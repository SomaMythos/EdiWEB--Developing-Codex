from data.database import Database
from datetime import datetime


class DailyConfigEngine:

    @staticmethod
    def get():
        with Database() as db:
            config = db.fetchone("SELECT * FROM daily_config WHERE id = 1")
            return config

    @staticmethod
    def update(
        sleep_start,
        sleep_end,
        work_start,
        work_end,
        buffer_between,
        granularity_min,
        avoid_category_adjacent,
        discipline_weight,
        fun_weight,
    ):
        if discipline_weight < 0 or fun_weight < 0:
            raise ValueError("discipline_weight e fun_weight devem ser >= 0")

        with Database() as db:
            db.execute(
                """
                UPDATE daily_config
                SET
                    sleep_start = ?,
                    sleep_end = ?,
                    work_start = ?,
                    work_end = ?,
                    buffer_between = ?,
                    granularity_min = ?,
                    avoid_category_adjacent = ?,
                    discipline_weight = ?,
                    fun_weight = ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    sleep_start,
                    sleep_end,
                    work_start,
                    work_end,
                    buffer_between,
                    granularity_min,
                    1 if avoid_category_adjacent else 0,
                    discipline_weight,
                    fun_weight,
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )
            return True
