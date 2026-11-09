# Çoklu ajanlı RL

> Tek ajan RL, ortamın sabit olduğunu varsayır. Aynı dünyada iki öğrenme ajanı koyun ve bu varsayım bozulur: her ajan diğerinin ortamının bir parçasıdır ve her ikisi de değişiyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## Sorun

Bir robot bir odayı gezinmeyi öğrenir. Tek ajan RL problemi. Bir futbol takımı değil. AlphaStar vs StarCraft rakipleri değil. Teklif yapan ajanların pazarı değil. Dört yönli durak müzakere eden iki araba değil. Birçok gerçek dünya sorunları değil.

Her çoklu ajan ortamında, herhangi bir ajanın bakış açısından diğer ajanlar * çevrenin bir parçasıdır. Öğrenirken ve davranışlarını değiştirirken, çevre sabit değil hale gelir. Markov özelliği  "sonraki devlet sadece mevcut durum ve benim eylemden"  ihlal edilir çünkü sonraki devlet de * diğer* ajanların seçtiği şeye bağlıdır ve politikaları hedefleri hareket ettirir.

Bu, tablolar birleştirme kanıtlarını kırar (Q-learning'in garantisi sabit bir ortamı varsayır). Bu da saf derin RL'yi kırar: ajanlar birbirlerini döngülerde kovalar, asla sabit bir politikaya birleştiler. Çoklu ajan özel tekniklerine ihtiyacınız var: merkezi eğitim / merkezi olmayan yürütme, karşı gerçeklik tabanları, lig oyunu, kendiliğinden oyun.

2026 uygulamaları: robot sürüleri, trafik yönlendirme, otonom araç filosları, piyasa simülatörleri, çoklu ajanlı LLM sistemleri (Fase 16) ve birden fazla akıllı oyunculu olan herhangi bir oyun.

## Anlaşım

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**MDP'nin genelleşmesi: devletler $S$, ortak bir eylemdir.$a = (a_1, \ldots, a_n)$, geçiş$P(s' \mid s, a)$, ve ajan başına ödüller .$R_i(s, a, s')$Her ajan .$i$Kendi politikası altında kendi getiriyi en üst düzeye çıkarır.$\pi_i$Eğer ödüller aynı ise, o da aynı.**fully cooperative**Eğer sıfır toplamsa, o da **adversarial**Karışıksa, öyle.**general-sum**- Evet .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$Ajanın .$i$Görüşün değişeceğine .$\pi_{-i}$, değişen bir durum.
- **Credit assignment.**Paylaşılan bir ödülle, hangi ajanın nedeni buydu?
- **Exploration coordination.**Ajanlar, aynı durumu gereksiz yere araştırmak yerine, tamamlayıcı stratejileri keşfetmelidir.
- **Scalability.**Ortak eylem alanı $n$- Evet .
- **Partial observability.**Her ajan sadece kendi gözlemini görür; küresel durum gizlidir.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**Her ajan kendi Q veya politikasını öğrenir, diğerlerini çevrenin bir parçası olarak görüyor. Basit, bazen işe yarıyor (özellikle deneyim tekrarlamasıyla akıcı bir ajan modeli hilesi olarak hareket eder).

**2. Centralized training, decentralized execution (CTDE).**Modern paradigmaların en yaygını.$\pi_i$Yerel gözlem koşulları $o_i$ standard merkezi olmayan uygulamalar dağıtım sırasında.$Q(s, a_1, \ldots, a_n)$Dünya durumu ve ortak eylem konusunda koşullar.
- **MADDPG**(Lowe et al. 2017): DDPG, her ajan için merkezi bir eleştirmen ile.
- **COMA**(Foerster et al. 2017): karşı gerçekli bir başlangıç  sor "Eğer harekete geçseydim ödülüm ne olurdu $a'$Bunun yerine?"  katkılarımı bir kenara ayırır.
- **MAPPO**- Ne ?**IPPO**ortak eleştirmenle (Yu et al. 2022): Merkezi bir değer fonksiyonu olan PPO. 2026 yılında kooperatif MARL için baskın.
- **QMIX**(Rashid et al. 2018): değer parçalanması  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$- Tek kelimeyle karıştır.

**3. Self-play.**Aynı ajanın iki kopyası birbirini oynar. Rahatsız eden politika * geçmiş bir anlık fotoğrafımdan benim politikamdır. AlphaGo / AlphaZero / MuZero. OpenAI Beş.

**4. League play.**Self-play'ın genel toplam / karşıma ortamlara genişletilmesi: geçmiş ve mevcut politikaların bir nüfusunu tutun, ligten bir rakibi örnekleyin, onlara karşı eğitiniz. İstifadeleri (sağlam en iyiyi yenmek için uzmanlaşmış) ve ana sömürücüleri (sömürücüleri yenmek için uzmanlaşmış) ekler. AlphaStar (StarCraft II).

**Communication.**Ajanların öğrenilmiş mesajlar göndermesine izin verin .$m_i$Foerster et al. (2016) farklılaştırılabilir ajanlar arası iletişimin sonundan sona kadar eğitilebileceğini gösterdi. Bugünün LLM tabanlı çoklu ajan sistemleri (Fase 16) esasen doğal dilde iletişim kurar.

```figure
f3-marl-orbit
```

## Yapın

Bu ders, iki işbirlikçi ajanla birlikte 6×6 GridWorld kullanır.`-1`Bir ajan hareket ederken,`+10`İkisi de geldiğinde.`code/main.py`- Evet .

### Adım 1: Çoklu ajan ortamı

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

* ortak * eylem alanı `|A|² = 16`Küresel durum iki pozisyondur.

### Adım 2: Bağımsız Q öğrenimi

Her ajan ortak durumdaki kendi Q-tablosunu çalıştırır. Her adımda: ikisinin de ε-cinsel eylemleri seçmesi, ortak geçiş toplaması, her biri kendi Q'sini paylaşılan ödülle güncelleştirir.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

Bu görevde çalışır çünkü ödüller yoğun ve uyumludur. Yakından ilişkili görevlerde başarısız olur (örneğin bir ajanın diğerini * beklemelidir).

### Adım 3: Çürütülen değer güncelleme ile merkezi Q

Birlikte yapılan eylemlere bir Q kullanın $Q(s, a_1, a_2)$. Paylaşılan ödülden güncelleme.$\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$* Doğru* küresel görüş için eksponensel ortak eylem alanı ticaret.

### Adım 4: Basit kendi oyun (adversarial 2-agent)

Aynı ajan, iki rol.$K$A'nın ağırlıklarını B'ye kopyalayıp simetrik eğitim, sürekli ilerleme.

## Tuzaklar

- **Non-stationary replay.**Bağımsız ajanlarla deneyime tekrar yapmak tek ajanla oynayanlardan daha kötüdür çünkü eski geçişler artık eskileri tarafından oluşturuldu.
- **Credit assignment ambiguity.**Uzun bir bölümden sonra paylaşılan ödül; hangi ajanın katkıda bulunduğunu belirlemek için kesin bir yol yok.
- **Policy drift / chasing.**Her ajanın en iyi tepkisi diğerlerinin güncellemesiyle değişir.
- **Reward hacking via coordination.**Agentler tasarımcı tarafından öngörülmemiş koordine edilmiş başarılar bulurlar. Satış ajanları sıfır tekliflere doğru birleştiler.
- **Exploration redundancy.**Her iki ajan da aynı durum aksiyon çiftlerini araştırıyor.
- **League cycles.**Temiz kendi oyunları bir dominanç döngüsünde sıkışır.
- **Sample explosion.** `n`Ajanlar × devlet alanı × ortak eylemler. Fonksiyon yakınlaması ile yaklaşır; faktörlü eylem alanları (her ajan için bir politika çıkış başı).

## Kullan

2026 MARL başvuru haritası:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

MARL'nin 2026 yılında en büyük büyüme alanı LLM tabanlı: dil modelleri ajanlarının sürüleri pazarlık, tartışma, yazılım oluşturma.

## Gönder

- Kaydet .`outputs/skill-marl-architect.md`- ...

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Egzersizler

1. **Easy.**2. Ajanlı kooperatif GridWorld'de bağımsız Q-öğrenme eğitimi.
2. **Medium.**Bir "koordinasyon" görevi ekleyin: hedef ancak her iki ajan aynı virajda ona adım atınca ulaşılır.
3. **Hard.**MAPPO tarzı eğitim için merkezi bir eleştirmen uygulayın ve koordine görevi için bağımsız PPO ile konverjense hızını karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## Daha Fazla Okumak

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) Merkezli bir eleştirmenle CTDE.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) kredi tahsisine karşı gerçeklik bazları.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) değer parçalanması monotonlukla.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)PPO MARL için şaşırtıcı derecede güçlü.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) Lig oynamak ölçekte.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) sıfır toplam oyunlarında saf bir oyun.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) ders kitabının çoklu ajan ayarlarının kısa süreli olarak ele alınması ve CTDE'nin çözmesi için tasarlanmış olan istasyonarlık olmayan sorun içerir.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) Kooperatif, rekabetçi ve karışık MARL'yi kapsayan ve dönüşüm sonuçları ile sonuçlanan anket.
