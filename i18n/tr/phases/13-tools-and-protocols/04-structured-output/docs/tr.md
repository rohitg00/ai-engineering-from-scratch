# Yapılandırılmış Çıktı  JSON Şema, Pydantic, Zod, Sınırlı Şifreleme

> "Modelle JSON'u geri göndermesini iyice iste" zamanın yüzde 5 ila 15'inde başarısız olur. Sınır modelleri bile. Yapısal çıkışlar kısıtlı dekodlama ile bu boşluğu kapatır: model kelimenin tam anlamıyla şema ihlal edecek bir token göndermekten engelleniyor. OpenAI'nin sıkı modu, Anthropic'in şema tipi araç kullanımı, Gemini'nin `responseSchema`, Pydantic AI's `output_type`, ve Zod'un `.parse`Bu ders, şema onaylayıcısını oluşturur ve sıkı mod sözleşme öğrencileri her üretim çıkarma boru hattı için kullanacak.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, JSON Schema 2020-12 subset)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Doğru kısıtlamaları kullanarak bir çıkarma hedefi için JSON Schema 2020-12 yazın (enum, min/max, gerekli, desen).
- Sıkı mod ve kısıtlı dekodlama neden "genresinden sonra geçerlilik"ten farklı garantiler veriyor?
- Üç başarısızlık modunu ayırt edin: analiz hatası, şema ihlali, model reddesi.
- Tipik tamir ve tipik reddetme işlemleri ile bir çıkarma boru hattı gönderin.

## Sorun

Bir e-posta e-postalarını okuyan bir ajan , ücretsiz metni `{customer, line_items, total_usd}`Üç yaklaşım.

**Approach one: prompt for JSON.**"JSON'da müşteri alanları, line_items, total_usd ile yanıtlayın. " Sınır modelleri üzerinde zamanın yüzde 85 ila 95'inde çalışır. Altı şekilde başarısız olur: eksik bir kemik, arka kom, yanlış türler, halüsinasyon alanları, token limitinde kısaltılmış, "Burada JSON: " gibi sızmış proza.

**Approach two: validate after generation.**Güvenilir ama pahalı  her tekrar deneme için ödeme yaparsınız ve kesim hataları her olayda bir ekstra dönüştürür.

**Approach three: constrained decoding.**Provider şema'yı çözme zamanında zorlar. Geçersiz tokenler örnekleme dağıtımından gizlenir. Çıktı analiz edilmesi ve onaylanması garantilidir. Başarısızlık bir modda çökür: reddedilme (model giriş şema'ya uymadığını belirler).

2026'da her sınır sağlayıcısı üçüncü yaklaşım yöntemi gönderir.

- **OpenAI.** `response_format: {type: "json_schema", strict: true}`Ek olarak .`refusal`model düşerse tepki gösterir.
- **Anthropic.**Şema uygulanması `tool_use`Girişler; `stop_reason: "refusal"`- Bu bir şey değil ama.`end_turn`Araç çağrısı olmadan sinyal.
- **Gemini.** `responseSchema`İsteğe bağlı olarak; 2026 yılında Gemini seçilen türler için token seviyesindeki dilbilimsel kısıtlamalar gönderir.
- **Pydantic AI.** `output_type=InvoiceModel`yapılandırılmış bir `RunResult` olarak yazılır`InvoiceModel`- Evet .
- **Zod (TypeScript).**Zod şeması ile sağlayıcı çıkışını doğrulayan çalıştırma zamanını analiz eden, OpenAI'nin `beta.chat.completions.parse`- Evet .

Ortak nokta: Şema'yı bir kez açıklayın, sonuna kadar uygulayın.

## Anlaşım

### JSON Şema 2020-12  dil dili

Her sağlayıcı JSON Schema 2020-12'yi kabul eder. En çok kullandığınız yapı:

- `type`: bir tanesi`object`- Evet .`array`- Evet .`string`- Evet .`number`- Evet .`integer`- Evet .`boolean`- Evet .`null`- Evet .
- `properties`: alan adı haritası alt planlara.
- `required`: görünmesi gereken alan isimlerinin listesi.
- `enum`: izin verilen değerlerin kapalı bir kümesi.
- `minimum`- Ne ?`maximum`(sayılar),`minLength`- Ne ?`maxLength`- Ne ?`pattern`- Evet.
- `items`: her dizi öğesine uygulanan alt şema.
- `additionalProperties`- Evet .`false`Ekstra alanları yasaklar (öntemli mod değişir).

OpenAI sıkı modunda üç şart eklenir: her mülk listede bulunmalıdır `required`- Evet .`additionalProperties: false`Her yerde, çözülmemiş bir şey yok.`$ref`Bunları kırarsanız, API talep sırasında 400'i geri verir.

### Python bağlayıcı

Pydantic v2 , JSON Şeması'nı veri sınıfı şeklinde modellerden `model_json_schema()`Pydantic AI bunu şöyle yazıyor:

```python
class Invoice(BaseModel):
    customer: str
    line_items: list[LineItem]
    total_usd: Decimal
```

ve ajan çerçevesinin şemaları OpenAI sıkı moduna çevirmesi , Anthropic `input_schema`, ya da İkizler `responseSchema`Model çıkışı bir tipte geri gelir.`Invoice`Valide hataları yükselmektedir.`ValidationError`Tipleme hatası yolları ile.

### Zod, TypeScript bağlama

Zod (`z.object({customer: z.string(), ...})`OpenAI'nin Node SDK'sı `zodResponseFormat(Invoice)`API'nin JSON Schema payload'una çevirir.

### İtirazlar

Sıkı mod mod modun modelin cevap vermesini zorlayamaz. Giriş şemaya uymadıysa ("e-posta bir şiirdi, fatura değil"), model bir `refusal`Bu nedenle, bu durumun bir başarı olarak kabul edilmesi gerekmektedir. Bu durumun bir başarı olarak değil, bir başarısızlık olarak ele alınması gerekir. reddedilme güvenlik sinyali olarak da kullanışlıdır: korunan bir e-posta içerikinden kredi kartı numarasını çıkarmak istenen bir model, güvenlik nedenini ekleyerek reddedilmeyi gönderir.

### Açıkta kısıtlı şifreleme

Açık ağırlıklı uygulamalar üç tekniği kullanır.

1. **Grammar-based decoding**(`outlines`- Evet .`guidance`- Evet .`lm-format-enforcer`): Şema'dan bir belirleyici sınırlı otomaton oluşturun; her adımda FSM'yi ihlal edecek tokenların logitlerini gizleyin.
2. **Logit masking with a JSON parser**: modelle birlikte bir akış JSON analizciyi kilitlemede çalıştırın; her adımda geçerli-sonuçlu belirti setini hesaplayın.
3. **Speculative decoding with a verifier**: ucuz taslak modeli token önerir, doğrulayıcı şema uyguluyor.

Ticari tedarikçiler bu ürünlerden birini sahne arkasında seçerler. 2026 tarihli gelişme, kısa yapılandırılmış ürünler için sıradan jenerasyondan daha hızlı ve uzun ürünler için yaklaşık olarak aynı hızda.

### Üç başarısızlık modusu

1. **Parse error.**Çıktı geçerli JSON değil. Sıkı modda gerçekleşemez. Sıkı olmayan sağlayıcılarda hala gerçekleşebilir.
2. **Schema violation.**Çıktılamalar şema ile ilgili olarak ayrıştırılır ama sıkı modda gerçekleşmez.
3. **Refusal.**Modelle düşüş var, bu tip bir sonuç olarak ele alınmalıdır.

### Yeniden deneme stratejisi

Sıkı modun dışında (Antropik araç kullanımı, sıkı olmayan OpenAI, eski İkizler)yken, kurtarma örneği:

```
generate -> parse -> validate -> if fail, inject error and retry, max 3x
```

Bir tekrar deneme genellikle yeterlidir. Üç tekrar deneme zayıf model flakları yakalar. Üçten fazlası kötü bir şema belirtisidir: model bazı girişimler için tatmin edemez ve istek veya şema düzeltilmelidir.

### Küçük modellere destek

Sınırlı çözme küçük modeller üzerinde çalışır. Grammatik uygulamalar ile 3B parametresi açık bir model yapılandırılmış görevlerde ham istekle 70B parametresi modelini atlatır.

```figure
constrained-decoding
```

## Kullan

`code/main.py`stdlib'de en az JSON Schema 2020-12 onaylayıcıyı gönderir (tipler, gerekli, enum, min/max, desen, öğeler, ek özellikler).`Invoice`Şema ihlal ve reddetme yollarını göstererek, validatör üzerinden sahte bir LLM çıkışı çalıştırır.

Neye bakılır:

- Validatör , yazdırılmış bir `[ValidationError]`Bu, tekrar deneme sorguya çıkmasını istediğiniz şekil.
- İtiraz dalı tekrar denemez. Tiplenen bir reddedilmeyi kaydeder ve gönderir. 14 · 09 aşaması reddedilmeleri bir güvenlik sinyali olarak kullanır.
- - Evet .`additionalProperties: false`Karşılıklı test girişinde yangınları kontrol etmek, sert modun halüsinasyon alanlarında kapıyı neden kapadığını göstermek.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-structured-output-designer.md`. Özgür bir metin çıkarma hedefi (faktürler, destek biletleri, özetlemeler vb.) verildiğinde, becerik, sıkı mod uyumlu olan bir JSON Schema 2020-12 ve onu yansıtan bir Pydantic modeli üretir.

## Egzersizler

1. Çık .`code/main.py`Dördüncü test vakası da ekle .`total_usd`Validatörün onu reddetmesini onaylayın.`minimum`- Sınır yolu.

2. Validatörü desteklemek için uzat `oneOf`Bu durum da çok yaygın.`line_item` ile etiketlenmiş bir ürün veya hizmet`kind`Sıkı modda ince kurallar vardır; OpenAI'nin yapılandırılmış çıkış rehberine bakın.

3. Pydantic BaseModel ile aynı fatura şeması yazıp karşılaştır `model_json_schema()`Elle oynatılan versiyonun atadığı bir alan Pydantic setlerini varsayılan olarak tanımlayın.

4. Reddedilme oranlarını ölçün. Çıkarılamaz olmamalı olan on giriş oluşturun (bir şarkı sözlüğü, bir matematik kanıtı, boş bir e-posta) ve onları gerçek bir sağlayıcının üzerinden sıkı modda çalıştırın. Reddedilme oranlarını halüsinasyonlu çıkışlarla sayın. Reddedilme farkındalıklı tekrar denemeler için temel gerçek bu.

5. OpenAI'nin yapılandırılmış çıkış rehberini yukarıdan aşağıya okuyun. Açıkça yasakladığı yapılandırmayı açıkça açık bir şekilde açıklayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| JSON Schema 2020-12 | "The schema spec" | IETF-draft schema dialect every modern provider speaks |
| Strict mode | "Guaranteed schema" | OpenAI flag that enforces schema via constrained decoding |
| Constrained decoding | "Logit masking" | Decode-time enforcement that masks invalid next-tokens |
| Refusal | "Model declines" | Typed outcome when input cannot fit the schema |
| Parse error | "Invalid JSON" | Output did not parse as JSON; impossible under strict |
| Schema violation | "Wrong shape" | Parsed but violated types / required / enum / range |
| `additionalProperties: false` | "No extras allowed" | Forbids unknown fields; required in OpenAI strict |
| Pydantic BaseModel | "Typed output" | Python class that emits and validates JSON Schema |
| Zod schema | "TypeScript output type" | TS runtime schema for provider output validation |
| Grammar enforcement | "Open-weights constrained decode" | FSM-based logit masking, as in outlines / guidance |

## Daha Fazla Okumak

- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) Sıkı mod, reddedilme ve şema gereksinimleri
- [OpenAI — Introducing structured outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) Ağustos 2024'te kodlama garantisi açıklanan başlatma tarihi
- [Pydantic AI — Output](https://ai.pydantic.dev/output/) her sunucuya seriye edilen output_type bağlamaları
- [JSON Schema — 2020-12 release notes](https://json-schema.org/draft/2020-12/release-notes) Kanonik özellik
- [Microsoft — Structured outputs in Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs) Kurumsal dağıtım notları ve sıkı mod uyarıları
