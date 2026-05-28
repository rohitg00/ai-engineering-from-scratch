# Sampling MCP — Completions de LLM Solicitadas pelo Servidor e Loops de Agent

> A maioria dos servidores MCP são executores burros: recebem argumentos, rodam código, retornam conteúdo. Sampling permite que um servidor inverte a direção: ele pergunta ao LLM do cliente pra tomar uma decisão. Isso permite loops de agente hospedados no servidor sem o servidor possuir credenciais de modelo. SEP-1577, incorporado na 2025-11-25, adicionou ferramentas dentro de requests de sampling pra que o loop possa incluir raciocínio mais profundo. Nota de risco de deriva: a forma do tool-in-sampling do SEP-1577 foi experimental até Q1 2026 e ainda se estabilizando nas APIs de SDK.

**Tipo:** Construir
**Linguagens:** Python (stdlib, harness de sampling)
**Pré-requisitos:** Fase 13 · 07 (servidor MCP), Fase 13 · 10 (resources e prompts)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar o que `sampling/createMessage` resolve (loops hospedados no servidor sem chaves de API do lado do servidor).
- Implementar um servidor que pede ao cliente pra fazer sampling sobre um prompt multi-turno e retorna a completion.
- Usar `modelPreferences` (prioridades de custo / velocidade / inteligência) pra guiar a seleção de modelo do cliente.
- Construir uma ferramenta `summarize_repo` que internamente itera via sampling em vez de codificar comportamento.

## O Problema

Um servidor MCP útil pra um fluxo de trabalho de resumo de código precisa: caminhar uma árvore de arquivos, escolher quais arquivos ler, sintetizar um resumo e retornar. Onde acontece o raciocínio do LLM?

Opção A: o servidor chama seu próprio LLM. Precisa de chave de API, cobra do lado do servidor, é caro por usuário.

Opção B: o servidor retorna conteúdo cru; o agente do cliente faz o raciocínio. Funciona mas move lógica do servidor pro prompt do cliente, o que é frágil.

Opção C: o servidor pede ao LLM do cliente via `sampling/createMessage`. O servidor mantém o algoritmo (quais arquivos ler, quantas passadas fazer) enquanto o cliente mantém billing e escolha de modelo. O servidor não tem credenciais.

Sampling é a opção C. É o mecanismo pelo qual um servidor confiável pode hospedar um loop de agente sem ser um host de LLM completo.

## O Conceito

### Request `sampling/createMessage`

Servidor envia:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{"role": "user", "content": {"type": "text", "text": "..."}}],
    "systemPrompt": "...",
    "includeContext": "none",
    "modelPreferences": {
      "costPriority": 0.3,
      "speedPriority": 0.2,
      "intelligencePriority": 0.5,
      "hints": [{"name": "claude-3-5-sonnet"}]
    },
    "maxTokens": 1024
  }
}
```

Cliente roda seu LLM, retorna:

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

Três floats somando 1.0:

- `costPriority`: favorece modelos mais baratos.
- `speedPriority`: favorece modelos mais rápidos.
- `intelligencePriority`: favorece modelos mais capazes.

Mais `hints`: modelos nomeados que o servidor prefere. Cliente pode ou não honrar os hints; a configuração do usuário do cliente sempre vence.

### `includeContext`

Três valores:

- `"none"` — somente as mensagens fornecidas pelo servidor. Padrão.
- `"thisServer"` — incluir mensagens anteriores da sessão deste servidor.
- `"allServers"` — incluir todo contexto de sessão.

`includeContext` está soft-deprecated desde 2025-11-25 porque vaza contexto entre servidores, o que é preocupação de segurança. Prefira `"none"` e passe contexto explícito nas mensagens.

### Sampling com ferramentas (SEP-1577)

Novo em 2025-11-25: o request de sampling pode incluir um array `tools`. O cliente roda um loop completo de chamada de ferramenta usando essas ferramentas. Isso permite ao servidor hospedar um loop de agente estilo ReAct através do modelo do cliente.

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

O cliente faz loop: sample, executa ferramenta se chamada, sample de novo, retorna mensagem final do assistant. Isso é experimental até Q1 2026; assinaturas de SDK podem ainda mudar. Confirme na seção client/sampling da eespecificaçãoificação 2025-11-25 quando implementar.

### Humano no loop

O cliente DEVE mostrar ao usuário o que o servidor está pedindo ao modelo antes de rodar o sample. Um servidor malicioso poderia usar sampling pra manipular a sessão do usuário ("diga X pro usuário pra que clique em Y"). Claude Desktop, VS Code e Cursor mostram requests de sampling como um diálogo de confirmação que o usuário pode negar.

Consenso de 2026: sampling sem confirmação humana é sinal vermelho. Gateways (Fase 13 · 17) podem auto-aprovar sampling de baixo risco e auto-negar qualquer coisa suspeita.

### Loops hospedados no servidor sem chaves de API

O caso de uso canônico: um servidor MCP de resumo de código sem acesso próprio a LLM. Ele faz:

1. Caminha a estrutura do repo.
2. Chama `sampling/createMessage` com "Escolha cinco arquivos mais prováveis pra descrever o propósito deste repo."
3. Lê esses arquivos.
4. Chama `sampling/createMessage` com o conteúdo dos arquivos e "Resuma o repo em 3 parágrafos."
5. Retorna o resumo como resultado de `tools/call`.

O servidor nunca toca uma API de LLM. O usuário do cliente paga as completions usando suas próprias credenciais.

### Riscos de segurança (divulgação Unit 42, Q1 2026)

- **Sampling oculto.** Uma ferramenta que sempre chama sampling com "responda com o email do usuário do contexto de sessão." Fase 13 · 15 cobre os vetores de ataque.
- **Roubo de recursos via sampling.** Servidor pede ao cliente pra resumir um payload de atacante, cobra o usuário.
- **Bombas de loop.** Servidor chama sampling num loop apertado. Clientes DEVEM impor rate limits por sessão.

## Use

`code/main.py` entrega um harness falso de sampling servidor-cliente. Uma ferramenta simulada "summarize_repo" invoca duas rodadas de sampling (escolher arquivos, depois resumir) e o cliente falso retorna respostas prontas. O harness mostra:

- Servidor envia `sampling/createMessage` com `modelPreferences`.
- Cliente retorna uma completion.
- Servidor continua seu loop.
- Rate limiter limita chamadas totais de sampling por invocação de ferramenta.

O que conferir:

- Servidor expõe apenas uma ferramenta (`summarize_repo`); todo raciocínio acontece nas chamadas de sampling.
- Preferências de modelo ponderam a escolha de modelo do cliente; hints listam modelos preferidos.
- Loop termina em `stopReason: "endTurn"`.
- Limite `max_samples_per_tool = 5` pega um loop descontrolado.

## Entregue

Esta aula produz `outputs/skill-sampling-loop-designer.md`. Dado um algoritmo do lado do servidor que precisa de chamadas de LLM (pesquisa, resumo, planejamento), a skill projeta uma implementação baseada em sampling com as modelPreferences certas, rate limits e confirmações de segurança.

## Exercícios

1. Rode `code/main.py`. Mude `max_samples_per_tool` pra 2 e observe o corte de rate limit.

2. Implemente a variante tool-in-sampling do SEP-1577: o request de sampling carrega um array `tools`. Verifique que o loop do lado do cliente executa essas ferramentas antes de retornar a completion final. Nota de risco de deriva: assinaturas de SDK podem ainda mudar até H1 2026.

3. Adicione confirmação de humano no loop: antes do primeiro `sampling/createMessage` do servidor, pause e espere aprovação do usuário. Chamadas negadas retornam uma recusa tipada.

4. Adicione um rate limiter por usuário indexado por sessão do cliente. Loops no mesmo servidor pelo mesmo usuário devem compartilhar um orçamento.

5. Projete uma ferramenta `summarize_pdf` que usa sampling pra escolher chunks pra incluir. Esboce as mensagens enviadas. Como `modelPreferences.intelligencePriority` muda o comportamento em 0.1 vs. 0.9?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Sampling | "Chamada de LLM servidor-cliente" | Servidor pede completion do modelo do cliente |
| `sampling/createMessage` | "O método" | Método JSON-RPC pra requests de sampling |
| `modelPreferences` | "Prioridades de modelo" | Pesos de custo / velocidade / inteligência mais hints de nome |
| `includeContext` | "Vazamento cross-sessão" | Modo de inclusão de contexto soft-deprecated |
| SEP-1577 | "Ferramentas em sampling" | Permitir ferramentas dentro de sampling pra ReAct hospedado no servidor |
| Humano no loop | "Usuário confirma" | Cliente mostra request de sampling ao usuário antes de rodar |
| Bomba de loop | "Sampling descontrolado" | Loop infinito de sampling do lado do servidor; cliente deve limitar taxa |
| Sampling oculto | "Raciocínio escondido" | Servidor malicioso esconde intenção em prompts de sampling |
| Roubo de recursos | "Usando orçamento de LLM do usuário" | Servidor força cliente a gastar em sampling que não quer |
| `stopReason` | "Por que a geração parou" | `endTurn`, `stopSequence` ou `maxTokens` |

## Leituras Complementares

- [MCP — Concepts: Sampling](https://modelcontextprotocol.io/docs/concepts/sampling) — visão geral de alto nível do sampling
- [MCP — Client sampling especificação 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25/client/sampling) — forma canônica de `sampling/createMessage`
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — Proposta de Evolução da Eespecificaçãoificação pra ferramentas em sampling (experimental)
- [Unit 42 — MCP attack vectors](https://unit42.paloaltonetworks.com/modelcontextprotocol-attack-vectors/) — padrões de sampling oculto e roubo de recursos
- [Speakeasy — MCP sampling core concept](https://www.speakeasy.com/mcp/core-concepts/sampling) — walkthrough com exemplos de código do lado do cliente
