# Yerleşik VLA'lar: RT-2, OpenVLA, π0, GR00T

> İlk kez bir modelin bir web sitesindeki tarifi okuyup bunu bir mutfak robotunda yürütmesi RT-2'ydi (Google DeepMind, Temmuz 2023). RT-2, eylemleri metin token'ler olarak ayrıklaştırdı, web verileri artı robot eylem verileri üzerinde bir VLM'ye ortak ince ayar yaptı ve web ölçeğinde görüş dili bilgisinin robotik kontrole aktarıldığını kanıtladı. OpenVLA (Haziran 2024) açık 7B referansını yayınladı. Fiziksel Zeka'nın π0 serisi (2024-2025), akış eşleştirme eylem uzmanlarını ekledi. NVIDIA GR00T N1 (Mart 2025), insansı robotlar için uygun ölçekte ikili sistem (Sistem 1 / Sistem 2) kontrolü sağladı. VLA ilkel - vizyon-dil-eylem; gören, okuyan ve hareket eden tek bir model - bu aşamanın anlayış modelleri ile Aşama 15'teki otonom sistemler arasındaki köprüdür.

**Tür:** Öğren
**Diller:** Python (stdlib, eylem tokenizer + VLA inference iskeleti)
**Önkoşullar:** Aşama 12 · 05 (LLaVA), Aşama 15 (Otonom Sistemler, referans alınmıştır)
**Süre:** ~180 dakika

## Öğrenme Hedefleri

- tokenizasyon eylemini açıklayın: ayrık kutu kodlama (RT-2), HIZLI verimli eylem token'ler, sürekli akış eşleştirme eylemleri (π0).
- Web + robot verileri üzerindeki ortak fine-tuning'nin neden yeni görevlere genel bilgi aktarımını koruduğunu açıklayın.
- Aynı robot görevinde OpenVLA (açık 7B Llama+VLM), π0 (akış eşleştirme) ve GR00T N1'i (çift sistem) karşılaştırın.
- Open X-Embodiment dataset'yi ve RT-X eğitim külliyatı olarak rolünü adlandırın.

## Sorun

Doğal dil talimatlarına göre ev işleri yapan bir robot, 1970'lerden bu yana araştırma hedefi olmuştur. 2020'lerin cevabı: bir vizyon-dil-eylem (VLA) modeli. VQA için kullanılan aynı VLM mimarisi, ancak çıktı metin yerine eylemlerdir (ortak torklar, uç efektör pozları, ayrı komutlar).

VLA'lara özgü zorluklar:

1. Hareket alanları süreklidir (eklem açıları, kuvvetler) ve yüksek boyutludur (7 DOF kolu + 3 DOF tutucu = 30 Hz'de 10 karartma).
2. Robota özel eğitim verileri azdır. Açık X-Embodiment'in ~1M yörüngesi vardır; web metin görüntüsü 5B+'dır.
3. Kontrol frekansı önemlidir. 30 Hz kontrol döngüsü, işlem başına 33 ms bütçe anlamına gelir.
4. Güvenlik. Yanlış bir eylem donanıma, insanlara veya mülke zarar verir.

## Konsept

### Eylem tokenizasyon (RT-2)

RT-2'nin numarası: her ortak hedefi nicelenmiş bir metin token olarak temsil edin. Normalleştirilmiş [-1, 1] aralığını 256 bölmeye ayırın, her bölmeyi bir sözcük kimliğiyle eşleştirin. 10 DOF eylemi, her kontrol adımında 10 token olur.

Bir karışım üzerinde PaLM-X VLM'ye ortak ince ayar yapın:

- Web görseli-metin çiftleri (altyazı, VQA).
- Robot gösterileri, token'ler gibi aksiyon.

Model, "kırmızı küpü al" (dil) → görüntü (görüş) → 10-token eylem sırasını (ayrıklaştırılmış ortak hedefler) görür. Web ön eğitimi genel bilgi aktarımını korur: RT-2, eğitim verilerinde "hızlı hareket etme" olmasa bile "hızlı hareket eden nesneye doğru hareketi" takip edebilir.

RT-2 kağıdında 3-5 Hz'de Inference, VLM otoregresif kod çözme ile sınırlıdır.

### OpenVLA — açık 7B referansı

OpenVLA (Kim ve diğerleri, Haziran 2024), açık ağırlıklı RT-2 eşdeğeridir. 7B Llama omurgası, DINOv2 + SigLIP çift görüşlü kodlayıcı, 256 kutunun üzerinde eylem tokenizasyon.

Açık X-Embodiment eğitimi (22 robotta 970 bin yörünge). Yeni robotlara uyum sağlamak için LoRA fine-tuning desteğiyle birlikte gönderilir.

Inference: A100'de nicemlemeli 4-5 Hz. Yüksek frekanslı kontrol için değil, yavaş manipülasyon için yeterince hızlı.

### HIZLI tokenizer — daha hızlı kod çözme işlemi

Pertsch ve diğerleri. (2024), ayrık kutu tokenleştirmenin verimsiz olduğunu gösterdi; çoğu eylem, bölme alanının küçük bir bölgesinde kümeleniyor. FAST (Frekans Alanı Eylem Dizisi Tokenizer), DCT aracılığıyla eylem dizilerini sıkıştırır ve katsayıları niceler.

30 adımlı bir eylem yörüngesi, 300 ayrı bölmeli token yerine ~10 HIZLI token olur. Inference kalite kaybı olmadan 3-5 kat hızlanır.

### π0 ve akış eşleştirme eylemleri

Fiziksel Zekanın π0'ı (Black ve diğerleri, Ekim 2024), ayrı eylem token'leri akış eşleştirme eylem uzmanıyla değiştirir:

- Küçük bir eylem transformer, VLM'nin gizli durumlarını okur ve düzeltilmiş akış aracılığıyla sürekli 50 adımlık bir eylem dizisinin çıktısını verir.
- Hareket başlığı akış eşleştirme kaybıyla eğitilir; VLM ön eğitimi değişmeden kalır.
- Inference: ~5 gürültü giderme adımında yayılan tam eylem dizisi, etkili bir şekilde 50 Hz kontrol.

π0'ın iddiası: Çok çeşitli manipülasyon görevlerinde OpenVLA ve Octo'yu geride bırakıyor. Sürekli etkili formülasyon, ayrıklaştırmanın yok ettiği pürüzsüzlüğü korur.

π0,5 ve π0-FAST artımlı yükseltmelerdir. π0-FAST, FAST tokenization'ı akış eşleştirmeyle birleştirir.

### GR00T N1 — insansılar için ikili sistem

NVIDIA'nın GR00T N1 (Mart 2025) insansı robotlar için tasarlandı (>30 DOF, tam vücut):

- Sistem 2: ~1 Hz'de yüksek seviyeli alt hedefler üreten büyük bir VLM okuma sahnesi + talimatı.
- Sistem 1: alt hedeflere göre koşullandırılmış düşük seviyeli 50-100 Hz ortak komutlar üreten küçük bir hareket kafası transformer.

Bölünme, Kahneman'ın hızlı ve yavaş düşünmesiyle örtüşüyor: Sistem 2 planlar, Sistem 1 eyleme geçer. Faydaları: VLM boyutunda yavaş planlama, hızlı kontrolü engellemez; Sistem 1 gecikme nedeniyle küçük kalır.

GR00T N1.7 (2025 sonu) veri ölçeklendirmeyi iyileştirir. GR00T, Omniverse'ten alınan simüle edilmiş gerçek verilerle ince ayarlar yapar.

### X Düzenlemesini Aç

Eğitim verileri. RT-X (Ekim 2023), 22 robotta 1 milyon yörüngeyi kapsayan 22 dataset'yi bir araya getirdi. Open X-Embodiment herkesin kullandığı bir külliyattır:

- ALOHA / Bridge V2 / Droid / RT-2 Mutfak / Dil Masası.
- Her örnek: (robot durumu, kamera görüntüleri, talimat, eylem sırası).
- Hijyen eğitimi: eylem alanını birleştirin, eklem aralıklarını normalleştirin, kameraları yeniden boyutlandırın.

OpenVLA ve π0, Open X-Embodiment üzerinde eğitilir. Belirli bir robotla olan etki alanı boşluğu, 100-1000 göreve özel demolarda LoRA fine-tuning tarafından kapatılır.

### Co-fine-tuning ve yalnızca robotlara karşı

Co-fine-tuning, web VQA verilerini robot yörüngeleriyle birleştirir. Oran önemlidir: Çok fazla MYK olursa model eylemleri unutur; çok fazla robot verisi varsa model genel bilgiyi kaybeder.

RT-2'nin oranı: ~1:1. OpenVLA: ~0,5:1 webden robota. π0: benzer. Kesin oran, dataset boyutuna göre ayarlanacak bir hiper parametredir.

Yalnızca robot eğitimi, dağıtım dışı talimatlarda başarısız olan göreve özgü modeller üretir. Co-fine-tuning, "kırmızı küpü al (demoda)" ile "soldan üçüncü en büyük nesneyi al (yeni ifadeler)" arasındaki farktır.

### Güvenlik ve eylem sınırları

Her üretim VLA'sı aşağıdakilerle birlikte gönderilir:

- Sert bağlantı sınırları (özelliklerin ötesine geçemez).
- Hız sınırları (yumuşak kırpma).
- Çalışma alanı sınırları (son efektör masadan ayrılamaz).
- Yeni görevler için döngüdeki insan onayı.

Bunlar kontrol katmanı kontrolleri olarak VLA'nın dışında bulunur. VLA'nın çıktısı bir komut değil öneridir.

## Kullan onu

`code/main.py`:

- 256 bölmeli eylem tokenizasyon ve de-tokenizasyon işlemini uygular.
- DCT + kuantizasyona dayalı bir FAST tokenizer taslağı çizer.
- İşlem adımı başına token sayısını (ayrı bölme, HIZLI, sürekli akış) karşılaştırır.
- RT-2 → OpenVLA → π0 → GR00T'nin köken özetini yazdırır.

## Gönderin

Bu ders `outputs/skill-vla-action-format-picker.md`'yi üretir. Bir robot görevi verildiğinde (manipülasyon, navigasyon, insansı tüm vücut), ayrık kutu + RT-2, FAST + OpenVLA, akış eşleştirme + π0 veya ikili sistem + GR00T arasında seçim yapılır.

## Egzersizler

1. 30 Hz kontrol hızında 10 DOF'luk bir kol. 256 bölmedeki ayrık bölme tokenleştirme, saniyede kaç token yayar? 7B VLM buna ayak uydurabilir mi?

2. HIZLI tokenleştirme, 30 adımlı yörüngeleri ~10 token'ye sıkıştırır. Yörüngenin yüksek frekanslı hareketi varsa (e.g., davul çalma) kullanıcı ne kaybeder?

3. π0'ın akış uyumlu başlığı ~5 adımda gürültüyü giderir. Verimi OpenVLA'nın 4-5 Hz'deki otoregresif kod çözme işlemiyle karşılaştırın.

4. GR00T'nin Sistem 1 / Sistem 2 haritaları Kahneman'a bölünmüştür. İki ayaklı yürümeye yardımcı olabilecek farklı bir bölünme (Sistem 3?) önerin.

5. dataset düzenlemesi ile ilgili Açık X-Uygulaması Bölüm 4'ü okuyun. Etki alanı sızıntısını önleyen üç iyileştirme kuralını adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| VLA | "Vizyon-dil-eylem" | Görüntü + talimatı alan ve eylem komutlarının çıktısını veren model |
| Eylem tokenizasyon | "Ayrı kutular" | Sürekli ortak hedefleri, her biri bir kelime kimliği olan dim başına 256 kutuya nicelendirin |
| HIZLI tokenizer | "Frekans eylemi token'ler" | DCT + niceleme, 30 adımlı yörüngeleri ~10 token'ye sıkıştırmak için |
| Ortak ince ayar | "Web + robotu karıştır" | Genel bilgiyi korumak için robot demolarının yanı sıra web VQA verilerini eğitin |
| Akış uyumlu aksiyon başlığı | "π0 sürekli çıkış" | Düzeltilmiş akış yoluyla 50 adımlı bir eylem dizisi çıkaran küçük transformer |
| Sistem 1 / Sistem 2 | "Çift sistem kontrolü" | Büyük VLM yavaş plan yapar, küçük eylem kafası hızlı hareket eder; GR00T modeli |
| X-Embodiment'i açın | "RT-X dataset" | 1M yörüngeli çapraz robot dataset; eğitim külliyatı |

## Daha Fazla Okuma

- [Brohan ve ark. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim ve ark. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black ve diğerleri. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Açık X-Embodiment İşbirliği — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
