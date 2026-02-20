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
    a.is_disc,
    a.is_fun,
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
