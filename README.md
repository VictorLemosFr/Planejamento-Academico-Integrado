# Planejamento Acadêmico Integrado

Ferramenta de apoio à decisão para o estudante visualizar sua progressão acadêmica, simular cenários e planejar sua trajetória até a conclusão do curso. O SIGAA permanece responsável pelo histórico oficial e pela efetivação da matrícula.

Projeto da disciplina **Integração e Evolução de Sistemas de Informação (IESI)**, com orientação do **Prof. Paulemir Gonçalves Campos**.

## Estado atual

O repositório contém um protótipo navegável em HTML, CSS e JavaScript, com dados demonstrativos de Sistemas de Informação do CIn/UFPE. Ainda não há backend, banco de dados, autenticação ou importação do SIGAA. A arquitetura documentada descreve o sistema proposto.

O protótipo permite consultar o mapa curricular, visualizar dependências, filtrar disciplinas, simular aprovações e planejar disciplinas para o próximo semestre. Os cenários e as alterações existem apenas na memória do navegador; recarregar a página restaura os dados iniciais.

## Executar o protótipo

Abra [prototipo/index.html](prototipo/index.html) diretamente em um navegador. Não é necessário instalar dependências ou configurar serviços.

Opcionalmente, com Python 3 instalado, execute na raiz do projeto:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory prototipo
```

Acesse `http://localhost:8000`. Encerre o servidor com `Ctrl+C`.

## Documentação

- [Arquitetura proposta](docs/arquitetura.md): quatro domínios, diagramas C4, módulos, dados e justificativas.
- [Escopo e requisitos](docs/escopo.md): atores, fluxo de planejamento, responsabilidades e decisões abertas.
- [Guia do protótipo](docs/prototipo.md): cenários, regras demonstrativas, limitações e roteiro de validação manual.

## Organização

```text
docs/
  arquitetura.md
  escopo.md
  prototipo.md
prototipo/
  index.html
LICENSE
README.md
```

A evolução prevista é uma aplicação web com API HTTP/JSON em monolito modular, banco relacional e hospedagem gerenciada. Frameworks, linguagem do backend, banco específico e provedor ainda não foram escolhidos.

## Licença

[MIT](LICENSE).
