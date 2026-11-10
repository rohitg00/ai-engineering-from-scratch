# Deep Dive Çağrı Fonksiyonu  OpenAI, Anthropic, Gemini

> Üç sınır sağlayıcısı 2024'te aynı araç çağrısı döngüsünde birleşmiş ve sonra diğer her şeyde farklılaşmış.`tools`ve `tool_calls`- Antropik kullanımları`tool_use`ve `tool_result`Gemini kullanıyor.`functionDeclarations`Bu ders üç kodu bir kenara ayırır, böylece bir sunucuya gönderilen kod, onu port ettiğinizde kırılmaz.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, schema translators)
**Prerequisites:** Phase 13 · 01 (the tool interface)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- OpenAI, Anthropic ve Gemini fonksiyon çağıran payloadlar (deklarasyon, çağrı, sonuç) arasındaki üç şekil farkını belirtin.
- Üç sunucu biçimi boyunca bir araç açıklamasını çevirin ve sıkı mod kısıtlamalarının farklılık göstereceği yerleri tahmin edin.
- Kullanım`tool_choice`Her sağlayıcıda zorla, yasakla veya otomatik olarak araç seçme çağrıları yaptırmak için.
- Her sağlayıcıya göre sert sınırları (örnek sayısı, şema derinliği, argüman uzunluğu) ve sınırların ihlal edildiğinde her birinin yaydığı hata imzalılarını bil.

## Sorun

İşlev çağrısı talebinin şekli, tedarikçiye göre farklıdır. 2026 üretim aşamalarından üç tane örnek:

**OpenAI Chat Completions / Responses API.**Sen geç .`tools: [{type: "function", function: {name, description, parameters, strict}}]`Modelin yanıtı içerir.`choices[0].message.tool_calls: [{id, type: "function", function: {name, arguments}}]`nerede`arguments`Bu, JSON dizilisi.`strict: true`) kısıtlı dekodlama yoluyla şema uyumluluğunu zorlar.

**Anthropic Messages API.**Sen geç .`tools: [{name, description, input_schema}]`Cevap şu şekilde geliyor:`content: [{type: "text"}, {type: "tool_use", id, name, input}]`- Evet .`input`Yeni bir `user`bir mesaj içeren bir `{type: "tool_result", tool_use_id, content}`- Blok.

**Google Gemini API.**Sen geç .`tools: [{functionDeclarations: [{name, description, parameters}]}]`(Yatağı altında `functionDeclarations`) Cevap şu şekilde geliyor:`candidates[0].content.parts: [{functionCall: {name, args, id}}]`nerede`id`İkizler 3 ve yukarıdaki paralel çağrı ilişkisi için benzersiz.`{functionResponse: {name, id, response}}`- Evet .

Aynı döngü. Farklı alan isimleri, farklı yuvalamalar, farklı ipler karşı nesne konvansiyonları, farklı ilişki mekanizmaları. OpenAI'de bir hava ajanı yazmış bir ekip, tesisat için Anthropic'e iki günlük bir liman ödemiş ve diğer gün Gemini'ye ödemiş.

Bu ders, üç formatı tek bir kanonik araç açıklaması ve kenardaki yollara birleştiren bir çevirmen oluşturur.

## Anlaşım

### Ortak yapı

Her sağlayıcı beş şeye ihtiyaç duyar:

1. **Tool list.**Araç başına isim, açıklama ve giriş şeması.
2. **Tool choice.**Belirli bir alet zorla kullanın, aletleri yasaklayın veya modelin karar vermesine izin verin.
3. **Call emission.**Araç ve argümanların isimlendirilmesi için yapılandırılmış çıkış.
4. **Call id.**Yanıt doğru çağrı ile ilişkilendir (parallel konular).
5. **Result injection.**Sonuçla görüşme bağlayan bir mesaj veya blok.

### Şekil farklılıkları, alanlar alanlar

| Aspect | OpenAI | Anthropic | Gemini |
|--------|--------|-----------|--------|
| Declaration envelope | `{type: "function", function: {...}}` | `{name, description, input_schema}` | `{functionDeclarations: [{...}]}` |
| Schema field | `parameters` | `input_schema` | `parameters` |
| Response container | `tool_calls[]` on assistant message | `content[]` of type `tool_use` | `parts[]` of type `functionCall` |
| Arguments type | stringified JSON | parsed object | parsed object |
| Id format | `call_...` (OpenAI generates) | `toolu_...` (Anthropic) | UUID (Gemini 3+) |
| Result block | role `tool`, `tool_call_id` | `user` with `tool_result`, `tool_use_id` | `functionResponse` with matching `id` |
| Force-a-tool | `tool_choice: {type: "function", function: {name}}` | `tool_choice: {type: "tool", name}` | `tool_config: {function_calling_config: {mode: "ANY"}}` |
| Forbid tools | `tool_choice: "none"` | `tool_choice: {type: "none"}` | `mode: "NONE"` |
| Strict schema | `strict: true` | `strict: true` per tool (opt-in) | `responseSchema` at request level |

### Gerçekten bulacağın sınırlar

- **OpenAI.**128 araç talep başına. Şema derinliği 5. Argument dizilisi <= 8192 byte.`$ref`Hayır .`oneOf`- Ne ?`anyOf`- Ne ?`allOf``required`- Evet .
- **Anthropic.**Bu nedenle, bu konularda, düzenli olarak ve düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak ve düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli olarak, düzenli`strict: true`Bu sistem olmadan, şema, modelin takip etme eğiliminde olduğu bir sözleşmedir, bir garanti değil.
- **Gemini.**İsteğe göre 64 işlev. Şema türleri OpenAPI 3.0 alt kümesidir (JSON Şema 2020-12) paralel çağrılar eşsiz kimliklerden Gemini 3'den beri.

### `tool_choice`davranış

Herkesin desteklediği üç mod, farklı isimlendirilmiş.

- **Auto.**Model araç veya metin seçer.
- **Required / Any.**Model en az bir alet çağırmalıdır.
- **None.**Model alet çağırmamalı.

Her sunucu için özel bir mod:

- **OpenAI.**Adıyla belirli bir alet zorla.
- **Anthropic.**Adıyla belirli bir alet zorla .`disable_parallel_tool_use`Bayrak tek ve çok kişiyi ayırır.
- **Gemini.** `mode: "VALIDATED"`model niyetinden bağımsız olarak her cevabı bir schema doğrulayıcısı üzerinden yönlendirir.

### Dönüş çağrılar

OpenAI'nin `parallel_tool_calls: true`(devayla) bir asistan mesajında birden fazla arama gönderir.`tool_call_id`- Antropik tarihsel olarak tek çağrı yaptı .`disable_parallel_tool_use: false`Gemini 2 paralel aramalara izin verdi ancak sabit kimlikler vermedi; Gemini 3 UUID'leri ekler, böylece sıradan cevaplar temiz bir şekilde ilişkilendirilir.

### Akış

Üç de destek akış aracı çağrıları.

- **OpenAI.**Delta parçaları`tool_calls[i].function.arguments`Aradan artarak gelir.`finish_reason: "tool_calls"`- Evet .
- **Anthropic.**Blok başlangıç / blok delta / blok durma olayları. `input_json_delta`Parçalıklar kısmi argümanlar taşır.
- **Gemini.** `streamFunctionCallArguments`(Yeni Gemini 3) bir `functionCallId`Böylece çok sayıda paralel aramalar birbirine geçebilir.

13 · 03 aşaması paralel + akış yeniden birleştirme üzerine derinlemesine gider. Bu ders, açıklama ve tek çağrı şekillerine odaklanır.

### Hatalar ve onarım

Geçersiz argüman hataları da farklı görünüyor.

- **OpenAI (non-strict).**Model ödevleri `arguments: "{bad json}"`JSON analiziniz başarısız olursa hata mesajı enjekte eder ve tekrar ararsınız.
- **OpenAI (strict).**Deşifreleme sırasında doğrulama gerçekleşir; geçersiz JSON imkansızdır ama `refusal`- Görebilir.
- **Anthropic (non-strict).** `input`Bu, beklenmedik alanlar içerebilir; şema tavsiyeci.`strict: true`, örnekleme şema ile sınırlıdır.
- **Gemini.**OpenAPI 3.0 garipliği: `enum`Sessizce görmezden gelen nesne alanlarında; kendinizi doğrulayın.

### Tercüman örneği

Kodunuzdaki kanonik bir araç açıklaması şöyle görünüyor (şekili seçersiniz):

```python
Tool(
    name="get_weather",
    description="Use when ...",
    input_schema={"type": "object", "properties": {...}, "required": [...]},
    strict=True,
)
```

Üç küçük işlev onu üç sunucu şekline çevirir.`code/main.py`Bu ders, HTTP değil şekilleri öğretir.

Üretim ekibi bu tercümeyi `AbstractToolset`(Pydantik AI),`UniversalToolNode`(LangGraph), veya `BaseTool`(LlamaIndex). 13 · 17 aşaması, üçten herhangi birinin önünde OpenAI şeklinde bir API'yi ortaya çıkaran bir geçit gönderir.

```figure
function-call-args
```

## Kullan

`code/main.py`Kanonik bir tanımlar `Tool`Dataclass ve OpenAI, Anthropic ve Gemini deklarasyonlarını yayımlayan üç çevirmen. Daha sonra her şekilden bir el yapımı sunucu cevabını aynı kanonik çağrı nesneye analiz ederek semantiklerin cilt altında aynı olduğunu gösterir.

Neye bakılır:

- Üç açıklama blokunun farkı sadece zarf ve alan isimleri ile ilgilidir.
- Üç yanıt blokunun çağrıda bulunduğu yerlerde farklılıkları vardır (üst düzeyde `tool_calls`- Evet .`content[]`blok,`parts[]`Giriş).
- Bir tane .`canonical_call()`fonksiyon çekimleri `{id, name, args}`Bu üç tepki şeklini de.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-provider-portability-audit.md`. Bir hizmet sağlayıcısına karşı bir fonksiyon çağrısı entegrasyonu göz önüne alındığında, yetenek taşınabilirlik denetimi oluşturur: hangi hizmet sağlayıcısına güvendiği sınırları, hangi alanların yeniden adlandırılması gerektiği ve diğer hizmet sağlayıcılara aktarıldığında neyin kırıldığını.

## Egzersizler

1. Çık .`code/main.py`ve üç sunucu açıklaması JSON'larının hepsi aynı altta yatanı serilize ettiğini kontrol et`Tool`Enum parametre eklemek için kanonik aracı değiştirin ve sadece Gemini çevirmeni OpenAPI tuhaflığını işlemek için gerekli olduğunu onaylayın.

2. Bir ekle`ListToolsResponse`araç listesini çeken her tedarikçi için bir model bir `list_tools`OpenAI'nin doğuştan bir tane yok; bu asimetriyi dikkat edin.

3. Uygulama`tool_choice`dönüşüm: bir kanonik haritası`ToolChoice(mode="force", tool_name="x")`- Sonra harita yap.`mode="any"`ve `mode="none"`Dersin fark tablosuna bak.

4. Üç sağlayıcıdan birini seçin ve fonksiyon çağrısı rehberini sonuna kadar okuyun. Diğer iki desteklemeyen bir alanın schema özelliklerinde bulun.`strict`, Anthropic `disable_parallel_tool_use`, İkizler `function_calling_config.allowed_function_names`- Evet .

5. Test vektörü yazın: argümanları açıklanan şemayı ihlal eden bir araç çağrısı. Her sağlayıcı'nın onaylayıcıyı çalıştırın (Lection 01'deki stdlib bir vektor olarak çalışır) ve hangi hataları ateşleyin kaydetin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Function calling | "Tool use" | Provider-level API for structured tool-call emission |
| Tool declaration | "Tool spec" | Name + description + JSON Schema input payload |
| `tool_choice` | "Force / forbid" | Auto / required / none / specific-name modes |
| Strict mode | "Schema enforcement" | OpenAI flag that constrains decoding to match schema |
| `tool_use` block | "Anthropic's call shape" | Inline content block with id, name, input |
| `functionCall` part | "Gemini's call shape" | A `parts[]` entry containing name, args, and id |
| Arguments-as-string | "Stringified JSON" | OpenAI returns args as a JSON string, not an object |
| Parallel tool calls | "Fan-out in one turn" | Multiple tool calls in one assistant message |
| Refusal | "Model declines" | Strict-mode-only refusal block instead of a call |
| OpenAPI 3.0 subset | "Gemini schema quirk" | Gemini uses a JSON-Schema-like dialect with minor differences |

## Daha Fazla Okumak

- [OpenAI — Function calling guide](https://platform.openai.com/docs/guides/function-calling) Katı mod ve paralel çağrılar dahil olmak üzere kanonik referans
- [Anthropic — Tool use overview](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) `tool_use`ve `tool_result`blok semantikası
- [Google — Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) paralel çağrılar, benzersiz kimlikler ve OpenAPI alt kümesi
- [Vertex AI — Function calling reference](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/function-calling) Geminin işletme yüzeyi
- [OpenAI — Structured outputs](https://platform.openai.com/docs/guides/structured-outputs) Strik mod şema uygulama detayları
