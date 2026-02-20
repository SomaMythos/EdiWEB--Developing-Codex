from datetime import date, timedelta

from data.database import Database
from core.book_engine import BookEngine
from core.shopping_engine import ShoppingEngine
from core.user_profile_engine import UserProfileEngine
from core.reminder_engine import ReminderEngine


class DashboardEngine:
    @staticmethod
    def get_today_overview():
        overview = {}
        profile = UserProfileEngine.get_profile()
        if profile:
            overview["user"] = {"name": profile["name"], "age": UserProfileEngine.get_age(profile)}

        today = date.today().isoformat()
        with Database() as db:
            activity = db.fetchone(
                """
                SELECT COUNT(*) as total, SUM(completed) as completed, SUM(duration) as total_minutes
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE dl.date = ?
                """,
                (today,),
            )

        overview["activities"] = {
            "total": activity["total"] or 0,
            "completed": activity["completed"] or 0,
            "total_minutes": activity["total_minutes"] or 0,
        }
        overview["reading"] = BookEngine.get_reading_stats()
        overview["shopping"] = ShoppingEngine.get_shopping_stats()
        overview["reminders"] = {"urgent": len(ReminderEngine.get_upcoming_reminders(days_ahead=3))}
        return overview

    @staticmethod
    def get_weekly_summary():
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        with Database() as db:
            summary = db.fetchone(
                """
                SELECT COUNT(DISTINCT dl.date) as days_active, COUNT(dal.id) as total_activities,
                SUM(dal.completed) as completed_activities, SUM(dal.duration) as total_minutes
                FROM daily_logs dl
                LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
                WHERE dl.date >= ?
                """,
                (week_ago,),
            )
        total = summary["total_activities"] or 0
        completed = summary["completed_activities"] or 0
        return {
            "days_active": summary["days_active"] or 0,
            "total_activities": total,
            "completed_activities": completed,
            "total_hours": round((summary["total_minutes"] or 0) / 60, 1),
            "completion_rate": round((completed / max(total, 1)) * 100, 1),
        }
