import sqlite3
import logging
from pathlib import Path

DB_PATH = "data/lifemanager.db"

logging.basicConfig(
    level=logging.DEBUG,
    format="[%(levelname)s] %(message)s"
)


class Database:
    def __init__(self, path=DB_PATH):
        self.path = path
        self.conn = None
        self.lastrowid = None

    # -----------------------------
    # Connection handling
    # -----------------------------

    def connect(self):
        if not self.conn:
            self.conn = sqlite3.connect(self.path)
            self.conn.row_factory = sqlite3.Row
            logging.info("Conexão com banco de dados estabelecida %s", self.path)

    def close(self):
        if self.conn:
            self.conn.close()
            self.conn = None
            logging.debug("Conexão fechada")

    def commit(self):
        if self.conn:
            self.conn.commit()
            logging.debug("Commit realizado com sucesso")

    # -----------------------------
    # Core execution
    # -----------------------------

    def execute(self, query, params=()):
        try:
            self.connect()  # 🔥 AUTO-CONNECT AQUI
            cursor = self.conn.execute(query, params)
            self.lastrowid = cursor.lastrowid
            return cursor
        except Exception as e:
            logging.error("[Erro ao executar query] %s", e)
            logging.error("[Query       ] %s", query)
            logging.error("[Params      ] %s", params)
            raise

    # -----------------------------
    # Normalized fetch methods
    # -----------------------------

    def fetchone(self, query, params=()):
        cursor = self.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None

    def fetchall(self, query, params=()):
        cursor = self.execute(query, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

    # -----------------------------
    # Context manager
    # -----------------------------

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type:
            logging.error("[Erro durante transação] %s", exc)
        else:
            self.commit()
        self.close()


# Singleton-style helper
def get_db():
    return Database()


def _table_exists(db, table_name):
    row = db.fetchone(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return bool(row)


def _column_exists(db, table_name, column_name):
    rows = db.fetchall(f"PRAGMA table_info({table_name})")
    return any(row["name"] == column_name for row in rows)


def apply_migrations():
    with Database() as db:
        if _table_exists(db, "goals"):
            goal_columns = {
                "description": "ALTER TABLE goals ADD COLUMN description TEXT",
                "difficulty": "ALTER TABLE goals ADD COLUMN difficulty INTEGER DEFAULT 3",
                "status": "ALTER TABLE goals ADD COLUMN status TEXT DEFAULT 'ativa'",
                "deadline": "ALTER TABLE goals ADD COLUMN deadline TEXT",
                "created_at": "ALTER TABLE goals ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP",
                "completed_at": "ALTER TABLE goals ADD COLUMN completed_at TEXT",
            }
            for column, statement in goal_columns.items():
                if not _column_exists(db, "goals", column):
                    db.execute(statement)

            db.execute("UPDATE goals SET status = 'ativa' WHERE status = 'pendente'")

        if _table_exists(db, "daily_activity_logs"):
            if not _column_exists(db, "daily_activity_logs", "timestamp"):
                db.execute("ALTER TABLE daily_activity_logs ADD COLUMN timestamp TEXT")

        if _table_exists(db, "activity_types"):
            if not _column_exists(db, "activity_types", "progress_mode"):
                db.execute(
                    "ALTER TABLE activity_types "
                    "ADD COLUMN progress_mode TEXT NOT NULL DEFAULT 'frequencia'"
                )

        if _table_exists(db, "routine_blocks"):
            if not _column_exists(db, "routine_blocks", "auto_fill_allowed"):
                db.execute("ALTER TABLE routine_blocks ADD COLUMN auto_fill_allowed INTEGER DEFAULT 1")

        if not _table_exists(db, "progress_photos"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS progress_photos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    activity_id INTEGER NOT NULL,
                    photo_path TEXT NOT NULL,
                    description TEXT,
                    duration INTEGER,
                    date TEXT NOT NULL,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE
                )
                """
            )

        if not _table_exists(db, "paintings"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS paintings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    size TEXT,
                    description TEXT,
                    estimated_time INTEGER,
                    time_spent INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'em_progresso',
                    started_at TEXT,
                    finished_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        else:
            if not _column_exists(db, "paintings", "size"):
                db.execute("ALTER TABLE paintings ADD COLUMN size TEXT")

        if not _table_exists(db, "painting_progress"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS painting_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    painting_id INTEGER NOT NULL,
                    photo_path TEXT NOT NULL,
                    time_spent INTEGER NOT NULL,
                    notes TEXT,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
                )
                """
            )

        if not _table_exists(db, "notifications"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS notifications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    title TEXT,
                    message TEXT,
                    meta TEXT,
                    unique_key TEXT UNIQUE,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    read_at TEXT
                )
                """
            )

        if _table_exists(db, "books"):
            if not _column_exists(db, "books", "book_type"):
                db.execute(
                    "ALTER TABLE books ADD COLUMN book_type TEXT DEFAULT 'livro'"
                )

        if not _table_exists(db, "daily_plan_blocks"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS daily_plan_blocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    duration INTEGER NOT NULL,
                    activity_id INTEGER,
                    source_type TEXT DEFAULT 'atividade',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE SET NULL
                )
                """
            )

        if not _table_exists(db, "fixed_daily_blocks"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS fixed_daily_blocks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_time TEXT NOT NULL,
                    duration INTEGER NOT NULL,
                    activity_id INTEGER,
                    source_type TEXT DEFAULT 'rotina',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE SET NULL
                )
                """
            )

        if not _table_exists(db, "app_settings"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    value TEXT
                )
                """
            )

        if not _table_exists(db, "wish_items"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS wish_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    price REAL,
                    link TEXT,
                    item_type TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

        if not _table_exists(db, "restock_items"):
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS restock_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    item_id INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    restock_date TEXT NOT NULL,
                    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
                )
                """
            )


def initialize_database():
    if not Path(DB_PATH).exists():
        logging.info("Banco não encontrado, criando schema inicial")
        with open("data/schema.sql", "r", encoding="utf-8") as f:
            schema = f.read()

        with Database() as db:
            db.conn.executescript(schema)
            logging.info("Schema criado com sucesso")
    else:
        apply_migrations()
