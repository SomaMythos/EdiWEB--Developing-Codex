import sqlite3
import os
import logging
import shutil
import sys
from pathlib import Path
from typing import Callable, Dict, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _get_edi_storage_dir() -> Path:
    """Retorna o diretório persistente do cliente para dados do EDI."""
    custom_storage = os.getenv("EDI_STORAGE_DIR")
    if custom_storage:
        return Path(custom_storage).expanduser().resolve()

    home_dir = Path.home()
    preferred_dirs = [home_dir / "Documents", home_dir / "documents"]

    for directory in preferred_dirs:
        if directory.exists():
            return directory / "EDI"

    return preferred_dirs[0] / "EDI"


def _legacy_database_paths() -> List[Path]:
    backend_dir = Path(__file__).resolve().parents[1]
    candidates = [
        backend_dir / "lifemanager.db",
        backend_dir / "data" / "lifemanager.db",
    ]

    executable_path = Path(sys.executable).resolve().parent / "lifemanager.db"
    cwd_path = Path.cwd().resolve() / "lifemanager.db"
    candidates.extend([executable_path, cwd_path])

    unique_candidates: List[Path] = []
    seen = set()
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved in seen:
            continue
        seen.add(resolved)
        unique_candidates.append(resolved)

    return unique_candidates


def _migrate_legacy_database_file(target_path: Path) -> None:
    """Move DB antiga do diretório do backend para storage persistente, se existir."""
    if target_path.exists():
        return

    for legacy_path in _legacy_database_paths():
        if not legacy_path.exists() or legacy_path.resolve() == target_path.resolve():
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy_path), str(target_path))
        logger.info("Banco legado movido para storage persistente: %s -> %s", legacy_path, target_path)
        return


def table_exists(db, table_name):
    row = db.fetchone(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return row is not None


def column_exists(db, table_name, column_name):
    if not table_exists(db, table_name):
        return False
    columns = db.fetchall(f"PRAGMA table_info({table_name})")
    return any(column["name"] == column_name for column in columns)




def index_exists(db, index_name):
    row = db.fetchone(
        "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?",
        (index_name,),
    )
    return row is not None


def trigger_exists(db, trigger_name):
    row = db.fetchone(
        "SELECT 1 FROM sqlite_master WHERE type='trigger' AND name=?",
        (trigger_name,),
    )
    return row is not None


def read_migration_sql(filename: str) -> str:
    migration_path = Path(__file__).resolve().parent / "migrations" / filename
    return migration_path.read_text(encoding="utf-8")


def apply_migrations(db):
    """Aplica migrações idempotentes e aditivas para bancos existentes."""
    migration_log: List[Dict[str, str]] = []

    def run_migration(name: str, condition: Callable[[], bool], sql: str):
        if condition():
            logger.info("[migrations] SKIPPED %s", name)
            migration_log.append({"name": name, "status": "skipped"})
            return

        db.conn.executescript(sql)
        logger.info("[migrations] APPLIED %s", name)
        migration_log.append({"name": name, "status": "applied"})

    # Tabelas adicionadas/portadas ao domínio principal
    run_migration(
        "create_notifications_table",
        lambda: table_exists(db, "notifications"),
        """
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_type TEXT NOT NULL,
            type TEXT,
            source_feature TEXT DEFAULT 'system',
            title TEXT,
            message TEXT,
            severity TEXT DEFAULT 'info',
            status TEXT DEFAULT 'unread',
            scheduled_for TEXT,
            meta TEXT,
            sound_key TEXT,
            color_token TEXT,
            unique_key TEXT UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            read_at TEXT,
            completed_at TEXT
        )
        """,
    )

    run_migration(
        "create_notification_preferences_table",
        lambda: table_exists(db, "notification_preferences") and column_exists(db, "notification_preferences", "feature_key"),
        """
        CREATE TABLE IF NOT EXISTS notification_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_key TEXT NOT NULL UNIQUE,
            enabled INTEGER NOT NULL DEFAULT 1,
            channels TEXT NOT NULL DEFAULT '["in_app","sound"]',
            quiet_hours TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        """,
    )

    run_migration(
        "migrate_notification_preferences_single_row_to_feature_rows",
        lambda: not table_exists(db, "notification_preferences") or column_exists(db, "notification_preferences", "feature_key"),
        """
        ALTER TABLE notification_preferences RENAME TO notification_preferences_legacy;

        CREATE TABLE notification_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feature_key TEXT NOT NULL UNIQUE,
            enabled INTEGER NOT NULL DEFAULT 1,
            channels TEXT NOT NULL DEFAULT '["in_app","sound"]',
            quiet_hours TEXT,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        INSERT INTO notification_preferences (feature_key, enabled, channels)
        VALUES
            ('goals', 1, '["in_app","sound"]'),
            ('daily', 1, '["in_app","sound"]'),
            ('consumables', 1, '["in_app","sound"]'),
            ('shopping', 1, '["in_app","sound"]'),
            ('custom', 1, '["in_app","sound"]');

        DROP TABLE notification_preferences_legacy;
        """,
    )

    run_migration(
        "notifications_add_notification_type",
        lambda: column_exists(db, "notifications", "notification_type"),
        "ALTER TABLE notifications ADD COLUMN notification_type TEXT",
    )

    run_migration(
        "notifications_add_source_feature",
        lambda: column_exists(db, "notifications", "source_feature"),
        "ALTER TABLE notifications ADD COLUMN source_feature TEXT DEFAULT 'system'",
    )

    run_migration(
        "notifications_add_severity",
        lambda: column_exists(db, "notifications", "severity"),
        "ALTER TABLE notifications ADD COLUMN severity TEXT DEFAULT 'info'",
    )

    run_migration(
        "notifications_add_status",
        lambda: column_exists(db, "notifications", "status"),
        "ALTER TABLE notifications ADD COLUMN status TEXT DEFAULT 'unread'",
    )

    run_migration(
        "notifications_add_scheduled_for",
        lambda: column_exists(db, "notifications", "scheduled_for"),
        "ALTER TABLE notifications ADD COLUMN scheduled_for TEXT",
    )

    run_migration(
        "notifications_add_sound_key",
        lambda: column_exists(db, "notifications", "sound_key"),
        "ALTER TABLE notifications ADD COLUMN sound_key TEXT",
    )

    run_migration(
        "notifications_add_color_token",
        lambda: column_exists(db, "notifications", "color_token"),
        "ALTER TABLE notifications ADD COLUMN color_token TEXT",
    )

    run_migration(
        "notifications_add_completed_at",
        lambda: column_exists(db, "notifications", "completed_at"),
        "ALTER TABLE notifications ADD COLUMN completed_at TEXT",
    )

    db.execute(
        """
        UPDATE notifications
        SET
            notification_type = COALESCE(notification_type, type, 'legacy_notification'),
            type = COALESCE(type, notification_type),
            source_feature = COALESCE(source_feature, 'legacy_notifications'),
            severity = COALESCE(severity, 'info'),
            status = CASE
                WHEN status IS NOT NULL THEN status
                WHEN read_at IS NOT NULL THEN 'read'
                ELSE 'unread'
            END
        """
    )

    run_migration(
        "create_wish_items_table",
        lambda: table_exists(db, "wish_items"),
        """
        CREATE TABLE IF NOT EXISTS wish_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL,
            link TEXT,
            item_type TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "create_shopping_items_table",
        lambda: table_exists(db, "shopping_items"),
        """
        CREATE TABLE IF NOT EXISTS shopping_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            average_price REAL,
            restock_days INTEGER DEFAULT 30,
            quantity_per_purchase INTEGER DEFAULT 1,
            unit TEXT DEFAULT 'un',
            priority INTEGER DEFAULT 3,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "create_restock_items_table",
        lambda: table_exists(db, "restock_items"),
        """
        CREATE TABLE IF NOT EXISTS restock_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            created_at TEXT,
            restock_date TEXT,
            FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
        )
        """,
    )

    run_migration(
        "create_purchase_history_table",
        lambda: table_exists(db, "purchase_history"),
        """
        CREATE TABLE IF NOT EXISTS purchase_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            quantity INTEGER DEFAULT 1,
            price REAL DEFAULT 0,
            purchase_date TEXT NOT NULL,
            FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE SET NULL
        )
        """,
    )

    run_migration(
        "create_reminders_table",
        lambda: table_exists(db, "reminders"),
        """
        CREATE TABLE IF NOT EXISTS reminders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            priority INTEGER DEFAULT 3,
            category TEXT DEFAULT 'pessoal',
            reminder_days_before INTEGER DEFAULT 7,
            status TEXT DEFAULT 'pendente',
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    db.execute(
        """
        INSERT OR IGNORE INTO notifications (
            notification_type,
            type,
            source_feature,
            title,
            message,
            severity,
            status,
            scheduled_for,
            meta,
            sound_key,
            color_token,
            unique_key,
            created_at,
            completed_at,
            read_at
        )
        SELECT
            'custom_reminder',
            'custom_reminder',
            'manual',
            r.title,
            r.description,
            'info',
            CASE WHEN r.status = 'concluido' THEN 'completed' ELSE 'unread' END,
            r.due_date,
            json_object(
                'priority', COALESCE(r.priority, 3),
                'category', COALESCE(r.category, 'pessoal'),
                'reminder_days_before', COALESCE(r.reminder_days_before, 7),
                'legacy_source', 'reminders'
            ),
            'default',
            'accent',
            'reminder:' || r.id,
            r.created_at,
            CASE WHEN r.status = 'concluido' THEN COALESCE(r.completed_at, r.created_at) ELSE NULL END,
            CASE WHEN r.status = 'concluido' THEN COALESCE(r.completed_at, r.created_at) ELSE NULL END
        FROM reminders r
        """
    )

    run_migration(
        "create_daily_plan_blocks_table",
        lambda: table_exists(db, "daily_plan_blocks"),
        """
        CREATE TABLE IF NOT EXISTS daily_plan_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            duration INTEGER NOT NULL,
            activity_id INTEGER,
            source_type TEXT DEFAULT 'manual',
            block_name TEXT,
            block_category TEXT,
            completed INTEGER DEFAULT 0,
            updated_source TEXT DEFAULT 'auto',
            FOREIGN KEY(activity_id) REFERENCES activities(id)
        )
        """,
    )
    
    run_migration(
    "add_daily_config_discipline_weight",
    lambda: column_exists(db, "daily_config", "discipline_weight"),
    "ALTER TABLE daily_config ADD COLUMN discipline_weight INTEGER DEFAULT 1",
    )

    run_migration(
    "add_daily_config_fun_weight",
    lambda: column_exists(db, "daily_config", "fun_weight"),
    "ALTER TABLE daily_config ADD COLUMN fun_weight INTEGER DEFAULT 2",
    )

    run_migration(
        "create_weekly_activity_stats_table",
        lambda: table_exists(db, "weekly_activity_stats"),
        """
        CREATE TABLE IF NOT EXISTS weekly_activity_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start TEXT NOT NULL,
            activity_id INTEGER NOT NULL,
            times_scheduled INTEGER DEFAULT 0,
            times_completed INTEGER DEFAULT 0,
            UNIQUE(week_start, activity_id)
        )
        """,
    )


    run_migration(
        "add_daily_plan_block_name",
        lambda: column_exists(db, "daily_plan_blocks", "block_name"),
        "ALTER TABLE daily_plan_blocks ADD COLUMN block_name TEXT",
    )

    run_migration(
        "add_daily_plan_block_category",
        lambda: column_exists(db, "daily_plan_blocks", "block_category"),
        "ALTER TABLE daily_plan_blocks ADD COLUMN block_category TEXT",
    )

    run_migration(
        "add_daily_plan_completed",
        lambda: column_exists(db, "daily_plan_blocks", "completed"),
        "ALTER TABLE daily_plan_blocks ADD COLUMN completed INTEGER DEFAULT 0",
    )

    run_migration(
        "add_daily_plan_updated_source",
        lambda: column_exists(db, "daily_plan_blocks", "updated_source"),
        "ALTER TABLE daily_plan_blocks ADD COLUMN updated_source TEXT DEFAULT 'auto'",
    )


    run_migration(
        "create_paintings_table",
        lambda: table_exists(db, "paintings"),
        """
        CREATE TABLE IF NOT EXISTS paintings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            size TEXT,
            description TEXT,
            estimated_time INTEGER,
            category TEXT DEFAULT 'pintura',
            time_spent INTEGER DEFAULT 0,
            status TEXT DEFAULT 'em_progresso',
            started_at TEXT,
            finished_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "create_painting_progress_table",
        lambda: table_exists(db, "painting_progress"),
        """
        CREATE TABLE IF NOT EXISTS painting_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            painting_id INTEGER NOT NULL,
            photo_path TEXT,
            time_spent INTEGER DEFAULT 0,
            notes TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
        )
        """,
    )

    run_migration(
        "create_progress_photos_table",
        lambda: table_exists(db, "progress_photos"),
        """
        CREATE TABLE IF NOT EXISTS progress_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            activity_id INTEGER NOT NULL,
            photo_path TEXT NOT NULL,
            description TEXT,
            duration INTEGER,
            date TEXT,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE
        )
        """,
    )

    run_migration(
        "create_media_folders_table",
        lambda: table_exists(db, "media_folders"),
        """
        CREATE TABLE IF NOT EXISTS media_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            section_type TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "create_media_items_table",
        lambda: table_exists(db, "media_items"),
        """
        CREATE TABLE IF NOT EXISTS media_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(folder_id) REFERENCES media_folders(id) ON DELETE CASCADE
        )
        """,
    )

    # Expansões de colunas (migração aditiva, sem remoções)
    run_migration(
        "add_goals_difficulty",
        lambda: column_exists(db, "goals", "difficulty"),
        "ALTER TABLE goals ADD COLUMN difficulty INTEGER DEFAULT 1",
    )


    run_migration(
        "add_routine_blocks_completed",
        lambda: not table_exists(db, "routine_blocks") or column_exists(db, "routine_blocks", "completed"),
        "ALTER TABLE routine_blocks ADD COLUMN completed INTEGER DEFAULT 0",
    )


    run_migration(
        "add_wish_items_photo_url",
        lambda: column_exists(db, "wish_items", "photo_url"),
        "ALTER TABLE wish_items ADD COLUMN photo_url TEXT",
    )

    run_migration(
        "add_wish_items_is_marked",
        lambda: column_exists(db, "wish_items", "is_marked"),
        "ALTER TABLE wish_items ADD COLUMN is_marked INTEGER DEFAULT 0",
    )


    run_migration(
        "add_paintings_category",
        lambda: column_exists(db, "paintings", "category"),
        "ALTER TABLE paintings ADD COLUMN category TEXT DEFAULT 'pintura'",
    )

    run_migration(
        "add_paintings_visual_category",
        lambda: column_exists(db, "paintings", "visual_category"),
        "ALTER TABLE paintings ADD COLUMN visual_category TEXT DEFAULT 'pintura'",
    )

    run_migration(
        "add_paintings_reference_image_path",
        lambda: column_exists(db, "paintings", "reference_image_path"),
        "ALTER TABLE paintings ADD COLUMN reference_image_path TEXT",
    )

    run_migration(
        "add_painting_progress_update_title",
        lambda: column_exists(db, "painting_progress", "update_title"),
        "ALTER TABLE painting_progress ADD COLUMN update_title TEXT",
    )


    run_migration(
        "add_activities_variable_time",
        lambda: column_exists(db, "activities", "variable_time_enabled"),
        "ALTER TABLE activities ADD COLUMN variable_time_enabled INTEGER DEFAULT 0",
    )

    run_migration(
        "add_activities_min_time",
        lambda: column_exists(db, "activities", "min_time"),
        "ALTER TABLE activities ADD COLUMN min_time INTEGER",
    )

    run_migration(
        "add_activities_max_time",
        lambda: column_exists(db, "activities", "max_time"),
        "ALTER TABLE activities ADD COLUMN max_time INTEGER",
    )
    
    run_migration(
    "add_activities_min_duration",
    lambda: column_exists(db, "activities", "min_duration"),
    "ALTER TABLE activities ADD COLUMN min_duration INTEGER NOT NULL DEFAULT 30",
    )

    run_migration(
    "add_activities_max_duration",
    lambda: column_exists(db, "activities", "max_duration"),
    "ALTER TABLE activities ADD COLUMN max_duration INTEGER NOT NULL DEFAULT 60",
    )

    run_migration(
    "add_activities_is_everyday",
    lambda: column_exists(db, "activities", "is_everyday"),
    "ALTER TABLE activities ADD COLUMN is_everyday INTEGER NOT NULL DEFAULT 0",
    )

    run_migration(
    "add_activities_is_disc",
    lambda: column_exists(db, "activities", "is_disc"),
    "ALTER TABLE activities ADD COLUMN is_disc INTEGER NOT NULL DEFAULT 1",
    )

    run_migration(
    "add_activities_is_fun",
    lambda: column_exists(db, "activities", "is_fun"),
    "ALTER TABLE activities ADD COLUMN is_fun INTEGER NOT NULL DEFAULT 0",
    )

    run_migration(
    "add_activities_frequency_type",
    lambda: column_exists(db, "activities", "frequency_type"),
    "ALTER TABLE activities ADD COLUMN frequency_type TEXT DEFAULT 'flex'",
    )

    run_migration(
    "add_activities_fixed_time",
    lambda: column_exists(db, "activities", "fixed_time"),
    "ALTER TABLE activities ADD COLUMN fixed_time TEXT",
    )

    run_migration(
    "add_activities_fixed_duration",
    lambda: column_exists(db, "activities", "fixed_duration"),
    "ALTER TABLE activities ADD COLUMN fixed_duration INTEGER",
    )


    run_migration(
        "create_book_types_table",
        lambda: table_exists(db, "book_types"),
        """
        CREATE TABLE IF NOT EXISTS book_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "add_books_book_type_id",
        lambda: column_exists(db, "books", "book_type_id"),
        "ALTER TABLE books ADD COLUMN book_type_id INTEGER REFERENCES book_types(id)",
    )

    run_migration(
        "add_reading_sessions_read_at",
        lambda: column_exists(db, "reading_sessions", "read_at"),
        "ALTER TABLE reading_sessions ADD COLUMN read_at TEXT",
    )

    run_migration(
        "add_books_book_type",
        lambda: column_exists(db, "books", "book_type"),
        "ALTER TABLE books ADD COLUMN book_type TEXT DEFAULT 'Livro'",
    )
    
    # =========================================================================
    # FINANCE MODULE
    # =========================================================================

    run_migration(
    "create_finance_config_table",
    lambda: table_exists(db, "finance_config"),
    """
    CREATE TABLE IF NOT EXISTS finance_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        
        -- Receitas
        salary_monthly REAL DEFAULT 0,
        monthly_contribution REAL DEFAULT 0,
        thirteenth REAL DEFAULT 0,

        -- Saldos iniciais
        reserve_current REAL DEFAULT 0,
        reserve_cdb REAL DEFAULT 0,
        reserve_extra REAL DEFAULT 0,

        -- FGTS
        fgts REAL DEFAULT 0,  -- valor depositado mensalmente
       
        -- Taxas
        cdi_rate_annual REAL DEFAULT 0,        -- CDI anual (%)
        cdb_percent_cdi REAL DEFAULT 100,      -- % do CDI (ex: 100)
        extra_percent_cdi REAL DEFAULT 100,    -- % do CDI (ex: 120)
        interest_rate_current REAL DEFAULT 0,  -- % anual conta corrente

        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
)


    run_migration(
        "add_finance_config_reserve_fgts",
        lambda: column_exists(db, "finance_config", "reserve_fgts"),
        "ALTER TABLE finance_config ADD COLUMN reserve_fgts REAL DEFAULT 0",
    )

    run_migration(
        "add_finance_config_interest_rate_fgts",
        lambda: column_exists(db, "finance_config", "interest_rate_fgts"),
        "ALTER TABLE finance_config ADD COLUMN interest_rate_fgts REAL DEFAULT 3",
    )

    run_migration(
        "create_finance_fixed_expenses_table",
        lambda: table_exists(db, "finance_fixed_expenses"),
        """
        CREATE TABLE IF NOT EXISTS finance_fixed_expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            monthly_value REAL NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """,
    )

    run_migration(
        "v20260227_add_consumables_tables",
        lambda: (
            table_exists(db, "consumable_categories")
            and table_exists(db, "consumable_items")
            and table_exists(db, "consumable_cycles")
            and index_exists(db, "idx_consumable_cycles_open_item")
            and trigger_exists(db, "trg_consumable_cycles_no_delete")
            and trigger_exists(db, "trg_consumable_cycles_close_only")
        ),
        read_migration_sql("20260227_add_consumables_tables.sql"),
    )

    run_migration(
        "v20260302_add_finance_transactions",
        lambda: table_exists(db, "finance_transactions"),
        read_migration_sql("20260302_add_finance_transactions.sql"),
    )

    run_migration(
        "add_user_profile_gender",
        lambda: column_exists(db, "user_profile", "gender"),
        "ALTER TABLE user_profile ADD COLUMN gender TEXT",
    )
    run_migration(
        "add_user_profile_photo_path",
        lambda: column_exists(db, "user_profile", "photo_path"),
        "ALTER TABLE user_profile ADD COLUMN photo_path TEXT",
    )
    run_migration(
        "add_user_profile_updated_at",
        lambda: column_exists(db, "user_profile", "updated_at"),
        "ALTER TABLE user_profile ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP",
    )
    run_migration(
        "add_user_metrics_body_fat",
        lambda: column_exists(db, "user_metrics", "body_fat"),
        "ALTER TABLE user_metrics ADD COLUMN body_fat REAL",
    )
    run_migration(
        "add_user_metrics_muscle_mass",
        lambda: column_exists(db, "user_metrics", "muscle_mass"),
        "ALTER TABLE user_metrics ADD COLUMN muscle_mass REAL",
    )
    run_migration(
        "add_user_metrics_notes",
        lambda: column_exists(db, "user_metrics", "notes"),
        "ALTER TABLE user_metrics ADD COLUMN notes TEXT",
    )


    db.execute("INSERT OR IGNORE INTO book_types (name) VALUES ('Livro')")
    db.execute(
        """
        UPDATE books
        SET book_type_id = (
            SELECT id FROM book_types bt WHERE LOWER(bt.name) = LOWER(COALESCE(NULLIF(TRIM(books.book_type), ''), 'Livro'))
        )
        WHERE book_type_id IS NULL
        """
    )

    applied = sum(1 for item in migration_log if item["status"] == "applied")
    skipped = sum(1 for item in migration_log if item["status"] == "skipped")
    logger.info("[migrations] Completed - applied=%s skipped=%s", applied, skipped)
    return migration_log


class Database:
    def __init__(self, path=None):
        self.path = str(path or (_get_edi_storage_dir() / "lifemanager.db"))
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        _migrate_legacy_database_file(Path(self.path))
        try:
            self.conn = sqlite3.connect(self.path)
            self.conn.row_factory = sqlite3.Row
            logger.info(f"Conexão com banco de dados estabelecida: {self.path}")
        except Exception as e:
            logger.error(f"Erro ao conectar ao banco de dados: {e}")
            raise

    def __enter__(self):
        """Suporte para context manager (with statement)"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Fecha conexão e faz commit automático se não houver erros"""
        if exc_type is None:
            try:
                self.commit()
            except Exception as e:
                logger.error(f"Erro ao fazer commit: {e}")
        else:
            logger.error(f"Erro durante transação: {exc_val}")
        self.close()
        return False  # Não suprime exceções

    def execute(self, query, params=()):
        try:
            cursor = self.conn.execute(query, params)
            return cursor
        except Exception as e:
            logger.error(f"Erro ao executar query: {e}")
            logger.error(f"Query: {query}")
            logger.error(f"Params: {params}")
            raise

    @property
    def lastrowid(self):
        """Retorna o ID da última linha inserida"""
        return self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]

    def fetchall(self, query, params=()):
        try:
            cursor = self.execute(query, params)
            return cursor.fetchall()
        except Exception as e:
            logger.error(f"Erro ao buscar dados: {e}")
            raise

    def fetchone(self, query, params=()):
        try:
            cursor = self.execute(query, params)
            return cursor.fetchone()
        except Exception as e:
            logger.error(f"Erro ao buscar dado: {e}")
            raise

    def commit(self):
        try:
            self.conn.commit()
            logger.debug("Commit realizado com sucesso")
        except Exception as e:
            logger.error(f"Erro ao fazer commit: {e}")
            raise

    def close(self):
        try:
            self.conn.close()
            logger.debug("Conexão fechada")
        except Exception as e:
            logger.error(f"Erro ao fechar conexão: {e}")


# -------------------------
# Inicialização do banco
# -------------------------

def initialize_database():
    db_path = _get_edi_storage_dir() / "lifemanager.db"
    schema_path = Path(__file__).resolve().parent / "schema.sql"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    _migrate_legacy_database_file(db_path)

    db = Database(db_path)

    # Executa schema base
    with open(schema_path, "r", encoding="utf-8") as f:
        db.conn.executescript(f.read())

    # Aplica migrations aditivas
    apply_migrations(db)

    # =====================================================
    # SEED DAILY ROUTINES (auto-create default work/off)
    # =====================================================

    

    db.commit()
    db.close()
