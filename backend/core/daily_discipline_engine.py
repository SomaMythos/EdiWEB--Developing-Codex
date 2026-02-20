from datetime import datetime, timedelta
from typing import List, Dict
from data.database import Database
from core.daily_override_engine import DailyOverrideEngine


class DailyDisciplineEngine:

    @staticmethod
    def _get_week_start(target_date: str) -> str:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        start = dt - timedelta(days=dt.weekday())
        return start.date().isoformat()

    @staticmethod
    def build_today_activity_list(target_date: str, free_minutes: int) -> List[Dict]:

        with Database() as db:

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

            # ==============================
            # 3️⃣ FILTRAR POR FREQUENCY_TYPE
            # ==============================

            filtered_activities = []

            for act in activities:

                freq = act["frequency_type"] or "flex"

                if freq == "flex":
                    filtered_activities.append(dict(act))

                elif freq == "everyday":
                    filtered_activities.append(dict(act))

                elif freq == "workday" and day_type == "work":
                    filtered_activities.append(dict(act))

                elif freq == "offday" and day_type == "off":
                    filtered_activities.append(dict(act))

            if not filtered_activities:
                return []

            # ==============================
            # 4️⃣ SEPARAR FIXED TIME E FLEX
            # ==============================

            fixed_time_activities = []
            flex_pool = []

            for act in filtered_activities:

                if act["fixed_time"] and act["fixed_duration"]:
                    fixed_time_activities.append(dict(act))
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

            DISC_WEIGHT = config["discipline_weight"] or 1
            FUN_WEIGHT = config["fun_weight"] or 1

            for act in flex_pool:
                is_disc = bool(act.get("is_disc"))
                category_weight = DISC_WEIGHT if is_disc else FUN_WEIGHT

                stats = weekly_stats_map.get(act["id"], {})
                times_scheduled = stats.get("times_scheduled", 0)
                times_completed = stats.get("times_completed", 0)
                execution_deficit = max(times_scheduled - times_completed, 0)

                activity_adjustment = 1 + (execution_deficit * 0.3)
                act["final_weight"] = max(category_weight, 0.1) * activity_adjustment

            total_weight = DISC_WEIGHT + FUN_WEIGHT

            if total_weight <= 0:
                total_weight = 1

            disc_target_minutes = int((DISC_WEIGHT / total_weight) * free_minutes)
            fun_target_minutes = free_minutes - disc_target_minutes

            disc_pool.sort(key=lambda activity: activity.get("final_weight", 1), reverse=True)
            fun_pool.sort(key=lambda activity: activity.get("final_weight", 1), reverse=True)

            disc_used = 0
            fun_used = 0

            disc_index = 0
            fun_index = 0

            turn_disc = True

            while True:

                if turn_disc:
                    if disc_index < len(disc_pool) and disc_used < disc_target_minutes:
                        act = disc_pool[disc_index]
                        duration = act["min_duration"]

                        if disc_used + duration <= disc_target_minutes:
                            final_list.append(act)
                            disc_used += duration

                        disc_index += 1

                    turn_disc = False

                else:
                    if fun_index < len(fun_pool) and fun_used < fun_target_minutes:
                        act = fun_pool[fun_index]
                        duration = act["min_duration"]

                        if fun_used + duration <= fun_target_minutes:
                            final_list.append(act)
                            fun_used += duration

                        fun_index += 1

                    turn_disc = True

                if (
                    (disc_index >= len(disc_pool) or disc_used >= disc_target_minutes)
                    and
                    (fun_index >= len(fun_pool) or fun_used >= fun_target_minutes)
                ):
                    break

            return final_list
