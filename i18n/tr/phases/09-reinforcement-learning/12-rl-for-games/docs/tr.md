# Oyunlar için RL  AlphaZero, MuZero ve LLM-Düşünme Çağı

> 1992: TD-Gammon, saf TD ile backgammon'da insan şampiyonlarını yendi. 2016: AlphaGo Lee Sedol'u yendi. 2017: AlphaZero, satranç, shogi ve Go'yu sıfırdan baskın etti. 2025: DeepSeek-R1 aynı tarifleri kanıtladı.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## Sorun

Oyunlar RL'nin istediği her şeye sahiptir. Temiz ödül ( Kazanç / Kaybetme). Sonsuz bölümler (kendini oynayan yeniden ayarlamalar). Mükemmel simülasyon (oyun * simülatördür). Diskret veya küçük sürekli eylem alanları. Karşılıklı dayanıklılığı zorlayan çoklu ajan yapısı.

Ve oyunlar, RL'nin her büyük keşfi test edildiği bir yöntem. TD-Gammon (Backgammon, 1992). Atari-DQN (2013). AlphaGo (2016). AlphaZero (2017). OpenAI Five (Dota 2, 2019) AlphaStar (StarCraft II, 2019). MuZero (bilimli model, 2019). AlphaTensor (matris çarpımı, 2022). AlphaDev (sortlama algoritmaları, 2023). DeepSeek-R1 (Matematika mantığı, 2025)  oyun-RL tekniklerinin metinde çalıştığını gösteren en son gösterim.

Bu baş taşı, üç önemli mimarisi  AlphaZero, MuZero ve GRPO 'yu tek birleştiren lensle araştırır: **self-play + search + policy improvement**Her biri öncekiyi genelleştirir; GRPO özellikle AlphaZero'nun, kazanç sinyalini simgelendiren işlemler ve matematiksel doğrulama olarak tokenlerle LLM mantıklılığına uygulanan bir reçetesidir.

## Anlaşım

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**Silver et al. Bilinen kurallarla bir oyun (şah, shogi, Go) verildiğinde:

- Politika değerleri ağı: bir kule $f_\theta(s) \to (p, v)$- Evet .$p$- Hukuk hareketleri konusunda öncü.$v$Bu oyunun beklenen sonucu.
- Monte Carlo Ağacı Arama (MCTS): Her harekette, olası devamlar ağacını genişlet.$(p, v)$UCB (PUCT) tarafından düğümleri seçin: $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$- Evet .
- Kendi oyununu oynayın: ajan karşısına oyun oynayın.$t$, MCTS ziyaret dağıtımı $\pi_t$politika eğitim hedefi haline gelir.
- Kayıp:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$- Evet .$z$oyunun sonucu (+1 / 0 / -1).

İnsan bilgisi sıfır, el yapımı heuristik sıfır, tek bir tarif, her biri birkaç on milyon kendi oyunundan sonra satranç, shogi ve go ustası.

**MuZero (2019).**Schrittwieser et al. Kurallar bilinmesi gerekliliğini kaldırır.

- Sıkı bir ortam yerine *latent dinamik modeli öğrenin*$(h, g, f)$- ...
  - $h(s)$: gözlemleri gizli bir duruma kodlama.
  - $g(s_{\text{latent}}, a)$: bir sonraki gizli durumu + ödül öngör.
  - $f(s_{\text{latent}})$: politika öncesi tahmin + değer.
- MCTS * öğrenilen gizli alanda* çalışır. Aynı arama, aynı eğitim döngüsü.
- Go, satranç, shogi ve Atari'de çalışır. Bir algoritma, kural bilgisine sahip değil.

**Stochastic MuZero (2022).**Stochastic dinamikleri ve şans düğümlerini ekler; backgammon sınıfı oyunlara uzanır.

**Muesli, Gumbel MuZero (2022-2024).**Örnek verimliliği ve belirleyici arama konusunda gelişmeler.

**GRPO (2024-2025).**DeepSeek-R1 tarifi, AlphaZero şeklinde aynı döngü, dil modeline uygulanır:

- "Game": bir matematik / kodlama / akıl yürütme sorunu cevaplayın. "Win" = doğrulayıcı (test vakaları geçiyor, sayısal cevap eşleşir) 1 gönderir.
- Politikası: LLM. Eylemler: tokenler. Devlet: hızlı + tepki-bkz.
- Eleştirmen yok (PPO tarzı $V_\phi$Bunun yerine, her seferinde örnek alın.$G$Politika'nın tamamlanması.**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$REINFORCE tarzında güncelleme için sinyal olarak.
- KL'nin geri çekilmeyi önlemek için referans politikasına yönelik ceza (RLHF gibi).
- Tam kaybı:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

Öğrenilmiş ödül modeli, eleştirmen, MCTS yoktur. Kurallara dayalı bir doğrulayıcı ödül sağlar, grup ilişkili temel çizgi eleştirmeni değiştirir ve arama adımı düşürülür. Hesaplamaların bir kısmında akıl yürütme referansları üzerinde PPO-RLHF kalitesine eşittir veya üstlenir.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) bir kağıtta iki modelden oluşur:

- **R1-Zero.**DeepSeek-V3 temel modelinden başlayın. SFT yoktur. GRPO'yu doğrudan iki ödül bileşeniyle uygulayın: * doğruluk ödülü* (kurallara dayalı  son cevap doğru sayıya analiz etti / kod birim testlerini geçti mi) ve * format ödülü* (önüntüsü zincirini içine sarmış mı)`<think>…</think>`Etiketler). Binlerce adım boyunca, ortalama yanıt uzunluğu ~100'den ~10.000'e kadar büyür ve matematik referans puanları neredeyse o1 ön izleme seviyelerine tırmanır. Model sıfırdan mantık etmeyi öğrenir.
- **R1.**R1-Zero'nun okunma sorunlarını dört aşamalı bir boru hattıyla çözün:
  1. **Cold-start SFT.**Birkaç bin uzun CoT gösterisini temiz biçimlendirme ile toplayın.
  2. **Reasoning-oriented GRPO.**Kod değişimini önlemek için GRPO'yu doğruluk + biçim ödülleri ve *dilli tutarlılık* ödülü ile uygulayın.
  3. **Rejection sampling + SFT round 2.**RL kontrol noktasından ~ 600K mantık trajektörlerini örnekleyin, sadece doğru son cevapları ve okunur CoT'leri olanları tutun ve ~ 200K mantık dışı SFT örnekleriyle (yazma, sorgulama, kendi kendini tanımlama) birleştirin.
  4. **Full-spectrum GRPO.**Bir RL daha, hem akıl yürütme (kurallara dayalı ödüller) hem de genel uyum (karşılıklılık/hasırsızlık tercihlerine dayalı ödüller) kapsamaktadır.

Sonuç açık ağırlıklarda AIME ve MATH-500'de o1 ile eşleşir ve destille edilecek kadar küçüktür. Aynı makale aynı zamanda R1'nin akıl etmesi izlerine SFT'ye göre altı destille edilmiş yoğun model (Qwen-1.5B ile Llama-70B) serbest bırakır.

**Why GRPO instead of PPO for reasoning.**DeepSeekMath makalesinde (Feb 2024) üç neden: (1) eğitmek için değer ağı yoktur, hafıza yarıya kısaltılır; (2) grup tabanı doğal olarak akıl yürütme görevlerinin ürettiği nadir bir yolculuğun son ödülünü ele alıyor; (3) anlık normalleşme, PPO'nun tek eleştirmeninin yapamayacağı çok farklı zorluklarla ilgili sorunlar arasında karşılaştırılabilir avantajları sağlar.

**Search-free vs search-based.**Oyunlar şubelerle ayrılmıştır:

- *Uzun ufuklarla mükemmel bilgi oyunları* (Go, satranç): hala arama tabanlı. AlphaZero / MuZero hakim.
- *LLM mantıklılığı*: henüz üretimde MCTS yok; GRPO tam dağıtımlarda, sonuç hesaplama için en iyi N. Proses ödül modelleri (PRM) adım düzeyde arama eklenmeye işaret ediyor.

```figure
f3-selfplay-ladder
```

## Yapın

Kodun içinde .`code/main.py`uygulamalar **GRPO in miniature**Bir LLM'de olduğu gibi algoritma da aynıdır; ancak politika ve ortam daha basit. * kaybı* ve * grubun artı avantajını* öğretir.

### Adım 1: Küçük bir doğrulama ortamı

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

Gerçek GRPO'da doğrulayıcı birim testleri yürütür veya matematiksel eşitliği kontrol eder.

### Adım 2: Politika: K cevap simgelerinden softmax / prompt

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

Bir HLM'nin en son katman çıkışına eşdeğer.

### Adım 3: Grup örneği ve gruplara göre avantaj

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

Grup-sare avantajı 2024 DeepSeek hilesi. Eleştirmen gerekmez. "Baş çizgi" grup ortalamasıdır ve normallaşım grup std kullanır.

### Adım 4: REINFORCE'nin başlangıç seviyesine karşılaştır (değersiz)

Aynı ayar, aynı hesaplama, basit bir REINFORCE.

### Adım 5: Entropi ve KL'yi gözlemleyin

RLHF ile aynı teşhisler: referans için KL, politika entropi, ödül-over-time.

## Tuzaklar

- **Reward hacking via verifier gaming.**GRPO, RLHF'nin riskini miras alır: Eğer doğrulayıcı yanlış ya da sömürülebilirse, LLM sömürüyü bulacaktır.
- **Group size too small.**Grup ortalama başlangıç çizgisinin değişimi şöyle:$1/G$(Standard hatası gibi $1/\sqrt{G}$Aşağıda .$G = 4$, avantaj sinyali gürültülü , standart seçenek $G = 8$64'e kadar.
- **Length bias.**Farklı uzunluklarda LLM tamamlamaları farklı log- olasılıklara sahiptir. Token sayısına göre normalleştirin veya dizi düzeyde log-prob kullanın veya maksimum uzunlukta kesin.
- **Pure self-play cycles.**AlphaZero tarzı eğitim genel toplam oyunlarında egemenlik döngüsünde sıkışabilir.
- **Search-policy mismatch.**AlphaZero, arama sonuçlarını taklit etmek için politikaları eğitir. Eğer politika ağı aramaların dağılımını temsil etmek için çok küçükse, eğitim stallları.
- **Compute floor.**MuZero / AlphaZero büyük hesaplamalara ihtiyaç duyar. Tek bir ablation genellikle yüzlerce GPU-saati tutar. Öğrenmek için miniatür demolar vardır (örneğin, Connect Four'da AlphaZero).
- **Verifier coverage.**Bir hata çözümü için geçerli olan birim testleri, hatayı güçlendirir.

## Kullan

2026 oyun-RL manzarası, alanlar doğrultusunda:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

*Recipe*  kendi kendine oynamak, arama artırılmış geliştirme, politika destilasyonu  metin, piksel ve fiziksel kontrolden uzanır. GRPO en genç örnektir; daha fazlası geliyor.

## Gönder

- Kaydet .`outputs/skill-game-rl-designer.md`- ...

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## Egzersizler

1. **Easy.**GRPO ' yu kullanın .`code/main.py`. 2 çağrıda + 4 cevap simgesi her biri üzerinde çalış.$G=8$- Evet .
2. **Medium.**PPO ve vanilya REINFORCE'yi bağlayın.
3. **Hard.**Bir uzunluk-2 "düşünme zinciri"ne kadar uzan: ajan iki token gönderir ve doğrulayıcı çiftini ödüllendirir. GRPO'nun iki adımlı diziler boyunca kredi tahsisini nasıl ele aldığını ölç. (Tavsiye: * tam dizide hesap grup avantajı*, her iki token pozisyonuna yayıl.)

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## Daha Fazla Okumak

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)- Evet .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)- Evet .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)- Evet .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)- Evet .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) GRPO ve grup ilişkili temel değerleri tanıtan makale.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) R1 4 aşamalı resepti artı R1-Zero ablasyonu.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + derin öğrenme ölçeğinde.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)- Herşeye başlayan gazete.
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) GRO'yu özel ödül fonksiyonlarıyla uygulayacak üretim referansı.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) R1 tarifinin birden fazla ölçekte açık şekilde çoğaltılması.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) R1'in LLM ölçeğinde oluşturduğu kendi oyun, arama ve "önemli ödül" için ders kitabı çerçevesini.
