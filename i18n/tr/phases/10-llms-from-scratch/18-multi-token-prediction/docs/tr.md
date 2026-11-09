# Çoklu Token Tahmin (MTP)

> GPT-2'den Llama 3'e kadar her bir gerileme derecesinde olan LLM, pozisyon başına bir kayıp kazanır. DeepSeek-V3 pozisyon başına ikinci bir kayıp ekledi. Bundan sonra token'ı tahmin et. Ekstra 14B parametreleri (671B modelinde) gradient akışı yoluyla ana modele geri distillendi ve eğitilmiş MTP başları, %80+ kabul ile spekülasyonsal dekodlama taslakçıları olarak sonuçta yeniden kullanıldı. 1.8x jenerasyon geçiş ücretsiz geldi. Bu ders, DeepSeek teknik raporundan sıralı MTP modülü oluşturur, kayıp ve paylaşılan baş parametresi düzenini hesaplar ve neden MTP nedensel zinciri koruduğunu açıklarken Gloeckle et al'ın orijinal paralel MTP'si onu kırdı.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- MTP eğitim hedefini belirtin ve tahmin derinliklerinde ortak kayıptan çıkarın.
- Gloeckle et al.'ın paralel MTP başlıkları (2024) ile DeepSeek-V3'ün sıralı MTP modülleri arasındaki farkı ve sıralı tasarının nedensel zinciri neden koruduğunu açıklayın.
- Bir önceden eğitim koşusuna MTP modüllerini eklemek için parametreleri ve hafıza geçişlerini hesaplayın.
- Bir MTP modülü sıfırdan uygulayın: paylaşılan gömülme, derinlik dönüştürücü bloğu, projeksiyon ve paylaşılan çıkış başlığı.

## Sorun

Sonraki belirti tahminleri standart LLM eğitim hedefi. Her gizli durum tam olarak bir şeyi tahmin etmek için denetlenir: hemen sonraki simge. Bu şaşırtıcı derecede zayıf bir sinyal. Bir dizi içinde bulunan bilgilerin çoğu bir simge  yapısı, tutarlılık, gerçeklik, aritmetik akıştan daha öte uzanır. Modelle, bunları, bir bilyon simgelerin üzerinde bir tek sinyal sinyallerini biriktirerek öğrenmek zorundadır.

MTP soruyor: Ya her gizli durum birden fazla gelecekteki token tahmin etmek için denetlenirse? Gloeckle et al. (Meta, 2024) bunun yardımcı olduğunu gösterdi. Uygulamaları, her biri farklı bir ofset öngörerek omurganın üzerine birkaç bağımsız çıkış başını koydu. Paralel, basit, ama başlar herhangi bir hiyerarşik gelişme olmadan aynı gizli durumu gördü  ve tahminler nedensel olarak zincirlenmedi, bu yüzden spekülasyonsal dekodlama için kullanılamadı.

DeepSeek-V3 (Aralık 2024) MTP'yi, her tahmin derinliğinde nedenci zinciri tutan ardıcıl modüller olarak yeniden tasarladı.`t+1`-`h_i^(0)`Sonra tahmin eder .`t+2`Yeni bir gizli durumdan.`h_i^(1)`Bu da bir arada.`h_i^(0)`- ... ...`E(t+1)`DeepSeek-V3'ün ölçeğinde, 671B ana model ağırlıklarının üzerinde MTP modüllerindeki 14B ekstra parametreler. Bu% 2 overhead daha yoğun eğitim sinyalleri satın aldı ve sonuçta hazır bir spekülasyonsal dekodeleme taslakı aldı.

Bu ders tek bir MTP modülü oluşturur ve sıfırdan D derinliği kaybı.

## Anlaşım

### Sıradan MTP tarifi

DeepSeek-V3 ekliyor `D`Ana modelin üzerinde MTP modüller.`t_{i+1}`Her modül .`k`(çünkü)`k = 1..D`) simgesini tahmin eder .`k`Daha ileri adımlar atmak.`t_{i+k+1}`, konumdan bir ön işaret verilmiştir `i`- Evet .

Modül`k`aşağıdakilerden oluşur:

- Bir transformatör bloğu .`T_k`Kendi dikkatini ve MLP'yi.
- Bir projeksiyon matrisi `M_k`Önceki derinlik gizli durumunu birleştiren ve bir sonraki derinlik temel gerçeği simgesi yerleştiren.
- Paylaşılan yerleşim `E`(Ana modelle aynı).
- Paylaşılan çıkış başlığı `Out`(Ana modelle aynı).

Eğitim sırasında, pozisyon üzerinden bir önbellek için `i`, derinliklere göre gizli durum:

```math
\begin{aligned}
h_i^{(0)} &= \text{main model backbone at position } i \\
h_i^{(k)} &= T_k\Big( M_k \cdot \mathop{\mathrm{concat}}\big(\mathop{\mathrm{RMSNorm}}(h_i^{(k-1)}), \mathop{\mathrm{RMSNorm}}(E(t_{i+k}))\big) \Big) \quad \text{for } k \ge 1
\end{aligned}
```

Derinlik tahminleri:

```math
\text{logits}_{i+k+1} = \mathop{\mathrm{Out}}(h_i^{(k)}) \quad \text{for } k = 1, \ldots, D
```

Derinlik kaybı , temel gerçeğe karşı çapraz entropi .`t_{i+k+1}`- ...

```math
L_k = \mathop{\mathrm{CE}}(\text{logits}_{i+k+1}, t_{i+k+1})
```

Derinlikler boyunca eklem kaybı:

```math
L_{\text{MTP}} = \frac{\lambda}{D} \sum_{k=1}^{D} L_k
```

`lambda`DeepSeek-V3'de ilk %10 eğitim için 0.3 kullanılır ve sonrasında 0.1 kullanılır.`L_main + L_MTP`- Evet .

### Neden paralel değil, sıralı?

Gloeckle'nin orijinal paralel MTP'sinde D çıkış başları vardı, her biri doğrudan `h_i^(0)`Her baş tahmin ediyor .`t_{i+k}`Bu trenler iyi, ama tahminler birbirine bağlı değil.`head_1`Yardımcı çıkış .`head_2` kafalar paralel ateş eder.

DeepSeek-V3'ün dizaynı devamlı inşa ediliyor.`h_i^(k)`-`h_i^(k-1)`artı gerçek bir sonraki simge yerleştirme `E(t_{i+k})`Bu sebepli zinciri korur: tahmin etmek .`t_{i+k+1}`, derinlik modülü `k`Ne olduğunu görüyor.`t_{i+k}`Bu, yapısal olarak bir autoregressive dekoderin kendi çıkışını nasıl tükettiğine benzer, bu da MTP modüllerini spekülasyonsal dekodlama taslavu olarak doğrudan kullanılabilir hale getirir.

Sonuç: besin `h_i^(k-1)`ve taslağı`t_{i+k}`modülüne`k`, bir tahmin edin .`t_{i+k+1}`Tekrarlıyorum. Bu tam olarak EAGLE tarzı bir taslak, eğitimli MTP modülü kullanarak taslak ağ. DeepSeek-V3 ilk MTP modülü üzerinde %80+ kabul ve ~1.8x hızlanma rapor ediyor.

### Parametre muhasebe

Gizli bir model için .`h`ve kelime hazinesi `V`- ...

- Ana model: milyarlarca parametre, artı bir çıkış başlığı boyutu `V * h`- Evet .
- Paylaşılan çıkış başı: Ana modelin başını tekrar kullanın.
- Paylaşılan yerleştirme: Ana modelin yerleştirmesini yeniden kullan.
- MTP modülü başına:
  - Proje `M_k`- Evet .`(2h) * h = 2h^2`- Evet .
  - Transformer blokları `T_k`: dikkat (`4h^2`MHA için) artı MLP (genellikle `8h^2`SwiGLU için 8/3 oranı ile.`12h^2`- Bir blok için.

Modül başına toplam ekme: `~14h^2`DeepSeek-V3 için.`h = 7168`, D = 1 modül: `~14 * 7168^2 = ~720M`DeepSeek-V3 raporları 14B  fark çoğunlukla uzman katmanları MTP modülünde de MoE olmak.

### Spekülatör çözme ödülü

Ön eğitim sırasında, MTP modülleri eğitimini yaklaşık %10 yavaşlatır (daha ileri hesaplama, ekstra kayb).

1. Denser eğitim sinyali. Her gizli durum D+1 denetim hedeflerini görür. MMLU, GSM8K, MATH, HumanEval üzerindeki ölçülmüş etki: DeepSeek-V3'ün ablasiyonlarında tutarlı birkaç yüzde puan iyileştirmeler.

2. MTP modülü, önümüzdeki birkaç token'ı tahmin etmek için zaten eğitilmiştir. Bir proje ağı olarak yeniden tasarlanmıştır, %80+ kabul oranları sunar. Bu seviyede, N=3 veya N=5 spesifik çözme 1.8x throughput verir. İlk kez sonuçlar çıkarırken %10 eğitim süresi maliyeti ödenir.

### KİÇİN ile ilişki

EAGLE, küçük bir taslak modeli önceden eğitimden sonra SEPARATEL olarak eğitir. MTP taslakı önceden eğitim içine pişirir.

| Dimension | EAGLE-3 | MTP (DeepSeek-V3) |
|-----------|---------|------------------|
| When trained | Post-pre-training | During pre-training |
| Backward-compatible with existing weights | Yes | No (need to re-train) |
| Draft params | 1-2 transformer layers | 1 transformer block + projection |
| Acceptance rate | 0.88-0.92 | 0.80+ at depth 1 |
| Benefit beyond speedup | Speculative decoding only | Denser training signal + speedup |

```figure
multi-token-predict
```

## Yapın

`code/main.py`MTP modülü bir son son oluşturur: paylaşılan gömülme, projeksiyon, transformatör bloğu, paylaşılan çıkış başlığı. Daha sonra kısa bir sentetik dizide derinlik çapraz entropi kaybını hesaplar ve bileşenler tarafından parametrelerin sayısını yazdırır. 32 jetonlu bir oyuncak sözlük sayısı okunur.

### Adım 1: Paylaşılan yerleştirme masası

Tek bir tane .`vocab_size x hidden`Tablo, her derinlikte ana model ve her MTP modülü tarafından kullanılır.

### Adım 2: derinlik kombinasyonu

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

Gerçek DeepSeek-V3 iki RMSNormed vektörünü birleştirir .`[2h]`ve bir `h x 2h`Oyuncak stdlib kısaltması için vektör eklemesini kullanıyor.

### Adım 3: K derinliğinde transformatör blok

Kendi dikkatini artı MLP. Oyuncakta, bir katmanlı bir çizgiden dikkat bloğu ve SwiGLU MLP yapıyı numpy olmadan görünür tutmaktadır.

### 4. adım: Paylaşılan çıkış başlığı

Ana modelin çıkış projesi tekrar kullanın.

### Adım 5: Derinlik kaybı

Softmax'ın (logits) karşı karşıya geçiş sırasında yeraltı gerçeği simgesi karşı karşıya geçmesi`k+1`- Deniz derinliklerinde toplanıp `lambda / D`Ölçekleme faktörü.

### Adım 6: Parametre muhasebe

Toplam parametreler sayısını, paylaşılan (eğlenme, baş) sayısını ve modül başına ek sayıyı basın.

## Kullan

MTP, DeepSeek-V3 (Aralık 2024) ve DeepSeek-R1 serisine entegre edilmiştir.

- DeepSeek'in kendi servis yığını, MTP modülleri kasadan çıkmış spekülatör kodlayıcılar olarak tüketir.
- vLLM ve SGLang'ın Nisan 2026'dan itibaren DeepSeek-V3 MTP için entegrasyon yolları vardır.
- AMD'nin ROCm SGLang öğretim kitabı, V3 kontrol noktasında ölçülen 1.8× hızlandırma ile belirli bir MTP spekülasyonsal dekodlama yapılandırmasını gösterir.

Yeni bir eğitim öncesi koşuda MTP'yi ne zaman kullanmalısınız:

- Bütün antrenman öncesi boru hattını kontrol ediyorsun ve daha yoğun bir antrenman sinyali bankalamak istiyorsun.
- Model'e ölçekte hizmet vereceğini ve spekülasyonu ücretsiz olarak çözmek istediğini biliyorsun.
- Gizli boyutunuz en az 4096'dır. 1B ölçekinde, üst maliyet kazançtan daha fazla zarar verir.

Ne zaman yapmamak:

- MTP modülü eğitilmemiş.
- Temel bir temel çizgiyi karşılaştırmak için araştırma modelleri.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-mtp-planner.md`. Eğitim öncesi bir çalışma özellikini (model boyutu, veriler, hesaplama) göz önüne alarak, MTP'yi entegre etme planını gönderir: derinlik sayısı D, `lambda`Zamanlama, hafıza yükleme ve sonucu zaman spekülasyonu çözme kabloları.

## Egzersizler

1. Çık .`code/main.py`.Sintez sinyali güçlendikçe derinlik kaybının monoton olarak azalmasını göster.Sintezi sabit bir kalıp kullanmak için değiştirin ve hem derinlik-1 hem de derinlik-2 kaybının birleştiğini doğrulayın.

2. D = 1 MTP modülü olan yoğun 70B modeli için (goyduğu 8192, 80 katman) parametreler üstünü hesaplayın. DeepSeek-V3 rapor ettiği 14B üstünü karşılaştırın. DeepSeek'in sayısının neden daha yüksek olduğunu açıklayın: MTP transformatör bloku aynı MoE yapısını miras alır ve modül başına parametreler sayısını yükseltir.

3. Oyuncakta D=2 uygulamak: ikinci bir MTP modülü ekle$h^{(1)}$ve tahmin ediyor.`t_{i+3}`- Ortak kayıp ve parametreler hesaplamaları DeepSeek kağıdının 19-21 denklemlerine uygun olduğunu kontrol edin.

4. Oyuncakları paralel MTP'ye (Gloeckle tarzı) değiştirin: D çıkış başlıklarını ana gizli durumun üstüne ekleyin, her biri farklı bir sıyrıtı öngörür.

5. Eğlence tarzında bir taslak olarak eğitimli MTP modülü kullanın: önermek için k modülünü çağırın `t_{i+k+1}`Bu taslak tokenlerinin kabul oranını, baş modelin beklenen bir dizi üzerinde tahminlerine göre ölçün. Oyuncak üzerinde %50+'e ulaşırsanız, empiri MTP-as-draft özelliğini yeniden üretmiş olursunuz.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MTP module | "Extra loss block" | A small transformer block plus projection that predicts a token `k` positions ahead of the main model |
| Prediction depth | "Which offset" | The integer `k` such that module `k` predicts `t_{i+k+1}` from prefix through position `i` (the main model is depth 0 and predicts `t_{i+1}`) |
| Parallel MTP | "Gloeckle-style" | D independent heads on the same backbone hidden state, no conditional chain |
| Sequential MTP | "DeepSeek-V3 style" | Each module conditions on the previous depth's hidden state plus the next token's embedding; preserves causal chain |
| Shared output head | "Reuse the main head" | The MTP modules call the main model's LM head, not a separate output projection |
| Shared embedding | "Reuse the main table" | Same vocabulary embedding table is used everywhere; no duplicate parameters |
| Projection matrix $M_k$ | "Combine hidden + next-token" | An `h x 2h` linear layer that folds the previous hidden state and the target-token embedding into the next depth's input |
| Joint loss $L_{\text{MTP}}$ | "Averaged extra losses" | Arithmetic mean of per-depth cross-entropy losses, scaled by `lambda` |
| Acceptance rate at depth 1 | "How often MTP draft is right" | The rate at which the D=1 MTP module's top-1 prediction equals the main model's top-1 prediction; 80%+ on DeepSeek-V3 |
| Lambda weighting | "Extra-loss importance" | Per-depth scaling factor; 0.3 at start of training, 0.1 later on DeepSeek-V3 |

## Daha Fazla Okumak

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) toplam bir dizi MTP açıklaması (Bölüm 2.2), ortak kayıp denklemleri ve sonuçta 1.8× hızlandırma dahil
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) paralel MTP temel hattı DeepSeek'in tasarımı
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) 685B toplam (671B ana + 14B MTP), yerleştirme notları
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) spekülatör kodlama çerçevesinin MTP'si
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) EAGLE'nin 2025 tarihli tasarımı, karşılığı MTP ile rekabet ediyor
