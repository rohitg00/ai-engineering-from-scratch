# Capstone 17 — Kişisel Yapay Zeka Öğretmeni (Uyarlanabilir, Çok Modlu, Bellekli)

> Khanmigo (Khan Academy), Duolingo Max, Google LearnLM / Gemini for Education, Quizlet Q-Chat ve Synthesis Tutor'un tümü, 2026'da geniş ölçekte uyarlanabilir çok modlu ders hizmeti sundu. Ortak şekil, Sokratik bir politikadır (asla cevabı atmayın), her etkileşimden sonra güncellenen bir öğrenci modeli (Bayes'in bilgi izleme stili), ses + metin + fotoğraf-matematik girişi, müfredat grafiği alımı, aralıklı tekrarlama yaşa uygun içerik için planlama ve sıkı güvenlik filtreleri. Son nokta, konuya özel bir öğretmen göndermek (K-12 cebiri veya Python'a giriş), 10 öğrenciyle iki haftalık bir yeterlilik çalışması yürütmek ve bir içerik güvenliği denetimini geçmektir.

**Tür:** Kapak taşı
**Diller:** Python (arka uç, öğrenci modeli), TypeScript (web uygulaması), SQL (Postgres + Neo4j aracılığıyla müfredat grafiği)
**Önkoşullar:** Aşama 5 (NLP), Aşama 6 (konuşma), Aşama 11 (LLM mühendisliği), Aşama 12 (multimodal), Aşama 14 (agents), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Süre:** 30 saat

## Sorun

Uyarlanabilir özel ders eskiden bir eğitim teknolojisi araştırma alanıydı. 2026 yılına gelindiğinde ise tüketici ürünü haline gelecek. Khanmigo ABD'nin çoğu okul bölgesinde konuşlandırılmıştır. Duolingo Max on milyonlarca MAU'ya ulaştı. Google'ın LearnLM / Gemini for Education ürünü, Google Classroom'da ders vermeyi destekler. Quizlet Q-Chat bilgi kartlarının yanında yer alır. Sentez Öğretmeni meraklı çocuklara özel öğretmenle viral oldu. Ortak unsurlar: çok modlu girdi (yazın, konuşun, denklemlerin fotoğrafını çekin), Sokratik pedagoji (önce sor, sonra açıkla), her etkileşimden sonra güncellenen bir öğrenci modeli ve yaşa uygun katı güvenlik.

Belirli bir grup için bunlardan birini oluşturacaksınız. Ölçüm çubuğu gerçek bir yeterlilik çalışmasıdır: 10 öğrenciyle iki hafta boyunca ön test ve son test puanları. Ses döngüsü doğal hissettirmelidir (kapak taşı 03 alt yığını). Bellek mahremiyete saygılı olmalıdır. Güvenlik filtresinin K-12 için COPPA uyumlu kırmızı takımdan geçmesi gerekir.

## Konsept

Dört bileşen. **Öğretmen politikası** Sokratik bir döngüdür: Öğrenci yanıt istediğinde politika yönlendirici bir soru sorar; doğru anladıklarında bir sonraki konsepte geçiyor; sıkışıp kaldıklarında iskeleli bir ipucu sunuyor. **Öğrenci modeli**, her etkileşimden sonra müfredat düğümü başına ustalık olasılığını güncelleyen Bayesian bilgi takibidir (veya basit bir varyanttır). **Müfredat grafiği**, önkoşul kenarları olan kavramların Neo4j'sidir; politika bir sonraki konsepti seçmek için grafikte yürür. **Bellek** geçmiş etkileşimleri, hataları ve tercihleri ​​saklayan epizodik + semantik bir depodur (agentbellek tarzı).

UX çok modludur. Yazılan yanıtlar için metin girişi. LiveKit + Whisper aracılığıyla ses girişi (kapak taşı 03'ü yeniden kullanın). dots.ocr veya PaliGemma 2 aracılığıyla matematik problemleri için fotoğraf girişi. Cartesia Sonic-2 aracılığıyla ses çıkışı. Güvenlik, Llama Guard 4'ün yanı sıra yaşa uygun bir filtre (yetişkinlere yönelik içeriği, şiddeti, kendine zarar vermeyi engeller) ve COPPA uyumlu hafıza tutma politikasını kullanır.

Etkililik çalışması teslimattır. 10 öğrenci, ön test ve son test, iki hafta. Öğrenme kazancı deltasını ve güven aralığını rapor edin. Uyarlanabilir olmayan bir temel ile karşılaştırın (aynı içerik, öğretmen politikası olmadan doğrusal olarak sunulur).

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

## Yığın

- Konu seçimi: K-12 cebiri veya Python'a giriş (derinlik için birini seçin)
- Öğretmen politikası: Claude Sonnet 4.7 üzerinden LangGraph (prompt önbelleğe alma ile)
- Öğrenci modeli: Bayesian bilgi takibi (klasik) veya aralık için FSRS
- Müfredat grafiği: Kavramların Neo4j'si + ön koşul kenarları + OER içeriği
- Bellek: agentbellek tarzı kalıcı vektör + epizodik + anlamsal depo
- Ses: LiveKit Agents 1.0 + Cartesia Sonic-2 (capstone 03 alt yığınını yeniden kullanın)
- Fotoğraf matematiği: dots.ocr veya denklem tanıma için PaliGemma 2
- Güvenlik: Llama Guard 4 + yaşa uygun özel filtre
- Değerlendirme: Bloom düzeyinde soru oluşturma, test öncesi/sonrası koşum takımı, etkililik çalışması araçları

## Build It — Kendin Geliştir

1. **Müfredat grafiği.** Önkoşul kenarları olan 50-150 kavram düğümünden (e.g., "sayı doğrusu"ndan "ikinci dereceden formüle" K-12 cebiri) oluşan bir Neo4j oluşturun. Düğüm başına OER içeriğini ekleyin (Açık Ders Kitabı, OpenStax).

2. **Öğrenci modeli.** Bayesian bilgi takibini önceliklerle başlatın: tahmin etme, kayma, öğrenme oranı. Her etkileşimden sonra konsepte göre ustalığı güncelleyin. Öğrenci başına kalıcılık.

3. **Öğretmen politikası.** Düğümlü LangGraph: `read_signal` (öğrencinin cevabı doğru mu / kısmi / takılıp kalmış mıydı?), `select_concept` (en yüksek öncelikli kavramı seçen yürüyüş müfredat grafiği), `scaffold` (Sokratik prompt), `update_mastery`.

4. **Bellek.** Her etkileşim epizodik bir depoya yazar. Hatalar ve tercihler anlamsal hafızayı geliştirir. COPPA uyumlu saklama politikası: 1 yıl sonra otomatik olarak silinir, ebeveynler tarafından erişilebilir.

5. **Ses yolu.** Öğretmen politikasına bağlı LiveKit Agent çalışanı. Whisper-v3-turbo aracılığıyla ASR. Kartezya Sonic-2 aracılığıyla TTS. Katılma desteklenir (kapak taşı 03 mekaniğini yeniden kullanın).

6. **Fotoğraf-matematik yolu.** Görüntüyü yükleyin veya yakalayın; denklemi tanımak için dots.ocr veya PaliGemma 2'yi çalıştırın; yapılandırılmış girdi olarak öğretmene besleme.

7. **Güvenlik.** Her modelin çıktısı, Llama Guard 4 + yaşa uygun bir filtreden geçer (kendine zarar vermeyi, yetişkinlere yönelik içeriği ve şiddeti engeller). Öğrenci kimliği kapsamına alınan bellek erişimi; silinmek üzere ebeveyn erişim yüzeyi.

8. **Yeterlik çalışması.** 10 öğrenci, ön test (standartlaştırılmış 30 soruluk temel), iki haftalık öğretmen etkileşimi (3 oturum/hafta), son test. Aynı içerikteki 10 öğrenciden oluşan uyarlanabilir olmayan temel grupla karşılaştırın.

9. **Haftalık ilerleme raporları.** Öğrenci başına, araştırılan konuların, uzmanlık gidişatlarının ve önerilen sonraki adımların bir PDF özetini otomatik olarak oluşturun.

## Use It — Hazır Araçla Uygula

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

## Ship It — Kullanıma Sun

`outputs/skill-ai-tutor.md` teslim edilebilirdir. Çok modlu girdi, öğrenci modeli, hafıza, güvenlik ve ölçülen yeterliliğe sahip, konuya özel uyarlanabilir bir öğretmen.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | Delta kazanmayı öğrenme | 10 öğrencili iki haftalık bir çalışmada ön/son test deltası |
| 20 | Sokratik sadakat | Transkript örneklerine ilişkin değerlendirme listesi puanı |
| 20 | Çok Modlu Kullanıcı Deneyimi | Ses + fotoğraf + metin tutarlılığı uçtan uca |
| 20 | Güvenlik + gizlilik duruşu | Llama Guard 4 geçiş oranı + COPPA uyumlu elde tutma |
| 15 | Müfredat genişliği ve grafik kalitesi | Konsept kapsamı + önkoşul grafik tutarlılığı |
| **100** | | |

## Egzersizler

1. Yeterlilik çalışmasını uyarlanabilir öğrenci modeliyle ve bu model olmadan (rastgele kavram sırası) çalıştırın. Deltayı bildirin. Kazanmak için uyum sağlamayı bekleyin, ancak boyut ilginç bir rakam.

2. Çok modlu bir araştırma ekleyin: aynı kavram sorusu metin, ses ve fotoğraf olarak sunulur. Öğrencilerin tercih ettikleri yöntemle daha hızlı birleşip birleşip birleşemeyeceğini ölçün.

3. Bir ebeveyn kontrol paneli oluşturun: çalışılan konular, ustalık yolları, yaklaşmakta olan konseptler, güvenlik etkinlikleri (her türlü korkuluk isabeti). COPPA uyumlu.

4. Dil değiştirme modu ekleyin: öğretmen İspanyolca girişini kabul eder ve İspanyolca öğretir. X-Guard kapsamını ölçün.

5. Bellek gizliliğini vurgulayın: A öğrencisinin, ses klibini yeniden alma saldırısı olsa bile B öğrencisinin verilerini göremediğini doğrulayın. Erişim girişimini ve uyarıyı günlüğe kaydedin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Sokratik politika | "Sor, bırakmayın" | Öğretmen, cevabı vermek yerine yönlendirici bir soru sorar |
| Bayesian bilgi takibi | "BKT" | Kavram başına ustalık olasılığı için klasik öğrenci modeli denklemleri |
| FSRS | "Serbest Aralıklı Tekrarlama Zamanlayıcısı" | 2024 aralıklı tekrarlı zamanlayıcı, SM-2'den daha iyi |
| Müfredat grafiği | "Konsept DAG" | Önkoşul kenarları olan kavramların Neo4j'si |
| Epizodik hafıza | "Etkileşim başına günlük" | Her etkileşim daha sonra alınmak üzere saklanır |
| Anlamsal bellek | "Öğrenilmiş desen mağazası" | Bölümlerden öne çıkan sıkıştırılmış hatalar ve tercihler |
| COPPA | "Çocukların mahremiyeti yasası" | ABD yasaları 13 yaşın altındaki çocuklardan veri toplanmasını kısıtlıyor |

## Daha Fazla Okuma

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — tüketici K-12 eğitmenine referans
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — dil öğrenme eğitmenine referans
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) — barındırılan referans modeli
- [Quizlet Q-Chat](https://quizlet.com) — alternatif referans
- [Synthesis Tutor](https://www.synthesis.com) — başlangıç ​​referansı
- [FSRS algoritması](https://github.com/open-spaced-repetition/fsrs4anki) — aralıklı tekrarlama planlayıcısı
- [Bayes Bilgi Takibi](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — öğrenci modeli klasiği
- [LiveKit Agents](https://github.com/livekit/agents) — ses yığını
