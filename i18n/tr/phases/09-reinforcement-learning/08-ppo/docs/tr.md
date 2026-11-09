# Yakınlık Politikası Optimize (PPO)

> A2C, her bir yüklenmenin bir güncelleştirmeden sonra atılmasını sağlar. PPO politika gradiyentiyi kesilmiş önem oranında sarar, böylece politika patlamadan aynı veriler üzerinde 10+ dönem yapabilirsiniz. Schulman et al. (2017).

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## Sorun

A2C (Desin 07) politikada: gradient $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$*kurrent*'den örnek alınan verileri gerektirir.$\pi_\theta$Bir güncellemesi yapın ve$\pi_\theta$Bu değişiklikler, kullandığınız veriler artık politika dışı.

Atari'de 8 envs × 128 adım boyunca bir rolü = 1024 geçiş ve bir düzine saniye çevre zamanı.

Güven Bölgesi Politikası Optimize edilmesi (TRPO, Schulman 2015) ilk çözümdür: her güncellemeyi kısıtlayın, böylece eski ve yeni politikalar arasındaki KL farklılığı aşağıda kalır $\delta$Teorik olarak temiz ama her güncelleme için bir konjugat-gradyen çözümü gerektirir.

PPO (Schulman et al. 2017) sert güven bölgesinin kısıtlamasını basit bir kesilmiş hedef ile değiştirir. Bir ekstra kod satırı. Her dağıtım için on dönem. Konjugat gradient yoktur. Yeterince iyi teorik garantiler.

## Anlaşım

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

Bu yeni politika ile verileri toplayan politika arasındaki olasılık oranıdır. $r_t = 1$Değişiklik yok demektir.$r_t = 2$Yeni politika iki kat daha fazla süre alacak.$a_t$Eski gibi.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

İki dönem:

- Eğer avantajı $A_t > 0$ve oranın ötesine çıkmaya çalışması $1 + \epsilon$, klipi eğilimi düzeltir  iyi bir eylem daha fazla itmemek $+\epsilon$Eski olasılıkların üstünde.
- Eğer avantajı $A_t < 0$ve oran aşağı düşmeye çalışır.$1 - \epsilon$(yani kötü bir eylemin eski politikadan çok daha az olasılığını yapacağımızı gösterir) klip, eğilimi düzeltir: kötü bir eylemin daha ileriye doğru ilerlemesini önlemeyin.$-\epsilon$Eski olasılıktan aşağı.

- Evet .`min`Diğer yönü ele alır: oran * yararlı* yönde hareket ettiyse, hala eğilimi alırsınız (bölgeye bir kesim yapmamak sizi incitebilir).

Tipik $\epsilon = 0.2$. Hedefi bir fonksiyon olarak çiz .$r_t$: "iyi tarafta" düz bir çatı ve "kötü tarafta" düz bir zemin ile parça-düzsel bir işlev.

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

Aynı aktör-kritik yapı A2C ile.$c_v = 0.5$- Evet .$c_e = 0.01$- Evet .$\epsilon = 0.2$- Evet .

**The training loop.**

1. Toplayın .$N \times T$$N$paralel ortamlar için$T$Her adım.
2. Gelirleri hesaplayın (GAE), onları sabit olarak dondurun.
3. Dondurma$\pi_{\theta_{\text{old}}}$$\pi_\theta$- Evet .
4. - Evet .$K$                        `(s, a, A, V_target, log π_old(a|s))`- ...
   - Hesaplama$r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$- Evet .
   - Uygula$L^{\text{CLIP}}$+ değer kaybı + entropi.
   - - İlerleyici adım.
5. Çıkarmayı atın ve adım 1'e dönün.

$K = 10$PPO güçlüdür: tam sayı nadiren ±50%'lik bir değer içerir.

**KL-penalty variant.**Orijinal makalede adapte KL cezası kullanan bir alternatif önerildi: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$- Evet .$\beta$KL'ye göre ayarlanmıştır. Klipleme sürümü baskın hale geldi; KL variansı RLHF'de hayatta kalıyor (RLHF'de KL'ye göre referans politikası her zaman istediğiniz ayrı bir kısıtlama olduğu).

```figure
ppo-clip
```

## Yapın

### Adım 1: Yakalama `log π_old(a | s)`Çıkarma zamanı

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

Fotoğraf bir kez çekilir, yayımlama sırasında.

### Adım 2: GAE avantajlarını hesaplayın (Deneyim 07)

A2C'nin aynı şeyi.

### Adım 3: Çıkarılmış yedek güncelleme

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

"Klip → sıfır gradient" modeli PPO'nun kalbidir. Yeni politika zaten yararlı yönde çok fazla ilerlediyse, güncelleme durur.

### Adım 4: Değer ve entropi

Kritik hedefe standart MSE ve A2C ile aynı şekilde aktörde entropi bonusu ekleyin.

### Adım 5: teşhis

Her güncellemeyi izlemek için üç şey:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$İçeride kalmalıydım .`[0, 0.02]`- Eğer geçmişte uçarsa .`0.1`, azaltmak`K_EPOCHS`veya `LR`- Evet .
- **Clip fraction** oranı dışta bulunan örneklerin bölümü $[1-\epsilon, 1+\epsilon]$Olmalı .`~0.1-0.3`- Eğer ...`~0`, klipi asla                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          `LR`veya `K_EPOCHS`- Eğer ...`~0.5+`- Bu yüzden, onları aşağı düşürmek için çok fazla ayarlıyorsun.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$Eleştirmen öğrendiği gibi 1'e doğru tırmanmalı.

## Tuzaklar

- **Clip coefficient mistuned.** $\epsilon = 0.2$Bu gerçek standart.`0.1`güncellemeleri çok çekingen kılar .`0.3+`- Durum dengesizliği.
- **Too many epochs.** $K > 20$politikası uzaklaşır.$\pi_{\text{old}}$Özellikle büyük ağlar için sınırlama dönemleri.
- **No reward normalization.**Büyük ödül ölçekleri, video aralığında yer alır.
- **Forgetting advantage normalization.**Satır başına sıfır ortalama/birlik std normallaştırma standarttır.
- **Learning rate not decayed.**PPO, doğrusal LR'nin sıfıra düşmesinden yararlanır.
- **Importance ratio math errors.**Her zaman .`exp(log_new - log_old)`sayısal istikrar için değil `new / old`- Evet .
- **Wrong gradient sign.**Yeraltı anneni en üst seviyeye çıkar = *minimize* $-L^{\text{CLIP}}$- Dönüştürülmüş bir işaret en yaygın PPO virüsüdür.

## Kullan

PPO, 2026'ın şaşırtıcı sayıda alan üzerinde varsayılan RL algoritmasıdır:

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

PPO * kayb şekli*  kesilmiş alternatif + değer + entropi  DPO, GRPO ve neredeyse her RLHF boru hattı için asfalt.

## Gönder

- Kaydet .`outputs/skill-ppo-trainer.md`- ...

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

## Egzersizler

1. **Easy.**4×4 GridWorld ' da PPO çalıştır $\epsilon=0.2, K=4$. Örnek verimliliğini A2C ile (her bir atılım için bir dönem) eşleşen çevre adımlarında karşılaştırın.
2. **Medium.**Tarama$K \in \lbrace 1, 4, 10, 30 \rbrace$- Plan geri dönüşü vs. çevre adımları ve takip ortalaması KL güncelleme başına.$K$KL bu görevde patlayacak mı?
3. **Hard.**Kısaltılan yer değiştiricisini uyarlayıcı bir KL cezası ile değiştirin ($\beta$iki katına çıkarılır.$\mathrm{KL} > 2 \cdot \text{target}$, yarıya düştü$\mathrm{KL} < \text{target}/2$) Son dönüşü, istikrarı ve çubuksuzluğu karşılaştırın.

## Anahtar Terimler

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

## Daha Fazla Okumak

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)- Gazete.
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477)TRPO, PPO'nun öncüsü.
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) her PPO hiperparametre silinmiş.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT; PPO-in-RLHF tarifi.
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html)PyTorch ile temiz modern bir sergileme.
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) Referans bir dosya PPO birçok makalede kullanılır.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) dil modellerinde PPO için üretim tarifi; Ders 09 (RLHF) ile birlikte okuyun.
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) "37 kod seviyesinde optimizasyon" makalesi; hangi PPO numaraları yük taşıyor ve hangiları folklor.
