# Jamba  Transformador SSM híbrido

> Os modelos espaciais de estado (SSM) e transformadores querem coisas diferentes. Os transformadores compram qualidade através da atenção a um custo quadrático. Os SSM compram inferência de tempo linear e memória constante através de uma recorrência mas qualidade de atraso. Jamba (março de 2024) e Jamba 1.5 (agosto de 2024) da AI21 colocam-nos no mesmo modelo: 1 camada transformadora por cada 7 camadas de Mamba, MoE em cada outro bloco, e uma janela de contexto de 256k que cabem em uma única GPU de 80 GB. Mamba-3 (ICLR 2026) aperta o lado SSM com espaços de estado de valor complexo e projeções MIMO. Esta lição lê ambas as arquiteturas de ponta a ponta e explica por que a receita híbrida sobreviveu a três anos de escalação quando as tentativas de longo contexto de pure-SSM e pure-Transformer não o fizeram.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explicar os três primitivos em um bloco Jamba  camadas transformador, camadas Mamba, MoE  e a receita 1:7: mesmo interleaving.
- Descreva como é que a recorrência de um MSS se apresenta a um nível elevado e por que permite a inferência de memória constante.
- Calcule a pegada de cache KV de um modelo Jamba em contexto de 256k e compare com o que um modelo puro-transformador precisaria.
- Nomear as três inovações Mamba-3 (discretizamento exponencial-trapezoidal, atualização de estado com valor complexo, MIMO) e o problema que cada uma delas visa.

## O problema

A atenção é quadrática em comprimento de sequência. Os modelos de espaço de estado são lineares. Essa diferença é composta: em tokens 256k, um mapa de atenção do transformador é de 65B entradas por cabeça; o estado recorrente de um SSM é de tamanho fixo independentemente do comprimento da sequência.

Os modelos de SSM puros (Mamba, Mamba-2) correspondem à perplexidade do transformador em pequenas escalas, mas ficam atrasados nas tarefas de rastreamento de estado e falham em algumas categorias de recuperação no contexto.

A solução óbvia: usar as duas. Coloque camadas de Transformer onde a recordação exacta importa. Use camadas SSM em outro lugar. Ajustar a relação. Jamba é o primeiro modelo de produção a enviar essa receita híbrida em escala (52B total, 12B ativo, contexto 256k, GPU de 80GB único). Jamba 1.5 estende a família para 398B total / 94B ativo. Mamba-3 (ICLR 2026) é a melhor linha de base de SSM pura atual em torno da qual os híbridos podem ser reconstruídos.

Esta lição lê os três artigos e produz o modelo mental para "escolher a relação certa".

## O conceito

### Um SSM numa página

Um modelo espacial de estado processa uma sequência `x_1, ..., x_N`através de um estado de tamanho fixo `h`- Não .

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

A cada passo , o estado evolui através de uma dinâmica linear .`A`, toma entrada `B x_t`, e emite a saída `C h_t`- Não .`A, B, C`Observe a propriedade crítica: computação`y_t`necessidades só `h_{t-1}`E ...`x_t`Não antes .`x`A memória é constante.$O(1)$por token.

O truque para a qualidade de modelagem é a estrutura de`A`O S4 (Gu 2021) utilizou uma matriz altamente estruturada que podia ser avaliada de forma eficiente como uma longa convolução durante o treinamento.`A, B, C`O Mamba-2 (2024) simplificou ainda mais a estrutura. Mamba-3 (2026) adiciona complexidade em lugares específicos.

A propriedade chave: para um decodificador LLM, uma camada SSM é um substituto drop-in para uma camada de atenção, com estado de tamanho fixo por camada em vez de um cache KV crescente.

### O bloco Jamba

Um bloco Jamba interliga camadas de acordo com dois números:

- `l`A taxa de atenção para a Mamba.`l = 8`, ou seja, 1 camada transformadora por cada 7 camadas de Mamba (7 Mamba + 1 Atenção = 8 camadas por grupo).
- `e`A frequência do MoE.`e = 2`, o que significa que todas as outras camadas aplicam MoE.

A sequência de camadas dentro de um bloco:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Cada bloco Jamba tem 8 camadas. A 4 blocos de profundidade (32 camadas no total), você obtém 28 Mamba e 4 camadas de atenção. 16 delas usam MoE.

### Por que a proporção 1: 7

AI21 executou ablações: qual a relação de atenção-para-Mamba dá a melhor perplexidade-por-parâmetro E recall no contexto em suas avaliações de longo contexto?

- Muito atenção (1:1): a qualidade aumenta, mas a memória e a velocidade degradam.
- Muito pouca atenção (1:15): a memória é ótima mas a recuperação no contexto falha.
- Ponto de estimação: 1:7 ou 1:8.

A intuição: as camadas do Transformer lidam com a recuperação exacta e o rastreamento de estado.

### Codificação de posição

As camadas de Mamba são elas mesmas conscientes de posição (através da recorrência). As camadas de atenção nos híbridos originais baseados em Mamba não usaram RoPE  as camadas SSM forneceram informações de posição. Jamba 1.5 adiciona RoPE às camadas de atenção para generalização de contexto mais longo, um refinamento pós-hoc baseado em avaliação empírica de contexto longo.

### O orçamento de memória

Para uma forma Jamba-1 (32 camadas: 28 Mamba + 4 Atenção, 4096, 32 cabeças de atenção ocultas):

- Caché KV (apenas camadas de atenção): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`O Jamba lançado usa GQA com 8 cabeças de KV nessas camadas, o que leva isso a 4 GB, o número no papel Jamba.
- Estado do MSS: `28 * hidden * state_size`Mas é um tamanho fixo por camada, não escala com o comprimento da sequência.`28 * 4096 * 16 * 2 = 3.7 MB`- Total.

Comparar com um transformador puro em 32 camadas, o mesmo escondido, MHA completo em 32 cabeças: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`A redução de 8x no cache KV. Mesmo em relação à linha de base GQA ((8) a maioria dos modelos 2024 usa (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`), um híbrido 1:7 com 32 cabeças KV em 16 GB é ainda 2 vezes menor.

É o que o AI21 significa por "contexto de 256k em uma única GPU de 80 GB". O cache KV de um transformador puro completo de MHA não caberia; mesmo uma linha de base GQA não deixa espaço para pesos e ativações; o Jamba não.

### Mamba-3: linha de base de MSS puro em 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) introduz três inovações no lado do SSM puro:

1. **Exponential-trapezoidal discretization.**Substitui a discretization do método Euler em Mamba-2 por uma recorrência mais expressiva.`x_t`- Não .

2. **Complex-valued state update.**Mamba-3 adiciona valores complexos  equivalentes a um embebimento rotário dependente de dados no estado. Isso restaura as capacidades de rastreamento de estado que as simplificações anteriores de valor real custaram.

3. **Multi-input multi-output (MIMO) projections.**Em vez de projeções escalares por característica, use projeções com valor de matriz. Melhora a potência de modelagem e a utilização de hardware de tempo de inferência sem aumentar a latência de decodificação.

Em parâmetros 1,5B, Mamba-3 melhora a precisão média no downstream em 0,6 pontos em relação ao Gated DeltaNet; a variante MIMO adiciona 1,2 mais para um ganho total de 1,8 pontos. No mesmo tamanho do estado, Mamba-3 combina Mamba-2 com metade do estado.

O Mamba-3 ainda não está sendo enviado em um híbrido de produção em escala  mas é o candidato óbvio para o lado SSM do próximo modelo Jamba-classe.

### Quando procurar um híbrido

Os híbridos ganham quando:

- O contexto é longo o suficiente para que o cache KV do Transformer puro se torne doloroso (64k+).
- As tarefas misturam a estrutura de curto alcance (favorecida para o SSM) com a recuperação de longo alcance (necessidades de transformador).
- Quer implantar em orçamentos de memória de GPU único onde o cache KV do Transformer sozinho não caberia.

Os híbridos perdem quando:

- O conteúdo é curto (menos de 16k). O custo superior do SSM é desperdiçado; Transformer puro é bom.
- As tarefas necessitam de atenção em todos os lugares (razão profunda, referência cruzada de vários documentos).
- O Pure-Transformer + MLA + MoE (estilo DeepSeek-V3) está ganhando a corrida de capacidade.

### O cenário competitivo

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

A paisagem de 2026: o MoE de transformador puro domina a fronteira, mas os híbridos possuem o nicho de contexto de 256k mais.

```figure
swiglu-ffn
```

## Usá-lo

`code/main.py`É uma calculadora de memória para arquiteturas híbridas. Dada uma relação SSM-Transformer e uma configuração de tamanho oculto / contagem de camadas, ele calcula:

- Caché KV no contexto do alvo.
- Memória de estado SSM.
- Memória total no contexto N para uma gama de formas de modelo.

A calculadora suporta:

- Linha de base de Transformador puro (o cache de KV aumenta com N).
- Híbrido de estilo Jamba 1:7
- Pure-SSM (sem cache de KV).

Os números são diretamente dos artigos Jamba-1 e Jamba-1.5 para formas publicadas e extrapolados para variantes hipotéticas.

Considerações de integração para uma implantação real:

- A maioria dos servidores de inferência de produção (vLLM, SGLang) suporta Jamba e Mamba. Verifique a versão específica.
- No contexto de 256k, a vantagem de memória do Jamba aparece em transferência de solicitação simultânea.
- Mamba-3 como modelo independente ainda não está sendo enviado em produção  pré-visualização de pesquisa em 1.5B.

## Envia-o

Esta lição produz`outputs/skill-hybrid-picker.md`. Tendo em conta a especificação da carga de trabalho (profil de comprimento de contexto, mix de tarefas, orçamento de memória), recomenda entre um transformador puro, um híbrido de estilo Jamba e um SSM puro, com raciocínio explícito sobre a memória e as compensações de qualidade.

## Exercícios

1. Corra .`code/main.py`Para calcular o cache KV em contexto de 256k para um transformador puro de 32 camadas (escondido 4096, 32 cabeças) e para um híbrido Jamba-1 da mesma forma. Verifique a redução de memória ~8x que o papel AI21 afirma.

2. Modifique a calculadora para modelar um híbrido 1:3 (4 Mamba: 1 Atenção) e um híbrido 1:15 (14 Mamba: 1 Atenção).

3. Leia a Seção 3 do artigo Jamba (arXiv:2403.19887). Explique por que a AI21 usa Mamba-1 em vez de Mamba-2 apesar de Mamba-2 ser mais rápido.

4. Calcule o parâmetro de sobrecarga de MoE-cada outra camada no Jamba 1.5 Large (398B total, 94B ativo). Compare a relação ativa com a DeepSeek-V3 (37B/671B) e explique por que a arquitetura do Jamba empurra a relação ativa para cima.

5. Leia a Seção 3 do documento Mamba-3 (arXiv:2603.15569). Explique em três frases por que uma atualização de estado com valor complexo é equivalente a uma incorporação rotativa dependente de dados.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Mais leitura

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) o papel Jamba original, ablações de proporções, alegação de contexto de 256k
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) a família ampliada, 398B/94B e 12B/52B publicações
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) o papel seletivo do MSS sobre o qual Jamba se baseia
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) o sucessor simplificado do espaço-estado estruturado
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) Estado de valor complexo, MIMO, fronteira 2026 de SSM pura
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) o documento S4, ponto de partida da genealogia do MSS para os LLM
