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

## Primeira entrega funcional

A aplicação React/Tailwind consulta o FastAPI e persiste dados no PostgreSQL. Contas locais provisionadas pela coordenação permitem acessar histórico importado por JSON, progressão, alternativas de um semestre e simulações. Aprovação oficial, aprovação hipotética e andamento têm estados distintos.

Planos são rascunhos até salvar. Nome, semestre, escolhas e hipóteses são persistidos por estudante, com controle de versão e revisão do histórico. Uma importação substitui o histórico vigente atomicamente, conserva suas versões e revalida os planos sem apagar escolhas. Planos incompatíveis ficam acessíveis para ajuste ou exclusão. A coordenação usa endpoints documentados e CLI, sem interface administrativa nova.

A grade continua demonstrativa e a validação considera apenas pré-requisitos. Oferta, administração completa, integração automática com SIGAA, planejamento de vários semestres, recomendação personalizada, comparação lado a lado e previsão de conclusão permanecem fora desta entrega. A tabela anterior descreve o protótipo HTML preservado.

## Decisões ainda abertas

| Tema | Informação necessária |
| --- | --- |
| Funções e necessidades | Entregas 1 e 2, com F1–F10, necessidades e processos AS-IS/TO-BE. |
| Diagramas originais | Figuras de contexto, containers e componentes mencionadas na proposta. |
| Hospedagem | Provedor PaaS e configuração de implantação; stack de aplicação já aprovada. |
| Integração | Forma autorizada de integração automática e frequência de atualização; a entrega atual aceita JSON completo fornecido pela coordenação. |
| Identidade e acesso | Autenticação e permissões de estudante e coordenação. |
| Regras acadêmicas | Matriz validada, equivalências, requisitos de integralização, carga máxima e demais restrições aplicáveis. |
| Planejamento | Critérios de recomendação, comparação, previsão e tratamento de ofertas incertas. |

Esses pontos não representam decisões já aprovadas ou funcionalidades implementadas.
