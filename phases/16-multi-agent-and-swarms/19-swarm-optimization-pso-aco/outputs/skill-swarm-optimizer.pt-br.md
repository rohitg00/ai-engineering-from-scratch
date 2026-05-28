---
name: swarm-optimizer
description: Escolha entre PSO, ACO, algoritmos genéticos e otimizadores baseados em gradiente para um determinado LLM ou problema de otimização de agente. Bio-inspired swarm algorithms are gradient-free and suit LLM-era workloads where the search space is discrete or the fitness function is black-box.
version: 1.0.0
phase: 16
lesson: 19
tags: [multi-agent, swarm-optimization, PSO, ACO, prompt-optimization, routing]
---

Dado um problema de LLM ou otimização de agente, escolha o otimizador certo.

Produzir:

1. **Impressão digital do problema.** Espaço de pesquisa (numérico contínuo, string de prompt, pesos de modelo, gráfico de roteamento), sinal de aptidão (teste automático, juiz LLM, avaliador humano, KPI de negócios), tempo até valor (minutos, horas, dias).
2. **Escolha do otimizador.** PSO, ACO, algoritmo genético, DPO/RL, ajuste manual. Cada um tem um caso de uso padrão:
   - numérico contínuo em um espaço limitado → PSO
   - roteamento ou seleção de caminho → ACO
   - símbolos / programas discretos → algoritmos genéticos
   - recompensa diferenciável → DPO/RL
   - avaliação rápida e de baixa dimensão → pesquisa em grade/aleatória
3. **Dimensionamento da população.** 10-30 para PSO/GA, tamanho da matriz de feromônios para ACO. Cálculo do orçamento: N × T × custo por avaliação. Não execute enxames que custem mais do que o valor que produzem.
4. **Condicionamento físico + portão de qualidade.** Qual função avalia um candidato? Para roteamento ACO, qual limite de qualidade desencadeia o depósito de feromônios?
5. **Monitoramento de convergência.** Registrar g_best ou estabilidade de feromônios por iteração. Alerta sobre divergência (deriva catastrófica) e sobre convergência prematura (ótimo local).
6. **Ajuste de decaimento/exploração.** Inércia do PSO e pesos cognitivos/sociais; Taxa de decaimento do feromônio ACO e quantidade de depósito. Trade-off: baixo declínio → preso no vencedor inicial; alta decadência → sem memória.
7. **Redefinir condições.** Quando a distribuição de avaliação mudar ou o padrão de implantação mudar, redefina g_best ou zero feromônios temporariamente. Memórias obsoletas são piores do que nenhuma memória.

Rejeições difíceis:

- Otimizadores de enxame em tarefas onde o condicionamento físico precisa de revisão humana. O custo por iteração supera o orçamento.
- População > 50 pessoas sem uma justificação orçamental clara. Os retornos decrescentes dominam.
- Roteamento de feromônios sem portão de qualidade. Agentes rápidos, mas errados, bloqueiam.
- PSO em espaços de busca discretos que não possuem incorporação contínua natural. Use GA ou recozimento simulado.

Regras de recusa:

- Se o usuário estiver tentando otimizar algo sem uma função de aptidão clara, recomendamos definir primeiro a aptidão. Os otimizadores Swarm não podem ajudar sem um avaliador.
- Se o orçamento do usuário for inferior a US$ 100, recomende ajuste manual + armazenamento em cache em vez de enxames.
- Se a distribuição mudar diariamente, recomende aprendizagem on-line ou bandidos, não otimizadores de enxame.

Resultado: um resumo de uma página. Comece com uma recomendação de uma frase ("Use ACO com depósitos de feromônios controlados por qualidade em um problema de roteamento do tipo 3 agentes x 4 tarefas. Decaimento 0,05, limite 0,6, 200 tarefas de aquecimento.") e, em seguida, as sete seções acima. Termine com uma estimativa de orçamento e um plano de implementação de 1 semana.