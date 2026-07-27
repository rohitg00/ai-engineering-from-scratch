# GPT — Nedensel Dil Modellemesi

> BERT her iki tarafı da görür. GPT yalnızca geçmişi görür. Üçgen maskesi, modern yapay zekadaki en önemli tek satır koddur.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 7 · 02 (Self-Attention), Aşama 7 · 05 (Tam Transformer), Aşama 7 · 06 (BERT)
**Süre:** ~75 dakika

## Sorun

Bir dil modeli bir soruyu yanıtlıyor: İlk `t-1` token'ler göz önüne alındığında, token `t` üzerinden olasılık dağılımı nedir? Bu sinyal üzerinde antrenman yapın - sonraki-token tahmini - ve her seferinde bir token rastgele metin üretebilen bir model elde edersiniz.

Bunu paralel bir dizi üzerinde uçtan uca eğitmek için, her konumun tahmininin yalnızca önceki konumlara bağlı olması gerekir. Aksi takdirde model cevaba bakarak önemsiz bir şekilde hile yapar.

Nedensellik maskesi bunu yapar. Softmax'tan önce dikkat puanlarına eklenen `-inf` değerlerinin tek bir üst üçgen matrisidir. Softmax'tan sonra bu pozisyonlar 0 olur. Her pozisyon yalnızca kendisine ve önceki pozisyonlara katılabilir. Ve bunu tüm diziye bir kez uyguladığınız için, tek bir ileri geçişte N paralel sonraki-token tahmin elde edersiniz.

GPT-1 (2018), GPT-2 (2019), GPT-3 (2020), GPT-4 (2023), GPT-5 (2025), Claude, Llama, Qwen, Mistral, DeepSeek, Kimi — hepsi aynı çekirdek döngüye sahip, yalnızca kod çözücüye yönelik nedensel transformer'lerdir. Onları ayıran şey veri kalitesi, ölçek ve mimari iyileştirmeler ve eğitim sonrasıdır (SFT, RLHF, DPO ve onların halefleri).

## Konsept

![Nedensel maske üçgen bir dikkat matrisi oluşturur](../assets/causal-attention.svg)

### Maske

`N` uzunluğunda bir dizi verildiğinde, bir `N × N` matrisi oluşturun:

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

Softmax'tan önceki ham dikkat puanlarına `M` ekleyin. `exp(-inf) = 0`, yani maskelenmiş konumlar sıfır ağırlığa katkıda bulunur. Dikkat matrisinin her satırı yalnızca önceki konumlara göre bir olasılık dağılımıdır.

Uygulama maliyeti: bir `torch.tril()` çağrı. Hesaplama süresi: nanosaniye. Sahadaki etki: her şey.

### Üçgenin nereden geldiği

Maske genellikle dikkat üzerine yapıştırılmış bir yama olarak sunulur. Türetmeyi diğer yönde çalıştırdığınızda gizemli olmaktan çıkar: Dikkat, bir önek ortalamasının üçüncü iyileştirmesidir ve üçgen, bu ortalamanın matris olarak yazılan döngü sınırlarıdır.

**Aşama 1 — önek ortalaması.** Bir dizinin en saçma nedensel özeti: `i` konumu, `0…i` konumlarının ortalaması olur. Döngü olarak bu `out[i] = X[:i+1].mean(0)`'dir. Aynı hesaplama bir matris çarpımıdır. Birler alt üçgen matrisini alın, her satırı sayıya bölün ve çarpın:

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

`A` satırının `i`. satırı `[1/(i+1), …, 1/(i+1), 0, …, 0]`. Köşegenin üzerindeki sıfırlar nedenselliktir. Geleceğe dair hiçbir şey maskelenmemişti; gelecek asla toplamın içinde değildi.

**Aşama 2 — öğrenilen ağırlıklar.** Tek tip bir ortalama, her geçmiş token'yi eşit derecede alakalı olarak ele alır. Bunları öğrenilmiş puan matrisi `S` ile değiştirin. Artık satırların toplamı artık yapıya göre bir olmuyor; bu nedenle her satırı sayıya bölmek yerine softmax ile normalleştirin. Softmax asla tam bir sıfır çıkarmaz, bu da nedenselliği bozar - gelecekteki puanlar `-inf` olarak girmediği sürece, çünkü `exp(-inf) = 0`:

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

Aynı üçgen, aynı satır stokastik matrisi, aynı matmul. `-inf` maskesi yeni bir makine değil. Softmax'ın giriş alanına çevrilmiş, aşama 1'in sıfır girişleridir.

**Aşama 3 — içeriğe bağlı ağırlıklar.** 2. aşamada, `S` eğitimden sonra sabitlenir: konum 7, token'lar ne derse desin, konum 3'ü her zaman aynı şekilde ağırlaştırır. Puanların token'ların kendilerine bağlı olmasına izin verin: `S = Q @ K.T / sqrt(d_k)`. Başka hiçbir şey değişmiyor. Maske, softmax, matmul — aynı.

Üç aşama, bir değişmez: alt üçgen sıra stokastik matris çarpı dizi. Düzgün ortalama, öğrenilmiş statik ağırlıklar, içeriğe bağlı ağırlıklar. Maske hiçbir zaman dikkatlere eklenmedi. Ortalamadan kurtuldu.

```figure
mask-derivation
```

### Paralel eğitim, seri inference

Eğitim: `(N, d_model)` dizisinin tamamını bir kez ileri iletin, N çapraz entropi kaybını hesaplayın (konum başına bir), toplam, geri yayılım. Dizi boyunca paralel. GPT eğitiminin ölçeklenmesinin nedeni budur; tek bir GPU geçişinde toplu olarak 1 milyon tokens işlersiniz.

Inference: token ile token üretirsiniz. `[t1, t2, t3]`'ı besle, `t4`'ı al. `[t1, t2, t3, t4]`'yi besle, `t5`'yı al. `[t1, t2, t3, t4, t5]`'ı besle, `t6`'ı al. KV önbelleği (Ders 12), `t1…tn`'nın gizli durumlarını kaydeder, böylece bunları her adımda yeniden hesaplamazsınız. Ancak inference'deki seri derinlik = çıkış uzunluğu. Bu otoregresif vergidir ve kod çözmenin neden her LLM'nin gecikme darboğazı olduğunu gösterir.

### Kayıp — tek tek

Verilen tokens `[t1, t2, t3, t4]`:

- Giriş: `[t1, t2, t3]`
- Hedefler: `[t2, t3, t4]`

Her `i` konumu için `-log P(target_i | inputs[:i+1])`'yi hesaplayın. Toplam. Bu, tüm dizi için çapraz entropidir.

Her transformer LM'de bu kayıp üzerine tren yapıldığını duymuşsunuzdur. Eğitim öncesi, fine-tuning, SFT — aynı kayıp, farklı veriler.

### Kod çözme stratejileri

Eğitimden sonra örnekleme seçimleri insanların düşündüğünden daha fazla önem taşır.

| Yöntem | Ne işe yarar | Ne zaman kullanılır |
|--------|--------------|-------------|
| açgözlü | Argmax her adımda | Deterministik görevler, kod tamamlama |
| Sıcaklık | Logitleri T'ye bölün, örnek | Yaratıcı görevler, daha yüksek T = daha fazla çeşitlilik |
| Üst-k | Yalnızca en iyi token'lerden örnek | Düşük olasılıklı yazıları öldürür |
| Üst-p (çekirdek) | Kümülatif prob ≥ p olan en küçük kümeden örnek | 2020+ varsayılan; dağıtım şekline uyum sağlar |
| Min-p | token'ları `p > min_p * max_p` ile birlikte tutun | 2024+; uzun kuyrukları reddetme konusunda en iyilerden daha iyi |
| Spekülatif kod çözme | Taslak model N token önerir, büyük model | Aynı kalitede 2–3 kat gecikme azalması |

2026'da min-p + sıcaklık 0,7, açık ağırlıklı modeller için makul bir varsayılan değerdir. Spekülatif kod çözme, herhangi bir üretim inference yığını için masa bahisleridir.

### "GPT tarifinin" işe yaramasını sağlayan şey neydi

1. **Yalnızca kod çözücü.** Kodlayıcı ek yükü yok. Bir dikkat geçişi + katman başına FFN.
2. **Ölçeklendirme.** 124M → 1,5B → 175B → trilyon. Chinchilla ölçeklendirme yasaları (Ders 13) size bilişimi nasıl harcayacağınızı anlatır.
3. **Bağlam içi öğrenme.** 6B–13B civarında ortaya çıktı. Model, fine-tuning olmadan birkaç çekimli örnekleri takip edebilir.
4. **RLHF.** İnsan tercihleri ​​üzerine eğitim sonrası, önceden eğitilmiş ham metinler sohbet asistanlarına dönüştürüldü.
5. **Ön norm + RoPE + SwiGLU.** Geniş ölçekte istikrarlı eğitim.

Çekirdek mimari GPT-2'den bu yana pek değişmedi. Verilerde, ölçekte ve eğitim sonrasında ilginç olan her şey gerçekleşti.

```figure
causal-mask
```

## Build It — Kendin Oluştur

### Adım 1: nedensellik maskesi

Bkz. `code/main.py`. Tek satırlık bir yazı:

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Softmax'tan önce dikkat puanlarına ekleyin. Tüm mekanizma bu.

### 2. Adım: 2 katmanlı GPT benzeri bir model

İki kod çözücü bloğunu üst üste yerleştirin (maskeli self-attention + FFN, çapraz dikkat yok). Bir token embedding, bir konumsal kodlama ve bir unembedding ekleyin (token embedding matrisine bağlı - GPT-2'den bu yana standart bir numara).

### Adım 3: sonraki-token tahmin, uçtan uca

20-token oyuncak kelime dağarcığında, her konumda logitler üretin. Tek tek kaydırma hedefine göre çapraz entropi kaybını hesaplayın. Hayır gradient — bu bir ileri geçiş akıl sağlığı kontrolüdür.

### Adım 4: örnekleme

Açgözlü, sıcaklık, üst-k, üst-p, min-p'yi uygulayın. Her birini sabit bir prompt üzerinde çalıştırın ve çıktıları karşılaştırın. Bir örnekleme fonksiyonu 10 satırdır.

## Use It — Uygula

PyTorch, 2026 deyimi:

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

Temel olarak, `generate()` ileri geçişi çalıştırır, son konum logitlerini çeker, sonraki token'yi örnekler, ekler ve tekrarlar. Her üretim LLM inference yığını (vLLM, TensorRT-LLM, llama.cpp, Ollama, MLX), toplu ön doldurma, sürekli toplu işlem, KV önbellek sayfalama, spekülatif kod çözme gibi yoğun optimizasyonla aynı döngüyü uygular.

**GPT ve BERT, her biri birer satır:** GPT, `P(x_t | x_{<t})`'yi tahmin ediyor. BERT `P(x_masked | x_unmasked)`'yi tahmin ediyor. Kayıp, modelin oluşturulup oluşturulamayacağını belirler.

## Ship It — Kullanıma Sun

Bkz. `outputs/skill-sampling-tuner.md`. Beceri, yeni nesil bir görev için örnekleme parametrelerini seçer ve deterministik kod çözme gerektiğinde işaretler.

## Egzersizler

1. **Kolay.** `code/main.py` komutunu çalıştırın ve nedensel dikkat matrisinin softmax'tan sonra alt üçgensel olduğunu doğrulayın. Nokta kontrolü: 3. satırda yalnızca 0-3 arasındaki sütunlarda ağırlıklar bulunmalıdır.
2. **Orta.** Genişlik 4 için ışın aramasını uygulayın. 10 kısa prompts'de ışın-4 ile açgözlülüğün karmaşıklığını karşılaştırın. Işın her zaman kazanır mı? (İpucu: genellikle çeviri içindir, açık uçlu sohbet için değildir.)
3. **Zor** Spekülatif kod çözmeyi uygulayın: taslak olarak 2 katmanlı küçük bir model ve doğrulayıcı olarak 6 katmanlı bir model kullanın. 64 uzunluğundaki 100 tamamlamada duvar saati hızını ölçün. Çıktıların doğrulayıcının açgözlülüğüyle eşleştiğini doğrulayın.

## Anahtar Terimler

| Terim | Yaygın ifade | Gerçek anlamı |
|------|-----------------|-----------------------|
| Nedensel maske | "Üçgen" | Dikkat puanlarına üst üçgen `-inf` matrisi eklendi, böylece `i` konumu yalnızca `≤ i` konumlarını görüyor. |
| Sonraki-token tahmin | "Kayıp" | Her konumdaki gerçek sonraki token'ye karşı modelin dağılımının çapraz entropisi. |
| Otoregresif | "Tek seferde bir tane oluşturun" | Çıkışı giriş olarak geri besleyin; paralellik yalnızca eğitim sırasında, nesil sırasında değil. |
| Logitler | "Softmax öncesi puanlar" | Softmax'tan önce LM kafasının ham çıktısı; örnekleme bunlar üzerinde gerçekleşir. |
| Sıcaklık | "Yaratıcılık düğmesi" | Logitleri T'ye bölün; T→0 = açgözlü, T→∞ = tek biçimli. |
| Üst-p | "Çekirdek örneklemesi" | Dağıtımı en küçük kümeye toplayarak ≥p'ye kısaltın; kalanlardan örnek. |
| Min-p | "En iyi p'den daha iyi" | tokens'yi `p ≥ min_p × max_p`'da tutun; kesmeyi dağıtımın keskinliğine uyarlar. |
| Spekülatif kod çözme | "Taslak + doğrula" | Ucuz model N tokens önerir; büyük model paralel olarak doğrulanır. |
| Öğretmen zorlama | "Eğitim hilesi" | Eğitim sırasında modelin tahminini değil, gerçek önceki token değerini besleyin. Her seq2seq LM için standart. |

## Daha Fazla Okuma

-[Radford ve ark. (2018). Üretken Ön Eğitimle Dil Anlayışının Geliştirilmesi](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) — GPT-1.
-[Radford ve ark. (2019). Dil Modelleri Denetimsiz Çoklu Görev Öğrenicileridir](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) — GPT-2.
- [Brown ve ark. (2020). Dil Modelleri Birkaç Hızlı Öğrenicidir](https://arxiv.org/abs/2005.14165) — GPT-3 ve bağlam içi öğrenme.
- [Leviathan, Kalman, Matias (2023). Spekülatif Kod Çözme](https://arxiv.org/abs/2211.17192) aracılığıyla Transformer'lardan hızlı Inference - özel kod çözme kağıdı.
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) — kanonik nedensel-LM referans kodu.
