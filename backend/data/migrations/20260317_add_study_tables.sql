CREATE TABLE IF NOT EXISTS study_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS study_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL,
    title TEXT,
    source_url TEXT NOT NULL,
    embed_url TEXT,
    provider TEXT NOT NULL DEFAULT 'external',
    notes TEXT,
    current_seconds INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    progress_percent INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(topic_id) REFERENCES study_topics(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_videos_topic_id
    ON study_videos(topic_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_study_videos_completed
    ON study_videos(is_completed, completed_at DESC);
