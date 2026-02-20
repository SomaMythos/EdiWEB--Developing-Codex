from datetime import datetime
from data.database import Database


class PaintingEngine:
    @staticmethod
    def create_artwork(title, size=None, started_at=None, reference_image_path=None, visual_category="pintura"):
        with Database() as db:
            db.execute(
                """
                INSERT INTO paintings (title, size, started_at, reference_image_path, visual_category, category)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (title, size, started_at or datetime.now().isoformat(), reference_image_path, visual_category, visual_category),
            )
            return db.lastrowid

    @staticmethod
    def delete_artwork(painting_id):
        with Database() as db:
            # Primeiro remove o progresso vinculado
            db.execute(
                "DELETE FROM painting_progress WHERE painting_id = ?",
                (painting_id,),
            )

            # Depois remove a pintura
            cursor = db.execute(
                "DELETE FROM paintings WHERE id = ?",
                (painting_id,),
            )

            return cursor.rowcount > 0

    @staticmethod
    def add_artwork_update(painting_id, update_title, photo_path, mark_completed=False):
        with Database() as db:
            db.execute(
                """
                INSERT INTO painting_progress (painting_id, update_title, photo_path, timestamp)
                VALUES (?, ?, ?, ?)
                """,
                (painting_id, update_title, photo_path, datetime.now().isoformat()),
            )
            progress_id = db.lastrowid
            if mark_completed:
                db.execute(
                    "UPDATE paintings SET status = 'concluído', finished_at = ? WHERE id = ?",
                    (datetime.now().isoformat(), painting_id),
                )
            return progress_id

    @staticmethod
    def set_artwork_completed_date(painting_id, finished_at):
        with Database() as db:
            status = 'concluído' if finished_at else 'em_progresso'
            cursor = db.execute(
                "UPDATE paintings SET status = ?, finished_at = ? WHERE id = ?",
                (status, finished_at, painting_id),
            )
            return cursor.rowcount > 0

    @staticmethod
    def get_artwork_gallery(painting_id):
        with Database() as db:
            return db.fetchall(
                """
                SELECT id, update_title, photo_path, notes, timestamp
                FROM painting_progress
                WHERE painting_id = ?
                ORDER BY timestamp ASC
                """,
                (painting_id,),
            )

    @staticmethod
    def list_artworks(status=None, visual_category=None):
        with Database() as db:
            query = """
                SELECT
                    p.*, 
                    COUNT(pp.id) as photos_count,
                    (
                        SELECT COALESCE(json_group_array(progress.photo_path), '[]')
                        FROM (
                            SELECT pp_ordered.photo_path
                            FROM painting_progress pp_ordered
                            WHERE pp_ordered.painting_id = p.id
                              AND pp_ordered.photo_path IS NOT NULL
                            ORDER BY pp_ordered.timestamp ASC, pp_ordered.id ASC
                        ) progress
                    ) as progress_photo_paths,
                    (
                        SELECT pp_latest.photo_path
                        FROM painting_progress pp_latest
                        WHERE pp_latest.painting_id = p.id
                        ORDER BY pp_latest.timestamp DESC, pp_latest.id DESC
                        LIMIT 1
                    ) as latest_photo_path
                FROM paintings p
                LEFT JOIN painting_progress pp ON pp.painting_id = p.id
            """
            conditions = []
            params = []

            if status:
                conditions.append("p.status = ?")
                params.append(status)

            if visual_category:
                conditions.append("p.visual_category = ?")
                params.append(visual_category)

            if conditions:
                query += " WHERE " + " AND ".join(conditions)

            query += " GROUP BY p.id ORDER BY p.created_at DESC"
            return db.fetchall(query, tuple(params))

    @staticmethod
    def create_media_folder(section_type, name):
        with Database() as db:
            db.execute(
                "INSERT INTO media_folders (section_type, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (section_type, name, datetime.now().isoformat(), datetime.now().isoformat()),
            )
            return db.lastrowid

    @staticmethod
    def list_media_folders(section_type=None):
        with Database() as db:
            if section_type:
                return db.fetchall(
                    "SELECT * FROM media_folders WHERE section_type = ? ORDER BY updated_at DESC",
                    (section_type,),
                )
            return db.fetchall("SELECT * FROM media_folders ORDER BY updated_at DESC")

    @staticmethod
    def update_media_folder(folder_id, name):
        with Database() as db:
            cursor = db.execute(
                "UPDATE media_folders SET name = ?, updated_at = ? WHERE id = ?",
                (name, datetime.now().isoformat(), folder_id),
            )
            return cursor.rowcount > 0

    @staticmethod
    def delete_media_folder(folder_id):
        with Database() as db:
            cursor = db.execute("DELETE FROM media_folders WHERE id = ?", (folder_id,))
            return cursor.rowcount > 0

    @staticmethod
    def create_media_item(folder_id, title, file_path, date=None):
        with Database() as db:
            db.execute(
                "INSERT INTO media_items (folder_id, title, date, file_path, created_at) VALUES (?, ?, ?, ?, ?)",
                (folder_id, title, date, file_path, datetime.now().isoformat()),
            )
            item_id = db.lastrowid
            db.execute(
                "UPDATE media_folders SET updated_at = ? WHERE id = ?",
                (datetime.now().isoformat(), folder_id),
            )
            return item_id

    @staticmethod
    def list_media_items(folder_id):
        with Database() as db:
            return db.fetchall(
                "SELECT * FROM media_items WHERE folder_id = ? ORDER BY created_at DESC",
                (folder_id,),
            )

    @staticmethod
    def delete_media_item(item_id):
        with Database() as db:
            cursor = db.execute("DELETE FROM media_items WHERE id = ?", (item_id,))
            return cursor.rowcount > 0
