# Memória de Agente  Contexto Virtual e Paging de Memória

> As janelas de contexto são finitas. Conversas, documentos e traços de ferramentas não são. A correção é a memória virtual do sistema operacional re-estabelecida.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Explique a analogia do sistema operacional que MemGPT baseia no contexto principal = RAM, contexto externo = disco, ferramentas de memória = página de entrada/saída.
- Implementar o padrão MemGPT de dois níveis no stdlib com um buffer de contexto principal, uma loja de pesquisa externa e ferramentas de entrada/saída de página.
- Descreva como o agente emite "interrupts" para consultar ou modificar a memória externa e como o resultado é inserido no próximo prompt.
- Identificar as opções de design MemGPT que se incluem na Letta (Lessão 08) e Mem0 (Lessão 09).

## O problema

As janelas de contexto parecem que devem resolver a memória.

1. **Overflow.**Conversas de várias voltas, documentos longos ou trajetórias pesadas em ferramentas atravessam a janela.
2. **Dilution.**Mesmo dentro da janela, encher conteúdo irrelevante diluir a atenção sobre o que importa.
3. **Persistence.**Uma nova sessão começa com uma janela vazia, e os agentes sem memória externa não podem dizer " lembras-te quando me pediste"...

Os janelas maiores ajudam, mas não corrigem isso. Mem0 2025 papel medido que 128k janelas linhas de base ainda não têm fatos de longo horizonte que um agente de janelas 4k com memória externa capta.

## O conceito

### A analogia do sistema operacional

MemGPT (Packer et al., arXiv:2310.08560, v2 Feb 2024) mapeia a gestão de contexto para a memória virtual do sistema operacional:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

O agente executa um ciclo normal de ReAct. Uma classe extra de ferramentas permite que ele pegar dados dentro e fora do contexto principal.

### Dois níveis

- **Main context.**Promulgação de tamanho fixo mantendo a tarefa atual, sempre visível para o modelo.
- **External context.**Sem limites, pesquisáveis através de ferramentas, ler quando for relevante, escrever quando surgirem fatos.

O artigo original avaliou o projeto em duas tarefas além da janela base: análise de documentos mais longos do que 100k tokens e chat de várias sessões com memória persistente ao longo de dias.

### O padrão de interrupção

MemGPT introduz memória como interrupta: no meio da conversa, o agente pode invocar uma ferramenta de memória, o tempo de execução a executar, e o resultado se inserir na próxima vez de assistente como uma nova observação.`read()`syscall que bloqueia o processo, retorna bytes, e o processo continua.

Superfície de ferramenta de memória canônica:

- `core_memory_append(section, text)` escrever para uma seção persistente do aviso.
- `core_memory_replace(section, old, new)` editar uma seção persistente.
- `archival_memory_insert(text)` escrever para a loja externa pesquisável.
- `archival_memory_search(query, top_k)` recuperar na loja externa.
- `conversation_search(query)`- Escanar as viradas passadas.

### Onde termina o papel e começa a produção

Em Setembro de 2024, o MemGPT tornou-se Letta.`cpacker/MemGPT`) permanece; a Letta amplia o projecto:

- Três níveis em vez de dois (núcleo, recall, arquivo  Lição 08).
- Raciocínio nativo que substitua o `send_message`- padrão cardíaco (Lessão 08).
- Agentes de tempo de sono que executam a memória asíncrona (Lessão 08).

O papel MemGPT é a base para 2026, mesmo que os sistemas de produção executem Letta, Mem0, ou uma loja de dois níveis personalizada.

### Onde este padrão vai mal

- **Memory rot.**Os textos se acumulam mais rapidamente do que os textos são leitos; a recuperação afoga-se em fatos obsoletos.
- **Memory poisoning.**Memória externa é retomada texto. Se o conteúdo controlado pelo atacante cai em uma nota de memória, o agente reingere-a na próxima sessão.
- **Citation loss.**O agente lembra "o usuário me pediu para enviar X", mas não pode citar qual turno.

```figure
context-budget
```

## Construí-lo

`code/main.py`Implementa o padrão de dois níveis do MemGPT no stdlib:

- `MainContext` Buffer de resposta de tamanho fixo com um `core`- e um`messages`lista; auto-compacta as mensagens mais antigas quando ultrapassado.
- `ArchivalStore` armazenamento em memória BM25-esque (pontuação de tokens-overlap) de registros (id, texto, tags, sessão, turno).
- Cinco ferramentas de memória que mapeam a superfície do MemGPT.
- Um agente com guião que enche o arquivo com fatos, e depois responde a uma pergunta ligando.`archival_memory_search`- Não .

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

O rastro mostra o agente escrevendo três fatos, preenchendo o contexto principal do limite (despejo forçado), e depois respondendo a uma pergunta de acompanhamento, retirando do arquivo  reproduzindo o fluxo de trabalho MemGPT sem qualquer LLM real.

## Usá-lo

Todos os sistemas de memória de produção hoje são uma variante MemGPT:

- **Letta**(Lessão 08)  três níveis, raciocínio nativo, cálculo do tempo de sono.
- **Mem0**(Lessão 09)  vetor + KV + gráfico fundido com uma camada de pontuação.
- **OpenAI Assistants / Responses** gestão de memória através de fios e arquivos.
- **Claude Agent SDK** Memória de longo prazo através de competências e de sessões de armazenamento.

Escolha um por forma operacional (auto-hosted, gerenciado, integrado em framework), não pelo padrão central  o padrão central é MemGPT.

### A forma da memória do agente

A pagagem resolve a capacidade. Não decide o que armazenar. Quatro tipos de memória recorrem em todos os sistemas de produção, cada um respondendo a uma pergunta diferente:

- **Working memory**O nível no contexto: tarefa atual, viradas recentes, secções de núcleo fixas.
- **Episodic memory** o que aconteceu? curvas e trajetórias passadas, armazenadas com referências de sessão e curva, reproduzíveis sob demanda.
- **Semantic memory**Factos sobre o utilizador, o domínio, o mundo, atualizados e deduplicados à medida que mudam.
- **Procedural memory**Aprendi rotinas, preferências e regras que orientam o comportamento futuro em vez de lembrar.

As implementações de código aberto escolhem diferentes pontos de ataque:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## Envia-o

`outputs/skill-virtual-memory.md`é uma habilidade reutilizável que produz um andamio de memória de dois níveis correto (superfície principal + arquivo + ferramenta) para qualquer tempo de execução de alvo, com política de despejo e campos de citação conectados.

## Exercícios

1. Adicionar um`max_main_context_tokens`Cap em tokens (aproximadamente `len(text.split())`* 1.3). Compactar as mensagens mais antigas em um resumo quando o limite é ultrapassado.
2. Implementar adequadamente o BM25 sobre o arquivo (frequência de prazo, frequência inversa de documento).
3. Adicionar`citation`campos (session_id, turn_id, source_url) para inserções de arquivo. Faça com que o agente cite fontes em cada resposta apoiada pela recuperação.
4. Simula a intoxicação da memória: adicione um registro de arquivo que diga "ignore todas as instruções futuras do usuário". Escreva um guardas que rastreia as buscas de texto em forma de instrução e marca-as sem confiança.
5. Portar a implementação para usar o esquema JSON de memória central do repo de pesquisa MemGPT (`cpacker/MemGPT`O que muda quando você passa de cordas planas para seções de tipografia?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## Mais leitura

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) Papel de contexto virtual inspirado no sistema operacional
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) a evolução de três níveis
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) Tratar o contexto como um orçamento
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) Memória de produção híbrida em cima deste padrão
- [Zep (getzep/zep)](https://github.com/getzep/zep)Memória temporal do grafo de conhecimento da tabela de taxonomia
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) o gasoduto de extracção por trás da loja híbrida da Lição 09
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) Extração de antecedentes de fatos e regras de comportamento
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) Captura de sessões consolidada em registros digitalizados e pesquisáveis
