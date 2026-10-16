# API: identidade, histórico e planos

O contrato OpenAPI completo está em `/docs` e `/openapi.json`. A grade atual é demonstrativa e ainda depende de validação institucional. A validação considera **somente pré-requisitos**, sem oferta, horários ou limites institucionais de carga.

## Sessão e acesso

- `POST /api/auth/login`: `{ "email": "aluno@example.org", "password": "senha" }`. Retorna `{ "user": { "id", "email", "role" }, "csrf_token" }` e cookie `pai_session`.
- `GET /api/auth/me`: mesma resposta de identidade, sem renovar a expiração.
- `POST /api/auth/logout`: revoga a sessão e limpa o cookie.

Login exige `Origin` exatamente igual a uma entrada de `ALLOWED_ORIGINS`. Escritas autenticadas exigem também `X-CSRF-Token` retornado pelo login ou `/auth/me`. Clientes da coordenação devem guardar o cookie e enviar ambos os cabeçalhos. Swagger e scripts não recebem exceção a essas regras. Nenhum bearer token ou conclusão oficial enviada pelo cliente é aceito.

As sessões duram oito horas. O banco armazena apenas SHA-256 do identificador aleatório da sessão. Cookies usam `HttpOnly`, `SameSite=Lax`, caminho `/` e `Secure` quando `ENVIRONMENT=production`. Respostas da API têm `Cache-Control: no-store`. Redefinição de senha e desativação pela CLI revogam todas as sessões da conta.

## Histórico completo

`PUT /api/admin/students/{registration}/history` exige papel `coordination` e matrícula já provisionada. Exemplo fictício:

```json
{
  "schema_version": 1,
  "source": "Arquivo fornecido pela coordenação",
  "source_reference": "exemplo-ficticio-001",
  "current_period": 2,
  "records": [
    { "course_id": "ip", "academic_term": "2025.2", "status": "failed" },
    { "course_id": "ip", "academic_term": "2026.1", "status": "completed" },
    { "course_id": "edoo", "academic_term": "2026.2", "status": "in_progress" }
  ]
}
```

Retorna `{ "revision": 1, "warnings": [], "unchanged": false }`. Campos extras, disciplinas desconhecidas, período fora de 1–20, semestre fora de `AAAA.1`/`AAAA.2`, e duas entradas para a mesma disciplina no mesmo semestre são rejeitados com `422`. Erros de registros incluem a localização em `detail[].loc`.

Todo o arquivo é validado antes de mudar qualquer dado, e a troca é transacional. As versões anteriores são preservadas com autor, data, payload, registros e hash canônico SHA-256. Repetir o conteúdo vigente, inclusive com outra ordem dos registros, não cria versão. Reimportar um conteúdo antigo após outra versão cria uma revisão nova para restaurá-lo. A matrícula serializa importações e salvamentos concorrentes.

Ausência de aprovação anterior de pré-requisito no histórico oficial gera aviso, sem rejeitar o arquivo. Aprovação prevalece sobre tentativas reprovadas ou em andamento. Na ausência de aprovação, o andamento é derivado da tentativa mais recente. Reprovações e disciplinas em andamento não liberam dependentes. Um histórico sem registros aparece como aguardando importação, mesmo se houver metadados de arquivo vazio.

- `GET /api/me/history`: `revision`, `awaiting_import`, `current_period`, `records`, `import` (autor, data, fonte, referência, hash) e `warnings`.
- `GET /api/me/progression`: mapa calculado a partir do histórico vigente, sem hipótese.

O JSON representa uma importação da coordenação; não comprova integração automática com SIGAA.

## Alternativas do semestre

Todos os recursos são do estudante identificado pela sessão. Recursos de outra pessoa retornam `404` em consulta, simulação, alteração e exclusão.

- `GET /api/plans`: lista alternativas próprias com avaliação atual.
- `POST /api/plans`: `{ "name": "Alternativa A", "target_term": "2026.2" }`, retorna `201` e plano vazio com versão 1.
- `GET /api/plans/{id}`: retorna o plano e sua avaliação no histórico vigente.
- `POST /api/plans/{id}/simulations`: avalia um rascunho sem persistir:

```json
{
  "version": 1,
  "history_revision": 1,
  "hypothetical_ids": [],
  "planned_ids": [],
  "action": { "kind": "plan", "course_id": "mdc" }
}
```

`action` é opcional; `kind` aceita `approve`, `revoke`, `plan` e `unplan`. Aprovação oficial é somente leitura. Aprovações hipotéticas precisam de pré-requisitos coerentes; planejar não libera dependentes. `revoke` remove aprovações hipotéticas e escolhas planejadas dependentes, sem tocar no histórico.

- `PUT /api/plans/{id}` grava o estado completo:

```json
{
  "name": "Alternativa A",
  "target_term": "2026.2",
  "version": 1,
  "history_revision": 1,
  "hypothetical_ids": [],
  "planned_ids": ["mdc"]
}
```

Retorna versão incrementada apenas após commit. Rascunho inválido recebe `422`. Versão do plano ou revisão do histórico divergente recebe `409` sem sobrescrever dados. Nome e semestre fazem parte do mesmo salvamento.

- `DELETE /api/plans/{id}?version=2`: exige versão atual e continua disponível para planos incompatíveis.

Plano: `id`, `name`, `target_term`, `version`, `created_at`, `updated_at`, e avaliação contendo `current_period`, `history_revision`, `awaiting_import`, `official_completed_ids`, `in_progress_ids`, `hypothetical_ids`, `completed_ids` (união somente para exibição), `planned_ids`, `planned_hours`, `courses`, `counts`, `warnings`, `valid`, `problems` por disciplina. Estados do mapa: `completed` (oficial), `simulated`, `in_progress`, `planned`, `available`, `pending`, `locked`.

Uma nova importação não edita planos. Consultas recalculam sua validade e apontam escolhas já concluídas, em andamento ou sem requisitos satisfeitos. Simulações aceitam esses rascunhos para permitir ajustes; somente um estado inteiro válido pode ser salvo. O frontend mantém alterações locais até “Salvar” e permite recarregar após conflitos, com aviso antes de descartar o rascunho.

## Erros e demonstração

`401`: sessão inválida/expirada ou credenciais inválidas. `403`: papel, origem ou CSRF insuficiente. `404`: recurso ausente/de outro estudante ou demonstração desativada. `409`: versão/revisão concorrente. `422`: entrada inválida. `503`: banco indisponível.

`GET /api/curriculum` e `GET /api/health` continuam públicos. `GET /api/scenarios` e `POST /api/simulations` preservam os contratos demonstrativos antigos apenas com `DEMO_ENABLED=true`, desativado por padrão. A interface demonstrativa é `/demo` com `VITE_DEMO_ENABLED=true`; seus dados não são históricos oficiais e não são persistidos.
