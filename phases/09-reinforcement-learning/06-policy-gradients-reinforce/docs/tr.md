# Politika Gradient — Sıfırdan REINFORCE

> Değer tahmin etmeyi bırakın. Politikayı doğrudan parametrelendirin, beklenen getirinin gradient değerini hesaplayın, yokuş yukarı adım atın. Williams (1992) bunu bir teoremde yazmıştır. PPO, GRPO ve her LLM RL döngüsünün var olmasının nedeni budur.

**Tür:** Build
**Diller:** Python
**Önkoşullar:** Aşama 3 · 03 (Backpropagation), Aşama 9 · 03 (Monte Carlo), Aşama 9 · 04 (TD Learning)
**Süre:** ~75 dakika

## Sorun

Q-öğrenme ve DQN, *değer* fonksiyonunu parametreleştirir. Eylemleri `argmax Q`'ye göre seçersiniz. Ayrık eylemler ve ayrık durumlar için bu iyidir. Eylemler sürekli olduğunda (10 boyutlu bir tork üzerinde hangi `argmax`?) veya stokastik bir politika istediğinizde (`argmax` yapı gereği deterministiktir) bozulur.

Politika gradient'lar bunun yerine *politikayı* parametreleştirir. `π_θ(a | s)`, eylemler üzerinden bir dağılım çıkaran bir sinir ağıdır. Harekete geçmek için ondan örnek alın. Beklenen getirinin gradient değerini `θ`'ye göre hesaplayın. Yokuş yukarı adım atın. Hayır `argmax`. Bellman özyinelemesi yok. `J(θ) = E_{π_θ}[G]` üzerinde sadece gradient yükseliş.

REINFORCE teoremi (Williams 1992) size bu gradient'nin hesaplanabilir olduğunu söyler: `∇J(θ) = E_π[ G · ∇_θ log π_θ(a | s) ]`. Bir bölüm çalıştırın. Dönüşü hesaplayın. Her adımda `∇ log π_θ(a | s)` ile çarpın. Ortalama. Gradient-yükseliş. Tamamlamak.

2026'daki her LLM-RL algoritması (PPO, DPO, GRPO) REINFORCE'un geliştirilmiş halidir. Bunu parmaklarınızla anlamak, bu aşamanın geri kalanı ve Aşama 10 · 07 (RLHF uygulaması) ve Aşama 10 · 08 (DPO) için ön koşuldur.

## Konsept

![Politika gradient: softmax politikası, log-π gradient, dönüş ağırlıklı güncelleme](../assets/policy-gradient.svg)

**Politika gradient teoremi.** `θ` tarafından parametrelendirilen herhangi bir `π_θ` politikası için:

`∇J(θ) = E_{τ ~ π_θ}[ Σ_{t=0}^{T} G_t · ∇_θ log π_θ(a_t | s_t) ]`

burada `G_t = Σ_{k=t}^{T} γ^{k-t} r_{k+1}`, `t` adımından elde edilen indirimli getiridir. Beklenti, `π_θ`'dan örneklenen `τ` yörüngelerinin tamamının üzerindedir.

**İspat kısadır.** Beklenti altında `J(θ) = Σ_τ P(τ; θ) G(τ)`'yi ayırt edin. `∇P(τ; θ) = P(τ; θ) ∇ log P(τ; θ)` (log-türev hilesi) kullanın. `log P(τ; θ) = Σ log π_θ(a_t | s_t) + environment terms that do not depend on θ` çarpanı. Çevre terimleri ortadan kalkıyor. Cebirin iki doğrusu size teoremi verir.

**Farklılığı azaltma hileleri.** Vanilya REINFORCE'un öldürücü değişkenliği vardır — geri dönüşler gürültülüdür, `∇ log π` gürültülüdür, ürünleri çok gürültülüdür. İki standart düzeltme:

1. **Taban çizgisi çıkarma.** `a_t`'ye bağlı olmayan herhangi bir taban çizgisi `b(s_t)` için `G_t`'yi `G_t - b(s_t)` ile değiştirin. Tarafsız çünkü `E[b(s_t) · ∇ log π(a_t | s_t)] = 0`. Tipik seçim: `b(s_t) = V̂(s_t)` bir eleştirmen tarafından öğrenildi → aktör-eleştirmen (Ders 07).
2. **Gidiş ödülü.** `Σ_t G_t · ∇ log π_θ(a_t | s_t)`'yi `Σ_t G_t^{from t} · ∇ log π_θ(a_t | s_t)` ile değiştirin. Belirli bir eylem için yalnızca gelecekteki getiriler önemlidir; geçmiş ödüller sıfır ortalamalı gürültüye katkıda bulunur.

Kombine olarak şunları elde edersiniz:

`∇J ≈ (1/N) Σ_{i=1}^{N} Σ_{t=0}^{T_i} [ G_t^{(i)} - V̂(s_t^{(i)}) ] · ∇_θ log π_θ(a_t^{(i)} | s_t^{(i)})`

bu, bir taban çizgisiyle REINFORCE'dir - A2C (Ders 07) ve PPO'nun (Ders 08) doğrudan atası.

**Softmax politikası parametrelendirmesi.** Ayrık işlemler için standart seçim:

`π_θ(a | s) = exp(f_θ(s, a)) / Σ_{a'} exp(f_θ(s, a'))`

burada `f_θ`, eylem başına puan veren herhangi bir sinir ağıdır. gradient temiz bir forma sahiptir:

`∇_θ log π_θ(a | s) = ∇_θ f_θ(s, a) - Σ_{a'} π_θ(a' | s) ∇_θ f_θ(s, a')`

i.e., gerçekleştirilen eylemin puanı eksi politika kapsamında beklenen değeri.

**Sürekli eylemler için Gauss politikası.** `π_θ(a | s) = N(μ_θ(s), σ_θ(s))`. `∇ log N(a; μ, σ)` kapalı bir forma sahip. Aşama 9 · 07'nin SAC'sinin tüm ihtiyaçları budur.

```figure
policy-gradient-landscape
```

## Build It — Kendin İnşa Et

### Adım 1: softmax politika ağı

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

Tablosal bir ortam için doğrusal bir politika (eylem başına bir ağırlık vektörü) kullanın. Atari için CNN'yi değiştirin ve softmax kafasını koruyun.

### Adım 2: örnekleme ve log olasılığı

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### 3. Adım: Yakalanan günlük olasılıkları ile kullanıma sunma

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### 4. Adım: Güncellemeyi GÜÇLENDİRİN

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

gradient `∇ log π(a|s) = e_a - π(·|s)` (`a` eksi olasılıklardan bir tanesi), softmax politikası gradient'ların kalbidir. Bunu kas hafızasına yazın.

### Adım 5: temeller

Son bölümlere göre `G`'lik bir ortalama, 4×4 GridWorld'ün çalıştırılması için yeterli varyans azaltımıdır; bir araya gelmesi ~500 bölüm sürer. Taban çizgisini öğrenilmiş bir `V̂(s)`'ye yükseltin ve aktörlerin eleştirisini alın.

## Tuzaklar

- **Patlayan gradients.** Geri dönüşler çok büyük olabilir. `∇ log π` ile çarpmadan önce daima `G`'yi `~N(0, 1)`'ye normalleştirin.
- **Entropi çöküşü.** Politika, neredeyse deterministik bir eyleme çok erken yaklaşır, keşfetmeyi bırakır ve takılıp kalır. Düzeltme: Hedefe entropi bonusu `β · H(π(·|s))` eklendi.
- **Yüksek değişkenlik.** Vanilla REINFORCE'un binlerce bölüme ihtiyacı var. Kritik bir temel (Ders 07) veya TRPO/PPO'nun güven bölgesi (Ders 08) standart çözümdür.
- **Örnek verimsizliği.** Politikaya bağlı olmak, bir güncellemeden sonra her geçişi atmanız anlamına gelir. Önem örneklemesi yoluyla politika dışı düzeltmeler, sapma pahasına verileri geri getirir (PPO oranı kırpılmış bir IS ağırlığıdır).
- **Durağan olmayan gradient'lar.** 100 bölüm önceki aynı gradient eski `π`'yi kullanıyor. Politikaya bağlı yöntemler bu nedenle her birkaç kullanıma sunmada bir güncellenir.
- **Kredi tahsisi.** Devam eden ödül olmadığında, geçmiş ödüller gürültüye katkıda bulunur. Her zaman devam etme ödülünü kullanın.

## Use It — Uygula

2026'da REINFORCE nadiren doğrudan çalıştırılır ancak gradient formülü her yerdedir:

| Kullanım örneği | Türetilmiş yöntem |
|----------|---------------|
| Sürekli kontrol | Gauss politikasıyla PPO / SAC |
| LLM RLHF | KL cezalı PPO, token düzeyindeki politikayla çalışıyor |
| LLM muhakemesi (DeepSeek) | GRPO — Gruba bağlı temel çizgiyle REINFORCE, eleştiri yok |
| Çoklu-agent | Merkezi eleştiri REINFORCE (MADDPG, COMA) |
| Ayrık eylem robotiği | A2C, A3C, PPO |
| Yalnızca tercih ayarları | DPO - REINFORCE tercih olasılığı kaybı olarak yeniden yazıldı, örnekleme yok |

2026 eğitim komut dosyasında `loss = -advantage * log_prob`'yı okuduğunuzda, bu bir temel ile REINFORCEK anlamına gelir. Tüm makaleler (DPO, GRPO, RLOO) bu tek satırın üstünde varyans azaltma hileleridir.

## Ship It — Ürüne Dönüştür

`outputs/skill-policy-gradient-trainer.md` olarak kaydet:

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## Egzersizler

1. **Kolay.** REINFORCE'u 4×4 GridWorld'de doğrusal bir softmax politikasıyla uygulayın. Temel olmadan 1.000 bölüm için eğitim alın. Öğrenme eğrisini çizin; varyansı ölçün (getirilerin std'si).
2. **Orta.** Çalışan ortalama taban çizgisi ekleyin. Tekrar eğitin. Numune verimliliğini ve varyansını vanilya çalışmasıyla karşılaştırın. Temel çizgi yakınsama adımlarını ne kadar azaltıyor?
3. **Zor.** Bir entropi bonusu `β · H(π)` ekleyin. `β ∈ {0, 0.01, 0.1, 1.0}` tara. Nihai getiriyi ve politika entropisini çizin. Bu görevin en tatlı noktası nerede?

## Anahtar Terimler

| Terim | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Politika gradient | "Politikayı doğrudan eğitin" | `∇J(θ) = E[G · ∇ log π_θ(a\|s)]`; log-türev numarasından türetilmiştir. |
| REINFORCE | "Orijinal PG algoritması" | Williams (1992); Monte Carlo, log-policy gradient ile çarpılarak döndürülür. |
| Log-türev numarası | "Puan fonksiyonu tahmincisi" | `∇P(τ;θ) = P(τ;θ) · ∇ log P(τ;θ)`; beklentilerin gradient'lerini uysal hale getirir. |
| Temel | "Farklılığın azaltılması" | `G`'dan çıkarılan herhangi bir `b(s)`; tarafsız çünkü `E[b · ∇ log π] = 0`. |
| Devam Edecek Ödül | "Yalnızca gelecekteki iadeler sayılır" | Tam `G_0` yerine `G_t^{from t}`; doğru ve daha düşük varyans. |
| Entropi bonusu | "Keşfetmeyi teşvik edin" | `+β · H(π(·\|s))` terimi politikanın çökmesini önler. |
| Politikaya ilişkin | "Az önce gördükleriniz üzerinde çalışın" | Gradient beklentisi w.r.t. mevcut politika — eski verileri doğrudan yeniden kullanamaz. |
| Avantajı | "Ortalamadan ne kadar iyi" | `A(s, a) = G(s, a) - V(s)`; imzalı miktar REINFORCE-ile-taban çizgisiyle çarpılır. |

## Daha Fazla Okuma

-[Williams (1992). Basit İstatistiksel Gradient-Bağlantıcı Pekiştirmeli Öğrenme için Takip Edilen Algoritmalar](https://link.springer.com/article/10.1007/BF00992696) — orijinal REINFORCE makalesi.
- [Sutton ve ark. (2000). Politika Gradient Fonksiyon Yaklaşımı ile Pekiştirmeli Öğrenme Yöntemleri](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) — fonksiyon yaklaşımı ile modern politika-gradient teoremi.
- [Sutton ve Barto (2018). Ch. 13 — Politika Gradient Yöntemler](http://incompleteideas.net/book/RLbook2020.pdf) — ders kitabı sunumu.
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) — PyTorch koduyla anlaşılır pedagojik anlatım.
- [Peters ve Schaal (2008). Gradient](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) Politikasıyla Motor Becerilerin Takviyeli Öğrenimi — varyans azaltma ve REINFORCE'u güven bölgesi ailesine (TRPO, PPO) bağlayan doğal-gradient görünüm.
