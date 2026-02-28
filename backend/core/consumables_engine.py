from datetime import date, datetime, timedelta
from sqlite3 import IntegrityError
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
    DEFAULT_RISK_WINDOW_DAYS = 7
    DEFAULT_MIN_HISTORY_CYCLES = 2

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
    def _normalize_price(value: Optional[float]) -> Optional[float]:
        if value is None:
            return None

        try:
            normalized = float(value)
        except (TypeError, ValueError) as exc:
            raise ConsumablesValidationError("price_paid deve ser numérico") from exc

        if normalized < 0:
            raise ConsumablesValidationError("price_paid não pode ser negativo")

        return normalized

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
            try:
                db.execute("INSERT INTO consumable_categories (name) VALUES (?)", (normalized_name,))
            except IntegrityError as exc:
                raise ConsumablesConflictError("Já existe uma categoria com esse nome") from exc
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
        normalized_price = ConsumablesEngine._normalize_price(price_paid)

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
                (item_id, purchase_date_iso, normalized_price),
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

    @staticmethod
    def detect_restock_risks(
        window_days: int = DEFAULT_RISK_WINDOW_DAYS,
        include_insufficient_history: bool = False,
        min_history_cycles: int = DEFAULT_MIN_HISTORY_CYCLES,
        reference_date: Optional[date] = None,
    ):
        today = reference_date or date.today()

        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    i.id AS item_id,
                    i.name AS item_name,
                    c.name AS category_name,
                    oc.id AS open_cycle_id,
                    oc.purchase_date AS open_purchase_date,
                    stats.closed_cycles_count,
                    stats.avg_duration_days
                FROM consumable_items i
                JOIN consumable_categories c ON c.id = i.category_id
                JOIN consumable_cycles oc ON oc.item_id = i.id AND oc.ended_at IS NULL
                LEFT JOIN (
                    SELECT
                        item_id,
                        COUNT(CASE WHEN ended_at IS NOT NULL THEN 1 END) AS closed_cycles_count,
                        AVG(CASE WHEN ended_at IS NOT NULL THEN duration_days END) AS avg_duration_days
                    FROM consumable_cycles
                    GROUP BY item_id
                ) stats ON stats.item_id = i.id
                ORDER BY c.name, i.name
                """
            )

        notifications = []
        for row in rows:
            item_id = row["item_id"]
            item_name = row["item_name"]
            category_name = row["category_name"]
            purchase_date = date.fromisoformat(row["open_purchase_date"])
            closed_cycles_count = int(row["closed_cycles_count"] or 0)
            avg_duration_days = row["avg_duration_days"]

            if avg_duration_days is None or closed_cycles_count < min_history_cycles:
                if include_insufficient_history:
                    notifications.append(
                        {
                            "notification_type": "consumable_insufficient_history",
                            "source_feature": "consumables",
                            "title": item_name,
                            "message": f"Histórico insuficiente para prever reposição de '{item_name}'",
                            "severity": "info",
                            "meta": {
                                "item_id": item_id,
                                "item_name": item_name,
                                "category_name": category_name,
                                "predicted_end_date": None,
                                "days_remaining": None,
                            },
                            "color_token": "primary",
                            "unique_key": f"consumable_insufficient_history:{item_id}:{purchase_date.isoformat()}",
                        }
                    )
                continue

            predicted_end_date = purchase_date + timedelta(days=round(float(avg_duration_days)))
            days_remaining = (predicted_end_date - today).days
            risk_type = None
            severity = "warning"
            message = None
            color_token = "warning"

            if days_remaining < 0:
                risk_type = "consumable_overdue"
                severity = "critical"
                color_token = "danger"
                message = f"'{item_name}' está com ciclo vencido há {abs(days_remaining)} dias"
            elif days_remaining <= window_days:
                risk_type = "consumable_restock_due"
                message = f"Reposição de '{item_name}' prevista para {predicted_end_date.isoformat()}"

            if not risk_type:
                continue

            notifications.append(
                {
                    "notification_type": risk_type,
                    "source_feature": "consumables",
                    "title": item_name,
                    "message": message,
                    "severity": severity,
                    "scheduled_for": predicted_end_date.isoformat(),
                    "meta": {
                        "item_id": item_id,
                        "item_name": item_name,
                        "category_name": category_name,
                        "predicted_end_date": predicted_end_date.isoformat(),
                        "days_remaining": days_remaining,
                    },
                    "color_token": color_token,
                    "unique_key": f"{risk_type}:{item_id}:{predicted_end_date.isoformat()}",
                }
            )

        return notifications
