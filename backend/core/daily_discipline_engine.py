from datetime import datetime, timedelta
from typing import List, Dict
from data.database import Database


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

            dt = datetime.strptime(target_date, "%Y-%m-%d")
            weekday = dt.weekday()
            is_weekend = weekday >= 5
            day_type = "off" if is_weekend else "work"

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

            DISC_WEIGHT = config["discipline_weight"] or 1
            FUN_WEIGHT = config["fun_weight"] or 1

            total_weight = DISC_WEIGHT + FUN_WEIGHT

            disc_target_minutes = int((DISC_WEIGHT / total_weight) * free_minutes)
            fun_target_minutes = free_minutes - disc_target_minutes

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


