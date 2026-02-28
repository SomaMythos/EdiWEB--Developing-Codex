# 🤖 EDI - Life Manager Web

Aplicação web para gestão de rotina, metas e hobbies, com **backend FastAPI** e **frontend React + Vite**.

---

## 📌 Visão Geral

O projeto está organizado em duas camadas principais:

- **`backend/`**: API REST, regras de negócio (`core/*_engine.py`) e persistência SQLite.
- **`frontend/`**: Interface SPA com páginas por domínio (Daily, Goals, Dashboard, Financeiro, Hobbies etc.).

Também existe a pasta **`old_EDI/`** com a versão legada (Kivy), usada como referência histórica/migração.

---

## ✅ Domínios Funcionais Atuais

- **Planejamento diário**: rotina por tipo de dia, geração automática de agenda, marcação de blocos e consistência semanal.
- **Metas (Goals)**: CRUD completo, categorias, vínculo com atividades, cálculo de progresso e status.
- **Atividades e log diário**: cadastro, frequências fixas/flexíveis, validação de conflitos de horário e registro diário.
- **Financeiro**: configuração de renda, despesas fixas, resumo e projeções.
- **Hobbies**:
  - Leitura (books + sessões + estatísticas)
  - Artes visuais (obras, updates com mídia, galeria e pastas de referência)
  - Música (treinos por BPM, artistas e álbuns)
  - Games
  - Assistir (watchlist por categoria)
- **Shopping**: wishlist, itens comprados e estatísticas.
- **Notificações**: central única para lembretes custom, alertas de metas e resumo diário, com preferências de inbox.
- **Perfil e métricas**: dados de perfil e histórico de métricas corporais.
- **Analytics / dashboard**: visão diária, semanal e top atividades.
- **Exportação**: JSON/CSV/relatórios de atividades e metas.

> Para detalhes completos de payloads e respostas, use a documentação Swagger: `http://localhost:8000/docs`.

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
- React Router
- Axios
- Lucide React
- CSS modular + temas

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

Fallbacks:
- desenvolvimento: `http://localhost:8000/api`
- produção: `/api`

---

## ▶️ Executando

### Opção A — scripts do repositório

**Linux/macOS**
```bash
./start_edi.sh
```

**Windows**
```bat
start_edi.bat
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
- Frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

---

## 🗂️ Estrutura (resumo)

```text
.
├── backend/
│   ├── core/
│   ├── data/
│   ├── tests/
│   └── main.py
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── docs/
├── old_EDI/
├── QUICKSTART.md
├── FEATURE_INVENTORY.md
└── TROUBLESHOOTING.md
```

---

## 🧪 Testes (backend)

```bash
cd backend
pytest -q
```

Arquivos de teste atuais estão em `backend/tests/`.

---

## 📚 Documentação Complementar

- `QUICKSTART.md`: setup rápido e fluxo de primeiros passos.
- `FEATURE_INVENTORY.md`: mapeamento de domínios (legacy ➜ web).
- `MIGRATION.md`: notas de migração e compatibilidade.
- `TROUBLESHOOTING.md`: problemas comuns e soluções.
- `frontend/docs/color-token-mapping.md`: guia de tokens de cor/temas.

---

## 📝 Status

Versão em evolução contínua com foco em:
- robustez do fluxo Daily;
- estabilidade das regras de negócio no backend;
- melhoria de UX nas páginas de hobby e metas.

