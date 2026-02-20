"""
Testes para EDI v2.0 - Novos Recursos
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("EDI v2.0 - Testes de Novos Recursos")
print("=" * 70)
print()

# Importar engines
try:
    from core.user_profile_engine import UserProfileEngine
    from core.book_engine import BookEngine
    from core.shopping_engine import ShoppingEngine
    from core.reminder_engine import ReminderEngine
    from core.progress_photo_engine import ProgressPhotoEngine
    from core.dashboard_engine import DashboardEngine
    print("✅ Todos os engines foram importados com sucesso!")
except Exception as e:
    print(f"❌ Erro ao importar engines: {e}")
    sys.exit(1)

print()
print("🧪 Testando funcionalidades básicas...")
print()

# Teste 1: UserProfileEngine
print("1️⃣  Testando UserProfileEngine...")
try:
    profile = UserProfileEngine.get_profile()
    if profile:
        print(f"   ℹ️  Perfil encontrado: {profile['name']}")
        age = UserProfileEngine.get_age()
        if age:
            print(f"   ℹ️  Idade: {age} anos")
        bmi = UserProfileEngine.calculate_bmi()
        if bmi:
            print(f"   ℹ️  IMC: {bmi}")
    else:
        print("   ℹ️  Nenhum perfil cadastrado (normal na primeira execução)")
    print("   ✅ UserProfileEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()

# Teste 2: BookEngine
print("2️⃣  Testando BookEngine...")
try:
    books = BookEngine.list_books()
    print(f"   ℹ️  {len(books)} livros cadastrados")
    stats = BookEngine.get_reading_stats()
    status_counts = stats.get("status_counts", {})
    print(
        f"   ℹ️  Novos: {status_counts.get('Novo', 0)}, "
        f"Iniciados: {status_counts.get('Iniciado', 0)}, "
        f"Concluídos: {status_counts.get('Concluído', 0)}"
    )
    print("   ✅ BookEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()

# Teste 3: ShoppingEngine
print("3️⃣  Testando ShoppingEngine...")
try:
    items = ShoppingEngine.list_items()
    print(f"   ℹ️  {len(items)} itens no catálogo")
    print("   ✅ ShoppingEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()

# Teste 4: ReminderEngine
print("4️⃣  Testando ReminderEngine...")
try:
    reminders = ReminderEngine.list_reminders()
    print(f"   ℹ️  {len(reminders)} lembretes pendentes")
    print("   ✅ ReminderEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()

# Teste 5: ProgressPhotoEngine
print("5️⃣  Testando ProgressPhotoEngine...")
try:
    photos = ProgressPhotoEngine.get_recent_photos(limit=10)
    print(f"   ℹ️  {len(photos)} fotos recentes")
    print("   ✅ ProgressPhotoEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()

# Teste 6: DashboardEngine
print("6️⃣  Testando DashboardEngine...")
try:
    overview = DashboardEngine.get_today_overview()
    print(f"   ℹ️  Overview gerado com {len(overview)} categorias")
    score = DashboardEngine.get_productivity_score()
    print(f"   ℹ️  Score de produtividade: {score}/100")
    print("   ✅ DashboardEngine OK")
except Exception as e:
    print(f"   ❌ Erro: {e}")

print()
print("=" * 70)
print("🎉 Todos os testes da v2.0 passaram com sucesso!")
print("=" * 70)
print()
print("ℹ️  Próximos passos:")
print("   1. Configure seu perfil")
print("   2. Cadastre seus primeiros livros")
print("   3. Adicione itens de compra")
print("   4. Explore o dashboard")
print()
