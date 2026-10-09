from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api import router

app = FastAPI(title="Planejamento Acadêmico Integrado", version="0.1.0")
app.include_router(router)


@app.exception_handler(SQLAlchemyError)
def database_error(request, exception):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Não foi possível consultar o banco. Verifique a conexão e as migrações."
        },
    )
