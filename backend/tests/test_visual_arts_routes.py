from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app


def test_visual_arts_routes_are_registered_once_per_method_and_path():
    target_routes = {
        ("POST", "/api/visual-arts/artworks"),
        ("POST", "/api/visual-arts/artworks/{painting_id}/updates"),
        ("PATCH", "/api/visual-arts/artworks/{painting_id}/completion-date"),
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
        ("POST", "/api/visual-arts/artworks"): 1,
        ("POST", "/api/visual-arts/artworks/{painting_id}/updates"): 1,
        ("PATCH", "/api/visual-arts/artworks/{painting_id}/completion-date"): 1,
    }
