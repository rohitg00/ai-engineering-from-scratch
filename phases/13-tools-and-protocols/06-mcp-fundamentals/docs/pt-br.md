# Fundamentos do MCP — Primitivas, Ciclo de Vida, Base JSON-RPC

> Toda integração antes do MCP era uma exceção. O Model Context Protocol, lançado pela Anthropic em novembro de 2024 e agora administrado pela Agentic AI Foundation da Linux Foundation, padroniza descoberta e invocação pra que qualquer cliente possa falar com qualquer servidor. A eespecificaçãoificação 2025-11-25 nomeia seis primitivas (três do servidor, três do cliente), um ciclo de vida de três fases e um formato de rede JSON-RPC 2.0. Aprenda essas e o resto do capítulo MCP desta fase vira leitura.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, parser JSON-RPC)
**Pré-requisitos:** Fase 13 · 01 até 05 (a interface de ferramentas e function calling)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Nomear as seis primitivas MCP (tools, resources, prompts no servidor; roots, sampling, elicitation no cliente) e dar um caso de uso pra cada uma.
- Caminhar pelo ciclo de vida de três fases (inicialização, operação, desligamento) e apontar quem envia qual mensagem em cada fase.
- Fazer parse e emitir envelopes de request, response e notification JSON-RPC 2.0.
- Explicar o que é a negociação de capacidades no `initialize` e o que quebra sem ela.

## O Problema

Antes do MCP, todo agente que usava ferramentas tinha seu próprio protocolo. Cursor tinha um sistema de ferramentas em forma MCP mas incompatível. Claude Desktop saiu com outro diferente. A extensão Copilot do VS Code tinha um terceiro. Uma equipe que construiu uma ferramenta "Postgres consulta" escreveu a mesma ferramenta três vezes, cada uma pra uma API de host diferente. Reutilizá-la exigia copiar código.

O resultado foi uma explosão cambriana de integrações pontuais e um teto na velocidade do ecossistema.

MCP resolve isso padronizando o formato de rede. Um único servidor MCP funciona em todo cliente MCP: Claude Desktop, ChatGPT, Cursor, VS Code, Gemini, Goose, Zed, Windsurf, 300+ clientes em abril de 2026. 110 milhões de downloads mensais de SDK. 10.000+ servidores públicos. A Linux Foundation assumiu a administração em dezembro de 2025 sob a nova Agentic AI Foundation.

A revisão da eespecificaçãoificação usada nesta fase é a **2025-11-25**. Ela adiciona Tasks assíncronas (SEP-1686), elicitação em modo URL (SEP-1036), sampling com ferramentas (SEP-1577), consentimento incremental de escopo (SEP-835) e semântica de resource indicators do OAuth 2.1. Fase 13 · 09 até 16 cobrem essas extensões. Esta aula para na base.

## O Conceito

### Três primitivas do servidor

1. **Tools.** Ações chamáveis. Mesmo loop de quatro passos da Fase 13 · 01.
2. **Resources.** Dados expostos. Conteúdo somente leitura endereçável por URI: `file:///path`, `db://consulta/...`, esquemas custom.
3. **Prompts.** Templates reutilizáveis. Slash-commands na interface do host; servidor fornece o template, cliente preenche os argumentos.

### Três primitivas do cliente

4. **Roots.** O conjunto de URIs que o servidor pode tocar. Cliente declara; servidor respeita.
5. **Sampling.** Servidor solicita que o modelo do cliente faça uma completion. Permite loops de agente hospedados no servidor sem chaves de API do lado do servidor.
6. **Elicitation.** Servidor pergunta ao usuário do cliente por entrada estruturada no meio do caminho. Formulários ou URLs (SEP-1036).

Toda capacidade no MCP pertence a exatamente uma dessas seis. Fase 13 · 10 até 14 cobrem cada uma em profundidade.

### Formato de rede: JSON-RPC 2.0

Toda mensagem é um objeto JSON com esses campos:

- Requests: `{jsonrpc: "2.0", id, method, params}`.
- Responses: `{jsonrpc: "2.0", id, result | error}`.
- Notifications: `{jsonrpc: "2.0", method, params}` — sem `id`, sem resposta esperada.

A eespecificaçãoificação base tem ~15 métodos, agrupados por primitiva. Os importantes:

- `initialize` / `initialized` (handshake)
- `tools/list`, `tools/call`
- `resources/list`, `resources/read`, `resources/subscribe`
- `prompts/list`, `prompts/get`
- `sampling/createMessage` (servidor pra cliente)
- `notifications/tools/list_changed`, `notifications/resources/updated`, `notifications/progress`

### Ciclo de vida de três fases

**Fase 1: inicialização.**

Cliente envia `initialize` com suas `capabilities` e `clientInfo`. Servidor responde com suas próprias `capabilities`, `serverInfo` e a versão da eespecificaçãoificação que fala. Cliente envia `notifications/initialized` quando digeriu a resposta. A partir daqui, qualquer lado pode enviar requests conforme as capacidades negociadas.

**Fase 2: operação.**

Bidirecional. Cliente chama `tools/list` pra descobrir, depois `tools/call` pra invocar. Servidor pode enviar `sampling/createMessage` se declarou essa capacidade. Servidor pode enviar `notifications/tools/list_changed` quando seu conjunto de ferramentas muta. Cliente pode enviar `notifications/roots/list_changed` quando o usuário muda o escopo de roots.

**Fase 3: desligamento.**

Qualquer lado fecha o transporte. Sem método estruturado de desligamento no MCP; o transporte (stdio ou Streamable HTTP, Fase 13 · 09) carrega o sinal de fim de conexão.

### Negociação de capacidades

`capabilities` no handshake `initialize` é o contrato. Exemplo de um servidor:

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

O servidor declara que pode emitir notificações `tools/list_changed` e suporta `resources/subscribe`. O cliente concorda declarando as suas:

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

Se o cliente não declara `sampling`, o servidor não pode chamar `sampling/createMessage`. Simétrico: se o servidor não declara `resources.subscribe`, o cliente não deve tentar se inscrever.

Isso é o que impede deriva do ecossistema. Um cliente que não suporta sampling ainda é um cliente MCP válido; um servidor que não chama `sampling` ainda é um servidor MCP válido. Eles simplesmente não usam essa funcionalidade juntos.

### Conteúdo estruturado e formas de erro

`tools/call` retorna um array `content` de blocos tipados: `text`, `image`, `resource`. Fase 13 · 14 adiciona MCP Apps (`ui://` UI interativa) a essa lista.

Erros usam códigos de erro JSON-RPC. Adições definidas na eespecificaçãoificação: `-32002` "Recurso não encontrado", `-32603` "Erro interno", mais dados de erro eespecificaçãoíficos do MCP como `error.data`.

### Capacidades do cliente vs. detalhes da chamada de ferramenta

Confusão comum: `capabilities.tools` indica se o cliente suporta notificações de tool-list-changed. Se o cliente VAI chamar ferramentas eespecificaçãoíficas é uma escolha em runtime dirigida pelo seu modelo, não uma flag de capacidade. A flag de capacidade é o contrato em nível de eespecificaçãoificação. A escolha do modelo é ortogonal.

### Por que JSON-RPC e não REST?

JSON-RPC 2.0 (2010) é um protocolo leve e bidirecional. REST é iniciado pelo cliente. MCP precisava de mensagens iniciadas pelo servidor (sampling, notificações), então JSON-RPC com sua forma simétrica de request/response se encaixou naturalmente. JSON-RPC também compõe limpo sobre stdio e WebSocket/Streamable HTTP sem reinventar a forma de request do HTTP.

## Use

`code/main.py` entrega um parser e emissor mínimo de JSON-RPC 2.0, depois caminha pela sequência `initialize` → `tools/list` → `tools/call` → `shutdown` à mão, imprimindo cada mensagem. Sem transporte real; só as formas de mensagem. Compare com a eespecificaçãoificação链接 nas Leituras Complementares pra verificar cada envelope.

O que conferir:

- `initialize` declara capacidades nos dois lados; a resposta tem `serverInfo` e `protocolVersion: "2025-11-25"`.
- `tools/list` retorna um array `tools`; cada entrada tem `name`, `description`, `inputSchema`.
- `tools/call` usa `params.name` e `params.arguments`.
- O `content` da resposta é um array de blocos `{type, text}`.

## Entregue

Esta aula produz `outputs/skill-mcp-handshake-tracer.md`. Dada uma transcrição estilo pcap de uma interação cliente-servidor MCP, a skill anota cada mensagem indicando qual primitiva, qual fase do ciclo de vida e qual capacidade ela depende.

## Exercícios

1. Rode `code/main.py`. Identifique a linha onde a negociação de capacidades acontece e descreva o que mudaria se o servidor não declarasse `tools.listChanged`.

2. Estenda o parser pra lidar com `notifications/progress`. Forma da mensagem: `{method: "notifications/progress", params: {progressToken, progress, total}}`. Emita enquanto um `tools/call` de longa duração está em progresso e confirme que o handler do cliente exibiria uma barra de progresso.

3. Leia a eespecificaçãoificação MCP 2025-11-25 de ponta a ponta — o documento inteiro tem cerca de 80 páginas. Identifique a flag de capacidade que mais servidores NÃO precisam. Dica: ela diz respeito a assinatura de recursos.

4. Esboce no papel a primitiva que uma funcionalidade hipotética de "cron job" pertenceria. (Dica: o servidor quer que o cliente invoque num horário agendado. Nenhuma das seis primitivas se encaixa hoje.) O roadmap do MCP pra 2026 tem um SEP rascunhado pra isso.

5. Faça parse de um log de sessão de um servidor MCP aberto no GitHub. Conte mensagens de request vs. response vs. notification. Compute que fração do tráfego é ciclo de vida vs. operação.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| MCP | "Model Context Protocol" | Protocolo aberto pra descoberta e invocação model-to-tool |
| Primitiva do servidor | "O que um servidor expõe" | ferramentas (ações), resources (dados), prompts (templates) |
| Primitiva do cliente | "O que um cliente deixa servidores usarem" | roots (escopo), sampling (callbacks de LLM), elicitation (entrada do usuário) |
| JSON-RPC 2.0 | "O formato de rede" | Envelopes simétricos de request/response/notification |
| Handshake `initialize` | "Negociação de capacidades" | Primeiro par de mensagens; servidores e clientes declaram funcionalidades que suportam |
| `tools/list` | "Descoberta" | Cliente pergunta ao servidor seu conjunto atual de ferramentas |
| `tools/call` | "Invocação" | Cliente pede ao servidor pra executar uma ferramenta com argumentos |
| `notifications/*_changed` | "Eventos de mutação" | Servidor diz ao cliente que sua lista de primitivas mudou |
| Bloco de conteúdo | "Resultado tipado" | `{type: "text" \| "image" \| "resource" \| "ui_resource"}` no resultado da ferramenta |
| SEP | "Proposta de Evolução da Eespecificaçãoificação" | Proposta rascunhada nomeada (ex. SEP-1686 pra Tasks assíncronas) |

## Leituras Complementares

- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25) — o documento de eespecificaçãoificação canônico
- [Model Context Protocol — Architecture concepts](https://modelcontextprotocol.io/docs/concepts/architecture) — o modelo mental de seis primitivas
- [Anthropic — Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — post de lançamento de novembro 2024
- [MCP blog — First MCP anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — retroespecificaçãotiva de um ano e mudanças na eespecificaçãoificação 2025-11-25
- [WorkOS — MCP 2025-11-25 especificação update](https://workos.com/blog/mcp-2025-11-25-especificação-update) — resumo dos SEP-1686, 1036, 1577, 835 e 1724
