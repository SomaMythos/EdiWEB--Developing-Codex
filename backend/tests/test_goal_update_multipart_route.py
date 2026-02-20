import asyncio
import io
from pathlib import Path
import sys

from fastapi import UploadFile

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import update_goal_multipart


def test_update_goal_multipart_with_image(monkeypatch):
    payload = {}

    monkeypatch.setattr('main._save_upload_file', lambda image, destination: 'uploads/goals/new-image.png')

    def _fake_update_goal(**kwargs):
        payload.update(kwargs)
        return True

    monkeypatch.setattr('main.GoalEngine.update_goal', _fake_update_goal)

    image = UploadFile(filename='goal.png', file=io.BytesIO(b'image-bytes'))

    response = asyncio.run(
        update_goal_multipart(
            goal_id=10,
            title='Atualizada',
            description='Desc',
            deadline='2026-01-01',
            difficulty=3,
            category_id=2,
            image=image,
        )
    )

    assert response['success'] is True
    assert response['data']['image_path'] == 'uploads/goals/new-image.png'
    assert payload['image_path'] == 'uploads/goals/new-image.png'


def test_update_goal_multipart_without_image(monkeypatch):
    payload = {}

    def _fake_update_goal(**kwargs):
        payload.update(kwargs)
        return True

    monkeypatch.setattr('main.GoalEngine.update_goal', _fake_update_goal)

    response = asyncio.run(
        update_goal_multipart(
            goal_id=11,
            title='Sem foto',
            description=None,
            deadline=None,
            difficulty=2,
            category_id=None,
            image=None,
        )
    )

    assert response['success'] is True
    assert payload['image_path'] is None
