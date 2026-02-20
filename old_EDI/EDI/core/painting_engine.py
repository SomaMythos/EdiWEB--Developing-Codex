"""
Painting Engine - Gerenciamento de Pinturas
Controla obras de arte, progresso com fotos e tempo gasto
"""

from data.database import Database
from datetime import datetime
import logging
import os

logger = logging.getLogger(__name__)


class PaintingEngine:
    
    # =========================
    # CRUD PINTURAS
    # =========================
    
    @staticmethod
    def create_painting(title, size=None, description=None, estimated_time=None):
        """
        Cria nova pintura
        
        Args:
            title: Título da obra
            size: Tamanho da obra (opcional)
            description: Descrição (opcional)
            estimated_time: Tempo estimado em minutos (opcional)
        
        Returns:
            ID da pintura criada
        """
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO paintings (title, size, description, estimated_time, started_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (title, size, description, estimated_time, datetime.now().isoformat()))
                
                painting_id = db.lastrowid
                logger.info(f"Pintura criada: {title} (ID: {painting_id})")
                return painting_id
        except Exception as e:
            logger.error(f"Erro ao criar pintura: {e}")
            raise
    
    @staticmethod
    def list_paintings(status=None):
        """
        Lista pinturas
        
        Args:
            status: Filtrar por status (opcional)
        
        Returns:
            Lista de pinturas com progresso
        """
        try:
            with Database() as db:
                if status:
                    query = """
                        SELECT p.*, 
                               COUNT(pp.id) as photos_count,
                               MAX(pp.timestamp) as last_update
                        FROM paintings p
                        LEFT JOIN painting_progress pp ON pp.painting_id = p.id
                        WHERE p.status = ?
                        GROUP BY p.id
                        ORDER BY p.created_at DESC
                    """
                    return db.fetchall(query, (status,))
                else:
                    query = """
                        SELECT p.*, 
                               COUNT(pp.id) as photos_count,
                               MAX(pp.timestamp) as last_update
                        FROM paintings p
                        LEFT JOIN painting_progress pp ON pp.painting_id = p.id
                        GROUP BY p.id
                        ORDER BY p.created_at DESC
                    """
                    return db.fetchall(query)
        except Exception as e:
            logger.error(f"Erro ao listar pinturas: {e}")
            return []
    
    @staticmethod
    def get_painting(painting_id):
        """Obtém dados de uma pintura"""
        try:
            with Database() as db:
                return db.fetchone("SELECT * FROM paintings WHERE id = ?", (painting_id,))
        except Exception as e:
            logger.error(f"Erro ao buscar pintura: {e}")
            return None
    
    @staticmethod
    def update_painting(painting_id, **kwargs):
        """Atualiza dados da pintura"""
        try:
            if not kwargs:
                return
            
            fields = ", ".join([f"{k} = ?" for k in kwargs.keys()])
            values = list(kwargs.values()) + [painting_id]
            
            with Database() as db:
                db.execute(f"UPDATE paintings SET {fields} WHERE id = ?", values)
                logger.info(f"Pintura {painting_id} atualizada")
        except Exception as e:
            logger.error(f"Erro ao atualizar pintura: {e}")
            raise
    
    @staticmethod
    def delete_painting(painting_id):
        """Remove uma pintura e seus registros de progresso"""
        try:
            with Database() as db:
                db.execute("DELETE FROM paintings WHERE id = ?", (painting_id,))
                logger.info(f"Pintura {painting_id} removida")
        except Exception as e:
            logger.error(f"Erro ao deletar pintura: {e}")
            raise
    
    # =========================
    # REGISTRO DE PROGRESSO
    # =========================
    
    @staticmethod
    def register_progress(painting_id, photo_path, time_spent, notes=None):
        """
        Registra progresso da pintura com foto
        
        Args:
            painting_id: ID da pintura
            photo_path: Caminho para foto do progresso
            time_spent: Tempo gasto nesta sessão (minutos)
            notes: Anotações (opcional)
        
        Returns:
            ID do registro de progresso
        """
        try:
            with Database() as db:
                # Registrar progresso
                db.execute("""
                    INSERT INTO painting_progress (
                        painting_id, photo_path, time_spent, notes, timestamp
                    )
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    painting_id,
                    photo_path,
                    time_spent,
                    notes,
                    datetime.now().isoformat(),
                ))
                
                progress_id = db.lastrowid
                
                # Atualizar tempo total da pintura
                db.execute("""
                    UPDATE paintings
                    SET time_spent = time_spent + ?
                    WHERE id = ?
                """, (time_spent, painting_id))
                
                logger.info(f"Progresso registrado para pintura {painting_id}: {time_spent} minutos")
                return progress_id
        except Exception as e:
            logger.error(f"Erro ao registrar progresso: {e}")
            raise
    
    @staticmethod
    def complete_painting(painting_id):
        """Marca pintura como concluída"""
        try:
            with Database() as db:
                db.execute("""
                    UPDATE paintings
                    SET status = 'concluído', finished_at = ?
                    WHERE id = ?
                """, (datetime.now().isoformat(), painting_id))
                logger.info(f"Pintura {painting_id} concluída!")
        except Exception as e:
            logger.error(f"Erro ao concluir pintura: {e}")
            raise
    
    # =========================
    # PROGRESSO E ESTATÍSTICAS
    # =========================
    
    @staticmethod
    def get_progress(painting_id):
        """
        Calcula progresso da pintura
        
        Returns:
            Dicionário com dados de progresso
        """
        try:
            with Database() as db:
                painting = db.fetchone("""
                    SELECT * FROM paintings WHERE id = ?
                """, (painting_id,))
                
                if not painting:
                    return None
                
                # Contar fotos de progresso
                photos_count = db.fetchone("""
                    SELECT COUNT(*) as count
                    FROM painting_progress
                    WHERE painting_id = ?
                """, (painting_id,))
                
                # Calcular percentual baseado em tempo
                percentage = 0
                if painting["estimated_time"] and painting["estimated_time"] > 0:
                    percentage = int((painting["time_spent"] / painting["estimated_time"]) * 100)
                    percentage = min(percentage, 100)  # Máximo 100%
                
                # Tempo restante estimado
                time_remaining = None
                if painting["estimated_time"]:
                    time_remaining = max(0, painting["estimated_time"] - painting["time_spent"])
                
                return {
                    "painting_id": painting_id,
                    "title": painting["title"],
                    "time_spent": painting["time_spent"],
                    "estimated_time": painting["estimated_time"],
                    "percentage": percentage,
                    "time_remaining": time_remaining,
                    "photos_count": photos_count["count"] if photos_count else 0,
                    "status": painting["status"],
                    "started_at": painting["started_at"]
                }
        except Exception as e:
            logger.error(f"Erro ao calcular progresso: {e}")
            return None
    
    @staticmethod
    def get_progress_history(painting_id):
        """
        Obtém histórico de progresso com fotos
        
        Returns:
            Lista de registros de progresso
        """
        try:
            with Database() as db:
                return db.fetchall("""
                    SELECT * FROM painting_progress
                    WHERE painting_id = ?
                    ORDER BY timestamp DESC
                """, (painting_id,))
        except Exception as e:
            logger.error(f"Erro ao buscar histórico: {e}")
            return []

    @staticmethod
    def list_progress_entries(painting_id):
        """
        Lista progresso com data e caminho da foto.

        Returns:
            Lista de registros de progresso com timestamp e photo_path
        """
        try:
            with Database() as db:
                return db.fetchall("""
                    SELECT id, photo_path, time_spent, notes, timestamp
                    FROM painting_progress
                    WHERE painting_id = ?
                    ORDER BY timestamp DESC
                """, (painting_id,))
        except Exception as e:
            logger.error(f"Erro ao listar progressos: {e}")
            return []
    
    @staticmethod
    def get_stats():
        """Estatísticas gerais de pinturas"""
        try:
            with Database() as db:
                stats = {
                    "total_paintings": 0,
                    "in_progress": 0,
                    "completed": 0,
                    "paused": 0,
                    "total_time_spent": 0,
                    "total_photos": 0,
                    "avg_time_per_painting": 0
                }
                
                # Contar por status
                counts = db.fetchall("""
                    SELECT status, COUNT(*) as count, SUM(time_spent) as total_time
                    FROM paintings
                    GROUP BY status
                """)
                
                total_time = 0
                for row in counts:
                    stats["total_paintings"] += row["count"]
                    if row["total_time"]:
                        total_time += row["total_time"]
                    
                    if row["status"] == "em_progresso":
                        stats["in_progress"] = row["count"]
                    elif row["status"] == "concluído":
                        stats["completed"] = row["count"]
                    elif row["status"] == "pausado":
                        stats["paused"] = row["count"]
                
                stats["total_time_spent"] = total_time
                
                # Média de tempo por pintura
                if stats["total_paintings"] > 0:
                    stats["avg_time_per_painting"] = round(total_time / stats["total_paintings"], 1)
                
                # Total de fotos
                photos = db.fetchone("SELECT COUNT(*) as count FROM painting_progress")
                if photos:
                    stats["total_photos"] = photos["count"]
                
                return stats
        except Exception as e:
            logger.error(f"Erro ao calcular estatísticas: {e}")
            return {}
    
    @staticmethod
    def get_latest_photo(painting_id):
        """Obtém a foto mais recente de uma pintura"""
        try:
            with Database() as db:
                return db.fetchone("""
                    SELECT photo_path, timestamp
                    FROM painting_progress
                    WHERE painting_id = ?
                    ORDER BY timestamp DESC
                    LIMIT 1
                """, (painting_id,))
        except Exception as e:
            logger.error(f"Erro ao buscar última foto: {e}")
            return None
