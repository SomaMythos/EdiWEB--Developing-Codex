from pathlib import Path
import os
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.notification_engine import NotificationEngine
from main import (
    _notification_days_ahead,
    _notification_scheduler_interval_seconds,
    _should_start_notification_scheduler,
)


def test_notification_engine_run_cycle_calls_generate_and_dispatch(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "core.notification_engine.NotificationCenterEngine.generate_system_notifications",
        lambda days_ahead=7: calls.append(("generate", days_ahead)),
    )
    monkeypatch.setattr(
        "core.notification_engine.NotificationCenterEngine.dispatch_push_notifications",
        lambda dry_run=False: {"sent": 2, "dry_run": dry_run},
    )
    monkeypatch.setattr(
        "core.notification_engine.NotificationCenterEngine.list_notifications",
        lambda include_read=False: [{"id": 1}, {"id": 2}] if not include_read else [],
    )

    result = NotificationEngine.run_cycle(days_ahead=5, dry_run_push=True)

    assert calls == [("generate", 5)]
    assert result == {
        "generated_unread": 2,
        "push": {"sent": 2, "dry_run": True},
    }


def test_scheduler_helpers_respect_environment(monkeypatch):
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)
    monkeypatch.delenv("EDI_NOTIFICATIONS_SCHEDULER_DISABLED", raising=False)
    monkeypatch.setenv("EDI_NOTIFICATIONS_INTERVAL_SECONDS", "45")
    monkeypatch.setenv("EDI_NOTIFICATIONS_DAYS_AHEAD", "3")

    assert _should_start_notification_scheduler() is True
    assert _notification_scheduler_interval_seconds() == 45
    assert _notification_days_ahead() == 3

    monkeypatch.setenv("EDI_NOTIFICATIONS_SCHEDULER_DISABLED", "1")
    assert _should_start_notification_scheduler() is False


def test_scheduler_helpers_skip_during_pytest(monkeypatch):
    monkeypatch.setenv("PYTEST_CURRENT_TEST", "active")
    assert _should_start_notification_scheduler() is False
