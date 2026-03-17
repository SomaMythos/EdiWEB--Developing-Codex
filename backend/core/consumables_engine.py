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
    def _normalize_stock_quantity(value, field_name: str = "stock_quantity") -> int:
        try:
            normalized = int(value)
        except (TypeError, ValueError) as exc:
            raise ConsumablesValidationError(f"{field_name} deve ser inteiro") from exc

        if normalized <= 0:
            raise ConsumablesValidationError(f"{field_name} deve ser maior que zero")

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
    def _load_cycles_for_item(db, item_id: int):
        rows = db.fetchall(
            """
            SELECT
                c.id,
                c.item_id,
                c.purchase_date,
                c.stock_quantity,
                c.remaining_quantity,
                c.price_paid,
                c.ended_at,
                c.duration_days,
                c.created_at,
                COUNT(l.id) AS unit_logs_count,
                MAX(l.consumed_at) AS last_consumed_at
            FROM consumable_cycles c
            LEFT JOIN consumable_unit_logs l ON l.cycle_id = c.id
            WHERE c.item_id = ?
            GROUP BY c.id
            ORDER BY c.purchase_date DESC, c.id DESC
            """,
            (item_id,),
        )

        cycles = []
        for row in rows:
            cycle = dict(row)
            stock_quantity = int(cycle.get("stock_quantity") or 1)
            remaining_quantity = int(cycle.get("remaining_quantity") or stock_quantity)
            unit_logs_count = int(cycle.get("unit_logs_count") or 0)

            if cycle.get("ended_at"):
                remaining_quantity = 0

            units_consumed = unit_logs_count
            if units_consumed == 0 and cycle.get("ended_at") and cycle.get("duration_days") is not None:
                units_consumed = 1

            unit_price = None
            if cycle.get("price_paid") is not None and stock_quantity > 0:
                unit_price = float(cycle["price_paid"]) / stock_quantity

            cycle["stock_quantity"] = stock_quantity
            cycle["remaining_quantity"] = remaining_quantity
            cycle["unit_logs_count"] = unit_logs_count
            cycle["units_consumed"] = units_consumed
            cycle["last_consumed_at"] = cycle.get("last_consumed_at") or (
                cycle.get("ended_at") if units_consumed > 0 else None
            )
            cycle["unit_price"] = unit_price
            cycles.append(cycle)

        return cycles

    @staticmethod
    def _load_unit_logs_for_item(db, item_id: int):
        return [
            dict(row)
            for row in db.fetchall(
                """
                SELECT id, cycle_id, item_id, consumed_at, duration_days, created_at
                FROM consumable_unit_logs
                WHERE item_id = ?
                ORDER BY consumed_at DESC, id DESC
                """,
                (item_id,),
            )
        ]

    @staticmethod
    def _build_stats(cycles_list, unit_logs):
        total_purchases = len(cycles_list)
        open_cycle = next((cycle for cycle in cycles_list if cycle.get("ended_at") is None), None)

        legacy_unit_durations = [
            float(cycle["duration_days"])
            for cycle in cycles_list
            if cycle.get("ended_at") and cycle.get("duration_days") is not None and int(cycle.get("unit_logs_count") or 0) == 0
        ]
        unit_durations = [float(log["duration_days"]) for log in unit_logs if log.get("duration_days") is not None]
        unit_durations.extend(legacy_unit_durations)
        total_units_consumed = len(unit_durations)

        avg_duration_days = None
        if unit_durations:
            avg_duration_days = sum(unit_durations) / len(unit_durations)

        avg_purchase_price = None
        priced_cycles = [cycle for cycle in cycles_list if cycle.get("price_paid") is not None]
        if priced_cycles:
            avg_purchase_price = sum(float(cycle["price_paid"]) for cycle in priced_cycles) / len(priced_cycles)

        avg_unit_price = None
        total_priced_amount = 0.0
        total_priced_units = 0
        for cycle in priced_cycles:
            total_priced_amount += float(cycle["price_paid"])
            total_priced_units += int(cycle.get("stock_quantity") or 0)
        if total_priced_units > 0:
            avg_unit_price = total_priced_amount / total_priced_units

        last_price_delta = None
        last_price_delta_percent = None
        priced_unit_cycles = [cycle for cycle in cycles_list if cycle.get("unit_price") is not None]
        if len(priced_unit_cycles) >= 2:
            latest_price = ConsumablesEngine._to_float(priced_unit_cycles[0].get("unit_price"))
            previous_price = ConsumablesEngine._to_float(priced_unit_cycles[1].get("unit_price"))
            if latest_price is not None and previous_price is not None:
                last_price_delta = latest_price - previous_price
                if previous_price != 0:
                    last_price_delta_percent = (last_price_delta / previous_price) * 100

        purchase_frequency_per_month = None
        if total_purchases > 0 and cycles_list:
            first_purchase = min(date.fromisoformat(cycle["purchase_date"]) for cycle in cycles_list)
            days_since_first_purchase = (date.today() - first_purchase).days
            months_since_first_purchase = days_since_first_purchase / 30 if days_since_first_purchase > 0 else 0
            if months_since_first_purchase > 0:
                purchase_frequency_per_month = total_purchases / months_since_first_purchase

        monthly_avg_spend = None
        annual_avg_spend = None
        if avg_unit_price is not None and avg_duration_days is not None and avg_duration_days > 0:
            monthly_avg_spend = avg_unit_price / (avg_duration_days / 30)
            annual_avg_spend = monthly_avg_spend * 12

        predicted_end_date = None
        if open_cycle and avg_duration_days is not None and avg_duration_days > 0:
            remaining_quantity = int(open_cycle.get("remaining_quantity") or 0)
            if remaining_quantity > 0:
                baseline_iso = open_cycle.get("last_consumed_at") or open_cycle["purchase_date"]
                baseline_date = date.fromisoformat(baseline_iso)
                predicted_days = round(avg_duration_days * remaining_quantity)
                predicted_end_date = (baseline_date + timedelta(days=predicted_days)).isoformat()

        stats = {
            "total_purchases": total_purchases,
            "total_units_consumed": total_units_consumed,
            "avg_price": avg_unit_price,
            "avg_purchase_price": avg_purchase_price,
            "avg_unit_price": avg_unit_price,
            "last_price_delta": last_price_delta,
            "last_price_delta_percent": last_price_delta_percent,
            "avg_duration_days": avg_duration_days,
            "purchase_frequency_per_month": purchase_frequency_per_month,
            "monthly_avg_spend": monthly_avg_spend,
            "annual_avg_spend": annual_avg_spend,
            "predicted_end_date": predicted_end_date,
            "current_stock_quantity": int(open_cycle.get("remaining_quantity") or 0) if open_cycle else 0,
        }
        return stats, open_cycle

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
            SELECT
                i.id,
                i.name,
                i.category_id,
                i.created_at,
                c.name AS category_name,
                oc.id AS open_cycle_id,
                oc.purchase_date AS open_purchase_date,
                oc.stock_quantity,
                oc.remaining_quantity,
                oc.price_paid AS open_cycle_price
            FROM consumable_items i
            JOIN consumable_categories c ON c.id = i.category_id
            LEFT JOIN consumable_cycles oc ON oc.item_id = i.id AND oc.ended_at IS NULL
        """
        params = ()
        if category_id is not None:
            query += " WHERE i.category_id = ?"
            params = (category_id,)

        query += " ORDER BY c.name, i.name"

        with Database() as db:
            rows = db.fetchall(query, params)

        items = []
        for row in rows:
            item = dict(row)
            item["stock_quantity"] = int(item["stock_quantity"] or 0) if item.get("open_cycle_id") else 0
            item["remaining_quantity"] = int(item["remaining_quantity"] or 0) if item.get("open_cycle_id") else 0
            item["has_open_cycle"] = bool(item.get("open_cycle_id"))
            items.append(item)

        return items

    @staticmethod
    def restock_item(
        item_id: int,
        purchase_date: str,
        price_paid: Optional[float] = None,
        stock_quantity: int = 1,
    ) -> int:
        if not ConsumablesEngine._get_item(item_id):
            raise ConsumablesNotFoundError("Item não encontrado")

        purchase_date_iso = ConsumablesEngine._require_iso_date(purchase_date, "purchase_date")
        normalized_price = ConsumablesEngine._normalize_price(price_paid)
        normalized_stock_quantity = ConsumablesEngine._normalize_stock_quantity(stock_quantity)

        with Database() as db:
            open_cycle = db.fetchone(
                "SELECT id FROM consumable_cycles WHERE item_id = ? AND ended_at IS NULL",
                (item_id,),
            )
            if open_cycle:
                raise ConsumablesConflictError("Já existe um ciclo aberto para este item")

            db.execute(
                """
                INSERT INTO consumable_cycles (item_id, purchase_date, stock_quantity, remaining_quantity, price_paid)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    item_id,
                    purchase_date_iso,
                    normalized_stock_quantity,
                    normalized_stock_quantity,
                    normalized_price,
                ),
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
                SELECT id, purchase_date, stock_quantity, remaining_quantity
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

            stock_quantity = int(open_cycle["stock_quantity"] or 1)
            remaining_quantity = int(open_cycle["remaining_quantity"] or stock_quantity)
            if remaining_quantity <= 0:
                raise ConsumablesConflictError("Não há unidades restantes em estoque para este item")

            db.execute(
                """
                INSERT INTO consumable_unit_logs (cycle_id, item_id, consumed_at, duration_days)
                VALUES (?, ?, ?, ?)
                """,
                (open_cycle["id"], item_id, ended_at_iso, duration_days),
            )

            remaining_after = remaining_quantity - 1
            if remaining_after == 0:
                db.execute(
                    """
                    UPDATE consumable_cycles
                    SET remaining_quantity = ?, ended_at = ?, duration_days = ?
                    WHERE id = ?
                    """,
                    (0, ended_at_iso, duration_days, open_cycle["id"]),
                )
            else:
                db.execute(
                    """
                    UPDATE consumable_cycles
                    SET remaining_quantity = ?
                    WHERE id = ?
                    """,
                    (remaining_after, open_cycle["id"]),
                )

            return {
                "id": open_cycle["id"],
                "item_id": item_id,
                "purchase_date": purchase_date_iso,
                "ended_at": ended_at_iso if remaining_after == 0 else None,
                "duration_days": duration_days,
                "stock_quantity": stock_quantity,
                "remaining_quantity": remaining_after,
                "cycle_closed": remaining_after == 0,
            }

    @staticmethod
    def get_item_detail(item_id: int):
        item = ConsumablesEngine._get_item(item_id)
        if not item:
            raise ConsumablesNotFoundError("Item não encontrado")

        with Database() as db:
            cycles_list = ConsumablesEngine._load_cycles_for_item(db, item_id)
            unit_logs = ConsumablesEngine._load_unit_logs_for_item(db, item_id)

        stats, open_cycle = ConsumablesEngine._build_stats(cycles_list, unit_logs)
        item_data = dict(item)
        item_data["current_stock_quantity"] = stats["current_stock_quantity"]

        return {
            "item": item_data,
            "cycles": cycles_list,
            "unit_logs": unit_logs,
            "open_cycle": open_cycle,
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
                    c.name AS category_name
                FROM consumable_items i
                JOIN consumable_categories c ON c.id = i.category_id
                JOIN consumable_cycles oc ON oc.item_id = i.id AND oc.ended_at IS NULL
                ORDER BY c.name, i.name
                """
            )

        notifications = []
        for row in rows:
            detail = ConsumablesEngine.get_item_detail(row["item_id"])
            stats = detail["stats"]
            open_cycle = detail.get("open_cycle")
            if not open_cycle:
                continue

            item_id = row["item_id"]
            item_name = row["item_name"]
            category_name = row["category_name"]
            predicted_end_date_iso = stats.get("predicted_end_date")
            total_units_consumed = int(stats.get("total_units_consumed") or 0)

            if not predicted_end_date_iso or total_units_consumed < min_history_cycles:
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
                                "remaining_quantity": int(open_cycle.get("remaining_quantity") or 0),
                            },
                            "color_token": "primary",
                            "unique_key": f"consumable_insufficient_history:{item_id}:{open_cycle['purchase_date']}",
                        }
                    )
                continue

            predicted_end_date = date.fromisoformat(predicted_end_date_iso)
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
                        "remaining_quantity": int(open_cycle.get("remaining_quantity") or 0),
                    },
                    "color_token": color_token,
                    "unique_key": f"{risk_type}:{item_id}:{predicted_end_date.isoformat()}",
                }
            )

        return notifications
