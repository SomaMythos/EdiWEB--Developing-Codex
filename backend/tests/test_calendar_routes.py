from pathlib import Path
import asyncio
import sqlite3
import sys
from datetime import date

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from core.daily_engine import DailyEngine
from core.goal_engine import GoalEngine
from main import (
    CalendarEventPayload,
    CalendarEventCompletionPayload,
    CalendarManualLogPayload,
    app,
    calendar_complete_event,
    calendar_create_event,
    calendar_create_manual_log,
    calendar_day,
    calendar_delete_event,
    calendar_delete_manual_log,
    calendar_month,
    calendar_week,
    calendar_update_event,
    calendar_update_manual_log,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / 'data' / 'schema.sql'
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding='utf-8'))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr('core.calendar_engine.Database', lambda: Database(path=db_path))


def _configure_feature_dbs(monkeypatch, db_path: Path):
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr('core.daily_engine.Database', lambda: Database(path=db_path))
    monkeypatch.setattr('core.goal_engine.Database', lambda: Database(path=db_path))


def _run(coro):
    return asyncio.run(coro)


def test_calendar_routes_are_registered_once_per_method_and_path():
    target_routes = {
        ('GET', '/api/calendar/month'),
        ('GET', '/api/calendar/day'),
        ('POST', '/api/calendar/events'),
        ('PUT', '/api/calendar/events/{event_id}'),
        ('PATCH', '/api/calendar/events/{event_id}/complete'),
        ('DELETE', '/api/calendar/events/{event_id}'),
        ('POST', '/api/calendar/logs'),
        ('PUT', '/api/calendar/logs/{log_id}'),
        ('DELETE', '/api/calendar/logs/{log_id}'),
    }

    route_counts = {route: 0 for route in target_routes}

    for route in app.router.routes:
        path = getattr(route, 'path', None)
        methods = getattr(route, 'methods', set()) or set()
        for method in methods:
            key = (method, path)
            if key in route_counts:
                route_counts[key] += 1

    assert all(count == 1 for count in route_counts.values())


def test_calendar_month_and_day_merge_manual_and_automatic_logs(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with Database(path=db_path) as db:
        db.execute("INSERT INTO activities (title, min_duration, max_duration) VALUES ('Treino', 30, 60)")
        db.execute("INSERT INTO daily_logs (date) VALUES ('2026-03-15')")
        db.execute(
            "INSERT INTO daily_activity_logs (daily_log_id, activity_id, duration, completed, timestamp) VALUES (1, 1, 45, 1, '09:15:00')"
        )
        db.execute(
            "INSERT INTO goals (title, status, completed_at, difficulty) VALUES ('Meta trimestral', 'concluida', '2026-03-15T18:00:00', 3)"
        )
        db.execute(
            "INSERT INTO books (title, book_type, status, created_at, finished_at) VALUES ('Livro A', 'Livro', 'concluido', '2026-03-15T08:00:00', '2026-03-15T20:00:00')"
        )

    created_event = _run(
        calendar_create_event(
            CalendarEventPayload(
                date='2026-03-15',
                title='Dentista',
                description='Consulta de rotina',
                start_time='14:00',
                end_time='15:00',
            )
        )
    )
    created_log = _run(
        calendar_create_manual_log(
            CalendarManualLogPayload(
                date='2026-03-15',
                title='Dia puxado',
                description='Fechei tudo que estava pendente.',
            )
        )
    )

    month_payload = _run(calendar_month('2026-03'))['data']
    day_payload = _run(calendar_day('2026-03-15'))['data']

    assert created_event['data']['id'] == 1
    assert created_log['data']['id'] == 1
    assert month_payload['days']['2026-03-15']['manual_events'] == 1
    assert month_payload['days']['2026-03-15']['manual_logs'] == 1
    assert month_payload['days']['2026-03-15']['automatic_logs'] >= 3
    assert month_payload['days']['2026-03-15']['has_manual_event'] is True
    assert month_payload['manual_events'][0]['title'] == 'Dentista'

    automatic_types = {entry['event_type'] for entry in day_payload['automatic_logs']}
    assert {'goal_completed', 'book_created', 'book_finished'} <= automatic_types
    assert 'daily_completed' not in automatic_types
    assert day_payload['summary']['daily_blocks'] == 0
    assert day_payload['events'][0]['title'] == 'Dentista'
    assert day_payload['manual_logs'][0]['title'] == 'Dia puxado'


def test_calendar_delete_endpoints_remove_manual_entries(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    event_id = _run(calendar_create_event(CalendarEventPayload(date='2026-03-10', title='Evento teste')))['data']['id']
    log_id = _run(calendar_create_manual_log(CalendarManualLogPayload(date='2026-03-10', title='Log teste')))['data']['id']

    assert _run(calendar_delete_event(event_id)) == {'success': True}
    assert _run(calendar_delete_manual_log(log_id)) == {'success': True}

    with pytest.raises(HTTPException) as event_exc:
        _run(calendar_delete_event(event_id))
    assert event_exc.value.status_code == 404

    with pytest.raises(HTTPException) as log_exc:
        _run(calendar_delete_manual_log(log_id))
    assert log_exc.value.status_code == 404


def test_calendar_manual_event_can_be_marked_completed(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    event_id = _run(
        calendar_create_event(
            CalendarEventPayload(
                date='2026-03-15',
                title='Fechar relatório',
                description='Entrega final',
                start_time='10:00',
                end_time='11:00',
            )
        )
    )['data']['id']

    assert _run(calendar_complete_event(event_id, CalendarEventCompletionPayload(completed=True))) == {'success': True}

    day_payload = _run(calendar_day('2026-03-15'))['data']

    assert day_payload['events'][0]['title'] == 'Fechar relatório'
    assert day_payload['events'][0]['is_completed'] is True
    assert day_payload['events'][0]['completed_at'] is not None

    assert _run(calendar_complete_event(event_id, CalendarEventCompletionPayload(completed=False))) == {'success': True}
    reopened_payload = _run(calendar_day('2026-03-15'))['data']
    assert reopened_payload['events'][0]['is_completed'] is False
    assert reopened_payload['events'][0]['completed_at'] is None


def test_calendar_rejects_invalid_month_and_date(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with pytest.raises(HTTPException) as month_exc:
        _run(calendar_month('2026/03'))
    assert month_exc.value.status_code == 400

    with pytest.raises(HTTPException) as day_exc:
        _run(calendar_day('15-03-2026'))
    assert day_exc.value.status_code == 400


def test_calendar_automatic_logs_track_daily_block_completion_and_goal_status(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_feature_dbs(monkeypatch, db_path)
    today = date.today().isoformat()
    month_key = today[:7]

    with Database(path=db_path) as db:
        db.execute("INSERT INTO activities (title, min_duration, max_duration) VALUES ('Leitura focada', 20, 40)")
        db.execute(
            "INSERT INTO daily_plan_blocks (date, start_time, duration, activity_id, source_type, block_name, block_category, completed, updated_source) VALUES (?, '07:30', 30, 1, 'template', 'Leitura focada', 'disciplina', 0, 'auto')",
            (today,),
        )
        db.execute("INSERT INTO goals (title, status, difficulty) VALUES ('Fechar sprint pessoal', 'ativa', 4)")

    DailyEngine.toggle_block_completion(1, True)
    assert GoalEngine.update_status(1, 'concluida') is True

    day_payload = _run(calendar_day(today))['data']
    month_payload = _run(calendar_month(month_key))['data']

    automatic_types = {entry['event_type'] for entry in day_payload['automatic_logs']}
    assert 'daily_completed' not in automatic_types
    assert 'goal_completed' in automatic_types
    assert month_payload['days'][today]['automatic_logs'] >= 1

    assert day_payload['daily_blocks']
    assert any(block['title'] == 'Leitura focada' and block['completed'] is True for block in day_payload['daily_blocks'])
    assert day_payload['summary']['daily_blocks'] == 1
    assert day_payload['summary']['daily_completed_blocks'] == 1
    assert day_payload['summary']['daily_pending_blocks'] == 0
    assert day_payload['summary']['daily_all_completed'] is True
    assert month_payload['days'][today]['daily_blocks'] == 1
    assert month_payload['days'][today]['daily_completed_blocks'] == 1
    assert month_payload['days'][today]['daily_pending_blocks'] == 0
    assert month_payload['days'][today]['daily_all_completed'] is True

    week_payload = _run(calendar_week(today))['data']
    assert any(day['date'] == today and day['summary']['daily_all_completed'] is True for day in week_payload['days'])
    today_week_card = next(day for day in week_payload['days'] if day['date'] == today)
    assert all(entry['title'] != 'Leitura focada' for entry in today_week_card['preview'])

    goal_entries = [entry for entry in day_payload['automatic_logs'] if entry['event_type'] == 'goal_completed']
    assert any(entry['title'] == 'Fechar sprint pessoal' for entry in goal_entries)


def test_calendar_update_endpoints_edit_manual_entries(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    event_id = _run(
        calendar_create_event(
            CalendarEventPayload(
                date='2026-03-10',
                title='Evento teste',
                description='Antes',
                start_time='09:00',
                end_time='10:00',
            )
        )
    )['data']['id']
    log_id = _run(
        calendar_create_manual_log(
            CalendarManualLogPayload(
                date='2026-03-10',
                title='Log teste',
                description='Antes',
            )
        )
    )['data']['id']

    assert _run(
        calendar_update_event(
            event_id,
            CalendarEventPayload(
                date='2026-03-11',
                title='Evento atualizado',
                description='Depois',
                start_time='11:00',
                end_time='12:30',
            )
        )
    ) == {'success': True}

    assert _run(
        calendar_update_manual_log(
            log_id,
            CalendarManualLogPayload(
                date='2026-03-11',
                title='Log atualizado',
                description='Depois',
            )
        )
    ) == {'success': True}

    day_payload = _run(calendar_day('2026-03-11'))['data']

    assert day_payload['events'][0]['title'] == 'Evento atualizado'
    assert day_payload['events'][0]['start_time'] == '11:00'
    assert day_payload['manual_logs'][0]['title'] == 'Log atualizado'


def test_calendar_update_endpoints_return_404_when_entry_is_missing(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with pytest.raises(HTTPException) as event_exc:
        _run(calendar_update_event(999, CalendarEventPayload(date='2026-03-10', title='Nao existe')))
    assert event_exc.value.status_code == 404

    with pytest.raises(HTTPException) as log_exc:
        _run(calendar_update_manual_log(999, CalendarManualLogPayload(date='2026-03-10', title='Nao existe')))
    assert log_exc.value.status_code == 404


def test_calendar_day_includes_finance_consumables_and_counter_logs(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO finance_transactions (description, amount, category, occurred_at, kind)
            VALUES ('Mercado', 85.5, 'avulso', '2026-03-15T09:30:00', 'expense')
            """
        )
        db.execute(
            """
            INSERT INTO finance_transactions (description, amount, category, occurred_at, kind)
            VALUES ('Freela', 250, 'avulso', '2026-03-15T13:00:00', 'income')
            """
        )
        db.execute(
            """
            INSERT INTO activity_counters (title, started_at, completed_at, elapsed_days)
            VALUES ('Filtro da torneira', '2026-03-01', '2026-03-15', 14)
            """
        )
        db.execute("INSERT INTO consumable_categories (name) VALUES ('Casa')")
        db.execute("INSERT INTO consumable_items (name, category_id) VALUES ('Detergente', 1)")
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, stock_quantity, remaining_quantity, price_paid)
            VALUES (1, '2026-03-15', 2, 1, 12)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_unit_logs (cycle_id, item_id, consumed_at, duration_days)
            VALUES (1, 1, '2026-03-15T18:20:00', 5)
            """
        )

    day_payload = _run(calendar_day('2026-03-15'))['data']
    automatic_types = {entry['event_type'] for entry in day_payload['automatic_logs']}

    assert 'expense_created' in automatic_types
    assert 'income_created' in automatic_types
    assert 'activity_counter_completed' in automatic_types
    assert 'consumable_restock' in automatic_types
    assert 'consumable_finished' in automatic_types
