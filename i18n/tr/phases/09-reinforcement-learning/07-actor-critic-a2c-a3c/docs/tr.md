# Aktör-Kritik  A2C ve A3C

> ReINFORCE gürültülü, öğrenen bir eleştirmen ekle.$\hat{V}(s)$A2C, sinkron olarak çalışır, A3C ise ipler arasında çalışır. Her ikisi de modern derin-RL yönteminin zihinsel modelidir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## Sorun

Vanilla REINFORCE işe yarıyor ama farkı korkunç.$G_t$Bu sesleri 10 katına çarparak çarpıyor.$\nabla \log \pi$ve ortalama bir gradient tahmincisi üretir. Bu politikaları daha az DQN güncellemeleri ile taşıyabileceğiniz mesafeyi taşımak için binlerce bölüm alıyor.

Değişiklik çiğ geri dönüş kullanılarak ortaya çıkar.$b(s_t)$ öğrenilen bir değer de dahil olmak üzere herhangi bir durum fonksiyonu  beklenti değişmez ve varyansa düşer. En iyi ele alınan temel çizgi $\hat{V}(s_t)$Şimdi miktar çarpı.$\nabla \log \pi$* avantaj*:

```math
A(s, a) = G - \hat{V}(s)
```

Bir eylem ortalama üzerinde bir getiri üretirse iyi olur; aşağıda ise kötüdür. Öğrenmiş bir eleştirmen ile REINFORCE *actor-critic*. eleştirmen, aktörü düşük değişkenlik öğretmeni yapar. Bu 2015'ten sonra tüm derin politika yöntemleri (A2C, A3C, PPO, SAC, IMPALA).

## Anlaşım

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$Politikası. Yürümeye örneklenmiş. Politikası derecesi ile eğitilmiş.
- **Critic** $V_\phi(s)$Bu nedenle, bu durumun en az bir şekilde azaltılması için eğitilmiştir.$(V_\phi(s) - \text{target})^2$- Evet .

**The advantage.**İki standart form:

- *MC avantajı:* $A_t = G_t - V_\phi(s_t)$Tarafsız, daha yüksek bir değişim.
- *TD avantajı:* $A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. Tarafsız (kullanımlar $V_\phi$*TD geri kalanı* olarak da adlandırılır.$\delta_t$- Evet .

**n-step advantage.**İkisi arasında bir arada dur:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$saf TD.$n = \infty$MC'dir. Çoğu uygulamada kullanılır $n = 5$Atari için,$n = 2048$MuJoCo'da PPO için.

**Generalized Advantage Estimation (GAE).**Schulman et al. (2016) tüm n-adım avantajları üzerinde eksponensel olarak ağırlanan bir ortalama önerdi:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

- Evet .$\lambda \in [0, 1]$- Evet .$\lambda = 0$TD ( düşük değişkenlik, yüksek önyargı). $\lambda = 1$MC (yüksek farklılık, tarafsızlık)$\lambda = 0.95$2026'da, öntanımlı  ayarı, öntanımlı/varians diyalığı istediğiniz yere kadar.

**A2C: synchronous advantage actor-critic.**Toplayın .$T$Dönüşümler $N$Paralel ortamlar. Her adım için avantajlar hesaplayın. Birleştirilmiş seri için aktör ve eleştirmeni güncelleyin. Tekrarla.

**A3C: asynchronous advantage actor-critic.**Mnih et al. (2016). Spawn $N$İşçi ipleri, her biri bir çevre çalıştırır. Her işçi kendi dağıtımında yerel olarak gradientleri hesaplar, sonra eşzamanlı olarak paylaşılan bir parametre sunucusuna uyguluyor. Hiçbir tekrarlama tamponu gerekmez  işçiler farklı yörüngeler çalıştırarak dekorrele. A3C ölçekte CPU'larda eğitim alabileceğini kanıtladı. 2026'da, GPU tabanlı A2C (batched parallel envs) baskın çünkü GPU'lar büyük partiler istiyor.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

Üç şart: politika derecesi kaybı, değer gerileme, entropi bonusu. `c_v ~ 0.5`- Evet .`c_e ~ 0.01`Kanonik başlangıç noktalarıdır.

```figure
actor-critic
```

## Yapın

### Adım 1: eleştirmen

Düzsel eleştirmen$V_\phi(s) = w \cdot \text{features}(s)$MSE ile güncelleştirilmiştir:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

Bir tablo ortamında eleştirmen birkaç yüz bölümde bir araya gelir. Atari'de, çizgisi eleştirmeni CNN'in paylaşılan bir çekirdek + değer başlığı ile değiştirin.

### Adım 2: N-adım avantajı

Uzunluktan dolayı .$T$Ve bir de bir final.$V(s_T)$- ...

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`eleştirmen hedef.`advantages`- Çokluyor.$\nabla \log \pi$- Evet .

### Adım 3: birleşik güncelleme

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

Politikada, her güncelleme için bir çıkış, aktör ve eleştirmen için ayrı öğrenme oranları.

### Adım 4: paralellik (A3C vs. A2C)

- **A3C:**Çekil $N$Her biri kendi env ve kendi ileri geçişini yürütür. Periodik olarak gradient güncelleştirmeleri paylaşılmış bir usta.
- **A2C:**Çıkış$N$Tek bir süreçte örnekler oluşturmak, gözlemleri bir `[N, obs_dim]`Batch, batch forward pass, batch backward pass daha yüksek GPU kullanımı, belirleyici, akıl yürütmek daha kolay.

Oyuncak kodumuz netlik için tek iplik; A2C'ye yeniden yazmak üç satır numpy.

## Tuzaklar

- **Critic bias before actor gradient.**Eğer eleştirmen rastgele ise, temel çizgisi bilgilendirici değil ve saf gürültü üzerinde eğitim veriyorsunuz.
- **Advantage normalization.**Parçaya sıfır ortalama/birlik std'ye avantajları normalleştirir.
- **Shared trunk.**Görüntü girişlerinde oyuncu ve eleştirmen için ortak bir özellik çıkarıcı kullanın. Ayrı başlar. Paylaşılan özellikler her iki kayıpta da serbest sürüş.
- **On-policy contract.**A2C, verileri tam bir güncelleme için tekrar kullanır. Daha fazla ve gradiyenti tarafsızdır (PPO'nun eklediği önemlilik örneği düzeltmesidir).
- **Entropy collapse.**- Hayır .$c_e > 0$Bu politika birkaç yüz güncelleme ile neredeyse belirlenmiş hale gelir ve araştırmayı bırakır.
- **Reward scale.**Avantaj büyüklükleri ödül ölçeğine bağlıdır. Görevler arasında tutarlı gradient büyüklükleri için ödülleri (örneğin, çalıştırma-std bölüşmesi) normallaştırın.

## Kullan

A2C/A3C 2026'da nadiren son seçimdir ama sonraları en iyi yapılan mimarlıklardır:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

2026'da bir makalede "kalah" görürseniz, oyuncu eleştirmeni düşünün.

## Gönder

- Kaydet .`outputs/skill-actor-critic-trainer.md`- ...

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Egzersizler

1. **Easy.**MC avantajı olan aktör-kritikleri eğit $(G_t - V(s_t))$Örnek verimliliğini ders 06'tan REINFORCE-with-running-mean baseline ile karşılaştırın.
2. **Medium.**TD-salı avantajına geçin $(r + \gamma V(s') - V(s))$- Avantaj partilerinin farkını ölç.
3. **Hard.**GAE'yi uygula.$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$Bu görevin önyargısı/varians tatlı noktası nerede?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## Daha Fazla Okumak

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C, orijinal asynk aktör-kritik kağıdı.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) Temeller; eleştirmen bir sinir ağı olduğunda fonksiyon yaklaşımıyla ilgili 9. bölüm ile eşleştirin.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) V- izleme politika dışı düzeltme ile ölçeklenebilir dağıtılı aktör eleştirmen.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) üretim A2C/PPO uygulamaları okumaya değer.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) iki katlı aktör-kritik parçalanma için temel bir yakınlaşma sonucu.
