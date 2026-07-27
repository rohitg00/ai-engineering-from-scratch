# Yapılandırılmış Çıktı — JSON Schema, Pydantic, Zod, Kısıtlı Kod Çözme

> "Modelden nazikçe JSON'u iade etmesini isteyin", sınır modellerde bile yüzde 5 ila 15 oranında başarısız olur. Yapılandırılmış çıktılar, kısıtlı kod çözme ile bu boşluğu kapatır: modelin, şemayı ihlal edecek bir token yayması kelimenin tam anlamıyla engellenir. OpenAI'nin katı modu, Anthropic'in şema tipi araç kullanımı, Gemini'nin `responseSchema`'si, Pydantic AI'nın `output_type`'si ve Zod'un `.parse`'si aynı fikrin beş yüzey formudur. Bu ders, öğrencilerin her üretim çıkarma ardışık düzeni için kullanacakları şema doğrulayıcıyı ve katı mod sözleşmesini oluşturur.

**Tür:** Yapım
**Diller:** Python (stdlib, JSON Schema 2020-12 alt kümesi)
**Önkoşullar:** Aşama 13 · 02 (derin dalışı çağıran işlev)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Doğru kısıtlamaları (enum, min/max, gerekli, model) kullanarak bir çıkarma hedefi için bir JSON Schema 2020-12 yazın.
- Neden katı mod ve kısıtlı kod çözmenin "nesilden sonra doğrulama"dan farklı garantiler verdiğini açıklayın.
- Üç hata modunu ayırt edin: ayrıştırma hatası, şema ihlali, model reddi.
- Yazılı onarım ve yazılı reddetme işlemleriyle birlikte bir çıkarma hattı gönderin.

## Sorun

Bir satın alma siparişi e-postasını okuyan bir agent'nin, serbest metni `{customer, line_items, total_usd}`'ye dönüştürmesi gerekir. Üç yaklaşım.

**Birinci yaklaşım: JSON için prompt.** "JSON'da müşteri, line_items, total_usd alanlarıyla yanıtlayın." Sınır modellerinde zamanın yüzde 85 ila 95'inde çalışır. Altı şekilde başarısız olur: eksik parantez, sondaki virgül, yanlış türler, halüsinasyonlu alanlar, token sınırında kesilmiş, "İşte JSON'unuz:" gibi sızdırılmış düzyazı.

**İkinci yaklaşım: Oluşturduktan sonra doğrulayın.** Serbestçe oluşturun, ayrıştırın, şemaya göre doğrulayın, başarısızlık durumunda yeniden deneyin. Güvenilir ama pahalı; her yeniden deneme için ödeme yaparsınız ve kesme hataları, olay başına ekstra bir tur maliyetine mal olur.

**Üçüncü yaklaşım: kısıtlı kod çözme.** Sağlayıcı, kod çözme zamanında şemayı zorlar. Geçersiz token'ler örnekleme dağıtımının dışında maskelenir. Çıktının ayrıştırılması ve doğrulanması garanti edilir. Başarısızlık tek bir moda indirgenir: reddetme (model, girdinin şemaya uymadığına karar verir).

Her 2026 sınır sağlayıcısı bir tür üçüncü yaklaşımı gönderir.

- **OpenAI.** Modelin reddedilmesi durumunda yanıtta `response_format: {type: "json_schema", strict: true}` artı `refusal`.
- **Anthropic.** `tool_use` girişlerinde şema uygulaması; `stop_reason: "refusal"` bir şey değildir, ancak hiçbir araç çağrısı olmayan `end_turn` sinyaldir.
- **Gemini.** `responseSchema` istek düzeyinde; 2026'da Gemini, seçilen türler için token düzeyindeki dilbilgisi kısıtlamalarını sunuyor.
- **Pydantic AI.** `output_type=InvoiceModel`, `InvoiceModel`'ye yazılan yapılandırılmış bir `RunResult` yayar.
- **Zod (TypeScript).** Sağlayıcı çıktısını bir Zod şemasına göre doğrulayan çalışma zamanı ayrıştırıcısı; OpenAI'nin `beta.chat.completions.parse`'si ile eşleşir.

Ortak konu: şemayı bir kez ilan edin, uçtan uca uygulayın.

## Konsept

### JSON Schema 2020-12 — ortak dil

Her sağlayıcı JSON Schema 2020-12'yi kabul eder. En çok kullandığınız yapılar:

- `type`: `object`, `array`, `string`, `number`, `integer`, `boolean`, `null`'den biri.
- `properties`: alan adının alt şemaya eşlenmesi.
- `required`: görünmesi gereken alan adlarının listesi.
- `enum`: izin verilen değerlerin kapalı kümesi.
- `minimum` / `maximum` (sayılar), `minLength` / `maxLength` / `pattern` (dizeler).
- `items`: her dizi öğesine uygulanan alt şema.
- `additionalProperties`: `false` ekstra alanları yasaklar (varsayılan, moda göre değişir).

OpenAI katı modu üç gereksinim ekler: her özellik `required`, her yerde `additionalProperties: false`'de listelenmeli ve çözülmemiş `$ref` olmamalıdır. Bunları bozarsanız API istek anında 400 değerini döndürür.

### Pydantic, Python bağlaması

Pydantic v2, `model_json_schema()` aracılığıyla veri sınıfı şeklindeki modellerden JSON Schema oluşturur. Pydantic AI bunu tamamlar ve şunu yazarsınız:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

ve agent framework, şemayı uçta OpenAI katı moduna, Anthropic `input_schema` veya Gemini `responseSchema`'ye dönüştürür. Modelin çıktısı, yazılan bir `Invoice` örneği olarak geri gelir. Doğrulama hataları, yazılan hata yollarıyla `ValidationError`'yi yükseltir.

### Zod, TypeScript bağlaması

Zod (`z.object({customer: z.string(), ...})`) TS eşdeğeridir. OpenAI'nin Node SDK'sı, API'nin JSON Şema yükünü ifade eden `zodResponseFormat(Invoice)`'yi ortaya çıkarır.

### Reddedilenler

Katı mod, modeli yanıt vermeye zorlayamaz. Giriş şemaya uymuyorsa ("e-posta bir şiirdi, fatura değil"), model bunun nedenini içeren bir `refusal` alanı yayınlar. Kodunuz bunu bir başarısızlık olarak değil, birinci sınıf bir sonuç olarak ele almalıdır. Reddetme aynı zamanda bir güvenlik sinyali olarak da faydalıdır: Korumalı içerikli bir e-postadan kredi kartı numarasını alması istenen bir model, güvenlik nedeni eklenmiş bir ret yanıtı verir.

### Açık alanda kısıtlı kod çözme

Açık ağırlık uygulamaları üç teknik kullanır.

1. **Dilbilgisi tabanlı kod çözme** (`outlines`, `guidance`, `lm-format-enforcer`): şemadan deterministik bir sonlu otomat oluşturun; her adımda FSM'yi ihlal edecek token'lerin logitlerini maskeleyin.
2. **JSON ayrıştırıcısıyla logit maskeleme**: modelle uyumlu bir akış JSON ayrıştırıcısını çalıştırın; her adımda geçerli bir sonraki token kümesini hesaplayın.
3. **Doğrulayıcıyla spekülatif kod çözme**: Ucuz taslak modeli token'leri önerir, doğrulayıcı şemayı uygular.

Ticari sağlayıcılar perde arkasında bunlardan birini seçiyor. 2026'nın son teknolojisi, kısa yapılandırılmış çıktılar için düz üretimden daha hızlıdır ve uzun çıktılar için de kabaca aynı hıza sahiptir.

### Üç arıza modu

1. **Ayrıştırma hatası.** Çıkış geçerli bir JSON değil. Katı modda gerçekleşemez. Katı olmayan sağlayıcılarda hâlâ gerçekleşebilir.
2. **Şema ihlali.** Çıktı ayrıştırılıyor ancak şemayı ihlal ediyor. Katı modda gerçekleşemez. Onun dışında yaygındır.
3. **Ret.** Model reddedilir. Yazılı bir sonuç olarak ele alınmalıdır.

### Stratejiyi yeniden dene

Katı modun dışında olduğunuzda (Anthropic araç kullanımı, katı olmayan OpenAI, eski Gemini), kurtarma modeli şöyledir:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

Bir kez yeniden deneme genellikle yeterlidir. Üç yeniden deneme, zayıf model pullarını yakalar. Üçün ötesinde, kötü bir şemanın işaretidir: model bazı girdiler için bunu karşılayamaz ve prompt veya şemanın düzeltilmesi gerekir.

### Küçük model desteği

Kısıtlı kod çözme küçük modellerde çalışır. Dilbilgisi uygulamasına sahip 3B parametreli açık model, yapılandırılmış görevlerde ham prompting ile 70B parametreli modelden daha iyi performans gösterir. Yapılandırılmış çıktıların üretim için önemli olmasının ana nedeni budur: güvenilirliği model boyutundan ayırır.

## Kullan onu

`code/main.py`, stdlib'de minimum bir JSON Schema 2020-12 doğrulayıcı sunar (türler, gerekli, numaralandırma, min/maks, desen, öğeler, ekÖzellikler). Bir `Invoice` şemasını sarar ve doğrulayıcı aracılığıyla sahte bir LLM çıktısı çalıştırarak ayrıştırma hatasını, şema ihlalini ve ret yollarını gösterir. Sahte çıktıyı herhangi bir sağlayıcının üretimdeki gerçek tepkisiyle değiştirin.

Neye bakmalı:

- Doğrulayıcı, yolu ve mesajı içeren, yazılan bir `[ValidationError]` listesini döndürür. prompt'yi yeniden denediğinizde ortaya çıkmasını istediğiniz şekil budur.
- Reddetme dalı yeniden denemez. Yazılan bir reddi günlüğe kaydeder ve döndürür. Aşama 14 · 09, retleri bir güvenlik sinyali olarak kullanıyor.
- `additionalProperties: false` kontrolü, rakip test girişinde etkinleşerek katı modun neden halüsinasyonlu alanlarda kapıyı kapattığını gösterir.

## Gönderin

Bu ders `outputs/skill-structured-output-designer.md`'yi üretir. Serbest metin çıkarma hedefi (faturalar, destek biletleri, özgeçmişler vb.) göz önüne alındığında, beceri, katı modla uyumlu bir JSON Schema 2020-12 ve yazılan ret ve yeniden deneme işlemlerinin saplandığı şekilde onu yansıtan bir Pydantic modeli üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. `total_usd` negatif bir sayı olan dördüncü bir test senaryosu ekleyin. Doğrulayıcının bunu `minimum` kısıtlama yolu ile reddettiğini doğrulayın.

2. Doğrulayıcıyı bir ayırıcıyla `oneOf`'yi destekleyecek şekilde genişletin. Yaygın durum: `line_item`, `kind` tarafından etiketlenen bir ürün veya hizmettir. Katı modun burada ince kuralları vardır; OpenAI'nin yapılandırılmış çıktılar kılavuzunu kontrol edin.

3. Aynı Fatura şemasını Pydantic BaseModel olarak yazın ve `model_json_schema()` çıktısını elle haddelenmiş şemanızla karşılaştırın. Pydantic'in varsayılan olarak elle yuvarlanan sürümün atladığı bir alanı tanımlayın.

4. Reddetme oranlarını ölçün. Çıkarılamaması gereken on girdi oluşturun (bir şarkı sözü, bir matematik kanıtı, boş bir e-posta) ve bunları katı modda gerçek bir sağlayıcı aracılığıyla çalıştırın. Reddedilenleri ve halüsinasyonlu çıktıları sayın. Bu, reddedilmeye duyarlı yeniden denemeler için temel gerçeğinizdir.

5. OpenAI'nin yapılandırılmış çıktı kılavuzunu yukarıdan aşağıya okuyun. Düz JSON Schemanın izin verdiği katı modda açıkça yasakladığı yapıyı tanımlayın. Daha sonra, yasak yapıyı gereksiz yere kullanan bir şema tasarlayın ve onu tam uyumlu olacak şekilde yeniden düzenleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "Şema özellikleri" | IETF taslağı şema lehçesi her modern sağlayıcının konuştuğu dildir |
| Katı mod | "Garantili şema" | Kısıtlı kod çözme yoluyla şemayı zorlayan OpenAI bayrağı |
| Kısıtlı kod çözme | "Logit maskeleme" | Geçersiz sonraki token'leri maskeleyen kod çözme zamanı uygulaması |
| Reddetme | "Model reddediliyor" | Giriş şemaya sığmadığında yazılan sonuç |
| Ayrıştırma hatası | "Geçersiz JSON" | Çıktı JSON olarak ayrıştırılmadı; katı koşullar altında imkansız |
| Şema ihlali | "Yanlış şekil" | Ayrıştırılmış ancak ihlal edilen türler / gerekli / numaralandırma / aralık |
| `additionalProperties: false` | "Ekstralara izin verilmez" | Bilinmeyen alanları yasaklar; OpenAI'de gerekli katı |
| Pydantic TabanModeli | "Yazılan çıktı" | JSON Schemanı yayınlayan ve doğrulayan Python sınıfı |
| Zod şeması | "TypeScript çıktı türü" | Sağlayıcı çıktı doğrulaması için TS çalışma zamanı şeması |
| Dilbilgisi yaptırımı | "Açık ağırlıklar kısıtlı kod çözme" | Ana hatlarda/kılavuzda olduğu gibi FSM tabanlı logit maskeleme |

## Daha Fazla Okuma

- [OpenAI — Yapılandırılmış çıktılar](https://platform.openai.com/docs/guides/structured-outputs) — katı mod, retler ve şema gereksinimleri
- [OpenAI — Yapılandırılmış çıktılarla tanışın](https://openai.com/index/introducing-structured-outputs-in-the-api/) — Kod çözme garantisini açıklayan Ağustos 2024 lansman gönderisi
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) — her sağlayıcıya serileştirilen, yazılan çıktı_tipi bağlamaları
- [JSON Schema — 2020-12 sürüm notları](https://json-schema.org/draft/2020-12/release-notes) — standart spesifikasyon
- [Microsoft — Azure OpenAI'de yapılandırılmış çıktılar](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) — kurumsal deployment notları ve katı mod uyarıları
