# Análise Técnica do Código (EDI Web)

Documento de leitura rápida para manutenção: panorama da arquitetura, inventário de módulos e pontos de atenção com base no estado atual do repositório.

## 1) Arquitetura geral

- **Backend**: FastAPI em `backend/main.py`, com regras de negócio em engines (`backend/core/*_engine.py`) e persistência SQLite (`backend/data/`).
- **Frontend**: React + Vite (`frontend/src`), com rotas em `App.jsx`, páginas por domínio e componentes especializados.
- **Desktop**: Electron na raiz (`main.js` + `package.json`), consumindo build do frontend e backend empacotado.
- **Legado**: versão Kivy removida deste repositório para manter apenas a base web ativa.

## 2) Inventário atual (quantitativo)

### Backend

- **28 arquivos** em `backend/core/`.
- **153 rotas HTTP** em `backend/main.py`:
  - 76 `GET`
  - 43 `POST`
  - 10 `PUT`
  - 10 `PATCH`
  - 14 `DELETE`
- **13 arquivos de teste** em `backend/tests/`.
- Migrações SQL aditivas em `backend/data/migrations/`.

### Frontend

- **17 rotas** em `frontend/src/App.jsx`.
- **16 páginas** no diretório `frontend/src/pages/` (+ submódulo `pages/music/`).
- **hooks dedicados ao domínio Daily** em `frontend/src/hooks/daily/`.
- Camada de serviço HTTP centralizada em `frontend/src/services/api.js`.

## 3) Mapa funcional por blocos

### Núcleo de produtividade

- Daily, Rotinas, Day Plan, Daily Config, Daily Discipline.
- Atividades + log diário.
- Metas com categorias, vínculo com atividades e status.

### Núcleo de acompanhamento

- Dashboard + Analytics + Reports.
- Perfil do usuário e métricas.
- Exportação de dados (JSON/CSV e relatórios).

### Núcleo de lifestyle/hobbies

- Livros/leitura.
- Artes visuais (artworks, gallery, folders, media items, progress photos).
- Música (treinos, sessões, artistas, álbuns).
- Watchlist.
- Games (front-only hoje).

### Núcleo operacional

- Financeiro (configuração, despesas fixas, transações, projeção).
- Shopping e consumíveis (com sinalização de risco no backend/tests).
- Notificações unificadas + compatibilidade com reminders legados.

## 4) Cobertura de testes observada

Testes backend presentes para:

- engine e rotas de consumíveis;
- relatórios/analytics;
- regras de daily discipline/day engine;
- preferências e custom notifications;
- rotas de goals (status, vínculo e multipart update);
- rotas de artes visuais.

> Nota: há oportunidade de ampliar cobertura para domínios com alta superfície de API (finance, music, watch, shopping, user profile e export).

## 5) Riscos técnicos e oportunidades

### Pontos fortes

- Separação clara entre API, engines de negócio e frontend.
- Boa cobertura de domínios funcionais já migrados do legado.
- Estrutura preparada para evolução incremental (migrations + testes por domínio).

### Riscos / dívida técnica

- `backend/main.py` concentra muitos endpoints e validações (arquivo muito extenso).
- Domínios parcialmente front-only ou com namespace implícito (ex.: notes/games) podem gerar lacunas de contrato explícito.
- Parte da documentação histórica estava desatualizada em relação às features atuais.

### Recomendações práticas

1. Modularizar `backend/main.py` por routers (`APIRouter`) por domínio.
2. Expandir testes automatizados para finance/music/watch/shopping.
3. Criar contratos OpenAPI por tag e documentação por domínio em `docs/`.
4. Definir roadmap para manter/remover compatibilidade de endpoints legados (`/api/reminders`).

## 6) Como validar rapidamente o estado do projeto

```bash
# Backend
cd backend
pytest -q

# Frontend
cd frontend
npm test
```

## 7) Referências úteis no repositório

- `README.md` — visão geral e execução.
- `docs/FEATURE_INVENTORY.md` — matriz de features (legacy ➜ web).
- `docs/MIGRATION.md` — estratégia de migração.
- `docs/TROUBLESHOOTING.md` — diagnóstico operacional.
