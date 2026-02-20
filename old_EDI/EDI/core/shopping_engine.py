"""
Shopping Engine - Sistema de Compras e Lista Automática
"""

from data.database import Database
from datetime import date, datetime
import logging

logger = logging.getLogger(__name__)


class ShoppingEngine:

    @staticmethod
    def _parse_date(date_value):
        if not date_value:
            return None
        if isinstance(date_value, date):
            return date_value
        try:
            return datetime.strptime(date_value, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            try:
                return datetime.fromisoformat(date_value).date()
            except (TypeError, ValueError):
                return None

    @staticmethod
    def list_wish_items(item_type=None, order_by="name"):
        """Lista itens da wishlist"""
        order_field = "name"
        if order_by == "price":
            order_field = "price"
        with Database() as db:
            if item_type:
                items = db.fetchall(
                    f"""
                    SELECT * FROM wish_items
                    WHERE item_type = ?
                    ORDER BY {order_field} ASC, name
                    """,
                    (item_type,),
                )
            else:
                items = db.fetchall(
                    f"""
                    SELECT * FROM wish_items
                    ORDER BY {order_field} ASC, name
                    """
                )
            return items

    @staticmethod
    def add_wish_item(name, price=None, link=None, item_type=None):
        """Adiciona item à wishlist"""
        try:
            with Database() as db:
                db.execute(
                    """
                    INSERT INTO wish_items (name, price, link, item_type)
                    VALUES (?, ?, ?, ?)
                    """,
                    (name, price, link, item_type),
                )
                logger.info("Item adicionado à wishlist: %s", name)
                return True
        except Exception as e:
            logger.error("Erro ao adicionar item à wishlist: %s", e)
            return False

    @staticmethod
    def update_wish_item(item_id, name=None, price=None, link=None, item_type=None):
        """Atualiza item da wishlist"""
        fields = []
        params = []
        if name is not None:
            fields.append("name = ?")
            params.append(name)
        if price is not None:
            fields.append("price = ?")
            params.append(price)
        if link is not None:
            fields.append("link = ?")
            params.append(link)
        if item_type is not None:
            fields.append("item_type = ?")
            params.append(item_type)
        if not fields:
            return False
        params.append(item_id)
        try:
            with Database() as db:
                db.execute(
                    f"UPDATE wish_items SET {', '.join(fields)} WHERE id = ?",
                    tuple(params),
                )
                return True
        except Exception as e:
            logger.error("Erro ao atualizar item da wishlist: %s", e)
            return False

    @staticmethod
    def delete_wish_item(item_id):
        """Remove item da wishlist"""
        try:
            with Database() as db:
                db.execute("DELETE FROM wish_items WHERE id = ?", (item_id,))
                return True
        except Exception as e:
            logger.error("Erro ao excluir item da wishlist: %s", e)
            return False
    
    @staticmethod
    def list_items(category=None):
        """Lista itens do catálogo"""
        with Database() as db:
            if category:
                items = db.fetchall("""
                    SELECT * FROM shopping_items
                    WHERE category = ?
                    ORDER BY priority ASC, name
                """, (category,))
            else:
                items = db.fetchall("""
                    SELECT * FROM shopping_items
                    ORDER BY category, priority ASC, name
                """)
            return items

    @staticmethod
    def list_items_with_status(category=None):
        """Lista itens com status de reposição"""
        with Database() as db:
            if category:
                items = db.fetchall(
                    """
                    SELECT * FROM shopping_items
                    WHERE category = ?
                    ORDER BY priority ASC, name
                    """,
                    (category,),
                )
            else:
                items = db.fetchall(
                    """
                    SELECT * FROM shopping_items
                    ORDER BY category, priority ASC, name
                    """
                )

            restock_rows = db.fetchall(
                """
                SELECT item_id, MAX(restock_date) as last_restock
                FROM restock_items
                GROUP BY item_id
                """
            )
            restock_map = {
                row["item_id"]: row["last_restock"] for row in restock_rows
            }

        today = date.today()
        for item in items:
            last_restock = restock_map.get(item["id"]) or item.get("created_at")
            last_date = ShoppingEngine._parse_date(last_restock) or today
            days_since = (today - last_date).days
            restock_days = item.get("restock_days") or 0
            status = "Ok"
            if restock_days and days_since >= restock_days:
                status = "Item acabou!"
            elif restock_days and (restock_days - days_since) <= 1:
                status = "Perto de acabar"
            item["days_since_restock"] = days_since
            item["restock_status"] = status
            item["near_restock"] = restock_days and (restock_days - days_since) <= 1
        return items

    @staticmethod
    def record_restock(item_id):
        """Registra reposição e recalcula média de dias"""
        try:
            with Database() as db:
                item = db.fetchone(
                    "SELECT created_at FROM shopping_items WHERE id = ?",
                    (item_id,),
                )
                if not item:
                    return None

                last_restock = db.fetchone(
                    """
                    SELECT restock_date
                    FROM restock_items
                    WHERE item_id = ?
                    ORDER BY restock_date DESC
                    LIMIT 1
                    """,
                    (item_id,),
                )

                start_date = (
                    last_restock["restock_date"]
                    if last_restock
                    else item.get("created_at")
                )
                start_date = ShoppingEngine._parse_date(start_date) or date.today()
                today = date.today()

                db.execute(
                    """
                    INSERT INTO restock_items (item_id, created_at, restock_date)
                    VALUES (?, ?, ?)
                    """,
                    (item_id, start_date.isoformat(), today.isoformat()),
                )

                avg_row = db.fetchone(
                    """
                    SELECT AVG(julianday(restock_date) - julianday(created_at)) as avg_days
                    FROM restock_items
                    WHERE item_id = ?
                    """,
                    (item_id,),
                )
                avg_days = None
                if avg_row and avg_row.get("avg_days") is not None:
                    avg_days = max(1, round(avg_row["avg_days"]))
                    db.execute(
                        "UPDATE shopping_items SET restock_days = ? WHERE id = ?",
                        (avg_days, item_id),
                    )
                return avg_days
        except Exception as e:
            logger.error("Erro ao registrar reposição: %s", e)
            return None

    @staticmethod
    def get_items_near_restock():
        """Lista itens próximos da reposição"""
        items = ShoppingEngine.list_items_with_status()
        return [item for item in items if item.get("near_restock")]
    
    @staticmethod
    def add_item(name, category, average_price, restock_days, quantity_per_purchase=1, 
                 unit='un', priority=3, notes=None):
        """Adiciona item ao catálogo"""
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO shopping_items 
                    (name, category, average_price, restock_days, quantity_per_purchase, 
                     unit, priority, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (name, category, average_price, restock_days, quantity_per_purchase,
                      unit, priority, notes))
                logger.info(f"Item adicionado: {name}")
                return True
        except Exception as e:
            logger.error(f"Erro ao adicionar item: {e}")
            return False

    @staticmethod
    def delete_item(item_id):
        """Remove item do catálogo"""
        try:
            with Database() as db:
                db.execute("DELETE FROM shopping_items WHERE id = ?", (item_id,))
                return True
        except Exception as e:
            logger.error("Erro ao excluir item: %s", e)
            return False
    
    @staticmethod
    def create_shopping_list(name, target_date=None, notes=None):
        """Cria nova lista de compras"""
        try:
            with Database() as db:
                today = date.today().isoformat()
                db.execute("""
                    INSERT INTO shopping_lists (name, created_date, target_date, notes)
                    VALUES (?, ?, ?, ?)
                """, (name, today, target_date, notes))
                
                list_id = db.lastrowid
                logger.info(f"Lista de compras criada: {name}")
                return list_id
        except Exception as e:
            logger.error(f"Erro ao criar lista: {e}")
            return None
    
    @staticmethod
    def generate_automatic_list(name=None):
        """Gera lista de compras automática"""
        try:
            if name is None:
                name = f"Lista Automática - {date.today().strftime('%B %Y')}"
            
            list_id = ShoppingEngine.create_shopping_list(
                name=name,
                notes="Lista gerada automaticamente"
            )
            
            if not list_id:
                return None
            
            with Database() as db:
                items = db.fetchall("""
                    SELECT si.id, si.restock_days, si.quantity_per_purchase, MAX(ph.purchase_date) as last_purchase
                    FROM shopping_items si
                    LEFT JOIN purchase_history ph ON ph.item_id = si.id
                    GROUP BY si.id
                """)
                
                today = date.today()
                for item in items:
                    should_add = False
                    
                    if item["last_purchase"]:
                        last_date = datetime.strptime(item["last_purchase"], "%Y-%m-%d").date()
                        days_since = (today - last_date).days
                        if days_since >= item["restock_days"]:
                            should_add = True
                    else:
                        should_add = True
                    
                    if should_add:
                        db.execute("""
                            INSERT INTO shopping_list_items (list_id, item_id, quantity)
                            VALUES (?, ?, ?)
                        """, (list_id, item["id"], item["quantity_per_purchase"]))
                
                logger.info(f"Lista automática gerada")
                return list_id
                
        except Exception as e:
            logger.error(f"Erro ao gerar lista automática: {e}")
            return None

    @staticmethod
    def get_shopping_stats():
        """Retorna estatísticas gerais de compras"""
        with Database() as db:
            month_spending = db.fetchone(
                """
                SELECT COALESCE(SUM(price * quantity), 0) as total
                FROM purchase_history
                WHERE purchase_date >= date('now', 'start of month')
                """
            )

            items_total = db.fetchone(
                "SELECT COUNT(*) as total FROM shopping_items"
            )

            return {
                "month_spending": month_spending["total"] if month_spending else 0,
                "items_total": items_total["total"] if items_total else 0,
            }
