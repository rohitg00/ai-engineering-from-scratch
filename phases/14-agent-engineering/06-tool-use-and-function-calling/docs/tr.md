# Araç Kullanımı ve İşlev Çağırma

> Toolformer (Schick ve diğerleri, 2023) kendi kendini denetleyen takım açıklamalarını başlattı. Berkeley Function Calling Leaderboard V4 (Patil ve diğerleri, 2025) 2026 çıtasını belirliyor: %40 agentik, %30 çoklu dönüş, %10 canlı, %10 canlı olmayan, %10 halüsinasyon. Tek dönüş çözüldü. Bellek, dinamik karar verme ve uzun vadeli alet zincirleri öyle değil.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 13 · 01 (İşlev Çağrısı Derinlemesine İnceleme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Toolformer'ın kendi kendini denetleyen eğitim sinyalini açıklayın: araç açıklamalarını yalnızca yürütme sonraki token kaybını azalttığında saklayın.
- BFCL V4'ün beş değerlendirme kategorisini ve her birinin neyi ölçtüğünü belirtin.
- Şema doğrulama, bağımsız değişken zorlama ve yürütme korumalı alan oluşturma özelliklerine sahip bir stdlib aracı kayıt defteri uygulayın.
- 2026'nın üç açık sorununu teşhis edin: uzun vadeli takım zincirleme, dinamik karar verme ve hafıza.

## Sorun

Aracın erken kullanımı şu soruyu sordu: Model doğru bir işlev çağrısını tahmin edebilir mi? Modern araç kullanımı şunu sorar: Model, araçları 40 adım boyunca, bellekle, kısmi observability ile, araç arızalarından kurtarmayla, var olmayan halüsinasyon araçları olmadan zincirleyebilir mi?

Toolformer temel çizgiyi oluşturdu: modeller, kendi kendini denetleyerek araçları ne zaman çağıracaklarını öğrenebilir. BFCL V4, 2026 değerlendirme hedefini tanımlar. Aralarındaki boşluk, agent'ların yaşadığı alandır.

## Konsept

### Araç Oluşturucu (Schick ve diğerleri, NeurIPS 2023)

Fikir: Modelin kendi ön eğitim külliyatına aday API çağrılarıyla açıklama eklemesine izin verin. Her aday için bunu yürütün. Ek açıklamayı yalnızca araç sonucunun dahil edilmesi sonraki token'deki kaybı azaltıyorsa saklayın. Filtrelenen derlem üzerinde ince ayar yapın.

Kapsanan araçlar: hesap makinesi, QA sistemi, arama motorları, çevirmen, takvim. Kendi kendini denetleme sinyali tamamen aracın metni tahmin etmeye yardımcı olup olmadığıyla ilgilidir; insan etiketleri yoktur.

Ölçek sonucu: Araç kullanımı ölçekte ortaya çıkıyor. Daha küçük modeller araç açıklamalarından zarar görür; Daha büyük modeller kazanç sağlar. Bu nedenle 2026 sınır modelleri güçlü araç kullanımına sahipken çoğu 7B modelinin güvenilir olması için açık araç kullanımına fine-tuning ihtiyacı vardır.

### Berkeley İşlev Çağrısı Skor Tablosu V4 (Patil ve diğerleri, ICML 2025)

BFCL 2026 fiili değerlendirmesidir. V4 bileşimi:

- **Agentic (%40)** — tam agent yörüngeler: bellek, çok dönüşlü, dinamik kararlar.
- **Çoklu Dönüş (%30)** — takım zincirleriyle etkileşimli görüşmeler.
- **Canlı (%10)** — kullanıcı tarafından gönderilen gerçek prompt'ler (daha sert dağıtım).
- **Canlı Olmayan (%10)** — sentetik test senaryoları.
- **Halüsinasyon (%10)** — hiçbir aletin çağrılmaması gerektiğini tespit edin.

V3, duruma dayalı değerlendirmeyi tanıttı: bir araç dizisinden sonra, araç çağrılarının AST'sini eşleştirmek yerine API'nin gerçek durumunu (e.g. "dosya oluşturuldu mu?") kontrol edin. V4'e web araması, bellek ve format duyarlılığı kategorileri eklendi.

2026'nın önemli bulgusu: tek dönüşlü işlev çağrısı neredeyse çözüme ulaştı. Başarısızlıklar hafızada yoğunlaşır (bağlamın dönüşler arasında taşınması), dinamik karar verme (önceki sonuçlara göre araçların seçilmesi), uzun ufuk zincirleri (20'den fazla adımdan sonra sürüklenme) ve halüsinasyon tespitinde (hiçbir araç uymadığında aramayı reddetme).

### Araç şeması

Her sağlayıcının bir şeması vardır. Ayrıntılarda farklılık gösterirler ancak aynı şekli paylaşırlar:

```
name: string
description: string (what it does, when to use it)
input_schema: JSON Schema (properties, required, types, enums)
```

Antropik doğrudan `input_schema`'ı kullanır. OpenAI, `function.parameters` kullanır. Her ikisi de JSON Şemasını kabul ediyor. Açıklamalar yük taşır; model, doğru aleti seçmek için bunları okur. Kötü takım açıklamaları, yanlış takım seçimi arızalarının 1 numaralı temel nedenidir.

### Bağımsız değişken doğrulama

Hiçbir alet çağrısına güvenmeyin. Doğrula:

1. **Coercion yazın.** Şemanın int dediği yerde model "5" dizesini döndürebilir. Açıkça görülüyorsa baskı yapın; değilse reddedin.
2. **Sıralama doğrulaması.** Şema `status in {"open", "closed"}` diyorsa ve model `"in_progress"` yayınlıyorsa, açıklayıcı bir hatayla reddedin.
3. **Zorunlu alanlar.** Gerekli alan eksik -> modele anında hata gözlemleme, çökme değil.
4. **Biçim doğrulama.** Tarihler, e-postalar, URL'ler — normal ifadelerle değil, somut ayrıştırıcılarla doğrulayın.

Her doğrulama başarısızlığı, modelin doğru şekli yeniden deneyebilmesi için yapılandırılmış bir gözlem döndürmelidir.

### Paralel araç çağrıları

Modern sağlayıcılar tek bir asistan dönüşünde paralel araç çağrılarını destekler. Döngü:

1. Model, farklı `tool_use_id`'lara sahip 3 araç çağrısı yayınlar.
2. Çalışma zamanı bunları yürütür (bağımsızsa paralel olarak).
3. Her sonuç, `tool_use_id` ile ilişkilendirilen bir `tool_result` bloğu olarak geriye gider.

Mühendislik kuralı: korelasyon kimliklerini yük taşıyıcı olarak değerlendirin. Bunları değiştirin ve yanlış takımdan yanlış sonuca yönlendirme elde edin.

### Korumalı alana alma

Araç yürütme, korumalı alan sınırıdır. Ayrıntılı bilgi için Ders 09'a bakın. Kısa versiyon: Her araç okuma/yazma yüzeyini, ağ erişimini, zaman aşımını, bellek sınırını belirtmelidir. Genel `run_shell(cmd)` bir tehlike işaretidir; belirli `git_status()` daha güvenlidir.

```figure
tool-routing
```

## İnşa Et

`code/main.py`, üretim şekli aracı kaydını uygular:

- JSON Şeması alt küme doğrulayıcısı (yalnızca stdlib).
- Açıklama, giriş şeması, zaman aşımı ve yürütücü ile araç kaydı.
- Argüman zorlaması ve numaralandırma doğrulaması.
- Korelasyon kimlikleriyle paralel takım gönderimi.
- Yapılandırılmış dizeler olarak hata gözlemleri.

Çalıştır:

```
python3 code/main.py
```

İz, modelin harekete geçebileceği açıklayıcı bir hatayla reddedilen, kasıtlı olarak hatalı biçimlendirilmiş bir çağrıyla birlikte, bir turda üç aracı çağıran mini bir agent'yi göstermektedir.

## Kullan onu

Her sağlayıcının kendi araç şeması vardır: Anthropic, OpenAI, Gemini, Bedrock. Çoklu sağlayıcıya ihtiyacınız varsa bir çeviri katmanı (OpenAI Agent'nin SDK'sı, Vercel AI SDK'sı, LangChain araç adaptörü) kullanın. BFCL, benchmark referansıdır; eğer alet kullanımı ürün açısından önemliyse, göndermeden önce bunu agent cihazınıza karşı çalıştırın.

## Gönderin

`outputs/skill-tool-registry.md`, belirli bir görev alanı için bir araç kataloğu, şema ve kayıt defteri oluşturur. Açıklama kalitesi kontrollerini içerir (her aracın açıklaması modele onu ne zaman kullanacağını söylüyor mu?).

## Egzersizler

1. Modelin başka herhangi bir aracı kullanmayı açıkça reddetmesine olanak tanıyan bir "işlemsiz" araç ekleyin. BFCL benzeri halüsinasyon testinde ölçüm yapın.
2. int-as-string ve float-as-string için bağımsız değişken zorlaması uygulayın. Zorlama gerçek hataları gizlemeye nerede başlar?
3. Alet başına bir zaman aşımı ve bir devre kesici ekleyin (arka arkaya 3 arızadan sonra aleti 60 saniye süreyle reddedin). Bu, modelin iyileşme şekliyle ilgili neyi değiştirir?
4. BFCL V4 açıklamasını okuyun. Bir kategori seçin (e.g. "çoklu tur") ve agent cihazınızda 10 örnek prompt çalıştırın. Geçiş oranını bildirin.
5. Stdlib doğrulayıcıyı Pydantic veya Zod'a taşıyın. Pydantic/Zod oyuncağın kaçırdığı neyi yakaladı?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| İşlev çağırma | "Araç kullanımı" | Doğrulanmış şemayla yapılandırılmış çıktı aracının çağrılması |
| Kalıpçı | "Kendi kendini denetleyen araç açıklaması" | Schick 2023 — sonuçları bir sonraki token kaybı azaltan araç çağrılarını sürdürün |
| BFCL | "Berkeley İşlev Çağrısı Skor Tablosu" | 2026 benchmark: %40 agentic, %30 çoklu dönüş, %10 canlı, %10 canlı olmayan, %10 halüsinasyon |
| Araç şeması | "Model için fonksiyon imzası" | ad, açıklama, JSON Bağımsız değişken şeması |
| tool_use_id | "Korelasyon Kimliği" | Bir araç çağrısını sonucuna bağlar; paralel dağıtım için gerekli |
| Halüsinasyon tespiti | "Ne zaman aramamanız gerektiğini bilin" | V4 kategorisi: hiçbir alet uymadığında aramayı reddetme |
| Tartışma zorlaması | "Dizeden int'ye onarım" | Tahmin edilebilir şema uyumsuzluğuna yönelik dar düzeltmeler; belirsizse reddet |
| Korumalı alana alma | "Takım yürütme sınırı" | Araç başına okuma/yazma yüzeyi, ağ, zaman aşımı, bellek sınırı |

## Daha Fazla Okuma

- [Schick ve diğerleri, Toolformer (arXiv:2302.04761)](https://arxiv.org/abs/2302.04761) — kendi kendini denetleyen araç açıklaması
- [Berkeley İşlev Çağrısı Skor Tablosu (V4)](https://gorilla.cs.berkeley.edu/leaderboard.html) — 2026 değerlendirme benchmark
- [Antropik, Araç kullanımı belgeleri](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude Agent SDK'sındaki üretim aracı şeması
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) — işlev aracı türü ve Korkuluklar
