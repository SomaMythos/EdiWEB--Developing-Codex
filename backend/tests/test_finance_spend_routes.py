from pathlib import Path
import asyncio
import sqlite3
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data.database import Database
from main import FinanceSpendPayload, finance_register_spend


def _prepare_db(db_path: Path):
    schema_path = Path(__file__).resolve().parents[1] / 'data' / 'schema.sql'
    with sqlite3.connect(db_path) as conn:
        conn.executescript(schema_path.read_text(encoding='utf-8'))
        conn.commit()


def _configure_temp_db(monkeypatch, db_path: Path):
    monkeypatch.setattr('core.finance_engine.Database', lambda: Database(path=db_path))


def _run(coro):
    return asyncio.run(coro)


def test_finance_register_spend_debits_current_reserve_and_creates_transaction(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with Database(path=db_path) as db:
        db.execute(
            """
            INSERT INTO finance_config (
                salary_monthly,
                reserve_current,
                reserve_cdb,
                reserve_extra,
                reserve_fgts,
                fgts,
                monthly_contribution,
                thirteenth,
                cdi_rate_annual,
                cdb_percent_cdi,
                extra_percent_cdi,
                interest_rate_current,
                interest_rate_fgts,
                updated_at
            ) VALUES (5000, 1000, 0, 0, 0, 0, 0, 0, 0, 100, 100, 0, 3, CURRENT_TIMESTAMP)
            """
        )

    response = _run(
        finance_register_spend(
            FinanceSpendPayload(
                description='Uber',
                amount=35.9,
                category='transporte',
                occurred_at='2026-03-07T20:00:00',
            )
        )
    )

    assert response['success'] is True
    assert response['data']['reserve_current'] == 964.1
    assert response['data']['transaction']['description'] == 'Uber'
    assert response['data']['transaction']['kind'] == 'expense'

    with Database(path=db_path) as db:
        config = db.fetchone('SELECT reserve_current FROM finance_config LIMIT 1')
        tx = db.fetchone('SELECT description, amount, category, kind FROM finance_transactions LIMIT 1')

    assert float(config['reserve_current']) == pytest.approx(964.1)
    assert dict(tx) == {
        'description': 'Uber',
        'amount': 35.9,
        'category': 'transporte',
        'kind': 'expense',
    }


def test_finance_register_spend_returns_400_without_finance_config(monkeypatch, tmp_path):
    db_path = tmp_path / 'lifemanager.db'
    _prepare_db(db_path)
    _configure_temp_db(monkeypatch, db_path)

    with pytest.raises(HTTPException) as exc_info:
        _run(
            finance_register_spend(
                FinanceSpendPayload(
                    description='Uber',
                    amount=35.9,
                    category='transporte',
                    occurred_at='2026-03-07T20:00:00',
                )
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == 'finance_config_not_found'
