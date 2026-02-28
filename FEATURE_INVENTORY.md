# Feature Inventory Matrix (Legacy ➜ Web)

| Domínio | Referência legada (`old_EDI/EDI`) | Backend atual | Endpoints FastAPI (exemplos) | Frontend atual |
|---|---|---|---|---|
| Daily (rotina do dia) | `core/day_plan_engine.py`, `core/routine_engine.py` | `backend/core/day_engine.py`, `backend/core/daily_*_engine.py` | `/api/daily/routines`, `/api/daily/generate`, `/api/daily/summary`, `/api/daily/consistency` | `/` → `frontend/src/pages/Daily.jsx` |
| Atividades + log | `core/activity_engine.py`, `core/daily_log_engine.py` | `backend/core/activity_engine.py`, `backend/core/daily_log_engine.py` | `/api/activities`, `/api/activities/{id}/toggle`, `/api/daily-log/register` | Fluxo integrado na página Daily |
| Metas (Goals) | `core/goal_engine.py` | `backend/core/goal_engine.py` | `/api/goals`, `/api/goals/{id}/status`, `/api/goals/categories`, `/api/goals/home` | `/goals` → `frontend/src/pages/Goals.jsx` |
| Dashboard / Analytics | `core/dashboard_engine.py`, `core/analytics_engine.py` | `backend/core/dashboard_engine.py`, `backend/core/analytics_engine.py` | `/api/dashboard/overview`, `/api/dashboard/weekly`, `/api/analytics/today` | `/dashboard` → `frontend/src/pages/Dashboard.jsx` |
| Financeiro | *(novo no web)* | `backend/core/finance_engine.py` | `/api/finance/config`, `/api/finance/fixed-expenses`, `/api/finance/summary`, `/api/finance/projection` | `/financeiro` → `frontend/src/pages/Financeiro.jsx` |
| Leitura | `core/book_engine.py` | `backend/core/book_engine.py` | `/api/books`, `/api/books/{book_id}/sessions`, `/api/books/stats` | `/hobby/leitura` → `frontend/src/pages/Books.jsx` |
| Artes visuais | `core/painting_engine.py`, `core/progress_photo_engine.py` | `backend/core/painting_engine.py`, `backend/core/progress_photo_engine.py` | `/api/visual-arts/artworks`, `/api/visual-arts/artworks/{id}/updates`, `/api/visual-arts/media-folders` | `/hobby/artes-visuais` → `frontend/src/pages/HobbyVisualArts.jsx` |
| Música | *(evolução no web)* | `backend/core/music_engine.py` | `/api/music/training`, `/api/music/training/{id}/session`, `/api/music/albums` | `/hobby/musica` → `frontend/src/pages/music/Music.jsx` |
| Games | *(novo no web)* | (usa persistência geral no backend) | (sem namespace dedicado no `main.py`) | `/hobby/games` → `frontend/src/pages/Games.jsx` |
| Assistir (watchlist) | *(novo no web)* | `backend/core/watch_engine.py` | `/api/watch/categories`, `/api/watch/items`, `/api/watch/items/{item_id}/watched` | `/hobby/assistir` → `frontend/src/pages/Watch.jsx` |
| Shopping | `core/shopping_engine.py` | `backend/core/shopping_engine.py` | `/api/shopping/wishlist`, `/api/shopping/items`, `/api/shopping/stats` | `/shopping` → `frontend/src/pages/Shopping.jsx` |
| Notificações (domínio único) | `core/notification_center_engine.py` (com adapter legado em `core/reminder_engine.py`) | `backend/core/notification_center_engine.py` | `/api/notifications`, `/api/notifications/custom`, `/api/notifications/{id}/status`, `/api/notifications/preferences` (legado: `/api/reminders/...`) | `/notifications` → `frontend/src/pages/Notifications.jsx` (legado: `/reminders` redireciona) |
| Perfil e métricas | `core/user_profile_engine.py` | `backend/core/user_profile_engine.py` | `/api/profile`, `/api/profile/metrics`, `/api/user/profile`, `/api/user/metrics` | `/settings` + cards no dashboard |

## Observações

- O backend mantém compatibilidade com partes do legado, mas com expansão de domínios no web (financeiro, watch, música avançada).
- Para a lista completa de rotas e schemas, consulte `backend/main.py` e `http://localhost:8000/docs`.
