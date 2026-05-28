# Construindo um Servidor MCP — SDKs Python + TypeScript

> A maioria dos tutoriais de MCP mostra só stdio hello-worlds. Um servidor real expõe ferramentas mais resources mais prompts, lida com negociação de capacidades, emite erros estruturados e funciona igual entre SDKs. Esta aula constrói um servidor de notas de ponta a ponta: transporte stdlib stdio, dispatch JSON-RPC, as três primitivas do servidor e um estilo de função pura que migra pro FastMCP (SDK Python) ou pro SDK TypeScript quando você quiser escalar.

**Tipo:** Construir
**Linguagens:** Python (stdlib, servidor MCP via stdio)
**Pré-requisitos:** Fase 13 · 06 (fundamentos do MCP)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar os métodos `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list` e `prompts/get`.
- Escrever um loop de dispatch que lê mensagens JSON-RPC de stdin e escreve respostas em stdout.
- Emitir respostas de erro estruturadas conforme a eespecificaçãoificação JSON-RPC 2.0 e códigos adicionais do MCP.
- Migrar uma implementação stdlib pro FastMCP (SDK Python) ou pro SDK TypeScript sem reescrever a lógica de ferramentas.

## O Problema

Antes de usar um transporte remoto (Fase 13 · 09) ou uma camada de auth (Fase 13 · 16), você precisa de um servidor local limpo. Local significa stdio: o servidor é spawnado pelo cliente como processo filho, mensagens fluem via stdin/stdout delimitadas por newline.

A eespecificaçãoificação 2025-11-25 prescreve que mensagens stdio são codificadas como objetos JSON com separador `\n` explícito. Sem SSE aqui; SSE era o modo remoto antigo e está sendo removido no meio de 2026 (o servidor Rovo MCP da Atlassian deprecou em 30 de junho de 2026; Keboola em 1º de abril de 2026). Pra stdio, um objeto JSON por linha é o formato de rede completo.

Um servidor de notas é uma boa forma porque exerce todas as três primitivas do servidor. Tools fazem mutações (`notes_create`). Resources expõem dados (`notes://{id}`). Prompts fornecem templates (`review_note`). A forma desta aula se generaliza pra qualquer domínio.

## O Conceito

### Loop de dispatch

```
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

Três regras:

- Não imprima nada em stdout que não seja um envelope JSON-RPC. Logs de debug vão pra stderr.
- Todo request DEVE ser combinado com uma resposta contendo o mesmo `id`.
- Notifications NÃO DEVEM receber resposta.

### Implementando `initialize`

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

Declare só o que você suporta. O cliente depende do conjunto de capacidades pra controlar funcionalidades.

### Implementando `tools/list` e `tools/call`

`tools/list` retorna `{tools: [...]}` com cada entrada tendo `name`, `description`, `inputSchema`. `tools/call` recebe `{name, arguments}` e retorna `{content: [blocks], isError: bool}`.

Blocos de conteúdo são tipados. Os mais comuns:

```json
{"type": "text", "text": "Encontrei 2 notas"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

Erros de ferramenta vêm em duas formas. Erros de nível de protocolo (método desconhecido, params ruins) são erros JSON-RPC. Erros de nível de ferramenta (chamada válida mas a ferramenta falhou) são retornados como `{content: [...], isError: true}`. Isso permite que o modelo veja a falha em seu contexto.

### Implementando resources

Resources são somente leitura por design. `resources/list` retorna um manifesto; `resources/read` retorna o conteúdo. URIs podem ser `file://...`, `http://...` ou um esquema custom como `notes://`.

Quando você expõe dados como resource em vez de tool:

- O modelo não "chama"; o cliente pode injetar no contexto a pedido do usuário.
- Assinaturas permitem que o servidor envie atualizações quando o resource muda (Fase 13 · 10).
- Fase 13 · 14 estende isso com `ui://` pra resources interativos.

### Implementando prompts

Prompts são templates com argumentos nomeados. O host os mostra como slash-commands. Um prompt `review_note` pode receber um argumento `note_id` e produzir um template de múltiplas mensagens que o cliente alimenta ao seu modelo.

### Subtlezas do transporte stdio

- JSON delimitado por newline. Sem framing com prefixo de tamanho.
- Não faça buffer. `sys.stdout.flush()` depois de cada escrita.
- O cliente controla a vida útil. Quando stdin fecha (EOF), saia limpo.
- Não trate SIGPIPE silenciosamente; registre e saia.

### Anotações

Cada ferramenta pode carregar `annotations` descrevendo propriedades de segurança:

- `readOnlyHint: true` — leitura pura, seguro pra retry.
- `destructiveHint: true` — efeitos colaterais irreversíveis; cliente deve confirmar.
- `idempotentHint: true` — mesmos inputs produzem mesmos outputs.
- `openWorldHint: true` — interage com sistemas externos.

O cliente usa isso pra decidir UX (diálogos de confirmação, indicadores de status) e roteamento (Fase 13 · 17).

### Caminho de migração

O servidor stdlib em `code/main.py` tem cerca de 180 linhas. FastMCP (Python) comprime a mesma lógica pra estilo de decorator:

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(consulta: str, limit: int = 10) -> list[dict]:
    ...
```

O SDK TypeScript tem uma forma equivalente. O caminho de migração é drop-in quando você estiver pronto; os conceitos (capacidades, dispatch, blocos de conteúdo) são os mesmos.

## Use

`code/main.py` é um servidor MCP completo de notas via stdio, só stdlib. Ele lida com `initialize`, `tools/list`, `tools/call` pra três ferramentas (`notes_list`, `notes_search`, `notes_create`), `resources/list` e `resources/read` pra cada nota, e um prompt `review_note`. Você pode dirigir ele enviando mensagens JSON-RPC:

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

O que conferir:

- O dispatcher é um `dict[str, Callable]` indexado por nome de método.
- Todo executor de ferramenta retorna uma lista de blocos de conteúdo, não uma string crua.
- `isError: true` é setado quando o executor levanta exceção.

## Entregue

Esta aula produz `outputs/skill-mcp-server-scaffolder.md`. Dado um domínio (notas, tickets, arquivos, banco de dados), a skill scaffolds um servidor MCP com a divisão correta de ferramentas / resources / prompts e caminho de migração pro SDK.

## Exercícios

1. Rode `code/main.py` e dirija com mensagens JSON-RPC feitas à mão. Exercite `notes_create`, depois `resources/read` pra recuperar a nova nota.

2. Adicione uma ferramenta `notes_delete` com `annotations: {destructiveHint: true}`. Verifique que o cliente exibiria um diálogo de confirmação (isso requer um host real; Claude Desktop funciona).

3. Implemente `resources/subscribe` pra que o servidor envie `notifications/resources/updated` sempre que uma nota for modificada. Adicione uma tarefa de keepalive.

4. Porte o servidor pro FastMCP. O arquivo Python deve encolher pra menos de 80 linhas. O comportamento na rede deve ser idêntico; verifique com o mesmo harness de teste JSON-RPC.

5. Leia a seção `server/tools` da eespecificaçãoificação e identifique um campo de definição de ferramenta não implementado no servidor desta aula. (Dica: há vários; escolha um e adicione.)

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Servidor MCP | "A coisa que expõe ferramentas" | Processo que fala JSON-RPC MCP via stdio ou HTTP |
| Transporte stdio | "Modelo de processo filho" | Servidor spawnado pelo cliente; comunica via stdin/stdout |
| Dispatcher | "Roteador de métodos" | Mapa de nome de método JSON-RPC pra função handler |
| Bloco de conteúdo | "Pedaço de resultado da ferramenta" | Elemento tipado no array `content` de uma resposta de ferramenta |
| `isError` | "Falha de nível de ferramenta" | Sinaliza que a ferramenta falhou; distingue de erro JSON-RPC |
| Anotações | "Dicas de segurança" | Flags readOnly / destructive / idempotent / openWorld |
| FastMCP | "SDK Python" | Framework baseado em decorators acima do protocolo MCP |
| URI de resource | "Dados endereçáveis" | `file://`, `db://` ou esquema custom identificando um resource |
| Template de prompt | "Brief de slash-command" | Template fornecido pelo servidor com slots de argumento pra interfaces do host |
| Declaração de capacidades | "Toggle de funcionalidade" | Flags por primitiva declaradas no `initialize` |

## Leituras Complementares

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — a implementação Python de referência
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — implementação TS paralela
- [FastMCP — server framework](https://gofastmcp.com/) — API Python baseada em decorators pra servidores MCP
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) — tutorial ponta a ponta usando qualquer SDK
- [MCP — Server ferramentas especificação](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/server/tools) — referência completa pra mensagens tools/*
