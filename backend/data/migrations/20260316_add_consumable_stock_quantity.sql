ALTER TABLE consumable_cycles ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE consumable_cycles ADD COLUMN remaining_quantity INTEGER NOT NULL DEFAULT 1;

UPDATE consumable_cycles
SET stock_quantity = COALESCE(stock_quantity, 1);

UPDATE consumable_cycles
SET remaining_quantity = CASE
    WHEN ended_at IS NULL THEN 1
    ELSE 0
END
WHERE remaining_quantity IS NULL OR remaining_quantity = 1;

CREATE TABLE IF NOT EXISTS consumable_unit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    consumed_at TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(cycle_id) REFERENCES consumable_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES consumable_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_consumable_unit_logs_item_id
    ON consumable_unit_logs(item_id, consumed_at DESC);

CREATE INDEX IF NOT EXISTS idx_consumable_unit_logs_cycle_id
    ON consumable_unit_logs(cycle_id, consumed_at DESC);

INSERT INTO consumable_unit_logs (cycle_id, item_id, consumed_at, duration_days, created_at)
SELECT
    c.id,
    c.item_id,
    c.ended_at,
    c.duration_days,
    COALESCE(c.ended_at, c.created_at)
FROM consumable_cycles c
WHERE c.ended_at IS NOT NULL
  AND c.duration_days IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM consumable_unit_logs logs
      WHERE logs.cycle_id = c.id
  );

DROP TRIGGER IF EXISTS trg_consumable_cycles_close_only;

CREATE TRIGGER trg_consumable_cycles_close_only
BEFORE UPDATE ON consumable_cycles
WHEN (
    OLD.ended_at IS NOT NULL
    OR NEW.item_id <> OLD.item_id
    OR NEW.purchase_date <> OLD.purchase_date
    OR COALESCE(NEW.stock_quantity, 1) <> COALESCE(OLD.stock_quantity, 1)
    OR COALESCE(NEW.price_paid, -1) <> COALESCE(OLD.price_paid, -1)
    OR COALESCE(NEW.created_at, '') <> COALESCE(OLD.created_at, '')
    OR NEW.remaining_quantity < 0
    OR NEW.remaining_quantity > OLD.remaining_quantity
    OR NEW.remaining_quantity > NEW.stock_quantity
    OR (
        NEW.remaining_quantity = 0
        AND (NEW.ended_at IS NULL OR NEW.duration_days IS NULL)
    )
    OR (
        NEW.remaining_quantity > 0
        AND (
            COALESCE(NEW.ended_at, '') <> COALESCE(OLD.ended_at, '')
            OR COALESCE(NEW.duration_days, -1) <> COALESCE(OLD.duration_days, -1)
        )
    )
)
BEGIN
    SELECT RAISE(ABORT, 'consumable_cycles_only_close_open_cycle');
END;
