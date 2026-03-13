ALTER TABLE watch_items ADD COLUMN media_type TEXT NOT NULL DEFAULT 'movie';
ALTER TABLE watch_items ADD COLUMN status TEXT NOT NULL DEFAULT 'backlog';
ALTER TABLE watch_items ADD COLUMN description TEXT;
ALTER TABLE watch_items ADD COLUMN watch_with TEXT;
ALTER TABLE watch_items ADD COLUMN total_seasons INTEGER;
ALTER TABLE watch_items ADD COLUMN total_episodes INTEGER;
ALTER TABLE watch_items ADD COLUMN current_season INTEGER NOT NULL DEFAULT 0;
ALTER TABLE watch_items ADD COLUMN current_episode INTEGER NOT NULL DEFAULT 0;
ALTER TABLE watch_items ADD COLUMN started_at TEXT;
ALTER TABLE watch_items ADD COLUMN completed_at TEXT;
ALTER TABLE watch_items ADD COLUMN last_logged_at TEXT;
ALTER TABLE watch_items ADD COLUMN last_log_summary TEXT;
ALTER TABLE watch_items ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;

UPDATE watch_items
SET status = 'completed',
    completed_at = COALESCE(completed_at, watched_at),
    updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
WHERE watched_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS watch_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    season_number INTEGER,
    episode_number INTEGER,
    note TEXT,
    logged_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES watch_items(id)
);

CREATE INDEX IF NOT EXISTS idx_watch_items_status ON watch_items(status);
CREATE INDEX IF NOT EXISTS idx_watch_items_media_type ON watch_items(media_type);
CREATE INDEX IF NOT EXISTS idx_watch_logs_item_logged_at ON watch_logs(item_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_logs_logged_at ON watch_logs(logged_at DESC);
