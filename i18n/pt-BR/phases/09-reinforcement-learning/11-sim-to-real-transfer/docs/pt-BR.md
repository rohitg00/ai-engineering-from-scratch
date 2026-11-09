# Transferência Sim-Real

> Uma política treinada em um simulador que falha no hardware é uma política que memorizou o simulador.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 08 (PPO), Phase 2 · 10 (Bias/Variance)
**Time:** ~45 minutes

## O problema

O treinamento de um robô real é lento, perigoso e caro. Um bipé leva milhões de episódios de treinamento para aprender a andar; um bipé real que cai mesmo que quebre o hardware. A simulação lhe dá resetes ilimitados, reprodução determinista, ambientes paralelos e nenhum dano físico.

Mas os simuladores estão errados. Os rolamentos têm mais atrito do que os modelos MuJoCo. As câmeras têm distorção de lente que o simulador não inclui. Os motores têm atrasos, reações negativas e saturação que 99% dos modelos sim ignoram.**reality gap** Diferença sistemática entre a distribuição sim e a distribuição real  é o problema central da RL implantada para a robótica.

Precisam de uma política que seja *robusta para a transferência de distribuição sim-to-real*. Três abordagens históricas: randomizar o simulador (randomizar o domínio), adaptar a política com um pouco de dados reais (adaptação / ajuste fino do domínio), ou identificar os parâmetros do sistema real e combiná-los (identificação do sistema). Em 2026 a receita dominante combina as três com simulação paralela maciça (Isaac Sim, Isaac Lab, Mujoco MJX na GPU).

## O conceito

![Three sim-to-real regimes: domain randomization, adaptation, system identification](../assets/sim-to-real.svg)

**Domain Randomization (DR).**Tobin et al. 2017, Peng et al. 2018 . Durante o treinamento, randomize todos os parâmetros de simulação que possam diferir no robô real: massas, coeficientes de atrito, ganhos de PD do motor, ruído do sensor, posição da câmera, iluminação, texturas, modelos de contato. A política aprende uma distribuição condicional sobre "em que sim é hoje" e generaliza em todo o período. Se o robô real for incluído no envelope de formação, a política funciona.

- **Upside:**Não é preciso dados reais.
- **Downside:**A formação excessivamente aleatória produz uma política "universal" mas excessivamente cautelosa.

**System Identification (SI).**Se você puder medir o atrito da articulação do braço no robô real, conecte-o ao sim. Depois treine uma política que espera esses valores.

- **Upside:**alvo de treinamento preciso e de baixo ruído.
- **Downside:**O erro residual do modelo é invisível para a política; pequenos efeitos não identificados (por exemplo, banda morta do motor) ainda interrompem a implantação.

**Domain Adaptation.**Treinamento em simulação, sintonização com uma pequena quantidade de dados reais.

- **Real2Sim2Real:**Aprender um simulador residual $f(s, a, z) - f_{\text{sim}}(s, a)$usando lançamentos reais, treinar no simulador corrigido. Fecha a lacuna sem muitos dados reais.
- **Observation adaptation:**Capacitar uma política que mapeia os ob → sim-like ob através de um extractor de características aprendido (por exemplo, GAN pixel-to-pixel).

**Privileged learning / teacher-student.**Miki et al. 2022 (ANYmal quadruped). Treinar um professor em simulação que tenha acesso a informações privilegiadas (frito de verdade do solo, altura do terreno, deriva IMU). Destila um estudante que só vê observações de sensores reais. O estudante aprende a inferir características privilegiadas da história, robustas em parâmetros físicos.

**Massively parallel simulation.**20242026. Isaac Lab, Mujoco MJX, Brax todos executam milhares de robôs paralelos em uma única GPU. PPO com 4.096 humanoides paralelos coleta anos de experiência em horas. A "guia de realidade" diminui à medida que a distribuição de treinamento se amplia; DR torna-se quase livre quando cada um desses 4.096 envs tem diferentes parâmetros aleatórios.

**The real-world 2026 recipe (quadruped walking example):**

1. Simulação maciça paralela com gravidade randomizada por domínio, atrito, ganhos motores, carga útil.
2. Política de professores treinados com informações privilegiadas (mapa de terreno, velocidade do corpo, verdade do solo).
3. Política de estudantes destilada do professor usando apenas a propriocepção (códigos das articulações das pernas).
4. Adaptação opcional de observação por meio de autoencoder em uma UMI real.
5. Deploição, zero-shot em 10 ambientes, se falhar, faça minutos de ajuste real com PPO com restrições de segurança.

```figure
f3-reality-gap
```

## Construí-lo

O código desta lição é uma pequena demonstração de randomization de domínio em um GridWorld com transições * ruidosas *. Nós treinamos uma política que experimenta probabilidades de deslize aleatórias em "sim" e avaliam em "real" com um nível de deslize que nunca viu durante o treinamento.

### Passo 1: Sim parametrizado

```python
def step(state, action, slip):
    if rng.random() < slip:
        action = random_perpendicular(action)
    ...
```

`slip`Em robótica real pode ser atrito, massa, ganho motor  qualquer coisa que se desloque entre sim e real.

### Passo 2: treinar com DR

No início de cada episódio, amostra `slip ~ Uniform[0.0, 0.4]`Treinar PPO / Q-learning / qualquer coisa. Faça isto por muitos episódios.

### Passo 3: avaliar o zero-shot em folhas "reais"

Avaliação `slip ∈ {0.0, 0.1, 0.2, 0.3, 0.5, 0.7}`- Os quatro primeiros estão no âmbito do apoio à formação;`0.5`E ...`0.7`Uma política de formação de DR deve permanecer quase ótima dentro do apoio e degradar-se graciosamente fora.

### Passo 4: comparação com um treinamento estreito

Formar uma segunda política com `slip = 0.0`- E o que é que é?`slip`Deveria ver uma queda catastrófica assim que o real deslizar > 0.

## Encurralagens

- **Too much randomization.**Trem em marcha .`slip ∈ [0, 0.9]`A sua política é tão aversas ao risco que nunca tenta o caminho ideal.
- **Too little randomization.**Treinar em uma fatia fina e a política não pode generalizar em tudo. Use currículo adaptativo (Randomizamento Automático de Domínio) que amplia a distribuição à medida que a política melhora.
- **Misidentified parameter space.**Randomize a coisa errada (tintura da câmera quando a diferença real é o atraso motor) e DR não ajuda.
- **Privileged info leakage.**Um professor que usa o estado global para ações, não apenas observações, pode produzir um aluno que não pode alcançar.
- **Sim-to-sim transfer failure.**Se a sua política não for robusta para uma variante de sim mais difícil, também não será robusta para o mundo real.
- **No real-world safety envelope.**Uma política que funciona em simulação e "funciona em realidade" sem um escudo de segurança de baixo nível ainda pode quebrar o hardware. Adicionar limites de velocidade, limites de torque, limites conjuntos em um controlador não-aprendizagem.

## Usá-lo

A pilha sim-to-real de 2026:

| Domain | Stack |
|--------|-------|
| Legged locomotion (ANYmal, Spot, humanoid) | Isaac Lab + DR + privileged teacher / student |
| Manipulation (dexterous hands, pick-and-place) | Isaac Lab + DR + DR-GAN for vision |
| Autonomous driving | CARLA / NVIDIA DRIVE Sim + DR + real fine-tune |
| Drone racing | RotorS / Flightmare + DR + online adaptation |
| Finger/in-hand manipulation | OpenAI Dactyl (DR at unprecedented scale) |
| Industrial arms | MuJoCo-Warp + SI + small real fine-tune |

Para o controlo em todas as escalas, o fluxo de trabalho é consistente: ajuste o simulador o melhor que puder, randomise o que não pode, treine políticas enormes, destila, implante com um escudo de segurança.

## Envia-o

Salva como`outputs/skill-sim2real-planner.md`- Não .

```markdown
---
name: sim2real-planner
description: Plan a sim-to-real transfer pipeline for a given robot + task, covering DR, SI, and safety.
version: 1.0.0
phase: 9
lesson: 11
tags: [rl, sim2real, robotics, domain-randomization]
---

Given a robot platform, a task, and access to real hardware time, output:

1. Reality gap inventory. Suspected sources ranked by expected impact (contact, sensing, actuation delay, vision).
2. DR parameters. Exact list, ranges, distribution. Justify each range against real measurements.
3. SI steps. Which parameters to measure; measurement method.
4. Teacher/student split. What privileged info the teacher uses; what obs the student uses.
5. Safety envelope. Low-level limits, emergency stops, backup controller.

Refuse to deploy without (a) a zero-shot sim-variant test, (b) a safety shield, (c) a rollback plan. Flag any DR range wider than 3× measured real variability as likely over-randomized.
```

## Exercícios

1. **Easy.**Treinar um agente de aprendizagem Q no GridWorld de deslize fixo (slip=0,0).$\text{slip} \in \lbrace 0.0, 0.1, 0.3, 0.5 \rbrace$- Retorno contra ressaca.
2. **Medium.**Treinar um agente de aprendizagem DR Q`slip ~ Uniform[0, 0.3]`- Evaluação da mesma varredura.
3. **Hard.**Implementar um currículo: começar com slips=0.0, ampliar a faixa de DR sempre que a política atinge 90% do ideal. Medir os passos totais do ambiente para alcançar slips=0.3 zero-shot versus uma linha de base fixa de DR.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Reality gap | "Sim-to-real difference" | Distribution shift between training and deployment physics/sensing. |
| Domain randomization (DR) | "Train across random sims" | Randomize sim parameters during training so policy generalizes. |
| System identification (SI) | "Measure real and fit sim" | Estimate real physical parameters; set sim to match. |
| Domain adaptation | "Fine-tune on real data" | Small real-world fine-tune after sim training; may adapt obs or dynamics. |
| Privileged info | "Ground truth for teacher" | Information only the sim has; student must infer it from obs history. |
| Teacher/student | "Distill privileged -> observable" | Teacher trained with shortcuts; student learns to mimic without them. |
| ADR | "Automatic Domain Randomization" | Curriculum that widens DR ranges as the policy improves. |
| Real2Sim | "Close the gap with real data" | Learn a residual to make the sim mimic real rollouts. |

## Mais leitura

- [Tobin et al. (2017). Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World](https://arxiv.org/abs/1703.06907) o papel original de DR (visão para a robótica).
- [Peng et al. (2018). Sim-to-Real Transfer of Robotic Control with Dynamics Randomization](https://arxiv.org/abs/1710.06537) DR para dinâmica, locomoção quadrupla.
- [OpenAI et al. (2019). Solving Rubik's Cube with a Robot Hand](https://arxiv.org/abs/1910.07113) Dactyl, ADR em escala.
- [Miki et al. (2022). Learning robust perceptive locomotion for quadrupedal robots in the wild](https://www.science.org/doi/10.1126/scirobotics.abk2822)- Professor-aluno para ANYmal.
- [Makoviychuk et al. (2021). Isaac Gym: High Performance GPU Based Physics Simulation for Robot Learning](https://arxiv.org/abs/2108.10470) o sim paralelo massiva que impulsiona as implantações de 2025-2026.
- [Akkaya et al. (2019). Automatic Domain Randomization](https://arxiv.org/abs/1910.07113) Método do currículo ADR.
- [Sutton & Barto (2018). Ch. 8 — Planning and Learning with Tabular Methods](http://incompleteideas.net/book/RLbook2020.pdf) o enquadramento Dyna (utilizar um modelo para planejamento + implantações) que sustenta os modernos canais sim-to-real.
- [Zhao, Queralta & Westerlund (2020). Sim-to-Real Transfer in Deep Reinforcement Learning for Robotics: a Survey](https://arxiv.org/abs/2009.13303) taxonomia dos métodos sim-to-real com resultados de referência.
