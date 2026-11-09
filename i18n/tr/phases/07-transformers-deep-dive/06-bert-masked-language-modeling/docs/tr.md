# BERT  Maskeli Dil Modelleştirme

> GPT bir sonraki kelimeyi tahmin ediyor. BERT bir eksik kelimeyi tahmin ediyor.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## Sorun

2018 yılında her NLP görevi  duygu, NER, QA, entailment  kendi etiketlenmiş verilerinde sıfırdan kendi modelini eğitmiş. Düzeltirilebilecek önceden eğitilmiş "İngilizce anlama" kontrol noktası yoktu. ELMo (2018) iki yönlü LSTM ile bağlamlı yerleşimleri önceden eğitilebileceğini göstermiştir; yardımcı oldu ancak genelleştirmedi.

BERT (Devlin et al. 2018) sordu: Bir transformatör kodlayıcıyı alıp internet'teki her cümle üzerinde eğitirsek ve iki taraftan da bağlamdan kayıp kelimeleri tahmin etmeye zorlasak ne olur?

Sonuç: 18 ay içinde BERT ve onun çeşitleri (RoBERTa, ALBERT, ELECTRA) var olan her NLP liderliğindeki her bir kişiye hakim oldu. 2020 yılına kadar dünyanın her arama motoru, içerik moderasyon boru hattı ve semantik arama sistemi içinde bir BERT vardı.

2026'da sadece kodlayıcı modeller sınıflandırma, geri çekim ve yapılandırılmış çıkarma için hala doğru araçtır.

## Anlaşım

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### Eğitim sinyali

Bir cümle alın:`the quick brown fox jumps over the lazy dog`- Evet .

Tokenlerin % 15'ini rastgele maske edin:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Modelle, maskeli pozisyonlarda orijinal jetonları tahmin etmeyi eğit. Çünkü kodlayıcı iki yönlüdür, tahmin eder `[MASK]`1 pozisyonda kullanabilirsiniz `brown fox jumps`GPT'nin yapamayacağı şey bu.

### BERT maskası kuralları

Tahmin için seçilen tokenlerin %15'inden:

- % 80 ' i `[MASK]`- Evet .
- %10'u rastgele bir token ile değiştirilir.
- %10 değişmez kalır.

Neden her zaman değil ?`[MASK]`- Çünkü ...`[MASK]`Bu modelin tahminini öğrenmek için çalıştırmak.`[MASK]`Bu, maskeli pozisyonların %100'inde, antrenman öncesi ve ince ayarlama arasında bir dağılım değişikliğini yaratır.

### Sonraki Ceza Tahmini (NSP)  ve neden düşürüldü

Orijinal BERT ayrıca NSP üzerinde eğitim aldı: A ve B cümlelerini vererek, B'nin A'yı takip ettiğini tahmin edin. RoBERTa (2019) onu kaldırdı ve NSP'nin zarar verdiğini gösterdi, yardımcı olmadı.

### 2026'da Ne Değişti: ModernBERT

2024 ModernBERT kağıdı, blokları 2026 ilkelerle yeniden inşa etti:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

2018 pilinden farklı olarak, Flash-Attention-native. Inference daha iyi GLUE puanları ile DeBERTa-v3'den 8K dizide 23x daha hızlıdır.

### 2026'da hala bir kodlayıcı seçen kullanım durumları

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## Yapın

### Adım 1: Gizli mantık

Bakın .`code/main.py`- Fonksiyon`create_mlm_batch`Token ID'lerinin, bir sözcük boyutunun ve bir mask olasılık listesini alır. Giriş ID'lerini (mask uygulanan) ve etiketleri (sadece maskeli pozisyonlarda, -100 başka yerlerde  PyTorch'in indeksi kabulü görmezden gelme kuralı) gönderir.

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Adım 2: Küçük bir korpus üzerinde MLM tahminini çalıştır

2 katlı bir kodlayıcı + MLM başını 20 kelime, 200 cümle kelime birikimi üzerinde eğit.

### Adım 3: Maske türlerini karşılaştırın

Üç yönlü kuralın modelin nasıl kullanılabilir hale geldiğini göster .`[MASK]`- Maskeli cümle ve maskeli cümle üzerine tahmin yapın. Her ikisi de makul bir simge dağıtımları üretmelidir çünkü model eğitimde her iki örneği de görmüştür.

### Dördüncü adım: ince ayarlı baş

Bir oyuncak duygu verisi kümesindeki sınıflandırma başlığı ile değiştirin. Sadece baş trenleri; kodlayıcı donmuştur. Bu her BERT uygulamasının takip ettiği bir kalıp.

## Kullan

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers``all-MiniLM-L6-v2`Bu, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer tür devirde, bir diğer bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, bir devirde, birde, bir devirde, bir devirde, bir devirde, bir de, bir devirde,

**Cross-encoder rerankers are also fine-tuned BERT.**Çift sınıflandırma `[CLS] query [SEP] doc [SEP]`Arama ve belge arasındaki iki yönlü dikkat, çapraz kodlayıcılara iki yönlü kodlayıcılara karşı kalite kenarlarını veren tam olarak budur.

**When not to pick BERT in 2026.**Genereatif bir şey. Kodlayıcı, jetonları otomatik olarak üretmek için mantıklı bir yolun bulunmuyor. Ayrıca: küçük bir dekoderin daha esnek bir şekilde kalitesi eşleştirebileceği 1B parametrelerinin altında olan herhangi bir şey (Phi-3-Mini, Qwen2-1.5B).

## Gönder

Bakın .`outputs/skill-bert-finetuner.md`. Yetenek alanı yeni bir sınıflandırma veya çıkarma görevi için BERT ince ayarlamaları (yöntemlilik seçimi, baş özellikleri, veriler, değerlendirme, durma) yapar.

## Egzersizler

1. **Easy.**Çık .`code/main.py`Bu sayede %15'i onaylayıp %80'i de onaylayıp %10'a dağıtılır.`[MASK]`- Evet .
2. **Medium.**Tam kelime maskesini uygulayın: bir kelime alt kelimelere simgelik yapılırsa, tüm alt kelimeleri bir araya getir veya hiç bir şey maske edin. Bu 500 cümlelik bir korpusta MLM doğruluğunu arttırır mı ölçün.
3. **Hard.**Halkın bir veri kümesinden 10.000 cümle üzerine küçük bir (2 katman, d=64) BERT eğit.`[CLS]`- Dönüştürücü-tek bir başlangıç çizgisi ile karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Daha Fazla Okumak

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) orijinal kağıt.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692)BERT'i nasıl doğru şekilde eğitilir?
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) değiştirilmiş belirti tespitleri eşleşen hesaplamalarda MLM'yi yener.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663)ModernBERT kağıdı.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) Kanonik kodlayıcı referansı.
