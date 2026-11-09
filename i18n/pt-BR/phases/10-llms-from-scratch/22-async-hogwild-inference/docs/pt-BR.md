# Async e Hogwild!

> A descodificação especulativa (fase 10 · 15) paralela os tokens dentro de uma sequência. Os quadros multi-agentes paralelam-se em sequências inteiras, mas forçam coordenação explícita (voting, sub-task splitting). Hogwild! A Inferência (Rodionov et al., arXiv:2504.06261) faz outra coisa: executa N instâncias do mesmo LLM em paralelo contra um cache de valor de chave SHARED. Cada trabalhador vê instantaneamente os tokens gerados por cada outro trabalhador. Modelos de raciocínio modernos  QwQ, DeepSeek-R1  podem auto-coordenar através desse cache compartilhado sem qualquer ajuste fino. A abordagem é experimental, mas abre um eixo inteiramente novo de paralelismo de inferência que fica ortogonal ao descodificação de especificações. Esta lição implementa um Hogwild de dois trabalhadores! Simulador em stdlib Python e explica por que a colaboração de caché compartilhado emerge das habilidades de raciocínio do modelo existente.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 12 (inference optimization), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva as três topologias comuns paralelas de LLM (voting, subtask, Hogwild!) e nomear quais são os problemas que cada uma delas visa.
- Explique a configuração principal do Hogwild: vários trabalhadores, um cache de KV compartilhado, coordenação emergente através de auto-promulgação.
- Calcule a velocidade do tempo de parede de Hogwild! como função da contagem de trabalhadores `N`, paralelo de nível de tarefa `p`, e despesas gerais de coordenação `c`- Não .
- Implemente um simulador Hogwild! de dois trabalhadores sobre um problema de brinquedo e observe a divisão de tarefas emergente.

## O problema

Os LLM modernos resolvem problemas difíceis produzindo longas cadeias de raciocínio  5000 tokens de lógica passo a passo é comum, dezenas de milhares de tokens acontecem em problemas matemáticos profundos. Em 35 tokens / segundo decodificar em um modelo 70B, 50k tokens é 24 minutos.

A descodificação especulativa (fase 10 · 15) obtém um aumento de velocidade de 3-5x paralela dentro de uma sequência.

A pergunta óbvia é: podemos paralelalizar as sequências? executar várias cópias do mesmo modelo no mesmo problema, deixá-los cooperar, fazer-lhes dividir o trabalho?

Trabalho anterior: conjuntos de votação (exercer modelos N, escolher a resposta da maioria), árvore de pensamento (caminhos de raciocínio e recombinância), e quadros multi-agente (assignar a cada agente uma subtarefa, usar um coordenador).

Hogwild! A inferência adota uma abordagem diferente. Os trabalhadores N compartilham um único cache KV. Cada trabalhador vê imediatamente os tokens gerados por cada outro trabalhador, como se fossem o seu próprio contexto. Os trabalhadores  sem qualquer formação ou ajuste preciso  descobrir como dividir o trabalho. Modelos modernos de raciocínio (QwQ, DeepSeek-R1, modo de raciocínio Claude-família) podem ler o cache compartilhado e dizer coisas como "Vejo que o trabalhador 2 já lidou com o caso base, então vou trabalhar no passo indutivo".

A aceleração é dependente da carga de trabalho e experimental a partir de abril de 2026. Mas a ideia vale a pena saber porque abre um novo eixo de paralelismo de inferência.

## O conceito

### A configuração

Iniciar N processos de trabalhadores, todos executando o mesmo LLM. Em vez de caches KV por trabalhador, manter um caché compartilhado.`i`gera token `t_j`O token é escrito no cache compartilhado na posição seguinte.`k`Quando o sistema de dados de N é executado, ele lê o estado actual do cache (que inclui tudo o que todos os trabalhadores N têm gerado até agora).

No tempo de passo, os trabalhadores correm para escrever tokens. Não há índice de posição por trabalhador.

### Por que surge a coordenação

Os trabalhadores compartilham uma indicação. Normalmente algo como "Você é uma das N instâncias trabalhando juntos neste problema. Cada instância lê a memória compartilhada e pode ver o que outras instâncias escreveram. Evite o trabalho redundante". O prompt e o cache compartilhado são suficientes. Os modelos de raciocínio lêem o cache, notam quais partes do problema já foram tentadas e (muitas vezes, mas nem sempre) se voltam para partes não exploradas.

O artigo Hogwild! (Rodionov et al., 2025) relata observações como:

- Os trabalhadores formulaem planos e os comunicam a outros trabalhadores através do cache.
- Os trabalhadores notam erros no raciocínio dos outros trabalhadores e os denunciam.
- Os trabalhadores adaptam-se quando um plano falha e propõem alternativas.
- Quando solicitados a verificar se há demissão, os trabalhadores detectam e giram.

O comportamento emergente vem das capacidades de raciocínio que o modelo já possui.

### A nomeação

O nome do artigo deriva de Hogwild! SGD (Recht et al., 2011), um optimizador de atualização assíncrona. A analogia: os trabalhadores assíncronos da SGD todos escrevem para um vetor de parâmetros compartilhado; Hogwild! Os trabalhadores da Inferência todos escrevem para um cache KV compartilhado. Ambos dependem de convergência empírica em vez de garantias de sincronização.

### A RoPE torna isto tratável

Embedamentos de posição rotativa (RoPE, Su et al. 2021) codificar informações de posição através de rotação nos vetores Q e K. Como a pontuação de atenção entre uma consulta rotada e uma chave rotada depende apenas de sua distância relativa, um bloco inteiro de entradas em cache pode mudar para um novo offset sem recomputamento: gire a consulta em vez de voltar a rotear cada chave em cache. Hogwild! Inference faz isso uma vez por bloco de cache: para uma consulta em posição `i_q`e um bloco que começa em`i_k`A questão é rotada pela distância relativa.`i_q - i_k`É assim que cada trabalhador vê os blocos de cache compartilhados em sua própria ordem. O truque funciona para uma mudança uniforme de um bloco contíguo. Movendo tokens individuais para posições diferentes mudaria suas rotações e ainda precisa de recomputada.

Em um modelo de posição aprendida ou posição absoluta, Hogwild! precisaria de invalidação do cache em cada escrita simultânea.

### Matemática do tempo da parede

Deixe-me .`T_serial`O Conselho Europeu de Ministros dos Negócios Estrangeiros, em nome da Comissão, propõe que a Comissão adopte um novo regulamento que permita que a Comissão adopte medidas adequadas para a aplicação da legislação comunitária.`p`seja a fração paralelavel do nível da tarefa.`c`ser o custo de coordenação por etapa (leia o cache alargado, decide o que escrever).

Tempo de trabalho sem empregado: `T_serial`- Não .
N-trabalhador Hogwild! tempo, se a coordenação é livre: `T_serial * ((1 - p) + p / N)`- Um clássico Amdahl.
Com despesas gerais de coordenação: `T_serial * ((1 - p) + p / N) + c * steps_per_worker`- Não .

Para um trabalhador ser produtivo,`c`Os modelos de raciocínio que produzem tokens 5k+ podem permitir centenas de tokens de coordenação e ainda assim sair à frente. Em tarefas de chat curtas, a coordenação domina e Hogwild! é pior do que a série.

### Exemplo concreto

Problemas de raciocínio: 10 mil tokens de cadeia de pensamento.`p = 0.7`Os resultados da análise de casos são comparáveis com os resultados dos resultados da análise de casos.`c = 200`- a taxa de coordenada de despesas gerais por trabalhador.`N = 4`trabalhadores:

- Tempo de série: 10000 passos de decodificação.
- Tempo Hogwild: 10000 * (0,3 + 0,7 / 4) + 200 * 4 = 10000 * 0,475 + 800 = 5550 passos de decodificação.
- A velocidade: 10000 / 5550 = 1,8x.

Isso é modesto. Mas em problemas de raciocínio mais longos (50k tokens), a coordenação sobrecarga amortiza e a aceleração empurra 2,5-3x. Hogwild! é o equivalente de inferência de paralelismo de nível de fio em uma linguagem que permite que você escreva código multi-threaded naturalmente.

### Quando chegar a Hogwild!

- Problemas de raciocínio longo (milhares de tokens) onde a tarefa pode ser paralela em sub-objetivos independentes.
- Modelos racionais que foram treinados para pensar passo a passo.
- Implementações de um único nó com VRAM suficiente para manter o cache compartilhado mais N processos de trabalhador. O cache é compartilhado, mas cada trabalhador tem sua própria memória de ativação.

### Quando não

- Um breve chat interativo, a coordenação domina.
- As tarefas que não se paralelam (prova linear única, compilação única). N = 1 é o máximo.
- Modelos não racionais, não surge coordenação.
- Multi-nodo implementações. O cache compartilhado precisa de sincronização de trabalhadores cruzados muito rápido. Intra-node é bom; cross-node é um desastre de latência.

### O estado experimental

A partir de abril de 2026, Hogwild! é um método de pesquisa com uma implementação PyTorch de código aberto.

1. A gestão compartilhada de cache KV em processos simultâneos é engenharia não trivial.
2. A coordenação emergente depende da tarefa; ainda estão a ser construídos referências.
3. Os speedups são modestos em comparação com o que a descodificação especulativa já oferece, e os dois podem ser combinados, mas a engenharia combinada é outra camada.

Vale a pena saber, vale a pena experimentar, ainda não vale a pena apostar num produto.

```figure
continuous-batching
```

## Construí-lo

`code/main.py`Implementa um simulador Hogwild!

- Dois processos de trabalhador, cada um um um "LLM" determinista que produz uma das várias categorias de tokens (tokens de trabalho, tokens de observação, tokens de coordenadas) com probabilidades conhecidas.
- Um cache compartilhado (apenas uma lista de tokens) que ambos os trabalhadores leem e escrevem.
- Uma lógica de coordenação simples: quando um trabalhador vê que o outro já produziu suficientes tokens de trabalho numa categoria, ele escolhe uma categoria diferente.

O simulador funciona com um orçamento fixo de etapas e informa:

- Total de tokens de trabalho produzidos.
- Tempo total de parede (número de passos do trabalhador).
- A velocidade efetiva sobre um único trabalhador.
- Um rastro de qual trabalhador escreveu qual símbolo.

### Passo 1: o cache compartilhado

Uma lista que os dois trabalhadores se anexam.`threading.Lock`) numa implementação real; simulamos com um contador.

### Passo 2: o ciclo de trabalho

Cada trabalhador, em cada passo:

- Leia o cache compartilhado atual.
- Decide qual categoria de token escrever com base no que já existe.
- Escreve um token.

### Passo 3: a heurística de coordenação

Se a categoria X já tem tokens K no cache e a categoria pretendida do trabalhador é X, o trabalhador muda para a categoria Y. Este é um brinquedo substitutivo para o comportamento do modelo de raciocínio de "observe que isso já está coberto, faça algo diferente em vez disso".

### Passo 4: aceleração medida

A simulação deve ser executada com um trabalhador N=1 e com um trabalhador N=2, com o mesmo orçamento total de etapas.

### Passo 5: enfatizar a coordenação

Reduzir a sensibilidade da heurística de coordenação. Refazer. Observe que sem uma boa coordenação, N=2 produz redundantemente os mesmos tokens e a aceleração cai abaixo de 1.

## Usá-lo

A integração do Hogwild! na produção a partir de abril de 2026 é de nível de pesquisa. A implementação de referência do Yandex/HSE/IST é baseada em PyTorch e visa configurações de múltiplos processos de um único nó nos modelos DeepSeek-R1 e QwQ.

Caminho de adoção pragmática:

1. Profile a sua carga de trabalho de raciocínio. Messa a fração de tokens que são exploratórios (múltiplas estratégias, análises de casos, pesquisa) versus lineares.
2. Se a exploração dominar, faça um experimento Hogwild! com dois trabalhadores.
3. Se a melhoria for inferior a 1,3x, você está no regime de coordenação dominada.
4. Se a melhoria for superior a 1,5x, empurre para N=4 e mensure novamente.

Combine com decodificação especulativa: cada trabalhador de Hogwild! pode usar de forma independente o decodificação de especificações. Os dois aceleradores se multiplicam (aproximadamente), levando uma decodificação de especificações de 3x e Hogwild! de 1,8x a uma decodificação eficaz de 5,4x em relação à simples descodificação de trabalhador ingênuo.

## Envia-o

Esta lição produz`outputs/skill-parallel-inference-router.md`- Tendo em conta um perfil de carga de trabalho de raciocínio (orçamento de tokens, perfil de paralelo de tarefas, família de modelos, objetivo de implantação), ele percorre entre as estratégias de votação, árvore de pensamento, multi-agente, Hogwild! e de descodificação especulativa.

## Exercícios

1. Corra .`code/main.py`Confirme que a configuração N=2 Hogwild! produz mais tokens de trabalho do que a linha de base N=1 no mesmo tempo de parede.

2. Reduzir a força da heurística de coordenação (seto `coordination_weight=0.1`Re-exercício. Mostre que a aceleração desmorona. Explique por que: os trabalhadores duplicam o esforço quando não conseguem coordenar.

3. Calcule a velocidade esperada de Hogwild! para uma tarefa de raciocínio de 50k tokens com `p=0.8, c=500`Faça o mesmo para uma tarefa de bate-papo de 1k-token com `p=0.3, c=200`E N=4. Por que um é uma vitória e o outro uma perda?

4. Leia a secção 4 (avaliação preliminar) do artigo Hogwild! Identifique os dois modos de falha relatados pelos autores.

5. Combine Hogwild! com a descodificação especulativa no brinquedo: cada trabalhador usa um decodificação de especificação de 2 tokens internamente. Relate o aceleramento multiplicativo. Que problema de contabilidade surge quando dois trabalhadores ambos querem estender o mesmo prefixo de caché compartilhado?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hogwild! | "Parallel workers, shared cache" | N instances of the same LLM running concurrently with one shared KV cache; emergent coordination via self-prompting |
| Shared KV cache | "The coordination medium" | A single growing KV buffer that all workers read and write; enables instant token visibility across workers |
| Emergent coordination | "No training needed" | Reasoning-capable LLMs can read the shared cache and divide work without any fine-tuning or explicit protocol |
| Coordination overhead (c) | "Tokens spent orienting" | The per-worker cost of reading the extended cache and deciding what to do; must stay small vs total decode time |
| Parallelizable fraction (p) | "What can run in parallel" | Task-level parallelism: the fraction of the total work that is not intrinsically sequential |
| RoPE enables Hogwild! | "Rotary positions are shift-invariant" | Because positions are rotations, writing into a shared cache does not require recomputing prior tokens |
| Voting ensemble | "Run N, pick the majority" | The simplest parallel inference topology; useful for classification, less for long-form reasoning |
| Tree of thought | "Branch and prune" | Reasoning strategy that explores multiple branches and prunes; explicit coordination logic |
| Multi-agent framework | "Assign sub-tasks" | Each agent gets a role; a coordinator orchestrates; heavy protocol overhead |

## Mais leitura

- [Rodionov et al. — Hogwild! Inference: Parallel LLM Generation via Concurrent Attention (arXiv:2504.06261)](https://arxiv.org/abs/2504.06261) o artigo Hogwild!, avaliação preliminar sobre QwQ e DeepSeek-R1
- [Recht, Re, Wright, Niu — Hogwild!: A Lock-Free Approach to Parallelizing Stochastic Gradient Descent (arXiv:1106.5730, NeurIPS 2011)](https://arxiv.org/abs/1106.5730) o original Hogwild!, a origem do nome
- [Su et al. — RoFormer: Enhanced Transformer with Rotary Position Embedding (arXiv:2104.09864)](https://arxiv.org/abs/2104.09864) RoPE, a propriedade que torna tratável a inferência de caché compartilhado
- [Yao et al. — Tree of Thoughts: Deliberate Problem Solving with Large Language Models (arXiv:2305.10601)](https://arxiv.org/abs/2305.10601)A estratégia de raciocínio de árvore de pensamento Hogwild!
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) descodificação especulativa, o paralelismo dentro da sequência Hogwild! compõe com
- [Hogwild! reference PyTorch implementation](https://github.com/eqimp/hogwild_llm) a única fonte de verdade para as experiências do jornal
