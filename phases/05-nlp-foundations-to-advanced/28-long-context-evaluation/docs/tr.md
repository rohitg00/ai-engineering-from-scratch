# Uzun Bağlamlı Değerlendirme — NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro, 10 milyon token bağlamın tanıtımını yapar. 1 milyon token'de 8 iğneli MRCR %26,3'e düşüyor. Reklamı yapıldı ≠ kullanılabilir. Uzun bağlam değerlendirmesi, gönderdiğiniz modelin gerçek kapasitesini size bildirir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 5 · 13 (Soru Yanıtlama), Aşama 5 · 23 (Parçalama Stratejileri)
**Süre:** ~60 dakika

## Sorun

200 sayfalık bir sözleşmeniz var. Model, 1M-token bağlamını iddia ediyor. Sözleşmeyi yapıştırıp şunu soruyorsunuz: "Fesih maddesi nedir?" Model yanıt veriyor - ancak kapak sayfasından yanıt veriyor çünkü sonlandırma maddesi, modelin gerçekte katıldığı yerin 120 bin token ötesinde yer alıyor.

Bu, 2026 bağlam-kapasite açığıdır. Teknik özellikler sayfalarında 1M veya 10M yazıyor. Gerçekte bunun %60-70'inin kullanılabilir olduğu ve "kullanılabilir"liğin göreve bağlı olduğu belirtiliyor.

- **Geri alma (samanlıkta tek iğne):** Sınır modellerinde reklamı yapılan maksimum değere kadar mükemmele yakın.
- **Çoklu atlama / toplama:** çoğu modelde keskin bir şekilde ~128k'yi geçer.
- **Dağınık gerçekler üzerinde akıl yürütmek:** başarısız olan ilk görev.

Uzun bağlam değerlendirmesi bu eksenleri ölçer. Bu derste benchmark'ler, her birinin gerçekte neyi ölçtüğü ve etki alanınız için özel bir iğne testinin nasıl oluşturulacağı anlatılmaktadır.

## Konsept

![NIAH temel çizgisi, RULER çoklu görevi, LongBench bütünsel](../assets/long-context-eval.svg)

**Samanlıkta İğne (NIAH, 2023).** Uzun bir bağlamda kontrollü bir derinliğe bir gerçeği ("sihirli kelime ananastır") yerleştirin. Modelden onu almasını isteyin. Tarama derinliği × uzunluk. Orijinal uzun bağlamlı benchmark. Sınır modelleri artık bunu doyuruyor; bu gerekli ancak yeterli olmayan bir temeldir.

**RULER (Nvidia, 2024).** 4 kategoride 13 görev türü: alma (tek / çoklu anahtar / çoklu değer), çok atlamalı izleme (değişken izleme), toplama (ortak kelime sıklığı), QA. Yapılandırılabilir bağlam uzunluğu (4k - 128k+). NIAH'ı doyuran ancak çoklu atlamada başarısız olan modelleri ortaya çıkarır. 2024 sürümünde, 32k+ bağlam iddiasında bulunan 17 modelin yalnızca yarısı kaliteyi 32k'de korudu.

**LongBench v2 (2024).** 503 çoktan seçmeli soru, 8k-2 milyon kelime bağlamı, altı görev kategorisi: tek belgeli KG, çoklu belgeli KG, bağlam içi uzun öğrenme, uzun diyalog, kod deposu, uzun yapılandırılmış veriler. Gerçek dünyadaki uzun bağlam davranışı için üretim benchmark.

**MRCR (Çok Yuvarlak Çekirdek Referans Çözünürlüğü).** Ölçekte çok turlu çekirdek referans. 8 iğneli, 24 iğneli, 100 iğneli çeşitleri. Dikkatin azalmasından önce bir modelin kaç olguyla hokkabazlık yapabileceğini ortaya koyuyor.

**NoLiMa.** "Sözcüksel olmayan iğne." İğne ve sorgu hiçbir gerçek örtüşmeyi paylaşmaz; Geri çağırma, bir adımlık anlamsal akıl yürütmeyi gerektirir. NIAH'tan daha zor.

**KASK.** Birçok belgeyi birleştirir, herhangi birinden soru sorar. Seçici dikkati test eder.

**BABILong.** BAbI muhakeme zincirlerini alakasız saman yığınlarının içine yerleştirir. Sadece bilgiyi geri getirmeyi değil, samanlıkta akıl yürütmeyi de test eder.

### Gerçekte ne rapor edilmeli

- **Reklam yapılan context window.** Teknik özellik sayfası numarası.
- **Etkili alma uzunluğu.** NIAH belirli bir eşikte geçer (e.g., %90).
- **Etkili akıl yürütme uzunluğu.** Bu eşikte çoklu atlama veya toplama geçişi.
- **Bozulma eğrisi.** Doğruluk ve bağlam uzunluğu, görev türüne göre çizilmiştir.

Teknik özellikler sayfanız için iki sayı: geri getirme açısından etkili ve akıl yürütme açısından etkili. Genellikle etkili muhakeme, reklamı yapılan pencerenin %25-50'sidir.

## İnşa Et

### 1. Adım: alanınız için özel bir NIAH

Bkz. `code/main.py`. İskelet:

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

Tarama `depth_ratio` ∈ {0, 0,25, 0,5, 0,75, 1,0} × `total_tokens` ∈ {1k, 4k, 16k, 64k}. Isı haritasını çizin. Bu, hedef modelinizin NIAH kartıdır.

### Adım 2: çok iğneli bir model

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

"Üç sihirli kelime nedir?" gibi sorular üçünün de alınmasını gerektirir. Tek iğneli başarı, çoklu iğneli başarıyı öngörmez.

### Adım 3: çok atlamalı değişken izleme (CETVEL stili)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

Cevap üç ödevin zincirlenmesini gerektirir. 128k'deki sınır modelleri burada genellikle %50-70 doğruluğa düşer.

### Adım 4: Yığınınızda LongBench v2

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

Kategori başına doğruluğu bildirin. Toplam puanlar görev düzeyindeki büyük farklılıkları gizler.

## Tuzaklar

- **Yalnızca NIAH değerlendirmesi.** NIAH'ı 1 milyon token'de geçmek, çoklu atlama hakkında hiçbir şey söylemez. Her zaman RULER'ı veya özel bir çok atlamalı testi çalıştırın.
- **Tekdüze derinlik örneklemesi.** Çoğu uygulamada yalnızca test derinliği=0,5. Test derinliği=0, 0,25, 0,5, 0,75, 1,0 — "ortada kaybolma" etkisi gerçektir.
- **Dolgu maddesiyle sözcüksel örtüşme.** İğne, dolgu maddesiyle anahtar kelimeleri paylaşıyorsa, geri çağırma önemsiz hale gelir. NoLiMa tarzı üst üste binmeyen iğneler kullanın.
- **Gecikme göz ardı ediliyor.** 1M-token prompt'lerin önceden doldurulması 30-120 saniye sürer. Doğrulukla birlikte token'ye kadar geçen süreyi ölçün.
- **Satıcının kendisi tarafından bildirilen sayılar.** OpenAI, Google, Anthropic'in tümü kendi puanlarını yayınlar. Kullanım durumunuzda her zaman bağımsız olarak yeniden çalıştırın.

## Kullan onu

2026 yığını:

| Durum | Benchmark |
|-----------|-----------|
| Hızlı akıl sağlığı kontrolü | 3 derinlik × 3 uzunlukta özel NIAH |
| Üretim için model seçimi | RULER (13 görev) hedef uzunlukta |
| Gerçek dünya QA kalitesi | LongBench v2 tek belgeli QA alt kümesi |
| Çok atlamalı akıl yürütme | BABILuzun veya özel değişken izleme |
| Konuşma / diyalog | Hedef uzunlukta MRCR 8 iğne |
| Model yükseltme regresyonu | Her yeni modelde çalışan sabit şirket içi NIAH + RULER koşum takımı |

Üretim için temel kural: İstediğiniz uzunlukta NIAH + 1 muhakeme görevine sahip olana kadar context window'ye asla güvenmeyin.

## Gönderin

`outputs/skill-long-context-eval.md` olarak kaydet:

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

1. **Kolay.** 3 derinliğe (0,25, 0,5, 0,75) × 3 uzunluğa (1k, 4k, 16k) sahip bir NIAH oluşturun. Herhangi bir modelde çalıştırın. Geçiş hızını 3×3 ısı haritası olarak çizin.
2. **Orta.** 3 iğneli bir model ekleyin. Her uzunlukta 3'ünün de alınmasını ölçün. Aynı uzunluktaki tek iğne geçiş hızıyla karşılaştırın.
3. **Zor.** 64k dolguya gömülü değişken izleme görevi (X1 → X2 → X3, 3 atlamalı) oluşturun. 3 sınır modelinde doğruluğu ölçün. Model başına etkili muhakeme uzunluğunu bildirin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| NIAH | Samanlıkta iğne | Dolguya bir olgu yerleştirin ve modelden onu geri almasını isteyin. |
| CETVEL | Steroidler üzerinde NIAH | Alma / çoklu atlama / toplama / QA genelinde 13 görev türü. |
| Etkili bağlam | Gerçek kapasite | Doğruluğun hala eşiğin üzerinde olduğu uzunluk. |
| Ortada kayboldum | Derinlik sapması | Modeller, uzun girdilerin ortasında içeriğe yeterince ilgi göstermiyor. |
| Çok iğneli | Aynı anda birçok gerçek | Çoklu bitkiler; tek başına geri getirmeyi değil, dikkat hokkabazlığını test eder. |
| MRCR | Çok yönlü çekirdek | 8, 24 veya 100 iğneli referans; dikkat doygunluğunu ortaya çıkarır. |
| NoLiMa | Sözcüksel olmayan iğne | İğne ve sorgu hiçbir gerçek token'yi paylaşmaz; muhakeme gerektirir. |

## Daha Fazla Okuma

- [Kamradt (2023). Haystack analizinde iğne](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) — orijinal NIAH deposu.
- [Hsieh ve ark. (2024). RULER: Uzun Bağlamlı LM'lerinizin Gerçek Bağlam Boyutu Nedir?](https://arxiv.org/abs/2404.06654) — çoklu görev benchmark.
- [Bai ve ark. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) — gerçek dünyadaki uzun bağlam değerlendirmesi.
- [Modarressi ve ark. (2024). NoLiMa: Sözcüksel olmayan iğneler](https://arxiv.org/abs/2404.06666) — daha sert iğneler.
- [Kuratov ve ark. (2024). BABILong](https://arxiv.org/abs/2406.10149) — samanlıkta akıl yürütme.
- [Liu ve ark. (2024). Ortada Kaybolmak: Dil Modelleri Uzun Bağlamları Nasıl Kullanır](https://arxiv.org/abs/2307.03172) — derinlik yanlılığı makalesi.
