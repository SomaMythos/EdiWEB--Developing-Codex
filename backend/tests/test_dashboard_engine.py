from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.dashboard_engine import DashboardEngine


def test_reading_suggestions_prioritize_started_books(monkeypatch):
    monkeypatch.setattr(
        "core.dashboard_engine.BookEngine.list_books",
        lambda: [
            {
                "id": 1,
                "title": "Livro na estante",
                "status": "estante",
                "current_page": 0,
                "started_at": None,
                "total_pages": 300,
            },
            {
                "id": 2,
                "title": "Livro iniciado",
                "status": "lendo",
                "current_page": 48,
                "started_at": "2026-03-01T10:00:00",
                "total_pages": 320,
            },
            {
                "id": 3,
                "title": "Livro concluido",
                "status": "concluido",
                "current_page": 320,
                "started_at": "2026-02-01T10:00:00",
                "total_pages": 320,
            },
        ],
    )

    suggestions = DashboardEngine._build_reading_suggestions()

    assert len(suggestions) == 1
    assert suggestions[0]["title"] == "Livro iniciado"
    assert suggestions[0]["description"] == "Pagina 48 de 320"


def test_reading_suggestions_fall_back_to_unstarted_when_needed(monkeypatch):
    monkeypatch.setattr(
        "core.dashboard_engine.BookEngine.list_books",
        lambda: [
            {
                "id": 1,
                "title": "Livro na estante",
                "status": "estante",
                "current_page": 0,
                "started_at": None,
                "total_pages": 300,
            },
            {
                "id": 2,
                "title": "Outro da estante",
                "status": "estante",
                "current_page": 0,
                "started_at": None,
                "total_pages": 280,
            },
        ],
    )

    suggestions = DashboardEngine._build_reading_suggestions()

    assert len(suggestions) == 2
    assert {item["title"] for item in suggestions} == {"Livro na estante", "Outro da estante"}
