from datetime import date

from data.database import Database


class ProgressPhotoEngine:
    @staticmethod
    def add_photo(activity_id, photo_path, description=None, duration=None):
        with Database() as db:
            db.execute(
                """
                INSERT INTO progress_photos (activity_id, photo_path, description, duration, date)
                VALUES (?, ?, ?, ?, ?)
                """,
                (activity_id, photo_path, description, duration, date.today().isoformat()),
            )
            return db.lastrowid

    @staticmethod
    def get_photos(activity_id):
        with Database() as db:
            return db.fetchall(
                "SELECT * FROM progress_photos WHERE activity_id = ? ORDER BY date DESC, timestamp DESC",
                (activity_id,),
            )
