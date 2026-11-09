# Makine çevirisi

> Tercüme otuz yıldır NLP araştırmasına ödeyen ve şimdi de ödeyen bir görevdir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 10 (Attention Mechanism), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Sorun

Bir model bir dilde bir cümle okuyor ve bir cümleyi bir başka dilde üretir. Uzunluk değişir. Kelimeler sırası değişir. Bazı kaynak kelimeleri birden fazla hedef kelimeyi haritası yapar ve tersine. İdiomlar birbir haritasını reddeder. Fransızca'da "Seni özlüyorum" kelimesi "tu me manques"  kelimenin anlamı "benim için eksiksin".

Makine çevirisi, NLP'yi kodlayıcı-dekodörler, dikkat, dönüştürücüler ve sonunda tüm LLM paradigmasını icat etmeye zorlayan görevdir.

Bu ders tarih dersini atlıyor ve 2026'ın çalışma hattını öğretir: önceden eğitilmiş çok dilli kodlayıcı-dekoder (NLLB-200 veya mBART), alt sözcük işaretleme, ışın araması, BLEU ve chrF değerlendirme ve hala üretime ulaşmamış olan bir avuç başarısızlık modunu.

## Anlaşım

![MT pipeline: tokenize → encode → decode with attention → detokenize](../assets/mt-pipeline.svg)

Modern MT, paralel metinde eğitimli bir transformer kodlayıcı-dekodördür. Kodlayıcı kaynağı dilinin işaretlemesinde okuyor. Dekoder, hedefi, bir kez bir alt kelimeyi, çapraz dikkat yoluyla kodlayıcıın çıkışını kullanarak üretir (dersi 10). Dekodlama açgözlülükle dekodlama tuzağını önlemek için ışın araması kullanır. Çıkış detokenize edilir, yok edilir ve bir referans karşı puanlanır.

Üç operasyonel seçenek gerçek dünya MT kalitesini güçlendirir.

- **Tokenizer.**SentencePiece BPE, karışık diller kurpusunda eğitim almıştır.
- **Model size.**NLLB-200 destilli 600M bir dizüstü bilgisayarına uygundur. NLLB-200 3.3B yayınlanan üretim standartıdır. 54.5B araştırma tavanıdır.
- **Decoding.**Genel içerik için ışın genişliği 4-5 uzunluk cezası çok kısa çıkış önlemek için. Terminoloji tutarlılığına ihtiyaç duyduğunuzda kısıtlı kodlama.

```figure
seq2seq-alignment
```

## Yapın

### Adım 1: önceden eğitilmiş MT çağrısı

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

model_id = "facebook/nllb-200-distilled-600M"
tok = AutoTokenizer.from_pretrained(model_id, src_lang="eng_Latn")
model = AutoModelForSeq2SeqLM.from_pretrained(model_id)

src = "The cats are running."
inputs = tok(src, return_tensors="pt")

out = model.generate(
    **inputs,
    forced_bos_token_id=tok.convert_tokens_to_ids("fra_Latn"),
    num_beams=5,
    length_penalty=1.0,
    max_new_tokens=64,
)
print(tok.batch_decode(out, skip_special_tokens=True)[0])
```

```text
Les chats courent.
```

Burada önemli olan üç şey var.`src_lang`Tokenizer'e hangi senaryo ve bölümlemeyi uygulayacağını söyler. `forced_bos_token_id`Bu iki yöntem de NLLB özel numaralardır; mBART ve M2M-100 kendi geleneklerini kullanır ve birbirlerini değiştiremezler.

### Adım 2: BLEU ve chrF

BLEU, çıkış ve referans arasında n-gram örtüşmeyi ölçer. Dört referans n-gram boyutu (1-4), hassaslıkların geometrik ortalaması, çok kısa çıkış için kısalık cezası. Not [0, 100]'de bulunur. Genel olarak kullanılır. Tercüme için sinir bozucu: 30 BLEU "kullanılabilir"; 40 "iyi"; 50 "istifadedir"; 1 BLEU'dan aşağıdaki farklılıklar gürültüdür.

chrF karakter seviyesindeki F puanını ölçer. BLEU'nun az sayısının eşleşmesi olan morfolojik olarak zengin dillere daha duyarlı.

```python
import sacrebleu

hypotheses = ["Les chats courent."]
references = [["Les chats courent."]]

bleu = sacrebleu.corpus_bleu(hypotheses, references)
chrf = sacrebleu.corpus_chrf(hypotheses, references)
print(f"BLEU: {bleu.score:.1f}  chrF: {chrf.score:.1f}")
```

Her zaman kullan `sacrebleu`Bu, işaretlenmeyi normalleştirir, böylece puanlar makaleler arasında karşılaştırılabilir.

### Üç katlı değerlendirme hiyerarşisi (2026)

Modern MT değerlendirmesi, üç tamamlayıcı metrik ailesi kullanıyor.

- **Heuristic**Hızlı, referans tabanlı, yorumlanabilir, parafraseye duyarsız.
- **Learned**(COMET, BLEURT, BERTScore). İnsan yargılarına dayanan sinirsel modeller; kaynak ve referans ile çeviri semantik benzerliğini karşılaştırın. COMET 2023'ten beri MT araştırmalarıyla en yüksek ilişkiye sahiptir ve kalite konularında 2026 üretim standartıdır.
- **LLM-as-judge**(referanssız) Büyük bir model oluşturarak tercümanların akıcılık, yeterlilik, ton, kültürel uygunluk konusunda puanlarını alıntılayın.

Pratik 2026 yığın: `sacrebleu`BLEU ve chrF için, `unbabel-comet`COMET için, ve son insan yüzlü sinyal için uyarılmış bir LLM.

Referanssız ölçümler (COMET-QE, BLEURT-QE, LLM-as-judge) referanssız tercümeyi değerlendirmenize olanak sağlar. Referans tercüme bulunmayan uzun kuyruğu dil çiftleri için bu önemlidir.

### Adım 3: Üretimdeki bozukluklar

Yukarıdaki çalışma boru hattı zamanın %80'ini akıcı olarak tercüme eder ve kalan %20'i sessizce başarısız eder.

- **Hallucination.**Model, kaynağa ait olmayan içeriği icat eder. Tanınmayan alan sözlüklerinde yaygın. Simptom: çıkış akıcıdır ancak kaynak belirlemediği gerçekleri iddia eder. Yumuşak başlılık: domen terimlerinde kısıtlı dekode, düzenlenmiş içeriğe insan gözden geçirme, çıkış için girişten çok daha uzun bir izleme.
- **Off-target generation.**Model yanlış dile tercüme eder. NLLB nadir dil çiftlerinde şaşırtıcı derecede bu eğilimindedir.`forced_bos_token_id`ve her zaman çıkış kontrolü için dil-ID model ile çözülür.
- **Terminology drift.**"Aygın" dok 1'de "s'inscribe" ve dok 2'de "creer un compte" haline gelir. UI metni ve kullanıcıya yönelik dizileri için, tutarlılık ham kaliteden daha önemlidir.
- **Formality mismatch.**Fransızca "tu" vs. "vous", Japon kibarlık seviyeleri. Model eğitimde daha yaygın olan formları seçer. Müşteriye yönelik içerik için bu genellikle yanlışdır. Yumuşaklık: model desteklerse resmilik belirti ile bir önbellek ile hemen uyarın veya sadece resmi korporlarda küçük bir modelyi ince ayarlayın.
- **Length explosion on short input.**Çok kısa giriş cümleleri genellikle uzunluk cezası ~ 5 kaynak jetonunun altında bir uçurumdan düştüğü için uzunluktan fazla çeviriler üretir.

### Adım 4: Bir alan için ince ayarlama

Önceden eğitilmiş modeller genelistlerdir. Hukuki, tıbbi veya oyun diyalog çevirisi, alan paralel veriler üzerinde ince ayarlamalardan ölçülebilir şekilde yararlanır.

```python
from transformers import Trainer, TrainingArguments
from datasets import Dataset

pairs = [
    {"src": "The defendant pleaded guilty.", "tgt": "L'accusé a plaidé coupable."},
]

ds = Dataset.from_list(pairs)


def preprocess(ex):
    return tok(
        ex["src"],
        text_target=ex["tgt"],
        truncation=True,
        max_length=128,
        padding="max_length",
    )


ds = ds.map(preprocess, remove_columns=["src", "tgt"])

args = TrainingArguments(output_dir="out", per_device_train_batch_size=4, num_train_epochs=3, learning_rate=3e-5)
Trainer(model=model, args=args, train_dataset=ds).train()
```

Birkaç bin yüksek kaliteli paralel örnek birkaç yüz bin gürültülü web kazı örneğini yener.

## Kullan

MT için 2026 üretim aşaması:

| Use case | Recommended starting point |
|---------|---------------------------|
| Any-to-any, 200 languages | `facebook/nllb-200-distilled-600M` (laptop) or `nllb-200-3.3B` (production) |
| English-centric, high quality, 50 languages | `facebook/mbart-large-50-many-to-many-mmt` |
| Short runs, cheap inference, English-French/German/Spanish | Helsinki-NLP / Marian models |
| Latency-critical browser-side | ONNX-quantized Marian (~50 MB) |
| Maximum quality, willing to pay | GPT-4 / Claude / Gemini with translation prompts |

LLM'ler artık 2026'dan itibaren, özellikle dil içerikleri ve uzun bağlamlarda uzman MT modellerini üstlenmektedir.

## Gönder

- Kaydet .`outputs/skill-mt-evaluator.md`- ...

```markdown
---
name: mt-evaluator
description: Evaluate a machine translation output for shipping.
version: 1.0.0
phase: 5
lesson: 11
tags: [nlp, translation, evaluation]
---

Given a source text and a candidate translation, output:

1. Automatic score estimate. BLEU and chrF ranges you would expect. State whether a reference is available.
2. Five-point human-verifiable check list: (a) content preservation (no hallucinations), (b) correct language, (c) register / formality match, (d) terminology consistency with glossary if provided, (e) no truncation or length explosion.
3. One domain-specific issue to probe. E.g., for legal: named entities and statute citations. For medical: drug names and dosages. For UI: placeholder variables `{name}`.
4. Confidence flag. "Ship" / "Ship with review" / "Do not ship". Tie to the severity of issues found in step 2.

Refuse to ship a translation without a language-ID check on output. Refuse to evaluate without a reference unless the user explicitly opts in to reference-free scoring (COMET-QE, BLEURT-QE). Flag any content over 1000 tokens as likely needing chunked translation.
```

## Egzersizler

1. **Easy.**5 cümle İngilizce paragrafını Fransızcaya çevirin ve İngilizceye geri dönün `nllb-200-distilled-600M`Geri dönüş yolculuğunun orijinaline ne kadar yakın olduğunu ölçün.
2. **Medium.** kullanarak çeviri çıkışlarında dil kimliği kontrolü gerçekleştirmek`fasttext lid.176`veya `langdetect`. MT çağrısına entegre olun, böylece hedef dışı nesiller geri dönmeden yakalanır.
3. **Hard.**- Güzel sesli .`nllb-200-distilled-600M`5.500 çiftlik bir alan korpusunda, seçtiğinizde. BLEU'yu ince ayarlama yapmadan önce ve sonrasında uzun süren bir set üzerinde ölçün. Hangi cümle türlerinin daha iyi olup, hangileri geriye döndüğünü bildirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BLEU | Translation score | N-gram precision with brevity penalty. [0, 100]. |
| chrF | Character F-score | Character-level F-score. More sensitive for morphologically rich languages. |
| NMT | Neural MT | Transformer encoder-decoder trained on parallel text. The 2017+ default. |
| NLLB | No Language Left Behind | Meta's 200-language MT model family. |
| Constrained decoding | Controlled output | Force specific tokens or n-grams to appear / not appear in the output. |
| Hallucination | Invented content | Model output that is not supported by the source. |

## Daha Fazla Okumak

- [Costa-jussà et al. (2022). No Language Left Behind: Scaling Human-Centered Machine Translation](https://arxiv.org/abs/2207.04672)NLLB makalesini.
- [Post (2018). A Call for Clarity in Reporting BLEU Scores](https://aclanthology.org/W18-6319/)Neden ?`sacrebleu`BLEU'yu bildirmenin tek doğru yolu.
- [Popović (2015). chrF: character n-gram F-score for automatic MT evaluation](https://aclanthology.org/W15-3049/) chrF kağıdı.
- [Hugging Face MT guide](https://huggingface.co/docs/transformers/tasks/translation) pratik ince ayarlama yürüyüşü.
