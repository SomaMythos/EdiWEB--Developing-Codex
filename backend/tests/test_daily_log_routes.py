import asyncio
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import DailyActivityLog, get_daily_log_by_date, register_daily_activity


def test_register_daily_activity_passes_timestamp_to_engine(monkeypatch):
    captured = {}

    def _register_activity(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr("main.DailyLogEngine.register_activity", _register_activity)

    response = asyncio.run(
        register_daily_activity(
            DailyActivityLog(
                activity_id=7,
                duration=25,
                completed=1,
                timestamp="08:30",
            )
        )
    )

    assert response == {"success": True, "message": "Activity registered"}
    assert captured == {
        "activity_id": 7,
        "duration": 25,
        "completed": 1,
        "timestamp": "08:30",
    }


def test_get_daily_log_by_date_passes_selected_date_to_engine(monkeypatch):
    monkeypatch.setattr(
        "main.DailyLogEngine.list_day",
        lambda log_date=None: [{"date": log_date, "title": "Leitura"}],
    )

    response = asyncio.run(get_daily_log_by_date("2026-03-18"))

    assert response == {
        "success": True,
        "data": [{"date": "2026-03-18", "title": "Leitura"}],
    }
