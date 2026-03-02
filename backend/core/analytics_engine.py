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
    # NOVOS REPORTS DAILY
    # =========================
    @staticmethod
    def daily_overview():
        db = Database()

        def period_stats(where_clause):
            row = db.fetchone(
                f"""
                SELECT
                    COUNT(dal.id) AS total,
                    SUM(CASE WHEN dal.completed = 1 THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN dal.completed = 0 OR dal.completed IS NULL THEN 1 ELSE 0 END) AS pending,
                    SUM(COALESCE(dal.duration, 0)) AS total_duration
                FROM daily_logs dl
                LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
                WHERE {where_clause}
                """
            )

            total = row["total"] or 0
            completed = row["completed"] or 0
            return {
                "total": total,
                "completed": completed,
                "pending": row["pending"] or 0,
                "total_duration": row["total_duration"] or 0,
                "completion_rate": round((completed / total) * 100) if total > 0 else 0,
            }

        output = {
            "today": period_stats("dl.date = date('now')"),
            "week": period_stats("dl.date >= date('now', '-6 days')"),
            "month": period_stats("dl.date >= date('now', 'start of month')"),
        }
        db.close()
        return output

    @staticmethod
    def streaks_summary():
        db = Database()
        rows = db.fetchall(
            """
            SELECT dl.date,
                   COUNT(dal.id) AS total,
                   SUM(CASE WHEN dal.completed = 1 THEN 1 ELSE 0 END) AS completed
            FROM daily_logs dl
            LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
            WHERE dl.date <= date('now')
            GROUP BY dl.date
            ORDER BY dl.date DESC
            """
        )
        db.close()

        daily_map = {row["date"]: row for row in rows}

        activity_streak = 0
        perfect_streak = 0
        cursor = date.today()

        while True:
            key = cursor.isoformat()
            row = daily_map.get(key)
            if not row:
                break
            completed = row["completed"] or 0
            if completed > 0:
                activity_streak += 1
                cursor = cursor - timedelta(days=1)
                continue
            break

        cursor = date.today()
        while True:
            key = cursor.isoformat()
            row = daily_map.get(key)
            if not row:
                break
            total = row["total"] or 0
            completed = row["completed"] or 0
            if total > 0 and completed == total:
                perfect_streak += 1
                cursor = cursor - timedelta(days=1)
                continue
            break

        return {
            "current_activity_streak": activity_streak,
            "current_perfect_daily_streak": perfect_streak,
        }

    @staticmethod
    def daily_timeseries(days=30):
        db = Database()
        rows = db.fetchall(
            """
            SELECT dl.date,
                   COUNT(dal.id) AS total,
                   SUM(CASE WHEN dal.completed = 1 THEN 1 ELSE 0 END) AS completed,
                   SUM(COALESCE(dal.duration, 0)) AS total_duration,
                   AVG(CASE WHEN dal.completed = 1 THEN COALESCE(dal.duration, 0) END) AS avg_completed_duration
            FROM daily_logs dl
            LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
            WHERE dl.date >= date('now', ?)
            GROUP BY dl.date
            ORDER BY dl.date ASC
            """,
            (f"-{max(days - 1, 0)} days",),
        )
        db.close()

        return [
            {
                "date": row["date"],
                "total": row["total"] or 0,
                "completed": row["completed"] or 0,
                "completion_rate": round(((row["completed"] or 0) / (row["total"] or 1)) * 100) if (row["total"] or 0) > 0 else 0,
                "total_duration": row["total_duration"] or 0,
                "avg_completed_duration": round(row["avg_completed_duration"] or 0, 2),
            }
            for row in rows
        ]

    @staticmethod
    def activity_detail(activity_id):
        db = Database()

        activity = db.fetchone("SELECT id, title FROM activities WHERE id = ?", (activity_id,))
        if not activity:
            db.close()
            return None

        periods = {
            "week": "date('now', '-6 days')",
            "month": "date('now', 'start of month')",
        }

        period_data = {}
        for key, since_expr in periods.items():
            row = db.fetchone(
                f"""
                SELECT
                    COUNT(dal.id) AS total,
                    SUM(CASE WHEN dal.completed = 1 THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN dal.completed = 0 OR dal.completed IS NULL THEN 1 ELSE 0 END) AS pending,
                    SUM(COALESCE(dal.duration, 0)) AS total_duration,
                    AVG(COALESCE(dal.duration, 0)) AS avg_duration
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE dal.activity_id = ?
                  AND dl.date >= {since_expr}
                """,
                (activity_id,),
            )

            total = row["total"] or 0
            completed = row["completed"] or 0
            period_data[key] = {
                "total": total,
                "completed": completed,
                "pending": row["pending"] or 0,
                "total_duration": row["total_duration"] or 0,
                "avg_duration": round(row["avg_duration"] or 0, 2),
                "completion_rate": round((completed / total) * 100) if total > 0 else 0,
            }

        best_day = db.fetchone(
            """
            SELECT dl.date,
                   SUM(COALESCE(dal.duration, 0)) AS total_duration,
                   SUM(CASE WHEN dal.completed = 1 THEN 1 ELSE 0 END) AS completed
            FROM daily_activity_logs dal
            JOIN daily_logs dl ON dl.id = dal.daily_log_id
            WHERE dal.activity_id = ?
            GROUP BY dl.date
            ORDER BY completed DESC, total_duration DESC
            LIMIT 1
            """,
            (activity_id,),
        )

        db.close()

        return {
            "activity": {"id": activity["id"], "title": activity["title"]},
            "week": period_data["week"],
            "month": period_data["month"],
            "best_day": {
                "date": best_day["date"] if best_day else None,
                "completed": best_day["completed"] if best_day else 0,
                "total_duration": best_day["total_duration"] if best_day else 0,
            },
        }

    # =========================
    # ATIVIDADES MAIS FREQUENTES
    # =========================
    @staticmethod
    def top_activities(limit=5):
        db = Database()
        rows = db.fetchall("""
            SELECT a.id,
                   a.title,
                   COUNT(d.id) AS executions
            FROM daily_activity_logs d
            JOIN activities a ON d.activity_id = a.id
            WHERE d.completed = 1
            GROUP BY a.id, a.title
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
