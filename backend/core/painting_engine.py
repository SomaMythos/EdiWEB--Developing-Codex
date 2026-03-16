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

    @staticmethod
    def get_insights(visual_category=None):
        with Database() as db:
            artwork_where = ""
            artwork_params = []
            media_where = ""
            media_params = []
            completed_where = "WHERE p.finished_at IS NOT NULL"

            if visual_category:
                artwork_where = "WHERE p.visual_category = ?"
                artwork_params.append(visual_category)
                media_where = "WHERE mf.section_type = ?"
                media_params.append(visual_category)
                completed_where = "WHERE p.visual_category = ? AND p.finished_at IS NOT NULL"

            artwork_summary = db.fetchone(
                f"""
                SELECT
                    COUNT(*) AS total_artworks,
                    COALESCE(SUM(CASE WHEN LOWER(COALESCE(p.status, '')) IN ('concluido', 'concluído') THEN 1 ELSE 0 END), 0) AS completed_artworks,
                    COALESCE(SUM(CASE WHEN LOWER(COALESCE(p.status, '')) IN ('concluido', 'concluído') THEN 0 ELSE 1 END), 0) AS active_artworks,
                    COALESCE(SUM(CASE WHEN strftime('%Y-%m', p.finished_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END), 0) AS completions_this_month,
                    ROUND(COALESCE(AVG(COALESCE(progress_counts.progress_count, 0)), 0), 1) AS avg_updates_per_artwork
                FROM paintings p
                LEFT JOIN (
                    SELECT painting_id, COUNT(*) AS progress_count
                    FROM painting_progress
                    GROUP BY painting_id
                ) progress_counts ON progress_counts.painting_id = p.id
                {artwork_where}
                """,
                tuple(artwork_params),
            )

            update_summary = db.fetchone(
                f"""
                SELECT
                    COUNT(*) AS total_updates,
                    COALESCE(SUM(CASE WHEN strftime('%Y-%m', pp.timestamp) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END), 0) AS updates_this_month
                FROM painting_progress pp
                JOIN paintings p ON p.id = pp.painting_id
                {artwork_where}
                """,
                tuple(artwork_params),
            )

            folder_summary = db.fetchone(
                f"""
                SELECT COUNT(*) AS total_folders
                FROM media_folders mf
                {media_where}
                """,
                tuple(media_params),
            )

            media_summary = db.fetchone(
                f"""
                SELECT
                    COUNT(*) AS total_media_items,
                    COALESCE(SUM(CASE WHEN strftime('%Y-%m', mi.created_at) = strftime('%Y-%m', 'now', 'localtime') THEN 1 ELSE 0 END), 0) AS media_items_this_month
                FROM media_items mi
                JOIN media_folders mf ON mf.id = mi.folder_id
                {media_where}
                """,
                tuple(media_params),
            )

            artwork_summary = dict(artwork_summary or {})
            update_summary = dict(update_summary or {})
            folder_summary = dict(folder_summary or {})
            media_summary = dict(media_summary or {})

            return {
                "total_artworks": int(artwork_summary.get("total_artworks") or 0),
                "active_artworks": int(artwork_summary.get("active_artworks") or 0),
                "completed_artworks": int(artwork_summary.get("completed_artworks") or 0),
                "completions_this_month": int(artwork_summary.get("completions_this_month") or 0),
                "avg_updates_per_artwork": float(artwork_summary.get("avg_updates_per_artwork") or 0),
                "total_updates": int(update_summary.get("total_updates") or 0),
                "updates_this_month": int(update_summary.get("updates_this_month") or 0),
                "total_folders": int(folder_summary.get("total_folders") or 0),
                "total_media_items": int(media_summary.get("total_media_items") or 0),
                "media_items_this_month": int(media_summary.get("media_items_this_month") or 0),
            }

    @staticmethod
    def get_log(limit=40, visual_category=None):
        with Database() as db:
            artwork_filter = ""
            media_filter = ""
            completed_where = "WHERE p.finished_at IS NOT NULL"
            params = []

            if visual_category:
                artwork_filter = "WHERE p.visual_category = ?"
                media_filter = "WHERE mf.section_type = ?"
                completed_where = "WHERE p.visual_category = ? AND p.finished_at IS NOT NULL"
                params.extend([visual_category, visual_category, visual_category, visual_category, visual_category])

            rows = db.fetchall(
                f"""
                SELECT *
                FROM (
                    SELECT
                        'artwork_created' AS event_type,
                        p.id AS event_id,
                        p.title AS title,
                        p.created_at AS occurred_at,
                        p.size AS detail,
                        p.visual_category AS visual_category
                    FROM paintings p
                    {artwork_filter}

                    UNION ALL

                    SELECT
                        'artwork_update' AS event_type,
                        pp.id AS event_id,
                        p.title AS title,
                        pp.timestamp AS occurred_at,
                        COALESCE(pp.update_title, 'Atualização') AS detail,
                        p.visual_category AS visual_category
                    FROM painting_progress pp
                    JOIN paintings p ON p.id = pp.painting_id
                    {artwork_filter}

                    UNION ALL

                    SELECT
                        'artwork_completed' AS event_type,
                        p.id AS event_id,
                        p.title AS title,
                        p.finished_at AS occurred_at,
                        'Concluída' AS detail,
                        p.visual_category AS visual_category
                    FROM paintings p
                    {completed_where}

                    UNION ALL

                    SELECT
                        'media_folder' AS event_type,
                        mf.id AS event_id,
                        mf.name AS title,
                        mf.created_at AS occurred_at,
                        'Pasta criada' AS detail,
                        mf.section_type AS visual_category
                    FROM media_folders mf
                    {media_filter}

                    UNION ALL

                    SELECT
                        'media_item' AS event_type,
                        mi.id AS event_id,
                        mi.title AS title,
                        COALESCE(mi.created_at, mi.date) AS occurred_at,
                        mf.name AS detail,
                        mf.section_type AS visual_category
                    FROM media_items mi
                    JOIN media_folders mf ON mf.id = mi.folder_id
                    {media_filter}
                ) events
                WHERE occurred_at IS NOT NULL
                ORDER BY datetime(occurred_at) DESC
                LIMIT ?
                """,
                tuple([*params, limit]),
            )
            return rows
