from core.goal_engine import GoalEngine
from core.daily_log_engine import DailyLogEngine
from data.database import Database
from datetime import date, datetime
import json
import logging

logger = logging.getLogger(__name__)


class NotificationEngine:

    @staticmethod
    def check_stalled_goals(store=False):
        """
        Verifica metas que estão paradas (sem progresso há muito tempo)
        
        Returns:
            Lista de alertas com metas paradas
        """
        alerts = []
        try:
            goals = GoalEngine.list_goals()

            for g in goals:
                if GoalEngine.is_stalled(g["id"]):
                    alert = {
                        "type": "stalled_goal",
                        "title": g["title"],
                        "progress": GoalEngine.calculate_progress(g["id"]),
                        "message": f"Meta '{g['title']}' sem progresso há mais de 3 dias",
                        "meta": {"goal_id": g["id"], "date": date.today().isoformat()},
                    }
                    if store:
                        NotificationEngine._store_notification(alert)
                    alerts.append(alert)
        except Exception as e:
            logger.error(f"Erro ao verificar metas paradas: {e}")
        
        return alerts

    @staticmethod
    def check_upcoming_deadlines(days_ahead=7, store=False):
        """
        Verifica metas com deadline próximo
        
        Args:
            days_ahead: Quantos dias à frente verificar
        
        Returns:
            Lista de alertas com deadlines próximos
        """
        alerts = []
        try:
            goals = GoalEngine.list_goals()
            today = date.today()
            
            for g in goals:
                if g["deadline"]:
                    deadline = datetime.strptime(g["deadline"], "%Y-%m-%d").date()
                    days_remaining = (deadline - today).days
                    
                    if 0 <= days_remaining <= days_ahead:
                        alert = {
                            "type": "upcoming_deadline",
                            "title": g["title"],
                            "deadline": g["deadline"],
                            "days_remaining": days_remaining,
                            "message": f"Faltam {days_remaining} dias para o deadline de '{g['title']}'",
                            "meta": {"goal_id": g["id"], "deadline": g["deadline"]},
                        }
                        if store:
                            NotificationEngine._store_notification(alert)
                        alerts.append(alert)
        except Exception as e:
            logger.error(f"Erro ao verificar deadlines: {e}")
        
        return alerts

    @staticmethod
    def get_daily_summary(store=False):
        """
        Gera resumo das atividades do dia
        
        Returns:
            Dicionário com estatísticas do dia
        """
        try:
            entries = DailyLogEngine.list_day()
            
            total_activities = len(entries)
            completed_activities = sum(1 for e in entries if e.get("completed"))
            total_duration = sum(e.get("duration", 0) for e in entries)
            
            summary = {
                "type": "daily_summary",
                "total_activities": total_activities,
                "completed_activities": completed_activities,
                "total_duration": total_duration,
                "completion_rate": (completed_activities / total_activities * 100) if total_activities > 0 else 0,
                "message": f"Hoje você completou {completed_activities} de {total_activities} atividades",
                "meta": {"date": date.today().isoformat()},
            }
            if store:
                NotificationEngine._store_notification(summary)
            return summary
        except Exception as e:
            logger.error(f"Erro ao gerar resumo diário: {e}")
            return None

    @staticmethod
    def list_notifications(include_read=False):
        query = """
            SELECT id, type, title, message, meta, created_at, read_at
            FROM notifications
        """
        clauses = []
        params = []
        if not include_read:
            clauses.append("read_at IS NULL")

        if clauses:
            query += " WHERE " + " AND ".join(clauses)

        query += " ORDER BY datetime(created_at) DESC, id DESC"

        with Database() as db:
            rows = db.fetchall(query, tuple(params))

        for row in rows:
            meta = row.get("meta")
            if meta:
                try:
                    row["meta"] = json.loads(meta)
                except json.JSONDecodeError:
                    row["meta"] = {}
            else:
                row["meta"] = {}

        return rows

    @staticmethod
    def get_all_notifications():
        """
        Obtém todas as notificações pendentes
        
        Returns:
            Lista com todas as notificações
        """
        notifications = []
        
        # Verificar metas paradas
        NotificationEngine.check_stalled_goals(store=True)
        
        # Verificar deadlines próximos
        NotificationEngine.check_upcoming_deadlines(store=True)
        
        # Adicionar resumo diário
        NotificationEngine.get_daily_summary(store=True)

        return NotificationEngine.list_notifications(include_read=False)

    @staticmethod
    def mark_as_read(notification_id):
        """
        Marca notificação como lida (implementação futura com banco)
        
        Args:
            notification_id: ID da notificação
        """
        with Database() as db:
            db.execute(
                "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ?",
                (notification_id,),
            )

    @staticmethod
    def clear_all():
        """
        Limpa todas as notificações (implementação futura)
        """
        with Database() as db:
            db.execute(
                "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE read_at IS NULL"
            )

    @staticmethod
    def _store_notification(notification):
        unique_key = NotificationEngine._unique_key(notification)
        meta = notification.get("meta") or {}
        try:
            meta_payload = json.dumps(meta, ensure_ascii=False)
        except (TypeError, ValueError):
            meta_payload = "{}"

        with Database() as db:
            db.execute(
                """
                INSERT OR IGNORE INTO notifications
                (type, title, message, meta, unique_key)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    notification.get("type"),
                    notification.get("title"),
                    notification.get("message"),
                    meta_payload,
                    unique_key,
                ),
            )

    @staticmethod
    def _unique_key(notification):
        notif_type = notification.get("type", "generic")
        meta = notification.get("meta") or {}
        if notif_type == "daily_summary":
            return f"{notif_type}:{meta.get('date')}"
        if notif_type == "stalled_goal":
            return f"{notif_type}:{meta.get('goal_id')}:{meta.get('date')}"
        if notif_type == "upcoming_deadline":
            return f"{notif_type}:{meta.get('goal_id')}:{meta.get('deadline')}"
        title = notification.get("title") or ""
        message = notification.get("message") or ""
        return f"{notif_type}:{title}:{message}"
