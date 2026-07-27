# Araç Arayüzü — Agent'ler Neden Yapılandırılmış G/Ç'ye İhtiyaç Duyar?

> Bir dil modeli token'ler üretir. Bir program eylemler gerçekleştirir. Bu ikisi arasındaki boşluk, araç arayüzüdür: modelin bir eylem talep etmesine ve ana bilgisayarın bunu yürütmesine olanak tanıyan bir sözleşme. Her 2026 yığınında OpenAI, Anthropic ve Gemini'de işlev çağrısı; MCP'nin `tools/call`'si; A2A'nın görev bölümleri aynı dört adımlı döngünün farklı bir kodlamasıdır. Bu ders döngüyü adlandırır ve onu çalıştıracak minimum makineyi gösterir.

**Tür:** Öğren
**Diller:** Python (stdlib, LLM yok)
**Önkoşullar:** Aşama 11 (LLM tamamlama API'leri)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Yalnızca metin üretebilen bir LLM'ın neden tek başına gerçek dünyaya karşı eylemde bulunamayacağını açıklayın.
- Dört adımlı araç çağırma döngüsünü çizin (tanımlayın → karar verin → yürütün → gözlemleyin) ve her adımın sahibinin adını belirtin.
- Bir araç açıklamasını üç bölüm halinde yazın: ad, JSON Şema girişi ve deterministik bir yürütücü işlevi.
- Saf ve yan etkili araçları ayırt edin ve bölünmenin güvenlik açısından neden önemli olduğunu belirtin.

## Sorun

Bir LLM bir sonraki token üzerinden bir olasılık dağılımı yayar. Bu tüm çıktı yüzeyidir. Bir sohbet modeline "Bengaluru'da şu anda hava nasıl?" diye sorarsanız makul bir cümle yazabilir, ancak bir hava durumu API'sine bağlanamaz. Cümle tesadüfen doğru da olabilir, üç gün bayat da olabilir.

Bu boşluğu kapatmak araç arayüzünün amacıdır. Ana bilgisayar programı (agent çalışma zamanınız, Claude Desktop, ChatGPT, Cursor veya özel bir komut dosyası) modele çağrılabilir araçların bir listesini duyurur. Model, bir eylemin gerekli olduğuna karar verdiğinde, aracı ve onun argümanlarını adlandıran yapılandırılmış bir veri yayınlar. Ana bilgisayar bu yükü ayrıştırır, aracı gerçek anlamda çalıştırır ve sonucu geri bildirir. Döngü, model daha fazla çağrıya gerek olmadığına karar verene kadar devam eder.

Bu sözleşmenin ilk sürümü Haziran 2023'te OpenAI'nin "işlevler" parametresi olarak yayınlandı. Anthropic'i Claude 2.1'de `tool_use` bloklarıyla takip etti. Gemini birkaç ay sonra `functionDeclarations`'yi ekledi. Artık her sağlayıcı aynı şekli ortaya koyuyor: JSON Schema tipinde bir araç listesi, bir JSON yükü aracı çağrısı. Model Context Protocol (Kasım 2024), sözleşmeyi her modele tek bir araç kaydı hizmet edecek şekilde genelleştirdi. A2A (Nisan 2026, v1.0), agent-agent delegasyonu için aynı temel öğeyi katmanlandırdı.

Dört adımlı döngü tüm bunların altında yatan değişmezdir. Aşama 13'teki diğer her şey bir detaylandırmadır.

## Konsept

### Birinci adım: tanımlayın

Ana bilgisayar her aracı üç alanla bildirir.

- **Ad.** Sabit, makine tarafından okunabilen bir tanımlayıcı. `get_weather`, "hava durumu" değil.
- **Açıklama.** Tek paragraflık doğal dil özeti. "Kullanıcı belirli bir şehrin mevcut koşullarını sorduğunda kullanın. Geçmiş veriler için kullanmayın."
- **Giriş şeması.** Aracın bağımsız değişkenlerini açıklayan bir JSON Schema nesnesi (taslak 2020-12).

Model listeyi alır. Modern sağlayıcılar, sağlayıcıya özel bir şablon kullanarak bu bildirimleri prompt sistemine seri hale getirir, böylece arayan olarak siz yalnızca yapılandırılmış formla ilgilenirsiniz.

### İkinci adım: karar verin

Kullanıcının mesajı ve mevcut araçlar göz önüne alındığında model, üç davranıştan birini seçer.

1. **Metinle doğrudan cevap verin**. Alet çağrısı yok.
2. **Bir veya daha fazla aracı çağırın.** Yapılandırılmış çağrı nesneleri yayınlayın. `parallel_tool_calls: true` altında (OpenAI ve Gemini'de varsayılan, Anthropic'te isteğe bağlı) model tek seferde birden fazla çağrı gerçekleştirebilir.
3. **Reddet.** Katı modlu yapılandırılmış çıkışlar, çağrı yerine yazılı bir `refusal` bloğu üretebilir.

Bir araç çağrısı yükünün üç kararlı alanı vardır: bir çağrı `id`, bir araç `name` ve bir JSON `arguments` nesnesi. Kimlik, ana bilgisayarın daha sonraki sonucu belirli bir çağrıyla ilişkilendirebilmesi için mevcuttur; bu, paralel çağrılar tekrar bozulduğunda önemli olur.

### Üçüncü adım: yürüt

Ana bilgisayar çağrıyı alır, bildirilen şemaya göre argümanları doğrular ve yürütücüyü çalıştırır. Geçersiz argümanlar, modelin bir alanı halüsinasyona uğrattığı veya yanlış türü kullandığı anlamına gelir; bu, zayıf modellerde çok yaygın bir başarısızlık modudur. Üretim ana bilgisayarları geçersiz argümanlar konusunda üç şeyden birini yapar: hızlı bir şekilde başarısız olur ve hatayı modele yansıtır, JSON'u kısıtlı bir ayrıştırıcıyla onarır veya modeli prompt'de yer alan doğrulama hatasıyla yeniden deneyebilir.

Yürütücünün kendisi sıradan bir koddur. Python, TypeScript, bir kabuk komutu, bir veritabanı sorgusu. Genellikle bir dize olan ancak herhangi bir JSON değeri veya yapılandırılmış bir içerik bloğu (MCP'de metin, resim veya kaynak referansı) olabilen bir sonuç üretir. Sonuç serileştirilebilir olmalıdır.

### Dördüncü adım: gözlemleyin

Ana bilgisayar, araç sonucunu konuşmaya ekler (`id` ile eşleşen bir `tool` rol mesajı olarak) ve modeli yeniden çağırır. Model artık araç çıktısını bağlam içinde barındırıyor ve nihai bir yanıt üretebiliyor veya daha fazla çağrı talep edebiliyor. Bu, model çağrı göndermeyi durdurana veya ana bilgisayar yineleme sayısında bir güvenlik sınırına ulaşana kadar devam eder.

### Güven bölünmesi

Aletlerin güvenlik açısından önemli olan iki çeşidi vardır.

- **Saf.** Salt okunur, deterministik, yan etkisi yok. `get_weather`, `search_docs`, `get_current_time`. Spekülatif olarak aramak güvenlidir.
- **Sonuç olarak.** Durumu değiştirir, para harcar, kullanıcı verilerine dokunur. `send_email`, `delete_file`, `execute_trade`. Kapılı olmalı.

Meta'nın agent güvenliğine yönelik 2026 "İki Kuralı", tek bir dönüşün şunlardan en fazla ikisini birleştirebileceğini söylüyor: güvenilmeyen giriş, hassas veriler, sonuçsal eylem. Araç arayüzü, aramaları reddederek, kullanıcı onayı gerektirerek veya kapsamları yükselterek bu kuralı uyguladığınız yerdir. Güvenlik bölümünün tamamı için Aşama 13 · 15'e ve agent düzeyi izin politikaları için Aşama 14 · 09'a bakın.

### Döngünün yaşadığı yer

| Bağlam | Kim açıklıyor | Kim karar veriyor | Kim idam eder |
|---------|---------------|-------------|--------------|
| Tek dönüşlü işlev çağırma (OpenAI/Anthropic/Gemini) | Uygulama geliştiricisi | LLM | Uygulama geliştiricisi |
| MCP | MCP sunucusu | MCP istemcisi aracılığıyla LLM | MCP sunucusu |
| A2A | Agent Kart yayıncısı | agent'nin aranması | agent olarak adlandırıldı |
| Web tarayıcısı (işlev çağıran agent) | Tarayıcı uzantısı / WebMCP | LLM | Tarayıcı çalışma zamanı |

Her yerde aynı dört adım. Sütun adları değişir; yapı öyle değil.

### Neden sadece prompt JSON yayınlayacak model olmasın?

"Modelden JSON'da yanıt vermesini isteyin", işlev öncesi çağırma modeliydi. Sınır modellerinde ~ yüzde 5 ila 15 oranında başarısız olur ve daha küçük modellerde çok daha fazladır. Başarısızlık modları eksik parantezleri, sondaki virgülleri, halüsinasyonlu alanları ve yanlış türleri içerir. Daha sonra bir JSON onarım geçişine, yeniden denemeye veya kısıtlı bir kod çözücüye ihtiyacınız vardır.

Yerel işlev çağrısı üç nedenden dolayı daha iyidir. İlk olarak sağlayıcı, modeli uçtan uca tam çağrı şekline göre eğitir, böylece geçerli JSON oranı katı modda yüzde 98 ila 99'a çıkar. İkincisi, çağrı verisi serbest metnin içinde değil, kendi protokol yuvasında bulunur; böylece bir araç çağrısı asla kullanıcının görebileceği yanıta sızmaz. Üçüncüsü, sağlayıcılar kısıtlı kod çözme (OpenAI'nin katı modu, Anthropic'in `tool_use`'si, Gemini'nin `responseSchema`'si) ile şema uyumluluğunu zorunlu kılar. Çıktının doğrulanması garanti edilir.

Aşama 13 · 02, üç sağlayıcı API'sini yan yana ele alır. Aşama 13 · 04, yapılandırılmış çıktıların derinliklerine iniyor.

### Devre kesiciler

Model çağrı göndermeyi bıraktığında veya ana bilgisayar maksimum dönüş sayısına ulaştığında döngü sona erer. Prodüksiyon sunucuları bunu 5 ila 20 dönüş arasına ayarladı. Bunun ötesinde, neredeyse kesinlikle modelin çıkamayacağı bir döngünün içindesiniz. Claude Code varsayılan olarak 20'dir; 10'a kadar OpenAI Asistanı; İmlecin agent modunu 25'e getirin.

Alternatif - sınırsız döngüler - her altı ayda bir "agent'nin bir gecede API çağrılarına 400 dolar harcadığı" ölümden sonra ortaya çıkıyor. Sınırsız gönderim yapmayın.

Aşama 14 · 12, hata giderme ve kendi kendini iyileştirmeyi derinlemesine kapsar; Aşama 17, üretim hızı sınırlarını kapsar.

### Aşama 13 buradan nereye gidiyor

- 02'den 05'e kadar olan dersler, sağlayıcı düzeyinde araç çağırma yüzeyini iyileştirir.
- 06'dan 14'e kadar olan dersler döngüyü MCP'ye genelleştirir.
- 15'ten 18'e kadar olan dersler, döngüyü düşman sunuculara, düşman kullanıcılara ve kimliği doğrulanmamış uzak kimlik doğrulama yüzeylerine karşı savunur.
- 19'dan 22'ye kadar olan dersler, modeli agent'den agent'ye işbirliği, observability, yönlendirme ve paketlemeyi kapsayacak şekilde genişletir.
- Ders 23, her ilkel öğeyi kullanarak eksiksiz bir ekosistem sunar.

Geriye kalan her ders bu dört adımlı döngünün detaylandırılmasıdır. Bunu değişmez olarak aklınızda tutun.

## Kullan onu

`code/main.py` dört adımlı döngüyü LLM olmadan çalıştırır. Sahte bir "karar verici" işlevi, kullanıcı mesajındaki kalıp eşleştirme yoluyla modeli simüle eder; yürütücü, şema doğrulayıcı ve gözlem adımı donanımı gerçektir. Yazdırılabilir ara durumla birlikte istek/yanıt koreografisinin tamamını görmek için çalıştırın, ardından daha sonraki bir derste sahte karar vericiyi herhangi bir gerçek sağlayıcıyla değiştirin.

Neye bakmalı:

- Araç kayıt defterinde araç başına üç alan bulunur: ad, açıklama, şema ve yürütücü referansı.
- Doğrulayıcı, yalnızca stdlib'de yazılmış minimum bir JSON Schema alt kümesidir (türler, gerekli, numaralandırma, min/maks). Aşama 13 · 04 daha dolgun bir tane gönderiyor.
- Döngü yineleme sayısını beşte sınırlar. Üretim agent'ler tam olarak bu tür bir devre kesiciye ihtiyaç duyar.

## Gönderin

Bu ders `outputs/skill-tool-interface-reviewer.md`'yi üretir. Bir taslak araç tanımı verildiğinde (ad + açıklama + şema + yürütücü taslağı), beceri bunu döngü uygunluğu açısından denetler: adın makine açısından kararlı olup olmadığı, açıklamanın tam bir kullanım özeti olup olmadığı, şema JSON Schema 2020-12'yi doğru şekilde kullanıyor mu ve saf-sonuçsal sınıflandırma açık mı.

## Egzersizler

1. `code/main.py`'ye `get_stock_price(ticker)` adında dördüncü bir araç ekleyin. Açıklamasını şu şekilde yazın: "Kullanıcı, hisse senedi fiyatını kayan yazıyla sorduğunda kullanın. Geçmiş fiyatlar veya piyasa özetleri için kullanmayın." Kablo demetini çalıştırın ve sahte karar vericinin sorguları yeni araca işaretlerden bahsederek yönlendirdiğini onaylayın.

2. Şema doğrulayıcıyı kırın. `arguments` nesnesinde gerekli bir alan eksik olan bir çağrıyı iletin ve yürütmeden önce ana bilgisayarın bu çağrıyı reddettiğini onaylayın. Daha sonra fazladan bilinmeyen bir alana sahip bir çağrıyı iletin. Karar verin: Toplantı sahibi reddetmeli mi yoksa görmezden mi gelmeli? Seçiminizi bir güvenlik argümanıyla gerekçelendirin.

3. Donanımdaki her aleti saf veya sonuç olarak sınıflandırın. Gereken kayıt defteri girdilerine bir `consequential: true` bayrağı ekleyin ve sonuç niteliğindeki bir araç seçildiğinde "kullanıcıyla onaylanır" satırı yazdıracak şekilde döngüyü değiştirin. Bu, her üretim ana bilgisayarının ihtiyaç duyduğu onay kapısının şeklidir.

4. Favori istemciniz (Claude Desktop, Cursor, ChatGPT veya özel bir yığın) için yukarıdaki sağlayıcı sütunu tablosunu doldurarak dört adımlı döngüyü kağıda çizin. Aşama 13 · 06'daki MCP'ye özgü değişkenle çapraz referans.

5. OpenAI'nin işlev çağırma kılavuzunu yukarıdan aşağıya okuyun. İstekte yer alan ancak burada sunulan dört adımlı döngüde yer almayan tek alanı tanımlayın. Neler kattığını ve neden gerekli olmaktan ziyade kullanışlı olduğunu açıklayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Araç | "Modelin arayabileceği bir şey" | Üçlü ad + JSON-Şema tipi giriş + yürütücü işlevi |
| İşlev çağırma | "Yerel araç kullanımı" | Düzyazı yerine yapılandırılmış araç çağrıları yayınlamak için sağlayıcı düzeyinde API desteği |
| Araç çağrısı | "Modelin harekete geçme talebi" | Model tarafından yayılan `id`, `name`, `arguments` içeren bir JSON verisi |
| Araç sonucu | "Aracın döndürdüğü şey" | Yürütücünün çıktısı, eşleşen kimliğe sahip bir `tool` rol mesajına sarılmış |
| Paralel araç çağrıları | "Aynı anda birçok çağrı" | Tek bir modelde birden fazla çağrı nesnesi, bağımsız ve kimliğe göre sıralanabilir |
| Katı mod | "Garantili JSON" | Modelin çıktısını bildirilen şemaya göre doğrulamaya zorlayan kısıtlı kod çözme |
| Saf araç | "Salt okunur araç" | Yan etki yok; yeniden çalıştırmak güvenli |
| Sonuç aracı | "Eylem aracı" | Dış durumu değiştirir; geçit, denetim veya kullanıcı onayı gerektirir |
| Dört adımlı döngü | "Araç çağırma döngüsü" | tanımla → karar ver → yürüt → gözlemle |
| Sunucu | "Agent çalışma zamanı" | Araç kaydını tutan, modeli çağıran ve yürütücüyü çalıştıran program |

## Daha Fazla Okuma

- [OpenAI — İşlev çağırma kılavuzu](https://platform.openai.com/docs/guides/function-calling) — OpenAI tarzı araç bildirimleri ve çağrı şekilleri için standart referans
- [Anthropic — Araç kullanımına genel bakış](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview) — Claude'un `tool_use` / `tool_result` blok formatı
- [Google — Gemini işlev çağrısı](https://ai.google.dev/gemini-api/docs/function-calling) — `functionDeclarations` ve Gemini'de paralel çağrı semantiği
- [Model Context Protocol — Spesifikasyon 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — araç arayüzünün sağlayıcıdan bağımsız genellemesi
- [JSON Schema — 2020-12 sürüm notları](https://json-schema.org/draft/2020-12/release-notes) — her modern araç API'sinin konuştuğu şema lehçesi
