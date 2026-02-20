from datetime import date, timedelta

from data.database import Database


class ReminderEngine:
    @staticmethod
    def add_reminder(title, description=None, due_date=None, priority=3, category='pessoal', reminder_days_before=7):
        with Database() as db:
            db.execute(
                """
                INSERT INTO reminders (title, description, due_date, priority, category, reminder_days_before)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (title, description, due_date, priority, category, reminder_days_before),
            )
            return db.lastrowid

    @staticmethod
    def list_reminders(status='pendente'):
        with Database() as db:
            return db.fetchall(
                """
                SELECT * FROM reminders WHERE status = ?
                ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, priority ASC
                """,
                (status,),
            )

    @staticmethod
    def get_upcoming_reminders(days_ahead=7):
        end_date = (date.today() + timedelta(days=days_ahead)).isoformat()
        with Database() as db:
            return db.fetchall(
                """
                SELECT * FROM reminders
                WHERE status = 'pendente' AND due_date IS NOT NULL AND due_date <= ?
                ORDER BY due_date ASC
                """,
                (end_date,),
            )

    @staticmethod
    def complete_reminder(reminder_id):
        with Database() as db:
            db.execute("UPDATE reminders SET status = 'concluido', completed_at = ? WHERE id = ?", (date.today().isoformat(), reminder_id))
