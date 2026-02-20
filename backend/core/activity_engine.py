#activity_engine.py#

from data.database import Database


class ActivityEngine:

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
                    fixed_time,
                    fixed_duration,
                    is_disc,
                    is_fun,
                    active
                FROM activities
                ORDER BY title
            """)
            return rows

    @staticmethod
    def create_activity(
        title,
        min_duration,
        max_duration,
        frequency_type="flex",
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
                    fixed_time,
                    fixed_duration,
                    is_disc,
                    is_fun,
                    active
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (
                title,
                min_duration,
                max_duration,
                frequency_type,
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
    def delete_activity(activity_id):
        with Database() as db:
            db.execute(
                "DELETE FROM activities WHERE id = ?",
                (activity_id,)
            )
