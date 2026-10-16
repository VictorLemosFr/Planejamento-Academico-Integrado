"""Local administrative CLI. Passwords are read only from an interactive prompt."""

import argparse
from getpass import getpass

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import engine
from app.modules.personal.models import LoginSession, Student, User
from app.modules.personal.security import passwords


def normalize_email(email):
    email = email.strip().lower()
    if len(email) > 254 or "@" not in email or not email.split("@")[0]:
        raise ValueError("E-mail inválido.")
    return email


def validate_password(password):
    if not 8 <= len(password) <= 1024:
        raise ValueError("A senha deve conter entre 8 e 1024 caracteres.")


def provision(session, email, password, role, registration=None, current_period=1):
    email = normalize_email(email)
    validate_password(password)
    if role not in {"student", "coordination"}:
        raise ValueError("Papel inválido.")
    if not 1 <= current_period <= 20:
        raise ValueError("Período deve estar entre 1 e 20.")
    if role == "student" and (not registration or not registration.strip()):
        raise ValueError("Estudantes exigem matrícula.")
    if registration and len(registration) > 80:
        raise ValueError("Matrícula deve ter até 80 caracteres.")
    if role == "coordination" and registration:
        raise ValueError("Contas da coordenação não possuem matrícula.")
    user = User(email=email, password_hash=passwords.hash(password), role=role)
    session.add(user)
    session.flush()
    if role == "student":
        session.add(
            Student(
                user_id=user.id, registration=registration.strip(), current_period=current_period
            )
        )
    session.commit()


def find_user(session, email):
    user = session.scalar(
        select(User).where(User.email == normalize_email(email)).with_for_update()
    )
    if user is None:
        raise ValueError("Conta não encontrada.")
    return user


def revoke_sessions(session, user):
    session.execute(delete(LoginSession).where(LoginSession.user_id == user.id))


def reset_password(session, email, password):
    validate_password(password)
    user = find_user(session, email)
    user.password_hash = passwords.hash(password)
    revoke_sessions(session, user)
    session.commit()


def deactivate(session, email):
    user = find_user(session, email)
    user.active = False
    revoke_sessions(session, user)
    session.commit()


def prompted_password():
    password = getpass("Senha: ")
    if password != getpass("Confirme a senha: "):
        raise ValueError("As senhas não coincidem.")
    return password


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create")
    create.add_argument("--email", required=True)
    create.add_argument("--role", choices=["student", "coordination"], required=True)
    create.add_argument("--registration")
    create.add_argument("--current-period", type=int, default=1)
    for command in ["reset-password", "deactivate"]:
        commands.add_parser(command).add_argument("--email", required=True)
    args = parser.parse_args()
    try:
        with Session(engine) as session:
            if args.command == "create":
                provision(
                    session,
                    args.email,
                    prompted_password(),
                    args.role,
                    args.registration,
                    args.current_period,
                )
            elif args.command == "reset-password":
                reset_password(session, args.email, prompted_password())
            else:
                deactivate(session, args.email)
    except ValueError as error:
        parser.exit(1, f"{error}\n")
    except IntegrityError:
        parser.exit(1, "E-mail ou matrícula já provisionados.\n")
    except SQLAlchemyError:
        parser.exit(1, "Banco indisponível; verifique conexão e migrações.\n")
    print("Operação concluída.")


if __name__ == "__main__":
    main()
