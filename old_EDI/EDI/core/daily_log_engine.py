from datetime import date
from data.database import Database


class DailyLogEngine:

    @staticmethod
    def get_today_log_id():
        db = Database()
        today = date.today().isoformat()

        row = db.fetchone("""
            SELECT id FROM daily_logs
            WHERE date = ?
        """, (today,))

        if row:
            log_id = row["id"]
        else:
            db.execute("""
                INSERT INTO daily_logs (date)
                VALUES (?)
            """, (today,))
            db.commit()
            log_id = db.lastrowid

        db.close()
        return log_id

    # 🔹 Método esperado pela HomeScreen
    @staticmethod
    def list_day():
        db = Database()
        today = date.today().isoformat()

        rows = db.fetchall("""
            SELECT
                dal.id,
                a.title,
                at.role,
                dal.duration,
                dal.completed,
                dal.timestamp as start,
                CASE 
                    WHEN dal.duration IS NOT NULL 
                    THEN time(dal.timestamp, '+' || dal.duration || ' minutes')
                    ELSE dal.timestamp
                END as end
            FROM daily_activity_logs dal
            JOIN daily_logs dl ON dl.id = dal.daily_log_id
            JOIN activities a ON a.id = dal.activity_id
            JOIN activity_types at ON at.id = a.type_id
            WHERE dl.date = ?
            ORDER BY dal.timestamp
        """, (today,))

        db.close()
        return rows

    @staticmethod
    def register_activity(activity_id, duration=0, completed=0):
        from datetime import datetime
        db = Database()
        log_id = DailyLogEngine.get_today_log_id()

        timestamp = datetime.now().strftime("%H:%M:%S")

        db.execute("""
            INSERT INTO daily_activity_logs (
                daily_log_id,
                activity_id,
                duration,
                completed,
                timestamp
            ) VALUES (?, ?, ?, ?, ?)
        """, (log_id, activity_id, duration, completed, timestamp))

        db.commit()
        db.close()
        DailyLogEngine.upsert_daily_stats()

    @staticmethod
    def is_activity_logged(activity_id, timestamp):
        db = Database()
        log_id = DailyLogEngine.get_today_log_id()
        row = db.fetchone(
            """
            SELECT id
            FROM daily_activity_logs
            WHERE daily_log_id = ? AND activity_id = ? AND timestamp = ?
            """,
            (log_id, activity_id, timestamp),
        )
        db.close()
        return bool(row)

    @staticmethod
    def register_activity_at(activity_id, duration, completed, timestamp):
        db = Database()
        log_id = DailyLogEngine.get_today_log_id()

        db.execute(
            """
            INSERT INTO daily_activity_logs (
                daily_log_id,
                activity_id,
                duration,
                completed,
                timestamp
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (log_id, activity_id, duration, completed, timestamp),
        )

        db.commit()
        db.close()
        DailyLogEngine.upsert_daily_stats()

    @staticmethod
    def get_daily_stats(log_date=None):
        target_date = log_date or date.today().isoformat()
        with Database() as db:
            return db.fetchone(
                """
                SELECT
                    date,
                    total_activities,
                    completed_activities,
                    total_time_minutes,
                    productivity_score
                FROM daily_stats
                WHERE date = ?
                """,
                (target_date,),
            )

    @staticmethod
    def upsert_daily_stats(log_date=None):
        target_date = log_date or date.today().isoformat()
        with Database() as db:
            stats = db.fetchone(
                """
                SELECT
                    COUNT(*) as total,
                    SUM(completed) as completed,
                    SUM(duration) as total_minutes
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE dl.date = ?
                """,
                (target_date,),
            )

            total_activities = stats["total"] or 0
            completed_activities = stats["completed"] or 0
            total_time_minutes = stats["total_minutes"] or 0
            productivity_score = (
                round((completed_activities / total_activities) * 100)
                if total_activities > 0
                else 0
            )

            db.execute(
                """
                INSERT INTO daily_stats (
                    date,
                    total_activities,
                    completed_activities,
                    total_time_minutes,
                    productivity_score
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    total_activities = excluded.total_activities,
                    completed_activities = excluded.completed_activities,
                    total_time_minutes = excluded.total_time_minutes,
                    productivity_score = excluded.productivity_score
                """,
                (
                    target_date,
                    total_activities,
                    completed_activities,
                    total_time_minutes,
                    productivity_score,
                ),
            )

        return {
            "date": target_date,
            "total_activities": total_activities,
            "completed_activities": completed_activities,
            "total_time_minutes": total_time_minutes,
            "productivity_score": productivity_score,
        }
