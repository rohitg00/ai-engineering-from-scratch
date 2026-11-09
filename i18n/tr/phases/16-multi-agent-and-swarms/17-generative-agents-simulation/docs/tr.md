# Geliştirici Ajanlar ve Yeni Oluşan Simülasyon

> Park et al. 2023 (UIST '23, arXiv:2304.03442) nüfuslu **Smallville**, 25 ajanlı bir kum kutusu, üç bölümlü bir mimari ile:**memory stream**(doğal dil kayıtları),**reflection**(Ajantin kendi akışında ürettiği yüksek düzeyde sentezler) ve**plan**(gündüz düzeyinde davranış, sonra alt planlar). Önemli sonuç Sevgililer Günü partisi ortaya çıktı: bir ajan daha fazla senaryo yazmadan "sevgililer Günü partisi vermek istiyor" ile tohumlandı, nüfus arasında yayılmış davetiye üretti, koordinasyon tarihleri ve parti 24 ajanın bilgisi olmadan başlattığı bir parti oldu. Ablationlar, inançlılık için üç bileşenin de gerekli olduğunu göstermektedir. Belgelemiş hatalar, yer norm hataları (kapalı mağazalara girmek, tek kişilik banyo paylaşmak) dir. Bu, 2026'da ajan simülasyonları ve çoklu ajan sosyal değerlendirme için referans mimarisi.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Sorun

Çoğu çoklu ajan sistemi sıkı bir şekilde yazılmış ekiplerdir: planlama planları, kodlayıcı kodları, inceleyiciler incelemeleri. Bu iyi tanımlanmış görevler için çalışır. Ajanların hafızası, öncelikleri ve açık bir dünyası olduğunda ortaya çıkan ortaya çıkan, yazılmamış davranışları yakalamaz. Araştırma, toplumsal simülasyon ve giderek daha fazla oyun AI'nin bu ikinci türüne ihtiyacı vardır.

Park 2023'e kadar en iyi ajan simülasyonları ufak senaryo takipçileriydi; bundan sonra, örnekteki açık dünyalarda üreticiler için varsayılandır. 2026'da bir ajan simülasyonu oluşturursanız, ya Smallville'in üç bileşenini kullanıyorsunuz ya da açıkça neden olmadığınızı haklı çıkarıyorsunuz.

## Anlam

### Üç bileşen

**Memory stream.**Her giriş bir zaman damgası, bir tür, bir açıklama (doğal dil) ve elde edilen metadata sahiptir:**recency**- Evet .**importance**(Agent tarafından 1-10 değerlendirilmiş) ve **relevance**(kurrent sorguya benzerlik gösterir).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

Hatıra kurtarma üç puanı birleştirir:`score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`Top-k girişleri mevcut çağrıda girer.

**Reflection.**Periodik olarak (her N anısı veya önemli olaylarda), ajan son anılardan daha yüksek sıradaki sentezler üretir. Yansıma girişleri akıma geri döner ve diğer hafızayla aynı şekilde geri alınır. Bu şekilde ajanlar "anlamalar" oluşturur  mimarinin uzun vadeli inançlara eşdeğeri.

**Plan.**Top-down parçalanma. Önce gün düzeyde planı geniş vuruşlarda ("işe git, Klaus ile akşam yemeği yiyin"). Sonra saat düzeyde planlar. Sonra eylem düzeyde planlar. Planlar gözden geçirilebilir: bir gözlem bir plana aykırı olduğunda, ajan etkilenen bölümü yeniden planlar.

### Neden üçü de önemli (bırak)

Park et al. gözlem, düşünme ve planlama her birini düşüren ablationlar çalıştı.

- - Hayır .**observation**Ajan bağlamı kaçırıyor ve eski inançlara göre hareket ediyor.
- - Hayır .**reflection**ajan daha yüksek düzeyde inançlar oluşturabilir; etkileşimler yüzeysel kalır.
- - Hayır .**plan**Davranışlar reaktif gürültü haline gelir; hedefler dağılar.

İnsan değerlendiricilerinden alınan inanç puanları, üçüyle de en yüksek; herhangi birini düşürmek ölçülebilir bir gerileme üretir.

### Sevgililer Günü'nün ortaya çıkması

Bir ajan, Isabella Rodriguez, "14 Şubat'ta saat 5'te Hobbs Cafe'de Sevgililer Günü partisi vermek istiyor" hedefiyle tohumlanmış.

1. Isabella'nın planı insanları davet etmektir.
2. Her davet komşunun hafızasında bir gözlem haline gelir.
3. Komşunun düşüncesi inançlara yol açar: "Isabella parti veriyor".
4. Komşunun planı "14 Şubat'ta partiye katılmak" içermektedir.
5. Komşular diğer komşulara haber verirler.
6. 14 Şubat akşam 5'te birkaç ajan Hobbs Cafe'de toplanıyor.

Bu teknik anlamda ortaya çıkış: sistem düzeyinde davranış (bir parti) merkezi bir orkestrasyoncu olmadan yerel etkileşimlerden (iki taraflı davetler + bireysel planlama) ortaya çıktı.

### Belgelemiş başarısızlık modları

Park et al. açıkça belge:

- **Spatial norm errors.**Ajanlar kapalı mağazalara giriyorlar. Ajanlar aynı tek kişilik tuvaletini kullanmaya çalışıyorlar. Ajanlar yemek için tasarlanmamış odalarda yemek yiyorlar.
- **Memory overflow.**Derin simülasyon çalışmalar hafıza kurtarma maliyetinin artmasına neden olur. Pratik bir çözüm: periyodik hafıza sıkıştırılması (cümle ve kesme) ve düşük önemli girişlerde bozulma.
- **Reflection hallucination.**Refleksyonlar hafıza akımında bulunmayan ilişkileri icat edebilir. Yumuşaklaştırma: Refleksyon isteklerinde kaynak hafıza kimliklerini ekle ve kurtarma zamanında doğrulayın.

Bunlar üretim ile ilgili hata modlarıdır: 2026 ajan simülasyonu onları miras alır.

### Üç bileşenli uygulama kuralları

1. **Memory is append-only.**Hiç bir hafıza girişini mutasyona sokmayın.
2. **Importance scores are cheap.**Yazma zamanı 1-10 değerini değerlendirmek için Yüksek Lisans Yüksek Lisansına arayın.
3. **Retrieval is ranked, not filtered.**Top-k kombinasyon puanı; sert filtreler kullanmayın (koneks kaybederler).
4. **Reflection runs periodically.**İşlenmemiş hafızaların öneminin toplamı bir eşiği (örneğin 150) aşırırken tetikleyici.
5. **Plans are revisable.**Yeni bir gözlem bir plana aykırı olduğunda, sadece etkilenen bölümü, tüm planı değil, yeniden oluşturun.

### Smallville'den öte üreticiler

2024-2026 takip literatürü mimarlığı genişletiyor:

- **Multi-agent social simulation for policy / market research.**Smallville gibi nüfuslar, kullanıcı davranışlarını özelliklere karşılık olarak simüle eder.
- **NPC AI for games.**Smallville ajanları ile oynanan rol oynayan oyunlar senaryoda görevlerin yerine yeni hikayeler üretir.
- **Generative-agent evaluation benchmarks.**Görev doğruluğu yerine, metrik uzun süreler boyunca davranışların güvenilirliği + tutarlılığı haline gelir.

Arsitektur referanstır. Genişlemeler değişken bileşenler (hüye için vektör depolama, geri alma artıran yansıma, nörosimbolik plan) ama üç bölümlü yapıyı korur.

### Bu neden çoklu ajan mühendisliği için önemli

Smallville, çoklu ajanların ortaya çıkmasının bileşenler doğru olduğunda ucuz olduğunu kavramın kanıtıdır. Mimarlık şimdi açık kaynaklı modellerde çoğaltıldı (küçük LLM'ler, keskin değil, şık bir şekilde güvenilirliğini kaybediyor).**emergent social behavior**Bu şekli kullanır.**tight task execution**Bu aşamada daha önceki yönetici / rol / ilkeler kalıplarını kullanıyor.

```figure
a5-memory-reflection
```

## Yapın

`code/main.py`Stdlib Python'da üç bileşenini scripted agent politikaları ile uyguluyor (gerçek LLM yok).

- `MemoryStream` Yenilik/Önem/Alaylılık Kayıtları ile sadece ekleme kayıtları.
- `reflect(stream)` Son zamanlarda önemli anılar üzerinde yazılı bir düşünce.
- `plan(agent_state)` Günlük ve saatlik düzeyde güncel inançlara dayanan planlar.
- Scenari: 5 ajan. 1 ajan saat 5'te "eğlenme partisi" ile başlar. Simülasyonda tikler, daveti yayılır ve ajanlar bir araya gelir.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: tik-tik iz. Son tik'e kadar, 5 ajanın en az 3'ü partiyi planlarında gösterir ve parti konumunda bir araya gelirler. Tek tohum hiçbir orkestrasyoncu olmadan koordine edilmiş bir gelişi üretir.

## Kullan

`outputs/skill-simulation-designer.md`Bir jeneratif ajan simülasyonu tasarlıyor: ajan sayısı, hafıza şeması, yansıma kadansı, plan ufku ve değerlendirme metrikleri.

## Gönder

Üretim simülasyonları için kurallar:

- **Memory is the database.**Gerçek bir mağazayı (vector DB, Postgres) ölçekle seçin.
- **Log the retrieval trace.**Her eylem için, onu yönlendiren en üst-k anıları kaydet.
- **Budget per-agent tokens.**Her ajanın tik başına alın + refleks + planı $O(k)$N ajanlar × T tikler × tik başına çağrılar bütçenizi küçültüyor.
- **Compact memory periodically.**Düşük önemli yazıları özetleyip biç.
- **Detect spatial / social norm violations**Mimarlık onları öğrenmez.

## Egzersizler

1. Çık .`code/main.py`3+ ajanın partide toplandığını onaylayın.
2. Yönlendirme adımını kaldırın. Davranış nasıl görünüyor? Park 2023'te bulunan ablasyon bulgularına haritan.
3. Rekabetçi bir hedef oluşturun ("Klaus akşam 5'te bir araştırma konuşması yapmak istiyor").
4. Yer kısıtlamaları ekleyin: Hobbs Cafe en fazla 4 ajanı tutabilir.
5. Park et al. (arXiv:2304.03442) Bölüm 6 (Çok gelişmiş davranış deneyleri).

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## Daha Fazla Okumak

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) Referans mimarisi
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) Yayınlama yeri
- [Smallville code release](https://github.com/joonspk-research/generative_agents) Referans Python uygulaması
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) Yapılandırılmış hafıza ajanları için önceden kullanılan sanat
