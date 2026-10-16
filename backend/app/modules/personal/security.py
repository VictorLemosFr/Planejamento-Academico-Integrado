from datetime import UTC, datetime
from hashlib import sha256
from secrets import compare_digest
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_session
from app.modules.personal.models import LoginSession, User

passwords = PasswordHash.recommended()
DUMMY_HASH = passwords.hash("timing-only-not-a-user-password")
COOKIE = "pai_session"
Database = Annotated[Session, Depends(get_session)]


def token_hash(token):
    return sha256(token.encode()).hexdigest()


def require_origin(request: Request):
    if request.headers.get("origin") not in get_settings().allowed_origins:
        raise HTTPException(403, "Origem não permitida.")


def identity(request: Request, session: Database):
    login = session.get(LoginSession, token_hash(request.cookies.get(COOKIE, "")))
    if login is None:
        raise HTTPException(401, "Sessão expirada. Entre novamente.")
    expires = (
        login.expires_at.replace(tzinfo=UTC) if not login.expires_at.tzinfo else login.expires_at
    )
    user = session.scalar(select(User).where(User.id == login.user_id))
    if expires <= datetime.now(UTC) or user is None or not user.active:
        raise HTTPException(401, "Sessão expirada. Entre novamente.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        require_origin(request)
        if not compare_digest(request.headers.get("x-csrf-token", ""), login.csrf_token):
            raise HTTPException(403, "Token CSRF inválido.")
    return user, login


Identity = Annotated[tuple[User, LoginSession], Depends(identity)]
