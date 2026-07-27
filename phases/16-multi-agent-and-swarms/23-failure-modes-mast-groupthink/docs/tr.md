# Başarısızlık Modları — MAST, Grup Düşüncesi, Monokültür, Basamaklı Hatalar

> 2026 için referans sınıflandırması **MAST**'dır (Cemri ve diğerleri, NeurIPS 2025, arXiv:2503.13657), **%41-86,7 başarısızlık oranını** gösteren 7 son teknolojiye sahip açık kaynaklı MAS'taki 1642 yürütme izinden türetilmiştir. Üç kök kategori: **Şartname Sorunları** (%41,77) — rol belirsizliği, belirsiz görev tanımları; **Koordinasyon Arızaları** (%36,94) — iletişim kesintileri, durum uyumsuzluğu; **Doğrulama Boşlukları** (%21,30) — eksik doğrulama, eksik kalite kontrolleri. **Groupthink** ailesi (arXiv:2508.05687) şunları ekler: monokültürün çöküşü (aynı temel model → ilişkili başarısızlıklar), uygunluk yanlılığı (agent'lar birbirlerinin hatalarını güçlendirir), yetersiz zihin teorisi, karışık motivasyon dinamikleri, basamaklı güvenilirlik başarısızlıkları. Basamaklı örnek: bir ödeme başarısızlığının sipariş yeniden denemelerini tetiklediği, envanter yeniden denemelerini tetikleyen ve envanter hizmetini zorlayan yeniden deneme fırtınaları (saniyede 10 kat yük - devre kesicilere ihtiyaç vardır). Bellek zehirlenmesi: bir agent'ın halüsinasyonu paylaşılan belleğe girer, aşağı yöndeki agent'lar bunu gerçekmiş gibi ele alır; Doğruluk yavaş yavaş azalarak temel neden teşhisini acı verici hale getirir. **STRATUS** (NeurIPS 2025), özel tespit/teşhis/doğrulama agent'lar yoluyla azaltma başarısında 1,5 kat artış olduğunu rapor ediyor. Bu derste arıza modları birinci sınıf mühendislik hedefleri olarak ele alınmaktadır.

**Tür:** Öğren
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 13 (Paylaşılan Bellek), Aşama 16 · 14 (Uzlaşı ve BFT), Aşama 16 · 15 (Oylama ve Tartışma Topolojisi)
**Süre:** ~75 dakika

## Sorun

Çoklu-agent sistemler gerçek görevlerde %41-86,7 oranında başarısız oluyor (Cemri ve diğerleri 2025 bunu 7 açık kaynaklı MAS'ta ölçtü). "Sadece daha fazla agent ekleyin" ile hata ayıklanamaz. Başarısızlıkların yapısal nedenleri vardır. MAST taksonomisi size kategorileri verir. Bu derste her bir kategori somut bir tespit, teşhis ve hafifletme modeliyle eşleştirilir, böylece sayılar keyfi görünmeye son verilir.

2026 üretim uygulaması, arıza türlerini tasarım girdileri olarak ele almaktır. Her MAST kategorisine işaret edene ve dağıttığınız azaltıcı önlemi adlandırana kadar mimariniz "yeterince iyi" değildir.

## Konsept

### MAST kategorileri

**Şartname Sorunları (başarısızlıkların %41,77'si).** agent'ın görevi yeterince sıkı tanımlanmamış. Örnekler:

- Rol belirsizliği: iki agent her ikisi de kendilerinin inceleyen olduğunu düşünüyor.
- Görev yeterince belirtilmedi: Kullanıcı belirli bir açı istediğinde "bunu özetleyin".
- Başarı kriterleri örtülü: agent başarılı olup olmadığını söyleyemez.

Azaltmalar:
- Açık rol sözleşmeleri yazın. Her agent'ın prompt'si onun ne yaptığını *ve ne yapmadığını* belirtir.
- Görev başına kabul testleri. agent başlamadan önce, "tamamlanan X'e benziyor" ifadesini tanımlayın.
- Uçuş öncesi spesifikasyon kontrolü: ayrı bir agent, gönderilmeden önce görev tanımını inceler.

**Koordinasyon Arızaları (%36,94).** İletişim veya durum arızaları.

Örnekler:
- İki agent, senkronizasyon olmadan paylaşılan durumu günceller.
- agent saniyeler arasında mesaj kaybı (sıra hatası, zaman aşımı).
- Durum kayması: agent A görevin tamamlandığını düşünüyor; agent B hâlâ çalışıyor.

Azaltmalar:
- İyimser eşzamanlılıkla sürümlendirilmiş paylaşılan durum.
- Kritik mesajlar için açık onay (onaylanana kadar tekrar deneyin).
- Periyodik durum senkronizasyonu kontrol noktaları; sürüklenmeyi erken tespit edin.

**Doğrulama Boşlukları (%21,30).** Çıkışlarda bağımsız kontrol yok.

Örnekler:
- Bir agent başarılı olduğunu iddia ediyor; kimse doğrulamıyor.
- agent zincirinin her biri öncekinin çıktısına güveniyor.
- Ortaya çıkan oluşturulan davranışta test kapsamı eksik.

Azaltmalar:
- Bağımsız doğrulayıcı agent (Ders 13). Salt okunur, bağımsız kaynak erişimi.
- Açık devir sözleşmesi: "A'nın çıktısı, B başlamadan önce C denetleyicisini geçmelidir."
- Post-hoc analiz için sonuç kaydı.

### Groupthink ailesi (arXiv:2508.05687)

agent'lar birbirini homojenleştirdiğinde veya taklit ettiğinde ortaya çıkan beş ilgili hata:

**Tek kültür çöküşü.** Aynı temel model veya eğitim verileri → ilişkili hatalar. Üç agent bir yüksek lisansı paylaştığında, onun halüsinasyonlarını da paylaşırlar.

**Uygunluk önyargısı.** Agent'lar, yanlış olsa bile en gürültülü veya kendine en çok güvenen akranlarına göre uyum sağlarlar.

**Eksik ZK.** Agentler birbirlerinin inançlarını modellemede başarısız olurlar; koordinasyon bozulur (Ders 18).

**Karma motivasyon dinamikleri.** Kısmen uyumlu teşviklere sahip Agent'ler orta uzlaşmaya doğru sürüklenir ve bu da kimseyi tatmin etmez.

**Kademeli güvenilirlik hataları.** Bir bileşenin hata modeli, bağımlı bileşenlerdeki hata modellerini tetikler.

### Basamaklı örnek — yeniden deneme fırtınası

Klasik bir 2026 olay modeli:

```
payment service fails 10% of requests
   ↓
order agent retries payment (exponential backoff but naive)
   ↓
each retry is a new order-inventory check
   ↓
inventory service sees 2x normal load
   ↓
inventory service starts timing out
   ↓
every order retries inventory check
   ↓
inventory service sees 10x normal load
   ↓
cluster goes down
```

Çözüm klasik: **devre kesiciler**. Aşağı akış hata oranı eşiği aştığında, önbelleğe alınmış veya varsayılan sonuçlarla kısa devre yapın. Ayrıca istek başına sınırlı yeniden deneme bütçeleri.

Devre kesiciler, herhangi bir değişiklik yapmadan doğrudan dağıtılmış sistemlerden ödünç alabileceğiniz birkaç çoklu-agent arıza azaltma yönteminden biridir.

### Bellek zehirlenmesi (yeniden ziyaret edildi)

13. Dersten itibaren: bir agent'ın halüsinasyonu paylaşılan hafıza gerçeğine dönüşür; aşağı yöndeki agent'ın zehirli gerçekle ilgili nedeni. MAST açısından bu, paylaşılan bellek katmanındaki bir doğrulama boşluğudur.

Kademeli doğruluk kaybı semptomdur. Bir kaza yaşamazsınız; Kök nedenini bulmak zor olan yavaş bir sürüklenme yaşarsınız.

Azaltma: salt ekleme günlüğü, kaynak, yazılamaz doğrulayıcı. Zaten Ders 13'te ele alınmıştı.

### STRATUS — arıza tespiti için özel agent'lar

STRATUS (NeurIPS 2025), dağıtım yaptığınızda azaltma başarısında 1,5 kat artış olduğunu bildirir:

- **Algılama agent.** Belirti modellerini izler (yüksek anlaşmazlık, yeniden deneme ani artışları, doğruluk sapması).
- **Tanı agent.** Semptomlar göz önüne alındığında, MAST sınıflandırmasından olası temel nedeni çıkarır.
- **Doğrulama agent.** Azaltma uygulandıktan sonra belirtilerin giderilip giderilmediğini kontrol eder.

Bu, agent sistemlerine uygulanan SRE tarzı olay yanıtıdır. Üç rolün tümü, uzmanlaşmış prompt'lara sahip LLM agent'lar olabilir.

### Arıza modu denetimi

2026'nın en iyi uygulaması, yıllık (veya ana sürüm başına) bir arıza modu denetimidir:

1. **İzleme örneği.** ~1000 gerçek yürütme izini toplayın.
2. **Kategorize edin.** Her izlemenin başarısızlığını MAST + Groupthink kategorileriyle eşleştirin.
3. **Kategori bazında hesaplama hatası oranı.** Sisteminizde hangi kategoriler hakim?
4. **Sıralama azaltımları.** Hangi düzeltme en fazla başarısızlığı ortadan kaldırır?
5. **2-3 azaltım seçin.** Uygulayın; gelecek çeyrekte yeniden denetim yapın.

Disiplin, belirli seçimlerden daha önemlidir. Denetimler olmadan, hatalar gürültüye karışır ve hiçbir zaman sistematik olarak ele alınmaz.

### Sistemler sessizce arızalandığında

En tehlikeli hata kategorisi sessiz doğruluk hatasıdır. Yüksek sesle arızalanan bir sistem (çökme, istisna, uyarı) izlenebilir. Makul ancak yanlış çıktılar üreten bir sistem, istisna günlükleri tarafından tespit edilemez. Bu nedenle doğrulama boşlukları sayıca yalnızca %21,30 olmasına rağmen başarısızlık başına en pahalı kategoridir.

Yatırım yapın:
- Örnek bazlı insan incelemesi.
- Altın-dataset regresyon testleri.
- Önemli çıktıların çaprazagent çapraz kontrolü.

### Başarısızlık ve yavaş başarısızlık

Bazı başarısızlıklar anında gerçekleşir; bazıları yavaştır. Ani hataların (zaman aşımı, şema uyumsuzluğu, kimlik doğrulama hatası) tespit edilmesi ucuzdur. Yavaş başarısızlıkların (bellek zehirlenmesi, monokültür sapması, rol belirsizliği) tespit edilmesi ve önlenmesi pahalıdır.

2026'nın mühendislik hamlesi: yavaş arıza proxy'lerini kullanın, böylece sürüklenmeyi görünür bir hata haline gelmeden yakalayabilirsiniz. Anlaşma oranı, yeniden deneme oranı, çıktı uzunluğu dağılımı ve ardışık agent sürümleri arasındaki düzenleme mesafesinin tümü yararlı proxy'lerdir.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `FailureTaxonomy` — simüle edilmiş olayları MAST + Groupthink kategorilerine göre sınıflandırır.
- `CircuitBreaker` — klasik desen; Hata oranı eşiği aştığında açılır.
- `RetryStormSimulator` — basamaklı arızayı gösterir; devre kesiciyi açar/kapatır.
- `DetectionAgent` — kodlu STRATUS tarzı semptom eşleştirici.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı:
- devre kesici olmadan fırtınayı yeniden deneyin: envanter hataları ortaya çıkar (simüle edilmiştir).
- devre kesicili: eşikteki kapak; azaltılmış mod yanıtları sunuldu.
- algılama agent modeli işaretler ve MAST kategorisini adlandırır.

## Use It — Hazır Araçla Uygula

`outputs/skill-mast-auditor.md` , çokluagent sisteminde MAST tarzı bir hata modu denetimi çalıştırır. İzler → kategorizasyon → azaltma sıralaması.

## Ship It — Kullanıma Sun

Üretimde arıza modu disiplini:

- **Üç ayda bir MAST denetimi.** Yıllık değil. Sisteminiz büyüdükçe kategoriler değişir.
- **Her yerde devre kesiciler.** Herhangi bir bağımlı hizmete giden her çağrı. %5-10 hata oranında varsayılan açık eşik.
- **Altın dataset'ler.** Küçük, yüksek kaliteli, elle denetlenmiş. Onlara karşı haftalık regresyon testi yapın.
- **STRATUS üçlüsü.** Tespit + Teşhis + Doğrulama agent'ın üretimi izlemesi. Yalnızca agent tespiti ile başlayın; semptomlar gürültülü olduğunda tanıyı ekleyin.
- **Başarısızlık bütçesi.** Kategoriye göre başarısızlık oranı için açık SLO. Bütçenin aşılması, gönderimin durdurulması görüşmesini tetikler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Devre kesicinin yeniden deneme fırtınasını kapattığını doğrulayın. Başarısızlık eşiğini değiştirin ve ödünleşimi gözlemleyin.
2. **yavaş hata proxy'sini** uygulayın: 3 paralel agent'ta anlaşma oranı. Keskin bir şekilde düştüğünde bir uyarı tetikleyin. agent çıktılarını kademeli olarak ilişkilendirerek monokültür sürüklenmesini simüle edin.
3. Cemri ve ark.'yı okuyun. (arXiv:2503.13657). 7 MAS sisteminden birini seçin ve ilk 3 arıza kategorisinin haritasını çıkarın. Bunlar MAST'ın tahminleriyle nasıl karşılaştırılıyor?
4. Groupthink makalesini okuyun (arXiv:2508.05687). Üretimde beş modelden hangisinin tespit edilmesinin en zor olduğunu belirleyin. Bir proxy metriği önerin.
5. Bildiğiniz belirli bir çoklu-agent sistemi için STRATUS tarzı bir tespit-teşhis-doğrulama üçlüsü tasarlayın. Tespit hangi semptomları izler? Teşhis hangi hafifletme önlemlerini önerir? Doğrulama bunların çalıştığını nasıl doğrular?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| DİREK | "2026 sınıflandırması" | Cemri 2025; 3 kök kategori + 14 alt hata türü. |
| Şartname Sorunu | "Rol belirsizliği" | Görev veya rol yeterince tanımlanmamış; agent'lar ne yapacaklarını bilmiyorlar. |
| Koordinasyon Arızası | "Devlet kayması" | agent'lar arasındaki iletişim veya senkronizasyon dökümü. |
| Doğrulama Boşluğu | "Kimse kontrol etmedi" | Çıktılar bağımsız doğrulama olmadan kabul edilir. |
| Groupthink ailesi | "Homojenlik başarısızlıkları" | Monokültür, uyumluluk, ZK eksikliği, karışık motivasyon, basamaklı. |
| Monokültürün çöküşü | "Aynı model, aynı halüsinasyonlar" | Paylaşılan temel modelden veya eğitim verilerinden ilişkili hatalar. |
| Fırtınayı yeniden dene | "Basamaklı hata amplifikasyonu" | Bir başarısızlık, aşağı yöndeki yükü artıran yeniden denemeleri tetikler. |
| Devre kesici | "Hata oranında hızlı başarısız olun" | Hata oranı eşiği aştığında açılır; varsayılan olarak kısa devre. |
| STRATUS | "Olay müdahale üçlüsü" | Tespit + teşhis + doğrulama agents. 1,5 kat azaltma başarısı. |
| Hafıza zehirlenmesi | "Halüsinasyonlar yayılıyor" | Paylaşılan hafıza gerçeği lekelendi; aşağı yöndeki agent'ın zehirle ilgili nedeni. |

## Daha Fazla Okuma

- [Cemri ve ark. — Çoklu-Agent Yüksek Lisans Sistemleri Neden Başarısız Olur?](https://arxiv.org/abs/2503.13657) — MAST taksonomisi, NeurIPS 2025
- [Çokluagent LLM'deki grup düşüncesi başarısızlıkları](https://arxiv.org/abs/2508.05687) — monokültür, uyumluluk ve beş aile sınıflandırması
- [STRATUS — MAS olay müdahalesi için özel agent'lar](https://neurips.cc/) — NeurIPS 2025 işlem girişi (tespit + teşhis + doğrulama)
- [Bırak onu! — kararlılık modelleri (Nygard)](https://pragprog.com/titles/mnee2/release-it-second-edition/) — kurallı devre kesici referansı
- [Antropik — Çoklu-agent araştırma sistemi](https://www.anthropic.com/engineering/multi-agent-research-system) — üretim hatası modu notları
