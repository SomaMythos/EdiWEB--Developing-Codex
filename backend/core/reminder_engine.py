from core.notification_center_engine import NotificationCenterEngine


class ReminderEngine:
    @staticmethod
    def add_reminder(title, description=None, due_date=None, priority=3, category='pessoal', reminder_days_before=7):
        return NotificationCenterEngine.reminder_adapter_create(
            title,
            description,
            due_date,
            priority,
            category,
            reminder_days_before,
        )

    @staticmethod
    def list_reminders(status='pendente'):
        return NotificationCenterEngine.reminder_adapter_list(status=status)

    @staticmethod
    def get_upcoming_reminders(days_ahead=7):
        return NotificationCenterEngine.reminder_adapter_upcoming(days_ahead=days_ahead)

    @staticmethod
    def complete_reminder(reminder_id):
        NotificationCenterEngine.reminder_adapter_complete(reminder_id)
