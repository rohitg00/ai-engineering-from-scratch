# MARL — MADDPG, QMIX, MAPPO

> 2026'da hala LLM-agent sistemlerine bilgi sağlayan çoklu-agent koordinasyonunun takviye-öğrenme mirası. **MADDPG** (Lowe ve diğerleri, NeurIPS 2017, arXiv:1706.02275) Merkezi Eğitim, Merkezi Olmayan Yürütme'yi (CTDE) tanıttı: her eleştirmen eğitim sırasında tüm agent'larin durumlarını ve eylemlerini görür; test zamanında sadece yerel aktörler yarışıyor. İşbirlikçi, rekabetçi ve karma ortamlar için çalışır. **QMIX** (Rashid ve diğerleri, ICML 2018, arXiv:1803.11485), monotonik bir karıştırma ağıyla değer ayrıştırmasıdır; per-agent Q, eklem Q'da birleşir, böylece `argmax` temiz bir şekilde dağıtılır; StarCraft Multi-Agent Challenge'da (SMAC) baskındır. **MAPPO** (Yu ve diğerleri, NeurIPS 2022, arXiv:2103.01955) merkezi değer fonksiyonuna sahip PPO'dur; Parçacık dünyası, SMAC, Google Araştırma Futbolu ve Hanabi üzerinde minimum ayarlamayla "şaşırtıcı derecede etkili". Bunlar, merkezi olmayan bir şekilde hareket etmesi gereken agent ekiplerine yönelik eğitim politikalarının temelini oluşturur. MAPPO **varsayılan 2026 kooperatif-MARL temelidir**. Bu ders, her birini küçük bir ızgara dünyası oyuncağından inşa eder ve Yüksek Lisans-agent eğitimine dokunmadan önce üç fikri kas hafızasına yerleştirir.

**Tür:** Öğren
**Diller:** Python (stdlib, küçük NumPy içermeyen uygulamalar)
**Önkoşullar:** Aşama 09 (Takviyeli Öğrenme), Aşama 16 · 09 (Paralel Sürü Ağları)
**Süre:** ~90 dakika

## Sorun

LLM-agent sistemleri, agent arası koordinasyona yönelik politikaları giderek daha fazla eğitiyor: ne zaman ertelenmeli, ne zaman harekete geçilmeli, hangi eş aranmalı. Bu tür politikaları nasıl eğiteceğinizi anlatan literatür, LLM dalgasından önce gelen ve küçük bir baskın algoritma kümesine sahip olan Çoklu-Agent Takviyeli Öğrenme'dir (MARL).

MARL makalelerini kalıp söz dağarcığı olmadan okumak acı vericidir. Merkezi olmayan yürütme (CTDE), değer ayrıştırma ve merkezileştirilmiş eleştirilerle merkezileştirilmiş eğitim moda sözcükler değildir; bunlar belirli sorunlara özel yanıtlardır:

- Bağımsız RL (her agent tek başına öğrenir), her agent'ın bakış açısına göre durağan değildir. Kötü.
- Merkezi RL (bir agent tümünü kontrol eder) ölçeklenmez ve yürütme kısıtlamalarını ihlal eder.
- CTDE her ikisinin de en iyisini alır: küresel bilgilerle eğitim alın, yerel politikalarla konuşlandırın.

## Konsept

### Gazetelerin kullandığı üç ortam

- **Parçacık Dünyası (multi-agent parçacık ortamı).** İşbirliğine dayalı/rekabetçi görevlerle basit 2 boyutlu fizik. MADDPG'nin orijinal test ortamı.
- **StarCraft Multi-Agent Challenge (SMAC).** İşbirliğine dayalı mikro yönetim, kısmi gözlem. QMIX'in test ortamı. Ayrık eylemler, sürekli durumlar.
- **Google Araştırma Futbolu, Hanabi, MPE.** MAPPO temelleri.

Farklı ortamların farklı eylem/gözlem türleri vardır. Algoritmalar buna göre seçim yapar.

### MADDPG (2017) — CTDE modeli

Her agent `i` , kendi gözlemini eylemle eşleştiren bir aktöre ( `mu_i(o_i)` ) sahiptir. Her agent ayrıca eğitim sırasındaki tüm gözlemleri ve tüm eylemleri gören bir eleştirmene ( `Q_i(x, a_1, ..., a_n)` ) sahiptir. Aktör, eleştirmenin değerlendirmesine göre gradient politikasına göre güncellenir.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

Neden CTDE: Eğitim sırasında herkesin eylemlerini biliyoruz; bunu her eleştirmendeki farklılığı azaltmak için kullanırız. Dağıtım zamanında her agent yalnızca `o_i` 'yi görür ve `mu_i(o_i)`'ı çağırır.

Başarısızlık modu: eleştirmenler N agents ile büyür (girdi tüm eylemleri içerir). Yaklaşık değerler olmadan ~10 agent saniyeyi aşacak şekilde ölçeklenmez.

### QMIX (2018) — değer ayrışımı

Sadece kooperatif. Küresel ödül, her-agent Q değerinin monoton fonksiyonunun toplamıdır:

```
Q_tot(tau, a) = f(Q_1(tau_1, a_1), ..., Q_n(tau_n, a_n)),   df/dQ_i >= 0
```

Monotonluk garantileri `argmax_a Q_tot` , her agent'ın bağımsız olarak `argmax_{a_i} Q_i` 'yi seçmesiyle hesaplanabilir. Bu **tam olarak ihtiyacınız olan merkezi olmayan uygulama özelliğidir**. Eğitim zamanında, bir karma ağ, her-agent Q'dan `Q_tot` üretir.

QMIX neden SMAC'ta kazanıyor: işbirlikçi StarCraft mikro yönetiminin homojen agent'ları, yerel gözlemleri, küresel ödülleri vardır; değer ayrıştırması için mükemmel uyum.

Başarısızlık modu: monotonluk kısıtlaması kısıtlayıcıdır; bazı görevlerin monoton olarak ayrıştırılamayan ödül yapıları vardır (ekip için bir agent fedakarlık). Uzantılar (QTRAN, QPLEX) bunu rahatlatır.

### MAPPO (2022) — gözden kaçan varsayılan

Çoklu-Agent PPO: Merkezi değer fonksiyonuna sahip PPO. Her agent'ın kendi politikası vardır; tüm agent'larin tam durumu gören paylaşımlı (veya her-agent) değer işlevi vardır. Yu ve diğerleri. 2022 benchmarkMADDPG, QMIX ve bunların uzantılarına karşı beş benchmarks üzerinde MAPPO'yu araştırdı ve şunu buldu:

- MAPPO, parçacık dünyası, SMAC, Google Research Football, Hanabi, MPE'deki politika dışı MARL yöntemleriyle eşleşir veya onları yener.
- Minimal hiperparametre ayarı gerekli.
- Kararlı eğitim; tohumlar arasında tekrarlanabilir.

Topluluk bu makaleye kadar MARL politikasını hafife alıyordu. 2026'da MAPPO, kooperatif MARL için varsayılan temeldir; herhangi bir yeni yöntem onu ​​yenmelidir.

### Yüksek Lisans-agent mühendisleri neden bunu önemsemeli?

Üç doğrudan kullanım:

1. **Yönlendirici eğitimi.** Bir meta-agent, bir görevi hangi alt-agent'ın gerçekleştireceğini seçer. Bu, N adet merkezi olmayan altagent ve bir merkezi yönlendiriciden oluşan bir MARL sorunudur. MAPPO uyuyor.
2. **Rol ortaya çıkışı.** Üretken-agent simülasyonlarda, agent'lari zaman içinde tamamlayıcı rolleri benimsemek üzere eğitmek, kılık değiştirmiş bir MARL sorunudur. QMIX tarzı değer ayrıştırması, yapı itibarıyla tamamlayıcılığı zorlar.
3. **Çoklu-agent araç kullanımı.** agent'lar araçları paylaşıp bütçe için rekabet ettiğinde, onları CTDE aracılığıyla eğitmek, kaynak kısıtlamalarına saygı duyan konuşlandırılabilir yerel politikalar üretir.

Pratik uyarı: 2026'da çoğu üretim LLM-agent sistemi, onları eğitmek yerine kendi politikalarını prompt benimseyecek. MARL, (a) çok sayıda etkileşim verisine, (b) net bir ödül sinyaline ve (c) eğitim altyapısına yatırım yapma isteğine sahip olduğunuzda devreye girer.

### RL'nin ötesinde bir tasarım modeli olarak CTDE

CTDE, eğitim almasanız bile kullanışlı bir mimari modeldir:

- *Tasarım* sırasında ekibin tamamının görünürlüğünü üstlenin.
- *Çalışma zamanında*, merkezi olmayan yürütmeyi zorunlu kılın: her agent yalnızca `o_i`'yi görür.

Bu model sizi her-agent durumunu açık tutmaya ve kısmi observability'yi önceden düşünmeye zorlar. Çoğu üretim çoklu-agent sistemi sessizce her yerde paylaşılan durumu varsayar; CTDE disiplini bunu engeller.

### Durağan olmama sorunu

Birden fazla agent aynı anda öğrendiğinde, her agent'ın ortamı (diğerlerinin politikalarını da içerir) durağan değildir. Klasik tek-agent RL provaları bozulur. Bu dersteki MARL algoritmalarının tümü şunu ele alıyor:

- MADDPG: küresel eleştirmen tüm eylemleri görür, dolayısıyla değer tahmini sabittir.
- QMIX: değer ayrıştırması, öğrenmeyi optimalliğin iyi tanımlandığı ortak Q alanına taşır.
- MAPPO: merkezi değer işlevi, diğerlerinin politika değişikliklerinden sapmayı azaltır.

LLM-agent sistemlerinde durağan olmama, "benim agent'm geçen ay çalıştı, şimdi diğer agent yukarı akış değişti, benimki yanlış davranıyor." MARL'yi CTDE ile eğitmek temel çözümdür; prompt düzeyindeki düzeltmeler daha hızlıdır ancak daha az dayanıklıdır.

### Bu dersin KAPSAMADIĞI konular

Gerçek ağların eğitimi bir Aşama 09 konusudur. Bu ders, CTDE'yi, değer ayrıştırmayı ve merkezi değer modellerini gradient güncellemeleri olmadan gösteren kodlu politika sürümlerini oluşturur. Amaç, tam bir MARL kütüphanesini (PyMARL, MARLlib, RLlib multi-agent) almadan önce kalıpları içselleştirmektir.

## Build It — Kendin Geliştir

`code/main.py` , tümü küçük bir 2-agent işbirlikçi ızgara dünyasında olmak üzere üç model gösterimi uygular:

- Ortam: 4x4 ızgarada 2 agent, bir ödül pelleti. Ödül = 1 eğer herhangi bir agent taneye ulaşırsa; görev biter.
- `IndependentAgents` — her agent diğerlerine çevre olarak davranır. Temel.
- `MADDPGStyle` — merkezi eleştirmen ortak bir değer hesaplar; aktör politikaları buradan güncellenir. Senaryolu politika iyileştirmesi.
- `QMIXStyle` — monoton bir karıştırıcıyla değer ayrıştırma.
- `MAPPOStyle` — merkezi değer fonksiyonu; politikalar paylaşılan temele göre güncellenir.

Dördü de aynı bölümleri çalıştırıyor ve hedefe giden ortalama adımları rapor ediyor. CTDE varyantları bağımsız taban çizgisinden daha kısa yollara yakınlaşır.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: bağımsız agent'lar ortalama ~6 adım atar; CTDE varyantları ~3,5 adıma yakınlaşır (4x4 ızgara için en uygun olanı 3'tür). Desen farkı yazılı politikalara rağmen ortaya çıkıyor.

## Use It — Hazır Araçla Uygula

`outputs/skill-marl-picker.md` , belirli bir çoklu-agent görevi için bir MARL algoritması seçen bir beceridir: işbirlikçiye karşı rekabetçi, homojene karşı heterojen, eylem alanı türü, ölçek, ödül sinyali.

## Ship It — Kullanıma Sun

Üretimde MARL nadirdir. Bunu kullandığınızda:

- **MAPPO ile başlayın.** 2022 belgesi bunu temel olarak belirledi; ilk önce onu yeniden üretmek, haftalarca daha karmaşık yöntemlerin peşinde koşmaktan kurtarır.
- **Her agent'ın gözlem ve eylem akışını günlüğe kaydedin.** Per-agent izleri olmadan MARL'de hata ayıklamak umutsuzdur.
- **Eğitim kodunu yürütme kodundan ayırın.** CTDE bir disiplindir; yürütme yolunun gerçekten yalnızca `o_i` görmesine izin verin.
- **Ödül şekillendirme uyarısı.** MARL, ödül tasarımına son derece duyarlıdır. Şekillendirmede bir koordinasyon hatası var ve agentlar bundan yararlanmayı öğreniyor. Rakip testleri çalıştırın.
- **LLM agent'lar** için öncelikle prompt düzeyindeki politikaları göz önünde bulundurun. MARL eğitimine yalnızca etkileşim verileri + ödül sinyali + altyapı mevcut olduğunda yatırım yapın.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Bağımsız ve MAPPO tarzı agent'lar arasındaki adım-hedef aralığını ölçün. 6x6'lık bir ızgarada boşluk büyüyor mu yoksa daralıyor mu?
2. Rekabetçi bir varyant uygulayın: iki agent, bir saçma, yalnızca ilk ulaşan ödül alır. Hangi model rekabeti temiz bir şekilde ele alıyor? MADDPG tarihsel olarak.
3. MADDPG (arXiv:1706.02275) Bölüm 3'ü okuyun. Kritik güncelleme kuralını tam olarak kendi kelimelerinizle sözde kodda sembolik olarak uygulayın.
4. MAPPO'yu okuyun (arXiv:2103.01955). Yazarlar neden merkezi değer + PPO'nun benchmark'larda politika dışı MARL'yi yendiğini iddia ediyor? En güçlü üç iddiayı listeleyin.
5. CTDE'yi varsayımsal bir LLM-agent sistemine (e.g., araştırma agent + özetleyici + kodlayıcı) bir tasarım modeli olarak uygulayın. Çalışma zamanında mevcut olmayan, tasarım zamanında mevcut olan ortak bilgi nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MARL | "Çoklu-Agent RL" | Çoklu-agent sistemler için takviyeli öğrenme. |
| CTDE | "Merkezi Eğitim, Merkezi Olmayan Uygulama" | Küresel bilgilerle eğitim alın; yerel politikalarla dağıtın. |
| MADDPG | "Çoklu-Agent DDPG" | Tüm gözlemleri + eylemleri gören, her-agent eleştirmeni olan CTDE. |
| QMIX | "Değer ayrışımı" | Her-agent Q'nun monotonik karışımı. Kooperatif. |
| MAPPO | "Çoklu-Agent PPO" | Merkezi değer fonksiyonuna sahip PPO. 2026 varsayılan taban çizgisi. |
| Değer ayrışımı | "Bireysel Q'ların toplamı" | Ortak Q, per-agent Q'nun monoton bir fonksiyonu olarak temsil edilir. |
| Durağan Olmama | "Hedefler taşınıyor" | Diğerleri öğrendikçe her agent'ın ortamı değişir. Temel MARL sorunu. |
| Politikaya uygun / politika dışı | "Geçerli/tekrardan öğren" | PPO politikadadır (MAPPO); DDPG ve Q-öğrenme politika dışıdır. |
| SMAC | "StarCraft Çoklu-Agent Mücadelesi" | İşbirliğine dayalı mikro yönetim benchmark; QMIX'in kendi yetiştirdiği toprak. |

## Daha Fazla Okuma

- [Lowe ve ark. — Karma İşbirlikçi-Rekabetçi Ortamlar için Çoklu-Agent Aktör-Eleştirmen](https://arxiv.org/abs/1706.02275) — MADDPG; NeurIPS 2017
- [Rashid ve ark. — QMIX: Derin Çoklu-Agent Takviyeli Öğrenme için Monotonik Değer Fonksiyonunun Çarpanlara Ayrılması](https://arxiv.org/abs/1803.11485) — QMIX; ICML 2018
- [Yu ve ark. — İşbirliğine Dayalı ÇokluAgent Oyunlarda PPO'nun Şaşırtıcı Etkinliği](https://arxiv.org/abs/2103.01955) — MAPPO; NeurIPS 2022
- [MAPPO'daki BAIR blog yazısı](https://bair.berkeley.edu/blog/2021/07/14/mappo/) — MAPPO sonucunun okunabilir çerçevesi
- [SMAC deposu](https://github.com/oxwhirl/smac) — StarCraft Çoklu-Agent Mücadelesi
