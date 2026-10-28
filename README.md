# Planejamento Acadêmico Integrado

Ferramenta de apoio à decisão para o estudante visualizar sua progressão acadêmica, simular cenários e planejar sua trajetória até a conclusão do curso. O SIGAA permanece responsável pelo histórico oficial e pela efetivação da matrícula.

Projeto da disciplina **Integração e Evolução de Sistemas de Informação (IESI)**, com orientação do **Prof. Paulemir Gonçalves Campos**.

## Estado atual

A aplicação entrega **cadastro ou login → histórico informado pelo estudante → progressão → simulação → plano salvo → recuperação após novo acesso**, com dados pessoais no PostgreSQL.

- Mapa curricular por período, busca, filtros (inclusive "Críticas") e detalhes em abas: Resumo, Histórico e Dependências.
- Setas de dependência ao selecionar uma disciplina (pré-requisito, libera, co-requisito), com as demais esmaecidas; botão *Caminho crítico* destaca a maior cadeia de obrigatórias pendentes; modo *Compacto* e *Legenda*.
- Cards arrastáveis a qualquer momento com mouse, toque (pressionar e segurar) e teclado (espaço, setas, espaço), via dnd-kit, com anúncios em português para leitores de tela. No histórico, soltar num período já cursado registra a tentativa naquele semestre; soltar num período futuro leva a disciplina para a Simulação. Na Simulação sem alternativa aberta, o primeiro arraste cria um rascunho. O seletor "Mover … para período" no painel continua como alternativa; clicar de novo no card selecionado desmarca e apaga as setas.
- Barra lateral retrátil (no celular vira barra de abas no rodapé) com as páginas Visão geral, Meu histórico, Simulação, Sugestões, Comparar e Explorar grades. A nota sobre a fonte da matriz fica no rodapé.
- **Visão geral:** CR com decimais menores e evolução por semestre, integralização com legenda, previsão, avisos com ação ("Informar agora"), "Um caminho possível" até a formatura, calculadora de meta de CR e atividade recente do histórico.
- **E se eu reprovar?** No painel da disciplina, compara a previsão atual com a de uma reprovação (`GET /api/me/progression/failure-impact/{id}`): atraso em semestres, disciplinas que ficam travadas e o nível pela Res. nº 09/2009.
- **Alternativas = planos até a formatura:** cada coluna é um semestre de verdade ("4º período · 2026.2"). Arrastar uma disciplina para uma coluna futura a planeja para aquele semestre; o que já foi cursado fica onde foi cursado. O plano aceita pré-requisito em andamento agora ou planejado num semestre anterior e avisa quando a ordem não fecha. A faixa de indicadores mostra quando o plano forma ou o que ainda está "Sem semestre no plano". Não há mais "semestre-alvo": a alternativa é só um nome.
- **Sugestões:** gera o plano para quantos semestres você quiser (só o próximo, os próximos N ou até a formatura) pela carga desejada, priorizando o caminho crítico, as atrasadas e as que liberam mais; pode escolher as eletivas de perfil ou deixá-las como horas. Vira uma alternativa com cada disciplina na coluna do seu semestre.
- **Comparar:** até três alternativas lado a lado (formatura no plano, previsão mínima, integralização, CR simulado, carga), com a melhor de cada linha destacada.
- **Compartilhar e exportar:** link somente leitura de um plano salvo (`/compartilhado/<token>`, revogável, sem notas, CR, reprovações ou e-mail; migração `0011`) e "Exportar PDF", que imprime um relatório por período.
- **CR e MC como o SIGAA:** média das notas ponderada pela carga horária (CH), com reprovação por falta valendo zero; a MC (média de conclusão) usa só as aprovações. A Res. nº 09/2009 fala em créditos, mas o SIGAA pondera pela CH: conferido com um histórico emitido pelo SIGAA, o CR e a MC impressos só fecham assim.
- **Primeiro acesso:** sem histórico, a Visão geral só mostra "Preencha seu histórico acadêmico", com duas saídas: importar o PDF do SIGAA (recomendado) ou preencher no mapa. A importação é um passo só: escolher o PDF, conferir o resumo (aprovadas, reprovações, cursando e obrigatórias ainda não cursadas) e "Importar e salvar". Também abre pela barra lateral, pela busca rápida e por "Meu histórico".
- **Importação do PDF do SIGAA:** lê a coluna Média (inclusive notas sem vírgula, como "7"), o ingresso e o período atual do cabeçalho, ignora a lista de obrigatórias pendentes e mostra o CR/MC impressos para conferência.
- **Período atual:** "Marcar período como cursando" registra o semestre atual de uma vez; obrigatórias sem registro aparecem como "Não cursada" (períodos anteriores) ou "Não cursando agora" (período atual), e a Visão geral avisa o que ficou para depois. Cada coluna do mapa mostra o semestre letivo (ex.: "2026.2 · atual").
- **Busca rápida:** `Ctrl+K` (`⌘K` no Mac) encontra disciplinas, páginas e ações.
- Faixa fixa de indicadores (CR ou CR simulado, % integralizado, previsão, alterações não salvas). A Simulação tem identidade de rascunho (borda tracejada violeta) para não ser confundida com o histórico real.
- *Marcar período como aprovado* registra de uma vez as obrigatórias de um período já cursado; exceções são ajustadas card a card.
- Tema escuro (segue o sistema; a escolha fica salva no navegador). Nomes em CAIXA ALTA das páginas do CIn aparecem em formato de título só na exibição.
- Disciplinas aprovadas, em andamento e reprovadas informadas pelo estudante; aprovações hipotéticas ficam separadas nos planos.
- Edição do próprio histórico por disciplina e semestre, transacional, versionada e idempotente. A importação JSON pela coordenação permanece para contas provisionadas anteriormente.
- Várias alternativas para um semestre, com rascunhos locais, salvamento explícito, renomeação e exclusão.
- Controle de versão para evitar sobrescritas; novas importações revalidam planos sem apagar escolhas.
- Sessões opacas de oito horas, senhas Argon2, proteção de origem/CSRF e isolamento por estudante.
- Cadastro público de estudantes com escolha entre CC, SI, IA e EC, semestre de ingresso e período atual, sem aprovação manual da matrícula.

As quatro matrizes atuais foram transcritas das páginas públicas do CIn: SI (56 disciplinas), CC (101), IA (70) e EC (147), incluindo obrigatórias e eletivas de perfil. SI, CC e EC atendem ingressantes desde 2024.1; IA, desde 2025.1. Turmas anteriores podem criar conta, mas não recebem uma matriz inadequada; contas legadas de SI sem semestre de ingresso continuam na matriz de SI. Pré-requisitos e co-requisitos foram conferidos nos **Projetos Pedagógicos dos Cursos (PPCs)**, nos programas de cada componente curricular: 44 relações em SI, 107 em CC, 151 em EC e 83 em IA. Ficam sinalizadas como não confirmadas apenas Ética e Aspectos Jurídicos da Computação em IA (o pré-requisito Informática e Sociedade não consta na matriz de IA) e Algoritmos para Streams de Dados em EC (sem programa no PPC). Co-requisitos, como os laboratórios de EC, devem ser cursados no mesmo semestre ou antes. Onde a página pública diverge do PPC, vale o PPC: Introdução à Programação e Integração e Evolução de SI têm 120h em CC, Programação Funcional tem 30h em IA, e em SI Introdução à Programação tem 120h e Concepção de Artefatos Digitais tem 60h. As matrizes ainda não foram validadas pelas coordenações e o planejador não substitui a matrícula no SIGAA.

- **Meu histórico × Simulação:** o que já aconteceu fica na aba *Meu histórico*, editável no próprio mapa: cada disciplina recebe tentativas com semestre, situação (aprovada, reprovada ou cursando) e nota final; eletivas podem ser arrastadas para os períodos já cursados. Nada é gravado até *Salvar histórico*. Cenários ficam na aba *Simulação*, com aprovações hipotéticas, disciplinas planejadas e notas simuladas.
- **Reprovações (Res. nº 09/2009-CCEPE/UFPE):** 1 reprovação = atenção, 2 = crítico e a 3ª leva à recusa de matrícula; o número de reprovações aparece no card e o histórico não aceita tentativa depois da 3ª. Cadeiras do 1º período não têm a opção “não cursei”.
- **CR:** média das notas finais ponderada pelos créditos de cada disciplina (extraídos dos PPCs), contando todas as tentativas, inclusive reprovações; reprovação por falta vale zero. Na simulação, as notas simuladas geram o CR simulado.
- **Integralização:** carga concluída e em andamento de obrigatórias e eletivas de perfil, comparada aos requisitos publicados de cada curso. Eletivas livres, atividades complementares e extensão são exibidas, mas não acompanhadas.
- **Previsão mínima de conclusão:** o maior entre a maior cadeia de obrigatórias pendentes (caminho mais longo do grafo de pré-requisitos) e a carga restante no ritmo médio da própria matriz. As premissas aparecem na interface.
- **Grade pública** em `/grades`: qualquer pessoa navega pelas quatro matrizes e simula aprovações sem conta e sem gravar dados.
- **Eletivas com filtro e ordenação:** disponíveis, bloqueadas, planejadas ou concluídas; ordem por situação, nome, carga ou número de dependentes.
- **Importação do histórico em PDF do SIGAA:** o arquivo é lido em memória e descartado; os registros encontrados aparecem para revisão e só são gravados quando o estudante salva o histórico.

Oferta, administração completa, integração automática com SIGAA, planejamento de vários semestres e recomendações ficam para entregas posteriores. O protótipo HTML original permanece em `prototipo/`; a demonstração antiga exige configuração explícita.

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

O seed insere as disciplinas ausentes das quatro matrizes, sem substituir registros existentes. Não o utilize como rotina de atualização de uma grade oficial: correções de dados em bancos já populados são feitas por migrações, como a `0008`, que só altera valores conhecidos como errados. A API oferece documentação interativa em `http://127.0.0.1:8000/docs`.

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

Na validação local desta entrega, os 109 testes do backend passaram com PostgreSQL real, incluindo migrações (inclusive as correções de dados da 0008 e os requisitos dos PPCs da 0009), concorrência, isolamento entre matrizes, previsão, integralização, grade pública e leitura de PDF fictício. Os 3 testes de componentes e os 25 testes de navegador também passaram. Ruff, formatação e build/TypeScript passaram. Os testes de navegador cobrem cadastro, histórico e planos nos quatro cursos, distribuição de disciplinas e eletivas por alternativa, ordem dos cards, recuperação após novo login, grade pública, filtro de eletivas, resumo de integralização e importação de um histórico fictício em PDF (`frontend/tests/fixtures/`).

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
    data/                  # matrizes transcritas do CIn e cenários do protótipo
    modules/
      curriculum/          # entidades e leitura da grade
      constraints/         # grafo e pré-requisitos
      progression/         # estados acadêmicos derivados
      planning/            # previsão, integralização, simulação e contratos
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
