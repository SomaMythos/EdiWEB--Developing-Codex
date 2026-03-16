from datetime import date

from data.database import Database


def _parse_iso_date(value):
    return date.fromisoformat(value) if value else None


def _serialize_counter_row(row, reference_date):
    started_at = row["started_at"]
    completed_at = row["completed_at"]
    started_date = _parse_iso_date(started_at)
    completed_date = _parse_iso_date(completed_at)
    elapsed_days = row["elapsed_days"]

    if elapsed_days is None and started_date and completed_date:
        elapsed_days = max((completed_date - started_date).days, 0)

    days_since_start = None
    if started_date and completed_date is None:
        days_since_start = max((reference_date - started_date).days, 0)

    return {
        "id": row["id"],
        "title": row["title"],
        "started_at": started_at,
        "completed_at": completed_at,
        "elapsed_days": elapsed_days,
        "days_since_start": days_since_start,
        "is_completed": completed_at is not None,
        "completed_cycles": row["completed_cycles"] or 0,
        "average_elapsed_days": row["average_elapsed_days"],
    }


class ActivityCounterEngine:

    @staticmethod
    def list_counters(reference_date=None):
        today = reference_date or date.today()

        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    counters.id,
                    counters.title,
                    counters.started_at,
                    counters.completed_at,
                    counters.elapsed_days,
                    counters.created_at,
                    title_stats.completed_cycles,
                    title_stats.average_elapsed_days
                FROM activity_counters counters
                LEFT JOIN (
                    SELECT
                        LOWER(TRIM(title)) AS title_key,
                        COUNT(*) AS completed_cycles,
                        ROUND(AVG(elapsed_days), 1) AS average_elapsed_days
                    FROM activity_counters
                    WHERE completed_at IS NOT NULL
                      AND elapsed_days IS NOT NULL
                    GROUP BY LOWER(TRIM(title))
                ) AS title_stats
                    ON title_stats.title_key = LOWER(TRIM(counters.title))
                ORDER BY counters.created_at DESC, counters.id DESC
                """
            )

            averages = db.fetchall(
                """
                SELECT
                    grouped.title,
                    grouped.completed_cycles,
                    grouped.average_elapsed_days,
                    grouped.last_completed_at
                FROM (
                    SELECT
                        MAX(title) AS title,
                        LOWER(TRIM(title)) AS title_key,
                        COUNT(*) AS completed_cycles,
                        ROUND(AVG(elapsed_days), 1) AS average_elapsed_days,
                        MAX(completed_at) AS last_completed_at
                    FROM activity_counters
                    WHERE completed_at IS NOT NULL
                      AND elapsed_days IS NOT NULL
                    GROUP BY LOWER(TRIM(title))
                ) AS grouped
                ORDER BY grouped.last_completed_at DESC, grouped.title ASC
                """
            )

        items = [_serialize_counter_row(row, today) for row in rows]
        items.sort(
            key=lambda item: (
                0 if not item["is_completed"] else 1,
                item["started_at"] if not item["is_completed"] else "",
                "" if not item["is_completed"] else f"z{item['completed_at']}",
                item["title"].lower(),
            )
        )
        completed_items = [item for item in items if item["is_completed"]]
        open_items = [item for item in items if not item["is_completed"]]
        completed_items.sort(
            key=lambda item: (
                item["completed_at"] or "",
                item["started_at"],
                item["title"].lower(),
            ),
            reverse=True,
        )

        return {
            "items": open_items + completed_items,
            "summary": {
                "open_count": len(open_items),
                "completed_count": len(completed_items),
                "averages": [
                    {
                        "title": row["title"],
                        "completed_cycles": row["completed_cycles"],
                        "average_elapsed_days": row["average_elapsed_days"],
                        "last_completed_at": row["last_completed_at"],
                    }
                    for row in averages
                ],
            },
        }

    @staticmethod
    def create_counter(title, started_at=None):
        started_value = started_at or date.today().isoformat()

        with Database() as db:
            db.execute(
                """
                INSERT INTO activity_counters (
                    title,
                    started_at
                ) VALUES (?, ?)
                """,
                (title, started_value),
            )
            counter_id = db.lastrowid

            row = db.fetchone(
                """
                SELECT
                    id,
                    title,
                    started_at,
                    completed_at,
                    elapsed_days,
                    0 AS completed_cycles,
                    NULL AS average_elapsed_days
                FROM activity_counters
                WHERE id = ?
                """,
                (counter_id,),
            )

        return _serialize_counter_row(row, _parse_iso_date(started_value))

    @staticmethod
    def complete_counter(counter_id, completed_at=None):
        completed_value = completed_at or date.today().isoformat()
        completed_date = _parse_iso_date(completed_value)

        with Database() as db:
            counter = db.fetchone(
                """
                SELECT id, title, started_at, completed_at
                FROM activity_counters
                WHERE id = ?
                """,
                (counter_id,),
            )

            if counter is None:
                return None

            if counter["completed_at"] is not None:
                return "already_completed"

            started_date = _parse_iso_date(counter["started_at"])
            elapsed_days = max((completed_date - started_date).days, 0)

            db.execute(
                """
                UPDATE activity_counters
                SET completed_at = ?, elapsed_days = ?
                WHERE id = ?
                """,
                (completed_value, elapsed_days, counter_id),
            )

            row = db.fetchone(
                """
                SELECT
                    counters.id,
                    counters.title,
                    counters.started_at,
                    counters.completed_at,
                    counters.elapsed_days,
                    title_stats.completed_cycles,
                    title_stats.average_elapsed_days
                FROM activity_counters counters
                LEFT JOIN (
                    SELECT
                        LOWER(TRIM(title)) AS title_key,
                        COUNT(*) AS completed_cycles,
                        ROUND(AVG(elapsed_days), 1) AS average_elapsed_days
                    FROM activity_counters
                    WHERE completed_at IS NOT NULL
                      AND elapsed_days IS NOT NULL
                    GROUP BY LOWER(TRIM(title))
                ) AS title_stats
                    ON title_stats.title_key = LOWER(TRIM(counters.title))
                WHERE counters.id = ?
                """,
                (counter_id,),
            )

        return _serialize_counter_row(row, completed_date)
