from datetime import date, datetime, timedelta
import json
import logging
from typing import Any, Dict, Optional

from core.daily_log_engine import DailyLogEngine
from core.goal_engine import GoalEngine
from data.database import Database

logger = logging.getLogger(__name__)


class NotificationCenterEngine:
    DEFAULT_STATUS = "unread"

    @staticmethod
    def list_notifications(
        status: Optional[str] = None,
        notification_type: Optional[str] = None,
        source_feature: Optional[str] = None,
        severity: Optional[str] = None,
        include_read: bool = False,
    ):
        query = """
            SELECT
                id,
                notification_type,
                source_feature,
                title,
                message,
                severity,
                status,
                scheduled_for,
                meta,
                sound_key,
                color_token,
                created_at,
                read_at,
                completed_at,
                unique_key
            FROM notifications
            WHERE 1=1
        """
        params = []

        if status:
            query += " AND status = ?"
            params.append(status)
        elif not include_read:
            query += " AND status = 'unread'"

        if notification_type:
            query += " AND notification_type = ?"
            params.append(notification_type)

        if source_feature:
            query += " AND source_feature = ?"
            params.append(source_feature)

        if severity:
            query += " AND severity = ?"
            params.append(severity)

        query += " ORDER BY COALESCE(datetime(scheduled_for), datetime(created_at)) DESC, id DESC"

        with Database() as db:
            rows = db.fetchall(query, tuple(params))

        result = []
        for row in rows:
            item = dict(row)
            item["type"] = item.get("notification_type")
            meta_payload = item.get("meta")
            if meta_payload:
                try:
                    item["meta"] = json.loads(meta_payload)
                except json.JSONDecodeError:
                    item["meta"] = {}
            else:
                item["meta"] = {}
            result.append(item)

        return result

    @staticmethod
    def create_custom_notification(payload: Dict[str, Any]):
        data = {
            "notification_type": payload.get("notification_type") or "custom_reminder",
            "source_feature": payload.get("source_feature") or "manual",
            "title": payload.get("title"),
            "message": payload.get("message"),
            "severity": payload.get("severity") or "info",
            "status": payload.get("status") or NotificationCenterEngine.DEFAULT_STATUS,
            "scheduled_for": payload.get("scheduled_for"),
            "meta": payload.get("meta") or {},
            "sound_key": payload.get("sound_key"),
            "color_token": payload.get("color_token"),
        }
        unique_key = payload.get("unique_key") or NotificationCenterEngine._unique_key(data)
        return NotificationCenterEngine._insert_notification(data, unique_key=unique_key)

    @staticmethod
    def update_notification_status(notification_id: int, status: str):
        allowed = {"unread", "read", "completed"}
        if status not in allowed:
            raise ValueError(f"Invalid status: {status}")

        read_at = "CURRENT_TIMESTAMP" if status in {"read", "completed"} else "NULL"
        completed_at = "CURRENT_TIMESTAMP" if status == "completed" else "NULL"

        with Database() as db:
            db.execute(
                f"""
                UPDATE notifications
                SET status = ?,
                    read_at = {read_at},
                    completed_at = {completed_at}
                WHERE id = ?
                """,
                (status, notification_id),
            )

    @staticmethod
    def get_preferences():
        with Database() as db:
            row = db.fetchone("SELECT * FROM notification_preferences WHERE id = 1")
        return dict(row) if row else {
            "id": 1,
            "enable_sound": 1,
            "inbox_only_unread": 1,
            "default_sound_key": "default",
            "updated_at": None,
        }

    @staticmethod
    def save_preferences(payload: Dict[str, Any]):
        with Database() as db:
            db.execute(
                """
                INSERT INTO notification_preferences (id, enable_sound, inbox_only_unread, default_sound_key, updated_at)
                VALUES (1, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    enable_sound = excluded.enable_sound,
                    inbox_only_unread = excluded.inbox_only_unread,
                    default_sound_key = excluded.default_sound_key,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (
                    1 if payload.get("enable_sound", True) else 0,
                    1 if payload.get("inbox_only_unread", True) else 0,
                    payload.get("default_sound_key") or "default",
                ),
            )

    @staticmethod
    def generate_system_notifications(days_ahead: int = 7):
        NotificationCenterEngine._check_stalled_goals()
        NotificationCenterEngine._check_upcoming_deadlines(days_ahead=days_ahead)
        NotificationCenterEngine._store_daily_summary()

    @staticmethod
    def _check_stalled_goals():
        try:
            for goal in GoalEngine.list_goals():
                if GoalEngine.is_stalled(goal["id"]):
                    payload = {
                        "notification_type": "stalled_goal",
                        "source_feature": "goals",
                        "title": goal["title"],
                        "message": f"Meta '{goal['title']}' sem progresso há mais de 3 dias",
                        "severity": "warning",
                        "meta": {
                            "goal_id": goal["id"],
                            "date": date.today().isoformat(),
                            "progress": GoalEngine.calculate_progress(goal["id"]),
                        },
                        "color_token": "warning",
                    }
                    NotificationCenterEngine._insert_notification(payload)
        except Exception as exc:
            logger.error("Erro ao verificar metas paradas: %s", exc)

    @staticmethod
    def _check_upcoming_deadlines(days_ahead: int = 7):
        try:
            today = date.today()
            for goal in GoalEngine.list_goals():
                deadline_raw = goal.get("deadline")
                if not deadline_raw:
                    continue

                deadline = datetime.strptime(deadline_raw, "%Y-%m-%d").date()
                days_remaining = (deadline - today).days
                if 0 <= days_remaining <= days_ahead:
                    payload = {
                        "notification_type": "upcoming_deadline",
                        "source_feature": "goals",
                        "title": goal["title"],
                        "message": f"Faltam {days_remaining} dias para o deadline de '{goal['title']}'",
                        "severity": "info",
                        "scheduled_for": deadline_raw,
                        "meta": {
                            "goal_id": goal["id"],
                            "deadline": deadline_raw,
                            "days_remaining": days_remaining,
                        },
                        "color_token": "primary",
                    }
                    NotificationCenterEngine._insert_notification(payload)
        except Exception as exc:
            logger.error("Erro ao verificar deadlines: %s", exc)

    @staticmethod
    def _store_daily_summary():
        try:
            entries = DailyLogEngine.list_day()
            total_activities = len(entries)
            completed_activities = sum(1 for entry in entries if entry.get("completed"))
            completion_rate = (completed_activities / total_activities * 100) if total_activities else 0
            payload = {
                "notification_type": "daily_summary",
                "source_feature": "daily",
                "title": "Resumo diário",
                "message": f"Hoje você completou {completed_activities} de {total_activities} atividades",
                "severity": "info",
                "meta": {
                    "date": date.today().isoformat(),
                    "total_activities": total_activities,
                    "completed_activities": completed_activities,
                    "completion_rate": completion_rate,
                },
                "color_token": "success",
            }
            NotificationCenterEngine._insert_notification(payload)
        except Exception as exc:
            logger.error("Erro ao gerar resumo diário: %s", exc)

    @staticmethod
    def _insert_notification(payload: Dict[str, Any], unique_key: Optional[str] = None):
        notification_type = payload.get("notification_type", "generic")
        meta = payload.get("meta") or {}
        try:
            meta_payload = json.dumps(meta, ensure_ascii=False)
        except (TypeError, ValueError):
            meta_payload = "{}"

        effective_unique_key = unique_key or NotificationCenterEngine._unique_key(payload)

        with Database() as db:
            db.execute(
                """
                INSERT OR IGNORE INTO notifications (
                    notification_type,
                    type,
                    source_feature,
                    title,
                    message,
                    severity,
                    status,
                    scheduled_for,
                    meta,
                    sound_key,
                    color_token,
                    unique_key
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    notification_type,
                    notification_type,
                    payload.get("source_feature") or "system",
                    payload.get("title"),
                    payload.get("message"),
                    payload.get("severity") or "info",
                    payload.get("status") or NotificationCenterEngine.DEFAULT_STATUS,
                    payload.get("scheduled_for"),
                    meta_payload,
                    payload.get("sound_key"),
                    payload.get("color_token"),
                    effective_unique_key,
                ),
            )
            return db.lastrowid

    @staticmethod
    def _unique_key(notification: Dict[str, Any]):
        notification_type = notification.get("notification_type", "generic")
        meta = notification.get("meta") or {}
        if notification_type == "daily_summary":
            return f"{notification_type}:{meta.get('date')}"
        if notification_type == "stalled_goal":
            return f"{notification_type}:{meta.get('goal_id')}:{meta.get('date')}"
        if notification_type == "upcoming_deadline":
            return f"{notification_type}:{meta.get('goal_id')}:{meta.get('deadline')}"

        title = notification.get("title") or ""
        message = notification.get("message") or ""
        schedule = notification.get("scheduled_for") or ""
        return f"{notification_type}:{title}:{message}:{schedule}"

    @staticmethod
    def reminder_adapter_list(status: str = "pendente"):
        mapped_status = "completed" if status == "concluido" else "unread"
        notifications = NotificationCenterEngine.list_notifications(
            status=mapped_status,
            notification_type="custom_reminder",
            source_feature="manual",
            include_read=(mapped_status != "unread"),
        )
        result = []
        for item in notifications:
            meta = item.get("meta") or {}
            result.append(
                {
                    "id": item["id"],
                    "title": item.get("title"),
                    "description": item.get("message"),
                    "due_date": item.get("scheduled_for"),
                    "priority": meta.get("priority", 3),
                    "category": meta.get("category", "pessoal"),
                    "reminder_days_before": meta.get("reminder_days_before", 7),
                    "status": "concluido" if item.get("status") == "completed" else "pendente",
                    "completed_at": item.get("completed_at"),
                    "created_at": item.get("created_at"),
                }
            )
        return result

    @staticmethod
    def reminder_adapter_create(title, description=None, due_date=None, priority=3, category="pessoal", reminder_days_before=7):
        payload = {
            "notification_type": "custom_reminder",
            "source_feature": "manual",
            "title": title,
            "message": description,
            "severity": "info",
            "scheduled_for": due_date,
            "meta": {
                "priority": priority,
                "category": category,
                "reminder_days_before": reminder_days_before,
                "legacy_source": "reminders",
            },
            "sound_key": "default",
            "color_token": "accent",
        }
        return NotificationCenterEngine.create_custom_notification(payload)

    @staticmethod
    def reminder_adapter_complete(reminder_id: int):
        NotificationCenterEngine.update_notification_status(reminder_id, "completed")

    @staticmethod
    def reminder_adapter_upcoming(days_ahead=7):
        limit_date = (date.today() + timedelta(days=days_ahead)).isoformat()
        return [
            reminder
            for reminder in NotificationCenterEngine.reminder_adapter_list(status="pendente")
            if reminder.get("due_date") and reminder["due_date"] <= limit_date
        ]
