# Optimización de las políticas de proximidad (PPO)

> A2C arroja cada implementación después de una actualización. PPO envuelve el gradiente de política en una relación de importancia reducida para que pueda hacer 10+ épocas en los mismos datos sin que la política explode. Schulman et al. (2017).

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## El problema

A2C (lección 07) es sobre la política: el gradiente $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$Requiere datos recogidos de la *current* $\pi_\theta$. Toma una actualización, y $\pi_\theta$los cambios; los datos que usaste ahora están fuera de política.

En Atari, un despliegue en 8 envs × 128 pasos = 1024 transiciones y una docena de segundos de tiempo ambiental.

La optimización de las políticas de la región de confianza (TRPO, Schulman 2015) fue la primera solución: restringir cada actualización para que la divergencia entre las políticas antiguas y nuevas de KL se mantenga por debajo $\delta$Teóricamente limpio, pero requiere una solución de gradiente conjugado por actualización.

PPO (Schulman et al. 2017) reemplaza la restricción de la región de confianza dura con un objetivo simple recortado. Una línea extra de código. Diez épocas por implementación. No hay gradientes conjugados.

## El concepto

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

Esta es la proporción de probabilidad de la nueva política frente a la política que recopiló los datos. $r_t = 1$significa que no hay cambio.$r_t = 2$significa que la nueva política tiene el doble de probabilidades de tomar$a_t$como el viejo.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

Dos términos:

- Si la ventaja es$A_t > 0$y la proporción trata de crecer más allá $1 + \epsilon$, el clip aplanar el gradiente  no empujar una buena acción más allá de $+\epsilon$por encima de la antigua probabilidad.
- Si la ventaja es$A_t < 0$y la proporción intenta caer por debajo $1 - \epsilon$(lo que significa que haríamos que una mala acción fuera mucho menos probable que la vieja política), el clip aplanía el gradiente: no empujes una mala acción más allá de $-\epsilon$por debajo de la antigua probabilidad.

El `min`maneja la otra dirección: si la relación se ha movido en la dirección *beneficial* , todavía obtiene el gradiente (no hay recorte en el lado que le perjudique).

Típico$\epsilon = 0.2$. Describir el objetivo como función de $r_t$: una función lineal de pieza con un techo plano en el "lado bueno" y un piso plano en el "lado malo".

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

La misma estructura actor-crítica que A2C. Tres coeficientes, por lo general $c_v = 0.5$¿ Qué ?$c_e = 0.01$¿ Qué ?$\epsilon = 0.2$¿ Qué ?

**The training loop.**

1. Recolectar$N \times T$transiciones en el transcurso de la$N$Envistas paralelas para $T$cada uno de los pasos.
2. Computa ventajas (GAE), congelarlas como constantes.
3. Se congela .$\pi_{\theta_{\text{old}}}$como una instantánea de la corriente $\pi_\theta$¿ Qué ?
4. Para$K$La Comisión ha adoptado una directiva relativa a la protección de los animales en el sector de la pesca.`(s, a, A, V_target, log π_old(a|s))`¿Qué es esto ?
   - Computación$r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$¿ Qué ?
   - Aplicar$L^{\text{CLIP}}$+ pérdida de valor + entropía.
   - Un paso gradual.
5. Desecha el despliegue y vuelve al paso 1.

$K = 10$El PPO es robusto: los números exactos rara vez importan dentro de ±50%.

**KL-penalty variant.**El documento original propuso una alternativa mediante una penalidad KL adaptativa: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$con$\beta$La versión de recorte se convirtió en dominante; la variante KL sobrevive en RLHF (donde KL a la política de referencia es una restricción separada que siempre quieres de todos modos).

```figure
ppo-clip
```

## Construye el mismo

### Paso 1: captura `log π_old(a | s)`en el momento del despliegue

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

La instantánea se toma una vez, en el momento del lanzamiento.

### Paso 2: calcular las ventajas de la AEG (lección 07)

Igual que el A2C. Normaliza en todo el lote.

### Paso 3: actualización de sustituta recortada

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

El patrón de "gradiente reducido → cero" es el corazón de la PPO. Si la nueva política ya ha desviado demasiado en la dirección beneficiosa, la actualización se detiene.

### Paso 4: valor y entropía

Añadir MSE estándar al objetivo crítico y una bonificación de entropía en el actor, igual que A2C.

### Paso 5: diagnóstico

Tres cosas para ver en cada actualización:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$Debería quedarse .`[0, 0.02]`Si pasa por ahí`0.1`, reducir `K_EPOCHS`o `LR`¿ Qué ?
- **Clip fraction** la fracción de muestras cuya proporción se encuentra fuera $[1-\epsilon, 1+\epsilon]$- Deberían ser .`~0.1-0.3`Si ...`~0`, el clip nunca activa → aumento `LR`o `K_EPOCHS`Si ...`~0.5+`, estás sobre-ajustando el despliegue → bajarlos.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$- Metrica de calidad crítica. Debería subir hacia 1 a medida que el crítico aprende.

## Las trampas

- **Clip coefficient mistuned.** $\epsilon = 0.2$Es el estándar de facto.`0.1`hace que las actualizaciones sean demasiado tímidas; `0.3+`Invita a la inestabilidad.
- **Too many epochs.** $K > 20$La política de la UE se desestabiliza de forma rutinaria porque la política se deriva lejos de la$\pi_{\text{old}}$- Epocas de límite, especialmente para las redes grandes.
- **No reward normalization.**Las grandes escalas de recompensa se incorporan al rango de los clip. Normaliza las recompensas (con std) antes de las ventajas de la computación.
- **Forgetting advantage normalization.**La normalización de la media cero/unidad-std por lote es estándar.
- **Learning rate not decayed.**La PPO se beneficia de la decadencia de la LR lineal a cero.
- **Importance ratio math errors.**Siempre .`exp(log_new - log_old)`para la estabilidad numérica, no `new / old`¿ Qué ?
- **Wrong gradient sign.**Maximizar la madre sustitua = *minimizar* $-L^{\text{CLIP}}$Un letrero invertido es el virus más común.

## Usalo

PPO es el algoritmo RL predeterminado de 2026 en un sorprendente número de dominios:

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

La forma de PPO *perdida*  recortado sustituto + valor + entropía  es el andamio para DPO, GRPO y casi todos los oleoductos RLHF.

## Envío

Salvo como`outputs/skill-ppo-trainer.md`¿Qué es esto ?

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## Los ejercicios

1. **Easy.**Ejecutar PPO en 4×4 GridWorld con $\epsilon=0.2, K=4$. Comparar la eficiencia de la muestra con A2C (una época por lanzamiento) en etapas de entorno iguales.
2. **Medium.**Especialización$K \in \lbrace 1, 4, 10, 30 \rbrace$. Retorno de la trama vs. pasos env y seguimiento de media KL por actualización.$K$¿KL explotará en esta tarea?
3. **Hard.**En el caso de las personas que no tengan derecho a la prestación de servicios, el importe de la prestación de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de servicios de la Unión.$\beta$duplicado si $\mathrm{KL} > 2 \cdot \text{target}$, se redujeron a la mitad si $\mathrm{KL} < \text{target}/2$) Compare el rendimiento final, la estabilidad y la libre de clip.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## Leer más

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)- El periódico.
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) TRPO, el predecesor de PPO.
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) todos los hiperparámetros de PPO eliminados.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT; la receta de PPO en RLHF.
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) limpia exposición moderna con PyTorch.
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) PPO de referencia de archivo único utilizado por muchos documentos.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) la receta de producción de PPO en modelos de lenguaje; leer junto con la Lección 09 (RLHF).
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) el documento "37 optimizaciones de nivel de código"; cuáles son los trucos de PPO que son cargadores y cuáles son el folclore.
