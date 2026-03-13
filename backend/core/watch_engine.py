from typing import Any, Dict, List, Optional

from data.database import Database


class WatchEngine:
    MEDIA_TYPES = {
        'movie': 'Filme',
        'series': 'Série',
        'anime': 'Anime',
        'video_long': 'Vídeo longo',
    }
    STATUSES = {
        'backlog': 'Na lista',
        'watching': 'Assistindo',
        'paused': 'Pausado',
        'completed': 'Concluído',
        'rewatch': 'Rever',
        'dropped': 'Dropado',
    }
    EPISODIC_TYPES = {'series', 'anime'}

    @staticmethod
    def _clean_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = str(value).strip()
        return value or None

    @staticmethod
    def _clean_int(value: Any) -> Optional[int]:
        if value in (None, '', 'null'):
            return None
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            return None
        return max(parsed, 0)

    @staticmethod
    def _normalize_media_type(value: Optional[str]) -> str:
        token = (value or 'movie').strip().lower()
        return token if token in WatchEngine.MEDIA_TYPES else 'movie'

    @staticmethod
    def _normalize_status(value: Optional[str]) -> str:
        token = (value or 'backlog').strip().lower()
        return token if token in WatchEngine.STATUSES else 'backlog'

    @staticmethod
    def _current_timestamp(db: Database) -> str:
        return db.fetchone("SELECT CURRENT_TIMESTAMP AS now")['now']

    @staticmethod
    def _ensure_default_category(db: Database) -> int:
        row = db.fetchone(
            "SELECT id FROM watch_categories WHERE lower(name) = lower(?)",
            ('Geral',),
        )
        if row:
            return row['id']

        db.execute(
            "INSERT INTO watch_categories (name) VALUES (?)",
            ('Geral',),
        )
        return db.lastrowid

    @staticmethod
    def _resolve_category_id(db: Database, category_id: Optional[Any]) -> int:
        normalized_id = WatchEngine._clean_int(category_id)
        if normalized_id:
            row = db.fetchone(
                "SELECT id FROM watch_categories WHERE id = ?",
                (normalized_id,),
            )
            if row:
                return row['id']
        return WatchEngine._ensure_default_category(db)

    @staticmethod
    def _fetch_item_row(db: Database, item_id: int):
        return db.fetchone(
            """
            SELECT
                wi.id,
                wi.category_id,
                wc.name AS category_name,
                wi.name,
                wi.image_path,
                wi.media_type,
                wi.status,
                wi.description,
                wi.watch_with,
                wi.total_seasons,
                wi.total_episodes,
                wi.current_season,
                wi.current_episode,
                wi.started_at,
                wi.completed_at,
                wi.watched_at,
                wi.last_logged_at,
                wi.last_log_summary,
                wi.created_at,
                wi.updated_at
            FROM watch_items wi
            LEFT JOIN watch_categories wc ON wc.id = wi.category_id
            WHERE wi.id = ?
            """,
            (item_id,),
        )

    @staticmethod
    def _progress_label(item: Dict[str, Any]) -> Optional[str]:
        if item.get('media_type') not in WatchEngine.EPISODIC_TYPES:
            return 'Concluído' if item.get('status') == 'completed' else None

        current_season = item.get('current_season') or 0
        current_episode = item.get('current_episode') or 0
        total_seasons = item.get('total_seasons') or 0
        total_episodes = item.get('total_episodes') or 0

        tokens = []
        if current_season:
            tokens.append(f'T{current_season}')
        if current_episode:
            tokens.append(f'E{current_episode}')

        head = ' · '.join(tokens) if tokens else 'Sem progresso'
        tails = []
        if total_seasons:
            tails.append(f'{total_seasons} temp.')
        if total_episodes:
            tails.append(f'{total_episodes} eps.')
        if tails:
            return f"{head} / {' · '.join(tails)}"
        return head

    @staticmethod
    def _progress_percent(item: Dict[str, Any]) -> Optional[int]:
        if item.get('media_type') not in WatchEngine.EPISODIC_TYPES:
            return 100 if item.get('status') == 'completed' else None

        total_episodes = item.get('total_episodes') or 0
        current_episode = item.get('current_episode') or 0
        if total_episodes <= 0:
            return None
        return max(0, min(100, round((current_episode / total_episodes) * 100)))

    @staticmethod
    def _serialize_item(row) -> Dict[str, Any]:
        item = dict(row)
        item['media_type_label'] = WatchEngine.MEDIA_TYPES.get(item.get('media_type'), 'Filme')
        item['status_label'] = WatchEngine.STATUSES.get(item.get('status'), 'Na lista')
        item['progress_label'] = WatchEngine._progress_label(item)
        item['progress_percent'] = WatchEngine._progress_percent(item)
        item['is_episodic'] = item.get('media_type') in WatchEngine.EPISODIC_TYPES
        return item

    @staticmethod
    def _build_log_summary(item: Dict[str, Any], action: str, season_number: Optional[int], episode_number: Optional[int]) -> str:
        title = item.get('name') or 'Item'
        is_episodic = item.get('media_type') in WatchEngine.EPISODIC_TYPES

        if action == 'completed':
            return f'Concluiu {title}.'
        if action == 'paused':
            return f'Pausou {title}.'
        if action == 'dropped':
            return f'Dropou {title}.'
        if action == 'rewatch':
            return f'Retomou {title} para rever.'
        if is_episodic and season_number and episode_number:
            return f'Assistiu T{season_number}E{episode_number} de {title}.'
        if is_episodic and episode_number:
            return f'Assistiu E{episode_number} de {title}.'
        if is_episodic and season_number:
            return f'Avançou na temporada {season_number} de {title}.'
        return f'Avançou em {title}.'

    @staticmethod
    def create_category(name):
        with Database() as db:
            db.execute(
                "INSERT INTO watch_categories (name) VALUES (?)",
                (name.strip(),),
            )
            return db.lastrowid

    @staticmethod
    def list_categories():
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    wc.id,
                    wc.name,
                    COUNT(wi.id) AS item_count,
                    SUM(CASE WHEN wi.status IN ('watching', 'paused', 'rewatch') THEN 1 ELSE 0 END) AS active_count
                FROM watch_categories wc
                LEFT JOIN watch_items wi ON wi.category_id = wc.id
                GROUP BY wc.id, wc.name
                ORDER BY wc.name COLLATE NOCASE ASC
                """
            )
        return [dict(r) for r in rows]

    @staticmethod
    def create_item(category_id=None, name=None, image_path=None, **extra):
        title = WatchEngine._clean_text(name)
        if not title:
            raise ValueError('Nome do item é obrigatório.')

        media_type = WatchEngine._normalize_media_type(extra.get('media_type'))
        status = WatchEngine._normalize_status(extra.get('status'))
        description = WatchEngine._clean_text(extra.get('description'))
        watch_with = WatchEngine._clean_text(extra.get('watch_with'))
        total_seasons = WatchEngine._clean_int(extra.get('total_seasons'))
        total_episodes = WatchEngine._clean_int(extra.get('total_episodes'))
        current_season = WatchEngine._clean_int(extra.get('current_season')) or 0
        current_episode = WatchEngine._clean_int(extra.get('current_episode')) or 0

        with Database() as db:
            resolved_category_id = WatchEngine._resolve_category_id(db, category_id)
            now = WatchEngine._current_timestamp(db)

            started_at = None
            completed_at = None
            watched_at = None
            if status in {'watching', 'paused', 'rewatch'} or current_season or current_episode:
                started_at = now
            if status == 'completed':
                completed_at = now
                watched_at = now
                started_at = started_at or now

            db.execute(
                """
                INSERT INTO watch_items (
                    category_id,
                    name,
                    image_path,
                    media_type,
                    status,
                    description,
                    watch_with,
                    total_seasons,
                    total_episodes,
                    current_season,
                    current_episode,
                    started_at,
                    completed_at,
                    watched_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    resolved_category_id,
                    title,
                    image_path,
                    media_type,
                    status,
                    description,
                    watch_with,
                    total_seasons,
                    total_episodes,
                    current_season,
                    current_episode,
                    started_at,
                    completed_at,
                    watched_at,
                    now,
                ),
            )
            item_id = db.lastrowid
            row = WatchEngine._fetch_item_row(db, item_id)
        return WatchEngine._serialize_item(row)

    @staticmethod
    def update_item(item_id: int, **changes):
        with Database() as db:
            current = WatchEngine._fetch_item_row(db, item_id)
            if not current:
                raise ValueError('Item não encontrado.')

            current = dict(current)
            name = WatchEngine._clean_text(changes.get('name')) or current['name']
            image_path = changes.get('image_path', current.get('image_path'))
            media_type = WatchEngine._normalize_media_type(changes.get('media_type') or current.get('media_type'))
            status = WatchEngine._normalize_status(changes.get('status') or current.get('status'))
            description = WatchEngine._clean_text(changes.get('description'))
            if description is None and 'description' not in changes:
                description = current.get('description')
            watch_with = WatchEngine._clean_text(changes.get('watch_with'))
            if watch_with is None and 'watch_with' not in changes:
                watch_with = current.get('watch_with')
            total_seasons = WatchEngine._clean_int(changes.get('total_seasons'))
            if total_seasons is None and 'total_seasons' not in changes:
                total_seasons = current.get('total_seasons')
            total_episodes = WatchEngine._clean_int(changes.get('total_episodes'))
            if total_episodes is None and 'total_episodes' not in changes:
                total_episodes = current.get('total_episodes')
            current_season = WatchEngine._clean_int(changes.get('current_season'))
            if current_season is None and 'current_season' not in changes:
                current_season = current.get('current_season') or 0
            current_episode = WatchEngine._clean_int(changes.get('current_episode'))
            if current_episode is None and 'current_episode' not in changes:
                current_episode = current.get('current_episode') or 0

            resolved_category_id = WatchEngine._resolve_category_id(db, changes.get('category_id', current.get('category_id')))
            now = WatchEngine._current_timestamp(db)
            started_at = current.get('started_at')
            completed_at = current.get('completed_at')
            watched_at = current.get('watched_at')

            if status in {'watching', 'paused', 'rewatch'} and not started_at:
                started_at = now
            if status == 'completed':
                completed_at = completed_at or now
                watched_at = watched_at or completed_at
                started_at = started_at or completed_at

            db.execute(
                """
                UPDATE watch_items
                SET category_id = ?,
                    name = ?,
                    image_path = ?,
                    media_type = ?,
                    status = ?,
                    description = ?,
                    watch_with = ?,
                    total_seasons = ?,
                    total_episodes = ?,
                    current_season = ?,
                    current_episode = ?,
                    started_at = ?,
                    completed_at = ?,
                    watched_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    resolved_category_id,
                    name,
                    image_path,
                    media_type,
                    status,
                    description,
                    watch_with,
                    total_seasons,
                    total_episodes,
                    current_season,
                    current_episode,
                    started_at,
                    completed_at,
                    watched_at,
                    now,
                    item_id,
                ),
            )
            row = WatchEngine._fetch_item_row(db, item_id)
        return WatchEngine._serialize_item(row)

    @staticmethod
    def delete_item(item_id: int):
        with Database() as db:
            db.execute("DELETE FROM watch_logs WHERE item_id = ?", (item_id,))
            db.execute("DELETE FROM watch_items WHERE id = ?", (item_id,))

    @staticmethod
    def add_log(item_id: int, action: str = 'progress', season_number=None, episode_number=None, note=None):
        action = (action or 'progress').strip().lower()
        if action not in {'progress', 'completed', 'paused', 'dropped', 'rewatch'}:
            action = 'progress'

        with Database() as db:
            item_row = WatchEngine._fetch_item_row(db, item_id)
            if not item_row:
                raise ValueError('Item não encontrado.')

            item = dict(item_row)
            season_number = WatchEngine._clean_int(season_number)
            episode_number = WatchEngine._clean_int(episode_number)
            note = WatchEngine._clean_text(note)
            logged_at = WatchEngine._current_timestamp(db)

            current_season = item.get('current_season') or 0
            current_episode = item.get('current_episode') or 0
            status = item.get('status') or 'backlog'
            started_at = item.get('started_at')
            completed_at = item.get('completed_at')
            watched_at = item.get('watched_at')

            if season_number is not None:
                current_season = max(current_season, season_number)
            if episode_number is not None:
                current_episode = max(current_episode, episode_number)

            if action == 'completed':
                status = 'completed'
                completed_at = logged_at
                watched_at = logged_at
                started_at = started_at or logged_at
            elif action == 'paused':
                status = 'paused'
                started_at = started_at or logged_at
            elif action == 'dropped':
                status = 'dropped'
                started_at = started_at or logged_at
            elif action == 'rewatch':
                status = 'rewatch'
                started_at = started_at or logged_at
            else:
                if status in {'backlog', 'paused', 'dropped'}:
                    status = 'watching'
                started_at = started_at or logged_at

            summary = WatchEngine._build_log_summary(item, action, season_number, episode_number)
            db.execute(
                """
                INSERT INTO watch_logs (
                    item_id,
                    action,
                    summary,
                    season_number,
                    episode_number,
                    note,
                    logged_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (item_id, action, summary, season_number, episode_number, note, logged_at),
            )
            log_id = db.lastrowid

            db.execute(
                """
                UPDATE watch_items
                SET status = ?,
                    current_season = ?,
                    current_episode = ?,
                    started_at = ?,
                    completed_at = ?,
                    watched_at = ?,
                    last_logged_at = ?,
                    last_log_summary = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    current_season,
                    current_episode,
                    started_at,
                    completed_at,
                    watched_at,
                    logged_at,
                    summary,
                    logged_at,
                    item_id,
                ),
            )

            row = WatchEngine._fetch_item_row(db, item_id)
            log_row = db.fetchone(
                """
                SELECT
                    wl.id,
                    wl.item_id,
                    wl.action,
                    wl.summary,
                    wl.season_number,
                    wl.episode_number,
                    wl.note,
                    wl.logged_at,
                    wi.name,
                    wi.media_type,
                    wi.image_path,
                    wc.name AS category_name
                FROM watch_logs wl
                JOIN watch_items wi ON wi.id = wl.item_id
                LEFT JOIN watch_categories wc ON wc.id = wi.category_id
                WHERE wl.id = ?
                """,
                (log_id,),
            )

        return {
            'item': WatchEngine._serialize_item(row),
            'log': dict(log_row),
        }

    @staticmethod
    def mark_watched(item_id):
        WatchEngine.add_log(item_id, action='completed')

    @staticmethod
    def list_items(category_id=None, status=None, media_type=None, search=None, limit=None):
        conditions = []
        params: List[Any] = []

        if category_id is not None:
            conditions.append('wi.category_id = ?')
            params.append(category_id)
        if status:
            conditions.append('wi.status = ?')
            params.append(WatchEngine._normalize_status(status))
        if media_type:
            conditions.append('wi.media_type = ?')
            params.append(WatchEngine._normalize_media_type(media_type))
        if search:
            conditions.append('(wi.name LIKE ? OR wi.description LIKE ? OR wc.name LIKE ?)')
            token = f"%{search.strip()}%"
            params.extend([token, token, token])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ''
        limit_clause = 'LIMIT ?' if limit else ''
        if limit:
            params.append(limit)

        with Database() as db:
            rows = db.fetchall(
                f"""
                SELECT
                    wi.id,
                    wi.category_id,
                    wc.name AS category_name,
                    wi.name,
                    wi.image_path,
                    wi.media_type,
                    wi.status,
                    wi.description,
                    wi.watch_with,
                    wi.total_seasons,
                    wi.total_episodes,
                    wi.current_season,
                    wi.current_episode,
                    wi.started_at,
                    wi.completed_at,
                    wi.watched_at,
                    wi.last_logged_at,
                    wi.last_log_summary,
                    wi.created_at,
                    wi.updated_at
                FROM watch_items wi
                LEFT JOIN watch_categories wc ON wc.id = wi.category_id
                {where_clause}
                ORDER BY
                    CASE wi.status
                        WHEN 'watching' THEN 0
                        WHEN 'paused' THEN 1
                        WHEN 'rewatch' THEN 2
                        WHEN 'backlog' THEN 3
                        WHEN 'completed' THEN 4
                        ELSE 5
                    END,
                    COALESCE(wi.last_logged_at, wi.completed_at, wi.watched_at, wi.created_at) DESC,
                    wi.name COLLATE NOCASE ASC
                {limit_clause}
                """,
                tuple(params),
            )
        return [WatchEngine._serialize_item(row) for row in rows]

    @staticmethod
    def list_logs(limit: int = 20, item_id: Optional[int] = None):
        limit = max(1, min(int(limit or 20), 100))
        conditions = []
        params: List[Any] = []
        if item_id is not None:
            conditions.append('wl.item_id = ?')
            params.append(item_id)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ''
        params.append(limit)

        with Database() as db:
            rows = db.fetchall(
                f"""
                SELECT
                    wl.id,
                    wl.item_id,
                    wl.action,
                    wl.summary,
                    wl.season_number,
                    wl.episode_number,
                    wl.note,
                    wl.logged_at,
                    wi.name,
                    wi.media_type,
                    wi.image_path,
                    wi.status,
                    wc.name AS category_name
                FROM watch_logs wl
                JOIN watch_items wi ON wi.id = wl.item_id
                LEFT JOIN watch_categories wc ON wc.id = wi.category_id
                {where_clause}
                ORDER BY wl.logged_at DESC, wl.id DESC
                LIMIT ?
                """,
                tuple(params),
            )
        logs = []
        for row in rows:
            entry = dict(row)
            entry['media_type_label'] = WatchEngine.MEDIA_TYPES.get(entry.get('media_type'), 'Filme')
            entry['status_label'] = WatchEngine.STATUSES.get(entry.get('status'), 'Na lista')
            logs.append(entry)
        return logs

    @staticmethod
    def get_overview(limit_logs: int = 18):
        items = WatchEngine.list_items()
        stats = {
            'total_items': len(items),
            'by_status': {key: 0 for key in WatchEngine.STATUSES},
            'by_type': {key: 0 for key in WatchEngine.MEDIA_TYPES},
            'active_items': 0,
        }
        for item in items:
            status = item.get('status') or 'backlog'
            media_type = item.get('media_type') or 'movie'
            stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
            stats['by_type'][media_type] = stats['by_type'].get(media_type, 0) + 1
            if status in {'watching', 'paused', 'rewatch'}:
                stats['active_items'] += 1

        return {
            'items': items,
            'categories': WatchEngine.list_categories(),
            'recent_logs': WatchEngine.list_logs(limit_logs),
            'stats': stats,
        }
