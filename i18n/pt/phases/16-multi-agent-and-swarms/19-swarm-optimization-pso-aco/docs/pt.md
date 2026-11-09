# Otimizar o conjunto de LLM (PSO, ACO)

> A otimização bio-inspirada está a fazer um retorno de LLM. **LMPSO**(arXiv:2504.09247) usa PSO onde a velocidade de cada partícula é um prompt e o LLM gera o próximo candidato; funciona bem em saídas de sequência estruturada (expressões matemáticas, programas). **Model Swarms**(arXiv:2410.11163) trata cada especialista em LLM como uma partícula de PSO num variável de peso de modelo e apresenta relatórios **13.3% average gain**mais de 12 linhas de base em 9 conjuntos de dados com apenas 200 instâncias. **SwarmPrompt**(ICAART 2025) hibrida PSO + Grey Wolf para otimização rápida. **AMRO-S**(arXiv:2603.12933) é especialista em feromônios inspirado em ACO para roteamento de LLM multi-agente  **4.7x speedup**Esta lição implementa o PSO no espaço de parâmetros rápidos e o ACO no roteamento de agentes, mede por que esses algoritmos clássicos se encaixam na era do LLM e quando não.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problemas

Você tem um prompt que marca 62% em sua avaliação de tarefa. Você quer melhorar. O movimento ingênuo é ajustar manual sem gradiente, o que escala mal. A aprendizagem de reforço precisa de sinais de recompensa e implementações suficientes para treinar. Backprop através de prompts não é realmente possível  o prompt é uma cadeia discreta, não um parâmetro diferenciável.

Otimizar bio-inspirado clássico  PSO para espaços de pesquisa contínua, ACO para seleção de caminho  foi projetado exatamente para este regime: livre de gradientes, baseado na população, barato por avaliação.

Os mesmos padrões se aplicam ao agente *routing* em sistemas multi-agentes. Um feromônio de estilo ACO registra o agente que mais funcionou em que tipo de tarefa, permite que o roteador explore o rastro e decompõe feromônios para que as rotas possam ser redescobertas.

## Conceptos

### Refrescador do PSO (Kennedy & Eberhart 1995)

Otimizar o enxame de partículas: população de partículas num espaço de busca contínua.`x_i`e velocidade.`v_i`- Cada iteração:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

Onde ?`p_best`é o melhor da partícula,`g_best`É o melhor do enxame.`w, c1, c2`são a inercia + o cognitivo + os pesos sociais, `r1, r2`são fatores aleatórios.

### OPS sobre resultados de LLM  LMPSO

ArXiv:2504.09247 adapta PSO para saídas estruturadas geradas pela LLM (expressões matemáticas, programas). Cada partícula é uma saída candidata. Velocidade é um *prompt* que descreve como modificar a saída atual para o melhor pessoal / global. O LLM gera a nova saída a partir do prompt de velocidade. A "inertia" da velocidade é um prompt como "fazer pequenas mudanças incrementais".

Isto funciona bem quando:
- A saída é estruturada (percebível, avaliável).
- A forma é automática (teste de corridas, avaliação aritmética).
- A população é pequena (~ 10-30 partículas), por isso as chamadas de LLM totais permanecem gerenciáveis.

Não funciona bem quando a forma física precisa de revisão humana  o custo da per-iteration torna-se proibitivo.

### Modelo de Enxames

O arXiv:2410.11163 tira o PSO da camada de saída para a camada de modelo. Cada "partícula" é um LLM especialista (parâmetros). O enxame move os parâmetros para o melhor coletivo através de uma atualização sem gradiente.

A principal ideia é que os modelos de especialistas em LLM já estão próximos num variável parâmetro compartilhado (pesos de adaptadores, deltas de LoRA).

### Acondicionamento de água (Dorigo 1992)

A melhor forma de fazer uma colônia de formigas é através de um gráfico; cada caminho tem uma trilha de feromônios. As formigas movem as probabilidades de peso por força de feromônios. As formigas que completam a tarefa depositam feromônios proporcionais à qualidade da solução.

### AMRO-S  ACO para encaminhamento de agentes

ArXiv:2603.12933 usa ACO para roteamento multi-agente. Cada tipo de tarefa é um "destino"; cada agente é uma rota possível. Feromônios fortalecem rotas que produzem bons resultados. Contribuições principais:

- **Interpretable routing evidence.**A força feromônica é um sinal legível ao homem.
- **Quality-gated asynchronous update.**As feromônios atualizam-se apenas após a aprovação dos controlos de qualidade, desacoplando a inferência da aprendizagem.
- **4.7x speedup**sobre o indicador de referência de roteamento para vários agentes.

A porta de qualidade importa: sem ela, agentes rápidos mas errados acumulam feromônio, e o sistema bloqueia rotas ruins.

### Quando utilizar PSO/ACO para LLM

**Use PSO when:**
- O espaço de pesquisa é contínuo ou mapeia para parâmetros contínuos (embeddings de prompt, pesos de LoRA, parâmetros de geração numérica).
- A forma física é barata e automática.
- A população pode ser pequena (10-30).

**Use ACO when:**
- Tem um problema de roteamento ou de selecção de caminho.
- As decisões reforçam-se ao longo do tempo (os mesmos tipos de tarefas voltam).
- Precisas de provas interpretáveis para as decisões de roteamento.

**Do not use either when:**
- A aptidão física requer revisão humana (demasiada por iteração).
- O espaço de pesquisa é discreto e combinatório de uma forma que o PSO não cobre (use algoritmos genéticos em vez disso).
- As decisões em tempo real necessitam de uma latença rigorosa (PSO/ACO convergem lentamente em relação às heurísticas de passagem única).

### Por que a bio-inspiração ainda vence

Os métodos baseados em gradientes precisam de sinais diferenciáveis. As saídas do LLM e as decisões de roteamento não são triviais. Os métodos pseudo-gradientes (routers de reforço, sintonizadores de prompt no estilo DPO) funcionam, mas precisam de treinamento caro.

PSO e ACO precisam apenas de uma função de *evaluador* . Se você pode marcar uma saída candidata ou uma decisão de roteamento, você pode otimizar o espaço. Isso torna a barra de aplicabilidade muito menor.

### Limite prático

- **Population budget.**N partículas × T iterações × custo por eval. Para avaliações LLM em ~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20. Planeje em conformidade.
- **Exploration vs exploitation.**A taxa de decomposição feromônica e a inércia do PSO trocam-se; decomposição demasiado rápida → esqueça soluções; muito lenta → pegou em ótimas locais iniciais.
- **Catastrophic drift.**Os dois algoritmos podem convergir e depois divergir se a paisagem de fitness mudar (nova distribuição de dados).

```figure
swarm-stigmergy
```

## Construí-lo

`code/main.py`Implementos:

- `LMPSO` PSO sobre parâmetros de prompt numérico (temperatura, pesos top_k). A "geração LLM" de cada partícula é simulada como uma função de fitness scripted.
- `AMRO_S` Routing de estilo ACO. 3 agentes, 4 tipos de tarefas, matriz feromônica, 100 tarefas enrutadas. Impressões (task_type → opções de agentes) distribuição ao longo do tempo para mostrar a formação de trilha.
- Comparação: roteamento aleatório vs roteamento ACO no mesmo fluxo de tarefas.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Produção esperada:
- LMPSO: g_best fitness melhora de aleatório para quase ótimo em mais de 30 iterações.
- AMRO-S: a tabela de feromonas estabiliza-se no agente certo por tipo de tarefa; o roteamento ACO bate aleatoriamente em ~ 30-40% na qualidade e também reduz a latência (menos retrospectivas).

## Usá-lo

`outputs/skill-swarm-optimizer.md`ajuda a escolher entre PSO, ACO, algoritmos genéticos e optimizadores baseados em gradientes para problemas de otimização de LLM / agente.

## Envia-o

- **Start small.**10-20 partículas, 20 a 50 iterações.
- **Log pheromones or g_best per iteration.**Desembaraçar os optimizadores sem rastro é doloroso.
- **Quality-gate updates.**Especialmente para o encaminhamento ACO: agentes rápidos e errados não devem acumular feromona.
- **Reset decay on distribution shift.**Quando a distribuição da avaliação muda, as feromônios envelhecidos ficam obsoletas; restabeleça ou duplique temporariamente a taxa de decomposição.
- **Cap the per-iteration cost.**Emite uma métrica de custo por iteração. O PSO que custa $500 / iteração e ganha 0,5% não é enviável.

## Exercícios

1. Corra .`code/main.py`Observe a convergência do LMPSO. Dimensão populacional variar 5, 10, 20, 50.
2. Implementar um experimento de "drift catastrófico": após a iteração 30, alterar a função de fitness.`p_best`- Ajuda?
3. Adicionar um gate de qualidade para AMRO-S: depósito de feromônio apenas em corridas com pontuação de avaliação > 0,7. Como isso muda a convergência versus a versão não-gated?
4. Leia LMPSO (arXiv:2504.09247). Mapeia da "velocidade do papel como um prompt" de volta à sua velocidade numérica. O que é perdido na simulação e o que é preservado?
5. Leia AMRO-S (arXiv:2603.12933). Implementar o "caminho rápido de inferência" descoplado com atualização feromônica assíncrona. Como isso muda a latência do sistema sob carga sustentada?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Mais leitura

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) O documento da OPS de 1995
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) 1992 Fundações da ACO
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) OPS para resultados estruturados de MLL
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) PSO no subespaço de peso do modelo
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) Roteamento a base de feromonas com porta de qualidade
