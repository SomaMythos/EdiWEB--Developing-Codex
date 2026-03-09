import json
from datetime import date as date_cls, datetime, timedelta
from typing import Optional

from data.database import Database


class CalendarEngine:
    @staticmethod
    def _parse_date(date_value: str):
        normalized = (date_value or '').strip()
        if not normalized:
            raise ValueError('date is required')
        try:
            return datetime.strptime(normalized, '%Y-%m-%d').date()
        except ValueError as exc:
            raise ValueError('date must use YYYY-MM-DD') from exc

    @staticmethod
    def _parse_month(month_value: str):
        normalized = (month_value or '').strip()
        if not normalized:
            raise ValueError('month is required')
        try:
            parsed = datetime.strptime(normalized, '%Y-%m')
        except ValueError as exc:
            raise ValueError('month must use YYYY-MM') from exc

        month_start = parsed.date().replace(day=1)
        next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        return month_start, next_month

    @staticmethod
    def _build_log_summary(event_type: str, details: dict) -> str:
        if event_type == 'daily_completed':
            duration = details.get('duration')
            return f"Daily concluida{f' em {duration} min' if duration else ''}"
        if event_type == 'goal_completed':
            return 'Meta concluida'
        if event_type == 'painting_created':
            return 'Arte visual adicionada'
        if event_type == 'painting_progress':
            return 'Atualizacao de progresso em arte visual'
        if event_type == 'painting_completed':
            return 'Arte visual concluida'
        if event_type == 'book_created':
            return 'Livro adicionado'
        if event_type == 'reading_session':
            pages = details.get('pages_read')
            return f"Sessao de leitura{f' ({pages} pags)' if pages else ''}"
        if event_type == 'book_finished':
            return 'Livro concluido'
        if event_type == 'watch_completed':
            return 'Registro em Assistir concluido'
        if event_type == 'music_training_session':
            bpm = details.get('bpm')
            return f"Treino musical{f' a {bpm} BPM' if bpm else ''}"
        if event_type == 'album_listened_confirmation':
            return 'Album ouvido'
        return 'Registro automatico'

    @staticmethod
    def _normalize_automatic_rows(rows):
        normalized = []
        for row in rows:
            details = json.loads(row['details'] or '{}')
            normalized.append(
                {
                    'id': row['item_id'],
                    'entry_type': 'automatic_log',
                    'source_module': row['source_module'],
                    'event_type': row['event_type'],
                    'date': row['event_date'],
                    'timestamp': row['event_timestamp'],
                    'title': row['title'],
                    'description': CalendarEngine._build_log_summary(row['event_type'], details),
                    'details': details,
                }
            )
        return normalized

    @staticmethod
    def _list_automatic_logs(db, from_date: str, to_date: str):
        rows = db.fetchall(
            """
            SELECT * FROM (
                SELECT
                    'daily-block:' || dpb.id AS item_id,
                    dpb.date AS event_date,
                    CASE
                        WHEN COALESCE(dpb.start_time, '') = '' THEN dpb.date || 'T00:00:00'
                        ELSE dpb.date || 'T' || dpb.start_time || ':00'
                    END AS event_timestamp,
                    'daily' AS source_module,
                    'daily_completed' AS event_type,
                    COALESCE(a.title, dpb.block_name, 'Atividade concluida') AS title,
                    json_object(
                        'activity_id', dpb.activity_id,
                        'duration', COALESCE(dpb.duration, 0),
                        'source', 'daily_plan_block'
                    ) AS details
                FROM daily_plan_blocks dpb
                LEFT JOIN activities a ON a.id = dpb.activity_id
                WHERE COALESCE(dpb.completed, 0) = 1
                  AND dpb.activity_id IS NOT NULL

                UNION ALL

                SELECT
                    'daily-log:' || dal.id AS item_id,
                    dl.date AS event_date,
                    CASE
                        WHEN COALESCE(dal.timestamp, '') = '' THEN dl.date || 'T00:00:00'
                        ELSE dl.date || 'T' || dal.timestamp
                    END AS event_timestamp,
                    'daily' AS source_module,
                    'daily_completed' AS event_type,
                    COALESCE(a.title, 'Atividade concluida') AS title,
                    json_object(
                        'activity_id', a.id,
                        'duration', COALESCE(dal.duration, 0),
                        'source', 'daily_activity_log'
                    ) AS details
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                LEFT JOIN activities a ON a.id = dal.activity_id
                WHERE COALESCE(dal.completed, 0) = 1

                UNION ALL

                SELECT
                    'goal:' || g.id AS item_id,
                    date(g.completed_at) AS event_date,
                    g.completed_at AS event_timestamp,
                    'goals' AS source_module,
                    'goal_completed' AS event_type,
                    g.title AS title,
                    json_object(
                        'goal_id', g.id,
                        'difficulty', COALESCE(g.difficulty, 1)
                    ) AS details
                FROM goals g
                WHERE g.status = 'concluida'
                  AND g.completed_at IS NOT NULL

                UNION ALL

                SELECT
                    'painting-created:' || p.id AS item_id,
                    date(p.created_at) AS event_date,
                    p.created_at AS event_timestamp,
                    'artes' AS source_module,
                    'painting_created' AS event_type,
                    p.title AS title,
                    json_object(
                        'painting_id', p.id,
                        'category', COALESCE(p.visual_category, p.category, 'artes')
                    ) AS details
                FROM paintings p
                WHERE p.created_at IS NOT NULL

                UNION ALL

                SELECT
                    'painting-progress:' || pp.id AS item_id,
                    date(pp.timestamp) AS event_date,
                    pp.timestamp AS event_timestamp,
                    'artes' AS source_module,
                    'painting_progress' AS event_type,
                    COALESCE(pp.update_title, p.title, 'Atualizacao de pintura') AS title,
                    json_object(
                        'painting_id', p.id,
                        'time_spent', COALESCE(pp.time_spent, 0)
                    ) AS details
                FROM painting_progress pp
                JOIN paintings p ON p.id = pp.painting_id
                WHERE pp.timestamp IS NOT NULL

                UNION ALL

                SELECT
                    'painting-finished:' || p.id AS item_id,
                    date(p.finished_at) AS event_date,
                    p.finished_at AS event_timestamp,
                    'artes' AS source_module,
                    'painting_completed' AS event_type,
                    p.title AS title,
                    json_object(
                        'painting_id', p.id,
                        'time_spent', COALESCE(p.time_spent, 0)
                    ) AS details
                FROM paintings p
                WHERE p.finished_at IS NOT NULL

                UNION ALL

                SELECT
                    'book-created:' || b.id AS item_id,
                    date(b.created_at) AS event_date,
                    b.created_at AS event_timestamp,
                    'leitura' AS source_module,
                    'book_created' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'book_type', COALESCE(b.book_type, 'Livro')
                    ) AS details
                FROM books b
                WHERE b.created_at IS NOT NULL

                UNION ALL

                SELECT
                    'reading-session:' || rs.id AS item_id,
                    date(COALESCE(rs.read_at, rs.date || 'T00:00:00')) AS event_date,
                    COALESCE(rs.read_at, rs.date || 'T00:00:00') AS event_timestamp,
                    'leitura' AS source_module,
                    'reading_session' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'pages_read', COALESCE(rs.pages_read, 0),
                        'duration', COALESCE(rs.duration, 0)
                    ) AS details
                FROM reading_sessions rs
                JOIN books b ON b.id = rs.book_id

                UNION ALL

                SELECT
                    'book-finished:' || b.id AS item_id,
                    date(b.finished_at) AS event_date,
                    b.finished_at AS event_timestamp,
                    'leitura' AS source_module,
                    'book_finished' AS event_type,
                    b.title AS title,
                    json_object(
                        'book_id', b.id,
                        'total_pages', COALESCE(b.total_pages, 0)
                    ) AS details
                FROM books b
                WHERE b.finished_at IS NOT NULL

                UNION ALL

                SELECT
                    'watch:' || wi.id AS item_id,
                    date(wi.watched_at) AS event_date,
                    wi.watched_at AS event_timestamp,
                    'assistir' AS source_module,
                    'watch_completed' AS event_type,
                    wi.name AS title,
                    json_object(
                        'watch_item_id', wi.id,
                        'category', COALESCE(wc.name, 'Assistir')
                    ) AS details
                FROM watch_items wi
                LEFT JOIN watch_categories wc ON wc.id = wi.category_id
                WHERE wi.watched_at IS NOT NULL

                UNION ALL

                SELECT
                    'music-training:' || mts.id AS item_id,
                    date(mts.created_at) AS event_date,
                    mts.created_at AS event_timestamp,
                    'musica' AS source_module,
                    'music_training_session' AS event_type,
                    mtt.name AS title,
                    json_object(
                        'training_id', mtt.id,
                        'instrument', COALESCE(mtt.instrument, ''),
                        'bpm', COALESCE(mts.bpm, 0)
                    ) AS details
                FROM music_training_sessions mts
                JOIN music_training_tabs mtt ON mtt.id = mts.training_id
                WHERE mts.created_at IS NOT NULL

                UNION ALL

                SELECT
                    'album-listened:' || ma.id AS item_id,
                    date(ma.created_at) AS event_date,
                    ma.created_at AS event_timestamp,
                    'musica' AS source_module,
                    'album_listened_confirmation' AS event_type,
                    ma.name AS title,
                    json_object(
                        'album_id', ma.id,
                        'artist', COALESCE(mart.name, '')
                    ) AS details
                FROM music_albums ma
                LEFT JOIN music_artists mart ON mart.id = ma.artist_id
                WHERE ma.status = 'listened'
                  AND ma.created_at IS NOT NULL
            ) calendar_logs
            WHERE event_date >= ? AND event_date < ?
            ORDER BY datetime(event_timestamp) ASC, title ASC
            """,
            (from_date, to_date),
        )
        return CalendarEngine._normalize_automatic_rows(rows)

    @staticmethod
    def create_event(date: str, title: str, description: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None):
        event_date = CalendarEngine._parse_date(date).isoformat()
        normalized_title = (title or '').strip()
        if not normalized_title:
            raise ValueError('title is required')

        with Database() as db:
            db.execute(
                """
                INSERT INTO calendar_events (event_date, title, description, start_time, end_time)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    event_date,
                    normalized_title,
                    (description or '').strip() or None,
                    (start_time or '').strip() or None,
                    (end_time or '').strip() or None,
                ),
            )
            return db.lastrowid

    @staticmethod
    def update_event(event_id: int, date: str, title: str, description: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None):
        event_date = CalendarEngine._parse_date(date).isoformat()
        normalized_title = (title or '').strip()
        if not normalized_title:
            raise ValueError('title is required')

        with Database() as db:
            result = db.execute(
                """
                UPDATE calendar_events
                SET event_date = ?, title = ?, description = ?, start_time = ?, end_time = ?
                WHERE id = ?
                """,
                (
                    event_date,
                    normalized_title,
                    (description or '').strip() or None,
                    (start_time or '').strip() or None,
                    (end_time or '').strip() or None,
                    event_id,
                ),
            )
            return result.rowcount > 0

    @staticmethod
    def delete_event(event_id: int):
        with Database() as db:
            result = db.execute('DELETE FROM calendar_events WHERE id = ?', (event_id,))
            return result.rowcount > 0

    @staticmethod
    def create_manual_log(date: str, title: str, description: Optional[str] = None):
        log_date = CalendarEngine._parse_date(date).isoformat()
        normalized_title = (title or '').strip()
        if not normalized_title:
            raise ValueError('title is required')

        with Database() as db:
            db.execute(
                """
                INSERT INTO calendar_manual_logs (log_date, title, description)
                VALUES (?, ?, ?)
                """,
                (log_date, normalized_title, (description or '').strip() or None),
            )
            return db.lastrowid

    @staticmethod
    def update_manual_log(log_id: int, date: str, title: str, description: Optional[str] = None):
        log_date = CalendarEngine._parse_date(date).isoformat()
        normalized_title = (title or '').strip()
        if not normalized_title:
            raise ValueError('title is required')

        with Database() as db:
            result = db.execute(
                """
                UPDATE calendar_manual_logs
                SET log_date = ?, title = ?, description = ?
                WHERE id = ?
                """,
                (log_date, normalized_title, (description or '').strip() or None, log_id),
            )
            return result.rowcount > 0

    @staticmethod
    def delete_manual_log(log_id: int):
        with Database() as db:
            result = db.execute('DELETE FROM calendar_manual_logs WHERE id = ?', (log_id,))
            return result.rowcount > 0

    @staticmethod
    def get_month_overview(month: str):
        start_date, next_month = CalendarEngine._parse_month(month)
        start_iso = start_date.isoformat()
        end_iso = next_month.isoformat()

        with Database() as db:
            manual_events = [
                dict(row) for row in db.fetchall(
                    """
                    SELECT id, event_date AS date, title, description, start_time, end_time, created_at
                    FROM calendar_events
                    WHERE event_date >= ? AND event_date < ?
                    ORDER BY event_date ASC, COALESCE(start_time, '23:59') ASC, title ASC
                    """,
                    (start_iso, end_iso),
                )
            ]
            manual_logs = [
                dict(row) for row in db.fetchall(
                    """
                    SELECT id, log_date AS date, title, description, created_at
                    FROM calendar_manual_logs
                    WHERE log_date >= ? AND log_date < ?
                    ORDER BY log_date ASC, created_at ASC, title ASC
                    """,
                    (start_iso, end_iso),
                )
            ]
            automatic_logs = CalendarEngine._list_automatic_logs(db, start_iso, end_iso)

        day_map = {}

        def ensure_bucket(day_key: str):
            return day_map.setdefault(
                day_key,
                {
                    'manual_events': 0,
                    'manual_logs': 0,
                    'automatic_logs': 0,
                    'has_manual_event': False,
                },
            )

        for event in manual_events:
            bucket = ensure_bucket(event['date'])
            bucket['manual_events'] += 1
            bucket['has_manual_event'] = True

        for log in manual_logs:
            bucket = ensure_bucket(log['date'])
            bucket['manual_logs'] += 1

        for log in automatic_logs:
            bucket = ensure_bucket(log['date'])
            bucket['automatic_logs'] += 1

        return {
            'month': start_date.strftime('%Y-%m'),
            'days': day_map,
            'manual_events': manual_events,
            'manual_logs': manual_logs,
        }

    @staticmethod
    def get_day_view(date: str):
        target_date = CalendarEngine._parse_date(date)
        next_date = target_date + timedelta(days=1)
        target_iso = target_date.isoformat()

        with Database() as db:
            events = [
                {
                    **dict(row),
                    'entry_type': 'manual_event',
                    'date': row['event_date'],
                }
                for row in db.fetchall(
                    """
                    SELECT id, event_date, title, description, start_time, end_time, created_at
                    FROM calendar_events
                    WHERE event_date = ?
                    ORDER BY COALESCE(start_time, '23:59') ASC, title ASC
                    """,
                    (target_iso,),
                )
            ]
            manual_logs = [
                {
                    **dict(row),
                    'entry_type': 'manual_log',
                    'date': row['log_date'],
                }
                for row in db.fetchall(
                    """
                    SELECT id, log_date, title, description, created_at
                    FROM calendar_manual_logs
                    WHERE log_date = ?
                    ORDER BY created_at DESC, title ASC
                    """,
                    (target_iso,),
                )
            ]
            automatic_logs = CalendarEngine._list_automatic_logs(db, target_iso, next_date.isoformat())

        return {
            'date': target_iso,
            'events': events,
            'manual_logs': manual_logs,
            'automatic_logs': automatic_logs,
            'summary': {
                'manual_events': len(events),
                'manual_logs': len(manual_logs),
                'automatic_logs': len(automatic_logs),
            },
        }

