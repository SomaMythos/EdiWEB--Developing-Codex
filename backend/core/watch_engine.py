from data.database import Database

class WatchEngine:

    @staticmethod
    def create_category(name):
        with Database() as db:
            db.execute("""
                INSERT INTO watch_categories (name)
                VALUES (?)
            """, (name.strip(),))
            return db.lastrowid

    @staticmethod
    def list_categories():
        with Database() as db:
            rows = db.fetchall("""
                SELECT id, name
                FROM watch_categories
                ORDER BY name COLLATE NOCASE ASC
            """)
        return [dict(r) for r in rows]

    @staticmethod
    def create_item(category_id, name, image_path=None):
        with Database() as db:
            db.execute("""
                INSERT INTO watch_items (category_id, name, image_path)
                VALUES (?, ?, ?)
            """, (category_id, name.strip(), image_path))
            return db.lastrowid

    @staticmethod
    def mark_watched(item_id):
        with Database() as db:
            db.execute("""
                UPDATE watch_items
                SET watched_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (item_id,))

    @staticmethod
    def list_items(category_id):
        with Database() as db:
            rows = db.fetchall("""
                SELECT id, name, image_path, watched_at
                FROM watch_items
                WHERE category_id = ?
                ORDER BY created_at DESC
            """, (category_id,))
        return [dict(r) for r in rows]