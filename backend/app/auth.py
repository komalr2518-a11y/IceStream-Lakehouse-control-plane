from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import sqlite3
import threading
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path


SESSION_COOKIE = "icestream_session"
SESSION_TTL = timedelta(hours=8)
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9._-]{3,32}$")
USER_ID_PATTERN = re.compile(r"^[A-Za-z0-9-]{4,32}$")


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    user_id: str
    display_name: str

    def public_dict(self) -> dict[str, str]:
        return {
            "username": self.username,
            "user_id": self.user_id,
            "display_name": self.display_name,
        }


class RegistrationError(ValueError):
    def __init__(self, message: str, status_code: int = 422) -> None:
        super().__init__(message)
        self.status_code = status_code


class AuthManager:
    """SQLite-backed local accounts with memory-only revocable sessions."""

    def __init__(
        self,
        db_path: str | Path,
        seed_username: str = "",
        seed_user_id: str = "",
        seed_password: str = "",
        seed_display_name: str = "Axlero Operator",
    ) -> None:
        database_path = Path(db_path)
        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path, check_same_thread=False, timeout=10)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        self._sessions: dict[str, tuple[AuthenticatedUser, datetime]] = {}
        self._initialize_schema()

        if seed_username and seed_user_id and seed_password:
            self._seed_user(seed_display_name, seed_username, seed_user_id, seed_password)

    @classmethod
    def from_environment(cls, db_path: str | Path) -> "AuthManager":
        return cls(
            db_path=db_path,
            seed_username=os.environ.get("ICESTREAM_AUTH_USERNAME", ""),
            seed_user_id=os.environ.get("ICESTREAM_AUTH_USER_ID", ""),
            seed_password=os.environ.get("ICESTREAM_AUTH_PASSWORD", ""),
            seed_display_name=os.environ.get("ICESTREAM_AUTH_DISPLAY_NAME", "Axlero Operator"),
        )

    def _initialize_schema(self) -> None:
        with self._lock, self._connection:
            self._connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS auth_users (
                    auth_user_pk INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL COLLATE NOCASE,
                    user_id TEXT NOT NULL COLLATE NOCASE,
                    display_name TEXT NOT NULL,
                    password_salt BLOB NOT NULL,
                    password_hash BLOB NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username
                    ON auth_users(username COLLATE NOCASE);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_user_id
                    ON auth_users(user_id COLLATE NOCASE);
                PRAGMA optimize;
                """
            )

    @staticmethod
    def _hash_password(password: str, salt: bytes) -> bytes:
        return hashlib.scrypt(
            password.encode("utf-8"),
            salt=salt,
            n=2**14,
            r=8,
            p=1,
            dklen=32,
        )

    @staticmethod
    def _validate_registration(display_name: str, username: str, user_id: str, password: str) -> None:
        if not 2 <= len(display_name.strip()) <= 80:
            raise RegistrationError("Display name must be between 2 and 80 characters")
        if not USERNAME_PATTERN.fullmatch(username.strip()):
            raise RegistrationError("Username must be 3–32 characters using letters, numbers, dot, underscore, or hyphen")
        if not USER_ID_PATTERN.fullmatch(user_id.strip()):
            raise RegistrationError("User ID must be 4–32 characters using letters, numbers, or hyphens")
        if len(password) < 10:
            raise RegistrationError("Password must be at least 10 characters")
        if not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password):
            raise RegistrationError("Password must include uppercase and lowercase letters")
        if not re.search(r"\d", password) or not re.search(r"[^A-Za-z0-9]", password):
            raise RegistrationError("Password must include a number and a symbol")

    def _seed_user(self, display_name: str, username: str, user_id: str, password: str) -> None:
        with self._lock:
            existing = self._connection.execute(
                "SELECT 1 FROM auth_users WHERE username = ? COLLATE NOCASE OR user_id = ? COLLATE NOCASE",
                (username.strip(), user_id.strip()),
            ).fetchone()
            if existing is None:
                self._insert_user(display_name, username, user_id, password)

    def _insert_user(self, display_name: str, username: str, user_id: str, password: str) -> AuthenticatedUser:
        user = AuthenticatedUser(username.strip(), user_id.strip(), display_name.strip())
        salt = secrets.token_bytes(16)
        password_hash = self._hash_password(password, salt)
        with self._connection:
            self._connection.execute(
                """
                INSERT INTO auth_users (username, user_id, display_name, password_salt, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user.username, user.user_id, user.display_name, salt, password_hash, datetime.now(UTC).isoformat()),
            )
        return user

    def register_user(self, display_name: str, username: str, user_id: str, password: str) -> AuthenticatedUser:
        self._validate_registration(display_name, username, user_id, password)
        normalized_username = username.strip()
        normalized_user_id = user_id.strip()
        with self._lock:
            username_exists = self._connection.execute(
                "SELECT 1 FROM auth_users WHERE username = ? COLLATE NOCASE",
                (normalized_username,),
            ).fetchone()
            if username_exists is not None:
                raise RegistrationError("That username is already registered", status_code=409)
            user_id_exists = self._connection.execute(
                "SELECT 1 FROM auth_users WHERE user_id = ? COLLATE NOCASE",
                (normalized_user_id,),
            ).fetchone()
            if user_id_exists is not None:
                raise RegistrationError("That user ID is already registered", status_code=409)
            try:
                return self._insert_user(display_name, normalized_username, normalized_user_id, password)
            except sqlite3.IntegrityError as error:
                raise RegistrationError("Username or user ID is already registered", status_code=409) from error

    def authenticate(self, username: str, user_id: str, password: str) -> AuthenticatedUser | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT username, user_id, display_name, password_salt, password_hash
                FROM auth_users
                WHERE username = ? COLLATE NOCASE AND user_id = ? COLLATE NOCASE
                """,
                (username.strip(), user_id.strip()),
            ).fetchone()
        if row is None:
            return None
        candidate = self._hash_password(password, bytes(row["password_salt"]))
        if not hmac.compare_digest(candidate, bytes(row["password_hash"])):
            return None
        return AuthenticatedUser(row["username"], row["user_id"], row["display_name"])

    def create_session(self, user: AuthenticatedUser) -> str:
        with self._lock:
            self._remove_expired_sessions()
            token = secrets.token_urlsafe(32)
            self._sessions[token] = (user, datetime.now(UTC) + SESSION_TTL)
            return token

    def user_for_session(self, token: str | None) -> AuthenticatedUser | None:
        if not token:
            return None
        with self._lock:
            session = self._sessions.get(token)
            if session is None:
                return None
            user, expires_at = session
            if expires_at <= datetime.now(UTC):
                self._sessions.pop(token, None)
                return None
            return user

    def revoke_session(self, token: str | None) -> None:
        if token:
            with self._lock:
                self._sessions.pop(token, None)

    def _remove_expired_sessions(self) -> None:
        now = datetime.now(UTC)
        expired = [token for token, (_, expiry) in self._sessions.items() if expiry <= now]
        for token in expired:
            self._sessions.pop(token, None)

    def close(self) -> None:
        with self._lock:
            self._sessions.clear()
            self._connection.execute("PRAGMA optimize")
            self._connection.close()
