from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .auth import AuthenticatedUser, AuthManager, RegistrationError, SESSION_COOKIE, SESSION_TTL
from .engine import StreamEngine
from .rules import RULES
from .storage import LakehouseStore


load_dotenv(Path(__file__).parents[2] / ".env", override=False)


class LoginRequest(BaseModel):
    username: str
    user_id: str
    password: str


class RegisterRequest(BaseModel):
    display_name: str
    username: str
    user_id: str
    password: str


class InjectionRequest(BaseModel):
    kind: str
    count: int = 8


class ConnectionHub:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.connections.discard(websocket)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for connection in self.connections:
            try:
                await connection.send_json(payload)
            except RuntimeError:
                stale.append(connection)
        for connection in stale:
            self.disconnect(connection)


def create_app(
    db_path: str | Path | None = None,
    auto_start: bool = True,
    auth_manager: AuthManager | None = None,
) -> FastAPI:
    database_path = Path(db_path or Path(__file__).parents[1] / "data" / "icestream.db")
    store = LakehouseStore(database_path)
    hub = ConnectionHub()
    engine = StreamEngine(store, hub.broadcast)
    auth = auth_manager or AuthManager.from_environment(database_path)

    def require_user(request: Request) -> AuthenticatedUser:
        user = auth.user_for_session(request.cookies.get(SESSION_COOKIE))
        if user is None:
            raise HTTPException(status_code=401, detail="Sign in to continue")
        return user

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if auto_start:
            engine.start_task()
        yield
        await engine.shutdown()
        auth.close()
        store.close()

    app = FastAPI(
        title="IceStream API",
        version="1.0.0",
        description="Local-first streaming observability and circuit-breaker service.",
        lifespan=lifespan,
    )
    app.state.engine = engine
    app.state.store = store
    app.state.auth = auth
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "icestream"}

    def set_session_cookie(response: Response, token: str) -> None:
        response.set_cookie(
            key=SESSION_COOKIE,
            value=token,
            max_age=int(SESSION_TTL.total_seconds()),
            httponly=True,
            secure=False,
            samesite="lax",
            path="/",
        )

    @app.post("/api/auth/login")
    async def login(credentials: LoginRequest, response: Response) -> dict[str, Any]:
        user = auth.authenticate(credentials.username, credentials.user_id, credentials.password)
        if user is None:
            raise HTTPException(status_code=401, detail="Username, user ID, or password is incorrect")
        set_session_cookie(response, auth.create_session(user))
        return {"user": user.public_dict()}

    @app.post("/api/auth/register", status_code=201)
    async def register(details: RegisterRequest, response: Response) -> dict[str, Any]:
        try:
            user = auth.register_user(
                details.display_name,
                details.username,
                details.user_id,
                details.password,
            )
        except RegistrationError as error:
            raise HTTPException(status_code=error.status_code, detail=str(error)) from error
        set_session_cookie(response, auth.create_session(user))
        return {"user": user.public_dict()}

    @app.get("/api/auth/me")
    async def current_user(user: AuthenticatedUser = Depends(require_user)) -> dict[str, Any]:
        return {"user": user.public_dict()}

    @app.post("/api/auth/logout")
    async def logout(request: Request, response: Response) -> dict[str, bool]:
        auth.revoke_session(request.cookies.get(SESSION_COOKIE))
        response.delete_cookie(SESSION_COOKIE, path="/", samesite="lax")
        return {"signed_out": True}

    @app.get("/api/dashboard")
    async def dashboard(_: AuthenticatedUser = Depends(require_user)) -> dict[str, Any]:
        return await engine.dashboard_payload()

    @app.get("/api/rules")
    async def rules(_: AuthenticatedUser = Depends(require_user)) -> list[dict[str, str]]:
        return [rule.public_dict() for rule in RULES]

    @app.get("/api/incidents")
    async def incidents(_: AuthenticatedUser = Depends(require_user)) -> list[dict[str, Any]]:
        return store.recent_incidents(50)

    @app.get("/api/snapshots")
    async def snapshots(_: AuthenticatedUser = Depends(require_user)) -> list[dict[str, Any]]:
        return store.list_snapshots(50)

    @app.get("/api/time-travel/{snapshot_id}")
    async def time_travel(snapshot_id: int, _: AuthenticatedUser = Depends(require_user)) -> dict[str, Any]:
        snapshot = store.snapshot(snapshot_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail="Snapshot not found")
        return snapshot

    @app.post("/api/simulation/start")
    async def start(_: AuthenticatedUser = Depends(require_user)) -> dict[str, bool]:
        engine.running = True
        return {"running": True}

    @app.post("/api/simulation/stop")
    async def stop(_: AuthenticatedUser = Depends(require_user)) -> dict[str, bool]:
        engine.running = False
        return {"running": False}

    @app.post("/api/simulation/inject")
    async def inject(request: InjectionRequest, _: AuthenticatedUser = Depends(require_user)) -> dict[str, Any]:
        if not 1 <= request.count <= 100:
            raise HTTPException(status_code=422, detail="count must be between 1 and 100")
        try:
            engine.queue_injection(request.kind, request.count)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        return {"queued": request.count, "kind": request.kind}

    @app.post("/api/circuit/reset")
    async def reset(_: AuthenticatedUser = Depends(require_user)) -> dict[str, str]:
        await engine.reset_circuit()
        return {"circuit": "closed"}

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        if auth.user_for_session(websocket.cookies.get(SESSION_COOKIE)) is None:
            await websocket.close(code=4401)
            return
        await hub.connect(websocket)
        await websocket.send_json(await engine.dashboard_payload(event="connected"))
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            hub.disconnect(websocket)

    return app


app = create_app(os.getenv("ICESTREAM_DB_PATH"))
