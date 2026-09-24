from fastapi.testclient import TestClient

from app.auth import AuthManager
from app.main import create_app


def auth_fixture(db_path) -> AuthManager:
    return AuthManager(
        db_path,
        seed_username="test.operator",
        seed_user_id="TEST-001",
        seed_password="Test-password1!",
        seed_display_name="Test Operator",
    )


def sign_in(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "test.operator", "user_id": "TEST-001", "password": "Test-password1!"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["user_id"] == "TEST-001"


def test_health_dashboard_rules_and_validation(tmp_path) -> None:
    db_path = tmp_path / "api.db"
    app = create_app(db_path, auto_start=False, auth_manager=auth_fixture(db_path))
    with TestClient(app) as client:
        assert client.get("/api/health").json() == {"status": "ok", "service": "icestream"}
        assert client.get("/api/dashboard").status_code == 401
        assert client.post(
            "/api/auth/login",
            json={"username": "test.operator", "user_id": "TEST-001", "password": "wrong"},
        ).status_code == 401
        sign_in(client)
        assert client.get("/api/auth/me").json()["user"]["username"] == "test.operator"
        dashboard = client.get("/api/dashboard")
        assert dashboard.status_code == 200
        assert dashboard.json()["circuit"] == "closed"
        assert len(client.get("/api/rules").json()) == 6

        invalid = client.post("/api/simulation/inject", json={"kind": "unknown", "count": 8})
        assert invalid.status_code == 422

        too_many = client.post("/api/simulation/inject", json={"kind": "null_tax", "count": 101})
        assert too_many.status_code == 422

        assert client.post("/api/auth/logout").json() == {"signed_out": True}
        assert client.get("/api/dashboard").status_code == 401


def test_missing_snapshot_returns_404(tmp_path) -> None:
    db_path = tmp_path / "api-404.db"
    app = create_app(db_path, auto_start=False, auth_manager=auth_fixture(db_path))
    with TestClient(app) as client:
        sign_in(client)
        response = client.get("/api/time-travel/999")
        assert response.status_code == 404
        assert response.json()["detail"] == "Snapshot not found"


def test_registration_is_unique_and_persists(tmp_path) -> None:
    db_path = tmp_path / "registration.db"
    app = create_app(db_path, auto_start=False, auth_manager=AuthManager(db_path))
    registration = {
        "display_name": "Lake Operator",
        "username": "lake.operator",
        "user_id": "LAKE-002",
        "password": "Lakehouse1!",
    }

    with TestClient(app) as client:
        weak_password = client.post(
            "/api/auth/register",
            json={**registration, "username": "weak.user", "user_id": "WEAK-002", "password": "short"},
        )
        assert weak_password.status_code == 422

        created = client.post("/api/auth/register", json=registration)
        assert created.status_code == 201
        assert created.json()["user"]["display_name"] == "Lake Operator"
        assert client.get("/api/auth/me").status_code == 200

        duplicate_username = client.post(
            "/api/auth/register",
            json={**registration, "user_id": "LAKE-003"},
        )
        assert duplicate_username.status_code == 409

        duplicate_user_id = client.post(
            "/api/auth/register",
            json={**registration, "username": "another.operator"},
        )
        assert duplicate_user_id.status_code == 409

        assert client.post("/api/auth/logout").status_code == 200
        assert client.post(
            "/api/auth/login",
            json={key: registration[key] for key in ("username", "user_id", "password")},
        ).status_code == 200

    restarted = create_app(db_path, auto_start=False, auth_manager=AuthManager(db_path))
    with TestClient(restarted) as client:
        login = client.post(
            "/api/auth/login",
            json={key: registration[key] for key in ("username", "user_id", "password")},
        )
        assert login.status_code == 200
        assert login.json()["user"]["user_id"] == "LAKE-002"
