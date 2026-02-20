from data.database import Database


class ActivityTypeEngine:
    DEFAULT_PROGRESS_MODE = "frequencia"

    @staticmethod
    def _has_progress_mode_column(db):
        columns = db.fetchall("PRAGMA table_info(activity_types)")
        return any(column["name"] == "progress_mode" for column in columns)

    @staticmethod
    def list_types():
        db = Database()

        rows = db.fetchall("""
            SELECT
                id,
                title,
                role
            FROM activity_types
            ORDER BY title
        """)

        db.close()
        return rows

    @staticmethod
    def create_type(title, role):
        db = Database()

        if ActivityTypeEngine._has_progress_mode_column(db):
            db.execute(
                """
                INSERT INTO activity_types (title, role, progress_mode)
                VALUES (?, ?, ?)
                """,
                (title, role, ActivityTypeEngine.DEFAULT_PROGRESS_MODE),
            )
        else:
            db.execute(
                """
                INSERT INTO activity_types (title, role)
                VALUES (?, ?)
                """,
                (title, role),
            )

        db.commit()
        db.close()

    @staticmethod
    def update_type(type_id, title=None, role=None):
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if role is not None:
            updates.append("role = ?")
            params.append(role)

        if not updates:
            return False

        params.append(type_id)

        with Database() as db:
            db.execute(
                f"""
                UPDATE activity_types
                SET {', '.join(updates)}
                WHERE id = ?
                """,
                tuple(params),
            )
        return True

    @staticmethod
    def delete_type(type_id):
        db = Database()

        db.execute("""
            DELETE FROM activity_types
            WHERE id = ?
        """, (type_id,))

        db.commit()
        db.close()
