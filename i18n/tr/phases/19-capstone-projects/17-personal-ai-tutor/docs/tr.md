# Capstone 17  Kişisel AI Öğretmeni (Adaptif, Çok Modal, hafıza ile)

> Khanmigo (Khan Akademisi), Duolingo Max, Google LearnLM / Gemini for Education, Quizlet Q-Chat ve Synthesis Tutor hepsi 2026'da ölçekte adapte multimodal öğretim gönderiyor. Ortak şekil, Sokratik bir politika (sadece cevabı atmayın), her etkileşimden sonra güncellenen bir öğrenci modeli (Bayesian bilgi izleme tarzı), ses + metin + foto-riyaziyet girişleri, kurikulum grafiği geri alımı, aralı tekrar programlaması ve yaşa uygun içerik için sert güvenlik filtreleri. Başlık, konu-özel bir öğretmen göndermek (K-12 cebir veya giriş Python), 10 öğrenciyle iki haftalık bir etkinlik çalışması yürütmek ve içerik güvenliği denetimini geçmek.

**Type:** Capstone
**Languages:** Python (backend, learner model), TypeScript (web app, learner model scaffold), SQL (curriculum graph via Postgres + Neo4j)
**Prerequisites:** Phase 5 (NLP), Phase 6 (speech), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## Sorun

Adaptif öğretim, teknoloji araştırmaları için bir yerdi. 2026 yılına kadar bir tüketici ürünü haline gelecek. Khanmigo, ABD'nin çoğu okul bölgesinde yer almaktadır. Duolingo Max on milyonlarca MAU'ya çarptı. Google'ın Eğitim için LearnLM / Gemini'si Google Sınıfında öğretim vermeyi güçlendirir. Quizlet Q-Chat kartların yanında oturur. Synthesis Tutor, meraklı çocuklara öğretmenlik yaparak viral oldu. Ortak unsurlar: multimodal giriş (tip, konuşma, fotoğraf denklemleri), Sokratik pedagogi (en önce sor, sonra açıkla), her etkileşimden sonra güncellenen öğrenci modeli ve yaşlara uygun sıkı güvenlik.

Bu yöntemlerden birini belirli bir grup için inşa edeceksiniz. Ölçüm çubuğu gerçek bir etkinlik çalışmasıdır: 10 öğrenci ile iki hafta boyunca test öncesi ve test sonrası puanlar. Ses döngüsü doğal hissetmelidir (capstone 03 alt toplama). Hatıra gizliliğe saygı duymalıdır. Güvenlik filtresi COPPA-a karşı bilinçli kırmızı takım K-12 için geçmelidir.

## Anlam

Dört bileşen.**Tutor policy**Sokratik bir döngüdür: öğrenci cevap sorarken politika bir önde gelen soru sorar; doğru bulurlarsa, bir sonraki kavrama geçir; sıkıştıklarında, bir tekerlekli ipucu sunar. **Learner model**her etkileşimden sonra her kurikulum düğümüne göre ustalık olasılığını güncelleyen Bayesian bilgi izleme (veya basit bir varyant) **Curriculum graph**ön koşulları olan kavramların Neo4j'si; politika, sonraki kavramı seçmek için grafikte yürür. **Memory**Geçmişteki etkileşimleri, hataları ve tercihleri tutan bir bölümsel + semantik depo (agentmemory-style)

UX çok modaldir. Tiplenen cevaplar için metin giriş. LiveKit + Whisper üzerinden ses giriş (daha kullanın 03). Dots.ocr veya PaliGemma üzerinden matematik sorunları için fotoğraf giriş 2. Cartesia Sonic üzerinden ses çıkışı-2. Güvenlik Llama Guard 4 ile birlikte yaş açısından uygun bir filtre kullanır (büyükler içeriği, şiddet, kendini zararlandırmak) ve COPPA-a göre hafıza tutma politikası.

10 öğrenci, test öncesi ve test sonrası, iki hafta. Öğrenme kazancı delta ve güven aralığı rapor edin.

## Mimarlık

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## Yüküm

- Konu seçimi: K-12 cebir veya giriş Python ( derinlik için birini seçin)
- Öğretmen politikası: LangGraph over Claude Sonnet 4.7 (sürekli önbelleğe sahip)
- Öğrenci modeli: Bayesian bilgi izleme (klasik) veya boşluk için FSRS
- Eğitim grafikleri: Konsepler Neo4j + ön şartlar + OER içeriği
- Hatırlama: ajanhatırlama tarzında kalıcı vektör + episodik + semantik depolama
- Ses: LiveKit Ajanları 1.0 + Cartesia Sonic-2 (daha kullanın alt taş 03 yığın)
- Fotoğraf matematik: dots.ocr veya PaliGemma 2 denklem tanıma için
- Güvenlik: Llama Guard 4 + yaş için uygun özel filtre
- Eval: Bloom düzeyde soru oluşturma, test öncesi/sonrası kullanımı, etkinlik çalışmaları aracı

```figure
cf-tutor-loop
```

## Yapın

1. **Curriculum graph.**50-150 konsept düğümünden oluşan Neo4j'yi (örneğin, "sayı çizgisinden" "kadratik formül"e kadar K-12 cebir) ön şartlı kenarlarla oluşturun.

2. **Learner model.**Bayesian bilgilerini önceden takip ederek başlatın: tahmin, kaydırma, öğrenme hızı. Her etkileşimden sonra kavram başına ustalık güncelleyin. Öğrenci başına devam edin.

3. **Tutor policy.**Kürekleri olan LangGraph: `read_signal`(öğrencin cevabı doğru muydu / kısmi miydi / sıkıştı mıydı?),`select_concept`(en yüksek öncelik konseptini seçen yürüyüş kurikulum grafik), `scaffold`(Sokratik uyarı),`update_mastery`- Evet .

4. **Memory.**Her etkileşim bir bölümlü mağazaya yazılır. Hatalar ve tercihler semantik hafıza için destek olur. COPPA-a bağlı tutma politikası: 1 yıl sonra otomatik olarak silinir, ebeveyn erişilebilir.

5. **Voice path.**LiveKit Ajanlar çalışanı öğretmen politikasına bağlanmıştır. Whisper-v3-turbo üzerinden ASR. Cartesia Sonic-2 üzerinden TTS. Barge-in desteklenir (daha kullanın capstone 03 mekaniği).

6. **Photo-math path.**Görüntüyü yükle veya yakalayın; denklemi tanımak için dots.ocr veya PaliGemma 2 çalıştırın; yapılandırılmış giriş olarak öğretmene girin.

7. **Safety.**Her model çıkışı Llama Guard 4 + yaş için uygun bir filtreyi geçirir (kendine zarar verme, yetişkin içeriği, şiddet blokları).

8. **Efficacy study.**10 öğrenci, test öncesi (standart 30 soru temel çizgi), iki hafta öğretmen etkileşimi (3 seans/hafta), test sonrası.

9. **Weekly progress reports.**Öğrenci başına, araştırılan konular, ustalaşma rotaları ve önerilir sonraki adımların PDF özetini otomatik olarak oluşturun.

## Kullan

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## Gönder

`outputs/skill-ai-tutor.md`Multimodal giriş, öğrenci modeli, hafıza, güvenlik ve ölçülen etkinlik ile konu-specifik bir uyarlayıcı öğretmen.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | Pre/post-test delta in a 10-learner two-week study |
| 20 | Socratic fidelity | Rubric score on transcript samples |
| 20 | Multimodal UX | Voice + photo + text coherence end to end |
| 20 | Safety + privacy posture | Llama Guard 4 pass rate + COPPA-aware retention |
| 15 | Curriculum breadth and graph quality | Concept coverage + prerequisite graph consistency |
| **100** | | |

## Egzersizler

1. Adaptif öğrenci modeli (hassasi konsept sırası) ile ve olmadan etkinlik çalışmasını yürüt.

2. Bir multimodal sonda ekleyin: metin, ses ve fotoğraf olarak verilen aynı kavram sorusu. Öğrencilerin tercih ettikleri modalite daha hızlı bir şekilde yaklaşıp yaklaşmadığını ölçün.

3. Ana paneli oluşturun: uygulanan konular, ustalık yöreleri, gelecek konseptler, güvenlik etkinlikleri (herhangi bir koruma rayı çarpması). COPPA'ya uyumlu.

4. Dil değiştirme modunu ekleyin: öğretmen İspanyolca girişini kabul eder ve İspanyolca öğretir.

5. Hatıra gizliliğini vurgulamak: A öğrencisi B öğrencisi verilerini sesli bir klip yeniden içme saldırısı aracılığıyla bile göremeyeceğini doğrulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | Tutor asks a leading question rather than giving the answer |
| Bayesian knowledge tracing | "BKT" | Classic learner-model equations for mastery probability per concept |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 spaced-repetition scheduler, better than SM-2 |
| Curriculum graph | "Concept DAG" | Neo4j of concepts with prerequisite edges |
| Episodic memory | "Per-interaction log" | Every interaction stored for later retrieval |
| Semantic memory | "Learned pattern store" | Compacted mistakes and preferences promoted from episodic |
| COPPA | "Kids privacy law" | US law restricting data collection from children under 13 |

## Daha Fazla Okumak

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) İpucu tüketicisi K-12 öğretmeni
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) İdeal dil öğrenme öğretmeni
- [Google LearnLM / Gemini for Education](https://blog.google/products-and-platforms/products/education/google-learnlm-gemini-generative-ai/) barındırılmış referans modeli
- [Quizlet Q-Chat](https://quizlet.com) Değişkin referans
- [Synthesis Tutor](https://www.synthesis.com) Başlangıç referansı
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) Aralıklı tekrar programı
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) öğrenci modeli klasik
- [LiveKit Agents](https://github.com/livekit/agents) Sesli bir yığın
