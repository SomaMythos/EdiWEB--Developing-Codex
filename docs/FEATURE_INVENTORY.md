# Feature Inventory - EDI Web

## Resumo Executivo

Estado atual consolidado do projeto:

- Backend FastAPI com 174 endpoints em `backend/main.py`.
- Frontend React com autenticação e rotas por domínio em `frontend/src/App.jsx`.
- Suporte a execução local visível, execução silenciosa no Windows e publicação externa por Cloudflare.
- Atalho de Área de Trabalho e inicialização automática controláveis a partir da tela de Configurações.

## Matriz por Domínio

| Domínio | Backend atual | Endpoints principais | Frontend atual | Status |
|---|---|---|---|---|
| Autenticação | `core/auth_engine.py` | `/api/auth/status`, `/api/auth/login`, `/api/auth/change-password` | `/Login.jsx` | Implementado |
| Daily | `core/day_engine.py`, `core/daily_*_engine.py`, `core/routine_engine.py` | `/api/daily/*`, `/api/day-config`, `/api/day-plan` | `/` -> `Daily.jsx` | Implementado |
| Atividades e log diário | `core/activity_engine.py`, `core/daily_log_engine.py` | `/api/activities`, `/api/daily-log/*`, `/api/activity-history*` | Fluxo integrado em `Daily.jsx` | Implementado |
| Goals | `core/goal_engine.py` | `/api/goals*`, `/api/goals/categories*`, `/api/goals/home`, `/api/goals/stars/total` | `/goals` -> `Goals.jsx` | Implementado |
| Dashboard / Analytics / Reports | `core/dashboard_engine.py`, `core/analytics_engine.py` | `/api/dashboard/*`, `/api/analytics/*`, `/api/reports/*` | `/dashboard` -> `Dashboard.jsx` | Implementado |
| Financeiro | `core/finance_engine.py` | `/api/finance/config`, `/api/finance/fixed-expenses*`, `/api/finance/transactions*`, `/api/finance/summary`, `/api/finance/projection*` | `/financeiro` -> `Financeiro.jsx` | Implementado |
| Calendário | `core/calendar_engine.py` | `/api/calendar/month`, `/api/calendar/day`, `/api/calendar/events*`, `/api/calendar/logs*` | `/calendario` -> `Calendario.jsx` | Implementado |
| Perfil e métricas | `core/user_profile_engine.py` | `/api/user/profile`, `/api/user/metrics`, `/api/profile*` | `/settings` -> `Settings.jsx` | Implementado |
| Notificações | `core/notification_center_engine.py`, `core/notification_engine.py` | `/api/notifications*`, `/api/notifications/preferences`, `/api/notifications/push/*` | `/notifications` -> `Notifications.jsx` | Implementado |
| Shopping | `core/shopping_engine.py` | `/api/shopping/wishlist*`, `/api/shopping/items*`, `/api/shopping/stats` | `/shopping` -> `Shopping.jsx` | Implementado |
| Consumíveis | `core/consumables_engine.py` | `/api/consumables/categories*`, `/api/consumables/items*` | `/shopping/consumiveis` -> `Consumiveis.jsx` | Implementado |
| Leitura | `core/book_engine.py` | `/api/books*`, `/api/books/stats*`, `/api/books/types*`, `/api/books/log` | `/hobby/leitura` -> `Books.jsx` | Implementado |
| Artes visuais | `core/painting_engine.py`, `core/progress_photo_engine.py` | `/api/visual-arts/artworks*`, `/api/visual-arts/media-*` | `/hobby/artes-visuais` -> `HobbyVisualArts.jsx` | Implementado |
| Música | `core/music_engine.py` | `/api/music/training*`, `/api/music/artists*`, `/api/music/albums*` | `/hobby/musica` -> `music/Music.jsx` | Implementado |
| Assistir | `core/watch_engine.py` | `/api/watch/categories*`, `/api/watch/items*` | `/hobby/assistir` -> `Watch.jsx` | Implementado |
| Games | suporte frontend atual | sem namespace dedicado no backend hoje | `/hobby/games` -> `Games.jsx` | Parcial |
| Anotações | suporte frontend atual | sem namespace dedicado no backend hoje | `/anotacoes` -> `Anotacoes.jsx` | Parcial |
| Exportação | `core/export_engine.py` | `/api/export/json`, `/api/export/csv`, `/api/export/activities-report`, `/api/export/goals-progress` | integrada em `Settings.jsx` | Implementado |
| Integração Windows | `core/system_integration_engine.py` | `/api/system/integration`, `/api/system/desktop-shortcut`, `/api/system/windows-startup` | integrada em `Settings.jsx` | Implementado |
| Publicação externa | integração por scripts + Vite proxy | acesso por `/api` mesmo host + Cloudflare Tunnel | navegável pela mesma SPA | Implementado |

## Features de Destaque

### Daily e produtividade

- Geração automática da agenda diária.
- Rotinas separadas por dia útil e dia de folga.
- Resumo do dia, consistência e estatísticas semanais.
- Validação de conflitos entre atividades fixas, sono, trabalho e blocos de rotina.

### Metas

- CRUD completo.
- Categorias e organização visual.
- Upload de imagem por multipart.
- Cálculo de progresso e status.
- Relação entre meta e atividades.

### Notificações

- Preferências por feature.
- Notificações customizadas.
- Mensagens automáticas de metas, consumíveis e resumo diário.
- Som local configurável no frontend.
- Normalização de textos com acentuação para evitar mojibake em registros antigos e novos.

### Execução e operação

- `start_edi.bat`: sobe o ambiente local com janelas visíveis.
- `start_edi_silent.vbs`: sobe silenciosamente e abre o navegador padrão.
- `start_edi_cloudflare.bat`: sobe o app e publica por Cloudflare.
- Configuração de `Run at Windows startup` no app.
- Criação de atalho com `icon.ico` pela UI.

## Observações

- O frontend usa `HashRouter`, o que ajuda no empacotamento Electron e em cenários estáticos.
- O backend já trata URLs públicas de uploads com base no host da requisição, importante para Cloudflare.
- A API continua com alguns endpoints legados convivendo com namespaces mais novos.
- Os domínios `Games` e `Anotações` já têm páginas, mas ainda não têm a mesma profundidade de backend dos demais módulos.
