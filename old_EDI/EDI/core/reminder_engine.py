"""
Reminder Engine - Sistema de Lembretes e Tarefas Importantes
"""

from data.database import Database
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


class ReminderEngine:
    
    @staticmethod
    def add_reminder(title, description=None, due_date=None, priority=3, category='pessoal', reminder_days_before=7):
        """Adiciona novo lembrete"""
        try:
            with Database() as db:
                db.execute("""
                    INSERT INTO reminders (title, description, due_date, priority, category, reminder_days_before)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (title, description, due_date, priority, category, reminder_days_before))
                logger.info(f"Lembrete criado: {title}")
                return True
        except Exception as e:
            logger.error(f"Erro ao criar lembrete: {e}")
            return False
    
    @staticmethod
    def list_reminders(status='pendente'):
        """Lista lembretes por status"""
        with Database() as db:
            reminders = db.fetchall("""
                SELECT * FROM reminders
                WHERE status = ?
                ORDER BY 
                    CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
                    due_date ASC,
                    priority ASC
            """, (status,))
            return reminders
    
    @staticmethod
    def get_upcoming_reminders(days_ahead=7):
        """Retorna lembretes com vencimento próximo"""
        with Database() as db:
            end_date = (date.today() + timedelta(days=days_ahead)).isoformat()
            
            upcoming = db.fetchall("""
                SELECT * FROM reminders
                WHERE status = 'pendente'
                AND due_date IS NOT NULL
                AND due_date <= ?
                ORDER BY due_date ASC
            """, (end_date,))
            return upcoming
    
    @staticmethod
    def complete_reminder(reminder_id):
        """Marca lembrete como concluído"""
        try:
            with Database() as db:
                today = date.today().isoformat()
                db.execute("""
                    UPDATE reminders
                    SET status = 'concluido', completed_at = ?
                    WHERE id = ?
                """, (today, reminder_id))
                return True
        except Exception as e:
            logger.error(f"Erro ao completar lembrete: {e}")
            return False
