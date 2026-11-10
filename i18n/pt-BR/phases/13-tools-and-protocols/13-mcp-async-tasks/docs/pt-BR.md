# Extensão das tarefas do MCP: Trabalho duradouro sobre um núcleo sem nacionalidade

> O MCP sem estado não significa que todas as operações devem ser concluídas em uma única solicitação. A extensão oficial Tasks dá ao trabalho de longa duração um manilho durável explícito. Um servidor pode devolver esse manilho a partir de `tools/call`Qualquer instância pode responder .`tasks/get`, e a entrada do cliente chega através de `tasks/update`Sem reanimar sessões de protocolo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Distinguir o transporte de protocolo sem estado de aplicação do estado de tarefa de aplicação durável.
- Negociar o `io.modelcontextprotocol/tasks`Extensão das capacidades por pedido e `server/discover`- Não .
- Retorna um servidor-direcionado `CreateTaskResult`com`resultType: "task"`Só depois de uma criação duradoura.
- Pesquisa com `tasks/get`, cumprir tarefas de entrada com `tasks/update`, e solicitar a cancelamento da cooperação com `tasks/cancel`- Não .
- Remova o mais velho .`tasks/status`- Não .`tasks/result`, e `tasks/list`- As suposições.
- Subscreva-se às notificações opcionais de tarefas através de `subscriptions/listen`em um fluxo SSE de resposta POST.
- Expirar a tarefa modelo, reiniciar a recuperação, deduplicar a chave de entrada e erros de execução corretamente.

## Por que as tarefas são uma extensão

As tarefas apareceram pela primeira vez como uma característica central experimental em 2025-11-25.`io.modelcontextprotocol/tasks`Extensão para que clientes e servidores possam optar pelo ciclo de vida extra sem expandir o protocolo principal para todos.

A especificação da extensão continua a ser uma superfície de esboço, mesmo que seja a casa oficial atual para tarefas.

Usar uma tarefa quando a operação tiver uma ou mais das seguintes propriedades:

- Pode sobreviver a um prazo normal de solicitação.
- Uma fila de trabalhadores ou um sistema externo de emprego já possui execução.
- O cliente precisa de se recuperar depois de a sua própria reinicialização.
- A operação faz pausas para a entrada do usuário ou modelo durante a execução.
- A cancelamento e a recuperação de resultados duradouros são requisitos do produto.

Não crie uma tarefa para uma pesquisa determinista barata. Um manto, persistência, votação, expiração e cancelamento são complexidades reais.

## Núcleo de Estadão, Aplicação Estadual

MCP 2026-07-28 remove `initialize`- Não .`notifications/initialized`, sessões de protocolo, e`Mcp-Session-Id`Isso não proíbe os produtos de estado.

Um id de tarefa é um estado de aplicação explícito:

- O servidor insiste antes de devolvê-lo.
- O cliente pode armazená-lo e fazer uma pesquisa depois de reiniciar.
- A identificação pode ser encaminhada para qualquer réplica apoiada pela mesma loja durável.
- A autorização é verificada em cada método de tarefa.
- A expiração e a exclusão são definidas por campos de tarefas, não por um período de vida útil do transporte.

Isto é operacionalmente diferente do estado oculto ligado a uma conexão.

Mantém quatro vidas separadas:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

Movendo um registro de tarefa para a memória de processo não torna o MCP com estado.`tasks/get`Perseverar antes de devolver o manto, então fazer com que cada método de tarefa resolva o mesmo registro compartilhado sob inquilinos e cheques de principal.

## Negociação de Capacidade

O cliente anuncia apoio a cada pedido elegível:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

O servidor retorna exato `supportedVersions`, capacidades,`ttlMs`, e `cacheScope`de`server/discover`A Comissão propõe que os Estados-Membros, em conformidade com o artigo 107.°, n.° 1, do Tratado, tenham a mesma extensão em termos de capacidades.`tools/list`Esse resultado retorna uma determinação .`generate_report`Descrição, objeto válido `inputSchema`- Não .`resultType: "complete"`, metadados de identidade do servidor e dicas de cache público.

Um método de tarefa de um cliente que não declarou os retornos de extensão `-32021`, Falta de capacidade de cliente exigida, com `data.requiredCapabilities`definido para `{"extensions":{"io.modelcontextprotocol/tasks":{}}}`Uma cadeia de protocolo não suportada retorna .`-32022`com exato`supported`E ...`requested`dados; uma versão faltante ou não-string retornar `-32602`- Não .

Um envelope sem um JSON-RPC `id`O receptor pode processá-lo, mas não emite nenhum resultado ou erro JSON-RPC. Um adaptador HTTP Streamable retorna `202 Accepted`Sem organismo para uma notificação aceita.

No momento, apenas`tools/call`Desenha a sua abstração interna para que os tipos de solicitações futuros não necessitem de reescrever armazenamento.

## Criação de tarefas dirigidas por servidores

A velha bandeira do cliente .`params._meta.task.required`O cliente declara o suporte de extensão, e o servidor decide se um determinado`tools/call`torna-se uma tarefa.

Pedido:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Resposta:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

O servidor não deve devolver esta manobra até que um `tasks/get`Em uma loja eventualmente consistente, espere a visibilidade de leitura antes de responder. caso contrário, um cliente pode receber um ID válido e imediatamente obter "não encontrado".

Uma resposta à tarefa não é solicitada no sentido de que o cliente não solicita o modo tarefa.

## A forma da tarefa

Cada tarefa inclui:

- `taskId`: identificador estável gerado pelo servidor;
- `status`- Não .`working`- Não .`input_required`- Não .`completed`- Não .`cancelled`, ou `failed`O artigo 2.o
- `createdAt`E ...`lastUpdatedAt`: marcas de tempo ISO 8601;
- `ttlMs`: duração de expiração desde a criação, ou `null`sem limite anunciado;
- opcional`pollIntervalMs`: cadência de votação sugerida mínima do servidor;
- opcional`statusMessage`: contexto orientado para o utilizador ou para o modelo.

Os campos específicos de status só aparecem quando relevantes:

- `input_required`inclui`inputRequests`- Não .
- `completed`Inclui as informações do pedido original `result`- Forma.
- `failed`inclui um JSON-RPC `error`Objeto.

O cliente deve honrar .`pollIntervalMs`Um servidor pode limitar as taxas de pesquisas mais agressivas e pode alterar o intervalo durante a vida útil da tarefa.

## Pesquisa com `tasks/get`

O cliente pede uma instantânea atual:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get`O resultado é sempre o mesmo.`resultType: "complete"`A tarefa aninhada ainda pode ter`status: "working"`ou `status: "input_required"`- Não .

Esta distinção impede um bug comum do parser:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

Não há .`tasks/result`Quando a tarefa estiver concluída, o próximo `tasks/get`A resposta inclui o original `CallToolResult`Sub`result`- Não .

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

O exterior .`resultType`Diz o `tasks/get`O RPC completado.`result.resultType`O dispositivo original de chamada de ferramenta completado.`CallToolResult`Deveria também ter o seu próprio .`io.modelcontextprotocol/serverInfo`Esta lição inclui-o em vez de armazenar uma carga útil não tipográfica.

Não há .`tasks/list`Os servidores sem sessão não podem inferir com segurança quais tarefas pertencem a uma lista escaneada por conexão.

## Introdução durante a execução de tarefas

A entrada de tarefa e o MRTR central parecem semelhantes, mas usam continuidades diferentes.

### Entrada necessária antes da criação de tarefa

Núcleo de retorno`resultType: "input_required"`do original `tools/call`O cliente cumpre e retrata a chamada original, só cria a tarefa depois que as rodadas de MRTR sincronas terminem.

### Entrada necessária após a criação da tarefa

Defina a tarefa para `input_required`- Não .`tasks/get`expõe o excepcional `inputRequests`, e o cliente envia respostas através de `tasks/update`O cliente não retoma o original .`tools/call`- Não .

Imagem:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

Atualização:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

A resposta de sucesso é um reconhecimento vazio e mais `resultType: "complete"`A mudança de estado pode eventualmente ser consistente, então o cliente continua a votar ou a ouvir.

Cada um .`inputRequests`A chave deve ser única para toda a vida da tarefa.`tasks/get`Os dados de um servidor podem ser utilizados para fazer uma análise de dados de um servidor.`input_required`Até que todas as chaves necessárias sejam respondidas.

## Cancelamento é cooperativo

`tasks/cancel`O trabalho pode terminar primeiro, ignorar o cancelamento ou a transição mais tarde.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Para os três métodos de tarefa,`Mcp-Name`espelhos`params.taskId`Não repete o nome do método JSON-RPC. `code/main.py`centraliza esta regra em `make_http_request`- Não .

O trabalhador da lição honra a cancelamento imediatamente, fazendo chamadas repetidas idempotentes.

Não utilize `notifications/cancelled`Esta notificação pertence a um pedido de cancelamento, não a tarefas duradouras.

A distinção importa na fronteira de roteamento. A cancelamento de solicitações visa uma operação JSON-RPC em voo ou sua resposta HTTP escopoada por solicitação.`tools/call`Já voltou .`resultType: "task"`O pedido é completo e o encerramento do seu transporte não pode nomear ou interromper o trabalho duradouro. `tasks/cancel`O presente regulamento é um novo RPC autorizado.`params.taskId`, espelhos que identificam`Mcp-Name`, resolve o backend de posse da tarefa, registra a intenção de cancelamento da cooperativa e retorna um reconhecimento sem alegar que o trabalhador parou.

Uma gateway deve, portanto, manter os coordenadores de solicitações e as rotas de tarefas em tabelas diferentes. A tabela de solicitações pode desaparecer quando a resposta termina. A rota de tarefas deve sobreviver até o estado terminal e a expiração da retenção. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)Construi a corrida, o tempo de espera, a impotência, a pressão e a regra de retomada para ambos os caminhos.

## Notificações opcionais

Uma cliente que quer actualizações push envia`subscriptions/listen`Para Streamable HTTP, este é um POST cuja resposta é um fluxo de SSE com escala de solicitação. Não há fluxo de eventos GET independente e nenhuma sessão de protocolo para manter vivo.

O servidor reconhece as identidades aceitas com `notifications/subscriptions/acknowledged`e pode então enviar instantâneos completos através `notifications/tasks`O reconhecimento e todas as notificações de tarefas`io.modelcontextprotocol/subscriptionId`em `_meta`, igual ao `subscriptions/listen`Cada notificação de tarefa é equivalente a`tasks/get`Voltaria nesse momento.

Os clientes ainda devem declarar a extensão das tarefas. Eles devem reconectar e retomar a partir de ids de tarefas duráveis em vez de depender da repetição de eventos ou `Last-Event-ID`- Não .

## Semântica do fracasso

Use as duas camadas de erro corretamente.

### Erro de protocolo

Parâmetros de método inválidos ou um id de tarefa desconhecido retornam um erro JSON-RPC, comumente `-32602`- Falta de declarações de apoio à extensão .`-32021`com o objeto de capacidade exigido.

### Resultados da execução da tarefa

- Um resultado normal de ferramenta com `isError: true`- Ainda é um .`completed`A função é executada porque a chamada de ferramenta produziu o resultado definido.
- Um erro JSON-RPC durante a execução diferida faz a tarefa `failed`e armazena esse erro JSON-RPC em `error`- Não .
- Rejeição do utilizador pode produzir `cancelled`, um resultado de recusa concluído, ou outro resultado seguro específico do domínio.

## Durabilidade, expiração e propriedade

Permaneça pelo menos o id da tarefa, o status, as timestamps, ttl, o intervalo de pesquisa, a propriedade original da operação, o resultado ou o erro, os pedidos de entrada pendentes e todas as chaves de entrada emitidas.

A chave de armazenamento deve incluir ou resolver um inquilino e principal autorizado.`tasks/get`- Não .`tasks/update`- Não .`tasks/cancel`, e assinatura.

`ttlMs`O cliente pode tratá-lo como um backstop quando uma tarefa deixou de produzir atualizações observáveis. Um servidor pode falhar e posteriormente excluir uma tarefa expirada. Não descreva como uma promessa de manter um resultado concluído por tantos milissegundos após a conclusão.

Usar atômicos escreve ou transações. A lição escreve um arquivo temporário e renomeia-o atomicamente. Um serviço multi-replica deve usar uma loja durável compartilhada e um contrato de locação de trabalhadores ou controle de simultaneidade equivalente.

```figure
tp-task-lifecycle
```

## Construí-lo

`code/main.py`Implementa um serviço de tarefas deterministas:

- `server/discover`Retorno `supportedVersions`, dicas de cache e a extensão das tarefas.
- `tools/list`Retorna um determinista, cacheable `generate_report`Descrição com um esquema de entrada válido.
- `tools/call`cria e persiste a tarefa antes de retornar `resultType: "task"`- Não .
- Uma nova instância de serviço recarrega a mesma tarefa, demonstrando a recuperação de restart.
- `tasks/get`Retorna instantâneos completos da tarefa.
- O trabalhador muda de`working`- Não .`input_required`- Não .
- `tasks/update`Aceita uma resposta do formulário e retorna um reconhecimento completo vazio.
- O trabalhador armazena um aninhado`CallToolResult`com o seu próprio .`resultType`e identidade do servidor, e depois transições para `completed`- Não .
- `tasks/cancel`é impotente nesta aplicação.
- Configurações do construtor HTTP `Mcp-Name`- Não .`params.taskId`Para`tasks/get`- Não .`tasks/update`, e `tasks/cancel`- Não .
- Auxiliares de notificação utilizam `notifications/subscriptions/acknowledged`E ...`notifications/tasks`, ambos marcados com a identificação de solicitação de escuta.
- As notificações sem ID não produzem resposta JSON-RPC.

O trabalhador avança explicitamente em vez de dormir em um fio de fundo, o que torna cada transição de estado determinista e mantém o exemplo de protocolo separado da mecânica de fila.

## Usá-lo

A partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

Seqüência de resultados esperada:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

Verifique também que .`tasks/status`- Não .`tasks/result`, e `tasks/list`método de devolução não encontrado no serviço moderno.
Verifica isso .`tools/list`é determinista e cada método de tarefa HTTP atual reflete sua tarefa id através `Mcp-Name`- Não .

## Envia-o

`outputs/skill-task-store-designer.md`Agora produz um projeto consciente de extensão: negociação de capacidade, criação durável antes do retorno, métodos atuais, fluxo de atualização de entrada, propriedade, expiração, cancelamento, assinatura e migração dos métodos experimentais removidos.

## Exercícios

1. Adicione uma segunda chave de entrada pendente. Envie uma parcial `tasks/update`E provar que a tarefa continua.`input_required`Até que as duas chaves sejam respondidas.
2. Adicionar a propriedade do inquilino à loja e rejeitar um ID válido de tarefa apresentado pelo principal autenticado errado.
3. Adicionar um contrato de locação de trabalhadores com expiração. Demonstrar que duas instâncias de serviço não podem realizar a mesma tarefa simultaneamente.
4. Implementar um adaptador SSE de resposta POST para `subscriptions/listen`Não adicionar GET,`Last-Event-ID`, ou um cabeçalho de sessão.
5. Adicionar limpeza de expiração. Diferenciar uma tarefa expirada de uma identificação de tarefa mal formada sem vazamento de existência entre inquilinos.

## Termos-chave

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## Compatibilidade do legado

A superfície experimental de 2025-11-25 utilizou o aumento de tarefas solicitado pelo cliente,`tasks/status`- Não .`tasks/result`, e opcionais `tasks/list`Um cliente atual usa a extensão, aceita manipulações direcionadas por servidor, pesquisas.`tasks/get`, fornece entrada com `tasks/update`, e lê o resultado final da tarefa instantânea.

## Mais leitura

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
