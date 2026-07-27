# Tarayıcı Agent'ları ve Uzun Ufuk Web Görevleri

> ChatGPT agent (Temmuz 2025), Operatör ve derin araştırmayı tek bir tarayıcı/terminalde agent birleştirdi ve BrowseComp SOTA'yı %68,9'a ayarladı. OpenAI, Operatörü 31 Ağustos 2025'te kapattı - ürün katmanında konsolidasyon. Anthropic'in Vercept'i satın alması, Claude Sonnet'i OSWorld'de %15'in altından %72,5'e taşıdı. WebArena Onaylı (ServiceNow, ICLR 2026), orijinal WebArena'da yüzde 11,3 hatalı negatif oranını sabitledi ve 258 görevlik Sabit alt kümesini gönderdi. Rakamlar gerçek. Saldırı yüzeyi de öyle: OpenAI'nin hazırlık sorumlusu, tarayıcı agent'lara dolaylı prompt enjeksiyonunun "tamamen yamanabilecek bir hata olmadığını" kamuoyuna açıkladı. Belgelenmiş 2025-2026 saldırıları: Tainted Memories (Atlas CSRF), HashJack (Cato Networks) ve Perplexity Comet'teki tek tıklamayla saldırılar.

**Tür:** Öğren
**Diller:** Python (stdlib, dolaylı prompt-enjeksiyon saldırı yüzeyi modeli)
**Önkoşullar:** Aşama 15 · 10 (İzin modları), Aşama 15 · 01 (Uzun ufuk agents)
**Süre:** ~45 dakika

## Sorun

Tarayıcı agent, güvenilmeyen içeriği okuyan ve sonuç niteliğinde eylemler gerçekleştiren uzun ufuklu bir agent'dir. agent'ın ziyaret ettiği her sayfa, kullanıcının yazmadığı bir girdidir. Her sayfadaki her form potansiyel bir komut kanalıdır. 2025–2026 saldırı külliyatı bunun varsayımsal olmadığını gösteriyor: Kusurlu Anılar, bir saldırganın hazırlanmış bir sayfa aracılığıyla kötü amaçlı talimatları agent belleğine bağlamasına olanak tanır; HashJack, agent'ın ziyaret ettiği URL parçalarındaki komutları gizler; Şaşkınlık Kuyruklu yıldızın kaçırılması tek bir tıklamayla gerçekleşir.

Savunma tablosu rahatsız edici. OpenAI'nin hazırlık sorumlusu işin sessiz kısmını yüksek sesle söyledi: dolaylı prompt enjeksiyonu "tamamen yama yapılabilecek bir hata değil." Bunun nedeni, saldırının agent'ın mimari olarak bulanık olan okuma-yapma sınırında yaşamasıdır - modelin okuduğu her token, prensipte bir talimat olarak okunabilir.

Bu ders, saldırı yüzeyini adlandırır, benchmark ortamını (BrowseComp, OSWorld, WebArena-Verified) adlandırır ve minimal dolaylı-prompt-ekleme senaryosunu modeller, böylece Ders 14 ve 18'de gerçek savunmalar hakkında akıl yürütebilirsiniz.

## Konsept

### 2026 manzarası, sistem başına bir paragrafta

**ChatGPT agent (OpenAI).** Temmuz 2025'te kullanıma sunuldu. Operatör (göz atma) ile Derin Araştırmayı (çok saatlik araştırma) birleştirir. Bağımsız Operatörü 31 Ağustos 2025'te kapatın.BrowseComp'ta SOTA %68,9'da; OSWorld ve WebArena-Verified'da güçlü rakamlar.

**Claude Sonnet + Vercept (Anthropic).** Anthropic'in Vercept'i satın alması bilgisayar kullanım yeteneklerine odaklandı. OSWorld'de Claude Sonnet <%15'ten %72,5'e taşındı. Claude Bilgisayar Kullanımı bir araç API'si olarak gönderilir.

**Tarayıcı Kullanımıyla (DeepMind) Gemini 3 Pro.** Tarayıcı Kullanımı entegrasyonu, bilgisayar kullanımı kontrollerini sağlar; FSF v3 (Nisan 2026, Ders 20), özellikle makine öğrenimi Ar-Ge alanındaki özerkliği izler.

**WebArena Onaylı (ServiceNow, ICLR 2026).** İyi belgelenmiş bir sorunu düzeltir: Orijinal WebArena'da ~%11,3 yanlış negatif oranı vardı (başarısız olarak işaretlenen ve gerçekte çözülen görevler). Doğrulanmış sürüm, insanların belirlediği başarı kriterlerine göre yeniden derecelendirilir ve 258 görevden oluşan bir Sert alt küme ekler (ICLR 2026 makalesi, openreview.net/forum?id=94tlGxmqkN).

###BrowseComp vs OSWorld vs WebArena

| Benchmark | Neyi ölçer | Ufuk |
|---|---|---|
| GözatComp | Zaman baskısı altında açık web'de belirli gerçekleri bulma | dakika |
| İşletim Sistemi Dünyası | Agent tam masaüstü işletim sistemi (fare, klavye, kabuk) | onlarca dakika |
| WebArena Onaylı | Simüle edilmiş sitelerde işlemsel web görevleri | dakika |
| Sabit altküme | Çok sayfalı durum geçişlerine sahip WebArena Onaylı görevler | onlarca dakika |

Farklı eksenler. Yüksek bir BrowseComp puanı, agent'ın gerçekleri bulduğunu gösterir; agent'ın uçuş rezervasyonu yapabileceğini söylemiyor. OSWorld puanı "masaüstümde çalışıyor mu?" sorusuna daha yakın. WebArena-Verified "bir akışı tamamlayabilir mi?" sorusuna daha yakın. Herhangi bir üretim kararı, görev dağıtımıyla eşleşen benchmark'ya ihtiyaç duyar.

### Saldırı yüzeyi, adı

1. **Dolaylı prompt yerleştirme.** Güvenilmeyen sayfa içeriği talimatlar içerir. agent bunları okur. agent bunları yürütür. Herkese açık örnekler: 2024 Kai Greshake ve diğerleri, 2025 Tainted Memories makalesi, 2026 HashJack (Cato Networks).
2. **URL parçası / sorgu enjeksiyonu.** Taranan bir URL'nin `#fragment` veya sorgu dizesi komutlar içerir. Hiçbir zaman gözle görülür şekilde işlenmedi; hâlâ agent bağlamının içinde.
3. **Bellek bağlama saldırıları.** Sayfa, agent'a kalıcı bir bellek yazması talimatını verir (Ders 12, dayanıklı durumu kapsar). Bir sonraki oturumda bellek, görünür bir tetikleyici olmaksızın yükü ateşler.
4. **Kimliği doğrulanmış oturumlara CSRF şeklinde saldırılar.** Tainted Memories sınıfı: agent bir yere giriş yapmış; saldırganın sayfası, agent'ın kullanıcının çerezleriyle yürüttüğü durum değiştirme isteklerini yayınlıyor.
5. **Tek tıklamayla kaçırma.** Görsel olarak zararsız bir düğme, agent'ın takip ettiği bir yükü çalıştırır. Kuyruklu yıldız sınıfı.
6. **agent'ın ana bilgisayar yüzeyindeki İçerik-Güvenlik-Politikası delikleri.** Oluşturma ve araç katmanlarının kendileri saldırı vektörleri olabilir; tarayıcıdaki tarayıcıagent yığını geniştir.

### Neden "tamamen yamalanabilir değil"

Saldırı, agent'ın yeteneğine izomorfiktir. agent işini yapabilmek için güvenilmeyen içeriği okumalıdır. agent'ın okuduğu herhangi bir içerik talimat içerebilir. agent'ın izlediği herhangi bir talimat, kullanıcının gerçek isteğiyle yanlış hizalanmış olabilir. Savunmalar (güven sınırları, sınıflandırıcılar, araç izin verilenler listeleri, sonuçsal eylemlere ilişkin HITL) saldırının maliyetini artırır ve patlama yarıçapını azaltır. Sınıfı kapatmıyorlar.

Bu, Lob teoremi (Ders 8) ile aynı akıl yürütme modelidir: agent sonraki token'ın güvenli olduğunu kanıtlayamaz; yalnızca güvensiz token'larin daha tespit edilebilir olduğu bir sistem kurabilir.

### Aslında gönderilen savunma duruşu

- **Okuma/yazma sınırı.** Okuma hiçbir zaman sonuca bağlı değildir. Yazmak (bir form göndermek, içerik yayınlamak, yan etkileri olan bir aracı çağırmak), eğer başlatıcı içerik güven sınırının dışından geliyorsa, yeni insan onayı gerektirir.
- **Görev başına araç izin verilenler listesi.** agent göz atabilir; söz konusu araç görev için açıkça etkinleştirilmedikçe banka havalesi başlatamaz. Ders 13 bütçeleri kapsar.
- **Oturum izolasyonu.** Tarayıcı agent oturumu yalnızca kapsamlı kimlik bilgileriyle çalıştırılır. Üretim kimlik doğrulaması yok, kişisel e-posta yok. Denetim için tutulan her HTTP isteğinin günlükleri.
- **İçerik temizleyici.** Getirilen HTML, model bağlamıyla birleştirilmeden önce bilinen kötü kalıplardan arındırılır. (Kolay saldırıları azaltır; karmaşık yükleri durdurmaz.)
- **Sonuçsal eylemlerde HITL.** Teklif et-sonra taahhüt et modeli (Ders 15).
- **Kanarya token hafızadadır.** Bir hafıza girişi tetiklenirse kullanıcı bunu görür (Ders 14).

## Use It — Hazır Araçla Uygula

`code/main.py` , üç sentetik sayfaya karşı çalışan küçük bir tarayıcıyı (agent) modeller. Bir sayfa zararsız, birinde görünür metinde doğrudan prompt-enjeksiyon bloğu var, birinde bir URL-parçası enjeksiyonu var (görünmüyor ama agent'ın bağlamı içinde). Komut dosyası (a) saf bir agent'ın ne yapacağını, (b) okuma/yazma sınırının neyi yakaladığını, (c) bir temizleyicinin neyi yakaladığını, (d) ikisinin de neyi yakalayamadığını gösterir.

## Ship It — Kullanıma Sun

`outputs/skill-browser-agent-trust-boundary.md` önerilen tarayıcının kapsamını belirler -agent deployment: hangi güven bölgelerine dokunduğunu, neleri yazma yetkisine sahip olduğunu ve ilk çalıştırmadan önce hangi savunmaların mevcut olması gerektiğini.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Temizleyicinin hangi saldırıyı yakaladığını ancak okuma/yazma sınırının yakalamadığını ve hangi saldırının yalnızca okuma/yazma sınırını yakaladığını belirleyin.

2. Temizleyiciyi, HashJack tarzı URL parçası eklemenin bir sınıfını tespit edecek şekilde genişletin. Meşru parçalara sahip iyi huylu URL'lerdeki yanlış pozitif oranını ölçün.

3. Bildiğiniz gerçek bir tarayıcı-agent iş akışını seçin (e.g., "uçuş rezervasyonu"). Her okunan ve yazılan her şeyi listeleyin. Hangi yazanın HITL'e ihtiyacı olduğunu ve nedenini işaretleyin.

4. WebArena Onaylı ICLR 2026 makalesini okuyun. Orijinal WebArena'nın puanlamasının güvenilmez olduğu bir görev kategorisini tanımlayın ve Doğrulanmış alt kümesinin bunu nasıl çözdüğünü açıklayın.

5. Tarayıcı-agent ayarı için bir bellek kanaryası tasarlayın. Neyi, nerede saklarsınız ve alarmı ne tetikler?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Dolaylı prompt enjeksiyon | "Kötü sayfa metni" | agent'ın okuduğu bir sayfadaki güvenilmeyen içerik, agent'ın yürüttüğü talimatları içerir |
| Lekeli Anılar | "Bellek saldırısı" | Agent, saldırganın sağladığı talimatı dayanıklı belleğe yazar; sonraki oturumu tetikledi |
| HashJack | "URL parçası saldırısı" | URL parçasında/sorgu dizesinde gizlenen yük, agent bağlamında yer alıyor ancak görünür şekilde oluşturulmuyor |
| Tek tıkla kaçırma | "Kötü düğme" | Görünür uygunluk, agent'ın yürüttüğü bir takip yükünü beraberinde getirir |
| GözatComp | "Web araması benchmark" | Açık web'de belirli gerçekleri bulma; dakika ölçekli ufuk |
| İşletim Sistemi Dünyası | "Masaüstü benchmark" | Tam işletim sistemi kontrolü; çok adımlı GUI görevleri |
| WebArena Onaylı | "Sabit web görevi benchmark" | ServiceNow'un Sabit alt kümesiyle yeniden düzenlenen WebArena |
| Okuma/yazma sınırı | "Yan etki kapısı" | Okumak hiçbir zaman sonuç doğurmaz; içerik güvenilmezse yazı yazmak için yeni onay gerekir |

## Daha Fazla Okuma

- [OpenAI — ChatGPT ile Tanışın agent](https://openai.com/index/introducing-chatgpt-agent/) — Operatör ile derin araştırmanın birleşimi; GözatComp SOTA.
- [OpenAI — Bilgisayar Kullanımı Agent](https://openai.com/index/computer-using-agent/) — Operatör nesli ve ChatGPT agent haline gelen mimari.
- [Zhou ve ark. — WebArena](https://webarena.dev/) — orijinal benchmark.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) — ICLR 2026 sabit alt kümeli makale.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — bilgisayar kullanımı agent'lar için saldırı yüzeyi tartışmasını içerir.
