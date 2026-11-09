# T5, BART  Kodlayıcı-Küçükleme Modelleri

> Kodlayıcılar anlıyor. Dekoderler oluşturur. Onları bir araya getirir ve giriş → çıkış görevleri için bir model oluşturulur: çevir, özetle, yeniden yaz, transkripte et.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Sorun

Sadece dekodörlü GPT ve sadece kodlayıcı BERT her biri farklı bir amaç için 2017 mimarisini çizer.

- Çevirim: İngilizce → Fransızca.
- Toplam: 5.000 tokenlik makale → 200 tokenlik toplam.
- Konuşma tanımı: ses simgeler → metin simgeler.
- Yapılandırılmış çıkarma: proza → JSON.

Bu özellikler için, kodlayıcı-dekoder en temiz uyum sağlar. Kodlayıcı kaynağın yoğun bir temsilini üretir. Dekoder çıkış üretir, her adımda bu temsiline çapraz olarak katılır. Eğitim çıkış tarafında bir-bir değişimdir. GPT ile aynı kaybı, sadece kodlayıcı çıkışına bağlıdır.

Modern oyun kitabı iki makalede tanımlandı:

1. **T5**"Teks-yazı transfer transformer". Her NLP görevi metin-a, metin-a. tek mimarlık, tek kelime birikimi, tek kayıp olarak yeniden çerçevelidir. Gizli uzantı tahmininde önceden eğitilmiştir (girideki yozlaşmış uzantılar, çıkışta onları çözünür).
2. **BART**(Lewis et al. 2019). "İki yönlü ve Otomatik Geri Dönüştürücü Transformer. " Otomatik kodlayıcıyı reddetmek: çok yönlü olarak bozuk giriş (karıştırmak, maske, silmek, döndürmek), dekodörden orijinalini yeniden oluşturmasını isteyin.

2026 yılında kodlayıcı-dekoder biçimi giriş yapısının önemli olduğu yerlerde yaşar:

- Şapşır (söz → metin).
- Google'ın çeviri yığını.
- Bazı kod tamamlama / onarım modelleri farklı bağlam ve düzenleme yapıları vardır.
- Flan-T5 ve yapılandırılmış mantıklama görevleri için değişkenler.

Sadece dekoder odak noktasını kazandı, ama kodlayıcı dekoder asla gitmedi.

## Anlaşım

![Encoder-decoder with cross-attention](../assets/encoder-decoder.svg)

### Önceki döngü

```
source tokens ─▶ encoder ─▶ (N_src, d_model)  ──┐
                                                 │
target tokens ─▶ decoder block                   │
                 ├─▶ masked self-attention       │
                 ├─▶ cross-attention ◀───────────┘
                 └─▶ FFN
                ↓
              next-token logits
```

Önemli olan, kodlayıcı giriş başına bir kez çalışır. Dekoder otomatik olarak çalışır ancak her adımda * aynı * kodlayıcı çıkışına karşı çalışır. Kodlayıcı çıkışını önbelleğe koymak uzun girişler için ücretsiz bir hızlandırmadır.

### T5 Eğitim öncesi  Uçuş süresinin bozulması

Girişlerin rastgele uzantıları seçin (ortalama uzunluğu 3 token, toplam %15). Her uzantıyı benzersiz bir sentinel ile değiştirin: `<extra_id_0>`- Evet .`<extra_id_1>`, vb. Dekodör sadece bozuk olan alanları bekçi önlüğü ile çıkardı:

```
source: The quick <extra_id_0> fox jumps <extra_id_1> dog
target: <extra_id_0> brown <extra_id_1> over the lazy
```

T5 kağıtının ablasyonunda MLM (BERT) ve prefiks-LM (UniLM) ile rekabetçi.

### BART öncesi eğitim  Çok gürültü denetimi

BART beş gürültü fonksiyonunu dener:

1. İşaret maskeli.
2. İşaret silinmesi.
3. Metin doldurma (bir uzayı maske, dekodör doğru uzunluğu ekler).
4. Cevabı değiştirmek.
5. Belge dönüşümü.

Metin doldurma + cümle permutasyonu kombinasyonu en iyi aşağı akıntılı sayıları üretti. Dekodör her zaman orijinalini yeniden oluşturur. BART'in çıkışı sadece bozuk süreler değil, tüm dizidir  bu nedenle önceden hesaplama T5'ten daha yüksektür.

### İndirim

GPT ile aynı autoregressive nesil. Açgözlülük / ışın / üst-p örnekleme uygulanır. Çatlama oranından daha dar çıkış dağılımı olduğundan, ışın araması (genişliği 45) çevirme ve özetleme için standarttır.

### 2026'da her variansı ne zaman seçmeliyiz?

| Task | Encoder-decoder? | Why |
|------|------------------|-----|
| Translation | Yes, usually | Clear source sequence; fixed output distribution; beam search works |
| Speech-to-text | Yes (Whisper) | Input modality differs from output; encoder shapes audio features |
| Chat / reasoning | No, decoder-only | No persistent "input" — the conversation is the sequence |
| Code completion | Usually no | Decoder-only with long context wins; code models like Qwen 2.5 Coder are decoder-only |
| Summarization | Either works | BART, PEGASUS beat earlier decoder-only baselines; modern decoder-only LLMs match them |
| Structured extraction | Either | T5 is clean because "text → text" absorbs any output format |

~2022'den bu yana tendensi: sadece dekodör, kodlayıcı-dekodör sahip olduğu görevleri üstlenir çünkü (a) talimat ayarlı dekodör-tek LLM'ler istekle herhangi bir şeye genel hale gelir, (b) bir mimarinin iki taneye oranla daha kolay ölçeklenmesi, (c) RLHF bir dekodörü varsayır.

```figure
encoder-decoder
```

## Yapın

Bakın .`code/main.py`Oyuncak korpusu için T5 tarzı tarzı korumayı uyguluyoruz bu dersin en faydalı tek parçası çünkü o zamandan beri her kodlayıcı-dekoder öncesi eğitim tarifi içinde görünebilir.

### Adım 1: Uzay yolsuzluğu

```python
def corrupt_spans(tokens, mask_rate=0.15, mean_span=3.0, rng=None):
    """Pick spans summing to ~mask_rate of tokens. Return (corrupted_input, target)."""
    n = len(tokens)
    n_mask = max(1, int(n * mask_rate))
    n_spans = max(1, int(round(n_mask / mean_span)))
    ...
```

Hedef biçimi T5 sözleşmesi: `<sent0> span0 <sent1> span1 ...`. Bozuk giriş, değişmeyen tokenleri, bekçi tokenleriyle, uzanan yerlerde birbirine bırakır.

### Adım 2: Geri dönüş kontrolü

Bu, bir akıl kontrolüdür. Gerçek eğitim bunu asla yapmaz, ancak test ucuz ve zaman hesaplama işleminizde birer hata yakalar.

### Adım 3: BART gürültüsü

Beş fonksiyon: `token_mask`- Evet .`token_delete`- Evet .`text_infill`- Evet .`sentence_permute`- Evet .`document_rotate`İki tane yapıp sonuçları göster.

## Kullan

HuggingFace referansı:

```python
from transformers import T5ForConditionalGeneration, T5Tokenizer
tok = T5Tokenizer.from_pretrained("google/flan-t5-base")
model = T5ForConditionalGeneration.from_pretrained("google/flan-t5-base")

inputs = tok("translate English to French: Attention is all you need.", return_tensors="pt")
out = model.generate(**inputs, max_new_tokens=32)
print(tok.decode(out[0], skip_special_tokens=True))
```

T5 numarası: görev adı giriş metine girer. Aynı model onlarca görevi ele alır çünkü her görev metin-in, metin-out. 2026 yılında bu örnektir talimat ayarlı dekodör-tek modeller tarafından genelleştirildi, ancak T5 önce kodifiye edildi.

## Gönder

Bakın .`outputs/skill-seq2seq-picker.md`. Yetenek, giriş-çıktı yapısı, gecikme ve kalite hedefleri verildiği için yeni bir görev için sadece kodlayıcı-dekoder ve dekoder arasında seçim yapar.

## Egzersizler

1. **Easy.**Çık .`code/main.py`, 30 token cümleye uzanma bozukluğu uygula, sentinel olmayan kaynak tokenlerini çözülmüş hedef uzanmalarla bağlamanın orijinalini yeniden ürettiğini doğrula.
2. **Medium.**BART'ın uygulanması `text_infill`gürültü: rastgele süreleri tek birer ile değiştirin `<mask>`Bu, bir simgeyi gösterir ve dekodör doğru uzantı uzunluğu artı içeriği çıkarmalıdır.
3. **Hard.**- Güzel sesli .`flan-t5-small`Küçük bir İngilizce → Domuz-Latin corpus (200 çift) üzerinde.`Llama-3.2-1B`Aynı hesaplama ile aynı veriler üzerinde.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Encoder-decoder | "Seq2seq transformer" | Two stacks: bidirectional encoder for input, causal decoder with cross-attention for output. |
| Cross-attention | "Where source talks to target" | Decoder's Q × encoder's K/V. The only place encoder information enters the decoder. |
| Span corruption | "T5's pretraining trick" | Replace random spans with sentinel tokens; decoder outputs the spans. |
| Denoising objective | "BART's game" | Apply a noise function to the input, train the decoder to reconstruct the clean sequence. |
| Sentinel token | "The `<extra_id_N>` placeholder" | Special tokens that tag corrupted spans in the source and re-tag them in the target. |
| Flan | "Instruction-tuned T5" | T5 fine-tuned on >1,800 tasks; made encoder-decoder competitive at instruction-following. |
| Beam search | "Decoding strategy" | Keep top-k partial sequences at each step; standard for translation/summarization. |
| Teacher forcing | "Training-time input" | During training, feed the true previous output token to the decoder, not the sampled one. |

## Daha Fazla Okumak

- [Raffel et al. (2019). Exploring the Limits of Transfer Learning with a Unified Text-to-Text Transformer](https://arxiv.org/abs/1910.10683)T5.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training for Natural Language Generation, Translation, and Comprehension](https://arxiv.org/abs/1910.13461)- BART.
- [Chung et al. (2022). Scaling Instruction-Finetuned Language Models](https://arxiv.org/abs/2210.11416) Flan-T5.
- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Fısıltı, 2026'da kullanılan kodlayıcı-dekoder.
- [HuggingFace `modeling_t5.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/t5/modeling_t5.py) referans uygulanması.
