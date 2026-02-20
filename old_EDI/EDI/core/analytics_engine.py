from datetime import date, timedelta
from data.database import Database
from core.goal_engine import GoalEngine
from core.shopping_engine import ShoppingEngine


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
        goals = GoalEngine.list_goals()
        overview = []

        for g in goals:
            overview.append({
                "title": g["title"],
                "progress": GoalEngine.calculate_progress(g["id"]),
                "stalled": GoalEngine.is_stalled(g["id"])
            })

        return overview

    # =========================
    # PRODUTIVIDADE POR DIA
    # =========================
    @staticmethod
    def productivity_by_day(days=7):
        since = (date.today() - timedelta(days=days)).isoformat()
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    date,
                    total_activities,
                    completed_activities,
                    total_time_minutes,
                    productivity_score
                FROM daily_stats
                WHERE date >= ?
                ORDER BY date DESC
                """,
                (since,),
            )
        return rows

    # =========================
    # HISTÓRICO DIÁRIO DETALHADO
    # =========================
    @staticmethod
    def daily_log_details(days=7):
        since = (date.today() - timedelta(days=days)).isoformat()
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    dl.date,
                    a.title,
                    dal.duration,
                    dal.completed,
                    dal.timestamp
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                JOIN activities a ON a.id = dal.activity_id
                WHERE dl.date >= ?
                ORDER BY dl.date DESC, dal.timestamp DESC
                """,
                (since,),
            )
        return rows

    # =========================
    # ITENS PERTO DE REPOSIÇÃO
    # =========================
    @staticmethod
    def items_near_restock():
        return ShoppingEngine.get_items_near_restock()
