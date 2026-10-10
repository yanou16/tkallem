import io
import json
import hashlib
import hmac
import time
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from psycopg import Connection

from app.config import settings
from app.db.connection import get_conn
from app.db.users import DB_UPDATABLE_COLUMNS, USER_COLUMNS, update_profile
from app.dependencies import get_current_user

router = APIRouter(tags=["user-profile"])


# ── Preferences (stored in DB `preferences` JSONB column) ────────────────────

def _get_prefs(user: dict) -> dict:
    raw = user.get("preferences") or {}
    if isinstance(raw, str):
        raw = json.loads(raw)
    return {
        "notifications": {
            "practiceReminders": raw.get("notifications", {}).get("practiceReminders", False),
            "groupActivity": raw.get("notifications", {}).get("groupActivity", False),
            "achievements": raw.get("notifications", {}).get("achievements", False),
            "productUpdates": raw.get("notifications", {}).get("productUpdates", False),
        },
        "ai": {
            "correctionStyle": raw.get("ai", {}).get("correctionStyle", None),
            "voiceSpeed": raw.get("ai", {}).get("voiceSpeed", None),
            "preferredTopics": raw.get("ai", {}).get("preferredTopics", []),
        },
    }


@router.get("/api/users/me/preferences")
def get_user_preferences(
    user: dict = Depends(get_current_user),
) -> dict:
    return _get_prefs(user)


@router.patch("/api/users/me/preferences")
def update_user_preferences(
    body: dict,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    prefs = _get_prefs(user)
    if "notifications" in body and isinstance(body["notifications"], dict):
        prefs["notifications"].update(body["notifications"])
    if "ai" in body and isinstance(body["ai"], dict):
        prefs["ai"].update(body["ai"])
    update_profile(conn, user["id"], {"preferences": prefs})
    return prefs


# ── Achievements (computed from real DB data) ─────────────────────────────────

@router.get("/api/users/me/achievements")
def get_user_achievements(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS total_sessions,
            COUNT(*) FILTER (WHERE ended_at IS NOT NULL) AS completed_sessions,
            COUNT(DISTINCT DATE(started_at AT TIME ZONE 'Africa/Algiers')) AS days_practiced
        FROM practice_sessions
        WHERE user_id = %s
        """,
        (user["id"],),
    ).fetchone()

    completed = row["completed_sessions"] if row else 0
    days = row["days_practiced"] if row else 0

    achievements = []
    if completed >= 1:
        achievements.append({
            "id": "first-session",
            "title": "First Session",
            "description": "Completed your first speaking session",
            "icon": "sparkles",
        })
    if days >= 3:
        achievements.append({
            "id": "streak-3",
            "title": "3-Day Streak",
            "description": "Practiced 3 different days",
            "icon": "flame",
        })
    if completed >= 5:
        achievements.append({
            "id": "regular-speaker",
            "title": "Regular Speaker",
            "description": "Completed 5 sessions",
            "icon": "trophy",
        })
    if days >= 7:
        achievements.append({
            "id": "week-streak",
            "title": "Week Warrior",
            "description": "Practiced for 7 different days",
            "icon": "star",
        })
    return achievements


# ── Activity (real sessions from DB) ─────────────────────────────────────────

@router.get("/api/users/me/activity")
def get_user_activity(
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, scenario_id, started_at, ended_at
        FROM practice_sessions
        WHERE user_id = %s
        ORDER BY started_at DESC
        LIMIT 5
        """,
        (user["id"],),
    ).fetchall()

    return [
        {
            "id": str(r["id"]),
            "title": f"Practiced {r['scenario_id'].replace('-', ' ').title()}",
            "detail": "Completed session" if r["ended_at"] else "Session started",
            "createdAt": r["started_at"].isoformat(),
            "icon": "messageSquare",
        }
        for r in rows
    ]


# ── Avatar upload → Cloudinary ────────────────────────────────────────────────

def _cloudinary_sign(params: dict, api_secret: str) -> str:
    """Compute Cloudinary signature over sorted key=value pairs."""
    to_sign = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hashlib.sha256(f"{to_sign}{api_secret}".encode()).hexdigest()


@router.post("/api/users/me/avatar")
async def upload_user_avatar(
    avatar: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    if not settings.cloudinary_cloud_name or not settings.cloudinary_api_key or not settings.cloudinary_api_secret:
        raise HTTPException(
            status.HTTP_501_NOT_IMPLEMENTED,
            "Avatar upload requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env",
        )

    if avatar.size and avatar.size > 5 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File exceeds 5 MB limit")

    ts = int(time.time())
    public_id = f"tkallem/avatars/user_{user['id']}"
    sign_params = {
        "public_id": public_id,
        "timestamp": ts,
        "overwrite": "true",
    }
    signature = _cloudinary_sign(sign_params, settings.cloudinary_api_secret)

    file_bytes = await avatar.read()
    upload_url = f"https://api.cloudinary.com/v1_1/{settings.cloudinary_cloud_name}/image/upload"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            upload_url,
            data={
                "api_key": settings.cloudinary_api_key,
                "timestamp": ts,
                "public_id": public_id,
                "overwrite": "true",
                "signature": signature,
            },
            files={"file": (avatar.filename or "avatar.jpg", io.BytesIO(file_bytes), avatar.content_type)},
            timeout=30,
        )

    if resp.status_code != 200:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Cloudinary upload failed: {resp.text}")

    cloudinary_url = resp.json().get("secure_url")
    updated = update_profile(conn, user["id"], {"avatar_url": cloudinary_url})
    return updated


# ── Languages ─────────────────────────────────────────────────────────────────

@router.post("/api/users/me/languages")
def add_user_language(
    body: dict,
    user: dict = Depends(get_current_user),
    conn: Connection = Depends(get_conn),
) -> dict:
    raw = user.get("learning_languages") or []
    if isinstance(raw, str):
        raw = json.loads(raw)
    langs: list[dict] = list(raw)

    new_lang = {
        "id": body.get("code", "en"),
        "code": body.get("code", "en"),
        "name": body.get("name", body.get("code", "en").upper()),
        "level": body.get("level", "B1"),
    }
    langs = [l for l in langs if l.get("code") != new_lang["code"]]
    langs.append(new_lang)

    update_profile(conn, user["id"], {"learning_languages": langs})
    return {"status": "ok", "language": new_lang}


# ── Notifications unread count ────────────────────────────────────────────────

@router.get("/api/notifications/unread-count")
def get_unread_notifications_count(
    user: dict = Depends(get_current_user),
) -> dict:
    return {"count": 0}
