# Paralel Araç Çağrıları ve Araçlarla Akış

> Serileştirilmiş üç bağımsız hava durumu araması, üç gidiş-dönüş yolculuktur. Bunları paralel olarak çalıştırın ve toplam süre en yavaş tek çağrıya kadar daralır. Artık her sınır sağlayıcı tek seferde birden fazla araç çağrısı yapıyor. Kazanç gerçektir; sıhhi tesisat incelikli. Bu ders her iki yarımı da ele alır: kimlik korelasyon tuzağına vurgu yaparak paralel yayma ve akışlı argümanların yeniden birleştirilmesi.

**Tür:** Yapım
**Diller:** Python (stdlib, iş parçacığı havuzu + akış donanımı)
**Önkoşullar:** Aşama 13 · 02 (derin dalışı çağıran işlev)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- `parallel_tool_calls: true`'nin neden var olduğunu ve ne zaman devre dışı bırakılacağını açıklayın.
- Paralel yayma sırasında akışlı argüman parçalarını doğru araç çağrısı kimliğiyle ilişkilendirin.
- Kısmi `arguments` dizelerini, erken ayrıştırmaya gerek kalmadan tam JSON'a yeniden birleştirin.
- Sıralı ve paralel gecikmeyi gösteren üç şehirli bir hava durumu benchmark çalıştırın.

## Sorun

Paralel çağrılar olmadan, "Bengaluru, Tokyo ve Zürih'te hava nasıl?" diye yanıtlayan bir agent şunu yapar:

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

Her biri aynı zamanda uygulayıcıya gecikme süresi ödeyen üç LLM gidiş-dönüş yolculuğu. İdeal duvar saati süresinin kabaca 4 katı.

Paralel çağrılarla:

```
user -> LLM
LLM -> call get_weather(Bengaluru); call get_weather(Tokyo); call get_weather(Zurich)
host -> run all three executors concurrently, reply with three results
LLM -> final text answer
```

Bir LLM gidiş-dönüş. Yürütücü süresi toplamı değil, üçünün maksimumudur. OpenAI, Anthropic ve Gemini'deki üretim benchmark'ler, yayma iş yüklerinde duvar saatinde yüzde 60 ila 70 azalma gösteriyor.

Fiyat korelasyon karmaşıklığıdır. Üç çağrı hatalı bir şekilde tamamlandığında, modelin bunları sıralayabilmesi için sonuçlarınızın eşleşen `tool_call_id` değerini taşıması gerekir. Sonuçlar akışı sırasında, yürütmeden önce kısmi bağımsız değişken parçalarını tam JSON'da birleştirmeniz gerekir. Gemini 3, aynı araca yapılan iki paralel çağrının birbirinden ayırt edilemediği gerçek dünya sorununu çözmek için kısmen benzersiz kimlikler ekledi.

## Konsept

### Paralel etkinleştiriliyor

- **OpenAI.** `parallel_tool_calls: true` varsayılan olarak açıktır. Seriyi zorlamak için `false`'yi ayarlayın.
- **Anthropic.** `disable_parallel_tool_use: false` aracılığıyla paralel (Claude 3.5 ve üzeri sürümlerde varsayılan). Seri için `true`'yi ayarlayın.
- **Gemini.** Her zaman paralel özellikli; `tool_config.function_calling_config.mode = "AUTO"` modelin karar vermesini sağlar.

Araçların sıralama bağımlılıkları olduğunda (`create_file` ardından `write_file`), bir çağrının çıkışı diğerinin girişini bilgilendirdiğinde veya hız sınırlayıcı yayılmayı yönetemediğinde paraleli devre dışı bırakın.

### Kimlik korelasyonu

Modelin yaptığı her çağrının bir `id`'si vardır. Ana makinenin döndürdüğü her sonuç aynı kimliği içermelidir. Bu olmadan sonuçlar belirsizdir.

- **OpenAI.** Her araç rolü mesajında `tool_call_id`.
- **Anthropic.** Her `tool_result` bloğunda `tool_use_id`.
- **Gemini.** Her `functionResponse`'de `id` (Gemini 3 ve üzeri; aynı adlı paralel aramalar için bozulan isme göre eşleşen Gemini 2).

### Aramaları aynı anda yürütme

Ana bilgisayar, her çağrının yürütücüsünü kendi iş parçacığında, ortak yordamında veya uzak çalışanda çalıştırır. En basit koşum takımı bir iş parçacığı havuzu kullanır; üretim, `asyncio.gather` ile eşzamansız veya yapılandırılmış eşzamanlılık kullanır. Tamamlanma sırası tahmin edilemez; kimlik, tanımlayıcıdır.

Yaygın bir hata: sonuçları tamamlama sırası yerine çağrı listesi sırasına göre yanıtlayın. Bu genellikle işe yarar çünkü model yalnızca `tool_call_id`'yi önemser, ancak bir sonuç bırakılırsa veya kopyalanırsa sıra dışı gönderim hata ayıklamayı zorlaştırır. Açık kimliklerle tamamlanma sırasına göre yanıt vermeyi tercih edin.

### Akış aracı çağrıları

Model yayınlandığında `arguments` parçalar halinde gelir. Üç paralel çağrı için üç ayrı parça akışı kablo üzerinde serpiştirilir. Kimlik başına bir akümülatöre ihtiyacınız var.

Sağlayıcıya göre şekil:

- **OpenAI.** Her parça `choices[0].delta.tool_calls[i].function.arguments`'dir (kısmi dize). Parça `index`'yi (çağrı listesindeki konum) taşır. Dizin başına biriktirirsiniz, ilk göründüğünde `id` okursunuz ve `finish_reason = "tool_calls"` olduğunda JSON'u ayrıştırırsınız.
- **Anthropic.** Akış olayları `message_start`, ardından `tool_use` (kimlik, ad, boş giriş içeren) türüyle blok başına bir `content_block_start`'dir. `content_block_delta` olayları `input_json_delta` parçalarını taşır. `content_block_stop` her bloğu kapatır.
- **Gemini.** `streamFunctionCallArguments` (Gemini 3 ve üstü), `functionCallId` ile parçalar yayar, böylece çağrılar temiz bir şekilde serpiştirilir. Gemini 3'ten önce akış, tek seferde tam bir çağrı döndürüyordu.

### Kısmi JSON ve erken ayrıştırma tuzağı

Tamamlanana kadar `arguments`'yi ayrıştıramazsınız. `{"city": "Beng` gibi kısmi JSON geçerli değil ve yükselecek. Doğru kapı, sağlayıcının çağrı sonu sinyalidir: OpenAI'nin `finish_reason = "tool_calls"`'si, Anthropic'in `content_block_stop`'si veya Gemini'nin yayın sonu etkinliği. Ancak o zaman `json.loads`'yi deneyin. Daha sağlam bir yaklaşım, yapı tamamlandıkça olaylar üreten artımlı bir JSON ayrıştırıcısını kullanır; OpenAI'nin yayın kılavuzu, canlı bir "düşünme" göstergesi gösteren UX için bunu önerir. Parantez sayımı bir bütünlük testi olarak güvenilir değildir (alıntılanan dizelerin içindeki parantezler veya kaçan içerik yanlış pozitiflere neden olur) ve yalnızca resmi olmayan bir hata ayıklama buluşsal yöntemi olarak kullanılmalıdır.

### Sıra dışı tamamlama

```
call_A: fast API, returns first
call_B: slow API, returns second
call_C: median API, returns third
```

Toplantı sahibinin yanıtı yine de kimlikleri belirtmelidir:

```
[{role: "tool", tool_call_id: "call_A", content: ...},
 {role: "tool", tool_call_id: "call_B", content: ...},
 {role: "tool", tool_call_id: "call_C", content: ...}]
```

OpenAI veya Anthropic'te yanıtın sırasının doğruluğu önemli değildir. Gemini, kimlikler eşleştiği sürece her türlü siparişi kabul eder.

### Benchmark: sıralı ve paralel

`code/main.py`'deki donanım, 400, 600 ve 800 ms gecikme süresine sahip üç uygulayıcıyı simüle eder. Sıralı toplamda 1800 ms'de çalıştırır. Paralel, maksimum(400, 600, 800) = 800 ms'de çalıştırır. Fark orantılı değil sabittir, dolayısıyla tasarruflar takım sayısıyla birlikte artar.

Gerçek dünya uyarısı: paralel çağrılar aşağı yöndeki API'leri vurgular. Hızı sınırlı bir hizmete 10 yönlü bir dağıtım başarısız olacaktır. Aşama 13 · 17, ağ geçidi düzeyinde karşı basıncı kapsar; yeniden deneme semantiği gelecekteki bir aşama için planlanmıştır.

### Yayın yaymalı duvar saati

Modelin kendisi akış yapıyorsa, tüm çağrıların sonuçlanmasını beklemek yerine, bir çağrının bağımsız değişkenleri tamamlanır tamamlanmaz yürütmeye başlayabilirsiniz. Bu, OpenAI belgelerinin bir optimizasyonudur ancak tüm SDK'ların ortaya koymadığı bir optimizasyondur. Bu dersteki donanım bunu yapıyor: simüle edilen akış tam bir argüman nesnesi sağladığında, ana bilgisayar bu çağrıyı başlatır.

## Kullan onu

`code/main.py`'nin iki yarısı vardır. İlki, `concurrent.futures.ThreadPoolExecutor` kullanarak üç simüle edilmiş hava durumu çağrısını sırayla ve paralel olarak çalıştırır ve duvar saati zamanını yazdırır. İkinci yarı, sahte bir akış yanıtını (bir akışta serpiştirilmiş üç paralel çağrı için `arguments` parçaları) yeniden oynatır ve bunları kimlik başına `StreamAccumulator` ile yeniden birleştirir. LLM yok, ağ yok, yalnızca yeniden birleştirme mantığı var.

Neye bakmalı:

- Sıralı zamanlayıcı 1,8 saniyeye ulaşır. Paralel zamanlayıcı aynı sahte gecikmelerde 0,8 saniyeye ulaşıyor.
- Akümülatör, sıra dışı gelen parçaları, kimlik başına ara belleğe alarak ve yalnızca her çağrının JSON'u tamamlandığında ayrıştırarak yönetir.
- Yürütücü, tüm akışlar sona erdikten sonra değil, bir kimliğin argümanları tamamlanır tamamlanmaz başlar.

## Gönderin

Bu ders `outputs/skill-parallel-call-safety-check.md`'yi üretir. Bir araç kaydı verildiğinde beceri, hangi araçların paralelleştirilmesinin güvenli olduğunu, hangilerinin sıralama bağımlılıklarına sahip olduğunu ve hangilerinin aşağı akış hız sınırlarını aşacağını denetler ve araç başına `parallel_safe` işaretleriyle revize edilmiş bir kayıt döndürür.

## Egzersizler

1. `code/main.py`'yi çalıştırın ve simüle edilen gecikme sürelerini değiştirin. Paralel-sıralı oranının yaklaşık `max/sum` olduğunu doğrulayın (gerçek çalıştırmalar iş parçacığı planlama, serileştirme ve donanım ek yükü nedeniyle idealden biraz sapar). Hangi gecikme dağılımında paralelin önemi sona erer?

2. Akümülatörü, arabelleğini bırakarak ve bir `cancelled` olayı yayınlayarak "çağrı akışın ortasında iptal edildi" durumunu ele alacak şekilde genişletin. Hangi sağlayıcı bu durumu açıkça belgeliyor? Anthropic'in `content_block_stop` semantiğini ve OpenAI'nin `finish_reason: "length"` davranışını kontrol edin.

3. İş parçacığı havuzunu `asyncio.gather` ile değiştirin. Benchmark her ikisi de. Bağlam değiştirme maliyetinin düşük olması nedeniyle eşzamansız durumda küçük kazançlar görmelisiniz, ancak bu yalnızca uygulayıcıların gerçek G/Ç yapması durumunda gerçekleşir.

4. Paralelleştirilmemesi gereken iki takım seçin (e.g. `create_file` ve ardından `write_file`). Kayıt defterine bir `ordering_dependency` grafiği ekleyin ve bu grafikteki paralel yayılımı kapatın. Bu, gelecekteki bir agent mühendislik aşamasının resmileştireceği, bağımlılığa duyarlı planlama için minimum makinedir.

5. OpenAI'nin paralel işlev çağırma bölümünü ve Anthropic'in `disable_parallel_tool_use` belgelerini okuyun. Anthropic'in paralelliğin devre dışı bırakılmasını önerdiği tek gerçek araç türünü belirleyin. (İpucu: aynı kaynakta sonuç olarak meydana gelen mutasyonlar.)

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Paralel araç çağrıları | "Tek seferde yayma" | Model, tek bir asistan mesajında ​​birden fazla araç çağrısı yapıyor |
| `parallel_tool_calls` | "OpenAI'nin bayrağı" | Çoklu çağrı emisyonunu etkinleştirme veya devre dışı bırakma |
| `disable_parallel_tool_use` | "Anthropic'in tersi" | Devre dışı bırakma bayrağı; varsayılan olarak paralel etkindir |
| Araç çağrı kimliği | "Korelasyon tanıtıcısı" | Arama başına tanımlayıcı, sonuç mesajının yankılanması gerekir |
| Akümülatör | "Akış arabelleği" | Kısmi `arguments` parçaları için kimlik başına dize arabelleği |
| Sıra dışı tamamlama | "Önce en hızlı" | Paralel aramalar öngörülemeyen bir sırayla tamamlanır; kimlikler yapıştırıcıdır |
| Bağımlılık grafiği | "Sıralama kısıtlamaları" | Çıktıları diğer araçların girdilerini besleyen araçlar; paralelleştirilemiyor |
| Ayrıştırma-erken tuzak | "JSON.parse patladı" | Eksik bir `arguments` dizesi ayrıştırılmaya çalışılıyor |
| `streamFunctionCallArguments` | "Gemini 3 özelliği" | Çağrı başına benzersiz kimliğe sahip akışlı argüman parçaları |
| Tamamlama emri yanıtı | "Hepsini beklemeyin" | Sonuçlar geldiğinde, kimliğe göre anahtarlanmış şekilde yanıtlayın |

## Daha Fazla Okuma

- [OpenAI — Paralel işlev çağrısı](https://platform.openai.com/docs/guides/function-calling#parallel-function-calling) — varsayılan davranış ve devre dışı bırakma bayrağı
- [Anthropic — Araç kullanımı: araç kullanımının uygulanması](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implementing-tool-use) — `disable_parallel_tool_use` ve sonuç gruplama
- [Google — Gemini işlevi paralel bölümü çağırıyor](https://ai.google.dev/gemini-api/docs/function-calling) — Gemini 3'ten kimlikle ilişkili paralel çağrılar
- [OpenAI — Araçlarla akış yanıtları](https://platform.openai.com/docs/api-reference/responses-streaming) — OpenAI akışları için parçalanmış argümanların yeniden birleştirilmesi
- [Anthropic — Mesaj akışı](https://docs.anthropic.com/en/api/messages-streaming) — `content_block_delta`, `input_json_delta` ile
