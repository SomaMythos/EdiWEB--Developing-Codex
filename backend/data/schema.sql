---schema.sql---


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
    notes TEXT,
    date TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES user_profile(id)
);



-- =========================
-- ATIVIDADES
-- =========================
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,

    min_duration INTEGER NOT NULL DEFAULT 30,
    max_duration INTEGER NOT NULL DEFAULT 60,

    frequency_type TEXT DEFAULT 'flex', -- flex, everyday, workday, offday

    fixed_time TEXT,       -- HH:MM se for horário fixo
    fixed_duration INTEGER, -- duração fixa em minutos

    is_disc INTEGER NOT NULL DEFAULT 1,
    is_fun INTEGER NOT NULL DEFAULT 0,

    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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
-- DAILY ROUTINE SYSTEM (Day Engine Base)
-- =========================


-- Presets de tipo de dia (work / off)
CREATE TABLE IF NOT EXISTS daily_routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_type TEXT NOT NULL, -- 'work' ou 'off'
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Blocos fixos que estruturam o dia
CREATE TABLE IF NOT EXISTS daily_routine_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    category TEXT DEFAULT 'fixed',
    is_locked INTEGER DEFAULT 1, -- escrito em pedra
    track_completion INTEGER DEFAULT 1,
    FOREIGN KEY(routine_id) REFERENCES daily_routines(id) ON DELETE CASCADE
);

-- Subatividades dentro de um bloco fixo
CREATE TABLE IF NOT EXISTS daily_routine_block_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_id INTEGER NOT NULL,
    activity_id INTEGER,
    label TEXT,
    estimated_time INTEGER,
    track_completion INTEGER DEFAULT 1,
    FOREIGN KEY(block_id) REFERENCES daily_routine_blocks(id) ON DELETE CASCADE,
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- METAS (GOALS)
-- =========================
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'ativa',
    deadline TEXT,
    difficulty INTEGER DEFAULT 1,
    category_id INTEGER,
    image_path TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES goal_categories(id)
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
-- LIVROS
-- =========================
CREATE TABLE IF NOT EXISTS book_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    book_type TEXT DEFAULT 'livro',
    book_type_id INTEGER,
    total_pages INTEGER DEFAULT 0,
    current_page INTEGER DEFAULT 0,
    status TEXT DEFAULT 'lendo',
    genre TEXT,
    cover_image TEXT,
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_type_id) REFERENCES book_types(id)
);

CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    start_page INTEGER,
    end_page INTEGER,
    duration INTEGER,
    read_at TEXT DEFAULT CURRENT_TIMESTAMP,
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- =========================
-- PINTURAS E FOTOS
-- =========================
CREATE TABLE IF NOT EXISTS paintings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    size TEXT,
    description TEXT,
    estimated_time INTEGER,
    category TEXT DEFAULT 'pintura',
    visual_category TEXT DEFAULT 'pintura',
    reference_image_path TEXT,
    time_spent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'em_progresso',
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS painting_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    painting_id INTEGER NOT NULL,
    update_title TEXT,
    photo_path TEXT,
    time_spent INTEGER DEFAULT 0,
    notes TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_type TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    date TEXT,
    file_path TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(folder_id) REFERENCES media_folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS progress_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    description TEXT,
    duration INTEGER,
    date TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- =========================
-- SHOPPING
-- =========================
CREATE TABLE IF NOT EXISTS wish_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL,
    link TEXT,
    item_type TEXT,
    photo_url TEXT,
    is_marked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS restock_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    created_at TEXT,
    restock_date TEXT,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchase_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    quantity INTEGER DEFAULT 1,
    price REAL DEFAULT 0,
    purchase_date TEXT NOT NULL,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE SET NULL
);

-- =========================
-- LEMBRETES E PLANO DO DIA
-- =========================
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
);

CREATE TABLE IF NOT EXISTS daily_plan_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    activity_id INTEGER,
    source_type TEXT,
    block_name TEXT,
    completed INTEGER DEFAULT 0
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

-- =========================
-- GOAL CATEGORIES (NOVA FEATURE)
-- =========================

CREATE TABLE IF NOT EXISTS goal_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- FINANCEIRO
-- =========================

CREATE TABLE IF NOT EXISTS finance_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Renda
    salary_monthly REAL DEFAULT 0,

	-- Reservas iniciais
	reserve_current REAL DEFAULT 0,
	reserve_cdb REAL DEFAULT 0,
	reserve_extra REAL DEFAULT 0,
	reserve_fgts REAL DEFAULT 0,

	-- Depósito mensal FGTS
	fgts REAL DEFAULT 0,	

    -- Fluxo mensal
    monthly_contribution REAL DEFAULT 0,
    thirteenth REAL DEFAULT 0,

    -- CDI e percentuais
    cdi_rate_annual REAL DEFAULT 0,       -- Ex: 13.15 (% ao ano)
    cdb_percent_cdi REAL DEFAULT 100,     -- Ex: 100 (% do CDI)
    extra_percent_cdi REAL DEFAULT 120,   -- Ex: 120 (% do CDI)

    -- Juros específicos
    interest_rate_current REAL DEFAULT 0, -- % ao mês
    interest_rate_fgts REAL DEFAULT 3,    -- 3% ao ano padrão FGTS

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS finance_fixed_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    monthly_value REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- DAILY CONFIG (Day Engine Base Configuration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS daily_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),

    sleep_start TEXT DEFAULT '22:30',
    sleep_end TEXT DEFAULT '06:30',

    work_start TEXT DEFAULT '08:00',
    work_end TEXT DEFAULT '17:00',

    buffer_between INTEGER DEFAULT 10,
    granularity_min INTEGER DEFAULT 5,
    avoid_category_adjacent INTEGER DEFAULT 1,

    discipline_weight INTEGER DEFAULT 1,
    fun_weight INTEGER DEFAULT 1,

    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);


INSERT OR IGNORE INTO daily_config (id) VALUES (1);

-- ==========================================================================
-- DAILY OVERRIDES (feriados / dias especiais)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS daily_overrides (
    date TEXT PRIMARY KEY,
    is_off INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_activity_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    activity_id INTEGER NOT NULL,
    times_scheduled INTEGER DEFAULT 0,
    times_completed INTEGER DEFAULT 0,
    UNIQUE(week_start, activity_id)
);
