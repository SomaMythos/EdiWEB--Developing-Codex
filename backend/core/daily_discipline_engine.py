from datetime import datetime, timedelta
from typing import List, Dict
import random
from data.database import Database
from core.activity_engine import ActivityEngine
from core.daily_override_engine import DailyOverrideEngine


class DailyDisciplineEngine:

    @staticmethod
    def _mark_anchor_duration(activity: Dict) -> Dict:
        anchored = dict(activity)
        anchored["planned_duration"] = int(activity.get("min_duration") or 0)
        anchored["placement_priority"] = max(int(activity.get("placement_priority", 5)), 6)
        return anchored

    @staticmethod
    def _build_last_registration_map(db: Database, target_date: str, activity_ids: List[int]) -> Dict[int, str]:
        if not activity_ids:
            return {}

        placeholders = ",".join(["?"] * len(activity_ids))
        rows = db.fetchall(
            f"""
            SELECT
                source.activity_id,
                MAX(source.event_date) AS last_registered_date
            FROM (
                SELECT
                    dal.activity_id,
                    dl.date AS event_date
                FROM daily_activity_logs dal
                INNER JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE dal.activity_id IN ({placeholders})
                  AND dl.date <= ?
                  AND COALESCE(dal.completed, 0) = 1

                UNION ALL

                SELECT
                    dpb.activity_id,
                    dpb.date AS event_date
                FROM daily_plan_blocks dpb
                WHERE dpb.activity_id IN ({placeholders})
                  AND dpb.date <= ?
                  AND COALESCE(dpb.completed, 0) = 1
            ) AS source
            GROUP BY source.activity_id
            """,
            (*activity_ids, target_date, *activity_ids, target_date),
        )

        return {
            row["activity_id"]: row["last_registered_date"]
            for row in rows
            if row["last_registered_date"]
        }

    @staticmethod
    def _build_recent_schedule_map(db: Database, target_date: str, activity_ids: List[int]) -> Dict[int, Dict]:
        if not activity_ids:
            return {}

        target_dt = datetime.strptime(target_date, "%Y-%m-%d").date()
        lower_bound = (target_dt - timedelta(days=14)).isoformat()
        placeholders = ",".join(["?"] * len(activity_ids))

        rows = db.fetchall(
            f"""
            SELECT activity_id, date, COUNT(*) AS scheduled_count
            FROM daily_plan_blocks
            WHERE activity_id IN ({placeholders})
              AND date BETWEEN ? AND ?
            GROUP BY activity_id, date
            ORDER BY date DESC
            """,
            (*activity_ids, lower_bound, target_date)
        )

        recent_map: Dict[int, Dict] = {}

        for row in rows:
            activity_id = row["activity_id"]
            scheduled_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
            days_ago = (target_dt - scheduled_date).days
            info = recent_map.setdefault(
                activity_id,
                {
                    "recent_count": 0,
                    "distinct_days": 0,
                    "scheduled_today_count": 0,
                    "days_since_last": None,
                },
            )

            info["recent_count"] += row["scheduled_count"] or 0
            info["distinct_days"] += 1

            if row["date"] == target_date:
                info["scheduled_today_count"] += row["scheduled_count"] or 0

            if info["days_since_last"] is None or days_ago < info["days_since_last"]:
                info["days_since_last"] = days_ago

        return recent_map

    @staticmethod
    def _weighted_pick(rng: random.Random, pool: List[Dict]) -> Dict:
        total_weight = sum(max(float(item.get("selection_weight", 0.0)), 0.01) for item in pool)
        roll = rng.uniform(0, total_weight)
        cursor = 0.0

        for item in pool:
            cursor += max(float(item.get("selection_weight", 0.0)), 0.01)
            if roll <= cursor:
                return item

        return pool[-1]

    @staticmethod
    def _get_week_start(target_date: str) -> str:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        start = dt - timedelta(days=dt.weekday())
        return start.date().isoformat()

    @staticmethod
    def build_today_activity_list(target_date: str, free_minutes: int) -> List[Dict]:

        with Database() as db:
            rng = random.Random()

            # ==============================
            # 1️⃣ BUSCAR TODAS ATIVIDADES
            # ==============================

            activities = db.fetchall("""
                SELECT
                    id,
                    title,
                    min_duration,
                    max_duration,
                    frequency_type,
                    intercalate_days,
                    fixed_time,
                    fixed_duration,
                    is_disc,
                    is_fun
                FROM activities
                WHERE active = 1
            """)

            if not activities:
                return []

            # ==============================
            # 2️⃣ IDENTIFICAR TIPO DO DIA
            # ==============================

            day_type = DailyOverrideEngine.get_day_type(target_date)
            target_dt = datetime.strptime(target_date, "%Y-%m-%d").date()
            intercalated_ids = [
                act["id"]
                for act in activities
                if (act["frequency_type"] or "flex") == "intercalate"
            ]
            last_registration_map = DailyDisciplineEngine._build_last_registration_map(
                db,
                target_date,
                intercalated_ids,
            )

            # ==============================
            # 3️⃣ FILTRAR POR FREQUENCY_TYPE
            # ==============================

            filtered_activities = []

            for act in activities:
                normalized_activity = ActivityEngine.normalize_activity_record(act)

                freq = normalized_activity["frequency_type"] or "flex"

                if freq == "flex":
                    filtered_activities.append(normalized_activity)

                elif freq == "everyday":
                    filtered_activities.append(normalized_activity)

                elif freq == "workday" and day_type == "work":
                    filtered_activities.append(normalized_activity)

                elif freq == "offday" and day_type == "off":
                    filtered_activities.append(normalized_activity)

                elif freq == "intercalate":
                    minimum_days = normalized_activity["intercalate_days"] or 0
                    if minimum_days <= 0:
                        continue

                    last_registered_date = last_registration_map.get(normalized_activity["id"])
                    if not last_registered_date:
                        filtered_activities.append(normalized_activity)
                        continue

                    last_registered_dt = datetime.strptime(last_registered_date, "%Y-%m-%d").date()
                    days_since_last = (target_dt - last_registered_dt).days

                    # "intercalate_days" representa dias completos de espera
                    # entre uma execução e a próxima aparição na daily.
                    if days_since_last > minimum_days:
                        filtered_activities.append(normalized_activity)

            if not filtered_activities:
                return []

            # ==============================
            # 4️⃣ SEPARAR FIXED TIME E FLEX
            # ==============================

            fixed_time_activities = []
            flex_pool = []
            required_everyday_activities = []
            required_intercalate_activities = []

            for act in filtered_activities:
                frequency = (act["frequency_type"] or "flex")

                if act["fixed_time"] and act["fixed_duration"]:
                    fixed_time_activities.append(dict(act))
                elif frequency == "everyday":
                    required_everyday_activities.append(dict(act))
                elif frequency == "intercalate":
                    required_intercalate_activities.append(dict(act))
                else:
                    flex_pool.append(dict(act))

            final_list: List[Dict] = []

            # ==============================
            # 5️⃣ ADICIONAR FIXED TIME DIRETO
            # ==============================

            for act in fixed_time_activities:
                act["min_duration"] = act["fixed_duration"]
                act["max_duration"] = act["fixed_duration"]
                final_list.append(act)
                free_minutes -= act["fixed_duration"]

            for act in required_everyday_activities:
                final_list.append(act)
                free_minutes -= int(act["min_duration"] or 0)

            for act in required_intercalate_activities:
                final_list.append(act)
                free_minutes -= int(act["min_duration"] or 0)

            if free_minutes <= 0:
                return final_list

            # ==============================
            # 6️⃣ DISTRIBUIÇÃO DISC / FUN (original preservado)
            # ==============================

            disc_pool = []
            fun_pool = []

            for act in flex_pool:
                if act["is_disc"]:
                    disc_pool.append(act)
                elif act["is_fun"]:
                    fun_pool.append(act)

            config = db.fetchone("""
                SELECT discipline_weight, fun_weight
                FROM daily_config
                WHERE id = 1
            """)

            week_start = DailyDisciplineEngine._get_week_start(target_date)

            activity_ids = [act["id"] for act in flex_pool]
            weekly_stats_map = {}

            if activity_ids:
                placeholders = ",".join(["?"] * len(activity_ids))
                weekly_stats_rows = db.fetchall(
                    f"""
                    SELECT activity_id, times_scheduled, times_completed
                    FROM weekly_activity_stats
                    WHERE week_start = ?
                      AND activity_id IN ({placeholders})
                    """,
                    (week_start, *activity_ids)
                )

                weekly_stats_map = {
                    row["activity_id"]: {
                        "times_scheduled": row["times_scheduled"] or 0,
                        "times_completed": row["times_completed"] or 0
                    }
                    for row in weekly_stats_rows
                }

            recent_schedule_map = DailyDisciplineEngine._build_recent_schedule_map(
                db,
                target_date,
                activity_ids,
            )

            DISC_WEIGHT = config["discipline_weight"] or 1
            FUN_WEIGHT = config["fun_weight"] or 1

            for act in flex_pool:
                is_disc = bool(act.get("is_disc"))
                category_weight = DISC_WEIGHT if is_disc else FUN_WEIGHT

                stats = weekly_stats_map.get(act["id"], {})
                times_scheduled = stats.get("times_scheduled", 0)
                times_completed = stats.get("times_completed", 0)
                execution_deficit = max(times_scheduled - times_completed, 0)
                recent_stats = recent_schedule_map.get(act["id"], {})
                recent_count = recent_stats.get("recent_count", 0)
                distinct_days = recent_stats.get("distinct_days", 0)
                scheduled_today_count = recent_stats.get("scheduled_today_count", 0)
                days_since_last = recent_stats.get("days_since_last")

                activity_adjustment = 1 + (execution_deficit * 0.3)
                act["final_weight"] = max(category_weight, 0.1) * activity_adjustment
                recency_penalty = 1 / (1 + (recent_count * 0.18) + (distinct_days * 0.14))
                same_day_penalty = 1 / (1 + (scheduled_today_count * 2.25))

                if days_since_last is None:
                    freshness_bonus = 1.25
                elif days_since_last >= 7:
                    freshness_bonus = 1.18
                elif days_since_last >= 3:
                    freshness_bonus = 1.08
                else:
                    freshness_bonus = 1.0

                act["selection_weight"] = max(
                    act["final_weight"] * recency_penalty * same_day_penalty * freshness_bonus,
                    0.05,
                )

            total_weight = DISC_WEIGHT + FUN_WEIGHT

            if total_weight <= 0:
                total_weight = 1

            disc_target_minutes = int((DISC_WEIGHT / total_weight) * free_minutes)
            fun_target_minutes = free_minutes - disc_target_minutes

            disc_pool.sort(key=lambda activity: activity.get("final_weight", 1), reverse=True)
            fun_pool.sort(key=lambda activity: activity.get("final_weight", 1), reverse=True)

            disc_used = 0
            fun_used = 0
            selected_ids = {
                act["id"]
                for act in (
                    fixed_time_activities
                    + required_everyday_activities
                    + required_intercalate_activities
                )
            }

            turn_disc = True
            stalled_turns = 0
            flex_disc_selected = 0
            flex_fun_selected = 0

            # Garante pelo menos uma atividade de diversao quando ela estiver habilitada
            # pelo peso, houver atividade elegivel e existir tempo minimo para encaixe.
            guaranteed_fun_candidates = [
                act
                for act in fun_pool
                if act["id"] not in selected_ids
                and act["min_duration"] <= free_minutes
            ]
            has_fun_selected = any(act.get("is_fun") for act in final_list)

            if FUN_WEIGHT > 0 and not has_fun_selected and guaranteed_fun_candidates:
                guaranteed_fun = DailyDisciplineEngine._mark_anchor_duration(
                    DailyDisciplineEngine._weighted_pick(rng, guaranteed_fun_candidates)
                )
                final_list.append(guaranteed_fun)
                selected_ids.add(guaranteed_fun["id"])
                fun_used += guaranteed_fun["min_duration"]
                flex_fun_selected += 1
                turn_disc = True

            while stalled_turns < 2:
                progressed = False

                if turn_disc:
                    remaining = disc_target_minutes - disc_used
                    disc_candidates = [
                        act
                        for act in disc_pool
                        if act["id"] not in selected_ids
                        and act["min_duration"] <= remaining
                    ]

                    if disc_candidates:
                        act = DailyDisciplineEngine._weighted_pick(rng, disc_candidates)
                        if flex_disc_selected == 0:
                            act = DailyDisciplineEngine._mark_anchor_duration(act)
                        final_list.append(act)
                        selected_ids.add(act["id"])
                        disc_used += act["min_duration"]
                        flex_disc_selected += 1
                        progressed = True

                    turn_disc = False

                else:
                    remaining = fun_target_minutes - fun_used
                    fun_candidates = [
                        act
                        for act in fun_pool
                        if act["id"] not in selected_ids
                        and act["min_duration"] <= remaining
                    ]

                    if fun_candidates:
                        act = DailyDisciplineEngine._weighted_pick(rng, fun_candidates)
                        if flex_fun_selected == 0:
                            act = DailyDisciplineEngine._mark_anchor_duration(act)
                        final_list.append(act)
                        selected_ids.add(act["id"])
                        fun_used += act["min_duration"]
                        flex_fun_selected += 1
                        progressed = True

                    turn_disc = True

                stalled_turns = 0 if progressed else (stalled_turns + 1)

            return final_list
