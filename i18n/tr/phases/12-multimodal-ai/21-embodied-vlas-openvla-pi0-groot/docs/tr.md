# İçeriye yerleştirilmiş VLA'lar: RT-2, OpenVLA, π0, GR00T

> Bir model ilk kez bir web sitesinden bir tarif okudu ve mutfak robotu ile uyguladı RT-2 (Google DeepMind, Temmuz 2023). RT-2, metin işaretleri olarak eylemleri ayırt etti, web verileri ve robot eylem verileri üzerine bir VLM'yi birlikte ayarladı ve web ölçeğinde görme dil bilgisinin robot kontrolüne aktarıldığını kanıtladı. OpenVLA (Haziran 2024) açık 7B referansını gönderdi. Fiziksel Zeka'nın π0 serisi (2024-2025) akış eşleşme eylem uzmanlarını ekledi. NVIDIA'nın GR00T N1 (Mart 2025) ikili sistemli (Sistem 1 / Sistem 2) kontrolü, insanüstü robotlar için ölçekte sağladı. VLA ilkel  görme dili-hareket, gören, okuyan ve hareket eden tek bir model  bu aşamada anlama modelleri ile 15. aşamada otonom sistemler arasındaki köprüdür.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Öğrenme Hedefleri

- Eylem simgesi tanımlayın: ayrı bin kodlaması (RT-2), FAST verimli eylem simgesi, sürekli akış eşleşme eylemleri (π0).
- Web + robot verilerindeki ortak ince ayarlamanın neden yeni görevlere genel bilgi aktarımını koruduğunu açıklayın.
- OpenVLA (open 7B Llama+VLM), π0 (akış eşleşimi) ve GR00T N1 (ikili sistem) ile aynı robot görevinde karşılaştırın.
- Açık X-Embodiment veri kümesinin ve RT-X eğitim korpusu olarak rolünün adını verin.

## Sorun

Doğal dil talimatlarından iş yapan bir robot 1970'lerden beri bir araştırma hedefi olmuştur. 2020'lerin cevabı: bir görme dili-hareket (VLA) modeli. VQA için kullanılan aynı VLM mimarisi, ancak çıkış metin yerine eylemlerdir (birleştirilmiş torks, son efektör pozları, ayrı komutlar).

VLA'lara özel zorluklar:

1. Hareket alanları sürekli (birleştirilmiş açılar, güçler) ve yüksek boyutlu (7 DOF kol + 3-DOF tutku = 30 Hz'de 10 dim).
2. Robot özel eğitim verileri nadirdir. Açık X-Embodiment ~ 1M yoldur; web metin görüntüsü 5B +.
3. Kontrol frekansı önemli. 30 Hz kontrol döngüsü, her harekete 33 ms bütçedir.
4. Yanlış bir eylem donanım, insan veya malı zarar verir.

## Anlaşım

### Eylem simgesi (RT-2)

RT-2'nin hilesi: her ortak hedefi kuantistik bir metin jetonu olarak temsil edin. Normalleştirilmiş [-1, 1] aralığını 256 kutuya ayırın, her kutuyu bir kelime birikimi kimliği ile harekete geçirin. 10 DOF eyleminin her kontrol adımında 10 jetonu olur.

PaLM-X VLM'i karışım üzerinde birlikte ayarlayın:

- Web görüntü-metin çiftleri (başlık, VQA).
- Robot gösterileri, simgeler olarak hareket.

Model "kırmızı küpü topla" (dilli) → görüntü (görünüş) → 10 jeton eylem dizisi (diskretleştirilmiş ortak hedefler) görür. Web öncesi eğitim genel bilgi aktarımını korur: RT-2 "hızlı hareket eden nesneye doğru hareket" yapabilmektedir.

RT-2 kağıtında 3-5 Hz'de bir ferans, VLM autoregressive decode ile sınırlandırılır.

### OpenVLA  açık 7B referansı

OpenVLA (Kim ve diğerleri, Haziran 2024) açık ağırlıklı RT-2 eşdeğeri. 7B Llama omurgası, DINOv2 + SigLIP çift görüş kodlayıcı, 256 kutu üzerinde eylem simgesellemesi.

Açık X-Embodiment'te eğitim görmüşler. 22 robot üzerinde 970 bin rota.

Aktarım: 4-5 Hz, bir A100'de kuantitasyonla.

### Hızlı Tokenizer  daha hızlı eylem çözümü

Pertsch et al. (2024) diskre bin tokenizasyonunun verimsiz olduğunu gösterdi  bin alanının küçük bir bölgesinde çoğu eylem kümesi. FAST (Frequency-domain Action Sequence Tokenizer) DCT üzerinden eylem sekanslarını sıkıştırır ve koefisienleri kvantize eder.

30 adımlı bir eylem tarzı 300 ayrı bin jetonu yerine ~ 10 FAST jetonu olur.

### π0 ve akış eşleşme eylemleri

Fiziksel Zekilik'in π0 (Black et al., Ekim 2024) ayrı eylem belirtilerini akış eşleşme eylem uzmanıyla değiştirir:

- Küçük bir eylem transformatörü VLM'nin gizli durumlarını okuyor ve düzeltilmiş akış yoluyla sürekli 50 adımlı bir eylem dizisini çıkartıyor.
- Hareket başı akış eşleşme kaybı ile trenler; VLM antrenman öncesi değişmez kalır.
- İndirim: ~ 5 denoizing adımlarda yayılan tam eylem dizisi, etkin olarak 50 Hz kontrolü.

π0'nun iddiası: OpenVLA ve Octo'yu geniş bir manipülasyon görevleri yelpazesi üzerinde yenir.

π0.5 ve π0-FAST, aşamalı yükseltmelerdir. π0-FAST, FAST tokenizasyonunu akış eşleşimi ile birleştirir.

### GR00T N1  İnsanüstü hayvanlar için çift sistem

NVIDIA'nın GR00T N1 (Mart 2025) insanüstü robotlar için inşa edilmiştir (> 30 DOF, tam vücut):

- Sistem 2: Büyük bir VLM okuma sahnesini + talimatı, ~ 1 Hz'de yüksek düzeyde alt hedefler üretir.
- Sistem 1: alt hedeflere kondisyone edilen düşük seviye 50-100 Hz ortak komutları üreten küçük bir hareket başı transformatörü.

Kahneman'ın hızlı ve yavaş düşüncesine ayrılmış haritalar: Sistem 2 planları, Sistem 1 eylemleri. Avantajlar: yavaş VLM boyutlu planlama hızlı kontrolü engeller; Sistem 1 gecikme için küçük kalır.

GR00T N1.7 (yıl 2025 sonları) veri ölçeklemesini geliştirir. GR00T, Omniverse'den sim-real verilerle ince ayarlar yapar.

### Açık X-Body

RT-X (Oktyabr 2023) 22 robot üzerinde 1M yörüngeleri kapsayan 22 veri kümesi topladı. Open X-Embodiment herkesin kullandığı korpus:

- ALOHA / Bridge V2 / Droid / RT-2 Mutfağı / Dil Masası.
- Her örnek: (robot durum, kamera görüntüleri, talimatlar, eylem sırası).
- Eğitim hijyen: eylem alanını tekelleştirmek, ortak alanları normalleştirmek, kameraların boyutlarını değiştirmek.

OpenVLA ve π0 Open X-Embodiment'de trenler.

### - Sadece robotla karşılaştırıldığında

Co-fine-tuning web VQA verilerini robot yolları ile karıştırır. oran önemlidir: çok fazla VQA ve model eylemleri unutuyor; çok fazla robot verisi ve model genel bilgiyi kaybediyor.

RT-2 oranı: ~1:1. OpenVLA: ~0.5:1 web-robot. π0: benzer.

Sadece robot eğitiminde dağıtım dışı talimatlarda başarısız olan görev-spesifik modeller üretilir. Ko-fin-tuning "kırmızı küpü (demodede) topla" ve "soldan üçüncü en büyük nesneyi topla" arasındaki farkdır.

### Güvenlik ve eylem sınırları

Her üretim VLA gemisi:

- sert eklem sınırları (specifiğe geçebilir).
- Hız sınırı (yumuşak kesim).
- Çalışma alanı sınırları (son efektör masayı terk edemez).
- Yeni görevler için insanlık olarak onay.

Bu VLA'nın kontrol katman kontrolleri olarak VLA'nın dışında oturuyor.

```figure
mm-action-tokens
```

## Kullan

`code/main.py`- ...

- 256-bin eylem tokenizasyonu ve tokenizlemeyi uyguluyor.
- DCT + kuantitasyon üzerine kurulmuş FAST tokenizer çizimleri.
- Etkinlik adım başına simge sayısını karşılaştırır (diskret bin, FAST, sürekli akış).
- RT-2 → OpenVLA → π0 → GR00T'nin soy özetini basar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-vla-action-format-picker.md`. Robot görevleri (manipülasyon, navigasyon, insanüstü tüm vücut) verildiğinde, diskre bin + RT-2, FAST + OpenVLA, akış eşleşimi + π0, veya çift sistem + GR00T arasında seçim yapılır.

## Egzersizler

1. 10 DOF kolu 30 Hz kontrol hızında 256 kutuda diskret bin tokenizasyonu saniyede kaç tane token yayar?

2. Hızlı tokenizasyon 30 adımlı yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki

3. π0'nin akış eşleşme başı ~ 5 adımla denosiyon yapar.

4. GR00T'nin Sistem 1 / Sistem 2 Kahneman'a haritayı bölüyor. İki ayaklı yürümeyi yardımcı olabilecek farklı bir bölme (Sistem 3?) önerir.

5. Open X-Embodiment Bölümü 4'ü okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Daha Fazla Okumak

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
