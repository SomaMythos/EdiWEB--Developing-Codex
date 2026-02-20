"""
Dashboard Engine - Visão Geral e Estatísticas Consolidadas
"""

from data.database import Database
from datetime import date, timedelta
from core.book_engine import BookEngine
from core.shopping_engine import ShoppingEngine
from core.user_profile_engine import UserProfileEngine
from core.reminder_engine import ReminderEngine
from core.goal_engine import GoalEngine
from core.notification_engine import NotificationEngine
import logging

logger = logging.getLogger(__name__)


class DashboardEngine:
    
    @staticmethod
    def get_today_overview():
        """Retorna resumo completo do dia atual"""
        try:
            overview = {}
            
            # Perfil do usuário
            profile = UserProfileEngine.get_profile()
            if profile:
                overview['user'] = {
                    'name': profile['name'],
                    'age': UserProfileEngine.get_age()
                }
            
            # Atividades do dia
            with Database() as db:
                today = date.today().isoformat()
                
                activities_today = db.fetchone("""
                    SELECT 
                        COUNT(*) as total,
                        SUM(completed) as completed,
                        SUM(duration) as total_minutes
                    FROM daily_activity_logs dal
                    JOIN daily_logs dl ON dl.id = dal.daily_log_id
                    WHERE dl.date = ?
                """, (today,))
                
                overview['activities'] = {
                    'total': activities_today['total'] or 0,
                    'completed': activities_today['completed'] or 0,
                    'total_minutes': activities_today['total_minutes'] or 0
                }
            
            # Leitura
            book_stats = BookEngine.get_reading_stats()
            overview['reading'] = {
                'status_counts': book_stats['status_counts'],
                'pages_this_month': book_stats['pages_this_month']
            }
            
            # Metas
            goals = GoalEngine.list_goals()
            overview['goals'] = {
                'active_goals': len(goals),
                'stalled_goals': sum(1 for g in goals if GoalEngine.is_stalled(g['id']))
            }
            
            # Lembretes urgentes
            upcoming_reminders = ReminderEngine.get_upcoming_reminders(days_ahead=3)
            overview['reminders'] = {
                'urgent': len(upcoming_reminders)
            }
            
            # Notificações
            notifications = NotificationEngine.get_all_notifications()
            overview['notifications'] = len(notifications)
            
            return overview
            
        except Exception as e:
            logger.error(f"Erro ao gerar overview: {e}")
            return {}
    
    @staticmethod
    def get_weekly_summary():
        """Retorna resumo da semana"""
        try:
            with Database() as db:
                week_ago = (date.today() - timedelta(days=7)).isoformat()
                
                summary = db.fetchone("""
                    SELECT 
                        COUNT(DISTINCT dl.date) as days_active,
                        COUNT(dal.id) as total_activities,
                        SUM(dal.completed) as completed_activities,
                        SUM(dal.duration) as total_minutes
                    FROM daily_logs dl
                    LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
                    WHERE dl.date >= ?
                """, (week_ago,))
                
                return {
                    'days_active': summary['days_active'] or 0,
                    'total_activities': summary['total_activities'] or 0,
                    'completed_activities': summary['completed_activities'] or 0,
                    'total_hours': round((summary['total_minutes'] or 0) / 60, 1),
                    'completion_rate': round((summary['completed_activities'] or 0) / 
                                            max(summary['total_activities'] or 1, 1) * 100, 1)
                }
        except Exception as e:
            logger.error(f"Erro ao gerar resumo semanal: {e}")
            return {}
    
    @staticmethod
    def get_monthly_stats():
        """Retorna estatísticas do mês"""
        try:
            stats = {}
            
            # Atividades do mês
            with Database() as db:
                month_start = date.today().replace(day=1).isoformat()
                
                activities = db.fetchone("""
                    SELECT 
                        COUNT(dal.id) as total_activities,
                        SUM(dal.completed) as completed,
                        SUM(dal.duration) as total_minutes
                    FROM daily_activity_logs dal
                    JOIN daily_logs dl ON dl.id = dal.daily_log_id
                    WHERE dl.date >= ?
                """, (month_start,))
                
                stats['activities'] = {
                    'total': activities['total_activities'] or 0,
                    'completed': activities['completed'] or 0,
                    'total_hours': round((activities['total_minutes'] or 0) / 60, 1)
                }
            
            # Leitura do mês
            book_stats = BookEngine.get_reading_stats()
            stats['reading'] = {
                'pages_read': book_stats['pages_this_month'],
                'books_completed': book_stats['status_counts']['Concluído']
            }
            
            # Compras do mês
            shopping_stats = ShoppingEngine.get_shopping_stats()
            stats['shopping'] = {
                'spent': shopping_stats['month_spending']
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Erro ao gerar estatísticas mensais: {e}")
            return {}
    
    @staticmethod
    def get_productivity_score():
        """Calcula score de produtividade (0-100)"""
        try:
            with Database() as db:
                today = date.today().isoformat()
                activities = db.fetchone(
                    """
                    SELECT
                        COUNT(*) as total,
                        SUM(completed) as completed
                    FROM daily_activity_logs dal
                    JOIN daily_logs dl ON dl.id = dal.daily_log_id
                    WHERE dl.date = ?
                    """,
                    (today,),
                )

                total = activities["total"] or 0
                completed = activities["completed"] or 0
                if total > 0:
                    return round((completed / total) * 100)

                return 0
                
        except Exception as e:
            logger.error(f"Erro ao calcular productivity score: {e}")
            return 0
