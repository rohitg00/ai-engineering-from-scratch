# Anayasacı AI ve RLAIF

> Bai et al. (arXiv:2212.08073, 2022) sordu: Ya insan etiketini ilkeler listesini okuyan bir AI ile değiştirirsek? Anayasa AI'nin iki aşaması vardır  Anayasa altında kendi eleştirisi ve gözden geçirilmesi, ardından RL'den AI Feedback. Bu teknik RLAIF terimini ortaya koydu ve Claude 1 eğitim sonrası borusuna gönderildi. 21 Ocak 2026'da Anthropic, yeniden yazılmış bir Claude anayasası yayınladı: kural kuralları, dört katlı öncelikli hiyerarşi ve model ahlaki statü hakkında belirsizliklerin ilk büyük laboratuvar resmi tanınması üzerine açıklayıcı bir mantıklama. CC0 1.0 altında yayınlanmıştır.

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Yasal Yapay zeka'nın iki aşamasını (SFT eleştirisi ve inceleme, Yapay zeka geri bildiriminden RL) ve her birinde anayasanın rolünü açıklayın.
- İnsan tercih etiketini bir AI etiketle değiştirmenin neden " ucuz " bir RLHF olmadığını açıklayın.
- 2026 Claude anayasası'nın dört katlı öncelik yapısını ve 2023 yeniden yazısından neyi değiştirdiğini özetleyin.
- Anayasa sınıflandırıcılarını ve hesaplama genel maliyetinin % 23.7'den (v1) % 1'e (v2 / 2026) düşüşünü açıklayın.

## Sorun

RLHF etiketleme cihazlarına ihtiyaç duyar. Etiketler yavaş, tarafsız ve pahalıdır. Bir etiketleme cihazını açık ilkeler okuyan bir modelle değiştirerek ortadan kaldırabilirsiniz. Bu değişikliğin ilk resmi versiyonu Bai ve diğerlerinin Anayasa Yapay İlgisi'ydi.

Bu nedenle, bu seçenekler, bir süre önce bir süre önce bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre sonra bir süre daha bir süre sonra bir süre sonra bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha bir süre daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha daha

## Anlaşım

### EYİNİLİ FASİY  Denetimli kendi eleştirisi ve revizyonu

Bir kırmızı takım sorusu verildiğinde, model ilk bir yanıt verir. İkinci bir model (veya ikinci bir dönüşte aynı model) anayasanın örneklenmiş bir ilkesini okuyor ve yanıtı eleştirir. Üçüncü bir adım eleştirileri ele almak için yanıtı gözden geçirir. Gözden geçirilmiş yanıt SFT hedefi.

Anayasa ilkeler listesidir. Bai ve diğerleri 2022'de "en az zararlı ve etik olan yanıtları tercih etmek", "vaaz etmeyi kaçınmak", "asistan yardımcı, dürüst ve zararsız olmalıdır".

### 2. aşama  AI Feedback (RLAIF) RL

"Feedback model" örneklemelerindeki anayasa ilkelerine göre her birini puanlar. Tercihleri belirleyen sinyal geri bildirim modelinin sıralamasıdır. Yapay zeka tarafından oluşturulan tercihler üzerine ödül modeli eğit. PPO ile karşılaştırın. Diğer her şey InstructGPT'nin boru hattıdır (Desin 1).

"RLAIF" = tercih sinyali AI tarafından üretilmiştir.

### Neden bu sadece " ucuz RLHF " değil

- Etiketçi önyargısı etiketçi psikolojisinden ilke-tortusuna kayar. Bir AI etiketici " dürüst olmak " ı herhangi bir insandan daha az veya daha az sıkı bir şekilde yorumlayabilir; sıkılık veri kümesi boyunca birdir.
- Tercihleri belirten sinyal çok okunur. İlkeyi, eleştirileri ve revizyoni okuyabilirsiniz. İnsan etiketleri açık değildir.
- Başarısızlık modları değişir. Sycophancy düşer (AI etiketleyicisi memnun etmek için hiçbir kullanıcı yoktur). Goodhart Kanunu devam eder (proxy şimdi "model'in prensip kümesi X'in yorumlamasıdır", hala kusurlu bir ölçümdür).

CAI'nin 2022 iddiası: Eğitimli model daha zararsız ve benzer verilere sahip RLHF modeli kadar yaklaşık olarak yararlıdır.

### 2026 Claude anayasası yeniden yazılsın

Anthropic 21 Ocak 2026'da önemli ölçüde gözden geçirilmiş bir anayasa yayınladı.

1. Önceki kuralların ("CSAM üretmeyin") ilkelere genişletilmesi ("çocuklara zarar verdiği için, ...") ile genelleştirilmesi beklenen model ile.
2. Dört katlı öncelik yapısı:
   - Birinci seviye: felaket sonuçlarını (toplam zarar, kritik altyapı) önlemek.
   - Tier 2: Anthropic'in yönergelerine uyun (operatörlerin geçerliliği, platform kuralları).
   - 3. seviye: genel olarak etik olmalıdır (standart HHH).
   - Dördüncü seviye: Yardımcı ve dürüst ol.
   Çatışmalar üstten aşağı çözülür.
3. İlk büyük laboratuvarda, örneği ahlaki durum hakkında belirsizliklerin resmi olarak kabul edilmesi (Faz 18 · 19 Örneği Refah ile bağlantılı).
4. CC0 1.0 altında yayınlanmıştır. Diğer laboratuvarlar kısıtlama olmadan kullanabilir veya uyarlayabilir.

### Anayasa sınıflandırıcıları

Paralel bir çalışma hattı: modelin eğitim sonrası değişiminden ziyade, anayasa ve kapı model çıkışlarını okuyan hafif sınıflandırıcıları eğit. v1 (2023) %23,7 hesaplama genel maliyetine sahipti. v2 (2026) %1'dir ve Anthropic savunma Anthropic'in halka açık olarak test ettiği en düşük başarılı saldırı oranına sahiptir.

Bu bir katmanlı savunma modeli: CAI davranışları şekillendirir; sınıflandırıcılar değişkenleri zorlar.

### CAI'nin aileye uygun olduğu yer

- İnsan öncesi, RM, PPO.
- CAI / RLAIF: AI-generated prefs from principles, RM, PPO.
- DPO / aile: öncüler (insan veya AI) üzerinde kapalı formda kayıp.
- Kendini ödüllendirme, kendi eleştirisi: ilkeler içe aktarılır, model çoklu roller oynar.

Axis "Öncelik sinyali nereden geliyor?" CAI'nin 2022 makalesi, sınır ölçeğinde insan sinyali'ndan AI sinyali'na ilk ciddi bir değişim oldu.

```figure
constitutional-ai
```

## Kullan

`code/main.py`Oyuncak sözlüğünde CAI eleştirme ve inceleme döngüsünü simüle eder. Bir " prensip " zararlı bir setten belirtiler işaretler. İlk bir yanıt verildiğinde, eleştirme zararlı belirtileri tanımlar ve inceleme onları değiştirir. 200 iterasyondan sonra "eğitimli" model inceleme kuralını içe aktarmıştır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-constitution-writer.md`. Bir alan (müşteri desteği, tıbbi tavsiyeler, kodlama asistanı, araştırma aracı) göz önüne alındığında, 2026 Claude yapısını takip eden dört katlı bir anayasa taslağı hazırlar: felaketlerden kaçınma, platform kuralları, alan etikası, yararlılık.

## Egzersizler

1. Çık .`code/main.py`.Baz modelinin zararlı token oranını CAI eğitimiyle yapılan versiyonla karşılaştırın.

2. Anthropic'in 2026 anayasasını okuyun (anthropic.com/news/claudes-constitution).

3. Bir AI kodlama asistanı için bir anayasa tasarlayın. Tier 1 (fırtınalı: onaysız yıkıcı komutlar), Tier 2, Tier 3, Tier 4. Her bir seviyeye 3-5 ilkeyi koyun.

4. CAI insan etiketlerini AI etiketleriyle değiştirir. RLAIF'de hala oluşabilecek bir sikofans gibi başarısızlık modunu isimlendirin ve bunun için bir tespit tasarlayın.

5. Anayasa sınıflandırıcıları v2 metodolojisini okuyun (olursa). %1 hesaplama genel masrafının neden %23.7'den kalitede farklı bir güvenlik hikâyesi olduğunu açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Constitutional AI | "AI trained with principles" | Two-phase pipeline: self-critique-and-revise SFT, then RL from AI feedback |
| RLAIF | "RLHF without humans" | RL with preferences generated by an AI labeler; the rest of the pipeline is unchanged |
| Constitution | "the principles" | An ordered list of natural-language rules the critique/labeler model consults |
| Critique-and-revise | "the SFT loop" | Produce response → critique under a principle → revise → SFT target |
| Constitutional Classifier | "the output gate" | Lightweight classifier that evaluates outputs against the constitution and blocks/logs |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | The model that reads a principle and ranks a pair of completions |

## Daha Fazla Okumak

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) orijinal iki aşamalı boru hattı
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) 2026 dört katlı yeniden yazımı, CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) v2'de %1 üst maliyetle çıkış kapısı savunması
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) Empirik RLAIF / RLHF karşılaştırması
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) temel granularlık etkisi
