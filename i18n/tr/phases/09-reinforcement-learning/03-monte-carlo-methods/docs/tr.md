# Monte Carlo Metodları  Tam Bölümlerden Öğrenmek

> Dinamik programlama bir modeli gerektirir. Monte Carlo'nun sadece bölümlere ihtiyacı var. Politikayı çalıştırın, getiriyi izleyin, ortalama yapın. RL 'deki en basit fikir ve her şeyi aşağıdaki akıntıda açan bir fikir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## Sorun

Dinamik programlama zarif ama sorular sorulabilir.$P(s' \mid s, a)$Bu, bir robotun kamera piksellerinin dağılımını analizle hesaplayamadığı anlamına gelir. Bir fiyatlandırma algoritması her olası müşteri tepkisine dahil edemez. Bir LLM bir token sonrası tüm olası devamları sayamaz.

Sadece çevreye örnek alma yeteneğine ihtiyacınız var.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`- Değerleri tahmin etmek için kullan.

DP'den MC'ye geçiş felsefi açıdan önemlidir: * bilinmiş modelden + tam yedekleme*'den * örnekle atılan uygulamalardan + ortalama geri dönüşe* geçiyoruz.

## Anlaşım

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$nerede$G^{(i)}(s)$ ziyaretlerden sonra yapılan ziyaretler$s$Politikası altında$\pi$- Evet .

**First-visit vs every-visit MC.**Bir bölümü göz önüne alarak , devletin ziyaretlerini yapıyorlar .$s$İlk ziyaret MC'si, ilk ziyaret MC'si sadece ilk ziyaretten gelen geri dönüşü sayır. Her ziyaret MC'si tüm ziyaretleri sayır. İlk ziyaret MC tarafsızdır. Her ziyaret MC, biten bir bölüm sayısından sonra biraz tarafsız olabilir, çünkü bölüm başına rastgele bir geri dönüş sayısını ortalama yapar ve bu sayı geri dönüşlerle ilişki kurabilir, ancak her ikisi de birleşti $V^\pi(s)$İlk ziyaret analiz etmek daha kolay (iid örnekleri). Her ziyaret bölüm başına daha fazla veri kullanır ve genellikle uygulamada daha hızlı bir şekilde birleşti.

**Incremental mean.**Tüm gönderileri depolamak yerine, çalışkan ortalamayı güncelle:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

Yeniden düzenlenir: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$- Evet .$\alpha = 1/n$- Değiş .$1/n$sabit bir adım boyutu için $\alpha \in (0, 1)$ve bir istasyonel olmayan MC tahmincisi elde edersiniz ki değişimleri izler $\pi$Bu hareket, MC'den TD'ye ve modern RL algoritmasına kadar bir atlama.

**Exploration is now a problem.**DP, her eyalete sayım yoluyla dokundu. MC sadece eyaletlerin politika ziyaretlerini görüyor.$\pi$Bu durum, bir devlet alanının tüm bölgelerinin asla örneklenmemesi ve değer tahminleri sonsuza kadar sıfırda kalması anlamına gelir.

1. **Exploring starts.**Her bölümü rastgele bir çiftten başlatın.
2. **ε-greedy.**Açgözlü davranın.$\epsilon$Tüm durum eylem çiftleri asimptotik olarak örneklenir.
3. **Off-policy MC.**Davranış politikası çerçevesinde veriler toplayın $\mu$, hedef politika hakkında bilgi edinmek $\pi$Yüksek farklılık, ama DQN gibi tekrar oynatma tamponu yöntemlerine bir köprü.

**Monte Carlo Control.**Değerlendirme → geliştirme → değerlendirme, politika tekrarlaması gibi, ancak değerlendirme örnekleme tabanlı:

1. Çık .$\pi$Bir bölüm al.
2. Güncelleme$Q(s, a)$Görülen sonuçlardan.
3. Yap .$\pi$E-cinsel açgözlülük.$Q$- Evet .
4. Tekrar ediyorum.

$Q^{\ast}$ve $\pi^{\ast}$Hafif koşullarda 1 olasılıkla (her çiftin sonsuz sıklıkla ziyaret edildiği)$\alpha$Robbins-Monro'yu tatmin eder.

```figure
epsilon-greedy
```

## Yapın

### Adım 1: başlat → listesi (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

- Model yok, sadece.`env.reset()`ve `env.step(s, a)`Spor ortamı gibi aynı arayüz ama soyulmuş.

### Adım 2: Hesaplama sonuçları (geri tarama)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

Bir geçiş.$O(T)$Geriye dönme .$G_t = r_{t+1} + \gamma G_{t+1}$Yeniden toplama yapmaktan kaçınır.

### Adım 3: İlk ziyaret MC değerlendirme

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

İş üç satırla yapılır: ilk ziyarette görüldüğü gibi işaret durumunu, artış sayısını, güncelleme çalıştırma ortalamasını.

### Dördüncü adım: E-cinsel MC kontrolü (politikal)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Adım 5: DP altın standardı ile karşılaştır

MC tahmininiz$V^\pi$Ders 02'nin DP sonuçlarıyla aynı fikirde olmalısınız.`~0.1`DP cevabının.

## Tuzaklar

- **Infinite episodes.**MC'nin bölümleri sona erdirmesi gerekiyor.`max_steps`GridWorld'in rastgele politikası normal olarak 'yi çıkartır.
- **Variance.**MC'nin tam geri dönüşleri kullanıyor. Uzun bölümlerde, fark büyük  bir şanssız ödül sonunda varyasyon $V(s_0)$TD yöntemleri (Leçon 04) bunu bootstrapping ile azaltıyor.
- **State coverage.**Açgözlü MC'ler, yeni bir Q'da bir kere bir şey yapmayı deneyecekler.
- **Non-stationary policies.**- Eğer$\pi$Bu durumlar, sürekli-α MC tarafından ele alınırken örnek ortalama MC tarafından ele alınmaz.
- **Off-policy importance sampling.**Ağırlıkları .$\pi(a \mid s)/\mu(a \mid s)$Bir yörüngede çarpma. Varians ufukta patlar. Kapı, karar başına ağırlıklı IS veya TD'ye geçiş.

## Kullan

2026 Monte Carlo yöntemlerinin rolü:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

Modern derin-RL algoritmaları (PPO, SAC) saf MC (tam geri dönüş) ve saf TD (bir adımlı başlangıç) arasında aralar.$n$- step return veya GAE. Her iki uç noktası da aynı tahminçinin örnekleri.

## Gönder

- Kaydet .`outputs/skill-mc-evaluator.md`- ...

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## Egzersizler

1. **Easy.**4×4 GridWorld'da ilk ziyaret MC değerlendirmesini uygulayın. 10.000 bölüm çalıştırın.$V(0,0)$Bölüm sayısının DP cevabına göre bir fonksiyonu olarak.
2. **Medium.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$20.000 bölümden sonra ortalama geri dönüşü karşılaştırın.
3. **Hard.***Politik dışı* MC'yi önemli örnekleme ile uygula: Teker teker rastgele politika çerçevesinde veriler toplamak $\mu$, tahmin$V^\pi$Determinizm en iyi politika için $\pi$- Basit IS vs. Kararlama IS vs. Ağır IS. En düşük varyansa hangisi?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## Daha Fazla Okumak

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) Kanonik tedavi.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) İlk ziyaret vs. her ziyaret analizleri.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) politika dışı MC ve varyansa kontrolü.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) Modern düşük varyasyonlı IS tahmincileri.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) MC/TD kendi oyununun insanüstü oyunlara doğru yaklaşıp ilk büyük ölçekli deneyimli gösterimi; bu aşamanın ikinci yarısında her dersin kavramsal öncüsü.
