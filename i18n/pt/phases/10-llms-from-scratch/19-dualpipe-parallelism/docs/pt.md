# Paralelo de DualPipe

> O DeepSeek-V3 foi treinado em 2.048 GPUs H800 com especialistas em MoE espalhados por nós. O perito de comunicação trans-nodo custa uma hora de comunicação por cada hora de computação. As GPUs estavam inactivas metade do tempo. DualPipe (DeepSeek, Dec 2024) é um pipeline bidirecional que se sobrepõe computação para frente e para trás com as comunicações todos-a-todos que eles desencadeiam. A queda de bolhas, o aumento de rendimento e a manutenção de duas cópias de parâmetro do modelo (o "dual" que dá o nome) é barata uma vez que o Expert Parallelism já está espalhando especialistas entre as fileiras de qualquer maneira. Esta lição é um passo-a-passo do tipo Aprenda sobre o que a DualPipe realmente faz e por que o refinamento da Sea AI Lab em DualPipeV reduz o custo dos parâmetros 2x às custas de uma bolha marginalmente mais apertada.

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator), Rust
**Prerequisites:** Phase 10 · 05 (distributed training, FSDP, DeepSpeed), Phase 10 · 14 (open-model architectures and MoE)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear os quatro componentes de um pedaço DualPipe para frente e para trás e por que cada um tem sua própria janela de sobreposição.
- Explique o problema da bolha de pipeline em escala e o que significa "sem bolhas" na prática versus no marketing.
- Rastrear um cronograma DualPipe à mão para 8 fileiras de PP e 16 micro-batches e confirmar os fluxos para frente e para trás preencher os espaços ociosos um do outro.
- Explique a compensação que o DualPipeV (Sea AI Lab, 2025) faz: deixa cair a replicação de parâmetros 2x ao custo de uma bolha ligeiramente maior quando o Expert Parallelism está inativo.

## O problema

Treinar um modelo 671B MoE em GPUs H800 2k entra em três gargalos de engarrafamento:

1. **Memory pressure.**Cada GPU tem uma fatia do modelo. A memória de ativação em sequência 8k em 61 camadas em 128 cabeças é enorme.
2. **Pipeline bubbles.**O paralelismo tradicional de pipeline (GPipe, 1F1B) deixa as GPUs inativas enquanto esperam a entrada ou gradiente de seu estágio. Em 8 estágios, cerca de 12% do tempo da GPU pode ser bolha mesmo com a programação 1F1B.
3. **Cross-node all-to-all.**O MoE com paralelismo especialista espalha especialistas por todos os nós. Cada passagem avançada desencadeia um todo-a-todo para enviar tokens para seus especialistas e outro para combinar. Em GPUs de 2k isso facilmente se torna uma relação computação-comm 1:1.

Cada uma delas tem soluções separadas: ponto de verificação de gradiente para memória, Zero Bubble (Sea AI Lab, 2023) para bolhas de pipeline, kernels de comunicação paralelas para todos. O que o DualPipe faz é fazê-los tocar juntos. O cronograma sobrepõe computação e comunicação dentro de um único pedaço para frente e para trás, injeta micro-partidas de ambas as extremidades do tubo simultaneamente e usa o cronograma resultante para esconder tudo dentro das janelas de computação.

Resultado relatado: quase eliminação de bolhas de pipeline, mais de 95% de utilização de GPU no treinamento de tokens de DeepSeek-V3 de 14,8T.

## O conceito

### Refrescar o paralelismo dos oleodutos

Dividir um modelo de camada N em dispositivos P. Dispositivo `i`mantém camadas `i * N/P .. (i+1) * N/P - 1`. Um micro-batch flui para a frente através dos dispositivos 0 a P-1, e depois para trás a partir de P-1 a 0. Cada dispositivo só pode iniciar a sua fase para a frente quando o dispositivo anterior envia a sua saída e só pode começar para trás quando o dispositivo a jusante envia o gradiente ascendente.

O GPipe (Huang et al., 2019) agenda um micro-batch por vez, o que desperdiça a maior parte do tempo da GPU. O 1F1B (Narayanan et al., 2021) interliga passes para frente e para trás para vários micro-partidos. A Bubble Zero (Qi et al., 2023) divide a passagem para trás em duas partes  para trás-para-entrada (B) e para trás-para-pesos (W)  e agenda-os para preencher a bolha. Depois da bolha Zero, o oleoduto está quase apertado.

O DualPipe é o próximo passo.

### Ideia 1: decomposição em pedaços

Cada peça à frente é dividida em quatro componentes:

- **Attention.**Projeções Q/K/V, atenção, projeção de saída.
- **All-to-all dispatch.**Comunicação transnacional que envia sinais aos seus especialistas.
- **MLP.**O cálculo do especialista do Ministério da Educação.
- **All-to-all combine.**Comunicação transnacional que traz resultados de especialistas de volta.

Um pedaço para trás adiciona versões de gradiente de cada um destes. DualPipe agendá-los de modo que o despacho de tudo para tudo ocorra em paralelo com o cálculo da atenção do pedaço seguinte, e o combinar tudo para tudo ocorre em paralelo com o cálculo MLP do pedaço seguinte.

### Ideia 2: programação bidireccional

A maioria dos cronogramas de oleodutos injeta micro-parches a partir do estágio 0 e fluem para o estágio P-1. DualPipe injeta micro-parches a partir de ambas as extremidades.

Para que isto funcione, dispositivo.`i`Deve manter ambas as camadas de tubo inicial `i`E a camada de tubo final.`P - 1 - i`. Essa é a parte "dual" da DualPipe: cada dispositivo mantém duas cópias das camadas de modelo que precisa servir (uma para cada direção). Na escala do DeepSeek-V3, este é um custo de replicação de parâmetros 2x. É acessível porque o Expert Parallelism já espalha os especialistas do MoE tão finos que replicar as camadas não-expertas duas vezes é uma pequena batata.

Crucialmente, o fluxo para frente em uma direção e o fluxo para trás na outra direção se sobrepõem exatamente onde as bolhas estariam num cronograma de uma direção.

### Um cronograma rastreado à mão

Considere P = 4 filetes, 8 micro-partidas, divididas 4 para frente / 4 para trás. O tempo se move de esquerda para direita; filetes são filetes de dispositivos.

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

Lendo a notação "F4/F5R": o rank 1 está a avançar para o micro-batch 4 ( indo de esquerda para direita no pipeline) E para a frente do micro-batch 5 ( indo de direita para esquerda) no mesmo intervalo de tempo.

Na posição 2 os fluxos cruzados se sobrepõem mais cedo, na posição 0 e P-1 eles se sobrepõem mais tarde. Na fase média estável do cronograma, cada posição corre para a frente de X-direção sobrepondo-se com para trás de Y-direção. O cálculo está ocupado.

### Contabilidade de bolhas

Bolha de condutores padrão 1F1B (tempo desperdiçado por categoria):

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

O refinamento de bolhas zero leva-o para baixo, mas não para zero. DualPipe, na fase estável, tem bolha zero se a contagem de micro-batches for divisível por 2 vezes a profundidade do tubo. Fora da fase estável (calentamento e resfriamento), há alguma bolha, mas não cresce com o número de micro-batches  uma propriedade chave que o papel destaca.

Em termos de marketing: "sem bolhas". Em termos técnicos: bolhas não crescem com a contagem de micro-parcelas. A análise de acompanhamento do Sea AI Lab (DualPipeV / Cut-in-half) mostra a bolha zero completa somente quando o Expert Parallelism não é o gargalo de engarrafamento; com o EP-driven all-to-all, algum compromisso de agendamento está sempre presente.

### DualPipeV  o refinamento

Sea AI Lab (2025) observou que a replicação de parâmetros 2x é desperdiçosa quando a sobreposição de comunicações EP não é o ponto. O seu cronograma DualPipeV dobra a injecção bidirecional em um cronograma "de forma V" que funciona com uma única cópia de parâmetro. A bolha é um pouco maior que a DualPipe, mas a economia de memória é substancial. A DeepSeek adotou o DualPipeV em sua implementação de código aberto DualPipe como um modo de EP-off.

O compromisso:

| Feature | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| Param copies per device | 2 | 1 | 1 | 1 |
| Bubble vs micro-batches | constant | small growth | grows | grows |
| Compute-comm overlap | full | partial | minimal | partial |
| Use when | EP-heavy MoE | dense or EP-light | baseline | any pipeline |

### O que significa para uma corrida de tokens de 14,8T

O pré-treinamento do DeepSeek-V3 consumiu 14.8T de tokens em 2.048 GPUs H800 em aproximadamente 2,8 milhões de horas de GPU. Com 1F1B ingênuo, teriam perdido 12-15% disso para bolhas de tubo  340-420K GPU-hora, o suficiente para treinar um modelo completo de 70B. O DualPipe recuperou a maior parte disso. Quantificar diretamente a contribuição é difícil sem os registros internos, mas a afirmação no artigo é de mais de 95% de utilização de GPU em média em todo o treinamento.

Para corridas menores (menos de 1k GPUs), DualPipe é exagerado  bolhas de pipeline são menores em relação ao custo total, e o treinamento de modelo denso raramente atinge o gargalo de engarrafamento.

### Onde fica na pilha

- Complementar a **FSDP**(Fase 10 · 05). FSDP reduz os parâmetros do modelo em filas; DualPipe agenda o cálculo em filas.
- Compativel com **ZeRO-3**A contabilidade para a replicação de duas cópias precisa cooperar com os gradientes fragmentados do ZeRO.
- Requer**custom all-to-all kernels**Os kernels de código aberto do DeepSeek são a implementação de referência.

```figure
expert-capacity
```

## Usá-lo

`code/main.py`É um simulador de cronograma de pipeline.`(P, n_micro_batches, schedule)`O sistema de produção de energia de alta velocidade é um sistema de ensino que permite a utilização de uma fase estável para cada um dos sistemas 1F1B, Zero Bubble, DualPipe e DualPipeV.

O valor do simulador: executá-lo com diferentes contagens de P e micro-batches e observe como a fração da bolha cresce para 1F1B, mas não para DualPipe.

Considerações de integração para uma formação real:

- Escolha uma profundidade paralela ao pipeline que se divide claramente em sua contagem de micro-batches.
- Certifique-se de que a sua malha paralela de especialistas suporta tudo-a-todo bidirecional.
- Espera que a primeira vez que o fizeres, queiras uma semana de tempo de depuração no próprio cronograma.
- Monitore a utilização da GPU por classificação, não apenas agregada.

## Envia-o

Esta lição produz`outputs/skill-dualpipe-planner.md`. Tendo em conta a especificação do cluster de formação (contagem de GPU, topologia, interconexão, forma do modelo), recomenda uma estratégia de paralelismo de canais, o algoritmo de programação a utilizar e a fração de bolhas esperada na escala-alvo.

## Exercícios

1. Corra .`code/main.py`- Não .`(P=8, micro_batches=16, schedule=dualpipe)`E ...`(P=8, micro_batches=16, schedule=1f1b)`Calcule a diferença de utilização da GPU e expresse-a como horas de GPU recuperadas por milhão de tokens de treinamento.

2. Esboçar a tabela de horário para `(P=4, micro_batches=8, schedule=dualpipe)`Marque cada espaço horário com a identificação e direcção do micro lote. Identifique o primeiro espaço horário onde as bolhas estão ausentes.

3. Leia a Figura 5 do relatório técnico do DeepSeek-V3 (arXiv:2412.19437). Identifique a janela de sobreposição para o despacho de todos para todos dentro de um pedaço de DualPipe para a frente. Explique como o cronograma de computação o esconde.

4. Calcule o custo de 2x do parâmetro de DualPipe para um modelo denso de 70B com estágios de oleoduto P=8 e um modelo de MoE de 671B com estágios de oleoduto P=16. Mostre por que o custo de um caso de MoE é proporcionalmente menor (a maioria dos parâmetros são especialistas, divididos em um grande grupo de EP).

5. Compare DualPipe com Chimera (um agendador bidirecional concorrente a partir de 2021). Identifique as duas propriedades específicas que DualPipe acrescentou que a Chimera não tinha, usando a Seção 3.4 do papel como referência.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Pipeline bubble | "Idle time per rank" | GPU cycles wasted because a pipeline stage is waiting for its input or gradient |
| 1F1B | "Default pipeline schedule" | One forward / one backward interleaved scheduling; the baseline DualPipe beats |
| Zero Bubble | "Sea AI Lab 2023" | Splits backward into B (input gradient) and W (weight gradient); almost fully tightens the pipeline |
| DualPipe | "DeepSeek-V3 schedule" | Bidirectional pipeline + compute-comm overlap; bubbles do not grow with micro-batch count |
| DualPipeV | "Cut-in-half" | V-shape refinement that drops the 2x parameter replication at the cost of slightly larger bubbles |
| Chunk | "Unit of pipeline work" | A forward or backward pass of one micro-batch through one pipeline stage |
| All-to-all dispatch | "Send tokens to experts" | Cross-node comm that routes tokens to their assigned MoE experts |
| All-to-all combine | "Bring expert outputs back" | Cross-node comm that gathers expert outputs after the MLP |
| Expert Parallelism (EP) | "Experts across GPUs" | Shards MoE experts across ranks so different GPUs hold different experts |
| Pipeline Parallelism (PP) | "Layers across GPUs" | Shards model layers across ranks; the dimension DualPipe schedules |
| Bubble fraction | "Wasted GPU time" | (bubble_time / total_time); the fraction DualPipe drives toward zero |

## Mais leitura

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) a referência principal de DualPipe
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) a implementação de referência de código aberto, incluindo o modo DualPipeV (Cut-in-half)
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) O antecessor da Bolha Zero
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) a análise DualPipeV que informou o modo de desativação do EP da DeepSeek
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) o calendário 1F1B comparado com o DualPipe
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) o problema original de paralelismo de papel e bolha
