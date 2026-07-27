# İşlev Çağrısı Derinlemesine İnceleme — OpenAI, Anthropic, Gemini

> Üç sınır sağlayıcı, 2024'te aynı araç çağrısı döngüsünde birleşti ve ardından diğer her konuda ayrıldı. OpenAI, `tools` ve `tool_calls`'yi kullanır. Anthropic, `tool_use` ve `tool_result` bloklarını kullanır. Gemini, `functionDeclarations` ve benzersiz kimlik korelasyonunu kullanır. Bu ders, üçünü yan yana ayırır, böylece tek bir sağlayıcıya gönderilen kod, onu taşıdığınızda bozulmaz.

**Tür:** Yapım
**Diller:** Python (stdlib, şema çeviricileri)
**Önkoşullar:** Aşama 13 · 01 (araç arayüzü)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- OpenAI, Anthropic ve Gemini işlev çağırma yükleri arasındaki üç şekil farkını belirtin (bildirim, çağrı, sonuç).
- Bir araç bildirimini üç sağlayıcı formatının tümüne çevirin ve katı mod kısıtlamalarının nerede farklılık göstereceğini tahmin edin.
- Araç çağrılarını zorlamak, yasaklamak veya otomatik seçmek için her sağlayıcıda `tool_choice` kullanın.
- Sağlayıcı başına sabit sınırları (araç sayısı, şema derinliği, bağımsız değişken uzunluğu) ve sınırlar ihlal edildiğinde her birinin yaydığı hata imzalarını öğrenin.

## Sorun

İşlev çağırma isteğinin şekli sağlayıcıya göre farklılık gösterir. 2026 üretim yığınından üç somut örnek:

**OpenAI Sohbet Tamamlamaları/Yanıtları API'si.** `tools: [{type: "function", function: {name, description, parameters, strict}}]`'yi geçersiniz. Modelin yanıtı `choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`'yi içerir; burada `arguments`, ayrıştırmanız gereken bir JSON dizesidir. Katı mod (`strict: true`), kısıtlı kod çözme yoluyla şema uyumluluğunu zorunlu kılar.

**Anthropic Mesajlar API'si.** `tools: [{name, description, input_schema}]`'yi geçersiniz. Yanıt `content: [{type: "text"}, {type: "tool_use", id, name, input}]` olarak geri geliyor. `input` zaten ayrıştırılmıştır (bir dize değil, bir nesne). `{type: "tool_result", tool_use_id, content}` bloğu içeren yeni bir `user` mesajıyla yanıt verirsiniz.

**Google Gemini API.** `tools: [{functionDeclarations: [{name, description, parameters}]}]`'yi (`functionDeclarations` altında yuvalanmış) geçersiniz. Yanıt `candidates[0].content.parts: [{functionCall: {name, args, id}}]` olarak gelir; burada `id`, paralel çağrı korelasyonu için Gemini 3 ve üzeri sürümlerde benzersizdir. `{functionResponse: {name, id, response}}` ile yanıt veriyorsunuz.

Aynı döngü. Farklı alan adları, farklı iç içe yerleştirme, farklı dize-nesne kuralları, farklı korelasyon mekanizmaları. OpenAI'de agent hava durumu yazan bir ekip, sadece tesisat için Anthropic'e iki günlük bir liman ve Gemini'ye bir gün daha ödüyor.

Bu ders, üç formatı tek bir kurallı araç bildiriminde birleştiren ve uçta yönlendiren bir çevirici oluşturur. Aşama 13 · 17, aynı modeli bir LLM ağ geçidine genelleştirir.

## Konsept

### Ortak yapı

Her sağlayıcının beş şeye ihtiyacı vardır:

1. **Araç listesi.** Araç başına ad, açıklama ve giriş şeması.
2. **Araç seçimi.** Belirli bir aracı zorlayın, araçları yasaklayın veya kararı modele bırakın.
3. **Çağrı emisyonu.** Aracı ve bağımsız değişkenleri adlandıran yapılandırılmış çıktı.
4. **Çağrı kimliği.** Yanıtı doğru çağrıyla ilişkilendirin (paralellik önemlidir).
5. **Sonuç ekleme.** Sonucu tekrar aramaya bağlayan bir mesaj veya blok.

### Şekil farklılıkları, alan bazında

| Görünüş | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Beyan zarfı | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Şema alanı | `parameters` | `input_schema` | `parameters` |
| Yanıt kapsayıcısı | Asistan mesajında ​​`tool_calls[]` | `content[]` türü `tool_use` | `functionCall` tipi `parts[]` |
| Bağımsız değişken türü | telli JSON | ayrıştırılmış nesne | ayrıştırılmış nesne |
| Kimlik formatı | `call_...` (OpenAI oluşturur) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Sonuç bloğu | rolü `tool`, `tool_call_id` | `user` ile `tool_result`, `tool_use_id` | `functionResponse` ile eşleşen `id` |
| Bir aleti zorla | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Araçları yasakla | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Katı şema | `strict: true` | şema-şemadır (her zaman uygulanır) | `responseSchema` istek düzeyinde |

### Gerçekte ulaşacağınız sınırlar

- **OpenAI.** İstek başına 128 araç. Şema derinliği 5. Bağımsız değişken dizesi <= 8192 bayt. Katı mod, `$ref` gerektirmez, örtüşmeli `oneOf`/`anyOf`/`allOf` gerektirmez; tüm özellikler `required`'de listelenir.
- **Anthropic.** İstek başına 64 araç. Şema derinliği etkili bir şekilde sınırsızdır ancak pratik sınır 10'dur. Sıkı mod işareti yoktur; şema bir sözleşmedir ve model buna uyma eğilimindedir.
- **Gemini.** İstek başına 64 işlev. Şema türleri OpenAPI 3.0 alt kümesidir (JSON Schema 2020-12'den biraz farklıdır). Paralel, Gemini 3'ten bu yana benzersiz kimliği çağırıyor.

### `tool_choice` davranışı

Herkesin desteklediği, farklı adlara sahip üç mod.

- **Oto.** Model, aracı veya metni seçer. Varsayılan.
- **Gerekli / Herhangi biri.** Model en az bir aracı çağırmalıdır.
- **Yok.** Model araçları çağırmamalıdır.

Ayrıca her sağlayıcıya özel bir mod:

- **OpenAI.** Belirli bir aracı ada göre zorlayın.
- **Anthropic.** Belirli bir aracı ismine göre zorlayın; `disable_parallel_tool_use` bayrağı tekli ile çokluyu ayırır.
- **Gemini.** `mode: "VALIDATED"`, modelin amacına bakılmaksızın her yanıtı bir şema doğrulayıcı aracılığıyla yönlendirir.

### Paralel çağrılar

OpenAI'nin `parallel_tool_calls: true` (varsayılan) özelliği tek bir asistan mesajında birden fazla çağrı gönderir. Hepsini çalıştırırsınız ve `tool_call_id` başına bir giriş içeren toplu bir araç rolü mesajıyla yanıt verirsiniz. Anthropic tarihsel olarak tek arama yaptı; `disable_parallel_tool_use: false` (Claude 3.5'ten itibaren varsayılan) çoklu özelliği etkinleştirir. Gemini 2 paralel çağrılara izin verdi ancak kararlı kimlikler vermedi; Gemini 3, sıra dışı yanıtların temiz bir şekilde ilişkilendirilmesi için UUID'ler ekler.

### Akış

Üçü de akışlı araç çağrılarını destekler. Tel formatı farklıdır:

- **OpenAI.** `tool_calls[i].function.arguments`'nin delta parçaları artımlı olarak gelir. `finish_reason: "tool_calls"`'ye kadar biriktirirsiniz.
- **Anthropic.** Blok başlatma / blok delta / blok durdurma olayları. `input_json_delta` parçaları kısmi argümanlar taşır.
- **Gemini.** `streamFunctionCallArguments` (Gemini 3'te yeni), birden fazla paralel çağrının araya girebilmesi için `functionCallId` ile parçalar yayar.

Aşama 13 · 03, paralel + akışın yeniden birleştirilmesinin derinliklerine iniyor. Bu ders bildirime ve tek çağrı şekillerine odaklanmaktadır.

### Hatalar ve onarım

Geçersiz argüman hataları da farklı görünüyor.

- **OpenAI (katı olmayan).** Model, `arguments: "{bad json}"` değerini döndürür, JSON ayrıştırmanız başarısız olur, bir hata mesajı ekler ve yeniden ararsınız.
- **OpenAI (katı).** Doğrulama, kod çözme sırasında gerçekleşir; geçersiz JSON mümkün değildir ancak `refusal` görünebilir.
- **Anthropic.** `input` beklenmeyen alanlar içerebilir; şema tavsiye niteliğindedir. Sunucu tarafını doğrulayın.
- **Gemini.** OpenAPI 3.0 tuhaflığı: Nesne alanlarındaki `enum` sessizce göz ardı edildi; kendinizi doğrulayın.

### Çevirmen modeli

Kodunuzdaki kurallı bir araç bildirimi şuna benzer (şekli siz seçersiniz):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

Üç küçük işlev, bunu üç sağlayıcı şekline çevirir. `code/main.py`'deki donanım tam olarak bunu yapıyor ve ardından her sağlayıcının yanıt şekli aracılığıyla sahte bir araç çağrısına gidiş dönüş yapıyor. Ağ gerekmez; bu ders HTTP'yi değil şekilleri öğretir.

Üretim ekipleri bu çeviriciyi `AbstractToolset` (Pydantic AI), `UniversalToolNode` (LangGraph) veya `BaseTool` (LlamaIndex) ile paketliyor. Aşama 13 · 17, üçünden herhangi birinin önünde OpenAI şeklindeki bir API'yi ortaya çıkaran bir ağ geçidi gönderir.

## Kullan onu

`code/main.py`, bir kanonik `Tool` veri sınıfını ve OpenAI, Anthropic ve Gemini bildirimi JSON'u yayan üç çeviriciyi tanımlar. Daha sonra her şeklin el yapımı sağlayıcı yanıtını aynı kanonik çağrı nesnesine ayrıştırarak anlambilimin görünüm altında aynı olduğunu gösterir. Çalıştırın ve üç bildirimi yan yana ayırın.

Neye bakmalı:

- Üç bildirim bloğu yalnızca zarf ve alan adlarında farklılık gösterir.
- Üç yanıt bloğu, çağrının yaşadığı yere göre farklılık gösterir (üst düzey `tool_calls`, `content[]` bloğu, `parts[]` girişi).
- Bir `canonical_call()` işlevi, `{id, name, args}`'yi üç yanıt şeklinin hepsinden çıkarır.

## Gönderin

Bu ders `outputs/skill-provider-portability-audit.md`'yi üretir. Bir sağlayıcıya karşı işlev çağıran entegrasyon göz önüne alındığında, beceri bir taşınabilirlik denetimi üretir: hangi sağlayıcının sınırladığı, hangi alanların yeniden adlandırılması gerektiği ve başka bir sağlayıcıya aktarıldığında neyin bozulduğu.

## Egzersizler

1. `code/main.py`'yi çalıştırın ve üç sağlayıcı bildirimi JSON'unun hepsinin aynı temel `Tool` nesnesini seri hale getirdiğini doğrulayın. Bir enum parametresi eklemek için kurallı aracı değiştirin ve yalnızca Gemini çevirmeninin OpenAPI tuhaflığını işlemesi gerektiğini doğrulayın.

2. Her sağlayıcı için, bir `list_tools` veya keşif çağrısından sonra bir modelin döndürdüğü araç listesini çıkaran bir `ListToolsResponse` ayrıştırıcı ekleyin. OpenAI'nin yerel olarak bir tane yok; bu asimetriye dikkat edin.

3. `tool_choice` dönüşümünü uygulayın: standart bir `ToolChoice(mode="force", tool_name="x")`'yi üç sağlayıcı şeklinin tümüne eşleyin. Daha sonra `mode="any"` ve `mode="none"`'yi eşleyin. Dersin fark tablosunu kontrol edin.

4. Üç sağlayıcıdan birini seçin ve işlev çağırma kılavuzunu uçtan uca okuyun. Şema spesifikasyonunda diğer ikisinin desteklemediği bir alan bulun. Adaylar: OpenAI `strict`, Anthropic `disable_parallel_tool_use`, Gemini `function_calling_config.allowed_function_names`.

5. Bir test vektörü yazın: bağımsız değişkenleri bildirilen şemayı ihlal eden bir araç çağrısı. Bunu her sağlayıcının doğrulayıcısı aracılığıyla çalıştırın (Ders 01'deki stdlib, proxy görevi görecektir) ve hangi hataların tetiklendiğini kaydedin. Kesinlik açısından üretimde hangi sağlayıcıyı kullanacağınızı belgeleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| İşlev çağırma | "Araç kullanımı" | Yapılandırılmış araç çağrısı emisyonu için sağlayıcı düzeyinde API |
| Takım bildirimi | "Araç özellikleri" | Ad + açıklama + JSON Schema giriş yükü |
| `tool_choice` | "Zorla / yasakla" | Otomatik / gerekli / yok / belirli ad modları |
| Katı mod | "Şema uygulaması" | Kod çözmeyi şemayla eşleşecek şekilde kısıtlayan OpenAI bayrağı |
| `tool_use` blok | "Anthropic'in çağrı şekli" | Kimliği, adı ve girişi olan satır içi içerik bloğu |
| `functionCall` parçası | "Gemini'nin çağrı şekli" | Adı, bağımsız değişkenleri ve kimliği içeren bir `parts[]` girişi |
| Dize olarak bağımsız değişkenler | "Dizeli JSON" | OpenAI, argümanları bir nesne olarak değil, JSON dizesi olarak döndürür |
| Paralel araç çağrıları | "Tek seferde yayma" | Tek bir asistan mesajında ​​birden fazla araç çağrısı |
| Reddetme | "Model reddediliyor" | Çağrı yerine yalnızca katı modda reddetme engellemesi |
| OpenAPI 3.0 alt kümesi | "Gemini şeması tuhaflığı" | Gemini, küçük farklılıklarla JSON-Şema benzeri bir lehçe kullanıyor |

## Daha Fazla Okuma

- [OpenAI — İşlev çağırma kılavuzu](https://platform.openai.com/docs/guides/function-calling) — katı mod ve paralel çağrılar dahil standart referans
- [Anthropic — Araç kullanımına genel bakış](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — `tool_use` ve `tool_result` blok semantiği
- [Google — Gemini işlev çağrısı](https://ai.google.dev/gemini-api/docs/function-calling) — paralel çağrılar, benzersiz kimlikler ve OpenAPI alt kümesi
- [Vertex AI — İşlev çağırma referansı](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) — Gemini'nin kurumsal yüzeyi
- [OpenAI — Yapılandırılmış çıkışlar](https://platform.openai.com/docs/guides/structured-outputs) — katı mod şema uygulama ayrıntıları
