# Paralel Araç Aramaları ve Araçlarla Akışlama

> Üç bağımsız hava durumu bakışları seriye üç dönüş yoludur. Onları paralel olarak çalıştırın ve toplam zaman en yavaş tek çağrıya düşer. Her sınır sağlayıcısı şimdi tek bir dönüşte birden fazla araç çağrısı yayınlar. Ödül gerçek; tesisat inceliktir. Bu ders iki yarıya da geçer: paralel fan-out ve akışlı argüman yeniden birleştirme, id-korrelasyon tuzağına vurgu.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, thread pool + streaming harness)
**Prerequisites:** Phase 13 · 02 (function calling deep dive)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Nedenini açıkla `parallel_tool_calls: true`var ve ne zaman devre dışı bırakılır.
- Geçerli fan-out sırasında akışlı argüman parçalarını doğru araç çağrı kimliğine ilişkilendirin.
- Bölümsel yeniden toplayın `arguments`İpuçları erken analiz etmeden tamamlanmış JSON'a çevirir.
- Üç şehir hava durumu referansını çalıştırın ve sıralı ve paralel gecikme gösterilsin.

## Sorun

Paralel aramalar olmadan, "Bengaluru, Tokyo ve Zürih'te hava nasıl" diye cevap veren bir ajan şöyle yapar:

```
user -> LLM
LLM -> call get_weather(Bengaluru)
host -> run executor, reply with result
LLM -> call get_weather(Tokyo)
host -> run executor, reply with result
LLM -> call get_weather(Zurich)
host -> run executor, reply with result
LLM -> final text answer
```

Üç LLM geri dönüş yolculuğu, her biri de uygulayıcının gecikmesini ödüyor.

Paralel aramalar:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

Bir LLM geri dönüş yolculuğu. İcra süresi toplam değil, üçünün en iyisidir. OpenAI, Anthropic ve Gemini'deki üretim referansları fan-out iş yüklerinde %60 ila 70% duvar saati azaltmayı gösterir.

Üç çağrı tamamlandığında sonuçlarınız eşleşmeyi taşımalıdır.`tool_call_id`Gemini 3'ün gerçek dünyadaki bir sorunun çözülmesi için benzersiz kimlikler ekledi.

## Anlaşım

### paralelliği sağlayan

- **OpenAI.** `parallel_tool_calls: true`Öntanımlı olarak açıldı.`false`Seri zorlama.
- **Anthropic.**Dönüştürme yoluyla`disable_parallel_tool_use: false`(Standard Claude 3.5 ve üstü) ayar `true`Seri için.
- **Gemini.**Her zaman paralel olabilir .`tool_config.function_calling_config.mode = "AUTO"`model karar versin.

Araçların sıralama bağımlılıkları olduğunda paralelleri devre dışı bırak (`create_file`O zaman ...`write_file`), bir çağrının çıkışı diğerinin girişini bilgilendirdiğinde veya hız sınırlayıcı fan-out'u idare edemediğinde.

### İd ilişkisi

Model gönderdiği her çağrıda bir `id`Ev sahibi gönderdiği her sonuç aynı kimliği içermelidir.

- **OpenAI.** `tool_call_id`Her araç rolü mesajında.
- **Anthropic.** `tool_use_id`Her birinde`tool_result`- Blok.
- **Gemini.** `id`Her birinde`functionResponse`(Gemini 3 ve üst; Gemini 2 isimle eşleşirken aynı isimli paralel aramalar için kırıldı).

### Aynı anda aramalar yapılıyor

Ev sahibi her çağrı icracı'nı kendi ip, coroutine veya uzaktan çalışan üzerinde çalıştırır. En basit harness bir ip havuzu kullanır; üretim asyncio ile `asyncio.gather`Tamamlama sırası öngörülemez  kimlik tanımlayıcıdır.

Genel bir hata: cevaplama sonuçları, tamamlama sırası yerine çağrı listesi sırası ile. Bu genellikle çalışır çünkü model sadece `tool_call_id`, ama bir sonuç düşürülürse veya çoğaltılırsa, sonuçlar gelen sıradan uzaklaştırılmış bir cevap listesi, boşluğu günlüklerde bulmakta zorlaşır. Açık tanımlarla tamamlama sırasıyla cevap vermek tercih edilir.

### Akış araç çağrıları

Model akışlar sırasında,`arguments`Üç paralel arama için üç parça akışları telde birbirine karışır.

Sağlayıcıya göre şekli:

- **OpenAI.**Her parça `choices[0].delta.tool_calls[i].function.arguments`(Bölüm akrabası)`index`(Çalışmalar listesinde konum) İndeks başına biriktirir, oku `id`ilk kez görüntülene kadar ve JSON'u analiz ederken`finish_reason = "tool_calls"`- Evet .
- **Anthropic.**Akış olayları `message_start`Sonra bir tane .`content_block_start`Tip ile blok başına `tool_use`(İsim, isim, boş giriş içerir). `content_block_delta`olaylar `input_json_delta`- Çubuklar.`content_block_stop`Her blokunu kapatıyor.
- **Gemini.** `streamFunctionCallArguments`(Gemini 3 ve üstü) bir `functionCallId`Gemini 3'den önce akışlar bir seferde bir arama geri gönderdi.

### kısmi JSON ve analiz- erken tuzağı

Anlamıyorsun .`arguments`Bu, tamamlanana kadar.`{"city": "Beng`Doğru kapı, sunucu tarafından gönderilen arama sonu sinyalidir: OpenAI'nin `finish_reason = "tool_calls"`, Anthropic's `content_block_stop`...veya Geminin akış sonu olayı.`json.loads`Daha güçlü bir yaklaşım, yapı tamamlandığında olayları üreten bir eksel JSON analizcisi kullanır; OpenAI'nin akış rehberliği bunu canlı bir "düşünme" göstergesi gösteren UX için önerir. Brace sayımı bir tamamlayıcılık testi olarak güvenilir değildir (sıkı alıntılı dizileri içindeki braces veya kaçan içerik yanlış pozitif neden olur) ve sadece bir resmi hata defektörü heuristik olarak kullanılmalıdır.

### Sipariş dışı tamamlama

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

Ev sahibi cevap yine de kimliklerini belirtmelidir:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

Yanıtdaki sipariş, OpenAI veya Anthropic'de doğruluk için önemli değildir.

### Benchmark: sıralı vs paralel

- Kırmızı .`code/main.py`400, 600 ve 800 ms gecikme ile üç uygulayıcı simüle eder. Sequential onu toplam 1800 ms ile çalışır. Paralel olarak maksimum 400, 600, 800) = 800 ms ile çalışır. Fark sabit, orantısızdır, bu nedenle tasarruf araç sayısıyla birlikte büyür.

Gerçek dünya uyarısı: paralel aramalar aşağı akıntılı API'leri strese düşürür. Tarif sınırlı bir hizmet için 10 yönlü bir fan-out başarısız olur. 13 · 17 aşaması geçit seviyesindeki geri baskıyı kapsar; gelecek aşama için tekrar semantik deneyin planlanıyor.

### Akıştı fan-out duvar saati

Eğer model kendi akışlar ise, tüm aramaların tamamlanmasını beklemek yerine, bir çağrı argümanları tamamlandığında çalışmaya başlayabilirsiniz. Bu bir optimizasyon OpenAI belgeleri ama tüm SDK'ler ortaya çıkarmaz. Bu dersdeki harness bunu yapar: simülasyon akışı tam bir argüman nesnesini verdiğinde, ev sahibi bu çağrıyı başlatır.

```figure
tp-parallel-fanout
```

## Kullan

`code/main.py`İlk üç simülasyonlu hava çağrısı kullanılarak sıradan ve paralel olarak çalışır.`concurrent.futures.ThreadPoolExecutor`İkinci yarıda sahte bir akış tepkisi tekrarlanıyor.`arguments` bir akışta birbirine geçiyor ve her bir ID ile yeniden birleştirir`StreamAccumulator`- Yüksek lisans yok, ağ yok, sadece yeniden monte edilme mantığı.

Neye bakılır:

- Sıradan zamanlayıcı 1.8 saniye, paralel zamanlayıcı 0.8 saniye aynı sahte gecikmelerde.
- Akkumülatör, her çağrının JSON'u tamamlandığında sadece bir kimlik için tamponlama yaparak ve analiz ederek düzensiz gelen parçaları ele alır.
- İd argümanları biterken, tüm akışlar biterken değil.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-parallel-call-safety-check.md`. Bir araç rejistrisini göz önüne alarak, hangi araçların paralelleştirilmesi güvenli, hangi araçların sipariş bağımlılıkları olduğu ve aşağıdaki oran sınırlarını aşacak becerileri denetleme  her araçla birlikte gözden geçirilmiş bir kayıt iade etmek `parallel_safe`Bayraklar.

## Egzersizler

1. Çık .`code/main.py`paralel-sökensel oranın yaklaşık olarak `max/sum`(gerçek çalışmalar, ip programlaması, serileşme ve harness overhead nedeniyle idealden biraz sapmaktadır). Hangi gecikme dağılımında paralel çalışmayı durdurur?

2. Akkumaylateri, tamponu düşürerek ve bir `cancelled`Bu davayı açıkça hangi tedarikçi belgeledi?`content_block_stop`Semantik ve OpenAI'nin `finish_reason: "length"`davranış.

3. İçeği  ile değiştirin .`asyncio.gather`Async'de küçük kazançlar görmelisin çünkü bağlam değiştirme maliyeti daha düşük, ama sadece uygulayıcılar gerçek I/O yaparsa.

4. İki alet seçin ki paralelleşmemeleri gerekir (örneğin `create_file`O zaman ...`write_file`  Ekle`ordering_dependency`Bu, gelecekte ajan mühendisliği aşamasında resmileştirilen bağımlılık bilincili programlama için en az makinedir.

5. OpenAI'nin paralel fonksiyon çağrıları bölümünü ve Anthropic'in `disable_parallel_tool_use`Antropic paralelliği devre dışı bırakmayı önerdiği tek gerçek dünya araç türünü belirleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Parallel tool calls | "Fan-out in one turn" | Model emits multiple tool calls in a single assistant message |
| `parallel_tool_calls` | "OpenAI's flag" | Enable or disable multi-call emission |
| `disable_parallel_tool_use` | "Anthropic's inverse" | Opt-out flag; default is parallel enabled |
| Tool call id | "Correlation handle" | Per-call identifier the result message must echo |
| Accumulator | "Stream buffer" | Per-id string buffer for partial `arguments` chunks |
| Out-of-order completion | "Fastest first" | Parallel calls finish in unpredictable order; ids are the glue |
| Dependency graph | "Ordering constraints" | Tools whose outputs feed into inputs of other tools; cannot parallelize |
| Parse-early trap | "JSON.parse exploded" | Attempting to parse an incomplete `arguments` string |
| `streamFunctionCallArguments` | "Gemini 3 feature" | Streamed argument chunks with unique id per call |
| Completion-order reply | "Don't wait for all" | Reply with results as they arrive, keyed by id |

## Daha Fazla Okumak

- [OpenAI — Parallel function calling](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) Varsayılan davranış ve seçme bayrağı
- [Anthropic — Parallel tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use) `disable_parallel_tool_use`ve sonuç serileme
- [Google — Gemini function calling parallel section](https://ai.google.dev/gemini-api/docs/function-calling) Gemini 3'den id ile ilgili paralel aramalar
- [OpenAI — Streaming responses with tools](https://platform.openai.com/docs/api-reference/responses-streaming) OpenAI akışları için parçalara ayrılmış argüman yeniden birleştirilmesi
- [Anthropic — Streaming messages](https://docs.anthropic.com/en/api/messages-streaming) `content_block_delta`- Evet .`input_json_delta`
