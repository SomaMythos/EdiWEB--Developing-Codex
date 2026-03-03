# 🤖 EDI - Life Manager Web

Aplicação web para gestão de rotina, metas e hobbies, com **backend FastAPI**, **frontend React + Vite** e empacotamento desktop via **Electron**.

---

## 📌 Visão Geral

O projeto está organizado em três partes principais:

- **`backend/`**: API REST, regras de negócio (`core/*_engine.py`) e persistência SQLite.
- **`frontend/`**: SPA React com páginas por domínio (Daily, Goals, Dashboard, Financeiro, Hobbies etc.).
- **raiz (Electron)**: `main.js` + `package.json` para build de distribuição desktop.

Os artefatos legados foram removidos para manter a base ativa mais enxuta e focada na versão web.

---

## ✅ Domínios Funcionais Atuais

- **Planejamento diário**: rotina por tipo de dia, geração automática de agenda, marcação de blocos e consistência semanal.
- **Metas (Goals)**: CRUD completo, categorias, vínculo com atividades, cálculo de progresso e status.
- **Atividades e log diário**: cadastro, frequências fixas/flexíveis, validação de conflitos de horário e registro diário.
- **Financeiro**: configuração de renda, despesas fixas, transações, resumo e projeções.
- **Hobbies**:
  - Leitura (books + sessões + estatísticas)
  - Artes visuais (obras, updates com mídia, galeria e pastas de referência)
  - Música (treinos por BPM, artistas e álbuns)
  - Games
  - Assistir (watchlist por categoria)
- **Shopping e consumíveis**: wishlist, itens comprados, categorias de consumíveis, restock/finish e alertas.
- **Notificações**: central única para lembretes custom, alertas de metas/consumíveis e preferências de inbox.
- **Perfil e métricas**: dados de perfil e histórico de métricas corporais.
- **Analytics / dashboard / reports**: visão diária, semanal e relatórios por domínio.
- **Exportação**: JSON/CSV/relatórios de atividades e metas.

> Para detalhes completos de payloads e respostas, use Swagger em `http://localhost:8000/docs`.

---

## 🧰 Stack

### Backend
- FastAPI
- Uvicorn
- Pydantic
- SQLite

### Frontend
- React 18
- Vite
- React Router (HashRouter)
- Axios
- Lucide React
- Recharts

### Desktop
- Electron
- electron-builder

---

## 📦 Instalação

### Pré-requisitos
- Python 3.10+
- Node.js 18+
- npm

### 1) Backend

```bash
cd backend
pip install -r requirements.txt
```

### 2) Frontend

```bash
cd frontend
npm install
```

### 3) Variáveis de ambiente (frontend)

Crie `frontend/.env` e configure:

```env
VITE_API_URL=http://localhost:8000/api
```

Fallbacks usados pelo frontend:
- desenvolvimento: `http://localhost:8000/api`
- produção: `/api`

---

## ▶️ Executando

### Opção A — scripts do repositório

**Linux/macOS**
```bash
./scripts/start_edi.sh
```

**Windows**
```bat
scripts\\start_edi.bat
```

### Opção B — manual

**Terminal 1 (backend)**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 (frontend)**
```bash
cd frontend
npm run dev
```

Acessos:
- Frontend (dev): `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

---

## 🧪 Testes

### Backend
```bash
cd backend
pytest -q
```

### Frontend (teste unitário atual)
```bash
cd frontend
npm test
```

---

## 📚 Documentação Complementar

- `docs/QUICKSTART.md`: setup rápido e fluxos iniciais de validação.
- `docs/FEATURE_INVENTORY.md`: matriz de domínios (legado ➜ web) e mapeamento de rotas/telas.
- `docs/CODEBASE_ANALYSIS.md`: análise técnica da base atual (arquitetura, módulos e riscos).
- `docs/MIGRATION.md`: notas de migração e compatibilidade da versão Kivy.
- `docs/TROUBLESHOOTING.md`: problemas comuns e soluções.
- `frontend/docs/color-token-mapping.md`: guia de tokens de cor/temas.

---

## 📝 Status

Versão em evolução contínua com foco em:
- robustez do fluxo Daily;
- estabilidade das regras de negócio no backend;
- melhoria de UX em metas, notificações e hobbies;
- expansão de cobertura de testes para rotas/domínios recentes.
