# AlphaEvolve — Agents de Codificação Evolutiva

> Pare um modelo de codificação de fronteira com um loop evolutivo e um avaliador verificável por máquina. Deixe o loop rodar tempo suficiente. Ele descobre um procedimento de multiplicação de matrizes complexas 4x4 que usa 48 multiplicações escalares — a primeira melhoria sobre Strassen em 56 anos. Também encontra uma heurística de agendamento Borg que recupera ~0.7% do compute de cluster em produção. A propositalmente chata. As vitórias vêm da rigorosidade do avaliador.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, brinquedo de loop evolutivo)
**Pré-requisitos:** Fase 15 · 01 (enquadramento de longo prazo), Fase 15 · 02 (raciocínio auto-ensinado)
**Tempo:** ~60 minutos

## O Problema

Large language models conseguem escrever código. Algoritmos evolutivos conseguem buscar sobre código. Ambos foram tentados separadamente por décadas; ambos atingiram tetos. O teto do LLM é confabulação: o modelo escreve código plausível que não faz o que diz. O teto evolutivo é custo de busca: mutações aleatórias sobre sintaxe raramente produzem programas compiláveis, quanto mais melhores.

AlphaEvolve (Novikov et al., DeepMind, arXiv:2506.13131, junho de 2025) combina os dois. O LLM propõe edições direcionadas a um banco de dados de programas; um avaliador automático pontua cada variante; variantes de alta pontuação viram pais para gerações futuras. O LLM lida com o passo caro de escrever código plausível; o avaliador pega as confabulações. O loop roda de horas a semanas.

Resultados reportados: multiplicação de matrizes complexas 4x4 com 48 multiplicações escalares (o limite de Strassen de 1969 era 49), uma heurística de agendamento Borg em produção no Google, aceleração de 32.5% no kernel FlashAttention, melhorias no throughput de treinamento do Gemini.

A arquitetura funciona porque o avaliador é verificável por máquina. Não funciona onde o avaliador não é. Essa assimetria é a lição.

## O Conceito

### O loop

1. Comece a partir de um programa semente `P_0` que é correto mas subótimo.
2. Mantenha um banco de dados de variantes, cada uma pontuada pelo avaliador.
3. Amostra um ou mais pais do banco (estilo MAP-elites ou baseado em ilhas).
4. Induza o LLM (Gemini Flash para muitos candidatos, Gemini Pro para os difíceis) a produzir uma variante modificada do pai.
5. Compile, rode e avalie a variante no avaliador separado.
6. Insira no banco de dados com chave na pontuação e vetor de características.
7. Repete.

Dois detalhes importam. Primeiro, o LLM é induzido com mais do que o programa pai — tipicamente várias top variantes do banco, mais a assinatura do avaliador, mais uma breve descrição da tarefa. O trabalho do modelo é propor uma mudança direcionada que pode melhorar a pontuação. Segundo, o banco é estruturado (grid MAP-elites, baseado em ilhas) para que o loop explore diversidade, não apenas o líder atual.

### O que torna o avaliador inegociável

As vitórias do AlphaEvolve vêm todas de domínios onde o avaliador é rápido, determinístico e difícil de ludibriar:

- **Algoritmo de multiplicação de matrizes**: um teste unitário que multiplica matrizes e verifica igualdade bit a bit.
- **Heurística de agendamento Borg**: um simulador de nível de produção que reproduz carga histórica do cluster e mede compute desperdiçado.
- **Kernel FlashAttention**: um teste de correção mais benchmark de tempo real em hardware real.
- **Throughput de treinamento do Gemini**: medido em GPU-segundos por passo.

Em cada caso, o avaliador pega a classe de erros de LLM que de outra forma dominariam: declarações de correção confabuladas, declarações de performance que somem em hardware e falhas em edge cases. Remova o avaliador e o loop otimiza para código bonito.

### Reward hacking é a outra face dessa afirmação

Evolução otimiza para o que o avaliador mede. Se o avaliador for imperfeito, o loop vai encontrar a imperfeição. Em um domínio não verificado, o loop otimizaria para a característica superficial, não o comportamento pretendido. A DeepMind sinaliza isso explicitamente no paper: os sucessos do AlphaEvolve transferem apenas para domínios onde a rigorosidade do avaliador combina com a ambição da busca.

Exemplos concretos de reward hacking em loops de busca por código em 2025-2026:

- Alvos de otimização que recompensavam "tempo para completar" recompensavam submissão de soluções vazias.
- Scores de benchmark que recompensavam correção-sob-teste recompensavam memorização de testes e overfitting.
- Um proxy de "qualidade de código" recompensava remover comentários e renomear variáveis, sem mudança semântica.

O fix no AlphaEvolve: lance um avaliador separado que o LLM nunca viu, com entradas geradas no momento da avaliação. Mesmo assim, a DeepMind recomenda revisão forte em qualquer deploy proposto.

### Por que LLM + busca vence qualquer um sozinho

O LLM consegue produzir modificações compiláveis e semanticamente plausíveis. Um GA de mutação aleatória em um arquivo Python de 2000 linhas quase sempre produz erros de sintaxe. O LLM também concentra a busca em vizinhanças plausíveis (mude uma função, não bytes aleatórios), o que reduz dramaticamente chamadas desperdiçadas ao avaliador.

O avaliador, por sua vez, pega as confabulações do LLM. LLMs declaram com confiança que uma função "é O(n log n) no limite" quando na verdade é O(n^2); um benchmark de tempo real deixa a questão resolvida.

### Onde o AlphaEvolve se encaixa na stack de fronteira

| Sistema | Gerador | Avaliador | Domínio | Exemplo de vitória |
|---|---|---|---|---|
| AlphaEvolve | Gemini | correção + benchmark | algoritmos, kernels, agendadores | matmul 4x4 48-mul |
| FunSearch (DeepMind, 2023) | PaLM / Codey | corredução | matemática combinatória | limites inferiores de cap-set |
| AI Scientist v2 (Sakana, L5) | GPT/Claude | crítica LLM + experimento | pesquisa ML | paper de workshop ICLR |
| Darwin Godel Machine (L4) | estrutura do agent | SWE-bench / Polyglot | código do agent | 20% → 50% SWE-bench |

Os quatro são variações da mesma receita: gerador mais avaliador, loop. As diferenças são o que o avaliador avalia e quão rigoroso ele é.

## Use

`code/main.py` implementa um loop mínimo no estilo AlphaEvolve sobre um problema de regressão simbólica de brinquedo. O "LLM" é um proxy de stdlib que propõe pequenas mutações sintáticas em um programa que calcula uma função-alvo. O "avaliador" mede erro quadrático médio em pontos de teste separados.

Observe:

- Como a melhor pontuação melhora ao longo das gerações.
- Como um grid MAP-elites mantém soluções diversas vivas para que o loop não converge em um mínimo local.
- Como remover o teste separado (avaliador somente de treinamento) permite que o loop faça overfitting espetacularmente.

## Entregue

`outputs/skill-evaluator-rigor-audit.md` é a pré-condição para considerar um loop no estilo AlphaEvolve em um novo domínio: seu avaliador realmente pega as falhas que importam?

## Exercícios

1. Rode `code/main.py`. Observe a trajetória da melhor pontuação. Desabilite o avaliador separado (flag `--no-holdout`) e rode novamente. Quantifique o overfitting.

2. Leia a Seção 3 do paper AlphaEvolve sobre o grid MAP-elites. Projete um descritor de vetor de características para um novo problema (ex: passes de otimização de compilador) que manteria a busca diversa.

3. O resultado de 48 multiplicações 4x4 melhorou o limite de Strassen de 49-mul após 56 anos. Leia o Apêndice F do paper e explique em três frases por que o avaliador para esse problema é particularmente fácil de acertar e por que a maioria dos domínios não é assim.

4. Proponha um domínio onde o AlphaEvolve falharia. Identifique exatamente onde o avaliador quebra e por quê.

5. Para um domínio que você conheça, escreva a assinatura do avaliador que usaria. Inclua (a) condições de correção, (b) métrica de performance, (c) regra de geração de entradas separadas, (d) pelo menos uma verificação anti-reward-hacking.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| AlphaEvolve | "Agent evolutivo de codificação da DeepMind" | Gemini + banco de dados de programas + avaliador verificável por máquina |
| MAP-elites | "Arquivo preservador de diversidade" | Grid com chave em vetores de características; cada célula guarda a melhor variante com aquele descritor |
| Modelo de ilha | "Subpopulações de evolução paralela" | Populações independentes que migram periodicamente; previne convergência prematura |
| Avaliador verificável por máquina | "Oráculo determinístico" | Um teste unitário, simulador ou benchmark que o LLM não consegue forjar — pré-requisito para este loop |
| Reward hacking | "Otimizar a medida, não o objetivo" | Loop encontra uma forma de maximizar pontuação sem fazer a tarefa pretendida |
| Programa semente | "O ponto de partida" | Um programa inicial correto-mas-subótimo que o loop evolui |
| Avaliador separado | "Dados de avaliação que o LLM nunca viu" | Entradas geradas no momento da avaliação para prevenir memorização |

## Leituras Adicionais

- [Novikov et al. (2025). AlphaEvolve: A coding agent for scientific and algorithmic discovery](https://arxiv.org/abs/2506.13131) — o paper completo.
- [DeepMind blog on AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/) — texto do fornecedor com resultados.
- [AlphaEvolve results repository](https://github.com/google-deepmind/alphaevolve_results) — algoritmos descobertos, incluindo o matmul 4x4 48-mul.
- [Romera-Paredes et al. (2023). Mathematical discoveries from program search with LLMs (FunSearch)](https://www.nature.com/articles/s41586-023-06924-6) — o sistema predecessor.
- [Anthropic — Responsible Scaling Policy v3.0 (Feb 2026)](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — enquadra autonomia vinculada a avaliadores como direção de pesquisa-chave.
