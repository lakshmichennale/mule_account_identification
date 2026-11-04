"""Enterprise Authentication & Role-Based Access Control (RBAC) service.
Uses standard library hashlib.pbkdf2_hmac (SHA-256 with 600,000 iterations)
and PyJWT for cryptographically signed tokens.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import sqlite3
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sentinel.db"
SECRET_KEY = os.getenv("SENTINEL_JWT_SECRET", "sentinel-super-secure-fraud-intel-platform-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12  # 12 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token", auto_error=False)


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_auth_db() -> None:
    """Initialize user table and seed initial secure accounts if empty."""
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('ADMIN', 'FRAUD_ANALYST')),
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                last_login TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_email TEXT NOT NULL,
                action TEXT NOT NULL,
                resource TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                timestamp TEXT NOT NULL
            )
            """
        )
        conn.commit()

        # Check if any user exists; if none, seed default initial accounts
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            now = datetime.now(timezone.utc).isoformat()
            # Default administrator
            admin_hash = hash_password("Admin@Sentinel2026!")
            analyst_hash = hash_password("Analyst@Sentinel2026!")
            
            conn.execute(
                """
                INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """,
                ("admin@sentinel.bank", admin_hash, "System Administrator", "ADMIN", now),
            )
            conn.execute(
                """
                INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
                VALUES (?, ?, ?, ?, 1, ?)
                """,
                ("analyst@sentinel.bank", analyst_hash, "Lead Fraud Analyst", "FRAUD_ANALYST", now),
            )
            conn.commit()


def hash_password(password: str) -> str:
    """Hash password using PBKDF2-HMAC-SHA256 with 600,000 iterations and random salt."""
    salt = secrets.token_bytes(32)
    iterations = 600_000
    hash_bytes = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(hash_bytes).decode("ascii")
    return f"pbkdf2_sha256${iterations}${salt_b64}${hash_b64}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    """Verify password against stored PBKDF2 hash using constant-time comparison."""
    try:
        parts = stored_hash.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = base64.b64decode(parts[2].encode("ascii"))
        expected_hash = base64.b64decode(parts[3].encode("ascii"))
        computed_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(computed_hash, expected_hash)
    except Exception:
        return False


def create_access_token(data: dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def authenticate_user(email: str, password: str) -> Optional[dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = ?",
            (email.strip(),),
        )
        row = cursor.fetchone()
        if not row:
            return None
        if not bool(row["is_active"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated. Contact an administrator.",
            )
        if not verify_password(password, row["password_hash"]):
            return None

        # Update last login
        now = datetime.now(timezone.utc).isoformat()
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, row["id"]))
        conn.commit()

        return {
            "id": row["id"],
            "email": row["email"],
            "fullName": row["full_name"],
            "role": row["role"],
            "isActive": bool(row["is_active"]),
        }


def log_audit_event(user_email: str, action: str, resource: str, details: str = "", ip: str = "") -> None:
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO audit_logs (user_email, action, resource, details, ip_address, timestamp)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_email, action, resource, details, ip, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
    except Exception:
        pass


def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict[str, Any]:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
        )

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, full_name, role, is_active FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row or not bool(row["is_active"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account no longer exists or is inactive.",
            )
        return {
            "id": row["id"],
            "email": row["email"],
            "fullName": row["full_name"],
            "role": row["role"],
            "isActive": bool(row["is_active"]),
        }


def require_role(allowed_roles: list[str]):
    def role_checker(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}.",
            )
        return current_user

    return role_checker
