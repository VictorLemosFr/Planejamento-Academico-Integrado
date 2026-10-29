# Imagem única para a versão online: o FastAPI entrega a API e o site.

# 1) Build do React
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Mostra o aviso "use apenas dados fictícios" no login e na importação.
ENV VITE_PUBLIC_DEMO=true
RUN npm run build

# 2) API em Python
FROM python:3.13-slim
RUN pip install --no-cache-dir uv==0.11.32
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
COPY --from=web /web/dist ./static
ENV PATH="/app/.venv/bin:$PATH" \
    ENVIRONMENT=production \
    STATIC_DIR=/app/static
RUN useradd --create-home pai
USER pai
EXPOSE 10000
# Migrações e seed são idempotentes: rodam a cada início sem duplicar dados.
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --proxy-headers --forwarded-allow-ips='*'"]
