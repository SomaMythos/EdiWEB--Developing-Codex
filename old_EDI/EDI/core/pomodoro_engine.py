"""Pomodoro Engine - Timer Pomodoro"""
from data.database import Database
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class PomodoroEngine:
    DEFAULT_WORK = 25  # minutos
    DEFAULT_BREAK = 5  # minutos
    
    @staticmethod
    def start_session(activity_id=None, duration=None):
        """Inicia sessão Pomodoro"""
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO pomodoro_sessions (activity_id, duration, started_at)
                    VALUES (?, ?, ?)
                """, (activity_id, duration or PomodoroEngine.DEFAULT_WORK, datetime.now().isoformat()))
                return db.lastrowid
        except Exception as e:
            logger.error(f"Erro ao iniciar Pomodoro: {e}")
            raise
    
    @staticmethod
    def complete_session(session_id, notes=None):
        """Completa sessão Pomodoro"""
        try:
            with Database() as db:
                db.execute("""
                    UPDATE pomodoro_sessions
                    SET completed = 1, finished_at = ?, notes = ?
                    WHERE id = ?
                """, (datetime.now().isoformat(), notes, session_id))
        except Exception as e:
            logger.error(f"Erro ao completar Pomodoro: {e}")
            raise
    
    @staticmethod
    def get_stats(date_from=None):
        """Estatísticas de sessões Pomodoro"""
        try:
            with Database() as db:
                query = "SELECT COUNT(*) as total, SUM(duration) as total_time FROM pomodoro_sessions WHERE completed = 1"
                if date_from:
                    query += f" AND started_at >= '{date_from}'"
                return db.fetchone(query)
        except Exception as e:
            logger.error(f"Erro ao buscar stats: {e}")
            return {"total": 0, "total_time": 0}
