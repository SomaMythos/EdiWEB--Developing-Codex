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

        total = len(rows)
        done = sum(1 for r in rows if r["completed"])
        total_time = sum(r["duration"] or 0 for r in rows)
        completion_rate = round((done / total) * 100) if total > 0 else 0

        return {
            "total": total,
            "done": done,
            "total_time": total_time,
            "completion_rate": completion_rate
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

        normalized_rows = []
        for row in rows:
            total = row["total"] or 0
            done = row["done"] or 0
            total_time = row["total_time"] or 0
            normalized_rows.append({
                "date": row["date"],
                "total": total,
                "done": done,
                "total_time": total_time,
                "completion_rate": round((done / total) * 100) if total > 0 else 0,
            })

        return normalized_rows

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
