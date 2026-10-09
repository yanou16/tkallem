from fastapi import APIRouter, Body, Depends
from app.dependencies import get_current_user

router = APIRouter(tags=["app_support"])

_DEFAULT_PREFERENCES = {
    "notifications": {
        "practiceReminders": True,
        "groupActivity": True,
        "achievements": True,
        "productUpdates": False,
    },
    "ai": {
        "correctionStyle": "gentle",
        "voiceSpeed": "normal",
        "preferredTopics": [],
    },
}

_USER_PREFERENCES: dict[int, dict] = {}


@router.get("/api/groups/suggested")
def suggested_groups() -> list:
    return []


@router.get("/api/users/me/preferences")
def get_preferences(user: dict = Depends(get_current_user)) -> dict:
    return _USER_PREFERENCES.get(user["id"], _DEFAULT_PREFERENCES)


@router.patch("/api/users/me/preferences")
def update_preferences(
    body: dict = Body(...),
    user: dict = Depends(get_current_user),
) -> dict:
    current = _USER_PREFERENCES.get(user["id"], dict(_DEFAULT_PREFERENCES))
    if "notifications" in body:
        current["notifications"] = {**current["notifications"], **body["notifications"]}
    _USER_PREFERENCES[user["id"]] = current
    return current


@router.get("/api/users/me/achievements")
def achievements() -> list:
    return []


@router.get("/api/users/me/activity")
def activity() -> list:
    return []


@router.get("/api/notifications/unread-count")
def unread_count() -> dict[str, int]:
    return {"count": 0}


@router.post("/api/users/me/languages")
def add_language(
    body: dict = Body(...),
    user: dict = Depends(get_current_user),
) -> dict:
    return {"status": "ok", "language": body}


@router.post("/api/users/me/avatar")
def upload_avatar(
    user: dict = Depends(get_current_user),
) -> dict:
    return {
        "id": str(user["id"]),
        "firstName": user.get("first_name", "Student"),
        "email": user.get("email", ""),
        "avatarUrl": None,
        "learningLanguages": [],
    }
