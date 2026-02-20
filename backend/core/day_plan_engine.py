from datetime import date as date_module

from data.database import Database


class DayPlanEngine:
    @staticmethod
    def list_plan_blocks(plan_date=None):
        target_date = plan_date or date_module.today().isoformat()
        with Database() as db:
            return db.fetchall(
                """
                SELECT dp.id, dp.date, dp.start_time, dp.duration, dp.activity_id, dp.source_type, a.title
                FROM daily_plan_blocks dp
                LEFT JOIN activities a ON a.id = dp.activity_id
                WHERE dp.date = ?
                ORDER BY dp.start_time
                """,
                (target_date,),
            )

    @staticmethod
    def insert_plan_block(plan_date, start_time, duration, activity_id, source_type):
        with Database() as db:
            db.execute(
                "INSERT INTO daily_plan_blocks (date, start_time, duration, activity_id, source_type) VALUES (?, ?, ?, ?, ?)",
                (plan_date, start_time, duration, activity_id, source_type),
            )
            return db.lastrowid

    @staticmethod
    def remove_plan_block(block_id):
        with Database() as db:
            db.execute("DELETE FROM daily_plan_blocks WHERE id = ?", (block_id,))
