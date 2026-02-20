import asyncio
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import update_goal_status


def test_update_goal_status_returns_400_for_invalid_status(monkeypatch):
    def _raise_invalid_status(goal_id, status):
        raise ValueError("Status inválido")

    monkeypatch.setattr("main.GoalEngine.update_status", _raise_invalid_status)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(update_goal_status(goal_id=1, status="invalido"))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == {
        "code": "INVALID_GOAL_STATUS",
        "message": "Status inválido. Use: ativa, concluida ou cancelada.",
    }


def test_update_goal_status_returns_404_when_goal_does_not_exist(monkeypatch):
    monkeypatch.setattr("main.GoalEngine.update_status", lambda goal_id, status: False)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(update_goal_status(goal_id=999, status="ativa"))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == {
        "code": "GOAL_NOT_FOUND",
        "message": "Meta não encontrada para atualização de status.",
    }


def test_update_goal_status_returns_success_for_valid_update(monkeypatch):
    monkeypatch.setattr("main.GoalEngine.update_status", lambda goal_id, status: True)

    response = asyncio.run(update_goal_status(goal_id=1, status="concluida"))

    assert response == {"success": True, "message": "Goal status updated"}
