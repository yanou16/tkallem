from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("")
def list_groups(user: dict = Depends(get_current_user)) -> list[dict]:
    # No groups in DB: return empty list to trigger frontend EmptyState
    return []


@router.get("/suggested")
def list_suggested_groups(user: dict = Depends(get_current_user)) -> list[dict]:
    return []


@router.get("/sessions/upcoming")
def list_upcoming_sessions(user: dict = Depends(get_current_user)) -> list[dict]:
    return []


@router.get("/topics/active")
def list_active_topics(user: dict = Depends(get_current_user)) -> list[dict]:
    return []


@router.get("/{group_id}")
def get_group_detail(group_id: str, user: dict = Depends(get_current_user)) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")


@router.post("/{group_id}/join")
def join_group(group_id: str, user: dict = Depends(get_current_user)) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")


@router.post("/{group_id}/leave")
def leave_group(group_id: str, user: dict = Depends(get_current_user)) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")


@router.get("/{group_id}/posts")
def get_group_posts(group_id: str, user: dict = Depends(get_current_user)) -> list[dict]:
    return []


@router.post("/{group_id}/posts")
def create_group_post(
    group_id: str,
    body: dict,
    user: dict = Depends(get_current_user),
) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")


@router.post("/{group_id}/posts/{post_id}/like")
def like_group_post(
    group_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")


@router.get("/{group_id}/sessions")
def get_group_sessions(group_id: str, user: dict = Depends(get_current_user)) -> list[dict]:
    return []


@router.post("/{group_id}/sessions/{session_id}/reminder")
def set_session_reminder(
    group_id: str,
    session_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
