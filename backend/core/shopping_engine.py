from datetime import date, datetime

from data.database import Database


class ShoppingEngine:
    @staticmethod
    def list_wish_items(item_type=None):
        with Database() as db:
            if item_type:
                return db.fetchall("SELECT * FROM wish_items WHERE item_type = ? ORDER BY name", (item_type,))
            return db.fetchall("SELECT * FROM wish_items ORDER BY name")

    @staticmethod
    def add_wish_item(name, price=None, link=None, item_type=None, photo_url=None):
        with Database() as db:
            db.execute(
                "INSERT INTO wish_items (name, price, link, item_type, photo_url) VALUES (?, ?, ?, ?, ?)",
                (name, price, link, item_type, photo_url),
            )
            return db.lastrowid

    @staticmethod
    def update_wish_item(item_id, name, price=None, link=None, item_type=None, photo_url=None, is_marked=None):
        with Database() as db:
            cursor = db.execute(
                """
                UPDATE wish_items
                SET name = ?,
                    price = ?,
                    link = ?,
                    item_type = ?,
                    photo_url = ?,
                    is_marked = COALESCE(?, is_marked)
                WHERE id = ?
                """,
                (name, price, link, item_type, photo_url, is_marked, item_id),
            )
            return cursor.rowcount > 0

    @staticmethod
    def set_wish_item_marked(item_id, is_marked):
        with Database() as db:
            cursor = db.execute("UPDATE wish_items SET is_marked = ? WHERE id = ?", (1 if is_marked else 0, item_id))
            return cursor.rowcount > 0

    @staticmethod
    def delete_wish_item(item_id):
        with Database() as db:
            cursor = db.execute("DELETE FROM wish_items WHERE id = ?", (item_id,))
            return cursor.rowcount > 0

    @staticmethod
    def list_items_with_status(category=None):
        with Database() as db:
            if category:
                items = db.fetchall("SELECT * FROM shopping_items WHERE category = ? ORDER BY priority ASC, name", (category,))
            else:
                items = db.fetchall("SELECT * FROM shopping_items ORDER BY category, priority ASC, name")
            restock = db.fetchall("SELECT item_id, MAX(restock_date) as last_restock FROM restock_items GROUP BY item_id")

        restock_map = {r["item_id"]: r["last_restock"] for r in restock}
        today = date.today()
        for item in items:
            last = restock_map.get(item["id"]) or item.get("created_at") or today.isoformat()
            try:
                last_date = datetime.fromisoformat(last).date()
            except Exception:
                last_date = today
            days_since = (today - last_date).days
            restock_days = item.get("restock_days") or 0
            item["near_restock"] = bool(restock_days and (restock_days - days_since) <= 1)
            item["days_since_restock"] = days_since
        return items

    @staticmethod
    def add_item(name, category, average_price, restock_days, quantity_per_purchase=1, unit='un', priority=3, notes=None):
        with Database() as db:
            db.execute(
                """
                INSERT INTO shopping_items
                (name, category, average_price, restock_days, quantity_per_purchase, unit, priority, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (name, category, average_price, restock_days, quantity_per_purchase, unit, priority, notes),
            )
            return db.lastrowid

    @staticmethod
    def get_shopping_stats():
        with Database() as db:
            month_spending = db.fetchone(
                "SELECT COALESCE(SUM(price * quantity), 0) as total FROM purchase_history WHERE purchase_date >= date('now', 'start of month')"
            )
            items_total = db.fetchone("SELECT COUNT(*) as total FROM shopping_items")
        return {"month_spending": month_spending["total"] if month_spending else 0, "items_total": items_total["total"] if items_total else 0}
