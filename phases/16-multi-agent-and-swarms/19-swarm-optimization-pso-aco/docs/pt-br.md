# Otimização Swarm para LLMs (PSO, ACO)

> Otimização bio-inspirada está voltando para LLMs. **LMPSO** (arXiv:2504.09247) usa PSO onde a velocidade de cada partícula é um prompt e o LLM gera o próximo candidato; funciona bem em saídas de sequência estruturada (expressões matemáticas, programas). **Model Swarms** (arXiv:2410.11163) trata cada expert LLM como uma partícula PSO em um manifold de pesos do modelo e reporta **ganho médio de 13.3%** sobre 12 baselines em 9 datasets com apenas 200 instâncias. **SwarmPrompt** (ICAART 2025) hibridiza PSO + Grey Wolf para otimização de prompts. **AMRO-S** (arXiv:2603.12933) é ACO inspirado em feromônio para routing multi-agente — **speedup de 4.7x**, evidência de routing interpretável, atualização assíncrona com gate de qualidade que desacopla inferência de aprendizado. Esta aula implementa PSO no espaço de parâmetros do prompt e ACO no routing de agents, mede por que esses algoritmos clássicos se encaixam na era dos LLMs, e quando não se encaixam.

**Tipo:** Aprender + Construir
**Idiomas:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 09 (Redes Swarm Paralelas), Fase 16 · 14 (Consenso e BFT)
**Tempo:** ~75 minutos

## Problema

Você tem um prompt que pontua 62% na sua avaliação. Quer melhorar. O movimento ingênto é ajustar manualmente sem gradiente, o que não escala. Aprendizado por reforço precisa de sinais de recompensa e de rollouts suficientes pra treinar. Backpropagation por prompts não é realmente possível — o prompt é uma string discreta, não um parâmetro diferenciável.

A otimização bio-inspirada clássica — PSO para espaços de busca contínuos, ACO para seleção de caminhos — foi projetada exatamente pra esse regime: sem gradiente, baseada em população, barata por avaliação. Combine com LLMs pro passo de busca sem gradiente e você consegue um otimizador surpreendentemente prático.

Os mesmos padrões se aplicam ao *routing* de agents em sistemas multi-agente. Uma trilha de feromônio no estilo ACO registra qual agent funcionou melhor em qual tipo de tarefa, permite ao router explorar a trilha e decai o feromônio pra que rotas possam ser redescobertas.

## Conceito

### Revisão de PSO (Kennedy & Eberhart 1995)

Otimização por Enxame de Partículas: população de partículas em um espaço de busca contínuo. Cada partícula tem posição `x_i` e velocidade `v_i`. A cada iteração:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
atualiza p_best_i se melhorou
atualiza g_best se é o melhor global
```

Onde `p_best` é o melhor da própria partícula, `g_best` é o melhor do enxame, `w, c1, c2` são pesos de inércia + cognitivo + social, `r1, r2` são fatores aleatórios.

### PSO em saídas de LLM — LMPSO

arXiv:2504.09247 adapta PSO para saídas estruturadas geradas por LLM (expressões matemáticas, programas). Cada partícula é uma saída candidata. A velocidade é um *prompt* que descreve como modificar a saída atual em direção ao melhor pessoal/global. O LLM gera a nova saída a partir do prompt de velocidade. A "inércia" da velocidade é um prompt tipo "faça mudanças incrementais pequenas".

Isso funciona bem quando:
- A saída é estruturável (parseável, avaliável).
- Fitness é automático (execução de testes, avaliação aritmética).
- População é pequena (~10-30 partículas) pra manter o total de chamadas ao LLM gerenciável.

Não funciona bem quando o fitness precisa de revisão humana — o custo por iteração fica proibitivo.

### Model Swarms

arXiv:2410.11163 tira PSO da camada de saída e coloca na camada de *modelo*. Cada "partícula" é um expert LLM (parâmetros). O enxame move os parâmetros em direção ao coletivo melhor via atualização sem gradiente. Reportado: ganho médio de 13.3% sobre 12 baselines em 9 datasets, com apenas 200 instâncias por iteração.

A chave é que modelos expert LLM já estão próximos em um manifold de parâmetros compartilhado (pesos de adapter, deltas LoRA). PSO neste subespaço dimensional baixo é barato e efetivo.

### Revisão de ACO (Dorigo 1992)

Otimização por Colônia de Formigas: formigas percorrem um grafo; cada caminho tem uma trilha de feromônio. As probabilidades de movimento ponderam pela força do feromônio. As formigas que completam a tarefa depositam feromônio proporcional à qualidade da solução. O feromônio decai ao longo do tempo.

### AMRO-S — ACO para routing de agents

arXiv:2603.12933 usa ACO para routing multi-agente. Cada tipo de tarefa é um "destino"; cada agent é uma rota possível. Feromônios fortalecem rotas que produzem boas saídas. Contribuições principais:

- **Evidência de routing interpretável.** Força do feromônio é um sinal legível por humanos.
- **Atualização assíncrona com gate de qualidade.** Feromônios atualizam só depois que verificações de qualidade passam, desacoplando inferência de aprendizado.
- **Speedup de 4.7x** no benchmark de routing multi-agente.

O gate de qualidade importa: sem ele, agents rápidos-mas-errados acumulam feromônio e o sistema trava em rotas ruins.

### Quando usar PSO / ACO para LLMs

**Use PSO quando:**
- Espaço de busca é contínuo ou mapeia para parâmetros contínuos (embeddings de prompt, pesos LoRA, parâmetros numéricos de geração).
- Fitness é barato e automático.
- População pode ser pequena (10-30).

**Use ACO quando:**
- Você tem um problema de routing ou seleção de caminhos.
- Decisões se reforçam ao longo do tempo (mesmos tipos de tarefa voltam).
- Você precisa de evidência interpretável pra decisões de routing.

**Não use nenhum quando:**
- Fitness requer revisão humana (cara demais por iteração).
- Espaço de busca é discreto e combinatório de um jeito que PSO não cobre (use algoritmos genéticos).
- Decisões em tempo real precisam de latência estrita (PSO/ACO convergem devagar comparado a heurísticas de passo único).

### Por que bio-inspirado ainda vence

Métodos baseados em gradiente precisam de sinais diferenciáveis. Saídas de LLM e decisões de routing não são trivialmente diferenciáveis. Métodos de pseudo-gradiente (routers aprendidos por reforço, tuners de prompt no estilo DPO) funcionam mas precisam de treinamento caro.

PSO e ACO precisam apenas de uma função *evaluator*. Se você consegue pontuar uma saída candidata ou uma decisão de routing, consegue otimizar sobre o espaço. Isso barateia bastante a barra de aplicabilidade.

### Limites práticos

- **Orçamento de população.** N partículas × T iterações × custo por avaliação. Pra avaliações de LLM a ~$0.02/chamada, um PSO de 20 partículas rodando 50 iterações custa ~$20. Planeje de acordo.
- **Exploração vs exploração.** Taxa de decaimento de feromônio e inércia do PSO fazem trade-off; decaimento rápido → esquece soluções; devagar → fica preso em ótimos locais precoces.
- **Deriva catastrófica.** Ambos algoritmos podem convergir e depois divergir se o landscape de fitness mudar (nova distribuição de dados). Monitore a estabilidade do melhor fitness.

## Construir

`code/main.py` implementa:

- `LMPSO` — PSO sobre parâmetros numéricos de prompt (temperatura, pesos top_k). Cada partícula "geração do LLM" é simulada como uma função de fitness scriptada. Roda o algoritmo por 30 iterações e mostra a convergência de g_best.
- `AMRO_S` — routing no estilo ACO. 3 agents, 4 tipos de tarefa, matriz de feromônio, 100 tarefas roteadas. Imprime a distribuição de (tipo_tarefa → escolha de agent) ao longo do tempo pra mostrar formação de trilha.
- Comparação: routing aleatório vs ACO no mesmo fluxo de tarefas. Mede qualidade e latência.

Execute:

```
python3 code/main.py
```

Saída esperada:
- LMPSO: fitness de g_best melhora de aleatório a quase-ótimo ao longo de 30 iterações.
- AMRO-S: tabela de feromônio estabiliza no agent certo por tipo de tarefa; routing ACO supera aleatório por ~30-40% em qualidade e também reduz latência (menos retries).

## Usar

`outputs/skill-swarm-optimizer.md` ajuda a escolher entre PSO, ACO, algoritmos genéticos e otimizadores baseados em gradiente pra problemas de otimização de LLM/agent.

## Em produção

- **Comece pequeno.** 10-20 partículas, 20-50 iterações. Escale só se a curva de convergência mostrar ganho claro.
- **Logue feromônios ou g_best por iteração.** Debugar otimizadores swarm sem trilha é doloroso.
- **Atualizações com gate de qualidade.** Especialmente pra routing ACO: agents rápidos-mas-errados não podem acumular feromônio.
- **Resete decaimento na mudança de distribuição.** Quando sua distribuição de avaliação muda, feromônios antigos estão desatualizados; resete ou dobre a taxa temporariamente.
- **Limite o custo por iteração.** Emita uma métrica de custo por iteração. PSO que custa $500/iteração e ganha 0.5% não é viável.

## Exercícios

1. Execute `code/main.py`. Observe a convergência do LMPSO. Varie o tamanho da população 5, 10, 20, 50. Em que tamanho o tempo pra convergir satura?
2. Implemente um experimento de "deriva catastrófica": após a iteração 30, mude a função de fitness. Quão rápido o PSO se adapta? Resetar `p_best` ajuda?
3. Adicione um gate de qualidade ao AMRO-S: depósito de feromônio só em execuções com score de avaliação > 0.7. Como isso muda a convergência vs a versão sem gate?
4. Leia LMPSO (arXiv:2504.09247). Mapeie o "velocity as a prompt" do artigo de volta à sua velocidade numérica. O que se perde na simulação e o que se preserva?
5. Leia AMRO-S (arXiv:2603.12933). Implemente o "caminho rápido de inferência" desacoplado com atualização assíncrona de feromônio. Como isso muda a latência do sistema sob carga sustentada?

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Otimizador baseado em população sem gradiente. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Otimização de caminho/rota via trilhas de feromônio. |
| LMPSO | "PSO com geração de LLM" | arXiv:2504.09247. Velocidade é um prompt; LLM produz candidatos. |
| Model Swarms | "PSO em pesos de expert" | arXiv:2410.11163. Atualização sem gradiente no subespaço de parâmetros do modelo. |
| AMRO-S | "ACO para routing de agent" | arXiv:2603.12933. Matriz de feromônio sobre tipo_tarefa × agent. |
| p_best / g_best | "Melhor pessoal / global" | Melhores soluções encontradas por partícula e pelo enxame até agora. |
| Feromônio | "Memória de routing" | Força em uma aresta; decai ao longo do tempo; é depositado por qualidade. |
| Atualização com gate de qualidade | "Só aprender com boas execuções" | Depósito de feromônio condicionado à verificação de qualidade. |
| Deriva catastrófica | "Mudança de distribuição" | Landscape de fitness muda; p_best e feromônios antigos ficam desatualizados. |

## Leitura Adicional

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) — artigo de PSO de 1995
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) — fundamentos de ACO de 1992
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) — PSO pra saídas estruturadas de LLM
- [Model Swarms — otimização de experts LLM sem gradiente](https://arxiv.org/abs/2410.11163) — PSO no subespaço de pesos do modelo
- [AMRO-S — routing multi-agente com colônia de formigas](https://arxiv.org/abs/2603.12933) — routing guiado por feromônio com gate de qualidade
