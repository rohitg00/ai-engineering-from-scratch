# İfertasyon Platformu Ekonomi  Atölyeler, Birlikte, Baseten, Modal, Tekrarlama, Herhangi Bir Ölçü

> 2026 sonucu pazarı artık GPU zaman kiralama değildir. Özel silikon (Groq, Cerebras, SambaNova), GPU platformları (Baseten, Together, Fireworks, Modal) ve API-birincil pazarlar (Replicate, DeepInfra) olarak bölünür.$1/hr per GPU on May 1, 2026, and $4B değerlendirme 10T+ token/gün'de, hacmi yönlendiren model çalışmalarını gösterir.$300M Series E at $5B Ocak 2026'da rekabetçi konumlandırma kuralı basit: Ateşler gecikmeyi optimize eder, Birlikte katalog genişliğini optimize eder, Baseten kurumsal polish'i optimize eder, Modal Python-native DX'i optimize eder, Replicate multimodal erişimi optimize eder, Anyscale dağıtılan Python'ı optimize eder. Bu ders size bir kurucuya teslim edebileceğiniz bir matris verir.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy per-call economics comparator)
**Prerequisites:** Phase 17 · 01 (Managed LLM Platforms), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Üç pazar segmentini (geleneksel silikon, GPU platformları, API-birincisi) isimlendirin ve her satıcının bir segmentine haritasını yapın.
- "Token" API fiyatlandırma modeli neden donanım motorunun maliyet eğriğine doğru sıkıştırılmasını, donanımın değil açıklayın.
- En az üç satıcıda talep başına etkin maliyet hesaplayın ve dakika başına (Baseten, Modal) ne zaman atıldığını açıklayın.
- Belirli bir iş yükü için hangi platformun uygun olduğu belirlenir (serversiz patlayan, sabit yüksek çıkışlı, ince ayarlanmış çeşitler, multimodal).

## Sorun

Yönetilen hiper ölçekli platformları değerlendirdiniz. Daha dar ve daha hızlı bir sağlayıcının ihtiyaç duyduğunuzu düşündünüz.  Uzaklık için havai fişekleri, genişlik için birlikte, Baseten için ince ayarlanmış özel bir model. Şimdi altı gerçek seçeneğiniz var ve fiyatlandırma sayfaları sırayla değil.$/M tokens; Baseten shows $/minute; Modal gösteriler $/second; Replicate shows $İş yükünü modellemeden onları baş başa karşılaştıramazsın.

Daha da kötüsü, her fiyat sayfasının arkasındaki iş modeli farklıdır. Ateşler paylaşılan GPU'larda kendi özel motorunu (FireAttention) çalıştırabilir; her token oranı kullanım eğrisini yansıtır. Baseten size Truss + özel GPU'lar verir; dakikaya özellik yansıtır. Modal gerçek Python sunucu olmadan  saniyelik faturasyon alt saniyelik soğuk başlangıçlarla. Aynı çıkış (LLM cevabı), üç farklı maliyet fonksiyonu.

Bu ders altı numarayı modelliyor ve her birinin ne zaman kazandığını söylüyor.

## Anlaşım

### Üç bölüm

**Custom silicon** Groq (LPU), Cerebras (WSE), SambaNova (RDU). Genellikle aynı modelde GPU tabanlı bir kümeden 5-10 kat daha hızlı çözülür. Yüksek bir token fiyatı (Groq Llama-70B'de ~ 0.99 $ / M'di 2025) ancak gecikme hassas kullanım durumları için yenilmez. Groq ses ajanları ve gerçek zamanlı çeviri için üretim seçeneğidir.

**GPU platforms**Baseten, Together, Fireworks, Modal, Anyscale. NVIDIA (H100, H200, B200 2026 yılında) veya bazen AMD üzerinde çalıştırın.

**API-first marketplaces** Replicate, DeepInfra, OpenRouter, Fal. Geniş katalog, tahmin başına ödemek veya saniyede ödemek, ilk çağrıya zaman vurgu.

### Ateşler  Gecikme Optimized GPU Platform

- FireAttention motor (her zamankinden daha uygun); eşdeğer yapılandırmalarda vLLM'den 4 kat daha düşük gecikme olarak pazarlanmıştır.
- Interaktif olmayan iş yükleri için %50'lik sunucu olmayan oranda seri seviyesi.
- Düzgün ayarlanmış model, temel model ile aynı hızda hizmet verdi  LoRA için bir prim talep eden sağlayıcılara karşı gerçek bir farklılık.
- 2026 ortalarında: 1 Mayıs 2026 itibariyle talep üzerine GPU kiralama 1 $ / saat arttırıldı.
- Finansal sinyal: 4 milyar dolar değerlendirme, günde 10T+ token kullanılıyor.

### Birlikte  Genişlik Optimize

- Açık kaynaklı yayınlar dahil olmak üzere 200+ model, yayımlanmasından sonraki birkaç gün içinde yayınlanır.
- "AI Native Cloud" konumlandırması, boyut ve katalog.
- Bir API'de özetleme + ince ayarlama + eğitim.

### Baseten  işletme-polonyalı-optimize

- Truss çerçeve: bağımlılıkları, sırları olan model ambalajlar, bir manifeste konfig servis.
- GPU aralığı T4'den B200'e kadar.
- SOC 2 II tip, HIPAA hazır.
- $5B valuation, January 2026 Series E ($CapitalG, IVP, NVIDIA'dan 300 milyon dolar.

### Modal  Python- native- optimized

- Saf Python'da kod olarak altyapı.`@modal.function(gpu="A100")`Bir emirle görevlendir.
- İkinciye bir fiyatlar. Soğuk, önceden ısıtma ile 2-4 saniye başlar.
- $87M Series B at $1.1B değerlendirme (2025). Bağımsız anketlerde en güçlü geliştiriciler deneyimi puanı.

### Replik  multimodal genişlik

- Görüntü, video ve ses modelleri için varsayılan platform.
- Entegre ekosistem (Zapier, Vercel, CMS eklentileri).
- LLM'nin bir token oranı için daha az rekabetçi olduğu ancak multimodal çeşitlilikte kazanç sağladığı doğrudur.

### Herhangi bir ölçek                                                                                                                                                                                                                                                             

- Ray'de inşa edilmiş; RayTurbo Anyscale'ın özel sonuçlama motorudur (vLLM ile rekabet eder).
- En iyi, sonuç adımının daha büyük bir grafikte bir düğüm olduğu dağıtılmış Python iş yükleri için.
- Ray'in gruplarını yönetti, Ray AIR ve Ray Serve ile sıkı birleştirildi.

### Her bir kazanırken  per-minute karşı karşı

Per-token, iş yükü latensiyet karşısında hassas ve patlayan olduğunda mantıklıdır. Sadece kullandığınız şey için ödeme yapıyorsunuz. Per dakika kullanımı yüksek ve öngörülebilir olduğunda mantıklıdır. GPU'yu doyduğunuzda, token'ı yenersiniz.

Kaba kural: özel bir GPU'nun %30'dan fazla çalışma yükü için, dakikada (Baseten, Modal) her token (Fireworks, Together) yenilmeye başlar.

### Özel motor gerçek çukur.

VLLM ve SGLang'ın üzerindeki her platform özelleştirilmiş bir motor iddia eder. FireAttention, RayTurbo, Baseten'in sonuçlama yığın.

### Hatırlamalısın numaralar

- Ateşler GPU kiralama: 1 Mayıs 2026 itibariyle 1 saatlik bir dolarlık artış.
- Fuarek iddiaları: eşdeğer konfigürasyonlarda vLLM'den 4 kat daha düşük gecikme.
- Toplu olarak: LLM'lerde Replicate'den %50-70% daha ucuz.
- Baseten değerlendirme: $5B (Series E, Jan 2026, $300M yuvarlak).
- Modal değerlendirme: 1.1 milyar dolar (Series B, 2025).
- Dakikada tokenin üzerinde %30 sürdürülebilir kullanım çarpması.

```figure
cost-per-token
```

## Kullan

`code/main.py`fiyatlandırma modelleri arasında sentetik bir iş yükü üzerinde altı satıcı karşılaştırır.$/day and effective $/M tokenleri. /M token ve dakika arasındaki eşitliği bulmak için çalıştır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-inference-platform-picker.md`. İş yükü profilini, SLA'yı ve bütçeyi göz önüne alarak, ana sonuçlama platformu seçer ve ikinci sırayı belirler.

## Egzersizler

1. Çık .`code/main.py`Baseten'in H100'de 70B modelinde (per dakika) Fireworks'ten (per token) daha fazla kullanımı ne kadar sürüyor?
2. Ürününüz görüntü üretimi, sohbet ve konuşma metinleri sunuyor. Her modalite için platformlar seçin ve onları birleştiren geçit modelini isimlendirin.
3. Ateş fişekleri, ana modelinizden fiyatları saatte 1 dolar arttırır. Trafikinizin %40'ı parti seviyesine (%50 indirim) geçirse, karışık maliyet etkisini modelleyin.
4. Düzenlenmiş bir müşteriye SOC 2 Tipi II + HIPAA + özel GPU'lar gerekmektedir. Hangi üç platform uygulanabilir ve hangisi FinOps'te kazanır?
5. Llama 3.1 70B için 1000 tahminin maliyetini karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Custom silicon | "non-GPU chips" | Groq LPU, Cerebras WSE, SambaNova RDU — optimized for decode |
| FireAttention | "Fireworks engine" | Custom attention kernel; marketed at 4x lower latency than vLLM |
| Truss | "Baseten's format" | Model packaging manifest; dependencies + secrets + serving config |
| Per-token | "API pricing" | Charge by tokens consumed; pay for no idle |
| Per-minute | "dedicated pricing" | Charge by wall-clock GPU time; wins at high utilization |
| Per-prediction | "Replicate pricing" | Charge per model invocation; common for image/video |
| RayTurbo | "Anyscale engine" | Proprietary inference on Ray; competes with vLLM on Ray clusters |
| Batch tier | "50% off" | Non-interactive queue at reduced rate; common on Fireworks, OpenAI |
| Fine-tuned at base rate | "Fireworks LoRA" | Charge LoRA-served requests at base model's rate (differentiator) |

## Daha Fazla Okumak

- [Fireworks Pricing](https://fireworks.ai/pricing)Token başına oranlar, parti seviyesine, GPU kiralama.
- [Baseten Pricing](https://www.baseten.co/pricing/) Dakika oranları, sözleşme kapasitesi, işletme seviyeleri.
- [Modal Pricing](https://modal.com/pricing) Sekundu başına GPU hızları ve ücretsiz seviyeler.
- [Together AI Pricing](https://www.together.ai/pricing) model katalog ve token fiyatları.
- [Anyscale Pricing](https://www.anyscale.com/pricing)RayTurbo ve Ray fiyatlandırmasını yönetti.
- [Northflank — Fireworks AI Alternatives](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) karşılaştırmalı değerlendirme.
- [Infrabase — AI Inference API Providers 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) Satıcı manzarası.
