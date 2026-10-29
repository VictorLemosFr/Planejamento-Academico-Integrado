"""Entrega o build do React pela própria API (deploy em um único serviço).

Rotas fora de /api devolvem o arquivo pedido, se existir, ou o index.html, para
que o React Router resolva endereços como /grades e /compartilhado/<token>.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse


def mount_frontend(app: FastAPI, directory: Path) -> None:
    root = directory.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"Build do frontend não encontrado em {root}.")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            # Arquivos em assets/ têm hash no nome e podem ficar em cache.
            cache = (
                "public, max-age=31536000, immutable"
                if path.startswith("assets/")
                else "public, max-age=3600"
            )
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
