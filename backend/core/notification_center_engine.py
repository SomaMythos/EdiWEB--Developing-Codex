from datetime import date, datetime, timedelta
import json
import logging
from urllib import error as urllib_error
from urllib import request as urllib_request
from typing import Any, Dict, List, Optional

from core.daily_log_engine import DailyLogEngine
from core.consumables_engine import ConsumablesEngine
from core.goal_engine import GoalEngine
from core.note_engine import NoteEngine
from data.database import Database

logger = logging.getLogger(__name__)
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
MAX_PUSH_RETRIES = 2

_MOJIBAKE_SEQUENCES = (
    "Ã¡", "Ã¢", "Ã£", "Ã¤", "Ã§", "Ã©", "Ãª", "Ã­", "Ã³", "Ã´", "Ãµ", "Ãº", "Ã¼",
    "Ã ", "Ã‰", "Ã“", "Ãš", "Â", "â€", "â€œ", "â€", "â€˜", "â€™", "â€“", "â€”",
)


def _repair_mojibake_text(value: Any) -> Any:
    if not isinstance(value, str) or not value:
        return value
    if not any(token in value for token in _MOJIBAKE_SEQUENCES):
        return value
    try:
        return value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value


def _repair_mojibake_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _repair_mojibake_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_repair_mojibake_payload(item) for item in value]
    return _repair_mojibake_text(value)


class NotificationCenterEngine:
    DEFAULT_STATUS = "unread"
    SUPPORTED_SEVERITIES = {"info", "success", "warning", "critical", "neutral"}
    DEFAULT_CHANNELS = ["in_app", "sound", "push"]
    SUPPORTED_FEATURES = ["goals", "daily", "consumables", "shopping", "custom", "journal"]

    @staticmethod
    def list_notifications(
        status: Optional[str] = None,
        notification_type: Optional[str] = None,
        source_feature: Optional[str] = None,
        severity: Optional[str] = None,
        include_read: bool = False,
        due_only: bool = False,
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

        if due_only:
            query += " AND (scheduled_for IS NULL OR datetime(scheduled_for) <= CURRENT_TIMESTAMP)"

        query += " ORDER BY COALESCE(datetime(scheduled_for), datetime(created_at)) DESC, id DESC"

        with Database() as db:
            rows = db.fetchall(query, tuple(params))

        result = []
        for row in rows:
            item = dict(row)
            item["type"] = item.get("notification_type")
            item["title"] = _repair_mojibake_text(item.get("title"))
            item["message"] = _repair_mojibake_text(item.get("message"))
            meta_payload = item.get("meta")
            if meta_payload:
                try:
                    item["meta"] = _repair_mojibake_payload(json.loads(meta_payload))
                except json.JSONDecodeError:
                    item["meta"] = {}
            else:
                item["meta"] = {}
            scheduled_for = item.get("scheduled_for")
            item["is_due"] = True
            if scheduled_for:
                parsed_schedule = NotificationCenterEngine._parse_datetime_value(scheduled_for)
                if parsed_schedule is not None:
                    item["is_due"] = parsed_schedule <= datetime.now()
            result.append(item)

        return result

    @staticmethod
    def get_notification(notification_id: int):
        with Database() as db:
            row = db.fetchone(
                """
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
                WHERE id = ?
                """,
                (notification_id,),
            )
        if not row:
            return None
        items = NotificationCenterEngine.list_notifications(include_read=True)
        for item in items:
            if item.get("id") == notification_id:
                return item
        return None

    @staticmethod
    def create_custom_notification(payload: Dict[str, Any]):
        payload = _repair_mojibake_payload(payload)
        data = {
            "notification_type": payload.get("notification_type") or "custom_notification",
            "source_feature": payload.get("source_feature") or "custom",
            "title": payload.get("title"),
            "message": payload.get("message"),
            "severity": NotificationCenterEngine._normalize_severity(payload.get("severity")),
            "status": payload.get("status") or NotificationCenterEngine.DEFAULT_STATUS,
            "scheduled_for": payload.get("scheduled_for"),
            "meta": payload.get("meta") or {},
            "sound_key": payload.get("sound_key"),
            "color_token": payload.get("color_token"),
        }
        unique_key = payload.get("unique_key") or NotificationCenterEngine._unique_key(data)
        return NotificationCenterEngine._insert_notification(data, unique_key=unique_key)

    @staticmethod
    def update_custom_notification(notification_id: int, payload: Dict[str, Any]):
        payload = _repair_mojibake_payload(payload)
        with Database() as db:
            result = db.execute(
                """
                UPDATE notifications
                SET
                    title = ?,
                    message = ?,
                    severity = ?,
                    scheduled_for = ?,
                    sound_key = ?,
                    color_token = ?,
                    meta = ?
                WHERE id = ?
                    AND notification_type = 'custom_notification'
                    AND source_feature = 'custom'
                """,
                (
                    payload.get("title"),
                    payload.get("message"),
                    NotificationCenterEngine._normalize_severity(payload.get("severity")),
                    payload.get("scheduled_for"),
                    payload.get("sound_key"),
                    payload.get("color_token"),
                    json.dumps(payload.get("meta") or {}, ensure_ascii=False),
                    notification_id,
                ),
            )
            if result.rowcount == 0:
                raise ValueError("Notificação custom não encontrada")

    @staticmethod
    def _normalize_severity(value: Optional[str]) -> str:
        if value in NotificationCenterEngine.SUPPORTED_SEVERITIES:
            return value
        return "neutral" if value else "info"

    @staticmethod
    def update_notification_status(notification_id: int, status: str):
        allowed = {"unread", "read", "completed", "canceled"}
        if status not in allowed:
            raise ValueError(f"Invalid status: {status}")

        read_at = "CURRENT_TIMESTAMP" if status in {"read", "completed", "canceled"} else "NULL"
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
    def complete_daily_activity_notification(plan_block_id: int):
        if not plan_block_id:
            return

        notifications = NotificationCenterEngine.list_notifications(
            notification_type="daily_activity_start",
            source_feature="daily",
            include_read=True,
        )

        for item in notifications:
            meta = item.get("meta") or {}
            if int(meta.get("plan_block_id") or 0) != int(plan_block_id):
                continue
            if item.get("status") == "completed":
                continue
            NotificationCenterEngine.update_notification_status(item["id"], "completed")

    @staticmethod
    def snooze_notification(notification_id: int, minutes: int):
        snooze_minutes = max(1, int(minutes or 0))
        notification = NotificationCenterEngine.get_notification(notification_id)
        if not notification:
            raise ValueError("Notificacao nao encontrada")

        now = datetime.now()
        scheduled_for = NotificationCenterEngine._parse_datetime_value(notification.get("scheduled_for")) or now
        if scheduled_for < now:
            scheduled_for = now
        snoozed_until = scheduled_for + timedelta(minutes=snooze_minutes)

        meta = dict(notification.get("meta") or {})
        meta["snoozed_from_id"] = notification_id
        meta["snooze_minutes"] = snooze_minutes
        meta["snooze_count"] = int(meta.get("snooze_count") or 0) + 1

        unique_key = f"{notification.get('unique_key') or NotificationCenterEngine._unique_key(notification)}:snooze:{int(snoozed_until.timestamp())}"
        new_id = NotificationCenterEngine._insert_notification(
            {
                "notification_type": notification.get("notification_type") or notification.get("type") or "custom_notification",
                "source_feature": notification.get("source_feature") or "custom",
                "title": notification.get("title"),
                "message": notification.get("message"),
                "severity": notification.get("severity") or "info",
                "status": NotificationCenterEngine.DEFAULT_STATUS,
                "scheduled_for": snoozed_until.isoformat(timespec="minutes"),
                "meta": meta,
                "sound_key": notification.get("sound_key"),
                "color_token": notification.get("color_token"),
            },
            unique_key=unique_key,
        )
        NotificationCenterEngine.update_notification_status(notification_id, "canceled")
        return NotificationCenterEngine.get_notification(new_id) if new_id else {
            "id": None,
            "scheduled_for": snoozed_until.isoformat(timespec="minutes"),
        }

    @staticmethod
    def get_preferences():
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT feature_key, enabled, channels, quiet_hours, updated_at
                FROM notification_preferences
                """
            )

        existing = {
            row["feature_key"]: NotificationCenterEngine._serialize_preference_row(dict(row))
            for row in rows
        }

        changed = False
        for feature_key in NotificationCenterEngine.SUPPORTED_FEATURES:
            if feature_key not in existing:
                existing[feature_key] = NotificationCenterEngine._default_feature_preference(feature_key)
                changed = True

        if changed:
            NotificationCenterEngine.save_preferences(list(existing.values()))

        return [existing[feature] for feature in NotificationCenterEngine.SUPPORTED_FEATURES]

    @staticmethod
    def save_preferences(payload: List[Dict[str, Any]]):
        normalized_payload = []
        for item in payload:
            feature_key = item.get("feature_key")
            if feature_key not in NotificationCenterEngine.SUPPORTED_FEATURES:
                continue
            normalized_payload.append(
                {
                    "feature_key": feature_key,
                    "enabled": bool(item.get("enabled", True)),
                    "channels": NotificationCenterEngine._normalize_channels(item.get("channels")),
                    "quiet_hours": item.get("quiet_hours"),
                }
            )

        if not normalized_payload:
            normalized_payload = [
                NotificationCenterEngine._default_feature_preference(feature_key)
                for feature_key in NotificationCenterEngine.SUPPORTED_FEATURES
            ]

        with Database() as db:
            for item in normalized_payload:
                db.execute(
                    """
                    INSERT INTO notification_preferences (feature_key, enabled, channels, quiet_hours, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(feature_key) DO UPDATE SET
                        enabled = excluded.enabled,
                        channels = excluded.channels,
                        quiet_hours = excluded.quiet_hours,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (
                        item["feature_key"],
                        1 if item["enabled"] else 0,
                        json.dumps(item["channels"], ensure_ascii=False),
                        json.dumps(item["quiet_hours"], ensure_ascii=False)
                        if item["quiet_hours"] is not None
                        else None,
                    ),
                )

    @staticmethod
    def is_feature_enabled(feature_key: str, require_channel: str = "in_app"):
        normalized_key = NotificationCenterEngine._normalize_feature_key(feature_key)
        prefs = {item["feature_key"]: item for item in NotificationCenterEngine.get_preferences()}
        pref = prefs.get(normalized_key)
        if not pref:
            return True
        if not pref.get("enabled", True):
            return False
        return require_channel in pref.get("channels", [])

    @staticmethod
    def register_mobile_device(device_token: str, platform: str, device_name: Optional[str] = None):
        normalized_token = (device_token or "").strip()
        normalized_platform = (platform or "").strip().lower()
        normalized_name = (device_name or "").strip() or None

        if not normalized_token:
            raise ValueError("device_token is required")
        if normalized_platform not in {"android", "ios", "expo", "web"}:
            raise ValueError("platform is invalid")

        with Database() as db:
            db.execute(
                """
                INSERT INTO mobile_devices (device_token, platform, device_name, is_active, last_seen_at, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT(device_token) DO UPDATE SET
                    platform = excluded.platform,
                    device_name = excluded.device_name,
                    is_active = 1,
                    last_seen_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (normalized_token, normalized_platform, normalized_name),
            )
            row = db.fetchone(
                """
                SELECT id, device_token, platform, device_name, is_active, last_seen_at, created_at, updated_at
                FROM mobile_devices
                WHERE device_token = ?
                """,
                (normalized_token,),
            )
        return dict(row) if row else None

    @staticmethod
    def list_mobile_devices(include_inactive: bool = False):
        query = """
            SELECT id, device_token, platform, device_name, is_active, last_seen_at, created_at, updated_at
            FROM mobile_devices
        """
        if not include_inactive:
            query += " WHERE is_active = 1"
        query += " ORDER BY datetime(updated_at) DESC, id DESC"
        with Database() as db:
            rows = db.fetchall(query)
        return [dict(row) for row in rows]

    @staticmethod
    def deactivate_mobile_device(device_token: str):
        normalized_token = (device_token or "").strip()
        if not normalized_token:
            raise ValueError("device_token is required")

        with Database() as db:
            result = db.execute(
                """
                UPDATE mobile_devices
                SET is_active = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE device_token = ?
                """,
                (normalized_token,),
            )
            return result.rowcount > 0

    @staticmethod
    def dispatch_push_notifications(notification_ids: Optional[List[int]] = None, dry_run: bool = False):
        notifications = NotificationCenterEngine.list_notifications(include_read=False)
        if notification_ids:
            allowed_ids = set(notification_ids)
            notifications = [item for item in notifications if item.get("id") in allowed_ids]

        devices = NotificationCenterEngine.list_mobile_devices(include_inactive=False)
        summary = {
            "devices": len(devices),
            "notifications": len(notifications),
            "attempted": 0,
            "sent": 0,
            "failed": 0,
            "skipped": 0,
            "retried": 0,
            "dry_run": dry_run,
        }

        if not devices or not notifications:
            return summary

        for notification in notifications:
            feature_key = NotificationCenterEngine._normalize_feature_key(notification.get("source_feature"))
            if not NotificationCenterEngine.is_feature_enabled(feature_key, require_channel="push"):
                summary["skipped"] += len(devices)
                continue

            for device in devices:
                delivery = NotificationCenterEngine._get_delivery(notification["id"], device["id"])
                if delivery and not NotificationCenterEngine._should_retry_delivery(delivery):
                    summary["skipped"] += 1
                    continue

                summary["attempted"] += 1
                if delivery:
                    summary["retried"] += 1

                if dry_run:
                    NotificationCenterEngine._store_push_delivery(
                        notification["id"],
                        device["id"],
                        status="dry_run",
                        retry_count=(delivery or {}).get("retry_count", 0),
                    )
                    summary["sent"] += 1
                    continue

                result = NotificationCenterEngine._send_expo_push(device, notification)
                next_retry_count = ((delivery or {}).get("retry_count", 0) + 1) if result.get("status") != "sent" else (delivery or {}).get("retry_count", 0)
                NotificationCenterEngine._store_push_delivery(
                    notification["id"],
                    device["id"],
                    status=result.get("status", "failed"),
                    ticket_id=result.get("ticket_id"),
                    error_message=result.get("error_message"),
                    retry_count=next_retry_count,
                )
                if result.get("status") == "sent":
                    summary["sent"] += 1
                else:
                    summary["failed"] += 1

        return summary

    @staticmethod
    def _get_delivery(notification_id: int, device_id: int):
        with Database() as db:
            row = db.fetchone(
                """
                SELECT id, notification_id, device_id, provider, ticket_id, status, error_message, retry_count, created_at, updated_at
                FROM notification_push_deliveries
                WHERE notification_id = ? AND device_id = ?
                """,
                (notification_id, device_id),
            )
        return dict(row) if row else None

    @staticmethod
    def _should_retry_delivery(delivery: Dict[str, Any]):
        if not delivery:
            return True
        status = delivery.get("status")
        retry_count = int(delivery.get("retry_count") or 0)
        error_message = delivery.get("error_message") or ""
        if status in {"sent", "receipt_ok", "dry_run", "receipt_error"}:
            return False
        if "DeviceNotRegistered" in error_message:
            return False
        return retry_count < MAX_PUSH_RETRIES

    @staticmethod
    def _store_push_delivery(notification_id: int, device_id: int, status: str, ticket_id: Optional[str] = None, error_message: Optional[str] = None, retry_count: int = 0):
        with Database() as db:
            db.execute(
                """
                INSERT INTO notification_push_deliveries (notification_id, device_id, provider, ticket_id, status, error_message, retry_count, updated_at)
                VALUES (?, ?, 'expo', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(notification_id, device_id) DO UPDATE SET
                    ticket_id = excluded.ticket_id,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    retry_count = excluded.retry_count,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (notification_id, device_id, ticket_id, status, error_message, retry_count),
            )

    @staticmethod
    def list_push_deliveries(limit: int = 100, status: Optional[str] = None):
        query = """
            SELECT
                pd.id,
                pd.notification_id,
                pd.device_id,
                pd.provider,
                pd.ticket_id,
                pd.status,
                pd.error_message,
                pd.retry_count,
                pd.created_at,
                pd.updated_at,
                n.title AS notification_title,
                n.source_feature,
                md.device_token,
                md.platform,
                md.device_name,
                md.is_active
            FROM notification_push_deliveries pd
            INNER JOIN notifications n ON n.id = pd.notification_id
            INNER JOIN mobile_devices md ON md.id = pd.device_id
        """
        params = []
        if status:
            query += " WHERE pd.status = ?"
            params.append(status)
        query += " ORDER BY datetime(pd.updated_at) DESC, pd.id DESC LIMIT ?"
        params.append(max(1, min(int(limit or 100), 500)))
        with Database() as db:
            rows = db.fetchall(query, tuple(params))
        return [dict(row) for row in rows]

    @staticmethod
    def refresh_expo_push_receipts(ticket_ids: Optional[List[str]] = None):
        deliveries = NotificationCenterEngine.list_push_deliveries(limit=500)
        pending = [item for item in deliveries if item.get("ticket_id") and item.get("status") == "sent"]
        if ticket_ids:
            allowed = set(ticket_ids)
            pending = [item for item in pending if item.get("ticket_id") in allowed]

        if not pending:
            return {"checked": 0, "updated": 0, "invalidated_devices": 0}

        ids = [item["ticket_id"] for item in pending]
        request = urllib_request.Request(
            EXPO_RECEIPTS_URL,
            data=json.dumps({"ids": ids}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )

        updated = 0
        invalidated = 0
        with urllib_request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
        parsed = json.loads(raw) if raw else {}
        receipt_map = parsed.get("data") or {}

        for delivery in pending:
            receipt = receipt_map.get(delivery["ticket_id"]) or {}
            status = receipt.get("status")
            details = receipt.get("details") or {}
            if status == "ok":
                NotificationCenterEngine._store_push_delivery(
                    delivery["notification_id"],
                    delivery["device_id"],
                    status="receipt_ok",
                    ticket_id=delivery["ticket_id"],
                    error_message=None,
                    retry_count=delivery.get("retry_count", 0),
                )
                updated += 1
                continue

            error_message = json.dumps(details) if details else receipt.get("message") or "receipt_error"
            NotificationCenterEngine._store_push_delivery(
                delivery["notification_id"],
                delivery["device_id"],
                status="receipt_error",
                ticket_id=delivery["ticket_id"],
                error_message=error_message,
                retry_count=delivery.get("retry_count", 0),
            )
            updated += 1
            if details.get("error") == "DeviceNotRegistered":
                NotificationCenterEngine._deactivate_device_by_id(delivery["device_id"])
                invalidated += 1

        return {"checked": len(pending), "updated": updated, "invalidated_devices": invalidated}

    @staticmethod
    def _deactivate_device_by_id(device_id: int):
        with Database() as db:
            db.execute(
                "UPDATE mobile_devices SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (device_id,),
            )

    @staticmethod
    def _build_expo_push_payload(device: Dict[str, Any], notification: Dict[str, Any]):
        return {
            "to": device["device_token"],
            "title": notification.get("title") or "EDI",
            "body": notification.get("message") or "Nova notificação",
            "sound": "default" if notification.get("sound_key") else None,
            "data": {
                "notification_id": notification.get("id"),
                "source_feature": notification.get("source_feature"),
                "notification_type": notification.get("notification_type"),
                "meta": notification.get("meta") or {},
            },
        }

    @staticmethod
    def _send_expo_push(device: Dict[str, Any], notification: Dict[str, Any]):
        payload = NotificationCenterEngine._build_expo_push_payload(device, notification)
        body = json.dumps(payload).encode("utf-8")
        request = urllib_request.Request(
            EXPO_PUSH_URL,
            data=body,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib_request.urlopen(request, timeout=15) as response:
                raw = response.read().decode("utf-8")
            parsed = json.loads(raw) if raw else {}
            data = parsed.get("data") or {}
            if isinstance(data, list):
                data = data[0] if data else {}
            if data.get("status") == "ok":
                return {"status": "sent", "ticket_id": data.get("id")}
            details = data.get("details") if isinstance(data, dict) else None
            return {
                "status": "failed",
                "ticket_id": data.get("id") if isinstance(data, dict) else None,
                "error_message": json.dumps(details) if details else data.get("message") if isinstance(data, dict) else "expo_error",
            }
        except urllib_error.HTTPError as exc:
            return {"status": "failed", "error_message": f"http_error:{exc.code}"}
        except urllib_error.URLError as exc:
            return {"status": "failed", "error_message": f"url_error:{exc.reason}"}
        except Exception as exc:
            return {"status": "failed", "error_message": str(exc)}

    @staticmethod
    def generate_system_notifications(days_ahead: int = 7):
        NotificationCenterEngine._check_stalled_goals()
        NotificationCenterEngine._check_upcoming_deadlines(days_ahead=days_ahead)
        NotificationCenterEngine._check_consumables(days_ahead=days_ahead)
        NotificationCenterEngine._check_daily_routine_start_notifications()
        NotificationCenterEngine._store_daily_summary()
        NotificationCenterEngine._check_weekly_journal_prompt()

    @staticmethod
    def _check_daily_routine_start_notifications(lookback_minutes: int = 15):
        try:
            now = datetime.now().replace(second=0, microsecond=0)
            day_start = now.replace(hour=0, minute=0)
            window_start = now - timedelta(minutes=max(1, lookback_minutes))

            with Database() as db:
                rows = db.fetchall(
                    """
                    SELECT
                        dpb.id,
                        dpb.date,
                        dpb.start_time,
                        dpb.duration,
                        dpb.completed,
                        COALESCE(a.title, dpb.block_name, 'Atividade') AS activity_title,
                        dpb.block_name
                    FROM daily_plan_blocks dpb
                    LEFT JOIN activities a ON a.id = dpb.activity_id
                    WHERE dpb.date = ?
                      AND COALESCE(dpb.completed, 0) = 0
                    """,
                    (now.date().isoformat(),),
                )

            for raw_row in rows:
                row = dict(raw_row)
                start_time = row.get("start_time")
                if not start_time:
                    continue

                try:
                    scheduled_for = datetime.strptime(f"{row['date']} {start_time}", "%Y-%m-%d %H:%M")
                except ValueError:
                    continue

                if scheduled_for > now:
                    continue
                if scheduled_for < max(window_start, day_start):
                    continue

                title = row.get("activity_title") or row.get("block_name") or "Atividade"
                payload = {
                    "notification_type": "daily_activity_start",
                    "source_feature": "daily",
                    "title": "Hora de iniciar atividade",
                    "message": f"A atividade '{title}' está programada para começar agora.",
                    "severity": "info",
                    "scheduled_for": scheduled_for.isoformat(),
                    "sound_key": "default",
                    "color_token": "primary",
                    "meta": {
                        "date": row.get("date"),
                        "plan_block_id": row.get("id"),
                        "activity_title": title,
                        "start_time": start_time,
                        "duration": row.get("duration"),
                    },
                }
                NotificationCenterEngine._insert_notification(payload)
        except Exception as exc:
            logger.error("Erro ao verificar início de atividades da rotina: %s", exc)

    @staticmethod
    def _check_consumables(days_ahead: int = 7):
        try:
            risk_notifications = ConsumablesEngine.detect_restock_risks(window_days=days_ahead)
            for payload in risk_notifications:
                NotificationCenterEngine._insert_notification(
                    payload,
                    unique_key=payload.get("unique_key"),
                )
        except Exception as exc:
            logger.error("Erro ao verificar risco de consumíveis: %s", exc)

    @staticmethod
    def _check_stalled_goals():
        try:
            for goal in GoalEngine.list_goals():
                if not goal.get("notifications_enabled", True):
                    continue
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
                if not goal.get("notifications_enabled", True):
                    continue
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
    def _check_weekly_journal_prompt():
        try:
            if not NoteEngine.is_weekly_journal_due():
                return
            journal_state = NoteEngine.get_journal_entry()
            week = journal_state.get("week") or {}
            settings = NoteEngine.get_journal_settings()
            reminder_time = settings.get("reminder_time") or NoteEngine.DEFAULT_JOURNAL_TIME
            scheduled_for = f"{date.today().isoformat()}T{reminder_time}"
            payload = {
                "notification_type": "weekly_journal_prompt",
                "source_feature": "journal",
                "title": "Diário semanal pendente",
                "message": f"Seu diário da semana {week.get('label', '')} ainda não foi preenchido.",
                "severity": "warning",
                "status": NotificationCenterEngine.DEFAULT_STATUS,
                "scheduled_for": scheduled_for,
                "meta": {
                    "week_start": week.get("week_start"),
                    "week_end": week.get("week_end"),
                    "label": week.get("label"),
                },
                "sound_key": "soft_chime",
                "color_token": "warning",
            }
            NotificationCenterEngine._insert_notification(payload)
        except Exception as exc:
            logger.error("Erro ao gerar prompt do diário semanal: %s", exc)

    @staticmethod
    def _insert_notification(payload: Dict[str, Any], unique_key: Optional[str] = None):
        payload = _repair_mojibake_payload(payload)
        source_feature = payload.get("source_feature") or "system"
        feature_key = NotificationCenterEngine._normalize_feature_key(source_feature)
        if not NotificationCenterEngine.is_feature_enabled(feature_key=feature_key, require_channel="in_app"):
            return None

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
                    source_feature,
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
    def _parse_datetime_value(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _default_feature_preference(feature_key: str):
        return {
            "feature_key": feature_key,
            "enabled": True,
            "channels": list(NotificationCenterEngine.DEFAULT_CHANNELS),
            "quiet_hours": None,
            "updated_at": None,
        }

    @staticmethod
    def _serialize_preference_row(row: Dict[str, Any]):
        channels = NotificationCenterEngine.DEFAULT_CHANNELS
        if row.get("channels"):
            try:
                parsed_channels = json.loads(row.get("channels"))
                if isinstance(parsed_channels, list):
                    channels = NotificationCenterEngine._normalize_channels(parsed_channels)
            except (TypeError, ValueError, json.JSONDecodeError):
                channels = list(NotificationCenterEngine.DEFAULT_CHANNELS)

        quiet_hours = None
        if row.get("quiet_hours"):
            try:
                quiet_hours = json.loads(row.get("quiet_hours"))
            except (TypeError, ValueError, json.JSONDecodeError):
                quiet_hours = None

        return {
            "feature_key": row.get("feature_key"),
            "enabled": bool(row.get("enabled", 1)),
            "channels": channels,
            "quiet_hours": quiet_hours,
            "updated_at": row.get("updated_at"),
        }

    @staticmethod
    def _normalize_channels(channels: Any):
        if not isinstance(channels, list):
            channels = list(NotificationCenterEngine.DEFAULT_CHANNELS)

        allowed_channels = {"in_app", "sound", "push"}
        normalized = [channel for channel in channels if channel in allowed_channels]
        return normalized or ["in_app"]

    @staticmethod
    def _normalize_feature_key(source_feature: Optional[str]):
        if source_feature in NotificationCenterEngine.SUPPORTED_FEATURES:
            return source_feature

        mapping = {
            "manual": "custom",
            "system": "custom",
            "legacy_notifications": "custom",
        }
        return mapping.get(source_feature or "custom", "custom")

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
        if notification_type == "daily_activity_start":
            return f"{notification_type}:{meta.get('plan_block_id')}:{meta.get('date')}:{meta.get('start_time')}"
        if notification_type == "weekly_journal_prompt":
            return f"{notification_type}:{meta.get('week_start')}"

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







