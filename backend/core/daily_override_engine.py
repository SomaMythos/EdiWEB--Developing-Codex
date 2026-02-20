from datetime import datetime
from data.database import Database


class DailyOverrideEngine:

    @staticmethod
    def set_override(date: str, is_off: bool):
        with Database() as db:
            db.execute("""
                INSERT INTO daily_overrides (date, is_off)
                VALUES (?, ?)
                ON CONFLICT(date) DO UPDATE SET
                    is_off = excluded.is_off
            """, (date, 1 if is_off else 0))
        return True

    @staticmethod
    def get_override(date: str):
        with Database() as db:
            row = db.fetchone(
                "SELECT is_off FROM daily_overrides WHERE date = ?",
                (date,)
            )
            if not row:
                return None
            return bool(row["is_off"])

    @staticmethod
    def get_day_type(date: str):
        """
        Retorna:
            'work' ou 'off'
        Regras:
            - Override manual tem prioridade
            - Senão: seg-sex = work | sab-dom = off
        """
        override = DailyOverrideEngine.get_override(date)
        if override is not None:
            return "off" if override else "work"

        dt = datetime.fromisoformat(date)
        weekday = dt.weekday()  # 0=seg, 6=dom

        if weekday >= 5:
            return "off"
        return "work"
