# Uzmanların Karışığı (MoE)

> Dense 70B transformatörü her token için her parametreyi etkinleştirir. 671B MoE, her token için sadece 37B'yi etkinleştirir ve her referans markasında onu yenir.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Sorun

Dense bir transformatörün FLOP'leri, parametre sayısının (geri geçiş için 2 kat) eşit olduğu sonucunda. Dense bir modeli ölçeklendirir ve her token tüm faturayı öder. 2024 yılına gelindiğinde sınır bir hesaplama duvarına çarpardı: anlamlı olarak daha akıllı olmak için, bir token için eksponensel olarak daha fazla FLOP'ye ihtiyacınız vardı.

Uzmanlar karışımı bu bağlantıyı kırar.$E$bağımsız uzmanlar + seçen bir yönlendiricisi $k$Teknes başına uzmanlar.$E \times \text{FFN size}$. Token başına aktif parametreler = $k \times \text{FFN size}$.2026 tipi yapılandırma: $E=256$- Evet .$k=8$. depolama ölçekleri $E$, hesaplama ölçekleri ile $k$- Evet .

2026 sınır neredeyse tamamen MoE: DeepSeek-V3 (671B toplam / 37B aktif), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss. Yapay Analiz'in bağımsız liderlik tablosunda, en iyi 10 açık kaynaklı model tüm MoE.

## Anlaşım

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### FFN değişimi

Sıkı transformatör blokları:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE blok:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Her uzman bağımsız bir FFN (genellikle SwiGLU) dir. yönlendiricisi tek bir doğrusal katman. Her token kendi seçer.`k`uzmanları ve çıkışlarını kapalı bir karışım alır.

### Yük denge problemi

Eğer yönlendiriciler, %90'ı uzman 3'ün üzerinden gönderirse diğer uzmanlar aç kalır.

1. **Auxiliary load-balancing loss**(Switch Transformer, Mixtral). Uzman kullanımdaki değişikliğe göre bir ceza ekleyin. Çalışır, ancak bir hiperparametre ve ikinci bir gradient sinyali ekler.
2. **Expert capacity + token dropping**(Erken Switch) Her uzman en fazla işlem yapar.$C \times N/E$Tokenler, aşırı akış tokenleri katmanı atlar.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). Router'ın üst-k seçimini değiştiren bir uzman başına öğrenilen önyargıyı ekleyin.

DeepSeek-V3'ün yaklaşımı: her eğitim aşamasından sonra, her uzman için, kullanımının hedefin üzerinde veya altında olup olmadığını kontrol edin.`±γ`Seçim kullanımı`scores + bias`- Kaplama için kullanılan uzman olasılıkları ,`scores`- Yollama ifadelerinden koparılmasını.

### Ortak uzmanlar

DeepSeek-V2/V3 ayrıca uzmanları *shared* ve *routed* olarak bölüyor. Her token tüm ortak uzmanlardan geçer. Routed uzmanlar üst-k üzerinden seçilir. Ortak uzmanlar ortak bilgiyi yakalar; yönlendirilmiş uzmanlar uzmanlaşır. V3 1 ortak uzman artı 256 yönlendirilmiş üst-8'i çalışır.

### Güzel tahıllardaki uzmanlar

Klasik MoE (GShard, Switch): her uzman, tam bir FFN kadar geniş. `E`küçük (864), `k`küçüktür (12).

Modern ince tanelerli MoE (DeepSeek-V3, Qwen-MoE): her uzman daha dar (1/8 FFN boyut). $E$büyüktür (256+), $k$Aynı toplam parametreler, ancak kombinasyonlar daha hızlı ölçeklendirilir. $\binom{256}{8} \approx 400$Bir token için trilyonlarca uzman var.

### Maliyet profili

Bir token, bir katman:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 neredeyse her referans değerinde Llama 3 70B ' yi yener .**fewer active FLOPs per token**Daha fazla parametre = daha fazla bilgi. Daha aktif FLOPs = daha fazla hesaplama.

### Anlık: hafıza

Tüm uzmanlar, hangi birinden ateşlenmesine bakmaksızın GPU'da yaşarlar. 671B modeli fp16 ağırlıkları için ~ 1.3 TB VRAM gerektirir. Frontier MoE dağıtımı uzman paralellik gerektirir.

```figure
expert-routing
```

## Yapın

Bakın .`code/main.py`. Temiz bir stdlib'de kompakt bir MoE katmanı:

- `n_experts=8`SwiGLU uzmanları (her biri çizgici, örneğe göre)
- üst k=2 yönlendirme
- Softmax normalleştirilmiş kaplama ağırlıkları
- Uzmanlık önyargısı yoluyla yardımcı kayıpsız dengeleme

`code/main.rs`Rust Port'ı aynı fonksiyonlara ve demolara sahip. Sadece standart kütüphaneden kullanır.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Adım 1: Router

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Bu, DeepSeek-V3 numarasının  bias modeli tahminlerini yönlendirmeden yük dengesizliğini düzeltiyor.

### Adım 2: 100 tokeni yönlendiriciden çalıştır

Bilgi alanları hangi uzmanların ne sıklıkla ateş ettiğini takip et.`-γ`Aşırı kullanılmış uzmanlar için, `+γ`(ki) kullanımı birkaç tekrarla aynı bir dağılım halinde dönüşür.

### Adım 3: Param sayı karşılaştırması

Bir MoE yapılandırmasının "sık eşdeğerini" yazdır. DeepSeek-V3- şeklinde: 256 yönlendirilmiş + 1 paylaşılan, 8 aktif, d_model=7168. Toplam parametreler sayısı gözleri aydınlatır.

## Kullan

HuggingFace yüklenmesi:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 üretim sonucu: vLLM MoE yönlendirmeyi doğal olarak destekler. SGLang en hızlı uzman paralel yolu vardır.

**When to pick MoE:**
- Bir token için daha düşük bir sonuç fiyatı ile sınır kalitesi istiyorsunuz.
- VRAM / uzman paralel altyapınız var.
- İş yükünüz token ağır (çat, kod) bağlam ağır (uzun belgeleri) değil.

**When NOT to pick MoE:**
- Kenar dağıtım  aktif FLOP için tam depolama ödüllendiriyorsunuz.
- Latency-critical single-user servis  uzman yönlendirme genel maliyet ekler.
- Küçük modeller (<7B)  MoE'nin kalite avantajı sadece hesaplama eşiğinden (~6B aktif parametreler) ötesinde görülür.

## Gönder

Bakın .`outputs/skill-moe-configurator.md`. Yetenek yeni bir MOE için E, k ve ortak uzman düzenini seçer.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Yardımcı kayıpsız önyargı güncelleme 50'den fazla iterasyonda uzman kullanımını nasıl düzeltiyor.
2. **Medium.**Öğrenilen yönlendiricini hash tabanlı yönlendiricilerle değiştirin (deterministik, öğrenme yok). Kaliteli ve dengeyi karşılaştırın. Öğrenilen yönlendiriciler neden daha iyidir?
3. **Hard.**GRPO tarzında "rollout-matched routing" uygulamak (DeepSeek-V3.2 hilesi): akıl yürütme sırasında uzmanların ateşlediği kayıtları, gradient hesaplama sırasında aynı yönlendirmeyi zorlamak. Oyuncak politika-gradient ayarlama üzerindeki etkisini ölçmek.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## Daha Fazla Okumak

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)- İdeya.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) Switch, klasik MoE.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + yardımcı kayıpsız MoE + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) önyargılı dengeleme kağıdı.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) ince taneler + paylaşım uzmanı bu ders için yönlendirme kullanımı bölüştürdü.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) orijinal ortak uzman makalesi.
