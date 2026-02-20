"""Gamification Engine - Sistema de Pontos e Conquistas"""
from data.database import Database
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class GamificationEngine:
    
    # Regras de pontuação
    POINTS = {
        "activity_completed": 10,
        "goal_completed": 100,
        "habit_streak_7": 50,
        "habit_streak_30": 200,
        "book_finished": 150,
        "painting_finished": 100,
        "daily_log_complete": 20
    }
    
    @staticmethod
    def award_points(user_id, points, reason, reference_type=None, reference_id=None):
        """Concede pontos ao usuário"""
        try:
            with Database() as db:
                # Registrar pontos
                db.execute("""
                    INSERT INTO point_history (user_id, points, reason, reference_type, reference_id)
                    VALUES (?, ?, ?, ?, ?)
                """, (user_id, points, reason, reference_type, reference_id))
                
                # Atualizar total
                db.execute("""
                    UPDATE user_points
                    SET points = points + ?, total_points = total_points + ?
                    WHERE user_id = ?
                """, (points, points, user_id))
                
                # Verificar level up
                GamificationEngine._check_level_up(user_id)
                
                logger.info(f"Usuário {user_id} ganhou {points} pontos: {reason}")
        except Exception as e:
            logger.error(f"Erro ao conceder pontos: {e}")
    
    @staticmethod
    def _check_level_up(user_id):
        """Verifica se usuário subiu de nível"""
        try:
            with Database() as db:
                user_points = db.fetchone("""
                    SELECT points, level FROM user_points WHERE user_id = ?
                """, (user_id,))
                
                if not user_points:
                    return
                
                # 1000 pontos por nível
                new_level = (user_points["total_points"] // 1000) + 1
                
                if new_level > user_points["level"]:
                    db.execute("""
                        UPDATE user_points SET level = ? WHERE user_id = ?
                    """, (new_level, user_id))
                    logger.info(f"Usuário {user_id} subiu para nível {new_level}!")
        except Exception as e:
            logger.error(f"Erro ao verificar level up: {e}")
    
    @staticmethod
    def unlock_achievement(user_id, achievement_id):
        """Desbloqueia conquista"""
        try:
            with Database() as db:
                achievement = db.fetchone("""
                    SELECT * FROM achievements WHERE id = ?
                """, (achievement_id,))
                
                if not achievement or achievement["unlocked"]:
                    return
                
                # Desbloquear
                db.execute("""
                    UPDATE achievements
                    SET unlocked = 1, unlocked_at = ?
                    WHERE id = ?
                """, (datetime.now().isoformat(), achievement_id))
                
                # Conceder pontos
                GamificationEngine.award_points(
                    user_id,
                    achievement["points"],
                    f"Conquista: {achievement['title']}",
                    "achievement",
                    achievement_id
                )
                
                logger.info(f"Conquista desbloqueada: {achievement['title']}")
        except Exception as e:
            logger.error(f"Erro ao desbloquear conquista: {e}")
    
    @staticmethod
    def get_user_stats(user_id):
        """Estatísticas de gamificação do usuário"""
        try:
            with Database() as db:
                points_data = db.fetchone("""
                    SELECT * FROM user_points WHERE user_id = ?
                """, (user_id,))
                
                achievements = db.fetchall("""
                    SELECT * FROM achievements WHERE unlocked = 1
                """)
                
                total_achievements = db.fetchone("""
                    SELECT COUNT(*) as total FROM achievements
                """)
                
                return {
                    "points": points_data["points"] if points_data else 0,
                    "level": points_data["level"] if points_data else 1,
                    "total_points": points_data["total_points"] if points_data else 0,
                    "achievements_unlocked": len(achievements),
                    "total_achievements": total_achievements["total"] if total_achievements else 0,
                    "achievements": [dict(a) for a in achievements]
                }
        except Exception as e:
            logger.error(f"Erro ao buscar estatísticas: {e}")
            return {}
    
    @staticmethod
    def create_achievement(title, description, points, achievement_type, icon=None):
        """Cria nova conquista"""
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO achievements (title, description, points, type, icon)
                    VALUES (?, ?, ?, ?, ?)
                """, (title, description, points, achievement_type, icon))
                return db.lastrowid
        except Exception as e:
            logger.error(f"Erro ao criar conquista: {e}")
            raise
    
    @staticmethod
    def initialize_default_achievements():
        """Cria conquistas padrão do sistema"""
        default_achievements = [
            ("Primeira Atividade", "Complete sua primeira atividade", 10, "atividade", "🎯"),
            ("Leitor Iniciante", "Termine seu primeiro livro", 50, "livro", "📚"),
            ("Artista", "Complete sua primeira pintura", 50, "pintura", "🎨"),
            ("Streaker", "Mantenha um hábito por 7 dias seguidos", 100, "habito", "🔥"),
            ("Dedicado", "Mantenha um hábito por 30 dias", 300, "habito", "💎"),
            ("Meta Alcançada", "Complete sua primeira meta", 150, "meta", "🏆"),
            ("Comprador Esperto", "Complete uma lista de compras", 25, "compra", "🛒")
        ]
        
        try:
            for title, desc, points, atype, icon in default_achievements:
                GamificationEngine.create_achievement(title, desc, points, atype, icon)
            logger.info("Conquistas padrão criadas")
        except Exception as e:
            logger.error(f"Erro ao criar conquistas padrão: {e}")
