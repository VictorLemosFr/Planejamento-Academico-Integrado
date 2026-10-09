from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api import router
from app.modules.personal.api import router as personal_router

app = FastAPI(title="Planejamento Acadêmico Integrado", version="0.1.0")
app.include_router(router)
app.include_router(personal_router)


@app.middleware("http")
async def private_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(SQLAlchemyError)
def database_error(request, exception):
    return JSONResponse(
        status_code=503,
        content={
            "detail": "Não foi possível consultar o banco. Verifique a conexão e as migrações."
        },
    )
