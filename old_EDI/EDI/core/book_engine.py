"""
Book Engine - Gerenciamento de Livros e Leitura
"""

from data.database import Database
from datetime import date
import logging

logger = logging.getLogger(__name__)


class BookEngine:

    BOOK_TYPE_LABELS = {
        "livro": "Livro",
        "hq": "HQ",
        "manga": "Manga",
    }
    
    # =========================
    # CRUD DE LIVROS
    # =========================
    
    @staticmethod
    def list_books(status=None):
        """
        Lista livros
        
        Args:
            status: Filtrar por status ('lendo', 'concluido', 'pausado')
        """
        with Database() as db:
            if status:
                books = db.fetchall("""
                    SELECT * FROM books
                    WHERE status = ?
                    ORDER BY 
                        CASE status
                            WHEN 'lendo' THEN 1
                            WHEN 'pausado' THEN 2
                            WHEN 'concluido' THEN 3
                        END,
                        title
                """, (status,))
            else:
                books = db.fetchall("""
                    SELECT * FROM books
                    ORDER BY 
                        CASE status
                            WHEN 'lendo' THEN 1
                            WHEN 'pausado' THEN 2
                            WHEN 'concluido' THEN 3
                        END,
                        title
                """)
            return books
    
    @staticmethod
    def get_book(book_id):
        """Retorna informações de um livro específico"""
        with Database() as db:
            book = db.fetchone("SELECT * FROM books WHERE id = ?", (book_id,))
            return book
    
    @staticmethod
    def add_book(title, total_pages=0, book_type="livro", genre=None, cover_image=None):
        """Adiciona novo livro"""
        try:
            with Database() as db:
                today = date.today().isoformat()
                db.execute("""
                    INSERT INTO books (title, book_type, total_pages, genre, cover_image, started_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (title, BookEngine.normalize_book_type(book_type), total_pages, genre, cover_image, today))
                logger.info(f"Livro adicionado: {title}")
                return True
        except Exception as e:
            logger.error(f"Erro ao adicionar livro: {e}")
            return False
    
    @staticmethod
    def update_book(book_id, **kwargs):
        """Atualiza informações do livro"""
        try:
            with Database() as db:
                updates = []
                params = []
                
                for key, value in kwargs.items():
                    if value is not None:
                        updates.append(f"{key} = ?")
                        params.append(value)
                
                if not updates:
                    return False
                
                params.append(book_id)
                
                db.execute(f"""
                    UPDATE books
                    SET {', '.join(updates)}
                    WHERE id = ?
                """, tuple(params))
                
                logger.info(f"Livro {book_id} atualizado")
                return True
        except Exception as e:
            logger.error(f"Erro ao atualizar livro: {e}")
            return False
    
    # =========================
    # SESSÕES DE LEITURA
    # =========================
    
    @staticmethod
    def add_reading_session(book_id, pages_read, duration=None, notes=None):
        """
        Registra sessão de leitura e atualiza progresso do livro
        """
        try:
            book = BookEngine.get_book(book_id)
            if not book:
                logger.error(f"Livro {book_id} não encontrado")
                return False
            
            with Database() as db:
                today = date.today().isoformat()
                
                # Calcular páginas
                start_page = book["current_page"] + 1
                end_page = book["current_page"] + pages_read
                
                # Registrar sessão
                db.execute("""
                    INSERT INTO reading_sessions 
                    (book_id, pages_read, start_page, end_page, duration, date, notes)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (book_id, pages_read, start_page, end_page, duration, today, notes))
                
                # Atualizar progresso do livro
                new_current_page = min(end_page, book["total_pages"])
                new_status = book["status"]
                finished_at = None
                
                # Se terminou o livro
                if new_current_page >= book["total_pages"]:
                    new_status = "concluido"
                    finished_at = today
                
                db.execute("""
                    UPDATE books
                    SET current_page = ?, status = ?, finished_at = ?
                    WHERE id = ?
                """, (new_current_page, new_status, finished_at, book_id))
                
                logger.info(f"Sessão de leitura registrada: {book['title']} - {pages_read} páginas")
                return True
                
        except Exception as e:
            logger.error(f"Erro ao registrar sessão de leitura: {e}")
            return False
    
    @staticmethod
    def get_progress_percentage(book_id):
        """Calcula percentual de progresso do livro"""
        book = BookEngine.get_book(book_id)
        if not book or book["total_pages"] == 0:
            return 0
        
        percentage = (book["current_page"] / book["total_pages"]) * 100
        return round(percentage, 1)

    @staticmethod
    def normalize_book_type(book_type):
        """Normaliza o tipo de livro para valores válidos"""
        if not book_type:
            return "livro"
        book_type = book_type.lower()
        if book_type in BookEngine.BOOK_TYPE_LABELS:
            return book_type
        return "livro"

    @staticmethod
    def get_book_type_label(book_type):
        """Retorna o rótulo do tipo de livro"""
        return BookEngine.BOOK_TYPE_LABELS.get(
            BookEngine.normalize_book_type(book_type),
            "Livro",
        )

    @staticmethod
    def get_reading_status_label(book):
        """Classifica o status de leitura do livro"""
        if not book:
            return "Novo"
        if book.get("status") == "concluido":
            return "Concluído"
        if (book.get("current_page") or 0) > 0:
            return "Iniciado"
        return "Novo"
    
    @staticmethod
    def get_reading_stats():
        """Retorna estatísticas gerais de leitura"""
        with Database() as db:
            books = db.fetchall("""
                SELECT id, status, current_page, book_type
                FROM books
            """)
            # Total de páginas lidas este mês
            pages_this_month = db.fetchone("""
                SELECT COALESCE(SUM(pages_read), 0) as total_pages
                FROM reading_sessions
                WHERE date >= date('now', 'start of month')
            """)

            status_counts = {"Novo": 0, "Iniciado": 0, "Concluído": 0}
            type_counts = {
                "Novo": {key: 0 for key in BookEngine.BOOK_TYPE_LABELS},
                "Iniciado": {key: 0 for key in BookEngine.BOOK_TYPE_LABELS},
                "Concluído": {key: 0 for key in BookEngine.BOOK_TYPE_LABELS},
            }

            for book in books:
                status_label = BookEngine.get_reading_status_label(book)
                type_key = BookEngine.normalize_book_type(book.get("book_type"))
                status_counts[status_label] += 1
                type_counts[status_label][type_key] += 1

            return {
                "total_books": len(books),
                "status_counts": status_counts,
                "type_counts": type_counts,
                "pages_this_month": pages_this_month["total_pages"]
            }
