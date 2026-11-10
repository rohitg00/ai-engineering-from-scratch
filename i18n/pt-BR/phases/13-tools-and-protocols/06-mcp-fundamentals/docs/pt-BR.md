# Fundamentos do MCP: Solicitações de apátridas e JSON-RPC

> O MCP moderno não tem aperto de mão e nenhuma sessão de protocolo. Cada solicitação deve conter metadados suficientes para serem entendidos, autorizados, encaminhados e retestados por conta própria.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 01 through 05
**Time:** ~55 minutes

## Objetivos de aprendizagem

- Distinguir os primitivos do servidor do MCP de suas características do lado do cliente.
- Construa solicitações e respostas válidas JSON-RPC 2.0 para MCP `2026-07-28`- Não .
- Anexe versão de protocolo, capacidades do cliente e identidade do cliente a cada solicitação.
- Utilização`server/discover`e manusear .`UnsupportedProtocolVersionError`sem um aperto de mão.
- Rastrear um pedido independente da validação até um resultado completo.

## O problema

Um servidor MCP pode receber duas solicitações consecutivas de clientes diferentes, com capacidades diferentes, no mesmo processo ou servidor HTTP. Se o servidor lembrar o que a solicitação anterior declarou, ele pode aplicar as permissões erradas ou retornar a forma errada de fio.

MCP `2026-07-28`O protocolo é sem estado, o servidor deve decidir como lidar com a solicitação atual a partir da solicitação atual, não do histórico de conexão.

A antiga sequência era a conexão primeiro, aperto de mão segundo, operações terceiro.

1. O cliente envia um pedido de auto-descrição.
2. O servidor valida a versão e as capacidades daquele pedido.
3. O servidor lida com o método.
4. O servidor retorna um resultado digitado ou um erro JSON-RPC.

O pedido seguinte repete o mesmo processo a partir do zero.

## O conceito

### Servidores primitivos

Os servidores MCP expõem três primitivas primárias:

1. **Tools**são ações controladas por modelo, descobertas com `tools/list`e invocado com `tools/call`- Não .
2. **Resources**são dados endereçados por URI, descobertos com `resources/list`e recuperado com `resources/read`- Não .
3. **Prompts**são modelos reutilizáveis, descobertos com `prompts/list`e traduzido com `prompts/get`- Não .

As raízes, a amostragem e a madeira permanecem no `2026-07-28`O programa de compatibilidade, mas é desaproveitado. As novas implementações devem utilizar ferramentas ou recursos explícitos para as raízes, APIs directas do fornecedor de modelos para a amostragem e stderr ou OpenTelemetry para a registros. A solicitação continua disponível através de Requests Multi Round-Trip, onde um servidor retorna uma solicitação de entrada e o cliente retrata a operação original. Um servidor moderno nunca inicia uma solicitação independente JSON-RPC.

### Envelopes JSON-RPC

MCP utiliza JSON-RPC 2.0:

- Solicitação: `{jsonrpc, id, method, params}`
- Resposta: `{jsonrpc, id, result}`ou `{jsonrpc, id, error}`
- Notificação: `{jsonrpc, method, params}`sem nenhum`id`

O pedido `id`correlaciona uma resposta. Não cria uma sessão de protocolo.

### Metadados necessários para o pedido

Cada pedido moderno carrega um`_meta`O objeto interior`params`- Não .

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

A versão de protocolo e as capacidades do cliente são necessárias. A identidade do cliente é recomendada. É auto-relatado exibição e debug dados, não uma credencial de segurança.

O servidor não deve inferir nenhum desses valores a partir de uma solicitação anterior, um processo de estúdio, uma conexão HTTP ou um cabeçalho de transporte sozinho.

### Resultados completos e identidade do servidor

Cada resultado moderno bem sucedido inclui`resultType`Um resultado final normal usa`"complete"`Os servidores devem também identificar-se nos metadados dos resultados:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "tools": [],
    "ttlMs": 30000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "notes-server",
        "version": "1.0.0"
      }
    }
  }
}
```

`tools/list`- Não .`resources/list`- Não .`prompts/list`- Não .`resources/templates/list`- Não .`resources/read`, e `server/discover`Os resultados são armazenáveis em cache.`ttlMs`E ...`cacheScope`Um padrão seguro é`ttlMs: 0`E ...`cacheScope: "private"`. Os itens de lista devem ter uma ordem determinista para que respostas equivalentes produzam chaves de cache estáveis e contexto de modelo estável.

### Descoberta sem apertar a mão

Todos os servidores modernos devem implementar `server/discover`O cliente pode chamá-lo antes de outro método para obter:

- `supportedVersions`
- servidor`capabilities`
- utilização opcional `instructions`
- Identidade do servidor em resultado `_meta`
- Indicações de cache

A descoberta é útil, mas não é um portal.`tools/list`Primeiro, porque esse pedido já possui a sua versão de protocolo e as suas capacidades.

Se a versão solicitada não for suportada, o servidor retorna o código JSON-RPC `-32022`com:

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

O cliente seleciona uma versão moderna com suporte mútuo e retrata com um novo ID de solicitação JSON-RPC.

### Um ciclo de vida da solicitação

Traçar uma solicitação moderna nesta ordem:

1. Parsear um envelope JSON-RPC.
2. Confirme .`jsonrpc`É o que é`"2.0"`, um `id`Existe,`method`é uma corda, e `params`é um objeto.
3. Requer o objeto de cadeia de versão e capacidade em `params._meta`Os metadados malformados ou faltantes são:`-32602`- Não .
4. Em uma fronteira HTTP, compare a versão, método e cabeçalhos de nome aplicáveis com o corpo.`-32020`Mesmo quando um dos dois valores de versão não for suportado.
5. Após a igualdade ser estabelecida, rejeite uma versão correspondente mas não apoiada com `-32022`- Não .
6. Verifique as capacidades necessárias, e depois percorra por `method`e validar os argumentos específicos do método.
7. A autenticação e autorização da operação de concreto antes de o seu manipulador ser executado.
8. Retorna um resultado completo com identidade do servidor.
9. Esqueça os metadados do protocolo.

Essa ordem impede que dois componentes interpretem chamadas diferentes.`Mcp-Name: notes.read`enquanto a origem executa`params.name: notes.delete`Também mantém entrada malformada, confusão de cabeçalho, negociação de versão, falha de capacidade, autorização e falha de processador como evidências distintas.

Fechar o stdin ou uma resposta HTTP termina a atividade de transporte. Não termina uma sessão de protocolo porque o MCP moderno não tem sessão de protocolo.

### Compatibilidade explícita com o legado

Versões através de `2025-11-25`uso`initialize`- Não .`notifications/initialized`O comportamento ainda é relevante quando um cliente de dupla era conversa com um servidor antigo.

Mantenha as eras separadas. Uma solicitação moderna é identificada pelos metadados exigidos por solicitação. Uma conexão legada é selecionada apenas através do caminho de regressão documentado. Não envie `initialize`como o padrão para um `2026-07-28`Servidor.

O "patrialidade" tem, portanto, um significado específico da época.`2026-07-28`, é um protocolo invariante: cada pedido ordinário é independente e não existe sessão de MCP.`2025-11-25`A implementação de duas eras não é uma máquina de estado permisivo. É um núcleo moderno sem estado ao lado de um adaptador isolado, com uma decisão de seleção explícita antes de qualquer um dos parseiros ser executado.

Nenhum dos significados proíbe o estado duradouro da aplicação. Um fluxo de trabalho, tarefa ou rascunho pode viver atrás de um manilho opaco em uma loja compartilhada. O cliente envia esse manilho como entrada comum, e cada réplica autentica e autoriza seu uso. O contexto do protocolo não deve vazar para essa loja como substituto da sessão removida.

```figure
mcp-tool-call
```

## Usá-lo

`code/main.py`Cria, valida, rastreia e envia mensagens MCP modernas sem um framework.

```bash
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

Cuidado com três invariantes na saída:

- Cada pedido repete o seu`_meta`campos.
- Todo resultado bem sucedido é`resultType: "complete"`e inclui a identidade do servidor.
- O resultado da lista é ordenado deterministicamente e tem indicações de cache explícitas.

## Envia-o

Esta lição vai avançar .`outputs/skill-mcp-handshake-tracer.md`O nome histórico do arquivo permanece estável, mas o artefato é agora um rastreador de solicitações sem estado.

## Exercícios

1. Alterar a versão de protocolo de um pedido para `2027-01-01`Confirme o código de erro .`-32022`e os dados anunciam a versão suportada.
2. Remover`io.modelcontextprotocol/clientCapabilities`Confirmar que o servidor não reutiliza recursos da primeira solicitação.
3. Reverte o registro de ferramentas em memória.`tools/list`Ainda retorna a mesma ordem determinista.
4. Mudança .`cacheScope`de`public`- Não .`private`- Explique quais contextos de autorização podem reutilizar a resposta em cada caso.
5. Adicionar uma opcional `clientInfo`O pedido deve permanecer válido porque a identidade do cliente é recomendada, não exigida.

## Termos-chave

| Term | Meaning |
|------|---------|
| Stateless protocol | Every request supplies the metadata needed to interpret it |
| Request metadata | Version, client capabilities, and recommended client identity in `params._meta` |
| `server/discover` | Mandatory server method for versions, capabilities, instructions, and identity |
| `resultType` | Discriminator on every successful modern result |
| Cacheable result | Result that includes required `ttlMs` and `cacheScope` hints |
| Protocol era | Modern per-request metadata or legacy connection-scoped initialization |
| Transport lifetime | Process, connection, or response-stream lifetime, not protocol session state |
| `-32022` | Unsupported protocol version error with requested and supported versions |

## Mais leitura

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
