from datetime import date, timedelta
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.consumables_engine import ConsumablesEngine
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO consumable_categories (name) VALUES ('Cozinha')")
        conn.execute("INSERT INTO consumable_items (name, category_id) VALUES ('Detergente', 1)")
        conn.execute("INSERT INTO consumable_items (name, category_id) VALUES ('Sabão', 1)")
        conn.execute("INSERT INTO consumable_items (name, category_id) VALUES ('Papel Toalha', 1)")
        conn.commit()


def test_item_with_near_prediction_generates_due_alert(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    today = date(2024, 7, 20)
    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-05-01', 20, '2024-05-31', 30)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-06-01', 22, '2024-07-01', 30)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-06-25', 23, NULL, NULL)
            """
        )

    alerts = ConsumablesEngine.detect_restock_risks(window_days=7, reference_date=today)

    assert len(alerts) == 1
    assert alerts[0]["notification_type"] == "consumable_restock_due"
    assert alerts[0]["meta"]["predicted_end_date"] == "2024-07-25"
    assert alerts[0]["meta"]["days_remaining"] == 5


def test_item_with_overdue_cycle_generates_critical_alert(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    today = date(2024, 7, 20)
    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (2, '2024-04-01', 16, '2024-04-21', 20)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (2, '2024-05-01', 17, '2024-05-21', 20)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (2, '2024-06-15', 18, NULL, NULL)
            """
        )

    alerts = ConsumablesEngine.detect_restock_risks(window_days=7, reference_date=today)

    assert len(alerts) == 1
    assert alerts[0]["notification_type"] == "consumable_overdue"
    assert alerts[0]["severity"] == "critical"
    assert alerts[0]["meta"]["days_remaining"] == -15


def test_item_without_open_cycle_does_not_generate_false_positive(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    today = date(2024, 7, 20)
    with Database(path=db_path) as db:
        start = date(2024, 5, 1)
        for _ in range(2):
            end = start + timedelta(days=30)
            db.execute(
                """
                INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
                VALUES (3, ?, 10, ?, 30)
                """,
                (start.isoformat(), end.isoformat()),
            )
            start = end + timedelta(days=1)

    alerts = ConsumablesEngine.detect_restock_risks(window_days=7, reference_date=today)

    assert alerts == []
