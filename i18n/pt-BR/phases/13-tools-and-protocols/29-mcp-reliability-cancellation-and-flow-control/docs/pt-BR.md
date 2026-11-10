# Confiabilidade, cancelamento e controlo de fluxo do MCP

> Um ID de solicitação correlaciona uma mensagem. Não torna um efeito colateral seguro, detém um trabalhador ou protege um fluxo de um consumidor lento.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 09 and 13
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Implementar o sinal de cancelamento correto para stdio e Streamable HTTP.
- Resolver corridas de conclusão e cancelamento sem enviar mensagens após a cancelamento.
- Cancellação de pedido separada de duradoura `tasks/cancel`- Não, não.
- Construir decisões de retest com base em efeitos colaterais e claves explícitas de impotência.
- Limitar as filas de progresso, preservando as respostas finais.
- Recuperar fluxos através da recon ligação, re-recausão e backkoff nervoso.

## O problema

O caminho feliz esconde os bugs mais caros dos sistemas distribuídos.

Um cliente chama uma ferramenta. O servidor começa a trabalhar. O progresso chega. Um proxy amortece o fluxo. O cliente atinge seu tempo e desconecta. O servidor termina um milissegundo depois. O cliente retrata com um novo ID JSON-RPC. A mutação é executada duas vezes.

Cada componente se comportou localmente, o sistema falhou globalmente.

O MCP define o comportamento de mensagem e transporte, mas o seu aplicativo ainda possui:

- orçamentos temporais;
- A independência dos negócios;
- Coisas de segurança;
- Classificação de retest;
- Estado de tarefa durável;
- Reconectar e reajustar a política.

Esta lição constrói essas decisões num simulador determinista.
Não há interrupções, não há interrupções, não há falhas aleatórias.
Um teste de fio sincronizado obriga dois clientes do livro a competir
para a mesma chave de independência.

## O pedido de cancelamento é específico para o transporte

A intenção é a mesma em todos os transportes: o cliente não precisa mais de um resultado no voo.

### Estúdio

O stdio usa um canal bidirecional compartilhado.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/cancelled",
  "params": {
    "requestId": 41,
    "reason": "User closed the operation"
  }
}
```

A notificação é de fogo e esquecimento. O servidor não emite nenhuma resposta JSON-RPC para ele.

O servidor deve parar de trabalhar, liberar recursos e evitar enviar uma resposta para a solicitação cancelada. Pode ignorar a cancelamento quando a solicitação é desconhecida, já terminada ou não pode ser interrompida com segurança.

As notificações de cancelamento mal formadas, desconhecidas e já concluídas são ignoradas.

### HTTP em transmissão

O HTTP Streamable moderno dá a cada solicitação sua própria resposta HTTP ou fluxo de resposta SSE. O cliente cancela fechando o fluxo de resposta dessa solicitação.

Não POSTes `notifications/cancelled`Para uma solicitação HTTP comum.

Uma vez que o servidor observe a desconexão, deve parar de funcionar e não deve enviar mais mensagens para esse pedido.

### A cancelamento enviada pelo servidor é limitada

Um servidor não usa `notifications/cancelled`No estúdio, a cancelamento enviada pelo servidor é reservada para encerrar uma chamada de cliente.`subscriptions/listen`Mantém esse caminho separado da cancelamento normal de solicitações do cliente.

## O cancelamento é uma corrida

Duas ordens de eventos são válidas.

### A cancelamento vence

```text
request starts
client sends cancellation signal
server marks request cancelled
worker reaches completion
server suppresses the response
```

### A conclusão ganha

```text
request starts
worker commits the result
server sends the response
cancellation arrives late
server ignores the late notification
```

O cliente também deve ignorar uma resposta tardia para um pedido que já abandonou.

```figure
mcp-reliability-race
```

A lição é:`RequestCoordinator`Armazena um estado terminal. `complete()`Não é possível que o registro seja alterado por um cancelamento atrasado.

## As temporadas precisam de dois relógios

Um único temporizador de inatividade não é suficiente.

Use dois limites:

1. **Idle timeout.**Quanto tempo o pedido pode não produzir atividade útil.
2. **Maximum timeout.**O orçamento absoluto do relógio de parede desde o início do pedido.

O progresso pode reiniciar o relógio de inatividade.

```text
start: 0 ms
progress: 400 ms
progress: 800 ms
progress: 1200 ms
idle timeout: 500 ms
maximum timeout: 2000 ms
```

A partir de 1500 ms, o pedido ainda está ativo, pois o último progresso é de apenas 300 ms. A partir de 2000 ms, o prazo máximo o cancela mesmo que outro evento de progresso tenha chegado em 1999 ms.

O progresso é opcional. Um servidor pode aceitar um token de progresso e não emitir atualizações. Nunca transformar a presença de um token em um tempo de espera infinito.

Os valores de progresso do MCP devem aumentar. As notificações param após a conclusão ou cancelamento.

## Pedir cancelamento não é `tasks/cancel`

Estes mecanismos resolvem vidas diferentes.

| Mechanism | Target | Signal | What success means |
|-----------|--------|--------|--------------------|
| Request cancellation on stdio | One in-flight RPC | `notifications/cancelled` | Client abandoned the request; server should stop if practical |
| Request cancellation on HTTP | One in-flight response stream | Close the stream | Client abandoned the request; server should stop if practical |
| `tasks/cancel` | One durable Task | Ordinary MCP request | Server acknowledged cancellation intent |

Um bem-sucedido .`tasks/cancel`O resultado não prova que o trabalhador tenha parado.`working`Até que um posto de controlo de trabalhadores observe a bandeira.

Não apague o estado de tarefa duradouro quando a conexão HTTP fechar. A razão para criar uma tarefa é que seu ciclo de vida sobrevive a uma solicitação e uma conexão.

## Um novo ID JSON-RPC não é idempotencia

Os ids JSON-RPC correlham pedidos e respostas. Não identificam uma operação de negócio.

Suponha que um cliente apresente uma acusação com id `41`, perde a resposta e retrata com id `42`O servidor vê duas mensagens diferentes. sem uma chave de aplicação, não pode saber que representam um checkout.

Uma chave de idempotency identifica a intenção empresarial:

```json
{
  "name": "charge_account",
  "arguments": {
    "account": "acct-7",
    "cents": 1200,
    "idempotencyKey": "checkout-7"
  }
}
```

Os servidores armazenam:

- A chave;
- Uma impressão digital dos argumentos de operação;
- O resultado comprometido.

A mesma chave e os mesmos argumentos retornam o resultado armazenado. A mesma chave com argumentos diferentes é rejeitada. Isto impede que a reutilização acidental da chave mude uma operação de negócio diferente.

### O limite do livro-razão deve ser atômico e duradouro

Esta sequência não é segura:

```text
check key
run mutation
store result
```

Dois trabalhadores podem observar uma chave faltante e executar a mutação.
Depois do efeito, mas antes da loja cria a mesma ambigüidade na retomada.

A lição usa um livro-razão SQLite com arquivo. `BEGIN IMMEDIATE`serializa o
Verificação de chave, efeito de negócio simulado, contador de execução e resultado armazenado em
duas conexões independentes de contabilidade correndo com a mesma chave
Por conseguinte, observe um resultado comprometido e uma execução.
O livro conta com esse registro.

Cada valor de devolução é reconstruído a partir de JSON armazenado.
O objeto mutável detido no livro de contabilidade, de modo que a alteração de um dicionário devolvido não pode
Corrupto resultados de repetição posterior.

O efeito de negócio do simulador é o contador de receita e execução dentro do
Uma chamada de pagamento real, implantação ou API externa é
A produção não é feita atomicamente apenas por meio de uma tabela local.
Uma transação de base de dados compartilhada, uma caixa de saída transacional ou um fornecedor de dados upstream
O processo de bloqueio por si só não protege
Replicações múltiplas ou sobreviver a uma reinicialização.

### Matriz de retrovisor

Classificar as retemptadas antes de as implementar.

| Class | Example | Retry rule |
|------|---------|------------|
| Safe | Deterministic read with no side effect | Retry with a new JSON-RPC id after the failure boundary is understood |
| Conditional | Mutation with a durable idempotency key | Retry with the same key and identical arguments |
| Unsafe | Mutation without business deduplication | Do not retry automatically; reconcile first |

Anotativas de ferramentas como `readOnlyHint`E ...`idempotentHint`O contrato de aplicação e a implementação do servidor decidem a segurança da retest.

## A pressão é parte da corretura

Um produtor de SSE pode gerar progresso mais rápido do que um cliente, proxy ou rede pode consumir.

Use uma fila limitada e defina o que pode ser perdido.

Progress é substituível. Um valor de progresso posterior substitui um anterior para o mesmo token. Uma resposta final JSON-RPC não é substituível.

O amortigo das lições aplica-se a esta política:

1. Coalice o progresso adjacente para o mesmo token.
2. Deixe o progresso mais antigo quando a capacidade for alcançada.
3. Marque o fluxo como necessitando de uma reafirmação autorizada.
4. Preserva a resposta final.
5. Recusar um estado em que preservar a resposta final exigiria a queda de outra resposta final.

Esta é uma perda limitada com recuperação explícita.

### O sistema de amortização por procuração

Um servidor pode transmitir corretamente enquanto um proxy inverso mantém eventos em um buffer.

Para uma resposta da SSE, envie:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

A especificação HTTP 2026 Streamable recomenda `X-Accel-Buffering: no`para que os proxies compatíveis entreguem eventos imediatamente.

Para os fluxos silenciosos de longa duração, emitir periodicamente um comentário da SSE:

```text
:
```

O cliente ignora as linhas de comentários, os intermediários veem o tráfego e são menos propensos a fechar uma conexão ociosa.

Não restabeleça o tempo semântico de inatividade de uma operação apenas porque um comentário de transporte chegou.

## Reconectar significa recomeçar

O HTTP Streamable moderno não suporta SSE reiniciável através de `Last-Event-ID`- Não .

Depois de um`subscriptions/listen`Caixas de fluxo:

1. Abra uma nova solicitação de escuta com um novo ID JSON-RPC.
2. Restaurar o filtro de assinatura desejado.
3. Reemptar as ferramentas, recursos, instruções ou tarefas afetadas a partir de métodos autorizados.
4. Estado de aplicação deduplicado por identificadores estáveis.
5. Não repita uma mutação insegura só porque a resposta foi perdida.

O plano de recuperação da amostra define explicitamente `sendLastEventId`O que é que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é o que é.

### Prevenir a recon ligação de um rebanho

Se 10 mil clientes se reconectarem em exatamente um segundo, o servidor de recuperação falha novamente.

Use backkoff exponencial com jitter e um cap. A lição calcula o jitter determinista a partir do id do cliente e do número de tentativa para que os testes permaneçam reprodutíveis:

```text
attempt 0: up to 250 ms
attempt 1: up to 500 ms
attempt 2: up to 1000 ms
...
cap: 8000 ms
```

A produção pode usar criptografia segura ou runtime randomness.

## Construí-lo

`code/main.py`construi cinco componentes de fiabilidade pequenos.

### `RequestCoordinator`

- inicia um pedido de voo com prazos inativos e máximos;
- Emite notificações monótonas de progresso;
- produz o sinal de cancelamento stdio ou HTTP correto;
- Ignora as notificações de cancelamento inválidas;
- Explique explicitamente as corridas terminais de cancelamento e de conclusão;
- Reserva cancelamento enviado pelo servidor para assinaturas de estúdio.

### `MutationLedger`

- comprovar que dois IDs JSON-RPC executam duas vezes sem uma chave de negócio;
- utiliza uma transação SQLite com back-up de arquivo para a verificação de chave, efeito simulado,
  Contador de execução e compromisso de resultados;
- deduplica argumentos correspondentes sob uma chave de independência em diferentes
  Conexões de contabilidade;
- Rejeita uma chave reutilizada com diferentes argumentos;
- Retorna cópias defensivas e preserva registos cometidos durante a reabertura.

### `DurableTaskService`

- Reconhece um pedido de cancelamento;
- mantém a tarefa .`working`Até um posto de controlo de trabalhadores;
- demonstra por que o reconhecimento não é estatuto final.

### `BoundedSseBuffer`

- Coagulas ou descansas de progressos sob pressão;
- registos que exigem uma reafirmação autorizada;
- Nunca deixa cair a resposta final.

### Auxiliares de recuperação

- Retorno de cabeçalhos de SSE seguros por proxy e observações de conservação;
- criar um plano de reconexão e reencaminhamento;
- Repetições de espalhamento com retrocesso exponencial determinista e jitter.

## Usá-lo

A partir da raiz do repositório:

```bash
cd phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

A demonstração executa os dois lados da corrida central, executa uma transação
mutação deduplicada em um livro de contas temporário com arquivo, sobrecarrega um limite
progress buffer, e mostra uma tarefa duradoura que se move de cancelamento reconhecido
A anulação observada pelos trabalhadores.

## Laboratório Interativo

Faça quatro ordens de eventos sem adicionar dormências.

1. Começando a solicitação`A`, cancelar, depois ligar.`complete()`- Não .
2. Começando a solicitação`B`, concluí-lo, e depois entregar cancelamento.
3. Começando a solicitação`C`, emitir progressos antes de cada prazo de vazio, e depois ultrapassar o prazo máximo.
4. Começando a solicitação`D`sobre Streamable HTTP e fechar o seu fluxo de resposta.

Registo para cada cenário:

- O estado do pedido de terminal;
- Se existe uma resposta final;
- O sinal de cancelamento colocado no fio;
- que evento o cliente deve ignorar.

Então muda-te .`D`A operação é idêntica, mas o sinal de cancelamento deve mudar.

## Laboratório de Prática

Adicionar um`reserve_inventory`mutação para `MutationLedger`- Não .

Requisitos:

1. A chave liga o SKU, a quantidade, o inquilino e o nome da operação.
2. Uma nova tentativa com a mesma chave e os mesmos argumentos devolve a primeira reserva.
3. Uma nova tentativa com quantidade alterada falha sem outra reserva.
4. Uma execução que se cometeu mas perdeu a sua resposta pode ser reconciliada por chave.
5. O resultado não registra dados secretos ou de pagamento.
6. A retest automática é desativada quando o cliente não fornecer uma chave.
7. Adicione uma queda de assinatura simulada e refaça o registro de inventário antes de decidir o que fazer a seguir.
8. Inicie duas conexões de contabilidade em uma barreira e entregue a mesma chave
   Alegem que foi feita uma reserva.
9. Mutar o primeiro objeto de reserva retornado. Repete a chave e provar a
   O resultado armazenado não mudou.
10. Fechar e reabrir o arquivo do livro, e depois reconciliar a reserva por chave.

Mantém o laboratório honesto: se o inventário vive noutro serviço, explique se
O serviço aceita a mesma chave de idempotencia ou se uma caixa de saída transacional
Ponte o local compromete-se com o efeito remoto.

## Artigo enviado

`outputs/skill-mcp-reliability-reviewer.md`É uma habilidade de revisão de confiabilidade plana. Dê-lhe uma operação MCP, transporte, política de tempo de espera, comportamento de retiro, política de fila e plano de recuperação. Retorna uma tabela de corrida, classificação de retiro, limite de impotência, controles de controle de fluxo e equipamentos de falha.

## Verifique

A lição é completa quando estas declarações são verdadeiras:

- O estúdio cancelamento envia `notifications/cancelled`E não recebe resposta.
- A cancelamento HTTP streamable fecha o fluxo de solicitação e não envia nenhum cancelamento POST.
- Cancelar antes de completar suprime a resposta final.
- A completa antes de cancelamento preserva a resposta e ignora a cancelamento tardia.
- O progresso pode restabelecer o tempo de inatividade, mas nunca o máximo.
- Um novo ID JSON-RPC sozinho executa a mutação novamente.
- Uma chave de idempotency e argumentos idênticos executam uma vez em um simultâneo
  - Uma corrida de duas ligações.
- Um registro comprometido sobrevive ao reabrir e a repetição retorna uma cópia defensiva.
- A mutação de um resultado devolvido não pode alterar o resultado armazenado.
- O buffer limitado permanece dentro da capacidade e preserva a resposta final.
- Reconnect utiliza uma nova solicitação, não envia `Last-Event-ID`, e reafirma o estado afetado.
- `tasks/cancel`O reconhecimento deixa a tarefa não terminal até que o trabalhador a observe.

## Modos de falha de produção

| Failure | Observable symptom | Correct response |
|---------|--------------------|------------------|
| HTTP client POSTs cancellation notification | Server and client disagree about request lifetime | Close the request's SSE response stream |
| Server responds after accepted cancellation | Client receives an unusable late result | Stop work and suppress further messages when cancellation wins |
| Progress resets every deadline | Hung work survives forever | Keep a separate absolute maximum timeout |
| New RPC id treated as deduplication | Charge, deployment, or deletion runs twice | Add a durable application idempotency key |
| Key check and effect are separate | Concurrent workers both observe a missing key | Commit key claim, effect record, and result atomically |
| In-memory ledger used across replicas | Restart or another worker forgets prior commits | Use shared durable storage or upstream idempotency |
| Stored mutable result returned directly | Caller mutation corrupts later replays | Serialize committed results and return defensive copies |
| Key reused with changed arguments | One key aliases two business intents | Store and compare an argument fingerprint |
| Unbounded progress queue | Memory rises with a slow consumer | Coalesce and drop replaceable progress within a bound |
| Final response dropped under pressure | Client cannot know the request outcome | Reserve capacity or evict progress, never the final response |
| Proxy buffers SSE | Progress arrives in bursts or after timeout | Disable buffering and configure compatible proxy timeouts |
| `Last-Event-ID` assumed | Client resumes from state the server does not support | Reconnect with a new request and refetch |
| Every client reconnects immediately | Recovery creates another outage | Use capped exponential backoff with jitter |
| Task ack treated as final cancellation | Worker keeps running after UI says stopped | Poll the Task until a terminal status |

## Conexão Capstone

A pedra final do ecossistema de ferramentas deve tratar a fiabilidade como evidência executável, e não como um parágrafo num diagrama de arquitetura.

Requer estes artefatos:

- Uma transcrição da corrida de cancelamento para cada transporte;
- Uma mesa de retest para cada mutação exposta;
- um registro de chave de independência e um dispositivo de desajuste;
- Uma transcrição simultânea de chave, uma verificação de reabertura e uma verificação de alias de mutação;
- Um resultado de sobrecarga de tampão limitado;
- cabeçalhos de SSE de proxy inverso e política de inatividade;
- Um plano de reconexão que nomeie métodos de reencontro autorizados;
- uma traça duradoura de cancelamento de tarefas quando a pedra final utiliza tarefas.

Um pedido verde num processo local prova apenas o caminho feliz. A pedra final está pronta para produção quando respostas perdidas, cancelamento tardío, consumidores lentos e religações de rebanhos têm resultados deterministas.

## Termos-chave

| Term | Meaning |
|------|---------|
| Request cancellation | Abandonment of one in-flight MCP request |
| Cancellation race | Competition between terminal completion and cancellation events |
| Idle timeout | Limit since the last useful request activity |
| Maximum timeout | Absolute limit from request start, unaffected by progress |
| Idempotency key | Application identifier that deduplicates one business intent |
| Atomic ledger | Durable boundary that commits the key claim, effect record, and result as one unit |
| Backpressure | Control applied when producers outpace consumers |
| Progress coalescing | Replacing older progress with a newer authoritative value |
| Refetch | Reading current state again after a stream gap |
| Jitter | Deliberate variation that spreads retries across time |

## Mais leitura

- [MCP Cancellation](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation)
- [MCP Progress](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/progress)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Tasks Extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
