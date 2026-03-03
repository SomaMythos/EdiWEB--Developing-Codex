##main.py##

"""
EDI Web - Backend API
FastAPI application for EDI Life Manager
"""

import logging
import os
import json
import re
import secrets
from pathlib import Path
from uuid import uuid4
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, conint, field_validator
from typing import Literal, Optional, List
from datetime import datetime

from core.activity_engine import ActivityEngine
from core.daily_log_engine import DailyLogEngine
from core.goal_engine import GoalEngine, GoalActivityValidationError
from core.finance_engine import FinanceEngine
from core.music_engine import MusicEngine
from core.watch_engine import WatchEngine
from core.routine_engine import RoutineEngine
from core.analytics_engine import AnalyticsEngine
from core.daily_override_engine import DailyOverrideEngine
from core.day_engine import generate_day_schedule
from core.daily_config_engine import DailyConfigEngine
from core.time_overlap import add_minutes, intervals_overlap
from core.auth_engine import verify_password, update_password, password_config_exists, password_config_location
from data.database import Database, initialize_database


logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_UPLOADS_BASE_URL = os.getenv("PUBLIC_UPLOADS_BASE_URL", "http://localhost:8000").rstrip("/")


def _get_edi_storage_dir() -> Path:
    custom_storage = os.getenv("EDI_STORAGE_DIR")
    if custom_storage:
        return Path(custom_storage).expanduser().resolve()

    home_dir = Path.home()
    for candidate in (home_dir / "Documents", home_dir / "documents"):
        if candidate.exists():
            return candidate / "EDI"
    return home_dir / "Documents" / "EDI"


EDI_STORAGE_DIR = _get_edi_storage_dir()
UPLOADS_DIR = EDI_STORAGE_DIR / "uploads"
VISUAL_ARTS_UPLOADS_DIR = UPLOADS_DIR / "visual_arts"


def _normalize_relative_path(path_value: Optional[str]) -> Optional[str]:
    if not path_value:
        return None
    return path_value[1:] if path_value.startswith("/") else path_value


def _to_public_upload_url(path_value: Optional[str]) -> Optional[str]:
    normalized = _normalize_relative_path(path_value)
    if not normalized:
        return None
    return f"{PUBLIC_UPLOADS_BASE_URL}/{normalized}"


def _save_upload_file(upload_file: UploadFile, destination_dir: Path) -> str:
    destination_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload_file.filename or "").suffix
    file_name = f"{uuid4().hex}{suffix}"
    destination = destination_dir / file_name

    with destination.open("wb") as output:
        output.write(upload_file.file.read())

    relative_upload_path = destination.relative_to(UPLOADS_DIR)
    return f"uploads/{str(relative_upload_path).replace(chr(92), '/')}"

# Initialize FastAPI app
app = FastAPI(
    title="EDI Life Manager API",
    description="Personal Assistant & Routine Scheduler API",
    version="2.0.0"
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AUTH_BYPASS_PREFIXES = (
    "/",
    "/docs",
    "/openapi.json",
    "/uploads",
    "/api/auth/login",
    "/api/auth/status",
)
ACTIVE_AUTH_TOKENS = set()


@app.middleware("http")
async def authentication_middleware(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    if os.getenv("EDI_AUTH_DISABLED", "0") == "1" or "PYTEST_CURRENT_TEST" in os.environ:
        return await call_next(request)

    request_path = request.url.path
    if any(request_path == prefix or request_path.startswith(f"{prefix}/") for prefix in AUTH_BYPASS_PREFIXES):
        return await call_next(request)

    auth_header = request.headers.get("authorization", "")
    auth_token = request.headers.get("x-edi-auth-token")
    if auth_header.lower().startswith("bearer "):
        auth_token = auth_header[7:].strip()

    if not auth_token or auth_token not in ACTIVE_AUTH_TOKENS:
        return JSONResponse(status_code=401, content={"detail": "Autenticação necessária"})

    return await call_next(request)


@app.on_event("startup")
async def run_startup_migrations():
    """Garante criação/atualização aditiva do schema em todo startup."""
    logger.info("Starting database initialization/migrations...")
    initialize_database()
    logger.info("Database initialization/migrations completed.")


# ============================================================================
# PYDANTIC MODELS
# ============================================================================


class ActivityCreate(BaseModel):
    title: str
    min_duration: int
    max_duration: int
    frequency_type: str = "flex"
    fixed_time: Optional[str] = None
    fixed_duration: Optional[int] = None
    is_disc: int = 1
    is_fun: int = 0


class BpmRequest(BaseModel):
    bpm: int


class DailyActivityLog(BaseModel):
    activity_id: int
    duration: Optional[int] = None
    completed: int = 0
    timestamp: Optional[str] = None


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    difficulty: int = 1
    category_id: Optional[int] = None
    image_path: Optional[str] = None


class GoalActivityLink(BaseModel):
    goal_id: int
    activity_id: int


class GoalUpdate(BaseModel):
    title: str
    description: Optional[str] = None
    deadline: Optional[str] = None
    difficulty: int = 1
    category_id: Optional[int] = None
    image_path: Optional[str] = None


class RoutineCreate(BaseModel):
    period: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None


class RoutineBlockCreate(BaseModel):
    routine_id: int
    activity_id: Optional[int] = None
    duration: int
    auto_fill_allowed: int = 1


class RoutineBlockUpdate(BaseModel):
    activity_id: Optional[int] = None
    duration: int
    auto_fill_allowed: int = 1


class RoutineBlockComplete(BaseModel):
    completed: bool = True


class LoginRequest(BaseModel):
    password: str


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_size(cls, value: str):
        if len(value or "") < 4:
            raise ValueError("Nova senha deve ter pelo menos 4 caracteres")
        return value


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "app": "EDI Life Manager API",
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/api/auth/status")
async def auth_status():
    return {
        "success": True,
        "data": {
            "password_configured": password_config_exists(),
            "password_config_path": password_config_location(),
        },
    }


@app.post("/api/auth/login")
async def auth_login(payload: LoginRequest):
    if not verify_password(payload.password):
        raise HTTPException(status_code=401, detail="Senha inválida")

    token = secrets.token_urlsafe(48)
    ACTIVE_AUTH_TOKENS.add(token)
    return {"success": True, "data": {"token": token}}


@app.post("/api/auth/change-password")
async def auth_change_password(payload: PasswordUpdateRequest):
    changed = update_password(payload.current_password, payload.new_password)
    if not changed:
        raise HTTPException(status_code=401, detail="Senha atual inválida")

    ACTIVE_AUTH_TOKENS.clear()
    return {"success": True}




# ============================================================================
# ACTIVITIES ENDPOINTS
# ============================================================================

@app.get("/api/activities")
async def list_activities():
    """List all active activities"""
    try:
        activities = ActivityEngine.list_activities()
        return {"success": True, "data": activities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/activities")
async def create_activity(activity: ActivityCreate):
    def _validate_fixed_activity_conflicts(payload: ActivityCreate):
        if not payload.fixed_time or payload.fixed_duration is None:
            return

        frequency = (payload.frequency_type or "flex").strip().lower()
        fixed_end = add_minutes(payload.fixed_time, payload.fixed_duration)

        day_types = []
        if frequency == "workday":
            day_types = ["work"]
        elif frequency == "offday":
            day_types = ["off"]
        else:
            day_types = ["work", "off"]

        with Database() as db:
            config = db.fetchone(
                """
                SELECT sleep_start, sleep_end, work_start, work_end
                FROM daily_config
                WHERE id = 1
                """
            )

            if config and intervals_overlap(payload.fixed_time, fixed_end, config["sleep_start"], config["sleep_end"]):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Conflito de horário: atividade fixa {payload.fixed_time}-{fixed_end} "
                        f"intersecta a janela de sono ({config['sleep_start']}-{config['sleep_end']})."
                    ),
                )

            if config and frequency in {"workday", "everyday", "flex"} and intervals_overlap(
                payload.fixed_time,
                fixed_end,
                config["work_start"],
                config["work_end"],
            ):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Conflito de horário: atividade fixa {payload.fixed_time}-{fixed_end} "
                        f"intersecta o horário de trabalho ({config['work_start']}-{config['work_end']})."
                    ),
                )

            routine_rows = db.fetchall(
                """
                SELECT
                    dr.day_type,
                    drb.name,
                    drb.start_time,
                    drb.end_time
                FROM daily_routine_blocks drb
                INNER JOIN daily_routines dr ON dr.id = drb.routine_id
                WHERE dr.day_type IN ({})
                ORDER BY dr.day_type, drb.start_time
                """.format(",".join(["?"] * len(day_types))),
                tuple(day_types),
            )

            for row in routine_rows:
                if intervals_overlap(payload.fixed_time, fixed_end, row["start_time"], row["end_time"]):
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"Conflito de horário: atividade fixa {payload.fixed_time}-{fixed_end} "
                            f"intersecta bloco de rotina '{row['name']}' "
                            f"({row['day_type']}: {row['start_time']}-{row['end_time']})."
                        ),
                    )

    try:
        title = (activity.title or "").strip()
        frequency = (activity.frequency_type or "flex").strip().lower()
        allowed_frequencies = {"flex", "everyday", "workday", "offday"}

        if not title:
            raise HTTPException(status_code=400, detail="title é obrigatório")

        if activity.min_duration <= 0:
            raise HTTPException(status_code=400, detail="min_duration deve ser maior que zero")

        if activity.max_duration <= 0:
            raise HTTPException(status_code=400, detail="max_duration deve ser maior que zero")

        if activity.max_duration < activity.min_duration:
            raise HTTPException(status_code=400, detail="max_duration deve ser maior ou igual a min_duration")

        if frequency not in allowed_frequencies:
            raise HTTPException(status_code=400, detail="frequency_type inválido")

        has_fixed_time = bool(activity.fixed_time)
        has_fixed_duration = activity.fixed_duration is not None

        if has_fixed_time != has_fixed_duration:
            raise HTTPException(status_code=400, detail="fixed_time e fixed_duration devem ser informados juntos")

        if has_fixed_duration and activity.fixed_duration <= 0:
            raise HTTPException(status_code=400, detail="fixed_duration deve ser maior que zero")

        if activity.fixed_time:
            try:
                datetime.strptime(activity.fixed_time, "%H:%M")
            except ValueError:
                raise HTTPException(status_code=400, detail="fixed_time deve estar no formato HH:MM")

        if not activity.is_disc and not activity.is_fun:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma categoria: is_disc ou is_fun")

        _validate_fixed_activity_conflicts(activity)

        ActivityEngine.create_activity(
            title=title,
            min_duration=activity.min_duration,
            max_duration=activity.max_duration,
            frequency_type=frequency,
            fixed_time=activity.fixed_time,
            fixed_duration=activity.fixed_duration,
            is_disc=activity.is_disc,
            is_fun=activity.is_fun,
        )

        return {"success": True, "message": "Activity created"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/activities/{activity_id}/toggle")
async def toggle_activity(activity_id: int):
    """Toggle activity active/inactive status"""
    try:
        ActivityEngine.toggle_activity(activity_id)
        return {"success": True, "message": "Activity status toggled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@app.delete("/api/activities/{activity_id}")
async def delete_activity(activity_id: int):
    try:
        ActivityEngine.delete_activity(activity_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/activities/{activity_id}/progress")
async def get_activity_progress(activity_id: int):
    """Get progress of a specific activity"""
    try:
        progress = ActivityEngine.get_progress(activity_id)
        return {"success": True, "data": {"progress": progress}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DAILY LOG ENDPOINTS
# ============================================================================

@app.get("/api/daily-log")
async def list_daily_log():
    """List today's activity logs"""
    try:
        logs = DailyLogEngine.list_day()
        return {"success": True, "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/daily-log/register")
async def register_daily_activity(log: DailyActivityLog):
    """Register an activity for today"""
    try:
        DailyLogEngine.register_activity(
            activity_id=log.activity_id,
            duration=log.duration,
            completed=log.completed,
            timestamp=log.timestamp
        )
        return {"success": True, "message": "Activity registered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/daily-log/{date}")
async def get_daily_log_by_date(date: str):
    """Get activity logs for a specific date"""
    try:
        logs = DailyLogEngine.list_day(date)
        return {"success": True, "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# GOALS ENDPOINTS
# ============================================================================

@app.get("/api/goals")
async def list_goals(order_by: str = "created_at"):
    """List all goals"""
    try:
        goals = GoalEngine.list_goals(order_by=order_by)
        return {"success": True, "data": goals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/goals")
async def create_goal(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
    difficulty: int = Form(1),
    category_id: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    try:
        image_path = None

        if image:
            image_path = _save_upload_file(image, UPLOADS_DIR / "goals")

        GoalEngine.create_goal(
            title=title,
            description=description,
            deadline=deadline,
            difficulty=difficulty,
            category_id=category_id,
            image_path=image_path,
        )

        return {
            "success": True,
            "message": "Goal created",
            "data": {"image_path": image_path}
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/goals/{goal_id}")
async def update_goal(goal_id: int, goal: GoalUpdate):
    """Update a goal (except completed goals)"""
    try:
        updated = GoalEngine.update_goal(
            goal_id=goal_id,
            title=goal.title,
            description=goal.description,
            deadline=goal.deadline,
            difficulty=goal.difficulty,
            category_id=goal.category_id,
            image_path=goal.image_path,
        )
        if not updated:
            raise HTTPException(status_code=400, detail="Meta concluída não pode ser editada")
        return {"success": True, "message": "Goal updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/goals/{goal_id}/multipart")
async def update_goal_multipart(
    goal_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    deadline: Optional[str] = Form(None),
    difficulty: int = Form(1),
    category_id: Optional[int] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    """Update a goal using multipart/form-data, optionally replacing image."""
    try:
        image_path = None
        if image:
            image_path = _save_upload_file(image, UPLOADS_DIR / "goals")

        updated = GoalEngine.update_goal(
            goal_id=goal_id,
            title=title,
            description=description,
            deadline=deadline,
            difficulty=difficulty,
            category_id=category_id,
            image_path=image_path,
        )
        if not updated:
            raise HTTPException(status_code=400, detail="Meta concluída não pode ser editada")

        return {
            "success": True,
            "message": "Goal updated",
            "data": {"image_path": image_path},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/goals/{goal_id}")
async def delete_goal(goal_id: int):
    """Delete a goal"""
    try:
        deleted = GoalEngine.delete_goal(goal_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Meta não encontrada")
        return {"success": True, "message": "Goal deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/goals/stars/total")
async def get_goals_stars_total():
    """Total stars earned by completing goals"""
    try:
        total_stars = GoalEngine.get_stars_total()
        return {"success": True, "data": {"total_stars": total_stars}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/goals/link-activity")
async def link_goal_activity(link: GoalActivityLink):
    """Link an activity to a goal"""
    try:
        linked = GoalEngine.link_activity(link.goal_id, link.activity_id)
        if not linked:
            raise HTTPException(status_code=409, detail="Atividade já vinculada à meta")
        return {"success": True, "message": "Activity linked to goal"}
    except GoalActivityValidationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/goals/{goal_id}/activities/{activity_id}")
async def unlink_goal_activity(goal_id: int, activity_id: int):
    """Unlink an activity from a goal"""
    try:
        unlinked = GoalEngine.unlink_activity(goal_id, activity_id)
        if not unlinked:
            raise HTTPException(status_code=404, detail="Vínculo entre meta e atividade não encontrado")
        return {"success": True, "message": "Activity unlinked from goal"}
    except GoalActivityValidationError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/goals/{goal_id}/progress")
async def get_goal_progress(goal_id: int):
    """Calculate progress for a specific goal"""
    try:
        progress = GoalEngine.calculate_progress(goal_id)
        return {"success": True, "data": progress}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/goals/{goal_id}/status")
async def update_goal_status(goal_id: int, status: str):
    """Update goal status"""
    try:
        updated = GoalEngine.update_status(goal_id, status)
        if not updated:
            raise HTTPException(
                status_code=404,
                detail={
                    "code": "GOAL_NOT_FOUND",
                    "message": "Meta não encontrada para atualização de status.",
                },
            )
        return {"success": True, "message": "Goal status updated"}
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_GOAL_STATUS",
                "message": "Status inválido. Use: ativa, concluida ou cancelada.",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "GOAL_STATUS_UPDATE_ERROR",
                "message": "Erro inesperado ao atualizar status da meta.",
                "error": str(e),
            },
        )


# ============================================================================
# GOAL CATEGORIES & HOME (WOw Style)
# ============================================================================

class GoalCategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    
class GoalCategoryUpdate(BaseModel):
    name: str
    icon: Optional[str] = None


@app.put("/api/goals/categories/{category_id}")
async def update_goal_category(category_id: int, payload: GoalCategoryUpdate):
    """Update a goal category"""
    try:
        updated = GoalEngine.update_category(
            category_id=category_id,
            name=payload.name,
            icon=payload.icon
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Categoria não encontrada")

        return {"success": True, "message": "Category updated"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/goals/categories/{category_id}")
async def delete_goal_category(category_id: int):
    """Delete a goal category"""
    try:
        deleted = GoalEngine.delete_category(category_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Categoria não encontrada")

        return {"success": True, "message": "Category deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/goals/home")
async def goals_home():
    """Goals home overview (WoW-style summary)"""
    try:
        data = GoalEngine.get_home_overview()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/goals/categories")
async def list_goal_categories():
    """List all goal categories"""
    try:
        categories = GoalEngine.list_categories()
        return {"success": True, "data": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/goals/categories")
async def create_goal_category(payload: GoalCategoryCreate):
    """Create a new goal category"""
    try:
        GoalEngine.create_category(payload.name, payload.icon)
        return {"success": True, "message": "Category created"}
    except Exception as e:
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(status_code=400, detail="Já existe uma categoria com esse nome")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/goals/categories/{category_id}")
async def list_goals_from_category(category_id: int):
    """List goals from a specific category"""
    try:
        goals = GoalEngine.list_goals_by_category(category_id)
        return {"success": True, "data": goals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# MUSIC TRAINING ENDPOINTS
# ============================================================================

@app.post("/api/music/training")
async def create_training(
    name: str = Form(...),
    instrument: str = Form(...),
    image: UploadFile = File(...)
):
    image_path = _save_upload_file(image, UPLOADS_DIR / "music" / "training")

    tid = MusicEngine.create_training(name, instrument, image_path)

    return {"success": True, "data": {"id": tid, "image_path": image_path}}
    
    
@app.get("/api/music/training")
async def list_training():
    return {"success": True, "data": MusicEngine.list_trainings()}
    
    
@app.post("/api/music/training/{training_id}/session")
async def add_training_session(training_id: int, payload: BpmRequest):
    MusicEngine.add_training_session(training_id, payload.bpm)
    return {"success": True}


@app.get("/api/music/training/{training_id}/history")
async def training_history(training_id: int):
    return {"success": True, "data": MusicEngine.get_training_history(training_id)}

# ============================================================================
# MUSIC LISTENING ENDPOINTS
# ============================================================================
    
from fastapi import Form

@app.post("/api/music/artists")
async def create_artist(
    name: str = Form(...),
    image: UploadFile = File(None)
):
    try:
        image_path = None

        if image:
            image_path = _save_upload_file(
                image,
                UPLOADS_DIR / "music" / "artists"
            )

        artist_id = MusicEngine.create_artist(
            name.strip(),
            image_path
        )

        return {
            "success": True,
            "data": {
                "id": artist_id,
                "image_path": image_path
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
@app.get("/api/music/artists")
async def list_artists():
    return {"success": True, "data": MusicEngine.list_artists_grouped()}
    
    
@app.post("/api/music/albums")
async def create_album(
    artist_id: int = Form(...),
    name: str = Form(...),
    image: UploadFile = File(None)
):
    image_path = None

    if image:
        image_path = _save_upload_file(
            image,
            UPLOADS_DIR / "music" / "albums"
        )

    album_id = MusicEngine.create_album(
        artist_id,
        name,
        image_path
    )

    return {
        "success": True,
        "data": {
            "id": album_id,
            "image_path": image_path
        }
    }
    
@app.patch("/api/music/albums/{album_id}/confirm")
async def confirm_album(album_id: int):
    MusicEngine.confirm_album(album_id)
    return {"success": True}
    
    
@app.get("/api/music/albums")
async def list_albums(status: str = None):
    return {"success": True, "data": MusicEngine.list_albums(status)}



# ==============================
# WATCH
# ==============================

@app.post("/api/watch/categories")
async def create_watch_category(name: str = Form(...)):
    WatchEngine.create_category(name)
    return {"success": True}


@app.get("/api/watch/categories")
async def list_watch_categories():
    return {
        "success": True,
        "data": WatchEngine.list_categories()
    }


@app.post("/api/watch/items")
async def create_watch_item(
    category_id: int = Form(...),
    name: str = Form(...),
    image: UploadFile = File(None)
):
    image_path = None

    if image:
        image_path = _save_upload_file(
            image,
            UPLOADS_DIR / "watch"
        )

    WatchEngine.create_item(category_id, name, image_path)

    return {"success": True}


@app.patch("/api/watch/items/{item_id}/watched")
async def mark_watched(item_id: int):
    WatchEngine.mark_watched(item_id)
    return {"success": True}


@app.get("/api/watch/items/{category_id}")
async def list_watch_items(category_id: int):
    return {
        "success": True,
        "data": WatchEngine.list_items(category_id)
    }

# ============================================================================
# ROUTINES ENDPOINTS
# ============================================================================

@app.get("/api/routines")
async def list_routines():
    """List all routines"""
    try:
        routines = RoutineEngine.list_routines()
        return {"success": True, "data": routines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/routines")
async def create_routine(routine: RoutineCreate):
    """Create a new routine"""
    try:
        RoutineEngine.create_routine(
            period=routine.period,
            start_time=routine.start_time,
            end_time=routine.end_time
        )
        return {"success": True, "message": "Routine created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/routines/{routine_id}/blocks")
async def get_routine_blocks(routine_id: int):
    """Get blocks for a specific routine"""
    try:
        blocks = RoutineEngine.get_blocks(routine_id)
        return {"success": True, "data": blocks}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/routines/blocks")
async def add_routine_block(block: RoutineBlockCreate):
    """Add a block to a routine"""
    try:
        RoutineEngine.add_block(
            routine_id=block.routine_id,
            activity_id=block.activity_id,
            duration=block.duration,
            auto_fill_allowed=block.auto_fill_allowed
        )
        return {"success": True, "message": "Block added to routine"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/routines/blocks/{block_id}")
async def update_routine_block(block_id: int, block: RoutineBlockUpdate):
    """Update a routine block"""
    try:
        updated = RoutineEngine.update_block(
            block_id=block_id,
            activity_id=block.activity_id,
            duration=block.duration,
            auto_fill_allowed=block.auto_fill_allowed
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Bloco não encontrado")
        return {"success": True, "message": "Block updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/routines/blocks/{block_id}")
async def delete_routine_block(block_id: int):
    """Delete a routine block"""
    try:
        deleted = RoutineEngine.delete_block(block_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Bloco não encontrado")
        return {"success": True, "message": "Block deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/routines/blocks/{block_id}/complete")
async def complete_routine_block(block_id: int, payload: RoutineBlockComplete):
    """Mark a routine block as completed or pending"""
    try:
        updated = RoutineEngine.complete_block(block_id, payload.completed)
        if not updated:
            raise HTTPException(status_code=404, detail="Bloco não encontrado")
        return {"success": True, "message": "Block status updated"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYTICS ENDPOINTS
# ============================================================================

@app.get("/api/analytics/today")
async def get_today_summary():
    """Get today's summary"""
    try:
        summary = AnalyticsEngine.today_summary()
        return {"success": True, "data": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/last-days/{days}")
async def get_last_days(days: int = 7):
    """Get analytics for last N days"""
    try:
        data = AnalyticsEngine.last_days(days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/top-activities")
async def get_top_activities(limit: int = 5):
    """Get most frequent activities"""
    try:
        activities = AnalyticsEngine.top_activities(limit)
        return {"success": True, "data": activities}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analytics/goals-overview")
async def get_goals_overview():
    """Get overview of all goals"""
    try:
        overview = AnalyticsEngine.goals_overview()
        return {"success": True, "data": overview}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
        



@app.get("/api/reports/goals/summary")
async def reports_goals_summary():
    """Get weekly/monthly completed goals and category ranking."""
    try:
        data = AnalyticsEngine.goals_summary_report()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/daily/overview")
async def reports_daily_overview():
    """Get daily overview (today/week/month)."""
    try:
        data = AnalyticsEngine.daily_overview()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/daily/streaks")
async def reports_daily_streaks():
    """Get streak summary for activity and perfect daily."""
    try:
        data = AnalyticsEngine.streaks_summary()
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/daily/activity/{activity_id}")
async def reports_daily_activity(activity_id: int):
    """Get detailed report for one activity (week/month)."""
    try:
        data = AnalyticsEngine.activity_detail(activity_id)
        if not data:
            raise HTTPException(status_code=404, detail="Atividade não encontrada")
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/daily/timeseries")
async def reports_daily_timeseries(days: int = 30):
    """Get daily timeseries for completion and duration metrics."""
    try:
        days = max(1, min(days, 365))
        data = AnalyticsEngine.daily_timeseries(days)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/hobbies/log")
async def reports_hobbies_log(
    limit: int = 50,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    module: Optional[List[str]] = None,
):
    """Get unified hobbies log (Leitura, Artes, Assistir, Música)."""
    try:
        data = AnalyticsEngine.hobbies_log(
            limit=max(1, min(limit, 500)),
            from_date=from_date,
            to_date=to_date,
            modules=module,
        )
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# FINANCE ENDPOINTS
# ============================================================================

class FinanceConfigPayload(BaseModel):
    salary_monthly: float = 0
    monthly_contribution: float = 0
    thirteenth: float = 0

    reserve_current: float = 0
    reserve_cdb: float = 0
    reserve_extra: float = 0
    reserve_fgts: float = 0

    fgts: float = 0

    # CDI
    cdi_rate_annual: float = 0
    cdb_percent_cdi: float = 100
    extra_percent_cdi: float = 100

    # Conta corrente (taxa própria opcional)
    interest_rate_current: float = 0
    interest_rate_fgts: float = 3


class FixedExpensePayload(BaseModel):
    name: str
    monthly_value: float


class FinanceTransactionPayload(BaseModel):
    description: str
    amount: float
    category: Optional[str] = None
    occurred_at: str
    kind: Literal["expense", "income"] = "expense"


@app.get("/api/finance/config")
async def finance_get_config():
    return {"success": True, "data": FinanceEngine.get_config()}


@app.post("/api/finance/config")
async def finance_save_config(payload: FinanceConfigPayload):
    FinanceEngine.save_config(payload.model_dump())
    return {"success": True}


@app.get("/api/finance/fixed-expenses")
async def finance_list_fixed_expenses():
    return {"success": True, "data": FinanceEngine.list_fixed_expenses()}


@app.post("/api/finance/fixed-expenses")
async def finance_create_fixed_expense(payload: FixedExpensePayload):
    FinanceEngine.create_fixed_expense(payload.name, payload.monthly_value)
    return {"success": True}


@app.put("/api/finance/fixed-expenses/{expense_id}")
async def finance_update_fixed_expense(expense_id: int, payload: FixedExpensePayload):
    updated = FinanceEngine.update_fixed_expense(expense_id, payload.name, payload.monthly_value)
    return {"success": updated}


@app.delete("/api/finance/fixed-expenses/{expense_id}")
async def finance_delete_fixed_expense(expense_id: int):
    deleted = FinanceEngine.delete_fixed_expense(expense_id)
    return {"success": deleted}


@app.get("/api/finance/summary")
async def finance_summary():
    return {"success": True, "data": FinanceEngine.get_summary()}


@app.get("/api/finance/transactions")
async def finance_list_transactions(limit: int = 200):
    return {"success": True, "data": FinanceEngine.list_transactions(limit=limit)}


@app.post("/api/finance/transactions")
async def finance_create_transaction(payload: FinanceTransactionPayload):
    data = FinanceEngine.create_transaction(
        description=payload.description,
        amount=payload.amount,
        category=payload.category,
        occurred_at=payload.occurred_at,
        kind=payload.kind,
    )
    return {"success": True, "data": data}


@app.put("/api/finance/transactions/{transaction_id}")
async def finance_update_transaction(transaction_id: int, payload: FinanceTransactionPayload):
    data = FinanceEngine.update_transaction(
        transaction_id=transaction_id,
        description=payload.description,
        amount=payload.amount,
        category=payload.category,
        occurred_at=payload.occurred_at,
        kind=payload.kind,
    )
    if not data:
        raise HTTPException(status_code=404, detail="transaction_not_found")
    return {"success": True, "data": data}


@app.delete("/api/finance/transactions/{transaction_id}")
async def finance_delete_transaction(transaction_id: int):
    deleted = FinanceEngine.delete_transaction(transaction_id)
    return {"success": deleted}


@app.get("/api/finance/projection")
async def finance_projection(months: int = 120):
    return {"success": True, "data": FinanceEngine.generate_projection(months)}


@app.get("/api/reports/finance/summary")
async def reports_finance_summary(reference_date: Optional[str] = None):
    return {"success": True, "data": FinanceEngine.get_transaction_analytics(reference_date=reference_date)}


# ============================================================================
# NOTIFICATIONS ENDPOINTS
# ============================================================================


class CustomNotificationPayload(BaseModel):
    title: str
    message: Optional[str] = None
    severity: Literal["info", "success", "warning", "critical", "neutral"] = "info"
    scheduled_for: Optional[str] = None
    meta: Optional[dict] = None
    sound_key: Optional[str] = None
    color_token: Optional[str] = None

    @field_validator("title")
    def validate_title(cls, value):
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("title é obrigatório")
        return normalized

    @field_validator("message")
    def validate_message(cls, value):
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) > 500:
            raise ValueError("message excede o limite de 500 caracteres")
        return normalized

    @field_validator("scheduled_for")
    def validate_scheduled_for(cls, value):
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        try:
            datetime.fromisoformat(normalized.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("scheduled_for deve ser uma data/hora válida (ISO-8601)") from exc
        return normalized


class NotificationStatusPayload(BaseModel):
    status: str


class NotificationFeaturePreferencePayload(BaseModel):
    feature_key: str
    enabled: bool = True
    channels: list[str] = ["in_app", "sound"]
    quiet_hours: Optional[dict] = None


@app.get("/api/notifications/consumables")
async def notifications_consumables(
    include_read: bool = False,
    include_generated: bool = True,
):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        if include_generated:
            NotificationCenterEngine.generate_system_notifications()

        notifications = NotificationCenterEngine.list_notifications(
            source_feature="consumables",
            include_read=include_read,
        )
        return {"success": True, "data": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notifications")
async def notifications_list(
    status: Optional[str] = None,
    notification_type: Optional[str] = None,
    source_feature: Optional[str] = None,
    severity: Optional[Literal["info", "success", "warning", "critical", "neutral"]] = None,
    include_read: bool = False,
    include_generated: bool = True,
):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        if include_generated:
            NotificationCenterEngine.generate_system_notifications()

        notifications = NotificationCenterEngine.list_notifications(
            status=status,
            notification_type=notification_type,
            source_feature=source_feature,
            severity=severity,
            include_read=include_read,
        )
        return {"success": True, "data": notifications}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/notifications/custom")
async def notifications_create_custom(payload: CustomNotificationPayload):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        data = payload.model_dump()
        data["notification_type"] = "custom_notification"
        data["source_feature"] = "custom"
        data["status"] = "unread"
        notification_id = NotificationCenterEngine.create_custom_notification(data)
        return {"success": True, "data": {"id": notification_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/notifications/custom/{notification_id}")
async def notifications_update_custom(notification_id: int, payload: CustomNotificationPayload):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        NotificationCenterEngine.update_custom_notification(notification_id, payload.model_dump())
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/notifications/{notification_id}/status")
async def notifications_update_status(notification_id: int, payload: NotificationStatusPayload):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        NotificationCenterEngine.update_notification_status(notification_id, payload.status)
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/notifications/preferences")
async def notifications_get_preferences():
    try:
        from core.notification_center_engine import NotificationCenterEngine

        return {"success": True, "data": NotificationCenterEngine.get_preferences()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/notifications/preferences")
async def notifications_save_preferences(payload: list[NotificationFeaturePreferencePayload]):
    try:
        from core.notification_center_engine import NotificationCenterEngine

        NotificationCenterEngine.save_preferences([item.dict() for item in payload])
        return {"success": True, "data": NotificationCenterEngine.get_preferences()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# EXPORT ENDPOINTS
# ============================================================================

@app.get("/api/export/json")
async def export_json(filename: Optional[str] = None):
    """Export all data to JSON"""
    try:
        from core.export_engine import ExportEngine
        filepath = ExportEngine.export_json(filename)
        return {"success": True, "data": {"filepath": filepath}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/csv")
async def export_csv():
    """Export all data to CSV files"""
    try:
        from core.export_engine import ExportEngine
        filepaths = ExportEngine.export_csv()
        return {"success": True, "data": {"filepaths": filepaths}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/activities-report")
async def export_activities_report(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """Export activities report"""
    try:
        from core.export_engine import ExportEngine
        filepath = ExportEngine.export_activities_report(start_date, end_date)
        return {"success": True, "data": {"filepath": filepath}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/goals-progress")
async def export_goals_progress():
    """Export goals progress report"""
    try:
        from core.export_engine import ExportEngine
        filepath = ExportEngine.export_goals_progress()
        return {"success": True, "data": {"filepath": filepath}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# USER PROFILE ENDPOINTS
# ============================================================================

class UserProfileCreate(BaseModel):
    name: str
    birth_date: Optional[str] = None
    height: Optional[float] = None
    gender: Optional[str] = None
    photo_path: Optional[str] = None


class UserMetricCreate(BaseModel):
    user_id: Optional[int] = None
    weight: float
    date: Optional[str] = None
    body_fat: Optional[float] = None
    muscle_mass: Optional[float] = None
    notes: Optional[str] = None


@app.get("/api/user/profile")
async def get_user_profile():
    """Get user profile"""
    try:
        profile = UserProfileEngine.get_profile()
        return {"success": True, "data": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/user/profile")
async def create_user_profile(profile: UserProfileCreate):
    """Create or update user profile"""
    try:
        pid = UserProfileEngine.save_profile(
            profile.name,
            profile.birth_date,
            profile.height,
            profile.gender,
            profile.photo_path,
        )
        return {"success": True, "message": "Profile saved", "data": {"id": pid}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/user/metrics")
async def get_user_metrics(limit: int = 30):
    """Get user metrics history"""
    try:
        return {"success": True, "data": UserProfileEngine.get_metrics(limit)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/user/metrics")
async def add_user_metric(metric: UserMetricCreate):
    """Add user metric (weight, etc)"""
    try:
        ok = UserProfileEngine.add_metric(
            metric.weight,
            metric.date,
            metric.user_id,
            metric.body_fat,
            metric.muscle_mass,
            metric.notes,
        )
        if not ok:
            raise HTTPException(status_code=400, detail="Profile not found")
        return {"success": True, "message": "Metric added"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ACTIVITY HISTORY ENDPOINTS
# ============================================================================

@app.get("/api/activity-history")
async def get_activity_history(days: int = 30):
    """Get activity history for last N days"""
    try:
        from data.database import Database
        from datetime import date, timedelta
        
        start_date = (date.today() - timedelta(days=days)).isoformat()
        
        with Database() as db:
            history = db.fetchall("""
                SELECT 
                    dl.date,
                    a.title as activity,
                    a.is_disc,
                    a.is_fun,
                    dal.duration,
                    dal.completed,
                    dal.timestamp
                FROM daily_activity_logs dal
                JOIN daily_logs dl ON dl.id = dal.daily_log_id
                JOIN activities a ON a.id = dal.activity_id
                WHERE dl.date >= ?
                ORDER BY dl.date DESC, dal.timestamp DESC
            """, (start_date,))
        
        return {"success": True, "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




# ============================================================================
# DASHBOARD / PROFILE ENDPOINTS
# ============================================================================

from core.dashboard_engine import DashboardEngine
from core.user_profile_engine import UserProfileEngine
from core.book_engine import BookEngine
from core.painting_engine import PaintingEngine
from core.progress_photo_engine import ProgressPhotoEngine
from core.shopping_engine import ShoppingEngine
from core.consumables_engine import (
    ConsumablesEngine,
    ConsumablesConflictError,
    ConsumablesNotFoundError,
    ConsumablesValidationError,
)
from core.reminder_engine import ReminderEngine
from core.day_plan_engine import DayPlanEngine


class ProfilePayload(BaseModel):
    name: str
    birth_date: Optional[str] = None
    height: Optional[float] = None
    gender: Optional[str] = None
    photo_path: Optional[str] = None


class WeightPayload(BaseModel):
    weight: float
    date: Optional[str] = None
    body_fat: Optional[float] = None
    muscle_mass: Optional[float] = None
    notes: Optional[str] = None


class BookPayload(BaseModel):
    title: str
    total_pages: int = 0
    book_type: str = "Livro"
    genre: Optional[str] = None
    cover_image: Optional[str] = None


class BookTypePayload(BaseModel):
    name: str


class ReadingSessionPayload(BaseModel):
    pages_read: int
    duration: Optional[int] = None
    notes: Optional[str] = None
    read_at: Optional[str] = None


class ArtworkCreatePayload(BaseModel):
    title: str
    size: Optional[str] = None
    started_at: Optional[str] = None
    visual_category: str = "pintura"


class ArtworkUpdatePayload(BaseModel):
    update_title: str
    mark_completed: bool = False


class ArtworkCompletionPayload(BaseModel):
    finished_at: Optional[str] = None


class MediaFolderCreatePayload(BaseModel):
    section_type: str
    name: str


class MediaFolderUpdatePayload(BaseModel):
    name: str


class MediaItemCreatePayload(BaseModel):
    folder_id: int
    title: str


class WishItemPayload(BaseModel):
    name: str
    price: Optional[float] = None
    link: Optional[str] = None
    item_type: Optional[str] = None
    photo_url: Optional[str] = None


class WishItemUpdatePayload(BaseModel):
    name: str
    price: Optional[float] = None
    link: Optional[str] = None
    item_type: Optional[str] = None
    photo_url: Optional[str] = None
    is_marked: Optional[bool] = None


class WishItemMarkPayload(BaseModel):
    is_marked: bool


class ShoppingItemPayload(BaseModel):
    name: str
    category: str
    average_price: float = 0
    restock_days: int = 30
    quantity_per_purchase: int = 1
    unit: str = "un"
    priority: int = 3
    notes: Optional[str] = None


class ConsumableCategoryPayload(BaseModel):
    name: str


class ConsumableItemPayload(BaseModel):
    name: str
    category_id: int


class RestockPayload(BaseModel):
    purchase_date: str
    price_paid: Optional[float] = None


class FinishCyclePayload(BaseModel):
    ended_at: str


class ReminderPayload(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: int = 3
    category: str = "pessoal"
    reminder_days_before: int = 7


class DayPlanPayload(BaseModel):
    date: str
    start_time: str
    duration: int
    activity_id: Optional[int] = None
    source_type: str = "manual"
    block_name: Optional[str] = None
    block_category: Optional[str] = None
    updated_source: Optional[str] = "manual"


class DailyBlockUpdatePayload(BaseModel):
    start_time: str
    duration: int
    block_name: Optional[str] = None
    block_category: Optional[str] = None
    updated_source: Optional[str] = "manual"


@app.get("/api/dashboard/overview")
async def dashboard_overview():
    return {"success": True, "data": DashboardEngine.get_today_overview()}


@app.get("/api/dashboard/weekly")
async def dashboard_weekly():
    return {"success": True, "data": DashboardEngine.get_weekly_summary()}


@app.get("/api/profile")
async def profile_get():
    profile = UserProfileEngine.get_profile()
    return {"success": True, "data": profile, "age": UserProfileEngine.get_age(profile) if profile else None}


@app.post("/api/profile")
async def profile_save(payload: ProfilePayload):
    pid = UserProfileEngine.save_profile(payload.name, payload.birth_date, payload.height, payload.gender, payload.photo_path)
    return {"success": True, "data": {"id": pid}}


@app.get("/api/profile/metrics")
async def profile_metrics(limit: int = 30):
    return {"success": True, "data": UserProfileEngine.get_metrics(limit)}


@app.post("/api/profile/metrics")
async def profile_add_metric(payload: WeightPayload):
    ok = UserProfileEngine.add_metric(payload.weight, payload.date, None, payload.body_fat, payload.muscle_mass, payload.notes)
    return {"success": ok}


@app.get("/api/books")
async def books_list(status: Optional[str] = None):
    return {"success": True, "data": BookEngine.list_books(status)}


@app.post("/api/books")
async def books_create(payload: BookPayload):
    book_id = BookEngine.add_book(
        payload.title,
        payload.total_pages,
        payload.book_type,
        payload.genre,
        payload.cover_image,
    )
    return {"success": True, "data": {"id": book_id}}


@app.get("/api/books/types")
async def books_types_list():
    return {"success": True, "data": BookEngine.list_book_types()}


@app.post("/api/books/types")
async def books_types_create(payload: BookTypePayload):
    type_id = BookEngine.create_book_type(payload.name)
    if not type_id:
        raise HTTPException(status_code=400, detail="Nome do tipo é obrigatório")
    return {"success": True, "data": {"id": type_id}}


@app.post("/api/books/{book_id}/sessions")
async def books_session(book_id: int, payload: ReadingSessionPayload):
    return {
        "success": BookEngine.add_reading_session(
            book_id,
            payload.pages_read,
            payload.duration,
            payload.notes,
            payload.read_at,
        )
    }


@app.get("/api/books/log")
async def books_log(limit: int = 200):
    return {"success": True, "data": BookEngine.get_reading_log(limit)}


@app.get("/api/books/stats-by-type")
async def books_stats_by_type(month: Optional[int] = None, year: Optional[int] = None):
    return {"success": True, "data": BookEngine.get_stats_by_type(month, year)}


@app.get("/api/books/stats")
async def books_stats():
    return {"success": True, "data": BookEngine.get_reading_stats()}

@app.delete("/api/books/{book_id}")
async def books_delete(book_id: int):
    deleted = BookEngine.delete_book(book_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Livro não encontrado")
    return {"success": True}


@app.get("/api/visual-arts/artworks")
async def artworks_list(status: Optional[str] = None, visual_category: Optional[str] = None):
    artworks = [dict(artwork) for artwork in PaintingEngine.list_artworks(status, visual_category)]
    for artwork in artworks:
        progress_photo_paths = artwork.get("progress_photo_paths")
        if isinstance(progress_photo_paths, str):
            try:
                artwork["progress_photo_paths"] = json.loads(progress_photo_paths)
            except json.JSONDecodeError:
                artwork["progress_photo_paths"] = []
        elif not isinstance(progress_photo_paths, list):
            artwork["progress_photo_paths"] = []

        artwork["progress_photo_urls"] = [
            _to_public_upload_url(path) for path in artwork["progress_photo_paths"] if path
        ]
        artwork["reference_image_url"] = _to_public_upload_url(artwork.get("reference_image_path"))
        artwork["latest_photo_url"] = _to_public_upload_url(artwork.get("latest_photo_path"))
    return {"success": True, "data": artworks}


@app.post("/api/visual-arts/artworks")
async def artworks_create(
    title: str = Form(...),
    visual_category: str = Form("pintura"),
    size: Optional[str] = Form(None),
    started_at: Optional[str] = Form(None),
    reference_image: Optional[UploadFile] = File(None),
):
    required_reference_categories = {"pintura", "pintura_digital", "desenho_tradicional"}
    if visual_category in required_reference_categories and not reference_image:
        raise HTTPException(
            status_code=400,
            detail="A imagem de referência é obrigatória para pintura, pintura digital e desenho tradicional.",
        )

    reference_image_path = None
    if reference_image:
        reference_image_path = _save_upload_file(
            reference_image,
            VISUAL_ARTS_UPLOADS_DIR / "reference" / visual_category,
        )

    artwork_id = PaintingEngine.create_artwork(
        title=title,
        size=size,
        started_at=started_at,
        reference_image_path=reference_image_path,
        visual_category=visual_category,
    )
    return {
        "success": True,
        "data": {
            "id": artwork_id,
            "reference_image_path": reference_image_path,
            "reference_image_url": _to_public_upload_url(reference_image_path),
        },
    }


@app.delete("/api/visual-arts/artworks/{painting_id}")
async def artworks_delete(painting_id: int):
    deleted = PaintingEngine.delete_artwork(painting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Obra não encontrada")
    return {"success": True}


@app.post("/api/visual-arts/artworks/{painting_id}/updates")
async def artworks_add_update(
    painting_id: int,
    update_title: str = Form(...),
    mark_completed: bool = Form(False),
    photo: UploadFile = File(...),
):
    photo_path = _save_upload_file(photo, VISUAL_ARTS_UPLOADS_DIR / "progress")
    update_id = PaintingEngine.add_artwork_update(
        painting_id=painting_id,
        update_title=update_title,
        photo_path=photo_path,
        mark_completed=mark_completed,
    )
    return {
        "success": True,
        "data": {
            "id": update_id,
            "photo_path": photo_path,
            "photo_url": _to_public_upload_url(photo_path),
        },
    }


@app.patch("/api/visual-arts/artworks/{painting_id}/completion-date")
async def artworks_set_completion_date(painting_id: int, payload: ArtworkCompletionPayload):
    ok = PaintingEngine.set_artwork_completed_date(painting_id, payload.finished_at)
    return {"success": ok}


@app.get("/api/visual-arts/artworks/{painting_id}/gallery")
async def artworks_gallery(painting_id: int):
    gallery = [dict(item) for item in PaintingEngine.get_artwork_gallery(painting_id)]
    for item in gallery:
        item["photo_url"] = _to_public_upload_url(item.get("photo_path"))
    return {"success": True, "data": gallery}


@app.get("/api/visual-arts/media-folders")
async def media_folders_list(section_type: Optional[str] = None):
    return {"success": True, "data": PaintingEngine.list_media_folders(section_type)}


@app.post("/api/visual-arts/media-folders")
async def media_folders_create(payload: MediaFolderCreatePayload):
    folder_id = PaintingEngine.create_media_folder(payload.section_type, payload.name)
    return {"success": True, "data": {"id": folder_id}}


@app.put("/api/visual-arts/media-folders/{folder_id}")
async def media_folders_update(folder_id: int, payload: MediaFolderUpdatePayload):
    ok = PaintingEngine.update_media_folder(folder_id, payload.name)
    return {"success": ok}


@app.delete("/api/visual-arts/media-folders/{folder_id}")
async def media_folders_delete(folder_id: int):
    ok = PaintingEngine.delete_media_folder(folder_id)
    return {"success": ok}


@app.get("/api/visual-arts/media-folders/{folder_id}/items")
async def media_items_list(folder_id: int):
    items = [dict(item) for item in PaintingEngine.list_media_items(folder_id)]
    for item in items:
        item["file_url"] = _to_public_upload_url(item.get("file_path"))
    return {"success": True, "data": items}


@app.post("/api/visual-arts/media-items")
async def media_items_create(
    folder_id: int = Form(...),
    title: str = Form(...),
    date: str = Form(None),
    photo: UploadFile = File(...),
):
    folders = [dict(item) for item in PaintingEngine.list_media_folders()]
    folder = next((item for item in folders if item.get("id") == folder_id), None)
    if not folder:
        raise HTTPException(status_code=404, detail="Pasta não encontrada")

    section_type = folder.get("section_type") or "outros"
    file_path = _save_upload_file(photo, VISUAL_ARTS_UPLOADS_DIR / "folders" / section_type)
    item_id = PaintingEngine.create_media_item(folder_id, title, file_path, date)
    return {"success": True, "data": {"id": item_id, "file_path": file_path, "file_url": _to_public_upload_url(file_path)}}


@app.delete("/api/visual-arts/media-items/{item_id}")
async def media_items_delete(item_id: int):
    ok = PaintingEngine.delete_media_item(item_id)
    return {"success": ok}


@app.post("/api/progress-photos")
async def progress_photo_create(activity_id: int, photo_path: str, description: Optional[str] = None, duration: Optional[int] = None):
    pid = ProgressPhotoEngine.add_photo(activity_id, photo_path, description, duration)
    return {"success": True, "data": {"id": pid}}


@app.get("/api/shopping/wishlist")
async def shopping_wishlist(item_type: Optional[str] = None):
    return {"success": True, "data": ShoppingEngine.list_wish_items(item_type)}


@app.post("/api/shopping/wishlist")
async def shopping_wishlist_create(payload: WishItemPayload):
    iid = ShoppingEngine.add_wish_item(payload.name, payload.price, payload.link, payload.item_type, payload.photo_url)
    return {"success": True, "data": {"id": iid}}


@app.put("/api/shopping/wishlist/{item_id}")
async def shopping_wishlist_update(item_id: int, payload: WishItemUpdatePayload):
    ok = ShoppingEngine.update_wish_item(item_id, payload.name, payload.price, payload.link, payload.item_type, payload.photo_url, payload.is_marked)
    return {"success": ok}


@app.patch("/api/shopping/wishlist/{item_id}/mark")
async def shopping_wishlist_mark(item_id: int, payload: WishItemMarkPayload):
    ok = ShoppingEngine.set_wish_item_marked(item_id, payload.is_marked)
    return {"success": ok}


@app.delete("/api/shopping/wishlist/{item_id}")
async def shopping_wishlist_delete(item_id: int):
    ok = ShoppingEngine.delete_wish_item(item_id)
    return {"success": ok}


@app.get("/api/shopping/items")
async def shopping_items(category: Optional[str] = None):
    return {"success": True, "data": ShoppingEngine.list_items_with_status(category)}


@app.post("/api/shopping/items")
async def shopping_item_create(payload: ShoppingItemPayload):
    iid = ShoppingEngine.add_item(**payload.model_dump())
    return {"success": True, "data": {"id": iid}}


@app.get("/api/shopping/stats")
async def shopping_stats():
    return {"success": True, "data": ShoppingEngine.get_shopping_stats()}


@app.get("/api/consumables/categories")
async def consumable_categories_list():
    return {"success": True, "data": ConsumablesEngine.list_categories()}


@app.post("/api/consumables/categories")
async def consumable_categories_create(payload: ConsumableCategoryPayload):
    try:
        category_id = ConsumablesEngine.create_category(payload.name)
        return {"success": True, "data": {"id": category_id}}
    except ConsumablesValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ConsumablesConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@app.get("/api/consumables/items")
async def consumable_items_list(category_id: Optional[int] = None):
    try:
        items = ConsumablesEngine.list_items(category_id)
        return {"success": True, "data": items}
    except ConsumablesNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/consumables/items/{item_id}")
async def consumable_item_detail(item_id: int):
    try:
        detail = ConsumablesEngine.get_item_detail(item_id)
        return {"success": True, "data": detail}
    except ConsumablesNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/consumables/items")
async def consumable_items_create(payload: ConsumableItemPayload):
    try:
        item_id = ConsumablesEngine.create_item(payload.name, payload.category_id)
        return {"success": True, "data": {"id": item_id}}
    except ConsumablesValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ConsumablesNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/consumables/items/{item_id}/restock")
async def consumable_items_restock(item_id: int, payload: RestockPayload):
    try:
        cycle_id = ConsumablesEngine.restock_item(item_id, payload.purchase_date, payload.price_paid)
        return {"success": True, "data": {"id": cycle_id}}
    except ConsumablesValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ConsumablesConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except ConsumablesNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.post("/api/consumables/items/{item_id}/finish")
async def consumable_items_finish(item_id: int, payload: FinishCyclePayload):
    try:
        cycle = ConsumablesEngine.finish_open_cycle(item_id, payload.ended_at)
        return {"success": True, "data": cycle}
    except ConsumablesValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except ConsumablesNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/api/reminders")
async def reminders_list(status: str = "pendente"):
    return {"success": True, "data": ReminderEngine.list_reminders(status)}


@app.post("/api/reminders")
async def reminders_create(payload: ReminderPayload):
    rid = ReminderEngine.add_reminder(**payload.model_dump())
    return {"success": True, "data": {"id": rid}}


@app.post("/api/reminders/{reminder_id}/complete")
async def reminders_complete(reminder_id: int):
    ReminderEngine.complete_reminder(reminder_id)
    return {"success": True}


@app.get("/api/reminders/upcoming")
async def reminders_upcoming(days: int = 7):
    return {"success": True, "data": ReminderEngine.get_upcoming_reminders(days)}


@app.get("/api/day-plan")
async def day_plan_list(date: Optional[str] = None):
    """
    Lista agenda do dia (persistida em daily_plan_blocks)
    """

    try:
        if not date:
            from datetime import date as dt
            date = dt.today().isoformat()

        from data.database import Database

        with Database() as db:
            blocks = db.fetchall("""
                SELECT 
                    dpb.id,
                    dpb.date,
                    dpb.start_time,
                    dpb.duration,
                    dpb.activity_id,
                    dpb.source_type,
                    dpb.block_name,
                    dpb.block_category,
                    dpb.updated_source,
                    a.title as activity_title
                FROM daily_plan_blocks dpb
                LEFT JOIN activities a ON a.id = dpb.activity_id
                WHERE dpb.date = ?
                ORDER BY dpb.start_time ASC
            """, (date,))

        return {
            "success": True,
            "data": blocks
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/day-plan")
async def day_plan_add(payload: DayPlanPayload):
    bid = DayPlanEngine.insert_plan_block(
        payload.date,
        payload.start_time,
        payload.duration,
        payload.activity_id,
        payload.source_type,
        payload.block_name,
        payload.block_category,
        payload.updated_source,
    )
    return {"success": True, "data": {"id": bid}}


@app.delete("/api/day-plan/{block_id}")
async def day_plan_delete(block_id: int):
    DayPlanEngine.remove_plan_block(block_id)
    return {"success": True}


# ============================================================================
# DAILY CONFIG ENDPOINTS
# ============================================================================

from core.daily_config_engine import DailyConfigEngine


class DailyConfigPayload(BaseModel):
    sleep_start: str
    sleep_end: str
    work_start: str
    work_end: str
    buffer_between: int
    granularity_min: int
    avoid_category_adjacent: bool
    discipline_weight: conint(ge=0)
    fun_weight: conint(ge=0)


@app.get("/api/day-config")
async def get_day_config():
    return {"success": True, "data": DailyConfigEngine.get()}


@app.post("/api/day-config")
async def update_day_config(payload: DailyConfigPayload):
    try:
        DailyConfigEngine.update(
            payload.sleep_start,
            payload.sleep_end,
            payload.work_start,
            payload.work_end,
            payload.buffer_between,
            payload.granularity_min,
            payload.avoid_category_adjacent,
            payload.discipline_weight,
            payload.fun_weight,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True}
    
#===========================================================================
# DAILY OVERRIDE ENDPOINTS
#===========================================================================

class DailyOverridePayload(BaseModel):
    date: str
    is_off: bool


@app.get("/api/daily/type")
async def get_daily_type(date: str):
    """
    Retorna 'work' ou 'off' para a data informada.
    """
    return {
        "success": True,
        "data": {
            "type": DailyOverrideEngine.get_day_type(date)
        }
    }


@app.post("/api/daily/override")
async def set_daily_override(payload: DailyOverridePayload):
    DailyOverrideEngine.set_override(payload.date, payload.is_off)
    return {"success": True}



# ============================================================================
# DAILY ENGINE + DAILY ROUTINES ENDPOINTS
# ============================================================================

from core.daily_engine import DailyEngine


# =========================
# DAILY ROUTINES
# =========================

class DailyRoutineCreate(BaseModel):
    name: str
    day_type: str  # work | off


class DailyRoutineBlockCreate(BaseModel):
    routine_id: int
    name: str
    start_time: str
    end_time: str
    category: Optional[str] = "fixed"
    is_locked: Optional[int] = 1
    track_completion: Optional[int] = 1


@app.get("/api/daily/routines")
async def list_daily_routines():
    with Database() as db:
        data = db.fetchall("""
            SELECT id, name, day_type
            FROM daily_routines
            ORDER BY id DESC
        """)
    return {"success": True, "data": data}


@app.post("/api/daily/routines")
async def create_daily_routine(payload: DailyRoutineCreate):
    with Database() as db:

        existing = db.fetchone("""
            SELECT id FROM daily_routines
            WHERE day_type = ?
        """, (payload.day_type.strip().lower(),))

        if existing:
            return {"success": True, "message": "Routine already exists"}

        db.execute("""
            INSERT INTO daily_routines (name, day_type)
            VALUES (?, ?)
        """, (
            payload.name,
            payload.day_type.strip().lower()
        ))

    return {"success": True}



@app.get("/api/daily/routines/{routine_id}/blocks")
async def get_daily_routine_blocks(routine_id: int):
    with Database() as db:
        blocks = db.fetchall("""
            SELECT 
                id,
                name,
                start_time,
                end_time,
                category,
                is_locked,
                track_completion
            FROM daily_routine_blocks
            WHERE routine_id = ?
            ORDER BY start_time ASC
        """, (routine_id,))
    return {"success": True, "data": blocks}


@app.post("/api/daily/routines/blocks")
async def add_daily_routine_block(payload: DailyRoutineBlockCreate):
    time_pattern = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

    block_name = (payload.name or "").strip()
    if not block_name:
        raise HTTPException(status_code=400, detail="Nome do bloco é obrigatório")

    if not time_pattern.match(payload.start_time):
        raise HTTPException(status_code=400, detail="start_time deve estar no formato HH:MM")

    if not time_pattern.match(payload.end_time):
        raise HTTPException(status_code=400, detail="end_time deve estar no formato HH:MM")

    if payload.start_time == payload.end_time:
        raise HTTPException(status_code=400, detail="end_time deve ser diferente de start_time")

    with Database() as db:
        existing_blocks = db.fetchall(
            """
            SELECT name, start_time, end_time
            FROM daily_routine_blocks
            WHERE routine_id = ?
            """,
            (payload.routine_id,),
        )

        for block in existing_blocks:
            if intervals_overlap(payload.start_time, payload.end_time, block["start_time"], block["end_time"]):
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Conflito de horário com bloco existente "
                        f"'{block['name']}' ({block['start_time']}-{block['end_time']})"
                    ),
                )

        db.execute("""
            INSERT INTO daily_routine_blocks (
                routine_id,
                name,
                start_time,
                end_time,
                category,
                is_locked,
                track_completion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            payload.routine_id,
            block_name,
            payload.start_time,
            payload.end_time,
            payload.category,
            payload.is_locked,
            payload.track_completion
        ))
    return {"success": True}


@app.delete("/api/daily/routines/blocks/{block_id}")
async def delete_daily_routine_block(block_id: int):
    with Database() as db:
        db.execute("""
            DELETE FROM daily_routine_blocks
            WHERE id = ?
        """, (block_id,))
    return {"success": True}


# =========================
# DAILY GENERATION
# =========================

@app.post("/api/daily/generate")
async def generate_daily(date: str):
    try:
        result = DailyEngine.generate_day(date)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/daily/summary")
async def daily_summary(date: str):
    return {
        "success": True,
        "data": DailyEngine.get_day_summary(date)
    }




class DailyBlockCompletePayload(BaseModel):
    completed: bool


@app.patch("/api/daily/block/{block_id}/complete")
async def complete_daily_block(block_id: int, payload: DailyBlockCompletePayload):
    DailyEngine.toggle_block_completion(block_id, payload.completed)
    return {"success": True}


@app.patch("/api/daily/block/{block_id}")
async def update_daily_block(block_id: int, payload: DailyBlockUpdatePayload):
    try:
        DailyEngine.update_block(
            block_id,
            payload.start_time,
            payload.duration,
            payload.block_name,
            payload.block_category,
            payload.updated_source or "manual"
        )
        return {"success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/daily/consistency")
async def daily_consistency(days: int = 7):
    return {
        "success": True,
        "data": DailyEngine.get_consistency(days)
    }


@app.get("/api/daily/weekly-stats")
async def daily_weekly_stats(date: str):
    return {
        "success": True,
        "data": DailyEngine.get_weekly_activity_stats(date)
    }


# =========================
# DAILY ACTIVE ROUTINE
# =========================

@app.get("/api/daily/routine")
async def get_active_daily_routine(date: str):
    """
    Retorna a rotina ativa (work/off) da data,
    incluindo seus blocos.
    """

    try:
        # Descobre tipo do dia
        day_type = DailyOverrideEngine.get_day_type(date)

        with Database() as db:
            # Busca rotina correspondente
            routine = db.fetchone("""
                SELECT id, name, day_type
                FROM daily_routines
                WHERE day_type = ?
                ORDER BY id DESC
                LIMIT 1
            """, (day_type,))

            if routine:
                routine = dict(routine)


            if not routine:
                return {"success": True, "data": None}

            # Busca blocos da rotina
            blocks = db.fetchall("""
    SELECT 
        id,
        name,
        start_time,
        end_time,
        category,
        is_locked,
        track_completion
    FROM daily_routine_blocks
    WHERE routine_id = ?
    ORDER BY start_time ASC
""", (routine["id"],))

            blocks = [dict(b) for b in blocks]


        return {
            "success": True,
            "data": {
                "routine": routine,
                "blocks": blocks
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/api/daily/{date}")
async def get_daily(date: str):
    try:
        data = DailyEngine.get_day(date)
        return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
