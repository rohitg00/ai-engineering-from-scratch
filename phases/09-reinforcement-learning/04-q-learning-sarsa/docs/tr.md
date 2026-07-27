# Zamansal Fark — Q-Öğrenim ve SARSA

> Monte Carlo bölüm bitene kadar bekler. TD, bir sonraki değer tahminini önyükleyerek her adımdan sonra güncellenir. Q-öğrenme politika dışı ve iyimserdir; SARSA politikaya uygun ve temkinli. Her ikisi de bir kod satırıdır. Her ikisi de bu aşamadaki her deep-RL yöntemini destekler.

**Tür:** Build
**Diller:** Python
**Önkoşullar:** Aşama 9 · 01 (MDP'ler), Aşama 9 · 02 (Dinamik Programlama), Aşama 9 · 03 (Monte Carlo)
**Süre:** ~75 dakika

## Sorun

Monte Carlo çalışıyor ancak iki pahalı talebi var. Sonlanan bölümlere ihtiyaç duyar ve yalnızca son dönüş geldikten sonra güncellenir. Bölümünüz 1.000 adım ise, MC herhangi bir şeyi güncellemek için 1.000 adım bekler. Yüksek varyanslı, düşük önyargılı ve pratikte yavaştır.

Dinamik programlamanın tam tersi bir profili vardır (sıfır varyanslı ön yüklemeli yedeklemeler) ancak bilinen bir model gerektirir.

Zamansal fark (TD) öğrenimi farkı böler. Tek geçişten `(s, a, r, s')`, tek adımlı bir hedef `r + γ V(s')` oluşturun ve `V(s)`'yi ona doğru itin. Modeli yok. Tam bölüm yok. RHS'de yaklaşık bir `V` kullanılmasından kaynaklanan önyargı, ancak MC'den ve birinci adımdaki çevrimiçi güncellemelerden önemli ölçüde daha düşük sapma.

Bu, tüm modern RL'nin (DQN, A2C, PPO, SAC) döndüğü pivottur. 9. Aşamanın geri kalanı, bu derste yazacağınız tek adımlı TD güncellemesinin üzerine inşa edilen fonksiyon yaklaşımı katmanları ve püf noktalarından oluşur.

## Konsept

![Q-öğrenme ve SARSA: politika dışı maksimum ve politika içi Q(s', a')](../assets/td.svg)

**V: için TD(0) güncellemesi**

`V(s) ← V(s) + α [r + γ V(s') - V(s)]`

Parantez içindeki miktar TD hatası `δ = r + γ V(s') - V(s)`'dır. MC'deki `G_t - V(s_t)`'nin çevrimiçi analogudur. Yakınsama, Robbins-Monro'nun (`Σ α = ∞`, `Σ α² < ∞`) tatmin edici `α` olmasını ve tüm eyaletlerin sonsuz sıklıkta ziyaret edilmesini gerektirir.

**Q-öğrenme.** Kontrol için politika dışı bir tank avcısı yöntemi:

`Q(s, a) ← Q(s, a) + α [r + γ max_{a'} Q(s', a') - Q(s, a)]`

`max`, agent'ın gerçekte hangi eylemi gerçekleştirdiğine bakılmaksızın *açgözlü* politikasının `s'` tarihinden itibaren takip edileceğini varsayar. Bu ayırma, Q-öğrenmenin `Q*` öğrenmesini sağlarken, agent ε-açgözlülük yoluyla araştırır. Mnih ve ark. (2015) bunu Atari'de derin Q-öğrenmeye dönüştürdü (Ders 05).

**SARSA.** Politikaya bağlı bir tank avcısı yöntemi:

`Q(s, a) ← Q(s, a) + α [r + γ Q(s', a') - Q(s, a)]`

Ad, `(s, a, r, s', a')` tuple'ıdır. SARSA, açgözlü `argmax`'yi değil, agent *aslında* bir sonraki gerçekleştirdiği `a'` eylemini kullanır. ε-açgözlü `π`'nin çalıştığı her şey için `Q^π`'ye yakınsar ve bu, `ε → 0` limitinde `Q*` olur.

**Uçurumda yürüme farkı.** Klasik uçurumda yürüme görevinde (uçurumdan düşme = ödül -100), Q-öğrenme uçurumun kenarı boyunca en uygun yolu öğrenir ancak bazen keşif sırasında cezayı alır. SARSA, uçurumdan bir adım uzakta daha güvenli bir yol öğreniyor çünkü keşif gürültüsünü Q değerine dahil ediyor. Eğitimle her ikisi de `ε → 0` noktasında optimuma ulaşır. Uygulamada bu önemlidir: deployment'da keşif gerçekten gerçekleştiğinde, SARSA'nın davranışı daha muhafazakardır.

**Beklenen SARSA.** `Q(s', a')`'yi `π` altındaki beklenen değeriyle değiştirin:

`Q(s, a) ← Q(s, a) + α [r + γ Σ_{a'} π(a'|s') Q(s', a') - Q(s, a)]`

SARSA'dan daha düşük sapma (`a'` örneği yok), aynı politika hedefi. Genellikle modern ders kitaplarında varsayılandır.

**n-adım TD ve TD(λ).** Önyüklemeden önce `n` adım bekleyerek TD(0) ve MC arasında enterpolasyon yapın. `n=1` TD'dir, `n=∞` MC'dir. Geometrik ağırlıklar `(1-λ)λ^{n-1}` ile tüm `n` üzerinden TD(λ) ortalamaları. Çoğu derin RL, 3 ile 20 arasında `n` kullanır.

```figure
qlearning-gridworld
```

## Build It — Kendin İnşa Et

### Adım 1: ε-açgözlü politika hakkında SARSA

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

Sekiz satır. Q-öğrenmeden *tek* fark hedef çizgisidir.

### Adım 2: Q-öğrenme

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

`max` hedefi davranıştan ayırır. Bu tek sembol politika içi ve politika dışı arasındaki farktır.

### 3. Adım: eğrileri öğrenme

100 bölüm başına ortalama getiriyi izleyin. Q-öğrenme, basit deterministik GridWorld'de daha hızlı birleşir; SARSA uçurum yürüyüşü konusunda daha muhafazakar. `code/main.py`'daki 4×4 GridWorld'de, `α=0.1, ε=0.1` ile ~2.000 bölümden sonra her ikisi de neredeyse ideale yakın.

### 4. Adım: DP gerçeğiyle karşılaştırın

`Q*` elde etmek için değer yinelemesini (Ders 02) çalıştırın. `max_{s,a} |Q_learned(s,a) - Q*(s,a)|`'yi kontrol edin. Sağlıklı bir tablolu tank avcısı agent, 10.000 bölümden sonra 4×4 GridWorld'de `~0.5` bölgesine iner.

## Tuzaklar

- **İlk Q değerleri önemlidir.** İyimser başlangıç ​​(negatif ödüllü bir görev için `Q = 0`) keşfetmeyi teşvik eder. Kötümser başlangıç, açgözlü bir politikayı sonsuza dek tuzağa düşürebilir.
- **α programı.** Sabit `α`, durağan olmayan problemler için uygundur. `α_n = 1/n`'nin azalması teoride yakınsama sağlar ancak pratikte çok yavaştır — `α`'yi `[0.05, 0.3]`'ye sabitleyin ve öğrenme eğrisini izleyin.
- **ε programı.** Yüksekten başla (`ε=1.0`), `ε=0.05`'ye düş. "GLIE" (sonsuz keşifle sınırda açgözlü) yakınsama koşuludur.
- **Q-öğrenmede maksimum sapma.** `max` operatörü, `Q` gürültülü olduğunda yukarıya doğru yönelir. Fazla tahmine yol açar — Hasselt'in Çift Q-öğrenmesi (Ders 05'te DDQN tarafından kullanılmıştır) bunu iki Q tablosuyla düzeltir.
- **Sonlanmayan bölümler.** TD, terminaller olmadan öğrenebilir, ancak ya adımları sınırlamanız ya da önyüklemeyi sınırda doğru şekilde işlemeniz gerekir. Standart: Başlığa terminal dışı muamelesi yapın, önyüklemeye devam edin.
- **Durum karması.** Durumlar demetler/tensörlerse, hash edilebilir bir anahtar kullanın (liste değil demet; ham değil yuvarlanmış kayan nokta kümesi).

## Use It — Uygula

2026 Tank Avcısı manzarası:

| Görev | Yöntem | Nedeni |
|------|--------|--------|
| Küçük tablo ortamları | Q-öğrenme | Optimum politikayı doğrudan öğrenir. |
| Politikayla ilgili güvenlik açısından kritik | SARSA / Beklenen SARSA | Keşif sırasında muhafazakar. |
| Yüksek boyutlu durum | DQN (Aşama 9 · 05) | Tekrar oynatma ve hedef net ile sinir ağı Q işlevi. |
| Sürekli eylemler | SAC / TD3 (Aşama 9 · 07) | Q ağında TD güncellemesi; Politika ağı eylemler yayar. |
| LLM RL (ödül modeline dayalı) | PPO / GRPO (Aşama 9 · 08, 12) | GAE aracılığıyla TD tarzı avantaja sahip aktör eleştirmeni. |
| Çevrimdışı RL | CQL / IQL (Aşama 9 · 08) | Muhafazakar düzenlemeyle Q-öğrenme. |

2026 gazetelerinde okuduğunuz "RL"nin yüzde doksanı, Q-öğrenme veya SARSA'nın bazı ayrıntılarıdır. Daha derin okumadan önce tablo güncellemesini parmaklarınızda anlayın.

## Ship It — Ürüne Dönüştür

`outputs/skill-td-agent.md` olarak kaydet:

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

1. **Kolay.** 4×4 GridWorld'de Q-öğrenme ve SARSA'yı uygulayın. 2.000 bölüm için öğrenme eğrilerini (100 bölüm başına ortalama getiri) çizin. Kim daha hızlı birleşiyor?
2. **Orta.** Bir uçurumda yürüme ortamı oluşturun (4×12, son sıra -100 ödülü olan uçurumdur ve başlamak için sıfırlayın). Q-öğrenme ve SARSA nihai politikalarını karşılaştırın. Her birinin izlediği yolların ekran görüntüsünü alın. Hangisi uçuruma daha yakın?
3. **Zor.** Çift Q-öğrenmeyi uygulayın. Gürültülü ödüllü bir GridWorld'de (adım başına ödüle Gauss gürültüsü σ=5 eklenir), Q-öğrenmenin `V*(0,0)`'yi anlamlı bir miktarda fazla tahmin ettiğini, Çift Q-öğrenmenin ise bunu yapmadığını gösterin.

## Anahtar Terimler

| Terim | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| TD hatası | "Güncelleme sinyali" | `δ = r + γ V(s') - V(s)`, önyüklemeli artık. |
| TD(0) | "Tek adımlı tank avcısı" | Yalnızca bir sonraki durumun tahminini kullanarak her geçişten sonra güncelleme yapın. |
| Q-öğrenme | "Politika dışı RL 101" | Sonraki durum eylemlerine ilişkin `max` ile tank avcısı güncellemesi; davranış politikasından bağımsız olarak `Q*` öğrenir. |
| SARSA | "Politikaya uygun Q-öğrenme" | Gerçek bir sonraki eylemi kullanarak tank avcısı güncellemesi; mevcut ε-açgözlü π için `Q^π` öğrenir. |
| Beklenen SARSA | "Düşük varyanslı SARSA" | Örneklenen `a'`'yi π'nin altındaki beklentisiyle değiştirin. |
| GLIE | "Doğru keşif planı" | Sonsuz Keşifle Sınırda Açgözlü; Q-öğrenme yakınsaması için gereklidir. |
| Önyükleme | "Hedefte mevcut tahmin kullanılıyor" | TD'yi MC'den ayıran şey nedir? Önyargı kaynağı ancak büyük fark azaltımı. |
| Maksimumlaştırma önyargısı | "Q-öğrenme fazla tahmin ediyor" | Gürültülü tahminlere göre `max` yukarı yönlü eğilimdedir; Double Q-öğrenme ile düzeltildi. |

## Daha Fazla Okuma

- [Watkins ve Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) — orijinal makale ve yakınsama kanıtı.
- [Sutton ve Barto (2018). Ch. 6 — Zamansal Fark Öğrenme](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0), SARSA, Q-öğrenme, Beklenen SARSA.
- [Hasselt (2010). Çift Q-öğrenme](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) — maksimizasyon sapması düzeltmesi.
- [Seijen, Hasselt, Whiteson, Wiering (2009). Beklenen SARSA'nın Teorik ve Ampirik Analizi](https://ieeexplore.ieee.org/document/4927542) — beklenen SARSA motivasyonu.
- [Rummery ve Niranjan (1994). Bağlantıcı sistemleri kullanan çevrimiçi Q-öğrenme](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) — SARSA'yı ortaya atan makale (daha sonra "modifiye bağlantıcı Q-öğrenme" olarak adlandırıldı).
- [Sutton ve Barto (2018). Ch. 7 — n adımlı Önyükleme](http://incompleteideas.net/book/RLbook2020.pdf) — TD(0)'ı TD(n)'ye, Q-öğrenmeden uygunluk izlerine ve daha sonra PPO'da GAE'ye giden yolu genelleştirir.
