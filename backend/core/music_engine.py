from data.database import Database


class MusicEngine:

    # =============================
    # TRAINING
    # =============================

    @staticmethod
    def create_training(name, instrument, image_path):
        with Database() as db:
            db.execute("""
                INSERT INTO music_training_tabs (name, instrument, image_path)
                VALUES (?, ?, ?)
            """, (name.strip(), instrument.strip().lower(), image_path))
            return db.lastrowid

    @staticmethod
    def list_trainings():
        with Database() as db:
            rows = db.fetchall("""
                SELECT 
                    t.id,
                    t.name,
                    t.instrument,
                    t.image_path,
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
            return [dict(r) for r in rows]

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
    def create_artist(name):
        with Database() as db:
            db.execute("""
                INSERT INTO music_artists (name)
                VALUES (?)
            """, (name.strip(),))

    @staticmethod
    def list_artists_grouped():
        with Database() as db:
            rows = db.fetchall("""
                SELECT id, name
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