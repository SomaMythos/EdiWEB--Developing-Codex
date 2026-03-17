import json

from data.database import Database


class MusicEngine:
    @staticmethod
    def _normalize_training_row(row):
        training = dict(row)
        training["content_type"] = training.get("content_type") or "image"
        training["image_path"] = training.get("image_path") or None
        training["target_bpm"] = int(training.get("target_bpm") or 0) if training.get("target_bpm") else None
        tuning_raw = training.get("tuning")
        if isinstance(tuning_raw, str) and tuning_raw.strip():
            try:
                training["tuning"] = json.loads(tuning_raw)
            except json.JSONDecodeError:
                training["tuning"] = [value.strip() for value in tuning_raw.split("|") if value.strip()]
        else:
            training["tuning"] = []

        exercise_raw = training.get("exercise_data")
        if isinstance(exercise_raw, str) and exercise_raw.strip():
            try:
                training["exercise_data"] = json.loads(exercise_raw)
            except json.JSONDecodeError:
                training["exercise_data"] = None
        else:
            training["exercise_data"] = None
        return training

    # =============================
    # TRAINING
    # =============================

    @staticmethod
    def create_training(name, instrument, image_path, content_type="image", exercise_data=None, target_bpm=None, tuning=None):
        with Database() as db:
            db.execute("""
                INSERT INTO music_training_tabs (name, instrument, image_path, content_type, exercise_data, target_bpm, tuning)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                name.strip(),
                instrument.strip().lower(),
                image_path or "",
                content_type or "image",
                json.dumps(exercise_data) if exercise_data is not None else None,
                target_bpm,
                json.dumps(tuning) if tuning is not None else None,
            ))
            return db.lastrowid

    @staticmethod
    def update_training_exercise(training_id, name, instrument, exercise_data=None, target_bpm=None, tuning=None):
        with Database() as db:
            db.execute(
                """
                UPDATE music_training_tabs
                SET name = ?, instrument = ?, content_type = 'exercise', exercise_data = ?, target_bpm = ?, tuning = ?
                WHERE id = ?
                """,
                (
                    name.strip(),
                    instrument.strip().lower(),
                    json.dumps(exercise_data) if exercise_data is not None else None,
                    target_bpm,
                    json.dumps(tuning) if tuning is not None else None,
                    training_id,
                ),
            )

    @staticmethod
    def get_training(training_id):
        with Database() as db:
            row = db.fetchone(
                """
                SELECT
                    t.id,
                    t.name,
                    t.instrument,
                    t.image_path,
                    t.content_type,
                    t.exercise_data,
                    t.target_bpm,
                    t.tuning,
                    t.created_at,
                    (
                        SELECT bpm
                        FROM music_training_sessions s
                        WHERE s.training_id = t.id
                        ORDER BY s.created_at DESC
                        LIMIT 1
                    ) as last_bpm
                FROM music_training_tabs t
                WHERE t.id = ?
                """,
                (training_id,),
            )
        return MusicEngine._normalize_training_row(row) if row else None

    @staticmethod
    def list_trainings():
        with Database() as db:
            rows = db.fetchall("""
                SELECT 
                    t.id,
                    t.name,
                    t.instrument,
                    t.image_path,
                    t.content_type,
                    t.exercise_data,
                    t.target_bpm,
                    t.tuning,
                    t.created_at,
                    (
                        SELECT bpm
                        FROM music_training_sessions s
                        WHERE s.training_id = t.id
                        ORDER BY s.created_at DESC
                        LIMIT 1
                    ) as last_bpm
                FROM music_training_tabs t
                ORDER BY t.created_at DESC
            """)
            return [MusicEngine._normalize_training_row(r) for r in rows]

    @staticmethod
    def add_training_session(training_id, bpm):
        with Database() as db:
            db.execute("""
                INSERT INTO music_training_sessions (training_id, bpm)
                VALUES (?, ?)
            """, (training_id, bpm))

    @staticmethod
    def get_training_history(training_id):
        with Database() as db:
            rows = db.fetchall("""
                SELECT bpm, created_at
                FROM music_training_sessions
                WHERE training_id = ?
                ORDER BY created_at ASC
            """, (training_id,))
            return [dict(r) for r in rows]

    # =============================
    # LISTENING
    # =============================

    @staticmethod
    def create_artist(name, image_path=None):
        with Database() as db:
            db.execute("""
                INSERT INTO music_artists (name, image_path)
                VALUES (?, ?)
            """, (name.strip(), image_path))
            return db.lastrowid

    @staticmethod
    def list_artists_grouped():
        with Database() as db:
            rows = db.fetchall("""
                SELECT id, name, image_path
                FROM music_artists
                ORDER BY name COLLATE NOCASE ASC
            """)

        grouped = {}
        for r in rows:
            first_letter = r["name"][0].upper()
            grouped.setdefault(first_letter, []).append(dict(r))

        return grouped

    @staticmethod
    def create_album(artist_id, name, image_path=None, status="planned"):
        with Database() as db:
            db.execute("""
                INSERT INTO music_albums (artist_id, name, image_path, status)
                VALUES (?, ?, ?, ?)
            """, (artist_id, name.strip(), image_path, status))
            return db.lastrowid

    @staticmethod
    def confirm_album(album_id):
        with Database() as db:
            db.execute("""
                UPDATE music_albums
                SET status = 'listened'
                WHERE id = ?
            """, (album_id,))

    @staticmethod
    def list_albums(status=None):
        with Database() as db:
            if status:
                rows = db.fetchall("""
                    SELECT a.id, a.name, a.image_path, a.status, ar.name as artist
                    FROM music_albums a
                    JOIN music_artists ar ON ar.id = a.artist_id
                    WHERE a.status = ?
                    ORDER BY ar.name ASC
                """, (status,))
            else:
                rows = db.fetchall("""
                    SELECT a.id, a.name, a.image_path, a.status, ar.name as artist
                    FROM music_albums a
                    JOIN music_artists ar ON ar.id = a.artist_id
                    ORDER BY ar.name ASC
                """)

        return [dict(r) for r in rows]
