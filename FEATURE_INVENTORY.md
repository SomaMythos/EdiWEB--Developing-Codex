# Feature Inventory Matrix (Legacy ➜ Web)

| Domain | Legacy source (`old_EDI`) | Backend engine module | FastAPI endpoints (`backend/main.py`) | Frontend route/page |
|---|---|---|---|---|
| Profile / Dashboard | `core/user_profile_engine.py`, `core/dashboard_engine.py` | `backend/core/user_profile_engine.py`, `backend/core/dashboard_engine.py` | `/api/profile`, `/api/profile/metrics`, `/api/dashboard/overview`, `/api/dashboard/weekly` | `/dashboard` → `frontend/src/pages/Dashboard.jsx` |
| Books | `core/book_engine.py` | `backend/core/book_engine.py` | `/api/books`, `/api/books/{book_id}/sessions`, `/api/books/stats` | `/books` → `frontend/src/pages/Books.jsx` |
| Paintings / Progress photos | `core/painting_engine.py`, `core/progress_photo_engine.py` | `backend/core/painting_engine.py`, `backend/core/progress_photo_engine.py` | `/api/paintings`, `/api/paintings/{painting_id}/progress`, `/api/paintings/{painting_id}/complete`, `/api/progress-photos` | `/paintings` → `frontend/src/pages/Paintings.jsx` |
| Shopping | `core/shopping_engine.py` | `backend/core/shopping_engine.py` | `/api/shopping/wishlist`, `/api/shopping/items`, `/api/shopping/stats` | `/shopping` → `frontend/src/pages/Shopping.jsx` |
| Reminders / Day Plan | `core/reminder_engine.py`, `core/day_plan_engine.py` | `backend/core/reminder_engine.py`, `backend/core/day_plan_engine.py` | `/api/reminders`, `/api/reminders/upcoming`, `/api/day-plan` | `/reminders` → `frontend/src/pages/Reminders.jsx` |

