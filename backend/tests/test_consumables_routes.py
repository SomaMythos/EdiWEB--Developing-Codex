from datetime import date
from pathlib import Path
import asyncio
import sqlite3
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import (
    ConsumableCategoryPayload,
    ConsumableItemPayload,
    FinishCyclePayload,
    RestockPayload,
    app,
    consumable_categories_create,
    consumable_item_detail,
    consumable_items_create,
    consumable_items_finish,
    consumable_items_restock,
)


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / "data" / "schema.sql"
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding="utf-8"))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr("core.consumables_engine.Database", lambda: Database(path=db_path))


def _run(coro):
    return asyncio.run(coro)


def test_consumables_routes_are_registered_once_per_method_and_path():
    target_routes = {
        ("GET", "/api/consumables/categories"),
        ("POST", "/api/consumables/categories"),
        ("GET", "/api/consumables/items"),
        ("GET", "/api/consumables/items/{item_id}"),
        ("POST", "/api/consumables/items"),
        ("POST", "/api/consumables/items/{item_id}/restock"),
        ("POST", "/api/consumables/items/{item_id}/finish"),
    }

    route_counts = {route: 0 for route in target_routes}

    for route in app.router.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", set()) or set()
        for method in methods:
            key = (method, path)
            if key in route_counts:
                route_counts[key] += 1

    assert route_counts == {
        ("GET", "/api/consumables/categories"): 1,
        ("POST", "/api/consumables/categories"): 1,
        ("GET", "/api/consumables/items"): 1,
        ("GET", "/api/consumables/items/{item_id}"): 1,
        ("POST", "/api/consumables/items"): 1,
        ("POST", "/api/consumables/items/{item_id}/restock"): 1,
        ("POST", "/api/consumables/items/{item_id}/finish"): 1,
    }


def test_create_category_and_item_with_validations(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    created_category = _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    assert created_category["data"]["id"] == 1

    created_item = _run(
        consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=created_category["data"]["id"]))
    )
    assert created_item["data"]["id"] == 1

    with pytest.raises(HTTPException) as category_exc:
        _run(consumable_categories_create(ConsumableCategoryPayload(name="   ")))
    assert category_exc.value.status_code == 400
    assert category_exc.value.detail == "name é obrigatório"

    with pytest.raises(HTTPException) as item_exc:
        _run(consumable_items_create(ConsumableItemPayload(name="", category_id=created_category["data"]["id"])))
    assert item_exc.value.status_code == 400
    assert item_exc.value.detail == "name é obrigatório"

    with pytest.raises(HTTPException) as category_not_found_exc:
        _run(consumable_items_create(ConsumableItemPayload(name="Condicionador", category_id=999)))
    assert category_not_found_exc.value.status_code == 404
    assert category_not_found_exc.value.detail == "Categoria não encontrada"


def test_create_category_duplicate_name_returns_conflict(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))

    with pytest.raises(HTTPException) as exc_info:
        _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Já existe uma categoria com esse nome"


def test_restock_validates_negative_price(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=1)))

    with pytest.raises(HTTPException) as exc_info:
        _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-01", price_paid=-1.0)))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "price_paid não pode ser negativo"


def test_restock_is_blocked_when_open_cycle_exists(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=1)))

    first_cycle = _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-01", price_paid=20.0)))
    assert first_cycle["data"]["id"] == 1

    with pytest.raises(HTTPException) as exc_info:
        _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-05", price_paid=22.0)))

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "Já existe um ciclo aberto para este item"


def test_finish_cycle_calculates_duration_days_and_handles_date_edges(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=1)))

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-10", price_paid=19.9)))

    finished_same_day = _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-01-10")))
    assert finished_same_day["data"]["duration_days"] == 0
    assert finished_same_day["data"]["remaining_quantity"] == 0
    assert finished_same_day["data"]["cycle_closed"] is True

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-02-10", price_paid=21.0)))
    with pytest.raises(HTTPException) as exc_info:
        _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-02-01")))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "ended_at não pode ser anterior a purchase_date"


def test_finish_cycle_consumes_one_unit_at_a_time_when_stock_quantity_is_greater_than_one(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Sabonete", category_id=1)))

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-03-01", price_paid=18.0, stock_quantity=3)))

    first_finish = _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-03-05")))
    assert first_finish["data"]["duration_days"] == 4
    assert first_finish["data"]["remaining_quantity"] == 2
    assert first_finish["data"]["cycle_closed"] is False

    second_finish = _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-03-10")))
    assert second_finish["data"]["duration_days"] == 9
    assert second_finish["data"]["remaining_quantity"] == 1
    assert second_finish["data"]["cycle_closed"] is False

    last_finish = _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-03-14")))
    assert last_finish["data"]["duration_days"] == 13
    assert last_finish["data"]["remaining_quantity"] == 0
    assert last_finish["data"]["cycle_closed"] is True

    detail = _run(consumable_item_detail(1))["data"]
    assert detail["stats"]["total_units_consumed"] == 3
    assert detail["stats"]["current_stock_quantity"] == 0
    assert detail["open_cycle"] is None


def test_item_stats_for_one_cycle_and_partial_month_frequency(monkeypatch, tmp_path):
    class FrozenDate(date):
        @classmethod
        def today(cls):
            return cls(2024, 1, 16)

    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)
    monkeypatch.setattr("core.consumables_engine.date", FrozenDate)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=1)))
    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-01", price_paid=20.0)))
    _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-01-11")))

    detail = _run(consumable_item_detail(1))["data"]
    stats = detail["stats"]

    assert stats["total_purchases"] == 1
    assert stats["total_units_consumed"] == 1
    assert stats["avg_duration_days"] == 10.0
    assert stats["purchase_frequency_per_month"] == 2.0
    assert stats["predicted_end_date"] is None


def test_item_stats_with_multiple_cycles_and_open_cycle_prediction(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))
    _run(consumable_items_create(ConsumableItemPayload(name="Shampoo", category_id=1)))

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-01-01", price_paid=10.0)))
    _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-01-31")))

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-02-01", price_paid=15.0)))
    _run(consumable_items_finish(1, FinishCyclePayload(ended_at="2024-03-02")))

    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-03-05", price_paid=18.0)))

    detail = _run(consumable_item_detail(1))["data"]
    stats = detail["stats"]

    assert stats["total_purchases"] == 3
    assert stats["avg_price"] == 14.333333333333334
    assert stats["avg_duration_days"] == 30.0
    assert stats["last_price_delta"] == 3.0
    assert stats["last_price_delta_percent"] == 20.0
    assert stats["predicted_end_date"] == "2024-04-04"


def test_prediction_requires_open_cycle_and_finished_history(monkeypatch, tmp_path):
    db_path = tmp_path / "lifemanager.db"
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    _run(consumable_categories_create(ConsumableCategoryPayload(name="Higiene")))

    _run(consumable_items_create(ConsumableItemPayload(name="Sabonete", category_id=1)))
    _run(consumable_items_restock(1, RestockPayload(purchase_date="2024-04-01", price_paid=7.0)))

    only_open_detail = _run(consumable_item_detail(1))["data"]
    assert only_open_detail["stats"]["predicted_end_date"] is None

    _run(consumable_items_create(ConsumableItemPayload(name="Pasta", category_id=1)))
    _run(consumable_items_restock(2, RestockPayload(purchase_date="2024-01-01", price_paid=8.0)))
    _run(consumable_items_finish(2, FinishCyclePayload(ended_at="2024-01-21")))
    _run(consumable_items_restock(2, RestockPayload(purchase_date="2024-02-01", price_paid=9.0)))

    open_plus_history_detail = _run(consumable_item_detail(2))["data"]
    assert open_plus_history_detail["stats"]["avg_duration_days"] == 20.0
    assert open_plus_history_detail["stats"]["predicted_end_date"] == "2024-02-21"
