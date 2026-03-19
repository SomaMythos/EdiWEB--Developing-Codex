from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from core.activity_engine import ActivityEngine
from data.database import Database


class GoalActivityValidationError(ValueError):
    """Validation error when linking or unlinking activities from goals."""


class GoalEngine:
    STALE_DAYS_THRESHOLD = 3
    GOAL_MODES = {"simple", "milestones"}

    @staticmethod
    def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    @staticmethod
    def _is_older_than_threshold(value: Optional[str]) -> bool:
        reference = GoalEngine._parse_datetime(value)
        if reference is None:
            return False
        return datetime.now() - reference > timedelta(days=GoalEngine.STALE_DAYS_THRESHOLD)

    @staticmethod
    def _normalize_goal_mode(value: Optional[str]) -> str:
        normalized = (value or "simple").strip().lower()
        return normalized if normalized in GoalEngine.GOAL_MODES else "simple"

    @staticmethod
    def _serialize_milestone(row: Any) -> Dict[str, Any]:
        item = dict(row)
        item["is_completed"] = bool(item.get("is_completed"))
        return item

    @staticmethod
    def list_milestones(goal_id: int, db: Optional[Database] = None) -> List[Dict[str, Any]]:
        owns_db = db is None
        db = db or Database()
        try:
            rows = db.fetchall(
                """
                SELECT id, goal_id, title, description, sort_order, is_completed, completed_at, created_at, updated_at
                FROM goal_milestones
                WHERE goal_id = ?
                ORDER BY sort_order ASC, id ASC
                """,
                (goal_id,),
            )
            return [GoalEngine._serialize_milestone(row) for row in rows]
        finally:
            if owns_db:
                db.close()

    @staticmethod
    def _progress_from_activities(goal_id: int, db: Optional[Database] = None) -> Dict[str, Any]:
        activities = GoalEngine.list_linked_activities(goal_id, db=db)
        if not activities:
            return {
                "mode": "simple",
                "percentage": 0,
                "completed_milestones": 0,
                "total_milestones": 0,
                "linked_activities": 0,
                "summary": "Meta simples sem atividades vinculadas",
            }

        progresses = []
        for activity_id in activities:
            progress = ActivityEngine.get_progress(activity_id)
            if isinstance(progress, str) and "%" in progress:
                try:
                    progresses.append(int(progress.split("%")[0]))
                except ValueError:
                    progresses.append(0)
            else:
                progresses.append(0)

        percentage = int(sum(progresses) / len(progresses)) if progresses else 0
        return {
            "mode": "simple",
            "percentage": percentage,
            "completed_milestones": 0,
            "total_milestones": 0,
            "linked_activities": len(activities),
            "summary": f"{percentage}% via atividades vinculadas",
        }

    @staticmethod
    def get_progress_snapshot(goal_id: int, db: Optional[Database] = None, goal: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        owns_db = db is None
        db = db or Database()
        try:
            goal_row = goal or GoalEngine.get_goal(goal_id, db=db, include_milestones=False)
            if not goal_row:
                return {
                    "mode": "simple",
                    "percentage": 0,
                    "completed_milestones": 0,
                    "total_milestones": 0,
                    "linked_activities": 0,
                    "summary": "Meta não encontrada",
                }

            goal_mode = GoalEngine._normalize_goal_mode(goal_row.get("goal_mode"))
            if goal_row.get("status") == "concluida":
                milestone_rows = GoalEngine.list_milestones(goal_id, db=db) if goal_mode == "milestones" else []
                return {
                    "mode": goal_mode,
                    "percentage": 100,
                    "completed_milestones": len([item for item in milestone_rows if item.get("is_completed")]),
                    "total_milestones": len(milestone_rows),
                    "linked_activities": len(GoalEngine.list_linked_activities(goal_id, db=db)),
                    "summary": "Meta concluída",
                }

            if goal_mode == "milestones":
                milestones = GoalEngine.list_milestones(goal_id, db=db)
                total = len(milestones)
                completed = len([item for item in milestones if item.get("is_completed")])
                percentage = int((completed / total) * 100) if total else 0
                return {
                    "mode": "milestones",
                    "percentage": percentage,
                    "completed_milestones": completed,
                    "total_milestones": total,
                    "linked_activities": len(GoalEngine.list_linked_activities(goal_id, db=db)),
                    "summary": f"{completed}/{total} etapas concluídas" if total else "Meta fragmentada sem etapas ainda",
                }

            return GoalEngine._progress_from_activities(goal_id, db=db)
        finally:
            if owns_db:
                db.close()

    @staticmethod
    def calculate_progress(goal_id: int) -> str:
        snapshot = GoalEngine.get_progress_snapshot(goal_id)
        return f"{snapshot.get('percentage', 0)}%"

    @staticmethod
    def _serialize_goal(row: Any, db: Database, include_milestones: bool = False) -> Dict[str, Any]:
        item = dict(row)
        item["goal_mode"] = GoalEngine._normalize_goal_mode(item.get("goal_mode"))
        item["notifications_enabled"] = bool(item.get("notifications_enabled", 1))
        progress = GoalEngine.get_progress_snapshot(item["id"], db=db, goal=item)
        item["progress_snapshot"] = progress
        item["progress"] = f"{progress['percentage']}%"
        item["milestone_summary"] = progress.get("summary")
        item["total_milestones"] = progress.get("total_milestones", 0)
        item["completed_milestones"] = progress.get("completed_milestones", 0)
        if include_milestones:
            item["milestones"] = GoalEngine.list_milestones(item["id"], db=db)
        return item

    @staticmethod
    def list_goals(only_active: bool = False, order_by: str = "created_at", include_milestones: bool = False):
        with Database() as db:
            order_by_map = {
                "difficulty": "g.difficulty DESC, g.created_at DESC",
                "deadline": "CASE WHEN g.deadline IS NULL OR g.deadline = '' THEN 1 ELSE 0 END, g.deadline ASC",
                "alphabetical": "LOWER(g.title) ASC",
                "created_at": "g.created_at DESC",
            }
            order_clause = order_by_map.get(order_by, order_by_map["created_at"])
            where_clause = "WHERE g.status = 'ativa'" if only_active else ""
            rows = db.fetchall(
                f"""
                SELECT
                    g.id,
                    g.title,
                    g.description,
                    g.status,
                    g.deadline,
                    g.difficulty,
                    g.category_id,
                    g.image_path,
                    g.notifications_enabled,
                    g.completed_at,
                    g.created_at,
                    g.goal_mode
                FROM goals g
                {where_clause}
                ORDER BY {order_clause}
                """
            )
            return [GoalEngine._serialize_goal(row, db, include_milestones=include_milestones) for row in rows]

    @staticmethod
    def get_goal(goal_id: int, db: Optional[Database] = None, include_milestones: bool = True):
        owns_db = db is None
        db = db or Database()
        try:
            row = db.fetchone(
                """
                SELECT id, title, description, status, deadline, difficulty, category_id, image_path, notifications_enabled, completed_at, created_at, goal_mode
                FROM goals
                WHERE id = ?
                """,
                (goal_id,),
            )
            if not row:
                return None
            return GoalEngine._serialize_goal(row, db, include_milestones=include_milestones)
        finally:
            if owns_db:
                db.close()

    @staticmethod
    def create_goal(title: str, description: Optional[str] = None, deadline: Optional[str] = None, difficulty: int = 1, category_id: Optional[int] = None, image_path: Optional[str] = None, goal_mode: str = "simple", milestones: Optional[List[Dict[str, Any]]] = None, notifications_enabled: bool = True) -> int:
        normalized_mode = GoalEngine._normalize_goal_mode(goal_mode)
        with Database() as db:
            db.execute(
                """
                INSERT INTO goals (title, description, deadline, difficulty, category_id, image_path, goal_mode, notifications_enabled)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (title, description, deadline if deadline else None, difficulty, category_id, image_path, normalized_mode, 1 if notifications_enabled else 0),
            )
            goal_id = db.lastrowid
            GoalEngine.sync_milestones(goal_id, milestones or [], db=db)
            return goal_id

    @staticmethod
    def update_goal(goal_id: int, title: str, description: Optional[str] = None, deadline: Optional[str] = None, difficulty: int = 1, category_id: Optional[int] = None, image_path: Optional[str] = None, goal_mode: str = "simple", milestones: Optional[List[Dict[str, Any]]] = None, notifications_enabled: bool = True) -> bool:
        normalized_mode = GoalEngine._normalize_goal_mode(goal_mode)
        with Database() as db:
            db.execute(
                """
                UPDATE goals
                SET title = ?, description = ?, deadline = ?, difficulty = ?, category_id = ?, image_path = COALESCE(?, image_path), goal_mode = ?, notifications_enabled = ?
                WHERE id = ? AND status != 'concluida'
                """,
                (title, description, deadline if deadline else None, difficulty, category_id, image_path, normalized_mode, 1 if notifications_enabled else 0, goal_id),
            )
            updated = db.execute("SELECT changes() AS c").fetchone()[0] > 0
            if not updated:
                return False
            if milestones is not None:
                GoalEngine.sync_milestones(goal_id, milestones, db=db)
            return True

    @staticmethod
    def delete_goal(goal_id: int) -> bool:
        with Database() as db:
            db.execute("DELETE FROM goals WHERE id = ?", (goal_id,))
            deleted = db.execute("SELECT changes() AS c").fetchone()[0]
            return deleted > 0

    @staticmethod
    def update_status(goal_id: int, status: str) -> bool:
        if status not in ["ativa", "concluida", "cancelada"]:
            raise ValueError("Status inválido")
        completed_at = datetime.now().isoformat() if status == "concluida" else None
        with Database() as db:
            db.execute("UPDATE goals SET status = ?, completed_at = ? WHERE id = ?", (status, completed_at, goal_id))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def get_stars_total() -> int:
        with Database() as db:
            row = db.fetchone("SELECT COALESCE(SUM(difficulty), 0) AS total_stars FROM goals WHERE status = 'concluida'")
            return row["total_stars"] if row else 0

    @staticmethod
    def link_activity(goal_id: int, activity_id: int) -> bool:
        with Database() as db:
            goal_exists = db.fetchone("SELECT 1 FROM goals WHERE id = ?", (goal_id,))
            if not goal_exists:
                raise GoalActivityValidationError(f"Meta {goal_id} não encontrada")
            activity_exists = db.fetchone("SELECT 1 FROM activities WHERE id = ?", (activity_id,))
            if not activity_exists:
                raise GoalActivityValidationError(f"Atividade {activity_id} não encontrada")
            db.execute("INSERT OR IGNORE INTO goal_activities (goal_id, activity_id) VALUES (?, ?)", (goal_id, activity_id))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def unlink_activity(goal_id: int, activity_id: int) -> bool:
        with Database() as db:
            goal_exists = db.fetchone("SELECT 1 FROM goals WHERE id = ?", (goal_id,))
            if not goal_exists:
                raise GoalActivityValidationError(f"Meta {goal_id} não encontrada")
            activity_exists = db.fetchone("SELECT 1 FROM activities WHERE id = ?", (activity_id,))
            if not activity_exists:
                raise GoalActivityValidationError(f"Atividade {activity_id} não encontrada")
            db.execute("DELETE FROM goal_activities WHERE goal_id = ? AND activity_id = ?", (goal_id, activity_id))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def list_linked_activities(goal_id: int, db: Optional[Database] = None) -> List[int]:
        owns_db = db is None
        db = db or Database()
        try:
            rows = db.fetchall("SELECT a.id FROM activities a JOIN goal_activities g ON g.activity_id = a.id WHERE g.goal_id = ?", (goal_id,))
            return [row["id"] for row in rows]
        finally:
            if owns_db:
                db.close()

    @staticmethod
    def sync_milestones(goal_id: int, milestones: List[Dict[str, Any]], db: Optional[Database] = None):
        owns_db = db is None
        db = db or Database()
        try:
            goal_exists = db.fetchone("SELECT id, status FROM goals WHERE id = ?", (goal_id,))
            if not goal_exists:
                raise ValueError("Meta não encontrada")
            if goal_exists["status"] == "concluida":
                raise ValueError("Meta concluída não pode receber etapas")

            existing_rows = db.fetchall("SELECT id FROM goal_milestones WHERE goal_id = ?", (goal_id,))
            existing_ids = {row["id"] for row in existing_rows}
            kept_ids = set()

            for index, raw_item in enumerate(milestones or []):
                title = (raw_item.get("title") or "").strip()
                if not title:
                    continue
                milestone_id = raw_item.get("id")
                description = (raw_item.get("description") or "").strip() or None
                is_completed = bool(raw_item.get("is_completed", False))
                completed_at = datetime.now().isoformat() if is_completed else None
                sort_order = raw_item.get("sort_order")
                if sort_order is None:
                    sort_order = index

                if milestone_id and milestone_id in existing_ids:
                    previous = db.fetchone("SELECT is_completed, completed_at FROM goal_milestones WHERE id = ? AND goal_id = ?", (milestone_id, goal_id))
                    if previous and previous["is_completed"] and is_completed:
                        completed_at = previous["completed_at"]
                    db.execute(
                        """
                        UPDATE goal_milestones
                        SET title = ?, description = ?, sort_order = ?, is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ? AND goal_id = ?
                        """,
                        (title, description, sort_order, 1 if is_completed else 0, completed_at, milestone_id, goal_id),
                    )
                    kept_ids.add(milestone_id)
                    continue

                db.execute(
                    """
                    INSERT INTO goal_milestones (goal_id, title, description, sort_order, is_completed, completed_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (goal_id, title, description, sort_order, 1 if is_completed else 0, completed_at),
                )
                kept_ids.add(db.lastrowid)

            ids_to_delete = [milestone_id for milestone_id in existing_ids if milestone_id not in kept_ids]
            if ids_to_delete:
                placeholders = ",".join(["?"] * len(ids_to_delete))
                db.execute(f"DELETE FROM goal_milestones WHERE goal_id = ? AND id IN ({placeholders})", (goal_id, *ids_to_delete))
        finally:
            if owns_db:
                db.close()

    @staticmethod
    def update_milestone_status(milestone_id: int, is_completed: bool):
        with Database() as db:
            completed_at = datetime.now().isoformat() if is_completed else None
            db.execute(
                "UPDATE goal_milestones SET is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (1 if is_completed else 0, completed_at, milestone_id),
            )
            updated = db.execute("SELECT changes() AS c").fetchone()[0] > 0
            if not updated:
                raise ValueError("Etapa não encontrada")
            row = db.fetchone("SELECT goal_id FROM goal_milestones WHERE id = ?", (milestone_id,))
            return row["goal_id"] if row else None

    @staticmethod
    def is_stalled(goal_id: int) -> bool:
        goal = GoalEngine.get_goal(goal_id, include_milestones=False)
        if not goal or goal.get("status") != "ativa":
            return False
        if not goal.get("notifications_enabled", True):
            return False

        created_at = goal.get("created_at")
        created_is_old_enough = GoalEngine._is_older_than_threshold(created_at)

        if goal.get("goal_mode") == "milestones":
            milestones = GoalEngine.list_milestones(goal_id)
            if not milestones:
                return created_is_old_enough
            completed_dates = [
                GoalEngine._parse_datetime(item.get("completed_at"))
                for item in milestones
                if item.get("is_completed") and item.get("completed_at")
            ]
            completed_dates = [item for item in completed_dates if item is not None]
            if not completed_dates:
                return created_is_old_enough
            return datetime.now() - max(completed_dates) > timedelta(days=GoalEngine.STALE_DAYS_THRESHOLD)

        activities = GoalEngine.list_linked_activities(goal_id)
        if not activities:
            return created_is_old_enough
        with Database() as db:
            row = db.fetchone(
                f"SELECT MAX(d.timestamp) AS last_action FROM daily_activity_logs d WHERE d.completed = 1 AND d.activity_id IN ({','.join('?' * len(activities))})",
                tuple(activities),
            )
        if not row or not row["last_action"]:
            return created_is_old_enough
        last_action = GoalEngine._parse_datetime(row["last_action"])
        if last_action is None:
            return created_is_old_enough
        return datetime.now() - last_action > timedelta(days=GoalEngine.STALE_DAYS_THRESHOLD)

    @staticmethod
    def list_categories():
        with Database() as db:
            return db.fetchall("SELECT id, name, icon, created_at FROM goal_categories ORDER BY name ASC")

    @staticmethod
    def create_category(name: str, icon: Optional[str] = None):
        with Database() as db:
            db.execute("INSERT INTO goal_categories (name, icon) VALUES (?, ?)", (name.strip(), icon))

    @staticmethod
    def update_category(category_id: int, name: str, icon: Optional[str] = None) -> bool:
        with Database() as db:
            db.execute("UPDATE goal_categories SET name = ?, icon = ? WHERE id = ?", (name.strip(), icon, category_id))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def delete_category(category_id: int) -> bool:
        with Database() as db:
            db.execute("DELETE FROM goal_activities WHERE goal_id IN (SELECT id FROM goals WHERE category_id = ?)", (category_id,))
            db.execute("DELETE FROM goals WHERE category_id = ?", (category_id,))
            db.execute("DELETE FROM goal_categories WHERE id = ?", (category_id,))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def list_goals_by_category(category_id: int):
        with Database() as db:
            rows = db.fetchall(
                "SELECT id, title, description, status, deadline, difficulty, created_at, completed_at, image_path, goal_mode, category_id, notifications_enabled FROM goals WHERE category_id = ? ORDER BY created_at DESC",
                (category_id,),
            )
            return [GoalEngine._serialize_goal(row, db, include_milestones=True) for row in rows]

    @staticmethod
    def get_home_overview():
        with Database() as db:
            stars_row = db.fetchone("SELECT COALESCE(SUM(difficulty), 0) AS total_stars FROM goals WHERE status = 'concluida'")
            total_stars = stars_row["total_stars"] if stars_row else 0
            recent_rows = db.fetchall("SELECT id, title, description, difficulty, completed_at, image_path FROM goals WHERE status = 'concluida' ORDER BY completed_at DESC LIMIT 5")
            categories = db.fetchall(
                """
                SELECT c.id, c.name, COUNT(g.id) AS total, SUM(CASE WHEN g.status = 'concluida' THEN 1 ELSE 0 END) AS completed
                FROM goal_categories c
                LEFT JOIN goals g ON g.category_id = c.id
                GROUP BY c.id
                ORDER BY c.name ASC
                """
            )
            return {
                "total_stars": total_stars,
                "recent_achievements": recent_rows,
                "categories_overview": categories,
            }
