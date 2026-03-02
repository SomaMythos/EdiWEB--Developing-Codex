import json
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

    @staticmethod
    def goals_summary_report():
        db = Database()
        row = db.fetchone(
            """
            WITH completed_goals AS (
                SELECT
                    COALESCE(gc.name, 'Sem categoria') AS category_name,
                    CASE
                        WHEN date(g.completed_at) >= date('now', '-6 days') THEN 1
                        ELSE 0
                    END AS completed_week,
                    CASE
                        WHEN date(g.completed_at) >= date('now', 'start of month') THEN 1
                        ELSE 0
                    END AS completed_month
                FROM goals g
                LEFT JOIN goal_categories gc ON gc.id = g.category_id
                WHERE g.status = 'concluida'
                  AND g.completed_at IS NOT NULL
            ),
            category_totals AS (
                SELECT
                    category_name,
                    SUM(completed_week) AS total_week,
                    SUM(completed_month) AS total_month,
                    COUNT(*) AS total_completed
                FROM completed_goals
                GROUP BY category_name
            )
            SELECT
                COALESCE((SELECT SUM(completed_week) FROM completed_goals), 0) AS completed_week,
                COALESCE((SELECT SUM(completed_month) FROM completed_goals), 0) AS completed_month,
                COALESCE((SELECT json_object(
                    'category', category_name,
                    'completed', total_completed,
                    'week', total_week,
                    'month', total_month
                ) FROM category_totals ORDER BY total_completed DESC, category_name ASC LIMIT 1), '{}') AS top_category,
                COALESCE((SELECT json_object(
                    'category', category_name,
                    'completed', total_completed,
                    'week', total_week,
                    'month', total_month
                ) FROM category_totals ORDER BY total_completed ASC, CASE WHEN category_name = 'Sem categoria' THEN 0 ELSE 1 END ASC, category_name ASC LIMIT 1), '{}') AS bottom_category
            """
        )
        db.close()

        return {
            "completed_week": row["completed_week"] or 0,
            "completed_month": row["completed_month"] or 0,
            "ranking": {
                "most_completed": json.loads(row["top_category"] or "{}"),
                "least_completed": json.loads(row["bottom_category"] or "{}"),
            },
        }

    @staticmethod
    def hobbies_log(limit=50, from_date=None, to_date=None, modules=None):
        db = Database()

        rows = db.fetchall(
            """
            SELECT * FROM (
                SELECT
                    pp.timestamp AS timestamp,
                    'artes' AS module,
                    'painting_progress' AS event_type,
                    COALESCE(pp.update_title, p.title, 'Atualização de pintura') AS title,
                    json_object(
                        'painting_id', p.id,
                        'painting_title', p.title,
                        'time_spent', COALESCE(pp.time_spent, 0),
                        'notes', pp.notes
                    ) AS details
                FROM painting_progress pp
                INNER JOIN paintings p ON p.id = pp.painting_id

                UNION ALL

                SELECT
                    p.created_at AS timestamp,
                    'artes' AS module,
                    'painting_created' AS event_type,
                    p.title AS title,
                    json_object(
                        'painting_id', p.id,
                        'status', p.status,
                        'category', p.visual_category
                    ) AS details
                FROM paintings p
                WHERE p.created_at IS NOT NULL

                UNION ALL

                SELECT
                    p.finished_at AS timestamp,
                    'artes' AS module,
                    'painting_completed' AS event_type,
                    p.title AS title,
                    json_object(
                        'painting_id', p.id,
                        'status', p.status,
                        'time_spent', COALESCE(p.time_spent, 0)
                    ) AS details
                FROM paintings p
                WHERE p.finished_at IS NOT NULL

                UNION ALL

                SELECT
                    rs.read_at AS timestamp,
                    'leitura' AS module,
                    'reading_session' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'pages_read', rs.pages_read,
                        'start_page', rs.start_page,
                        'end_page', rs.end_page,
                        'duration', rs.duration
                    ) AS details
                FROM reading_sessions rs
                INNER JOIN books b ON b.id = rs.book_id

                UNION ALL

                SELECT
                    b.created_at AS timestamp,
                    'leitura' AS module,
                    'book_created' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'book_type', b.book_type,
                        'status', b.status,
                        'total_pages', COALESCE(b.total_pages, 0)
                    ) AS details
                FROM books b
                WHERE b.created_at IS NOT NULL

                UNION ALL

                SELECT
                    b.finished_at AS timestamp,
                    'leitura' AS module,
                    'book_finished' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'status', b.status,
                        'current_page', COALESCE(b.current_page, 0),
                        'total_pages', COALESCE(b.total_pages, 0)
                    ) AS details
                FROM books b
                WHERE b.finished_at IS NOT NULL

                UNION ALL

                SELECT
                    wi.watched_at AS timestamp,
                    'assistir' AS module,
                    'watch_completed' AS event_type,
                    wi.name AS title,
                    json_object(
                        'watch_item_id', wi.id,
                        'category', wc.name
                    ) AS details
                FROM watch_items wi
                INNER JOIN watch_categories wc ON wc.id = wi.category_id
                WHERE wi.watched_at IS NOT NULL

                UNION ALL

                SELECT
                    mts.created_at AS timestamp,
                    'musica' AS module,
                    'music_training_session' AS event_type,
                    mtt.name AS title,
                    json_object(
                        'training_id', mtt.id,
                        'instrument', mtt.instrument,
                        'bpm', mts.bpm
                    ) AS details
                FROM music_training_sessions mts
                INNER JOIN music_training_tabs mtt ON mtt.id = mts.training_id

                UNION ALL

                SELECT
                    ma.created_at AS timestamp,
                    'musica' AS module,
                    'album_listened_confirmation' AS event_type,
                    ma.name AS title,
                    json_object(
                        'album_id', ma.id,
                        'status', ma.status,
                        'artist', mart.name
                    ) AS details
                FROM music_albums ma
                INNER JOIN music_artists mart ON mart.id = ma.artist_id
                WHERE ma.status = 'listened'
            ) hobby_log
            WHERE timestamp IS NOT NULL
            ORDER BY datetime(timestamp) DESC
            """
        )

        db.close()

        from_bound = str(from_date).strip() if from_date else None
        to_bound = str(to_date).strip() if to_date else None
        module_set = {m.strip().lower() for m in (modules or []) if m}

        normalized = []
        for row in rows:
            timestamp = row["timestamp"]
            if from_bound and timestamp < from_bound:
                continue
            if to_bound and timestamp > to_bound:
                continue
            if module_set and row["module"] not in module_set:
                continue

            normalized.append(
                {
                    "timestamp": timestamp,
                    "module": row["module"],
                    "event_type": row["event_type"],
                    "title": row["title"],
                    "details": json.loads(row["details"] or "{}"),
                }
            )

            if len(normalized) >= max(limit, 1):
                break

        return normalized
