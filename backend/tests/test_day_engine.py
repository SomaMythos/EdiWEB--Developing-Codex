from core.day_engine import DayEngine, FixedEvent, ActivityTemplate, generate_day_schedule


def _overlaps(a_start, a_end, b_start, b_end):
    return a_start < b_end and b_start < a_end


def test_allocate_marks_template_not_scheduled_when_post_allocation_detects_conflict(monkeypatch):
    engine = DayEngine(buffer_between=0, granularity_min=1, seed=1)

    fixed_events = [
        FixedEvent(id="block", name="Routine", start=600, end=660, category="routine"),
    ]
    templates = [
        ActivityTemplate(
            id="tpl-1",
            name="Template",
            category="activity",
            min_duration=30,
            max_duration=30,
            priority=5,
        )
    ]

    monkeypatch.setattr(engine, "_build_free", lambda _fixed: [(600, 660)])

    scheduled, not_scheduled, _ = engine.allocate(fixed_events, templates)

    assert all(item.reason != "placed" for item in scheduled)
    assert not_scheduled == [
        type(not_scheduled[0])("tpl-1", "Template", "conflict_fixed_block")
    ]


def test_fixed_time_overlapping_routine_block_keeps_placed_items_non_overlapping_with_fixed():
    result = generate_day_schedule(
        fixed_events_json=[
            {
                "id": "routine",
                "name": "Rotina",
                "start_hm": "10:00",
                "end_hm": "11:00",
                "category": "routine",
            },
            {
                "id": "fixed_activity:7",
                "name": "Atividade fixa",
                "start_hm": "10:30",
                "end_hm": "11:30",
                "category": "disciplina",
            },
        ],
        templates_json=[
            {
                "id": "9",
                "name": "Template livre",
                "category": "disciplina",
                "min_duration": 60,
                "max_duration": 60,
                "priority": 5,
            }
        ],
        buffer_between=0,
        granularity_min=1,
        seed=42,
    )

    fixed = [item for item in result["scheduled"] if item["reason"] == "fixed"]
    placed = [item for item in result["scheduled"] if item["reason"] == "placed"]

    assert len(fixed) == 2
    assert len(placed) == 1
    assert result["not_scheduled"] == []

    for p in placed:
        assert not any(
            _overlaps(p["start_min"], p["end_min"], f["start_min"], f["end_min"])
            for f in fixed
        )
