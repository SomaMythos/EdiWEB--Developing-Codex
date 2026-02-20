from datetime import datetime, timedelta, date
from typing import Dict, Any, List
from data.database import Database
from core.day_engine import generate_day_schedule
from core.daily_discipline_engine import DailyDisciplineEngine

class DailyEngine:

    @staticmethod
    def _upsert_weekly_activity_counter(
        db: Database,
        week_start: str,
        activity_id: int,
        field: str,
        delta: int
    ):
        if not activity_id or field not in {"times_scheduled", "times_completed"} or delta == 0:
            return

        db.execute(
            """
            INSERT INTO weekly_activity_stats
            (week_start, activity_id, times_scheduled, times_completed)
            VALUES (?, ?, 0, 0)
            ON CONFLICT(week_start, activity_id) DO NOTHING
            """,
            (week_start, activity_id)
        )

        db.execute(
            f"""
            UPDATE weekly_activity_stats
            SET {field} = MAX({field} + ?, 0)
            WHERE week_start = ?
              AND activity_id = ?
            """,
            (delta, week_start, activity_id)
        )

    # ==========================================================
    # CONFIG
    # ==========================================================

    @staticmethod
    def get_config():
        with Database() as db:
            return db.fetchone("SELECT * FROM daily_config WHERE id = 1")

    # ==========================================================
    # DAY TYPE LOGIC
    # ==========================================================

    @staticmethod
    def is_off_day(target_date: str) -> bool:
        with Database() as db:
            row = db.fetchone(
                "SELECT is_off FROM daily_overrides WHERE date = ?",
                (target_date,)
            )
            return bool(row["is_off"]) if row else False

    @staticmethod
    def get_day_type(target_date: str) -> str:
        weekday = datetime.strptime(target_date, "%Y-%m-%d").weekday()
        is_weekend = weekday >= 5

        if DailyEngine.is_off_day(target_date):
            return "off"

        return "off" if is_weekend else "work"

    # ==========================================================
    # ROUTINES (FIXED BLOCKS)
    # ==========================================================

    @staticmethod
    def get_fixed_blocks(day_type: str):
        with Database() as db:
            routine = db.fetchone(
                "SELECT id FROM daily_routines WHERE day_type = ?",
                (day_type,)
            )
            if not routine:
                return []

            blocks = db.fetchall(
                """
                SELECT id, name, start_time, end_time, category
                FROM daily_routine_blocks
                WHERE routine_id = ?
                ORDER BY start_time
                """,
                (routine["id"],)
            )
            return blocks

    # ==========================================================
    # ACTIVITY TEMPLATES
    # ==========================================================

    @staticmethod
    def get_activity_templates():
        with Database() as db:
            return db.fetchall(
                """
                SELECT 
                    id,
                    title as name,
                    'activity' as category,
                    COALESCE(min_time, estimated_time, 30) as min_duration,
                    COALESCE(max_time, estimated_time, 60) as max_duration,
                    5 as priority
                FROM activities
                WHERE active = 1
                """
            )

    @staticmethod
    def generate_day(target_date: str) -> Dict[str, Any]:

        config = DailyEngine.get_config()
        day_type = DailyEngine.get_day_type(target_date)
        fixed_blocks = DailyEngine.get_fixed_blocks(day_type)

        # ===============================
        # CALCULAR TEMPO LIVRE DO DIA
        # ===============================

        def _hm_to_min(hm: str) -> int:
            h, m = map(int, hm.split(":"))
            return h * 60 + m

        occupied_minutes = 0

        # Sono
        sleep_start = _hm_to_min(config["sleep_start"])
        sleep_end = _hm_to_min(config["sleep_end"])

        if sleep_end <= sleep_start:
            occupied_minutes += (24 * 60 - sleep_start) + sleep_end
        else:
            occupied_minutes += sleep_end - sleep_start

        # Trabalho (se for work day)
        if day_type == "work":
            work_start = _hm_to_min(config["work_start"])
            work_end = _hm_to_min(config["work_end"])
            occupied_minutes += work_end - work_start

        # Rotinas fixas
        for block in fixed_blocks:
            start = _hm_to_min(block["start_time"])
            end = _hm_to_min(block["end_time"])
            if end > start:
                occupied_minutes += end - start

        free_minutes = max((24 * 60) - occupied_minutes, 0)

        # ===============================
        # DISCIPLINE ENGINE (CORRIGIDO)
        # ===============================

        discipline_activities = DailyDisciplineEngine.build_today_activity_list(
            target_date,
            free_minutes
        )

        templates: List[Dict[str, Any]] = []
        fixed_discipline_activities: List[Dict[str, Any]] = []

        def _add_minutes_to_hm(start_hm: str, minutes: int) -> str:
            total = _hm_to_min(start_hm) + int(minutes)
            total = total % (24 * 60)
            h = total // 60
            m = total % 60
            return f"{h:02d}:{m:02d}"

        for act in discipline_activities:

            if act.get("fixed_time") and act.get("fixed_duration"):
                fixed_discipline_activities.append(act)
                continue

            templates.append({
                "id": act["id"],
                "name": act["title"],
                "category": "disciplina" if act["is_disc"] else "diversao",
                "min_duration": act["min_duration"],
                "max_duration": act["max_duration"],
                "priority": 5
            })

        # ===============================
        # FIXED EVENTS (sleep + work + routines)
        # ===============================

        fixed_events: List[Dict[str, Any]] = []

        # -------------------------------
        # SONO (tratamento cruzando meia-noite)
        # -------------------------------

        sleep_start = config["sleep_start"]
        sleep_end = config["sleep_end"]

        def _hm_to_min(hm: str) -> int:
            h, m = map(int, hm.split(":"))
            return h * 60 + m

        start_min = _hm_to_min(sleep_start)
        end_min = _hm_to_min(sleep_end)

        if end_min <= start_min:
            # Cruza meia-noite → dividir em dois blocos

            fixed_events.append({
                "id": "sleep_part_1",
                "name": "Dormir",
                "start_hm": sleep_start,
                "end_hm": "23:59",
                "category": "sleep"
            })

            fixed_events.append({
                "id": "sleep_part_2",
                "name": "Dormir",
                "start_hm": "00:00",
                "end_hm": sleep_end,
                "category": "sleep"
            })

        else:
            fixed_events.append({
                "id": "sleep",
                "name": "Dormir",
                "start_hm": sleep_start,
                "end_hm": sleep_end,
                "category": "sleep"
            })

        # -------------------------------
        # TRABALHO
        # -------------------------------

        if day_type == "work":
            fixed_events.append({
                "id": "work",
                "name": "Trabalhar",
                "start_hm": config["work_start"],
                "end_hm": config["work_end"],
                "category": "work"
            })

        # -------------------------------
        # BLOCOS FIXOS DA ROTINA
        # -------------------------------

        for block in fixed_blocks:
            fixed_events.append({
                "id": f"block_{block['id']}",
                "name": block["name"],
                "start_hm": block["start_time"],
                "end_hm": block["end_time"],
                "category": block["category"]
            })

        # -------------------------------
        # ATIVIDADES COM HORÁRIO FIXO
        # -------------------------------

        for act in fixed_discipline_activities:
            fixed_events.append({
                "id": f"fixed_activity:{act['id']}",
                "name": act["title"],
                "start_hm": act["fixed_time"],
                "end_hm": _add_minutes_to_hm(act["fixed_time"], act["fixed_duration"]),
                "category": "disciplina" if act["is_disc"] else "diversao"
            })


        # ===============================
        # SCHEDULER
        # ===============================

        result = generate_day_schedule(
            fixed_events,
            templates,
            buffer_between=config["buffer_between"],
            granularity_min=config["granularity_min"],
            seed=None,
            avoid_category_adjacent=bool(config["avoid_category_adjacent"])
        )

        DailyEngine.save_plan(target_date, result["scheduled"])

        return result



    # ==========================================================
    # SAVE PLAN
    # ==========================================================

    @staticmethod
    def save_plan(target_date: str, scheduled_items):

        with Database() as db:

            week_start = DailyDisciplineEngine._get_week_start(target_date)

            existing_blocks = db.fetchall(
                """
                SELECT activity_id, completed
                FROM daily_plan_blocks
                WHERE date = ?
                  AND activity_id IS NOT NULL
                """,
                (target_date,)
            )

            for block in existing_blocks:
                DailyEngine._upsert_weekly_activity_counter(
                    db,
                    week_start,
                    block["activity_id"],
                    "times_scheduled",
                    -1
                )

                if block["completed"]:
                    DailyEngine._upsert_weekly_activity_counter(
                        db,
                        week_start,
                        block["activity_id"],
                        "times_completed",
                        -1
                    )

            db.execute(
                "DELETE FROM daily_plan_blocks WHERE date = ?",
                (target_date,)
            )

            for item in scheduled_items:

                duration = item["end_min"] - item["start_min"]

                source_type = (
                    "fixed" if item["reason"] == "fixed" else "template"
                )

                activity_id = None

                if source_type == "template":
                    try:
                        activity_id = int(item["source_id"])
                    except:
                        activity_id = None
                elif source_type == "fixed":
                    source_id = str(item.get("source_id") or "")
                    if source_id.startswith("fixed_activity:"):
                        try:
                            activity_id = int(source_id.split(":", 1)[1].split("_", 1)[0])
                        except:
                            activity_id = None

                db.execute(
                    """
                    INSERT INTO daily_plan_blocks
                    (date, start_time, duration, activity_id, source_type, block_name)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        target_date,
                        item["start_hm"],
                        duration,
                        activity_id,
                        source_type,
                        item["name"]
                    )
                )

                if activity_id is not None:
                    DailyEngine._upsert_weekly_activity_counter(
                        db,
                        week_start,
                        activity_id,
                        "times_scheduled",
                        1
                    )

# ==========================================
# GET DAY
# ==========================================

    @staticmethod
    def get_day(target_date: str):

        with Database() as db:
            rows = db.fetchall(
                """
                SELECT 
                    d.id,
                    d.start_time,
                    d.duration,
                    d.completed,
                    d.source_type,
                    d.activity_id,
                    COALESCE(a.title, d.block_name) AS activity_title
                FROM daily_plan_blocks d
                LEFT JOIN activities a ON a.id = d.activity_id
                WHERE d.date = ?
                ORDER BY time(d.start_time)
                """,
                (target_date,)
            )

        blocks = [dict(r) for r in rows]

        # ==========================================
        # UNIFICAR BLOCOS DE SONO (visual apenas)
        # ==========================================

        sleep_blocks = [b for b in blocks if b["activity_title"] == "Dormir"]

        if len(sleep_blocks) == 2:

            block1, block2 = sleep_blocks

            if block1["start_time"] > block2["start_time"]:
                night_block = block1
                early_block = block2
            else:
                night_block = block2
                early_block = block1

            unified = {
                "id": night_block["id"],
                "start_time": night_block["start_time"],
                "duration": night_block["duration"] + early_block["duration"],
                "completed": night_block["completed"] and early_block["completed"],
                "source_type": "fixed",
                "activity_id": None,
                "activity_title": "Dormir"
            }

            blocks = [b for b in blocks if b["activity_title"] != "Dormir"]
            blocks.append(unified)

            blocks.sort(key=lambda x: x["start_time"])

        return blocks


# ==========================================
# TOGGLE COMPLETION
# ==========================================

    @staticmethod
    def toggle_block_completion(block_id: int, completed: bool):
        with Database() as db:
            block = db.fetchone(
                """
                SELECT date, activity_id, completed
                FROM daily_plan_blocks
                WHERE id = ?
                """,
                (block_id,)
            )

            if not block:
                return

            new_completed = 1 if completed else 0

            if int(block["completed"] or 0) == new_completed:
                return

            db.execute(
                """
                UPDATE daily_plan_blocks
                SET completed = ?
                WHERE id = ?
                """,
                (new_completed, block_id)
            )

            if block["activity_id"] is not None:
                week_start = DailyDisciplineEngine._get_week_start(block["date"])
                delta = 1 if new_completed else -1

                DailyEngine._upsert_weekly_activity_counter(
                    db,
                    week_start,
                    block["activity_id"],
                    "times_completed",
                    delta
                )


    @staticmethod
    def get_weekly_activity_stats(target_date: str):
        week_start = DailyDisciplineEngine._get_week_start(target_date)

        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    w.activity_id,
                    a.title AS activity_title,
                    w.times_scheduled,
                    w.times_completed
                FROM weekly_activity_stats w
                LEFT JOIN activities a ON a.id = w.activity_id
                WHERE w.week_start = ?
                ORDER BY w.times_scheduled DESC, w.activity_id ASC
                """,
                (week_start,)
            )

        return {
            "target_date": target_date,
            "week_start": week_start,
            "items": [dict(row) for row in rows]
        }


# ==========================================
# CONSISTENCY
# ==========================================

    @staticmethod
    def get_consistency(days: int = 7):

        results = []
        total_percentage = 0
        valid_days = 0

        today = date.today()

        with Database() as db:
            for i in range(days):
                target = today - timedelta(days=i)
                target_str = target.isoformat()

                blocks = db.fetchall(
                    """
                    SELECT completed
                    FROM daily_plan_blocks
                    WHERE date = ?
                    """,
                    (target_str,)
                )

                if not blocks:
                    continue

                total = len(blocks)
                completed = sum(1 for b in blocks if b["completed"])

                percentage = int((completed / total) * 100) if total > 0 else 0

                results.append({
                    "date": target_str,
                    "percentage": percentage
                })

                total_percentage += percentage
                valid_days += 1

        average = int(total_percentage / valid_days) if valid_days > 0 else 0

        return {
            "average": average,
            "days": list(reversed(results))
        }


# ==========================================
# DAY SUMMARY
# ==========================================

    @staticmethod
    def get_day_summary(target_date: str):

        with Database() as db:

            blocks = db.fetchall(
                """
                SELECT completed
                FROM daily_plan_blocks
                WHERE date = ?
                """,
                (target_date,)
            )

            total = len(blocks)

            if total == 0:
                return {
                    "total_blocks": 0,
                    "completed_blocks": 0,
                    "percentage": 0
                }

            completed = sum(1 for b in blocks if b["completed"])

            percentage = int((completed / total) * 100)

            return {
                "total_blocks": total,
                "completed_blocks": completed,
                "percentage": percentage
            }
