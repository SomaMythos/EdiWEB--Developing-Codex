from data.database import Database


class RoutineEngine:

    # ---------------------------
    # ROTINAS
    # ---------------------------

    @staticmethod
    def list_routines():
        with Database() as db:
            rows = db.fetchall("""
                SELECT
                    id,
                    period,
                    start_time,
                    end_time
                FROM routines
                ORDER BY start_time
            """)

        routines = []
        for r in rows:
            routines.append({
                "id": r["id"],
                "period": r["period"],
                "start": r["start_time"],
                "end": r["end_time"]
            })

        return routines

    @staticmethod
    def create_routine(period, start_time, end_time):
        with Database() as db:
            db.execute("""
                INSERT INTO routines (period, start_time, end_time)
                VALUES (?, ?, ?)
            """, (period, start_time, end_time))

    @staticmethod
    def get_routine(routine_id):
        with Database() as db:
            row = db.fetchone("""
                SELECT
                    id,
                    period,
                    start_time,
                    end_time
                FROM routines
                WHERE id = ?
            """, (routine_id,))

        if not row:
            return None

        return {
            "id": row["id"],
            "period": row["period"],
            "start": row["start_time"],
            "end": row["end_time"]
        }

    # ---------------------------
    # BLOCOS DA ROTINA
    # ---------------------------

    @staticmethod
    def list_blocks(routine_id):
        with Database() as db:
            rows = db.fetchall("""
                SELECT
                    rb.id,
                    rb.activity_id,
                    rb.duration,
                    a.title,
                    rb.auto_fill_allowed
                FROM routine_blocks rb
                LEFT JOIN activities a ON a.id = rb.activity_id
                WHERE rb.routine_id = ?
                ORDER BY rb.id
            """, (routine_id,))

        blocks = []
        for r in rows:
            blocks.append({
                "id": r["id"],
                "activity_id": r["activity_id"],
                "title": r["title"] or "Bloco livre",
                "duration": r["duration"],
                "auto_fill_allowed": r["auto_fill_allowed"]
            })

        return blocks

    @staticmethod
    def add_block(routine_id, activity_id, duration, auto_fill_allowed=1):
        with Database() as db:
            db.execute("""
                INSERT INTO routine_blocks (routine_id, activity_id, duration, auto_fill_allowed)
                VALUES (?, ?, ?, ?)
            """, (routine_id, activity_id, duration, auto_fill_allowed))

    @staticmethod
    def autofill_blocks(routine_id, seed=None):
        """
        Preenche blocos vazios com atividades aleatórias baseadas no tempo estimado.
        """
        import random

        rng = random.Random(seed)

        with Database() as db:
            blocks = db.fetchall("""
                SELECT id, duration
                FROM routine_blocks
                WHERE routine_id = ?
                  AND activity_id IS NULL
                  AND auto_fill_allowed = 1
            """, (routine_id,))

            if not blocks:
                return []

            activities = db.fetchall("""
                SELECT id, title, estimated_time
                FROM activities
                WHERE active = 1
            """)

            if not activities:
                return []

            filled = []
            for block in blocks:
                duration = block["duration"]
                candidates = [
                    activity for activity in activities
                    if activity["estimated_time"] is None or activity["estimated_time"] <= duration
                ]
                if not candidates:
                    candidates = activities

                chosen = rng.choice(candidates)
                db.execute("""
                    UPDATE routine_blocks
                    SET activity_id = ?
                    WHERE id = ?
                """, (chosen["id"], block["id"]))

                filled.append({
                    "block_id": block["id"],
                    "activity_id": chosen["id"],
                    "activity_title": chosen["title"]
                })

            return filled
