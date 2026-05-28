# MCP Apps — Resources de UI Interativa via `ui://`

> Saída de ferramenta só em texto limita o que agentes podem mostrar. MCP Apps (SEP-1724, oficial em 26 de janeiro de 2026) permitem que uma ferramenta retorne HTML interativo sandboxed renderizado inline no Claude Desktop, ChatGPT, Cursor, Goose e VS Code. Dashboards, formulários, mapas, cenas 3D, tudo através de uma extensão. Esta aula caminha pelo esquema de resource `ui://`, o MIME `text/html;profile=mcp-app`, o protocolo postMessage de iframe sandboxed e a superfície de segurança que vem com deixar um servidor renderizar HTML.

**Tipo:** Construir
**Linguagens:** Python (stdlib, emissor de resource de UI), HTML (app de exemplo)
**Pré-requisitos:** Fase 13 · 07 (servidor MCP), Fase 13 · 10 (resources)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Retornar um resource `ui://` de uma chamada de ferramenta e setar o MIME e metadados corretos.
- Declarar a UI associada de uma ferramenta com `_meta.ui.resourceUri`, `_meta.ui.csp` e `_meta.ui.permissions`.
- Implementar o JSON-RPC de postMessage de iframe sandboxed pra comunicação UI-host.
- Aplicar configurações-padrão de CSP e permissions-policy que defendam contra ataques originados pela UI.

## O Problema

Uma ferramenta `visualize_timeline` de 2025 pode retornar "Aqui estão 14 notas organizadas cronologicamente: ...". Isso é um parágrafo. Usuários na verdade querem a timeline interativa. Antes de MCP Apps, as opções eram: APIs de widgets eespecificaçãoíficas do cliente (artifacts do Claude, HTML de Custom GPT da OpenAI), ou nenhuma UI.

MCP Apps (SEP-1724, lançado em 26 de janeiro de 2026) padronizam o contrato. Um resultado de ferramenta contém um `resource` cuja URI é `ui://...` e cujo MIME é `text/html;profile=mcp-app`. O host renderiza em um iframe sandboxed com CSP limitado e sem acesso a rede a menos que explicitamente concedido. A UI dentro do iframe posta mensagens pro host via um pequeno dialeto de JSON-RPC sobre postMessage.

Todo cliente compatível (Claude Desktop, ChatGPT, Goose, VS Code) renderiza o mesmo resource `ui://` da mesma forma. Um servidor, um pacote HTML, UI universal.

## O Conceito

### O esquema de resource `ui://`

Uma ferramenta retorna:

```json
{
  "content": [
    {"type": "text", "text": "Aqui está sua timeline de notas:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

O host então chama `resources/read` na URI `ui://notes/timeline` e recebe:

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe sandboxed

O host renderiza o HTML dentro de um `<iframe>` sandboxed com:

- `sandbox="allow-scripts allow-same-origin"` (ou mais restritivo por declaração do servidor)
- CSP declarada pelo servidor aplicada via headers de resposta.
- Sem cookies, sem localStorage da origem do host.
- Acesso a rede limitado a `connectSrc` no CSP.

### Protocolo postMessage

O iframe comunica com o host via `window.postMessage`. Um pequeno dialeto JSON-RPC 2.0:

Fixe sempre `targetOrigin` na origem exata do par, e do lado receptor valide `event.origin` contra uma allowlist antes de processar qualquer payload. Nunca use `"*"` em nenhum lado desse canal — o corpo carrega chamadas de ferramenta e leituras de resource.

```js
// iframe pro host  (fixar na origem do host)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host pro iframe  (fixar na origem do iframe)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receptor em ambos os lados
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // seguro pra processar event.data
});
```

Métodos disponíveis do lado do host que a UI pode chamar:

- `host.callTool(name, arguments)` — invoca uma ferramenta do servidor.
- `host.readResource(uri)` — lê um resource MCP.
- `host.getPrompt(name, arguments)` — busca um template de prompt.
- `host.close()` — dispensa a UI.

Toda chamada ainda passa pelo protocolo MCP e herda as permissões do servidor.

### Permissões

A lista `_meta.ui.permissions` solicita funcionalidades extras:

- `camera` — acessar a câmera do usuário (usado em UIs de escaneamento de documento).
- `microphone` — entrada de voz.
- `geolocation` — localização.
- `network:*` — acesso a rede mais amplo que `connectSrc` sozinho permite.

Cada permissão é uma prompt que o usuário vê antes da UI renderizar.

### Riscos de segurança

HTML num iframe continua sendo HTML. Nova superfície de ataque:

- **Injeção de prompt via UI.** Uma UI maliciosa do servidor pode mostrar texto que parece mensagem de sistema e engana o host. Renderização do host deve distinguir visualmente UI do servidor da UI do host.
- **Exfiltração via `connectSrc`.** Se CSP permite `connect-src: *`, a UI pode enviar dados pra qualquer lugar. Default deve ser restritivo.
- **Clickjacking.** A UI sobrepõe chrome do host. Hosts devem prevenir manipulação de z-index e aplicar regras de opacidade.
- **Roubo de foco.** UI captura foco de teclado e captura a próxima mensagem. Hosts devem interceptar.

Fase 13 · 15 cobre isso em profundidade como parte da segurança MCP; esta aula introduz.

### Handshake `ui/initialize`

Após o iframe carregar, ele envia `ui/initialize` via postMessage:

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

Host responde com capacidades e um token de sessão. A UI usa o token de sessão em toda chamada subsequente ao host.

### Primitivas de SDK AppRenderer / AppFrame

O SDK ext-apps expõe duas primitivas de conveniência:

- `AppRenderer` (lado do servidor) — embrulha um componente React / Vue / Solid e emite um resource `ui://` com o MIME e metadados corretos.
- `AppFrame` (lado do cliente) — recebe o resource, monta o iframe e media o postMessage.

Você pode usar essas ou fazer o HTML e JSON-RPC à mão.

### Status do ecossistema

MCP Apps saiu em 26 de janeiro de 2026. Suporte de clientes em abril de 2026:

- **Claude Desktop.** Suporte completo desde janeiro de 2026.
- **ChatGPT.** Suporte completo via Apps SDK (mesmo protocolo subjacente MCP Apps).
- **Cursor.** Beta; habilitar nas configurações.
- **VS Code.** Só builds Insider.
- **Goose.** Suporte completo.
- **Zed, Windsurf.** No roadmap.

Servidores em produção: dashboards, visualizações de mapa, tabelas de dados, construtores de gráficos, previews de IDE sandboxed.

## Use

`code/main.py` estende o servidor de notas com uma ferramenta `visualize_timeline` que retorna um resource `ui://notes/timeline`, mais um handler pra `resources/read` naquela URI que retorna um pacote HTML pequeno mas completo com uma timeline SVG. O HTML é template-ado em stdlib — sem sistema de build. postMessage está esboçado em comentários JS já que stdlib não pode dirigir um navegador.

O que conferir:

- `_meta.ui` na resposta da ferramenta carrega resourceUri, CSP, permissões.
- HTML renderiza sem acesso a rede; todos dados estão inline.
- JS chama `host.callTool` via `window.parent.postMessage` (documentado mas inerte nesta demonstração stdlib).

## Entregue

Esta aula produz `outputs/skill-mcp-apps-especificação.md`. Dada uma ferramenta que se beneficiaria de uma UI interativa, a skill produz o contrato completo de MCP Apps: URI `ui://`, CSP, permissões, pontos de entrada de postMessage e um checklist de segurança.

## Exercícios

1. Rode `code/main.py` e inespecificaçãoione o HTML emitido. Abra o HTML diretamente num navegador; verifique que a SVG renderiza. Depois esboce o contrato de postMessage que a UI usaria pra chamar `host.callTool("notes_update", ...)`.

2. Restrinja o CSP: remova `'unsafe-inline'` e use uma política de script baseada em nonce. O que muda no código de geração do HTML?

3. Adicione um segundo resource de UI `ui://notes/editor` com um formulário pra editar uma nota no local. Quando o usuário submete, o iframe chama `host.callTool("notes_update", ...)`.

4. Audite a superfície de ataque da UI. Onde um servidor malicioso poderia injetar conteúdo? O que o sandbox do iframe defende e o que não defende?

5. Leia a eespecificaçãoificação SEP-1724 e identifique uma funcionalidade no SDK de MCP Apps que esta implementação de brinquedo não usa. (Dica: sincronização de estado no nível de componente.)

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| MCP Apps | "Resources de UI interativa" | Extensão SEP-1724 lançada em 2026-01-26 |
| `ui://` | "Esquema de URI de App" | Esquema de resource pra pacotes de UI |
| `text/html;profile=mcp-app` | "O MIME" | Content-type pra HTML de MCP App |
| Iframe sandboxed | "Container de renderização" | Sandboxing de navegador da UI com CSP e permissões |
| postMessage JSON-RPC | "Rede UI-para-host" | Pequeno dialeto JSON-RPC sobre postMessage pra chamadas ao host |
| `_meta.ui` | "Binding tool-UI" | Metadados que ligam um resultado de ferramenta a um resource de UI |
| CSP | "Content-Security-Policy" | Declara fontes permitidas pra scripts, rede, estilos |
| AppRenderer | "Primitiva de SDK do servidor" | Converte um componente de framework num resource `ui://` |
| AppFrame | "Primitiva de SDK do cliente" | Helper de montagem de iframe que media o postMessage |
| `ui/initialize` | "Handshake" | Primeiro postMessage da UI pro host |

## Leituras Complementares

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — implementação de referência e SDK
- [MCP Apps especificaçãoification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/especificaçãoification/2026-01-26/apps.mdx) — documento formal de eespecificaçãoificação
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) — documentação de alto nível
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — post de lançamento de janeiro 2026
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) — referência de SDK estilo JSDoc
