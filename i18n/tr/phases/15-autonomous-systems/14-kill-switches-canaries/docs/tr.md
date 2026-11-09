# Çıkartıcıları, Çıkartıcıları ve Kanarya Tokenlerini Kaldır

> Bir kill switch, ajanın düzenleme yüzeyinin dışında tutulan bir boolean  bir Redis anahtarı, bir özellik bayrağı, imzalanmış bir yapılandırma  aracı tamamen devre dışı bırakır. Bir devrim kesici daha ince bir biçimdir: belirli bir örneğe (bir sırada beş aynı araç çağrısı) çarpır, saldırgan yolu durdurur ve bir insana kadar tırmanır. Bir kanary token klasik aldatmaca miras alınır: bir ajanın dokunmak için yasal bir nedeni olmayan sahte bir kimlik veya balık kayıtları, erişimi uyarıyı tetikler. eBPF tabanlı veri yolları (örneğin: Cilium) karantinalı bir kapsülün çıkışını çekirdek katmanındaki bir adli tıbbi balıkçıya yeniden yazabilir; yayınlanan Cilium referansları yük altında sub-millisecond P99 veri yolu gecikmesini rapor eder (gelişme bütçeniz, bir politika güncelleme nodu nasıl ulaştığına bağlıdır, veri yolu kendisi değil). Hareketli bir temel çizgiye uyum sağlayan istatistik algılayıcılar (EWMA, CUSUM) sessizce hareket etmesini kabul eder  onları eğilmeyen sert anayasa sınırları ile katlar.

**Type:** Learn
**Languages:** Python (stdlib, three-detector simulator: kill switch, circuit breaker, canary), TypeScript
**Prerequisites:** Phase 15 · 13 (Cost governors), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## Sorun

Ücret yöneticileri (Denevi 13) ajanın harcayabileceği maliyeti sınırlı tutarlar. Ücretli bir ajanın bütçe içinde yapabileceği şeyleri sınırlamıyorlar. 50 dolarlık bir hız sınırı olan bir ajan hala bir sırrı sızdırır, yanlış bir yazı yayınlar veya bir kaynağı siler.

Bu ders, maliyet katmanının yanında bulunan üç detektörü kapsar:

1. **Kill switch**: Boolean off-button ajanın erişimi dışında tutuldu.
2. **Circuit breaker**: belirli bir yolu durduran hareket modelini algılayıcı.
3. **Canary token**Dokunmak için yasal bir neden olmayan bir ajanın dokunarak kendini ortaya çıkaracağı yem.

Üçü de LLM öncesi mühendisliktir. Klasik aldatma, hız sınırları kırıcıları ve özellik bayrağı öncesinde özerk ajanları öldürür. Yeni olan saldırı yüzeyi: ajanlar güvenilmeyen içeriği okuyor (Desin 11), kendi hafızasını düzenler ve birçok güvenli görünen eylemleri güvenli olmayan birine yazabilir. Burada adı geçen dedektörler, ajanın kendi raporuna güvenmedikleri için çalışır.

## Anlaşım

### Öldürme anahtarları

Bir kill switch, ajanın okuduğu ama yazabileceği bir boolean'dır. Uygulama seçenekleri:

- **Feature flag in a managed service.**Açılış, Karanlık, Statsig, Çıkış.
- **Redis key the agent polls.**Basit; ajanın her dönüşte kontrol etmesini gerektirir.
- **Signed config in object storage.**Ajan, imzaları kontrol ederken imzalamayan devletleri reddeder.
- **OS-level signal or container-lifecycle kill.**Docker `kill`, Kubernetes `kubectl delete pod`- Sistem durdu.

Doğru öldürme anahtarının özellikleri:

- Ajan ayarlayamaz .`off`(Agentin kimlik belgeleri yazılmayan bir sistemde yaşıyor.)
- Sadece başlatma sırasında değil, sonuçta yapılacak her bir eylemde kontrol edilir.
- Kapalı olduğunda, ajan dışarıdan gözlemlenebilir hiçbir şey yapmaz, örneğin ajanın ulaşabildiği sistemlere kayıt yaptırır.
- Tekrar etkinleştirmek açıkça insan eylemidir, otomatik bir zaman kesimi değil.

### Çeviri kesicileri

Bir devreler kesici, tüm ajanı değil, belirli bir örneği durdurur. Klasik şekil (2007 Nygard kitabı, hala mevcut):

- **Closed**: eylem kabul edilir.
- **Open**: eylem engellenmiştir.
- **Half-open**: soğutma sonrasında 13 probe denemesi izin verilir (devayla 1); başarıyla kesicisi kapatılır, kalan herhangi bir hata yeniden açılır.

Ajanla ilgili tetikleyiciler:

- Bir sırada beş aynı araç çağrısı (sıradan döngü).
- Aynı araçta farklı girişlerle (sistemik hata) beş ardıcıl hata.
- Araç çağrılarının hızı bir eşiğin üzerinde (Düşünme 13. hız)
- İstihbaratın kullanıldığı özel araç (örneğin: `file.delete`) güven dışı bir içeriği okuduktan sonra (Desin 11).

### Kanarya tokenleri

Kanarya tokeni (hayırlık tokenler de denir) ajanın asla dokunmaması gereken girişlerdir.

Ajanlar için örnekler:

- Sahte bir .`AWS_SECRET_ACCESS_KEY`Bu yüzden, bu durumun bir parçası olarak, bu durumun bir diğer tarafı da var.
- Bilinen bir sentinel değeriyle işaretlenen sahte bir veritabanı kaydı.
- İş alanında sahte bir dosya var. Bu dosyanın okunması ya da düzenlenmesi şüpheli.
- Oturum başlatıldığında enjekte edilen sahte bir bellek girişidir.

Kanarya tasarımının iş akışına özel olması için, bir kanarya ajanın dokunmak için meşru bir nedeni olan gürültüdür.

### Neden istatistik ve sert sınırları kat

İstatistik detektörler (EWMA, CUSUM, araç çağrı oranlarındaki z-score) hareketli bir temel çizgiye uyarlar. Bu meşru sürükleme için bir özellik ve karşıtlık sürükleme için bir hata.

"Hiçbir zaman e-posta gönderme"`secrets@`"Bir anayasa kuralı olarak daha basit, denetlenir ve yavaş sürükleyerek oynanamaz.

### Karantin, eBPF veri yolunun yönlendirmesi yoluyla

Cilium'un eBPF tabanlı ağ politikası karantinalı bir kapsülün çekirdek katmanındaki adli tıbbi bir balı çömlekine çıkışını yeniden yazabilir. Cilium'un kamu referansları TCP_RR'de alt milisecond P99 veri yolu gecikmesini bildirir; küme içinde karantinayı * tetiklemek için duvar saatinin bütçesi, bir politika güncelleme yönlendirme düzeyinden düğümüne nasıl yayıldığına (operatör önceden yüklenmiş olan Kubernetes'te birkaç yüz milisecond gerçekçi; kuyru gecikmesi küme boyutuna ve uyumlu kadenceye bağlıdır). Bu size iki şey verir: ajan gerçek bir şey çıkarmaz ve ajanın bal kavanozu içinde davranışları tam olarak gözlemlenir. Aynı desen, farklı katman, Kanarya işaretine benzer: ajan, içindeki şeyle niyetini ortaya çıkarır.

### Hiçbir dedektörün yakalamadığı şey

- **Semantic attacks that compose from allowed primitives.**Her bireysel eylem her detektörü geçer; kompozisyon sorundur. Bu, Ders 10'dan otomatik mod kompozisyon başarısızlığı.
- **Attacks that include the detector as part of the payload.**Bir ajan "harekete geçmeden önce, kanaryayı devre dışı bırak" yazılı bir sayfayı okuyorsa ve ajanın bu yeteneği varsa, detektör bozulur.

```figure
circuit-breaker
```

## Kullan

`code/main.py`Üç detektör aracılığıyla kısa bir ajan yörüngesini simüle eder. Dış bir dikte tutulan bir öldürme anahtarı; aynı beş araç çağrısında çarpışan bir devrim kesicisi; bir kanary dosyası okudukları bir uyarıyı tetikler. Sintez bir yörüngede beslenir: meşru eylemler, tekrarlayıcı döngü, kanary sonda ve öldürme anahtarı tetiklenen bir senaryo.

## Gönder

`outputs/skill-tripwire-design.md`bir ajanın dağıtılması için önerilen bir detektör pilini gözden geçirir ve boşlukları işaretler (kayıp öldürme anahtarı, kayıp kanarya, devreler kesici eşiği çok gevşek).

## Egzersizler

1. Çık .`code/main.py`- 7. virajda (beşinci aynı çağrı) ve 9. virajda (sahte anahtar okuyucu) kanarya yangınlarını onaylayın.

2. Statistik bir detektör ekleyin: EWMA z-notı araç çağrı hızında. yavaş hareket eden bir yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldaki yoldki yoldki yoldki yoldki yoldki yoldki yoldki yoldki yoldki yoldki yold

3. Bir tarayıcı aracı için bir kanarya simgesi oluşturun (Deneyim 11).

4. Cilium ağ politika belgeleri okuyun. Çıkış-önerleştirici karantin akışını konkret olarak açıklayın: hangi politika seçicisi, hangi kapsül, hangi çıkış yeniden yazıyor, hangi uyarı. Duvar saatini "karantinaya karar vermek"ten "ilk yönlendirilmiş paket"e ne yönlendirir?

5. Killing-Switched ajanı için yeniden etkinleştirme prosedürünü tanımlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Kill switch | "Off button" | Boolean outside the agent's edit surface; checked on every consequential action |
| Circuit breaker | "Pattern pause" | Action-specific trip on repetition, failure rate, or rate-limit |
| Canary token | "Honeytoken" | Bait the agent has no legitimate reason to touch; access fires an alert |
| Honeypot | "Forensic sandbox" | Redirected traffic / workspace where a quarantined agent is observed |
| EWMA | "Moving average" | Exponentially weighted; adapts to drift (feature + bug) |
| CUSUM | "Cumulative sum" | Detects sustained shift from baseline |
| Hard limit | "Constitutional rule" | Does not adapt; constant regardless of history |
| Constitutional limit | "Always-true rule" | Tied to Lesson 17's constitution; cannot be edited by the agent |

## Daha Fazla Okumak

- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) özerk ajanlar için öldürme anahtarı ve devresi kesicisi çerçevesini.
- [Microsoft Agent Framework — HITL and oversight](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) üretim yönetimi modelleri.
- [OWASP LLM / Agentic Top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/) tespit ve yanıt gereksinimleri.
- [Cilium — Network policy and eBPF](https://docs.cilium.io/en/stable/security/network/) Kapak seviyesindeki çıkış yönlendirme ve adli tıbbi balıkçılık kalıpları.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) sert kodlanmış yasaklar "anayasa sınırları" olarak.
