"""User Management and RBAC Administration service for SENTINEL."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from backend.services.auth_service import (
    get_db_connection,
    hash_password,
    log_audit_event,
)


def get_user_management_stats() -> dict[str, int]:
    """Retrieve aggregate user counts for the administrative dashboard."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        total = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1")
        active_admins = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'FRAUD_ANALYST' AND is_active = 1")
        active_analysts = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM users WHERE is_active = 0")
        deactivated = cursor.fetchone()[0]

        return {
            "totalUsers": total,
            "activeAdmins": active_admins,
            "activeAnalysts": active_analysts,
            "deactivatedUsers": deactivated,
        }


def query_users(
    search: str | None = None,
    role: str | None = None,
    status_filter: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict[str, Any]:
    """Query paginated users with optional search and role/status filters."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        conditions = []
        params = []

        if search:
            conditions.append("(email LIKE ? OR full_name LIKE ?)")
            s_param = f"%{search.strip()}%"
            params.extend([s_param, s_param])

        if role and role.upper() in {"ADMIN", "FRAUD_ANALYST"}:
            conditions.append("role = ?")
            params.append(role.upper())

        if status_filter:
            if status_filter.lower() == "active":
                conditions.append("is_active = 1")
            elif status_filter.lower() == "deactivated":
                conditions.append("is_active = 0")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        cursor.execute(f"SELECT COUNT(*) FROM users {where_clause}", params)
        total = cursor.fetchone()[0]

        offset = (page - 1) * page_size
        query = f"""
            SELECT id, email, full_name, role, is_active, created_at, last_login
            FROM users
            {where_clause}
            ORDER BY id ASC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [page_size, offset])
        rows = cursor.fetchall()

        users = [
            {
                "id": r["id"],
                "email": r["email"],
                "fullName": r["full_name"],
                "role": r["role"],
                "isActive": bool(r["is_active"]),
                "createdAt": r["created_at"],
                "lastLogin": r["last_login"],
            }
            for r in rows
        ]

        return {
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": max(1, (total + page_size - 1) // page_size),
            "users": users,
            "stats": get_user_management_stats(),
        }


def create_new_user(
    email: str,
    password: str,
    full_name: str,
    role: str,
    actor_email: str,
) -> dict[str, Any]:
    """Create a new user with PBKDF2 hashed credentials and record audit event."""
    email_clean = email.strip().lower()
    if not re.match(r"^[^@]+@[^@]+\.[^@]+$", email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email address format.",
        )

    if role not in {"ADMIN", "FRAUD_ANALYST"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be either ADMIN or FRAUD_ANALYST.",
        )

    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters in length.",
        )

    pw_hash = hash_password(password)
    now = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{email_clean}' already exists.",
            )

        cursor.execute(
            """
            INSERT INTO users (email, password_hash, full_name, role, is_active, created_at)
            VALUES (?, ?, ?, ?, 1, ?)
            """,
            (email_clean, pw_hash, full_name.strip(), role, now),
        )
        new_id = cursor.lastrowid
        conn.commit()

    log_audit_event(
        user_email=actor_email,
        action="USER_CREATED",
        resource="user_management",
        details=f"Created user '{email_clean}' with role '{role}' (ID: {new_id})",
    )

    return {
        "status": "ok",
        "message": f"User '{email_clean}' created successfully.",
        "user": {
            "id": new_id,
            "email": email_clean,
            "fullName": full_name.strip(),
            "role": role,
            "isActive": True,
            "createdAt": now,
            "lastLogin": None,
        },
    }


def update_existing_user(
    user_id: int,
    full_name: str | None,
    role: str | None,
    is_active: bool | None,
    actor_email: str,
) -> dict[str, Any]:
    """Modify user attributes, role, or active status with safety checks against last admin deactivation."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, full_name, role, is_active FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        current_email = row["email"]
        current_role = row["role"]
        current_active = bool(row["is_active"])

        # Safety Check: Prevent deactivating or demoting the last active ADMIN
        if (role and role != "ADMIN" and current_role == "ADMIN") or (is_active is False and current_active):
            cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = 1")
            admin_count = cursor.fetchone()[0]
            if admin_count <= 1 and current_role == "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot de-escalate or deactivate the last active system administrator.",
                )

        new_name = full_name.strip() if full_name is not None else row["full_name"]
        new_role = role if role in {"ADMIN", "FRAUD_ANALYST"} else row["role"]
        new_active = int(is_active) if is_active is not None else row["is_active"]

        conn.execute(
            "UPDATE users SET full_name = ?, role = ?, is_active = ? WHERE id = ?",
            (new_name, new_role, new_active, user_id),
        )
        conn.commit()

    changes = []
    if full_name and full_name != row["full_name"]:
        changes.append(f"name: '{row['full_name']}' -> '{new_name}'")
    if role and role != row["role"]:
        changes.append(f"role: '{row['role']}' -> '{new_role}'")
    if is_active is not None and is_active != current_active:
        changes.append(f"status: {'ACTIVE' if is_active else 'DEACTIVATED'}")

    log_audit_event(
        user_email=actor_email,
        action="USER_UPDATED",
        resource="user_management",
        details=f"Updated user '{current_email}': {', '.join(changes) if changes else 'no change'}",
    )

    return {
        "status": "ok",
        "message": f"User '{current_email}' updated successfully.",
        "user": {
            "id": user_id,
            "email": current_email,
            "fullName": new_name,
            "role": new_role,
            "isActive": bool(new_active),
        },
    }


def admin_reset_user_password(
    user_id: int,
    new_password: str,
    actor_email: str,
) -> dict[str, Any]:
    """Administratively reset a user's password with PBKDF2 hashing."""
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters in length.",
        )

    pw_hash = hash_password(new_password)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

        user_email = row["email"]
        conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (pw_hash, user_id))
        conn.commit()

    log_audit_event(
        user_email=actor_email,
        action="ADMIN_PASSWORD_RESET",
        resource="user_management",
        details=f"Administratively reset credentials for '{user_email}'",
    )

    return {
        "status": "ok",
        "message": f"Password for '{user_email}' reset successfully.",
    }
