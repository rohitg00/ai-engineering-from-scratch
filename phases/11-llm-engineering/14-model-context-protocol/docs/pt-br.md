# Model Context Protocol (MCP)

> Toda aplicação LLM construída antes de 2025 inventou seu próprio schema de tools. Depois a Anthropic lançou MCP, Claude adotou, OpenAI adotou, e em 2026 é o formato padrão para conectar qualquer LLM a qualquer tool, fonte de dados ou agent. Escreva um MCP server e todo host fala com ele.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 11 · 09 (Function Calling), Fase 11 · 03 (Structured Outputs)
**Tempo:** ~75 minutos

## O Problema

Você envia um chatbot que precisa de três tools: consulta ao banco, API de calendário e leitor de arquivos. Escreve três JSON schemas para Claude. Depois vendas quer as mesmas tools no ChatGPT — reescreve para o parâmetro `tools` da OpenAI. Depois adiciona Cursor, Zed e Claude Code — mais três reescritas. Uma semana depois, a Anthropic adiciona um campo novo; você atualiza seis schemas.

MCP colapsa essa matriz. Uma spec baseada em JSON-RPC. Um server expõe tools, resources e prompts. Qualquer host compatível — Claude Desktop, ChatGPT, Cursor, Claude Code, Zed — pode descobrir e chamar sem cola customizada.

## O Conceito

### Os Três Primitivos

1. **Tools** — funções que o modelo pode chamar. Analog dos `tools` da OpenAI ou `tool_use` da Anthropic
2. **Resources** — conteúdo read-only que o modelo ou usuário pode requisitar (arquivos, linhas de DB, respostas de API). Endereçados por URI
3. **Prompts** — templates reutilizáveis que o usuário pode invocar como atalhos

### O Formato de Transmissão

JSON-RPC 2.0 over stdio, WebSocket ou streamable HTTP. Cada mensagem é `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}`.

Métodos de descoberta: `tools/list`, `resources/list`, `prompts/list`
Métodos de invocação: `tools/call`, `resources/read`, `prompts/get`

## Construa

### Passo 1: MCP Server Mínimo

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Soma dois inteiros."""
    return a + b

@mcp.resource("config://app")
def app_config() -> str:
    """Retorna config JSON atual do app."""
    return '{"env": "prod", "region": "us-east-1"}'

@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """Revisa código para correção e estilo."""
    return f"Você é um revisor sênior de {language}. Revise:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

### Passo 2: Chamando um MCP Server

```python
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp import ClientSession

params = StdioServerParameters(command="python", args=["server.py"])

async def call_add(a: int, b: int) -> int:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool("add", {"a": a, "b": b})
            return int(result.content[0].text)
```

### Passo 3: Streamable HTTP

```python
# Dentro do entrypoint do server
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

Config do host (Claude Desktop `mcp.json`):

```json
{
  "mcpServers": {
    "demo": {
      "type": "http",
      "url": "https://tools.example.com/mcp"
    }
  }
}
```

### Passo 4: Segurança

- **Capability allowlists**: Hosts expõem capability `roots` para limitar paths
- **Human-in-the-loop para mutação**: Tools read-only podem auto-executar. Write/delete precisam de confirmação
- **Defesa contra tool poisoning**: Trate conteúdo de resource como dados não confiáveis

## Use

| Situação | Escolha |
|----------|---------|
| Dev local, tools single-user | Python `FastMCP`, transport stdio |
| Tools remotas / SaaS | Streamable HTTP, OAuth 2.1 |
| Host TypeScript | `@modelcontextprotocol/sdk` |
| Servidor high-throughput | Rust SDK (`modelcontextprotocol/rust-sdk`) |
| Explorar ecossistema | `modelcontextprotocol/servers` monorepo |

## Entregue

- `outputs/skill-mcp-server-designer.md` — skill para projetar e scaffold um MCP server com tools, resources e defaults de segurança

## Exercícios

1. **Fácil**: Estenda o `demo-server` com uma tool `subtract`. Conecte do Claude Desktop.

2. **Médio**: Adicione um `resource` expondo as últimas 100 linhas de `/var/log/app.log`. Enforce allowlist de roots.

3. **Difícil**: Construa um proxy MCP que multiplexa três servers upstream em uma superfície agregada.

## Termos-Chave

| Termo | O que o pessoal diz | O que realmente significa |
|-------|--------------------|-----------------------|
| MCP | "Protocolo de tools para LLMs" | Spec JSON-RPC 2.0 para expor tools, resources e prompts a qualquer host |
| Host | "Claude Desktop" | A aplicação LLM — owns o modelo e UI do usuário |
| Client | "Conexão" | Conexão por server dentro do host que fala JSON-RPC |
| Server | "O thing com as tools" | Seu código; anuncia tools/resources/prompts e lida com invocação |
| Tool | "Chamada de função" | Ação invocável pelo modelo com input JSON Schema e resultado texto/JSON |
| Resource | "Dados read-only" | Conteúdo endereçado por URI que o host pode requisitar |
| Prompt | "Prompt salvo" | Template invocável pelo usuário (frequentemente com argumentos) |

## Leitura Adicional

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification) — referência canônica
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — servers de referência
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) — SDK oficial
- [Security considerations for MCP](https://modelcontextprotocol.io/docs/concepts/security) — roots, destructive hints, tool poisoning
- [Anthropic — Introducing MCP](https://www.anthropic.com/news/model-context-protocol) — post de lançamento
