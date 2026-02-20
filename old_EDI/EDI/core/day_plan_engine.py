from datetime import date as date_module

from data.database import Database


class DayPlanEngine:
    @staticmethod
    def list_plan_blocks(plan_date=None):
        target_date = plan_date or date_module.today().isoformat()
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    dp.id,
                    dp.date,
                    dp.start_time,
                    dp.duration,
                    dp.activity_id,
                    dp.source_type,
                    a.title,
                    at.role
                FROM daily_plan_blocks dp
                LEFT JOIN activities a ON a.id = dp.activity_id
                LEFT JOIN activity_types at ON at.id = a.type_id
                WHERE dp.date = ?
                ORDER BY dp.start_time
                """,
                (target_date,),
            )
        return rows

    @staticmethod
    def list_fixed_blocks():
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    fdb.id,
                    fdb.start_time,
                    fdb.duration,
                    fdb.activity_id,
                    fdb.source_type,
                    a.title,
                    at.role
                FROM fixed_daily_blocks fdb
                LEFT JOIN activities a ON a.id = fdb.activity_id
                LEFT JOIN activity_types at ON at.id = a.type_id
                ORDER BY fdb.start_time
                """
            )
        return rows

    @staticmethod
    def clear_plan(plan_date=None):
        target_date = plan_date or date_module.today().isoformat()
        with Database() as db:
            db.execute(
                """
                DELETE FROM daily_plan_blocks
                WHERE date = ?
                """,
                (target_date,),
            )

    @staticmethod
    def insert_plan_block(plan_date, start_time, duration, activity_id, source_type):
        with Database() as db:
            db.execute(
                """
                INSERT INTO daily_plan_blocks (
                    date,
                    start_time,
                    duration,
                    activity_id,
                    source_type
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (plan_date, start_time, duration, activity_id, source_type),
            )

    @staticmethod
    def update_plan_block(block_id, activity_id, source_type):
        with Database() as db:
            db.execute(
                """
                UPDATE daily_plan_blocks
                SET activity_id = ?, source_type = ?
                WHERE id = ?
                """,
                (activity_id, source_type, block_id),
            )

    @staticmethod
    def remove_plan_block(block_id):
        with Database() as db:
            db.execute(
                """
                DELETE FROM daily_plan_blocks
                WHERE id = ?
                """,
                (block_id,),
            )

    @staticmethod
    def upsert_fixed_block(start_time, duration, activity_id, source_type):
        with Database() as db:
            existing = db.fetchone(
                """
                SELECT id
                FROM fixed_daily_blocks
                WHERE start_time = ?
                """,
                (start_time,),
            )
            if existing:
                db.execute(
                    """
                    UPDATE fixed_daily_blocks
                    SET duration = ?, activity_id = ?, source_type = ?
                    WHERE id = ?
                    """,
                    (duration, activity_id, source_type, existing["id"]),
                )
            else:
                db.execute(
                    """
                    INSERT INTO fixed_daily_blocks (
                        start_time,
                        duration,
                        activity_id,
                        source_type
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (start_time, duration, activity_id, source_type),
                )

    @staticmethod
    def remove_fixed_block(block_id):
        with Database() as db:
            db.execute(
                """
                DELETE FROM fixed_daily_blocks
                WHERE id = ?
                """,
                (block_id,),
            )
