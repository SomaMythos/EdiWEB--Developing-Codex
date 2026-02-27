from datetime import date, datetime, timedelta
from typing import Optional

from data.database import Database


class ConsumablesError(Exception):
    """Erro base do domínio de consumíveis."""


class ConsumablesNotFoundError(ConsumablesError):
    """Entidade de consumível não encontrada."""


class ConsumablesConflictError(ConsumablesError):
    """Conflito de estado para operação de consumível."""


class ConsumablesValidationError(ConsumablesError):
    """Payload/data inválida para operação de consumível."""


class ConsumablesEngine:
    @staticmethod
    def _to_float(value):
        if value is None:
            return None
        return float(value)

    @staticmethod
    def _require_iso_date(value: str, field_name: str) -> str:
        raw = (value or "").strip()
        if not raw:
            raise ConsumablesValidationError(f"{field_name} é obrigatório")

        try:
            parsed = date.fromisoformat(raw)
            return parsed.isoformat()
        except ValueError:
            try:
                parsed = datetime.fromisoformat(raw).date()
                return parsed.isoformat()
            except ValueError as exc:
                raise ConsumablesValidationError(f"{field_name} deve estar em formato ISO válido") from exc

    @staticmethod
    def _calculate_duration_days(started_iso: str, ended_iso: str) -> int:
        started = date.fromisoformat(started_iso)
        ended = date.fromisoformat(ended_iso)
        return (ended - started).days

    @staticmethod
    def _get_category(category_id: int):
        with Database() as db:
            return db.fetchone("SELECT id, name, created_at FROM consumable_categories WHERE id = ?", (category_id,))

    @staticmethod
    def _get_item(item_id: int):
        with Database() as db:
            return db.fetchone(
                """
                SELECT i.id, i.name, i.category_id, i.created_at, c.name AS category_name
                FROM consumable_items i
                JOIN consumable_categories c ON c.id = i.category_id
                WHERE i.id = ?
                """,
                (item_id,),
            )

    @staticmethod
    def create_category(name: str) -> int:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ConsumablesValidationError("name é obrigatório")

        with Database() as db:
            db.execute("INSERT INTO consumable_categories (name) VALUES (?)", (normalized_name,))
            return db.lastrowid

    @staticmethod
    def list_categories():
        with Database() as db:
            return db.fetchall("SELECT id, name, created_at FROM consumable_categories ORDER BY name")

    @staticmethod
    def create_item(name: str, category_id: int) -> int:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ConsumablesValidationError("name é obrigatório")

        if not ConsumablesEngine._get_category(category_id):
            raise ConsumablesNotFoundError("Categoria não encontrada")

        with Database() as db:
            db.execute(
                "INSERT INTO consumable_items (name, category_id) VALUES (?, ?)",
                (normalized_name, category_id),
            )
            return db.lastrowid

    @staticmethod
    def list_items(category_id: Optional[int] = None):
        if category_id is not None and not ConsumablesEngine._get_category(category_id):
            raise ConsumablesNotFoundError("Categoria não encontrada")

        query = """
            SELECT i.id, i.name, i.category_id, i.created_at, c.name AS category_name
            FROM consumable_items i
            JOIN consumable_categories c ON c.id = i.category_id
        """
        params = ()
        if category_id is not None:
            query += " WHERE i.category_id = ?"
            params = (category_id,)

        query += " ORDER BY c.name, i.name"

        with Database() as db:
            return db.fetchall(query, params)

    @staticmethod
    def restock_item(item_id: int, purchase_date: str, price_paid: Optional[float] = None) -> int:
        if not ConsumablesEngine._get_item(item_id):
            raise ConsumablesNotFoundError("Item não encontrado")

        purchase_date_iso = ConsumablesEngine._require_iso_date(purchase_date, "purchase_date")

        with Database() as db:
            open_cycle = db.fetchone(
                "SELECT id FROM consumable_cycles WHERE item_id = ? AND ended_at IS NULL",
                (item_id,),
            )
            if open_cycle:
                raise ConsumablesConflictError("Já existe um ciclo aberto para este item")

            db.execute(
                """
                INSERT INTO consumable_cycles (item_id, purchase_date, price_paid)
                VALUES (?, ?, ?)
                """,
                (item_id, purchase_date_iso, price_paid),
            )
            return db.lastrowid

    @staticmethod
    def finish_open_cycle(item_id: int, ended_at: str):
        if not ConsumablesEngine._get_item(item_id):
            raise ConsumablesNotFoundError("Item não encontrado")

        ended_at_iso = ConsumablesEngine._require_iso_date(ended_at, "ended_at")

        with Database() as db:
            open_cycle = db.fetchone(
                """
                SELECT id, purchase_date
                FROM consumable_cycles
                WHERE item_id = ? AND ended_at IS NULL
                ORDER BY id DESC
                LIMIT 1
                """,
                (item_id,),
            )
            if not open_cycle:
                raise ConsumablesValidationError("Não há ciclo aberto para este item")

            purchase_date_iso = ConsumablesEngine._require_iso_date(open_cycle["purchase_date"], "purchase_date")
            duration_days = ConsumablesEngine._calculate_duration_days(purchase_date_iso, ended_at_iso)
            if duration_days < 0:
                raise ConsumablesValidationError("ended_at não pode ser anterior a purchase_date")

            db.execute(
                """
                UPDATE consumable_cycles
                SET ended_at = ?, duration_days = ?
                WHERE id = ?
                """,
                (ended_at_iso, duration_days, open_cycle["id"]),
            )

            return {
                "id": open_cycle["id"],
                "item_id": item_id,
                "purchase_date": purchase_date_iso,
                "ended_at": ended_at_iso,
                "duration_days": duration_days,
            }

    @staticmethod
    def get_item_detail(item_id: int):
        item = ConsumablesEngine._get_item(item_id)
        if not item:
            raise ConsumablesNotFoundError("Item não encontrado")

        with Database() as db:
            cycles = db.fetchall(
                """
                SELECT id, item_id, purchase_date, price_paid, ended_at, duration_days, created_at
                FROM consumable_cycles
                WHERE item_id = ?
                ORDER BY purchase_date DESC, id DESC
                """,
                (item_id,),
            )

            aggregate = db.fetchone(
                """
                SELECT
                    COUNT(*) AS total_purchases,
                    AVG(price_paid) AS avg_price,
                    AVG(CASE WHEN ended_at IS NOT NULL THEN duration_days END) AS avg_duration_days,
                    MIN(purchase_date) AS first_purchase_date
                FROM consumable_cycles
                WHERE item_id = ?
                """,
                (item_id,),
            )

            open_cycle = db.fetchone(
                """
                SELECT id, item_id, purchase_date, price_paid, ended_at, duration_days, created_at
                FROM consumable_cycles
                WHERE item_id = ? AND ended_at IS NULL
                ORDER BY purchase_date DESC, id DESC
                LIMIT 1
                """,
                (item_id,),
            )

        cycles_list = [dict(cycle) for cycle in cycles]
        item_data = dict(item)

        aggregate_data = dict(aggregate) if aggregate else {}

        total_purchases = int(aggregate_data.get("total_purchases") or 0)
        avg_price = ConsumablesEngine._to_float(aggregate_data.get("avg_price"))
        avg_duration_days = ConsumablesEngine._to_float(aggregate_data.get("avg_duration_days"))

        last_price_delta = None
        last_price_delta_percent = None
        if len(cycles_list) >= 2:
            latest_price = ConsumablesEngine._to_float(cycles_list[0].get("price_paid"))
            previous_price = ConsumablesEngine._to_float(cycles_list[1].get("price_paid"))
            if latest_price is not None and previous_price is not None:
                last_price_delta = latest_price - previous_price
                if previous_price != 0:
                    last_price_delta_percent = (last_price_delta / previous_price) * 100

        purchase_frequency_per_month = None
        first_purchase_date = aggregate_data.get("first_purchase_date")
        if total_purchases > 0 and first_purchase_date:
            first_purchase = date.fromisoformat(first_purchase_date)
            days_since_first_purchase = (date.today() - first_purchase).days
            months_since_first_purchase = days_since_first_purchase / 30 if days_since_first_purchase > 0 else 0
            if months_since_first_purchase > 0:
                purchase_frequency_per_month = total_purchases / months_since_first_purchase

        monthly_avg_spend = None
        annual_avg_spend = None
        if avg_price is not None and avg_duration_days is not None and avg_duration_days > 0:
            monthly_avg_spend = avg_price / (avg_duration_days / 30)
            annual_avg_spend = monthly_avg_spend * 12

        predicted_end_date = None
        if open_cycle and avg_duration_days is not None and avg_duration_days > 0:
            open_purchase_date = date.fromisoformat(open_cycle["purchase_date"])
            predicted_end_date = (open_purchase_date + timedelta(days=round(avg_duration_days))).isoformat()

        stats = {
            "total_purchases": total_purchases,
            "avg_price": avg_price,
            "last_price_delta": last_price_delta,
            "last_price_delta_percent": last_price_delta_percent,
            "avg_duration_days": avg_duration_days,
            "purchase_frequency_per_month": purchase_frequency_per_month,
            "monthly_avg_spend": monthly_avg_spend,
            "annual_avg_spend": annual_avg_spend,
            "predicted_end_date": predicted_end_date,
        }

        return {
            "item": item_data,
            "cycles": cycles_list,
            "stats": stats,
        }
