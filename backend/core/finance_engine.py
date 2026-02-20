# core/finance_engine.py
from datetime import datetime
from data.database import Database


class FinanceEngine:

    # =========================================================
    # CONFIGURAÇÃO
    # =========================================================

    @staticmethod
    def get_config():
        """
        Retorna a configuração como um dicionário puro.
        Converte sqlite3.Row (ou outros formatos) para dict para permitir .get().
        """
        db = Database()
        row = db.fetchone("SELECT * FROM finance_config LIMIT 1")
        db.close()
        if not row:
            return {}
        # sqlite3.Row -> dict(row) funciona; se falhar, constrói manualmente
        try:
            return dict(row)
        except Exception:
            # fallback: construir dict a partir dos campos conhecidos (mais seguro)
            # Se row for indexável por col name, isso tentará extrair.
            config = {}
            try:
                for k in row.keys():
                    config[k] = row[k]
                return config
            except Exception:
                # por segurança, retorna row como está (mas preferimos dict)
                return row

    @staticmethod
    def save_config(data: dict):
        """
        Salva / atualiza a configuração financeira.
        Inclui reserve_fgts (saldo atual FGTS) e fgts (depósito mensal FGTS).
        Faz UPDATE com WHERE id=? quando já existe registro.
        """
        db = Database()

        existing = db.fetchone("SELECT id FROM finance_config LIMIT 1")
        existing_id = existing["id"] if existing else None

        # montar fields na mesma ordem das colunas do INSERT/UPDATE
        fields = (
            data.get("salary_monthly", 0),
            data.get("reserve_current", 0),
            data.get("reserve_cdb", 0),
            data.get("reserve_extra", 0),
            data.get("reserve_fgts", 0),     # Saldo atual FGTS
            data.get("fgts", 0),             # Depósito mensal FGTS
            data.get("monthly_contribution", 0),
            data.get("thirteenth", 0),
            data.get("cdi_rate_annual", 0),
            data.get("cdb_percent_cdi", 100),
            data.get("extra_percent_cdi", 100),
            data.get("interest_rate_current", 0),
            data.get("interest_rate_fgts", 3),
            datetime.now().isoformat()
        )

        if existing_id:
            # UPDATE precisa do id no final dos params para WHERE id=?.
            db.execute("""
                UPDATE finance_config
                SET salary_monthly=?,
                    reserve_current=?,
                    reserve_cdb=?,
                    reserve_extra=?,
                    reserve_fgts=?,
                    fgts=?,
                    monthly_contribution=?,
                    thirteenth=?,
                    cdi_rate_annual=?,
                    cdb_percent_cdi=?,
                    extra_percent_cdi=?,
                    interest_rate_current=?,
                    interest_rate_fgts=?,
                    updated_at=?
                WHERE id=?
            """, fields + (existing_id,))
        else:
            db.execute("""
                INSERT INTO finance_config (
                    salary_monthly,
                    reserve_current,
                    reserve_cdb,
                    reserve_extra,
                    reserve_fgts,
                    fgts,
                    monthly_contribution,
                    thirteenth,
                    cdi_rate_annual,
                    cdb_percent_cdi,
                    extra_percent_cdi,
                    interest_rate_current,
                    interest_rate_fgts,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, fields)

        db.commit()
        db.close()

    # =========================================================
    # GASTOS FIXOS
    # =========================================================

    @staticmethod
    def list_fixed_expenses():
        db = Database()
        rows = db.fetchall("""
            SELECT id, name, monthly_value, created_at, updated_at
            FROM finance_fixed_expenses
            ORDER BY name ASC
        """)
        db.close()
        return rows

    @staticmethod
    def create_fixed_expense(name, monthly_value):
        db = Database()
        db.execute("""
            INSERT INTO finance_fixed_expenses (name, monthly_value)
            VALUES (?, ?)
        """, (name, monthly_value))
        db.commit()
        db.close()

    @staticmethod
    def update_fixed_expense(expense_id, name, monthly_value):
        db = Database()
        db.execute("""
            UPDATE finance_fixed_expenses
            SET name=?, monthly_value=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        """, (name, monthly_value, expense_id))
        updated = db.execute("SELECT changes()").fetchone()[0]
        db.commit()
        db.close()
        return updated > 0

    @staticmethod
    def delete_fixed_expense(expense_id):
        db = Database()
        db.execute("DELETE FROM finance_fixed_expenses WHERE id=?", (expense_id,))
        deleted = db.execute("SELECT changes()").fetchone()[0]
        db.commit()
        db.close()
        return deleted > 0

    # =========================================================
    # RESUMO FINANCEIRO
    # =========================================================

    @staticmethod
    def get_summary():
        """
        Retorna resumo com valores principais e também os saldos por conta:
        - patrimonio_total, saldo_disponivel, percentual_economia, total_gastos_fixos, health_indicator
        - current, cdb, extra, fgts (para os cards do frontend)
        """
        config = FinanceEngine.get_config()
        if not config:
            return {}

        db = Database()
        total_fixed_row = db.fetchone("""
            SELECT COALESCE(SUM(monthly_value), 0) as total
            FROM finance_fixed_expenses
        """)
        total_fixed = float(total_fixed_row["total"]) if total_fixed_row and total_fixed_row["total"] is not None else 0.0
        db.close()

        # agora config é dict -> usar config.get é seguro
        salary = float(config.get("salary_monthly", 0) or 0)
        contribution = float(config.get("monthly_contribution", 0) or 0)

        # patrimônio total considera reserve_fgts (saldo atual) também
        patrimonio_total = (
            float(config.get("reserve_current", 0) or 0) +
            float(config.get("reserve_cdb", 0) or 0) +
            float(config.get("reserve_extra", 0) or 0) +
            float(config.get("reserve_fgts", 0) or 0)
        )

        saldo_disponivel = salary - total_fixed - contribution
        percentual_economia = (contribution / salary * 100) if salary > 0 else 0

        if patrimonio_total >= total_fixed * 6 and percentual_economia >= 20:
            health = "bom"
        elif patrimonio_total >= total_fixed * 3:
            health = "regular"
        else:
            health = "ruim"

        # Também exportar saldos individuais para o frontend mostrar “atual”
        return {
            "patrimonio_total": round(patrimonio_total, 2),
            "saldo_disponivel": round(saldo_disponivel, 2),
            "percentual_economia": round(percentual_economia, 2),
            "total_gastos_fixos": round(total_fixed, 2),
            "health_indicator": health,
            "current": round(float(config.get("reserve_current", 0) or 0), 2),
            "cdb": round(float(config.get("reserve_cdb", 0) or 0), 2),
            "extra": round(float(config.get("reserve_extra", 0) or 0), 2),
            "fgts": round(float(config.get("reserve_fgts", 0) or 0), 2),
        }

    # =========================================================
    # PROJEÇÃO JUROS COMPOSTOS
    # =========================================================

    @staticmethod
    def generate_projection(months=120):
        config = FinanceEngine.get_config()
        if not config:
            return []

        # helper para ler o config com segurança e converter para float
        def cfg(name):
            try:
                # config é dict graças a get_config()
                v = config.get(name, 0)
            except Exception:
                v = 0
            try:
                return float(v)
            except Exception:
                return 0.0

        # ============================
        # SALDOS INICIAIS
        # ============================
        current = cfg("reserve_current")
        cdb = cfg("reserve_cdb")
        extra = cfg("reserve_extra")
        fgts_balance = cfg("reserve_fgts")  # saldo atual FGTS

        # ============================
        # CONFIGURAÇÕES
        # ============================
        salary = cfg("salary_monthly")
        contribution = cfg("monthly_contribution")
        thirteenth = cfg("thirteenth")
        fgts_monthly_deposit = cfg("fgts")  # fgts no config = depósito mensal

        # ============================
        # CDI - CAPITALIZAÇÃO EXPONENCIAL
        # ============================
        cdi_annual = cfg("cdi_rate_annual") / 100.0
        cdi_monthly = (1 + cdi_annual) ** (1.0 / 12.0) - 1.0

        cdb_rate = cdi_monthly * (cfg("cdb_percent_cdi") / 100.0)
        extra_rate = cdi_monthly * (cfg("extra_percent_cdi") / 100.0)

        # Conta corrente (taxa anual própria)
        current_annual = cfg("interest_rate_current") / 100.0
        current_rate = (1 + current_annual) ** (1.0 / 12.0) - 1.0

        # FGTS: taxa anual configurável (default 3%)
        fgts_annual = cfg("interest_rate_fgts") / 100.0
        fgts_rate = (1 + fgts_annual) ** (1.0 / 12.0) - 1.0

        # ============================
        # GASTOS FIXOS (mensal)
        # ============================
        db = Database()
        total_fixed_row = db.fetchone("""
            SELECT COALESCE(SUM(monthly_value), 0) as total
            FROM finance_fixed_expenses
        """)
        total_fixed = float(total_fixed_row["total"]) if total_fixed_row and total_fixed_row["total"] is not None else 0.0
        db.close()

        projection = []

        for m in range(1, months + 1):
            # 1. juros sobre saldos
            current = current * (1.0 + current_rate)
            cdb = cdb * (1.0 + cdb_rate)
            extra = extra * (1.0 + extra_rate)
            fgts_balance = fgts_balance * (1.0 + fgts_rate)

            # 2. movimentação mensal
            monthly_leftover = salary - total_fixed - contribution
            current += monthly_leftover

            cdb += contribution
            fgts_balance += fgts_monthly_deposit

            # 13º salário no mês 12,24...
            if (m % 12) == 0 and thirteenth > 0:
                current += thirteenth

            total = current + cdb + extra + fgts_balance

            projection.append({
                "month": m,
                "total": round(total, 2),
                "current": round(current, 2),
                "cdb": round(cdb, 2),
                "extra": round(extra, 2),
                "fgts": round(fgts_balance, 2),
            })

        return projection
