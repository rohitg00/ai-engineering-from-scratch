# LLM Yönlendirme Katmanı — LiteLLM, OpenRouter, Portkey

> Sağlayıcıya bağlı kalmak pahalıdır. Farklı araç çağırma iş yükleri farklı modellere uygundur. Yönlendirme ağ geçitleri, tek bir API yüzeyi, yeniden denemeler, yük devretme, maliyet takibi ve korumalar sağlar. 2026'ya üç arketip hakimdir: LiteLLM (açık kaynaklı, kendi kendine barındırılan), OpenRouter (yönetilen SaaS), Portkey (üretim düzeyinde, Mart 2026'da açık kaynaklı). Bu ders, karar kriterlerini adlandırır ve bir stdlib yönlendirme ağ geçidini yürütür.

**Tür:** Öğren
**Diller:** Python (stdlib, yönlendirme + yük devretme + maliyet izleyici)
**Önkoşullar:** Aşama 13 · 02 (işlev çağrısı), Aşama 13 · 17 (ağ geçitleri)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Şirket içinde barındırılan, yönetilen ve üretim düzeyinde yönlendirme seçeneklerini birbirinden ayırın.
- Sağlayıcı hatalarını tanımlanmış bir öncelik sırasına göre yeniden deneyen bir geri dönüş zinciri uygulayın.
- Sağlayıcılar genelinde istek başına maliyeti ve token kullanımını izleyin.
- Belirli bir üretim kısıtlaması için LiteLLM, OpenRouter ve Portkey arasında karar verin.

## Sorun

Sağlayıcı yönlendirmesinin önemli olduğu senaryolar:

1. **Maliyet.** Claude Sonnet'in fiyatı Haiku'nun 3 katıdır. Triyaj görevi için Haiku yeterlidir; Bir sentez görevi için Sonnet buna değer. İstek başına rota.

2. **Yük devretme.** OpenAI'nin kötü bir saati var. Her istek başarısız olur. Yeniden konuşlandırmaya gerek kalmadan Anthropic'e otomatik geri dönüş istiyorsunuz.

3. **Gecikme.** Canlı sohbet kullanıcı arayüzünün hızlı ilk token süresine ihtiyacı vardır. Bir toplu özetleyici bunu yapmaz. Gecikme HDS'sine göre yönlendirme.

4. **Uyumluluk.** AB kullanıcıları AB bölgelerinde kalmalıdır. Bölgeye göre rota.

5. **Deneme.** Aynı iş yükünde A/B iki model. Test paketine göre rota.

Tüm bunların entegrasyon başına elle kodlanması tekrarlanır. Yönlendirme ağ geçidi, OpenAI uyumlu bir API sağlar ve gerisini halleder.

## Konsept

### OpenAI uyumlu proxy şekli

Herkes OpenAI şeklinde konuşuyor. Yönlendirme ağ geçidi `/v1/chat/completions`'yi açığa çıkarır, OpenAI şemasını kabul eder ve Anthropic / Gemini / Cohere / Ollama / herhangi bir şeye dahili olarak proxy'ler gönderir. Müşteri umursamıyor.

### Model takma adları

Sabitlenmiş anlık görüntü kimliği yerine kodunuz `our_smart_model` diyor. Ağ geçidi takma adları gerçek modellerle eşleştirir. Bir sağlayıcı yeni nesil gönderdiğinde, sunucu tarafındaki takma adı değiştirirsiniz; kodunuz hiçbir şeye dokunmuyor.

### Geri dönüş zincirleri

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Ağ geçitleri bunu bir yapılandırmada tanımlar. Yeniden denemeler bütçeye dahil edilir, böylece geri dönüş basamakları maliyeti artırmaz.

### Anlamsal önbelleğe alma

Aynı veya neredeyse aynı prompt'ler sağlayıcı yerine önbelleğe çarptı. Tekrarlanan agent loop'lerdeki tasarruf yüzde 30 ila 60 arasında olabilir. Anahtarlar embedding tabanlıdır; neredeyse aynı prompt'ler bir önbellek yuvasını paylaşır.

### Korkuluklar

Ağ geçidi düzeyinde:

- **PII düzenlemesi.** prompt'leri göndermeden önce normal ifade veya ML tabanlı geçiş.
- **Politika ihlalleri.** Yasaklı içeriğe sahip prompt'leri reddedin.
- **Çıkış filtreleri.** Tamamlananları sızıntılara karşı fırçalayın.

Portkey ve Kong'un her ikisi de inatçı korkuluklar sunuyor. LiteLLM bunları isteğe bağlı olarak bırakır.

### Anahtar başına hız sınırları

Bir API anahtarı = bir ekip. Anahtar başına bütçeler, bir ekibin paylaşılan kotayı tüketmesini engeller. Çoğu ağ geçidi bunu destekler.

### Kendi kendine barındırılan ve yönetilen karşılaştırmalar

| Faktör | LiteLLM (kendi kendine barındırılan) | OpenRouter (yönetilen) | Anahtar (üretim) |
|--------|----------------------|----------------------|----------------------|
| Kod | Açık kaynak, Python | Yönetilen SaaS | Açık kaynak (Mart 2026) + yönetilen |
| Kurulum | Proxy dağıtma | Kaydol | Ya |
| Sağlayıcılar | 100+ | 300+ | 100+ |
| Faturalandırma | Kendi anahtarlarınız | OpenRouter kredileri | Kendi anahtarlarınız |
| Observability | Açık Telemetri | Kontrol Paneli | Tam OTel + PII redaksiyonu |
| Şunun için en iyisi | Tam kontrol isteyen takımlar | Hızlı prototipleme | Uyumlu üretim |

LiteLLM, bir SRE ekibiniz olduğunda ve veri egemenliği istediğinizde kazanır. Tek bir abonelik istediğinizde ve altyapıya ihtiyaç duymadığınızda OpenRouter kazanır. Portkey, korkuluklara ve kullanıma hazır uyumluluğa ihtiyaç duyduğunuzda kazanır.

### Maliyet takibi

Her istek `provider`, `model`, `input_tokens`, `output_tokens` taşır. Model başına token fiyatlarıyla çarpın (ağ geçidinin tuttuğu fiyatlandırma tablosundan alınır). Kullanıcı başına / ekip başına / proje başına toplama.

### MCP artı yönlendirme

Bir ağ geçidi hem LLM çağrılarını hem de MCP örnekleme isteklerini yönlendirebilir. Bir örnekleme isteğinin modelPreferences'ı belirli bir modeli tercih ettiğinde, ağ geçidi sağ arka uca çeviri yapar. Burası Aşama 13 · 17'nin (MCP ağ geçidi) ve bu dersin yönlendirme ağ geçidinin bazen tek bir hizmette birleştiği yerdir.

### Yönlendirme stratejileri

- **Statik öncelik.** Listede ilk sırada; hataya düşmek.
- **Yük dengeleme.** Yuvarlak veya ağırlıklı.
- **Maliyet bilincinde.** Gecikme/kaliteyi karşılayan en ucuz modeli seçin.
- **Gecikmeye duyarlı.** Son N dakikadaki en hızlı modeli seçin.
- **Göreve duyarlı.** Prompt sınıflandırıcı, kodlamayı bir modele, özetlemeyi diğerine yönlendirir.

## Kullan onu

`code/main.py`, yaklaşık 150 satırlık bir yönlendirme ağ geçidi uygular: OpenAI şeklindeki istekleri kabul eder, sağlayıcı başına taslaklara çevirir, öncelikli bir geri dönüş zinciri çalıştırır, istek başına maliyeti izler ve girişlere bir PII düzenleme geçişi uygular. Üç senaryoyla çalıştırın: normal istek, birincil sağlayıcı kesintisinin geri dönüşü tetiklemesi, düzeltmeyle yakalanan PII sızıntısı.

Neye bakmalı:

- `ROUTES` dict: takma ad -> somut sağlayıcıların öncelik sırasına göre listesi.
- Geri dönüş döngüsü 5xx'te yeniden denenir.
- Maliyet takipçisi, token kullanımını model başına oranlarla çarpar.
- PII redaktörü, iletmeden önce SSN şeklindeki desenleri temizler.

## Gönderin

Bu ders `outputs/skill-routing-config-designer.md`'yi üretir. Bir iş yükü profili (gecikme, maliyet, uyumluluk) verildiğinde, beceri LiteLLM / OpenRouter / Portkey'i seçer ve bir yönlendirme yapılandırması üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Kesinti senaryosunu tetikleyin; Yedeklemenin ikinci sağlayıcıya ulaştığını ve maliyetin doğru şekilde ilişkilendirildiğini doğrulayın.

2. Anlamsal önbelleğe alma ekleyin: prompt'nin SHA256'sı bir arama anahtarıdır; önbellek isabetleri anında geri döner. Tekrarlanan bir aramada maliyet tasarrufunu ölçün.

3. "Kod..." prompt'leri zekayı destekleyen bir takma ada yönlendiren ve prompt'leri hızı tercih eden bir takma ada "özetleyen..." bir prompt sınıflandırıcı ekleyin.

4. Ekip başına bütçe tasarlayın: Her ekibin aylık harcama sınırı vardır; ağ geçidi sınıra ulaşıldığında istekleri reddeder. Bir yaptırım ayrıntı düzeyi seçin (istek başına veya pencereli).

5. LiteLLM, OpenRouter ve Portkey belgelerini yan yana okuyun. Her iki geminin de diğer ikisinin sahip olmadığı bir özelliği adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Yönlendirme ağ geçidi | "Yüksek Lisans vekili" | Birçok sağlayıcının önünde tek API yüzey katmanı |
| OpenAI uyumlu | "OpenAI şemasını konuşuyor" | `/v1/chat/completions` şeklini kabul eder, herhangi bir arka uca çevirir |
| Model takma adı | "bizim_smart_modelimiz" | Kodunuzda ağ geçidinin somut bir modelle eşleştiği adı belirtin |
| Geri dönüş zinciri | "Listeyi yeniden dene" | Başarısızlık durumunda denenen sağlayıcıların sıralı listesi |
| Anlamsal önbelleğe alma | "Prompt-embedding önbellek" | Anahtar, prompt'nin embedding'sidir; neredeyse kopyalar önbellek isabetini paylaşıyor |
| Korkuluklar | "Giriş/çıkış filtreleri" | Kimlik Bilgilerini düzeltin, politika ihlallerini reddedin |
| Anahtar başına ücret sınırı | "Takım bütçesi" | Kotanın kapsamı bir API anahtarına ayarlandı |
| Maliyet takibi | "İstek başına harcama" | Toplam token kullanım x model başına fiyat |
| LiteLLM | "Açık proxy" | Kendi kendine barındırılabilen OSS yönlendirme ağ geçidi |
| OpenRouter | "Yönetilen SaaS" | Kredi bazlı faturalandırma ile barındırılan ağ geçidi |
| Anahtar | "Üretim seçeneği" | Açık kaynak + yerleşik korkuluklarla yönetilir |

## Daha Fazla Okuma

- [LiteLLM — docs](https://docs.litellm.ai/) — şirket içinde barındırılan yönlendirme ağ geçidi
- [OpenRouter — hızlı başlangıç](https://openrouter.ai/docs/quickstart) — yönetilen yönlendirme SaaS'ı
- [Portkey — dokümanlar](https://portkey.ai/docs) — korkuluklarla üretim yönlendirme
- [TrueFoundry — LiteLLM ve OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) — karar kılavuzu
- [Relayplane — Yüksek Lisans ağ geçidi karşılaştırması 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) — tedarikçi anketi
