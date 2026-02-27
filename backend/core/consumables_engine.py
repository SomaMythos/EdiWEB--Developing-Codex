from datetime import date, datetime
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
