# WMDP ve Çift Kullanımlılık Yetenekleri Değerlendirme

> Li et al., "WMDP Benchmark: Unlearning ile Kötü Kullanımı Ölçmek ve azaltmak" (ICML 2024, arXiv:2403.03218). Biyolojik güvenlik (1,520), siber güvenlik (2,225) ve kimya (412) alanında 4.157 çoklu seçim sorusu. Sorular, "sarı bölgede"  yakın bilgi sağlayan, çok uzmanlık alanındaki inceleme ve ITAR/EAR yasal uyumluluğu ile filtrelenir. İki amaçlı: çift kullanım kabiliyetinin vekili değerlendirilmesi ve öğrenme oranı (ekleyici RMU yöntemi genel kapasiteyi korurken WMDP performansını azaltır). 2024-2025 saha anlatısı: erken OpenAI / Anthropic 2024 değerlendirmeleri internet aramaları üzerinde " hafif bir yükseltme " rapor etti; Nisan 2025'e kadar, OpenAI'nin Hazırlık Çerçevi v2 modellerinin "biolojik tehditler yaratmak için yeni başlayanlara anlamlı bir şekilde yardımcı olma eğiliminde" olduğunu söyledi. Anthropic'in biyolojik silah edinme denemesi, ASL-3'ü dışlamak için yeterli olmayan 2.53 kat yükseltme gösterdi.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- WMDP'nin üç alanını, soru sayısını ve "sarı bölge" filtre kriterini açıklayın.
- RMU'yu ve WMDP'nin neden hem bir değerlendirme hem de bir öğrenme dışı bir referans değerini açıklayın.
- 2024-2025 yükseltme anlatımını açıklayın: " hafif yükseltme " -> "yüksek" -> "ASL-3'yi dışlamak için yetersiz".
- Yeni başlayanların akrabaları arasındaki yüksekliği uzmanların mutlak yeteneklerinden ayırt edin.

## Sorun

Çift kullanım kabiliyeti, her laboratuvarın sınır güvenlik çerçevesinde ölçüm sorunu (Denevi 18) Soru: Model X, yeni başlayanın biyolojik, kimyasal veya siber alanlarda kitlesel zarar vermeyi başarısını önemli ölçüde geliştirir mi? Doğrudan ölçüm (modelin aslında zarar vermesini isteyin) yasadışı ve etik olmayan bir şeydir. Proxy ölçümüne model reddedemeyeceği ( dürüst kapasite numaraları üretmek) bir referans göstergesi gerekmektedir, ancak soruları kendi başlarına zararlı yayınlar değildir.

## Anlaşım

### "Sarı bölge"

Bir zararlı işlem hakkında doğrudan bir sentez reçetesine dönüşmeden bilgi sahibi olmak için yakın bir şekilde sorulan sorular. "Ne tür bir reagent [veya yayınlanmış yolun] 4. adımını katalize eder?" değil " [tehlikeli bileşik] nasıl yaparım?"

Toplam 4 157 soru:
- Biyolojik güvenlik: 1.520
- Siber güvenlik: 2.225
- Kimya: 412

Çoklu seçim biçimi. Modeller herhangi bir şeyle yardımcı olmaları istenmeden cevap verir; zararlı davranışlara neden olmadan yetenek ölçülebilir.

### RMU  Değerlendirme Yalancı Yöntem

LLaMa-2-7B'ye uygulanan eşleşme öğrenme yönteminin MMLU ve diğer genel yetenek referanslarını birkaç yüzde puan içinde korurken WMDP puanlarını neredeyse rastgeleye indirgenmesi. Yayınlanan yöntem, sonraki her biyokimyasal-siber öğrenme makalesinin öğrenme öğrenme bilgisi temelidir.

### 2024-2025'te yükselen anlatım

Üç aşama:

1. **2024 "mild uplift."**İlk OpenAI ve Anthropic Preparedness / RSP değerlendirmeleri, biyolojik yakın görevlere başlayan yeni başlayanlar için internet aramalarına göre küçük avantajlar gösterdi.

2. **April 2025 "on the cusp."**OpenAI'nin Hazırlık Çerçevi v2'de "Önce öğrencilere bilinen biyolojik tehditleri anlamlı bir şekilde yaratmalarına yardımcı olma eğiliminde" olan modeller rapor edildi.

3. **Anthropic's 2025 bioweapon-acquisition trial.**Yeni başlayan katılımcılarla kontrol edilen çalışma, edinme aşamasındaki görevlerde nispeten başarı ölçüldü. 2.53x yükseltme rapor edildi. ASL-3'yi (Daa 18) istisna etmek için yetersiz  Anthropic'in Sorumlu Ölçekleme Politikası 3 seviyesine ulaştı veya yaklaştı.

### Yeni başlayan ve uzmanlık alanı

Önemli bir fark:

- **Novice-relative uplift.**Bu model uzman olmayan birine ne kadar yardımcı olur?
- **Expert-absolute capability.**Bu model maksimum çaba gösterdiğinde ne kadar bilgi üretebilir?

Güvenlik vakaları (Daabi 18) her ikisini de hedefler: "model yeni başlayanı çalıştırmak için yeterli bir yükseltme veremez" ve "bir uzman daha önce yayınlanmamış bir modelden bilgi alamaz".

### Ölçüm tuzağı

WMDP, bir dağıtım ölçümü değil, bir yetenek proxy'sidir. WMDP'de yüksek puan alan bir model, uygulamada yeni başlayanlar tarafından kullanılabilir veya kullanılamaz olabilir.
- Çözüm direnci (güven filtrelerini boğmadan yeteneği çıkarmak ne kadar zor)
- Susuk bilgi (sıkılıktan kaynaklanan bilgi değil, test becerisini gerektiren yetenek)
- İcra etmenin engelleri (alışmalar, ekipman)

Anthropic'in 2025 biyolojik silah edinme denemesi, WMDP tarzı yeteneklerinin üstüne yeni başlayanların başlatma katmanını ekler: gerçek görev başarısını ölçer, birden fazla seçeneği yeteneğini ölçmez.

### Bu 18 fazaya uygun.

Ders 12-16 model çıkışları üzerindeki saldırı ve savunma araçlarıdır. Ders 17 çift kullanımlı yetenek katmanı  sınır güvenlik çerçevelerinin ( Ders 18) değerlendirdiği ölçümdür. Ders 30 2026'da mevcut siber / biyolojik / kimyasal / nükleer yükseltme kanıtlarıyla arkı kapatır.

```figure
al-wmdp-yellow-zone
```

## Kullan

`code/main.py`Oyuncak WMDP şeklinde değerlendirme harnessini oluşturur. Bir sahte model kategoriler içi sorular üzerinde test edilir; her alan için puanlar bildirilir. Basit bir öğrenme müdahalesi (sıfır dışı alan özel temsil) puanları azaltır; genel yeteneklere karşı pazarlama ölçülebilir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-wmdp-eval.md`. İki kullanımlılık iddiası göz önüne alındığında ("biyo silahlarla ilgili modelimiz anlamlı bir şekilde yardımcı değildir") hangi referans değerlerinin yürütüldüğünü, hangi reddedilme yolunun değerlendirilmek için kullanıldığını (çırın tamamlama ile politika hedeflenmiş) ve yeni başlayanların başlatma çalışmalarının birden fazla seçim sonucu ile tamamlandığını denetler.

## Egzersizler

1. Çık .`code/main.py`Oyuncak öğrenme aşamasından önce ve sonra alan doğruluğunu bildirin.

2. Oyuncak WMDP'yi dördüncü bir alanla büyütün (örneğin radyolojik). Sarı bölgede iki örnek sorular türünü belirtin.

3. WMDP 2024 Bölümü 5 (RMU metodolojisi) okuyun. Daha basit bir öğrenme yaklaşımını çizin (örneğin, alan içeriği için üst-k nöronları bastırın) ve beklenen genel kapasite maliyetini açıklayın.

4. Anthropic 2025'in biyolojik silah edinme denemesi 2.53 kat artış rapor ediyor. Bu rakamın yukarı doğru (başlangıç örnek boyutu, görev sadakati) ve iki şekilde aşağıya doğru (çalışım tavanı, model güvenlik kapısı) öne sürülebileceğini açıklayın.

5. ASL-3 için bir güvenlik durumu için WMDP'nin öğrenme dışı geçişten fazlasını gerektirenleri açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Daha Fazla Okumak

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) Referans değer ve RMU kağıdı
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "Kırmızı" dili
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) ASL-3 biyolojik eşiği ve satın alma çalışma sonuçları
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Biyolojik yükseltme CCL
