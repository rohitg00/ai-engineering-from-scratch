# AI Ağ Geçitleri — LiteLLM, Portkey, Kong AI Ağ Geçidi, Bifrost

> Uygulamalarınız ve model sağlayıcılarınız arasında bir ağ geçidi bulunur. Temel özellikler sağlayıcı yönlendirme, geri dönüş, yeniden denemeler, hız sınırlama, gizli referanslar, observability, korkuluklardır. 2026'da pazar bölünmesi: **LiteLLM** 100'den fazla sağlayıcıya sahip, OpenAI uyumlu, ancak ~2000 RPS civarında (8 GB bellek, yayınlanan benchmark'larda ardışık hatalar) MIT OSS'dir; Python için en iyisi, <500 RPS, geliştirme/prototip oluşturma. **Portkey** kontrol düzleminde konumlandırılmıştır (korkuluklar, PII düzenlemesi, jailbreak tespiti, denetim izleri), Mart 2026'da Apache 2.0 açık kaynak olarak kullanılmıştır, 20-40 ms gecikme ek yükü, $49/mo production tier. **Kong AI Gateway** built on Kong Gateway — Kong's own benchmark on same 12 CPUs: 228% faster than Portkey, 859% faster than LiteLLM; $100/model/ay fiyatlandırma (Plus katmanında maksimum 5); Zaten Kong'daysanız kurumsal kullanıma uygundur. **Bifrost** (Maxim AI) — yapılandırılabilir geri çekilmeli otomatik yeniden denemeler, OpenAI 429'da Anthropic'e geri dönüş. **Cloudflare / Vercel AI Ağ Geçitleri** — yönetilen, sıfır operasyonlar, temel yeniden deneme. Veri yerleşimi kendi kendine barındırma kararını yönlendirir; Portkey ve Kong, OSS + isteğe bağlı yönetim ile ortada yer alıyor.

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak ağ geçidi yönlendirme simülatörü)
**Önkoşullar:** Aşama 17 · 01 (Yönetilen Yüksek Lisans Platformları), Aşama 17 · 16 (Model Yönlendirme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Altı temel ağ geçidi özelliğini sıralayın (yönlendirme, geri dönüş, yeniden denemeler, hız sınırları, sırlar, observability, korkuluklar).
- Tavanları ölçeklendirmek ve senaryoları kullanmak için dört 2026 ağ geçidini (LiteLLM, Portkey, Kong AI, Bifrost) eşleyin.
- Kong'dan benchmark alıntı yapın (%228'e karşı Portkey, %859'a karşı LiteLLM) ve >500 RPS için neden önemli olduğunu açıklayın.
- Veri yerleşimi ve operasyon bütçesi göz önüne alındığında, kendi kendine barındırılan ve yönetilenleri seçin.

## Sorun

Ürününüz OpenAI, Anthropic ve kendi kendine barındırılan bir Lamayı çağırır. Her sağlayıcının farklı bir SDK'sı, hata modeli, hız sınırı ve kimlik doğrulama şeması vardır. Yük devretme (OpenAI 429'lar ise Anthropic'i deneyin), tek bir kimlik bilgisi deposu, birleştirilmiş observability ve kiracı başına hız limitleri istiyorsunuz.

Bunu uygulama katmanında yeniden tasarlamak, her hizmeti her sağlayıcıyla eşleştirir. Bir ağ geçidi katmanı, bunu sağlayıcılara dağıtan tek bir API (genellikle OpenAI uyumlu) ile tek bir işlemde birleştirir.

## Konsept

### Altı temel özellik

1. **Sağlayıcı yönlendirme** — OpenAI, Anthropic, Gemini, kendi kendine barındırılan vb. tek bir API'nin arkasında.
2. **Geri çekilme** — 429, 5xx veya kalite hatası durumunda başka bir yerde yeniden deneyin.
3. **Yeniden denemeler** — üstel geri çekilme, sınırlı denemeler.
4. **Ücret sınırları** — kiracı başına, anahtar başına, model başına.
5. **Gizli referanslar** — Çalışma zamanında kimlik bilgilerini kasadan çekin (asla uygulamada değil).
6. **Observability** — OTel + GenAI özellikleri (Aşama 17 · 13) + maliyet ilişkilendirmesi.
7. **Korkuluklar** — Kişisel bilgilerin düzenlenmesi, jailbreak tespiti, izin verilen konu filtreleri.

### LiteLLM — MIT OSS, Python

- 100'den fazla sağlayıcı, OpenAI uyumlu, yönlendirici yapılandırması, geri dönüş, temel observability.
- Kong'un benchmark'sında 2000 RPS civarına düşüyor; 8 GB bellek alanı, sürekli yük altında ardışık arızalar.
- En uygun: Python uygulaması, <500 RPS, geliştirme/hazırlama ağ geçitleri, deneysel yönlendirme.
- Maliyet: OSS için 0$; bulut ücretsiz katmanı mevcuttur.

### Anahtar — düzlem konumlandırmayı kontrol eder

- Mart 2026 itibarıyla Apache 2.0 OSS. Korkuluklar, PII redaksiyonu, jailbreak tespiti, denetim izleri.
- İstek başına 20-40 ms gecikme ek yükü.
- Tutma + SLA ile üretim katmanı için aylık 49 ABD doları.
- En uygun: korkuluklara ihtiyaç duyan düzenlenmiş endüstriler + observability paket.

### Kong AI Ağ Geçidi — ölçekli oyun

- Kong Gateway (olgun API ağ geçidi ürünü, lua+OpenResty) üzerine kurulmuştur.
- Kong'un 12 CPU eşdeğerindeki kendi benchmark'si: Portkey'den %228 daha hızlı, LiteLLM'den %859 daha hızlı.
- Fiyatlandırma: Model/ay başına 100$, Plus kademesinde maksimum 5.
- En uygun: zaten Kong'da; >1000RPS; lisans vermeye istekli.

### Bifrost (Maxim AI)

- Yapılandırılabilir geri çekilmeyle otomatik yeniden denemeler.
- OpenAI 429'da Antropik'e geri dönüş standart bir tariftir.
- Daha yeni katılımcı; reklam.

### Cloudflare AI Ağ Geçidi / Vercel AI Ağ Geçidi

- Yönetilen, sıfır operasyon. Temel yeniden deneme ve observability.
- En uygun: Cloudflare/Vercel'de uçta hizmet veren JavaScript uygulamaları.
- Korkuluklar ve oran limitleri açısından Kong/Portkey ile karşılaştırıldığında sınırlıdır.

### Kendi kendine barındırılan ve yönetilen karşılaştırması

Veri yerleşimi zorlama işlevidir. Sağlık hizmetleri ve finans varsayılan olarak kendi kendine barındırılır (LiteLLM veya Portkey OSS veya Kong). Tüketici ürünleri varsayılan olarak yönetilir (Cloudflare AI Gateway) veya orta katman (Portkey tarafından yönetilir). Hibrit: Düzenlemeye tabi kiracı için kendi kendine barındırılan, başkaları için yönetilen.

### Gecikme bütçesi

- LiteLLM: Tipik 5-15 ms ek yük.
- Anahtar: 20-40 ms ek yük.
- Kong: 3-8 ms ek yük.
- Cloudflare/Vercel: 1-3 ms ek yük (kenar avantajı).

Ağ geçidi gecikmesi doğrudan TTFT'ye eklenir. TTFT P99 için < 100 ms SLA, Kong veya Cloudflare. P99 < 500 ms için herhangi biri.

### Hız sınırı semantiği önemlidir

Basit token-kova orta ölçeğe kadar çalışır. Çok kiracılı, kayan pencere + patlama izni + kiracı başına katmanlama gerektirir. LiteLLM, token-kovayı gönderir; Kong kayan pencereli gemiler; Portkey gemileri katmanlı.

### Ağ Geçidi + observability + yönlendirme oluşturma

Aşama 17 · 13 (observability) + 16 (model yönlendirme) + 19 (ağ geçitleri), üretimdeki aynı katmandır. Üçünü de kapsayan bir araç seçin veya bunları dikkatlice bağlayın: 2026 deployment'ların çoğu, bölünmüş roller için Helicone (observability) veya Portkey'i (korkuluklar) Kong (ölçek) ile birleştirir.

### Hatırlamanız gereken sayılar

- LiteLLM: ~2000 RPS'de kesilir, 8 GB bellek.
- Anahtar: 20-40 ms ek yük; Apache 2.0, Mart 2026'dan beri.
- Kong: Portkey'den %228 daha hızlı, LiteLLM'den %859 daha hızlı.
- Kong fiyatlandırması: 100$/model/ay, Plus katmanında maksimum 5.
- Cloudflare/Vercel: Kenarda 1-3 ms ek yük.

## Use It — Hazır Araçla Uygula

`code/main.py` , 429/5xx enjeksiyonu altında 3 sağlayıcı arasında geri dönüşle ağ geçidi yönlendirmesini simüle eder. Gecikmeyi, yeniden deneme oranını ve geri dönüş isabet oranını raporlar.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-gateway-picker.md` üretir. Ölçek, operasyon duruşu, uyumluluk, gecikme bütçesi göz önüne alındığında bir ağ geçidi seçer.

## Egzersizler

1. `code/main.py`'yı çalıştırın. OpenAI → Antropik → kendi kendine barındırılan seçeneğinden geri dönüşü yapılandırın. %5 sağlayıcı hata oranında beklenen isabet oranı nedir?
2. SLA'nız 300 ms'lik taban çizgisinde TTFT P99 < 200 ms'dir. Hangi ağ geçitleri bütçe dahilinde kalıyor?
3. Bir sağlık hizmeti müşterisi, kendi kendine barındırılan + PII düzenleme + denetim gerektirir. Portkey OSS veya Kong'u seçin.
4. LiteLLM ile Kong'u karşılaştırın: Bir ekip hangi RPS tavanına göre geçiş yapmalıdır?
5. Çok kiracılı bir SaaS için bir ücret sınırı politikası tasarlayın: ücretsiz katman, deneme katmanı, ücretli katman. Token-kova mı yoksa sürgülü pencere mi?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Ağ Geçidi | "API komisyoncusu" | Uygulamalar ve sağlayıcılar arasında işlem oturumu |
| LiteLLM | "MIT'deki" | Python OSS, 100'den fazla sağlayıcı, 2K RPS'de ara veriyor |
| Anahtar | "korkuluk ağ geçidi" | Kontrol düzlemi + observability, Apache 2.0 |
| Kong AI Ağ Geçidi | "ölçek bir" | Kong Ağ Geçidi üzerine geliştirildi, benchmark lider |
| Bifrost | "Maxim'in geçidi" | Yeniden denemeler + Antropik geri dönüş tarifi |
| Cloudflare AI Ağ Geçidi | "kenar yönetimli" | Uçta konuşlandırılan yönetilen ağ geçidi, sıfır işlem |
| PII redaksiyonu | "veri temizleme" | Modele göndermeden önce Regex + NER maskesi |
| Jailbreak tespiti | "prompt enjeksiyon koruması" | Kullanıcı girişindeki sınıflandırıcı |
| Denetim takibi | "düzenlenmiş günlük" | Her LLM çağrısının değişmez kaydı |
| Token-kova | "basit oran sınırı" | Yeniden doldurma tabanlı hız sınırlayıcı |
| Sürgülü pencere | "kesin oran sınırı" | Zaman aralıklı hız sınırlayıcı; daha iyi adalet |

## Daha Fazla Okuma

- [Kong AI Ağ Geçidi Benchmark](https://konghq.com/blog/engineering/ai-gateway-benchmark-kong-ai-gateway-portkey-litellm)
- [TrueFoundry — AI Gateways 2026 Karşılaştırması](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison)
- [Techsy — En İyi Yüksek Lisans Ağ Geçidi Araçları 2026](https://techsy.io/en/blog/best-llm-gateway-tools)
- [LiteLLM GitHub](https://github.com/BerriAI/litellm)
- [Portkey GitHub](https://github.com/Portkey-AI/gateway)
- [Kong AI Ağ Geçidi belgeleri](https://docs.konghq.com/gateway/latest/ai-gateway/)
