PRAGMA foreign_keys = ON;

-- =========================
-- PERFIL DO USUÁRIO
-- =========================
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birth_date TEXT,
    height REAL,
    gender TEXT,
    photo_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    weight REAL,
    body_fat REAL,
    muscle_mass REAL,
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES user_profile(id)
);

-- =========================
-- TIPOS DE ATIVIDADE
-- =========================
CREATE TABLE IF NOT EXISTS activity_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    role TEXT NOT NULL,      -- 'rotina' ou 'atividade'
    progress_mode TEXT NOT NULL DEFAULT 'frequencia'
);

-- =========================
-- ATIVIDADES
-- =========================
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type_id INTEGER NOT NULL,
    estimated_time INTEGER,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(type_id) REFERENCES activity_types(id)
);

CREATE TABLE IF NOT EXISTS activity_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- LOG DIÁRIO
-- =========================
CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS daily_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_log_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    duration INTEGER,
    completed INTEGER,
    timestamp TEXT,
    FOREIGN KEY(daily_log_id) REFERENCES daily_logs(id),
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- ROTINAS (futuro)
-- =========================
CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT
);

CREATE TABLE IF NOT EXISTS routine_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL,
    activity_id INTEGER,
    duration INTEGER NOT NULL,
    auto_fill_allowed INTEGER DEFAULT 1,
    FOREIGN KEY(routine_id) REFERENCES routines(id),
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT
);

-- =========================
-- PLANEJAMENTO DIÁRIO
-- =========================
CREATE TABLE IF NOT EXISTS daily_plan_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    activity_id INTEGER,
    source_type TEXT DEFAULT 'atividade', -- 'rotina' ou 'atividade'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

CREATE TABLE IF NOT EXISTS fixed_daily_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    activity_id INTEGER,
    source_type TEXT DEFAULT 'rotina', -- 'rotina' ou 'atividade'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- METAS (GOALS)
-- =========================
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    difficulty INTEGER DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'concluida', 'cancelada')),
    deadline TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS goal_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE,
    UNIQUE(goal_id, activity_id)
);

-- =========================
-- LIVROS E LEITURA
-- =========================
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    book_type TEXT DEFAULT 'livro' CHECK (book_type IN ('livro', 'hq', 'manga')),
    total_pages INTEGER NOT NULL,
    current_page INTEGER DEFAULT 0,
    genre TEXT,
    cover_image TEXT,
    status TEXT DEFAULT 'lendo',  -- 'lendo', 'concluido', 'pausado'
    started_at TEXT,
    finished_at TEXT,
    rating INTEGER,  -- 1-5
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    duration INTEGER,  -- em minutos
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- =========================
-- GALERIA DE PROGRESSO (Para atividades artísticas)
-- =========================
CREATE TABLE IF NOT EXISTS progress_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    description TEXT,
    duration INTEGER,  -- tempo gasto nesta sessão
    date TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- =========================
-- PINTURAS (para progresso por tempo + fotos)
-- =========================
CREATE TABLE IF NOT EXISTS paintings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    size TEXT,
    description TEXT,
    estimated_time INTEGER,
    time_spent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'em_progresso',  -- 'em_progresso', 'concluído', 'pausado'
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS painting_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    painting_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    time_spent INTEGER NOT NULL,
    notes TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
);

-- =========================
-- COMPRAS E SUPRIMENTOS
-- =========================
CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,  -- 'alimentos', 'higiene', 'limpeza', 'outros'
    average_price REAL,
    last_price REAL,
    restock_days INTEGER,  -- dias até precisar repor
    quantity_per_purchase INTEGER DEFAULT 1,
    unit TEXT,  -- 'un', 'kg', 'l', 'pacote'
    priority INTEGER DEFAULT 3,  -- 1-5 (1=urgente, 5=pode esperar)
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    purchase_date TEXT NOT NULL,
    store TEXT,
    notes TEXT,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,  -- ex: "Compras de Fevereiro 2026"
    created_date TEXT NOT NULL,
    target_date TEXT,  -- quando pretende fazer a compra
    status TEXT DEFAULT 'pendente',  -- 'pendente', 'parcial', 'concluida'
    estimated_total REAL,
    actual_total REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    estimated_price REAL,
    checked INTEGER DEFAULT 0,  -- marcado como comprado
    actual_price REAL,
    FOREIGN KEY(list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wish_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL,
    link TEXT,
    item_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restock_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    restock_date TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
);

-- =========================
-- LEMBRETES E TAREFAS IMPORTANTES
-- =========================
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    priority INTEGER DEFAULT 3,  -- 1-5
    category TEXT,  -- 'saude', 'documentos', 'pessoal', 'trabalho'
    status TEXT DEFAULT 'pendente',  -- 'pendente', 'concluido', 'cancelado'
    reminder_days_before INTEGER DEFAULT 7,  -- avisar X dias antes
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ESTATÍSTICAS E INSIGHTS
-- =========================
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    total_activities INTEGER DEFAULT 0,
    completed_activities INTEGER DEFAULT 0,
    total_time_minutes INTEGER DEFAULT 0,
    productivity_score INTEGER,  -- 0-100
    mood TEXT,  -- 'excelente', 'bom', 'neutro', 'ruim'
    energy_level INTEGER,  -- 1-5
    notes TEXT
);

-- =========================
-- NOTIFICAÇÕES
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    meta TEXT,
    unique_key TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    read_at TEXT
);
