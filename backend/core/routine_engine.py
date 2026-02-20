from data.database import Database


class RoutineEngine:

    @staticmethod
    def list_routines():
        db = Database()
        rows = db.fetchall("""
            SELECT id, period, start_time, end_time
            FROM routines
            ORDER BY start_time
        """)
        return rows

    @staticmethod
    def create_routine(period, start_time=None, end_time=None):
        db = Database()
        db.execute(
            "INSERT INTO routines (period, start_time, end_time) VALUES (?, ?, ?)",
            (period, start_time, end_time)
        )
        db.commit()

    @staticmethod
    def get_blocks(routine_id):
        db = Database()
        rows = db.fetchall("""
            SELECT rb.id, rb.activity_id, rb.duration, rb.auto_fill_allowed, rb.completed, a.title AS activity_title
            FROM routine_blocks rb
            LEFT JOIN activities a ON a.id = rb.activity_id
            WHERE rb.routine_id = ?
            ORDER BY rb.id
        """, (routine_id,))
        return rows

    @staticmethod
    def add_block(routine_id, activity_id, duration, auto_fill_allowed=1):
        db = Database()
        db.execute("""
            INSERT INTO routine_blocks (routine_id, activity_id, duration, auto_fill_allowed)
            VALUES (?, ?, ?, ?)
        """, (routine_id, activity_id, duration, auto_fill_allowed))
        db.commit()
        return True, "Bloco adicionado com sucesso"

    @staticmethod
    def update_block(block_id, activity_id, duration, auto_fill_allowed=1):
        db = Database()
        cursor = db.execute(
            """
            UPDATE routine_blocks
            SET activity_id = ?, duration = ?, auto_fill_allowed = ?
            WHERE id = ?
            """,
            (activity_id, duration, auto_fill_allowed, block_id),
        )
        db.commit()
        return cursor.rowcount > 0

    @staticmethod
    def delete_block(block_id):
        db = Database()
        cursor = db.execute("DELETE FROM routine_blocks WHERE id = ?", (block_id,))
        db.commit()
        return cursor.rowcount > 0

    @staticmethod
    def complete_block(block_id, completed):
        db = Database()
        cursor = db.execute(
            "UPDATE routine_blocks SET completed = ? WHERE id = ?",
            (1 if completed else 0, block_id),
        )
        db.commit()
        return cursor.rowcount > 0
