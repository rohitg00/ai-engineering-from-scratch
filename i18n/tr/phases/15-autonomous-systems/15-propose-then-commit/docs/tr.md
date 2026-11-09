# İnsanlık: Teklif Yapın ve O halde Yaptık

> HITL konusunda 2026 yılındaki konsensüs spesifiktir. Bu "evlat soruyor, kullanıcı onay tıklıyor". değildir. Bu önerilen-sonra-yüzdür: önerilen eylem idempotency anahtarı ile dayanıklı bir depoya devam eder; niyet, veri soy, dokunan izinler, patlama radyüsü ve geri dönüş planı ile bir inceleyicinin önüne çıkarılır; sadece olumlu onaylandıktan sonra yapılır; yan etkinin gerçekleştiğini doğrultmak için uygulandıktan sonra doğrulanır. LangGraph'in `interrupt()`Ayrıca PostgreSQL kontrol noktası, Microsoft Agent Framework'ın `RequestInfoEvent`, ve Cloudflare'ın `waitForApproval()`Bu yöntemin en iyi yöntemleri ise, aynı şekil ile uygulanmasıdır. Kanonik başarısızlık modunda kauçuk damgası onaylaması bulunur: "Onurlandır?" üzerinde inceleme yapmadan tıklanır. Belli bir hafifleme açık bir kontrol listesi ile meydan okuma ve yanıtlama yapılır.

**Type:** Learn
**Languages:** Python (stdlib, propose-then-commit state machine with idempotency), TypeScript
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 14 (Tripwires)
**Time:** ~60 minutes

## Sorun

Bir ajan bir eylem yapar. Kullanıcı karar vermek zorunda: onaylamak veya onaylamamak. Eğer karar anlık ise, muhtemelen bir inceleme değildir. Eğer karar yapılandırılmış ise, yavaş ama güvenilirdir. Mühendislik sorusu, yapılandırılmış bir incelemeyi en az direniş yoluna nasıl yönlendireceğidir.

2023 çağının HITL örneği eşzamanlı bir istekti: "Ajent Y  onaylı vücut ile X'ye e-posta göndermek istiyor mu?" Kullanıcı onayla tıklıyor. Herkes sistemin güvenli olduğunu düşünüyor.

2026 modeli  öner-sonra görev  HITL'i dayanıklı bir altyapıya taşıyor, yapılandırılmış metadata bağlıyor ve pozitif görev gerektirir.`interrupt()`, Microsoft Agent Framework `RequestInfoEvent`, Cloudflare `waitForApproval()`API isimleri farklıdır, şekli değil.

## Anlaşım

### Önerilen ve sonra görevlendirilmiş devlet makinesi

1. **Propose.**Agent, önerilen bir eylem üretir. Sürdürülebilir bir depoya (PostgreSQL, Redis, Durable Object) devam eder.
   - Niyet (ajan neden bunu yapıyor)
   - Veriler soyundan (bu önermeye hangi kaynak yol açtı)
   - dokunan izinler (ne alanlar / dosyalar / son noktalar)
   - patlama radyüsü (en kötü durum nedir)
   - Geri dönüş planı (eğer yapılmışsa, nasıl geri çeviriyoruz)
   - İdepotans anahtarı (tekrar bir önerme; yeniden gönderme aynı kayıtları gönderir)
2. **Surface.**Eleştirmen, teklifi tüm metadata ile görüyor. Eleştirmen bir insandır (öntemsel eleştiren değil).
3. **Commit.**- İstihbarat onaylandı.
4. **Verify.**İptal sonrasında yan etki tekrar okunuyor ve onaylanıyor. Eğer doğrulama adımı başarısız olursa, sistem bilinen kötü bir durumdadır ve uyarı etkinleştirir.

### İdempotency anahtarı

İdempotency anahtarı olmadan geçici bir başarısızlıktan sonra yeniden deneme onaylanmış bir eylemin iki katına uygulanabilir. Konkret örnek: kullanıcı "A'dan B'ye 100 dolar aktarmayı" onaylar. Ağ blipleri. İş akışı tekrar denemeler. Kullanıcı bir kez onayladı ancak aktarım iki kez yürütülür. İdempotency anahtarı onayı tek, benzersiz bir yan etkiye bağlar; ikinci yürütme bir işlemizdir.

Bu aynı idempotency örneği Stripe ve AWS API'ler kullanır. Ajan onayları için tekrar kullanmak Microsoft Ajan Çerçeve belgeleri açıkça belirtilmiştir.

### Süreklilik: neden onaylamalar sürecinden daha uzun sürer

Onaylama bekleme odası, ajanın sahip olmadığı bir durum parçasıdır. İş akışı durur (Denevi 12). Onaylama geldiğinde, iş akışı tam olarak o noktadan yeniden başlar. Bu nedenle LangGraph çiftleşir `interrupt()`PostgreSQL kontrol noktası ile ve sadece hafıza durumu değil  bir onay iki gün sonra hala iş akışı sağlam bulur.

### Kağız damgası onayları ve meydan okuma ve yanıt azaltma

HITL için varsayılan kullanıcı arayüzü ("Onaylayın" / "Refut" düğmeleri) gerçek bir inceleme olmadan hızlı onaylar üretir. Belli hafifleme: Onaylayın düğmesi etkinleştirilmeden önce belirli sorulara olumlu cevaplar gerektiren bir meydan okuma ve yanıt kontrol listesi.

- "Bu ne kaynakla ilgili olduğunu anlıyor musun?"
- "Patlama radyüsünün kabul edilebilir olduğunu doğruladın mı?"
- "Bu başarısız olursa geri dönüş planınız var mı?

Bu, birincil olarak bir işverenin bir diğer işverenin yaptığı bir çalışma olarak görülür. Bu çalışma, birincil olarak bir işlev olarak kullanılır.

### Sonuç olarak neyin önemli olduğu

Her eylemde önerilen ve sonra yapılan bir şey gerekmez.

- **Consequential actions**(her zaman HITL): geri dönüşü olmayan yazılar, finansal işlemler, dışa giden iletişim, üretim veritabanı değişiklikleri, yıkıcı dosya sistemleri operasyonları.
- **Reversible actions**(bazen HITL): yerel dosyalara düzenlemeler, aşamalama-env değişiklikleri, net bir geri dönüş ile geri dönüşlü yazılar.
- **Reads and inspections**(never HITL): bir dosyayı okumak, kaynakları listelenmek, sadece okuma API'yi arama.

### Eylem sonrası doğrulama

"Commit ran" " yan etkisi oldu" ile aynı değildir. Ağ partisyonu ve yarış koşulları, arka uç devam etmeden başarılı olduğunu düşünen bir iş akışı oluşturabilir. Verify adımı, onaylama için commit edildikten sonra hedef kaynağı yeniden okuyor. Bu, veri tabanı işlemleri ile aynı kalıptır `RETURNING`Sözleşmeler veya AWS `GetObject`Sonra .`PutObject`- Evet .

### AB AI Yasası 14 Maddesi

14. madde, AB'deki yüksek riskli Yapay zeka sistemleri için etkili insan denetimi zorunluyor. "Etkili" dekoratif değildir. Yönetim dili özellikle kauçuk damga desenlerini dışlıyor.

```figure
mx-propose-then-commit
```

## Kullan

`code/main.py`Stdlib Python'da bir önerme-sonra-yaptırma durum makinesi uyguluyor. Durable store bir JSON dosyası. Idempotency anahtarı bir hash (thread_id, action_signature) dir. Sürücü üç vaka simüle eder: temiz onay akışı, geçici başarısızlıktan sonra yeniden deneme (iki kat çalıştırılamaz) ve bir kağız damgası varsayılan karşı bir meydan okuma ve yanıt akışı.

## Gönder

`outputs/skill-hitl-design.md`önerilen HITL iş akışını gözden geçirir. Bu durumda, metadata eksikliği, idempotency, verifikasyon veya meydan okuma ve yanıt katmanları için önerilen ve işlenilen biçim ve işaretler.

## Egzersizler

1. Çık .`code/main.py`- Onaylanmış bir önerinin yeniden deneme süresi, dayanıklı kayıt kullanıldığını ve tekrar yürütülmediğini onaylayın.

2. Teklif kayıtlarını bir  ile uzatmak`rollback`Verification adımının başarısız olduğu bir işlem simülasyonu yapın.

3. Microsoft Agent Framework'ı okuyun `RequestInfoEvent`Bir metadata alanı belirleyin. API'de oyuncak motoru eksik olduğunu belirtir.

4. Bir belirli eylem için bir meydan okuma ve yanıt kontrol listesini oluşturun (örneğin "ağcı bir Twitter hesabına gönderin").

5. "Tamamlayın" diye bir çağrılı sorunun yeterli olabileceği bir durum seçin (kalıcı bir depo gerekmez). Nedenini açıklayın ve kabul ettiğiniz risk sınıfını isimlendirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Propose-then-commit | "Two-phase approval" | Persisted proposal + positive commit + verify |
| Idempotency key | "Retry-safe token" | Unique per proposal; second execution no-ops |
| Data lineage | "Where it came from" | The specific source content that led to the proposal |
| Blast radius | "Worst case" | Scope of effect if the action goes wrong |
| Rubber-stamp | "Fast approval" | "Approve" clicked without genuine review |
| Challenge-and-response | "Forcing checklist" | Reviewer must positively acknowledge specific questions |
| RequestInfoEvent | "MS Agent Framework primitive" | Durable HITL request with structured metadata |
| `interrupt()` / `waitForApproval()` | "Framework primitives" | LangGraph / Cloudflare equivalents of the same shape |

## Daha Fazla Okumak

- [Microsoft Agent Framework — Human in the loop](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) `RequestInfoEvent`, kalıcı onaylar.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) `waitForApproval()`Ve Kalıcı Nesneler.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) HITL uzun vadede riskin azaltılması olarak.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) Yüksek riskli sistemler için düzenleyici bir temel.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) denetim ile ilgili anayasa çerçevesini oluşturmak.
