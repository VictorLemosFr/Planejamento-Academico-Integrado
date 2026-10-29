"""Configuração de deploy: URL do banco, origem pública e site servido pela API."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.frontend import mount_frontend


@pytest.mark.parametrize(
    "given",
    ["postgres://u:p@host:5432/pai", "postgresql://u:p@host:5432/pai"],
)
def test_provider_database_url_uses_psycopg(given):
    settings = Settings(_env_file=None, database_url=given)
    assert settings.database_url == "postgresql+psycopg://u:p@host:5432/pai"


def test_explicit_driver_is_kept():
    url = "postgresql+psycopg://pai:pai@127.0.0.1:54329/pai"
    assert Settings(_env_file=None, database_url=url).database_url == url


def test_public_url_becomes_allowed_origin():
    settings = Settings(_env_file=None, render_external_url="https://pai.onrender.com/")
    assert "https://pai.onrender.com" in settings.allowed_origins
    assert "http://localhost:5173" in settings.allowed_origins


@pytest.fixture
def site(tmp_path):
    (tmp_path / "index.html").write_text("<div id=root></div>")
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "app-1a2b.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path.parent / "secret.txt").write_text("nao")
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    mount_frontend(app, tmp_path)
    return TestClient(app)


def test_spa_routes_fall_back_to_index(site):
    for path in ("/", "/grades", "/compartilhado/abc", "/sugestoes"):
        response = site.get(path)
        assert response.status_code == 200
        assert "id=root" in response.text
        assert response.headers["cache-control"] == "no-cache"


def test_static_files_and_api_are_not_swallowed(site):
    asset = site.get("/assets/app-1a2b.js")
    assert asset.status_code == 200 and "immutable" in asset.headers["cache-control"]
    assert site.get("/favicon.svg").text == "<svg/>"
    assert site.get("/api/health").json() == {"status": "ok"}
    assert site.get("/api/nao-existe").status_code == 404


def test_paths_outside_build_are_not_served(site):
    response = site.get("/..%2Fsecret.txt")
    assert "nao" not in response.text
