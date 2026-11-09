# Zaman Farkı  Q-Learning & SARSA

> Monte Carlo, bölümün sonunu bekliyor. TD, bir sonraki değer tahminini başlatarak her adımdan sonra güncelleyecek. Q-öğrenme politika dışı ve iyimser; SARSA politika içindedir ve dikkatlidir. Her ikisi de bir kod satırı. Her iki yöntemi bu aşamada derin-RL yönteminin temelini oluşturur.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## Sorun

Monte Carlo çalışıyor ama iki pahalı talebe sahiptir. Son bölümlerin sona ermesi gerekiyor ve son dönüşün geldiği zaman güncelleştirilir. Eğer bölümünüz 1000 adım ise MC herhangi bir şeyi güncellemek için 1.000 adım bekler. Yüksek çeşitlilik, düşük önyargı ve pratikte yavaş.

Dinamik programlamanın ters profilü vardır  sıfır varyasyonlı bootstrapped yedekleme  ancak bilinen bir modeli gerektirir.

Zaman farkı (TD) öğrenme farkı ayırır.$(s, a, r, s')$, tek adımlı bir hedef oluşturun .$r + \gamma V(s')$Ve itmek .$V(s)$- Model yok, episodlar yok, yaklaşık bir kısım kullanmaktan dolayı.$V$RHS'de, ancak MC ve çevrimiçi güncellemelerden çok daha düşük bir değişim.

Bu modern RL  DQN, A2C, PPO, SAC 'nin dönüşü olan bir merkezdir. 9. Fase'nin geri kalanı bu dersde yazacağınız tek adımlı TD güncelleme üzerine inşa edilen fonksiyon yaklaşımını ve hilelerini oluşturur.

## Anlaşım

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

Çekilen miktar TD hatasıdır $\delta = r + \gamma V(s') - V(s)$Bu internet analogi .$G_t - V(s_t)$MC'de. Dönüşüm gerektirir.$\alpha$Robbins-Monro'nun hoşnutluğunu$\sum \alpha = \infty$- Evet .$\sum \alpha^2 < \infty$) ve tüm eyaletler sonsuz sıklıkla ziyaret edildi.

**Q-learning.**Kontrol için politika dışı bir TD yöntemi:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

- Evet .`max`* açgözlülük* politikası takip edileceğini varsayır.$s'$Bu kopyalanma, Q öğrenmeyi öğrenir.$Q^{\ast}$Mnih et al. (2015) bunu Atari'de derin Q öğrenimine dönüştürdü (Desin 05).

**SARSA.**Politikada TD yöntemi:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

Adı tuple .$(s, a, r, s', a')$SARSA bu eylemden yararlanıyor .$a'$*Agent* gerçekte* # # sonra alır, açgözlü değil.`argmax`- Dönüştüğü$Q^\pi$- Ne kadar açgözlüyse .$\pi$- Evet. - Evet.$\epsilon \to 0$$Q^{\ast}$- Evet .

**The cliff-walking difference.**Klasik uçurum yürüyüşü görevinde (kuşağın düşmesi = ödül -100), Q-öğrenme uçurum kenarında en iyi yolu öğrenir, ancak ara sıra keşif sırasında ceza alır. SARSA, keşif gürültüsünü Q değerine dahil ettiği için uçurumdan bir adım uzakta daha güvenli bir yol öğrenir.$\epsilon \to 0$. Pratikte önemli: keşif gerçekte yerleştirilmekteyken, SARSA'nın davranışları daha muhafazakârdır.

**Expected SARSA.**Değiştir $Q(s', a')$Beklenen değeri $\pi$- ...

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

SARSA' dan daha düşük bir varyansa (sırın $a'$Bu, modern ders kitaplarında genellikle standart olarak kullanılır.

**n-step TD and TD(λ).**TD(0) ve MC arasında bekleme yoluyla aralaştır $n$Baştan çıkmadan önce adımlar atın. $n=1$TD'dir.$n=\infty$MC. TD(λ) ortalamaları tüm $n$Geometri ağırlıkları ile $(1-\lambda)\lambda^{n-1}$En çok derin RL kullanımı$n$3 ila 20 arasında.

```figure
qlearning-gridworld
```

## Yapın

### Adım 1: Kıskançlık politikası üzerine SARSA

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

8 satır. Q öğrenme ile * tek* fark hedef satır.

### Adım 2: Q öğrenme

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

- Evet .`max`Bu bir sembol politika içi ve dışı politika arasındaki fark.

### Adım 3: Öğrenme eğri

100 bölüm başına geri dönüş ortalaması. Q-öğrenme basit belirleyici GridWorld'da daha hızlı bir şekilde birleşti. SARSA, uçurum yürüyüşünde daha muhafazakardır.`code/main.py`Her ikisi de yaklaşık 2000 bölümden sonra en iyi şekilde yapılıyor .$\alpha=0.1, \epsilon=0.1$- Evet .

### Dördüncü adım: DP gerçeği ile karşılaştır

Çalışma değerinin tekrarlanması (Denevi 02) elde etmek için $Q^{\ast}$- Kontrol et .$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$Sağlıklı bir tablolar TD ajanı `~0.5`4×4 GridWorld'da 10.000 bölümden sonra.

## Tuzaklar

- **Initial Q values matter.**Optimistik başlangıç ($Q = 0$Bu nedenle, bu durumun bir sonucu olarak, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir kişinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerinin, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğerine, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir diğer, bir, bir, bir diğer, bir, bir, bir diğer, bir, bir, bir diğer, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir, bir
- **α schedule.**Sürekli .$\alpha$-Sitasyonel olmayan sorunlar için iyi.$\alpha_n = 1/n$teoride bir uyum sağlar ama pratikte çok yavaş  pin $\alpha$İçeride`[0.05, 0.3]`Öğrenme eğrisini izle.
- **ε schedule.**Yüksek başlayın ($\epsilon=1.0$), ıkışmaya$\epsilon=0.05$"GLIE" (sonsuz keşifle sınırda açgözlülük) bir yakınlık şartıdır.
- **Max bias in Q-learning.**- Evet .`max`Operatör yukarı tarafa eğilimi gösterir.$Q$Hasselt'in Çift Q öğrenimi (DDDQN tarafından Ders 05) bunu iki Q tablosu ile düzeltir.
- **Non-terminating episodes.**TD, terminal olmadan öğrenebilir, ancak ya adımları kapalı tutmanız veya başlatma çubuğunu başlatmanız gerekir. Standart: başlatmayı terminal olmayan olarak değerlendirin, başlatmayı sürdürün.
- **State hashing.**Eğer durumlar tuples/tenzorlar ise, bir hashable anahtar kullanın (toplo, listesi değil; toplu, çiğ değil yuvarlanmış yüzenler).

## Kullan

2026 TD manzarası:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

2026 makalelerinde okuduğunuz "RL"lerin yüzde 90'ı, Q-öğrenme veya SARSA'nın bir çeşit geliştirmesidir.

## Gönder

- Kaydet .`outputs/skill-td-agent.md`- ...

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Egzersizler

1. **Easy.**4×4 GridWorld'de Q-öğrenme ve SARSA uygulaması. 2000 bölüm için plan öğrenme eğri (100 bölüm başına ortalama dönüş) uygulayın.
2. **Medium.**Klip yürüyüş ortamı oluşturun (4×12, son satır ödül -100 ile klip ve başlangıç için yeniden ayarlayın). Q-öğrenme ve SARSA son politikalarını karşılaştırın. Her birinin aldığı yolları ekran görüntüsü. Klipten hangisi daha yakın?
3. **Hard.**Gürültülü bir ödül GridWorld'de (Gaussian noise) iki kat Q öğrenimi uygula.$\sigma=5$(Hızlı bir eğitim ve eğitim)$V^{\ast}(0,0)$İki kez öğrenmek, iki kez öğrenmek değil.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Daha Fazla Okumak

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) orijinal kağıt ve yakınlık kanıtı.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, Q-öğrenme, Beklenen SARSA.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) Maksimumlama tercihleri için düzeltme.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) beklenen SARSA motivasyonu.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) SARSA'yı (o zaman "değiştirilmiş bağlantılı Q-öğrenme" olarak adlandırılan) ortaya koyan kağıt.
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) TD(0) ile TD(n'e genelleştirir.
