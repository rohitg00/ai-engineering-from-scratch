# SGLang e RadixAttention para Workloads com Prefixo Pesado

> SGLang trata o KV cache como um recurso de primeira classe e reutilizável, armazenado em uma radix tree. Onde o vLLM agenda requests FCFS (primeiro a chegar, primeiro a ser servido), o scheduler com consciência de cache do SGLang prioriza requests com prefixos compartilhados mais longos — efetivamente uma travessia radix em profundidade para que os ramos quentes fiquem residentes no HBM. No Llama 3.1 8B com prompts de 1K estilo ShareGPT, SGLang atinge ~16.200 tok/s vs ~12.500 do vLLM, uma vantagem de ~29%. Em workloads RAG com prefixo pesado a vantagem chega a 6,4x. Em workloads com formato de clonagem de voz, a taxa de acerto do cache superou 86%. Implantado em 400.000+ GPUs em 2026 no xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. O detalhe é que o número de 6,4x evapora quando a ordenação de prefixos é inconsistente — ordenação é a alavanca do engenheiro.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, radix-tree cache toy + scheduler com consciência de cache)
**Pré-requisitos:** Fase 17 · 04 (Internals de Serving vLLM), Fase 14 (Agentic RAG)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Diagramar RadixAttention: como prefixos são armazenados em uma radix tree e como blocos KV são compartilhados entre sequências enraizadas no mesmo ramo.
- Explicar agendamento com consciência de cache e por que FCFS é errado para tráfego com prefixo pesado.
- Computar o speedup esperado para um workload dado a taxa de acerto do prefix-cache e a distribuição de comprimento de prompts.
- Nomear a disciplina de ordenação de prompts que torna o número de 6,4x real vs uma oportunidade desperdiçada.

## O Problema

Serving clássico trata o prompt de cada request como opaco. Mesmo quando 5.000 requests RAG começam todos com o mesmo prompt de sistema de 2.000 tokens mais o mesmo preâmbulo de recuperação, o vLLM prefilla esse prefixo de 2.000 tokens 5.000 vezes. A GPU faz o mesmo trabalho repetidamente.

A observação: prompts em workloads agentic e RAG compartilham prefixos longos quase sempre. Prompt de sistema, schemas de ferramentas, exemplos few-shot, cabeçalhos de recuperação, histórico de conversa — tudo se repete entre requests. Se você armazenasse o KV cache para esse prefixo uma vez e reutilizasse, não faria prefill de novo.

RadixAttention faz exatamente isso. Tokens são indexados em uma radix tree; cada nó possui blocos KV para a sequência de tokens no seu caminho da raiz. Um novo request percorre a árvore: qualquer nó cujo token coincida reutiliza os blocos KV daquele nó. O custo de prefill se torna proporcional ao sufixo "novo", não ao prompt inteiro.

O desafio é o agendamento. Se dois requests compartilham um prefixo de 2.000 tokens e um terceiro compartilha apenas 200 tokens do mesmo prefixo, você quer servir os dois com prefixo longo compartilhado juntos para que o prefixo longo fique no HBM. FCFS faz o oposto — serve quem chegou primeiro, potencialmente evacuando o ramo quente antes do próximo request de prefixo longo chegar.

## O Conceito

### A radix tree como índice de KV

Uma radix tree (trie compacta) armazena sequências de tokens. Cada nó possui um intervalo de tokens e os blocos KV calculados para esse intervalo. Filhos estendem a sequência em um ou mais tokens.

```
root
 |- "You are a helpful assistant..."  (2.000 tokens, 124 blocos KV)
      |- "Context: <doc A>..."        (500 tokens, 31 blocos)
           |- "Question: Alice..."    (80 tokens, 5 blocos)
           |- "Question: Bob..."      (95 tokens, 6 blocos)
      |- "Context: <doc B>..."        (520 tokens, 33 blocos)
```

Um novo request chega com prompt de sistema + "Context: <doc A>" + "Question: Carol". O scheduler percorre: prefixo do sistema coincide (124 blocos reutilizados), ramo doc-A coincide (31 blocos reutilizados), depois aloca blocos novos apenas para "Question: Carol" (4 blocos). Custo de prefill: 4 blocos de tokens novos. Sem a árvore: 160 blocos. ~40x de economia no prefill.

### Agendamento com consciência de cache

Reutilização baseada em radix tree é inútil se o cache churna. Duas políticas chave:

1. **Despacho em profundidade**. Ao escolher o próximo request da fila, preferir requests enraizados no mesmo ramo que o conjunto atual de execução. Isso mantém o ramo quente fixado.
2. **LRU no nível do ramo, não no nível do bloco**. Evitar ramos inteiros (começando pelas folhas de menor uso) em vez de blocos individuais, para que a forma do cache combine com a forma da radix.

FCFS viola as duas. Um request compartilhando 2.000 tokens fica atrás de um compartilhando 50, depois o ramo de 2.000 tokens é evacuado para admitir o de 50 tokens.

### Números de benchmark que você deve memorizar

- Llama 3.1 8B, H100, prompts de 1K ShareGPT: SGLang ~16.200 tok/s vs vLLM ~12.500 (~29% de vantagem).
- RAG com prefixo pesado (mesmo sistema + mesmo documento, questão variando): até 6,4x no SGLang.
- Workloads de clonagem de voz: 86,4% de taxa de acerto do prefix-cache.
- Taxas de acerto em produção entre clientes do SGLang: 50-99% dependendo da disciplina de prompts.
- Implantado em 400.000+ GPUs em 2026.

### A armadilha da ordenação

O número de 6,4x depende de ordenação consistente do template de prompt. Se seu cliente constrói prompts como `[system, tools, context, history, question]` em alguns requests e `[system, context, tools, history, question]` em outros, a árvore não consegue encontrar o prefixo compartilhado. O que parece um prefixo compartilhado para um humano são duas sequências distintas para a radix tree.

Alavanca do engenheiro: seu template de prompt é a chave do cache. Fixe a ordem. Coloque tudo imutável (sistema, tools, schemas) primeiro. Coloque o contexto de recuperação em seguida. Coloque a questão do usuário por último. Não interleave conteúdo dinâmico no prefixo.

Caso real da pesquisa: mover conteúdo dinâmico para fora do prefixo cacheável levou um deployment de 7% para 74% de taxa de acerto do cache em uma mudança.

### Onde RadixAttention ganha e perde

Ganha:
- RAG (mesmo preâmbulo de recuperação, questão variando).
- Agents (mesmos schemas de ferramentas, query variando).
- Chat com prompt de sistema longo.
- Workloads de voz/vision com preâmbulos repetidos.

Perde (volta ao throughput nível vLLM):
- Geração single-shot com prompts únicos (completar código, chat aberto sem prompt de sistema).
- Prompts dinâmicos onde cada request interleave conteúdo único no prefixo.

### Por que isso é um problema de scheduler, não só de kernel

Você pode implementar reutilização de KV como um truque de kernel. O insight do SGLang é que a reutilização só paga se o scheduler mantém o ramo quente resident. Uma política ingênua de "reutilizar se disponível" vai churnar o cache sob carga mista. O scheduler indexado em radix tree é o que transforma o truque de kernel em uma vantagem de 29% em produção.

### Interação com vLLM

Os dois sistemas não são competidores estritos. Em 2026 o vLLM adicionou prefix caching (`--enable-prefix-caching`) e um roteador com consciência de cache (vLLM Router em Rust). A lacuna fechou mas não desapareceu totalmente — a stack inteira do SGLang é radix-first; o vLLM enxertou depois. Para workloads dominados por reutilização de prefixo, SGLang continua sendo o padrão. Para serving sem padrões fortes de prefixo, vLLM continua igual ou melhor.

## Use

`code/main.py` implementa um radix-tree KV cache toy mais um scheduler com duas políticas: FCFS e com consciência de cache. Roda o mesmo workload através das duas, reporta taxa de acerto do prefix-cache e delta de throughput. Depois roda um workload com "ordenção embaralhada" para mostrar o colapso do 6,4x.

## Entregue

Esta aula produz `outputs/skill-radix-scheduler-advisor.md`. Dada uma descrição do workload (forma do template de padrão, padrão de recuperação, número de tenants concorrentes), produz uma prescrição de ordenação de prompts e um go/n-go para adoção do SGLang.

## Exercícios

1. Execute `code/main.py`. Compare FCFS e com consciência de cache no mesmo workload. De onde vem o delta — economia de prefill, economia de decode ou atraso de fila?
2. Modifique o workload para que os prompts permutem aleatoriamente `[system, tools, context]`. Re-execute. O que acontece com a taxa de acerto? Por quê?
3. Calcule o custo em HBM de manter um prompt de sistema de 2.000 tokens residente como um ramo da radix no Llama 3.1 8B. Compare com o custo de um batch de 16 sequências sem reutilização de prefixo.
4. Leia o paper RadixAttention do SGLang. Explique em três frases por que a remoção LRU em formato de árvore ganha da remoção LRU em formato de bloco sob carga com prefixo pesado.
5. Um cliente relata apenas 8% de taxa de acerto do cache. Nomeie três causas prováveis e o diagnóstico que você rodaria para cada uma.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| RadixAttention | "aquela coisa do SGLang" | KV cache indexado como radix tree para que prefixos compartilhados reutilizem blocos |
| Radix tree | "trie compacta" | Árvore onde cada nó possui um intervalo de tokens e seus blocos KV |
| Scheduler com consciência de cache | "ramo quente primeiro" | Scheduler que prioriza requests compartilhando o ramo residente |
| Taxa de acerto do prefix-cache | "quanto do seu prompt foi grátis" | Fração de tokens do prompt servidos de blocos KV reutilizados |
| FCFS | "first-come first-served" | Agendamento padrão que quebra a localidade de prefixo |
| LRU no nível do ramo | "evitar a folha" | Política de remoção correspondente à forma da radix |
| Ordenação do template de prompt | "a chave do cache" | A ordem dos componentes do prompt determina o que a árvore pode compartilhar |
| Fixação do prompt de sistema | "prefixo residente" | Manter a parte imutável do sistema fixada para evitar churn de remoção |

## Leitura Complementar

- [SGLang GitHub](https://github.com/sgl-project/sglang) — código-fonte e docs.
- [SGLang documentation](https://sgl-project.github.io/) — detalhes do RadixAttention e agendamento.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) — referência de design.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) — números de benchmark e raciocínio do scheduler.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/prefix_caching.html) — implementação própria do vLLM, estilo radix, para comparação.
