# Instruction-Following como Sinal de Alinhamento

> Toda crítica posterior ao RLHF argumenta contra esse pipeline. Antes de estudar como a pressão de otimização distorce um proxy, você precisa ver o proxy. InstructGPT (Ouyang et al., 2022) definiu a arquitetura de referência: supervised fine-tuning em pares instrução-resposta, um reward model treinado em rankings de preferência par a par, e PPO contra o reward model com penalidade KL em relação à política SFT. Um InstructGPT de 1.3B foi preferido sobre um GPT-3 de 175B. Esse resultado único é o motivo pelo qual todo laboratório fronteiriço em 2026 ainda distribui um pipeline de pós-treinamento no formato RLHF.

**Tipo:** Learn
**Linguagens:** Python (stdlib, pipeline de três estágios toy)
**Pré-requisitos:** Fase 18 · 01 (InstructGPT), Fase 10 · 07 (RLHF), Fase 10 · 08 (DPO)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Nomeie os três estágios do pipeline InstructGPT e a loss usada em cada um.
- Explique por que um modelo de 1.3B sintonizado em instruções superou o GPT-3 puro de 175B em avaliação de preferência humana.
- Declare o que a penalidade KL no estágio 3 protege e por que removê-la colapsa para comportamento de busca por modos.
- Descreva o custo de alinhamento e a mitigação PPO-ptx que Ouyang et al. usaram contra ele.

## O Problema

Modelos de linguagem pré-treinados completam texto. Eles não respondem perguntas. Peça ao GPT-3 "escreva uma função Python que inverte uma lista" e você frequentemente recebe outro prompt de volta, porque a maior parte da distribuição de treinamento é texto da web que continua com mais texto da web. O modelo está fazendo seu trabalho — o trabalho está errado.

O proxy que todo laboratório sério usou para resolver isso é preferência humana. Duas completões vão para um avaliador; o avaliador escolhe a melhor; um reward model aprende do avaliador. Então um loop de RL desloca a política em direção a saídas que o reward model pontua alto. Essa é a tese completa do InstructGPT em três frases. O resto do paper é engenharia.

## O Conceito

### Estágio 1: supervised fine-tuning (SFT)

Colete pares instrução-resposta onde a resposta é o que um humano bem-intencionado escreveria. Ouyang et al. usaram 13k prompts de labelers e da API da OpenAI. Faça fine-tuning do modelo base nesses dados com a loss padrão de cross-entropy.

O que o SFT te dá: o modelo agora responde perguntas em vez de continuá-las. O que não te dá: qualquer sinal sobre qual resposta o avaliador prefere quando múltiplas são plausíveis.

### Estágio 2: reward model (RM)

Para cada prompt, amostrize K completões do modelo SFT. Um labeler ordena. Treine um reward model que pontue qualquer par instrução-resposta de forma que, para pares onde `y_w` foi preferido sobre `y_l`:

```
L_RM = -log sigmoid(r(x, y_w) - r(x, y_l))
```

Essa é a loss de preferência par a par de Bradley-Terry. O RM é geralmente inicializado a partir do modelo SFT com a cabeça LM substituída por uma cabeça escalar.

Reward models são pequenos: 6B foi suficiente para o InstructGPT de 175B. Eles também são frágeis — a seção 5 do paper é majoritariamente sobre comportamentos de reward hacking que apareceram em escala reduzida.

### Estágio 3: PPO com penalidade KL

Defina o objetivo:

```
J(pi) = E_{x~D, y~pi(.|x)} [ r(x, y) ] - beta * KL(pi(.|x) || pi_SFT(.|x))
```

Maximize com PPO. O termo KL mantém `pi` de se afastar demais da política SFT. Sem ele, o otimizador encontra adversarial examples — strings que pontuam alto no RM porque o RM nunca as viu, não porque humanos realmente as preferem.

O coeficiente KL `beta` é o hiperparâmetro mais importante do RLHF. Muito baixo: reward hacking. Muito alto: sem melhoria sobre o SFT.

### O custo de alinhamento

Após o RLHF, o modelo é preferido por humanos mas regride em benchmarks padrão (SQuAD, HellaSwag, DROP). Ouyang et al. chamam isso de custo de alinhamento e corrigem com PPO-ptx: misturam gradientes de pré-treinamento no objetivo de RL para que o modelo não esqueça como fazer tarefas downstream pelas quais nunca foi recompensado.

```
J_ptx(pi) = J(pi) + gamma * E_{x~D_pretrain} [ log pi(x) ]
```

O PPO-ptx se tornou padrão. Anthropic, DeepMind e Meta usam alguma variante.

### O resultado

Um InstructGPT de 1.3B (SFT + RM + PPO-ptx) é preferido por labelers sobre o GPT-3 base de 175B cerca de 70% das vezes. A margem se amplia em prompts ocultos de tráfego de produção. Duas coisas para extrair desse número:

1. Alinhamento é um eixo diferente de capacidade. O modelo de 175B tinha mais capacidade; o modelo de 1.3B tinha mais alinhamento; labelers preferiram o alinhado.
2. O piso de capacidade é definido pelo modelo base. Você não pode usar RLHF em um modelo base para fazê-lo saber fatos que nunca viu.

### Por que esse é o ponto de referência da Fase 18

Toda crítica nas lições posteriores — reward hacking (Lição 2), DPO (Lição 3), sycophancy (Lição 4), CAI (Lição 5), sleeper agents (Lição 7), alignment faking (Lição 9) — argumenta contra alguma parte desse pipeline. Reward hacking ataca o estágio 2. DPO colapsa os estágios 2 e 3. CAI substitui o labeler humano. Sycophancy mostra que o labeler é um sinal enviesado. Alignment faking mostra que a política pode contornar o estágio 3 inteiramente. Você não pode seguir nenhuma dessas críticas sem ter o pipeline na sua cabeça primeiro.

## Use

`code/main.py` simula os três estágios em dados de preferência toy. A "política" base é uma moeda enviesada sobre ações {A, B, C}. O estágio 1 SFT imita ações de labelers em 200 prompts. O estágio 2 ajusta um reward model Bradley-Terry a partir de 500 ordenações par a par. O estágio 3 roda uma atualização PPO simplificada com penalidade KL à política SFT. Você pode observar a recompensa subir, a divergência KL crescer, e a política derivar — e pode desligar o termo KL para ver o reward hacking aparecer dentro de 50 passos de atualização.

O que observar:

- Trajetória da recompensa com `beta = 0.1` vs `beta = 0.0`.
- KL(pi || pi_SFT) ao longo dos passos de treinamento.
- Distribuição final de ações comparada à preferência dos labelers.

## Entregue

Essa lição produz `outputs/skill-instructgpt-explainer.md`. Dada uma descrição de pipeline RLHF ou um resumo de paper, identifica qual dos três estágios está sendo modificado, qual loss está sendo usada em cada estágio, e se há uma penalidade KL ou regularizador equivalente presente.

## Exercícios

1. Execute `code/main.py`. Defina `beta = 0.0` e reporte a distribuição de ações após 200 passos de PPO. Explique o comportamento de busca por modos em um parágrafo.

2. Modifique o reward model para ter um viés +0.5 para a ação A (um bug de recompensa simulado). Execute PPO com `beta = 0.1`. A penalidade KL impede a política de explorar o viés? Em que `beta` a exploração se torna visível?

3. Leia Ouyang et al. (arXiv:2203.02155) Figura 1. Reproduza a curva de preferência dos labelers executando PPO por 1, 5, 20, 100 passos e medindo a preferência em relação ao modelo SFT.

4. A seção 4.3 do paper reporta que um InstructGPT de 1.3B supera o GPT-3 de 175B cerca de 70% das vezes. Por que a razão seria maior em prompts ocultos de produção do que nos prompts dos próprios labelers?

5. Substitua a loss de PPO por DPO (Fase 10 · 08) nos mesmos dados de preferência. Compare a derivação final da política (KL em relação ao SFT) e a recompensa final. Qual método deriva mais à recompensa pareada?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| SFT | "sintonização por instrução" | Estágio 1: fine-tuning por cross-entropy em pares instrução-resposta |
| Reward model | "o RM" | Regressor escalar sobre (prompt, response) treinado com Bradley-Terry em labels par a par |
| Bradley-Terry | "loss de preferência par a par" | -log sigmoid(r_w - r_l); reduz ordenação par a par para classificação binária |
| Penalidade KL | "o regularizador" | `beta * KL(pi || pi_SFT)` — mantém a política RL perto da âncora SFT |
| PPO-ptx | "PPO com mistura de pré-treinamento" | Adiciona uma fração da log-likelihood de pré-treinamento ao objetivo de PPO para compensar o custo de alinhamento |
| Custo de alinhamento | "a regressão do RLHF" | Queda pós-RLHF em benchmarks padrão que o RLHF não alvo |
| Preferência do labeler | "a verdade real" | Amostra de ordenações humanas; o RM é um proxy estatístico disso, não de "valores humanos"

## Leituras Adicionais

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) — o paper InstructGPT, base para todo pipeline RLHF que veio depois
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) — o predecessor de RLHF para sumarização
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) — a formulação original de RL baseada em preferências
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) — a extensão HH da Anthropic do pipeline InstructGPT
