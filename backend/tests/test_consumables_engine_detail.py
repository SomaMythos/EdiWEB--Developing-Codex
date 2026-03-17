from datetime import date
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.consumables_engine import ConsumablesEngine, ConsumablesNotFoundError
from data.database import Database


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO consumable_categories (name) VALUES ('Higiene')")
        conn.execute("INSERT INTO consumable_items (name, category_id) VALUES ('Shampoo', 1)")
        conn.commit()


def test_get_item_detail_with_history(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-01-01', 10, '2024-01-31', 30)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-02-10', 12, '2024-03-11', 30)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-04-01', 15, NULL, NULL)
            """
        )

    detail = ConsumablesEngine.get_item_detail(1)

    assert detail["item"]["name"] == "Shampoo"
    assert [cycle["purchase_date"] for cycle in detail["cycles"]] == ["2024-04-01", "2024-02-10", "2024-01-01"]
    assert detail["stats"]["total_purchases"] == 3
    assert detail["stats"]["avg_price"] == 12.333333333333334
    assert detail["stats"]["last_price_delta"] == 3
    assert detail["stats"]["last_price_delta_percent"] == 25
    assert detail["stats"]["avg_duration_days"] == 30
    assert detail["stats"]["monthly_avg_spend"] == 12.333333333333334
    assert detail["stats"]["annual_avg_spend"] == 148
    assert detail["stats"]["predicted_end_date"] == "2024-05-01"

    first_purchase = date.fromisoformat("2024-01-01")
    months = (date.today() - first_purchase).days / 30
    assert detail["stats"]["purchase_frequency_per_month"] == 3 / months


def test_get_item_detail_handles_missing_history(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, price_paid, ended_at, duration_days)
            VALUES (1, '2024-04-01', NULL, NULL, NULL)
            """
        )

    detail = ConsumablesEngine.get_item_detail(1)
    stats = detail["stats"]

    assert stats["total_purchases"] == 1
    assert stats["avg_price"] is None
    assert stats["last_price_delta"] is None
    assert stats["last_price_delta_percent"] is None
    assert stats["avg_duration_days"] is None
    assert stats["monthly_avg_spend"] is None
    assert stats["annual_avg_spend"] is None
    assert stats["predicted_end_date"] is None


def test_get_item_detail_not_found(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    try:
        ConsumablesEngine.get_item_detail(999)
        assert False, "Expected ConsumablesNotFoundError"
    except ConsumablesNotFoundError:
        assert True


def test_get_item_detail_multiplies_unit_average_by_remaining_stock(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)

    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, stock_quantity, remaining_quantity, price_paid, ended_at, duration_days)
            VALUES (1, '2024-01-01', 1, 0, 10, '2024-01-06', 5)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_unit_logs (cycle_id, item_id, consumed_at, duration_days)
            VALUES (1, 1, '2024-01-06', 5)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, stock_quantity, remaining_quantity, price_paid, ended_at, duration_days)
            VALUES (1, '2024-02-01', 1, 0, 12, '2024-02-06', 5)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_unit_logs (cycle_id, item_id, consumed_at, duration_days)
            VALUES (2, 1, '2024-02-06', 5)
            """
        )
        db.execute(
            """
            INSERT INTO consumable_cycles (item_id, purchase_date, stock_quantity, remaining_quantity, price_paid)
            VALUES (1, '2024-03-01', 4, 4, 44)
            """
        )

    detail = ConsumablesEngine.get_item_detail(1)

    assert detail["stats"]["avg_duration_days"] == 5
    assert detail["stats"]["current_stock_quantity"] == 4
    assert detail["stats"]["avg_unit_price"] == 11
    assert detail["stats"]["predicted_end_date"] == "2024-03-21"
