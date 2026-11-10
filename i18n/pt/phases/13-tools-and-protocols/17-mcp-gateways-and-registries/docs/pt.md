# Portas de acesso e registro de MCP sem nacionalidade

> Um gateway deve tornar cada rota explícita. O protocolo 2026-07-28 dá-lhe método, nome, versão, capacidade, identidade, cache e limites de rastreamento sem uma sessão de transporte.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Agregar vários servidores MCP atrás de um endpoint 2026-07-28 sem afinidade de sessão.
- Validar os metadados e cabeçalhos de roteamento por pedido antes da política ou da encaminhamento.
- Fuse ferramentas com espaços de nomes estáveis, ordem determinista, pinos de descrição, RBAC e cache privado.
- Tratar os registos como evidências de descoberta que ainda exigem política de admissão.
- SSE de rota escalonada por pedido, `subscriptions/listen`, MRTR retestes, e tarefas extensão chamadas corretamente.
- Isole o apoio de mão e sessão do caminho moderno.

## O problema

Conectar um cliente diretamente a um servidor é simples. Uma implantação maior precisa de uma resposta consistente a perguntas mais difíceis:

- Que servidores são permitidos?
- Que diretor pode ver e ligar a cada ferramenta?
- O que acontece quando dois backends expõem o mesmo nome?
- Como são analisadas as alterações no descrito?
- Onde são aplicados os limites de taxas e os eventos de auditoria?
- Qualquer instância pode lidar com o próximo pedido?

Um gateway fica entre os clientes e os servidores MCP de backend. Ele apresenta um endpoint MCP, aplica políticas transversais e encaminha pedidos aprovados.

Os projetos de gateway mais antigos muitas vezes multiplicam uma sessão de cliente em várias sessões backend e reescrevem `Mcp-Session-Id`O núcleo 2026-07-28 não tem sessões de protocolo.

## O conceito

### O caminho moderno da porta de entrada

Para cada pedido:

1. A autenticação do principal da autorização de transporte.
2. Validação`MCP-Protocol-Version`- Não .`Mcp-Method`- Não .`Mcp-Name`, e `params._meta`- Não .
3. Autorize o principal, recurso, método, ferramenta e argumentos.
4. Aplicar descriptório, registo, taxa e política de dados.
5. Crie uma nova solicitação independente para o backend selecionado.
6. Validar o resultado de backend e retornar um resultado de gateway.
7. Registrar um evento de auditoria sem registar segredos.

Nenhum passo precisa de uma sessão de protocolo oculta. O estado de aplicação ainda pode existir em bancos de dados, manuais explícitos, tarefas ou estado MRTR protegido pela integridade.

### A política de tempo de execução é a principal decisão de entrada

A admissão decide qual versão de backend pode entrar no gateway. Não autoriza uma chamada ao vivo. Para cada solicitação, o gateway recalcula a política do principal autenticado, emissor e recurso, inquilino, método e nome correspondentes, argumentos normalizados, pin de descrição admitido, saúde de backend atual, interseção de capacidade, classificação de dados, estado de taxa e qualquer aprovação vinculada à ação.

Um registro de registro pode permanecer ativo enquanto o papel de um usuário é revogado. Um descritivo pode permanecer fichado enquanto um argumento de destino cruza um limite de inquilino. Um backend pode permanecer aprovado enquanto a política de quarentena incidente mudanças de estado chamadas.

Não cache uma decisão de permitir sob uma conexão ou identificador de sessão removido. Se a política não estiver disponível, siga uma política de falha declarada por classe de operação. Um padrão seguro é o de não fechar para alterações de estado e leituras sensíveis, enquanto os caminhos de leitura pública explicitamente aprovados só podem usar uma política de última vez conhecida de curta duração quando o seu modelo de risco o permite. Registrar qual versão de política e caminho de falha tomou a decisão, em seguida, validar o resultado de backend antes de devolvê-lo.

### Um ponto final POST

O HTTP Streamable moderno envia cada mensagem JSON-RPC através do POST:

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

O gateway pode retornar JSON ou SSE escaneado por solicitação para esse POST. GET e DELETE retornar 405 para solicitações modernas. `Mcp-Session-Id`E ...`Last-Event-ID`não criar autoridade, afinidade ou repetição de comportamento.

Os valores do cabeçalho e do corpo devem concordar.`-32020`Isto permite que os equilíbrios de carga, gateways e limitadores de velocidade percorram sem analisar o corpo inteiro, preservando a integridade de ponta a ponta.

Valida em uma ordem exata: JSON-RPC e tipos de metadados, equivalência de cabeçalho e corpo, em seguida, suporte para a versão correspondente.`-32020`. Se o cabeçalho e o corpo concordarem em uma versão não suportada, retorne HTTP 400 com `-32022`E ...`data`- Exactamente .`{"supported":["2026-07-28"],"requested":"<actual>"}`Um método desconhecido retorna HTTP 404 com `-32601`- Não .

`ProtocolError`Carrega opcional `data`, e o gateway serializa-lo no objeto de erro JSON-RPC.`id`Uma notificação HTTP aceita retorna 202 com um corpo vazio.

### Implementar a descoberta em cada camada

O portal implementa `server/discover`Também descobre cada backend para que conheça as versões de protocolo, capacidades e extensões.

Resultado do gateway:

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

Anunciar apenas a interseção de recursos que o gateway pode honrar de ponta a ponta. Um recurso backend não é automaticamente seguro de expor. Um recurso gateway sem caminho backend não é útil para anúncios.

`serverInfo`Não o utilize como prova de registro ou de editor.

### Capacidades de cliente por pedido

Cada pedido enviado precisa de uma actualização `_meta`Envelope:

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

Não copie cegamente as capacidades do cliente externo para um backend. O gateway é o cliente do backend.

### Espaçamento de nomes determinista

Fundição de ferramentas de backend sob nomes públicos estáveis:

```text
notes.search
notes.create
issues.list
issues.open
```

Mantenha um mapeamento do nome público para o backend e nome da ferramenta original. Nunca escolha a primeira ou última colisão. Um nome público é parte do contrato de aprovação e auditoria, por isso mudá-lo é uma migração.

`tools/list`Quando a visibilidade difere por principal, retornar`cacheScope: private`- Um limite .`ttlMs`Reduz a carga de descoberta do backend sem permitir que uma lista específica do usuário seja filtrada em contextos de autorização.

Cada descriptor de ferramenta exposto inclui um nome estável, descrição e raiz-objeto `inputSchema`. O espaçamento de nomes não pode remover os campos de descrição necessários. O resultado da lista completa também inclui `resultType`Metadados de identidade do servidor e sugestões de cache.

### Descrição de pin homologada

No momento da admissão, canonize o descrito completo e armazenar o seu digest sob o nome público qualificado.

Se for alterada:

- Remova-o de `tools/list`- Não .
- Rejeita chamadas diretas.
- Emite um evento de auditoria.
- Requer a aprovação política ou humana antes de atualizar o pin.

Um portal é um ponto central de aplicação útil, mas não transforma um descritivo inicialmente visto em um seguro.

### Os registos ajudam a descobrir, não a decidir

Um Registo `server.json`Um registro apoiado em pacotes pode parecer assim:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

Os metadados da publicação não contêm a decisão de segurança do portal.

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

O portal verifica o `server.json`O portal ainda precisa de uma política de admissão.

Para cada backend admitido, registar:

- Registo e identificação de registro exatos.
- Espaço de nomes ou evidências de domínio verificados.
- Transporte permitido e ponto final.
- Versão empinada ou política de atualização aprovada.
- Digestão de artefatos ou descriptórios.
- Emitente e recurso da autorização.
- Revisor, tempo de aprovação e expiração.

Não aceite um servidor porque o nome da sua exibição se assemelha a um produto familiar. Não trate a presença do registro como uma revisão de segurança operacional. Os servidores privados podem ser admitidos através do mesmo esquema de evidência, mesmo que nunca apareçam em um registro público.

Esta lição implementa a função de porta de entrada: unir a evidência da publicação à admissão local antes que um backend se torne rotativo. [Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md)Construir o plano de controle completo para a prova exata do espaço de nomes, proveniência do artefato, pins imutáveis, derivação do descrito ao vivo, reconciliação do status do Registo, um livro de admissões de manipulação evidente e um retrocesso apoiado por evidências.

### Medicação de credenciais

O gateway autentica os seus chamadores e autentica separadamente os backends.

Mantém as seguintes obrigações explícitas:

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

Nunca passe o token de gateway externo para um backend. Nunca reutilize um token de backend em um emissor ou recurso diferente. Se uma ferramenta age em nome de um usuário final, preserve essa delegação com um modelo de troca ou reivindicações projetado em vez de se passar por um usuário com uma credencial de serviço compartilhado.

### Limites de taxa sem sessões

Limitações-chave por principal autenticado, emissor, recurso, ferramenta pública, classe de custo e janela de tempo.

Aplique a validação barata antes de consumir trabalho caro. Decida se os chamadas rejeitadas contam com limites de abuso, cotas de negócios ou ambos.

### Auditoria da cadeia de decisões

Gravar o suficiente para reconstruir uma chamada:

- Identificadores de solicitação e rastreamento.
- Capital e emissor autenticados.
- Ferramenta pública e rota de backend.
- Verão de pin de descrição.
- Decisão política e razão.
- A classe de latência e resultados.
- Identificador de rodada ou tarefa MRTR, quando aplicável.

Tokens de redator, códigos de autorização, tokens de atualização, segredos crues e argumentos sensíveis desnecessários.

### A SSE adaptada à solicitação

Um POST normal pode retornar a solicitação-escopo SSE quando os fluxos de trabalho durante essa única solicitação. fechar o fluxo de resposta cancela que em voo moderno HTTP solicitação.

Não crie um fluxo GET separado e não prometa repetição do último evento.

### Notificações de alterações de longa duração

Para notificações de alteração de lista e recurso, um cliente atual envia `subscriptions/listen`Os filtros de notificação utilizam os campos planos exatos `toolsListChanged`- Não .`promptsListChanged`- Não .`resourcesListChanged`, e `resourceSubscriptions`- Não .

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

O primeiro evento reconhece o subconjunto suportado. Seu identificador de assinatura é o ID JSON-RPC da solicitação que abriu o fluxo:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

O gateway então envia apenas os tipos de alterações reconhecidos.`io.modelcontextprotocol/subscriptionId`em `params._meta`Não há reprodução automática ou re-audição automática. Ao reconnectar, o cliente reabre a assinatura e atualiza as listas em que depende. Um fechamento gracioso iniciado pelo servidor retorna um resultado completo final etiquetado com a mesma identificação de assinatura.

O caminho moderno substitui`resources/subscribe`- Não .`resources/unsubscribe`Mantém-as apenas num caminho antigo com versões fechadas.

### MRTR através de um portal

Quando um backend voltar `resultType: input_required`, o gateway só pode encaminhar esse resultado se o cliente externo apoiar a solicitação de entrada necessária.`requestState`O sistema de acesso deve ser utilizado para a comunicação de dados e de dados.

O cliente retestará a ferramenta pública original com um ID JSON-RPC novo e `inputResponses`O portal de acesso reautorizará a reaprovação, verificará a mesma rota pública e enviará um novo pedido de backend.

### Funções de encaminhamento de extensão

As tarefas são uma extensão oficial identificada por `io.modelcontextprotocol/tasks`Não são um substituto de sessões de base.

O cliente declara a extensão dentro das capacidades do cliente por pedido, e o gateway anuncia-o em descoberta apenas quando pode preservar o ciclo de vida de fim a fim.`tools/call`, o backend só decide se retorna o resultado normal ou `resultType: task`Um resultado da tarefa leva `taskId`- Não .`status`, timestamps, `ttlMs`, e opcional `pollIntervalMs`A tarefa deve ser duradoura e legível antes de ser enviada.

O gateway registra a rota principal e backend autenticada para o identificador de tarefa opaco.`tasks/get`- Não .`tasks/update`, e `tasks/cancel`- Aplicações`params.taskId`Como `Mcp-Name`, que dá aos intermediários uma chave de encaminhamento. `tasks/get`Retorno `resultType: complete`com o estado da tarefa atual e inclui o resultado final ou o erro de protocolo em um estado terminal. `tasks/update`Envia-se com chave`inputResponses`para entrada de tarefa pendente e retorna um reconhecimento completo vazio. `tasks/cancel`É uma intenção cooperativa com um reconhecimento completo vazio, não uma garantia de que o trabalho se detém.

Não implementar novos `tasks/list`ou `tasks/result`A função que requer entrada expõe pedidos integrados completos através de`tasks/get`O cliente responde-lhes através de`tasks/update`O cliente ainda vota no intervalo sugerido; a criação de tarefas permanece orientada pelo servidor.

O estado de rota de tarefa durável é dados de aplicação teclados pelo maná de tarefa, não uma sessão de protocolo.

### Limite de compatibilidade

Se o gateway tiver de servir um cliente ou backend mais antigo:

- Detetar a era explicitamente.
- Mantenha a inicialização, sessões de transporte, fluxos GET, assinaturas de recursos e vocabulário de tarefas antigo dentro de um adaptador legado.
- Nunca ligue um ID de sessão antigo para roteamento ou autorização moderna.
- Prefere uma sonda de descoberta limitada e uma política explícita de retrocesso ao contrário de um desvalorização silenciosa.

```figure
t3-gateway-funnel
```

## Construí-lo

`code/main.py`O gateway fornece uma porta de acesso de protocolo em processo e dois servidores backend.`tools/list`, roteamento com espaços de nome, Registro `server.json`Além do estado de admissão externa, pinos de descrição, RBAC, limites de taxas de juro baseados em principais critérios, decisões de auditoria e um modelo `subscriptions/listen`Reconhecimento da SSE.

O modelo recebe corpos de solicitações analisados, cabeçalhos de roteamento e uma identidade de portador autenticada.`Content-Type`ou o completo`Accept`Conecte-o ao adaptador HTTP Streamable da lição 09 , que requer `Content-Type: application/json`e um `Accept`valor que contém ambos `application/json`E ...`text/event-stream`- Não .

- É o que é ?

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

A demonstração imprime o ID externo da solicitação e o ID de solicitação de backend fresco para que o hop sem estado seja visível.

## Usá-lo

Substitua os objetos de backend em processo com clientes reais de protocolo de corrente. Mantenha as mesmas costuras:

- Registo de admissão antes da ligação.
- Descoberta de fundo antes da exposição de capacidade.
- Nome público qualificado antes da autorização.
- Pin de descrição antes de lista ou chamada.
- Metadados frescos por pedido antes da remessa.
- Validação do resultado antes de retornar.

## Envia-o

Esta lição vai avançar .`outputs/skill-gateway-bootstrap.md`. Produz um design moderno de gateway que abrange entrada, descoberta, admissão, espaços de nomes, autorização, armazenamento em cache, streaming, assinaturas, MRTR, tarefas, observabilidade e isolamento legado.

## Exercícios

1. Adicionar contexto de rastreamento aos metadados externos e enviados de pedido e registar a correlação no evento de auditoria.
2. Adicionar um backend e rota com funções`tasks/get`por tarefa id em `Mcp-Name`- Não .
3. Mudança um descritivo de backend e prova que a descoberta e a chamada direta estão bloqueadas.
4. Adicione uma capacidade de servidor específica do principal e explique por que a descoberta deve permanecer em cache privado.
5. Escreva uma interface do adaptador antigo sem adicionar qualquer estado antigo ao moderno `Gateway`A aula.

## Termos-chave

| Term | Meaning |
|------|---------|
| MCP gateway | Policy and routing server between clients and backend MCP servers |
| Admission record | Evidence and policy decision allowing one backend into the gateway |
| Qualified tool name | Stable public route such as `notes.search` |
| Descriptor pin | Approved digest checked during discovery and dispatch |
| Private cache scope | Cached result restricted to one authorization context |
| Request-scoped SSE | Streaming response attached to one POST request |
| `subscriptions/listen` | Client-opened SSE stream for selected long-lived change notifications |
| Task route | Application mapping from an opaque task id to its backend |
| Legacy adapter | Explicit version-gated boundary for old handshake and session behavior |

## Mais leitura

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
