# Planejamento Acadêmico Integrado

Ferramenta de apoio à decisão para o estudante visualizar sua progressão acadêmica, simular cenários e planejar sua trajetória até a conclusão do curso. O SIGAA permanece responsável pelo histórico oficial e pela efetivação da matrícula.

Projeto da disciplina **Integração e Evolução de Sistemas de Informação (IESI)**, com orientação do **Prof. Paulemir Gonçalves Campos**.

## Estado atual

A primeira implementação conecta um mapa curricular em React a uma API FastAPI e a uma grade persistida no PostgreSQL. Inclui 56 disciplinas e quatro cenários demonstrativos extraídos do protótipo.

- Mapa curricular por período, eletivas, busca e filtros de situação.
- Consulta de pré-requisitos, dependentes e disciplinas críticas.
- Planejamento do próximo semestre com carga horária total.
- Simulação de aprovação, remoção de planejamento e restauração de cenários.
- Validação das regras no backend; desfazer uma aprovação remove conclusões e planos dependentes.
- Interface responsiva com Tailwind CSS e tratamento de erros da API.

A grade é persistida; os cenários são demonstrações locais e as alterações do plano existem apenas na sessão do navegador. Autenticação, histórico real, planos salvos, oferta, administração, importação do SIGAA e previsão de conclusão ainda não estão implementados. O protótipo HTML original permanece preservado em `prototipo/`.

## Stack

| Parte | Tecnologias |
| --- | --- |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy, Psycopg |
| Dados | PostgreSQL e migrações Alembic |
| Qualidade | pytest, Playwright, Ruff, Prettier e verificação TypeScript |
| Dependências | uv no backend, npm no frontend, com arquivos de lock versionáveis |

## Executar a aplicação

Requisitos: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node.js 22.12+ com npm e Docker com Compose. O Docker precisa estar ativo. As credenciais do Compose são apenas para desenvolvimento local; a porta do banco é exposta em `127.0.0.1:54329`.

Na raiz do projeto, inicie o banco:

```sh
docker compose up -d db
```

Em um terminal, prepare e inicie a API:

```sh
cd backend
uv sync --python 3.12
cp .env.example .env
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

O seed insere os dados demonstrativos ausentes, sem substituir registros existentes. Não o utilize como rotina de atualização de uma grade oficial. A API oferece documentação interativa em `http://127.0.0.1:8000/docs`.

Em outro terminal, inicie o frontend:

```sh
cd frontend
npm ci
npm run dev
```

Acesse **http://127.0.0.1:5173**. O Vite encaminha `/api` para o FastAPI na porta 8000, evitando configuração adicional de CORS no desenvolvimento. Para usar um PostgreSQL já instalado, ajuste `DATABASE_URL` em `backend/.env` e execute as mesmas migrações e seed.

Encerre API e frontend com `Ctrl+C`. Pare o banco com `docker compose stop db`; os dados permanecem no volume.

## Verificação

Backend, sem exigir um banco externo para os testes isolados:

```sh
cd backend
uv run pytest
uv run ruff check
uv run ruff format --check
```

Frontend:

```sh
cd frontend
npm run build
npm run format:check
npx playwright install chromium
npm test
```

Os testes de navegador exigem a API em execução com a grade demonstrativa carregada. O Playwright inicia o Vite automaticamente. As regras de domínio são verificadas sem banco; os testes isolados da API usam SQLite em memória; os testes de navegador usam o banco configurado na API.

Na validação inicial, passaram 21 testes do backend e quatro fluxos de navegador, além do build, Ruff e Prettier. Migrações, seed e comunicação com o banco foram exercitados em uma instância temporária de PostgreSQL/WASM (PGlite), porque o Docker não estava ativo e o sandbox impediu o PostgreSQL nativo. O Compose passou na validação de configuração; sua execução com PostgreSQL nativo ainda precisa ser verificada. PGlite não é uma dependência do projeto nem a escolha de banco para produção.

## Executar somente o protótipo original

Abra [prototipo/index.html](prototipo/index.html) diretamente em um navegador. Esse arquivo reúne HTML, CSS, JavaScript e dados; não exige instalação de dependências.

## Documentação

- [Arquitetura e stack](docs/arquitetura.md): proposta, diagramas C4 e decisões técnicas da primeira implementação.
- [Escopo e requisitos](docs/escopo.md): capacidades, limites e decisões pendentes.
- [Guia do protótipo](docs/prototipo.md): comportamento e limitações do HTML original.
- [API](docs/api.md): rotas e contrato da simulação.

## Organização

```text
backend/
  app/
    core/                  # configuração e acesso ao banco
    data/                  # dados demonstrativos do protótipo
    modules/
      curriculum/          # entidades e leitura da grade
      constraints/         # grafo e pré-requisitos
      progression/         # estados acadêmicos derivados
      planning/            # simulação e contratos
  alembic/                 # migrações de esquema
  tests/
frontend/
  src/components/          # mapa, cards e detalhes
  tests/                   # fluxos de navegador
docs/
prototipo/
compose.yaml
```

O backend segue um monolito modular. Oferta e Administrativo serão adicionados quando seus fluxos forem implementados. Provedor de hospedagem e configuração de produção ainda não foram escolhidos.

## Licença

[MIT](LICENSE).
