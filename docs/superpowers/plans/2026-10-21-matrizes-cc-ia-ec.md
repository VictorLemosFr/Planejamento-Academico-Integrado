# Matrizes atuais de CC, IA e EC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute natively in this session; the user's repository instructions prohibit subagents.

**Goal:** Fazer CC, IA e EC usarem suas matrizes atuais em histórico, progressão e planos, preservando os dados de SI.

**Architecture:** Uma matriz identifica curso, versão e vigência; cada disciplina pertence a uma matriz. A API seleciona a matriz pela conta e pelo semestre de ingresso, e todo acesso a disciplinas passa por essa seleção. JSON versionado guarda a transcrição das páginas públicas do CIn, carregada por seed explícito.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, pytest, React, TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-matrizes-cc-ia-ec-design.md`

## Global Constraints

- CC e EC: matriz atual para ingresso desde `2024.1`; IA: desde `2025.1`.
- SI conserva IDs de disciplinas, históricos, layouts e planos existentes; sua matriz permanece demonstrativa.
- Códigos institucionais ausentes em IA são `null`; IDs internos estáveis são distintos por matriz.
- Cadastrar pré-requisitos somente com fonte confirmada. Mostrar aviso de validação incompleta para os demais.
- Não alterar o SIGAA nem importar dados acadêmicos automaticamente.

## Review Focus

- Mesmo código institucional com carga horária diferente em dois cursos: Task 2 prova isolamento dos dois registros.
- Ingresso anterior à vigência: Task 3 prova que a API não oferece uma matriz errada.
- ID de outra matriz em histórico ou plano: Task 3 prova rejeição sem mutação.
- Seed repetido após alteração local: Task 2 prova que a carga não sobrescreve o registro.
- IDs antigos de SI: Task 1 prova migração sem troca de identidade; Task 4 prova novo login com plano antigo.

---

### Task 1: Modelo e migração das matrizes

**Files:**
- Create: `backend/alembic/versions/0007_curricula.py`
- Modify: `backend/app/modules/curriculum/models.py`
- Test: `backend/tests/test_curriculum_constraints.py`, `backend/tests/test_postgres.py`

**Interfaces:** `Curriculum(id, program, valid_from, source_url)`; `Course.curriculum_id` FK, `Course.source_code` opcional e `Course.prerequisite_status` (`verified` ou `unverified`). IDs existentes de `Course` permanecem inalterados. `Prerequisite` continua referindo IDs internos.

- [ ] Escrever testes: upgrade de `0006` para `0007` cria `SI-demo` e associa todas as disciplinas atuais sem alterar IDs; plano/layout/histórico existente permanece legível; banco impede disciplina sem matriz. Códigos institucionais não são chave única porque as páginas publicadas podem repeti-los.
- [ ] Rodar os testes novos e confirmar falha por ausência de `Curriculum`/migração.
- [ ] Implementar modelo e migração, com `SI-demo` e `source_url` da grade demonstrativa local; preservar chaves existentes.
- [ ] Rodar `cd backend && uv run pytest tests/test_curriculum_constraints.py tests/test_postgres.py -q`; exigir sucesso.
- [ ] Commitar apenas modelo, migração e testes desta tarefa.

### Task 2: Dados publicados e seleção de disciplinas

**Files:**
- Create: `backend/app/data/curriculum_cc_2024.json`, `backend/app/data/curriculum_ia_2025.json`, `backend/app/data/curriculum_ec_2024.json`
- Modify: `backend/app/seed.py`, `backend/app/modules/curriculum/repository.py`
- Test: `backend/tests/test_api.py`, `backend/tests/test_curriculum_constraints.py`

**Interfaces:** `list_courses(session: Session, curriculum_id: str) -> list[dict]`; `seed(session: Session) -> None` valida todos os catálogos antes de escrever. Cada JSON informa `id`, `source_code`, `name`, `short_name`, `hours`, `period`, `type`, `prerequisite_ids`, `prerequisite_status` e liga-se à matriz definida no código de carga.

- [ ] Escrever testes: cada curso possui obrigatórias e eletivas das páginas fonte; mesmo código em cursos distintos permanece independente; código ausente em IA mantém ID estável; seed repetido não duplica nem sobrescreve; pré-requisito entre matrizes, ciclo ou ID duplicado falha antes do commit.
- [ ] Rodar testes novos e confirmar falha.
- [ ] Transcrever as páginas oficiais citadas na especificação para JSON; marcar regras não verificadas, sem inferir pré-requisitos; implementar seed e consulta filtrada por matriz.
- [ ] Rodar `cd backend && uv run pytest tests/test_api.py tests/test_curriculum_constraints.py -q`; exigir sucesso.
- [ ] Commitar catálogos, seed, repositório e testes desta tarefa.

### Task 3: Isolamento dos fluxos pessoais pela matriz

**Files:**
- Modify: `backend/app/modules/personal/api.py`, `backend/app/modules/personal/service.py`, `backend/app/modules/personal/schemas.py`
- Test: `backend/tests/test_registration.py`, `backend/tests/test_personal_flow.py`

**Interfaces:** `student_curriculum(session: Session, student: Student) -> Curriculum | None` seleciona pela sigla e `start_term`; `user_view` retorna `student.curriculum` com versão, fonte, vigência e `available`; `list_courses(session, curriculum.id)` alimenta histórico, progressão e todos os endpoints de planos. O estado sem matriz mantém login e leitura de histórico, mas bloqueia escrita e planejamento com `409`.

- [ ] Escrever testes parametrizados para CC/EC `2024.1`, IA `2025.1`, limites anteriores e SI legado; registrar histórico e plano por curso; testar IDs cruzados em histórico, simulação e salvamento sem revisão incrementada.
- [ ] Rodar testes novos e confirmar falha.
- [ ] Substituir guarda exclusiva de SI por seleção central da matriz e aplicar a consulta filtrada em todos os caminhos, inclusive importação administrativa.
- [ ] Rodar `cd backend && uv run pytest tests/test_registration.py tests/test_personal_flow.py -q`; exigir sucesso.
- [ ] Commitar API, serviço, schemas e testes desta tarefa.

### Task 4: Interface para os quatro cursos

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/types.ts`, `frontend/src/components/HistoryEditor.tsx`
- Test: `frontend/tests/registration.spec.ts`, `frontend/tests/personal.spec.ts`

**Interfaces:** A interface usa exclusivamente `identity.student.curriculum` para decidir disponibilidade e mostrar curso, versão, vigência e fonte. `HistoryEditor` recebe apenas disciplinas da progressão já filtrada pela API. Aviso de pré-requisitos não verificados aparece no mapa/plano.

- [ ] Escrever testes de navegador para novo cadastro em CC/IA/EC, edição do histórico, plano e novo login; turma anterior à vigência vê motivo de indisponibilidade; SI com plano anterior segue acessível.
- [ ] Rodar os testes novos e confirmar falha.
- [ ] Remover a trava de curso `SI` na interface; usar o estado de disponibilidade enviado pela API e mostrar fonte/aviso da matriz.
- [ ] Rodar `cd frontend && npm test && npm run build && npm run format:check`; exigir sucesso.
- [ ] Commitar interface e testes desta tarefa.

### Task 5: Documentação e verificação integrada

**Files:**
- Modify: `README.md`, `docs/api.md`, `docs/escopo.md`, `docs/arquitetura.md`
- Test: suites existentes de backend e frontend.

- [ ] Atualizar instruções de seed, versões atendidas, fontes, limites de pré-requisitos e respostas da API.
- [ ] Rodar suíte backend com PostgreSQL real (`TEST_DATABASE_URL=postgresql+psycopg://pai:pai@127.0.0.1:54329/pai uv run pytest -q`), Ruff, frontend `npm test`, build, Prettier e `git diff --check`; exigir sucesso.
- [ ] Conferir que o seed carrega os quatro cursos após `alembic upgrade head` em banco vazio e que a migração preserva SI em banco antigo.
- [ ] Commitar apenas documentação e ajustes finais relacionados à verificação.
