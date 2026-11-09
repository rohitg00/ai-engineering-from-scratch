# Kendini İyileştirmek İçin Sınırlı Tasarımlar

> Araştırmalar, kendi kendini geliştirme döngüsünü sınırlamak için dört ilkeler üzerinde birleşmiştir. Her düzenlemede kalması gereken resmi değişkenler. Düzeltme demirleri değiştirilmez. Sadece performans değil, her boyut (güvenlik, adillik, dayanıklılık) ile uyumlu olmak zorunda olan çok amaçlı kısıtlamalar. Tarihsel ölçümler kapasite kaybını gösterdiğinde döngüyü durduran gerileme algısı. Bunların hiçbiri güvenlik kanıtı değildir  bilgi teorik sonuçları (Kolmogorov karmaşıklığı, Lob teoremi) herhangi bir sistemin kendi halefleri hakkında kanıtlayabileceği şeyi bağladı. Bunlar sessiz başarısızlığın maliyetini artıran hafifletmeler.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## Sorun

Ders 7'nin yarış simülatörü, küçük oran farklarının büyük boşluklara karıştığını gösterdi. Ders 4'ün DGM vaka çalışması, döngelerin kendi değerlendicilerini aktif olarak oynayabileceğini gösterdi. Her iki sonuç da aynı mühendislik sorusuna işaret ediyor: Kendini geliştirme döngüsüne hangi kısıtlamaları koyulabilir ki kısıtlamalar döngüsün kendisi tarafından sessiz olarak zayıflatılamaz?

ICLR 2026 RSI Atölyesi özetinde (openreview.net/pdf?id=OsPQ6zTQXV) bu tür dört primitif tanımlanır. Anthropic'in RSP v3.0 (Desin 19) ve DeepMind'in FSF v3 (Desin 20) her ikisi de onları kapasite eşiğinde belirtir. Meta HyperAgents çalışmaları ve SAHOO (Mart 2026) gibi topluluk çerçeveleri üretimdeki alt kümeleri uyguluyor.

Dürüst çerçeveleme: bunlar hafiflemeler. Bilgi teorisi sonuçları herhangi bir sistemin kendi varisi hakkında kanıtlayabileceği şeyleri bağlar ve hiçbir mevcut tasarım sorunu resmi olarak kapatmaz. İyi sınırlı bir döngü sınırsızdan daha güvenli, mutlak anlamda güvenli değildir.

## Anlaşım

### İlkel 1: resmi değişkenler

Değişmeyen bir özellik, her kendi kendini değiştirmeden önce ve sonra tutması gereken bir özeldir.

- Üretim dağılımı sabit bir yapı başlığı ile koşullandırılır (Desin 17).
- Hiçbir araç çağrısı yetkisiz bir son noktaya gitmez.
- Hatıra yazıları kayıtlı, imzalı bir yoldan geçer.
- Değerlendirici modül hash onaylanmış sürümle eşleşir.

Değişiklikler dış kodla kontrol edilir. döngü düzenleyemez. Önerilen bir değişiklik bir invariantı ihlal ederse, reddedilmektedir. Bu DGM tarzı değerlendirici-düzeltme modunu yakalar (Desin 4).

Zor kısmı, güvenliğe gerek olan ve makul bir zamanda hesaplanabilen invariantları seçmektir. Aşırı spesifikasyon stall ilerlemesini sağlar; az spesifikasyon, döngüye önemli özelliklerin geçtiğini sağlar.

### Primitive 2: Düzeltme demirleri

Bir uyum demirleme, döngünün temel hedefinin değişmez bir temsilidir, döngünün düzenleme yüzeyinin dışında sabitlenir. Örnekler:

- Her çağrıda sadece okunabilir bir yerden yüklenen anayasa metni (Daahi 17).
- Bazarlama kontrolü bağımsız bir depoda değerlendirici.
- Bir insan tarafından imzalanan ve her bir döngüde tekrar doğrulanmış bir araç izni manifesti.

Anker rolü objektif sürüklenmeyi önlemektir. Çapka hedefi takip etme yöntemini iyileştirebilir, ancak hedefin ne olduğunu düzenleyemez.

Anchor'un düzenlemesi mümkün olmayan bir demir halka, yine de demir halka okumasında hareket eden bir demir halka tarafından yeniden yorumlanabilir. Anayasa AI (Desin 17) açıkça yeni durumları ele almak için mantık tabanlıdır; bu mantık tabakası yorum sürümünün yaşadığı yerdir. Ankerler gerekli, yeterli değildir.

### İlkel 3: Çok amaçlı kısıtlamalar

Tek bir skalar skorunu optimize eden bir döngü kısa yollar bulacaktır.

- Performans (tüm görev düzeyinde referans değerleri)
- Güvenlik (kırmızı ekip değerlendirmeleri, bilinen kötü olanlara karşı reddedilme oranı)
- Düzgünlük (hissedici alt gruplar için farklı etki sınırı)
- Güçlülik (OOD test setleri, karşılaşma girişleri ile işlenme)

Bir değişiklik sadece her kısıtlama geçerli olursa kabul edilir. Ders 13'ün mali kısıtlamalarla birlikte maliyet yöneticisi bunu toplar. Ders 18'in Llama Gardi güvenli bir ekseni olarak bağlanır.

### Primitif 4: Regresi tespit

Her döngünün puanları tarihsel dağılımlara karşı karşılaştırılır. Yapılandırılmış toleransın ötesinde bir düşüş döngüyü durdurur. Bu, döngü "geçmişte" iyileştirildiği için geçerli ortalama içine emilmiş olan sessiz kapasite kaybını yakalar.

Uygulama: Son N döngülerin görev başına puanlarını saklamak. Her yeni döngü bir görev başına delta hesaplar. Eğer herhangi bir delta bir eşiğin altında düşerse, döngü reddedilmiş ve insan incelemeleri yapılır.

### Bilgi teorisi sınırları

Kolmogorov karmaşıklığı ve Lob teoremi bir sistemin kendisinde kanıtlayabileceği şeylerin üst sınırlarını belirler. Schmidhuber'ın resmi Godel Makinesi (Daavi 4) bu sınırın en yüksekine yöneliktir; kimse önemsiz bir kanıt tamamlamadı. Lob'un sonucu şöyle diyor: Eğer bir sistem kanıtlanabilir şekilde "X yapmam gerektiğini kanıtlarsam X yapacağım" derse, bunu kanıtlamadan X yapacaktır, bilinen bir öz-referans başarısızlığı.

Bu, bizim ilkelerimiz için bir sonuç: güvenlik sorunu kapatamazlar. Sessiz başarısızlığı daha pahalı hale getirirler. Kayıp bir çek'i sessizce atlatacak kötü niyetli veya akıntılı bir döngü şimdi açık bir imzanı daha açık bir şekilde zayıflatmalıdır.

### Çalışmış bir örnek

Bir ajan düzenleme önerisini yapsayalım.

1. Değişmeyen kontroller: modül haşları, araç izinleri manifesti, anayasa başlığı.
2. Anchor check: objektif ifade onaylanmış versiyona (byte veya semantik olarak) uymaktadır.
3. Çok amaçlı değerlendirme: performans, güvenlik, adillik, dayanıklılık ekseleri.
4. Geri dönüş algısı: toleranstan daha fazla bir eksiklik yoktur.

Dörtü de düzenlemeyi geçmeli, herhangi bir başarısızlık döngüyü durdurur.

```figure
bounded-gates
```

## Kullan

`code/main.py`DGM tarzında oyuncaklar üzerinde sınırlı bir kendi geliştirme döngüsü çalıştırır, ancak üstte dört primitif katlanır. Her primitif ayrı ayrı etkinleştirilebilir veya devre dışı bırakılabilir.

## Gönder

`outputs/skill-bounded-loop-review.md`Önerilen sınırlı döngüden bir denetim yaparak, dört ilkelin hangisini uyguladığı ve iddia ettiği değerlendirilir.

## Egzersizler

1. Çık .`code/main.py`Bağlantının, hack'in kazanmasına izin vermeden, birincil metrikte gelişmesini onaylayın.

2. Geri dönüş algısını devre dışı bırak. Bu sessiz kapasite kaybının kabul edilmesine yol açan bir giriş oluşturun.

3. Çok objektif kısıtlama etkinliğini kapat. Bir güvenlik eksesi düşerken, döngü performans eksesi üzerinde birleştiğini göster.

4. Bir kodlama ajanı için bir uyum örgütü tasarlayın.

5. ICLR 2026 RSI Atölyesi özetini okuyun. Dört ilkelden birini seçin ve mevcut teknoloji durumuna somut bir iyileştirme önerin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Daha Fazla Okumak

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) dört primitif yakınlaşma.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Çok amaçlı kapasite eşiği.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) yanıltıcı uyum izlemeyi değişmez bir primitif olarak.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) bu ilkelerin resmi kanıtlı ataları.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) sebeple uyum sağlayan demir.
