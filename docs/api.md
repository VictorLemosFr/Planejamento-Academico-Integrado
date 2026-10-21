# API: identidade, histórico e planos

O contrato OpenAPI completo está em `/docs` e `/openapi.json`. A grade atual é demonstrativa e ainda depende de validação institucional. A validação considera **somente pré-requisitos**, sem oferta, horários ou limites institucionais de carga.

## Sessão e acesso

- `POST /api/auth/login`: `{ "email": "aluno@example.org", "password": "senha" }`. Retorna `{ "user": { "id", "email", "role" }, "student": { "program" }, "csrf_token" }` e cookie `pai_session`. Para a coordenação, `student` é `null`.
- `POST /api/auth/register`: `{ "email", "password", "registration", "start_term", "current_period", "program" }`, com `start_term` no formato `AAAA.1` ou `AAAA.2`, `program` igual a `CC`, `SI`, `IA` ou `EC` e `current_period` entre 1 e 20. Cria estudante sem aprovação manual da matrícula e retorna `201`, identidade e sessão. E-mail ou matrícula repetidos retornam `409`.
- `GET /api/auth/me`: mesma resposta de identidade, sem renovar a expiração.
- `POST /api/auth/logout`: revoga a sessão e limpa o cookie.

Login e cadastro exigem `Origin` exatamente igual a uma entrada de `ALLOWED_ORIGINS`. Escritas autenticadas exigem também `X-CSRF-Token` retornado pelo login ou `/auth/me`. Clientes da coordenação devem guardar o cookie e enviar ambos os cabeçalhos. Swagger e scripts não recebem exceção a essas regras. Nenhum bearer token é aceito.

As sessões duram oito horas. O banco armazena apenas SHA-256 do identificador aleatório da sessão. Cookies usam `HttpOnly`, `SameSite=Lax`, caminho `/` e `Secure` quando `ENVIRONMENT=production`. Respostas da API têm `Cache-Control: no-store`. Redefinição de senha e desativação pela CLI revogam todas as sessões da conta.

## Histórico informado pelo estudante

`PUT /api/me/history` grava o histórico da própria sessão. O aluno informa semestre de ingresso, período atual e tentativas por cadeira; pode registrar aprovação, andamento e reprovação, inclusive tentativas da mesma cadeira em semestres diferentes. Exemplo:

```json
{
  "start_term": "2024.1",
  "current_period": 3,
  "records": [
    { "course_id": "ip", "academic_term": "2024.1", "status": "failed" },
    { "course_id": "ip", "academic_term": "2024.2", "status": "completed" }
  ]
}
```

As tentativas devem pertencer à grade disponível e não podem anteceder o semestre de ingresso. O salvamento substitui a versão vigente; repetir o mesmo conteúdo é idempotente. Os dados são **autodeclarados** e servem apenas ao planejamento: não alteram nem comprovam o histórico do SIGAA. O semestre de ingresso também pode ser informado por contas antigas na primeira edição.

## Importação administrativa legada

`PUT /api/admin/students/{registration}/history` exige papel `coordination` e conta de estudante criada administrativamente. O endpoint não vincula dados institucionais a matrículas autodeclaradas no cadastro público. Para CC, IA e EC, a importação aguarda a grade do curso. Exemplo fictício:

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

Ausência de aprovação anterior de pré-requisito no histórico gera aviso, sem rejeitar o arquivo. Aprovação prevalece sobre tentativas reprovadas ou em andamento. Na ausência de aprovação, o andamento é derivado da tentativa mais recente. Reprovações e disciplinas em andamento não liberam dependentes. Um histórico sem registros aparece como sem cadeiras registradas.

- `GET /api/me/history`: `revision`, `awaiting_import` (sem tentativas), `start_term`, `current_period`, `records`, `import` (autor, data, fonte, referência, hash) e `warnings`.
- `GET /api/me/progression`: mapa calculado a partir do histórico vigente, sem hipótese.

Nenhum dos dois caminhos comprova integração automática com SIGAA. A resposta identifica a fonte vigente em `import.source`.

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

`action` é opcional; `kind` aceita `approve`, `revoke`, `plan` e `unplan`. Aprovações registradas no histórico são somente leitura dentro de uma alternativa; o aluno as altera no editor do histórico. Aprovações hipotéticas precisam de pré-requisitos coerentes; planejar não libera dependentes. `revoke` remove aprovações hipotéticas e escolhas planejadas dependentes, sem tocar no histórico.

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

Plano: `id`, `name`, `target_term`, `version`, `created_at`, `updated_at`, e avaliação contendo `current_period`, `history_revision`, `awaiting_import`, `official_completed_ids` (nome legado para aprovações registradas no histórico, inclusive autodeclaradas), `in_progress_ids`, `hypothetical_ids`, `completed_ids` (união somente para exibição), `planned_ids`, `planned_hours`, `courses`, `counts`, `warnings`, `valid`, `problems` por disciplina. Estados do mapa: `completed` (informada no histórico), `simulated`, `in_progress`, `planned`, `available`, `pending`, `locked`.

Uma nova importação não edita planos. Consultas recalculam sua validade e apontam escolhas já concluídas, em andamento ou sem requisitos satisfeitos. Simulações aceitam esses rascunhos para permitir ajustes; somente um estado inteiro válido pode ser salvo. O frontend mantém alterações locais até “Salvar” e permite recarregar após conflitos, com aviso antes de descartar o rascunho.

## Erros e demonstração

`401`: sessão inválida/expirada ou credenciais inválidas. `403`: papel, origem ou CSRF insuficiente. `404`: recurso ausente/de outro estudante ou demonstração desativada. `409`: versão/revisão concorrente. `422`: entrada inválida. `503`: banco indisponível.

`GET /api/curriculum` e `GET /api/health` continuam públicos. `GET /api/scenarios` e `POST /api/simulations` preservam os contratos demonstrativos antigos apenas com `DEMO_ENABLED=true`, desativado por padrão. A interface demonstrativa é `/demo` com `VITE_DEMO_ENABLED=true`; seus dados não são históricos oficiais e não são persistidos.


### Distribuição de disciplinas por alternativa

Os pedidos de simulação e salvamento aceitam `course_layout`, um objeto por ID de disciplina:

```json
{"course_layout": {"ip": {"period": 3, "order": 0}}}
```

`period` aceita inteiros de 1 a 20; `order`, de 0 a 500. IDs desconhecidos são rejeitados. A resposta de cada alternativa inclui essa distribuição. Clientes antigos que omitirem o campo preservam a distribuição salva. Um objeto vazio restaura a disposição padrão, exceto pelas eletivas planejadas, que continuam no mapa.

A distribuição é visual e exclusiva da alternativa: não altera o período recomendado da grade, o histórico oficial ou as regras de aprovação. Os pré-requisitos continuam sendo validados pelas ações de planejamento e simulação. A interface sinaliza pré-requisitos posicionados no mesmo período ou em um período posterior, como orientação visual; esse aviso não impede salvar a distribuição.

Eletivas planejadas sem posição entram no período seguinte ao período atual (limitado ao 20º). A distribuição e a ordem dos cards são persistidas ao clicar em **Salvar**, com os mesmos controles de versão e isolamento por estudante. Devolver uma eletiva planejada ao catálogo também a remove do planejamento. A carga horária exibida em cada coluna soma as disciplinas distribuídas ali, independentemente dos filtros.
