# MARL  MADDPG, QMIX, MAPPO

> 2026'da hala LLM-agent sistemlerini bilgilendiren çoklu ajan koordinasyonunun güçlendirme-öğrenme mirası. **MADDPG**(Lowe et al., NeurIPS 2017, arXiv:1706.02275) Merkezi Eğitim, Merkezi İşlem (CTDE) başlattı: her eleştirmen eğitim sırasında tüm ajanların durumlarını ve eylemlerini görür; test zamanında sadece yerel aktörler çalışır. İşbirliği, rekabetçi ve karışık ortamlar için çalışır. **QMIX**(Rashid et al., ICML 2018, arXiv:1803.11485) bir monotonik karıştırma ağı ile değer-karıştırma; ajan başına Qs birleşik Q'lar böylece `argmax` StarCraft Multi-Agent Challenge (SMAC) üzerinde baskın bir şekilde dağıtılır. **MAPPO**(Yu et al., NeurIPS 2022, arXiv:2103.01955) merkezi bir değer fonksiyonu olan PPO'dur; parçacık dünyasında, SMAC, Google Araştırma Futbolu, Hanabi'de en az ayarlama ile "içik etkili".**default 2026 cooperative-MARL baseline**Bu ders, küçük bir çubuğuz dünyası oyuncağından her birini inşa eder ve üç fikri kas hafızasına yerleştirir.

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations), TypeScript
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## Sorun

LLM-agent sistemleri, giderek daha fazla ajanlar arası koordinasyon politikalarını eğitmektedir: ne zaman ertelenmek, ne zaman harekete geçmek, hangi kişiyi çağrmak. Bu politikaları nasıl eğitileceğini söyleyen literatür, LLM dalgasından önceki ve küçük bir baskın algoritma kümesine sahip olan Multi-Agent Reinforcement Learning (MARL) dır.

MARL makaleleri, örneği kelimeforusu olmadan okumak acı verici. Merkezsiz yürütme (CTDE), değer parçalanması ve merkezi eleştirmenlerle merkezileştirilmiş eğitim, birer konu hakkında konuşan bir kelime değildir.

- Bağımsız RL (her ajan tek başına öğrenir) her ajanın bakış açısından istasyonel değil.
- Merkezi RL (tek ajan hepsini kontrol eder) ölçeklendirme yapmaz ve yürütme kısıtlamalarını ihlal etmez.
- CTDE her ikisinden de en iyisini elde eder: küresel bilgi ile eğitilmek, yerel politikalarla çalıştırmak.

## Anlam

### Kağıtlar üç ortamda kullanıyor

- **Particle World (multi-agent particle env).**MADDPG'nin orijinal test yatağı.
- **StarCraft Multi-Agent Challenge (SMAC).**İşbirliği mikro yönetimi, kısmi gözlem, QMIX'in test yatağı, ayrıntılı eylemler, sürekli durumlar.
- **Google Research Football, Hanabi, MPE.**Mappo Temel Hatları.

Farklı ortamlar farklı eylem/ gözlem türlerine sahiptir.

### MADDPG (2017)  CTDE örneği

Her ajan .`i`Bir aktörü var.`mu_i(o_i)`Bu, kendi gözlemlerini eylemlere yerleştirir.`Q_i(x, a_1, ..., a_n)`Bu, eğitim sırasında tüm gözlemleri ve tüm eylemleri görüyor.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

Neden CTDE: eğitim sırasında, herkesin eylemlerini biliyoruz; bunu her eleştirmende farklılık azaltmak için kullanıyoruz.`o_i`ve aramalar`mu_i(o_i)`- Evet .

Başarısızlık modu: eleştirmenler N ajanlarla büyür (gönüllülük tüm eylemleri içerir). Yaklaşım olmadan ~ 10 ajanın ötesine ölçeklendirmeyi engellemez.

### QMIX (2018)  değer parçalanması

Sadece kooperatif.`Q_tot`bir ajan başına Q değerlerinin monoton karıştırma fonksiyonu:

```math
Q_{\text{tot}}(\tau, a) = f\big(Q_1(\tau_1, a_1), \ldots, Q_n(\tau_n, a_n)\big), \quad \frac{\partial f}{\partial Q_i} \ge 0
```

Tek kelimelilik garanti eder `argmax_a Q_tot`Her seçen ajan tarafından hesaplanabilir.`argmax_{a_i} Q_i`- Bağımsız olarak.**exactly the decentralized execution property**Eğitim sırasında, bir karıştırma ağı üretir.`Q_tot`- Bir ajan için Qs'ten.

Neden QMIX SMAC'da kazanıyor: StarCraft mikro yönetimi kooperatifine eşdeğer ajanlar, yerel iş, küresel ödül  değer parçalanması için mükemmel bir uyum sağlar.

Başarısızlık modu: monotonluk kısıtlaması kısıtlayıcıdır; bazı görevlerde monoton bozulmayan ödül yapıları vardır (kişiler için bir ajan feda edilir).

### MAPPO (2022)  göz ardı edilen misilleme

Çoklu Ajan PPO: Merkezi bir değer fonksiyonu olan PPO. Her ajanın kendi politikası vardır; tüm ajanlar tam durumu gören değer fonksiyonlarını paylaşıyor (veya var). Yu ve diğerleri 2022'de MAPPO'yu MADDPG, QMIX ve uzantıları ile beş referans değerine göre karşılaştırdılar ve buldular:

- MAPPO, PARTICLE-WORLD, SMAC, Google Research Football, Hanabi, MPE'deki politikası dışı MARL yöntemlerine eşlik ediyor veya yener.
- En az hiperparametre ayarlaması gereklidir.
- Dayanıklı eğitim; tohumlar arasında yeniden üretilebilir.

Toplum bu makaleye kadar politika MARL'i küçümsüyordu. 2026'da MAPPO kooperatif MARL için varsayılan temel çizgidir; herhangi bir yeni yöntem onu yenmelidir.

### LLM mühendislerinin neden ilgilenmesi gerekiyor

Üç doğrudan kullanım:

1. **Router training.**Meta-agent bir görevi hangi alt-agent ile hallediyor seçer. Bu bir MARL sorunu N merkezi olmayan alt-agent ve bir merkezi yönlendirici.
2. **Role emergence.**Geliştirici ajan simülasyonlarında, zaman içinde tamamlayıcı roller benimsemek için eğitim ajanları, bir MARL sorunu olarak gizlenir.
3. **Multi-agent tool use.**Ajanlar araçları paylaşırken ve bütçe için rekabet ederken, CTDE aracılığıyla eğitilmeleri kaynak kısıtlamalarını saygılı olarak uygulanabilir yerel politikalar üretir.

Pratik bir uyarı: 2026 yılında, çoğu üretim LLM-ajen sistemi, politikalarını eğitmek yerine uyarır. MARL (a) çok sayıda etkileşim verisi, (b) net bir ödül sinyali ve (c) eğitim altyapısına yatırım yapmaya istekli olduğunuzda gelir.

### CTDE, RL'den öte bir tasarım örneği olarak

Eğitim olmadan bile CTDE yararlı bir mimari örneğidir:

- * tasarım* sırasında, tüm ekibin görünürlüğünü düşünün.
- * Runtime*'de merkezi olmayan yürütme uygulanması: her ajan sadece `o_i`- Evet .

Bu model, ajan başına açık bir durum tutmanıza ve öncesinde kısmi gözlemlenebilirliği düşünmenize zorlar. Birçok üretim çok ajanlı sistemi sessizce her yerde paylaşılan durumun varlığını varsaymaktadır.

### Yerleşimsizlik sorunu

Birden fazla ajan aynı anda öğrendiğinde, her ajanın ortamı (başkalarının politikalarını da içeren) sabit değildir.

- MADDPG: Küresel eleştirmen tüm eylemleri görür, bu yüzden değer tahminleri sabit.
- QMIX: değer parçalanması, öğrenmenin iyi tanımlanmış olan en iyi şekilde tanımlanmış olan bir ortak-Q alanına taşınır.
- MAPPO: merkezi değer fonksiyonu, başkalarının politika değişikliklerinden farklılıkları azaltır.

LLM-agent sistemlerinde, istasyonarlık "benim ajanım geçen ay çalıştı, şimdi diğer ajanın akıntıda değişmesi, maden yanlış davranışı" olarak ortaya çıkar.

### Bu ders neyi kapsamıyor

Gerçek ağları eğitmek, 9. aşamada bir konu. Bu ders, CTDE, değer parçalanması ve gradient güncellemeleri olmadan merkezileştirilmiş değer kalıplarını gösteren senaryolı politika sürümlerini oluşturur.

```figure
sw-ctde
```

## Yapın

`code/main.py`Üç örnek gösterisi uyguluyor, hepsi küçük bir iki ajanlı kooperatif şebekesi dünyasında:

- Çevre: 4×4 şebekede 2 ajan, bir ödül pellet.
- `IndependentAgents` her ajan diğerlerini çevre olarak görüyor.
- `MADDPGStyle` Merkezli eleştirmen ortak bir değer hesaplar; aktör politikaları ondan güncelleştirir.
- `QMIXStyle` değer parçalanması monoton bir karıştırıcı ile.
- `MAPPOStyle` Merkezi değer fonksiyonu; politikalar paylaşılan temel çizgiye göre güncellenir.

Dörtü de aynı bölümleri yürütür ve ortalama adımlar ile hedefe rapor eder. CTDE varianları bağımsız başlangıç çizgisinden daha kısa yollara doğru birleşti.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: bağımsız ajanlar ortalama ~ 6 adım atarlar; CTDE varyantları ~ 3.5 adımlara doğru birleşti (optimal 4x4 şebekesi için 3'dir).

## Kullan

`outputs/skill-marl-picker.md`verilen bir çok ajanlı görev için MARL algoritmasını seçen bir beceri: işbirliği vs rekabetçi, homogen vs heterogen, eylem alanı tipi, ölçek, ödül sinyali.

## Gönder

Üretimdeki MARL nadirdir.

- **Start with MAPPO.**2022 makalesi bunu temel çizgi olarak belirledi; ilk olarak yeniden üretmek, daha süslü yöntemlerin peşinden koşmak için haftalar kurtarır.
- **Log every agent's observation and action stream.**Ajanın izleri olmadan MARL'i düzeltmek umutsuz.
- **Separate training code from execution code.**CTDE bir disiplin; sadece yürütme yolunun görmesine izin verin`o_i`- Evet .
- **Reward shaping warning.**MARL, ödül tasarımına çok hassas bir koordinasyon hatası şekillendirme ve ajanlar bunu kullanmayı öğrenir.
- **For LLM agents**MARL eğitimine yalnızca etkileşim verileri + ödül sinyali + altyapı mevcut olduğunda yatırım yapın.

## Egzersizler

1. Çık .`code/main.py`- bağımsız ve MAPPO tarzı ajanlar arasındaki adım-amaca farkı ölçmek. 6x6 şebekede fark büyüyor mu yoksa küçülüyor mu?
2. Rekabetçi bir variant uygulayın: iki ajan, bir pellet, sadece ilk ulaşan ödül alır. Hangi model rekabeti temiz şekilde ele alır?
3. MADDPG'yi okuyun (arXiv:1706.02275) Bölüm 3. Tam eleştirmen güncelleme kuralını kendi kelimelerinizle, sembolik olarak pseudokodla uygulayın.
4. MAPPO'yu okuyun (arXiv:2103.01955). Yazarlar neden merkezi değer + PPO'nun politika dışı MARL'yi yendiğini iddia ediyorlar?
5. CTDE'yi bir hipotetik LLM-ağent sistemi için tasarım örneği olarak uygulayın (örneğin, araştırma ajanı + özetleyici + kodlayıcı).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## Daha Fazla Okumak

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) MAPPO; NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) MAPPO sonuçlarının okunur çerçevesinde
- [SMAC repository](https://github.com/oxwhirl/smac) StarCraft Çoklu Ajan Çabası
