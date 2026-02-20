from datetime import datetime, date
from typing import Optional, Any

from data.database import Database


class UserProfileEngine:
    @staticmethod
    def _parse_date(date_str: Optional[str]):
        if not date_str:
            return None
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(date_str.strip(), fmt).date()
            except Exception:
                continue
        return None

    @staticmethod
    def get_profile():
        with Database() as db:
            return db.fetchone(
                """
                SELECT id, name, birth_date, height, gender, photo_path, created_at, updated_at
                FROM user_profile
                LIMIT 1
                """
            )

    @staticmethod
    def save_profile(
        name: str,
        birth_date: Optional[str] = None,
        height: Optional[float] = None,
        gender: Optional[str] = None,
        photo_path: Optional[str] = None,
    ):
        with Database() as db:
            existing = db.fetchone("SELECT id FROM user_profile LIMIT 1")
            if existing:
                db.execute(
                    """
                    UPDATE user_profile
                    SET name = ?, birth_date = ?, height = ?, gender = ?, photo_path = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (name, birth_date, height, gender, photo_path, existing["id"]),
                )
                return existing["id"]

            db.execute(
                """
                INSERT INTO user_profile (name, birth_date, height, gender, photo_path, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                """,
                (name, birth_date, height, gender, photo_path),
            )
            return db.lastrowid

    @staticmethod
    def get_age(profile: Optional[Any] = None):
        prof = profile or UserProfileEngine.get_profile()
        if not prof:
            return None
        birth = UserProfileEngine._parse_date(prof.get("birth_date"))
        if not birth:
            return None
        today = date.today()
        age = today.year - birth.year
        if (today.month, today.day) < (birth.month, birth.day):
            age -= 1
        return age

    @staticmethod
    def add_metric(
        weight: float,
        metric_date: Optional[str] = None,
        user_id: Optional[int] = None,
        body_fat: Optional[float] = None,
        muscle_mass: Optional[float] = None,
        notes: Optional[str] = None,
    ):
        profile = UserProfileEngine.get_profile()
        if not profile and not user_id:
            return False

        metric_date = metric_date or date.today().isoformat()
        resolved_user_id = user_id or profile["id"]

        with Database() as db:
            db.execute(
                """
                INSERT INTO user_metrics (user_id, weight, body_fat, muscle_mass, notes, date)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (resolved_user_id, weight, body_fat, muscle_mass, notes, metric_date),
            )
        return True

    @staticmethod
    def get_metrics(limit: int = 30):
        with Database() as db:
            return db.fetchall(
                """
                SELECT id, user_id, weight, body_fat, muscle_mass, notes, date
                FROM user_metrics
                ORDER BY date DESC
                LIMIT ?
                """,
                (limit,),
            )
