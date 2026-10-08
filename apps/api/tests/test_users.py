from app.db.users import get_by_clerk_id, get_or_create_by_clerk_id


def test_creates_user_on_first_visit(db):
    user = get_or_create_by_clerk_id(db, "user_test_1")

    assert user["clerk_user_id"] == "user_test_1"
    assert user["explain_lang"] == "fr"
    assert user["level"] is None
    assert user["first_name"] is None


def test_returns_same_user_on_next_visit(db):
    first = get_or_create_by_clerk_id(db, "user_test_2")
    second = get_or_create_by_clerk_id(db, "user_test_2")

    assert second["id"] == first["id"]


def test_unknown_user_returns_none(db):
    assert get_by_clerk_id(db, "user_does_not_exist") is None