# Çoklu-Token Tahmin (MTP)

> GPT-2'den Llama 3'e kadar her otoregresif LLM, pozisyon başına bir kayıp üzerine eğitim verir: sonraki token'yi tahmin edin. DeepSeek-V3, pozisyon başına ikinci bir kayıp ekledi: bundan sonra token'yi tahmin edin. Ekstra 14B parametre (671B modelinde), gradient akışı yoluyla ana modele geri damıtıldı ve eğitimli MTP başkanları, %80'den fazla kabulle spekülatif kod çözücü taslak hazırlayıcıları olarak inference'da yeniden tasarlandı. 1,8 kat üretim verimi ücretsiz olarak geldi. Bu ders, DeepSeek teknik raporundan sıralı MTP modülünü oluşturur, kaybı ve paylaşılan kafa parametre düzenini hesaplar ve Gloeckle ve diğerlerinin orijinal paralel MTP'si bunu kırarken MTP'nin neden nedensel zinciri koruduğunu açıklar.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 10 · 04 (mini GPT'ye ön eğitim), Aşama 10 · 15 (spekülatif kod çözme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- MTP eğitim hedefini belirtin ve tahmin derinliklerindeki ortak kaybı hesaplayın.
- Gloeckle ve diğerlerinin paralel MTP kafaları (2024) ile DeepSeek-V3'ün sıralı MTP modülleri arasındaki farkı ve sıralı tasarımın neden nedensel zinciri koruduğunu açıklayın.
- Bir eğitim öncesi çalıştırmaya MTP modülleri eklemenin parametre ve bellek yükünü hesaplayın.
- Sıfırdan bir MTP modülü uygulayın: paylaşılan embedding, derinlik başına transformer blok, projeksiyon ve paylaşılan çıktı kafası.

## Sorun

Next-token tahmini standart LLM eğitim hedefidir. Her gizli durum tam olarak tek bir şeyi tahmin etmek için denetlenir: hemen ardından gelen token. Bu şaşırtıcı derecede zayıf bir sinyal. Bir dizideki bilgilerin çoğu tek bir token'nin ötesine uzanır — yapı, tutarlılık, gerçeklik, aritmetik akış. Modelin bunları trilyonlarca token saniye boyunca çok sayıda bir-token sinyali biriktirerek öğrenmesi gerekiyor.

MTP şunu soruyor: Ya her gizli durum birden fazla gelecek token'yi aynı anda tahmin etmek için denetlenseydi? Gloeckle ve ark. (Meta, 2024) bunun yardımcı olduğunu gösterdi. Uygulamaları, her biri farklı bir ofset öngören, omurganın üstüne birkaç bağımsız çıkış kafası yerleştirdi. Paralel, basit, ancak kafalar herhangi bir hiyerarşik ayrıntılandırma olmadan aynı gizli durumu gördüler ve tahminler nedensel olarak zincirlenmedi, dolayısıyla spekülatif kod çözme için kullanılamazlar.

DeepSeek-V3 (Aralık 2024), MTP'yi her tahmin derinliğinde nedensel zinciri koruyan sıralı modüller olarak yeniden tasarladı. Model, `h_i^(0)`'den `t+1`'yi tahmin eder, ardından `h_i^(0)`'i `E(t+1)` embedding ile birleştiren yeni bir gizli durumdan `h_i^(1)` `t+2`'yi tahmin eder, vb. Her derinlik kendi küçük transformer bloğudur. Paylaşılan embedding ve paylaşılan çıkış kafası, parametre yükünü makul düzeyde tutar. DeepSeek-V3 ölçeğinde, 671B ana model ağırlıklarına ek olarak MTP modülleri genelinde 14B ekstra parametre. Bu %2'lik ek yük, inference'ta daha yoğun eğitim sinyalleri VE hazır bir spekülatif kod çözme taslağı satın aldı.

Bu derste tek bir MTP modülü ve D derinliği kaybı sıfırdan oluşturulur. Matematik düzenli. Uygulama 150 satırdır.

## Konsept

### Sıralı MTP tarifi

DeepSeek-V3, ana modelin üstüne `D` MTP modülü ekler. Her modül `k` (`k = 1..D` için), derinlikte `k` token'yi tahmin eder - yani, `i` konumu boyunca bir önek verilen `t_{i+k}`.

Modül `k` şunlardan oluşur:

- Kendi dikkati ve MLP'si olan bir transformer blok `T_k`.
- Önceki derinlikteki gizli durumu, sonraki derinlikteki yer gerçeğinin token embedding'si ile birleştiren bir projeksiyon matrisi `M_k`.
- Paylaşılan embedding `E` (ana modelle aynı).
- Paylaşılan çıkış kafası `Out` (ana modelle aynı).

Eğitimde, `i` konumu boyunca bir önek için, derinlik başına gizli durum şöyledir:

```
h_i^(0) = main model backbone at position i
h_i^(k) = T_k( M_k * concat(RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k}))) )   for k >= 1
```

Derinlik başına tahmin şu şekildedir:

```
logits_{i+k} = Out(h_i^(k-1))   for k = 1..D
```

Derinlik başına kayıp, temel gerçeğe `t_{i+k}` karşı çapraz entropidir:

```
L_k = CE(logits_{i+k}, t_{i+k})
```

Derinliklerdeki ortak kayıp:

```
L_MTP = (lambda / D) * sum_{k=1..D} L_k
```

`lambda` küçük bir ağırlıklandırma faktörüdür — DeepSeek-V3, eğitimin ilk %10'u için 0,3'ü ve sonrasında 0,1'i kullanır. Toplam eğitim kaybı `L_main + L_MTP`.

### Neden paralel değil de sıralı

Gloeckle'ın orijinal paralel MTP'si, her biri doğrudan `h_i^(0)`'ye uygulanan D çıkış kafalarına sahipti. Her kafa, aynı omurga gizli durumundan `t_{i+k}`'yi tahmin eder. Bu iyi bir antrenman ancak tahminler birbirine bağlı değil. `head_1`'nin çıkışını `head_2`'ye yardımcı olmak için kullanamazsınız; kafalar paralel olarak ateşlenir.

DeepSeek-V3'ün sıralı tasarımı, `h_i^(k-1)` artı gerçek sonraki-token embedding `E(t_{i+k})`'den `h_i^(k)` oluşturur. Bu nedensel zinciri korur: `t_{i+k+1}`'yi tahmin etmek için, `k+1` derinliğindeki modül, `t_{i+k}`'da ne olduğunu görür. Bu, yapısal olarak bir otoregresif kod çözücünün kendi çıktısını nasıl tükettiğiyle aynıdır; MTP modüllerini doğrudan spekülatif kod çözme taslakları olarak kullanılabilir hale getirir.

inference'da: `h_i^(k-1)` ve taslak halindeki `t_{i+k}`'yi `k+1` modülüne besleyin, `t_{i+k+1}` için bir tahmin alın. Tekrarlamak. Bu tam olarak EAGLE tarzı bir taslaktır ve eğitimli MTP modülünü taslak ağ olarak kullanır. DeepSeek-V3, ilk MTP modülünde %80'den fazla kabul ve ~1,8 kat hızlanma bildirdi.

### Parametre hesaplaması

Gizli `h` ve kelime bilgisi `V` içeren bir model için:

- Ana model: milyarlarca parametre artı `V * h` boyutunda bir çıkış kafası.
- Paylaşılan çıkış kafası: ana modelin kafasını yeniden kullanın. Ekstra parametre yok.
- Paylaşılan embedding: ana modelin embedding'sini yeniden kullanın. Ekstra parametre yok.
- MTP modülü başına:
- Projeksiyon `M_k`: `(2h) * h = 2h^2`.
- Transformer blok `T_k`: dikkat (MHA için `4h^2`) artı MLP (genellikle 8/3 oranıyla SwiGLU için `8h^2`). Blok başına yaklaşık `12h^2`.

Modül başına toplam ekstra: `~14h^2`. DeepSeek-V3'ün `h = 7168`, D = 1 modülü için: kağıt üzerinde `~14 * 7168^2 = ~720M` parametreleri. DeepSeek-V3, 14B'yi rapor ediyor; fark çoğunlukla uzman katmanların MTP modülünde de MoE olmasıdır.

### Spekülatif kod çözmenin getirisi

Ön eğitim sırasında, MTP modülleri eğitimi yaklaşık %10 oranında yavaşlatır (daha fazla ileri hesaplama, ekstra kayıp). Kazanç iki yönlüdür:

1. Daha yoğun eğitim sinyali. Her gizli durum D+1 denetim hedeflerini görür. MMLU, GSM8K, MATH, HumanEval üzerinde ölçülen etki: DeepSeek-V3'ün ablasyonlarında tutarlı birkaç yüzde puanlık iyileştirmeler.

2. inference adresinde ücretsiz spekülatif kod çözme taslağı. MTP modülü zaten önümüzdeki birkaç token'yi tahmin edecek şekilde eğitildi. Taslak ağ olarak yeniden tasarlanan ağ, %80'den fazla kabul oranı sunar. Bu seviyede, N=3 veya N=5 spesifik kod çözme 1,8 kat verim sağlar. inference'yi ilk kez çalıştırdığınızda %10'luk eğitim süresi maliyeti geri ödenir.

### KARTAL ile İlişki

EAGLE, ön eğitimden sonra AYRI olarak küçük bir taslak modeli eğitir. MTP taslağı ön eğitime dönüştürür. İki yaklaşım benzer kabul oranlarında ancak farklı boru hatları aracılığıyla birleşiyor:

| Boyut | KARTAL-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| Eğitildiğinde | Eğitim öncesi | Ön eğitim sırasında |
| Mevcut ağırlıklarla geriye dönük uyumludur | Evet | Hayır (yeniden eğitim almanız gerekir) |
| Taslak parametreler | 1-2 transformer katman | 1 transformer blok + projeksiyon |
| Kabul oranı | 0,88-0,92 | 0,80+ derinlikte 1 |
| Hızlanmanın ötesinde fayda | Yalnızca spekülatif kod çözme | Daha yoğun eğitim sinyali + hızlanma |

## İnşa Et

`code/main.py` uçtan uca tek bir MTP modülü oluşturur: paylaşılan embedding, projeksiyon, transformer blok, paylaşılan çıkış kafası. Daha sonra kısa bir sentetik dizide derinlik başına çapraz entropi kaybını hesaplar ve parametre sayısını bileşen bazında yazdırır. 32 token'lik oyuncak sözlüğü sayıların okunabilir olmasını sağlar.

### Adım 1: paylaşılan embedding tablosu

Tek bir `vocab_size x hidden` tablosu ana model tarafından VE her derinlikteki her MTP modülü tarafından kullanılır. İkinci bir kopya değil; kelimenin tam anlamıyla aynı tensör.

### Adım 2: derinlik başına kombinasyon

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

Real DeepSeek-V3, iki RMSNormed vektörünü `[2h]` ile birleştirir ve bir `h x 2h` matrisiyle yansıtır. Oyuncak, stdlib'in kısa olması için vektör toplamayı kullanır.

### Adım 3: k derinliğindeki transformer bloğu

Kişisel dikkat artı MLP. Oyuncakta, tek katmanlı doğrusal dikkat bloğu ve SwiGLU MLP, yapıyı uyuşukluk olmadan görünür tutuyor.

### Adım 4: Paylaşılan çıktı kafası

Ana modelin çıktı projeksiyonunu yeniden kullanın. Kelime dağarcığı üzerinde Logits.

### Adım 5: derinlik başına kayıp

`k` uzaklığında softmax(logits)'in temel gerçeğe token karşı çapraz entropisi. `lambda / D` ölçeklendirme faktörüyle derinlikler boyunca toplayın.

### Adım 6: parametre hesaplaması

Toplam parametre sayısını, paylaşılan (embedding, kafa) sayısını ve modül başına ekstra sayımı yazdırın. MTP ekstrasının ana model boyutuna oranını gösterin.

## Kullan onu

MTP, DeepSeek-V3 (Aralık 2024) ve DeepSeek-R1 serisine entegre edilmiştir. inference konumunda:

- DeepSeek'in kendi hizmet yığını, MTP modüllerini kutudan çıktığı haliyle spekülatif kod çözücüler olarak tüketir.
- vLLM ve SGLang, Nisan 2026 itibarıyla DeepSeek-V3 MTP için entegrasyon yollarına sahiptir.
- AMD'nin ROCm SGLang öğreticisi, V3 kontrol noktasında ölçülen 1,8 kat hızlanma ile belirli bir MTP spekülatif kod çözme yapılandırmasını gösterir.

Yeni bir eğitim öncesi çalıştırmada MTP ne zaman kullanılmalı:

- Eğitim öncesi sürecin tamamını kontrol ediyorsunuz ve daha yoğun bir eğitim sinyali biriktirmek istiyorsunuz.
- Modeli geniş ölçekte sunacağınızı ve spekülatif kod çözmeyi ücretsiz isteyeceğinizi biliyorsunuz.
- Gizli boyutunuz en az 4096. 1B ölçeğinde genel gider, kazancın faydasından çok zarar verir.

Ne zaman yapılmamalı:

- Fine-tuning önceden eğitilmiş mevcut bir yoğun model. MTP modülü eğitilmemiştir.
- Karşılaştırma yapmak için temiz bir temel almak istediğiniz modelleri araştırın. MTP mimariyi değiştirir.

## Gönderin

Bu ders `outputs/skill-mtp-planner.md` üretir. Bir eğitim öncesi çalıştırma spesifikasyonu (model boyutu, veri, hesaplama) verildiğinde, MTP'yi entegre etmek için bir plan döndürür: derinlik sayısı D, `lambda` programı, bellek yükü ve inference-zamanlı spekülatif kod çözme kablolaması.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Sentetik sinyal güçlendikçe derinlik başına kaybın monoton bir şekilde azaldığını gösterin. Sentetiki sabit bir model kullanacak şekilde değiştirin ve hem derinlik-1 hem de derinlik-2 kayıplarının birbirine yakınlaştığını doğrulayın.

2. D=1 MTP modülüne sahip yoğun bir 70B modeli (gizli 8192, 80 katman) için parametre ek yükünü hesaplayın. DeepSeek-V3'ün bildirdiği 14B ek yük ile karşılaştırın. DeepSeek'in sayısının neden daha yüksek olduğunu açıklayın: MTP transformer bloğu aynı MoE yapısını miras alarak modül başına parametre sayısını artırır.

3. Oyuncağa D=2'yi uygulayın: h^(1)'i alan ve `t_{i+2}`'yi tahmin eden ikinci bir MTP modülü ekleyin. Eklem kaybının ve parametre hesaplamasının DeepSeek makalesindeki 19-21 denklemleriyle eşleştiğini doğrulayın.

4. Oyuncağı paralel MTP'ye (Gloeckle tarzı) geçirin: her biri farklı bir ofset öngören ana gizli durumun üstüne D çıkış kafaları ekleyin. Aynı sentetik sinyalin sıralı versiyonuyla karşılaştırıldığında derinlik başına kayıpların nasıl olduğunu ölçün. Sıralı versiyon k > 1 için daha düşük derinlik-k kaybı üretmelidir çünkü ara tahminlere bağlıdır.

5. EAGLE tarzı bir taslak olarak eğitilmiş MTP modülünü kullanın: inference'da `t_{i+k}` önermek için k modülünü çağırın. Bu taslak token'ların kabul oranını, ana modelin uzatılmış bir dizideki tahminlerine göre ölçün. Oyuncakta %50+'ye ulaşırsanız ampirik MTP taslak özelliğini yeniden ürettiniz demektir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| MTP modülü | "Ekstra kayıp bloğu" | Ana modelin ilerisinde bir token `k` konumu öngören küçük bir transformer blok artı projeksiyon |
| Tahmin derinliği | "Hangi ofset" | `k` tamsayı öyle ki `k` modülü `t_{i+k}`'yi ön ekten `i` konumuna kadar tahmin eder |
| Paralel MTP | "Gloeckle tarzı" | D bağımsız kafalar aynı omurga üzerinde gizli durumdadır, koşullu zincir yoktur |
| Sıralı MTP | "DeepSeek-V3 stili" | Her modül, önceki derinliğin gizli durumu artı sonraki token'nin embedding'sini koşullandırır; nedensel zinciri korur |
| Paylaşılan çıkış kafası | "Ana kafayı yeniden kullanın" | MTP modülleri, ayrı bir çıkış projeksiyonu değil, ana modelin LM kafasını çağırır |
| Paylaşılan embedding | "Ana tabloyu yeniden kullanın" | Her yerde aynı kelime embedding tablosu kullanılıyor; yinelenen parametre yok |
| Projeksiyon matrisi M_k | "Gizli + sonraki-token'yi birleştir" | Önceki gizli durumu ve hedef-token embedding'yi bir sonraki derinliğin girişine katlayan bir `h x 2h` doğrusal katman |
| Ortak kayıp L_MTP | "Ortalama ekstra kayıplar" | Derinlik başına çapraz entropi kayıplarının `lambda` ile ölçeklendirilmiş aritmetik ortalaması |
| Derinlikte kabul oranı 1 | "MTP taslağı ne sıklıkla doğrudur" | D=1 MTP modülünün ilk 1 tahmininin ana modelin ilk 1 tahminine eşit olma oranı; DeepSeek-V3'te %80+ |
| Lambda ağırlıklandırma | "Ekstra kayıp önemi" | Derinlik başına ölçeklendirme faktörü; Eğitim başlangıcında 0,3, daha sonra DeepSeek-V3'te 0,1 |

## Daha Fazla Okuma

- [DeepSeek-AI — DeepSeek-V3 Teknik Raporu (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — ortak kayıp denklemleri ve inference'daki 1,8 kat hızlanma dahil olmak üzere tam sıralı MTP açıklaması (Bölüm 2.2)
- [Gloeckle ve ark. — Çoklu-token Tahmin (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) aracılığıyla Daha İyi ve Daha Hızlı Büyük Dil Modelleri — paralel MTP temel çizgisi DeepSeek'in tasarımı,
- [Hugging Facende DeepSeek-V3 model kart](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 685B toplam (671B ana + 14B MTP), deployment notlar
- [Leviathan ve ark. — Spekülatif Kod Çözme (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) yoluyla Transformer'lardan hızlı Inference - spekülatif kod çözme framework MTP'si buna uyar
- [Li ve ark. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — EAGLE'nin 2025 taslak mimarisi, muadili MTP ile rekabet ediyor
