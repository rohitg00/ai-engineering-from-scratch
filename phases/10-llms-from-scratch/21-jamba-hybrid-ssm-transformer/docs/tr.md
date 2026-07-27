# Jamba — Hibrit SSM-Transformer

> Durum uzayı modelleri (SSM'ler) ve transformer'ler farklı şeyler ister. Transformer'ler kaliteyi ikinci dereceden maliyetle dikkat yoluyla satın alırlar. SSM'ler yinelemeli ancak gecikmeli kalite yoluyla doğrusal zamanlı inference ve sabit bellek satın alır. AI21'in Jamba (Mart 2024) ve Jamba 1.5 (Ağustos 2024) bunları aynı modele yerleştirir: her 7 Mamba katmanı için 1 Transformer katman, her diğer blokta MoE ve tek bir 80 GB GPU'ya sığan 256k context window. Mamba-3 (ICLR 2026), SSM tarafını karmaşık değerli durum alanları ve MIMO projeksiyonlarıyla sıkılaştırır. Bu ders, her iki mimariyi de uçtan uca okur ve saf SSM ve saf-Transformer uzun bağlamlı denemeler başarısız olmasına rağmen hibrit tarifin neden üç yıllık ölçeklendirmeye dayanabildiğini açıklar.

**Tür:** Öğren
**Diller:** Python (stdlib, katman karışımı hesaplayıcı)
**Önkoşullar:** Aşama 10 · 14 (açık model mimarileri), Aşama 10 · 17 (yerel seyrek dikkat)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Bir Jamba bloğundaki üç temel öğeyi (Transformer katmanları, Mamba katmanları, MoE) ve 1:7:even serpiştirme tarifini açıklayın.
- Yüksek düzeyde bir SSM'nin tekrarının nasıl göründüğünü ve neden sabit hafızayı inference etkinleştirdiğini belirtin.
- 256k bağlamında bir Jamba modelinin KV önbellek ayak izini hesaplayın ve saf-Transformer modelinin ihtiyaç duyacağı şeylerle karşılaştırın.
- Üç Mamba-3 yeniliğini (üstel-yamuk ayrıklaştırma, karmaşık değerli durum güncellemesi, MIMO) ve her birinin hedeflediği sorunu adlandırın.

## Sorun

Dikkat dizi uzunluğu bakımından ikinci derecedendir. Durum uzayı modelleri doğrusaldır. Bu fark daha da artıyor: 256k tokens'de, bir Transformer dikkat haritası kişi başına 65B giriştir; bir SSM'nin yinelenen durumu, dizi uzunluğundan bağımsız olarak sabit boyuttadır.

Pure-SSM modelleri (Mamba, Mamba-2) küçük ölçeklerde Transformer karışıklığını eşleştirir ancak durum izleme görevlerinde gecikme yaşar ve bazı bağlam içi erişim kategorilerinde başarısız olur. Sezgi: SSM'ler geçmişi sabit bir duruma sıkıştırır ve geçmiş uzun olduğunda bilgi sızıntısı olur. Dikkat her şeyi tam olarak hatırlar ancak ikinci dereceden maliyet öder.

Açıkça görülen düzeltme: ikisini de kullanın. Tam hatırlamanın önemli olduğu yere Transformer katman koyun. SSM katmanlarını başka yerde kullanın. Oranı ayarlayın. Jamba, bu hibrit tarifi geniş ölçekte sunan ilk üretim sınıfı modeldir (52 milyar toplam, 12 milyar aktif, 256 bin bağlam, tek 80 GB GPU). Jamba 1.5, aileyi toplam 398 milyar / aktif 94 milyara çıkarıyor. Mamba-3 (ICLR 2026), hibritlerin yeniden oluşturulabileceği mevcut en iyi saf SSM temelidir.

Bu derste her üç makale de okunur ve "doğru oranın seçilmesi" için zihinsel model oluşturulur.

## Konsept

### Tek sayfada bir SSM

Bir durum uzayı modeli, sabit boyutlu bir durum `h` aracılığıyla bir `x_1, ..., x_N` dizisini işler:

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

Her adımda durum doğrusal bir dinamik `A` aracılığıyla gelişir, `B x_t` girdisini alır ve `C h_t` çıktısını yayar. `A, B, C` öğrenilebilir. Kritik özelliğe dikkat edin: `y_t` hesaplaması yalnızca `h_{t-1}` ve `x_t` gerektirir, daha eski bir `x` gerektirmez. Bellek sabittir. Inference, token başına O(1)'dir.

Modelleme kalitesinin püf noktası `A`'nın yapısıdır. S4 (Gu 2021), eğitim sırasında uzun bir evrişim olarak verimli bir şekilde değerlendirilebilecek oldukça yapılandırılmış bir matris kullandı. Mamba (Gu, Dao 2023) sabit `A, B, C`'yi verilere bağımlı olanlarla ("seçici" kısım) değiştirdi. Mamba-2 (2024) yapıyı daha da basitleştirdi. Mamba-3 (2026), belirli yerlerde karmaşıklığı yeniden katıyor.

Anahtar özellik: Bir kod çözücü Yüksek Lisans Programı için SSM katmanı, büyüyen bir KV önbelleği yerine katman başına sabit boyutlu duruma sahip, dikkat katmanının yerini alan bir uygulamadır.

### Jamba bloğu

Bir Jamba bloğu, katmanları iki sayıya göre serpiştirir:

- `l`: Mamba'ya olan ilgi oranı. Jamba, `l = 8` kullanır, yani her 7 Mamba katmanı için 1 Transformer katman (7 Mamba + 1 Dikkat = grup başına 8 katman).
- `e`: MoE frekansı. Jamba `e = 2` kullanır, yani diğer tüm katmanlar MoE'yi uygular.

Bir blok içindeki katman sırası:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Her Jamba bloğu 8 katmandan oluşur. 4 blok derinliğinde (toplam 32 katman), 28 Mamba ve 4 attention katmanı elde edersiniz. Bu katmanların 16'sı MoE kullanır.

### Neden 1:7 oranı

AI21 ablasyonlar yürüttü: Mamba'ya dikkatin hangi oranı, uzun bağlam değerlendirmelerinde parametre başına en iyi karışıklığı VE bağlam içi hatırlamayı sağlıyor?

- Çok fazla dikkat (1:1): kalite artar ancak bellek ve hız düşer.
- Çok az dikkat (1:15): hafıza harika ancak bağlam içi erişim başarısız oluyor.
- Tatlı nokta: 1:7 veya 1:8.

Sezgi: Transformer katmanları tam geri çağırma ve durum izlemeyi yönetir. Mamba katmanları, ucuz işlem hacmini yönetir.

### Konumsal kodlama

Mamba katmanlarının kendisi de konum farkındadır (yineleme yoluyla). Orijinal Mamba tabanlı hibritlerdeki dikkat katmanları RoPE kullanmıyordu; SSM katmanları konum bilgisi sağlıyordu. Jamba 1.5, ampirik uzun bağlam değerlendirmesine dayanan post-hoc bir iyileştirme olan daha uzun bağlam genellemesi için dikkat katmanlarına RoPE'yi ekler.

### Bellek bütçesi

Jamba-1 şekli için (32 katman: 28 Mamba + 4 Dikkat, gizli 4096, 32 dikkat başlığı):

- KV önbelleği (yalnızca dikkat katmanları): 256k BF16'da `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`. Only the 4 attention layers contribute.
- SSM durumu: token öneki başına `28 * hidden * state_size`, ancak bu katman başına sabit boyutludur, dizi uzunluğuyla ölçeklenmez. Tipik Mamba durumu özellik başına 16, gizli 4096: toplam `28 * 4096 * 16 * 2 = 3.7 MB`.

32 katmandaki saf Transformer, aynı gizli, 32 kafadaki tam MHA ile karşılaştırın: 256k BF16'da `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`. KV önbelleğinde 8 kat azalma. Çoğu 2024 modelinin kullandığı GQA(8) temel çizgisine (`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`) karşı bile, Jamba'nın 16 GB'taki 1:7 hibriti hala 2 kat daha küçüktür.

AI21'in "tek bir 80 GB GPU'da 256k bağlam" ile kastettiği budur. Tam MHA saf Transformer'ın KV önbelleği sığmaz; bir DKG temel çizgisi bile ağırlıklara ve aktivasyonlara yer bırakmaz; Jamba'da öyle.

### Mamba-3: 2026'da saf SSM temeli

Mamba-3 (ICLR 2026, arXiv:2603.15569), saf SSM tarafında üç yenilik sunar:

1. **Üstel-trapezoidal ayrıklaştırma.** Mamba-2'deki Euler yöntemi ayrıklaştırmasını daha anlamlı bir yinelemeyle değiştirir. `x_t` üzerinde bir dış evrişim yerine, çekirdek yineleme içindeki durum girişine uygulanan evrişim benzeri işlem.

2. **Karmaşık değerli durum güncellemesi.** Önceki Mambalar, durum matrisini karmaşıktan (S4) gerçek köşegen (Mamba) ve ölçekli kimliğe (Mamba-2) indirgemişti. Mamba-3, karmaşık değerleri yeniden ekler; durum üzerinde veriye bağlı bir embedding dönere eşdeğerdir. Bu, önceki gerçek değerli basitleştirmelerin maliyeti olan durum izleme yeteneklerini geri yükler.

3. **Çok girişli çok çıkışlı (MIMO) projeksiyonlar.** Özellik başına skaler projeksiyonlar yerine matris değerli projeksiyonlar kullanın. Kod çözme gecikmesini artırmadan modelleme gücünü ve inference zamanlı donanım kullanımını iyileştirir.

1,5B parametrelerde Mamba-3, Gated DeltaNet'e göre ortalama aşağı akış doğruluğunu 0,6 puan artırır; MIMO varyantı toplam 1,8 puanlık kazanç için 1,2 puan daha ekler. Aynı eyalet boyutunda Mamba-3, Mamba-2'yi eyaletin yarısıyla eşleştirir.

Mamba-3 henüz geniş ölçekte bir üretim hibridiyle gönderilmiyor; ancak bir sonraki Jamba sınıfı modelin SSM tarafı için açık bir aday.

### Hibrite ne zaman ulaşmalı

Hibritler şu durumlarda kazanır:

- Bağlam, saf Transformer KV önbelleğinin sıkıntılı hale gelmesine (64k+) yetecek kadar uzun.
- Görevler, kısa menzilli yapıyı (SSM için iyi) uzun menzilli geri çağırmayla (Transformer gerektirir) birleştirir.
- Transformer KV önbelleğinin tek başına sığmayacağı tek GPU bellek bütçelerine dağıtım yapmak istiyorsunuz.

Melezler şu durumlarda kaybeder:

- Bağlam kısa (16k'nin altında). SSM yükü boşa harcanır; saf Transformer iyidir.
- Görevler her yerden her yere dikkat gerektirir (derin akıl yürütme, çoklu belge çapraz referansı). Melezdeki dikkat katmanlarının azlığı acı veriyor.
- Trilyon parametreli sınır modellerine ölçekleniyorsunuz. Pure-Transformer + MLA + MoE (DeepSeek-V3 stili) şu anda yetenek yarışını kazanıyor.

### Rekabet ortamı

| Modeli | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | doğrusal zaman, sabit bellek |
| Jamba | hibrit | 52B/12B | 80 GB'ta 256 bin |
| Jamba 1.5 Large | hybrid | 398B/94B | kurumsal düzeyde uzun bağlam |
| Mamba-3 | saf SSM | 1,5B (kağıt) | durum takibi geri yüklendi |
| DeepSeek-V3 | saf Transformer + MoE | 671B/37B | sınır yeteneği |

2026 manzarası: pure-Transformer MoE sınırda hakim durumda, ancak hibritler 256 binden fazla bağlam nişine sahip. Mamba-3'ün durum izleme kazanımları, gelecek nesilde hibrit oranlarının daha düşük olmasına (daha fazla SSM, daha az dikkat) neden olabilir.

```figure
swiglu-ffn
```

## Kullan onu

`code/main.py` hibrit mimarilere yönelik bir bellek hesaplayıcıdır. Bir SSM-Transformer oranı ve gizli boyut / katman sayısı yapılandırması verildiğinde şunu hesaplar:

- Hedef bağlamda KV önbelleği.
- SSM durum belleği.
- Bir dizi model şekli için N bağlamındaki toplam bellek.

Hesap makinesi şunları destekler:

- Pure-Transformer taban çizgisi (KV önbelleği N ile birlikte büyür).
- Jamba tarzı 1:7 hibrit.
- Pure-SSM (hiç KV önbelleği yok).

Sayılar, yayınlanan şekiller için doğrudan Jamba-1 ve Jamba-1.5 makalelerinden alınmıştır ve varsayımsal değişkenler için tahmin edilmiştir.

Gerçek bir deployment için entegrasyon hususları:

- Çoğu üretim inference sunucusu (vLLM, SGLang) Jamba ve Mamba'yı destekler. Belirli sürümü kontrol edin.
- 256k bağlamında, Jamba'nın bellek avantajı eşzamanlı istek veriminde ortaya çıkıyor. Aynı VRAM'e Transformer dizisinden daha fazla Jamba dizisi sığdırıyorsunuz.
- Bağımsız bir model olarak Mamba-3 henüz üretime geçmiyor; araştırma önizlemesi 1,5B'de.

## Gönderin

Bu ders `outputs/skill-hybrid-picker.md` üretir. Bir iş yükü spesifikasyonu (bağlam uzunluğu profili, görev karışımı, bellek bütçesi) göz önüne alındığında, saf bir Transformer, Jamba tarzı bir hibrit ve saf bir SSM arasında, bellek ve kalite değiş tokuşları hakkında açık bir akıl yürütme ile tavsiyede bulunur.

## Egzersizler

1. 32 katmanlı saf Transformer (gizli 4096, 32 kafa) ve aynı şekle sahip bir Jamba-1 hibriti için KV önbelleğini 256k bağlamda hesaplamak üzere `code/main.py` komutunu çalıştırın. AI21 belgesinin iddia ettiği ~8 kat bellek azaltımını doğrulayın.

2. Hesap makinesini 1:3 hibrit (4 Mamba : 1 Dikkat) ve 1:15 hibrit (14 Mamba : 1 Dikkat) modelleyecek şekilde değiştirin. KV önbelleği ile oranın grafiğini çizin. KV önbelleği hangi oranda SSM durum belleğine eşittir?

3. Jamba makalesinin 3. Bölümünü okuyun (arXiv:2403.19887). Mamba-2 daha hızlı olmasına rağmen AI21'in neden Mamba-2 yerine Mamba-1 kullandığını açıklayın. İpucu: Hibrit ablasyon bölümü bunu belgelemektedir.

4. Jamba 1.5 Large'da (toplam 398B, 94B aktif) MoE-diğer katmanların parametre ek yükünü hesaplayın. Aktif oranı DeepSeek-V3 (37B/671B) ile karşılaştırın ve Jamba mimarisinin neden aktif oranı daha yükseğe çıkardığını açıklayın.

5. Mamba-3 makalesinin (arXiv:2603.15569) 3. Bölümünü okuyun. Karmaşık değerli bir durum güncellemesinin neden veriye bağlı bir döner embedding ile eşdeğer olduğunu üç cümleyle açıklayın. Cevabı Aşama 7 · Ders 04'ün RoPE türetmesine bağlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Durum uzayı modeli (SSM) | "Sabit durumla yineleme" | Öğrenilmiş yinelemeye sahip bir katman `h_t = A h_{t-1} + B x_t`; token başına sabit bellek |
| Seçici SSM | "Mamba'nın numarası" | Modele doğrusal zamanda geçit benzeri seçicilik kazandıran verilere bağlı A, B, C parametreleri |
| Dikkat-Mamba oranı | "Kaç tane dikkat katmanı" | Jamba'da `l = 8`, 7 Mamba katmanı başına 1 dikkat katmanı anlamına gelir |
| Jamba bloğu | "8 katmanlı grup" | Alternatif pozisyonlarda bir dikkat + yedi Mamba + MoE |
| SSM durumu | "Gizli arabellek" | Mamba katmanları için KV önbelleğinin yerini alan, katman başına sabit boyutlu durum |
| 256k bağlam | "Jamba'nın amiral gemisi numarası" | Jamba-1 dizi uzunluğu tek bir 80 GB GPU'ya sığar; saf Transformer bu boyutta olamaz |
| Mamba-3 | "2026 saf SSM" | Karmaşık durum + MIMO ile mevcut en iyi saf SSM mimarisi; temel hibritler etrafında yeniden inşa ediliyor |
| MIMO | "Çok girişli çoklu çıkış" | Özellik başına skaler yerine matris değerli projeksiyonlar kullanan Mamba-3 yeniliği |
| Üstel-yamuk ayrıklaştırma | "Mamba-3'ün tekrarı" | Mamba-2'nin Euler yöntemi ayrıklaştırmasını kapsayan daha anlamlı yineleme |
| Hibrit mimari | "Dikkat ve SSM'yi karıştırın" | Transformer ve SSM katmanlarını serpiştiren herhangi bir model; Jamba üretim arketipidir |

## Daha Fazla Okuma

- [Lieber ve ark. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) — orijinal Jamba makalesi, oran ablasyonları, 256k bağlam iddiası
- [AI21 — Jamba 1.5: Hibrit Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) — ölçeği büyütülmüş aile, 398B/94B ve 12B/52B genel sürümler
- [Gu, Dao — Mamba: Seçici Durum Uzaylarıyla Doğrusal Zaman Dizisi Modellemesi (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) — Jamba'nın temel aldığı seçici SSM makalesi
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) — basitleştirilmiş yapılandırılmış durum uzayı halefi
- [Lahoti ve ark. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) — karmaşık değerli durum, MIMO, 2026 saf SSM sınırı
- [Gu ve ark. — Yapılandırılmış Durum Uzayları ile Uzun Dizileri Verimli Bir Şekilde Modellemek (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) — S4 makalesi, LLM'ler için SSM soyağacının başlangıç ​​noktası
