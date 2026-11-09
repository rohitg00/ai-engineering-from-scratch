# LLM'lerde Tarafsızlıklar ve Temsilcilik Zararı

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Bileştirici Dilbilim 2024, arXiv:2309.00770). Temel 2024 araştırması, temsil zararı (stereyotipler, silme) ve tahsis zararı (eşitsiz kaynak dağılım) arasında ayrım yaparak değerlendirme ölçümlerini yerleştirme tabanlı, olasılık tabanlı veya oluşturulan metrik tabanlı olarak sınıflandırır. 2024-2025 deneysel: An et al. (PNAS Nexus, Mart 2025) GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B'de 20 giriş düzeyde iş için otomatik olarak özetleme değerlendirmesi üzerinden kesimler arası cinsiyet x ırk ayrımcılığını ölçmek. WinoIdentity (COLM 2025, arXiv:2508.07111) kesimsel kimlikler için belirsizlik tabanlı adil değerlendirmeyi tanıttı. Yu & Ananiadou 2025 MLP katmanlarında cinsiyet nöronlarını tanımlar; Ahsan & Wallace 2025 klinik ırk ayrımcılığını ortaya çıkarmak için SAE'leri kullanır; Zhou ve diğerleri. 2024 (UniBias) dikkat başlıklarını deviseye sokar. Meta-tıkıntısı (arXiv:2508.11067): 10 yıllık edebiyat, eşcinsel önyargıya karşı orantısız bir şekilde odaklanır.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Temsilcilik vs. tahsis zararı tanımlayın ve LLM dağıtımında her birinin bir örneğini verin.
- Gallegos et al. 2024'ten üç değerlendirme-metrik kategorisi adını verin ve her birinden bir metrik tanımlayın.
- Bölümler arası ilişkiyi ve WinoIdentity'nin belirsizlik tabanlı adillik ölçümünün tek eksel önyargılı önyargılı değerlendirme açılarını neden ele aldığını açıklayın.
- Taraflılığa üç mekanizma-tortanlama yaklaşımını açıklayın (cinsel nöronlar, SAE özellikleri, dikkat başı manipülasyonu).

## Sorun

Önceki dersler kasıtlı zararları (ceilbreaks, scheme) ve güvenlik yönetimi kapsar. Tarafsızlık, amaçsızca  eğitim verileri dağıtımından, hızlı çerçeveleme, toplanmış tasarım seçimlerinden ortaya çıkan zararlardır.

## Anlaşım

### Temsilcilik vs. tahsis

- **Representational harm.**Hemşireleri sadece kadın olarak gösteren bir LLM temsilcilik zarar verir.
- **Allocational harm.**Siyah başvuruda bulunanların özetlerini sistematik olarak daha düşük puan alan bir LLM, tahsis zararı yaratıyor.

Bu farklılıklardır. Bir model "tüm yönlerden tarafsız" olabilir (çok çeşitli portreler üretir) ve "tüm yönlerden tarafsız" olabilir (eşitsiz öneriler yapar).

### Üç değerlendirme-metrik kategorisi (Gallegos et al. 2024)

- **Embedding-based.**RLHF öncesi yerleşimlerde WEAT tarzı testleri. Kimlik terimleri ve atribut terimleri arasındaki istatistiksel ilişkileri ölçer.
- **Probability-based.**Stereotip doğrulayıcı ve stereotip ihlal eden tamamlamaların log-e olasılıkları.
- **Generated-text-based.**Yaratılan metin üzerinde aşağıdaki görev ölçümü. Özetleme puanlaması, tavsiye yazımı, diyalog. En ekolojik olarak geçerli; çoğaltılması en zor.

### Bölümler arası

"Cinsiyet" üzerinde önyargılı değerlendirme sadece (cins, ırk) çiftlere ateş eden önyargıyı kaçırır. Bir et al. 2025 bulguları GPT-4o, siyah kadınların özetleme sırasında ayrı ayrı siyah erkeklere ve beyaz kadınlara göre daha fazla puan almasına cezalandırır. Tek eksel değerlendirme bunu yakalayamaz.

WinoIdentity (COLM 2025) belirsizlik tabanlı kesimsel adilliği tanıtır. Modelin kesimsel kimlik tuplesinde sonuçlar üzerindeki belirsizliklerinin farklı olup olmadığını ölçer.

### Mekanik yaklaşımlar

2024-2025 tarihleri arasında yapılan yorumlama çalışmaları, mekanizma müdahalelerine önyargıyı açar:

- **Gender neurons (Yu & Ananiadou 2025).**Özel MLP nöronları cinsiyet-spesifik davranışlarla ilişkilidir. Bu nöronları silmek, sınırlı kapasite maliyeti ile cinsiyet fark ölçümlerini azaltır.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**Sparse oto kodlayıcı özellikleri, iç temsilini yorumlanabilir boyutlara parçalayır; ırk ile ilişkili özellikler tanımlanabilir ve bastırılabilir.
- **UniBias (Zhou et al. 2024).**Zıfır atışlı deviseleştirme için dikkat başı manipülasyonu. Özel başlar kimlik sınıfının hassasiyetini artırır; bu başları sıfırlamak veya yeniden ağırlaştırmak ince ayarlama olmadan tarafsızlığı azaltır.

### Meta-kritik

10 yıllık literatür incelemesi (arXiv:2508.11067, 2025) alanın ikili cinsiyet ayrımcılığına orantısız bir şekilde odaklandığını buldu. Diğer ekseler  engelliği, din, göç durumunu, çok dilli kimliği  çok daha az ilgi görüyor. Meta-tıkıntısı, sınır dışı gruplara ihmal ederek dar bir odaklanma yaratabileceğini savunuyor: ikili cinsiyet üzerinde iyi ayrımcılık yapan bir model, kimsenin kontrol etmediği boyutlarda kötü bir tarafsızlık gösterebilir.

### Bu 18 fazaya uygun.

Dersler 20-21 ayrımcılık ve adilliği resmi olarak kapsar. Ders 22 gizliliği kapsar. Ders 23 su işaretlemeyi kapsar. Bunlar daha önceki aldatma / güvenlik katmanını tamamlayan kullanıcı zarar katmanı.

```figure
an-bias-two-harms
```

## Kullan

`code/main.py`Oyuncak yerleştirme tabanlı bir önyargı araştırması yapar: basit bir eşleşme yerleştirme ile kimlik terimleri ve atribut terimleri arasındaki WEAT tarzı mesafeyi ölçer. Bir önyargı enjekte edebilir ve metrik ateşi gözlemleyebilirsiniz; basit bir defibasing işlevi uygulayarak kısmi geri kazanımı gözlemleyebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-bias-eval.md`. Bir model kart veya adillik iddiası göz önüne alındığında, üç metrik kategoride (eğlenme, olasılık, oluşturulan metrik), kesimler arası kapsam ve herhangi bir devisaj müdahale mekanizması için değerlendirme denetlenir.

## Egzersizler

1. Çık .`code/main.py`- Debiasing adımından önce ve sonra WEAT tarzı tarafsızlık puanlarını bildirin.

2. Sonda kesimler arası bir test ile uzantı: (cinsel, ırk) x (kariyer, aile).

3. An et al. 2025 (PNAS Nexus) okuyun. Tek eksel cins değerlendirmesinin kaçırılacağı iki kesimsel etkeni belirleyin.

4. Yu & Ananiadou 2025'te cinsiyet nöronlarını tanımlar. "Bu nöronlar cinsiyet önyargısına neden olur" ve "bu nöronlar cinsiyet önyargısıyla ilişkilidir" arasındaki farkı yaratacak bir sahtelik deneyimi çizer.

5. Meta-kritik alanın ikili cinsiyet üzerinde çok dar bir şekilde odaklandığını iddia ediyor.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## Daha Fazla Okumak

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) Kanonik araştırma
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) Beş model çapraz çalışma
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) Yeni bir referans değer
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) sıfır atışlı devreye atış
