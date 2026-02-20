# 🤖 EDI - Life Manager

**Personal Assistant & Routine Scheduler**

EDI é um aplicativo de gerenciamento pessoal desenvolvido em Python com KivyMD, projetado para ajudar você a organizar atividades, criar rotinas, definir metas e acompanhar seu progresso diário.

---

## 🚀 Funcionalidades

### ✅ Implementadas
- **Gerenciamento de Atividades**: Crie, edite e organize suas atividades
- **Tipos de Atividade Customizáveis**: Categorize atividades com tipos personalizados
- **Log Diário**: Registre e visualize suas atividades do dia
- **Sistema de Rotinas**: Crie rotinas com blocos de tempo
- **Metas (Goals)**: Defina objetivos e vincule atividades a eles
- **Análise de Progresso**: Acompanhe o progresso de atividades e metas
- **Notificações**: Alertas para metas paradas

### 🚧 Em Desenvolvimento
- Sistema de notificações push
- Exportação de dados (CSV, JSON)
- Analytics avançado
- Integração com calendário
- Sincronização em nuvem

---

## 📦 Instalação

### Pré-requisitos
- Python 3.8 ou superior
- pip (gerenciador de pacotes Python)

### Passos

1. **Clone ou extraia o projeto:**
```bash
cd EDI
```

2. **Instale as dependências:**
```bash
pip install -r requirements.txt
```

3. **Execute o aplicativo:**
```bash
python main.py
```

**Windows:** Você também pode usar o arquivo `EDI.bat` para iniciar rapidamente.

---

## 🗂️ Estrutura do Projeto

```
EDI/
├── core/                   # Lógica de negócio
│   ├── activity_engine.py      # CRUD de atividades
│   ├── activity_type_engine.py # Gerenciamento de tipos
│   ├── daily_log_engine.py     # Log diário
│   ├── routine_engine.py       # Gerenciamento de rotinas
│   ├── goal_engine.py          # Sistema de metas
│   ├── analytics_engine.py     # Análises e estatísticas
│   ├── notification_engine.py  # Sistema de notificações
│   └── export_engine.py        # Exportação de dados
│
├── data/                   # Camada de dados
│   ├── database.py             # Classe Database com Context Manager
│   ├── schema.sql              # Schema do banco de dados
│   └── lifemanager.db          # Banco SQLite (criado automaticamente)
│
├── ui/                     # Interface do usuário
│   ├── components/             # Componentes reutilizáveis
│   │   ├── bottom_bar.py
│   │   ├── bottom_nav.py
│   │   └── header.py
│   │
│   └── screens/                # Telas do aplicativo
│       ├── home.py             # Tela inicial
│       ├── activities.py       # Gerenciamento de atividades
│       ├── activity_types.py   # Tipos de atividade
│       ├── routine.py          # Lista de rotinas
│       ├── routine_detail.py   # Detalhes da rotina
│       ├── add_routine_block.py
│       ├── goals.py            # Metas
│       ├── stats.py            # Estatísticas
│       └── settings.py         # Configurações
│
├── assets/                 # Recursos (imagens, ícones, etc)
├── main.py                 # Ponto de entrada do aplicativo
├── requirements.txt        # Dependências Python
└── README.md              # Este arquivo
```

---

## 🗄️ Banco de Dados

EDI usa SQLite para armazenamento local. O schema inclui:

- **user_profile**: Perfil do usuário
- **user_metrics**: Métricas corporais (peso, etc)
- **activity_types**: Tipos de atividade customizáveis
- **activities**: Atividades cadastradas
- **daily_logs**: Logs diários
- **daily_activity_logs**: Registro de atividades realizadas
- **routines**: Rotinas definidas
- **routine_blocks**: Blocos de tempo das rotinas
- **goals**: Metas definidas
- **goal_activities**: Vínculo entre metas e atividades

---

## 💡 Como Usar

### 1. Criar Tipos de Atividade
Antes de criar atividades, defina os tipos (exemplo: "Exercício", "Estudo", "Trabalho").

### 2. Adicionar Atividades
Crie atividades e associe-as a tipos. Defina tempo estimado e modo de progresso.

### 3. Registrar Atividades Diárias
Use a tela Home para registrar as atividades realizadas no dia.

### 4. Criar Rotinas
Monte rotinas com blocos de tempo para organizar seu dia.

### 5. Definir Metas
Crie metas e vincule atividades relevantes para acompanhar progresso.

---

## 🛠️ Desenvolvimento

### Engines Principais

#### ActivityEngine
```python
from core.activity_engine import ActivityEngine

# Listar atividades
activities = ActivityEngine.list_activities()

# Criar atividade
ActivityEngine.create_activity(
    title="Correr",
    type_id=1,
    estimated_time=30
)

# Calcular progresso
progress = ActivityEngine.get_progress(activity_id=1)
```

#### DailyLogEngine
```python
from core.daily_log_engine import DailyLogEngine

# Registrar atividade
DailyLogEngine.register_activity(
    activity_id=1,
    duration=30,
    completed=1
)

# Listar atividades do dia
entries = DailyLogEngine.list_day()
```

#### GoalEngine
```python
from core.goal_engine import GoalEngine

# Criar meta
GoalEngine.create_goal(
    title="Correr 100km este mês",
    deadline="2026-02-28"
)

# Vincular atividade
GoalEngine.link_activity(goal_id=1, activity_id=1)

# Verificar progresso
progress = GoalEngine.calculate_progress(goal_id=1)
```

### Context Manager no Database

Use o context manager para operações seguras:

```python
from data.database import Database

# Método recomendado
with Database() as db:
    rows = db.fetchall("SELECT * FROM activities")
    # Commit automático ao sair do bloco

# Método tradicional (ainda suportado)
db = Database()
rows = db.fetchall("SELECT * FROM activities")
db.commit()
db.close()
```

---

## 🐛 Correções Recentes

### v1.1.0 (Última atualização)
- ✅ Corrigido bug crítico em `DailyLogEngine.list_day()` - Adicionados campos `role`, `start`, `end`
- ✅ Adicionado método `ActivityEngine.get_progress()`
- ✅ Implementado Context Manager na classe `Database`
- ✅ Adicionado logging para debugging
- ✅ Corrigido `GoalEngine.create_goal()` - Adicionado commit
- ✅ Criadas tabelas `goals` e `goal_activities` no schema
- ✅ Adicionados métodos `link_activity()` e `unlink_activity()` ao GoalEngine
- ✅ Timestamp automático ao registrar atividades

---

## 📝 TODO / Roadmap

### Prioridade Alta
- [ ] Implementar sistema de notificações push
- [ ] Completar ExportEngine (CSV, JSON, PDF)
- [ ] Adicionar edição de atividades existentes
- [ ] Implementar busca/filtro de atividades

### Prioridade Média
- [ ] Gráficos e visualizações no Analytics
- [ ] Temas customizáveis
- [ ] Backup automático
- [ ] Importação de dados

### Prioridade Baixa
- [ ] Modo dark/light
- [ ] Sincronização multi-dispositivo
- [ ] Widgets para desktop
- [ ] API REST para integrações

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:
- Reportar bugs
- Sugerir funcionalidades
- Submeter pull requests

---

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para usar e modificar conforme necessário.

---

## 👤 Autor

**EDI - Life Manager**
Desenvolvido como um assistente pessoal para gerenciamento de rotinas e produtividade.

---

## 📞 Suporte

Para questões ou suporte, abra uma issue no repositório do projeto.

---

**Versão**: 1.1.0  
**Última Atualização**: Fevereiro 2026
