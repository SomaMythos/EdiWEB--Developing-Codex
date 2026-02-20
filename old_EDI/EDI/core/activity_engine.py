from data.database import Database


class ActivityEngine:
    PROGRESS_MODE_ALIASES = {
        "boolean": "boolean",
        "binario": "boolean",
        "binário": "boolean",
        "tempo": "tempo",
        "duracao": "tempo",
        "duração": "tempo",
        "frequencia": "frequencia",
        "frequência": "frequencia",
        "percentual": "percentual",
        "percent": "percentual",
        "paginas": "paginas",
        "páginas": "paginas",
        "leitura": "paginas",
    }

    @staticmethod
    def list_activities(search=None, type_id=None, active_only=True):
        db = Database()

        query = """
            SELECT
                a.id,
                a.title,
                a.type_id,
                a.estimated_time,
                a.active,
                t.title AS type_title,
                t.role
            FROM activities a
            JOIN activity_types t ON t.id = a.type_id
        """
        clauses = []
        params = []

        if active_only:
            clauses.append("a.active = 1")
        if type_id is not None:
            clauses.append("a.type_id = ?")
            params.append(type_id)
        if search:
            clauses.append("LOWER(a.title) LIKE ?")
            params.append(f"%{search.lower()}%")

        if clauses:
            query += " WHERE " + " AND ".join(clauses)

        query += " ORDER BY t.title, a.title"

        rows = db.fetchall(query, tuple(params))

        db.close()
        return rows

    @staticmethod
    def update_activity(activity_id, title=None, type_id=None, estimated_time=None, active=None):
        updates = []
        params = []

        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if type_id is not None:
            updates.append("type_id = ?")
            params.append(type_id)
        if estimated_time is not None:
            updates.append("estimated_time = ?")
            params.append(estimated_time)
        if active is not None:
            updates.append("active = ?")
            params.append(1 if active else 0)

        if not updates:
            return False

        params.append(activity_id)

        with Database() as db:
            db.execute(
                f"""
                UPDATE activities
                SET {', '.join(updates)}
                WHERE id = ?
                """,
                tuple(params),
            )
        return True

    @staticmethod
    def create_activity(title, type_id, estimated_time=None):
        db = Database()

        db.execute("""
            INSERT INTO activities (title, type_id, estimated_time)
            VALUES (?, ?, ?)
        """, (title, type_id, estimated_time))

        db.commit()
        db.close()

    @staticmethod
    def toggle_activity(activity_id):
        db = Database()

        db.execute("""
            UPDATE activities
            SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END
            WHERE id = ?
        """, (activity_id,))

        db.commit()
        db.close()

    @staticmethod
    def delete_activity(activity_id):
        with Database() as db:
            db.execute(
                """
                DELETE FROM activity_metadata
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM daily_activity_logs
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM routine_blocks
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM daily_plan_blocks
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM fixed_daily_blocks
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM goal_activities
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM progress_photos
                WHERE activity_id = ?
                """,
                (activity_id,),
            )
            db.execute(
                """
                DELETE FROM activities
                WHERE id = ?
                """,
                (activity_id,),
            )

    @staticmethod
    def get_metadata(activity_id, key=None):
        db = Database()
        if key:
            row = db.fetchone(
                """
                SELECT value
                FROM activity_metadata
                WHERE activity_id = ? AND key = ?
                """,
                (activity_id, key),
            )
            db.close()
            return row["value"] if row else None

        rows = db.fetchall(
            """
            SELECT key, value
            FROM activity_metadata
            WHERE activity_id = ?
            """,
            (activity_id,),
        )
        db.close()
        return {row["key"]: row["value"] for row in rows}

    @staticmethod
    def set_metadata(activity_id, key, value):
        db = Database()
        existing = db.fetchone(
            """
            SELECT id
            FROM activity_metadata
            WHERE activity_id = ? AND key = ?
            """,
            (activity_id, key),
        )

        if existing:
            db.execute(
                """
                UPDATE activity_metadata
                SET value = ?
                WHERE id = ?
                """,
                (str(value), existing["id"]),
            )
        else:
            db.execute(
                """
                INSERT INTO activity_metadata (activity_id, key, value)
                VALUES (?, ?, ?)
                """,
                (activity_id, key, str(value)),
            )

        db.commit()
        db.close()

    @staticmethod
    def get_progress(activity_id):
        """
        Calcula o progresso de uma atividade baseado no seu tipo e logs
        Retorna uma string como "75%" ou "5/10 sessões"
        """
        db = Database()
        
        # Buscar informações da atividade e seu tipo
        activity = db.fetchone("""
            SELECT a.id, a.title
            FROM activities a
            JOIN activity_types t ON t.id = a.type_id
            WHERE a.id = ?
        """, (activity_id,))
        
        if not activity:
            db.close()
            return "0%"
        
        metadata_row = db.fetchone(
            """
            SELECT value
            FROM activity_metadata
            WHERE activity_id = ? AND key = 'progress_mode'
            """,
            (activity_id,),
        )

        progress_mode = metadata_row["value"] if metadata_row else "frequencia"
        progress_mode = ActivityEngine.PROGRESS_MODE_ALIASES.get(progress_mode, progress_mode)
        
        # Buscar logs da atividade
        logs = db.fetchall("""
            SELECT completed, duration
            FROM daily_activity_logs
            WHERE activity_id = ?
        """, (activity_id,))
        
        db.close()
        
        if not logs:
            return "0%"
        
        # Calcular progresso baseado no modo
        if progress_mode == "frequencia":
            # Conta quantas vezes foi completada
            completed_count = sum(1 for log in logs if log["completed"])
            return f"{completed_count} sessões"
        
        elif progress_mode == "tempo":
            # Soma duração total
            total_duration = sum(log["duration"] or 0 for log in logs)
            hours = total_duration // 60
            minutes = total_duration % 60
            return f"{hours}h {minutes}min"
        
        elif progress_mode == "boolean":
            # Verifica se foi completada pelo menos uma vez
            any_completed = any(log["completed"] for log in logs)
            return "100%" if any_completed else "0%"

        elif progress_mode == "percentual":
            metadata = ActivityEngine.get_metadata(activity_id)
            if "current_value" in metadata and "target_value" in metadata:
                try:
                    current = float(metadata["current_value"])
                    target = float(metadata["target_value"])
                    if target > 0:
                        return f"{int((current / target) * 100)}%"
                except ValueError:
                    pass
            if "progress_percent" in metadata:
                return f"{metadata['progress_percent']}%"
            return "0%"

        elif progress_mode == "paginas":
            metadata = ActivityEngine.get_metadata(activity_id)
            try:
                current_page = int(metadata.get("current_page", 0))
                total_pages = int(metadata.get("total_pages", 0))
            except ValueError:
                return "0%"
            if total_pages <= 0:
                return "0%"
            return f"{int((current_page / total_pages) * 100)}%"
        
        else:
            # Para modos customizados, calcula % baseado em conclusões
            total = len(logs)
            completed = sum(1 for log in logs if log["completed"])
            percentage = int((completed / total) * 100) if total > 0 else 0
            return f"{percentage}%"
