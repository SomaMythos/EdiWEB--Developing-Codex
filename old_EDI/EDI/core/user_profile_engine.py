from datetime import datetime, date
from typing import Optional, Dict, Any

from data.database import Database


class UserProfileEngine:

    # =========================
    # Utils
    # =========================
    @staticmethod
    def _parse_date(date_str: str) -> Optional[date]:
        if not date_str:
            return None

        s = date_str.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except Exception:
                pass
        return None

    @staticmethod
    def _normalize_profile(row: Any) -> Optional[Dict[str, Any]]:
        if row is None:
            return None

        if isinstance(row, dict):
            return row

        try:
            if hasattr(row, "keys"):
                return {
                    "id": row["id"],
                    "name": row["name"],
                    "birth_date": row["birth_date"],
                    "height": row["height"],
                }
        except Exception:
            pass

        if isinstance(row, (list, tuple)) and len(row) >= 4:
            return {
                "id": row[0],
                "name": row[1],
                "birth_date": row[2],
                "height": row[3],
            }

        return None

    # =========================
    # Perfil
    # =========================
    @staticmethod
    def get_profile() -> Optional[Dict[str, Any]]:
        with Database() as db:
            row = db.fetchone(
                "SELECT id, name, birth_date, height FROM user_profile LIMIT 1"
            )
            return UserProfileEngine._normalize_profile(row)

    @staticmethod
    def create_profile(name: str, birth_date: str, height: Optional[float] = None):
        with Database() as db:
            db.execute(
                "INSERT INTO user_profile (name, birth_date, height) VALUES (?, ?, ?)",
                (name, birth_date, height),
            )

    # =========================
    # Idade
    # =========================
    @staticmethod
    def get_age(arg: Optional[Any] = None) -> Optional[int]:
        birth_date_str = None

        if arg is None:
            profile = UserProfileEngine.get_profile()
            if not profile:
                return None
            birth_date_str = profile.get("birth_date")

        elif isinstance(arg, str):
            birth_date_str = arg

        else:
            profile = UserProfileEngine._normalize_profile(arg)
            if profile:
                birth_date_str = profile.get("birth_date")

        birth = UserProfileEngine._parse_date(birth_date_str)
        if not birth:
            return None

        today = date.today()
        age = today.year - birth.year
        if (today.month, today.day) < (birth.month, birth.day):
            age -= 1
        return age

    # =========================
    # Métricas
    # =========================
    @staticmethod
    def add_metric(weight: float, metric_date: Optional[str] = None):
        """
        Retorna:
        (True, msg) em sucesso
        (False, msg) em erro
        """
        try:
            profile = UserProfileEngine.get_profile()
            if not profile or not profile.get("id"):
                return False, "Perfil não encontrado"

            if metric_date:
                d = UserProfileEngine._parse_date(metric_date)
                metric_date = d.isoformat() if d else date.today().isoformat()
            else:
                metric_date = date.today().isoformat()

            with Database() as db:
                db.execute(
                    "INSERT INTO user_metrics (user_id, weight, date) VALUES (?, ?, ?)",
                    (profile["id"], float(weight), metric_date),
                )

            return True, "Peso salvo"

        except Exception as e:
            return False, str(e)

    @staticmethod
    def get_latest_metric(user_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        if user_id is None:
            profile = UserProfileEngine.get_profile()
            if not profile:
                return None
            user_id = profile["id"]

        with Database() as db:
            row = db.fetchone(
                """
                SELECT id, weight, date
                FROM user_metrics
                WHERE user_id = ?
                ORDER BY id DESC
                LIMIT 1
                """,
                (user_id,),
            )

            if not row:
                return None

            try:
                return {
                    "id": row["id"],
                    "weight": row["weight"],
                    "date": row["date"],
                }
            except Exception:
                return {
                    "id": row[0],
                    "weight": row[1],
                    "date": row[2],
                }

    # =========================
    # BMI
    # =========================
    @staticmethod
    def calculate_bmi(weight: Optional[float] = None,
                      height: Optional[float] = None,
                      profile: Optional[Any] = None) -> Optional[float]:

        prof = None
        if profile:
            prof = UserProfileEngine._normalize_profile(profile)

        if height is None:
            src = prof or UserProfileEngine.get_profile()
            if src and src.get("height"):
                height = src.get("height")

        if weight is None:
            latest = UserProfileEngine.get_latest_metric(
                prof["id"] if prof and prof.get("id") else None
            )
            if latest:
                weight = latest.get("weight")

        if weight is None or height is None:
            return None

        try:
            h = float(height)
            if h > 10:
                h /= 100.0
            bmi = float(weight) / (h ** 2)
            return round(bmi, 2)
        except Exception:
            return None
