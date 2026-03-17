from datetime import datetime, timedelta, date
from typing import Dict, Any, List
from core.activity_engine import ActivityEngine
from data.database import Database
from core.day_engine import generate_day_schedule
from core.daily_discipline_engine import DailyDisciplineEngine
from core.notification_center_engine import NotificationCenterEngine
from core.time_overlap import add_minutes, intervals_overlap

class DailyEngine:
    DEFAULT_CALENDAR_EVENT_DURATION = 60

    @staticmethod
    def _hm_to_min(hm: str) -> int:
        h, m = map(int, hm.split(":"))
        return h * 60 + m

    @staticmethod
    def _safe_calendar_duration(start_time: str, end_time: str):
        normalized_start = (start_time or "").strip()
        if not normalized_start:
            return None

        try:
            start_minutes = DailyEngine._hm_to_min(normalized_start)
        except Exception:
            return None

        normalized_end = (end_time or "").strip()
        if normalized_end:
            try:
                end_minutes = DailyEngine._hm_to_min(normalized_end)
                if end_minutes > start_minutes:
                    return end_minutes - start_minutes
            except Exception:
                pass

        return DailyEngine.DEFAULT_CALENDAR_EVENT_DURATION

    @staticmethod
    def _list_calendar_event_blocks(target_date: str):
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT id, title, description, start_time, end_time, is_completed, completed_at
                FROM calendar_events
                WHERE event_date = ?
                  AND COALESCE(start_time, '') <> ''
                ORDER BY start_time ASC, title ASC
                """,
                (target_date,),
            )

        blocks = []
        for row in rows:
            duration = DailyEngine._safe_calendar_duration(row["start_time"], row["end_time"])
            if duration is None:
                continue

            blocks.append(
                {
                    "id": f"calendar-{row['id']}",
                    "calendar_event_id": row["id"],
                    "start_time": row["start_time"],
                    "duration": duration,
                    "completed": bool(row["is_completed"]),
                    "source_type": "calendar",
                    "block_name": row["title"],
                    "block_category": "calendar",
                    "updated_source": "calendar",
                    "activity_id": None,
                    "activity_title": row["title"],
                    "description": row["description"],
                    "completed_at": row["completed_at"],
                }
            )

        return blocks

    @staticmethod
    def _list_calendar_fixed_events(target_date: str):
        fixed_events = []
        for block in DailyEngine._list_calendar_event_blocks(target_date):
            fixed_events.append(
                {
                    "id": f"calendar_event:{block['calendar_event_id']}",
                    "name": block["activity_title"],
                    "start_hm": block["start_time"],
                    "end_hm": add_minutes(block["start_time"], block["duration"]),
                    "category": "calendar",
                }
            )
        return fixed_events


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
        calendar_fixed_events = DailyEngine._list_calendar_fixed_events(target_date)

        # ===============================
        # CALCULAR TEMPO LIVRE DO DIA
        # ===============================

        occupied_minutes = 0

        # Sono
        sleep_start = DailyEngine._hm_to_min(config["sleep_start"])
        sleep_end = DailyEngine._hm_to_min(config["sleep_end"])

        if sleep_end <= sleep_start:
            occupied_minutes += (24 * 60 - sleep_start) + sleep_end
        else:
            occupied_minutes += sleep_end - sleep_start

        # Trabalho (se for work day)
        if day_type == "work":
            work_start = DailyEngine._hm_to_min(config["work_start"])
            work_end = DailyEngine._hm_to_min(config["work_end"])
            occupied_minutes += work_end - work_start

        # Rotinas fixas
        for block in fixed_blocks:
            start = DailyEngine._hm_to_min(block["start_time"])
            end = DailyEngine._hm_to_min(block["end_time"])
            if end > start:
                occupied_minutes += end - start

        for event in calendar_fixed_events:
            start = DailyEngine._hm_to_min(event["start_hm"])
            end = DailyEngine._hm_to_min(event["end_hm"])
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
            total = DailyEngine._hm_to_min(start_hm) + int(minutes)
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
                "category": ActivityEngine.resolve_block_category(act),
                "min_duration": int(act.get("planned_duration") or act["min_duration"]),
                "max_duration": int(act.get("planned_duration") or act["max_duration"]),
                "priority": int(act.get("placement_priority") or 5)
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

        start_min = DailyEngine._hm_to_min(sleep_start)
        end_min = DailyEngine._hm_to_min(sleep_end)

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
                "category": ActivityEngine.resolve_block_category(act)
            })

        fixed_events.extend(calendar_fixed_events)


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
                if str(item.get("source_id") or "").startswith("calendar_event:"):
                    continue

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
                    (date, start_time, duration, activity_id, source_type, block_name, block_category, updated_source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        target_date,
                        item["start_hm"],
                        duration,
                        activity_id,
                        source_type,
                        item["name"],
                        item.get("category"),
                        "auto"
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
                    d.block_name,
                    d.block_category,
                    d.updated_source,
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
        blocks.extend(DailyEngine._list_calendar_event_blocks(target_date))

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
                "linked_block_ids": [night_block["id"], early_block["id"]],
                "source_type": "fixed",
                "block_name": "Dormir",
                "block_category": "sleep",
                "updated_source": "auto",
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
        should_complete_notification = False

        with Database() as db:
            block = db.fetchone(
                """
                SELECT id, date, activity_id, completed, source_type, block_category, block_name
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

            is_sleep_block = (
                block["source_type"] == "fixed"
                and (block["block_category"] == "sleep" or block["block_name"] == "Dormir")
            )

            target_ids = [block["id"]]
            if is_sleep_block:
                sleep_rows = db.fetchall(
                    """
                    SELECT id
                    FROM daily_plan_blocks
                    WHERE date = ?
                      AND source_type = 'fixed'
                      AND (block_category = 'sleep' OR block_name = 'Dormir')
                    """,
                    (block["date"],)
                )
                target_ids = [row["id"] for row in sleep_rows] or [block["id"]]

            placeholders = ",".join("?" for _ in target_ids)
            db.execute(
                f"""
                UPDATE daily_plan_blocks
                SET completed = ?
                WHERE id IN ({placeholders})
                """,
                (new_completed, *target_ids)
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

            should_complete_notification = bool(new_completed)

        if should_complete_notification:
            for target_id in target_ids:
                NotificationCenterEngine.complete_daily_activity_notification(target_id)

    @staticmethod
    def update_block(
        block_id: int,
        start_time: str,
        duration: int,
        block_name: str = None,
        block_category: str = None,
        edit_source: str = "manual"
    ):
        with Database() as db:
            block = db.fetchone(
                """
                SELECT id, date
                FROM daily_plan_blocks
                WHERE id = ?
                """,
                (block_id,)
            )

            if not block:
                raise ValueError("Bloco não encontrado.")

            if duration <= 0:
                raise ValueError("duration deve ser maior que zero.")

            try:
                datetime.strptime(start_time, "%H:%M")
            except ValueError:
                raise ValueError("start_time deve estar no formato HH:MM.")

            proposed_end = add_minutes(start_time, duration)

            fixed_blocks = db.fetchall(
                """
                SELECT id, start_time, duration
                FROM daily_plan_blocks
                WHERE date = ?
                  AND source_type = 'fixed'
                  AND id != ?
                """,
                (block["date"], block_id)
            )

            for fixed_block in fixed_blocks:
                fixed_end = add_minutes(fixed_block["start_time"], fixed_block["duration"])
                if intervals_overlap(start_time, proposed_end, fixed_block["start_time"], fixed_end):
                    raise ValueError("Conflito de horário com bloco fixo.")

            db.execute(
                """
                UPDATE daily_plan_blocks
                SET start_time = ?,
                    duration = ?,
                    block_name = COALESCE(?, block_name),
                    block_category = COALESCE(?, block_category),
                    updated_source = ?
                WHERE id = ?
                """,
                (start_time, duration, block_name, block_category, edit_source, block_id)
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
        blocks = DailyEngine.get_day(target_date)
        total = len(blocks)

        if total == 0:
            return {
                "total_blocks": 0,
                "completed_blocks": 0,
                "percentage": 0
            }

        completed = sum(1 for block in blocks if bool(block["completed"]))
        percentage = int((completed / total) * 100)

        return {
            "total_blocks": total,
            "completed_blocks": completed,
            "percentage": percentage
        }
