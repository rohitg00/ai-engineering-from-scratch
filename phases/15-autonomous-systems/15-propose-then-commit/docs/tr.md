# Döngüdeki İnsan: Öner-Sonra-Taahhüt Et

> HITL ile ilgili 2026 konsensüsü spesifiktir. "agent sorar, kullanıcı Onayla'ya tıklar." Teklif et-sonra-taahhüt yöntemidir: teklif edilen eylem, bir geçicilik anahtarıyla dayanıklı bir depoda sürdürülür; niyet, veri kökeni, dokunulan izinler, patlama yarıçapı ve geri alma planıyla birlikte bir incelemecinin karşısına çıktı; yalnızca olumlu onay alındıktan sonra taahhüt edilir; yan etkinin gerçekten meydana geldiğini doğrulamak için uygulamadan sonra doğrulandı. LangGraph'ın `interrupt()` artı PostgreSQL kontrol noktası oluşturması, Microsoft Agent Framework'nin `RequestInfoEvent`'si ve Cloudflare'in `waitForApproval()` 'sinin tümü aynı şekli uygular. Kurallı arıza modu, onay damgasıdır: "Onaylanıyor mu?" inceleme yapılmadan tıklanır. Belgelenen hafifletme yöntemi, açık bir kontrol listesiyle yapılan sorgulama ve yanıttır.

**Tür:** Öğren
**Diller:** Python (stdlib, bağımsız teklif-sonra-taahhüt durum makinesi)
**Önkoşullar:** Aşama 15 · 12 (Dayanıklı uygulama), Aşama 15 · 14 (Tetikleme Telleri)
**Süre:** ~60 dakika

## Sorun

Bir agent bir eylem gerçekleştirir. Kullanıcının karar vermesi gerekir: onaylayıp onaylamaması. Karar anında veriliyorsa bu muhtemelen bir inceleme değildir. Karar yapılandırılmışsa yavaş ama güvenilirdir. Mühendislik sorusu, en az dirençli yolun yapılandırılmış bir incelemesinin nasıl yapılacağıdır.

2023 dönemi HITL modeli eşzamanlı bir prompt idi: "Agent X'e Y gövdesiyle e-posta göndermek istiyor — onaylıyor musunuz?" Kullanıcı Onayla'ya tıklar. Herkes sistemin güvenli olduğunu düşünüyor. Uygulamada bu yüzey büyük ölçüde lastik damgalıdır: kullanıcılar hızlı onay verir, onaylar çok az şey öngörür ve agent yanlış gittiğinde denetim izi, kullanıcının hatırlayamayacağı uzun bir onay geçmişini gösterir.

2026 modeli (öner-sonra-taahhüt) HITL'yi dayanıklı bir alt tabakaya taşır, yapılandırılmış meta veriler ekler ve pozitif taahhüt gerektirir. Yönetilen her agent SDK bir sürüm gönderir: LangGraph `interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`. API adları farklıdır; şekil öyle değil.

## Konsept

### Öner-sonra-taahhüt durum makinesi

1. **Öner.** Agent önerilen bir eylemi üretir. Dayanıklı bir depoda ısrar edildi (PostgreSQL, Redis, Dayanıklı Nesne). Şunları içerir:
- niyet (agent bunu neden yapıyor)
- veri kökeni (bu öneriye hangi kaynak yol açtı)
- dokunulan izinler (hangi kapsamları/dosyaları/uç noktaları)
- patlama yarıçapı (en kötü durum nedir)
- geri alma planı (eğer taahhüt edildiyse bunu nasıl geri alırız)
- idempotency anahtarı (teklif başına benzersiz; yeniden gönderim aynı kaydı döndürür)
2. **Yüzey.** İnceleyen, teklifi tüm meta verilerle birlikte görür. İncelemeyi yapan kişi bir kişidir (kendisini inceleyen agent değil).
3. **Taahhüt.** Olumlu onay. Eylem yürütülür.
4. **Doğrulayın.** Yürütmeden sonra yan etki tekrar okunur ve onaylanır. Doğrulama adımı başarısız olursa sistem bilinen bir kötü durumda demektir ve uyarı devreye girer.

### İdempotency anahtarı

İdempotency anahtarı olmadan, geçici bir hatanın ardından yapılan yeniden deneme, onaylanmış bir işlemin iki kez yürütülmesine neden olabilir. Somut örnek: kullanıcı "A'dan B'ye 100 ABD doları transferini" onaylar. Ağ kesintileri. İş akışı yeniden denemeler yapar. Kullanıcı bir kez onayladı ancak aktarım iki kez gerçekleştirildi. İdempotans anahtarı, onayı tek ve benzersiz bir yan etkiye bağlar; ikinci infaz operasyon dışıdır.

Bu, Stripe ve AWS API'lerinin kullandığı aynı yetkisizlik modelidir. agent onayları için yeniden kullanılması Microsoft Agent Framework belgelerinde açıkça belirtilmiştir.

### Dayanıklılık: neden onaylar süreçlerden daha uzun sürüyor?

Onay bekleme odası, agent'ın sahip olmadığı bir devlet parçasıdır. İş akışı duraklatıldı (Ders 12). Onay geldiğinde iş akışı tam olarak bu noktadan devam eder. LangGraph'ın `interrupt()` 'yi yalnızca bellek içi durumla değil, PostgreSQL kontrol noktasıyla eşleştirmesinin nedeni budur; iki gün sonraki bir onayda iş akışı yine de sağlam bulunur.

### Onaylar ve sorgulama ve yanıtın hafifletilmesi

HITL için varsayılan kullanıcı arayüzü ("Onayla" / "Reddet" düğmeleri), gerçek bir inceleme olmadan hızlı onaylar üretir. Belgelenmiş azaltma: Onayla düğmesi etkinleştirilmeden önce belirli sorulara olumlu yanıtlar gerektiren bir sorgulama ve yanıt kontrol listesi. Beton şekli:

- "Bunun hangi kaynağa dokunduğunu anlıyor musunuz? [ ]"
- "Patlama yarıçapının kabul edilebilir olduğunu doğruladınız mı? [ ]"
- "Bu başarısız olursa geri alma planınız var mı? [ ]"

Bürokrasinin kendisi değil, zorlayıcı bir işlevi var. Kutuları işaretleyemeyen incelemeci ya açıklama ister (yükseltme) ya da reddeder (güvenli varsayılan). Antropik agent-güvenlik araştırması, kontrol listesi odaklı HITL'in, onay modellerine yönelik bir hafifletme yöntemi olduğunu açıkça belirtiyor.

### Neler sonuç olarak sayılır?

Her eylemin öner-sonra-taahhüt etmesi gerekmez. 2026 kılavuzu:

- **Ardışık eylemler** (her zaman HITL): geri döndürülemez yazma işlemleri, finansal işlemler, giden iletişim, üretim veritabanı değişiklikleri, yıkıcı dosya sistemi işlemleri.
- **Geri döndürülebilir eylemler** (bazen HITL): yerel dosyalarda düzenlemeler, hazırlama ortamı değişiklikleri, net geri alma ile geri döndürülebilir yazmalar.
- **Okumalar ve incelemeler** (hiçbir zaman HITL değil): bir dosyayı okuma, kaynakları listeleme, salt okunur bir API'yi çağırma.

### İşlem sonrası doğrulama

"Taahhüt gerçekleşti" ile "yan etki oluştu" aynı şey değil. Ağ bölümü ve yarış koşulları, arka uç devam etmezken başarılı olduğunu düşünen bir iş akışı üretebilir. Doğrulama adımı, onaylamayı taahhüt ettikten sonra hedef kaynağı yeniden okur. Bu, `RETURNING` yan tümceleri veya `PutObject`'den sonra AWS `GetObject` içeren veritabanı işlemleriyle aynı kalıptır.

### AB AI Yasası Madde 14

Madde 14, AB'deki yüksek riskli yapay zeka sistemleri için etkili insan gözetimini zorunlu kılmaktadır. "Etkili" dekoratif değildir. Düzenleyici dil özellikle damga kalıplarını hariç tutar. Soru-cevap ile teklif et-sonra-taahhüt, Microsoft Agent Yönetişim Araç Takımı uyumluluk belgelerindeki 14. Madde incelemesinden sağ çıkan şekildir.

## Use It — Hazır Araçla Uygula

`code/main.py` , stdlib Python'da bir öner-sonra-taahhüt durum makinesini uygular. Dayanıklı mağaza bir JSON dosyasıdır. Idempotency anahtarı (thread_id, action_signature)'ın bir karmasıdır. Sürücü üç durumu simüle eder: temiz bir onay akışı, geçici hatadan sonra yeniden deneme (iki kez çalıştırılmaması gerekir) ve bir sorgulama ve yanıt akışına karşı varsayılan bir lastik damgası.

## Ship It — Kullanıma Sun

`outputs/skill-hitl-design.md` , teklif et-sonra-taahhüt şekli için önerilen bir HITL iş akışını inceliyor ve eksik meta veriler, belirsizlik, doğrulama veya sorgulama ve yanıt katmanlarını işaretliyor.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Onaylanmış bir teklifin yeniden denenmesinin kalıcı kaydı kullandığını ve yeniden yürütülmediğini doğrulayın. Şimdi idempotency anahtarını bir zaman damgası içerecek şekilde değiştirin ve yeniden deneme çift çalıştırmalarını gösterin.

2. Teklif kaydını bir `rollback` alanıyla genişletin. Doğrulama adımı başarısız olan bir yürütmeyi simüle edin. Geri almanın otomatik olarak etkinleştiğini göster.

3. Microsoft Agent Framework'nin `RequestInfoEvent` belgelerini okuyun. API'nin içerdiği ve oyuncak motorunun eksik olduğu bir meta veri alanı belirleyin. Bunu ekleyin ve neye karşı koruduğunu açıklayın.

4. Belirli bir eylem için bir sorgulama ve yanıt kontrol listesi tasarlayın (e.g., "herkese açık bir Twitter hesabına gönderi yayınlama"). İncelemeyi yapan kişinin hangi üç soruyu yanıtlaması gerekir? Neden bu üçü?

5. Eşzamanlı bir "Onaylanıyor musunuz?" sorusunun olduğu bir durum seçin. prompt yeterli olacaktır (dayanıklı depoya gerek yoktur). Nedenini açıklayın ve kabul ettiğiniz risk sınıfını adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Öner-sonra-taahhüt | "İki aşamalı onay" | Kalıcı teklif + olumlu taahhüt + doğrulama |
| İdempotency anahtarı | "Yeniden deneme güvenli token" | Teklif başına benzersiz; ikinci infaz işlemsiz |
| Veri kökeni | "Nereden geldi?" | Teklife yol açan spesifik kaynak içeriği |
| Patlama yarıçapı | "En kötü durum" | Eylemin ters gitmesi durumunda etkinin kapsamı |
| Lastik damgası | "Hızlı onay" | Gerçek inceleme yapılmadan "Onayla" tıklandı |
| Meydan Okuma ve Yanıt | "Kontrol listesini zorlama" | İncelemeyi yapan kişi belirli soruları olumlu bir şekilde kabul etmelidir |
| TalepBilgiOlay | "MS Agent Framework ilkel" | Yapılandırılmış meta verilere sahip dayanıklı HITL isteği |
| `interrupt()` / `waitForApproval()` | "Framework ilkeller" | LangGraph / Cloudflare aynı şeklin eşdeğerleri |

## Daha Fazla Okuma

- [Microsoft Agent Framework — Döngüdeki insan](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — `RequestInfoEvent`, kalıcı onaylar.
- [Cloudflare Agent'ler — Döngüdeki insan](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — `waitForApproval()` ve Dayanıklı Nesneler.
- [Antropik — Uygulamada agent özerkliğinin ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — Uzun vadeli risklerin azaltılması için HITL.
- [AB Yapay Zeka Yasası — Madde 14: İnsan gözetimi](https://artificialintelligenceact.eu/article/14/) — yüksek riskli sistemler için düzenleyici temel çizgi.
- [Antropik — Claude Anayasası (Ocak 2026)](https://www.anthropic.com/news/claudes-constitution) — gözetim etrafında anayasal çerçeve.
