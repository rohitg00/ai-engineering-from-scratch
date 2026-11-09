# Modelo de Protocolo Contextual (MCP)

> O MCP dá a um host de IA um protocolo para descobrir e invocar ferramentas, recursos e instruções. A revisão 2026-07-28 torna esse protocolo estatais: a capacidade e o contexto de versão viajam com cada solicitação, não em um aperto de mão vinculado à conexão.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Distinguir um host MCP, cliente, servidor, transporte e servidor primitivo.
- Construa uma solicitação JSON-RPC com os metadados exigidos pelo MCP 2026-07-28.
- Utilização`server/discover`para inspecionar versões, identidade e capacidades.
- Retorna resultados digitalizados e conscientes do cache de ferramentas, recursos e instruções.
- Explique como o MCP sem Estado moderno interage com servidores da era das aplausas.
- Escolha o estado seguro, transporte e limites de aprovação para um servidor.

## O problema

O seu aplicativo precisa de uma consulta de banco de dados, uma operação de calendário e um leitor de arquivos. Sem um protocolo compartilhado, cada host de IA precisa de descoberta personalizada, invocação, erros, transporte e adesão de autorização para essas mesmas capacidades.

O MCP reduz essa matriz de integração. Um servidor publica uma superfície JSON-RPC padrão. Um cliente compatível pode descobrir a superfície, apresentá-la a um modelo ou usuário, invocá-la e interpretar o resultado sem um adaptador específico do servidor.

O MCP padroniza a comunicação. Não decide a ferramenta que o modelo deve chamar, tornar o conteúdo não confiável seguro ou transformar uma solicitação sem estado em um estado de aplicação duradouro.

## O conceito

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### Os três servidores primitivos

1. **Tools**Cada ferramenta tem um nome, descrição, entrada de JSON Schema e manipulador.
2. **Resources**são nomeados, contatos com endereço URI que um cliente pode ler.
3. **Prompts**são modelos reutilizáveis que um host pode expor ao usuário.

O host é a aplicação de IA. Um cliente MCP dentro desse host fala com um servidor. O transporte transporta mensagens JSON-RPC entre eles.

### Pedidos de apadrinho substituem o aperto de mão

MCP 2026-07-28 remove `initialize`E ...`notifications/initialized`- Elimina também sessões de nível de protocolo.`params._meta`- Não .

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

É necessário a versão do protocolo e as capacidades do cliente.`_meta`, um campo requerido faltante, ou um campo requerido com o tipo errado é mal formado e retorna Paramens inválidos (`-32602`). Uma cadeia de versões bem formada que o servidor não suporta retorna `UnsupportedProtocolVersionError`(`-32022`O servidor pode processar uma solicitação válida sem recuperar um registro de negociação prévio.

Estatal não significa que uma aplicação nunca possa manter o estado.`Mcp-Session-Id`Se um fluxo de trabalho necessita de continuidade, o servidor fabrica um manilho opaco e o cliente passa esse manilho como um argumento de ferramenta comum em chamadas posteriores.

### Descoberta e seleção de versões

Todos os servidores modernos implementam `server/discover`O resultado anuncia versões, capacidades e identidade do servidor suportados:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

Um cliente pode chamar diretamente outro método e lidar com um erro de versão, mas a descoberta torna a exibição de capacidade e a seleção de versão explícita. Uma versão não suportada retorna `UnsupportedProtocolVersionError`com código `-32022`Os dados contêm:`supported`, uma série de revisões de servidores, e `requested`, a revisão rejeitada.

No estúdio, um cliente de duas eras investiga com`server/discover`Um resultado de descoberta ou um erro moderno reconhecido , como`UnsupportedProtocolVersionError`Qualquer erro ou tempo de espera que não seja reconhecido como moderno permite voltar para o 2025-11-25`initialize`O comportamento legado é código de compatibilidade, não o padrão moderno.

### Os resultados são explícitos

Cada resultado de núcleo 2026-07-28 tem`resultType`- Não .

- `complete`Significa que a operação terminou.
- `input_required`significa que o servidor precisa de outra viagem de ida e volta através do padrão de solicitações de viagem múltipla.`tools/call`- Não .`resources/read`, ou `prompts/get`- Não .

Os clientes devem tratar um resultado legado que omita `resultType`- Como completa.

Os servidores devem incluir `io.modelcontextprotocol/serverInfo`em todos os resultados.`_meta`Esta identidade é auto-relatada e é para exibição, registro e depuração, não para decisões de segurança.

Lista e leitura dos resultados também contêm `ttlMs`E ...`cacheScope`- Um determinista .`tools/list`ordem mais uma dica de frescura permite aos clientes armazenar em cache a descoberta com segurança e melhora a estabilidade do caché rápido. `cacheScope: public`Permitem o armazenamento em cache compartilhado; `private`O uso de dados de dados é limitado ao contexto de chamada.

### O formato do fio e o transporte

O MCP usa JSON-RPC 2.0 através do stdio ou do HTTP Streamable.

- Um pedido tem`jsonrpc`- Não .`id`- Não .`method`, e `params`- Não .
- Uma resposta tem a correspondência .`id`E qualquer um .`result`ou `error`- Não .
- Uma notificação não tem `id`E não espera resposta.

O HTTP Streamable moderno expõe um ponto final que aceita POST. Cada mensagem JSON-RPC recebe seu próprio POST. Uma solicitação POST recebe um objeto JSON ou um fluxo de eventos enviados por servidor escopo de solicitação que termina com a resposta final. Uma notificação POST aceita recebe HTTP 202 sem corpo de resposta; esta revisão central não define notificações de cliente a servidor sobre o HTTP Streamable.

Não existe fluxo GET de MCP independente, ponto final de sessão DELETE, `Mcp-Session-Id`, ou `Last-Event-ID`A nova versão será reproduzida em 2026-07-28.`subscriptions/listen`POST cuja resposta permanece aberta como um fluxo de SSE.

### Entrada do cliente sem solicitações iniciadas pelo servidor

As revisões anteriores permitem que um servidor envie solicitações como `sampling/createMessage`- Não .`roots/list`, ou `elicitation/create`O protocolo atual usa Requests Multi Round-Trip em vez disso. Uma chamada de ferramenta elegível, leitura de recursos ou solicitação de retornos `resultType: input_required`com pelo menos um dos`inputRequests`ou `requestState`O cliente recolhe qualquer entrada solicitada, retenta o método original com um novo ID JSON-RPC e o correspondente `inputResponses`, e ecoa exatamente`requestState`Quando foi fornecido.`inputRequests`Se estiverem presentes, a retomada é omitida.`inputResponses`- Não .

As raízes, a amostragem e a tomada de amostras continuam funcionais, mas são desatualizadas, por isso as novas implementações não devem adotá-las.`inputRequests`, nunca como solicitações JSON-RPC independentes de servidor para cliente. Prefere parâmetros de arquivo ou diretório explícitos, URIs de recursos, configuração do servidor e integração direta do fornecedor de modelos. Use stderr para diagnóstico de estúdio e OpenTelemetry para telemetria de produção.

```figure
mcp-nxm-collapse
```

## Construí-lo

### Passo 1: Registre uma superfície de servidor

O registo permanece simples, apesar de o contrato de pedido ter sido alterado:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

A implementação enviada em`code/main.py`Ele utiliza deliberadamente a biblioteca padrão para que você possa ver cada envelope em vez de delegar o protocolo para um SDK.

### Passo 2: anexar metadados a cada pedido

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

Não cache esses metadados apenas em um objeto de conexão. O servidor os valida em cada solicitação.

### Passo 3: opcionalmente, descubra antes da listagem

Liga-me .`server/discover`, escolher uma versão suportada, e depois ligar `tools/list`- Um directo .`tools/list`é válido também se já conhece a versão e pode lidar com `-32022`- Não .

A demonstração retorna as listas de ferramentas em ordem de nomes e anexas `ttlMs`- Não .`cacheScope`- Não .`resultType`Uma chamada de ferramenta retorna um resultado completo e não caché, porque sua saída pode depender do estado atual.

### Passo 4: mapear a mesma solicitação para HTTP

Um controle remoto .`tools/call`O POST inclui cabeçalhos que refletem o corpo JSON-RPC:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

O `MCP-Protocol-Version`cabeçalho deve corresponder à versão em `_meta`- Não .`Mcp-Method`é exigido em cada pedido de JSON-RPC e deve corresponder `method`- Não .`Mcp-Name`é necessário apenas para `tools/call`- Não .`resources/read`, e `prompts/get`, onde deve corresponder ao nome da ferramenta, URI de recurso ou nome de prompt. Um cabeçalho necessário faltante ou não corresponder retorna HTTP 400 com `HeaderMismatch`código `-32020`- Não .

### Passo 5: Forçar a segurança fora do estado do protocolo

- Validar a autorização e o público em cada solicitação HTTP.
- Ligue os servidores locais para localhost e valida `Origin`em Streamable HTTP.
- Marque as ferramentas mutantes com `destructiveHint: true`e exigem a aprovação do hospedeiro.
- Passar diretório e alcance de arquivo explicitamente em vez de depender de raízes desatualizadas.
- Tratar os recursos e as ferramentas de saída como dados não confiáveis.
- Mantenha o stdout reservado para JSON-RPC sob o stdio; escreva diagnósticos para stderr.

## Usá-lo

Exerça a lição do seu diretório:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

A primeira linha deve relatar a descoberta de `demo-server`No protocolo `2026-07-28`- Então inspecione .`MCPClient.request`- Reconstrui .`_meta`Remover os metadados de uma solicitação e observar o servidor rejeitá-lo.

## Envia-o

`outputs/skill-mcp-server-designer.md`transforma um domínio em um design de MCP sem estado. Seu portão de aceitação requer um resultado de descoberta, política de metadados por solicitação, listas deterministas de cache, manuais de estado explícitos, cabeçalhos de transporte, autorização e regras de aprovação.

## Continuar o Mergulho Profundo MCP

Esta lição dá-lhe o modelo de protocolo. Fase 13 transforma quatro limites de produção em lições separadas de construção e verificação:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)abrange esquemas de entrada fechados, conteúdo estruturado, metadados de roteamento, paginamento opaco, autorização de conclusão e a diferença entre erros de protocolo e de domínio de ferramenta.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)abrange cancelamento de solicitações, cancelamento de tarefas duradouras, prazos, idempotencia, contrapressão, tampão de proxy e comportamento de reconexão.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)abrange a prova de espaço de nomes, a proveniência do artefato, os pinos imutáveis, a deriva ao vivo, o status do Registo, a prova de admissão e o retrocesso.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)abrange transcrições de fio de ouro e negativo, épocas de versão rigorosa, diferenciais SDK, evidências por procuração, redação, portões de saúde e lançamento de rollback.

Seguir-os em ordem quando o servidor cruzará uma fronteira de equipe ou confiança. Juntos, eles passam do método que funciona para o contrato permanece seguro e diagnosticável através da implantação.

## Exercícios

1. Adicionar um`subtract`ferramenta e confirmação `tools/list`permanece ordenado por ordem alfabética.
2. Remover a chave de versão do protocolo e verificar Params inválidos (`-32602`Depois, envia a versão bem formada mas sem apoio.`2025-11-25`, verificar`-32022`- Confirme .`requested`O relatório é um relatório sobre a política de segurança social e de segurança social.`supported`- Não .
3. Adicionar um servidor-minted `draftId`Explique por que esse é o estado da aplicação em vez de uma sessão de protocolo.
4. Retorno .`input_required`- uma ferramenta que precisa de confirmação do usuário.`inputResponses`A entrada, e o exato `requestState`Em vez de inventar uma solicitação JSON-RPC de servidor a cliente.
5. Desenhe um cliente de estúdio de dupla era. Trate um resultado ou erro moderno reconhecido como moderno, e permita que o fallback para `initialize`Só por um erro não reconhecido ou um prazo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## Mais leitura

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
