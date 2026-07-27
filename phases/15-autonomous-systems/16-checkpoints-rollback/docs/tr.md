# Kontrol Noktaları ve Geri Alma

> Her grafik durumu geçişi devam eder. Bir işçi kaza yaptığında, kira sözleşmesi sona erer ve en son kontrol noktasında başka bir işçi işçiyi alır. Cloudflare Dayanıklı Nesneler, durumunu saatler veya haftalar boyunca korur. Teklif et-sonra-taahhüt (Ders 15), eylem başına bir geri alma planı tanımlar. Eylem sonrası doğrulama döngüyü kapatır. AB Yapay Zeka Yasası Madde 14, yüksek riskli sistemler için etkili insan gözetimini zorunlu kılmaktadır; pratikte bu, kontrol noktalarının sorgulanabilir olması, geri alma işlemlerinin prova edilmesi ve denetim takibinin bir dağıtımdan sonra hayatta kalması gerektiği anlamına gelir. Keskin arıza modu: Belirsizlik anahtarları ve önkoşul kontrolleri olmadan, geçici bir arızadan sonra yapılan yeniden deneme, önceden onaylanmış bir eylemi iki kez çalıştırabilir. Eylem sonrası doğrulama onu yakalayan şeydir.

**Tür:** Öğren
**Diller:** Python (stdlib, kontrol noktası ve geri alma durumu makinesi)
**Önkoşullar:** Aşama 15 · 12 (Kalıcı uygulama), Aşama 15 · 15 (Öner-sonra-taahhüt)
**Süre:** ~60 dakika

## Sorun

Dayanıklı yürütme (Ders 12), çöken bir agent'yi devam ettirilebilir hale getirir. Öner-sonra-taahhüt et (Ders 15) onaylanmış bir eylemi denetlenebilir hale getirir. Bu ders de onlara katılıyor: Onaylanan bir eylem kısmen yürütüldüğünde, çöktüğünde ve devam ettiğinde ne olur? Geri alma ne zaman ve hangi duruma karşı çalışır?

Gerçek sistemler bunu farklı şekilde bağlar:

- **LangGraph** PostgreSQL'e her grafik durumu geçişini kontrol eder. İşçinin çökmesi durumunda kira kontratı iptal edilir ve başka bir işçi en son kontrol noktasında görevine devam eder. İş akışları `interrupt()` üzerinde duraklatılır ve bu durum devam eder.
- **Cloudflare Dayanıklı Nesneler** anahtar başına durumu saatler veya haftalar boyunca korur. Onaylanan eylem için hesaplamayı depolama alanıyla aynı konuma getirin.
- **Microsoft Agent Framework** iş akışı API'sinde `Checkpoint` temel öğelerini kullanıma sunar; tekrar oynatma artı idempotency yeniden denemeleri kapsar.

Her durumda, gerçekten işe yarayan kombinasyon şudur: eşgüdüm anahtarı (çift çalıştırmayı önler) + önkoşul kontrolü (durum hala onayladığımız şeydir) + eylem sonrası doğrulama (yan etki gerçekten gerçekleşti) + doğrulama-başarısızlık durumunda geri alma.

## Konsept

### Her geçiş devam eder

Grafik durumu geçişi, iş akışını adlandırılmış bir durumdan diğerine taşıyan herhangi bir adımdır. Naif uygulamalar yalnızca belirli taahhüt noktalarında devam eder; üretim uygulamaları her geçişte devam eder. Maliyet (ekstra birkaç yazma) güvenilirlik kazancıyla karşılaştırıldığında küçüktür (tekrar oynatma her yerde olur, kira geri kazanımı kesindir).

### Kira geri kazanımı

Bir işçi kaza yaptığında iş akışı kaybolmaz; kira sözleşmesi (bu çalışanın bu çalıştırmayı yürüttüğüne dair kısa süreli bir iddia) sona erer. Başka bir çalışan en son kontrol noktasını alıp devam ediyor. Kiralama mekanizması, üretim sistemlerinin uçuş sırasındaki işleri kaybetmeden sürekli dağıtımlarda hayatta kalmasını sağlayan şeydir.

### Yetkisizlik artı önkoşullar

Idempotency tek başına yeterli değildir. Şunu düşünün: "$100 from A to B when balance > $1000 aktarımı" için bir iş akışı onaylandı. İş akışı kaydedilir, yürütmenin ortasında çöker ve devam eder. Yalnızca kimlik anahtarı işaretlenirse ve yürütme devam ederse aktarım bir kez çalışır (doğru). Ancak çökme ve devam etme arasında A'nın bakiyesinin farklı bir iş akışı yoluyla 500 dolara düştüğünü düşünün. Yeterlilik kontrolü hala başarılı; önkoşul geçerli değildir. Önkoşul kontrolü olmadan, kredili mevduat hesabını gönderiyoruz.

Her sonuçsal eylemin her ikisine de ihtiyacı vardır:

- **Idempotency anahtarı**: çift çalıştırmayı önler.
- **Önkoşul kontrolü**: durumun hâlâ onaylananla tutarlı olduğunu doğrular.

### İşlem sonrası doğrulama

"Araç 200 döndürdü" doğrulama değildir. Gerçek doğrulama, hedef durumu yeniden okur ve gerçekte meydana gelen yan etkiyi doğrular. Desenler:

- Veritabanı güncellemesi: `UPDATE ... RETURNING *` ardından döndürülen satırın amaçlanan durumla eşleştiğini onaylayın.
- E-posta gönderimi: gönderimden sonra mesaj kimliği için gönderilenler klasörünü kontrol edin.
- Dosya yazma: dosyayı geri okuyun ve karma işlemi yapın.
- API çağrısı: hedef kaynakta `GET` takibi.

Doğrulama başarısız olursa iş akışı bilinen bir bozuk durumdadır. Geri alma devreye giriyor.

### Geri alma planları

Öner-sonra-taahhüt etme yöntemindeki (Ders 15) her sonuçta ortaya çıkan eylem bir geri alma planı taşır. Türler:

- **Bant içi geri alma**: yan etkiyi doğrudan tersine çevirir (`INSERT`'den sonra `DELETE`, gönderdikten sonra `Send-correction-email`).
- **Telafi edici işlem**: orijinali (standart SAGA modeli) etkisiz hale getiren yeni bir eylem.
- **Bant dışı geri alma**: Bir insanı uyarır, iş akışını duraklatır, kötü durumu incelemeye bırakır.

İşlem yapılmayan geri alma ("bunu geri alamayız") teklifte belirtilmelidir. Geri almanın olmadığı eylemler, taahhüt zamanında daha güçlü HITL gerektirir (Ders 15 meydan okuma ve yanıt).

### AB AI Yasası Madde 14 operasyonel okuma

Madde 14, yüksek riskli sistemler için "etkili insan gözetimi" gerektirmektedir. Operasyonel açıdan uygulayıcılar bunu şu şekilde okur:

- Kontrol noktaları bir denetçi tarafından sorgulanabilir.
- Geri almaların provası yapılır (en az bir kez uçtan uca test edilir).
- Denetim izi bir dağıtımdan sonra hayatta kalır (kontrol noktası arka ucu geçici değildir).
- Başarısız olan doğrulamalar sessizce günlüğe kaydedilmez, uyarılır.

İşlemin ortasında çöken, devam eden ve doğrulama + geri alma yolu olmadan yan etkiyi tamamlayan bir iş akışı, Madde 14 testinden sağ çıkamaz.

### Keskin başarısızlık modu: çift yürütme

Bu alandaki en yaygın üretim olayı:

1. Eylem onaylandı, geçicilik anahtarı k.
2. Commit başlar, yürütülür ve 200 değerini döndürür.
3. "Taahhüt edildi" durumu sürdürülemeden iş akışı çöküyor.
4. İş akışı devam eder; "onaylandı ancak taahhüt edilmedi" ifadesini görüyor; yeniden yürütür.
5. Yan etki iki kez tetiklenir.

Azaltma: yürütmeden önce "uçuş sırasında" niyetini sürdürün, bir kimliksizlik anahtarıyla yürütün, ardından yalnızca eylem sonrası doğrulama başarılı olduktan sonra "taahhüt edildi" olarak işaretleyin. Eylem tetiklenirse ve durum yazma işlemi başarısız olursa, doğrulamayı ve (gerekirse) yeniden başlatmayı bilirsiniz. Durum yazma işlemi başarılı olursa ve eylem başarısız olursa, kurtarma yolu aracılığıyla tam olarak bir kez doğrular ve harekete geçersiniz.

## Kullan onu

`code/main.py`, eksiklik, önkoşullar, doğrulama ve geri alma ile denetim noktalı bir iş akışı uygular. Sürücü dört senaryoyu simüle eder: temiz çalıştırma, kilitlenmeden sonra yeniden deneme (zamansızlık yakalamaları), önkoşul hatası (iş akışı tetiklenmeden iptal edilir), başarısızlığı doğrulama (geri alma tetiklenir).

## Gönderin

`outputs/skill-rollback-rehearsal.md`, önerilen bir iş akışı için bir geri alma prova testi tasarlar ve denetim izi kalıcılığı açısından kontrol noktası arka ucunu denetler.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Dört senaryoyu doğrulayın. İşleme sırasında kilitlenme durumu için, eylemin yeniden denemelerde tam olarak bir kez tetiklendiğini doğrulayın.

2. "Önce yapıldı olarak işaretle, sonra yap" modelini değiştirerek durum yazma işleminin eylemden sonra gerçekleşmesini sağlayın. Kilitlenme senaryosunu yeniden çalıştırın. Kaç tane yinelenen eylemin tetiklendiğini ölçün.

3. Belirli bir üretim eylemi için bir geri alma planı tasarlayın (e.g., "Slack kanalına gönderme"). Bant içi, telafi edici veya bant dışı olarak sınıflandırın. Seçimi gerekçelendirin.

4. Bildiğiniz bir iş akışını ele alın. Her durum geçişini tanımlayın. Her birini bir dayanıklılık gereksinimiyle işaretleyin (devam ediyor / devam etmiyor). Şu anda ısrar etmediklerinizi sayın.

5. Prova edilmiş geri alma testi: Gerçek bir iş akışını çalıştıran, onu çökerten ve geri alma yolunun tetiklendiğini doğrulayan uçtan uca bir test tasarlayın. Test neyi iddia ediyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|---|---|---|
| Kontrol noktası | "Noktayı kaydet" | Her grafik durumu geçişi, dayanıklı bir depolamaya devam eder |
| Kiralama | "İşçi iddiası" | Bir işçinin bir çalışma yürüttüğüne dair kısa süreli iddia; çökme durumunda sona erer |
| Önkoşul | "Devlet kapısı" | Durumun hâlâ onaylanan eylemle tutarlı olduğuna dair iddia |
| İşlem sonrası doğrulama | "Yeniden okuma kontrolü" | Yan etkinin hedef sistemde gerçekten meydana geldiğini doğrulayın |
| Bant içi geri alma | "Doğrudan geri al" | Ters işlemle yan etkiyi tersine çevirin |
| Telafi edici işlem | "SAGA'yı geri al" | Orijinali etkisiz hale getiren yeni bir eylem |
| İlk önce tamamlandı olarak işaretle | "Durum yazma sırası" | Taahhütten dönmeden önce taahhüt durumunu sürdürün |
| Madde 14 | "AB Yapay Zeka Yasası insan gözetimi" | Operasyonel: sorgulanabilir kontrol noktaları, prova edilmiş geri dönüşler, denetlenebilir izleme |

## Daha Fazla Okuma

- [Microsoft Agent Framework — Denetim Noktası Oluşturma ve HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — Denetim noktası temel öğeleri ve kira kurtarma.
- [Cloudflare Agents — Döngüdeki insan](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — Durum alt katmanı olarak Dayanıklı Nesneler.
- [AB AI Yasası — Madde 14: İnsan gözetimi](https://artificialintelligenceact.eu/article/14/) — düzenleyici temel.
- [Antropik — agent özerkliğinin pratikte ölçülmesi](https://www.anthropic.com/research/measuring-agent-autonomy) — uzun ufuklu iş akışları için güvenilirlik çerçevesi.
- [Antropik — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — Claude Code Rutinleri için iş akışı şekli.
