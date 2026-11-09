# İlişki Çekimi ve Bilgi Grafi Yapı

> NER varlıkları buldu. varlık bağlantısı onları demirledi. ilişki çıkarımı aralarındaki kenarları bulur. Bilgi grafi düğümlerin, kenarların ve kökenlerinin toplamıdır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## Sorun

Bir analist şöyle okuyor: "Tim Cook 2011'de Apple'ın CEO'su oldu".

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

İlişki Çekimi (RE) serbest metni yapılandırılmış üçlüler haline getirir `(subject, relation, object)`Bir diziyi toplayıp bir bilgi grafikine sahip olursunuz. Toplayıp sorguya sahip olursunuz ve RAG, analitik veya uyumluluk denetimi için bir mantık altyapınız vardır.

2026 sorunu: LLM'ler ilişkileri coşkuyla çıkarır. Çok coşkuyla. Kaynak metnin desteklemediği üçlü halüsinasyonlar yaparlar. Kaynak olmadan gerçek üçlüleri makul kurgudan ayırt edemezsiniz. 2026 cevabı AEVS tarzı demirleyici ve doğrulama boru hattıdır.

## Anlaşım

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`. İlişkiler kapalı bir ontolojiden (Wikidata özellikleri, FIBO, UMLS) veya açık bir setten (OpenIE tarzı, her şey geçerlidir) gelir.

**Three extraction approaches.**

1. **Rule / pattern-based.**Hearst modelleri: "X gibi Y" → `(Y, isA, X)`Ayrıca el yapımı regex, kırılgan, kesin, açıklanabilir.
2. **Supervised classifier.**Bir cümlede iki varlıktan bahsedilirse, ilişkiyi sabit bir setten tahmin edin. TACRED, ACE, KBP üzerinde eğitilmiş. Standart 20152022.
3. **Generative LLM.**Modelle üçlü yayımlamaları için uyarın.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**Mevcut halüsinasyon-düşünme çerçevesinde:

- **Anchor.**Her bir varlık aralığını ve ilişki-söz aralığını tam pozisyonlarla tanımlayın.
- **Extract.**Anchor spans ile bağlantılı üçlü oluşturun.
- **Verify.**Her üçlü öğeyi kaynak metine eşleştirin; desteklenmeyen herhangi bir şeyi reddedin.
- **Supplement.**Bir kaplama geçitinin, demirlenmiş bir uzanın düşmemesini sağlar.

Halüsinasyonlar keskin düşüyor.

**The open-vs-closed tradeoff.**

- **Closed ontology.**Düzgün özellikler listesi (örneğin, Wikidata'nın 11.000+ özellikleri). Önceden tahmin edilebilir. Arayan. Yaratmak zor.
- **Open IE.**Her sözlü cümle bir ilişki haline gelir. Yüksek hatırlama, düşük hassaslık. Sorgulamak çirkin.

Üretim KG'leri genellikle karıştırılır: keşif için IE açın, sonra ana grafikte birleşmeden önce ilişkileri kapalı bir ontolojiye kanonize edin.

```figure
relation-triples
```

## Yapın

### Adım 1: Şablon tabanlı çıkarma

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

Bakın .`code/main.py`Hearst modelleri hala alan özel boru hattlarında gönderiliyor çünkü hataları çözülebilir.

### Adım 2: denetim altında olan sek2 sek ilişki çıkarımı

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL, BART tabanlı bir seq2seq ilişki çıkarıcısıdır: birim çiftlerini sınıflandırmak yerine üçlüler oluşturur.`<triplet>`- Evet .`<subj>`ve `<obj>`işaretçiler, böylece onları bölün (model kartın analizcisi gibi) elde etmek için `(subject, relation, object)`Uzaktan denetim verilerine göre ayarlanmış standart açık ağırlıklı temel.

### Adım 3: Ankerleme ile LLM ile yapılan çıkarma

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

Geri dönüşe gelen her uzayı kaynağa karşı doğrulayın.`text[start:end] != triple_entity`Bu AEVS'in "tutar" adımıdır.

### Adım 4: Kapalı ontolojiye kanonikleştir

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

Kanonikleştirme genellikle mühendislik işinin %60-80'ini alır.

### Adım 5: Küçük bir grafik oluşturun ve sorgu

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Bu, her RAG-over-KG sisteminin atomudur. RDF üçlü depoları (Blazegraph, Virtuoso), özellik grafikleri (Neo4j) veya vektörlü artıran grafik depoları ile ölçebilirsiniz.

## Tuzaklar

- **Coreference before RE.**"Apple'ı kurdu"  RE'nin "o" kim olduğunu bilmesi gerekiyor.
- **Entity canonicalization.**"Apple Inc" ve "Apple" aynı düğmeye bağlanmalıdır.
- **Hallucinated triples.**LLM'ler, metnin desteklemediği üçlü yayınlar.
- **Relation canonicalization drift.**Açık IE ilişkileri tutarlı değildir ("doğuştu," "gelendi," "doğuştu"). Kanonik kimliklere veya grafiklere düşmek engelli değildir.
- **Temporal errors.**"Tim Cook Apple'ın CEO'su"  doğru şimdi, yanlış 2005'te.`P580`Başlama zamanı,`P582`Wikidata'da son zaman).
- **Domain mismatch.**REBEL, Wikipedia'da eğitim aldı. Hukuk, tıbbi ve bilimsel metin genellikle alanlar için iyi ayarlanmış RE modellerine ihtiyaç duyar.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

Entegreleme örneği: NER → coref → entite bağlantı → ilişki çıkarımı → ontoloji haritası → grafik yükü. Her aşama potansiyel bir kalite kapısıdır.

## Gönder

- Kaydet .`outputs/skill-re-designer.md`- ...

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Egzersizler

1. **Easy.**Şablon çıkarıcıyı çalıştır `code/main.py`5 haber makalesinin cümlesi.
2. **Medium.**Aynı cümlelerde REBEL (veya küçük bir LLM) kullanın. Üçlü ile karşılaştırın. Hangisi daha hassas?
3. **Hard.**AEVS borusunu oluşturun: LLM + ile ekstraktı çıkarın ve kaynaklara göre süreleri doğrulayın. 50 Wikipedia tarzı cümle üzerinde doğrulama adımından önce vs. sonra halüsinasyon oranını ölçün.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## Daha Fazla Okumak

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) Uzak denetim kağıdı.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) Seq2seq RE iş atı.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) ortak IE.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) 2026 hallüsinasyon-düşünme tasarımı.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) Kanonik grafik sorguları.
