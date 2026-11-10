# Introdução do modelo de MCP: Migração e MRTR sem nacionalidade

> MCP 2026-07-28 depreca a amostragem para novos projetos e remove o canal de solicitação de servidor a cliente.`input_required`O resultado é que o cliente retrata a solicitação original com a saída do modelo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique por que a amostragem é obsoleta no MCP 2026-07-28 e escolha o modelo de integração direta padrão para os novos servidores.
- Implementar um fluxo de trabalho de compatibilidade que consiga `sampling/createMessage`através de Solicitações de Viagem Múltiple e Rondada (MRTR).
- Colocar a revisão do protocolo e as capacidades do cliente em cada pedido `_meta`Objeto.
- Retorno .`resultType: "input_required"`e retestar o método original com um ID JSON-RPC novo.
- Proteção da integridade `requestState`e vincular-o ao principal, método, argumentos e expiração.
- Loops ligados com modelo assistido com verificações de capacidade, aprovação, validação de resposta e limite redondo.

## A decisão anterior ao Protocolo

Uma ferramenta como `summarize_repo`requer dois tipos de trabalho:

1. Trabalho determinista: lista de arquivos, leitura de arquivos permitidos, validação de caminhos e montagem de conteúdo.
2. Trabalho de modelo: escolha arquivos representativos e sintetiza o resumo.

Agora tens duas arquiteturas válidas.

### Novo servidor: integração direta com um fornecedor de modelo

Este é o padrão atual. O servidor possui seleção de modelo, credenciais, orçamentos, retries e observabilidade.`tools/call`Resultados para o cliente do MCP.

Escolha isso quando o servidor já é um serviço hospedado ou quando o comportamento preditivo do modelo é mais importante do que usar o modelo do host.

### Fluxo de trabalho de amostragem existente: migrar para MRTR

A amostragem ainda existe durante a sua janela de deprecação. Um servidor que visa 2026-07-28 não pode enviar um live `sampling/createMessage`A empresa de informação e comunicação de dados, que é a empresa de informação e comunicação de dados, é a empresa de informação e comunicação de dados.`InputRequiredResult`- Não .

Escolher este caminho de compatibilidade apenas quando usar o modelo do cliente e as credenciais é um requisito real do produto.

## O Contrato de Estadão

O protocolo de Julho de 2026 não tem`initialize`- Não.`notifications/initialized`E não .`Mcp-Session-Id`Cada pedido contém as informações que costumavam viver no aperto de mão:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

O servidor valida a revisão em cada solicitação. Uma versão faltante ou não-string é parâmetros inválidos, `-32602`Uma cadeia não suportada retorna .`-32022`com dados exatos `{"supported":["2026-07-28"],"requested":"<client version>"}`- Uma capacidade de amostragem faltante retorna .`-32021`com`data.requiredCapabilities`definido para `{"sampling":{}}`- Não .

Um envelope sem um JSON-RPC `id`O receptor pode processá-lo, mas não emite nem uma resposta de sucesso nem uma resposta de erro. Um adaptador HTTP Streamable retorna `202 Accepted`Sem organismo para uma notificação aceita.

O servidor também implementa `server/discover`com o exato `supportedVersions`- Capacidades,`ttlMs`, e `cacheScope`O cliente pode aprender e armazenar no cache o contrato do servidor antes de ligar para uma ferramenta.`tools`O servidor também implementa obrigatoriamente`tools/list`É determinista .`summarize_repo`O descriptor inclui um objeto válido `inputSchema`- Não .`resultType: "complete"`, metadados de identidade do servidor e dicas de cache público.

Cada resultado moderno bem sucedido tem um discriminador:

- `resultType: "complete"`Significa que a operação terminou.
- `resultType: "input_required"`significa que o cliente deve cumprir os pedidos incorporados e tentar novamente.
- As extensões podem definir tipos adicionais de resultados.`"task"`Na lição 13.

## Uma Ronda de MRTR

O servidor não pode ligar ao cliente enquanto lida com a solicitação.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

O cliente verifica que suporta a amostragem, aplica suas políticas de aprovação e modelo e obtém uma resposta de modelo.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

A retry não é uma continuação de uma sessão de protocolo. É uma nova solicitação que repete o método e argumentos originais, adicionando apenas os de rodada atual `inputResponses`, e ecoe .`requestState`Byte por byte.

O MRTR é permitido apenas em`tools/call`- Não .`prompts/get`, e `resources/read`Um servidor não deve voltar .`input_required`de métodos não relacionados.

## Estado de vários rodamentos

Esta lição precisa de duas chamadas modelo:

1. `pick_files`Retorna um conjunto JSON.
2. `summary`devolve a prosa final.

Cada retry carrega apenas as respostas para essa rodada. O servidor, portanto, coloca a fase e os dados intermediários validados na próxima `requestState`- Não .

Tratar esse valor como controlado pelo atacante.

- O principal autenticado, não auto-relatado `clientInfo`O artigo 2.o
- O método de origem;
- Um resumo dos argumentos originais;
- um prazo de validade curto;
- A fase atual e os valores intermediários validados.

Use HMAC quando não for exigida confidencialidade. Use criptografia autenticada quando o cliente não deve ler o estado. Rejeite uma assinatura ruim, valor expirado, principal alterado ou alterado argumentos com `-32602`- Não .

O cliente não deve analisar ou modificar `requestState`O seu único trabalho é fazer eco da linha exata na retomada.

## Preferências de modelo são sugestões

`costPriority`- Não .`speedPriority`, e `intelligencePriority`As preferências são independentes, não são uma distribuição de probabilidades e não precisam ser somadas em uma.

- Não .`includeContext`- Não .`"none"`Se você manter um fluxo de amostragem antigo. Outros modos de contexto aumentam o risco de vazamento e são eles mesmos depreciados. Passe o contexto mínimo explícito no pedido.

## Invariantes de segurança

O cliente é o limite de confiança para as solicitações de amostragem embutidas.

- Mostrar ao usuário o que o servidor está a pedir ao modelo para fazer quando a política requer aprovação.
- Um servidor malicioso pode criar um ciclo de gastos de modelo.
- Validar cada resposta de amostragem antes de usá-la como um nome de arquivo, URL ou entrada de ferramenta.
- Limite bytes e tokens por rodada.
- Recusar uma solicitação de entrada que não foi declarada nas capacidades atuais do cliente.
- Mantenha a saída do modelo fora das decisões de autorização.
- Registrar o método de origem e a chave de entrada-requisito sem registar conteúdo de pedido sensível.

`clientInfo`E ...`serverInfo`Não utilizar nenhum dos dois como identidade autenticada.

```figure
t3-sampling-flip
```

## Construí-lo

`code/main.py`Implementa o fluxo integral de duas rodadas sem pacotes de terceiros:

- `server/discover`Retorno `supportedVersions`, anuncia o suporte à ferramenta e retorna as dicas do cache.
- `tools/list`Retorna um determinista, cacheable `summarize_repo`Descrição com um esquema de entrada de objeto.
- `tools/call`valida os metadados por pedido.
- O primeiro resultado inclui `sampling/createMessage`para a selecção de ficheiros.
- A primeira retestativa valida o resultado do modelo e incorpora um segundo pedido.
- Protegida por HMAC `requestState`A Comissão deve apresentar uma proposta de decisão.
- O resultado final utiliza `resultType: "complete"`- Não .

O modelo de hospedeiro falso torna o exemplo determinista.`fake_host_model`A máquina de estado do lado do servidor deve permanecer determinista e testável.

## Usá-lo

A partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Pontos de controlo previstos:

- A Discovery retorna um resultado completo com `ttlMs`E ...`cacheScope`- Não .
- O Tool Discovery retorna o mesmo descrito de tipo com `resultType`, identidade do servidor e sugestões de cache.
- Capacidades faltantes e versões não suportadas usam exato `-32021`E ...`-32022`dados de erro.
- Uma notificação sem id não produz resposta JSON-RPC.
- As identidades de pedido são `[1, 2, 3]`, provando que cada rodada MRTR é independente.
- Os dois primeiros resultados são:`input_required`- Não .
- O resultado final é:`complete`e contém os ficheiros seleccionados, mais um resumo.
- A alteração dos argumentos originais numa retestada falha na verificação do estado de solicitação.

## Envia-o

`outputs/skill-sampling-loop-designer.md`O sistema de seleção de modelos é um sistema de seleção de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de modelos de

## Exercícios

1. Alterar a resposta de seleção de arquivo para JSON inválido. Confirmar o servidor retorna `-32602`Em vez de confiar na saída do modelo.
2. Mudança .`audience`Explique porque o estado selado impede a reutilização de pedidos cruzados.
3. Adicione uma terceira rodada que peça ao anfitrião para criticar o resumo.
4. Remova a amostragem substituindo o falso callback do host por um adaptador de modelo de propriedade do servidor.
5. Adicionar um teste de expiração usando um valor de estado que seja um segundo após o seu prazo.

## Termos-chave

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## Compatibilidade do legado

Um cliente fichado para 2025-11-25 pode ainda usar o servidor mais antigo iniciado `sampling/createMessage`Não faça do caminho de sessão a arquitetura para um servidor 2026-07-28.

Os SDKs oficiais podem traduzir modernos `input_required`Esse shim é um limite de compatibilidade, não permissão para adicionar nova lógica dependente de sessão.

## Mais leitura

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
