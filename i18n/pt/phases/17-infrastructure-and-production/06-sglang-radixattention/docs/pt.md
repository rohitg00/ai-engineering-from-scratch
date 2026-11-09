# Prefixo-Cache Servindo  RadixAttenção e KV Reutilização

> Trate o cache KV como um recurso reutilizável de primeira classe armazenado em uma árvore de radix e muda a programação com ele: em vez de FCFS (primeiro-chegado, primeiro servido) como agendas vLLM, um cronista consciente do cache priorizará solicitações com prefixos compartilhados mais longos  efetivamente uma profundidade-primeira travessia de radix para que os ramos quentes permaneçam residentes no HBM. O SGLang é o motor que construiu a ideia. No Llama 3.1 8B com as instruções de 1K parecidas com o ShareGPT, o SGLang chega a ~ 16.200 tok/s para ~ 12.500 do vLLM, uma vantagem de ~ 29%. Nas cargas de trabalho RAG de prefixo pesado, a vantagem atinge 6,4x. Nas cargas de trabalho em forma de clonagem de voz, a taxa de acessos no cache foi limpa em 86%. Implementado em mais de 400.000 GPUs em 2026 em xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS. O problema é que o número 6.4x evapora quando o prefixo de ordem é inconsistente.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy radix-tree cache + cache-aware scheduler)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 14 (Agentic RAG)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Diagrama RadixAttenção: como os prefixos são armazenados em uma árvore radix e como os blocos KV são compartilhados entre sequências enraizadas no mesmo ramo.
- Explique a programação consciente do cache e por que o FCFS é errado para o tráfego pesado de prefixos.
- Calcule a aceleração esperada para uma carga de trabalho dada a taxa de acidente do prefixo-cache e a distribuição de comprimento imediata.
- Nomear a disciplina de ordenação rápida que faz o número 6.4x real versus um lado positivo perdido.

## O problema

O serviço clássico trata o prompt de cada solicitação como opaco. Mesmo quando 5.000 solicitações RAG começam com o mesmo prompt de sistema de 2.000 tokens mais o mesmo preâmbulo de recuperação, vLLM preenche o prefixo de 2.000 tokens 5.000 vezes.

A observação: as instruções em cargas de trabalho agencias e RAG compartilham quase sempre prefixos longos. Pronto de sistema, esquemas de ferramentas, exemplos de poucas fotos, cabeçalhos de recuperação, histórico de conversação  todas repetem-se em todas as solicitações. Se você armazenou o cache KV para esse prefixo uma vez e o reutilizou, você não o preencheria novamente.

A RadixAttention faz exatamente isso. Os tokens são indexados em uma árvore radix; cada nó possui blocos KV para a sequência de token em seu caminho da raiz. Uma nova solicitação percorre a árvore: qualquer nó cujo token corresponde reutiliza os blocos KV desse nó. O custo de preenchimento torna-se proporcional ao sufixo "novo", não o prompt completo.

O desafio é agendar. Se duas solicitações compartilham um prefixo de 2.000 tokens e um terceiro compartilha apenas 200 tokens do mesmo prefixo, você quer servir as duas solicitações compartilhadas longamente juntas para que o prefixo longo permaneça no HBM. FCFS faz o oposto  ele serve quem chegou primeiro, potencialmente despejando o ramo quente antes que o próximo pedido de prefixo longo atinja.

## O conceito

### A árvore de radix como índice de KV

Uma árvore de radix (trie compacto) armazena sequências de tokens. Cada nó possui um intervalo de tokens e os blocos KV calculados para esse intervalo.

```
root
 |- "You are a helpful assistant..."  (2,000 tokens, 124 KV blocks)
      |- "Context: <doc A>..."        (500 tokens, 31 blocks)
           |- "Question: Alice..."    (80 tokens, 5 blocks)
           |- "Question: Bob..."      (95 tokens, 6 blocks)
      |- "Context: <doc B>..."        (520 tokens, 33 blocks)
```

Um novo pedido vem com o sistema prompt + "Contexto: <doc A>" + "Question: Carol". O cronista executa: prefixo do sistema coincide (124 blocos reutilizados), doc-A branca coincide (31 blocos reutilizados), então atribui blocos novos apenas para "Question: Carol" (4 blocos). Prefill custo: 4 blocos de novos tokens. Sem a árvore: 160 blocos. ~40x economia em prefill.

### Programação de cache

Reutilização com a base de árvore Radix não tem sentido se o cache se desfechar.

1. **Depth-first dispatch**Quando escolher a próxima solicitação da fila, prefira solicitações enraizadas no mesmo ramo que o conjunto de execução atual. Isso mantém o ramo quente fixado.
2. **LRU at branch level, not block level**. Eliminar ramos inteiros (a partir das folhas mais curtas utilizadas) em vez de blocos individuais, para que a forma do cache coincida com a forma do radix.

Um pedido de compartilhamento de 2.000 tokens fica atrás de um pedido de compartilhamento de 50, e depois a filial de 2.000 tokens é despejada para admitir a de 50.

### Números de referência que você deve memorizar

- Llama 3.1 8B, H100, ShareGPT 1K: SGLang ~ 16.200 tok/s vs vLLM ~ 12.500 (~ 29% vantagem).
- RAG com prefixo pesado (seme sistema + mesmo documento, pergunta variada): até 6,4x no SGLang.
- Cargas de trabalho de clonagem de voz: taxa de acessos de prefixos em cache de 86,4%.
- Taxas de impacto da produção em todos os clientes da SGLang: 50-99% dependendo da disciplina imediata.
- Deployado em 400.000+ GPUs em 2026.

### O pedido te apanhou.

O número 6.4x depende de um pedido consistente de modelo de pedido.`[system, tools, context, history, question]`em alguns pedidos e `[system, context, tools, history, question]`O que parece um prefixo compartilhado para um ser humano são duas sequências distintas para a árvore radíx.

Lever do engenheiro: seu modelo de pedido é uma chave de cache. Fique a ordem. Coloque tudo imutável (sistema, ferramentas, esquemas) em primeiro lugar. Coloque o contexto de recuperação em segundo lugar. Coloque a pergunta do usuário em último lugar. Não deixe conteúdo dinâmico no prefixo.

Caso real da pesquisa: o movimento de conteúdo dinâmico para fora do prefixo cacheável levou uma implantação de 7% para 74% taxa de hits de cache em uma mudança.

### Onde a RadixAttention ganha e perde

Ganhos:
- RAG (seme preâmbulo de recuperação, pergunta variada).
- Agentes (mesmo esquema de ferramentas, consulta variada).
- Chat com o sistema de alargamento.
- Cargas de trabalho de voz/visão com preámbulos repetidos.

Perdas (retorna à capacidade de transmissão a nível vLLM):
- Geração de um só momento com instruções únicas (completo de código, chat aberto sem instrução do sistema).
- Instruções dinâmicas onde cada solicitação interliga conteúdo único no prefixo.

### Por que é um problema de cronograma, não apenas um problema de núcleo

Você pode implementar a reutilização de KV como um truque do kernel. A visão da SGLang é que a reutilização só paga se o cronógrafo mantém o ramo quente residente. Uma política ingênua de "reutilização se disponível" vai fazer o cache sob carga mista. O cronógrafo indexado por árvore radix é o que transforma o truque do kernel em uma vantagem de produção de 29%.

### Interação com o vLLM

Os dois sistemas não são concorrentes estritais.`--enable-prefix-caching`O espaço foi fechado, mas não desapareceu completamente. A pilha inteira do SGLang é radix-first; o vLLM o enxertou. Para cargas de trabalho dominadas pela reutilização de prefixos, o SGLang permanece o padrão. Para serviços de finalidade geral sem padrões de prefixos fortes, o vLLM permanece igual ou melhor.

```figure
roofline
```

## Usá-lo

`code/main.py`Implementa um cache KV de brinquedo radix-tree mais um cronógrafo com duas políticas: FCFS e cache-consciente. Executa a mesma carga de trabalho através de ambos, relata taxa de acidente de prefixo-cache e delta de throughput.

O [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?workload=shared&shared=4096)A máquina mostra o cache de radix em uma execução real L4. quatro grupos cada um têm seu próprio prompt de sistema de tokens 4.096. A primeira solicitação de um grupo calcula seu prompt. Enquanto esse prompt permanece no cache, solicitações posteriores do grupo computam apenas a pergunta de 128 tokens. Desligue o cache de radix para ver a média do primeiro token ir de 479 ms para 14.706 ms.

## Envia-o

Esta lição produz`outputs/skill-radix-scheduler-advisor.md`. Dada uma descrição da carga de trabalho (forma do modelo de solicitação, padrão de recuperação, número de inquilinos simultâneos), produz uma prescrição de solicitação de solicitação e uma indicação de saída para a adopção do SGLang.

## Exercícios

1. Corra .`code/main.py`Comparar FCFS e cache-consciente na mesma carga de trabalho. Onde vem o delta de  pre-fill poupança, decodificação poupança ou atraso na fila?
2. Modificar a carga de trabalho para que as instruções de permuta aleatória `[system, tools, context]`- O que acontece com a taxa de impacto?
3. Calcule o custo do HBM de manter um sistema de 2.000 tokens como um ramo de radix no Llama 3.1 8B. Compare com o custo de um lote de 16 sequências sem reutilização de prefixos.
4. Leia o artigo SGLang RadixAttention. Explique em três frases por que o despejo de LRU em forma de árvore é melhor que o LRU em forma de bloco sob carga pesada de prefixo.
5. Um cliente relata apenas 8% de taxa de cache.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| RadixAttention | "the SGLang thing" | KV cache indexed as a radix tree so shared prefixes reuse blocks |
| Radix tree | "compact trie" | Tree where each node owns a token range and its KV blocks |
| Cache-aware scheduler | "hot-branch-first" | Scheduler that prefers requests sharing the resident branch |
| Prefix-cache hit rate | "how much of your prompt was free" | Fraction of prompt tokens served from reused KV blocks |
| FCFS | "first-come first-served" | Default scheduling that breaks prefix locality |
| Branch-level LRU | "evict the leaf" | Eviction policy matched to radix shape |
| Prompt template ordering | "the cache key" | The prompt's component order determines what the tree can share |
| System prompt pinning | "resident prefix" | Keep the immutable system portion pinned to avoid eviction thrash |

## Mais leitura

- [SGLang GitHub](https://github.com/sgl-project/sglang) fonte e documentos.
- [SGLang documentation](https://sgl-project.github.io/) RadixAttenção e detalhes de programação.
- [SGLang paper — Efficiently Programming Large Language Models (arXiv:2312.07104)](https://arxiv.org/abs/2312.07104) a referência do projecto.
- [LMSYS blog — SGLang with RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) Números de referência e raciocínio do agendador.
- [vLLM — Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) A própria implementação radix-like do vLLM, para comparação.
