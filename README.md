# 🤖 EDI - Life Manager Web

**Personal Assistant & Routine Scheduler - Web Version**

Versão web moderna do EDI Life Manager, desenvolvida com FastAPI (backend) e React (frontend). Esta versão oferece uma interface web responsiva e moderna, mantendo todas as funcionalidades do aplicativo original.

---

## ✨ Novidades da Versão Web

- 🌐 **Interface Web Moderna**: Design limpo e responsivo com React
- ⚡ **API REST**: Backend FastAPI com documentação automática
- 🎨 **UI/UX Aprimorada**: Interface intuitiva e agradável
- 📱 **Responsivo**: Funciona em desktop, tablet e mobile
- 🔄 **Real-time Updates**: Atualizações instantâneas da interface

---

## 🚀 Funcionalidades

### ✅ Totalmente Implementadas
- **Gerenciamento de Atividades**: Crie, edite e organize suas atividades
- **Tipos de Atividade Customizáveis**: Categorize atividades com tipos personalizados
- **Log Diário**: Registre e visualize suas atividades do dia
- **Sistema de Rotinas Completo**: Crie rotinas com blocos de tempo personalizados
- **Metas (Goals)**: Defina objetivos, vincule atividades e acompanhe progresso
- **Analytics Avançado**: Visualize estatísticas, tendências e atividades mais frequentes
- **Notificações Inteligentes**: Alertas para metas paradas, deadlines próximos e resumo diário
- **Perfil de Usuário**: Gerencie suas informações pessoais (nome, idade, altura)
- **Métricas Corporais**: Acompanhe peso, calcule IMC e veja tendências
- **Exportação Completa**: Exporte dados em JSON, CSV ou relatórios personalizados
- **Dashboard Interativo**: Visualize estatísticas em tempo real
- **API REST Completa**: Endpoints documentados para todas as funcionalidades
- **Histórico de Atividades**: Veja seu histórico completo de atividades realizadas

### 🚧 Em Desenvolvimento
- Gráficos interativos com Chart.js/Recharts
- PWA (Progressive Web App)
- Temas customizáveis (dark mode)
- Sincronização em nuvem
- Autenticação multi-usuário

---

## 📦 Instalação

### Pré-requisitos
- Python 3.8 ou superior
- Node.js 16 ou superior
- npm ou yarn

### Instalação do Backend

```bash
cd backend
pip install -r requirements.txt
```

### Instalação do Frontend

```bash
cd frontend
npm install
```

---

## 🏃‍♂️ Executando o Projeto

### Opção 1: Executar Backend e Frontend Separadamente

**Terminal 1 - Backend:**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Acesse: http://localhost:3000

### Opção 2: Script de Inicialização

**Windows:**
```bash
start_edi.bat
```

**Linux/Mac:**
```bash
chmod +x start_edi.sh
./start_edi.sh
```

---

## 📁 Estrutura do Projeto

```
edi-web/
├── backend/                    # API FastAPI
│   ├── core/                   # Lógica de negócio (engines)
│   │   ├── activity_engine.py
│   │   ├── activity_type_engine.py
│   │   ├── daily_log_engine.py
│   │   ├── goal_engine.py
│   │   ├── routine_engine.py
│   │   ├── analytics_engine.py
│   │   ├── notification_engine.py
│   │   └── export_engine.py
│   │
│   ├── data/                   # Camada de dados
│   │   ├── database.py
│   │   ├── schema.sql
│   │   └── lifemanager.db
│   │
│   ├── main.py                 # FastAPI app
│   └── requirements.txt
│
├── frontend/                   # React app
│   ├── src/
│   │   ├── components/         # Componentes React
│   │   │   └── Layout.jsx
│   │   │
│   │   ├── pages/              # Páginas
│   │   │   ├── Home.jsx
│   │   │   ├── Activities.jsx
│   │   │   ├── Goals.jsx
│   │   │   └── ...
│   │   │
│   │   ├── services/           # Serviços/API
│   │   │   └── api.js
│   │   │
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   │
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

---

## 🔌 API Endpoints

### Documentação Interativa
Acesse: http://localhost:8000/docs (Swagger UI)

### Principais Endpoints

**Activity Types:**
- `GET /api/activity-types` - Listar tipos
- `POST /api/activity-types` - Criar tipo

**Activities:**
- `GET /api/activities` - Listar atividades
- `POST /api/activities` - Criar atividade
- `PATCH /api/activities/{id}/toggle` - Ativar/desativar
- `GET /api/activities/{id}/progress` - Ver progresso

**Daily Log:**
- `GET /api/daily-log` - Log de hoje
- `POST /api/daily-log/register` - Registrar atividade
- `GET /api/daily-log/{date}` - Log de data específica

**Goals:**
- `GET /api/goals` - Listar metas
- `POST /api/goals` - Criar meta
- `POST /api/goals/link-activity` - Vincular atividade
- `DELETE /api/goals/{id}/activities/{activity_id}` - Desvincular atividade
- `GET /api/goals/{id}/progress` - Ver progresso
- `PATCH /api/goals/{id}/status` - Atualizar status

**Routines:**
- `GET /api/routines` - Listar rotinas
- `POST /api/routines` - Criar rotina
- `GET /api/routines/{id}/blocks` - Ver blocos
- `POST /api/routines/blocks` - Adicionar bloco

**Analytics:**
- `GET /api/analytics/today` - Resumo de hoje
- `GET /api/analytics/last-days/{days}` - Últimos N dias
- `GET /api/analytics/top-activities` - Atividades mais frequentes
- `GET /api/analytics/goals-overview` - Visão geral de metas

**Notifications:**
- `GET /api/notifications` - Todas as notificações
- `GET /api/notifications/stalled-goals` - Metas paradas
- `GET /api/notifications/upcoming-deadlines` - Deadlines próximos
- `GET /api/notifications/daily-summary` - Resumo diário

**Export:**
- `GET /api/export/json` - Exportar tudo em JSON
- `GET /api/export/csv` - Exportar tudo em CSV
- `GET /api/export/activities-report` - Relatório de atividades
- `GET /api/export/goals-progress` - Progresso de metas

**User Profile:**
- `GET /api/user/profile` - Ver perfil
- `POST /api/user/profile` - Criar/atualizar perfil
- `GET /api/user/metrics` - Histórico de métricas
- `POST /api/user/metrics` - Adicionar métrica (peso)

**Activity History:**
- `GET /api/activity-history` - Histórico completo de atividades

---

## 🎨 Tecnologias Utilizadas

### Backend
- **FastAPI**: Framework web moderno e rápido
- **Uvicorn**: Servidor ASGI
- **Pydantic**: Validação de dados
- **SQLite**: Banco de dados

### Frontend
- **React 18**: Biblioteca UI
- **Vite**: Build tool
- **React Router**: Roteamento
- **Axios**: Cliente HTTP
- **Lucide React**: Ícones
- **CSS Custom Properties**: Estilização

---

## 🗄️ Banco de Dados

O projeto mantém o mesmo schema SQLite do original:

- **user_profile**: Perfil do usuário
- **user_metrics**: Métricas corporais
- **activity_types**: Tipos de atividade
- **activities**: Atividades cadastradas
- **daily_logs**: Logs diários
- **daily_activity_logs**: Registro de atividades realizadas
- **routines**: Rotinas definidas
- **routine_blocks**: Blocos de tempo das rotinas
- **goals**: Metas definidas
- **goal_activities**: Vínculo entre metas e atividades

---

## 🔧 Desenvolvimento

### Backend

```bash
# Instalar dependências
cd backend
pip install -r requirements.txt

# Executar com reload automático
uvicorn main:app --reload --port 8000

# Acessar documentação
# http://localhost:8000/docs
```

### Frontend

```bash
# Instalar dependências
cd frontend
npm install

# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Preview do build
npm run preview
```

---

## 🚀 Deploy

### Backend (Uvicorn/Gunicorn)

```bash
# Produção com Uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# Com Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### Frontend

```bash
# Build
npm run build

# A pasta dist/ pode ser servida por qualquer servidor estático
# Nginx, Apache, Vercel, Netlify, etc.
```

---

## 📝 Próximos Passos

- [ ] Implementar página de Rotinas completa
- [ ] Adicionar gráficos e visualizações
- [ ] Sistema de notificações
- [ ] Exportação de dados
- [ ] Temas customizáveis (dark mode)
- [ ] PWA (Progressive Web App)
- [ ] Autenticação de usuários
- [ ] Deploy em cloud

---

## 🤝 Migração do Kivy

Esta versão web mantém 100% da lógica de negócio do projeto original Kivy:
- Todos os engines foram preservados
- Mesmo banco de dados SQLite
- Mesmas funcionalidades core
- Compatibilidade total com dados existentes

---

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para usar e modificar conforme necessário.

---

## 👤 Autor

**EDI - Life Manager Web**  
Portado de KivyMD para FastAPI + React

**Versão**: 2.0.0  
**Última Atualização**: Fevereiro 2026
