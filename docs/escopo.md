# Escopo e requisitos

## Objetivo

Apoiar o estudante no planejamento que antecede a matrícula oficial: compreender a situação acadêmica, verificar dependências, testar alternativas e estimar a trajetória até a conclusão.

O nome adotado nesta documentação é **Planejamento Acadêmico Integrado**, conforme a proposta e o repositório. A expressão “Planejamento Acadêmico Estratégico” usada na apresentação do trabalho ainda não foi incorporada como renomeação.

## Atores e fluxo

1. A coordenação cadastra e atualiza grade, pré-requisitos e ofertas.
2. O sistema importa identificação e histórico do estudante a partir do SIGAA.
3. O estudante consulta sua progressão e escolhe disciplinas para um cenário.
4. O sistema valida dependências, considera ofertas e apresenta impactos na trajetória.
5. O estudante ajusta e mantém seus planos no sistema.
6. O estudante realiza a matrícula oficial no SIGAA.

Esse é o fluxo proposto. No protótipo, os passos de manutenção, importação e persistência ainda não existem.

## Capacidades previstas

| Capacidade | Situação no protótipo |
| --- | --- |
| Consolidar progressão acadêmica | Demonstra estados de disciplinas; não representa histórico importado nem estado “em andamento”. |
| Visualizar dependências e validar pré-requisitos | Usa o grafo de dados locais e conclusões simuladas. |
| Planejar e simular trajetórias | Permite planejar o próximo semestre e simular aprovações; não distribui planos persistentes por vários períodos. |
| Estimar conclusão | Usa uma heurística demonstrativa, sem oferta real ou integralização completa. |
| Identificar disciplinas críticas | Usa um limiar fixo de alcance no grafo. |
| Recomendar e comparar trajetórias | Oferece cenários demonstrativos e uma trilha destacada; não há recomendação personalizada ou comparação lado a lado. |
| Manter ofertas confirmadas e previstas | Ainda não implementado. |
| Administrar grade, pré-requisitos e oferta | Ainda não implementado. |

O mapeamento exato fornecido pela proposta é: F1 em Progressão; F2 e F7 em Pré-requisitos; F3, F4, F5, F6, F9 e F10 em Planejamento; F8 em Oferta. Não se atribuem nomes individuais a esses identificadores sem as Entregas 1 e 2.

## Regras e limites da proposta

- O histórico oficial tem origem no SIGAA.
- A coordenação mantém os dados curriculares e a oferta centralizados.
- Planos e simulações não alteram o histórico oficial nem efetivam matrícula.
- O planejamento deve ser validado contra os pré-requisitos.
- Ofertas futuras distinguem disponibilidade confirmada e prevista.
- Previsões dependentes de ofertas não confirmadas devem apresentar essa condição ao estudante.
- O sistema não replica a administração acadêmica completa do SIGAA.

## Primeira implementação

A aplicação React/Tailwind consulta disciplinas e pré-requisitos persistidos no PostgreSQL por meio do FastAPI. O backend calcula estados, dependentes e criticidade, valida ações de planejamento e aprovação e remove conclusões e planos dependentes ao desfazer uma aprovação simulada.

O usuário pode consultar o mapa, buscar e filtrar disciplinas, explorar detalhes e montar um plano do próximo semestre com carga horária total. Trocar de cenário ou recarregar a página descarta as alterações. O plano não é salvo no banco nesta etapa.

Ainda não há estado “em andamento”, ofertas, autenticação, histórico importado, planos persistentes, administração, recomendação personalizada, comparação lado a lado ou previsão de conclusão. A tabela acima continua descrevendo o protótipo HTML preservado, não o estágio da aplicação nova.

## Decisões ainda abertas

| Tema | Informação necessária |
| --- | --- |
| Funções e necessidades | Entregas 1 e 2, com F1–F10, necessidades e processos AS-IS/TO-BE. |
| Diagramas originais | Figuras de contexto, containers e componentes mencionadas na proposta. |
| Hospedagem | Provedor PaaS e configuração de implantação; stack de aplicação já aprovada. |
| Integração | Forma autorizada de obter o histórico, formato e frequência de importação. |
| Identidade e acesso | Autenticação e permissões de estudante e coordenação. |
| Regras acadêmicas | Matriz validada, equivalências, requisitos de integralização, carga máxima e demais restrições aplicáveis. |
| Planejamento | Critérios de recomendação, comparação, previsão e tratamento de ofertas incertas. |

Esses pontos não representam decisões já aprovadas ou funcionalidades implementadas.
