# Kontrol noktaları ve geri dönüş

> Her grafik-devlet geçişi devam ediyor. Bir işçi kaza yaparsa, kira sözleşmesi geçerli olur ve son kontrol noktasında başka bir işçi onu alır. Cloudflare Durable Objects saatler veya haftalar boyunca durumunu korur. Teklif-sonra-tümlenme (Disim 15) her eylem için bir gerileme planı tanımlar. Eylem sonrası doğrulama döngüyü kapatır. AB AI Yasası'nın 14. maddesi yüksek riskli sistemler için etkili insan denetimini zorunlu kılıyor  bu, pratikte kontrol noktalarının sorgulanabilir olması, geri dönüşlerin prova edilmesi ve denetim yolunun bir dağıtımdan geçmesi gerektiği anlamına geliyor. Keskin bir başarısızlık modusu: İdempotency anahtarları ve ön koşul kontrolleri olmadan geçici bir başarısızlıktan sonra yeniden deneme, zaten onaylanmış bir eylemin iki katına çıkabilir. İşten sonra doğrulama onu yakalar.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## Sorun

Sürekli yürütme (Durable execution) (Lection 12) bir çökmüş ajanı yeniden başlatabilir hale getirir. Önerilen-sonra-otlama (Lection 15) onaylanmış bir eylemin denetlenebilir hale getirir. Bu ders onlara katılır: onaylanmış bir eylem kısmen yürütüldüğünde, çöktüğünde ve yeniden başlatıldığında ne olur?

Gerçek sistemler bunu farklı şekilde gösterir:

- **LangGraph**PostgreSQL'e yapılan her grafik durumu geçişini kontrol noktaları kontrol eder. İşçi çöktüğünde, kira sözleşmesi serbest bırakılır ve bir diğer işçi en son kontrol noktasında yeniden başlar. İş akışları duraklama yapar.`interrupt()`, ki bu da devam ediyor.
- **Cloudflare Durable Objects**Saatler veya haftalar boyunca anahtar durumunu tutun. Bilgisayarı onaylanmış eylem için depolama ile birlikte yerleştirin.
- **Microsoft Agent Framework**Açıklamalar`Checkpoint`iş akışı API'sinde primitifler; tekrarlama artı idempotency tekrar denemeleri kapsar.

Her durumda, gerçekten işe yarayan kombinasyon: idempotency anahtarı (iki katı çalıştırmayı önler) + ön koşul kontrolü (devlet hala onayladığımız şey) + eylem sonrası doğrulama (ayrı etki gerçekten oldu) + doğrulama başarısızlığı üzerine geri dönüş.

## Anlaşım

### Her geçiş devam ediyor .

Grafik-devlet geçimi, iş akışını bir isimli devletteki diğerine taşıyan herhangi bir adımdır. Saçma uygulamalar sadece belirli görev noktalarında kalır; üretim uygulamalar her geçişte kalır. Maliyet (bazı ekstra yazılar) güvenilirlik kazancı ile görece küçüktür (replay herhangi bir yerde yer alır, kiralama kurtarımı doğru olur).

### Kiralama geri kazanımı

Bir işçi kaza olduğunda, iş akışı kaybolmaz; kiralama (bu işçinin bu çalışmayı gerçekleştirdiğini kısa süredir iddia eden) sadece sona erer. Bir başka işçi en son kontrol noktasını alır ve yeniden başlar. Kiralama mekanizması üretim sistemlerinin uçuşta çalışmalarını kaybetmeden süren yerleşimlerde hayatta kalmasına izin verir.

### İdempotence artı ön koşullar

Sadece idempotency yeterli değildir.$100 from A to B when balance > $1000. " İş akışı yapılır, çalıştırma ortasında çöker ve devam eder. Eğer idempotency anahtarı kontrol edilirse ve çalıştırma devam ederse, transfer bir kez çalışır (tam). Ancak çökme ve devam arasında A'nın bakiyesinin farklı bir iş akışı aracılığıyla 500 dolara düştüğünü düşünün. Idempotency kontrolü hala geçer; ön koşul değil. Ön koşul kontrolü olmadan, bir ödemek göndeririz.

Her sonuçlı eylem her iki şeye de ihtiyaç duyar:

- **Idempotency key**: ikili işlenmeyi önler.
- **Precondition check**: devletin hala onaylananlara uygun olduğunu doğruluyor.

### Eylem sonrası doğrulama

"Yalnızca 200'e geri döndürülmüş" doğrulama değildir. Gerçek doğrulama hedefi yeniden okuyor ve yan etkisi gerçekte meydana geldiğini doğruluyor.

- Veritabanı güncelleştir: `UPDATE ... RETURNING *`Sonra geri gönderilen satır eşleşmelerinin istenen durumunu belirtir.
- E-posta gönderme: gönderilen mesaj kimliği için gönderilen klasörü kontrol edin.
- Dosya yazma: dosyayı tekrar oku ve hash et.
- API çağrısı: takip `GET`hedef kaynağı.

Eğer doğrulama başarısız olursa, iş akışı bilinen kötü bir durumdadır.

### Rollback planları

Teklif sonra görev (Desin 15) her sonuçta bir geri dönüş planı vardır.

- **In-band rollback**: yan etkisini doğrudan tersine çevir (`DELETE`Sonra .`INSERT`- Evet .`Send-correction-email`gönderildikten sonra).
- **Compensating transaction**: orijinalini (standart SAGA modelini) nötralize eden yeni bir eylem.
- **Out-of-band rollback**İnsanı uyar, iş akışını durdur, kötü durumu araştırmaya bırak.

Bu konuda bir değişiklik yapılması gerekmektedir. "Bu durumu geri çeviremeyiz" ("bu durumu geri çeviremeyiz") öneride belirtilmelidir.

### AB AI Yasası 14 . madde İşlemsel okuma

Madde 14 yüksek riskli sistemler için "verimli insan denetimi" gerektirir.

- Kontrol noktaları bir denetçi tarafından sorulabilir.
- Rollback'ler prova edilir (en az bir kez sonundan sona test edilir).
- Denetim izleri bir dağıtımdan geçiyor (checkpoint backend geçici değildir).
- Başarısız doğrulamalar uyarılır, sessiz olarak kaydedilmez.

Verify + rollback yolu olmadan görev sırasında çökmüş, yan etkeni yeniden başlatan ve tamamlayan bir iş akışı, Madde 14 testi boyunca hayatta kalmaz.

### Keskin bir arıza modusu: çift çalıştırma

Bu alanda en yaygın üretim olayı:

1. Hareket onaylandı, idempotency key k.
2. Başlatma, yürütme, 200'e geri dönüş.
3. İş akışı "altınlık" durumunu sürdürmeden önce çöküyor.
4. İş akışı devam eder; "önlendirildi ama commit edilmedi" görür; yeniden yürütülür.
5. Yan etkisi iki kez ateş eder.

Yumuşatma: yürütmeden önce "uçuşta" bir niyeti sürdürün, idempotency anahtarıyla yürütün, sonra "yürüttük" işaretini sadece eylem sonrası doğrulama başarısız olduğunda işaretleyin. Eylem ateşleri ve durum yazısı başarısız olursa, doğrulama ve (gerekirse) yeniden ateş etmeyi biliyorsunuz. Eğer durum yazısı başarılı olursa ve eylem başarısız olursa, kurtarma yolu üzerinden tam olarak bir kez doğrulayıp ateş edersiniz.

```figure
checkpoint-replay
```

## Kullan

`code/main.py`Sürücü dört senaryoyu simüle eder: temiz çalışmak, kaza sonrası yeniden denemek (idempotency catch), ön koşul başarısızlığı (iş akışı ateşlemeden düşürülür), başarısızlığı doğrulayın (rollback fire).

## Gönder

`outputs/skill-rollback-rehearsal.md`önerilen bir iş akışı için bir geri dönüş prova testi tasarlar ve denetim yolunun devamlılığı için kontrol noktasının arka planını denetler.

## Egzersizler

1. Çık .`code/main.py`Dört senaryoyu kontrol edin, kaza sırasında olayda, tekrar denemeler sırasında bir kez ateş açıldığını doğrulayın.

2. "İlk önce işlendiği gibi işaretle, sonra yap" örneğini değiştirin, böylece durum hareketi sonrasında ateşler yazır. Çarpışma senaryosunu tekrarlayın. Ne kadar ikili hareketi ateşlediğini ölçün.

3. Özel bir üretim eyleminin (örneğin "Slack kanalına gönderme") bir geri dönüş planı tasarlayın.

4. Bildiğiniz bir iş akışı alın. Her durum geçimini belirleyin. Her birini dayanıklılık gereksinimleri ile işaretleyin (durdurmak / devam etmemek). Şu anda devam etmemekte olduğunuzları sayın.

5. Tekrar tekrarlı geri dönüş testi: gerçek bir iş akışı çalıştırmak, bozulmak ve geri dönüş yolunun ateşini doğrulayan bir uçtan sona test tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Daha Fazla Okumak

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Kontrol noktaları ve kiralama geri kazanımı.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) Durumlu nesneler bir devlet altyapısı olarak.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) düzenleyici başlangıç.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Uzun vadede iş akışları için güvenilirlik çerçevesini oluşturmak.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) Claude Code Routines için iş akışı şekli.
