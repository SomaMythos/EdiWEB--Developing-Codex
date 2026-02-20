"""Habit Engine - Gerenciamento de Hábitos e Streaks"""
from data.database import Database
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)

class HabitEngine:
    
    @staticmethod
    def create_habit(title, frequency, target_days=None, description=None):
        """Cria novo hábito"""
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO habits (title, description, frequency, target_days)
                    VALUES (?, ?, ?, ?)
                """, (title, description, frequency, target_days))
                return db.lastrowid
        except Exception as e:
            logger.error(f"Erro ao criar hábito: {e}")
            raise
    
    @staticmethod
    def list_habits(active_only=True):
        """Lista hábitos"""
        try:
            with Database() as db:
                query = "SELECT * FROM habits WHERE 1=1"
                if active_only:
                    query += " AND active = 1"
                query += " ORDER BY current_streak DESC"
                return db.fetchall(query)
        except Exception as e:
            logger.error(f"Erro ao listar hábitos: {e}")
            return []
    
    @staticmethod
    def log_completion(habit_id, completed=True, notes=None):
        """Registra conclusão do hábito"""
        try:
            today = date.today().isoformat()
            with Database() as db:
                # Inserir log
                db.execute("""
                    INSERT OR REPLACE INTO habit_logs (habit_id, date, completed, notes)
                    VALUES (?, ?, ?, ?)
                """, (habit_id, today, 1 if completed else 0, notes))
                
                # Atualizar streak
                HabitEngine._update_streak(habit_id)
                
                logger.info(f"Hábito {habit_id} registrado para {today}")
        except Exception as e:
            logger.error(f"Erro ao registrar hábito: {e}")
            raise
    
    @staticmethod
    def _update_streak(habit_id):
        """Atualiza contagem de streak"""
        try:
            with Database() as db:
                habit = db.fetchone("SELECT * FROM habits WHERE id = ?", (habit_id,))
                if not habit:
                    return
                
                # Buscar logs recentes
                logs = db.fetchall("""
                    SELECT date, completed FROM habit_logs
                    WHERE habit_id = ? AND completed = 1
                    ORDER BY date DESC
                    LIMIT 365
                """, (habit_id,))
                
                if not logs:
                    db.execute("UPDATE habits SET current_streak = 0 WHERE id = ?", (habit_id,))
                    return
                
                # Calcular streak atual
                current_streak = 0
                expected_date = date.today()
                
                for log in logs:
                    log_date = date.fromisoformat(log["date"])
                    if log_date == expected_date:
                        current_streak += 1
                        expected_date -= timedelta(days=1)
                    else:
                        break
                
                # Atualizar banco
                db.execute("""
                    UPDATE habits
                    SET current_streak = ?,
                        best_streak = MAX(best_streak, ?),
                        total_completions = total_completions + 1
                    WHERE id = ?
                """, (current_streak, current_streak, habit_id))
        except Exception as e:
            logger.error(f"Erro ao atualizar streak: {e}")
    
    @staticmethod
    def get_stats(habit_id):
        """Estatísticas do hábito"""
        try:
            with Database() as db:
                habit = db.fetchone("SELECT * FROM habits WHERE id = ?", (habit_id,))
                if not habit:
                    return None
                
                # Taxa de conclusão últimos 30 dias
                thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
                completion_rate = db.fetchone("""
                    SELECT 
                        COUNT(*) as total_days,
                        SUM(completed) as completed_days
                    FROM habit_logs
                    WHERE habit_id = ? AND date >= ?
                """, (habit_id, thirty_days_ago))
                
                rate = 0
                if completion_rate and completion_rate["total_days"] > 0:
                    rate = int((completion_rate["completed_days"] / completion_rate["total_days"]) * 100)
                
                return {
                    "habit": dict(habit),
                    "completion_rate_30d": rate,
                    "days_tracked": completion_rate["total_days"] if completion_rate else 0
                }
        except Exception as e:
            logger.error(f"Erro ao buscar estatísticas: {e}")
            return None
