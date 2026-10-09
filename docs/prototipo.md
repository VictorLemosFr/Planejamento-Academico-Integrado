# Guia do protótipo

## Origem e execução

[index.html](../prototipo/index.html) é uma cópia integral do arquivo `index_1.html` fornecido pelo autor. O HTML reúne estilos, dados e JavaScript e pode ser aberto diretamente no navegador, conforme o [README](../README.md).

Não existem dependências externas de execução, API, banco de dados ou mecanismo de persistência. Identificação, matriz curricular e cenários estão escritos no próprio arquivo; são dados de demonstração, não comprovação de histórico ou regras oficiais da instituição.

## Interações

- Selecionar uma disciplina para consultar carga horária, pré-requisitos e componentes desbloqueados.
- Filtrar disciplinas por estado ou visualizar eletivas.
- Mostrar ou ocultar conexões do grafo.
- Simular aprovação e observar alterações nas dependências.
- Marcar uma disciplina concluída como pendente.
- Planejar uma disciplina elegível para o próximo semestre e remover esse planejamento.
- Alternar cenários e restaurar seu estado inicial.
- Navegar por períodos em telas menores e fechar detalhes com `Esc`.

Os cenários demonstram situações de progressão regular, pendências e uma trilha de IA e Dados. Trocar de cenário descarta as alterações da simulação anterior.

## Regras implementadas

| Regra | Comportamento |
| --- | --- |
| Pré-requisitos | Todos os requisitos diretos precisam constar no conjunto de conclusões simuladas. |
| Estado da disciplina | A prioridade é: concluída, bloqueada, planejada, pendente e disponível. |
| Pendência | Uma obrigatória elegível de período anterior ao atual é exibida como pendente. Uma disciplina com requisito não atendido é exibida como bloqueada. |
| Planejamento | Planejar não equivale a concluir e não libera dependências. |
| Criticidade | Um componente é crítico quando alcança pelo menos seis dependentes diretos ou indiretos, incluindo eletivas. |
| Previsão | Considera obrigatórias restantes divididas por quatro, arredondadas para cima, e o tempo até o oitavo período; usa o maior valor e no mínimo um semestre. |

A previsão parte de **2026.2**, fixo no código. Não considera disponibilidade de oferta, carga horária, sequência efetiva dos pré-requisitos, exigências de eletivas ou outras condições de integralização. Mesmo com todas as obrigatórias concluídas, a fórmula mantém no mínimo um semestre. É uma demonstração visual, ainda inadequada como previsão acadêmica confiável.

Ao remover uma conclusão simulada, o protótipo reavalia os bloqueios dos componentes ainda não concluídos, mas não desfaz automaticamente conclusões de dependentes. Assim, a simulação pode manter uma situação inconsistente com o grafo. Essa limitação deve ser resolvida quando as regras do sistema forem implementadas.

## Organização interna do HTML

| Bloco | Conteúdo |
| --- | --- |
| `DATA` | Disciplinas obrigatórias, eletivas e pré-requisitos. |
| `GRAPH ENGINE` | Dependentes, ancestrais, alcance e criticidade. |
| `STATE` | Cenário selecionado, conclusões, planejamento e filtros. |
| `STATUS ENGINE` | Estados derivados, requisitos pendentes e previsão. |
| `RENDER` | Mapa, painel, indicadores e conexões SVG. |
| Eventos e `INIT` | Interações e inicialização do cenário. |

Esses blocos ajudam a entender o protótipo, mas não constituem os cinco módulos de backend da arquitetura proposta.

## Roteiro de validação manual

Este roteiro descreve verificações a realizar no navegador; não é um registro de testes já executados.

1. Abrir o HTML e confirmar a apresentação de disciplinas, indicadores e cenário inicial.
2. Selecionar uma disciplina bloqueada e conferir os pré-requisitos apresentados.
3. Selecionar uma disciplina elegível e planejá-la; confirmar que seus dependentes continuam bloqueados.
4. Simular sua aprovação e conferir os componentes liberados.
5. Marcar essa disciplina como pendente e conferir os bloqueios recalculados.
6. Alternar filtros, ocultar conexões e selecionar uma eletiva.
7. Trocar de cenário, restaurá-lo e confirmar o retorno aos dados iniciais.
8. Recarregar a página e confirmar que alterações de simulação não foram persistidas.
9. Usar uma janela estreita para conferir navegação por períodos e painel de detalhes.
