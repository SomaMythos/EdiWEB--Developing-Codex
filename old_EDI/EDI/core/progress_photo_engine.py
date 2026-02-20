"""
Progress Photo Engine - Galeria de Progresso para Atividades Artísticas
"""

from data.database import Database
from datetime import date
import logging

logger = logging.getLogger(__name__)


class ProgressPhotoEngine:
    
    @staticmethod
    def add_photo(activity_id, photo_path, description=None, duration=None):
        """Adiciona foto de progresso"""
        try:
            with Database() as db:
                today = date.today().isoformat()
                db.execute("""
                    INSERT INTO progress_photos (activity_id, photo_path, description, duration, date)
                    VALUES (?, ?, ?, ?, ?)
                """, (activity_id, photo_path, description, duration, today))
                logger.info(f"Foto de progresso adicionada para atividade {activity_id}")
                return True
        except Exception as e:
            logger.error(f"Erro ao adicionar foto: {e}")
            return False
    
    @staticmethod
    def get_photos(activity_id):
        """Retorna todas as fotos de uma atividade"""
        with Database() as db:
            photos = db.fetchall("""
                SELECT * FROM progress_photos
                WHERE activity_id = ?
                ORDER BY date DESC, timestamp DESC
            """, (activity_id,))
            return photos
    
    @staticmethod
    def get_recent_photos(limit=20):
        """Retorna fotos recentes de todas as atividades"""
        with Database() as db:
            photos = db.fetchall("""
                SELECT pp.*, a.title as activity_title
                FROM progress_photos pp
                JOIN activities a ON a.id = pp.activity_id
                ORDER BY pp.date DESC, pp.timestamp DESC
                LIMIT ?
            """, (limit,))
            return photos
    
    @staticmethod
    def delete_photo(photo_id):
        """Remove foto"""
        try:
            with Database() as db:
                db.execute("DELETE FROM progress_photos WHERE id = ?", (photo_id,))
                return True
        except Exception as e:
            logger.error(f"Erro ao deletar foto: {e}")
            return False
