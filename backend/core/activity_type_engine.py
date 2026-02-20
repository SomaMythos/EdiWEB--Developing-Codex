from data.database import Database


class ActivityTypeEngine:

    # ==========================================================
    # LIST
    # ==========================================================

    @staticmethod
    def list_types():
        db = Database()

        rows = db.fetchall("""
            SELECT
                id,
                title,
                weekly_target_blocks,
                max_consecutive_blocks,
                min_interval_days,
                distribution_weight
            FROM activity_types
            ORDER BY title
        """)

        db.close()
        return rows


    # ==========================================================
    # CREATE
    # ==========================================================

    @staticmethod
    def create_type(
        title,
        weekly_target_blocks=3,
        max_consecutive_blocks=1,
        min_interval_days=0,
        distribution_weight=1.0
    ):
        db = Database()

        db.execute("""
            INSERT INTO activity_types (
                title,
                weekly_target_blocks,
                max_consecutive_blocks,
                min_interval_days,
                distribution_weight
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            title,
            weekly_target_blocks,
            max_consecutive_blocks,
            min_interval_days,
            distribution_weight
        ))

        db.commit()
        db.close()


    # ==========================================================
    # UPDATE
    # ==========================================================

    @staticmethod
    def update_type(
        type_id,
        title,
        weekly_target_blocks,
        max_consecutive_blocks,
        min_interval_days,
        distribution_weight
    ):
        db = Database()

        db.execute("""
            UPDATE activity_types
            SET
                title = ?,
                weekly_target_blocks = ?,
                max_consecutive_blocks = ?,
                min_interval_days = ?,
                distribution_weight = ?
            WHERE id = ?
        """, (
            title,
            weekly_target_blocks,
            max_consecutive_blocks,
            min_interval_days,
            distribution_weight,
            type_id
        ))

        db.commit()
        db.close()


    # ==========================================================
    # DELETE
    # ==========================================================

    @staticmethod
    def delete_type(type_id):
        db = Database()

        db.execute("""
            DELETE FROM activity_types
            WHERE id = ?
        """, (type_id,))

        db.commit()
        db.close()
