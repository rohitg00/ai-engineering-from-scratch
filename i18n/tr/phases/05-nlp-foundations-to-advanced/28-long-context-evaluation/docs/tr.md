# Uzun bağlamlı değerlendirme  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro 10M bağlamlı token reklam eder. 1M tokenlerde, 8 iğne MRCR 26,3%'e düşer. Reklamlanmış ≠ kullanılabilir. Uzun bağlam değerlendirmesi gönderdiğiniz modelin gerçek kapasitesini söyler.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## Sorun

200 sayfalık bir sözleşme var. Model 1M jeton bağlamını iddia ediyor. Sözleşmeyi yapıştırıp "Küntüleme hükümleri nedir?" diye sorarsınız. Model 'ye cevap verir, ancak kapak sayfasından cevap verir çünkü sona erme hükümleri modelin gerçekte katıldığı yerin arkasında 120k jeton derinliklerinde yer alır.

Bu 2026'da bağlam-ücretlilik boşluğu. Spec sayfalarında 1M veya 10M diyor. Gerçekte bunun %60-70'i kullanılabilir ve "kullanılabilir" göreve bağlı.

- **Retrieval (single needle in haystack):**Sınır modellerinde reklam edilen maksimum seviyeye kadar mükemmel.
- **Multi-hop / aggregation:**Çoğu modelde keskin bir şekilde ~ 128k'den fazla derecede azalır.
- **Reasoning over dispersed facts:**Başarısız olan ilk görev.

Uzun bağlam değerlendirme bu ekseleri ölçer. Bu ders referans değerlerini, her birinin aslında ölçtüğünü ve alanınız için özel bir iğne testi nasıl oluşturulacağını belirler.

## Anlaşım

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**Bir gerçeği ("magi kelime ananasdır") uzun bir bağlamda kontrol altına alınmış bir derinlikte yerleştirin. Modelin onu geri almasını isteyin.

**RULER (Nvidia, 2024).**13 görev türü 4 kategoride: geri alım (tek / çok anahtar / çok değer), çok atış izleme (değişkin izleme), birleştirme (orta kelime frekansı), QA. Yapılandırılabilir bağlam uzunluğu (4k ila 128k +). NIAH'yi doymayan ancak çok atışta başarısız olan modeller ortaya çıkar. 2024 sürümünde, 32k + bağlamını iddia eden 17 modelin sadece yarısı 32k+ kalitesini korudu.

**LongBench v2 (2024).**503 çoklu seçim sorusu, 8k-2M kelime bağlamları, altı görev kategorisi: tek belgeli QA, çoklu belgeli QA, uzun bağlamlı öğrenme, uzun diyalog, kod repo, uzun yapılandırılmış veriler.

**MRCR (Multi-Round Coreference Resolution).**Çok yönlü bir ölçekle, 8 iğne, 24 iğne, 100 iğne çeşitleri.

**NoLiMa.**İğne ve sorgu kelimenin birbiriyle örtüşmemektedir.

**HELMET.**Birçok belgeyi bir araya getirir, herkese bir soru sorar, seçici bir dikkatini test eder.

**BABILong.**İşe yaramaz saman kütleleri içinde ABI mantık zincirlerini yerleştirir.

### Neyi rapor edelim

- **Advertised context window.**- Özellik sayfa numarası.
- **Effective retrieval length.**NIAH, belirli bir eşiğinde geçiyor (örneğin, %90).
- **Effective reasoning length.**Bu eşiğinde çoklu atlama veya toplama geçişi.
- **Degradation curve.**Dürüstlük vs. bağlam uzunluğu, görev türüne göre çizilmiştir.

İki sayı, bir hesaplama ve bir hesaplama. Genellikle açıklanan pencereye göre yüzde 25-50'lik hesaplama.

```figure
gx-niah-decay
```

## Yapın

### Adım 1: Alanınız için özel bir NIAH

Bakın .`code/main.py`- Skelet:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

Tarama`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`∈ {1k, 4k, 16k, 64k}. ısı haritasını çiz. Bu hedef modeliniz için NIAH kartı.

### Adım 2: Çoklu iğneli bir variant

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

"Üç sihirli kelime nedir?" gibi sorular için üç kelimeyi de öğrenmek gerekir.

### Adım 3: Çoklu hop değişken izleme (RULER tarzı)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

Cevap üç görev zincirlenmesi gerektirir. 128k'da sınır modelleri genellikle burada %50-70% doğruluğa düşer.

### Adım 4: LongBench v2'i yığın üzerinde

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

Toplam puanlar büyük görev düzeyinde farkları gizler.

## Tuzaklar

- **NIAH-only evaluation.**1M tokenle NIAH'yi geçmek, multi-hop hakkında hiçbir şey söylemez.
- **Uniform depth sampling.**Birçok uygulamada sadece test derinliği = 0.5. Test derinliği = 0, 0.25, 0.5, 0.75, 1.0  "ortalarda kaybolan" etki gerçek.
- **Lexical overlap with filler.**İğne, dolgu ile anahtar kelimeleri paylaşırsa, geri almak önemsiz hale gelir.
- **Ignoring latency.**1M-token istekleri 30-120 saniye sürer.
- **Vendor-self-reported numbers.**OpenAI, Google, Anthropic hepsi kendi puanlarını yayınlar. Her zaman kullanım durumunuzda bağımsız olarak tekrar çalıştırın.

## Kullan

2026'da:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

Üretim için basamak kural: NIAH + 1 akıl yürütme görevini istediğiniz uzunlukta yapana kadar bağlam penceresine asla güvenmeyin.

## Gönder

- Kaydet .`outputs/skill-long-context-eval.md`- ...

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## Egzersizler

1. **Easy.**NIAH'yi 3 derinlik (0.25, 0.5, 0.75) × 3 uzunluk (1k, 4k, 16k) ile inşa edin.
2. **Medium.**3 iğne varyasyonunu ekleyin. Her uzunlukta 3'ün hepsini ölçün. Aynı uzunlukta tek iğne geçiş oranına karşılaştırın.
3. **Hard.**64k dolguya gömülü değişken izleme görevini (X1 → X2 → X3, 3 hop ile) oluşturun. 3 sınır modeli boyunca doğruluğu ölçün. Model başına etkili bir mantık uzunluğu rapor edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## Daha Fazla Okumak

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack)- Asıl NIAH repo.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) çok görevli referans değerini.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) gerçek dünya uzun bağlam değerlendirme.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) daha sert iğneler.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) Haystack'ta akıl yürütme.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) derinlik ayrımcılığı kağıdı.
