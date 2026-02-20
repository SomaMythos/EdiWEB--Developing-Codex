# 🚀 EDI v2.0 - Life Manager

**Personal Assistant & Comprehensive Life Manager**

## ✨ Novidades da v2.0

### 🆕 Recursos Principais

#### 📚 **Sistema de Leitura**
- Cadastro completo de livros (título, autor, páginas, capa)
- Tracking de progresso em % por livro
- Sessões de leitura com duração
- Estatísticas (páginas/mês, livros concluídos)
- Estimativa de dias para terminar baseado no ritmo
- Avaliação com estrelas (1-5)

#### 🛒 **Sistema de Compras Inteligente**
- Catálogo de itens com preço médio
- Dias para reposição configurável
- **Lista automática** gerada baseada em necessidade
- Histórico de compras por item
- Previsão de gastos mensais
- Múltiplas listas de compras
- Marcação de itens comprados

#### 🎨 **Galeria de Progresso**
- Upload de fotos para atividades artísticas
- Registro de tempo gasto por sessão
- Timeline visual do progresso
- Descrições e anotações

#### 📌 **Lembretes Importantes**
- Tarefas como "Tirar carta", "Dentista"
- Categorias (saúde, documentos, pessoal, trabalho)
- Prioridades (1-5)
- Alertas X dias antes do vencimento

#### 👤 **Perfil Completo**
- Nome, idade (calculada automaticamente)
- Peso, altura, gordura corporal, massa muscular
- Tracking de evolução corporal
- Cálculo automático de IMC e categoria
- Foto de perfil

#### 📊 **Dashboard Inteligente**
- Visão geral do dia
- Score de produtividade (0-100)
- Resumo semanal e mensal
- Estatísticas consolidadas
- Notificações centralizadas

## 🎯 Como Funciona

### Sistema de Atividades Tipadas

Cada tipo de atividade tem um modo de progresso específico:

- **Leitura**: % baseado em páginas (ex: "45% - página 180/400")
- **Limpeza**: Boolean (concluído/não concluído)
- **Cuidados Pessoais**: Boolean
- **Pintura**: Tempo + galeria de fotos
- **Treino Físico**: Boolean ou duração
- **Outras**: Customizável

### Rotinas Inteligentes

- Separação por período (manhã, tarde, noite)
- Blocos de tempo preenchidos manualmente OU
- **Auto-fill**: Preenche blocos vazios com atividades baseadas no tempo necessário
- Visualização timeline do dia

### Sistema de Compras Automático

1. **Cadastre itens** com dias para reposição
2. **Registre compras** conforme faz
3. **Gere lista automática**: Sistema calcula o que precisa repor
4. **Previsão de custo**: Baseado em preços médios
5. **Marque itens** conforme compra

## 📥 Instalação v2.0

### Para Usuários da v1.x

```bash
# 1. Extraia v2.0 sobre a pasta do projeto
unzip EDI_v2.0.zip

# 2. Execute migração
python migrate_v2.py

# 3. Inicie normalmente
python main.py
```

### Novos Usuários

```bash
# 1. Instale dependências
pip install -r requirements.txt

# 2. Execute
python main.py
```

## 🆕 Novos Engines

- `UserProfileEngine` - Gerenciamento de perfil e métricas
- `BookEngine` - Sistema de leitura
- `ShoppingEngine` - Compras e listas
- `ReminderEngine` - Lembretes importantes
- `ProgressPhotoEngine` - Galeria de progresso
- `DashboardEngine` - Visão consolidada

## 📊 Exemplos de Uso v2.0

### Registrar Leitura

```python
from core.book_engine import BookEngine

# Adicionar livro
BookEngine.add_book(
    title="Sapiens",
    author="Yuval Harari",
    total_pages=512,
    genre="História"
)

# Registrar sessão de leitura
BookEngine.add_reading_session(
    book_id=1,
    pages_read=25,
    duration=45  # minutos
)

# Ver progresso
progress = BookEngine.get_progress_percentage(book_id=1)
# Retorna: 4.9% (25/512 páginas)
```

### Gerar Lista de Compras Automática

```python
from core.shopping_engine import ShoppingEngine

# Cadastrar itens (uma vez)
ShoppingEngine.add_item(
    name="Arroz",
    category="alimentos",
    average_price=25.00,
    restock_days=30,  # precisa comprar a cada 30 dias
    quantity_per_purchase=2,  # compra 2 pacotes por vez
    unit="pacote"
)

# Gerar lista automática
list_id = ShoppingEngine.generate_automatic_list()
# Sistema analisa última compra e gera lista com o que precisa repor!
```

### Dashboard

```python
from core.dashboard_engine import DashboardEngine

# Ver resumo do dia
overview = DashboardEngine.get_today_overview()
# Retorna: atividades, leitura, metas, lembretes, etc

# Score de produtividade
score = DashboardEngine.get_productivity_score()
# Retorna: 0-100 baseado em múltiplos fatores
```

## 🎨 Melhorias de UX Planejadas

- Tela de Dashboard moderna
- Cards coloridos por categoria
- Gráficos de progresso
- Timeline visual de atividades
- Galeria de fotos em grid
- Filtros e busca avançada

## 📝 Roadmap v2.1

- [ ] Integração com calendário
- [ ] Exportar relatórios em PDF
- [ ] Gráficos interativos
- [ ] Backup em nuvem
- [ ] Sincronização multi-dispositivo
- [ ] App mobile companion

## 🔄 Changelog v2.0

Ver arquivo `CHANGELOG_v2.md` para lista completa de mudanças.

---

**Versão**: 2.0.0  
**Data**: Fevereiro 2026  
**Status**: ✅ Estável
