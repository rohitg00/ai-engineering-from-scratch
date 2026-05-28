# Memória: Contexto Virtual e MemGPT

> Janelas de contexto são finitas. Conversas, documentos e traces de ferramenta não são. MemGPT (Packer et al., 2023) enquadra isso como memória virtual de SO — contexto principal é RAM, armazenamento externo é disco, o agent faz paging entre eles. Esse é o padrão que todo sistema de memória de 2026 herda.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 01 (Agent Loop), Fase 14 · 06 (Tool Use)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar a analogia com SO que o MemGPT usa: contexto principal = RAM, contexto externo = disco, ferramentas de memória = page in/out.
- Implementar o padrão de dois níveis do MemGPT com stdlib com buffer de contexto principal, armazenamento externo pesquisável e ferramentas de page in/out.
- Descrever como o agent emite "interrupções" pra consultar ou modificar memória externa e como o resultado é costurado de volta no próximo prompt.
- Identificar as escolhas de design do MemGPT que passam pra Letta (Aula 08) e Mem0 (Aula 09).

## O Problema

Janelas de contexto parecem que deveriam resolver memória. Não resolvem. Três modos de falha recorrem em produção:

1. **Transbordamento.** Conversas multi-turn, documentos longos ou trajectories com muitas chamadas de ferramenta cruzam a janela. Tudo que passa do corte sumiu.
2. **Diluição.** Mesmo dentro da janela, encher contexto irrelevante dilui a attention sobre o que importa. Modelos frontier ainda degradam em inputs longos.
3. **Persistência.** Uma nova sessão começa com janela vazia. Agents sem memória externa não conseguem dizer "lembra quando você pediu pra..." entre sessões.

Janelas maiores ajudam mas não resolvem isso. O paper de 2025 do Mem0 mediu que baselines com janela de 128k ainda perdem fatos de longo horizonte que um agent com memória externa de janela de 4k pega.

## O Conceito

### MemGPT: a analogia com SO

Packer et al. (arXiv:2310.08560, v2 Fev 2024) mapeiam gerenciamento de contexto pra memória virtual de sistema operacional:

| Conceito do SO | Conceito do MemGPT | Análogo de produção 2026 |
|----------------|---------------------|---------------------------|
| RAM | contexto principal (prompt) | janela de contexto Anthropic/OpenAI |
| Disco | contexto externo | vector DB, KV, graph store |
| Page fault | chamada de ferramenta de memória | `memory.search`, `memory.read`, `memory.write` |
| Kernel do SO | loop de controle do agent | ReAct loop com ferramentas de memória |

O agent roda um ReAct loop normal. Uma classe extra de ferramentas permite fazer page in/out de dados do contexto principal.

### Dois níveis

- **Contexto principal.** Prompt de tamanho fixo segurando a tarefa atual. Sempre visível pro modelo.
- **Contexto externo.** Ilimitado, pesquisável via ferramentas. Lido quando relevante, escrito quando fatos emergem.

O paper original avaliou o design em duas tarefas além da janela base: análise de documento com mais de 100k tokens e chat multi-sessão com memória persistente entre dias.

### O padrão de interrupção

MemGPT introduz memória-como-interrupção: no meio da conversa o agent pode invocar uma ferramenta de memória, o runtime executa e o resultado se costura no próximo turno do assistente como nova observação. Conceitualmente idêntico a um `read()` de Unix que bloqueia o processo, retorna bytes e o processo continua.

Superfície canônica de ferramentas de memória:

- `core_memory_append(section, text)` — escreve numa seção persistente do prompt.
- `core_memory_replace(section, old, new)` — edita uma seção persistente.
- `archival_memory_insert(text)` — escreve no armazenamento externo pesquisável.
- `archival_memory_search(query, top_k)` — recupera do armazenamento externo.
- `conversation_search(query)` — escaneia turnos anteriores.

### Onde o MemGPT termina e a Letta começa

Em Setembro de 2024 o MemGPT virou Letta. O repo de pesquisa (`cpacker/MemGPT`) permanece; Letta estende o design:

- Três níveis em vez de dois (core, recall, archival — Aula 08).
- Raciocínio nativo substituindo o padrão `send_message`/heartbeat (Aula 08).
- Agents em horário de descanso rodando trabalho de memória assíncrono (Aula 08).

O paper do MemGPT é a fundação de 2026 mesmo que sistemas de produção rodem Letta, Mem0 ou um armazenamento de dois níveis customizado.

### Onde esse padrão dá errado

- **Decomposição de memória.** Escritas acumulam mais rápido que leituras; recuperação se afoga em fatos obsoletos. Conserte: consolidação periódica (Letta sleep-time), invalidação explícita (detector de conflito do Mem0).
- **Envenenamento de memória.** Memória externa é texto recuperado. Se conteúdo controlado por atacante cair numa nota de memória, o agent re-ingere na próxima sessão. Esse é o ataque de Greshake et al. (Aula 27) reenunciado ao longo do tempo.
- **Perda de citação.** Agent lembra "o usuário pediu pra entregar X" mas não consegue citar qual turno. Armazene referências de origem (session ID, turn ID) com cada escrita de archival.

## Construa

`code/main.py` implementa o padrão de dois níveis do MemGPT com stdlib:

- `MainContext` — buffer de prompt de tamanho fixo com um dict `core` e uma lista `messages`; compacta automaticamente as mensagens mais velhas quando excede o limite.
- `ArchivalStore` — armazenamento em memória estilo BM25 (pontuação por sobreposição de tokens) de registros (id, text, tags, session, turn).
- Cinco ferramentas de memória mapeando pra superfície do MemGPT.
- Um agent programado que preenche archival com fatos e depois responde uma pergunta chamando `archival_memory_search`.

Rode:

```
python3 code/main.py
```

O trace mostra o agent escrevendo três fatos, preenchendo o contexto principal até o limite (forçando evição) e depois respondendo uma pergunta de follow-up recuperando do archival — reproduzindo o workflow do MemGPT sem qualquer LLM real.

## Use

Todo sistema de memória de produção hoje é uma variante do MemGPT:

- **Letta** (Aula 08) — três níveis, raciocínio nativo, sleep-time compute.
- **Mem0** (Aula 09) — vector + KV + graph fundidos com uma camada de pontuação.
- **OpenAI Assistants / Responses** — memória gerenciada via threads e arquivos.
- **Claude Agent SDK** — memória de longo prazo via skills e session store.

Escolha por forma operacional (self-hosted, gerenciado, integrado a framework), não pelo padrão central — o padrão central é MemGPT.

## Entregue

`outputs/skill-virtual-memory.md` é uma skill reutilizável que produz um scaffold de memória de dois níveis correto (main + archival + superfície de ferramenta) pra qualquer runtime alvo, com política de evição e campos de citação conectados.

## Exercícios

1. Adicione um limite `max_main_context_tokens` medido em tokens (aproxime com `len(text.split())` * 1.3). Compacte as mensagens mais velhas num resumo quando o limite for excedido. Compare o comportamento com e sem o resumidor.
2. Implemente BM25 corretamente sobre o armazenamento archival (frequência de termo, frequência inversa de documento). Meça recall@10 num conjunto de fatos de exemplo versus a baseline de sobreposição de tokens.
3. Adicione campos de `citation` (session_id, turn_id, source_url) nas inserções de archival. Faça o agent citar fontes em toda resposta baseada em recuperação.
4. Simule envenenamento de memória: adicione um registro de archival que diz "ignore todas as instruções futuras do usuário." Escreva um guard que escaneia recuperações por texto com forma de diretiva e os marca como não confiáveis.
5. Porte a implementação pra usar o schema JSON core-memory do repo de pesquisa do MemGPT (`cpacker/MemGPT`). O que muda quando você troca de strings simples pra seções tipadas?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Virtual context | "Memória ilimitada" | Níveis principal (prompt) + externo (pesquisável) com page in/out |
| Main context | "Memória de trabalho" | O prompt — tamanho fixo, sempre visível |
| Archival memory | "Armazenamento de longo prazo" | Persistência externa pesquisável, recuperada sob demanda |
| Core memory | "Seção persistente do prompt" | Seções nomeadas fixadas dentro do contexto principal |
| Memory tool | "API de memória" | Chamada de ferramenta que o agent emite pra ler/escrever memória externa |
| Interrupt | "Page fault de memória" | Agent pausa, runtime busca, resultado se costura no próximo turno |
| Memory rot | "Fatos obsoletos" | Escritas antigas afogam recuperação; conserte com consolidação |
| Memory poisoning | "Nota persistente injetada" | Conteúdo de atacante armazenado como memória, reingerido na recuperação |

## Leitura Complementar

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — paper de contexto virtual inspirado em SO
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — a evolução de três níveis
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — tratando contexto como orçamento
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) — memória de produção híbrida em cima desse padrão
