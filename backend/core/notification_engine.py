from core.notification_center_engine import NotificationCenterEngine


class NotificationEngine:
    @staticmethod
    def check_stalled_goals(store=False):
        if store:
            NotificationCenterEngine.generate_system_notifications()
        return [
            item for item in NotificationCenterEngine.list_notifications(include_read=True)
            if item.get("notification_type") == "stalled_goal"
        ]

    @staticmethod
    def check_upcoming_deadlines(days_ahead=7, store=False):
        if store:
            NotificationCenterEngine.generate_system_notifications(days_ahead=days_ahead)
        return [
            item for item in NotificationCenterEngine.list_notifications(include_read=True)
            if item.get("notification_type") == "upcoming_deadline"
        ]

    @staticmethod
    def get_daily_summary(store=False):
        if store:
            NotificationCenterEngine.generate_system_notifications()
        summaries = [
            item for item in NotificationCenterEngine.list_notifications(include_read=True)
            if item.get("notification_type") == "daily_summary"
        ]
        return summaries[0] if summaries else None

    @staticmethod
    def list_notifications(include_read=False):
        return NotificationCenterEngine.list_notifications(include_read=include_read)

    @staticmethod
    def get_all_notifications():
        NotificationCenterEngine.generate_system_notifications()
        return NotificationCenterEngine.list_notifications(include_read=False)

    @staticmethod
    def mark_as_read(notification_id):
        NotificationCenterEngine.update_notification_status(notification_id, "read")

    @staticmethod
    def clear_all():
        for notification in NotificationCenterEngine.list_notifications(include_read=False):
            NotificationCenterEngine.update_notification_status(notification["id"], "read")
