from datetime import date, datetime, timedelta
from data.database import Database, apply_migrations


class GoalEngine:
    """
    Engine responsável por CRUD e regras de negócio das metas.
    """

    POINTS_PER_DIFFICULTY = 10  # 1 estrela = 10 pontos

    @staticmethod
    def create_goal(title, description=None, difficulty=3, deadline=None, status="ativa"):
        if not title:
            return False, "Título é obrigatório"

        apply_migrations()

        if difficulty is None:
            difficulty = 3

        if not isinstance(difficulty, int) or not (1 <= difficulty <= 5):
            return False, "Dificuldade inválida"

        created_at = datetime.now().isoformat()

        try:
            with Database() as db:
                db.execute(
                    """
                    INSERT INTO goals (title, description, difficulty, status, deadline, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (title, description, difficulty, status, deadline, created_at),
                )
            return True, "Meta criada com sucesso"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def update_goal(goal_id, title, description=None, difficulty=3, deadline=None):
        if not title:
            return False, "Título é obrigatório"

        apply_migrations()

        if difficulty is None:
            difficulty = 3

        if not isinstance(difficulty, int) or not (1 <= difficulty <= 5):
            return False, "Dificuldade inválida"

        try:
            with Database() as db:
                cursor = db.execute(
                    """
                    UPDATE goals
                    SET title = ?,
                        description = ?,
                        difficulty = ?,
                        deadline = ?
                    WHERE id = ?
                    """,
                    (title, description, difficulty, deadline, goal_id),
                )
            if cursor.rowcount == 0:
                return False, "Meta não encontrada"
            return True, "Meta atualizada com sucesso"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def list_goals(status=None):
        try:
            with Database() as db:
                if status:
                    rows = db.fetchall(
                        """
                        SELECT *
                        FROM goals
                        WHERE status = ?
                        ORDER BY
                            CASE status
                                WHEN 'ativa' THEN 1
                                WHEN 'concluida' THEN 2
                                ELSE 3
                            END,
                            created_at ASC
                        """,
                        (status,),
                    )
                else:
                    rows = db.fetchall(
                        """
                        SELECT *
                        FROM goals
                        WHERE status != 'cancelada'
                        ORDER BY
                            CASE status
                                WHEN 'ativa' THEN 1
                                WHEN 'concluida' THEN 2
                                ELSE 3
                            END,
                            created_at ASC
                        """
                    )
            return [dict(row) for row in rows]
        except Exception:
            return []

    @staticmethod
    def delete_goal(goal_id):
        try:
            with Database() as db:
                db.execute(
                    """
                    DELETE FROM goals
                    WHERE id = ?
                    """,
                    (goal_id,),
                )
            return True, "Meta excluída"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def complete_goal(goal_id):
        try:
            completed_at = datetime.now().isoformat()
            with Database() as db:
                cursor = db.execute(
                    """
                    UPDATE goals
                    SET status = 'concluida',
                        completed_at = ?
                    WHERE id = ? AND status = 'ativa'
                    """,
                    (completed_at, goal_id),
                )
            if cursor.rowcount == 0:
                return False, "Meta já está concluída ou não encontrada"
            return True, "Meta concluída"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def cancel_goal(goal_id):
        try:
            with Database() as db:
                db.execute(
                    """
                    UPDATE goals
                    SET status = 'cancelada'
                    WHERE id = ?
                    """,
                    (goal_id,),
                )
            return True, "Meta cancelada"
        except Exception as e:
            return False, str(e)

    @staticmethod
    def link_activity(goal_id, activity_id):
        try:
            with Database() as db:
                db.execute(
                    """
                    INSERT OR IGNORE INTO goal_activities (goal_id, activity_id)
                    VALUES (?, ?)
                    """,
                    (goal_id, activity_id),
                )
            return True
        except Exception:
            return False

    @staticmethod
    def unlink_activity(goal_id, activity_id):
        try:
            with Database() as db:
                db.execute(
                    """
                    DELETE FROM goal_activities
                    WHERE goal_id = ? AND activity_id = ?
                    """,
                    (goal_id, activity_id),
                )
            return True
        except Exception:
            return False

    @staticmethod
    def list_goal_activities(goal_id):
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT a.*
                FROM activities a
                JOIN goal_activities ga ON ga.activity_id = a.id
                WHERE ga.goal_id = ?
                ORDER BY a.title
                """,
                (goal_id,),
            )
            return rows

    @staticmethod
    def calculate_progress(goal_id):
        """
        Calcula progresso com base nas atividades vinculadas.
        """
        with Database() as db:
            total = db.fetchone(
                """
                SELECT COUNT(*) as total
                FROM goal_activities
                WHERE goal_id = ?
                """,
                (goal_id,),
            )
            if not total or total["total"] == 0:
                return "0%"

            completed = db.fetchone(
                """
                SELECT COUNT(DISTINCT ga.activity_id) as completed
                FROM goal_activities ga
                JOIN daily_activity_logs dal ON dal.activity_id = ga.activity_id
                WHERE ga.goal_id = ? AND dal.completed = 1
                """,
                (goal_id,),
            )

        completion_rate = (completed["completed"] or 0) / total["total"]
        return f"{int(completion_rate * 100)}%"

    @staticmethod
    def is_stalled(goal_id, days=3):
        """
        Considera estagnada se não houve registro de atividades vinculadas
        nos últimos N dias.
        """
        since = (date.today() - timedelta(days=days)).isoformat()

        with Database() as db:
            activity_count = db.fetchone(
                """
                SELECT COUNT(*) as total
                FROM goal_activities
                WHERE goal_id = ?
                """,
                (goal_id,),
            )

            if not activity_count or activity_count["total"] == 0:
                return False

            recent = db.fetchone(
                """
                SELECT COUNT(*) as recent
                FROM goal_activities ga
                JOIN daily_activity_logs dal ON dal.activity_id = ga.activity_id
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE ga.goal_id = ?
                  AND dl.date >= ?
                """,
                (goal_id, since),
            )

        return (recent["recent"] or 0) == 0

    @staticmethod
    def get_total_points():
        """
        Soma pontos APENAS de metas concluídas.
        Pontos = difficulty * POINTS_PER_DIFFICULTY
        """
        try:
            with Database() as db:
                rows = db.fetchall(
                    """
                    SELECT difficulty
                    FROM goals
                    WHERE status = 'concluida'
                    """
                )

            total = 0
            for row in rows:
                difficulty = row.get("difficulty") or 0
                total += difficulty * GoalEngine.POINTS_PER_DIFFICULTY

            return total
        except Exception:
            return 0
