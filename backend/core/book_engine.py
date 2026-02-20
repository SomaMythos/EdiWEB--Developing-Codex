from datetime import datetime
from data.database import Database


class BookEngine:
    @staticmethod
    def list_book_types():
        with Database() as db:
            return db.fetchall("SELECT id, name, created_at FROM book_types ORDER BY name")

    @staticmethod
    def create_book_type(name):
        normalized = (name or "").strip()
        if not normalized:
            return None

        with Database() as db:
            existing = db.fetchone("SELECT id FROM book_types WHERE name = ?", (normalized,))
            if existing:
                return existing["id"]

            db.execute("INSERT INTO book_types (name) VALUES (?)", (normalized,))
            return db.lastrowid

    @staticmethod
    def update_book_type(type_id, name):
        normalized = (name or "").strip()
        if not normalized:
            return False

        with Database() as db:
            db.execute("UPDATE book_types SET name = ? WHERE id = ?", (normalized, type_id))
            return True

    @staticmethod
    def delete_book_type(type_id):
        with Database() as db:
            db.execute("UPDATE books SET book_type_id = NULL WHERE book_type_id = ?", (type_id,))
            db.execute("DELETE FROM book_types WHERE id = ?", (type_id,))
            return True

    @staticmethod
    def list_books(status=None):
        query = """
            SELECT
                b.*,
                COALESCE(bt.name, b.book_type, 'Livro') AS book_type_name
            FROM books b
            LEFT JOIN book_types bt ON bt.id = b.book_type_id
        """
        params = ()
        if status:
            query += " WHERE b.status = ?"
            params = (status,)
        query += " ORDER BY COALESCE(bt.name, b.book_type, 'Livro'), b.title"

        with Database() as db:
            return db.fetchall(query, params)

    @staticmethod
    def add_book(title, total_pages=0, book_type="Livro", genre=None, cover_image=None):
        type_id = BookEngine.create_book_type(book_type or "Livro")

        with Database() as db:
            db.execute(
                """
                INSERT INTO books (title, book_type, book_type_id, total_pages, genre, cover_image, started_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    title,
                    (book_type or "Livro").strip(),
                    type_id,
                    total_pages,
                    genre,
                    cover_image,
                    datetime.now().isoformat(timespec="seconds"),
                ),
            )
            return db.lastrowid

    # 🔥 MÉTODO NOVO – DELETE DEFINITIVO
    @staticmethod
    def delete_book(book_id):
        with Database() as db:
            book = db.fetchone("SELECT id FROM books WHERE id = ?", (book_id,))
            if not book:
                return False

            # Remove sessões primeiro (integridade)
            db.execute("DELETE FROM reading_sessions WHERE book_id = ?", (book_id,))
            db.execute("DELETE FROM books WHERE id = ?", (book_id,))
            return True

    @staticmethod
    def add_reading_session(book_id, pages_read, duration=None, notes=None, read_at=None):
        with Database() as db:
            book = db.fetchone("SELECT * FROM books WHERE id = ?", (book_id,))
            if not book:
                return False

            now = read_at or datetime.now().isoformat(timespec="seconds")
            current_page = book["current_page"] or 0
            total_pages = book["total_pages"] or 0
            pages_read = max(0, pages_read)
            start_page = current_page + 1 if pages_read > 0 else current_page
            end_page = current_page + pages_read

            db.execute(
                """
                INSERT INTO reading_sessions (book_id, pages_read, start_page, end_page, duration, read_at, date, notes)
                VALUES (?, ?, ?, ?, ?, ?, date(?), ?)
                """,
                (book_id, pages_read, start_page, end_page, duration, now, now, notes),
            )

            new_current = min(end_page, total_pages or end_page)
            status = "concluido" if (total_pages and new_current >= total_pages) else (book["status"] or "lendo")
            finished_at = now if status == "concluido" else None
            db.execute(
                "UPDATE books SET current_page = ?, status = ?, finished_at = COALESCE(?, finished_at) WHERE id = ?",
                (new_current, status, finished_at, book_id),
            )
        return True

    @staticmethod
    def get_reading_log(limit=200):
        with Database() as db:
            return db.fetchall(
                """
                SELECT
                    rs.id,
                    rs.book_id,
                    b.title,
                    COALESCE(bt.name, b.book_type, 'Livro') AS book_type,
                    rs.pages_read,
                    rs.start_page,
                    rs.end_page,
                    rs.duration,
                    COALESCE(rs.read_at, rs.date || 'T00:00:00') AS read_at,
                    rs.notes
                FROM reading_sessions rs
                JOIN books b ON b.id = rs.book_id
                LEFT JOIN book_types bt ON bt.id = b.book_type_id
                ORDER BY datetime(COALESCE(rs.read_at, rs.date || 'T00:00:00')) DESC
                LIMIT ?
                """,
                (limit,),
            )

    @staticmethod
    def get_stats_by_type(month=None, year=None):
        now = datetime.now()
        target_month = month or now.month
        target_year = year or now.year

        with Database() as db:
            monthly = db.fetchall(
                """
                SELECT
                    COALESCE(bt.name, b.book_type, 'Livro') AS book_type,
                    COALESCE(SUM(rs.pages_read), 0) AS total_pages
                FROM reading_sessions rs
                JOIN books b ON b.id = rs.book_id
                LEFT JOIN book_types bt ON bt.id = b.book_type_id
                WHERE strftime('%Y', COALESCE(rs.read_at, rs.date)) = ?
                  AND strftime('%m', COALESCE(rs.read_at, rs.date)) = ?
                GROUP BY COALESCE(bt.name, b.book_type, 'Livro')
                ORDER BY total_pages DESC
                """,
                (str(target_year), f"{target_month:02d}"),
            )

            yearly = db.fetchall(
                """
                SELECT
                    COALESCE(bt.name, b.book_type, 'Livro') AS book_type,
                    COALESCE(SUM(rs.pages_read), 0) AS total_pages
                FROM reading_sessions rs
                JOIN books b ON b.id = rs.book_id
                LEFT JOIN book_types bt ON bt.id = b.book_type_id
                WHERE strftime('%Y', COALESCE(rs.read_at, rs.date)) = ?
                GROUP BY COALESCE(bt.name, b.book_type, 'Livro')
                ORDER BY total_pages DESC
                """,
                (str(target_year),),
            )

            daily_avg = db.fetchall(
                """
                WITH type_day AS (
                    SELECT
                        COALESCE(bt.name, b.book_type, 'Livro') AS book_type,
                        date(COALESCE(rs.read_at, rs.date)) AS reading_day,
                        SUM(rs.pages_read) AS day_pages
                    FROM reading_sessions rs
                    JOIN books b ON b.id = rs.book_id
                    LEFT JOIN book_types bt ON bt.id = b.book_type_id
                    WHERE strftime('%Y', COALESCE(rs.read_at, rs.date)) = ?
                      AND strftime('%m', COALESCE(rs.read_at, rs.date)) = ?
                    GROUP BY COALESCE(bt.name, b.book_type, 'Livro'), date(COALESCE(rs.read_at, rs.date))
                )
                SELECT
                    book_type,
                    ROUND(AVG(day_pages), 2) AS avg_pages_per_day,
                    COUNT(*) AS active_days
                FROM type_day
                GROUP BY book_type
                ORDER BY avg_pages_per_day DESC
                """,
                (str(target_year), f"{target_month:02d}"),
            )

        return {
            "month": target_month,
            "year": target_year,
            "monthly": monthly,
            "yearly": yearly,
            "daily_average": daily_avg,
        }

    @staticmethod
    def get_reading_stats():
        with Database() as db:
            books = db.fetchall("SELECT id, status, current_page FROM books")
            pages_this_month = db.fetchone(
                """
                SELECT COALESCE(SUM(pages_read), 0) as total_pages
                FROM reading_sessions
                WHERE date(COALESCE(read_at, date)) >= date('now', 'start of month')
                """
            )

        status_counts = {"Novo": 0, "Iniciado": 0, "Concluído": 0}
        for book in books:
            if book["status"] == "concluido":
                status_counts["Concluído"] += 1
            elif (book["current_page"] or 0) > 0:
                status_counts["Iniciado"] += 1
            else:
                status_counts["Novo"] += 1

        return {
            "total_books": len(books),
            "status_counts": status_counts,
            "pages_this_month": pages_this_month["total_pages"] if pages_this_month else 0,
        }
