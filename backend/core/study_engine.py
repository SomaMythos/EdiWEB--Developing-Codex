from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlparse
from urllib.request import urlopen
import xml.etree.ElementTree as ET

from data.database import Database


class StudyEngine:
    VIDEO_EXTENSIONS = (".mp4", ".webm", ".ogg", ".mov", ".m4v")
    ATOM_NS = {
        "atom": "http://www.w3.org/2005/Atom",
        "yt": "http://www.youtube.com/xml/schemas/2015",
    }

    @staticmethod
    def _clean_text(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @staticmethod
    def _clean_int(value: Any) -> Optional[int]:
        if value in (None, "", "null"):
            return None
        try:
            parsed = int(float(value))
        except (TypeError, ValueError):
            return None
        return max(parsed, 0)

    @staticmethod
    def _current_timestamp(db: Database) -> str:
        return db.fetchone("SELECT CURRENT_TIMESTAMP AS now")["now"]

    @staticmethod
    def _extract_video_source(source_url: str) -> Dict[str, Optional[str]]:
        normalized_url = (source_url or "").strip()
        if not normalized_url:
            raise ValueError("Link do vídeo é obrigatório.")

        parsed = urlparse(normalized_url)
        host = (parsed.netloc or "").lower()
        path = parsed.path or ""
        query = parse_qs(parsed.query or "")

        youtube_id = None
        if "youtu.be" in host:
            youtube_id = path.strip("/").split("/")[0] or None
        elif "youtube.com" in host:
            if path == "/watch":
                youtube_id = (query.get("v") or [None])[0]
            elif path.startswith("/embed/"):
                youtube_id = path.split("/embed/", 1)[1].split("/")[0] or None
            elif path.startswith("/shorts/"):
                youtube_id = path.split("/shorts/", 1)[1].split("/")[0] or None

        if youtube_id:
            return {
                "provider": "youtube",
                "embed_url": f"https://www.youtube.com/embed/{youtube_id}?enablejsapi=1&playsinline=1&rel=0",
            }

        if "vimeo.com" in host:
            vimeo_token = next((token for token in path.split("/") if token.isdigit()), None)
            if vimeo_token:
                return {
                    "provider": "vimeo",
                    "embed_url": f"https://player.vimeo.com/video/{vimeo_token}",
                }

        lowered_path = path.lower()
        if lowered_path.endswith(StudyEngine.VIDEO_EXTENSIONS):
            return {
                "provider": "html5",
                "embed_url": normalized_url,
            }

        return {
            "provider": "external",
            "embed_url": None,
        }

    @staticmethod
    def _extract_youtube_playlist_id(source_url: str) -> Optional[str]:
        normalized_url = (source_url or "").strip()
        if not normalized_url:
            return None

        parsed = urlparse(normalized_url)
        host = (parsed.netloc or "").lower()
        if "youtube.com" not in host and "youtu.be" not in host:
            return None

        query = parse_qs(parsed.query or "")
        playlist_id = (query.get("list") or [None])[0]
        return StudyEngine._clean_text(playlist_id)

    @staticmethod
    def _fetch_youtube_playlist_items(source_url: str) -> List[Dict[str, str]]:
        playlist_id = StudyEngine._extract_youtube_playlist_id(source_url)
        if not playlist_id:
            raise ValueError("Link de playlist do YouTube inválido.")

        feed_url = f"https://www.youtube.com/feeds/videos.xml?playlist_id={playlist_id}"
        try:
            with urlopen(feed_url, timeout=12) as response:
                payload = response.read()
        except Exception as exc:
            raise ValueError("Não foi possível ler a playlist do YouTube.") from exc

        try:
            root = ET.fromstring(payload)
        except ET.ParseError as exc:
            raise ValueError("Não foi possível interpretar a playlist do YouTube.") from exc

        items: List[Dict[str, str]] = []
        for entry in root.findall("atom:entry", StudyEngine.ATOM_NS):
            video_id = entry.findtext("yt:videoId", default="", namespaces=StudyEngine.ATOM_NS).strip()
            title = entry.findtext("atom:title", default="", namespaces=StudyEngine.ATOM_NS).strip()
            if not video_id:
                continue
            items.append(
                {
                    "title": title or f"YouTube {video_id}",
                    "source_url": f"https://www.youtube.com/watch?v={video_id}",
                }
            )

        if not items:
            raise ValueError("A playlist não possui vídeos disponíveis para importação.")

        return items

    @staticmethod
    def _infer_title_from_url(source_url: str) -> Optional[str]:
        normalized_url = (source_url or "").strip()
        if not normalized_url:
            return None

        parsed = urlparse(normalized_url)
        host = (parsed.netloc or "").lower()
        path = parsed.path or ""
        query = parse_qs(parsed.query or "")

        if "youtube.com" in host and path == "/watch":
            youtube_id = (query.get("v") or [None])[0]
            if youtube_id:
                return f"YouTube {youtube_id}"

        if "youtu.be" in host:
            youtube_id = path.strip("/").split("/")[0] or None
            if youtube_id:
                return f"YouTube {youtube_id}"

        segments = [segment for segment in path.split("/") if segment]
        if not segments:
            return None

        candidate = unquote(segments[-1]).strip()
        if "." in candidate:
            candidate = candidate.rsplit(".", 1)[0]
        candidate = candidate.replace("-", " ").replace("_", " ").strip()
        if not candidate:
            return None

        return " ".join(candidate.split())

    @staticmethod
    def _serialize_topic(row) -> Dict[str, Any]:
        topic = dict(row)
        topic["total_videos"] = int(topic.get("total_videos") or 0)
        topic["completed_videos"] = int(topic.get("completed_videos") or 0)
        topic["started_videos"] = int(topic.get("started_videos") or 0)
        return topic

    @staticmethod
    def _serialize_video(row) -> Dict[str, Any]:
        video = dict(row)
        video["current_seconds"] = int(video.get("current_seconds") or 0)
        video["duration_seconds"] = int(video.get("duration_seconds") or 0) if video.get("duration_seconds") else None
        video["progress_percent"] = int(video.get("progress_percent") or 0)
        video["is_completed"] = bool(video.get("is_completed"))
        video["display_title"] = video.get("title") or "Vídeo sem título"
        return video

    @staticmethod
    def list_topics() -> List[Dict[str, Any]]:
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    st.id,
                    st.title,
                    st.description,
                    st.created_at,
                    st.updated_at,
                    COUNT(sv.id) AS total_videos,
                    SUM(CASE WHEN COALESCE(sv.is_completed, 0) = 1 THEN 1 ELSE 0 END) AS completed_videos,
                    SUM(CASE WHEN COALESCE(sv.progress_percent, 0) > 0 AND COALESCE(sv.is_completed, 0) = 0 THEN 1 ELSE 0 END) AS started_videos
                FROM study_topics st
                LEFT JOIN study_videos sv ON sv.topic_id = st.id
                GROUP BY st.id
                ORDER BY COALESCE(st.updated_at, st.created_at) DESC, st.id DESC
                """
            )
        return [StudyEngine._serialize_topic(row) for row in rows]

    @staticmethod
    def create_topic(title: str, description: Optional[str] = None) -> Dict[str, Any]:
        normalized_title = StudyEngine._clean_text(title)
        if not normalized_title:
            raise ValueError("Título do assunto é obrigatório.")

        normalized_description = StudyEngine._clean_text(description)

        with Database() as db:
            now = StudyEngine._current_timestamp(db)
            db.execute(
                """
                INSERT INTO study_topics (title, description, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (normalized_title, normalized_description, now, now),
            )
            topic_id = db.lastrowid
            row = db.fetchone(
                """
                SELECT
                    id,
                    title,
                    description,
                    created_at,
                    updated_at,
                    0 AS total_videos,
                    0 AS completed_videos,
                    0 AS started_videos
                FROM study_topics
                WHERE id = ?
                """,
                (topic_id,),
            )
        return StudyEngine._serialize_topic(row)

    @staticmethod
    def update_topic(topic_id: int, title: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]:
        with Database() as db:
            current = db.fetchone("SELECT id, title, description FROM study_topics WHERE id = ?", (topic_id,))
            if not current:
                raise ValueError("Assunto não encontrado.")

            next_title = StudyEngine._clean_text(title) if title is not None else current["title"]
            if not next_title:
                raise ValueError("Título do assunto é obrigatório.")
            next_description = StudyEngine._clean_text(description) if description is not None else current["description"]
            now = StudyEngine._current_timestamp(db)
            db.execute(
                """
                UPDATE study_topics
                SET title = ?, description = ?, updated_at = ?
                WHERE id = ?
                """,
                (next_title, next_description, now, topic_id),
            )
        return StudyEngine.get_topic(topic_id)

    @staticmethod
    def delete_topic(topic_id: int) -> None:
        with Database() as db:
            db.execute("DELETE FROM study_topics WHERE id = ?", (topic_id,))

    @staticmethod
    def list_videos(topic_id: int) -> List[Dict[str, Any]]:
        with Database() as db:
            rows = db.fetchall(
                """
                SELECT
                    id,
                    topic_id,
                    title,
                    source_url,
                    embed_url,
                    provider,
                    notes,
                    current_seconds,
                    duration_seconds,
                    progress_percent,
                    is_completed,
                    completed_at,
                    created_at,
                    updated_at
                FROM study_videos
                WHERE topic_id = ?
                ORDER BY created_at ASC, id ASC
                """,
                (topic_id,),
            )
        return [StudyEngine._serialize_video(row) for row in rows]

    @staticmethod
    def get_topic(topic_id: int) -> Dict[str, Any]:
        with Database() as db:
            row = db.fetchone(
                """
                SELECT
                    st.id,
                    st.title,
                    st.description,
                    st.created_at,
                    st.updated_at,
                    COUNT(sv.id) AS total_videos,
                    SUM(CASE WHEN COALESCE(sv.is_completed, 0) = 1 THEN 1 ELSE 0 END) AS completed_videos,
                    SUM(CASE WHEN COALESCE(sv.progress_percent, 0) > 0 AND COALESCE(sv.is_completed, 0) = 0 THEN 1 ELSE 0 END) AS started_videos
                FROM study_topics st
                LEFT JOIN study_videos sv ON sv.topic_id = st.id
                WHERE st.id = ?
                GROUP BY st.id
                """,
                (topic_id,),
            )
        if not row:
            raise ValueError("Assunto não encontrado.")

        topic = StudyEngine._serialize_topic(row)
        topic["videos"] = StudyEngine.list_videos(topic_id)
        return topic

    @staticmethod
    def add_video(topic_id: int, source_url: str, title: Optional[str] = None) -> Dict[str, Any]:
        normalized_title = StudyEngine._clean_text(title)
        video_source = StudyEngine._extract_video_source(source_url)
        initial_title = normalized_title or StudyEngine._infer_title_from_url(source_url)

        with Database() as db:
            topic = db.fetchone("SELECT id FROM study_topics WHERE id = ?", (topic_id,))
            if not topic:
                raise ValueError("Assunto não encontrado.")

            now = StudyEngine._current_timestamp(db)
            db.execute(
                """
                INSERT INTO study_videos (
                    topic_id,
                    title,
                    source_url,
                    embed_url,
                    provider,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    topic_id,
                    initial_title,
                    source_url.strip(),
                    video_source["embed_url"],
                    video_source["provider"],
                    now,
                    now,
                ),
            )
            video_id = db.lastrowid
            db.execute(
                "UPDATE study_topics SET updated_at = ? WHERE id = ?",
                (now, topic_id),
            )
            row = db.fetchone("SELECT * FROM study_videos WHERE id = ?", (video_id,))
        return StudyEngine._serialize_video(row)

    @staticmethod
    def add_playlist(topic_id: int, source_url: str) -> Dict[str, Any]:
        playlist_url = StudyEngine._clean_text(source_url)
        if not playlist_url:
            raise ValueError("Link da playlist é obrigatório.")

        items = StudyEngine._fetch_youtube_playlist_items(playlist_url)

        with Database() as db:
            topic = db.fetchone("SELECT id FROM study_topics WHERE id = ?", (topic_id,))
            if not topic:
                raise ValueError("Assunto não encontrado.")
            existing_urls = {
                (row["source_url"] or "").strip()
                for row in db.fetchall("SELECT source_url FROM study_videos WHERE topic_id = ?", (topic_id,))
            }

        created_videos: List[Dict[str, Any]] = []
        skipped_count = 0
        for item in items:
            normalized_source = (item["source_url"] or "").strip()
            if normalized_source in existing_urls:
                skipped_count += 1
                continue
            created_video = StudyEngine.add_video(topic_id, normalized_source, item.get("title"))
            created_videos.append(created_video)
            existing_urls.add(normalized_source)

        return {
            "playlist_url": playlist_url,
            "created_videos": created_videos,
            "created_count": len(created_videos),
            "skipped_count": skipped_count,
        }

    @staticmethod
    def update_video(
        video_id: int,
        *,
        title: Optional[str] = None,
        source_url: Optional[str] = None,
        notes: Optional[str] = None,
        current_seconds: Optional[int] = None,
        duration_seconds: Optional[int] = None,
        progress_percent: Optional[int] = None,
        is_completed: Optional[bool] = None,
    ) -> Dict[str, Any]:
        with Database() as db:
            current = db.fetchone("SELECT * FROM study_videos WHERE id = ?", (video_id,))
            if not current:
                raise ValueError("Vídeo não encontrado.")

            current = dict(current)
            next_title = StudyEngine._clean_text(title) if title is not None else current.get("title")
            next_notes = StudyEngine._clean_text(notes) if notes is not None else current.get("notes")
            next_source_url = current.get("source_url")
            next_embed_url = current.get("embed_url")
            next_provider = current.get("provider")

            if source_url is not None:
                normalized_url = StudyEngine._clean_text(source_url)
                if not normalized_url:
                    raise ValueError("Link do vídeo é obrigatório.")
                parsed_source = StudyEngine._extract_video_source(normalized_url)
                next_source_url = normalized_url
                next_embed_url = parsed_source["embed_url"]
                next_provider = parsed_source["provider"]

            next_current_seconds = (
                StudyEngine._clean_int(current_seconds)
                if current_seconds is not None
                else StudyEngine._clean_int(current.get("current_seconds")) or 0
            )
            next_duration_seconds = (
                StudyEngine._clean_int(duration_seconds)
                if duration_seconds is not None
                else StudyEngine._clean_int(current.get("duration_seconds"))
            )

            computed_progress = progress_percent
            if computed_progress is None:
                if next_duration_seconds and next_duration_seconds > 0:
                    computed_progress = round((next_current_seconds / next_duration_seconds) * 100)
                else:
                    computed_progress = current.get("progress_percent") or 0

            next_progress_percent = max(0, min(int(computed_progress or 0), 100))
            next_is_completed = bool(current.get("is_completed"))
            if is_completed is not None:
                next_is_completed = bool(is_completed)
            elif next_progress_percent >= 100:
                next_is_completed = True

            now = StudyEngine._current_timestamp(db)
            completed_at = current.get("completed_at")
            if next_is_completed:
                completed_at = completed_at or now
                next_progress_percent = 100
                if next_duration_seconds:
                    next_current_seconds = next_duration_seconds
            else:
                completed_at = None

            db.execute(
                """
                UPDATE study_videos
                SET title = ?,
                    source_url = ?,
                    embed_url = ?,
                    provider = ?,
                    notes = ?,
                    current_seconds = ?,
                    duration_seconds = ?,
                    progress_percent = ?,
                    is_completed = ?,
                    completed_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    next_title,
                    next_source_url,
                    next_embed_url,
                    next_provider,
                    next_notes,
                    next_current_seconds,
                    next_duration_seconds,
                    next_progress_percent,
                    1 if next_is_completed else 0,
                    completed_at,
                    now,
                    video_id,
                ),
            )
            db.execute(
                "UPDATE study_topics SET updated_at = ? WHERE id = ?",
                (now, current["topic_id"]),
            )
            row = db.fetchone("SELECT * FROM study_videos WHERE id = ?", (video_id,))
        return StudyEngine._serialize_video(row)

    @staticmethod
    def delete_video(video_id: int) -> None:
        with Database() as db:
            current = db.fetchone("SELECT id, topic_id FROM study_videos WHERE id = ?", (video_id,))
            if not current:
                return
            now = StudyEngine._current_timestamp(db)
            db.execute("DELETE FROM study_videos WHERE id = ?", (video_id,))
            db.execute(
                "UPDATE study_topics SET updated_at = ? WHERE id = ?",
                (now, current["topic_id"]),
            )
