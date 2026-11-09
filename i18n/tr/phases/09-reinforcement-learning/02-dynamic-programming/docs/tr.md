# Dinamik Programlama  Politika İterasyonu & Değer İterasyonu

> Dinamik programlama, aldatmacılık ile RL'dir.$V$veya $\pi$Bu, her örnekleme tabanlı yöntemin yaklaşmaya çalıştığı referans değeridir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## Sorun

Bilinen bir modelle bir MDP 'ye sahipsiniz: sorguya girebilirsiniz $P(s' \mid s, a)$ve $R(s, a, s')$Bu, bir envanter yöneticisi olarak talep dağılımını bilir. bir masa oyunu belirlenmiş geçişler vardır. bir gridworld Python'un dört satırı.

Modelsiz RL (Q-learning, PPO, REINFORCE) bir modeliniz olmadığı durum için icat edildi.  Sadece çevreye örnek alabilirsiniz. Ama bir tane olduğunda, daha hızlı, daha iyi yöntemler vardır: dinamik programlama. Bellman onları 1957'de tasarladı.

2026'da üç nedenden dolayı ihtiyaç duyarsınız. Birincisi, RL araştırmalarında her tablo ortamı (GridWorld, FrozenLake, CliffWalking) altın standart politikasını üretmek için DP ile çözülür.$V^{\ast}(s_0)$Üçüncü olarak, modern çevrimdışı RL ve planlama yöntemleri (MCTS, AlphaZero'nun arama, 9. · 10 aşamada model tabanlı RL) hepsi Bellman yedeklemeyi öğrenilen veya verilen bir model üzerinde tekrarlar.

## Anlaşım

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**Politika değişmezken iki adım değiştiriyor.

1. *Değerlendirme:* belirli politika $\pi$, hesaplama$V^\pi$Tekrar tekrar uygulayarak $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$Bir araya gelene kadar.
2. *Yenileştirme:* verildi $V^\pi$, yapın$\pi$Açgözlü bir hırsızlık .$V^\pi$- Evet .$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$- Evet .

Dönüşüm garanti edilir çünkü (a) her iyileştirme aşamasında ya $\pi$Aynı veya sıkı bir şekilde artıyor $V^\pi$Bazı devletler için (b) belirleyici politikaların alanı sınırlıdır. Genellikle büyük devlet alanları için bile ~520 dış iterasyonlarda birleşti.

**Value iteration.**Değerlendirme ve iyileştirme bir süpürgeye çöküyor. Bellman * optimizasyon * denklemini uygulayın:

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

$\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. Açgözlü eylemleri yaparak son politika çıkar. Yeterlikçe daha hızlı  iç değerlendirme döngüsü  ama genellikle daha fazla iterasyon konverje gerekir.

**Generalized policy iteration (GPI).**Birleştiren çerçeveleme. Değer fonksiyonu ve politika iki yönlü bir geliştirme döngüsünde kilitlenir; her iki yönü de karşılıklı tutarlılığa (asynk değer iterasyonu, değiştirilmiş politika iterasyonu, Q-öğrenme, aktör eleştirmeni, PPO) yönlendiren herhangi bir yöntem GPI'nin bir örneğidir.

**Why $\gamma < 1$ matters.**Bellman operatörü bir $\gamma$-Sup-norm'daki kısıtlama: $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$-Kısıtlama, benzersiz sabit nokta ve geometrik bir yakınlık anlamına gelir.$\gamma < 1$Ve garantiyi kaybedersen... ...bir sınırlı ufaklık veya absorber bir terminal durum gerekir.

```figure
value-iteration-gamma
```

## Yapın

### Adım 1: GridWorld MDP modeli oluştur

Ders 1'den aynı 4×4 GridWorld'u kullanın.`0.1`ajan rastgele dik yönde kayar.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)` listesi gönderir`(s', r, p)`Bu tüm model.

### Adım 2: Politika değerlendirme

Bir politika göre .`π(s) = {action: prob}`, Bellman denklemini tekrarlayalım .$V$hareket etmeyi durdurur:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### Adım 3: Politikayı iyileştirmek

Değiştir $\pi$Açgözlü politika ile.$V$- Eğer ...$\pi$Değişmemiş, geri dönmüş  en iyisindeyiz.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### Dördüncü adım: Bir araya getirin

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

4×4: 46 dış iterasyonlarında tipik bir yakınlık.$V^{\ast}(0,0) \approx -6$Ve adım sayısını kesinlikle azaltan bir politika.

### Adım 5: değer iterasyonu (bir döngü versiyonu)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

Aynı sabit nokta, daha az kod satırı.

## Tuzaklar

- **Forgetting to handle terminals.**Bellman'ı emekçi bir duruma uyguladığınızda, hiçbir şey değiştirmeyen "en iyi eylem" alır.`if s == terminal: V[s] = 0`- Evet .
- **Sup-norm vs L2 convergence.**Kullanım`max |V_new - V|`Teorik garanti sup-norma üzerinde.
- **In-place vs synchronous updates.**Güncelleme`V[s]`Yerde (Gauss-Seidel) ayrı bir `V_new`Üretim kodu yerinde kullanılıyor.
- **Policy ties.**Eğer iki işlem aynı Q değeri varsa,`argmax`Her iterasyonda farklı şekilde bağları kırmak, "politik istikrarlı" kontrolünün oscilansına neden olabilir.
- **State-space explosion.**DP $O(\lvert S \rvert \cdot \lvert A \rvert)$Bu işlemler, 107. durumlara kadar çalışmaktadır.

## Kullan

2026 yılında DP, planlamacıların doğruluk başlangıç çizgisi ve iç döngüsüdür:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

Birisi "optimal değer fonksiyonu" dediğinde, "DP sabit noktası" demek istiyorlar.$V^{\ast}$veya $Q^{\ast}$Bir kağıtda, bu döngüyü hayal edin.

## Gönder

- Kaydet .`outputs/skill-dp-solver.md`- ...

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Egzersizler

1. **Easy.**4×4 GridWorld'de değer iterasyonunu  ile çalıştır$\gamma \in \lbrace 0.9, 0.99 \rbrace$- Ne kadar süpürür ?$\max \lvert \Delta V \rvert < 10^{-6}$- Baskı$V^{\ast}$4×4 şebekesi olarak.
2. **Medium.*** Stochastic* GridWorld'de politika iterasyonu vs değer iterasyonu karşılaştırın (slip olasılığı `0.1`Sayım: süpürmeler, duvar saati, son $V^{\ast}(0,0)$- Hangi süreler daha hızlı bir şekilde dönüşüyor?
3. **Hard.**Değiştirilmiş politika tekrarını oluştur: değerlendirme aşamasında sadece çalıştır $k$- Birleştirilmek yerine tarar.$V^{\ast}(0,0)$hata vs $k$için$k \in \lbrace 1, 2, 5, 10, 50 \rbrace$Bu eğrilik değerlendirme/iyileştirme karşılığı hakkında size ne söylüyor?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## Daha Fazla Okumak

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) politika iterasyonunun ve değer iterasyonunun kanonik sunumu.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) Kısalaşma haritası argümanlarının sıkı şekilde ele alınması.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) modifi politikayı tekrarlama ve onun yakınlaştırma analizi.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) orijinal politika tekrarlama kağıdı.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) DP'den yaklaşık DP/ derin RL'ye kadar her sonraki dersde kullanılan köprü.
