from datetime import datetime, timedelta
from core.activity_engine import ActivityEngine
from data.database import Database


class GoalActivityValidationError(ValueError):
    """Erro de validação ao vincular/desvincular atividades de metas."""


class GoalEngine:

    STALE_DAYS_THRESHOLD = 3

    # =========================
    # CRUD
    # =========================
    @staticmethod
    def list_goals(only_active=False, order_by="created_at"):
        db = Database()

        order_by_map = {
            "difficulty": "difficulty DESC, created_at DESC",
            "deadline": "CASE WHEN deadline IS NULL OR deadline = '' THEN 1 ELSE 0 END, deadline ASC",
            "alphabetical": "LOWER(title) ASC",
            "created_at": "created_at DESC",
        }
        order_clause = order_by_map.get(order_by, order_by_map["created_at"])

        params = []
        where_clause = ""
        if only_active:
            where_clause = "WHERE status = 'ativa'"

        rows = db.fetchall(
            f"""
            SELECT id, title, description, status, deadline, difficulty, category_id, image_path, completed_at, created_at
            FROM goals
            {where_clause}
            ORDER BY {order_clause}
        """,
            params,
        )
        db.close()
        return rows

    @staticmethod
    def create_goal(title, description=None, deadline=None, difficulty=1, category_id=None, image_path=None):
        db = Database()
        db.execute(
            """
            INSERT INTO goals (title, description, deadline, difficulty, category_id, image_path)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (title, description, deadline if deadline else None, difficulty, category_id, image_path)
        )
        db.commit()
        db.close()


    @staticmethod
    def update_goal(goal_id, title, description=None, deadline=None, difficulty=1, category_id=None, image_path=None):
        db = Database()
        db.execute(
            """
            UPDATE goals
            SET title = ?,
            description = ?,
            deadline = ?,
            difficulty = ?,
            category_id = COALESCE(?, category_id),
            image_path = COALESCE(?, image_path)
            WHERE id = ? AND status != 'concluida'
            """,
            (title, description, deadline if deadline else None, difficulty, category_id, image_path, goal_id),
        )
        updated = db.execute("SELECT changes() AS c").fetchone()[0]
        db.commit()
        db.close()
        return updated > 0


    @staticmethod
    def delete_goal(goal_id):
        db = Database()
        db.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
        deleted = db.execute("SELECT changes() AS c").fetchone()[0]
        db.commit()
        db.close()
        return deleted > 0

    @staticmethod
    def update_status(goal_id, status):
        if status not in ["ativa", "concluida", "cancelada"]:
            raise ValueError("Status inválido")

        db = Database()

        completed_at = datetime.now().isoformat() if status == "concluida" else None

        db.execute(
            """
            UPDATE goals
            SET status = ?, completed_at = ?
            WHERE id = ?
            """,
            (status, completed_at, goal_id),
        )

        updated = db.execute("SELECT changes() AS c").fetchone()[0]
        db.commit()
        db.close()
        return updated > 0


    @staticmethod
    def get_stars_total():
        db = Database()
        row = db.fetchone(
            """
            SELECT COALESCE(SUM(difficulty), 0) AS total_stars
            FROM goals
            WHERE status = 'concluida'
            """
        )
        db.close()
        return row["total_stars"] if row else 0

    # =========================
    # VINCULAÇÃO
    # =========================
    @staticmethod
    def link_activity(goal_id, activity_id):
        """Vincula uma atividade a uma meta"""
        db = Database()
        goal_exists = db.fetchone("SELECT 1 FROM goals WHERE id = ?", (goal_id,))
        if not goal_exists:
            db.close()
            raise GoalActivityValidationError(f"Meta {goal_id} não encontrada")

        activity_exists = db.fetchone("SELECT 1 FROM activities WHERE id = ?", (activity_id,))
        if not activity_exists:
            db.close()
            raise GoalActivityValidationError(f"Atividade {activity_id} não encontrada")

        db.execute(
            """
                INSERT OR IGNORE INTO goal_activities (goal_id, activity_id)
                VALUES (?, ?)
            """,
            (goal_id, activity_id),
        )
        linked = db.execute("SELECT changes() AS c").fetchone()[0] > 0
        db.commit()
        db.close()
        return linked

    @staticmethod
    def unlink_activity(goal_id, activity_id):
        """Remove vínculo entre atividade e meta"""
        db = Database()
        goal_exists = db.fetchone("SELECT 1 FROM goals WHERE id = ?", (goal_id,))
        if not goal_exists:
            db.close()
            raise GoalActivityValidationError(f"Meta {goal_id} não encontrada")

        activity_exists = db.fetchone("SELECT 1 FROM activities WHERE id = ?", (activity_id,))
        if not activity_exists:
            db.close()
            raise GoalActivityValidationError(f"Atividade {activity_id} não encontrada")

        db.execute(
            """
                DELETE FROM goal_activities
                WHERE goal_id = ? AND activity_id = ?
            """,
            (goal_id, activity_id),
        )
        unlinked = db.execute("SELECT changes() AS c").fetchone()[0] > 0
        db.commit()
        db.close()
        return unlinked

    @staticmethod
    def list_linked_activities(goal_id):
        db = Database()
        rows = db.fetchall("""
            SELECT a.id
            FROM activities a
            JOIN goal_activities g ON g.activity_id = a.id
            WHERE g.goal_id = ?
        """, (goal_id,))
        db.close()
        return [r["id"] for r in rows]

    # =========================
    # PROGRESSO
    # =========================
    @staticmethod
    def calculate_progress(goal_id):
        activities = GoalEngine.list_linked_activities(goal_id)
        if not activities:
            return "0%"

        progresses = []
        for aid in activities:
            p = ActivityEngine.get_progress(aid)
            if "%" in p:
                progresses.append(int(p.split("%")[0]))
            else:
                progresses.append(0)

        avg = int(sum(progresses) / len(progresses))
        return f"{avg}%"

    # =========================
    # META PARADA
    # =========================
    @staticmethod
    def is_stalled(goal_id):
        activities = GoalEngine.list_linked_activities(goal_id)
        if not activities:
            return True

        db = Database()
        row = db.fetchone(f"""
            SELECT MAX(d.timestamp) AS last_action
            FROM daily_activity_logs d
            WHERE d.completed = 1
              AND d.activity_id IN ({','.join('?' * len(activities))})
        """, activities)
        db.close()

        if not row or not row["last_action"]:
            return True

        last = datetime.fromisoformat(row["last_action"])
        return datetime.now() - last > timedelta(days=GoalEngine.STALE_DAYS_THRESHOLD)

    # =========================
    # CATEGORIAS
    # =========================

    @staticmethod
    def list_categories():
        db = Database()
        rows = db.fetchall("""
            SELECT id, name, icon, created_at
            FROM goal_categories
            ORDER BY name ASC
        """)
        db.close()
        return rows

    @staticmethod
    def create_category(name, icon=None):
        db = Database()
        db.execute("""
            INSERT INTO goal_categories (name, icon)
            VALUES (?, ?)
        """, (name.strip(), icon))
        db.commit()
        db.close()

    @staticmethod
    def update_category(category_id, name, icon=None):
        db = Database()
        db.execute("""
            UPDATE goal_categories
            SET name = ?, icon = ?
            WHERE id = ?
        """, (name.strip(), icon, category_id))

        updated = db.execute("SELECT changes() AS c").fetchone()[0]
        db.commit()
        db.close()
        return updated > 0

    @staticmethod
    def delete_category(category_id):
        db = Database()
        try:
            # 1️⃣ Remover vínculos das metas com atividades
            db.execute("""
                DELETE FROM goal_activities
                WHERE goal_id IN (
                    SELECT id FROM goals WHERE category_id = ?
                )
            """, (category_id,))

            # 2️⃣ Remover metas da categoria
            db.execute("""
                DELETE FROM goals
                WHERE category_id = ?
            """, (category_id,))

            # 3️⃣ Remover categoria
            db.execute("""
                DELETE FROM goal_categories
                WHERE id = ?
            """, (category_id,))

            deleted = db.execute("SELECT changes() AS c").fetchone()[0]

            db.commit()
            return deleted > 0
        finally:
            db.close()

    @staticmethod
    def list_goals_by_category(category_id):
        db = Database()
        rows = db.fetchall("""
            SELECT id, title, description, status, deadline, difficulty, created_at, image_path
            FROM goals
            WHERE category_id = ?
            ORDER BY created_at DESC
        """, (category_id,))
        db.close()
        return rows


    # =========================
    # HOME OVERVIEW (Estilo WoW)
    # =========================

    @staticmethod
    def get_home_overview():
        db = Database()

        # Total de estrelas
        stars_row = db.fetchone("""
            SELECT COALESCE(SUM(difficulty), 0) AS total_stars
            FROM goals
            WHERE status = 'concluida'
        """)
        total_stars = stars_row["total_stars"] if stars_row else 0

        # Metas recentes (últimas 5 concluídas)
        recent = db.fetchall("""
            SELECT id, title, difficulty, completed_at, image_path
            FROM goals
            WHERE status = 'concluida'
            ORDER BY completed_at DESC
            LIMIT 5
        """)

        # Overview por categoria
        categories = db.fetchall("""
            SELECT c.id, c.name,
                   COUNT(g.id) as total,
                   SUM(CASE WHEN g.status = 'concluida' THEN 1 ELSE 0 END) as completed
            FROM goal_categories c
            LEFT JOIN goals g ON g.category_id = c.id
            GROUP BY c.id
            ORDER BY c.name ASC
        """)

        db.close()

        return {
            "total_stars": total_stars,
            "recent_achievements": recent,
            "categories_overview": categories
        }
