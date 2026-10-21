# Matrizes atuais de CC, IA e EC

## Objetivo e recorte

Permitir que estudantes de Ciência da Computação (CC), Inteligência Artificial (IA) e Engenharia da Computação (EC) registrem o próprio histórico e usem o mapa, as simulações e os planos com disciplinas do seu curso. A escolha do usuário é atender somente as matrizes atuais: CC e EC para ingressantes desde 2024.1; IA para ingressantes desde 2025.1. O fluxo existente de Sistemas de Informação (SI) permanece disponível e seus registros e planos não mudam de identidade.

O sistema continua sendo uma ferramenta de planejamento. O histórico é informado pelo estudante, e a matrícula oficial permanece no SIGAA. As novas grades devem ser identificadas pela fonte e pela vigência; sua transcrição e suas regras acadêmicas ainda exigem conferência institucional antes de qualquer alegação de validação oficial.

## Fontes e qualidade dos dados

Transcrever disciplinas obrigatórias e eletivas, período, carga horária e código quando publicado das páginas do CIn para [CC](https://portal.cin.ufpe.br/graduacao/ciencia-da-computacao/), [IA](https://portal.cin.ufpe.br/graduacao/inteligencia-artificial/) e [EC](https://portal.cin.ufpe.br/graduacao/engenharia-da-computacao/). Armazenar arquivos de dados versionados no repositório e carregar por seed explícito; não consultar ou extrair essas páginas durante o uso da aplicação.

Algumas disciplinas de IA aparecem sem código definitivo na página pública. Elas terão identificadores internos estáveis, separados do campo opcional de código institucional, e serão apresentadas pelo nome. Um mesmo código pode ter carga horária distinta entre cursos; o identificador interno sempre incluirá a matriz.

Pré-requisitos só serão cadastrados quando houver fonte verificável para a matriz correspondente. Para disciplinas sem regras confirmadas, o sistema deve marcar a verificação de pré-requisitos como incompleta e mostrar esse limite no planejamento. Lista vazia de pré-requisitos não deve ser apresentada como prova de que a disciplina não possui pré-requisitos. O planejamento continuará validando apenas as dependências efetivamente cadastradas, sem inventar regras.

## Modelo e migração

Criar uma entidade de matriz com curso, identificador de versão, semestre inicial de vigência e URL de fonte. Associar cada disciplina a exatamente uma matriz, mantendo seu identificador interno globalmente único. Guardar código institucional opcional separadamente. Pré-requisitos devem apontar para disciplinas da mesma matriz; validar essa regra na carga e na API.

Migrar as disciplinas atuais de SI para uma matriz `SI-demo`, preservando seus IDs, os IDs dos pré-requisitos, históricos, layouts e planos existentes. O seed de SI permanece idempotente; os novos seeds não substituem dados editados. Não remover nem reescrever registros pessoais durante a migração.

Vincular cada estudante a uma matriz disponível a partir de curso e semestre de ingresso. Como esta entrega inclui uma matriz por novo curso, ingressos anteriores a 2024.1 em CC/EC ou 2025.1 em IA não receberão uma grade inadequada: poderão entrar na conta e verão uma mensagem de turma ainda não atendida. SI continua usando sua matriz demonstrativa enquanto sua validação institucional estiver pendente. A API é responsável por informar a disponibilidade da matriz; a interface não deve duplicar a decisão.

## Fluxo da aplicação

Todos os endpoints de histórico, progressão, simulação e plano carregarão somente a matriz do estudante autenticado. A edição do histórico oferecerá apenas disciplinas dessa matriz e rejeitará IDs de outra. A importação legada da coordenação continuará restrita a contas provisionadas por ela e usará a matriz do estudante. Nenhum plano poderá referenciar IDs de outro curso. O frontend exibirá curso e versão da matriz, fonte e aviso de regras incompletas onde couber.

Uma conta sem matriz aplicável terá histórico legível, mas não poderá registrar disciplinas nem abrir o planejador. Isso impede que o aluno use por engano uma grade de outra turma. O usuário verá a razão e a vigência da matriz disponível.

## Erros e verificação

Dados de origem malformados, IDs repetidos, pré-requisitos externos à matriz e grafos cíclicos devem falhar na carga, antes de disponibilizar a grade. Matrícula em curso sem matriz aplicável recebe um estado de indisponibilidade distinto de erro inesperado. IDs de disciplinas de outra matriz em histórico, simulação ou plano retornam erro de validação sem alterar dados.

Verificar com testes: migração preserva os IDs e planos de SI; seed repetido não duplica nem sobrescreve dados; cada curso recebe somente suas disciplinas; tentativas de cruzar IDs entre cursos são rejeitadas; limites de 2024.1/2025.1 selecionam a matriz correta; cadastro, histórico, simulação, salvamento e novo login funcionam nos quatro cursos; avisos de pré-requisitos não verificados aparecem sem prometer elegibilidade oficial.

## Fora deste recorte

Matrizes antigas, equivalências entre cursos, integralização por créditos/horas, oferta, choque de horários, recuperação de senha e integração automática com SIGAA ficam fora desta mudança.
