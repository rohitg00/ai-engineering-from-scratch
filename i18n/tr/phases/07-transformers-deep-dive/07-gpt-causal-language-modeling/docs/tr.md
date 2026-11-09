# GPT  Sebep dili modeli

> BERT her iki tarafı da görüyor. GPT sadece geçmişi görüyor. Üçgen maskası modern AI'de en önemli tek bir kod satırıdır.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## Sorun

Bir dil modeli bir soruya cevap verir: ilk soruya göre `t-1`Token, token üzerinde olasılık dağılımının ne olduğu`t`Bu sinyali çalıştır  bir sonraki belirti tahmin  ve bir seferde bir belirti gibi keyfi metin oluşturabilecek bir model elde edersiniz.

Bu şekilde, her pozisyonun tahmininin sadece önceki pozisyonlara bağlı olması gerekir. aksi takdirde model cevaplara bakarak basitce aldatır.

Sebep maskası bunu yapar.`-inf`Bu değerler, softmax'den önce dikkat puanlarına eklenir. softmax'den sonra, bu pozisyonlar 0 olur. Her pozisyon sadece kendisini ve önceki pozisyonları takip edebilir. ve onu tüm dizine bir kez uyguladığınız için, bir ileri geçişte N paralel bir sonraki belirti tahminlerini elde edersiniz.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi  hepsi aynı çekirdek döngüsü olan sadece dekodörlü sebepçi transformatörlerdir. Onları ayıran şey veri kalitesi, ölçek ve mimari gelişmeler ve eğitim sonrası (SFT, RLHF, DPO ve onların halefi).

## Anlaşım

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### Maske .

Uzunluk bir sırayla .$N$, bir inşaat$N \times N$matris:

```math
M_{ij} = \begin{cases} 0 & \text{if } j \le i \\ -\infty & \text{if } j > i \end{cases}
```

Ekle`M`softmax öncesinde yapılan incelemeler için. $\exp(-\infty) = 0$Dikkat matrisinin her satırı sadece önceki pozisyonlar üzerinde bir olasılık dağılımıdır.

Uygulama maliyeti: 1 `torch.tril()`Çağrı, hesaplama zamanı: nanoseconds, etkisi: her şey.

### Üçgenin nereden geldiği yer

Maske genellikle dikkat üzerine bir yama olarak sunulur. Delivasyonu diğer yönde çalıştırın ve gizemli olmaktan vazgeçirilir: dikkat bir önbellek ortalamasının üçüncü gelişmesidir ve üçgen bir matris olarak yazılan ortalamanın döngü sınırlarıdır.

**Stage 1 — prefix average.**Bir dizi için en aptalca nedenci özet: pozisyon .$i$pozisyonların ortalaması olur.$0 \ldots i$Bir döngü olarak, bu `out[i] = X[:i+1].mean(0)`Aynı hesaplama bir matris çarpmasıdır.

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

Satır $i$$A$- Evet .$[1/(i+1), \ldots, 1/(i+1), 0, \ldots, 0]$Diyagonalın üzerindeki sıfırlar sebepliliktir. Gelecek hakkında hiçbir şey gizlenmemiştir. Gelecek asla toplamda değildi.

**Stage 2 — learned weights.**Bir düz ortalama, geçmişteki her simgeyi eşit derecede değerlendirir.`S`Şimdi sıralar artık yapısal olarak birine toplamamaktadır, bu nedenle sayıya bölmek yerine her satırı softmax ile normalleştirin. Softmax asla tam bir sıfır çıkarmaz, bu da nedenlik ilişkisini kırır  eğer gelecekteki puanlar  gibi girmezse `-inf`Çünkü ...`exp(-inf) = 0`- ...

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

Aynı üçgen, aynı satır-stochastic matris, aynı bir matmul.`-inf`Maske yeni bir makine değil. 1. aşamada sıfır girişler, softmax'in giriş alanına çevrilmiştir.

**Stage 3 — content-dependent weights.**2. aşamada.`S`Eğitimden sonra sabitlenir: pozisyon 7 her zaman pozisyon 3'ün ağırlığını aynı şekilde taşır.`S = Q @ K.T / sqrt(d_k)`Maske, yumruk, matmul aynı.

Üç aşama, bir değişmez: aşağı üçgen sıra-stochastic matrisi katı sıra.

```figure
mask-derivation
```

### Paralel eğitim, seri sonucu

Eğitim: Tümünü ileriye geçin `(N, d_model)`Bir dizi bir kez, N çapraz entropy kaybı (her pozisyonda bir), toplam, backprop hesaplayın.

İfade: simgeyi simge olarak oluşturursunuz.`[t1, t2, t3]`- Tamam .`t4`- Yem .`[t1, t2, t3, t4]`- Tamam .`t5`- Yem .`[t1, t2, t3, t4, t5]`- Tamam .`t6`KV önbelleği (Denevi 12) gizli durumları kaydetir .`t1…tn`Bu yüzden her adımını yeniden hesaplamazsınız. Ama sonucu derinliği = çıkış uzunluğu. bu da autoregressive vergisidir ve neden çözme her LLM'nin gecikme boğazıdır.

### Kayıp  birer birer değişim

Verilen tokens `[t1, t2, t3, t4]`- ...

- Giriş: `[t1, t2, t3]`
- Hedefler: `[t2, t3, t4]`

Her pozisyon için .`i`, hesaplama`-log P(target_i | inputs[:i+1])`Bu, bütün dizinin çapraz entropisi.

Bu kayıpta trenler hakkında duyduğunuz her transformatör LM.

### Şifreleme stratejileri

Eğitimden sonra, örnek seçimi insanların düşündüklerinden daha önemli.

| Method | What it does | When to use |
|--------|--------------|-------------|
| Greedy | Argmax every step | Deterministic tasks, code completion |
| Temperature | Divide logits by T, sample | Creative tasks, higher T = more diversity |
| Top-k | Sample from top-k tokens only | Kills low-probability tails |
| Top-p (nucleus) | Sample from smallest set with cumulative prob ≥ p | 2020+ default; adapts to distribution shape |
| Min-p | Keep tokens with `p > min_p * max_p` | 2024+; better at rejecting long tails than top-p |
| Speculative decoding | Draft model proposes N tokens, big model verifies | 2–3× latency reduction at same quality |

2026'da, min-p + sıcaklık 0.7 açık ağırlıklı modeller için makul bir varsayımdır.

### "GPT tarifi"nin işe yaramasına neden

1. **Decoder-only.**Bir katman için bir dikkat + FFN.
2. **Scaling.**124M → 1.5B → 175B → trilyonlar. Chinchilla ölçekleme yasaları (Denevi 13) size hesaplama nasıl harcanır, söyler.
3. **In-context learning.**6B13B civarında ortaya çıktı. Model ince ayarlama yapmadan birkaç atış örneğini takip edebilir.
4. **RLHF.**İnsan tercihleri üzerine eğitim sonrası, çiğ hazırlanmış metinleri sohbet asistanlarına dönüştürdü.
5. **Pre-norm + RoPE + SwiGLU.**Stablı bir eğitim.

GPT-2'den beri temel mimarlık çok fazla değişmedi. Veriler, ölçek ve eğitim sonrası ilkeler ile ilgili ilginç şeyler oldu.

```figure
causal-mask
```

## Yapın

### Adım 1: sebep maskası

Bakın .`code/main.py`Tek satırlı bir.

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

- Bu tüm mekanizma.

### İkinci adım: İki katmanlı GPT-like model

İki dekoder blokunu yığ (maskeli kendi dikkat + FFN, çapraz dikkat yok). Bir token gömülmesi, bir pozisyon kodlaması ve bir unembedding ekleyin (GPT-2'den bu yana token gömülme matrisine bağlanmış  standart bir numara).

### Adım 3: Sonraki belirti tahmin, sonundan sonuna

20 token oyuncak sözcük üzerinde, her pozisyonda logit üretin. Bir-bir değişim hedefi karşı çapraz entropik kayıp hesaplayın.

### 4. adım: Örnekleme

Açgözlülük, sıcaklık, üst-k, üst-p, min-p uygulayın. Her birini sabit bir istekle çalıştırın ve çıkışları karşılaştırın.

## Kullan

PyTorch, 2026 dilini:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

Kapusunun altında,`generate()`Önceki geçitini yürütür, son pozisyon logitlerini çekir, bir sonraki jetonu örnekler, ekler ve tekrarlar. Her üretim LLM sonuç kümesi (vLLM, TensorRT-LLM, llama.cpp, Ollama, MLX) aynı döngüyü ağır optimizasyonla uyguluyor  toplu önceden doldurma, sürekli serileme, KV önbelleği sayfalama, spekülasyonsal dekodlama.

**GPT vs BERT, one line each:**GPT tahminleri $P(x_t \mid x_{<t})$BERT tahmin ediyor .$P(x_{\text{masked}} \mid x_{\text{unmasked}})$Kayıp, modelin üretebildiğini belirler.

## Gönder

Bakın .`outputs/skill-sampling-tuner.md`. Yetenek yeni nesil görev için örnekleme parametrelerini seçer ve deterministik dekodlama gerektiğinde işaretler.

## Egzersizler

1. **Easy.**Çık .`code/main.py`ve nedenci dikkat matrisinin softmax'den sonra alt üçgenli olduğunu kontrol edin.
2. **Medium.**Beam 4 ile açgözlülüğün karmaşıklığını 10 kısa sorguda karşılaştırın. Beam her zaman kazanıyor mu? (Tavsiye: genellikle çeviri için, açık uç sohbet için değil.)
3. **Hard.**Spekülatör çözümü uygulayın: taslak olarak küçük bir iki katlı model ve doğrulayıcı olarak 6 katlı model kullanın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Causal mask | "The triangle" | Upper-triangular `-inf` matrix added to attention scores so position `i` only sees positions `≤ i`. |
| Next-token prediction | "The loss" | Cross-entropy of the model's distribution against the true next token at every position. |
| Autoregressive | "Generate one at a time" | Feed output back as input; parallelism only during training, not during generation. |
| Logits | "Pre-softmax scores" | Raw output of the LM head before softmax; sampling happens on these. |
| Temperature | "Creativity knob" | Divide logits by $T$; $T \to 0$ = greedy, $T \to \infty$ = uniform. |
| Top-p | "Nucleus sampling" | Truncate distribution to smallest set summing to $\ge p$; sample from what remains. |
| Min-p | "Better than top-p" | Keep tokens where `p ≥ min_p × max_p`; adapts cutoff to sharpness of distribution. |
| Speculative decoding | "Draft + verify" | Cheap model proposes N tokens; big model verifies in parallel. |
| Teacher forcing | "Training trick" | During training, feed the true previous token, not the model's prediction. Standard for every seq2seq LM. |

## Daha Fazla Okumak

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) GPT-1.
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) GPT-2.
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) GPT-3 ve bağlam içi öğrenme.
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Spec kodlama kağıdı.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) Kanonik nedensel-LM referans kodu.
