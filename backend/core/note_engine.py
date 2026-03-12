from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional

from data.database import Database


class NoteEngine:
    DEFAULT_CONTEXT_COLOR = "#facc15"
    DEFAULT_NOTE_COLOR = "#facc15"
    DEFAULT_JOURNAL_TIME = "18:00"

    @staticmethod
    def _normalize_color(value: Optional[str], default: str) -> str:
        normalized = (value or "").strip()
        return normalized or default

    @staticmethod
    def _parse_iso_date(value: Optional[str]) -> date:
        if not value:
            return date.today()
        return datetime.strptime(value, "%Y-%m-%d").date()

    @staticmethod
    def _week_bounds(reference_date: Optional[str] = None) -> Dict[str, str]:
        current_date = NoteEngine._parse_iso_date(reference_date)
        week_start = current_date - timedelta(days=current_date.weekday())
        week_end = week_start + timedelta(days=6)
        return {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "label": f"{week_start.strftime('%d/%m')} - {week_end.strftime('%d/%m')}",
        }

    @staticmethod
    def list_contexts() -> List[Dict[str, Any]]:
        with Database() as db:
            rows = db.fetchall(
                "SELECT id, name, color, created_at, updated_at FROM note_contexts ORDER BY LOWER(name) ASC"
            )
            return [dict(row) for row in rows]

    @staticmethod
    def create_context(name: str, color: Optional[str] = None) -> int:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ValueError("Nome do contexto e obrigatorio")
        with Database() as db:
            db.execute(
                "INSERT INTO note_contexts (name, color, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (normalized_name, NoteEngine._normalize_color(color, NoteEngine.DEFAULT_CONTEXT_COLOR)),
            )
            return db.lastrowid

    @staticmethod
    def update_context(context_id: int, name: str, color: Optional[str] = None) -> bool:
        normalized_name = (name or "").strip()
        if not normalized_name:
            raise ValueError("Nome do contexto e obrigatorio")
        with Database() as db:
            db.execute(
                "UPDATE note_contexts SET name = ?, color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (normalized_name, NoteEngine._normalize_color(color, NoteEngine.DEFAULT_CONTEXT_COLOR), context_id),
            )
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def delete_context(context_id: int) -> bool:
        with Database() as db:
            db.execute("UPDATE notes SET context_id = NULL WHERE context_id = ?", (context_id,))
            db.execute("DELETE FROM note_contexts WHERE id = ?", (context_id,))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def list_notes(context_id: Optional[int] = None, query: Optional[str] = None) -> List[Dict[str, Any]]:
        sql = """
            SELECT
                n.id,
                n.context_id,
                c.name AS context_name,
                c.color AS context_color,
                n.title,
                n.content,
                n.title_color,
                n.created_at,
                n.updated_at
            FROM notes n
            LEFT JOIN note_contexts c ON c.id = n.context_id
            WHERE 1=1
        """
        params: List[Any] = []
        if context_id is not None:
            sql += " AND n.context_id = ?"
            params.append(context_id)
        if query:
            sql += " AND (LOWER(n.title) LIKE ? OR LOWER(COALESCE(n.content, '')) LIKE ? OR LOWER(COALESCE(c.name, '')) LIKE ?)"
            token = f"%{query.strip().lower()}%"
            params.extend([token, token, token])
        sql += " ORDER BY datetime(n.updated_at) DESC, datetime(n.created_at) DESC, n.id DESC"
        with Database() as db:
            rows = db.fetchall(sql, tuple(params))
            return [dict(row) for row in rows]

    @staticmethod
    def create_note(title: str, content: Optional[str] = None, context_id: Optional[int] = None, title_color: Optional[str] = None) -> int:
        normalized_title = (title or "").strip() or "Sem titulo"
        with Database() as db:
            db.execute(
                "INSERT INTO notes (context_id, title, content, title_color, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
                (context_id, normalized_title, content or "", NoteEngine._normalize_color(title_color, NoteEngine.DEFAULT_NOTE_COLOR)),
            )
            return db.lastrowid

    @staticmethod
    def update_note(note_id: int, title: str, content: Optional[str] = None, context_id: Optional[int] = None, title_color: Optional[str] = None) -> bool:
        normalized_title = (title or "").strip() or "Sem titulo"
        with Database() as db:
            db.execute(
                "UPDATE notes SET context_id = ?, title = ?, content = ?, title_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (context_id, normalized_title, content or "", NoteEngine._normalize_color(title_color, NoteEngine.DEFAULT_NOTE_COLOR), note_id),
            )
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def delete_note(note_id: int) -> bool:
        with Database() as db:
            db.execute("DELETE FROM notes WHERE id = ?", (note_id,))
            return db.execute("SELECT changes() AS c").fetchone()[0] > 0

    @staticmethod
    def search(query: str) -> Dict[str, Any]:
        normalized_query = (query or "").strip()
        if not normalized_query:
            return {"query": "", "notes": [], "journal_entries": []}
        token = f"%{normalized_query.lower()}%"
        with Database() as db:
            note_rows = db.fetchall(
                """
                SELECT n.id, n.title, n.content, c.name AS context_name, n.updated_at
                FROM notes n
                LEFT JOIN note_contexts c ON c.id = n.context_id
                WHERE LOWER(n.title) LIKE ?
                   OR LOWER(COALESCE(n.content, '')) LIKE ?
                   OR LOWER(COALESCE(c.name, '')) LIKE ?
                ORDER BY datetime(n.updated_at) DESC
                LIMIT 20
                """,
                (token, token, token),
            )
            journal_rows = db.fetchall(
                """
                SELECT id, week_start, week_end, title, content, updated_at
                FROM weekly_journal_entries
                WHERE LOWER(COALESCE(title, '')) LIKE ?
                   OR LOWER(COALESCE(content, '')) LIKE ?
                ORDER BY week_start DESC
                LIMIT 12
                """,
                (token, token),
            )
        return {
            "query": normalized_query,
            "notes": [dict(row) for row in note_rows],
            "journal_entries": [dict(row) for row in journal_rows],
        }

    @staticmethod
    def get_journal_settings() -> Dict[str, Any]:
        with Database() as db:
            row = db.fetchone("SELECT enabled, reminder_time, updated_at FROM weekly_journal_settings WHERE id = 1")
            if not row:
                db.execute(
                    "INSERT OR IGNORE INTO weekly_journal_settings (id, enabled, reminder_time) VALUES (1, 1, ?)",
                    (NoteEngine.DEFAULT_JOURNAL_TIME,),
                )
                row = db.fetchone("SELECT enabled, reminder_time, updated_at FROM weekly_journal_settings WHERE id = 1")
            data = dict(row)
            data["enabled"] = bool(data.get("enabled"))
            return data

    @staticmethod
    def update_journal_settings(enabled: bool, reminder_time: str) -> Dict[str, Any]:
        with Database() as db:
            db.execute(
                """
                INSERT INTO weekly_journal_settings (id, enabled, reminder_time, updated_at)
                VALUES (1, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(id) DO UPDATE SET
                    enabled = excluded.enabled,
                    reminder_time = excluded.reminder_time,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (1 if enabled else 0, reminder_time or NoteEngine.DEFAULT_JOURNAL_TIME),
            )
        return NoteEngine.get_journal_settings()

    @staticmethod
    def get_journal_entry(reference_date: Optional[str] = None) -> Dict[str, Any]:
        bounds = NoteEngine._week_bounds(reference_date)
        with Database() as db:
            row = db.fetchone(
                "SELECT id, week_start, week_end, title, content, created_at, updated_at FROM weekly_journal_entries WHERE week_start = ?",
                (bounds["week_start"],),
            )
        entry = dict(row) if row else None
        return {
            "week": bounds,
            "entry": entry,
            "pending": entry is None,
        }

    @staticmethod
    def list_journal_entries(limit: int = 12) -> List[Dict[str, Any]]:
        with Database() as db:
            rows = db.fetchall(
                "SELECT id, week_start, week_end, title, content, created_at, updated_at FROM weekly_journal_entries ORDER BY week_start DESC LIMIT ?",
                (limit,),
            )
            return [dict(row) for row in rows]

    @staticmethod
    def upsert_journal_entry(content: str, title: Optional[str] = None, reference_date: Optional[str] = None) -> Dict[str, Any]:
        bounds = NoteEngine._week_bounds(reference_date)
        journal_title = (title or "").strip() or f"Diario semanal {bounds['label']}"
        with Database() as db:
            db.execute(
                """
                INSERT INTO weekly_journal_entries (week_start, week_end, title, content, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(week_start) DO UPDATE SET
                    week_end = excluded.week_end,
                    title = excluded.title,
                    content = excluded.content,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (bounds["week_start"], bounds["week_end"], journal_title, content or ""),
            )
            row = db.fetchone(
                "SELECT id, week_start, week_end, title, content, created_at, updated_at FROM weekly_journal_entries WHERE week_start = ?",
                (bounds["week_start"],),
            )
            db.execute(
                """
                UPDATE notifications
                SET status = 'completed',
                    read_at = COALESCE(read_at, CURRENT_TIMESTAMP),
                    completed_at = CURRENT_TIMESTAMP
                WHERE notification_type = 'weekly_journal_prompt'
                  AND unique_key = ?
                  AND status != 'completed'
                """,
                (f"weekly_journal_prompt:{bounds['week_start']}",),
            )
        return dict(row)

    @staticmethod
    def is_weekly_journal_due(now: Optional[datetime] = None) -> bool:
        current = now or datetime.now()
        settings = NoteEngine.get_journal_settings()
        if not settings.get("enabled", True):
            return False
        if current.weekday() != 6:
            return False
        reminder_time = settings.get("reminder_time") or NoteEngine.DEFAULT_JOURNAL_TIME
        reminder_hour, reminder_minute = [int(part) for part in reminder_time.split(":")]
        scheduled_time = datetime.combine(current.date(), time(hour=reminder_hour, minute=reminder_minute))
        if current < scheduled_time:
            return False
        current_entry = NoteEngine.get_journal_entry(current.date().isoformat())
        return current_entry.get("entry") is None
