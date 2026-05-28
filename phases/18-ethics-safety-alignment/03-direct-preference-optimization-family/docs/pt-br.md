# A Família de Direct Preference Optimization

> Rafailov et al. (2023) mostraram que o ótimo do RLHF tem uma forma fechada em termos dos dados de preferência, então você pode pular o reward model explícito e otimizar a política diretamente. Essa visão gerou uma família — IPO, KTO, SimPO, ORPO, BPO — cada uma corrigindo um modo de falha do DPO. Em 2026, algoritmos de alinhamento direto rodam mais execuções de pós-treinamento fronteiriço do que PPO. Mas a curva de otimização excessiva da Lição 2 ainda se aplica: DAAs não escapam do Goodhart, eles só mudam onde ele morde.

**Tipo:** Learn
**Linguagens:** Python (stdlib, comparador de loss de preferência de seis variantes)
**Pré-requisitos:** Fase 18 · 01 (InstructGPT), Fase 18 · 02 (Reward hacking), Fase 10 · 08 (DPO básico)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Derive a forma fechada do DPO a partir do ótimo RLHF-com-KL.
- Declare o modo de falha que cada IPO, KTO, SimPO, ORPO, BPO corrige no DPO.
- Distinga "gap de recompensa implícita" de "força de preferência" e explique por que o mapeamento identidade do IPO importa.
- Explique por que Rafailov et al. (NeurIPS 2024) provam que DAAs otimizam excessivamente apesar de não terem RM explícito.

## O Problema

O objetivo de RLHF (Lição 1):

```
max_pi E_{x,y~pi} [ r(x, y) ] - beta * KL(pi || pi_ref)
```

tem um ótimo conhecido:

```
pi*(y|x) = (1/Z(x)) * pi_ref(y|x) * exp(r(x, y) / beta)
```

Então a recompensa é implicitamente definida pela razão da política ótima em relação à referência:

```
r(x, y) = beta * log(pi*(y|x) / pi_ref(y|x)) + beta * log Z(x)
```

Substitua isso na likelihood de preferência Bradley-Terry e a função de partição `Z(x)` se cancela porque depende apenas de `x`. O que resta é uma loss apenas nos parâmetros da política — sem reward model necessário. Isso é o DPO.

O complicador: a derivação assume que o ótimo é alcançável, os dados de preferência estão na distribuição, e a política referência é a âncora real do modo. Nenhuma dessas coisas se mantém exatamente. Cada membro da família corrige uma premissa violada diferente.

## O Conceito

### DPO (Rafailov et al., 2023)

```
L_DPO = -log sigmoid(
  beta * log(pi(y_w | x) / pi_ref(y_w | x))
  - beta * log(pi(y_l | x) / pi_ref(y_l | x))
)
```

O que pode dar errado:

- O gap de recompensa implícita `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)` é ilimitado. Uma preferência mínima pode produzir um gap arbitariamente grande.
- A loss empurra as log-probs escolhidas e rejeitadas em direções opostas. Ela pode empurrar a log-prob absoluta escolhida para baixo enquanto a rejeitada cai mais rápido. Isso é o fenômeno de Resposta Escolhida Degradada.
- Preferências fora da distribuição (par raro raro vs par raro raro) produzem recompensas implícitas arbitrárias.

### IPO (Azar et al., 2024)

Identity Preference Optimization substitui o log-sigmoid por um mapeamento identidade na probabilidade de preferência. A loss se torna um erro quadrático em um alvo limitado:

```
L_IPO = (log(pi(y_w | x) / pi_ref(y_w | x)) - log(pi(y_l | x) / pi_ref(y_l | x)) - 1/(2 beta))^2
```

A margem é limitada por `1/(2 beta)`. Força de preferência e gap de recompensa implícita são proporcionais. Sem explosão.

### KTO (Ethayarajh et al., 2024)

Kahneman-Tversky Optimization descarta a estrutura par a par inteiramente. Dada uma única saída rotulada e um sinal binário "desejável" ou "indesejável", ela mapeia para uma utilidade de proespecificaçãot theory:

```
v(x, y) = sigma(beta * log(pi(y|x) / pi_ref(y|x)) - z_ref)
```

com pesos diferentes para ganhos e perdas (aversão à perda). Benefício: você pode usar dados não pareados, que são muito mais abundantes.

### SimPO (Meng et al., 2024)

Simple Preference Optimization alinha o sinal de treinamento com a geração. Remove a política referência inteiramente e normaliza a log-likelihood por comprimento:

```
L_SimPO = -log sigmoid(
  (beta / |y_w|) * log pi(y_w | x)
  - (beta / |y_l|) * log pi(y_l | x)
  - gamma
)
```

com uma margem `gamma` para estabilizar. A normalização por comprimento remove o incentivo de explorar o modo de falha de viés de comprimento do DPO (mais longo `y_w` dá uma margem de log-prob maior por construção).

### ORPO (Hong et al., 2024)

Odds-Ratio Preference Optimization adiciona um termo de preferência à negative log-likelihood padrão do SFT:

```
L_ORPO = L_NLL(y_w) + lambda * L_OR
L_OR = -log sigmoid(log(odds(y_w) / odds(y_l)))
```

Sem política referência — o termo SFT é o regularizador. Treine em um único estágio do modelo base ao modelo alinhado. Sem checkpoint SFT separado.

### BPO (submissão ICLR 2026, OpenReview id=b97EwMUWu7)

Identifica o problema de Respostas Escolhidas Degradadas: DPO preserva a ordenação `y_w > y_l` mas a log-prob absoluta de `y_w` pode cair. BPO adiciona uma correção de uma linha que penaliza movimentos descendentes na resposta escolhida. Reporta +10.1% de acurácia em Llama-3.1-8B-Instruct em raciocínio matemático comparado ao DPO.

### O resultado universal: DAAs ainda otimizam excessivamente

Rafailov et al. "Scaling Laws for Reward Model Overoptimization in Direct Alignment Algorithms" (NeurIPS 2024) treinaram políticas com DPO, IPO, SLiC em múltiplos datasets com orçamentos KL variados. As curvas de recompensa-ouro-vs-KL têm a mesma forma de pico-e-colapso de Gao et al. A recompensa implícita amostra fora de distribuição durante o treinamento; regularização KL não estabiliza isso.

DAAs não escapam do Goodhart. Eles mudam a superfície onde ele morde de "reward model otimizado excessivamente" para "razão da política referência otimizada excessivamente." A correção universal — dados melhores, ensambles, parada antecipada — se aplica a ambos.

### Escolhendo entre eles (2026)

- Se você tem dados de preferência pareados grandes: DPO com beta conservativo, SimPO se o viés de comprimento for evidente.
- Se você tem feedback binário não pareado: KTO.
- Se você quer um pipeline de estágio único a partir de um modelo base: ORPO.
- Se você vê log-probs escolhidas degradadas nos logs de DPO: BPO.
- Se as forças de preferência variam muito e DPO está saturando: IPO.

Todo laboratório roda todos os cinco em uma bateria e escolhe o vencedor por tarefa. Não há motivo para o ótimo ser o mesmo para raciocínio matemático e segurança.

## Use

`code/main.py` compara seis losses (DPO, IPO, KTO, SimPO, ORPO, BPO) em um dataset de preferência toy onde a verdadeira força de preferência varia por par. Cada loss é otimizada contra a mesma amostra de 500 pares com uma política softmax pequena. Plota a taxa de vitória final, a derivação da log-prob escolhida, e o espalhamento da recompensa implícita por método.

## Entregue

Essa lição produz `outputs/skill-preference-loss-selector.md`. Dadas estatísticas de dataset (pareado vs não pareado, força de preferência variável vs uniforme, distribuição de comprimento) e um alvo (estágio único ou SFT-depois-de-preferência), recomenda uma loss de preferência e reporta o modo de falha contra o qual ela protege.

## Exercícios

1. Execute `code/main.py`. Reporte a queda final da log-prob escolhida para DPO e BPO. BPO deve reter maior probabilidade absoluta escolhida — verifique isso.

2. Modifique os dados de preferência para que todos os pares tenham força igual. Qual dos seis métodos é mais robusto? Qual degrada? Explique a vantagem do IPO aqui.

3. Faça as respostas rejeitadas serem em média 2x mais longas que as escolhidas. Sem mudar nada mais, mostre numericamente a exploração de comprimento do DPO e a correção do SimPO.

4. Rafailov et al. (NeurIPS 2024) afirmam que DAAs otimizam excessivamente. Reproduza uma versão de ponto único: plote a divergência KL escolhido-menos-rejeitado e observe a otimização excessiva em DPO com beta grande.

5. Leia o resumo do paper BPO (OpenReview b97EwMUWu7). Escreva a correção de uma linha que o BPO adiciona ao DPO. Confirme contra a implementação em `code/main.py`.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| DPO | "RLHF sem reward model" | Loss derivada do ótimo RLHF em forma fechada; apenas parâmetros da política |
| Recompensa implícita | "a razão logarítmica" | `beta * log(pi(y|x) / pi_ref(y|x))` — a recompensa implícita pelo DPO |
| IPO | "DPO limitado" | Substitui log-sigmoid por identidade; gap de recompensa implícita limitado por `1/(2 beta)` |
| KTO | "DPO não pareado" | Utilidade de proespecificaçãot theory sobre rótulos individuais com aversão à perda |
| SimPO | "DPO sem referência" | Log-likelihood normalizada por comprimento + margem; sem política referência |
| ORPO | "DPO de estágio único" | NLL + termo de preferência odds-ratio; treina do modelo base em uma passagem |
| BPO | "DPO preservador da escolhida" | DPO mais uma penalidade para diminuir a log-prob absoluta da resposta escolhida |
| Escolhida Degradada | "escolhida cai" | DPO diminui a log-prob escolhida enquanto a rejeitada cai mais rápido |
| DAA | "algoritmo de alinhamento direto" | Qualquer método de loss de preferência que pula um RM explícito |

## Leituras Adicionais

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) — IPO
- [Ethayarajh et al. — KTO: Model Alignment as Proespecificaçãot Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
