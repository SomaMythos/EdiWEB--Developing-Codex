from core.daily_discipline_engine import DailyDisciplineEngine


class _FakeDatabase:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def fetchall(self, query, params=None):
        return [
            {
                "id": 1,
                "title": "Flex",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "flex",
                "fixed_time": "08:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 2,
                "title": "Everyday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "everyday",
                "fixed_time": "09:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 3,
                "title": "Workday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "workday",
                "fixed_time": "10:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
            {
                "id": 4,
                "title": "Offday",
                "min_duration": 10,
                "max_duration": 10,
                "frequency_type": "offday",
                "fixed_time": "11:00",
                "fixed_duration": 10,
                "is_disc": 1,
                "is_fun": 0,
            },
        ]


def test_frequency_filter_respects_weekend_overridden_to_work(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "work",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-22", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 3]


def test_frequency_filter_respects_weekday_overridden_to_off(monkeypatch):
    monkeypatch.setattr("core.daily_discipline_engine.Database", _FakeDatabase)
    monkeypatch.setattr(
        "core.daily_discipline_engine.DailyOverrideEngine.get_day_type",
        lambda _date: "off",
    )

    result = DailyDisciplineEngine.build_today_activity_list("2026-02-18", 10)

    ids = [item["id"] for item in result]
    assert ids == [1, 2, 4]
