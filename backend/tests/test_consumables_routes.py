from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app


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
