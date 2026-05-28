# Blocos de Memória e Sleep-Time Compute (Letta)

> MemGPT virou Letta em 2024. A evolução de 2026 adiciona duas ideias: blocos de memória funcionais discretos que o modelo pode editar diretamente e um agent em horário de descanso que consolida memória assincronamente enquanto o agent principal tá ocioso. É assim que você escala memória pra além de uma conversa.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 07 (MemGPT)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomear os três níveis de memória que a Letta usa (core, recall, archival) e o papel de cada um.
- Explicar o padrão de blocos de memória: bloco Human, bloco Persona e blocos definidos pelo usuário como objetos tipados de primeira classe.
- Descrever o que é sleep-time compute, por que fica fora do caminho crítico e por que pode rodar um modelo mais forte que o agent principal.
- Implementar um loop programado de dois agents onde um agent principal serve respostas e um agent de sleep-time consolida blocos entre turnos.

## O Problema

MemGPT (Aula 07) resolveu o fluxo de controle de memória virtual. Três problemas de produção surgiram:

1. **Latência.** Toda operação de memória fica no caminho crítico. Se o agent tem que podar, resumir ou reconciliar enquanto o usuário espera, latência no tail explode.
2. **Decomposição de memória.** Escritas acumulam. Fatos contraditórios permanecem. Recuperação se afoga em conteúdo obsoleto.
3. **Perda de estrutura.** Um armazenamento archival plano não consegue expressar "o bloco Human sempre fica no prompt; o bloco Persona sempre fica no prompt; o bloco Task troca por sessão."

Letta (letta.com) é a reescrita de 2026. Blocos de memória tornam explícita a estrutura; sleep-time compute move a consolidação fora do caminho crítico.

## O Conceito

### Três níveis

| Nível | Escopo | Onde vive | Escrito por |
|-------|--------|-----------|-------------|
| Core | Sempre visível | Dentro do prompt principal | Chamada de ferramenta do agent + reescritas sleep-time |
| Recall | Histórico de conversa | Recuperável | Log automático de turnos |
| Archival | Fatos arbitrários | Vector + KV + graph | Chamada de ferramenta do agent + ingestão sleep-time |

Core é o core do MemGPT. Recall é o buffer de conversa com sua cauda evicted. Archival é o armazenamento externo. A divisão limpa a sobrecarga de dois níveis do MemGPT.

### Blocos de memória

Um bloco é uma seção tipada, persistente e editável do nível core. O paper original do MemGPT definiu dois:

- **Bloco Human** — fatos sobre o usuário (nome, cargo, preferências, objetivos).
- **Bloco Persona** — auto-conceito do agent (identidade, tom, restrições).

Letta generaliza pra blocos arbitrários definidos pelo usuário: um bloco `Task` pro objetivo atual, um bloco `Project` pra fatos do codebase, um bloco `Safety` pra restrições rígidas. Cada bloco tem um `id`, `label`, `value`, `limit` (limite de caracteres), `description` (pra que o modelo saiba quando editar).

Blocos são editáveis via superfície de ferramentas:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` — condensa um bloco que está perto do limite.

### Sleep-time compute

A adição da Letta de 2025: roda um segundo agent em background, fora do caminho crítico. Agents de sleep-time processam transcripts de conversa e contexto de codebase, escrevem `learned_context` em blocos compartilhados e consolidam ou invalidam registros de archival.

Propriedades que emergem:

- **Sem custo de latência.** Respostas principais não esperam operações de memória.
- **Modelo mais forte permitido.** O agent de sleep-time pode ser um modelo mais caro e lento porque não é restrito a latência.
- **Janela natural de consolidação.** Dedup, resumo, invalidação de fatos contraditórios quando o usuário não tá esperando.

A forma combina como humanos trabalham: você faz a tarefa, dorme sobre isso, a memória de longo prazo se estabiliza durante a noite.

### Letta V1 e raciocínio nativo

Letta V1 (`letta_v1_agent`, 2026) descontinua `send_message`/heartbeat e tokens `Thought:` inline em favor de raciocínio nativo. A Responses API (OpenAI) e a Messages API com extended thinking (Anthropic) emitem raciocínio num canal separado, passado entre turnos (criptografado entre provedores em produção). O loop de controle ainda é ReAct. O trace de pensamento é estrutural, não em forma de prompt.

### Onde esse padrão dá errado

- **Inchaço de bloco.** `block_append` infinito atinge o limite rápido. Conecte um resumidor de bloco antes da escrita que empurre pra cima do limite.
- **Deriva silenciosa.** Agent de sleep-time reescreve um bloco e o agent principal nunca perceba. Versione blocos e mostre diffs no trace.
- **Consolidação envenenada.** Agent de sleep-time processa conteúdo acessível por atacante pra dentro do core. Aula 27 se aplica à superfície de sleep-time também.

## Construa

`code/main.py` implementa:

- `Block` — id, label, value, limit, description.
- `BlockStore` — CRUD + helper `near_limit(label)`.
- Dois agents programados — `PrimaryAgent` serve um turno, `SleepTimeAgent` consolida entre turnos.
- Um trace que mostra uma conversa de três turnos com escritas de bloco, mais uma passada de sleep-time que resume um bloco e invalida um fato obsoleto.

Rode:

```
python3 code/main.py
```

O transcript mostra a divisão: turnos principais são rápidos e produzem escritas brutas; a passada de sleep-time compacta e limpa.

## Use

- **Letta** (letta.com) pra implementação de referência. Self-host ou cloud gerenciado.
- **Skills do Claude Agent SDK** como conhecimento em formato de bloco — uma skill é um bloco de instruções nomeado, versionado e recuperável que o agent carrega sob demanda.
- **Construções customizadas** pra equipes que querem controle sobre o backend de armazenamento. Use o contrato de API da Letta pra poder migrar depois.

## Entregue

`outputs/skill-memory-blocks.md` gera um sistema de blocos formato Letta com hooks de sleep-time pra qualquer runtime, incluindo regras de segurança e conexão de citações.

## Exercícios

1. Adicione uma ferramenta `block_summarize` que substitui o valor do bloco por um resumo gerado por modelo quando `near_limit` retorna true. Qual limiar de trigger minimiza tanto chamadas de resumo quanto transbordamento de bloco?
2. Implemente dedup de sleep-time sobre archival: dois registros cujo texto tem >90% de sobreposição de tokens colapsam pra um. Faça só na passada de sleep-time, nunca no caminho crítico.
3. Versione blocos. Em toda escrita grave o valor antigo e um diff. Exponha `block_history(label)` pra que operadores possam debugar "por que o agent esqueceu X."
4. Trate agents de sleep-time como escritores não confiáveis. Quando tocam no bloco Persona ou Safety, exija revisão por segundo agent antes de commitar.
5. Porte o exemplo pra usar a API da Letta (`letta_v1_agent`). O que muda no schema de blocos e como raciocínio nativo altera a forma do trace?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| Memory block | "Seção de prompt editável" | Segmento tipado, persistente, editável por LLM da memória core |
| Human block | "Memória do usuário" | Fatos sobre o usuário, fixados no core |
| Persona block | "Identidade do agent" | Auto-conceito, tom, restrições, fixados no core |
| Sleep-time compute | "Trabalho de memória assíncrono" | Segundo agent fazendo consolidação fora do caminho crítico |
| Core / Recall / Archival | "Níveis" | Divisão de memória em três camadas: sempre-visível / conversa / externo |
| Block limit | "Cap" | Limite de caracteres por bloco; força resumo |
| Native reasoning | "Canal de raciocínio" | Saída de raciocínio no nível de provider, não `Thought:` no nível de prompt |
| Learned context | "Saída do sleep-time" | Fatos que o agent de sleep-time escreve em blocos compartilhados |

## Leitura Complementar

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) — o padrão de blocos
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) — consolidação assíncrona
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) — reescrita com raciocínio nativo
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) — a origem
