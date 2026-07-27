# Alt Kelime Tokenization — BPE, WordPiece, Unigram, SentencePiece

> Kelime tokenizer'ler görünmeyen kelimeler yüzünden boğuluyor. tokenizer karakteri dizi uzunluğunu artırır. Alt kelime tokenizer'ler farkı bölüyor. Her modern LLM bir tane ile gönderilir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 5 · 01 (Metin İşleme), Aşama 5 · 04 (GloVe / FastText / Alt Kelime)
**Süre:** ~60 dakika

## Sorun

Kelime dağarcığınızda 50.000 kelime var. Bir kullanıcı "untokenizable" yazar. tokenizer'niz `[UNK]`'yi döndürür. Modelin artık kelimeyle ilgili bir sinyali yok. Daha da kötüsü: Derleminizdeki yüzde 90'lık dilimdeki belgede 40 nadir kelime bulunur, bu da belge başına 40 bitlik bilginin atlandığı anlamına gelir.

Alt kelime tokenization bunu çözer. Ortak kelimeler tek token olarak kalır. Nadir kelimeler anlamlı parçalara ayrılıyor: `untokenizable` → `un`, `token`, `izable`. Eğitim verileri her şeyi kapsar çünkü herhangi bir dize sonuçta bir bayt dizisidir.

2026'daki her sınır LLM, üç kütüphaneden (tiktoken, SentencePiece, HF Tokenizers) birine sarılmış üç algoritmadan (BPE, Unigram, WordPiece) birinde gönderilir. Bir dil modelini seçmeden gönderemezsiniz.

## Konsept

![BPE vs Unigram vs WordPiece, karakter karakter](../assets/subword-tokenization.svg)

**BPE (Bayt Çifti Kodlama).** Karakter düzeyinde bir kelime dağarcığıyla başlayın. Her bitişik çifti sayın. En sık görülen çifti yeni bir token ile birleştirin. Hedef sözcük boyutuna ulaşana kadar tekrarlayın. Baskın algoritma: GPT-2/3/4, Llama, Gemma, Qwen2, Mistral.

**Bayt düzeyinde BPE.** Aynı algoritma ancak Unicode karakterler yerine ham baytlar (256 temel token) üzerinden. Sıfır `[UNK]` token'yi garanti eder — herhangi bir bayt dizisi kodlaması. GPT-2, 50.257 token (256 bayt + 50.000 birleştirme + 1 özel) kullanır.

**Unigram.** Geniş bir kelime dağarcığıyla başlayın. Her token'ye bir unigram olasılık atayın. Kaldırılması derlem günlüğü olasılığını en az artıran token'leri yinelemeli olarak budayın. inference'de olasılıksal: tokenizasyonları örnekleyebilir (alt kelime düzenleme yoluyla veri artırma için kullanışlıdır). T5, mBART, ALBERT, XLNet, Gemma tarafından kullanılır.

**WordPiece.** Ham sıklıktan ziyade eğitim derleminin olasılığını en üst düzeye çıkaran çiftleri birleştirin. BERT, DistilBERT, ELECTRA tarafından kullanılır.

**SentencePiece ve tiktoken.** SentencePiece, boşlukları `▁` olarak kodlayarak doğrudan ham Unicode metin üzerinde sözcük dağarcığını (BPE veya Unigram) *eğiten* bir kitaplıktır. tiktoken, önceden oluşturulmuş sözcüklere karşı OpenAI'nin hızlı *kodlayıcısıdır*; antrenman yapmıyor.

Temel kural:

- **Yeni bir kelime dağarcığı eğitimi:** Cümle Parçası (çok dilli, token öncesi yok) veya HF Tokenizer'ler.
- **GPT kelime hazinesine karşı hızlı inference:** tiktoken (cl100k_base, o200k_base).
- **Her ikisi de:** HF Tokenizer'ler — bir kitaplık, eğitim + hizmet.

```figure
bpe-merge
```

## İnşa Et

### Adım 1: Sıfırdan BPE

Bkz. `code/main.py`. Döngü:

```python
def train_bpe(corpus, num_merges):
    vocab = {tuple(word) + ("</w>",): count for word, count in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = apply_merge(vocab, best)
    return merges
```

Algoritmanın kodladığı üç gerçek. `</w>` sözcük sonunu işaretler, böylece "düşük" (sonek) ve "alt" (önek) ayrı kalır. Frekans ağırlıklandırma, yüksek frekanslı çiftlerin erken kazanmasını sağlar. Birleştirme listesi sıralıdır — inference, birleştirmeleri eğitim sırasına göre uygular.

### Adım 2: öğrenilen birleştirmelerle kodlayın

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

Naif O(n·|birleşme|). Üretim uygulamaları (tiktoken, HF Tokenizer'ler) öncelik kuyruklarıyla birleştirme sıralaması aramasını kullanır ve neredeyse doğrusal zamanda çalışır.

### Adım 3: Cümle Parçası pratikte

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # or "unigram"
    character_coverage=0.9995, # lower for CJK (e.g. 0.9995 for English, 0.995 for Japanese)
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

Uyarı: önceden tokenleştirme gerekmez, `▁`, `character_coverage` olarak kodlanan alan, `<unk>` ile eşlenene karşı agresif derecede nadir karakterlerin nasıl korunduğunu kontrol eder.

### Adım 4: OpenAI uyumlu sözcükler için tiktoken

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

Yalnızca kodlama. Hızlı (Rust arka ucu). Bayt sayma, maliyet tahmini, bağlam penceresi bütçeleme için GPT-4/5 tokenization ile tam eşleşme.

## 2026'da hâlâ gönderilecek tuzaklar

- **Tokenizer drift.** Kelime A üzerinde eğitim, B kelimesine karşı uygulama. Token kimlikleri farklıdır; model çöp çıktısı veriyor. CI'daki `tokenizer.json` karma değerini kontrol edin.
- **Boşluk belirsizliği.** BPE "merhaba" ve "merhaba" farklı token'ler üretir. Her zaman `add_special_tokens` ve `add_prefix_space`'yi açıkça belirtin.
- **Çok dilli yetersiz eğitim.** İngilizce ağırlıklı derlem, Latince olmayan alfabeleri 5-10 kat daha fazla token'ye bölen kelime dağarcığı üretir. Aynı prompt, GPT-3.5'te Japonca/Arapça olarak 5-10 kat daha pahalıdır. o200k_base bunu kısmen düzeltti.
- **Emoji bölünür.** Tek bir emoji 5 token alabilir. Bütçeleme bağlamı sırasında kontrol noktası emojisinin kullanımı.

## Kullan onu

2026 yığını:

| Durum | Seç |
|-----------|------|
| Tek dilli bir modeli sıfırdan eğitmek | HF Tokenizer'ler (BPE) |
| Çok dilli bir modeli eğitmek | Cümle Parçası (Unigram, `character_coverage=0.9995`) |
| OpenAI uyumlu bir API sunma | tiktoken (GPT-4+ için `o200k_base`) |
| Alana özgü kelime bilgisi (kod, matematik, protein) | Alan adı külliyatında özel BPE'yi eğitin, temel kelime dağarcığıyla birleştirin |
| Edge inference, küçük model | Unigram (daha küçük kelimeler daha iyi çalışır) |

Kelime dağarcığı büyüklüğü bir ölçeklendirme kararıdır, sabit değil. Kaba buluşsal yöntem: <1B parametreleri için 32k, 1-10B için 50-100k, çok dilli/sınır için 200k+.

## Gönderin

`outputs/skill-bpe-vs-wordpiece.md` olarak kaydet:

```markdown
---
name: tokenizer-picker
description: Pick tokenizer algorithm, vocab size, library for a given corpus and deployment target.
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

Given a corpus (size, languages, domain) and deployment target (training from scratch / fine-tuning / API-compatible inference), output:

1. Algorithm. BPE, Unigram, or WordPiece. One-sentence reason.
2. Library. SentencePiece, HF Tokenizers, or tiktoken. Reason.
3. Vocab size. Rounded to nearest 1k. Reason tied to model size and language coverage.
4. Coverage settings. `character_coverage`, `byte_fallback`, special-token list.
5. Validation plan. Average tokens-per-word on held-out set, OOV rate, compression ratio, round-trip decode equality.

Refuse to train a character-coverage <0.995 tokenizer on corpora with rare-script content. Refuse to ship a vocab without a frozen `tokenizer.json` hash check in CI. Flag any monolingual tokenizer under 16k vocab as likely under-spec.
```

## Egzersizler

1. **Kolay.** `code/main.py`'nin küçük külliyatı üzerinde 500 birleştirmeli bir BPE eğitin. Uzatılan üç kelimeyi kodlayın. Kaç tanesi tam olarak 1 token ve >1 token üretti?
2. **Orta.** token sayılarını `cl100k_base`, `o200k_base` ve vocab=32k ile eğittiğiniz bir SentencePiece BPE arasındaki 100 İngilizce Wikipedia cümlesini karşılaştırın. Her birinin sıkıştırma oranını bildirin.
3. **Zor.** Aynı korpusu BPE, Unigram ve WordPiece ile eğitin. Her birini küçük bir duyarlılık sınıflandırıcısında kullanırken aşağı akış doğruluğunu ölçün. Seçim ibreyi 1 puan F1'den fazla hareket ettiriyor mu?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| BPE | Bayt Çifti Kodlama | Hedef kelime büyüklüğüne ulaşana kadar en sık kullanılan karakter çiftlerinin açgözlü bir şekilde birleştirilmesi. |
| Bayt düzeyinde BPE | Hiç bilinmeyen token yok | Ham 256 baytın üzerinde BPE; GPT-2 / Lama bunu kullanıyor. |
| Ünigram | Olasılıksal tokenizer | Log-olabilirlik kullanılarak büyük bir aday kümesinden elde edilen kuru erikler; T5, Gemma tarafından kullanılıyor. |
| Cümle Parçası | Boşluk olan | BPE/Unigram'ı ham metin konusunda eğiten kütüphane; `▁` olarak kodlanmış alan. |
| tiktoken | Hızlı olan | Önceden oluşturulmuş sözcükler için OpenAI'nin Rust destekli BPE kodlayıcısı. Eğitim yok. |
| Listeyi birleştir | Sihirli sayılar | `(a, b) → ab` birleştirmelerinin sıralı listesi; inference sırayla uygulanır. |
| Karakter kapsamı | Ne kadar nadir çok nadir? | tokenizer'nin eğitim külliyatındaki karakterlerin kapsaması gereken kısmı; ~0,9995 tipik. |

## Daha Fazla Okuma

- [Sennrich, Haddow, Birch (2015). Alt Kelime Birimleriyle Nadir Kelimelerin Nöral Makine Çevirisi](https://arxiv.org/abs/1508.07909) — BPE makalesi.
-[Kudo (2018). Unigram Dil Modeli ile Alt Kelime Düzenlemesi](https://arxiv.org/abs/1804.10959) — Unigram makalesi.
- [Kudo, Richardson (2018). SentencePiece: Basit ve dilden bağımsız bir alt kelime tokenizer](https://arxiv.org/abs/1808.06226) — kitaplık.
- [Sarılma Yüzü — tokenizer'lerin Özeti](https://huggingface.co/docs/transformers/tokenizer_summary) — kısa referans.
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) — yemek kitabı + kodlama listesi.
