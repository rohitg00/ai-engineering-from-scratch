# Multimodal ajanlar ve bilgisayar kullanımı (Capstone)

> 2026 sınır ürünü ekran görüntüleri okuyan, düğmeler üzerinde tıklayan, web UI'lerini gezinen, formları dolduran ve iş akışlarını sonundan sonuna tamamlayan bir multimodal ajan. SeeClick ve CogAgent (2024) GUI-burunlama ilkelerini kanıtladı. Ferret-UI'ye mobil eklendi. ChartAgent, grafikler için görsel araç kullanımı tanıttı. VisualWebArena ve AgentVista (2026) sınır kovalamaları  ve hatta Gemini 3 Pro ve Claude Opus'un zor görevlerinde %30'luk puanı var. Bu kapı taşı 12 aşamasının her ipini bir araya getiriyor: algılama (yüksek çözünürlüklü VLM), mantıklama (cilt kullanımı ile LLM), yerleştirme (koordinat çıkışı), uzun ufukta hafıza ve değerlendirme.

**Type:** Capstone
**Languages:** Python (stdlib, action schema + agent loop skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 09 (Qwen-VL JSON), Phase 14 (Agent Engineering)
**Time:** ~240 minutes

## Öğrenme Hedefleri

- Multimodal bir ajan döngüsünü tasarlayın: algı → neden → eylem → gözlem → tekrar.
- VLM'nin JSON olarak yayınlayabileceği bir GUI yerleştirme çıkış şeması oluşturun (klik koordinatları, metin yazma, kaydırma, çekme).
- Sadece ekran görüntüsü ajanları vs erişilebilirlik ağacı ajanları vs hibrit ajanları karşılaştırın.
- Küçük bir VisualWebArena parçası üzerinde multimodal ajan referans değerlendirmeyi oluşturun.

## Sorun

Bir rezervasyon sitesi iş akışı: "15 Nisan için Tokyo'ya bir uçak bul bana, 800 dolardan az bir koridor koltuğu, rezervasyon yap".

Bir multimodal ajanın:

1. Tarayıcı ekran görüntüsünü çek.
2. Ekran çekimini + URL + hedefi bir plana ayırın.
3. Yapılandırılmış bir eylem yapın: tıklayın (x,y), "Tokyo" yazın (E elementinde), aşağıya kaydırın, seçin (radio düğmesi).
4. Eylemleri tarayıcıya uygulayın.
5. Yeni durumu izleyin (sonraki ekran görüntüsü).
6. Görev bitene kadar tekrarlayın.

Her adım bir multimodal VLM çağrısıdır. VLM çıkışı parse edilebilir JSON olmalıdır. Hatalar adımlar arasında karmaşık, bu yüzden kurtarma önemlidir.

## Anlaşım

### GUI yerleştirme  ilkel

GUI yerleştirme: bir ekran görüntüsü ve doğal dil talimatı verildiğinde, tıklamak için (x, y) koordinatını çıkartın (veya diğer eylem).

SeeClick (arXiv:2401.10935) ölçekte ilk açık sonuç oldu: sentetik + gerçek GUI verilerine bir VLM'yi ince ayarlayın, çıkış koordinatları düz metin işaretleri olarak çalıştırın.

CogAgent (arXiv:2312.08914) yoğun UI için 1120x1120 yüksek çözünürlüklü kodlama ekledi.

Ferret-UI (arXiv:2404.05719) mobil UI'lere odaklanır, iOS erişilebilirlik verileri ile entegre edilir.

Çıktı biçimi genellikle JSON:

```json
{"action": "click", "x": 384, "y": 220, "element_desc": "Search button"}
```

- Evet .`element_desc`kurtarmaya yardımcı olur: Eğer koordinatlar ekran görüntüleri arasında hareket ederse, semantik ipucu sistemi yeniden yerleştirir.

### Eylem düzenlemeleri

Tipik bir eylem şeması 6-10 eylem türüne sahiptir:

- `click`(x, y)
- `type`(seks, x?, y?)
- `scroll`: (yön, miktar)
- `drag`(x0, y0, x1, y1)
- `select`: (option_index)
- `hover`(x, y)
- `navigate`- Evet .
- `wait`(ms)
- `done`: (Başarısı, açıklama)

Ajan her adımda bir eylem çıkarır. Tarayıcı sarısı yeni durumu yürütür ve gönderir.

### Sadece ekran görüntüsü vs erişilebilirlik ağacı

İki giriş modusu:

- Sadece ekran görüntüsü: tam görüntü, yapısal bilgi yok. En genel; herhangi bir uygulamada çalışır.
- Erişilebilirlik ağacı: yapılandırılmış DOM / iOS erişilebilirlik bilgileri. Yerleşim için çok daha güvenilir; ağaç mevcut olduğunda çalışır.
- İkili de, atomik eylemler için güvenilir bir temel olarak ağaç ve semantik bağlam için ekran görüntüsü ile.

Üretim ajanları mümkün olduğunda hibrid kullanırlar. Tarayıcı otomasyonu (Selenium + erişilebilirlik) her zaman ağacı vardır; masaüstü uygulamaları bazen yapar.

### Uzun uzayda hafıza

20 adımlı bir iş akışı 20 ekran görüntüsü oluşturur. VLM'nin bağlamı hızlı bir şekilde doldurulur.

- Özet zinciri: her 5 adımdan sonra, olanları özetleyin, eski ekran görüntüleri bırakın.
- Atlama çerçeve: ilk, son ve her 3. ekran görüntüsünü tutun.
- Araç kayıtlı günlüğü: eylemleri gerçekleştirin, yapılanların metin günlüğünü tutun; eski ekran görüntüleri tekrar görmeyin.

Claude'un bilgisayar kullanımı API'si günlük örneğini kullanıyor.

### Görsel araç kullanımı

ChartAgent (arXiv:2510.04514) grafik anlama için görsel araç kullanımı sunar: biçim, zoom, OCR, dış algılama çağrısı. Ajan "çeviri bölgeye (100, 200, 300, 400) çıkarabilir, sonra bir araç çağrısı olarak OCR çağrısı yapabilir. Alet metni iade eder; VLM mantıklamaya devam eder.

Bu örnekteki genelleştirmeler: işaret setini istekleme, bölge notasyonu ve dış algılama araçları hepsi aynı "bir araç çağrısı çıkart, yapılandırılmış bir yanıt al" şemasıyla uyumludur.

### 2026 referans değerleri

- ScreenSpot-Pro. GUI'nin yerleştirilmesi 1k web ekran görüntüsüne. SOTA Qwen2.5-VL-72B ~85% Açık.
- VisualWebArena. Web görevleri (dükkan, forum, sınıflandırma reklamları). SOTA ~ 20% Açık. Gemini 3 Pro ~ 27%
- AgentVista (arXiv:2602.23166). 2026'da en zor standart. 12 alan arasında gerçekçi iş akışları. Sınır modelleri yüzde 27-40 puan alır; açık modeller yüzde 10-20 puan alır.
- WebArena / WebShop. Eski referanslar; sınır ile doymuş.

### Neden hala zor?

Ajanın performansındaki boğazlar:

1. "Küçük X'e tıklayın" genellikle mobil çözünürlükte başarısız olur.
2. 10 eylemden sonra ajan hedefi terk eder.
3. Hata kurtarma. Bir tıklama başarısız olduğunda (hatalı düğme), tespit + kurtarma nadiren eğitimli veridir.
4. Sayfalar arası bağlam. Sekmeler veya uzun formlar arasında atlamak durumunu kaybeder.

Araştırma yönleri: hafıza mimarileri, açık bir yeniden planlama, multimodal doğrulama (eğer bir eylem başarısı için ekran görüntüsü eşleşir).

### Başta taş inşa-o

Son görev: bilgisayar kullanımı ajanı oluşturmak:

1. Bir rezervasyon sitesi sahte sayfasının HTML + ekran görüntüsünü okuyor.
2. Çok adımlı bir dizi planlar: arama → seç → doldur formu → gönder.
3. Eylem şemasıyla eşleşen JSON eylemlerini gönderir.
4. - 10 görevi olan sabit bir parça ile değerlendiriyor.

Ders, gerçek bir tarayıcıya kolayca yayılabilecek bir asfalt kodu sağlar.

```figure
mm-agent-loop
```

## Kullan

`code/main.py`- Taşlı bir asfalt:

- Eylem şeması JSON tanımlama (10 eylem: yukarıda listelenen dokuz ek `screenshot_region`, bir biçim + zoom aracı).
- Sahte tarayıcı durumu dikt olarak.
- Ajan kemiri: alış, hareket, uygula, kemir.
- 10 görevli mini-benchmark (sentezik sayfalar) son-son başarıyı ölçmek için.
- Bir eylem başarısız olduğunda hata kurtarma hokusu.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-multimodal-agent-designer.md`. Bilgisayar kullanım ürünü (domain, eylem seti, değerlendirme hedefi) göz önüne alındığında, tam ajan döngüsünü, hafıza stratejisini, yerleştirme modunu ve beklenen referans puanını tasarlar.

## Egzersizler

1. Kodun şeması bir  ekliyor.`screenshot_region`dokuz temel eylem için araç (crop + zoom). Hangi görevler yararlıdır?

2. AgentVista'yı okuyun (arXiv:2602.23166). En zor görev kategorisini ve neden sınır modelleri hala başarısız olduğunu açıklayın.

3. Uzun uzayda hafıza sıkıştırması: ≤4 ekran görüntüsü canlı tutulan, herhangi bir sayı kaydedilen bir özet zinciri tasarlayın.

4. Hata kurtarma hokunu oluşturun: eylem başarısız olduğunda (buton bulunamadı), ajan daha sonra ne yapar?

5. Sadece ekran görüntüsü olan Claude 4.7 ile 10 web görevinde hibrit ekran görüntüsü + erişilebilirlik ağacı Qwen2.5 VL'yi karşılaştırın. Hangisi hangisiyle kazanır?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GUI grounding | "Click coordinates" | Model outputs (x,y) for the target of an instruction on a screenshot |
| Action schema | "Tool definitions" | JSON description of valid actions (click, type, scroll, drag) |
| Accessibility tree | "Structured DOM" | Machine-readable UI hierarchy from browser/iOS APIs |
| Hybrid agent | "Screenshot + tree" | Uses both image and structured info; more reliable than either alone |
| Visual tool use | "Zoom/crop/detect" | Agent calls external vision tools (OCR, detection) mid-plan |
| Summary-chain | "Memory compression" | Periodic text summaries replace long screenshot history |
| VisualWebArena | "E2E web bench" | 2024 benchmark for end-to-end web tasks |
| AgentVista | "2026 hard bench" | 12-domain realistic workflows; even Gemini 3 Pro scores ~30% |

## Daha Fazla Okumak

- [Cheng et al. — SeeClick (arXiv:2401.10935)](https://arxiv.org/abs/2401.10935)
- [Hong et al. — CogAgent (arXiv:2312.08914)](https://arxiv.org/abs/2312.08914)
- [You et al. — Ferret-UI (arXiv:2404.05719)](https://arxiv.org/abs/2404.05719)
- [ChartAgent (arXiv:2510.04514)](https://arxiv.org/abs/2510.04514)
- [Koh et al. — VisualWebArena (arXiv:2401.13649)](https://arxiv.org/abs/2401.13649)
- [AgentVista (arXiv:2602.23166)](https://arxiv.org/abs/2602.23166)
