from datetime import date, datetime

from data.database import Database


class DailyLogEngine:

    @staticmethod
    def get_today_log_id(log_date=None):
        db = Database()
        selected_date = log_date or date.today().isoformat()

        row = db.fetchone(
            """
            SELECT id FROM daily_logs
            WHERE date = ?
            """,
            (selected_date,),
        )

        if row:
            log_id = row["id"]
        else:
            db.execute(
                """
                INSERT INTO daily_logs (date)
                VALUES (?)
                """,
                (selected_date,),
            )
            db.commit()
            log_id = db.lastrowid

        db.close()
        return log_id

    @staticmethod
    def _normalize_timestamp(timestamp, fallback_date):
        if not timestamp:
            now = datetime.now()
            return fallback_date, now.strftime("%H:%M:%S")

        if "T" in timestamp or " " in timestamp:
            normalized_value = timestamp.replace("Z", "+00:00")
            parsed_datetime = datetime.fromisoformat(normalized_value)
            return parsed_datetime.date().isoformat(), parsed_datetime.strftime("%H:%M:%S")

        for fmt in ("%H:%M:%S", "%H:%M"):
            try:
                parsed_time = datetime.strptime(timestamp, fmt)
                return fallback_date, parsed_time.strftime("%H:%M:%S")
            except ValueError:
                continue

        raise ValueError("Timestamp inválido para registro diário.")

    @staticmethod
    def list_day(log_date=None):
        db = Database()
        selected_date = log_date or date.today().isoformat()

        rows = db.fetchall(
            """
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
            """,
            (selected_date,),
        )

        db.close()
        return rows

    @staticmethod
    def register_activity(activity_id, duration=0, completed=0, timestamp=None, log_date=None):
        db = Database()
        fallback_date = log_date or date.today().isoformat()
        resolved_date, resolved_timestamp = DailyLogEngine._normalize_timestamp(timestamp, fallback_date)
        log_id = DailyLogEngine.get_today_log_id(resolved_date)

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
            (log_id, activity_id, duration, completed, resolved_timestamp),
        )

        db.commit()
        db.close()
