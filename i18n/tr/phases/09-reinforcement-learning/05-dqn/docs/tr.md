# Derin Q-Ağlar (DQN)

> 2013: Mnih, çiğ pikseli üzerinde bir Q-öğrenme ağı eğitmiş, yedi Atari oyununda her klasik RL ajanını yenmiştir. 2015: 49 oyunlara kadar uzattı, Nature'de yayınlanmıştır, derin-RL çağını tetikledi. DQN, işlev yaklaşımını istikrarlı hale getiren üç numara ile birlikte Q-öğrenme.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## Sorun

Tablolar Q öğrenme, her çift için ayrı bir Q değere ihtiyaç duyar. Bir satranç tahtasında ~1043 devlet vardır. Atari çerçevesinin 210 × 160 × 3 = 100,800 özellik vardır. Tablolar RL binlerce devlette ölür, milyarlarca bile olmaz.

Çözüm, geriye bakıldığında açık: Q-tabloyu nöral ağla değiştirin.$Q(s, a; \theta)$Ancak açık-görünen geriye bakış on yıllar sürdü. Saçma fonksiyon yaklaşımı ve Q öğrenimi "ölümlü üçlü"  fonksiyon yaklaşımı + başlangıç + politika dışı öğrenme altında ayrılır. Mnih et al. (2013, 2015) öğrenmeyi istikrarlandıran üç mühendislik hilesi tanımladı:

1. **Experience replay**Decorrelates geçişler.
2. **Target network**Başlangıç hedefini dondururur.
3. **Reward clipping**- Bu, gradient büyüklüklerini normalleştirir.

Atari'deki DQN, tek bir hiperparametre seti ile tek bir mimarinin ilk kez çiğ piksellerden düzinelerce kontrol sorunu çözmesiydi. DDQN, Rainbow, Dueling, Distributional, R2D2, Agent57 'den sonra inşa edilen her şey bu üç numara tabanının üzerine yığılmıştı.

## Anlaşım

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**DQN, sinirsel bir Q fonksiyonunda tek adımlı TD kaybını en aza indirgerir:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= çevrimiçi ağ, her adım gradient düşüşe göre güncellenir. $\theta^-$= hedef ağ, düzenli olarak kopyalanır $\theta$(Her ~ 10.000 adım).$D$= geçmiş geçişlerin yeniden oynatma tamponu.

**The three tricks, in order of importance:**

**Experience replay.**Bir yüzük tamponu .`~10⁶`Bu, zamansal ilişkiyi kırar (sükseces çerçeveler neredeyse aynıdır), ağın nadir ödüllendirici geçişlerden birçok kez öğrenmesine izin verir ve ardıcıl gradient güncellemelerini dekorele eder.

**Target network.**Aynı ağı kullanıyor $Q(\cdot; \theta)$Bellman denkleminin her iki tarafında hedef her güncelleme hareket eder  "kendin kuyruk peşinde".$Q(\cdot; \theta^-)$Dondurulmuş ağırlıklarla.$C$Adımlar, kopya $\theta \to \theta^-$Bu, gerileme hedefini bir seferde binlerce gradient adımları için istikrarlı hale getirir.$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(DDPG, SAC'da kullanılır) daha düzgün bir variandır.

**Reward clipping.**Atari ödül büyüklükleri 1 ila 1000 + arasında değişir.$\lbrace-1, 0, +1 \rbrace$Ödül büyüklüğü önemli olduğunda yanlış, sadece imza önemli olduğunda Atari için iyi.

**Double DQN.**Hasselt (2016) maksimum önyargıyı düzeltir: eylem * seçmek için çevrimiçi ağ kullanın, hedef ağ * değerlendirmek için.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

Değiştirme, sürekli daha iyi.

**Other improvements (Rainbow, 2017):**öncelikli tekrarlama (öntem yüksek TD hata geçişleri daha fazla), düello mimarisi (ayrı $V(s)$ve avantaj başları), gürültülü ağlar (öğrenmiş keşif), n-adım geri dönüşü, dağılımlı Q (C51/QR-DQN), çok adımlı başlangıç. Her biri birkaç yüzde ekler; kazançlar yaklaşık olarak eklenir.

```figure
f3-dqn-stability
```

## Yapın

Burada kod sadece stdlib-numpy-free. küçük bir sürekli GridWorld'de elle yuvarlanan tek katmanlı MLP kullanıyoruz, bu yüzden her eğitim adımı mikrosekonda çalışır. Algoritm Atari DQN'e eşit ölçekte.

### Adım 1: Yeniden oynatma tamponu

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

~ Atari için orijinal DQN'de olduğu gibi 106 kapasite (öğrenme başlamadan önce 50.000 geçiş toplar); Oyuncak çevremiz için 5.000 yeterlidir.

### Adım 2: Küçük bir Q-ağı (elçi MLP)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Ön geçit: doğrusal → ReLU → doğrusal.

### Adım 3: DQN güncelleme

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

Şekil, iki farklılık ile Ders 04'ten Q-öğrenme şeklidir: (a) farklılıklara sahip bir $Q(\cdot; \theta)$Bir tabloyu indeksilemek yerine, (b) hedef kullanımı $Q(\cdot; \theta^-)$- Evet .

### Dördüncü adım: Dış döngü

Her bölümde, $Q(\cdot; \theta)$, tampona geçişleri itmek, minibatch örneğini almak, bir gradient adımını atmak, zaman zaman senkronize etmek$\theta^- \leftarrow \theta$- Şablon:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

16 boyutlu bir sıcaktan ibaret küçük GridWorld'da, ajan yaklaşık 500 bölümde en iyi politika öğrenir. Atari'de bunu 200M çerçeveye kadar ölçeklendirin ve CNN özellikleri çıkarıcısı ekleyin.

## Tuzaklar

- **Deadly triad.**Fonksiyon yaklaşımı + politika dışı + başlangıç kaydetimi farklı olabilir. DQN hedefi ağ + tekrar ile hafifletiyor; ikisini de kaldırmayın.
- **Exploration.**E-net, genellikle ilk %10 eğitim sırasında 1.0 ila 0.01 arasında bozulmalıdır.
- **Overestimation.** `max`Sesli Q'dan yukarı tarafsızdır.
- **Reward scale.**Ödülleri kes veya normalleştir; gradient büyüklüğü ödül büyüklüğüne orantılıdır.
- **Replay buffer coldstart.**Buffer birkaç bin geçiş yapana kadar antrenman yapmayın.
- **Target sync frequency.**Çok sık ≈ hedef ağı yok; çok nadir ≈ eskileri hedefler. Atari DQN 10.000 env adımları kullanır.
- **Observation preprocessing.**Atari DQN, Markov durumu oluşturmak için 4 çerçeve yığar.

## Kullan

2026 yılında DQN nadiren en son teknolojiye sahip ancak politika dışı referans algoritması olarak kalır:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

SAC, TD3, DDPG, SAC-X, AlphaZero'nun kendi kendine oynatma tamponu ve her çevrimdışı RL yöntemi boyunca tekrar oynatma ve hedef ağlar görünür. Ödüllü kesim PPO'da avantaj normallaşması olarak yaşar. Mimarlık bir tasarımdır.

## Gönder

- Kaydet .`outputs/skill-dqn-trainer.md`- ...

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## Egzersizler

1. **Easy.**Çık .`code/main.py`-Episod başına geri dönüş eğriyi çiz.
2. **Medium.**Hedef ağını devre dışı bırakın (Bellman hedefinin her iki tarafı için çevrimiçi ağ kullanın).
3. **Hard.**Çift DQN ekle: seçmek için çevrimiçi ağ kullan `argmax a'`, hedef ağ değerlendirmek için.`Q(s_0, best_a)`Gerçek karşısında$V^{\ast}(s_0)$1000 bölümden sonra gürültülü bir ödül GridWorld'da Double DQN'de karşı karşıya kalmadı.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## Daha Fazla Okumak

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) Derin RL'ye başlayan 2013 NeurIPS atölyesi makalesi.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) Nature gazetesi, 49 oyun DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581)DQN'de dövüş.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)- Yapacakları kağıt.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) DQN'nin hedef ağının ve tekrarlama tamponu tarafından kontrol altına alınması için tasarlanmış olan "ölümlü üçlü" (fonksiyon yaklaşımı + başlatma + politika dışı) ders kitabı tedavisi.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) Ablation çalışmalarında kullanılan tek dosya DQN referansı; bu dersin sıfırdan versiyonu ile birlikte okumak iyi.
