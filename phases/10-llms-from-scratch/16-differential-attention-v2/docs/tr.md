# Diferansiyel Dikkat (V2)

> Softmax dikkati, eşleşmeyen her token üzerine küçük bir miktar olasılık yayar. 100.000'den fazla token bu gürültüyü topluyor ve sinyali boğuyor. Diferansiyel Transformer (Ye ve diğerleri, ICLR 2025), dikkati iki softmax'ın farkı olarak hesaplayarak, paylaşılan gürültü tabanını çıkararak bunu düzeltir. DIFF V2 (Microsoft, Ocak 2026), üretim yığınının yeniden yazılmasıdır: kod çözme gecikmesini temel Transformer ile eşleştirme, özel çekirdek yok, FlashAttention uyumlu. Bu ders, stdlib Python'da çalıştırabileceğiniz fark işleminin çalışan bir oyuncak uygulamasıyla V1'den V2'ye uçtan ucadır.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 7 · 02 (öz dikkat), Aşama 7 · 15 (dikkat çeşitleri), Aşama 10 · 14 (mimariye geçiş)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Softmax dikkatinin neden bir gürültü tabanına sahip olduğunu ve bağlam uzunluğuyla birlikte neden büyüdüğünü tam olarak belirtin.
- Diferansiyel dikkat formülünü türetin ve çıkarma işleminin, sinyali korurken neden paylaşılan gürültü bileşenini iptal ettiğini açıklayın.
- V1'den V2'ye farkını yürüyün: ne daha hızlı oldu, ne daha basit, ne daha kararlı hale geldi ve her değişikliğin üretim öncesi eğitimi için neden gerekli olduğu.
- Saf Python'da diferansiyel dikkati sıfırdan uygulayın ve sentetik bir sinyal artı gürültü sorgusunda gürültü engelleme özelliğini ampirik olarak doğrulayın.

## Sorun

Standart softmax dikkatinin, ölçekte operasyonel bir baş ağrısına dönüşen matematiksel bir özelliği vardır. `q` sorgusu için dikkat ağırlıkları `softmax(qK^T / sqrt(d))`'dir. Softmax asla tam sıfırlar üretemez; eşleşmeyen her token bir miktar pozitif kütle alır. Bu artık kütle gürültüdür ve bağlam uzunluğuna göre ölçeklenir. 128k token'de, eşleşmeyen her token olasılığın yalnızca %0,001'ini alsa bile, bunların 127.999'u toplamın yaklaşık %12'sine katkıda bulunur. Modelin bağlamla birlikte büyüyen bir gürültü tabanının etrafından dolaşmayı öğrenmesi gerekiyor.

Ampirik olarak bu, dikkat-kafa müdahalesi olarak ortaya çıkıyor: uzun bağlamlı RAG'de halüsinasyonlu alıntılar, 100k-token alma görevlerinde ortada kaybolan hatalar ve 32k'yi geçen samanlıktaki iğne benchmark'lerde ince doğruluk bozulması. Diferansiyel Transformer makalesi (arXiv:2410.05258, ICLR 2025) boşluğu ölçtü: DIFF Transformer'ler aynı boyuttaki taban çizgilerine göre daha düşük şaşkınlık, daha yüksek uzun bağlam doğruluğu ve daha az halüsinasyona ulaştı.

DIFF V1'in onu sınır öncesi eğitim hatlarının dışında tutan üç sorunu vardı. Değer önbelleğinin kod çözme adımı başına iki kez yüklenmesi gerekiyordu, FlashAttention uyumluluğunu bozan özel CUDA çekirdekleri gerektiriyordu ve kişi başına RMSNorm, 70B'den büyük ölçekte uzun vadeli eğitimi istikrarsızlaştırıyordu. DIFF V2 (Microsoft unilm blogu, 20 Ocak 2026) üçünü de düzeltti. Bu derste her iki versiyon da anlatılır, fark operatörü oluşturulur ve bir oyuncak sorgusunda benchmark'nin gürültü iptali sağlanır.

## Konsept

### Softmax'ın gürültü tabanı

`q` sorgusu ve `K = [k_1, ..., k_N]` anahtarları için dikkat ağırlıkları şöyledir:

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

Hiçbir `w_i` asla sıfır değildir. `k_i`, `q` ile tamamen ilgisizse, `q . k_i` puanı 0 değildir — `||q||^2 / d` varyansıyla sıfır etrafında dalgalanır. Softmax normalleştirmesinden sonra ilgisiz her token, ağırlıklı toplama `O(1/N)` katkıda bulunmaya devam eder. İlgisiz token'lerin toplam katkısı `O((N-1)/N) = O(1)`'dir — küçük bir miktar değildir.

Modelin istediği şey sert bir top-k gibi bir şey: eşleşen token'lerde yüksek ağırlık, diğer her yerde sıfıra yakın ağırlık. Softmax bunu doğrudan yapamayacak kadar pürüzsüz.

### Diferansiyel fikir

Her kafanın Q ve K projeksiyonlarını ikiye bölün: Q = (Q_1, Q_2) ve K = (K_1, K_2). İki dikkat haritasını hesaplayın:

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

Çıkış:

```
DiffAttn = (A_1 - lambda * A_2) V
```

Çıkarma işlemi, iki haritanın paylaştığı gürültü dağılımını iptal eder. Her iki harita da 127k ilgisiz token'ler üzerinde kabaca aynı ağırlığa sahipse (ki rastgele başlatma sırasında bunu yapacaklardır), bunlar iptal edilir. Sinyal (gerçekte ilgili birkaç token'nin en yüksek ağırlığı) yalnızca her iki haritada da aynı büyüklükte göründüğünde iptal olur; model eğitildikten sonra bu durum gerçekleşmeyecektir.

`lambda`, `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init` olarak parametrelendirilmiş, kişi başına öğrenilebilir bir skalerdir. Negatif olabilir. `lambda_init` varsayılan olarak 0,8 gibi küçük bir pozitif sayıya ayarlanır.

### Bu neden başlı gürültü engellemeyle eşleşiyor?

Aynı sesi kaydeden iki gürültülü mikrofonu düşünün. Her ikisi de hoparlörü ve ilişkili arka plan gürültüsünü alır. Birini diğerinden çıkardığınızda paylaşılan gürültü ortadan kalkar. Ses hayatta kalır çünkü iki sinyalin fazı veya genliği tamamen iptal edilmeyi önleyecek kadar farklılık gösterir. Kafa başına `lambda` tam olarak bu dengeyi öğrenir.

### V1 ve V2: fark

V1, parametre sayısını taban çizgisi Transformer'ye eşit tuttu. Kişi başına iki sorgu almak için kafa boyutunu yarıya indirdi. Bu, kafa ifadesine mal oldu ve daha da acı verici şekilde, kafa başına önbellek değerini yarıya indirdi. Decode'un değer önbelleğini adım başına iki kez (softmax dalı başına bir kez) yüklemesi gerekiyordu. Sonuç: eşleşen parametre sayısına rağmen kod çözme işlemi taban çizgisinden daha yavaştır.

V2, sorgu kafalarının sayısını iki katına çıkarır ve KV kafalarını aynı tutar (yukarı projeksiyondan parametreler ödünç alır). Kafa boyutu taban çizgisiyle aynı kalır. Çıkarma işleminden sonra ekstra boyut, Transformer'nin O_W projeksiyonuyla eşleşecek şekilde geri yansıtılır. Üç şey aynı anda olur:

1. Kod çözme hızı temel değerle eşleşir (KV önbelleği bir kez yüklenir).
2. FlashAttention değişmeden çalışır (özel çekirdek yoktur).
3. Kod çözme sırasındaki aritmetik yoğunluk artar (HBM'den yüklenen bayt başına daha fazla hesaplama).

V2 aynı zamanda V1'in çıkarmayı dengelemek için kullandığı kişi başına RMSNorm'u da kaldırır. 70B sınıfı eğitim öncesi ölçeklerde, RMSNorm geç eğitimin istikrarını bozdu. V2, ekstra modül olmadan eğitimi istikrarlı tutan daha basit bir başlatma şemasıyla değiştirir.

### Ne zaman ulaşmalı

| İş Yükü | Fayda |
|----------|---------|
| Uzun bağlamlı RAG (64k+) | Daha net dikkat haritaları, daha az halüsinasyonlu alıntılar |
| Samanlıkta iğne benchmarks | 32 bini aşan önemli doğruluk artışı |
| Çoklu Belge Kalite Güvencesi | Belgeler arası daha az müdahale |
| 8k'de kod tamamlama | Marjinal, mimari değişikliğe değmez |
| Kısa sohbet (< 4k) | Temel olarak başlangıçtan ayırt edilemez |

Değer bağlam uzunluğuyla birlikte artar. 4k token'lerde gürültü tabanı standart dikkatin iyi olmasını sağlayacak kadar küçüktür. 128k'da canınızı acıtıyor.

### Diğer 2026 düğmelerle nasıl birleşir?

| Özellik | DIFF V2 ile uyumlu mu? |
|---------|------------------------|
| GQA | Evet (V2, KV kafalarını değil, Q kafalarını artırır) |
| MLA (Derin Arama) | Evet, prensip olarak bunları birleştiren yayınlanmış bir makale yok |
| MEB | Evet (dikkat MLP bloğundan bağımsızdır) |
| halat | Evet (değişmedi) |
| YaRN / uzun bağlam ölçeklendirme | Evet (tam olarak DIFF'in en çok yardımcı olduğu yer) |
| FlashDikkat | V2'de evet (V1'de hayırdı) |
| Spekülatif kod çözme | Evet (dikkat değişikliği, spesifikasyon kod çözme döngüsünde görünmez) |

```figure
differential-attention
```

## İnşa Et

`code/main.py`, saf Python'da diferansiyel dikkati uygular. Bilinen sinyal artı gürültü yapısına sahip bir oyuncak sorgusu, gürültü engelleme oranını doğrudan ölçmenize olanak tanır.

### Adım 1: standart softmax dikkati

Stdlib matris işlemleri: liste listeleri, manuel matmul, softmax ve maksimumdan sayısal kararlılık çıkarma.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Adım 2: Q, K'yi ikiye bölün

V1 stili: kafa boyutunu yarıya indirin. V2 stili: Kafa boyutunu koruyun ve kafa sayısını iki katına çıkarın. Oyuncak uygulaması pedagojik netlik sağlamak için V1'i kullanıyor; matematik aynı, yalnızca muhasebe farklı.

### Adım 3: iki softmax dalı + çıkarma

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

Not: Çıkış ağırlıkları negatif olabilir. Bu sorun değil; değer önbelleği hala imzalı katkıları yönetiyor. Sonraki V projeksiyonu işareti emer.

### Adım 4: gürültü engelleme ölçümü

1024 uzunluğunda sentetik bir dizi oluşturun. token sinyalini bilinen bir konuma yerleştirin, geri kalanını gürültüyle doldurun. (a) sinyal pozisyonundaki standart softmax dikkat ağırlığını ve (b) diferansiyel dikkat ağırlığını hesaplayın. Her birinde sinyal-gürültü oranını ölçün. DIFF dikkati, iki dalın ne kadar farklılık gösterecek şekilde eğitildiğine bağlı olarak 3x-10x faktörü kadar güvenilir bir şekilde daha yüksek bir sinyal-gürültü oranı üretir.

### Adım 5: V1 ve V2 parametre hesaplaması

Bir yapılandırma verildiğinde (gizli=4096, kafalar=32, d_head=128), yazdır:

- Temel Transformer: Q, K, V her boyutta `hidden * hidden`, MLP 4 * gizli.
- DIFF V1: Q, K her boyut `hidden * hidden`, V boyut `hidden * hidden` (değişmedi), kafa dahili olarak yarıya kadar karartıldı. Kafa başına `lambda` parametrelerini ekler (O(kafalar * d_kafa)).
- DIFF V2: Q boyutu `2 * hidden * hidden`, K boyutu `hidden * hidden`, V boyutu `hidden * hidden`. O_W'den önce ekstra loşluk geri yansıtıldı. Aynı `lambda` parametrelerini ekler.

Oyuncak, V2 için ekstra parametre maliyetini ölçer (kabaca dikkat bloğu başına ekstra `hidden * hidden` ekstra) ve yazdırır.

## Kullan onu

DIFF V2, Nisan 2026 itibarıyla henüz her üretim inference sunucusunda kullanıma sunulmamaktadır ancak vLLM ve SGLang'da entegrasyon devam etmektedir. Bu arada desen şu şekilde ortaya çıkıyor:

- Microsoft'un dahili uzun bağlamlı üretim modelleri.
- 256k'den fazla bağlamı hedefleyen çeşitli açık model eğitim çalıştırmalarında araştırma kopyaları.
- DIFF dikkatini alternatif katmanlarda kayan pencere dikkatiyle birleştiren hibrit mimariler.

2026'da buna ne zaman ulaşacaksınız:

- 64k'den fazla etkili bağlamı hedefleyen yeni bir modeli sıfırdan eğitmek. Başlangıçtan itibaren farklı dikkat ekleyin; Daha sonra yeniden eğitim pahalıdır.
- Fine-tuning, değerlendirmenizde gözden kaçan başarısızlıkların hakim olduğu uzun bağlamlı bir model. Q projeksiyonlarındaki bir LoRA, DIFF yapısına yaklaşabilir.

Ne zaman yapmazsın:

- İstikrarlı uzun bağlam performansına sahip, önceden eğitilmiş yoğun bir model sunuyorsunuz. Yeniden eğitim maliyeti nadiren mevcut ağırlıkların karşılığını verir.
- Bağlamınız her zaman 16k'nin altındadır. Gürültü tabanı ihmal edilebilir düzeydedir.

## Gönderin

Bu ders `outputs/skill-diff-attention-integrator.md`'yi üretir. Bir model mimarisi, hedef bağlam uzunluğu, halüsinasyon profili ve eğitim bütçesi göz önüne alındığında, yeni bir eğitim öncesi çalıştırmaya veya LoRA ince ayarına farklı dikkat eklemek için bir entegrasyon planı üretir.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Sentetik sorguda diferansiyel dikkat için bildirilen sinyal-gürültü oranının standart softmax dikkatinden daha yüksek olduğunu doğrulayın. Gürültü genliğini değiştirin ve standart dikkatin kullanılamaz hale geldiği geçiş noktasını gösterin.

2. 7B sınıfı bir model için (gizli=4096, kafalar=32, d_head=128, 32 katman) taban çizgisinden DIFF V1'e ve taban çizgisinden DIFF V2'ye parametre sayısı deltasını hesaplayın. Hangi bileşenlerin parametre kazandığını ve hangilerinin aynı kaldığını gösterin.

3. DIFF V1 makalesinin 3. Bölümünü (arXiv:2410.05258) ve DIFF V2 Hugging Face blogunun 2. Bölümünü okuyun. İki cümleyle, kişi başına V1 RMSNorm'un neden gerekli olduğunu ve V2'nin eğitimde farklılığa neden olmadan bunu neden kaldırabileceğini açıklayın.

4. Bir ablasyon uygulayın: `lambda = 0` (saf ilk softmax) ve `lambda = 1` (tam çıkarma) ile diferansiyel dikkati hesaplayın. Sentetik sorguda, tarama boyunca sinyal-gürültü değişiminin nasıl değiştiğini ölçün. Sinyal-gürültüyü en üst düzeye çıkaran `lambda`'yi tanımlayın.

5. Oyuncağı GQA + DIFF V2'ye kadar uzatın. 8 KV kafa ve 32 Q kafa seçin. KV önbellek boyutunun aynı (8, 32) konfigürasyona sahip bir temel GQA modeliyle eşleştiğini gösterin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Farklı dikkat | "İki softmax eksi birbirini" | Q, K'yi iki yarıya bölün, iki softmax haritası hesaplayın, ikinciyi (lambda ile ölçeklendirilmiş) birinciden çıkarın, ardından V |
| Gürültü zemini | "Softmax'ın sıfır olmayan kuyruğu" | O(1/N) ağırlıklı softmax, ilgisiz her token'yi koyar, bu da uzun bağlamlarda O(1)'e karşılık gelir |
| lambda | "Çıkarma ölçeği" | `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init` olarak parametrelendirilmiş kişi başına öğrenilebilir skaler; negatif olabilir |
| FARK V1 | "ICLR 2025 sürümü" | Orijinal Diferansiyel Transformer; parametre sayısını korumak için kafanın kararması yarıya indirilir, özel çekirdeğe ihtiyaç vardır, kod çözme işlemi daha yavaştır |
| FARK V2 | "Ocak 2026 düzeltmesi" | KV kafalarını koruyan Q kafalarını ikiye katlar; temel kod çözme hızıyla eşleşir ve FlashAttention |
| Kişi başına RMSNorm | "V1 dengeleyici" | Fark sonrasında uygulanan ekstra norm V1; V2, eğitimin sonlarında istikrarsızlığı önlemek için bunu kaldırdı |
| Sinyal-gürültü oranı | "Ne kadar dikkat boşa gidiyor" | Gerçek sinyal konumundaki ağırlığın ilgisiz konumlardaki ortalama ağırlığa oranı |
| Ortada kayboldum | "Uzun bağlamlı hata modu" | Uzun bir bağlamın ortasındaki belgeler için erişim doğruluğunun düştüğü ampirik olay — DIFF'in dikkati bunu azaltır |
| Aritmetik yoğunluk | "Yüklenen bayt başına FLOP sayısı" | KV yükü başına sorgular iki katına çıkarılarak kod çözme sırasında V2 oranı artırıldı; belleğe bağlı kod çözme için önemli |

## Daha Fazla Okuma

- [Ye ve ark. — Diferansiyel Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) — gürültü engelleme teorisi ve uzun bağlam ablasyonları içeren orijinal makale
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blogu, Ocak 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) — üretim yığınının yeniden yazılması, eşleşen temel kod çözme, FlashAttention uyumlu
- [Diferansiyel Transformer Önceden Eğitimli Kişisel Dikkatin Zincirlerini Çözmeyi Anlamak (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) — çıkarma işleminin neden önceden eğitilmiş dikkat yapısını kurtardığına dair teorik analiz
- [Paylaşılan DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) — parametre paylaşım değişkeni
- [Vaswani ve ark. — Tek İhtiyacınız Olan Dikkat (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) — Transformer DIFF temel çizgisi bundan çıkarılır
- [Liu ve ark. — Ortada Kayıp (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) — uzun bağlam benchmark DIFF dikkat hedefleri
