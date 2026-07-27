# Spekülatif Kod Çözme ve EAGLE-3

> Aşama 7 · Ders 16 matematiği kanıtladı: Leviathan reddetme kuralı, doğrulayıcının dağılımını tam olarak korur. Bu ders, 2026 üretim spekülatif kod çözme işleminin eğitim yığını görünümüdür. EAGLE-3, taslak modeli ucuz bir yaklaşımdan, doğrulayıcının kendi gizli durumları üzerinde eğitilmiş amaca yönelik oluşturulmuş küçük bir ağa dönüştürdü, ardından tren ve inference dağılımlarını hizalayan bir eğitim süresi test döngüsü ekledi. Sonuç: Uçtan uca 3 ila 6,5 ​​kat hızlanma, sohbette 0,9'un üzerinde her-token oranları kabul edildi, dağıtımsal ödünleşim yok. 2026'daki her üretim inference yığını varsayılan olarak onu gönderir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 7 · 16 (spekülatif kod çözme matematiği), Aşama 10 · 12 (inference optimizasyonu)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Leviathan teoremini bir cümleyle açıklayın ve spekülatif döngünün doğrulayıcıya aynı şekilde dağıtılan örnekler ürettiğini kanıtlayın.
- Vanilya spesifikasyon kod çözümünden (Leviathan 2023) EAGLE, EAGLE-2 ve EAGLE-3'e kadar olan iki yıllık ilerlemeyi izleyin ve kaldırılan her adımın tam sınırlamasını belirtin.
- Kabul oranı `α` ve taslak-doğrulayıcı maliyet oranından `c` beklenen hızı hesaplayın ve her rejim için en uygun taslak uzunluğunu `N` seçin.
- Tüm spekülatif döngüyü sıfırdan uygulayın: taslak hazırlayın, doğrulayın, kalıntıdan örnek reddedin, reddedilme durumunda KV önbelleğini geri alın, tam kabul durumunda bonus token verin.

## Sorun

70B modelinde otoregresif kod çözme, H100'de saniyede belki 35 tokens hızında çalışır. GPU doyuma yakın değil. Bellek bant genişliği tavandır: her token HBM'den 70B ağırlık yükler, bir aritmetik adımı yapar ve bir kayan nokta üretir. Hesaplama birimleri çoğunlukla boşta duruyor.

Spekülatif kod çözme, bunu gerçekten çözebileceğiniz bir üretim sorununa dönüştürür. Ucuz bir taslak, `N` küçük ileri geçişte `N` tokens önerir. Doğrulayıcı, önek artı tüm `N` taslaklarda bir kez çalışır. Doğrulayıcının `i` pozisyonundaki dağılımı taslakla uyumluysa (istatistiksel anlamda kesinleştireceğiz), kabul ediyoruz; değilse, reddederiz ve artık dağılımdan bir düzeltme örneği alırız. Tek bir büyük model ileri, bir yerine en fazla `N+1` kabul edilmiş token üretir.

Önemli olan teorem Leviathan, Kalman, Matias'tır (ICML 2023): çıktı dağılımı, doğrulayıcıdan alınan örneklemenin doğrudan üreteceği dağılımla aynıdır. Yaklaşık olarak değil. Aynı şekilde. Spekülatif kod çözmenin üretimde kabul edilebilir olmasının tam nedeni budur; bu, kaliteden ödün vermeyen saf bir gecikme optimizasyonudur.

Aşama 7 · Ders 16'nın size kazandırdığı şey matematikti. Bu dersin size sağladığı şey eğitim yığınıdır. İyi bir taslak, ucuz bir taslaktan 2 kat daha fazla hızlanmaya değer. EAGLE, EAGLE-2 ve EAGLE-3 (Li ve diğerleri, 2024–2025) "taslak = aynı modelin daha küçük versiyonu"nu kesin bir mühendislik disiplinine dönüştürdü. 2026 üretim inference sunucuları varsayılan olarak EAGLE-3'tür.

## Konsept

### Değişmez: Leviathan ret örneklemesi

Bir önek verilen sonraki token için taslağın dağıtımı `p(t)` olsun ve doğrulayıcınınki de `q(t)` olsun. Bir taslak örnekleyin token `d ~ p`. `min(1, q(d) / p(d))` olasılıkla kabul edin. Reddedildiğinde, `(q - p)_+ / ||(q - p)_+||_1` artık dağılımından örnek alın. Ortaya çıkan örnekler `q`'a göre dağıtılır. Bu, `p` ne kadar kötü olursa olsun doğrudur; ne kadar kötü olursa, o kadar sıklıkla reddedersiniz, ancak çıktı kesin kalır.

`prefix + d_1 + ... + d_N` üzerinde bir doğrulayıcı ileri geçişi kullanarak bu çağrılardan `N` tanesini arka arkaya yığın. Doğrulayıcı aynı anda `q_1, q_2, ..., q_{N+1}` değerini döndürür. Soldan sağa yürüyün. `j` konumundaki ilk reddetmede, `residual(q_j, p_j)` konumundan örnek alın ve durun. Tam kabul üzerine, `q_{N+1}`'tan bir bonus token alın.

### Hızlanmayı ne belirler?

Taslak başına token beklenen kabul oranı `α` olsun. Maliyet oranı `c = cost(draft) / cost(verifier)` olsun. Doğrulayıcı iletme başına beklenen kabul edilen token sayısı:

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

Kabul edilen token başına beklenen toplam duvar süresi `(N * c + 1) / E[accepted]`'dır. Bunu `N`'ye göre en aza indirin ve tatlı noktayı yakalayın. `α = 0.8, c = 0.05` için: optimal `N` 5–7 civarındadır, hızlanma 3,2 kattır. `α = 0.95, c = 0.02` için: optimal `N` 8–10 civarındadır, hızlanma 5 kat artar.

En büyük tek kaldıraç `α`'dır. Sabit `N = 5` ile `α = 0.6` (vanilya taslağı)'ndan `α = 0.9` (EAGLE-3)'e geçmek, sizi doğrulayıcı başına beklenen 2,2 kabul edilen token'den 4,1'e götürür. Aynı doğrulayıcıdan neredeyse 2 kat daha fazla verim.

### İki yıllık ilerleme

**Vanilya spekülatif (Leviathan, 2023).** Taslak model, aynı aileden bağımsız olarak eğitilmiş daha küçük bir LLM'dir. Kablo bağlaması kolay `α ≈ 0.6`, en iyi ihtimalle yaklaşık 2 kat hızlanır.

**EAGLE-1 (Li ve diğerleri, 2024).** Taslak, doğrulayıcının son katmandaki gizli durumunu girdi olarak alan ve bir sonraki token'yi doğrudan tahmin eden küçük bir transformer'dır (tipik olarak bir veya iki katman). Taslak, doğrulayıcının özellik temsilini gördüğünden dağıtımı doğrulayıcınınkine çok daha yakındır. `α` 0,7-0,8'e tırmanıyor.

**EAGLE-2 (Li ve diğerleri, 2024).** Dinamik bir taslak ağaç ekler: tek bir `N` token dizisi önermek yerine, küçük bir aday ağacı önerin, her birini doğrulayıcıyla tek bir ileri geçişte puanlayın (ağaç dikkati) ve en yüksek olasılıklı yolu yürüyün. Taslak uzunluğu adım başına uyarlanabilir hale gelir. Kabul edilen yol token başına `α` 0,85'in üzerine tırmanıyor.

**EAGLE-3 (Li ve diğerleri, 2025, NeurIPS).** İki değişiklik daha. İlk olarak, özellik tahmin kaybını tamamen bırakın - EAGLE-1/2, taslağı doğrulayıcının gizli durumlarıyla eşleşecek şekilde eğitti; bu, ne kadar verinin yardımcı olacağını sınırlıyor. EAGLE-3 doğrudan token tahminiyle antrenman yapar. İkincisi, eğitim süresi testi (TTT): Taslak eğitimi sırasında, taslağın kendi önceki tahminlerini, inference'da çalıştığı gibi, birden fazla adım üzerinden girdi olarak geri besleyin. Bu, eğitim ve test dağılımlarını hizalar ve hata birikimini durdurur. Ölçülen hızlanma: sohbette 6,5 kata kadar, H100'de SGLang'da 64. grupta %38 verim artışı.

### KV önbellek geri alma

Doğrulama, doğrulayıcının KV önbelleğini tek geçişte `N` giriş kadar genişletir. Reddetme `j` konumunda gerçekleşirse, `j-1` konumundan sonraki önbellek içerikleri artık yanlıştır. İki yaygın uygulama: bir karalama arabelleğine yazma ve kabul edildiğinde işleme koyma (vLLM, TensorRT-LLM) veya fiziksel bir KV önbelleği artı mantıksal bir uzunluk tutma ve reddetme durumunda kesme. Her iki durumda da geri alma maliyeti, kafa başına katman başına bayttır ve bu, ileri geçiş maliyetinin yanında ihmal edilebilir.

EAGLE-2 ağaç araması için doğrulayıcı, ağaç topolojisine saygılı, nedensel olmayan bir maskeyle dikkat çeker. Mühendislik karmaşıktır ancak hesaplama, özel bir maskeye sahip standart bir hızlı dikkat çağrısıdır.

### 2026'daki taslak mimariler

| Strateji | Taslak türü | `α` | Hızlandırma | Eğitim maliyeti |
|----------|-----------|-----|---------|---------------|
| Vanilya | Ayrı küçük LLM | 0,55-0,70 | 1,8-2,3× | Yok (mevcut küçük modeli yeniden kullanın) |
| Medusa | Doğrulayıcıda ekstra LM başlıkları | 0,65-0,75 | 2-3× | ~1B SFT tokens |
| KARTAL-1 | Gizli durumlarda 1 katmanlı transformer | 0,70-0,80 | 2,5-3× | ~60B tokens |
| KARTAL-2 | EAGLE-1 + dinamik taslak ağacı | 0,80-0,88 | 3-4× | ~60B tokens |
| KARTAL-3 | Çok katmanlı özellik füzyonu + TTT | 0,88-0,92 | 3,5-6,5× | ~60-200B tokens |
| İleriye Bak | Taslak yok (Jacobi yinelemesi) | Yok | 1,3-1,6× | Yok |

2026 üretiminde: vLLM ve SGLang, mevcut olduğunda varsayılan olarak EAGLE-3'tür, aksi halde EAGLE-2'dir. TensorRT-LLM, Meta ve NVIDIA genel modelleri için en hızlı Medusa yoluna sahiptir. llama.cpp, CPU deployment'lar için vanilya taslağını gönderir.

## İnşa Et

Bkz. `code/main.py`. Bu, tüm parçaları içeren tam Leviathan spekülatif döngüsüdür: N taslağı, doğrulayıcı paralel geçiş, konum başına reddetme, artık örnekleme, bonus token, KV geri alma ve çıktı dağılımının `q`'den doğrudan örneklemeyle eşleştiğine dair ampirik doğrulama.

### Adım 1: Reddetme kuralı

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Adım 2: artık dağılım

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Adım 3: tam spekülatif bir adım

`spec_step` işlevi, `p`'den `N` token'ların taslağını çıkarır, ardından hepsini tek bir paralel `q` değerlendirmesinde doğrular. Taslaktaki her token için ret kuralını uygular ve ilk ret durumunda düzeltmeyi artıktan örnekler. Her şey kabul edilirse, `q_{N+1}`'tan bir bonus token yayar.

### Adım 4: KV geri alma muhasebesi

Simülatör, çalışan başına mantıksal bir `kv_length` izler. `k` taslağın kabulü üzerine, `kv_length += k`. `j` konumundaki bir ret durumunda, önbellek zaten `j`'den sonra yazılmıştır, ancak mantıksal uzunluk `prefix_length + j + 1` olarak ayarlanmıştır — token düzeltmesinden bir sonra. Sonraki okumalar mantıksal uzunluğa kısaltılır.

### Adım 5: Leviathan kontrolü

50.000 spekülatif adımı çalıştırın. Kabul edilen token'ların ampirik dağılımını sayın. `q`'dan gelen 50.000 doğrudan örnekle karşılaştırın. Ki-kare istatistiği kritik değerin oldukça altında olmalıdır. Teorem pratikte geçer.

### Adım 6: Hızlandırma ve α

Farklı genliklerde `p`'yi `q`'den uzaklaştırarak taslak kalitesini tarayın. `α`'yi ölçün, ardından doğrulayıcı çağrısı başına beklenen token'leri `α` ve `N`'nin bir fonksiyonu olarak çizin. Kod, EAGLE-3 sınıfı taslak kalitesinin (`α ≈ 0.9`) doğrulayıcı çağrısı başına 4–5 token'nin kilidini nasıl açtığını gösteren bir tablo yazdırır.

## Kullan onu

EAGLE-3 ile üretim seviyesi `vllm serve`:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

H100'de 64. partide EAGLE-3 ile SGLang: EAGLE-3 makalesine göre parti-64 vanilya kod çözme işleminden yaklaşık 1,38 kat daha fazla verim.

Spekülatif kod çözmeye ne zaman ulaşılmalı:

- P50 gecikmesinin en yüksek verimden daha önemli olduğu her türlü etkileşimli sohbet iş yükü.
- Kod oluşturma ve yapılandırılmış çıktı (JSON, SQL). Hedef dağılımı oldukça öngörülebilir olduğundan `α` 0,9'un üzerindedir.
- Uzun biçimli nesil (binlerce tokens). Amorti edilmiş hızlanma ödemeye devam ediyor.

Ne zaman yapılmamalı:

- Çok küçük modeller (< 3B). Taslak, doğrulayıcıdan çok daha ucuz değil.
- Minik toplu-1 CPU deployment'lar. Taslak modelin bellek yükü buna değmeyebilir.
- `α`'nin çöktüğü çok yüksek sıcaklıktaki reklam örneklemesi.

## Gönderin

Bu ders `outputs/skill-eagle3-tuner.md` üretir. Bir inference iş yükü (model, toplu iş boyutu, hedef gecikme, görev profili) göz önüne alındığında, spekülatif kod çözme stratejisi ve ayarlama parametreleri (taslak ailesi, `N`, ağaç derinliği, sıcaklığa duyarlı anahtarlama) önerir.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Leviathan dağıtım kontrolünde ki-kare istatistiğinin 50.000 örnekte %95 kritik değerin altında kaldığını doğrulayın.

2. `α` 0,9'da ve `c` 0,04'te tutularak 1'den 10'a kadar `N`'yi tarayın. Doğrulayıcı çağrısı başına beklenen token saniyeyi ve token başına gerçek duvar süresini çizin. Duvar süresini en aza indiren `N`'yi bulun. Eğrinin şeklini açıklayınız.

3. EAGLE-2 ağaç aramasını simüle etmek için kodu değiştirin: her adımda taslak, `[2, 2, 2]` şeklinde bir ağaç (sekiz aday yol) önerir. Doğrulayıcı bir kez çalıştırılır ve kabul edilen en yüksek olasılığa sahip yol kazanır. Yaprak başına `α` ve doğrulayıcı çağrısı başına toplam token sayısını hesaplayın. Eşdeğer hesaplamada doğrusal zincir spesifikasyon kod çözmeyle karşılaştırın.

4. İki eşzamanlı dizi için toplu bir KV geri alma simülatörü uygulayın. Sıra A'da tüm taslaklar kabul edilmiştir; B dizisi 2. konumda reddediyor. Her diziye göre doğru `kv_length`'nun güncellendiğini ve hiçbir işin boşa gitmediğini gösterin.

5. EAGLE-3 makalesinin 4. Bölümünü (Eğitim Süresi Testi) okuyun. TTT'siz saf draft eğitiminin neden maruz kalma yanlılığından muzdarip olduğunu ve taslağı eğitim sırasında kendi tahminleriyle beslemenin neden bunu düzelttiğini iki cümleyle açıklayın. Bunu seq2seq'deki planlı örnekleme literatürüne bağlayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Leviathan kuralı | "min(1, q bölü p)" | Bernoulli `min(1, q(d)/p(d))` olasılığıyla kabul/reddeder, reddedilme durumunda artıktan numune aldığınızda doğrulayıcı dağılımını tam olarak korur |
| Artık dağıtımı | "(q eksi p) artı, normalleştirilmiş" | `(q - p)_+` sıfıra sabitlendi ve yeniden normalleştirildi — reddedilme durumunda numune alınacak doğru dağılım |
| Kabul oranı α | "taslağın ne sıklıkla doğru olduğu" | Reddetme kuralına göre -token Bernoulli başına beklenen başarı olasılığı; tüm hızlandırılmış matematik işlemlerini yönetir |
| KARTAL-1 | "gizli durum taslağı" | Doğrulayıcının son katman gizli durumuna göre koşullandırılmış küçük transformer taslak (Li ve diğerleri, 2024) |
| KARTAL-2 | "dinamik taslak ağacı" | EAGLE-1 artı bir doğrulama geçişinde ağaç dikkatiyle puanlanan aday devamlarından oluşan bir ağaç |
| KARTAL-3 | "eğitim süresi testi" | Özellik tahmin kaybını azaltır, eğitim sırasında taslağın kendi çıktılarını beslediği doğrudan token tahmini üzerinde eğitim alır |
| Eğitim süresi testi (TTT) | "maruz kalma yanlılığı düzeltmesi" | Eğitim sırasında taslağı otoregresif olarak çalıştırın, böylece eğitim ve test girdi dağılımları eşleşsin; planlı örneklemenin doğrudan benzeri |
| KV'yi geri alma | "reddedilen taslakları geri al" | Reddedildikten sonra doğrulayıcının KV önbelleğini kabul edilen önek uzunluğuna sıfırlayan defter tutma |
| Bonus token | "ücretsiz olan" | Tüm `N` taslaklar kabul edildiğinde, ek doğrulama ücreti ödemeden `q_{N+1}` taslaklarından bir tanesini daha örnekleyin |
| Ağaç dikkati | "birçok adayı aynı anda doğrulayın" | Taslak ağacın topolojisine saygılı, nedensel olmayan bir maskeye dikkat; tek ileri geçişte ağaçtaki her düğüm için `q_i` değerini hesaplar |

## Daha Fazla Okuma

- [Leviathan, Kalman, Matias — Spekülatif Kod Çözme yoluyla Transformer'lardan hızlı Inference (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) — temel makale ve denklik teoremi
- [Chen ve ark. — Spekülatif Örnekleme ile Büyük Dil Modeli Kod Çözmeyi Hızlandırma (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) — temiz bir kanıtla eş zamanlı bağımsız tanıtım
- [Li ve ark. — EAGLE: Spekülatif Örnekleme, Özellik Belirsizliğinin Yeniden Düşünülmesini Gerektirir (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE-1, gizli durum koşullu taslak
- [Li ve ark. — EAGLE-2: Dinamik Taslak Ağaçlarla Dil Modellerinin Daha Hızlı Inference (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — dinamik ağaç araması
- [Li ve ark. — EAGLE-3: Eğitim Süresi Testi aracılığıyla Inference Hızlandırmanın Ölçeklendirilmesi (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) — 2026 üretim varsayılanı
- [Cai ve ark. — Medusa: Çoklu Kod Çözme Kafaları (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) — taslaksız alternatif yaklaşım
- [vLLM Spekülatif Kod Çözme belgeleri](https://docs.vllm.ai/en/latest/features/spec_decode.html) — tüm stratejilerin birbirine bağlı olduğu kanonik üretim referansı
