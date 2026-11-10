# Aplicações do MCP no Protocolo sobre apátridas

> Um resultado interativo ainda é uma ferramenta MCP e troca de recursos. O núcleo 2026-07-28 torna essa troca autônoma, enquanto a extensão Apps adiciona a superfície do navegador sandboxed.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Publicitar as aplicações MCP através de `server/discover`e capacidades de extensão por pedido.
- Declare um `ui://`recurso numa ferramenta antes de a ferramenta ser chamada.
- Retorna resultados completos de ferramentas e recursos no fio sem estado de 2026-07-28.
- Separar os aplicativos `ui/initialize`mensagem de ponte do aperto de mão do núcleo MCP removido.
- Aplicar a validação de origem, sandboxing, CSP e permissões de menor privilégio.

## O problema

Um resultado de texto pode descrever uma linha de tempo. Não pode dar ao usuário uma linha de tempo que ele possa filtrar, inspecionar ou agir sobre.

A MCP Apps resolve o problema de apresentação com uma extensão opcional.`ui://`O host pode buscar e rever esse recurso antes da ferramenta ser executada, renderizá-lo em um iframe em caixa de areia e mediar todas as ações do aplicativo através de uma ponte JSON-RPC.

O protocolo principal mudou em 2026-07-28. Não envolva um App no ciclo de vida da conexão antiga:

- Não há núcleo .`initialize`pedido ou `notifications/initialized`notificação.
- Não há .`Mcp-Session-Id`- O cabeçalho.
- Cada solicitação contém versão de protocolo e recursos do cliente em `params._meta`- Não .
- Um servidor implementa `server/discover`para que os clientes possam inspecionar versões, recursos principais e extensões.
- Cada resultado bem sucedido tem um`resultType`- Discriminador.
- O HTTP streamable usa um POST por solicitação. Os pontos de entrada modernos GET e DELETE retornam 405.

A ponte das aplicações ainda tem um método chamado `ui/initialize`É do dialeto de post-Message do iframe, não recria uma sessão central de MCP.

## O conceito

### Dois protocolos, uma característica

Mantém as camadas explícitas:

1. O núcleo do MCP transporta `server/discover`- Não .`tools/list`- Não .`tools/call`- Não .`resources/list`, e `resources/read`- Não .
2. A extensão MCP Apps declara a interface e define a ponte iframe-host.
3. As regras da caixa de areia do navegador limitam o que a interface pode alcançar.

O identificador de extensão é `io.modelcontextprotocol/ui`Um cliente envia suporte de extensão dentro do objeto de recursos em cada solicitação:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo`É um documento de identidade de autorização, não de autorização.

### Descobrir antes de render

O resultado da descoberta do servidor anuncia a extensão:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

O servidor deve suportar a descoberta. Um cliente não é forçado a chamar a descoberta antes de cada ação porque cada ação carrega suas próprias capacidades.

### Declare a interfaz de interfaces na definição da ferramenta

O contrato moderno de Apps liga uma interface de interface à ferramenta em `tools/list`- Não .

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

Este é deliberadamente metadados pré-chamadas. O host pode pré-carregar, cache e segurança-revista do HTML antes de um resultado pedir para exibir-lo.`_meta.ui.resourceUri`- O formulário.

`tools/list`É caché no núcleo corrente. Incluir ordenação determinista,`ttlMs`, e `cacheScope`- Usar .`private`Quando as ferramentas visíveis variam de acordo com o utilizador ou o token.

### Retorna os dados, então deixe o host ligar a visão

A chamada de ferramenta retorna conteúdo comum mais dados estruturados:

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

O host já sabe qual visão pertence à ferramenta. Evite inventar um novo bloco de conteúdo apenas para repetir o URI.

### Servir o aplicativo como recurso

O servidor anuncia `resources`A Comissão tem de fazer uma análise das alterações que foram tomadas.`resources/list`A sua entrada de lista determinista inclui o URI canônico, um nome estável, descrição e tipo MIME. O resultado da lista inclui `resultType`, metadados de identidade do servidor, `ttlMs`, e `cacheScope`, como a lista de ferramentas deterministas.

O anfitrião manda .`resources/read`No HTTP Streamable, o pedido tem:

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

Os valores do cabeçalho e o corpo JSON-RPC devem coincidir. Uma descoincidência é o erro de protocolo `-32020`- Não .

O resultado contém o recurso HTML e as dicas do cache:

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### Cachar recursos da interfaz de interfaces como conteúdo executável

Um recurso de aplicativo não é intercâmbio com a prosa comum. Sua entrada no cache pode executar código ponte, renderizar dados da ferramenta e solicitar ações mediadas pelo host.`ui://`URI, identidade e versão admitidas do servidor, digestamento de conteúdo de recursos e contexto de autorização quando `cacheScope`Nunca reutilize um recurso privado de aplicativo em todos os principais, porque o HTML ou seus metadados de política podem diferir mesmo quando o URI é idêntico.

Invalida a entrada quando o seu `ttlMs`expira, a ferramenta é `_meta.ui.resourceUri`alterações vinculativas, a versão do servidor ou alterações de pin de descriptório admitidas, ou uma assinatura reconhecida de mudança de recurso nomeia o URI. Reaplique e reaplique a revisão de permissões e CSP antes de reinstalação. Um iframe obsoleto não deve manter permissões mais amplas simplesmente porque uma nova versão de recurso ainda não foi carregada.

### Rejeitar a ambigüidade do fio antes da política de recursos

A validação tem uma ordem deliberada. Primeiro valida a forma JSON-RPC e requer metadados de protocolo de cadeia mais um mapa de capacidade do cliente objeto. Em seguida, compare os cabeçalhos de roteamento com o corpo. Só então decide se a versão do protocolo correspondente é suportada. Esta ordem impede que um proxy e servidor interpretem diferentes solicitações.

| Condition | HTTP | JSON-RPC error |
|-----------|------|----------------|
| Header and body version, method, or name disagree | 400 | `-32020` |
| Header and body agree on an unsupported version | 400 | `-32022`, with `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` lacks the Apps extension capability | 400 | `-32021`, with `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| Method is unknown | 404 | `-32601` |

Uma notificação JSON-RPC não tem `id`O servidor nunca emite uma resposta JSON-RPC para ele. Uma notificação HTTP aceita retorna 202 com um corpo vazio. Um erro pode alterar o status HTTP, mas ainda não pode criar um corpo de erro JSON-RPC para uma notificação.

### A caixa de areia é um limite, não um veredicto de confiança

Um host controla o iframe. O aplicativo não pode ler diretamente os cookies do host, armazenamento local ou página DOM. Todos os trabalhos privilegiados devem atravessar a ponte.

Use estes padrões:

- Deixe todas as listas de domínio CSP vazias, e adicione apenas as origens que o aplicativo precisa. Use `connectDomains`para tracer, XHR e WebSocket; uso `resourceDomains`para scripts, estilos, imagens e fontes.
- Encomenda código e dados quando possível.
- Não solicite permissão de câmera, microfone ou localização a menos que um recurso visível o precise.
- Pin `postMessage`A partir daí, a Comissão deve ter em conta a sua posição sobre o assunto.
- Trate argumentos de ferramentas, resultados de ferramentas, texto de recursos e mensagens de ponte como entradas não confiáveis.
- Manter o consentimento do usuário no host. O iframe não pode aprovar a sua própria ação consequente.

Não copie um fixo .`sandbox`O host deve escolher bandeiras com base no modelo de origem do aplicativo e seu próprio design de isolamento.

Um domínio permitido é ainda um caminho de exfiltração.`connectDomains: ["https://api.example.com"]`significa que qualquer script que executa dentro do App pode enviar dados permitidos lá. A correspondência exacta da origem evita a confusão do destino, mas não determina se a carga útil é adequada. Mantenha o acesso de conexão vazio por padrão, evite colocar tokens portadores no iframe, operações de estreita proxy através do host quando práticas, limite os tamanhos de resposta e solicitação e verifique qual a ação do usuário causou cada solicitação de saída. Tratar`resourceDomains`separadamente de `connectDomains`; a autorização para carregar uma fonte ou um script não deve permitir o carregamento arbitrário de dados.

### A ponte das Aplicativos tem o seu próprio ciclo de vida

A ponte das aplicações é um dialeto JSON-RPC sobre `postMessage`- Pode trocar .`ui/initialize`E ...`ui/*`notificações e podem proxy métodos de aparência de núcleo, tais como `tools/call`- Não .

A visão envia `ui/initialize`com`appInfo`e um `appCapabilities`Objeto. O host retorna as suas capacidades e contexto do host.`ui/notifications/initialized`O anfitrião deve esperar esta notificação de aplicativos antes de enviar mensagens para a visualização.

Esse aperto de mão local cria uma ponte entre um iframe e um host frame. Não negocia a versão do protocolo MCP, cria estado do servidor ou cria uma sessão de transporte. Observe o prefixo exato: core `notifications/initialized`foi removido, enquanto Apps `ui/notifications/initialized`Uma solicitação central gerada por uma chamada de ferramenta de ponte é uma nova solicitação autônoma com um novo ID JSON-RPC e metadados completos de solicitação.

### Contexto do anfitrião, ações e revogação

O host permanece a autoridade após a inicialização da ponte. Uma visão pode solicitar uma ação de ferramenta, navegação, uso de clipboard ou outro efeito privilegiado apenas através de uma capacidade anunciada pelo host. O host valida a solicitação digitada, usuário atual, alvo e argumentos, aplica política de aprovação e pode recusá-la. Um clique de botão e uma mensagem de ponte válida expressam intenção; nenhum deles concede autoridade.

Trate o tema, o tamanho e a acessibilidade como conteúdo de hospedagem em vez de entradas de renderização única:

- Aplique os tokens de cor e tipografia fornecidos pelo host, em seguida, reage quando o tema ou a preferência de contraste mudar.
- Deixe que a visualização informe as dimensões desejadas, mas deixe que o host cap e aplicar o tamanho do iframe para que o conteúdo não possa escapar do seu layout ou criar superposições enganosas.
- Preserva a ordem do teclado, foco visível, nomes acessíveis, status do leitor de tela, contraste suficiente, zoom e comportamento de movimento reduzido dentro do iframe.
- Re-teste transferência de foco entre os controles host e View após redimensionamento e redirecionamento.

As capacidades podem ser revogadas enquanto o aplicativo está aberto porque o usuário muda de conta, mudanças de política, um servidor é em quarentena ou o host restringe o consentimento.`ui/initialize`. Na revogação, rejeitar chamadas privilegiadas pendentes, parar a atividade da rede que não mais se encaixa na política, limpar o estado sensível de renderização e reinstalar ou voltar ao texto quando o recurso da própria interface não é mais admitido.

### O regresso é parte do contrato .

Um servidor consciente de Apps ainda pode servir hosts que não anunciam a extensão da UI:

- Retorna a mesma ferramenta sem `_meta.ui`em `tools/list`- Não .
- Mantenha um resultado de texto útil para `tools/call`- Não .
- Recusar`resources/read`para a interfaz de interfaces com um erro de capacidade faltante.
- Nunca suponha que exista um iframe ao decidir se a ferramenta está concluída.

```figure
t3-ui-sandbox
```

## Construí-lo

`code/main.py`Construi um pequeno modelo de protocolo em processo sem um SDK. Valida o envelope de solicitação atual e os valores de roteamento HTTP Streamable, anuncia Apps através de `server/discover`, lista ferramentas e recursos, executa a ferramenta e serve um recurso HTML independente.

O modelo recebe corpos já analisados e cabeçalhos de roteamento.`Content-Type`ou `Accept`. Use a lição 09 para o adaptador HTTP Streamable completo que requer `Content-Type: application/json`e um `Accept`valor que contém ambos `application/json`E ...`text/event-stream`- Não .

- É o que é ?

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Inspectar cinco coisas na saída:

1. Todas as chamadas são independentes.
2. Cada pedido tem ...`_meta`- Capacidades.
3. `resources/list`Retorna um descritivo estável antes de qualquer recurso ser lido.
4. Todos os resultados têm`resultType`e metadados de identidade do servidor.
5. Não aparece nenhum identificador de sessão central.

## Usá-lo

Começa com `server/discover`- Confirme .`io.modelcontextprotocol/ui`aparece no mapa de extensão do servidor. Depois, ligue `tools/list`O primeiro recurso é o recurso, o segundo é uma ferramenta de texto.

Leia `ui://notes/timeline.html`Procure no HTML para`hostOrigin`e o `event.origin`Estas duas linhas são a prova mínima visível de que a ponte não usa um alvo de cartão.

## Envia-o

Esta lição vai avançar .`outputs/skill-mcp-apps-spec.md`. Use-o para revisar um contrato de aplicativo antes de escrever código-quadro. Ele obriga o autor a indicar o envelope principal atual, negociação de extensão, fallback, recurso da UI, política de cache, CSP, permissões, métodos de ponte e limites de consentimento.

## Exercícios

1. Mudança da capacidade do cliente para um mapa de extensão vazio.`tools/list`mantém a ferramenta, mas remove a ligação da interface.
2. Enviar .`Mcp-Name: ui://notes/other.html`Confirme o erro.`-32020`- Não .
3. Crie o recurso para `cacheScope: private`Descrever a condição específica do utilizador que a justifica.
4. Mova o roteiro para `https://static.example.com/app.js`Adicionar essa origem a`resourceDomains`e explicar o novo risco da cadeia de suprimentos.
5. Adicionar um`notes_open`ferramenta e direcionar o botão clique através do host. Mantenha a aprovação do usuário no host.

## Termos-chave

| Term | Meaning |
|------|---------|
| MCP Apps | Optional extension for interactive HTML rendered by an MCP host |
| `io.modelcontextprotocol/ui` | Extension identifier advertised by both peers |
| `ui://` | Resource scheme for an App's UI template |
| `text/html;profile=mcp-app` | MIME type for MCP App HTML |
| `server/discover` | Current RPC for protocol and capability discovery |
| `resources/list` | Mandatory resource listing method when the server advertises resources |
| `resultType` | Required discriminator for modern successful results |
| `ui/initialize` | First Apps bridge request, separate from removed core initialization |
| `ui/notifications/initialized` | Apps View readiness notification sent after the host responds |
| CSP | Browser policy that restricts scripts, styles, images, and network origins |
| Text fallback | Tool behavior retained for a host without Apps support |

## Mais leitura

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps build guide](https://modelcontextprotocol.io/extensions/apps/build)
- [Official extension support matrix](https://modelcontextprotocol.io/extensions/client-matrix)
