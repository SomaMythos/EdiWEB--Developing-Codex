PRAGMA foreign_keys = ON;

-- =========================
-- PERFIL DO USUÁRIO (EXPANDIDO)
-- =========================
CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    birth_date TEXT,
    height REAL,
    gender TEXT,
    email TEXT,
    phone TEXT,
    avatar_path TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    language TEXT DEFAULT 'pt_BR',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    weight REAL,
    date TEXT NOT NULL,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES user_profile(id)
);

-- =========================
-- TIPOS DE ATIVIDADE ESPECIALIZADOS
-- =========================
CREATE TABLE IF NOT EXISTS activity_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    role TEXT NOT NULL,  -- 'rotina' ou 'atividade'
    progress_mode TEXT NOT NULL DEFAULT 'frequencia',
    icon TEXT,
    color TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ATIVIDADES (EXPANDIDO)
-- =========================
CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type_id INTEGER NOT NULL,
    estimated_time INTEGER,
    priority INTEGER DEFAULT 2,  -- 1=alta, 2=média, 3=baixa
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(type_id) REFERENCES activity_types(id)
);

CREATE TABLE IF NOT EXISTS activity_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- =========================
-- LIVROS (LEITURA)
-- =========================
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    book_type TEXT DEFAULT 'livro' CHECK (book_type IN ('livro', 'hq', 'manga')),
    total_pages INTEGER NOT NULL,
    current_page INTEGER DEFAULT 0,
    isbn TEXT,
    cover_path TEXT,
    started_at TEXT,
    finished_at TEXT,
    rating INTEGER,  -- 1-5 estrelas
    notes TEXT,
    status TEXT DEFAULT 'lendo',  -- 'lendo', 'concluído', 'pausado', 'abandonado'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    pages_read INTEGER NOT NULL,
    duration INTEGER,  -- minutos
    date TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- =========================
-- PINTURAS (ARTE)
-- =========================
CREATE TABLE IF NOT EXISTS paintings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    size TEXT,
    description TEXT,
    time_spent INTEGER DEFAULT 0,  -- minutos totais
    estimated_time INTEGER,
    status TEXT DEFAULT 'em_progresso',  -- 'em_progresso', 'concluído', 'pausado'
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS painting_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    painting_id INTEGER NOT NULL,
    photo_path TEXT NOT NULL,
    time_spent INTEGER,  -- minutos nesta sessão
    notes TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
);

-- =========================
-- LOG DIÁRIO (EXPANDIDO)
-- =========================
CREATE TABLE IF NOT EXISTS daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    mood INTEGER,  -- 1-5 (péssimo a excelente)
    energy_level INTEGER,  -- 1-5
    notes TEXT,
    weather TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_log_id INTEGER NOT NULL,
    activity_id INTEGER NOT NULL,
    duration INTEGER,
    completed INTEGER DEFAULT 0,
    progress_value TEXT,  -- JSON com dados específicos (páginas, %, etc)
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY(daily_log_id) REFERENCES daily_logs(id),
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- ROTINAS (MELHORADO)
-- =========================
CREATE TABLE IF NOT EXISTS routines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    period TEXT NOT NULL,  -- 'manha', 'tarde', 'noite', 'madrugada'
    start_time TEXT,
    end_time TEXT,
    active INTEGER DEFAULT 1,
    auto_fill_enabled INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routine_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    routine_id INTEGER NOT NULL,
    activity_id INTEGER,
    order_index INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    auto_fill_allowed INTEGER DEFAULT 1,
    FOREIGN KEY(routine_id) REFERENCES routines(id) ON DELETE CASCADE,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE SET NULL
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
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS fixed_daily_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    activity_id INTEGER,
    source_type TEXT DEFAULT 'rotina', -- 'rotina' ou 'atividade'
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE SET NULL
);

-- =========================
-- METAS COM SUBTAREFAS
-- =========================
CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- 'saude', 'financeiro', 'pessoal', 'profissional', etc
    status TEXT DEFAULT 'ativa',  -- 'ativa', 'concluida', 'cancelada', 'pausada'
    priority INTEGER DEFAULT 2,  -- 1=alta, 2=média, 3=baixa
    deadline TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goal_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE
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
-- COMPRAS DO MÊS
-- =========================
CREATE TABLE IF NOT EXISTS shopping_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,  -- 'alimentacao', 'higiene', 'limpeza', 'outros'
    average_price REAL,
    last_price REAL,
    quantity REAL DEFAULT 1,
    unit TEXT DEFAULT 'unidade',  -- 'unidade', 'kg', 'litro', 'pacote'
    replenishment_days INTEGER,  -- dias até precisar repor
    last_purchased TEXT,
    next_purchase_estimate TEXT,
    store_preference TEXT,
    notes TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    month TEXT,  -- formato YYYY-MM
    status TEXT DEFAULT 'planejada',  -- 'planejada', 'em_andamento', 'concluida'
    estimated_total REAL,
    actual_total REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity REAL DEFAULT 1,
    estimated_price REAL,
    actual_price REAL,
    purchased INTEGER DEFAULT 0,
    purchased_at TEXT,
    FOREIGN KEY(list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES shopping_items(id)
);

-- =========================
-- HÁBITOS & STREAKS
-- =========================
CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL,  -- 'diario', 'semanal', 'mensal'
    target_days INTEGER,  -- dias por semana/mês
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    completed INTEGER DEFAULT 1,
    notes TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    UNIQUE(habit_id, date)
);

-- =========================
-- GAMIFICAÇÃO
-- =========================
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    points INTEGER DEFAULT 0,
    type TEXT,  -- 'atividade', 'meta', 'habito', 'streak', etc
    unlocked INTEGER DEFAULT 0,
    unlocked_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    total_points INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES user_profile(id)
);

CREATE TABLE IF NOT EXISTS point_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    points INTEGER NOT NULL,
    reason TEXT,
    reference_type TEXT,  -- 'atividade', 'meta', 'habito', etc
    reference_id INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES user_profile(id)
);

-- =========================
-- LEMBRETES
-- =========================
CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    reminder_type TEXT NOT NULL,  -- 'atividade', 'meta', 'compra', 'generico'
    reference_id INTEGER,
    scheduled_time TEXT NOT NULL,
    repeat_pattern TEXT,  -- 'diario', 'semanal', 'mensal', 'nenhum'
    active INTEGER DEFAULT 1,
    last_triggered TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- TIMER POMODORO
-- =========================
CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id INTEGER,
    duration INTEGER NOT NULL,  -- minutos (geralmente 25)
    break_duration INTEGER,  -- minutos de pausa
    completed INTEGER DEFAULT 0,
    started_at TEXT,
    finished_at TEXT,
    notes TEXT,
    FOREIGN KEY(activity_id) REFERENCES activities(id)
);

-- =========================
-- CONFIGURAÇÕES DO USUÁRIO
-- =========================
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    FOREIGN KEY(user_id) REFERENCES user_profile(id),
    UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT
);

-- =========================
-- ÍNDICES PARA PERFORMANCE
-- =========================
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_daily_activity_logs_date ON daily_activity_logs(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_month ON shopping_lists(month);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_paintings_status ON paintings(status);
