ALTER TABLE calendar_events ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0;

ALTER TABLE calendar_events ADD COLUMN completed_at TEXT;
