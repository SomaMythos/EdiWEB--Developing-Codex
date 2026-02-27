CREATE TABLE IF NOT EXISTS consumable_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consumable_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES consumable_categories(id)
);

CREATE TABLE IF NOT EXISTS consumable_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    purchase_date TEXT NOT NULL,
    price_paid NUMERIC,
    ended_at TEXT,
    duration_days INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES consumable_items(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consumable_cycles_open_item
    ON consumable_cycles(item_id)
    WHERE ended_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_consumable_cycles_no_delete
BEFORE DELETE ON consumable_cycles
BEGIN
    SELECT RAISE(ABORT, 'consumable_cycles_history_is_append_only');
END;

CREATE TRIGGER IF NOT EXISTS trg_consumable_cycles_close_only
BEFORE UPDATE ON consumable_cycles
WHEN (
    OLD.ended_at IS NOT NULL
    OR NEW.item_id <> OLD.item_id
    OR NEW.purchase_date <> OLD.purchase_date
    OR COALESCE(NEW.price_paid, -1) <> COALESCE(OLD.price_paid, -1)
    OR COALESCE(NEW.created_at, '') <> COALESCE(OLD.created_at, '')
    OR NEW.ended_at IS NULL
)
BEGIN
    SELECT RAISE(ABORT, 'consumable_cycles_only_close_open_cycle');
END;
