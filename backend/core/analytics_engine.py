from datetime import date, timedelta
from data.database import Database
from core.goal_engine import GoalEngine


class AnalyticsEngine:

    # =========================
    # RESUMO DO DIA
    # =========================
    @staticmethod
    def today_summary():
        today = date.today().isoformat()
        db = Database()

        rows = db.fetchall("""
            SELECT completed, duration
            FROM daily_activity_logs d
            JOIN daily_logs l ON d.daily_log_id = l.id
            WHERE l.date = ?
        """, (today,))

        db.close()

        planned = len(rows)
        completed = sum(1 for r in rows if r["completed"])
        planned_time = sum(r["duration"] or 0 for r in rows)
        executed_time = sum((r["duration"] or 0) for r in rows if r["completed"])

        return {
            "planned": planned,
            "completed": completed,
            "planned_time": planned_time,
            "executed_time": executed_time
        }

    # =========================
    # ÚLTIMOS N DIAS
    # =========================
    @staticmethod
    def last_days(days=7):
        since = (date.today() - timedelta(days=days)).isoformat()
        db = Database()

        rows = db.fetchall("""
            SELECT l.date,
                   COUNT(d.id) AS total,
                   SUM(CASE WHEN d.completed = 1 THEN 1 ELSE 0 END) AS done,
                   SUM(d.duration) AS total_time
            FROM daily_logs l
            LEFT JOIN daily_activity_logs d ON d.daily_log_id = l.id
            WHERE l.date >= ?
            GROUP BY l.date
            ORDER BY l.date DESC
        """, (since,))

        db.close()
        return rows

    # =========================
    # ATIVIDADES MAIS FREQUENTES
    # =========================
    @staticmethod
    def top_activities(limit=5):
        db = Database()
        rows = db.fetchall("""
            SELECT a.title,
                   COUNT(d.id) AS executions
            FROM daily_activity_logs d
            JOIN activities a ON d.activity_id = a.id
            WHERE d.completed = 1
            GROUP BY a.title
            ORDER BY executions DESC
            LIMIT ?
        """, (limit,))
        db.close()
        return rows

    # =========================
    # METAS
    # =========================
    @staticmethod
    def goals_overview():
        goals = GoalEngine.list_goals(only_active=True)
        overview = []

        for g in goals:
            overview.append({
                "title": g["title"],
                "progress": GoalEngine.calculate_progress(g["id"]),
                "stalled": GoalEngine.is_stalled(g["id"])
            })

        return overview
