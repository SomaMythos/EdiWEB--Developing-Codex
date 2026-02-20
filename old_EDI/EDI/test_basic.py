"""
Testes Básicos para EDI - Life Manager
Execute com: python test_basic.py
"""

import sys
import os

# Adicionar diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.database import Database
from core.activity_engine import ActivityEngine
from core.activity_type_engine import ActivityTypeEngine
from core.daily_log_engine import DailyLogEngine
from core.goal_engine import GoalEngine
from core.notification_engine import NotificationEngine
from core.export_engine import ExportEngine


def test_database_connection():
    """Testa conexão com banco de dados"""
    print("🧪 Testando conexão com banco de dados...")
    try:
        with Database() as db:
            result = db.fetchone("SELECT 1 as test")
            assert result["test"] == 1
        print("✅ Conexão com banco OK")
        return True
    except Exception as e:
        print(f"❌ Erro na conexão: {e}")
        return False


def test_schema_tables():
    """Verifica se todas as tabelas necessárias existem"""
    print("\n🧪 Testando schema do banco...")
    
    required_tables = [
        "user_profile",
        "user_metrics",
        "activity_types",
        "activities",
        "activity_metadata",
        "daily_logs",
        "daily_activity_logs",
        "routines",
        "routine_blocks",
        "goals",
        "goal_activities"
    ]
    
    try:
        with Database() as db:
            result = db.fetchall("""
                SELECT name FROM sqlite_master 
                WHERE type='table'
            """)
            existing_tables = [row["name"] for row in result]
            
            missing_tables = [t for t in required_tables if t not in existing_tables]
            
            if missing_tables:
                print(f"⚠️  Tabelas faltando: {', '.join(missing_tables)}")
                print("   Execute: python migrate.py")
                return False
            
            print(f"✅ Todas as {len(required_tables)} tabelas necessárias existem")
            return True
    except Exception as e:
        print(f"❌ Erro ao verificar tabelas: {e}")
        return False


def test_activity_engine():
    """Testa métodos do ActivityEngine"""
    print("\n🧪 Testando ActivityEngine...")
    try:
        # Testar listagem
        activities = ActivityEngine.list_activities()
        print(f"   ℹ️  {len(activities)} atividades encontradas")
        
        # Testar get_progress (deve funcionar mesmo sem atividades)
        if len(activities) > 0:
            progress = ActivityEngine.get_progress(activities[0]["id"])
            print(f"   ℹ️  Progresso da primeira atividade: {progress}")
        
        print("✅ ActivityEngine OK")
        return True
    except Exception as e:
        print(f"❌ Erro no ActivityEngine: {e}")
        return False


def test_daily_log_engine():
    """Testa métodos do DailyLogEngine"""
    print("\n🧪 Testando DailyLogEngine...")
    try:
        # Testar list_day com campos novos
        entries = DailyLogEngine.list_day()
        print(f"   ℹ️  {len(entries)} entradas hoje")
        
        # Verificar se campos necessários existem
        if len(entries) > 0:
            entry = entries[0]
            required_fields = ["title", "role", "start", "end"]
            missing_fields = [f for f in required_fields if f not in entry.keys()]
            
            if missing_fields:
                print(f"⚠️  Campos faltando: {', '.join(missing_fields)}")
                return False
        
        print("✅ DailyLogEngine OK")
        return True
    except Exception as e:
        print(f"❌ Erro no DailyLogEngine: {e}")
        return False


def test_goal_engine():
    """Testa métodos do GoalEngine"""
    print("\n🧪 Testando GoalEngine...")
    try:
        # Testar listagem de metas
        goals = GoalEngine.list_goals()
        print(f"   ℹ️  {len(goals)} metas ativas")
        
        # Testar link_activity (método novo)
        if hasattr(GoalEngine, 'link_activity'):
            print("   ✅ Método link_activity disponível")
        else:
            print("   ⚠️  Método link_activity não encontrado")
            return False
        
        print("✅ GoalEngine OK")
        return True
    except Exception as e:
        print(f"❌ Erro no GoalEngine: {e}")
        return False


def test_notification_engine():
    """Testa métodos do NotificationEngine"""
    print("\n🧪 Testando NotificationEngine...")
    try:
        # Testar verificação de metas paradas
        stalled = NotificationEngine.check_stalled_goals()
        print(f"   ℹ️  {len(stalled)} metas paradas")
        
        # Testar deadlines próximos
        deadlines = NotificationEngine.check_upcoming_deadlines()
        print(f"   ℹ️  {len(deadlines)} deadlines próximos")
        
        # Testar resumo diário
        summary = NotificationEngine.get_daily_summary()
        if summary:
            print(f"   ℹ️  Resumo: {summary['message']}")
        
        print("✅ NotificationEngine OK")
        return True
    except Exception as e:
        print(f"❌ Erro no NotificationEngine: {e}")
        return False


def test_export_engine():
    """Testa métodos do ExportEngine"""
    print("\n🧪 Testando ExportEngine...")
    try:
        # Verificar se diretório de exportação pode ser criado
        ExportEngine._ensure_dir()
        
        if hasattr(ExportEngine, 'export_activities_report'):
            print("   ✅ Método export_activities_report disponível")
        else:
            print("   ⚠️  Método export_activities_report não encontrado")
        
        print("✅ ExportEngine OK")
        return True
    except Exception as e:
        print(f"❌ Erro no ExportEngine: {e}")
        return False


def run_all_tests():
    """Executa todos os testes"""
    print("=" * 60)
    print("EDI - Executando Testes Básicos")
    print("=" * 60)
    
    tests = [
        test_database_connection,
        test_schema_tables,
        test_activity_engine,
        test_daily_log_engine,
        test_goal_engine,
        test_notification_engine,
        test_export_engine
    ]
    
    results = []
    for test in tests:
        results.append(test())
    
    print("\n" + "=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Resultado: {passed}/{total} testes passaram")
    
    if passed == total:
        print("🎉 Todos os testes passaram!")
    else:
        print("⚠️  Alguns testes falharam. Verifique os erros acima.")
    
    print("=" * 60)
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
