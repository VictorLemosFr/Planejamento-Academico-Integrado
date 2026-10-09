# API da primeira implementação

Base de desenvolvimento: `http://127.0.0.1:8000/api`. O contrato completo gerado pelo FastAPI está em `/docs` e `/openapi.json`.

## Rotas

| Método | Rota | Responsabilidade |
| --- | --- | --- |
| GET | `/api/health` | Verifica conexão com o banco. |
| GET | `/api/curriculum` | Retorna disciplinas e IDs dos pré-requisitos persistidos. |
| GET | `/api/scenarios` | Retorna os quatro cenários demonstrativos locais. |
| POST | `/api/simulations` | Valida e recalcula o cenário hipotético, sem persistir alterações. |

Não há autenticação nesta etapa. As rotas expõem apenas demonstração e leitura da grade; a configuração local restringe os serviços a `127.0.0.1`.

## Simular um cenário

```json
{
  "current_period": 4,
  "completed_ids": ["ip"],
  "planned_ids": [],
  "action": {
    "kind": "plan",
    "course_id": "ds"
  }
}
```

`current_period` deve estar entre 1 e 20. As listas são opcionais e começam vazias. `action` é opcional: sem ela, a API apenas avalia o estado recebido.

| Ação | Resultado |
| --- | --- |
| `plan` | Adiciona uma disciplina elegível ao plano do próximo semestre. |
| `unplan` | Remove uma disciplina do planejamento. |
| `approve` | Acrescenta uma conclusão hipotética e remove a disciplina do plano. |
| `revoke` | Remove a conclusão e conclusões ou planos de todos os dependentes. |

Planejar não libera pré-requisitos. Conclusões e planos recebidos precisam estar coerentes com os pré-requisitos cadastrados; disciplinas desconhecidas, ciclos na grade e ações incompatíveis são rejeitados.

A resposta contém `completed_ids`, `planned_ids`, `planned_hours`, `current_period`, `counts`, `warnings` e `courses`. Cada disciplina inclui seus dados curriculares, `status`, `missing_prerequisite_ids`, `dependent_ids` e `critical`.

Os estados são `completed`, `planned`, `available`, `pending` e `locked`. Uma obrigatória de período anterior é pendente quando elegível e ainda não concluída ou planejada. A criticidade usa o critério demonstrativo de pelo menos seis dependentes diretos ou indiretos.

## Erros e limites

- **422:** contrato inválido ou cenário incompatível com as regras. Erros de domínio retornam uma descrição em `detail`; erros de contrato retornam a lista de validação do FastAPI.
- **503:** banco indisponível, migrações ausentes ou grade vazia para simulação.
- A simulação considera pré-requisitos; oferta, conflitos de horário, carga máxima e demais condições de integralização ainda não são avaliados.
- A API não calcula previsão de conclusão e não grava histórico, planos ou matrícula.
