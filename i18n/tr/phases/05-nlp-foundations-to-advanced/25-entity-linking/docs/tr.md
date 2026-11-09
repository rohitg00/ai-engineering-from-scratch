# Birim Bağlantısı ve Açıklama

> NER "Paris"i buldu. "Paris, Fransa"yı bağlantı veren bir varlık Paris Hilton Paris, Texas Paris, Paris (Trojan prens) mı?

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## Sorun

Bir cümle şöyle yazıyor: "Jordan basını dövdü". NER'iniz "Jordan"ı kişi olarak etikete aldı.

- Michael Jordan (basketbol)?
- Michael B. Jordan (aktör)?
- Michael I. Jordan (Berkeley ML profesörü  evet, bu karışıklık ML makalelerinde gerçek mi)?
- Ülke?
- Jordan (İbranice ilk isim)?

Entity linking (EL) bir bilgi tabanındaki her bahsedilen tek bir giriş için çözülür: Wikidata, Wikipedia, DBpedia veya alanınız KB. İki alt görev:

1. **Candidate generation.**"Jordan"ı göz önüne alarak hangi KB kayıtları makul?
2. **Disambiguation.**Bu bağlamda hangisi doğru aday?

Her iki adım da öğrenilmeye yarar. Her ikisi de benchmarkedir.

## Anlaşım

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**İsim yüzey formu ("Jordan") verildiğinde, adayları bir isim endeksinde arayın. Wikipedia isim sözlükleri çoğu isimli varlığı kapsar: "JFK" → John F. Kennedy, Jacqueline Kennedy, JFK havaalanı, JFK (film). Tipik bir isim endeksinde 10-30 aday gönderir.

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`İyi çalışıyor, hızlı, hiç eğitim yok.
2. **Embedding-based (ESS / REL / Blink).**Encode adı + bağlam. Her adayın açıklamasını encode. Max cosine seçin. 2020-2024 öntanımlı.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**Yönetici'nin kanonik adı token-by-token'i çöz. Geçerli bir varlık adlarının bir üçlüüne sınırlı, böylece çıkışın geçerli KB kimliği garanti edilir.

**End-to-end vs pipeline.**Modern modeller (ELQ, BLINK, ExtEnD, GENRE) bir geçit içinde NER + aday jenerasyonu + belirsizliği çalıştırır.

### İki ölçüm

- **Mention recall (candidate gen).**Altınının bölümü, aday listesinde doğru KB girişinin görüntüsünde belirtilmiştir.
- **Disambiguation accuracy / F1.**Doğru adaylar verildiğinde, ilk 1'in ne kadar sık doğru olduğu ortaya çıkıyor.

İhtiyacın %80'i ile ilgili %99 açıklama sisteminin %80'i de bir boru hattı.

```figure
gx-entity-linking
```

## Yapın

### Adım 1: Wikipedia yönlendirmelerinden bir isim indeks oluşturun

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Wikipedia alias verileri: ~ 18M (alias, entite) çiftleri. Wikidata çöplüklerinden indir. Ters indeks olarak saklayın.

### Adım 2: bağlam tabanlı belirsizlik

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

Jaccard örtüsü bir oyuncak.`code/main.py`Transformer versiyonu için adım 2.

### Adım 3: Eklenti tabanlı (BLINK tarzı)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

İndeks zamanında, her KB varlığı bir kez yerleştirin. Sorgu zamanında, bahane + bağlamı bir kez yerleştirin, aday havuzuna karşı nokta- ürünü seçin, maksimum seçin.

### Adım 4: Geliştirici birim bağlantısı (konsept)

GENRE, kuruluşun Wikipedia başlıklarını karakterle karakter çözüyor. Sınırlı çözme (derse 20) yalnızca geçerli başlıkların çıkarabilmesini sağlar. KB desteklenen bir trie ile sıkı bir entegrasyon. Modern nesil REL-GEN ve LLM tarafından uyarlanan EL'dir.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Beyaz bir liste ile birleştirilmiştir (Könüllü çizelgeleri `choice`), 2026 yılında gönderilmesi gereken en basit EL boru hattı.

### Adım 5: AIDA-CoNLL değerlendirme

AIDA-CoNLL standart EL referans değeridir: 1.393 Reuters makalesi, 34k bahsedilen, Wikipedia kurumları.`P@1`) ve KB dışındaki NIL tespit oranı.

## Tuzaklar

- **NIL handling.**Bazı isimler KB'de (önerilen varlıklar, belirsiz insanlar) bulunmuyor. Sistemler yanlış varlık tahmin etmek yerine NIL tahmin etmelidir. Ayrı ayrı ölçülmüştür.
- **Mention boundary errors.**Akıntılı NER kısmi süreleri ("Bank of America" olarak etiketlenmiş) kaybeder. EL geri çağırma düşer.
- **Popularity bias.**Eğitimli sistemler sık sık varlıkları fazla tahmin eder. ML kağıdındaki "Michael I. Jordan" adı genellikle basketbol Jordan ile bağlantılıdır.
- **Cross-lingual EL.**Çince metinde İngilizce Wikipedia kuruluşlarına bahsedilen haritalama. Çok dilli bir kodlayıcı veya bir çeviri adımını gerektirir.
- **KB staleness.**Yeni şirketler, etkinlikler, insanlar geçen yılki Wikipedia çöplüğünde değil. Üretim boru hattları bir yenilenme döngüsüne ihtiyaç duyar.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

2026'da gönderilen üretim modeli: NER → coref → EL her bahsedilen → çöküş kümeleri her kümede bir kanonik varlık haline getirir. Çıktım: belgedeki bir varlık için bir KB id, bahsedilmeyen bir.

## Gönder

- Kaydet .`outputs/skill-entity-linker.md`- ...

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## Egzersizler

1. **Easy.**Önceki + bağlam belirlemeciyi  uygulamak`code/main.py`10 belirsiz isimle (Paris, İordana, Apple) doğru kişiyi işaretleyin.
2. **Medium.**50 belirsiz bahsedilen cümleyi bir cümle dönüştürücü ile kodlayın. Her adayın açıklamasını yerleştirin. Yerleştirme tabanlı belirsizlikleri Jaccard bağlamı üst üste karşılaştırın.
3. **Hard.**1k'lik bir alan KB oluşturun (örneğin şirketinizde çalışanlar + ürünler). NER + EL'i son-son uygulayın. 100 beklenmiş cümle üzerinde doğruluk ölçün ve geri alın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## Daha Fazla Okumak

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) temel ön + bağlam yaklaşımı.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) yerleşim tabanlı iş atı.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) kısıtlı dekodlama ile generatif EL.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) referans kağıdı.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) açık üretim yığın.
