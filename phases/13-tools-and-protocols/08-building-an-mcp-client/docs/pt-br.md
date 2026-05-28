# Construindo um Cliente MCP — Descoberta, Invocação, Gerenciamento de Sessão

> A maioria do conteúdo MCP lança tutoriais de servidor e acena pra mão pro cliente. O código do cliente é onde vive a orquestração difícil: spawn de processos, negociação de capacidades, merge de listas de ferramentas entre múltiplos servidores, callbacks de sampling, reconexão e resolução de colisões de namespace. Esta aula constrói um cliente multi-servidor que sobe três servidores MCP diferentes num namespace de ferramentas flat pro modelo.

**Tipo:** Construir
**Linguagens:** Python (stdlib, cliente MCP multi-servidor)
**Pré-requisitos:** Fase 13 · 07 (construindo um servidor MCP)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Spawnar um servidor MCP como processo filho, completar `initialize` e enviar `notifications/initialized`.
- Manter estado de sessão por servidor (capacidades, lista de ferramentas, ids de notificações vistos por último).
- Mesclar listas de ferramentas de múltiplos servidores num namespace com tratamento de colisão.
- Rotear uma chamada de ferramenta pro servidor que a possui e remontar a resposta.

## O Problema

Um host de agente real (Claude Desktop, Cursor, Goose, Gemini CLI) carrega múltiplos servidores MCP de uma vez. Um usuário pode ter um servidor de sistema de arquivos, um servidor Postgres e um servidor GitHub rodando simultaneamente. O trabalho do cliente:

1. Spawnar cada servidor.
2. Fazer handshake de cada um independentemente.
3. Chamar `tools/list` em cada um e achatar o resultado.
4. Quando o modelo emitir `notes_search`, buscar no namespace mesclado e rotear pro servidor correto.
5. Lidar com notificações de qualquer servidor (`tools/list_changed`) sem bloquear.
6. Reconectar na falha de transporte.

Fazer tudo isso à mão é o que separa "brinquedo" de "utilizável". Os SDKs oficiais embrulham isso, mas o modelo mental tem que ser seu.

## O Conceito

### Spawn de processo filho

`subprocess.Popen` com `stdin=PIPE, stdout=PIPE, stderr=PIPE`. Configure `bufsize=1` e use modo de texto pra leituras linha por linha. Cada servidor é um processo; o cliente mantém um handle `Popen` por servidor.

### Estado de sessão por servidor

Um objeto `Session` por servidor mantém:

- `process` — o handle Popen.
- `capabilities` — o que o servidor declarou no `initialize`.
- `tools` — o último resultado de `tools/list`.
- `pending` — mapa de request id pra promise/future esperando a resposta.

Requests são intrinsecamente assíncronos; um `tools/call` enviado pro servidor A enquanto o servidor B está no meio de uma chamada não pode bloquear. Use threads com filas ou asyncio.

### Namespace mesclado

Quando o cliente vê a lista agregada de ferramentas, nomes podem colidir. Dois servidores podem ambos expor `search`. O cliente tem três opções:

1. **Prefixar pelo nome do servidor.** `notes/search`, `files/search`. Claro mas feio.
2. **Primeiro silencioso.** O `search` do servidor posterior sobrescreve o anterior. Arriscado; esconde colisões.
3. **Rejeição de colisão.** Recusar carregar o segundo servidor; notificar o usuário. Mais seguro pra hosts sensíveis em segurança.

Claude Desktop usa prefixo por servidor. Cursor usa rejeição de colisão com erro claro. VS Code MCP também adota prefixo por servidor.

### Roteamento

Depois do mesclamento, uma tabela de dispatch mapeia `tool_name -> session`. O modelo emite uma chamada por nome; o cliente encontra a sessão e escreve uma mensagem `tools/call` no stdin daquele servidor, depois aguarda a resposta.

### Callback de sampling

Se o servidor declarou a capacidade `sampling` no `initialize`, ele pode enviar `sampling/createMessage` pedindo que o cliente rode seu LLM. O cliente deve:

1. Bloquear requests adicionais àquele servidor até o sample resolver, ou pipeline se sua implementação suportar concorrência.
2. Chamar seu provedor de LLM.
3. Enviar a resposta de volta pro servidor.

A Aula 11 cobre sampling de ponta a ponta. Esta aula esboça pra completude.

### Tratamento de notificações

`notifications/tools/list_changed` significa rechamar `tools/list`. `notifications/resources/updated` significa reler o resource se estiver em uso. Notifications não devem produzir respostas — não tente dar ack nelas.

Bug comum de cliente: bloquear o loop de leitura no `tools/call` enquanto uma notification fica na fila. Use uma thread de leitura em background que coloca cada mensagem numa fila; a thread principal desenfileira e despacha.

### Reconexão

Transporte pode falhar: servidor caiu, SO matou o processo, pipe stdio quebrou. O cliente detecta EOF em stdout e trata a sessão como morta. Opções:

- Reiniciar silenciosamente o servidor e refazer handshake. OK pra servidores somente leitura.
- Mostrar a falha pro usuário. OK pra servidores com sessões visíveis pro usuário.

Fase 13 · 09 cobre a semântica de reconexão do Streamable HTTP; stdio é mais simples.

### Keepalive e id de sessão

Streamable HTTP usa um header `Mcp-Session-Id`. Stdio não tem id de sessão — a identidade do processo É a sessão. Pings de keepalive são opcionais; pipes stdio não quebram por inatividade.

## Use

`code/main.py` spawna três servidores MCP simulados como subprocessos, faz handshake de cada um, mescla suas listas de ferramentas e roteia chamadas de ferramenta pro correto. Os "servidores" são na verdade outros processos Python rodando respondentes de brinquedo (sem LLM real). Rode pra ver:

- Três inicializações, cada uma com seu próprio conjunto de capacidades.
- Três resultados de `tools/list` mesclados num namespace de 7 ferramentas.
- Uma decisão de roteamento baseada no nome da ferramenta.
- Uma colisão prevenida por prefixo de namespace.

O que conferir:

- O dataclass `Session` mantém estado por servidor de forma limpa.
- A thread de leitura em background desenfileira cada linha em stdout sem bloquear a thread principal.
- A tabela de dispatch é um simples `dict[str, Session]`.
- Tratamento de colisão é explícito: quando dois servidores declaram o mesmo nome, o segundo é renomeado com um prefixo.

## Entregue

Esta aula produz `outputs/skill-mcp-client-harness.md`. Dada uma lista declarativa de servidores MCP (nome, comando, args), a skill produz um harness que os spawna, mescla listas de ferramentas e entrega uma função de roteamento com resolução de colisão.

## Exercícios

1. Rode `code/main.py` e observe o log de spawn dos servidores. Mate um dos processos simulados com SIGTERM e observe como o cliente detecta o EOF e marca aquela sessão como morta.

2. Implemente prefixo de namespace. Quando dois servidores expõem `search`, renomeie o segundo como `<server>/search`. Atualize a tabela de dispatch e verifique que chamadas de ferramenta roteam corretamente.

3. Adicione backoff estilo connection pool pra reinício de servidor: backoff exponencial em falhas consecutivas, teto de 30 segundos, emitir uma notification pro usuário após três falhas.

4. Esboce um cliente que suporte 100 servidores MCP concorrentes. Que estrutura de dados substitui o dict simples de dispatch? (Dica: trie pra namespacing por prefixo, mais uma métrica de contagem de ferramentas por servidor.)

5. Porte o cliente pro SDK oficial MCP Python. O SDK embrulha `stdio_client` e `ClientSession`. O código deve encolher de ~200 linhas pra ~40 linhas preservando o roteamento multi-servidor.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Cliente MCP | "O host do agent" | Processo que spawna servidores e orquestra chamadas de ferramenta |
| Session | "Estado por servidor" | Capacidades, lista de ferramentas e controle de requests pendentes |
| Namespace mesclado | "Uma lista de ferramentas" | Conjunto flat de nomes de ferramentas de todos os servidores ativos |
| Colisão de namespace | "Dois servidores mesma ferramenta" | Cliente deve prefixar, rejeitar ou pegar o primeiro do duplicado |
| Roteamento | "Quem recebe essa chamada?" | Dispatch do nome da ferramenta pro servidor proprietário |
| Leitor em background | "Stdout não bloqueante" | Thread ou tarefa que esvazia stdout do servidor numa fila |
| Callback de sampling | "LLM como serviço" | Handler do cliente pra `sampling/createMessage` do servidor |
| `notifications/*_changed` | "Primitiva mutou" | Sinal de que o cliente deve redescobrir ou reler |
| Política de reconexão | "Quando o servidor morre" | Semântica de reinício quando o transporte falha |
| Sessão stdio | "Processo = sessão" | Sem id de sessão; vida do processo filho é a sessão |

## Leituras Complementares

- [Model Context Protocol — Client especificação](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/client) — comportamento canônico do cliente
- [MCP — Quickstart client guide](https://modelcontextprotocol.io/quickstart/client) — tutorial hello-world com o SDK Python
- [MCP Python SDK — client module](https://github.com/modelcontextprotocol/python-sdk) — referência `ClientSession` e `stdio_client`
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) — TS paralelo
- [VS Code — MCP in extensions](https://code.visualstudio.com/api/extension-guides/ai/mcp) — como o VS Code multiplexa múltiplos servidores MCP num único host de editor
