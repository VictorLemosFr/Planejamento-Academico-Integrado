# Planejamento Acadêmico Integrado

Ferramenta de apoio à decisão para o estudante visualizar sua progressão acadêmica, simular cenários e planejar sua trajetória até a conclusão do curso. O SIGAA permanece responsável pelo histórico oficial e pela efetivação da matrícula.

Projeto da disciplina **Integração e Evolução de Sistemas de Informação (IESI)**, com orientação do **Prof. Paulemir Gonçalves Campos**.

## Estado atual

A aplicação entrega **cadastro ou login → histórico informado pelo estudante → progressão → simulação → plano salvo → recuperação após novo acesso**, com dados pessoais no PostgreSQL.

- Mapa curricular por período, busca, filtros e detalhes de pré-requisitos.
- Distribuição de cards por arraste, ordem e eletivas dentro do mapa, salva por alternativa; controles de movimentação também disponíveis no celular.
- Disciplinas aprovadas, em andamento e reprovadas informadas pelo estudante; aprovações hipotéticas ficam separadas nos planos.
- Edição do próprio histórico por disciplina e semestre, transacional, versionada e idempotente. A importação JSON pela coordenação permanece para contas provisionadas anteriormente.
- Várias alternativas para um semestre, com rascunhos locais, salvamento explícito, renomeação e exclusão.
- Controle de versão para evitar sobrescritas; novas importações revalidam planos sem apagar escolhas.
- Sessões opacas de oito horas, senhas Argon2, proteção de origem/CSRF e isolamento por estudante.
- Cadastro público de estudantes com escolha entre CC, SI, IA e EC, semestre de ingresso e período atual, sem aprovação manual da matrícula.

A grade de 56 disciplinas de SI continua demonstrativa. Foram transcritas as matrizes públicas atuais do CIn para CC (101 disciplinas), IA (70) e EC (147), incluindo obrigatórias e eletivas. CC e EC atendem ingressantes desde 2024.1; IA, desde 2025.1. Turmas anteriores podem criar conta, mas não recebem uma matriz inadequada. A transcrição ainda depende de conferência institucional. Os pré-requisitos de CC, IA e EC não estão confirmados nas fontes consultadas; o planejador sinaliza essa limitação e não comprova elegibilidade. Oferta, administração completa, integração automática com SIGAA, planejamento de vários semestres, previsão e recomendações ficam para entregas posteriores. O protótipo HTML original permanece em `prototipo/`; a demonstração antiga exige configuração explícita.

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

O seed insere as disciplinas ausentes das quatro matrizes, sem substituir registros existentes. Não o utilize como rotina de atualização de uma grade oficial. A API oferece documentação interativa em `http://127.0.0.1:8000/docs`.

Em outro terminal, inicie o frontend:

```sh
cd frontend
npm ci
npm run dev
```

Acesse **http://127.0.0.1:5173**. O Vite encaminha `/api` para o FastAPI na porta 8000, evitando configuração adicional de CORS no desenvolvimento. Para usar um PostgreSQL já instalado, ajuste `DATABASE_URL` em `backend/.env` e execute as mesmas migrações e seed.

Encerre API e frontend com `Ctrl+C`. Pare o banco com `docker compose stop db`; os dados permanecem no volume.

## Cadastro e histórico

Após as migrações, provisione contas locais pelo terminal do backend:

```sh
uv run python -m app.accounts create --email estudante@example.org --role student --registration 20260001 --current-period 2
uv run python -m app.accounts create --email coordenacao@example.org --role coordination
uv run python -m app.accounts reset-password --email estudante@example.org
uv run python -m app.accounts deactivate --email estudante@example.org
```

Criação e redefinição pela CLI solicitam a senha duas vezes, sem argumentos nem exibição. O estudante também pode criar uma conta pela tela inicial, informando e-mail, senha, matrícula, semestre de ingresso, período atual e curso; entra automaticamente após o cadastro. E-mail é normalizado para minúsculas; e-mail e matrícula são únicos. Senhas são protegidas com `pwdlib[argon2]`, conforme a [documentação do FastAPI](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/). Redefinição e desativação revogam todas as sessões. Não há confirmação ou recuperação por e-mail nesta entrega.

O estudante de qualquer curso com matriz atendida edita o próprio histórico, registrando cadeira, semestre e situação (aprovada, cursando ou reprovada). Esses dados são autodeclarados, usados somente no planejamento e não alteram nem verificam o SIGAA. A importação administrativa legada aceita apenas contas criadas pela coordenação, para evitar vincular dados institucionais a uma matrícula autodeclarada. A API restringe histórico e planos às disciplinas da matriz do estudante.

As fontes das matrizes atuais são as páginas do CIn para [CC](https://portal.cin.ufpe.br/graduacao/ciencia-da-computacao/), [IA](https://portal.cin.ufpe.br/graduacao/inteligencia-artificial/) e [EC](https://portal.cin.ufpe.br/graduacao/engenharia-da-computacao/). A página de IA não informa a carga horária de CIN0134; o valor de 60h foi conferido no [registro público de disciplinas do SIGAA](https://sigaa.ufpe.br/sigaa/public/docente/disciplinas.jsf?siape=1039616). A página de IA também repete o código CIN0123 para cadeiras diferentes, por isso os IDs internos são distintos. Nenhum pré-requisito dessas três matrizes foi inferido a partir da ordem dos períodos.

O endpoint administrativo legado continua disponível para contas provisionadas pela coordenação. Consulte [contratos e exemplo JSON](docs/api.md). O estudante entra na aplicação, registra suas tentativas, cria alternativas e salva explicitamente os rascunhos. Dados fictícios de contas só são criados pelo servidor de testes, nunca pelo seed da grade.

Frontend e API devem compartilhar a origem pública. Configure `ALLOWED_ORIGINS` com essa origem e `ENVIRONMENT=production` em produção para cookies `Secure`; use HTTPS. Em desenvolvimento o proxy do Vite mantém a mesma origem. Para usar o Swagger local autenticado, inclua sua origem em `ALLOWED_ORIGINS` e envie o token CSRF nos pedidos de escrita.

A demonstração antiga continua separada: inicie a API com `DEMO_ENABLED=true` e o Vite com `VITE_DEMO_ENABLED=true npm run dev`, depois abra `/demo`. Os dois controles são desativados por padrão.

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

O Playwright inicia uma API de fixtures fictícias na porta 8011 e o Vite na porta 5173. Não exige a API de desenvolvimento ligada; essas duas portas precisam estar livres. O servidor de testes usa SQLite descartável por padrão. Para exercitar persistência, migrações e concorrência em **PostgreSQL real**, execute:

```sh
# Na raiz do projeto, com o Compose disponível:
docker compose config
docker compose up -d db
cd backend
TEST_DATABASE_URL=postgresql+psycopg://pai:pai@127.0.0.1:54329/pai uv run pytest
cd ../frontend
TEST_DATABASE_URL=postgresql+psycopg://pai:pai@127.0.0.1:54329/pai npm test
```

Os testes criam esquemas aleatórios e removem somente esses esquemas ao terminar. Cobrem banco vazio e grade existente, seed repetido, dois salvamentos concorrentes, importações simultâneas idênticas e reconexão do pool. Sem `TEST_DATABASE_URL`, os testes específicos de PostgreSQL são marcados como ignorados; a suíte de API usa SQLite em memória. Os testes de navegador incluem o fluxo persistido, duas alternativas, novo login, sessão expirada, conflito, histórico ausente e tela móvel, além das demonstrações antigas.

Na validação local desta entrega, os 70 testes do backend passaram com PostgreSQL real, incluindo migrações, concorrência, isolamento entre matrizes, cadastro e edição do histórico pelo estudante. Os 3 testes de componentes e os 17 testes de navegador também passaram. Ruff, formatação e build/TypeScript passaram. Os testes de navegador cobrem cadastro, histórico e planos nos quatro cursos, distribuição de disciplinas e eletivas por alternativa, ordem dos cards e recuperação após novo login.

## Executar somente o protótipo original

Abra [prototipo/index.html](prototipo/index.html) diretamente em um navegador. Esse arquivo reúne HTML, CSS, JavaScript e dados; não exige instalação de dependências.

## Documentação

- [Arquitetura e stack](docs/arquitetura.md): proposta, diagramas C4 e decisões técnicas da primeira implementação.
- [Escopo e requisitos](docs/escopo.md): capacidades, limites e decisões pendentes.
- [Guia do protótipo](docs/prototipo.md): comportamento e limitações do HTML original.
- [API](docs/api.md): autenticação, importação, planos e simulação.

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
      planning/            # simulação demonstrativa e contratos
      personal/            # identidade, histórico e planos persistidos
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
