# Resources e Prompts MCP — Exposição de Contexto Além de Ferramentas

> Ferramentas pegam 90 por cento da atenção do MCP. As outras duas primitivas do servidor resolvem problemas diferentes. Resources expõem dados pra leitura; prompts expõem templates reutilizáveis como slash-commands. Muitos servidores devem usar resources em vez de embrulhar leituras em ferramentas, e prompts em vez de codificar fluxos de trabalho nos prompts do cliente. Esta aula nomeia a regra de decisão e caminha pelas mensagens `resources/*` e `prompts/*`.

**Tipo:** Construir
**Linguagens:** Python (stdlib, handler de resource + prompt)
**Pré-requisitos:** Fase 13 · 07 (servidor MCP)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Decidir entre expor uma funcionalidade como tool, resource ou prompt pra um domínio dado.
- Implementar `resources/list`, `resources/read`, `resources/subscribe` e lidar com `notifications/resources/updated`.
- Implementar `prompts/list` e `prompts/get` com templates de argumento.
- Reconhecer quando o host mostra prompts como slash-commands vs. contexto injetado automaticamente.

## O Problema

Um servidor MCP simplista pra uma aplicação de notas expõe tudo como tools: `notes_read`, `notes_list`, `notes_search`. Isso embrulha cada acesso a dados numa chamada de ferramenta dirigida pelo modelo. Consequências:

- O modelo tem que decidir se chama `notes_read` pra cada consulta que se beneficiaria de contexto.
- Conteúdo somente leitura não pode ser assinado nem transmitido pro painel lateral do host.
- Interfaces do cliente (painel de anexo de resources do Claude Desktop, seletor "Incluir arquivo" do Cursor) não conseguem mostrar os dados.

A divisão correta: expor dados como resource, expor ações mutantes ou computadas como tools, expor fluxos de trabalho multi-etapa reutilizáveis como prompts. Cada primitiva tem sua affordance de UX e seu padrão de acesso.

## O Conceito

### Tools vs. resources vs. prompts — a regra de decisão

| Funcionalidade | Primitiva |
|----------------|-----------|
| Usuário quer pesquisar, filtrar ou transformar dados | ferramenta |
| Usuário quer que o host inclua esses dados como contexto | resource |
| Usuário quer um fluxo de trabalho template que pode re-executar | prompt |

Diretriz: se o modelo se beneficiaria de chamar em cada consulta relacionada, é uma tool. Se o usuário se beneficiaria de anexar à conversa, é um resource. Se um fluxo de trabalho multi-etapa inteiro é a unidade que o usuário quer reusar, é um prompt.

### Resources

`resources/list` retorna `{resources: [{uri, name, mimeType, description?}]}`. `resources/read` recebe `{uri}` e retorna `{contents: [{uri, mimeType, text | blob}]}`.

URIs podem ser qualquer coisa endereçável:

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/consulta/SELECT ...`
- `notes://note-14` (esquema custom)
- `memory://session-2026-04-22/recent` (eespecificaçãoífico do servidor)

`contents[]` suporta tanto texto quanto binário. Binário usa `blob` como string base64-encoded mais um `mimeType`.

### Assinaturas de resources

Declare `{resources: {subscribe: true}}` nas capacidades. Cliente chama `resources/subscribe {uri}`. Servidor envia `notifications/resources/updated {uri}` quando o resource muda. Cliente relê.

Caso de uso: um servidor de notas cujos resources são arquivos em disco; um file watcher dispara notificações de atualização; Claude Desktop rebusca o arquivo pro contexto quando editado fora do host.

### Templates de resources (adição 2025-11-25)

`resourceTemplates` permitem expor um padrão de URI parametrizado: `notes://{id}` com `id` como alvo de autocompletar. O cliente pode autocompletar ids no seletor de resources.

### Prompts

`prompts/list` retorna `{prompts: [{name, description, arguments?}]}`. `prompts/get` recebe `{name, arguments}` e retorna `{description, messages: [{role, content}]}`.

Um prompt é um template que preenche para uma lista de mensagens que o host alimenta ao seu modelo. Por exemplo, um prompt `code_review` recebe um argumento `file_path` e retorna uma sequência de três mensagens: uma mensagem de sistema, uma mensagem do usuário com o corpo do arquivo, e um kickoff do assistant com um template de raciocínio.

### Hosts e prompts

Claude Desktop, VS Code e Cursor mostram prompts como slash-commands na interface de chat. O usuário digita `/code_review` e escolhe argumentos de um formulário. O prompt do servidor é o atalho entre "atalho do usuário" e "prompt completo enviado pro modelo".

Nem todo cliente suporta prompts ainda — verifique a negociação de capacidades. Um servidor com capacidade de prompt declarada mas um cliente sem suporte a prompts simplesmente não verá os slash commands.

### A notification "list changed"

Tanto resources quanto prompts emitem `notifications/list_changed` quando o conjunto muta. Um servidor de notas que acabou de importar 20 novas notas emite `notifications/resources/list_changed`; o cliente rechama `resources/list` pra pegar as adições.

### Convenções de tipo de conteúdo

Pra texto: `mimeType: "text/plain"`, `text/markdown`, `application/json`.
Pra binário: `image/png`, `application/pdf`, mais o campo `blob`.
Pra MCP Apps (Aula 14): `text/html;profile=mcp-app` numa URI `ui://`.

### Resources dinâmicos

Uma URI de resource não precisa corresponder a um arquivo estático. `notes://recent` pode retornar as cinco notas mais recentes em cada leitura. `db://consulta/users/active` pode executar uma consulta parametrizada. O servidor é livre pra computar conteúdo dinamicamente.

Regra: se o cliente pode cache por URI, a URI deve ser estável. Se a computação é one-shot, a URI deve incluir um timestamp ou nonce pra que o cache do cliente não fique obsoleto.

### Assinaturas vs. polling

Clientes com capacidade de assinatura recebem push do servidor via `notifications/resources/updated`. Clientes anteriores à assinatura ou hosts que não suportam fazem polling relendo. Ambos são compatíveis com a eespecificaçãoificação. A declaração de capacidade do servidor diz ao cliente qual usar.

Custo das assinaturas: estado por sessão no servidor (quem está assinando o quê). Mantenha o conjunto de assinaturas limitado; clientes desconectados devem expirar.

### Prompts vs. system prompts

Prompts no MCP não são system prompts. O system prompt do host (suas próprias instruções de operação) e os prompts MCP (templates fornecidos pelo servidor invocados pelo usuário) convivem lado a lado. Um cliente bem comportado nunca deixa um prompt de servidor sobrescrever seu próprio system prompt; ele os empilha.

## Use

`code/main.py` estende o servidor de notas da Aula 07 com:

- Resources por nota (`notes://note-1`, etc.) com suporte a `resources/subscribe`.
- Um prompt `review_note` que renderiza pra um template de três mensagens.
- Uma simulação de file watcher que emite `notifications/resources/updated` quando uma nota é modificada.
- Um resource dinâmico `notes://recent` que sempre retorna as cinco notas mais recentes.

Rode a demonstração pra ver o fluxo completo.

## Entregue

Esta aula produz `outputs/skill-primitive-splitter.md`. Dado um servidor MCP proposto, a skill categoriza cada funcionalidade como ferramenta / resource / prompt com justificativa.

## Exercícios

1. Rode `code/main.py`. Observe a lista inicial de resources, depois dispare uma edição de nota e verifique que o evento `notifications/resources/updated` dispara.

2. Adicione um emissor de `resources/list_changed`: quando uma nova nota for criada, envie a notificação pra que clientes redescubram.

3. Projete três prompts pra um servidor MCP de GitHub: `summarize_pr`, `triage_issue`, `release_notes`. Cada um com schemas de argumento. O corpo do prompt deve ser executável sem edições adicionais.

4. Pegue uma ferramenta existente no servidor da Aula 07 e classifique se deve permanecer como ferramenta ou ser dividida num par resource + tool. Justifique numa frase.

5. Leia as seções `server/resources` e `server/prompts` da eespecificaçãoificação. Identifique o único campo em `resources/read` que raramente é preenchido mas suportado pela eespecificaçãoificação. Dica: olhe `_meta` no conteúdo do resource.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Resource | "Dados expostos" | Conteúdo endereçável por URI que o host pode ler |
| URI de Resource | "Ponteiro pra dados" | Identificador com prefixo de esquema (`file://`, `notes://`, etc.) |
| `resources/subscribe` | "Observar mudanças" | Updates push do servidor a que o cliente optou pra uma URI eespecificaçãoífica |
| `notifications/resources/updated` | "Resource mudou" | Sinal pro cliente de que um resource assinado tem conteúdo novo |
| Template de resource | "URI parametrizado" | Padrão de URI com dicas de autocompletar pro seletor do host |
| Prompt | "Template de slash-command" | Template multi-mensagem nomeado com slots de argumento |
| Argumentos de prompt | "Entradas do template" | Parâmetros tipados que o host coleta antes de renderizar |
| `prompts/get` | "Renderizar template" | Servidor retorna a lista de mensagens preenchida |
| Bloco de conteúdo | "Pedaço tipado" | `{type: text \| image \| resource \| ui_resource}` |
| UX de slash-command | "Atalho do usuário" | Host mostra prompts como comandos começando com `/` |

## Leituras Complementares

- [MCP — Concepts: Resources](https://modelcontextprotocol.io/docs/concepts/resources) — URIs de resource, assinaturas e templates
- [MCP — Concepts: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) — templates de prompt e integração com slash-commands
- [MCP — Server resources especificação 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/server/resources) — referência completa de mensagens `resources/*`
- [MCP — Server prompts especificação 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/server/prompts) — referência completa de mensagens `prompts/*`
- [MCP — Protocol info site: resources](https://modelcontextprotocol.info/docs/concepts/resources/) — guia da comunidade expandindo a documentação oficial
