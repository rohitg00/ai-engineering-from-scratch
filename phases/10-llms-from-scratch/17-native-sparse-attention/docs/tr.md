# Native Sparse Attention (DeepSeek NSA)

> 64k tokens'de dikkat, kod çözme gecikmesinin %70-80'ini tüketir. Her açık model laboratuvarın bunu düzeltmek için bir planı vardır. DeepSeek'in NSA'sı (ACL 2025'in en iyi makalesi) sıkışıp kalmış olanıdır: üç paralel dikkat dalı — sıkıştırılmış iri taneli token'ler, seçici olarak tutulan ince taneli token'ler ve yerel bağlam için kayan pencereler — öğrenilmiş bir kapı aracılığıyla birleştirilmiştir. Donanımla uyumludur (çekirdek dostu), yerel olarak eğitilebilir (eğitim öncesi çalışır, inference'da cıvatalanmaz) ve 64k kod çözmede FlashAttention'dan daha hızlı çalışır ve tam dikkat kalitesiyle eşleşir veya onu geçer. Bu ders üç dalı uçtan uca oluşturur ve seyrekliğin neden uçtan uca türevlenebilir olduğunu gösterir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 7 · 12 (KV önbellek, flaş dikkat), Aşama 7 · 15 (dikkat çeşitleri), Aşama 10 · 16 (diferansiyel dikkat)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- NSA'nın üç dikkat dalını ve her birinin neyi yakaladığını belirtin.
- Önceki seyrek dikkat yöntemlerinin yalnızca inference olduğu halde, NSA'nın neden "yerel olarak eğitilebilir" olduğunu açıklayın.
- Sıkıştırma blok boyutunun ve üst-k seçiminin bir fonksiyonu olarak, NSA'nın 64k bağlamında tam dikkat karşısında dikkat hesaplama tasarrufunu hesaplayın.
- Üç dallı kombinasyonu stdlib Python'da kısa bir sentetik diziye uygulayın ve geçit ağırlıklarının davranışını doğrulayın.

## Sorun

N dizi uzunluğunda tam dikkat, katman başına `O(N^2)` zaman ve `O(N)` KV önbelleğe mal olur. 64k tokens'de, hesaplama ve bellek bant genişliği sayıları felaket düzeydedir. NSA belgesinden ölçülen teorik tahmin: Dikkat, 64k'de toplam kod çözme gecikmesinin %70-80'ini oluşturur. Aşağı yöndeki her şeye - TTFT, tokens/sn, milyon tokens başına maliyet - dikkat maliyeti hakimdir.

Az dikkat bunun bariz cevabıdır. Önceki girişimler iki gruba ayrılır. Sabit model seyrekliği (kayan pencere, adımlı, blok yerel) bilgiyi çöpe atar ve uzun menzilli geri çağırma görevlerinde başarısız olur. Inference-zaman seyrekliği (KV önbellek budama, H2O, StreamingLLM), yoğun dikkat üzerine önceden eğitilmiş bir modele uygulanır ve modelden hiçbir zaman bilgileri seyrek desen üzerinden yönlendirmesi istenmediği için potansiyel hızın yalnızca bir kısmını kurtarır.

Yerel Seyrek Dikkat (Yuan ve diğerleri, DeepSeek + PKU + UW, ACL 2025 en iyi makale, arXiv:2502.11089) her ikisini de yapar: modelin ön eğitim sırasında öğrendiği, aslında inference değerinde işlem tasarrufu sağlayan çekirdek hizalı bir algoritma olarak uygulanan bir seyreklik modeli. Bundan iki yıl sonra, NSA veya onun doğrudan soyundan gelen bir kişi, tüm uzun bağlamlı sınır modellerinde varsayılan ilgi odağı olacak.

## Konsept

### Üç paralel dal

Her sorgu için NSA, KV önbelleğinin üç farklı görünümüne karşı üç kez dikkat çeker:

1. **Sıkıştırılmış dal.** Token'lar, `l` (genellikle 32 veya 64) boyutunda bloklar halinde gruplanır. Her blok, küçük bir öğrenilmiş MLP aracılığıyla tek bir token özetine sıkıştırılır. Sorgu bu sıkıştırılmış token'lere katılarak tüm dizinin kaba taneli bir görünümünü elde eder.

2. **Seçilen dal.** Sıkıştırılmış daldan alınan dikkat puanları kullanılarak mevcut sorguyla en alakalı en üstteki bloklar belirlenir. Bu bloklardaki ince taneli (sıkıştırılmamış) token'lar okunur ve sorgu bunların hepsine katılır. Seçim için yönlendirme sinyali olarak sıkıştırılmış dal dikkatini düşünün.

3. **Sürgülü pencere dalı.** Sorgu, yerel bağlam için en son `W` token'lere (genellikle 512) katılır. Bu dal, diğer ikisinin gözden kaçırabileceği yapı ağırlıklı kısa menzilli kalıpları (sözdizimi, yerel referans) yakalar.

Üç dal çıkışı, öğrenilen konum başına bir kapı aracılığıyla birleştirilir:

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win`, sorgudaki küçük bir MLP'nin kapı ağırlıklarıdır. Toplamlarının 1'e ulaşması gerekmez; dalları bağımsız olarak ağırlıklandırabilirler.

### Bu neden "yerel olarak eğitilebilir"

Seçim adımı (üst-k bloklar) ayrıktır. Ayrık işlemler gradient akışını bozar. Önceki seyrek dikkat çalışmaları ya seçim yoluyla geri tepmeyi atladı (eğitimi sınırladı) ya da inference'da gerçek bir seyreklik sağlamayan sürekli gevşemeler kullandı.

NSA bunu atlıyor: Sıkıştırılmış dal dikkati, tüm sekansta ayırt edilebilir, kaba taneli bir dikkattir. Top-k işlemi, hangi ince taneli blokların yükleneceğini seçmek için sıkıştırılmış daldaki en yüksek dikkat puanlarını yeniden kullanır. Gradient'nin sıkıştırılmış dal puanları boyunca akışı (hem sıkıştırılmış çıktıyı HEM seçim mantığını etkiler) ve seçilen blokların son çıktıya katkısı da farklılaştırılabilir. Türevlenemeyen `top_k` işlemi ileri hesaplamalı grafikte işlem yapılmaz; yalnızca bellekten hangi blokların yükleneceğini kontrol eder.

Bu nedenle NSA eğitim öncesi uçtan uca kullanılabilir. Model, bilgileri üç dal boyunca ortaklaşa yönlendirmeyi öğrenir ve inference noktasında vaat edilen hızı gerçekten sağlayan seyrek bir model üretir.

### Donanımla uyumlu çekirdek

NSA'nın çekirdeği, modern GPU bellek hiyerarşileri için tasarlanmıştır. Çekirdek, sorguları GQA gruplarına (dış döngü) göre yükler, grup başına karşılık gelen seyrek KV bloklarını getirir (iç döngü) ve dikkati SRAM üzerinde çalıştırır. Her sorgu grubu aynı seçilen blokları gördüğünden (seçim sorgu başlığı başına değil, sorgu grubu başına yapılır), KV yükleri grup genelinde amortismana tabi tutulur. Aritmetik yoğunluk yüksek kalır.

Makale, Triton çekirdeklerinin 64k kod çözmede FlashAttention'dan 9 kat daha hızlı çalıştığını ve hızlanma oranının dizi uzunluğuyla birlikte arttığını bildiriyor. İleri ve geri çekirdeklerin her ikisi de sağlanır.

### İşlem bütçesi

`N` dizi uzunluğu olsun, `l` sıkıştırma blok boyutu olsun, `k` üst-k seçim sayısı olsun, `w` kayan pencere olsun, `b` seçilen blok boyutu olsun (genellikle `l` eşittir).

- Sıkıştırılmış dal: Sorgu başına `O(N/l)` anahtar, yani toplam `O(N * N / l)`.
- Seçilen dal: Sorgu başına `O(k * b)` anahtar, yani `O(N * k * b)`.
- Kayan dal: Sorgu başına `O(w)` anahtar, yani `O(N * w)`.

Toplam: `O(N * (N/l + k*b + w))`.

`N = 64k, l = 64, k = 16, b = 64, w = 512` ile: sorgu başına maliyet `1000 + 1024 + 512 = 2536 keys` olur. Tüm dikkat `64000 keys`'de. 25 kat işlem azaltma.

`N = 128k, l = 64, k = 16, b = 64, w = 512` ile: sorgu başına maliyet `2000 + 1024 + 512 = 3536 keys` olur. Tüm dikkat `128000 keys`'de. 36x azalma. Fayda, dizi uzunluğuyla birlikte artar, asıl mesele de budur.

### Nasıl karşılaştırılır?

| Yöntem | Türevlenebilir | Gerçek inference hızlanma | Uzun menzilli geri çağırma |
|--------|---------------|----------------------|-------------------|
| Yalnızca sürgülü pencere | evet | evet | başarısız |
| Adımlı / blok-seyrek | evet | evet | kısmi |
| KV budama (H2O, StreamingLLM) | Yok (inference-zaman) | evet | kısmi |
| MoBA (Ay Atışı) | kısmi | evet | iyi |
| NSA | evet (yerel olarak) | evet (64k'de 9x) | tam dikkat ile eşleşiyor |

MoBA (Moonshot, arXiv:2502.13189) eşzamanlı olarak yayınlandı ve MoE ilkesini dikkat bloklarına uygulayarak benzer bir "üç birden iyidir" yaklaşımını benimsiyor. NSA ve MoBA, 2026 uzun bağlamlı ön eğitim için bilinmesi gereken iki mimaridir.

```figure
sliding-window-attention
```

## İnşa Et

`code/main.py` üç dalı kısa bir sentetik dizide uygular ve şunları gösterir:

- Sıkıştırma MLP'si (pedagojik netlik için basit bir ortalama havuz temel çizgisi kullanılır; gerçek NSA, öğrenilmiş bir MLP'yi kullanır).
- Sıkıştırılmış dal puanlarına göre yönlendirilen en üstteki blok seçimi.
- Son `w` token saniyedeki kayan pencere dikkati.
- Geçitli kombinasyon.
- Tam dikkatle karşılaştırılan bir hesaplama sayımı çıktısı.

### Adım 1: token'ları bloklara sıkıştırın

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Adım 2: sıkıştırılmış dallara dikkat

Sıkıştırılmış anahtarlara karşı sorgunun softmax dikkatini çalıştırın. Sıkıştırılmış dal puanları, üst k seçimi için sinyalin iki katıdır.

### Adım 3: üst-k blok seçimi

`k` en yüksek puana sahip sıkıştırılmış blokların endekslerini seçin. Bu bloklardan orijinal sıkıştırılmamış token'ları yükleyin ve dikkatleri üzerlerine çekin.

### Adım 4: kayan pencereye dikkat

Son `w` token'ları alın ve onlara karşı standart dikkat gösterin.

### Adım 5: geçit + birleştirme

Sorgudaki küçük bir MLP, üç kapı ağırlığı üretir. Nihai çıktı, üç dal çıktısının ağırlıklı toplamıdır.

### Adım 6: sayımı hesaplayın

Her şube için sorgu başına katılan anahtar sayısını ve toplamı yazdırın. `N` ile karşılaştırın (tüm dikkat). `l = 32, k = 4, w = 128` içeren 1024-token sentetikte, NSA sorgu başına `32 + 128 + 128 = 288` anahtar görürken, tam dikkat için 1024 anahtar görüyor - 3,5 kat daha az.

## Kullan onu

NSA, DeepSeek'in kendi uzun bağlamlı ön eğitim hattında nakliye yapıyor. Nisan 2026 itibarıyla genel inference yığınlarındaki entegrasyon durumu:

- **DeepSeek dahili**: yerel, yayınlanmış ağırlıklar NSA'yı veya onun halefi DSA'yı (Deepseek Sparse Attention) kullanır.
- **vLLM**: DeepSeek-V3.x ağırlıkları için geliştirilmekte olan deneysel NSA desteği.
- **SGLang**: NSA benchmarkyayınlandı; üretim yolu vLLM'yi takip eder.
- **llama.cpp / CPU**: desteklenmiyor; Çekirdek ayrışmasının ek yükü CPU veriminde buna değmez.

NSA'ya ne zaman ulaşılmalıdır:

- Ciddi bir bilgi işlem bütçesiyle 64k'den fazla bağlamı hedefleyen eğitim öncesi veya sürekli eğitim çalıştırması.
- DeepSeek'in kendi uzun bağlam kontrol noktalarından Inference tanesi. Ağırlıklar NSA'ya özgüdür.

Ne zaman yapılmamalı:

- Mevcut yoğun dikkatin önceden eğitilmiş bir modeline hizmet etmek. Sürekli eğitim olmadan NSA'yı güçlendiremezsiniz.
- 16k'nin altındaki içerik. Tasarruflara üç koldan oluşan genel giderler hakimdir.
- Toplu 1 etkileşimli sohbet. Gecikmeye duyarlı kod çözme avantajları, ancak yalnızca uzun bağlamlarda.

## Gönderin

Bu ders `outputs/skill-nsa-integrator.md` üretir. Uzun bağlamlı bir eğitim öncesi çalışma spesifikasyonu göz önüne alındığında, bir NSA entegrasyon planı üretir: sıkıştırma bloğu boyutu, üst k, kayan pencere, geçit MLP genişliği, çekirdek seçimi ve mimari değişikliği haklı çıkaracak belirli uzun bağlam değerlendirmeleri.

## Egzersizler

1. `code/main.py`'yi 1024-token sentetik üzerinde çalıştırın. `(l, k, w)`'yi üç ön ayar boyunca gezdirin ve hesaplama sayımlarını yazdırın. Samanlıkta iğne testinde tüm dikkati %95 geri çağırırken sorgu başına en düşük anahtar sayısını elde eden ön ayarı belirleyin.

2. Ortalama havuz kompresörünü küçük öğrenilmiş bir MLP (2 katmanlı, gizli 32) ile değiştirin. Sinyalin bir bloğun ortalaması olduğu sentetik bir görev üzerinde onu eğitin. Bekletilen verilerdeki ortalama havuz temel çizgisine göre şaşkınlık boşluğunu ölçün.

3. Gate MLP'yi uygulayın. Sorguyu girdi olarak alır ve üç skaler çıktı verir. Kapının mantıklı davrandığını gösterin: rastgele sorgularda neredeyse aynı ağırlıklandırma, sorgu uzak bir bloğa çarptığında seçilen dalda ağır ağırlık.

4. 128k bağlamında NSA destekli 70B modeli için KV önbellek bütçesini hesaplayın. KV kafaları 8, baş loş 128, BF16'dır. Tam dikkat ve MLA ile karşılaştırın (Aşama 10 · 14, MLA'nın sayılarını gösterdi). NSA'nın ince taneli şube KV önbelleğinin tam dikkat gerektirdiği sıra uzunluğunu belirleyin.

5. NSA belgesinin (arXiv:2502.11089) 4. Bölümünü okuyun ve sıkıştırılmış şubenin dikkat puanlarının ayrı bir yönlendirme puanı hesaplamak yerine neden en üstteki seçim için yeniden kullanıldığını üç cümleyle açıklayın. Cevabı gradient akışına bağlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Sıkıştırılmış şube | "Kaba görünüm" | Sorgu başına O(N/l) anahtarlarında genel bağlam sağlayan blok ortalamalı anahtarlara dikkat |
| Seçilen şube | "En iyi bloklar" | En yüksek sıkıştırılmış dal puanlarına sahip `k` bloklara ayrıntılı dikkat |
| Sürgülü pencere | "Yerel bağlam" | Kısa menzilli modeller için son `W` tokens'ye dikkat |
| Yerel eğitilebilirlik | "İnternet açıkken ön antrenman yapın" | Seyreklik modeli ön eğitim sırasında öğrenilir, inference |
| Sıkıştırma bloğu boyutu l | "Kaba görünüm için grup boyutu" | Tek bir özette kaç tane token birleştirilir; 32-64 tipik |
| Üst-k | "Saklanacak bloklar" | Sıkıştırılmamış token'ları okunan sıkıştırılmış blok sayısı; 16 tipik |
| Sürgülü pencere W | "Yerel ilgi alanı" | Tipik olarak 512; daha kısası yerel tutarlılığa zarar verir, daha uzun süre bilgi israfına neden olur |
| Şube kapısı | "Üçü nasıl karıştırılır" | Üç şubenin katkılarını ağırlıklandıran pozisyon başına MLP çıktısı |
| Donanım hizalaması | "Çekirdek dostu seyreklik" | Gerçek GPU çekirdeğinin teorik hızlanmaya ulaşması için seyrek desen seçildi |
| DSA | "NSA'nın halefi" | Deepseek Sparse Dikkat, DeepSeek'in soyunda NSA'yı takip eden mimari |

## Daha Fazla Okuma

- [Yuan ve ark. — Yerel Sparse Attention: Donanımla Uyumlu ve Yerel Olarak Eğitilebilir Sparse Attention (arXiv:2502.11089, ACL 2025 En İyi Makale)](https://arxiv.org/abs/2502.11089) — makale
- [DeepSeek-V3 Teknik Raporu (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — NSA'nın hedeflediği mimari ailesi
- [Moonshot AI — MoBA: Uzun Bağlamlı Yüksek Lisanslar için Blok Dikkat Karışımı (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) — eşzamanlı çalışma, bloklar üzerinde MoE tarzı dikkat
- [Beltagy ve ark. — Longformer: Uzun Belge Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) — kayan pencere kökenleri
-[Xiao ve ark. — StreamingLLM: Dikkat Gidericileri Olan Verimli Akış Dili Modelleri (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) — inference-zaman seyrekliği temel çizgisi NSA gelişiyor
- [Dao ve ark. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) — tam dikkat temel NSA çekirdekleri 64k'de atıyor
