# Transportes MCP — stdio vs. Streamable HTTP vs. Migração SSE

> stdio funciona local e em nenhum outro lugar. Streamable HTTP (2025-03-26) é o padrão remoto. O antigo transporte HTTP+SSE está deprecado e sendo removido no meio de 2026. Escolher o transporte errado custa uma migração; escolher o certo compra um servidor MCP hospedável remotamente com continuidade de sessão e proteção contra DNS-rebinding.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, esqueleto de endpoint Streamable HTTP)
**Pré-requisitos:** Fase 13 · 07, 08 (servidor e cliente MCP)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Escolher entre stdio e Streamable HTTP baseado na forma de deployment (local vs. remoto, processo único vs. frota).
- Implementar o padrão de endpoint único Streamable HTTP: POST pra requests, GET pra stream de sessão.
- Aplicar validação de `Origin` e semântica de session-id pra derrotar DNS-rebinding.
- Migrar um servidor HTTP+SSE legado pra Streamable HTTP antes dos prazos de remoção de meados de 2026.

## O Problema

O primeiro transporte remoto do MCP (2024-11) era HTTP+SSE: dois endpoints, um pra POSTs do cliente e um canal Server-Sent-Events pra stream servidor-cliente. Funcionava. Também era desajeitado: dois endpoints por sessão, caches quebrados na frente de alguns CDNs e dependência rígida em conexões SSE de longa duração que certos WAFs terminam agressivamente.

A eespecificaçãoificação 2025-03-26 substituiu por Streamable HTTP: um endpoint único, POST pra requests do cliente, GET pra estabelecer uma stream de sessão, ambos compartilhando um header `Mcp-Session-Id`. Todo servidor construído ou migrado desde então usa Streamable HTTP. O modo SSE antigo está sendo deprecado — Atlassian Rovo removeu em 30 de junho de 2026; Keboola em 1º de abril de 2026; a maioria dos servidores empresariais restantes até o fim de 2026.

E stdio ainda importa pra servidores locais. Claude Desktop, VS Code e todo cliente em forma de IDE spawnam servidores via stdio. O modelo mental certo: stdio pra "esta máquina", Streamable HTTP pra "pela rede". Sem cruzamento.

## O Conceito

### stdio

- Transporte de processo filho. Cliente spawna servidor, comunica via stdin/stdout.
- Um objeto JSON por linha. Delimitado por newline.
- Sem id de sessão; identidade do processo é a sessão.
- Sem auth necessário (o filho herda o limite de confiança do pai).
- Nunca use pra servidores remotos — você precisaria de SSH ou socat pra tunelar, aí use Streamable HTTP.

### Streamable HTTP

Endpoint único `/mcp` (ou qualquer path). Suporta três métodos HTTP:

- **POST /mcp.** Cliente envia uma mensagem JSON-RPC. Servidor responde com uma resposta JSON única ou um stream SSE de uma ou mais respostas (útil pra respostas em lote e notificações relacionadas àquele request).
- **GET /mcp.** Cliente abre um canal SSE de longa duração. Servidor usa pra requests servidor-cliente (sampling, notificações, elicitação).
- **DELETE /mcp.** Cliente termina a sessão explicitamente.

Sessões são identificadas pelo header `Mcp-Session-Id` que o servidor define na primeira resposta e o cliente ecoa em todo request subsequente. Ids de sessão DEVEM ser criptograficamente aleatórios (128+ bits); ids escolhidos pelo cliente são rejeitados por segurança.

### Endpoint único vs. dois

Modo de dois endpoints da eespecificaçãoificação antiga ainda é chamável em 2026 — a eespecificaçãoificação o declara "compatível com legado". Mas todos os novos servidores devem ser de endpoint único. Os SDKs oficiais emitem endpoint único; use o modo legado só ao falar com um remoto não migrado.

### Validação de `Origin` e DNS-rebinding

Navegadores não são clientes MCP (hoje), mas um atacante pode montar uma página web que convence um navegador a fazer POST pra `localhost:1234/mcp` — onde o servidor local do usuário escuta. Se o servidor não verifica `Origin`, a política de same-origin do navegador não o salvará porque `Origin: http://evil.com` é cross-origin válido.

A eespecificaçãoificação 2025-11-25 requer que servidores rejeitem requests cujo `Origin` não esteja numa allowlist. A allowlist normalmente contém o host do cliente MCP (`https://claude.ai`, `vscode-webview://*`) e variantes de localhost pra UIs locais.

### Ciclo de vida do id de sessão

1. Cliente envia o primeiro request sem `Mcp-Session-Id`.
2. Servidor atribui um id aleatório, seta `Mcp-Session-Id` no header da resposta.
3. Cliente ecoa aquele header em todos requests subsequentes e no `GET /mcp` pra stream.
4. Sessão pode ser revogada pelo servidor; cliente vê 404 em requests subsequentes e deve reinicializar.
5. Cliente pode fazer DELETE explícito da sessão pra desligamento limpo.

### Keepalive e reconexão

Conexões SSE caem. Cliente reestabelecendo re-GETa com o mesmo `Mcp-Session-Id`. Servidor DEVE enfileirar eventos perdidos durante a interrupção (até uma janela razoável) e replay via o header `last-event-id` que o cliente ecoa.

Fase 13 · 13 cobre Tasks, que permitem trabalho de longa duração sobreviver até uma reconexão completa de sessão.

### Sonda de compatibilidade retroativa

Um cliente que quer suportar servidores antigos e novos:

1. POSTa pra `/mcp`.
2. Se a resposta é `200 OK` com JSON ou SSE, isso é Streamable HTTP.
3. Se a resposta é `200 OK` com `Content-Type: text/event-stream` E um header `Location` apontando pra um endpoint secundário, isso é HTTP+SSE legado; siga o `Location`.

### Cloudflare, ngrok e hospedagem

Servidores MCP remotos de produção em 2026 rodam no Cloudflare Workers (com seu MCP Agents SDK), Vercel Functions ou Node/Python containerizado. Chave: sua hospedagem precisa suportar conexões HTTP longas pro GET SSE. Tier grátis do Vercel limita a 10 segundos e não serve. Workers do Cloudflare suportam streams indefinidas.

### Composição de gateway

Quando você coloca múltiplos servidores MCP atrás de um gateway (Fase 13 · 17), o gateway é um endpoint Streamable HTTP único que reescreve ids de sessão e multiplexa upstream. Ferramentas são mescladas na camada do gateway; o cliente vê um único servidor lógico.

### Modos de falha de transporte

- **stdio SIGPIPE.** Morte do processo filho durante escrita levanta SIGPIPE; servidores devem sair limpo. Clientes devem detectar EOF e marcar a sessão como morta.
- **HTTP 502 / 504.** Cloudflare, nginx e outros proxies emitem em falha upstream. Clientes Streamable HTTP devem tentar uma vez após backoff curto.
- **Queda de conexão SSE.** TCP RST, timeout de proxy ou mudança de rede do cliente fecha a stream. Cliente reconecta com `Mcp-Session-Id` e `last-event-id` opcional pra retomar.
- **Revogação de sessão.** Servidor invalida um id de sessão; cliente vê 404 no próximo request. Cliente deve refazer handshake.
- **Desequilíbrio de relógio.** Cálculos de TTL de recurso no cliente divergem do servidor. Cliente deve tratar timestamps do servidor como autoritativos.

### Quando pular o Streamable HTTP

Algumas empresas implementam servidores MCP atrás de transports gRPC ou de fila de mensagens em suas próprias redes. Isso é não-padrão — a eespecificaçãoificação do MCP não define formalmente esses. Gateways podem expor uma superfície Streamable HTTP pra clientes MCP enquanto usam gRPC internamente. Mantenha a superfície externa compatível com a especificação; o gateway cuida da tradução.

## Use

`code/main.py` implementa um endpoint Streamable HTTP mínimo usando `http.server` (stdlib). Ele lida com POST, GET e DELETE em `/mcp`, seta `Mcp-Session-Id` na primeira resposta, valida `Origin` e rejeita requests de origens não listadas. O handler reutiliza a lógica de dispatch do servidor de notas da Aula 07.

O que conferir:

- O handler de POST lê o corpo JSON-RPC, despacha e escreve uma resposta JSON (variante de resposta única; variante SSE é estruturalmente similar).
- A verificação de `Origin` rejeita a sonda padrão `http://evil.example` mas aceita `http://localhost`.
- Ids de sessão são strings hex aleatórias de 128 bits; o servidor mantém estado por sessão em memória.

## Entregue

Esta aula produz `outputs/skill-mcp-transport-migrator.md`. Dado um servidor MCP HTTP+SSE (legado), a skill produz um plano de migração pra Streamable HTTP com continuidade de session-id, verificações Origin e suporte a sonda de compatibilidade retroativa.

## Exercícios

1. Rode `code/main.py`. POSTe um `initialize` do `curl` e observe o header `Mcp-Session-Id` na resposta. POSTe um segundo request ecoando o header e verifique a continuidade de sessão.

2. Adicione um handler GET que abre um stream SSE. Envie um evento `notifications/progress` a cada cinco segundos. Reconecte re-GETando com o mesmo id de sessão e confirme que o servidor aceita.

3. Implemente a lógica de replay com `last-event-id`. Na reconexão, repita quaisquer eventos gerados desde aquele id.

4. Estenda a validação de `Origin` pra suportar um padrão wildcard (`https://*.example.com`) e confirme que aceita `https://app.example.com` mas rejeita `https://evil.example.com.attacker.net`.

5. Pegue um servidor HTTP+SSE legado do registry oficial (há vários) e esboce a migração: o que muda no tratamento de endpoints, geração de ids de sessão e semântica de headers.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Transporte stdio | "Processo filho local" | JSON-RPC via stdin/stdout, delimitado por newline |
| Streamable HTTP | "O transporte remoto" | Endpoint único POST + GET + SSE opcional, eespecificaçãoificação 2025-03-26 |
| HTTP+SSE | "Legado" | Modelo de dois endpoints sendo removido no meio de 2026 |
| `Mcp-Session-Id` | "Header de sessão" | Id aleatório atribuído pelo servidor e ecoado em todo request subsequente |
| Allowlist de `Origin` | "Defesa contra DNS-rebinding" | Rejeitar requests cuja Origin não está aprovada |
| Endpoint único | "Uma URL" | `/mcp` lida com POST / GET / DELETE pra todas operações de sessão |
| `last-event-id` | "Replay de SSE" | Header usado pra retomar stream caída sem perder eventos |
| Sonda de compat retroativa | "Detecção velho vs. novo" | Verificação de forma de resposta do cliente que seleciona transporte automaticamente |
| HTTP longa duração | "Streaming SSE" | Servidor empurra eventos por minutos ou horas numa conexão TCP |
| Revogação de sessão | "Forçar reinício" | Servidor invalida um id de sessão; cliente deve refazer handshake |

## Leituras Complementares

- [MCP — Basic transports especificação 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/basic/transports) — referência canônica pra stdio e Streamable HTTP
- [MCP — Basic transports especificação 2025-03-26](https://modelcontextprotocol.io/especificaçãoification/2025-03-26/basic/transports) — a revisão que introduziu Streamable HTTP
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — padrões de Streamable HTTP hospedados em Workers
- [AWS — MCP transport mechanisms](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — comparação entre formas de deployment
- [Atlassian — HTTP+SSE deprecation notice](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — exemplo concreto de prazo de migração
