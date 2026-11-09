# AlphaEvolve  Agentes de codificação evolutivos

> Combinar um modelo de codificação de fronteira com um ciclo evolutivo e um avaliador verificável por máquina. Deixe o ciclo correr o suficiente. Descobre um procedimento de multiplicação de matriz complexa 4x4 que usa 48 multiplicações escalares, a primeira melhoria em relação a Strassen em 56 anos. Também encontra uma heurística de agendamento Borg em todo o Google que recupera ~ 0,7% do computação de cluster na produção. A arquitetura é aborrecida de propósito. As vitórias vêm do rigor do avaliador.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, evolutionary-loop toy)
**Prerequisites:** Phase 15 · 01 (long-horizon framing), Phase 15 · 02 (self-taught reasoning)
**Time:** ~60 minutes

## O problema

Os modelos de linguagem grandes podem escrever código. Algoritmos evolutivos podem pesquisar código. Ambos foram testados separadamente por décadas; ambos atingiram limites. O teto LLM é confabulação: o modelo escreve código plausível que não faz o que afirma. O teto evolutivo é custo de pesquisa: mutações aleatórias sobre sintaxe raramente produzem programas compiláveis, muito menos melhores.

O LLM propõe edições direcionadas a um banco de dados de programas; um avaliador automático marca cada variante; as variantes de pontuação alta se tornam pais para as gerações futuras. O LLM lida com a etapa cara de escrever código plausível; o avaliador pega as confabulações. O ciclo dura de horas a semanas.

Resultados relatados: multiplicação de matriz complexa 4x4 de 48-escala-multiplicação (limite de 1969 de Straßsen foi 49), um heurística de agendamento Borg na produção do Google, um 32,5% de flashattention kernel speedup, melhorias de throughput de treinamento Gemini.

A arquitetura funciona porque o avaliador é verificável pela máquina. Não funciona onde o avaliador não está. Essa assimetria é a lição.

## O conceito

### O ciclo

1. Comece com um programa de sementes .`P_0`Isso é correto, mas suboptimo.
2. Manter um banco de dados de programas variantes, cada um marcado pelo avaliador.
3. Amostra de um ou mais pais da base de dados (em estilo MAP-elite ou baseado em ilhas).
4. Promover o LLM (Gemini Flash para muitos candidatos, Gemini Pro para os mais difíceis) para produzir uma variante modificada do pai.
5. Compile, execute e avalia a variante no avaliador de tempo.
6. Insira na base de dados selecionada por seu ponto e vector de características.
7. Repito. - Não.

O modelo é um modelo de trabalho que é um modelo de trabalho de trabalho, que é a de proporcionar uma mudança direcionada que pode melhorar a pontuação.

### O que torna o avaliador não negociável

As vitórias do AlphaEvolve vêm de domínios onde o avaliador é rápido, determinista e difícil de jogar:

- **Matrix multiplication algorithm**O teste unitário multiplica matrizes e verifica a igualdade de forma bit-identical.
- **Borg scheduling heuristic**O simulador de nível de produção que reproduz a carga histórica do cluster e mede o cálculo desperdiçado.
- **FlashAttention kernel**: um teste de correcção mais um indicador de relógio de parede em hardware real.
- **Gemini training throughput**: GPU-segundos por passo.

Em cada caso, o avaliador capta a classe de erros de LLM que de outra forma dominariam: alegações de corretão confabuladas, alegações de desempenho que desaparecem no hardware e falhas de bordo.

### O hacking de recompensas é a outra face dessa declaração

A evolução otimiza para qualquer medida que o avaliador mede. Se o avaliador é imperfeito, o loop encontrará a imperfeição. Em um domínio não verificado o loop otimiza para a característica de superfície, não o comportamento pretendido. DeepMind sinaliza isso explicitamente no artigo: os sucessos do AlphaEvolve transferem apenas para domínios onde o rigor do avaliador corresponde à ambição da pesquisa.

Exemplos concretos de hacking de recompensas em ciclos de busca de código:

- Objetivos de otimização que recompensam "tempo para completar" recompensaram a apresentação de soluções vazias.
- Os resultados de referência que recompensam a correcção sob o teste recompensaram os testes de memória e o excesso de correspondência.
- Um proxy de "qualidade de código" recompensou a remoção de comentários e a reescritura de nomes de variáveis, sem mudança semântica.

A solução no AlphaEvolve: enviar um avaliador que o LLM nunca viu, com insumos gerados no momento da avaliação.

### Por que a busca LLM + bate sozinha

O LLM pode produzir modificações compilaveis e semânticamente plausíveis. Uma mutação aleatória GA em um arquivo Python de 2000 linhas quase sempre produz erros de sintaxe. O LLM também concentra a pesquisa em bairros plausíveis (mudança de uma função, não bytes aleatórios), o que reduz drasticamente as chamadas de avaliador desperdiçadas.

O avaliador, por sua vez, capta as confabulações do LLM.$O(n \log n)$No limite" quando é realmente $O(n^2)$A questão é resolvida por um indicador de referência do relógio de parede.

### Onde o AlphaEvolve se encaixa na pilha de fronteira

| System | Generator | Evaluator | Domain | Example win |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correctness + benchmark | algorithms, kernels, schedulers | 48-mul 4x4 matmul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | correctness | combinatorial math | cap-set lower bounds |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | LLM critique + experiment | ML research | ICLR workshop paper |
| Darwin Godel Machine (L4) | agent scaffolding | SWE-bench / Polyglot | agent code | 20% → 50% SWE-bench |

Todas as quatro são variações da mesma receita: gerador mais avaliador, loop. As diferenças são o que o avaliador classifica e quão rigoroso é.

```figure
alphaevolve-loop
```

## Usá-lo

`code/main.py`O "LLM" é um proxy stdlib que propõe pequenas mutações sintáticas para um programa que calcula uma função alvo.

- Vigiar:

- Como a melhor pontuação melhora ao longo das gerações.
- Como uma rede de elite MAP mantém diversas soluções vivas para que o ciclo não converja em um mínimo local.
- Como a remoção do teste prolongado (avaliador de treinamento só) permite que o loop se encaixe espetacularmente.

## Envia-o

`outputs/skill-evaluator-rigor-audit.md`É a condição prévia para considerar um ciclo de estilo AlphaEvolve num novo domínio: o seu avaliador realmente detecta os falhas que lhe importam?

## Exercícios

1. Corra .`code/main.py`- Observe a melhor trajetória de pontuação.`--no-holdout`) e re-exercício.

2. Leia a Seção 3 do artigo AlphaEvolve sobre a grade MAP-elites.

3. O resultado de 48-multiplicação 4x4 melhorou no limite de 49-mul de Strassen após 56 anos.

4. Propõe um domínio onde o AlphaEvolve falha, identifique exatamente onde o avaliador rompe e porquê.

5. Para um domínio que conheça, escreva a assinatura do avaliador que você usaria. Incluir (a) condições de correção, (b) métrica de desempenho, (c) regra de geração de entrada prolongada, (d) pelo menos um check anti-reward hacking.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| AlphaEvolve | "DeepMind's evolutionary coding agent" | Gemini + program database + machine-checkable evaluator |
| MAP-elites | "Diversity-preserving archive" | Grid keyed by feature vectors; each cell holds the best variant with that descriptor |
| Island model | "Parallel evolution subpopulations" | Independent populations that migrate periodically; prevents premature convergence |
| Machine-checkable evaluator | "Deterministic oracle" | A unit test, simulator, or benchmark the LLM cannot fake — a prerequisite for this loop |
| Reward hacking | "Optimizing the measure, not the goal" | Loop finds a way to maximize score without doing the intended task |
| Seed program | "The starting point" | An initial correct-but-suboptimal program the loop evolves from |
| Held-out evaluator | "Evaluation data the LLM never saw" | Inputs generated at evaluation time to prevent memorization |

## Mais leitura

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131)- O papel completo.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) O fornecedor com resultados.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results)Algoritmos descobertos, incluindo o matmul 4x4 de 48-mul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) o sistema anterior.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) define a autonomia do avaliador como uma direcção-chave da investigação.
