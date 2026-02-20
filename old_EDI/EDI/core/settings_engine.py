from data.database import Database


class SettingsEngine:
    @staticmethod
    def get_work_days(default="0,1,2,3,4"):
        raw = SettingsEngine.get_setting("work_days", default) or ""
        days = set()
        for item in raw.split(","):
            item = item.strip()
            if not item:
                continue
            try:
                value = int(item)
            except ValueError:
                continue
            if 0 <= value <= 6:
                days.add(value)
        if not days:
            return {0, 1, 2, 3, 4}
        return days

    @staticmethod
    def get_setting(key, default=None):
        with Database() as db:
            row = db.fetchone(
                """
                SELECT value
                FROM app_settings
                WHERE key = ?
                """,
                (key,),
            )
        return row["value"] if row else default

    @staticmethod
    def set_setting(key, value):
        with Database() as db:
            db.execute(
                """
                INSERT INTO app_settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value
                """,
                (key, str(value)),
            )
