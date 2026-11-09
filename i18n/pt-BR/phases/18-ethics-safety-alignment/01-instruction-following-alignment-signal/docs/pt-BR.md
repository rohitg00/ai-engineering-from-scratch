# Seguir instruções como sinal de alinhamento

> Todas as críticas posteriores à RLHF argumentam contra este gasoduto. Antes de estudar como a pressão de otimização distorce um proxy, tem de ver o proxy. A instruçãoGPT (Ouyang et al., 2022) definiu a arquitetura de referência: ajuste supervisionado em pares de instrução-resposta, um modelo de recompensa treinado em rankings de preferência em pares e o PPO contra o modelo de recompensa com uma penalidade KL para a política SFT. Um GPT InstructGPT 1.3B foi preferido a um GPT-3 175B. Esse único resultado é a razão pela qual cada laboratório de fronteira em 2026 ainda envia um pipeline de pós-treino em forma de RLHF.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Objetivos de aprendizagem

- Nomear as três fases do gasoduto InstructGPT e a perda utilizada em cada uma delas.
- Explique por que um modelo com instruções de 1.3B venceu o GPT-3 bruto de 175B na avaliação das preferências humanas.
- Explique do que a penalidade KL na fase 3 está a proteger e por que a sua remoção entra em colapso com o comportamento de busca de modo.
- Descreva o imposto de alinhamento e a mitigação do PPO-ptx utilizada contra o Ouyang et al.

## O problema

Os modelos de linguagem pré-treinados completam texto. Eles não respondem perguntas. Pergunte ao GPT-3 "escrever uma função Python que inverte uma lista" e você geralmente recebe outro prompt, porque a maior parte da distribuição de treinamento é texto web que continua com mais texto web. O modelo está fazendo seu trabalho  o trabalho é errado.

O proxy que cada laboratório sério usa para corrigir isso é a preferência humana. Duas conclusões vão para um avaliador; o avaliador escolhe o melhor; um modelo de recompensa aprende o avaliador.

## O conceito

### Fase 1: ajuste fino supervisionado (SFT)

Coletar pares de resposta rápida onde a resposta é o que um humano bem intencionado escreveria. Ouyang et al. usou 13k prompts de etiquetadores e a API OpenAI.

O que o SFT lhe dá: o modelo agora responde às perguntas em vez de continuá-las. O que não lhe dá: qualquer sinal sobre qual resposta o avaliador prefere quando múltiplos são plausíveis.

### Fase 2: Modelo de recompensa (RM)

Para cada resposta rápida, mostre as conclusões K do modelo SFT. Um etiquetador as classifica. Treinar um modelo de recompensa que pontua qualquer par de resposta rápida para que, para pares onde `y_w`Era preferido .`y_l`- Não .

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

Esta é a perda de preferência em pares Bradley-Terry. O RM é geralmente iniciado a partir do modelo SFT com a cabeça LM substituída por uma cabeça escalar.

Os modelos de recompensa são pequenos: 6B foi suficiente para o 175B InstructGPT. Eles também são frágeis.

### Fase 3: PPO com penalidade KL

Define o objectivo:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

Maximizar com PPO.`pi`Sem ele, o optimizador encontra exemplos adversários  cordas que pontuação alta abaixo do RM porque o RM nunca os viu, não porque os seres humanos realmente preferem.

O coeficiente KL `beta`O que é que é o mais importante hiperparâmetro RLHF?

### Imposto de alinhamento

Após o RLHF, o modelo é preferido pelos humanos, mas regredem em benchmarks padrão (SQuAD, HellaSwag, DROP). Ouyang et al. chamam isso de imposto de alinhamento e o corrigem com PPO-ptx: misturam gradientes pré-treinamento no objetivo de RL para que o modelo não esqueça como fazer tarefas a jusante que nunca foi recompensado.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

O PPO-ptx tornou-se padrão. Anthropic, DeepMind e Meta todos usam alguma variante.

### O resultado

Um 1.3B InstructGPT (SFT + RM + PPO-ptx) é preferido pelos etiquetadores sobre o 175B base GPT-3 cerca de 70% do tempo.

1. O modelo 175B tinha mais capacidade; o modelo 1.3B tinha mais alinhamento; os etiquetadores preferiam o alinhado.
2. O nível de capacidade é definido pelo modelo base.

### Por que é este o ponto de referência para a Fase 18

Cada crítica nas aulas posteriores  hacking de recompensa (Lessão 2), DPO (Lessão 3), sicofania (Lessão 4), CAI (Lessão 5), agentes adormecedores (Lessão 7), alinhamento falsificação (Lessão 9)  argumenta contra alguma parte deste pipeline. Ataques de hacking de recompensa estágio 2. O DPO desmorona nos estágios 2 e 3. A CAI substitui o rotulador humano. A sícofancia mostra que o rotulador é um sinal tendencioso. A falsificação de alinhamento mostra que a política pode percorrer a fase 3 inteiramente. Não se pode seguir nenhuma dessas críticas sem o pipeline na cabeça primeiro.

```figure
al-instruct-pipeline
```

## Usá-lo

`code/main.py`Simula as três etapas dos dados de preferência dos brinquedos. A "política" base é uma moeda tendenciosa sobre as ações {A, B, C}. Estação 1 SFT imita ações de rotulagem em 200 instruções. O estágio 2 corresponde a um modelo de recompensa Bradley-Terry de 500 rankings em pares. A fase 3 apresenta uma atualização simplificada do PPO com uma penalidade KL para a política de SFT. Você pode assistir ao aumento da recompensa, a divergência KL crescer, e a política de deriva  e você pode desligar o termo KL para ver o hacking de recompensa aparecer dentro de 50 passos de atualização.

O que ver:

- Tráetoria de recompensa com `beta = 0.1`- Não .`beta = 0.0`- Não .
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$sobre as etapas de treinamento.
- Distribuição final de ações em comparação com a preferência do etiquetador.

## Envia-o

Esta lição produz`outputs/skill-instructgpt-explainer.md`. Tendo em conta uma descrição do gasoduto RLHF ou um resumo de papel, identifica qual das três fases está a ser modificada, qual a perda a utilizar em cada etapa e se existe uma penalidade KL ou reguladora equivalente.

## Exercícios

1. Corra .`code/main.py`- Set .`beta = 0.0`E informar a distribuição de ação após 200 etapas de PPO. Explique o comportamento de busca de modo num parágrafo.

2. Modifique o modelo de recompensa para ter um preconceito de +0,5 para a ação B (um bug de recompensa simulado).`beta = 0.1`A penalidade KL impede que a política explore o preconceito?`beta`torna-se visível a exploração?

3. Leia Ouyang et al. (arXiv:2203.02155) Figura 1. Reproduzir a curva de preferência de etiquetador executando PPO por 1, 5, 20, 100 passos e medindo a preferência em relação ao modelo SFT.

4. A secção 4.3 do jornal relata que um 1.3B InstructGPT supera o 175B GPT-3 cerca de 70% do tempo.

5. Substituir a perda de PPO por DPO (Fase 10 · 08) com base nos mesmos dados de preferência. Comparar a derivação final da política (KL a SFT) e a recompensa final. Qual método deriva mais longe com a recompensa correspondente?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## Mais leitura

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) o papel InstructGPT, base para cada oleoduto RLHF que se seguiu
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) o antecessor do RLHF para resumo
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) a formulação original de RL baseada em preferências
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) Extensão da HH do gasoduto InstructGPT pela Anthropic
