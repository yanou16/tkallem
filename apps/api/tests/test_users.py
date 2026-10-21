import psycopg
import pytest

from app.db.users import get_by_clerk_id, get_or_create_by_clerk_id, update_profile


def test_creates_user_on_first_visit(db):
    user = get_or_create_by_clerk_id(db, "user_test_1")

    assert user["clerk_user_id"] == "user_test_1"
    assert user["explain_lang"] == "en"  # a new profile is explained in English: the jury may read English only
    assert user["level"] is None
    assert user["first_name"] is None


def test_returns_same_user_on_next_visit(db):
    first = get_or_create_by_clerk_id(db, "user_test_2")
    second = get_or_create_by_clerk_id(db, "user_test_2")

    assert second["id"] == first["id"]


def test_unknown_user_returns_none(db):
    assert get_by_clerk_id(db, "user_does_not_exist") is None


def test_update_profile_changes_only_given_fields(db):
    user = get_or_create_by_clerk_id(db, "user_test_3")

    updated = update_profile(db, user["id"], {"level": "B1"})

    assert updated["level"] == "B1"
    assert updated["explain_lang"] == "en"
    assert updated["id"] == user["id"]


def test_update_profile_both_fields(db):
    user = get_or_create_by_clerk_id(db, "user_test_4")

    updated = update_profile(db, user["id"], {"level": "C1", "explain_lang": "en"})

    assert updated["level"] == "C1"
    assert updated["explain_lang"] == "en"


def test_update_profile_rejects_forbidden_column(db):
    user = get_or_create_by_clerk_id(db, "user_test_5")

    with pytest.raises(ValueError):
        update_profile(db, user["id"], {"clerk_user_id": "someone_else"})


def test_update_profile_rejects_empty_changes(db):
    user = get_or_create_by_clerk_id(db, "user_test_6")

    with pytest.raises(ValueError):
        update_profile(db, user["id"], {})


def test_database_rejects_invalid_level(db):
    user = get_or_create_by_clerk_id(db, "user_test_7")

    with pytest.raises(psycopg.errors.CheckViolation):
        update_profile(db, user["id"], {"level": "Z9"})