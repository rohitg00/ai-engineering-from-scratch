# Tarayıcı Agent'ler ve Uzun Ufuk Web Görevleri

> ChatGPT agent (Temmuz 2025), Operatör ve derin araştırmayı tek bir tarayıcı/terminal agent'de birleştirdi ve BrowseComp SOTA'yı %68,9'a ayarladı. OpenAI, Operatörü 31 Ağustos 2025'te kapattı - ürün katmanında konsolidasyon. Anthropic'in Vercept'i satın alması, Claude Sonnet'i OSWorld'de %15'in altından %72,5'e taşıdı. WebArena Onaylı (ServiceNow, ICLR 2026), orijinal WebArena'da yüzde 11,3 hatalı negatif oranını sabitledi ve 258 görevlik Sabit alt kümesini gönderdi. Rakamlar gerçek. Saldırı yüzeyi de öyle: OpenAI'nin hazırlık sorumlusu, prompt'nin tarayıcı agent'lere dolaylı olarak enjekte edilmesinin "tamamen yamanabilecek bir hata olmadığını" kamuoyuna açıkladı. Belgelenmiş 2025-2026 saldırıları: Tainted Memories (Atlas CSRF), HashJack (Cato Networks) ve Perplexity Comet'teki tek tıklamayla saldırılar.

**Tür:** Öğren
**Diller:** Python (stdlib, dolaylı prompt-enjeksiyon saldırı yüzeyi modeli)
**Önkoşullar:** Aşama 15 · 10 (İzin modları), Aşama 15 · 01 (Uzun ufuk agent'ler)
**Süre:** ~45 dakika

## Sorun

agent tarayıcısı, güvenilmeyen içeriği okuyan ve sonuç niteliğinde eylemler gerçekleştiren uzun ufuklu bir agent'dir. agent'nin ziyaret ettiği her sayfa, kullanıcının yazmadığı bir girdidir. Her sayfadaki her form potansiyel bir komut kanalıdır. 2025-2026 saldırı külliyatı bunun varsayımsal olmadığını gösteriyor: Kusurlu Anılar, bir saldırganın hazırlanmış bir sayfa aracılığıyla kötü amaçlı talimatları agent'nin belleğine bağlamasına olanak tanır; HashJack, agent'nin ziyaret ettiği URL parçalarındaki komutları gizler; Şaşkınlık Kuyruklu yıldızın kaçırılması tek bir tıklamayla gerçekleşir.

Savunma tablosu rahatsız edici. OpenAI'nin hazırlık sorumlusu sessiz kısmı yüksek sesle söyledi: Dolaylı prompt enjeksiyonu "tamamen yama yapılabilecek bir hata değil." Bunun nedeni, saldırının agent'nin mimari açıdan bulanık olan okumaya karşı eyleme sınırında yaşamasıdır; modelin okuduğu her token, prensip olarak bir talimat olarak okunabilir.

Bu ders, saldırı yüzeyini adlandırır, benchmark ortamını (BrowseComp, OSWorld, WebArena-Verified) adlandırır ve minimum dolaylı prompt enjeksiyon senaryosunu modeller, böylece Ders 14 ve 18'de gerçek savunmalar hakkında akıl yürütebilirsiniz.

## Konsept

### 2026 manzarası, sistem başına bir paragrafta

**ChatGPT agent (OpenAI).** Temmuz 2025'te kullanıma sunuldu. Operatör (göz atma) ve Derin Araştırmayı (çok saatlik araştırma) birleştirir. Bağımsız Operatörü 31 Ağustos 2025'te kapatın.BrowseComp'ta SOTA %68,9'da; OSWorld ve WebArena-Verified'da güçlü rakamlar.

**Claude Sonnet + Vercept (Anthropic).** Anthropic'in Vercept'i satın alması bilgisayar kullanım yeteneklerine odaklandı. OSWorld'de Claude Sonnet <%15'ten %72,5'e taşındı. Claude Bilgisayar Kullanımı bir araç API'si olarak gönderilir.

**Tarayıcı Kullanımıyla (DeepMind) Gemini 3 Pro.** Tarayıcı Kullanımı entegrasyonu, bilgisayar kullanımı kontrollerini sağlar; FSF v3 (Nisan 2026, Ders 20), özellikle makine öğrenimi Ar-Ge alanındaki özerkliği izler.

**WebArena Onaylı (ServiceNow, ICLR 2026).** İyi belgelenmiş bir sorunu düzeltir: Orijinal WebArena'da ~%11,3 yanlış negatif oranı vardı (başarısız olarak işaretlenen ve gerçekten çözülen görevler). Doğrulanmış sürüm, insanların belirlediği başarı kriterlerine göre yeniden derecelendirilir ve 258 görevlik bir Sert alt küme ekler (ICLR 2026 makalesi, openreview.net/forum?id=94tlGxmqkN).

###BrowseComp vs OSWorld vs WebArena

| Benchmark | Neyi ölçer | Ufuk |
|---|---|---|
| GözatComp | Zaman baskısı altında açık web'de belirli gerçekleri bulma | dakika |
| İşletim Sistemi Dünyası | Agent tam bir masaüstü işletim sistemi (fare, klavye, kabuk) | onlarca dakika |
| WebArena Onaylı | Simüle edilmiş sitelerde işlemsel web görevleri | dakika |
| Sabit altküme | Çok sayfalı durum geçişlerine sahip WebArena Onaylı görevler | onlarca dakika |

Farklı eksenler. Yüksek bir BrowseComp puanı, agent'nin gerçekleri bulduğunu gösterir; agent'nin uçuş rezervasyonu yapabileceğini söylemiyor. OSWorld puanı "masaüstümde çalışıyor mu?" sorusuna daha yakın. WebArena-Verified "bir akışı tamamlayabilir mi?" sorusuna daha yakın. Herhangi bir üretim kararının, görev dağıtımına uygun benchmark'ye ihtiyacı vardır.

### Saldırı yüzeyi, adı

1. **Dolaylı prompt ekleme.** Güvenilmeyen sayfa içeriği talimatlar içerir. agent bunları okur. agent bunları yürütür. Herkese açık örnekler: 2024 Kai Greshake ve diğerleri, 2025 Tainted Memories makalesi, 2026 HashJack (Cato Networks).
2. **URL parçası / sorgu yerleştirme.** `#fragment` veya taranan bir URL'nin sorgu dizesi komutlar içerir. Hiçbir zaman gözle görülür şekilde işlenmedi; hala agent'nin bağlamı içinde.
3. **Bellek bağlama saldırıları.** Sayfa, agent'ye kalıcı bir bellek yazması talimatını verir (Ders 12, dayanıklı durumu kapsar). Bir sonraki oturumda bellek, görünür bir tetikleyici olmaksızın yükü ateşler.
4. **Kimliği doğrulanmış oturumlara CSRF şeklinde saldırılar.** Tainted Memories sınıfı: agent bir yerde oturum açmış; Saldırganın sayfası, agent'nin kullanıcının çerezleriyle yürüttüğü durum değiştirme isteklerini yayınlar.
5. **Tek tıklamayla kaçırma.** Görsel olarak zararsız bir düğme, agent'nin takip ettiği bir yükü çalıştırır. Kuyruklu yıldız sınıfı.
6. **agent'nin ana bilgisayar yüzeyindeki İçerik-Güvenlik-Politikası delikleri.** Oluşturma ve araç katmanlarının kendileri saldırı vektörleri olabilir; tarayıcıdaki tarayıcı agent yığını geniştir.

### Neden "tamamen yamalanabilir değil"

Saldırı, agent'nin kabiliyetine izomorfiktir. agent işini yapabilmek için güvenilmeyen içeriği okumalıdır. agent'nin okuduğu herhangi bir içerik talimatlar içerebilir. agent'nin izlediği herhangi bir talimat, kullanıcının gerçek isteğiyle yanlış hizalanmış olabilir. Savunmalar (güven sınırları, sınıflandırıcılar, araç izin verilenler listeleri, sonuçsal eylemlere ilişkin HITL) saldırının maliyetini artırır ve patlama yarıçapını azaltır. Sınıfı kapatmıyorlar.

Bu, Lob teoremiyle aynı mantık modelidir (Ders 8): agent bir sonraki token'nin güvenli olduğunu kanıtlayamaz; yalnızca güvenli olmayan token'lerin daha tespit edilebilir olduğu bir sistem kurabilir.

### Aslında gönderilen savunma duruşu

- **Okuma/yazma sınırı.** Okuma hiçbir zaman sonuca bağlı değildir. Yazmak (bir form göndermek, içerik yayınlamak, yan etkileri olan bir aracı çağırmak), eğer başlatıcı içerik güven sınırının dışından geliyorsa, yeni insan onayı gerektirir.
- **Görev başına araç izin verilenler listesi.** agent; söz konusu araç görev için açıkça etkinleştirilmedikçe banka havalesi başlatamaz. Ders 13 bütçeleri kapsar.
- **Oturum yalıtımı.** Tarayıcı agent oturumları yalnızca kapsamlı kimlik bilgileriyle çalışır. Üretim kimlik doğrulaması yok, kişisel e-posta yok. Denetim için tutulan her HTTP isteğinin günlükleri.
- **İçerik temizleyici.** Getirilen HTML, model bağlamıyla birleştirilmeden önce bilinen kötü kalıplardan arındırılır. (Kolay saldırıları azaltır; karmaşık yükleri durdurmaz.)
- **Sonuçsal eylemlerde HITL.** Teklif et-sonra taahhüt et modeli (Ders 15).
- **Bellekteki Canary token'ler.** Bir bellek girişi tetiklenirse kullanıcı bunu görür (Ders 14).

## Kullan onu

`code/main.py`, üç sentetik sayfaya karşı çalışan küçük bir tarayıcı olan agent'yi modeller. Bir sayfa zararsız, birinde görünür metinde doğrudan prompt enjeksiyon bloğu var, birinde URL parçası enjeksiyonu var (görünmüyor ama agent'nin bağlamı içinde). Komut dosyası (a) saf bir agent'nin ne yapacağını, (b) okuma/yazma sınırının neyi yakaladığını, (c) bir temizleyicinin neyi yakaladığını, (d) ikisinin de neyi yakalayamadığını gösterir.

## Gönderin

`outputs/skill-browser-agent-trust-boundary.md`, önerilen bir tarayıcı olan agent deployment'nin kapsamını belirler: hangi güven bölgelerine dokunduğunu, ne yazma yetkisine sahip olduğunu ve ilk çalıştırmadan önce hangi savunmaların mevcut olması gerektiğini.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Temizleyicinin hangi saldırıyı yakaladığını ancak okuma/yazma sınırının yakalamadığını ve hangi saldırının yalnızca okuma/yazma sınırını yakaladığını belirleyin.

2. Temizleyiciyi, HashJack tarzı URL parçası eklemenin bir sınıfını tespit edecek şekilde genişletin. Meşru parçalar içeren iyi huylu URL'lerdeki yanlış pozitif oranını ölçün.

3. Gerçek bir tarayıcı seçin; bildiğiniz agent iş akışı (e.g., "uçuş rezervasyonu"). Her okunan ve yazılan her şeyi listeleyin. Hangi yazanın HITL'e ihtiyacı olduğunu ve nedenini işaretleyin.

4. WebArena Onaylı ICLR 2026 makalesini okuyun. Orijinal WebArena'nın puanlamasının güvenilmez olduğu bir görev kategorisini tanımlayın ve Doğrulanmış alt kümesinin bunu nasıl çözdüğünü açıklayın.

5. Tarayıcı-agent ayarı için bir bellek kanaryası tasarlayın. Neyi, nerede saklarsınız ve alarmı ne tetikler?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Dolaylı prompt enjeksiyonu | "Kötü sayfa metni" | agent'nin okuduğu bir sayfadaki güvenilmeyen içerik, agent'nin yürüttüğü talimatları içerir |
| Lekeli Anılar | "Bellek saldırısı" | Agent, saldırganın sağladığı talimatı dayanıklı belleğe yazar; sonraki oturumu tetikledi |
| HashJack | "URL parçası saldırısı" | URL parçasında/sorgu dizesinde gizlenen yük, agent bağlamında yer alıyor ancak görünür şekilde oluşturulmuyor |
| Tek tıkla kaçırma | "Kötü düğme" | Görünür maliyet, agent'nin yürüttüğü bir takip yükünü beraberinde getiriyor |
| GözatComp | "Web'de arama benchmark" | Açık web'de belirli gerçekleri bulma; dakika ölçekli ufuk |
| İşletim Sistemi Dünyası | "Masaüstü benchmark" | Tam işletim sistemi kontrolü; çok adımlı GUI görevleri |
| WebArena Onaylı | "Sabit web görevi benchmark" | ServiceNow'un Sabit alt kümesiyle yeniden düzenlenen WebArena |
| Okuma/yazma sınırı | "Yan etki kapısı" | Okumak hiçbir zaman sonuç doğurmaz; içerik güvenilmezse yazı yazmak için yeni onay gerekir |

## Daha Fazla Okuma

- [OpenAI — ChatGPT agent ile Tanışın](https://openai.com/index/introducing-chatgpt-agent/) — Operatör ile derin araştırmanın birleşimi; GözatComp SOTA.
- [OpenAI — Bilgisayar Kullanan Agent](https://openai.com/index/computer-using-agent/) — Operatör nesli ve ChatGPT agent haline gelen mimari.
- [Zhou ve ark. — WebArena](https://webarena.dev/) — orijinal benchmark.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 sabit alt kümeli kağıt.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — bilgisayar kullanımında agent'ler için saldırı yüzeyi tartışmasını içerir.
