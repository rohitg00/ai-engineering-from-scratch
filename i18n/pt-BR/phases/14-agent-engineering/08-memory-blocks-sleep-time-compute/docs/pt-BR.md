# Blocos de memória e tempo de sono

> O modelo pode editar diretamente e um agente de tempo de sono que consolida a memória de forma assíncrona enquanto o agente primário está ocioso.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Nomear os três níveis de memória que Letta usa (núcleo, recall, arquivo) e o papel de cada um.
- Explique o padrão de bloqueio de memória: Bloco humano, bloco Persona e blocos definidos pelo usuário como objetos de primeira classe.
- Descreva o que é o cálculo do tempo de sono, por que fica fora do caminho crítico e por que pode executar um modelo mais forte do que o agente primário.
- Implementar um ciclo de dois agentes scripted onde um agente primário serve respostas e um agente de tempo de sono consolida blocos entre viradas.

## O problema

MemGPT (Lessão 07) resolveu o fluxo de controle de memória virtual.

1. **Latency.**Cada operação de memória está no caminho crítico. se o agente tiver que poda, resumir ou reconciliar enquanto o usuário espera, a latência da cauda explode.
2. **Memory rot.**Os escritos acumulam-se, os fatos contraditórios permanecem, a recuperação afoga-se em conteúdo obsoleto.
3. **Structure loss.**Um arquivo plano não pode expressar "o bloco humano está sempre no prompt; o bloco Persona está sempre no prompt; o bloco tarefa troca por sessão".

Letta (letta.com) é o nome da plataforma o projeto MemGPT original adotado em 2024  O padrão do papel mantém o nome MemGPT  e a reescritura de 2026 Letta V1 é um passo posterior e separado.

## O conceito

### Três níveis

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

O núcleo é o núcleo MemGPT. O memorando é o buffer de conversação com a sua cauda despejada. O arquivo é a loja externa. A divisão limpa a sobrecarga de dois níveis do MemGPT.

### Blocos de memória

Um bloco é uma seção tipada, persistente e editável do nível principal.

- **Human block** Factos sobre o utilizador (nome, função, preferências, objectivos).
- **Persona block** autoconceito do agente (identidade, tom, restrições).

Letta generaliza para blocos arbitrários definidos pelo usuário: a `Task`Bloque para o objectivo actual, um `Project`Bloco de dados baseados em código, a`Safety`Bloco para restrições duras.`id`- Não .`label`- Não .`value`- Não .`limit`(capítulo de caracteres), `description`(para que o modelo saiba quando editá-lo).

Os blocos são editáveis através da superfície da ferramenta:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` condensa um bloco próximo do seu limite.

### Computação do tempo de sono

A adição Letta 2025: executar um segundo agente em segundo plano, fora do caminho crítico.`learned_context`em blocos compartilhados e consolidar ou invalidar os registos de arquivo.

Propriedades que caem:

- **No latency cost.**As respostas primárias não esperam por operações de memória.
- **Stronger model allowed.**O agente de tempo de sono pode ser um modelo mais caro e mais lento porque não é limitado pela latência.
- **Natural consolidation window.**Dedup, resumir, invalidar fatos contraditórios quando o usuário não está esperando.

A forma corresponde ao modo como os humanos trabalham: você faz a tarefa, dorme sobre ela, a memória a longo prazo se acalma durante a noite.

### Raciocínio nativo

Letta V1 (`letta_v1_agent`, 2026) deprecia `send_message`/ batimento cardíaco e em linha`Thought:`Os responsáveis API (OpenAI) e as mensagens API com pensamento extendido (Antropic) emitem o raciocínio em um canal separado, passado por turnos (encriptado entre provedores na produção). O ciclo de controle ainda é ReAct. O rastro de pensamento é estrutural, não em forma de prompt.

### Onde este padrão vai mal

- **Block bloat.**Infinito .`block_append`Envia um resumo de bloco antes da escrita que empurra sobre o limite.
- **Silent drift.**O agente do sono reescreve um bloco e o agente principal nunca percebe.
- **Poisoned consolidation.**O agente do sono processa o conteúdo alcançável pelo atacante no núcleo.

```figure
memory-blocks
```

## Construí-lo

`code/main.py`Implementos:

- `Block` identificação, etiqueta, valor, limite, descrição.
- `BlockStore` CRUD + `near_limit(label)`- Ajudante.
- Dois agentes com guião`PrimaryAgent`serve um turno, `SleepTimeAgent`consolida-se entre os viros.
- Um rastro que mostra uma conversa de três voltas com o Bloc escreve, mais um passe de sono que resume um bloco e invade um fato antiquado.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

A transcrição mostra a divisão: as viradas primárias são rápidas e produzem escritos crus; o passe de sono compacta e limpa.

## Usá-lo

- **Letta**(letta.com) para a implementação de referência.
- **Claude Agent SDK skills**Como conhecimento em forma de bloco  uma habilidade é um bloco de instruções nomeado, versão, recuperável que o agente carrega à demanda.
- **Custom builds**Para equipes que querem o controle sobre o backend de armazenamento, use o contrato Letta API para poderem migrar mais tarde.

## Envia-o

`outputs/skill-memory-blocks.md`gera um sistema de blocos em forma de Letta com ganchos de tempo de sono para qualquer tempo de execução, incluindo regras de segurança e cablagem de citação.

## Exercícios

1. Adicionar um`block_summarize`ferramenta que substitui o valor de bloco por um resumo gerado por modelo quando `near_limit`Qual limiar de gatilho minimiza as chamadas de resumo e o desbordamento de blocos?
2. Implementar a dedução do tempo de sono sobre o arquivo: dois registros cujo texto tem > 90% de sobreposição simbólica colapsam para um.
3. Blocos de versão. em cada registro de escrita o valor antigo e uma diferença. Expor `block_history(label)`Então os operadores podem fazer o depósito "por que o agente esqueceu X".
4. Tratem os agentes do sono como escritores não confiáveis, quando tocarem no bloco Persona ou Segurança, precise de uma revisão de segundo agente antes de se comprometer.
5. Portar o exemplo para usar a API Letta (`letta_v1_agent`Quais são as mudanças no esquema de blocos, e como o raciocínio nativo altera a forma do rastro?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## Mais leitura

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) padrão de bloco
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) Consolidação de sincronização
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) Reescrever o raciocínio nativo
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) origem
