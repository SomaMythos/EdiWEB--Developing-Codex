import json
import random
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from core.analytics_engine import AnalyticsEngine
from core.book_engine import BookEngine
from core.consumables_engine import ConsumablesEngine
from core.finance_engine import FinanceEngine
from core.goal_engine import GoalEngine
from core.music_engine import MusicEngine
from core.note_engine import NoteEngine
from core.notification_center_engine import NotificationCenterEngine
from core.user_profile_engine import UserProfileEngine
from core.watch_engine import WatchEngine
from data.database import Database


class DashboardEngine:
    SEARCH_SECTIONS = {
        "goals": "Metas",
        "activities": "Atividades",
        "notes": "Notas",
        "journal": "Diário",
        "books": "Leitura",
        "watch": "Assistir",
        "notifications": "Notificacoes",
    }

    @staticmethod
    def _safe_parse_date(value: Optional[str]) -> Optional[date]:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            pass
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
            try:
                return datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
        return None

    @staticmethod
    def _safe_parse_datetime(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        raw = str(value).strip()
        if not raw:
            return None
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            pass
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
            try:
                return datetime.strptime(raw, fmt)
            except ValueError:
                continue
        return None

    @staticmethod
    def _format_short_date(value: Optional[str]) -> str:
        parsed = DashboardEngine._safe_parse_date(value)
        if not parsed:
            return "Sem data"
        return parsed.strftime("%d/%m")

    @staticmethod
    def _format_datetime_label(value: Optional[str]) -> str:
        parsed = DashboardEngine._safe_parse_datetime(value)
        if not parsed:
            return "Sem horario"
        return parsed.strftime("%d/%m %H:%M")

    @staticmethod
    def _format_currency(value: Any) -> str:
        try:
            amount = float(value or 0)
        except (TypeError, ValueError):
            amount = 0.0
        formatted = f"{amount:,.2f}"
        return f"R$ {formatted}".replace(",", "_").replace(".", ",").replace("_", ".")

    @staticmethod
    def _completion_rate(total: int, completed: int) -> int:
        if total <= 0:
            return 0
        return round((completed / total) * 100)

    @staticmethod
    def _days_until(deadline: Optional[str]) -> Optional[int]:
        deadline_date = DashboardEngine._safe_parse_date(deadline)
        if not deadline_date:
            return None
        return (deadline_date - date.today()).days

    @staticmethod
    def _minutes_to_end_time(start_time: Optional[str], duration: Any) -> Optional[str]:
        if not start_time:
            return None
        try:
            parsed = datetime.strptime(start_time, "%H:%M")
            end_time = parsed + timedelta(minutes=int(duration or 0))
            return end_time.strftime("%H:%M")
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _clean_line(value: Optional[str]) -> str:
        return " ".join(str(value or "").split()).strip()

    @staticmethod
    def _build_goal_suggestions(limit: int = 12) -> List[Dict[str, Any]]:
        items = []
        for goal in GoalEngine.list_goals(only_active=True, order_by="deadline", include_milestones=False):
            progress = goal.get("progress_snapshot") or {}
            deadline = goal.get("deadline")
            deadline_label = DashboardEngine._format_short_date(deadline) if deadline else "Sem prazo"
            description = (
                DashboardEngine._clean_line(goal.get("description"))
                or progress.get("summary")
                or "Meta ativa"
            )
            items.append(
                {
                    "id": goal.get("id"),
                    "title": goal.get("title") or "Meta",
                    "description": description,
                    "image_path": goal.get("image_path"),
                    "badge": "Etapas" if goal.get("goal_mode") == "milestones" else "Meta",
                    "meta": deadline_label,
                    "path": "/goals",
                }
            )
            if len(items) >= limit:
                break
        return items

    @staticmethod
    def _build_reading_suggestions(limit: int = 12) -> List[Dict[str, Any]]:
        suggestions = []
        books = [dict(book) for book in BookEngine.list_books()]
        active_books = [book for book in books if str(book.get("status") or "").lower() != "concluido"]
        started_books = [
            book for book in active_books
            if (book.get("current_page") or 0) > 0 or book.get("started_at")
        ]
        candidate_books = started_books or active_books
        for book in candidate_books[:limit]:
            current_page = int(book.get("current_page") or 0)
            total_pages = int(book.get("total_pages") or 0)
            if current_page and total_pages:
                description = f"Pagina {current_page} de {total_pages}"
            elif current_page:
                description = f"Parou na pagina {current_page}"
            else:
                description = "Pronto para avancar"
            suggestions.append(
                {
                    "id": book.get("id"),
                    "title": book.get("title") or "Leitura",
                    "description": description,
                    "image_path": book.get("cover_image"),
                    "badge": book.get("book_type_name") or book.get("book_type") or "Livro",
                    "meta": str(book.get("status") or "lendo").capitalize(),
                    "path": "/hobby/leitura",
                }
            )
        return suggestions

    @staticmethod
    def _build_music_suggestions(limit: int = 12) -> List[Dict[str, Any]]:
        suggestions = []
        albums = [album for album in MusicEngine.list_albums() if album.get("status") != "listened"]
        trainings = MusicEngine.list_trainings()

        for album in albums:
            suggestions.append(
                {
                    "id": f"album-{album.get('id')}",
                    "title": album.get("name") or "Album",
                    "description": album.get("artist") or "Album para ouvir",
                    "image_path": album.get("image_path"),
                    "badge": "Album",
                    "meta": "Ouvir",
                    "path": "/hobby/musica",
                }
            )
            if len(suggestions) >= limit:
                return suggestions

        for training in trainings:
            bpm = training.get("last_bpm")
            detail = f"Ultimo BPM {bpm}" if bpm else "Treino pronto"
            suggestions.append(
                {
                    "id": f"training-{training.get('id')}",
                    "title": training.get("name") or "Treino",
                    "description": f"{str(training.get('instrument') or 'musica').capitalize()} · {detail}",
                    "image_path": training.get("image_path"),
                    "badge": "Treino",
                    "meta": "Praticar",
                    "path": "/hobby/musica",
                }
            )
            if len(suggestions) >= limit:
                break

        return suggestions
    @staticmethod
    def _build_watch_suggestions(limit: int = 12) -> List[Dict[str, Any]]:
        suggestions = []
        for category in WatchEngine.list_categories():
            items = [item for item in WatchEngine.list_items(category["id"]) if not item.get("watched_at")]
            for item in items:
                suggestions.append(
                    {
                        "id": item.get("id"),
                        "title": item.get("name") or "Assistir",
                        "description": f"{category.get('name') or 'Assistir'} em espera",
                        "image_path": item.get("image_path"),
                        "badge": category.get("name") or "Assistir",
                        "meta": "Assistir",
                        "path": "/hobby/assistir",
                    }
                )
                if len(suggestions) >= limit:
                    return suggestions
        return suggestions

    @staticmethod
    def _next_daily_activity() -> Optional[Dict[str, Any]]:
        today = date.today().isoformat()
        now_time = datetime.now().strftime("%H:%M")
        with Database() as db:
            row = db.fetchone(
                """
                SELECT
                    dpb.id,
                    dpb.date,
                    dpb.start_time,
                    dpb.duration,
                    dpb.block_name,
                    dpb.block_category,
                    dpb.completed,
                    a.title AS activity_title
                FROM daily_plan_blocks dpb
                LEFT JOIN activities a ON a.id = dpb.activity_id
                WHERE dpb.date = ?
                  AND COALESCE(dpb.completed, 0) = 0
                ORDER BY CASE WHEN dpb.start_time >= ? THEN 0 ELSE 1 END, dpb.start_time ASC, dpb.id ASC
                LIMIT 1
                """,
                (today, now_time),
            )
        if not row:
            return None

        item = dict(row)
        title = item.get("activity_title") or item.get("block_name") or "Bloco do dia"
        return {
            "id": item.get("id"),
            "title": title,
            "start_time": item.get("start_time"),
            "end_time": DashboardEngine._minutes_to_end_time(item.get("start_time"), item.get("duration")),
            "duration": int(item.get("duration") or 0),
            "block_category": item.get("block_category") or "disciplina",
            "completed": bool(item.get("completed")),
            "path": "/daily",
        }

    @staticmethod
    def _consumables_due(limit: int = 6) -> List[Dict[str, Any]]:
        risks = ConsumablesEngine.detect_restock_risks(window_days=3)
        items = []
        for risk in sorted(risks, key=lambda item: (item.get("meta") or {}).get("days_remaining", 9999))[:limit]:
            meta = risk.get("meta") or {}
            days_remaining = meta.get("days_remaining")
            if days_remaining is None:
                status = "Em breve"
            elif days_remaining < 0:
                status = f"Atrasado {abs(days_remaining)} dia(s)"
            elif days_remaining == 0:
                status = "Hoje"
            else:
                status = f"{days_remaining} dia(s)"
            items.append(
                {
                    "id": meta.get("item_id") or risk.get("unique_key"),
                    "title": meta.get("item_name") or risk.get("title") or "Consumivel",
                    "subtitle": meta.get("category_name") or "Consumiveis",
                    "status": status,
                    "date_label": DashboardEngine._format_short_date(meta.get("predicted_end_date")),
                    "path": "/shopping/consumiveis",
                }
            )
        return items

    @staticmethod
    def _recent_expenses(limit: int = 3) -> List[Dict[str, Any]]:
        expenses = []
        for transaction in FinanceEngine.list_transactions(limit=30):
            item = dict(transaction)
            if item.get("kind") != "expense":
                continue
            expenses.append(
                {
                    "id": item.get("id"),
                    "title": item.get("description") or "Gasto",
                    "subtitle": item.get("category") or "Sem categoria",
                    "amount": DashboardEngine._format_currency(item.get("amount")),
                    "occurred_at": DashboardEngine._format_short_date(item.get("occurred_at")),
                    "path": "/financeiro",
                }
            )
            if len(expenses) >= limit:
                break
        return expenses

    @staticmethod
    def _next_calendar_event() -> Optional[Dict[str, Any]]:
        today = date.today().isoformat()
        now_time = datetime.now().strftime("%H:%M")
        with Database() as db:
            row = db.fetchone(
                """
                SELECT id, event_date, title, description, start_time, end_time
                FROM calendar_events
                WHERE event_date > ?
                   OR (event_date = ? AND COALESCE(start_time, '23:59') >= ?)
                ORDER BY event_date ASC, COALESCE(start_time, '23:59') ASC, id ASC
                LIMIT 1
                """,
                (today, today, now_time),
            )
        if not row:
            return None

        event = dict(row)
        if event.get("start_time") and event.get("end_time"):
            schedule = f"{event['start_time']} - {event['end_time']}"
        elif event.get("start_time"):
            schedule = event["start_time"]
        else:
            schedule = "Dia inteiro"

        return {
            "id": event.get("id"),
            "title": event.get("title") or "Evento",
            "description": DashboardEngine._clean_line(event.get("description")) or "Proximo evento do calendario",
            "date_label": DashboardEngine._format_short_date(event.get("event_date")),
            "schedule": schedule,
            "path": "/calendario",
        }

    @staticmethod
    def _log_text(category: str, event_key: str, title: str, details: Dict[str, Any]) -> str:
        if event_key == "daily_completed":
            return f'Concluiu "{title}"'
        if event_key == "goal_created":
            return f'Criou a meta "{title}"'
        if event_key == "goal_completed":
            return f'Concluiu a meta "{title}"'
        if event_key == "milestone_completed":
            goal_title = details.get("goal_title")
            return f'Concluiu a etapa "{title}" de "{goal_title}"' if goal_title else f'Concluiu a etapa "{title}"'
        if event_key == "painting_created":
            return f'Criou a arte visual "{title}"'
        if event_key == "painting_progress":
            return f'Atualizou a arte visual "{title}"'
        if event_key == "painting_completed":
            return f'Concluiu a arte visual "{title}"'
        if event_key == "reading_session":
            pages = details.get("pages_read") or 0
            return f'Leu {pages} pagina(s) de "{title}"'
        if event_key == "book_finished":
            return f'Concluiu a leitura de "{title}"'
        if event_key == "watch_completed":
            return f'Assistiu "{title}"'
        if event_key == "music_training":
            bpm = details.get("bpm")
            return f'Treinou "{title}" a {bpm} BPM' if bpm else f'Treinou "{title}"'
        if event_key == "album_listened":
            return f'Escutou "{title}"'
        if event_key == "consumable_restock":
            return f'Restocou "{title}"'
        if event_key == "consumable_finished":
            return f'Concluiu o ciclo de "{title}"'
        if event_key == "expense_created":
            return f'Gastou {DashboardEngine._format_currency(details.get("amount"))} com "{title}"'
        if event_key == "calendar_event_created":
            return f'Criou o evento "{title}"'
        if event_key == "calendar_log_created":
            return f'Registrou no calendario "{title}"'
        if event_key == "note_created":
            return f'Criou a nota "{title}"'
        if event_key == "note_updated":
            return f'Atualizou a nota "{title}"'
        if event_key == "journal_created":
            return "Escreveu o diario semanal"
        if event_key == "journal_updated":
            return "Atualizou o diario semanal"
        return title or category.capitalize()
    @staticmethod
    def _activity_log(limit: int = 14) -> List[Dict[str, Any]]:
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT * FROM (
                    SELECT
                        'daily-plan-' || dpb.id AS entry_id,
                        CASE
                            WHEN COALESCE(dpb.start_time, '') = '' THEN dpb.date || 'T00:00:00'
                            ELSE dpb.date || 'T' || dpb.start_time || ':00'
                        END AS timestamp,
                        'daily' AS category,
                        'daily_completed' AS event_key,
                        COALESCE(a.title, dpb.block_name, 'Atividade') AS title,
                        json_object('duration', COALESCE(dpb.duration, 0)) AS details,
                        '/daily' AS path
                    FROM daily_plan_blocks dpb
                    LEFT JOIN activities a ON a.id = dpb.activity_id
                    WHERE COALESCE(dpb.completed, 0) = 1

                    UNION ALL

                    SELECT
                        'daily-log-' || dal.id AS entry_id,
                        COALESCE(dal.timestamp, dl.date || 'T00:00:00') AS timestamp,
                        'daily' AS category,
                        'daily_completed' AS event_key,
                        COALESCE(a.title, 'Atividade') AS title,
                        json_object('duration', COALESCE(dal.duration, 0)) AS details,
                        '/daily' AS path
                    FROM daily_activity_logs dal
                    JOIN daily_logs dl ON dl.id = dal.daily_log_id
                    LEFT JOIN activities a ON a.id = dal.activity_id
                    WHERE COALESCE(dal.completed, 0) = 1

                    UNION ALL

                    SELECT 'goal-created-' || g.id, g.created_at, 'goals', 'goal_created', g.title, '{}', '/goals'
                    FROM goals g
                    WHERE g.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'goal-completed-' || g.id, g.completed_at, 'goals', 'goal_completed', g.title, '{}', '/goals'
                    FROM goals g
                    WHERE g.completed_at IS NOT NULL

                    UNION ALL

                    SELECT
                        'milestone-completed-' || gm.id,
                        gm.completed_at,
                        'goals',
                        'milestone_completed',
                        gm.title,
                        json_object('goal_title', g.title),
                        '/goals'
                    FROM goal_milestones gm
                    JOIN goals g ON g.id = gm.goal_id
                    WHERE gm.completed_at IS NOT NULL

                    UNION ALL

                    SELECT 'painting-created-' || p.id, p.created_at, 'visual-arts', 'painting_created', p.title, '{}', '/hobby/artes-visuais'
                    FROM paintings p
                    WHERE p.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'painting-progress-' || pp.id, pp.timestamp, 'visual-arts', 'painting_progress', COALESCE(p.title, pp.update_title, 'Arte visual'), '{}', '/hobby/artes-visuais'
                    FROM painting_progress pp
                    JOIN paintings p ON p.id = pp.painting_id
                    WHERE pp.timestamp IS NOT NULL

                    UNION ALL

                    SELECT 'painting-completed-' || p.id, p.finished_at, 'visual-arts', 'painting_completed', p.title, '{}', '/hobby/artes-visuais'
                    FROM paintings p
                    WHERE p.finished_at IS NOT NULL

                    UNION ALL

                    SELECT
                        'reading-session-' || rs.id,
                        COALESCE(rs.read_at, rs.date || 'T00:00:00'),
                        'reading',
                        'reading_session',
                        b.title,
                        json_object('pages_read', COALESCE(rs.pages_read, 0)),
                        '/hobby/leitura'
                    FROM reading_sessions rs
                    JOIN books b ON b.id = rs.book_id

                    UNION ALL

                    SELECT 'book-finished-' || b.id, b.finished_at, 'reading', 'book_finished', b.title, '{}', '/hobby/leitura'
                    FROM books b
                    WHERE b.finished_at IS NOT NULL

                    UNION ALL

                    SELECT 'watch-' || wi.id, wi.watched_at, 'watch', 'watch_completed', wi.name, '{}', '/hobby/assistir'
                    FROM watch_items wi
                    WHERE wi.watched_at IS NOT NULL

                    UNION ALL

                    SELECT
                        'music-training-' || mts.id,
                        mts.created_at,
                        'music',
                        'music_training',
                        mtt.name,
                        json_object('bpm', COALESCE(mts.bpm, 0)),
                        '/hobby/musica'
                    FROM music_training_sessions mts
                    JOIN music_training_tabs mtt ON mtt.id = mts.training_id
                    WHERE mts.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'album-listened-' || ma.id, ma.created_at, 'music', 'album_listened', ma.name, '{}', '/hobby/musica'
                    FROM music_albums ma
                    WHERE ma.status = 'listened'
                      AND ma.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'consumable-restock-' || cc.id, COALESCE(cc.created_at, cc.purchase_date || 'T00:00:00'), 'consumables', 'consumable_restock', ci.name, '{}', '/shopping/consumiveis'
                    FROM consumable_cycles cc
                    JOIN consumable_items ci ON ci.id = cc.item_id

                    UNION ALL

                    SELECT 'consumable-finished-' || cc.id, cc.ended_at, 'consumables', 'consumable_finished', ci.name, '{}', '/shopping/consumiveis'
                    FROM consumable_cycles cc
                    JOIN consumable_items ci ON ci.id = cc.item_id
                    WHERE cc.ended_at IS NOT NULL

                    UNION ALL

                    SELECT
                        'expense-' || ft.id,
                        COALESCE(ft.created_at, ft.occurred_at),
                        'finance',
                        'expense_created',
                        ft.description,
                        json_object('amount', COALESCE(ft.amount, 0)),
                        '/financeiro'
                    FROM finance_transactions ft
                    WHERE ft.kind = 'expense'

                    UNION ALL

                    SELECT 'calendar-event-' || ce.id, ce.created_at, 'calendar', 'calendar_event_created', ce.title, '{}', '/calendario'
                    FROM calendar_events ce
                    WHERE ce.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'calendar-log-' || cl.id, cl.created_at, 'calendar', 'calendar_log_created', cl.title, '{}', '/calendario'
                    FROM calendar_manual_logs cl
                    WHERE cl.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'note-created-' || n.id, n.created_at, 'notes', 'note_created', n.title, '{}', '/anotacoes'
                    FROM notes n
                    WHERE n.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'note-updated-' || n.id, n.updated_at, 'notes', 'note_updated', n.title, '{}', '/anotacoes'
                    FROM notes n
                    WHERE n.updated_at IS NOT NULL
                      AND n.updated_at != n.created_at

                    UNION ALL

                    SELECT 'journal-created-' || wj.id, wj.created_at, 'journal', 'journal_created', COALESCE(wj.title, 'Diário semanal'), '{}', '/anotacoes?tab=journal'
                    FROM weekly_journal_entries wj
                    WHERE wj.created_at IS NOT NULL

                    UNION ALL

                    SELECT 'journal-updated-' || wj.id, wj.updated_at, 'journal', 'journal_updated', COALESCE(wj.title, 'Diário semanal'), '{}', '/anotacoes?tab=journal'
                    FROM weekly_journal_entries wj
                    WHERE wj.updated_at IS NOT NULL
                      AND wj.updated_at != wj.created_at
                ) activity_log
                WHERE timestamp IS NOT NULL
                ORDER BY datetime(timestamp) DESC
                LIMIT ?
                """,
                (max(1, int(limit or 14)),),
            )

        items = []
        for row in rows:
            entry = dict(row)
            details = json.loads(entry.get("details") or "{}")
            items.append(
                {
                    "id": entry.get("entry_id"),
                    "category": entry.get("category") or "system",
                    "text": DashboardEngine._log_text(
                        entry.get("category") or "system",
                        entry.get("event_key") or "log",
                        entry.get("title") or "Registro",
                        details,
                    ),
                    "timestamp": DashboardEngine._format_datetime_label(entry.get("timestamp")),
                    "path": entry.get("path") or "/",
                }
            )
        return items

    @staticmethod
    def get_today_overview():
        overview: Dict[str, Any] = {}
        profile = UserProfileEngine.get_profile()
        if profile:
            overview["user"] = {"name": profile["name"], "age": UserProfileEngine.get_age(profile)}

        today = date.today().isoformat()
        with Database() as db:
            activity = db.fetchone(
                """
                SELECT COUNT(*) as total, SUM(completed) as completed, SUM(duration) as total_minutes
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                WHERE dl.date = ?
                """,
                (today,),
            )

        overview["activities"] = {
            "total": activity["total"] or 0,
            "completed": activity["completed"] or 0,
            "total_minutes": activity["total_minutes"] or 0,
        }
        overview["reading"] = BookEngine.get_reading_stats()
        overview["reminders"] = {"urgent": len(NotificationCenterEngine.list_notifications(include_read=False, due_only=True))}
        return overview

    @staticmethod
    def get_weekly_summary():
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        with Database() as db:
            summary = db.fetchone(
                """
                SELECT COUNT(DISTINCT dl.date) as days_active, COUNT(dal.id) as total_activities,
                SUM(dal.completed) as completed_activities, SUM(dal.duration) as total_minutes
                FROM daily_logs dl
                LEFT JOIN daily_activity_logs dal ON dal.daily_log_id = dl.id
                WHERE dl.date >= ?
                """,
                (week_ago,),
            )
        total = summary["total_activities"] or 0
        completed = summary["completed_activities"] or 0
        return {
            "days_active": summary["days_active"] or 0,
            "total_activities": total,
            "completed_activities": completed,
            "total_hours": round((summary["total_minutes"] or 0) / 60, 1),
            "completion_rate": round((completed / max(total, 1)) * 100, 1),
        }
    @staticmethod
    def get_frontpage() -> Dict[str, Any]:
        profile = UserProfileEngine.get_profile() or {}
        goal_items = DashboardEngine._build_goal_suggestions()
        reading_items = DashboardEngine._build_reading_suggestions()
        music_items = DashboardEngine._build_music_suggestions()
        watch_items = DashboardEngine._build_watch_suggestions()

        return {
            "greeting": profile.get("name") or "Home",
            "next_activity": DashboardEngine._next_daily_activity(),
            "suggestion_groups": {
                "goal": {
                    "label": "Meta",
                    "path": "/goals",
                    "items": random.sample(goal_items, len(goal_items)) if len(goal_items) > 1 else goal_items,
                },
                "reading": {
                    "label": "Leitura",
                    "path": "/hobby/leitura",
                    "items": random.sample(reading_items, len(reading_items)) if len(reading_items) > 1 else reading_items,
                },
                "music": {
                    "label": "Musica",
                    "path": "/hobby/musica",
                    "items": random.sample(music_items, len(music_items)) if len(music_items) > 1 else music_items,
                },
                "watch": {
                    "label": "Assistir",
                    "path": "/hobby/assistir",
                    "items": random.sample(watch_items, len(watch_items)) if len(watch_items) > 1 else watch_items,
                },
            },
            "consumables_due": DashboardEngine._consumables_due(),
            "recent_expenses": DashboardEngine._recent_expenses(),
            "next_event": DashboardEngine._next_calendar_event(),
            "activity_log": DashboardEngine._activity_log(),
        }

    @staticmethod
    def search_everything(query: str, limit_per_section: int = 5) -> Dict[str, Any]:
        normalized_query = (query or "").strip()
        if not normalized_query:
            return {"query": "", "total_results": 0, "sections": []}

        token = f"%{normalized_query.lower()}%"
        limit = max(1, min(int(limit_per_section or 5), 10))
        sections: List[Dict[str, Any]] = []

        with Database() as db:
            goals = db.fetchall(
                """
                SELECT id, title, status, deadline
                FROM goals
                WHERE LOWER(title) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?
                ORDER BY CASE WHEN status = 'ativa' THEN 0 ELSE 1 END, datetime(created_at) DESC
                LIMIT ?
                """,
                (token, token, limit),
            )
            activities = db.fetchall(
                """
                SELECT id, title
                FROM activities
                WHERE LOWER(title) LIKE ?
                ORDER BY LOWER(title) ASC
                LIMIT ?
                """,
                (token, limit),
            )
            notes = db.fetchall(
                """
                SELECT n.id, n.title, c.name AS context_name
                FROM notes n
                LEFT JOIN note_contexts c ON c.id = n.context_id
                WHERE LOWER(n.title) LIKE ? OR LOWER(COALESCE(n.content, '')) LIKE ?
                ORDER BY datetime(n.updated_at) DESC
                LIMIT ?
                """,
                (token, token, limit),
            )
            journal_entries = db.fetchall(
                """
                SELECT id, title, week_start, week_end
                FROM weekly_journal_entries
                WHERE LOWER(COALESCE(title, '')) LIKE ? OR LOWER(COALESCE(content, '')) LIKE ?
                ORDER BY week_start DESC
                LIMIT ?
                """,
                (token, token, limit),
            )
            books = db.fetchall(
                """
                SELECT id, title, status
                FROM books
                WHERE LOWER(title) LIKE ?
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (token, limit),
            )
            watch_items = db.fetchall(
                """
                SELECT wi.id, wi.name, wc.name AS category_name
                FROM watch_items wi
                LEFT JOIN watch_categories wc ON wc.id = wi.category_id
                WHERE LOWER(wi.name) LIKE ?
                ORDER BY datetime(wi.created_at) DESC
                LIMIT ?
                """,
                (token, limit),
            )
            notifications = db.fetchall(
                """
                SELECT id, title, message, severity
                FROM notifications
                WHERE LOWER(COALESCE(title, '')) LIKE ? OR LOWER(COALESCE(message, '')) LIKE ?
                ORDER BY datetime(created_at) DESC
                LIMIT ?
                """,
                (token, token, limit),
            )

        def add_section(key: str, rows: List[Dict[str, Any]], formatter):
            if not rows:
                return
            items = [formatter(dict(row)) for row in rows]
            sections.append({"key": key, "label": DashboardEngine.SEARCH_SECTIONS[key], "count": len(items), "items": items})

        add_section(
            "goals",
            goals,
            lambda row: {
                "id": row["id"],
                "title": row["title"],
                "subtitle": row.get("status") or "Meta",
                "meta": row.get("deadline") or "Sem prazo",
                "path": "/goals",
            },
        )
        add_section(
            "activities",
            activities,
            lambda row: {
                "id": row["id"],
                "title": row["title"],
                "subtitle": "Atividade do daily",
                "meta": "Daily",
                "path": "/daily",
            },
        )
        add_section(
            "notes",
            notes,
            lambda row: {
                "id": row["id"],
                "title": row["title"],
                "subtitle": row.get("context_name") or "Sem contexto",
                "meta": "Anotacoes",
                "path": "/anotacoes",
            },
        )
        add_section(
            "journal",
            journal_entries,
            lambda row: {
                "id": row["id"],
                "title": row.get("title") or "Diário semanal",
                "subtitle": f"Semana {row.get('week_start')} a {row.get('week_end')}",
                "meta": "Diário",
                "path": "/anotacoes?tab=journal",
            },
        )
        add_section(
            "books",
            books,
            lambda row: {
                "id": row["id"],
                "title": row["title"],
                "subtitle": row.get("status") or "Leitura",
                "meta": "Leitura",
                "path": "/hobby/leitura",
            },
        )
        add_section(
            "watch",
            watch_items,
            lambda row: {
                "id": row["id"],
                "title": row["name"],
                "subtitle": row.get("category_name") or "Assistir",
                "meta": "Assistir",
                "path": "/hobby/assistir",
            },
        )
        add_section(
            "notifications",
            notifications,
            lambda row: {
                "id": row.get("id"),
                "title": row.get("title") or "Notificacao",
                "subtitle": row.get("message") or "Painel de notificacoes",
                "meta": row.get("severity") or "info",
                "path": "/notifications",
            },
        )

        return {
            "query": normalized_query,
            "total_results": sum(section["count"] for section in sections),
            "sections": sections,
        }
