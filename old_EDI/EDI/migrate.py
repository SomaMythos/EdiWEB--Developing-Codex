"""
Script de Migração do Banco de Dados EDI
Atualiza bancos de dados existentes com novas tabelas e colunas
"""

import sqlite3
import os
from datetime import datetime


def migrate_database(db_path="data/lifemanager.db"):
    """
    Aplica migrações necessárias ao banco de dados existente
    """
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        return False
    
    print(f"🔄 Iniciando migração do banco de dados: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Backup antes de migrar
        backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"📦 Criando backup em: {backup_path}")
        
        import shutil
        shutil.copy2(db_path, backup_path)
        
        # Verificar se as tabelas já existem
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='goals'
        """)

        if cursor.fetchone():
            print("ℹ️  Tabela 'goals' já existe. Verificando colunas...")
            cursor.execute("PRAGMA table_info(goals)")
            columns = [col[1] for col in cursor.fetchall()]
            required_columns = {
                "description": "ALTER TABLE goals ADD COLUMN description TEXT",
                "difficulty": "ALTER TABLE goals ADD COLUMN difficulty INTEGER DEFAULT 3",
                "status": "ALTER TABLE goals ADD COLUMN status TEXT DEFAULT 'ativa'",
                "deadline": "ALTER TABLE goals ADD COLUMN deadline TEXT",
                "created_at": "ALTER TABLE goals ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP",
                "completed_at": "ALTER TABLE goals ADD COLUMN completed_at TEXT",
            }

            for column, statement in required_columns.items():
                if column not in columns:
                    print(f"➕ Adicionando coluna '{column}' à tabela 'goals'...")
                    cursor.execute(statement)
        else:
            print("➕ Criando tabela 'goals'...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS goals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    difficulty INTEGER DEFAULT 3,
                    status TEXT DEFAULT 'ativa',
                    deadline TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    completed_at TEXT
                )
            """)
            print("✅ Tabela 'goals' criada com sucesso!")
        
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='goal_activities'
        """)
        
        if cursor.fetchone():
            print("ℹ️  Tabela 'goal_activities' já existe. Pulando migração.")
        else:
            print("➕ Criando tabela 'goal_activities'...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS goal_activities (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    goal_id INTEGER NOT NULL,
                    activity_id INTEGER NOT NULL,
                    FOREIGN KEY(goal_id) REFERENCES goals(id) ON DELETE CASCADE,
                    FOREIGN KEY(activity_id) REFERENCES activities(id) ON DELETE CASCADE,
                    UNIQUE(goal_id, activity_id)
                )
            """)
            print("✅ Tabela 'goal_activities' criada com sucesso!")
        
        # Verificar se a coluna timestamp existe em daily_activity_logs
        cursor.execute("PRAGMA table_info(daily_activity_logs)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'timestamp' not in columns:
            print("➕ Adicionando coluna 'timestamp' à tabela 'daily_activity_logs'...")
            cursor.execute("""
                ALTER TABLE daily_activity_logs 
                ADD COLUMN timestamp TEXT
            """)
            print("✅ Coluna 'timestamp' adicionada!")
        else:
            print("ℹ️  Coluna 'timestamp' já existe em 'daily_activity_logs'")

        # Verificar coluna auto_fill_allowed em routine_blocks
        cursor.execute("PRAGMA table_info(routine_blocks)")
        columns = [col[1] for col in cursor.fetchall()]

        if "auto_fill_allowed" not in columns:
            print("➕ Adicionando coluna 'auto_fill_allowed' à tabela 'routine_blocks'...")
            cursor.execute("""
                ALTER TABLE routine_blocks
                ADD COLUMN auto_fill_allowed INTEGER DEFAULT 1
            """)
            print("✅ Coluna 'auto_fill_allowed' adicionada!")
        else:
            print("ℹ️  Coluna 'auto_fill_allowed' já existe em 'routine_blocks'")

        # Normalizar status de metas antigas
        cursor.execute("UPDATE goals SET status = 'ativa' WHERE status = 'pendente'")

        # Progress photos table
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='progress_photos'
        """)

        if not cursor.fetchone():
            print("➕ Criando tabela 'progress_photos'...")
            cursor.execute("""
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
            """)
            print("✅ Tabela 'progress_photos' criada com sucesso!")

        # Painting tables
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='paintings'
        """)
        if not cursor.fetchone():
            print("➕ Criando tabela 'paintings'...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS paintings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    estimated_time INTEGER,
                    time_spent INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'em_progresso',
                    started_at TEXT,
                    finished_at TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✅ Tabela 'paintings' criada com sucesso!")

        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='painting_progress'
        """)
        if not cursor.fetchone():
            print("➕ Criando tabela 'painting_progress'...")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS painting_progress (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    painting_id INTEGER NOT NULL,
                    photo_path TEXT NOT NULL,
                    time_spent INTEGER NOT NULL,
                    notes TEXT,
                    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(painting_id) REFERENCES paintings(id) ON DELETE CASCADE
                )
            """)
            print("✅ Tabela 'painting_progress' criada com sucesso!")

        # Atualizar tabela books com book_type
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name='books'
        """)
        if cursor.fetchone():
            cursor.execute("PRAGMA table_info(books)")
            columns = [col[1] for col in cursor.fetchall()]
            if "book_type" not in columns:
                print("➕ Adicionando coluna 'book_type' à tabela 'books'...")
                cursor.execute("""
                    ALTER TABLE books
                    ADD COLUMN book_type TEXT DEFAULT 'livro'
                """)
                print("✅ Coluna 'book_type' adicionada!")

        conn.commit()
        conn.close()
        
        print("\n🎉 Migração concluída com sucesso!")
        print(f"📁 Backup salvo em: {backup_path}")
        return True
        
    except Exception as e:
        print(f"\n❌ Erro durante migração: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("EDI - Script de Migração de Banco de Dados")
    print("=" * 60)
    print()
    
    # Migrar banco principal
    success = migrate_database("data/lifemanager.db")
    
    # Verificar se existe o banco antigo (edi.db)
    if os.path.exists("data/edi.db"):
        print("\n" + "=" * 60)
        print("📌 Banco antigo detectado: data/edi.db")
        response = input("Deseja migrar este banco também? (s/n): ")
        if response.lower() in ['s', 'sim', 'y', 'yes']:
            migrate_database("data/edi.db")
    
    print("\n" + "=" * 60)
    if success:
        print("✅ Processo finalizado! Você pode iniciar o EDI normalmente.")
    else:
        print("⚠️  Ocorreram erros. Verifique os logs acima.")
    print("=" * 60)
