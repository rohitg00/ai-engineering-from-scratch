# Koreferans Kararı

> "O, onu aradı. cevap vermedi. Doktor öğle yemeğindeydi". İki kişiye üç referans ve kimse adı verilmedi.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## Sorun

300 kelimelik bir makaleden Apple Inc. hakkında her anlattığı her anını çıkarın. Makalede "Apple" dendiğinde kolay. "Olar", "Cupertino'nun teknoloji devleri" veya "Jobs'ın firması" dendiğinde zor.

Coreference çözünürlüğü, aynı gerçek dünya varlığına atıfta bulunan her ifadeyi bir küme bağlar.

2026'da neden önemli:

- Özet: " CEO ilan etti... " vs " Tim Cook ilan etti... "  Özet CEO'nun adını almalıdır.
- "Kimleri aradı?" sorusuna cevap vermek için "o"u çözmek gerekir.
- Bilgi çıkarımı: "PER1 Apple'ı kurdu" ve "Jobs Apple'ı kurdu" ayrı girişler olarak bilgi grafiği yanlış.
- Çok belge IE: aynı olayla ilgili makaleler arasında bahsedilen ifadelerin birleşmesi, çapraz belge temel referansıdır.

## Anlaşım

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**Giriş: bir belge. Çıktı: her kümenin bir varlığa atfettiği bir isim gruplaması (span).

**Mention types.**

- **Named entity.**"Tim Cook"
- **Nominal.**"İş Başkanı", "Şirket"
- **Pronominal.**"O", "o", "onlar", "o"
- **Appositive.**"Tim Cook, Apple'ın CEO'su,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**Yerim kurallarını kullanarak sözcük çözünürlüğü, güzel bir başlangıç, sözcüklerle çarpışmak şaşırtıcı derecede zor.
2. **Mention-pair classifier.**Her iki söz için .$(m_i, m_j)$- 2016'dan önceki standartlar, geçici kapanışla gruplandırılmış.
3. **Mention-ranking.**Her bir anket için adayların öncesini sıralayın ( "öncesini yok" da dahil olmak üzere).
4. **Span-based end-to-end (Lee et al., 2017).**Transformer kodlayıcı. Tüm adaylık alanlarını uzunluk kapısına kadar sayın. Notları belirtin. Her alan için öntemel olasılık tahmin edin. Açgözlülükle toplayın. Modern öntanımlı.
5. **Generative (2024+).**LLM'yi başlatmak: "Bu metinde ve öncesinde bulunan her isimleri listele".

**The evaluation metrics.**Beş standart ölçüm (MUC, B3, CEAF, BLANC, LEA) çünkü tek bir ölçüm bile gruplama kalitesini yakalamamaktadır.

**Known hard cases.**

- Daha önce sayfalar açılan kurumlara atıfta bulunan kesin tanımlar.
- Köprü Anafora ("tekerlekler" → daha önce bahsedilen bir araba).
- Çince ve Japonca gibi dillerde sıfır anafor.
- Kataphora (referent öncesindeki telaffuz): "Ne zaman **she**"Ben içeri girdim, Mary gülümsedi".

```figure
coref-links
```

## Yapın

### Adım 1: Ön eğitilmiş sinir çekirdekleri (AllenNLP / spaCy- deneysel)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

Uzun bir belgeye göre şöyle bir şey olur:
- Cluster 1: [Apple, Şirket, it]
- Grup 2: [yeni ürünler, onlar]

### Adım 2: Kurallara dayalı isim çözücü (öğretim)

Bakın .`code/main.py`Sadece stdlib uygulanması için:

1. Ekstrak bahşedilmeleri: isimli varlıklar (kapitalleşmiş alanlar), telaffuzlar (dik arama), kesin tanımlar ("X").
2. Her ad için, önceki K isimlerine bak ve onları puanlayın:
   - Cinsiyet/sayı anlaşması (heuristik)
   - Son (kıskanç kazanır)
   - Sözcük rolü (seçilmiş konular)
3. En yüksek puan alan bir önceki bağlantı.

Sinir modelleri ile rekabetçi değil ama bir son-son modelin yapması gereken arama alanını ve kararları gösterir.

### Adım 3: Coreference için LLM kullanmak

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

İki başarısızlık modunu izlemek için. Birincisi, LLM'ler aşırı birleştirilmektedir ("o" ve "o" iki farklı kişiyi ifade eder).

### Dördüncü adım: değerlendirme

Standart conll-2012 senaryosu MUC, B3, CEAF-φ4 hesaplar ve ortalamayı rapor eder. İçsel bir değerlendirme için, uzantı seviyesindeki hassaslıkla başlayın ve notlanmış test setinizi geri çağırın, sonra bahsedilen bağlantı F1 ekleyin.

## Tuzaklar

- **Singleton explosion.**Bazı sistemler her bahsedilen şeyi kendi kümesi olarak rapor eder. B3 yumuşak davranır. MUC bunu cezalandırır. Her zaman üç metrikten de kontrol et.
- **Pronouns in long context.**2000'den fazla belge üzerinde performans 15 F1 düşüyor.
- **Gender assumptions.**Zor kodlanmış cinsiyet kuralları ikili olmayan referanslara, organizasyonlara, hayvanlara karşı geçerli değildir.
- **LLM drift on long docs.**Tek bir API çağrısı 50+ paragraf boyunca güvenilir bir şekilde kümelerden bahsetemez.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

2026'da gönderilen entegrasyon modeli: önce NER çalıştırın, coref çalıştırın, coref kümelerini NER kuruluşlarına birleştirin.

## Gönder

- Kaydet .`outputs/skill-coref-picker.md`- ...

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Egzersizler

1. **Easy.**Kurallara dayalı çözücüyi çalıştır `code/main.py`5 el yapımı paragraf üzerinde. İsim-bağlam doğruluğunu temel gerçeğe göre ölç.
2. **Medium.**Bir haber makalesinde önceden eğitilmiş bir sinir çekirdek modeli kullanın.
3. **Hard.**Temel geliştirilmiş bir NER boru hattı oluşturun: önce NER, sonra da temel gruplar üzerinden birleşin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## Daha Fazla Okumak

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) Kanonik ders kitabı bölümü.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) Dönüş tabanlı uçtan sonuna.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) Korfeyi iyileştiren bir antrenman.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) referans değerini.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) kurallara dayalı klasik.
