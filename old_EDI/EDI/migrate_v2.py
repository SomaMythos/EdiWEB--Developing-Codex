"""
Script de Migração EDI v1.x -> v2.0
Adiciona todas as novas tabelas e funcionalidades
"""

import sqlite3
import os
from datetime import datetime
import shutil

def migrate_to_v2(db_path="data/lifemanager.db"):
    """Migra banco de dados para v2.0"""
    
    if not os.path.exists(db_path):
        print(f"❌ Banco de dados não encontrado: {db_path}")
        print("ℹ️  Um novo banco será criado automaticamente ao iniciar o app.")
        return True
    
    print("=" * 70)
    print("EDI - Migração para v2.0")
    print("=" * 70)
    print()
    
    # Backup
    backup_path = f"{db_path}.backup_v1_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"📦 Criando backup: {backup_path}")
    shutil.copy2(db_path, backup_path)
    print("✅ Backup criado!")
    print()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("🔄 Aplicando migrações...")
        print()
        
        # 1. Atualizar user_profile
        print("1️⃣  Atualizando tabela user_profile...")
        try:
            cursor.execute("ALTER TABLE user_profile ADD COLUMN gender TEXT")
            cursor.execute("ALTER TABLE user_profile ADD COLUMN photo_path TEXT")
            cursor.execute("ALTER TABLE user_profile ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP")
            print("   ✅ user_profile atualizada")
        except:
            print("   ℹ️  user_profile já estava atualizada")
        
        # 2. Atualizar user_metrics
        print("2️⃣  Atualizando tabela user_metrics...")
        try:
            cursor.execute("ALTER TABLE user_metrics ADD COLUMN body_fat REAL")
            cursor.execute("ALTER TABLE user_metrics ADD COLUMN muscle_mass REAL")
            cursor.execute("ALTER TABLE user_metrics ADD COLUMN notes TEXT")
            print("   ✅ user_metrics atualizada")
        except:
            print("   ℹ️  user_metrics já estava atualizada")
        
        # 3. Criar tabela books
        print("3️⃣  Criando tabela books...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                book_type TEXT DEFAULT 'livro',
                total_pages INTEGER NOT NULL,
                current_page INTEGER DEFAULT 0,
                genre TEXT,
                cover_image TEXT,
                status TEXT DEFAULT 'lendo',
                started_at TEXT,
                finished_at TEXT,
                rating INTEGER,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✅ Tabela books criada")

        cursor.execute("PRAGMA table_info(books)")
        book_columns = [col[1] for col in cursor.fetchall()]
        if "book_type" not in book_columns:
            print("   ➕ Adicionando coluna 'book_type' em books...")
            cursor.execute("ALTER TABLE books ADD COLUMN book_type TEXT DEFAULT 'livro'")

        # 4. Criar tabela reading_sessions
        print("4️⃣  Criando tabela reading_sessions...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reading_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL,
                pages_read INTEGER NOT NULL,
                start_page INTEGER,
                end_page INTEGER,
                duration INTEGER,
                date TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
            )
        """)
        print("   ✅ Tabela reading_sessions criada")
        
        # 5. Criar tabela progress_photos
        print("5️⃣  Criando tabela progress_photos...")
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
        print("   ✅ Tabela progress_photos criada")
        
        # 6. Criar tabela shopping_items
        print("6️⃣  Criando tabela shopping_items...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shopping_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT,
                average_price REAL,
                last_price REAL,
                restock_days INTEGER,
                quantity_per_purchase INTEGER DEFAULT 1,
                unit TEXT,
                priority INTEGER DEFAULT 3,
                notes TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✅ Tabela shopping_items criada")
        
        # 7. Criar tabela purchase_history
        print("7️⃣  Criando tabela purchase_history...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS purchase_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                purchase_date TEXT NOT NULL,
                store TEXT,
                notes TEXT,
                FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
            )
        """)
        print("   ✅ Tabela purchase_history criada")
        
        # 8. Criar tabela shopping_lists
        print("8️⃣  Criando tabela shopping_lists...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shopping_lists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_date TEXT NOT NULL,
                target_date TEXT,
                status TEXT DEFAULT 'pendente',
                estimated_total REAL,
                actual_total REAL,
                notes TEXT
            )
        """)
        print("   ✅ Tabela shopping_lists criada")
        
        # 9. Criar tabela shopping_list_items
        print("9️⃣  Criando tabela shopping_list_items...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS shopping_list_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                list_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                estimated_price REAL,
                checked INTEGER DEFAULT 0,
                actual_price REAL,
                FOREIGN KEY(list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
                FOREIGN KEY(item_id) REFERENCES shopping_items(id) ON DELETE CASCADE
            )
        """)
        print("   ✅ Tabela shopping_list_items criada")
        
        # 10. Criar tabela reminders
        print("🔟 Criando tabela reminders...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                due_date TEXT,
                priority INTEGER DEFAULT 3,
                category TEXT,
                status TEXT DEFAULT 'pendente',
                reminder_days_before INTEGER DEFAULT 7,
                completed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        print("   ✅ Tabela reminders criada")
        
        # 11. Criar tabela daily_stats
        print("1️⃣1️⃣  Criando tabela daily_stats...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE NOT NULL,
                total_activities INTEGER DEFAULT 0,
                completed_activities INTEGER DEFAULT 0,
                total_time_minutes INTEGER DEFAULT 0,
                productivity_score INTEGER,
                mood TEXT,
                energy_level INTEGER,
                notes TEXT
            )
        """)
        print("   ✅ Tabela daily_stats criada")
        
        conn.commit()
        conn.close()
        
        print()
        print("=" * 70)
        print("🎉 Migração concluída com sucesso!")
        print(f"📁 Backup salvo em: {backup_path}")
        print("=" * 70)
        print()
        print("✨ Novos recursos disponíveis:")
        print("   • Sistema de Leitura (Livros e Progresso)")
        print("   • Galeria de Fotos de Progresso")
        print("   • Sistema de Compras Automático")
        print("   • Lembretes e Tarefas Importantes")
        print("   • Dashboard Completo")
        print("   • Métricas Corporais Expandidas")
        print()
        
        return True
        
    except Exception as e:
        print(f"\n❌ Erro durante migração: {e}")
        print(f"💾 Você pode restaurar o backup em: {backup_path}")
        return False


if __name__ == "__main__":
    print()
    success = migrate_to_v2("data/lifemanager.db")
    
    print()
    if success:
        print("✅ Processo finalizado! Você pode iniciar o EDI v2.0 normalmente.")
    else:
        print("⚠️  Ocorreram erros. Verifique os logs acima.")
    print()
