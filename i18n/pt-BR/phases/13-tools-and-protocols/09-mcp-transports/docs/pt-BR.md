# Transporte de MCP: estúdio e HTTP sem Estado

> O transporte transporta mensagens MCP. Não fornece estado de protocolo faltante.`2026-07-28`, estúdio local e remoto Streamable HTTP ambos carregam pedidos auto-descrição.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## Objetivos de aprendizagem

- Escolha o estúdio para processos locais de crianças e o HTTP Streamable para serviços de rede.
- Implementar o moderno contrato HTTP Streamable de ponto único, apenas POST.
- Reflectar e validar as cabeçalhas de versão, método e nome do MCP contra o corpo JSON-RPC.
- Entregar SSE com escala de pedido e de longa duração `subscriptions/listen`- Corretamente.
- Migrar implementações HTTP+SSE baseadas em sessões e legais sem apresentar o comportamento legais como moderno.

## O problema

As revisões anteriores do HTTP Streamable combinaram negociação de protocolo com o comportamento de conexão e sessão.`Mcp-Session-Id`, expõem um fluxo GET independente, aceitam o DELETE para o encerramento da sessão e retomam a SSE com `Last-Event-ID`- Não .

MCP `2026-07-28`As cabeçalhas HTTP espelham campos selecionados para roteamento e política, mas o servidor valida esses cabeçalhos contra o corpo antes da execução.

O resultado é mais fácil de dimensionar e mais fácil de raciocinar. Também significa que um servidor que ensina o transporte 2025 como atual está ensinando o modelo de falha e segurança errados.

## O conceito

### Estúdio

A ligação do estúdio é para um subprocesso lançado pelo cliente:

- O cliente escreve uma mensagem UTF-8 JSON-RPC por linha para stdin.
- O servidor escreve uma mensagem UTF-8 JSON-RPC por linha para stdout.
- O servidor escreve diagnósticos para o STERR.
- O servidor sai imediatamente no STDIN EOF.
- Cada pedido moderno carrega versões e recursos do cliente em `params._meta`- Não .

O processo pode funcionar para muitas chamadas, mas não é uma sessão de protocolo moderno. Se sair inesperadamente, as solicitações de voo são perdidas. Reinicie o processo, redescobre, relista, reabra assinaturas e tente novamente operações seguras com novos IDs de solicitação.

### HTTP em 2026-07-28

Um servidor moderno expõe um endpoint MCP, como `/mcp`, que aceita POST.

Cada solicitação ou notificação JSON-RPC é um novo HTTP POST. O corpo contém uma mensagem JSON-RPC. Os clientes não enviam respostas JSON-RPC para o servidor.

Para uma solicitação, o servidor retorna:

- `Content-Type: application/json`com uma resposta JSON-RPC; ou
- `Content-Type: text/event-stream`A Comissão deve apresentar ao Parlamento Europeu e ao Conselho as suas propostas de decisão.

Para uma notificação aceita, o servidor retorna `202 Accepted`Sem corpo.

Os clientes anunciam os dois tipos de resposta:

```http
Accept: application/json, text/event-stream
```

### POST-only significa POST-only

O HTTP Streamable moderno não tem fluxo GET independente e nenhum endpoint de sessão DELETE.

- `GET /mcp`Retorno `405 Method Not Allowed`- Não .
- `DELETE /mcp`Retorno `405 Method Not Allowed`- Não .
- `Mcp-Session-Id`é ignorado e nunca é feito ou ecoado.
- `Last-Event-ID`é ignorado porque as correntes modernas não são retomáveis.

Se um fluxo de solicitação escalado quebrar antes de sua resposta final, o cliente perdeu esse pedido em voo. Ele pode emitir um novo pedido com um novo ID JSON-RPC quando a retest é segura. Não deve tentar retomar o fluxo.

### Validação da origem

Servidores validam `Origin`Se o cabeçalho estiver presente e não for explicitamente permitido, retorne `403 Forbidden`Um cliente não navegador pode omitir `Origin`, que as regras oficiais de transporte permitem.

Os servidores locais devem ligar-se a `127.0.0.1`Os serviços de rede ainda precisam de autenticação e autorização em cada pedido.

Use a correspondência exata de origem após a configuração canônica.`origin.startswith("https://trusted.example")`Não são seguros porque podem aceitar sufixos controlados pelo atacante.

### Requisitos de cabeçalhos de metadados HTTP

Cada pedido moderno de POST inclui:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

Regras do cabeçalho:

- `MCP-Protocol-Version`é exigido e deve ser igual `params._meta.io.modelcontextprotocol/protocolVersion`- Não .
- `Mcp-Method`é exigido e deve ser igual ao JSON-RPC `method`- Não .
- `Mcp-Name`é necessário para `tools/call`- Não .`resources/read`, e `prompts/get`- Não .
- `Mcp-Name`- É igual .`params.name`, ou `params.uri`Para`resources/read`- Não .
- Os valores de cabeçalhos são sensíveis a casos, embora os nomes de cabeçalhos sejam insensiveis a casos.

Não seguro ou não ASCII `Mcp-Name`Os valores usam o sentinela base 64 exato UTF-8:

```text
=?base64?{Base64EncodedValue}?=
```

O servidor decodifica esse valor antes de compará-lo com o corpo.

Os cabeçalhos espelhados faltantes, mal formados ou incompatíveis retornam HTTP `400`com código JSON-RPC `-32020`. Se cabeçalho e corpo concordarem em uma versão que o servidor não suporta, retorne HTTP `400`com`-32022`e dados de erro exatos, tais como `{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Não .

Um método moderno desconhecido retorna HTTP `404`com JSON-RPC `-32601`O corpo JSON-RPC é importante porque um cliente de dupla era o usa para distinguir um erro moderno de um erro de ponto final legado.

### A SSE adaptada à solicitação

Um servidor pode escolher o SSE para uma solicitação de longa data:

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

O servidor não deve enviar solicitações independentes JSON-RPC neste fluxo. Amostração, elicitação e interações raízes usam resultados de Requisito de Viagem Rondada Múlti. Fechar o fluxo de resposta cancela essa solicitação.

Não adicionar os IDs de evento SSE para repetição. `Last-Event-ID`A reinstalação não faz parte da revisão moderna.

### Mudanças de longa duração utilizam assinaturas/audição

As notificações de alteração utilizam uma solicitação aberta pelo cliente, não um GET independente:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
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

A resposta POST é um fluxo SSE de longa duração.`notifications/subscriptions/acknowledged`- O reconhecimento, todas as notificações de alterações e o resultado final`io.modelcontextprotocol/subscriptionId`em `_meta`O servidor pode emitir comentários SSE como mantentores. Quando o fluxo cai, o cliente reemite `subscriptions/listen`com uma nova identificação de pedido e reformula os dados afectados.

`resources/subscribe`E ...`resources/unsubscribe`Não os usem em uma conexão moderna.

### Estado de aplicação explícita

A remoção de sessões de protocolo não proíbe fluxos de trabalho com estado. O servidor pode imprimir um manilho de estado opaco e devolvê-lo como um resultado de ferramenta normal. O cliente passa esse manilho como um argumento explícito em chamadas posteriores.

Ligar as asas ao principal autenticado, torná-las inexplicáveis, expirar e autorizar todo uso. Isso torna o estado visível na camada de aplicação em vez de escondê-lo na afinidade de transporte.

A falha causada pelo estado de réplica oculta é mecânica:

1. O pedido A chega à réplica 1 e cria um esboço na memória desse processo.
2. A resposta não retorna um projecto de manuseio porque a execução assume que a conexão identifica o projecto.
3. O pedido B é um POST novo e chega à réplica 2.
4. A réplica 2 tem metadados válidos do protocolo, mas não há forma de nomear ou carregar o esboço, então o fluxo de trabalho falha ou lê o objeto local errado.
5. O roteamento pegajoso parece corrigir o sintoma até que uma reinicialização, implantação, reprogramamento ou falhaover transfira o próximo pedido.

O limite correto tem duas partes. O contexto do protocolo permanece em cada pedido. O estado de aplicação duradouro vive em uma loja compartilhada sob um cabo de servidor-mintado devolvido ao cliente. A próxima chamada fornece o que é manuseado, qualquer réplica carrega o mesmo registro, e a autorização liga o registro ao principal e aluguer autenticado. A memória de réplica pode armazenar um registro em cache, mas não pode ser a única cópia necessária para a corretão.

Escolha o mecanismo de estado por vida. As variáveis locais de solicitação podem servir uma chamada. Uma curta continuação MRTR pode usar integridade protegida `requestState`Uma tarefa de projeto ou duradoura requer um manuseio explícito mais persistência compartilhada, expiração, controle de concurência e idempotencia.

### Compatível com a dupla era HTTP

Um cliente que suporta servidores modernos e legacy tenta um POST moderno primeiro. Se ele receber HTTP `400`- Não .`404`, ou `405`, inspeciona o corpo:

- Um erro JSON-RPC moderno reconhecido prova que o servidor é moderno. Corrigir a solicitação ou tentar novamente uma versão anunciada. Não rebaixar.
- Um corpo vazio ou uma resposta não reconhecida pode indicar um servidor HTTP+SSE antigo. Só então tente o antigo ponto final GET e espere o seu legado `endpoint`Evento.

Um servidor pode suportar ambas as eras durante a migração, enrutando metadados modernos para a implementação moderna apenas POST e mantendo endpoints legacy separados para clientes antigos. Nunca descreva o legado GET, DELETE, session id, ou comportamento de replay como parte de `2026-07-28`- Não .

```figure
tp-transport-handshake
```

## Usá-lo

`code/main.py`Implementa um servidor HTTP Streamable moderno e finito com a biblioteca padrão Python. Valida o Origin e os cabeçalhos espelhados, ignora os cabeçalhos de sessão removidos, retorna JSON para chamadas normais e demonstra um limite `subscriptions/listen`Corrente SSE.

```bash
cd code
python3 main.py --probe
npx tsx main.ts --probe
python3 -m unittest discover tests -v
```

A sonda verifica:

- A origem inválida é rejeitada;
- A detecção é bem-sucedida sem um ID de sessão;
- `Mcp-Session-Id`E ...`Last-Event-ID`são ignoradas;
- Retorna desajuste de cabeçalho `-32020`O artigo 2.o
- versões não suportadas retornam `-32022`com exato`supported`E ...`requested`dados;
- uma notificação sem id aceita retorna HTTP `202`sem corpo;
- Retorno de GET e DELETE `405`O artigo 2.o
- `subscriptions/listen`é um fluxo de resposta POST cujo reconhecimento, notificações e resultado final contêm a sua identificação de assinatura.

## Envia-o

Esta lição vai avançar .`outputs/skill-mcp-transport-migrator.md`. Elimina sessões de protocolo modernas, adiciona validação de cabeçalho-corpo, substitui GET independente por `subscriptions/listen`, e mantém qualquer ponte legado visível separado.

## Exercícios

1. Remover`Mcp-Method`de um POST. Confirmar HTTP `400`e erro .`-32020`- Não .
2. Enviar versão de cabeçalho e corpo correspondente `2027-01-01`Confirmar o HTTP`400`, erro `-32022`, e dados exatos `{"supported":["2026-07-28"],"requested":"2027-01-01"}`- Não .
3. Envie um sentinela Base64 .`Mcp-Name`Para um URI de recurso não ASCII. Confirme que o valor decodificado é comparado com `params.uri`- Não .
4. Desligar o fluxo de escuta finito antes de sua resposta final, reeditá-lo com um novo ID JSON-RPC e ferramentas de reeditamento.
5. Adicione um manto de fluxo de trabalho explícito à ferramenta ping. Ligue-o a um sujeito de autorização sem usar afinidade de conexão.

## Termos-chave

| Term | Meaning |
|------|---------|
| stdio | Newline-delimited JSON-RPC over a client-launched subprocess |
| Streamable HTTP | Single endpoint where each modern message is a new POST |
| Request-scoped SSE | POST response stream containing related notifications and final response |
| `subscriptions/listen` | Long-lived POST request for opted-in change notifications |
| Header mismatch | HTTP `400` and JSON-RPC `-32020` when mirrored headers disagree with body |
| Origin validation | DNS-rebinding defense for incoming connections, not authentication |
| Explicit state handle | Application token passed as an ordinary argument instead of hidden session state |
| Legacy bridge | Separate earlier-era behavior kept only for compatibility |

## Mais leitura

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
