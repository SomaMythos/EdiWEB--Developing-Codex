#activity_engine.py#

from data.database import Database


class ActivityEngine:

    @staticmethod
    def uses_neutral_category(frequency_type="flex", fixed_time=None, fixed_duration=None):
        frequency = (frequency_type or "flex").strip().lower()
        has_fixed_schedule = bool(fixed_time) and fixed_duration is not None
        return frequency in {"everyday", "intercalate"} or has_fixed_schedule

    @staticmethod
    def normalize_category_flags(
        frequency_type="flex",
        fixed_time=None,
        fixed_duration=None,
        is_disc=1,
        is_fun=0,
    ):
        if ActivityEngine.uses_neutral_category(frequency_type, fixed_time, fixed_duration):
            return 0, 0
        return int(bool(is_disc)), int(bool(is_fun))

    @staticmethod
    def normalize_activity_record(activity):
        normalized = dict(activity)
        is_disc, is_fun = ActivityEngine.normalize_category_flags(
            frequency_type=normalized.get("frequency_type"),
            fixed_time=normalized.get("fixed_time"),
            fixed_duration=normalized.get("fixed_duration"),
            is_disc=normalized.get("is_disc"),
            is_fun=normalized.get("is_fun"),
        )
        normalized["is_disc"] = is_disc
        normalized["is_fun"] = is_fun
        return normalized

    @staticmethod
    def resolve_block_category(activity):
        normalized = ActivityEngine.normalize_activity_record(activity)
        if normalized.get("is_disc"):
            return "disciplina"
        if normalized.get("is_fun"):
            return "diversao"
        return "base"

    @staticmethod
    def list_activities():
        with Database() as db:
            rows = db.fetchall("""
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
                    is_fun,
                    active
                FROM activities
                ORDER BY title
            """)
            return [ActivityEngine.normalize_activity_record(row) for row in rows]

    @staticmethod
    def create_activity(
        title,
        min_duration,
        max_duration,
        frequency_type="flex",
        intercalate_days=None,
        fixed_time=None,
        fixed_duration=None,
        is_disc=1,
        is_fun=0
    ):
        with Database() as db:
            db.execute("""
                INSERT INTO activities (
                    title,
                    min_duration,
                    max_duration,
                    frequency_type,
                    intercalate_days,
                    fixed_time,
                    fixed_duration,
                    is_disc,
                    is_fun,
                    active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun
            ))

    @staticmethod
    def toggle_activity(activity_id):
        with Database() as db:
            db.execute("""
                UPDATE activities
                SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END
                WHERE id = ?
            """, (activity_id,))

    @staticmethod
    def update_activity(
        activity_id,
        title,
        min_duration,
        max_duration,
        frequency_type="flex",
        intercalate_days=None,
        fixed_time=None,
        fixed_duration=None,
        is_disc=1,
        is_fun=0
    ):
        with Database() as db:
            cursor = db.execute("""
                UPDATE activities
                SET
                    title = ?,
                    min_duration = ?,
                    max_duration = ?,
                    frequency_type = ?,
                    intercalate_days = ?,
                    fixed_time = ?,
                    fixed_duration = ?,
                    is_disc = ?,
                    is_fun = ?
                WHERE id = ?
            """, (
                title,
                min_duration,
                max_duration,
                frequency_type,
                intercalate_days,
                fixed_time,
                fixed_duration,
                is_disc,
                is_fun,
                activity_id
            ))
            return cursor.rowcount > 0

    @staticmethod
    def delete_activity(activity_id):
        with Database() as db:
            db.execute(
                "DELETE FROM activities WHERE id = ?",
                (activity_id,)
            )
