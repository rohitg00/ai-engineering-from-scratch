# Üretken Agent'lar ve Ortaya Çıkan Simülasyon

> Park ve ark. 2023 (UIST '23, arXiv:2304.03442), 25 agent'lik bir sanal alan olan **Smallville**'i üç bölümlü bir mimariyle doldurdu: **bellek akışı** (doğal dil günlüğü), **yansıtma** (agent'ın kendi akışı hakkında ürettiği yüksek düzeyli sentezler) ve **plan** (günlük düzey davranış, ardından alt planlar). Dönüm noktası niteliğindeki sonuç, Sevgililer Günü partisinin ortaya çıkmasıydı: "Sevgililer Günü partisi düzenlemek istiyor" ifadesinin tohumlandığı bir agent, daha fazla senaryo yazmadan, nüfusa yayılan davetiyeler üretti, tarihleri ​​koordine etti ve parti gerçekleşti - 24 agent'tan, hiçbir bilgisi olmadan başladı. Ablasyonlar, inandırıcılık için üç bileşenin de gerekli olduğunu göstermektedir. Belgelenen hatalar mekansal norm hatalarıdır (kapalı mağazalara girmek, tek kişilik banyoları paylaşmak). Bu, 2026'daki agent simülasyonları ve çokluagent sosyal değerlendirmesi için referans mimarisidir.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model), Aşama 16 · 13 (Paylaşılan Bellek)
**Süre:** ~75 dakika

## Sorun

Çoklu-agent sistemlerinin çoğu sıkı bir şekilde yazılmış ekiplerdir: planlayıcı planları, kodlayıcı kodları, incelemeci incelemeleri. Bu, iyi tanımlanmış görevler için işe yarar. agent'ların hafızası, öncelikleri ve açık bir dünyası olduğunda ortaya çıkan, önceden belirlenmemiş davranışları yakalamaz. Araştırma, toplum simülasyonu ve giderek artan oranda oyun yapay zekasının bu ikinci türe ihtiyacı var.

Smallville mimarisi bunun için benchmark'dir. Park 2023'e kadar en iyi agent simülasyonlar sığ senaryo takipçileriydi; ondan sonra bu kalıp, açık dünyalardaki üretken agent'lar için varsayılandır. 2026'da bir agent simülasyonu oluşturursanız, ya Smallville'in üç bileşenini kullanıyorsunuz ya da neden kullanmadığınızı açıkça gerekçelendiriyorsunuz.

## Konsept

### Üç bileşen

**Bellek akışı.** Gözlemlerin, eylemlerin, düşüncelerin ve planların yalnızca eklenen bir günlüğü. Her girişin bir zaman damgası, bir türü, bir açıklaması (doğal dil) ve türetilmiş meta verileri vardır: **yenilik**, **önem** (agent tarafından 1-10 arasında derecelendirilmiştir) ve **alaka düzeyi** (geçerli sorguyla kosinüs benzerliği).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

Hafıza alımı üç puanı birleştirir: `score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`. En üstteki girişler mevcut prompt değerini girer.

**Yansıma.** Periyodik olarak (her N anıda veya önemli olaylarda), agent yakın zamandaki anılardan daha yüksek düzeyde sentezler üretir. Yansıma girdileri akışa geri döner ve diğer bellekler gibi geri alınabilir. agent'lar bu şekilde "anlayışları" oluştururlar; mimarinin uzun vadeli inançlara eşdeğeri.

**Plan.** Yukarıdan aşağıya ayrıştırma. İlk olarak, genel hatlarıyla günlük düzeyde bir plan ("işe git, Klaus'la akşam yemeği ye"). Daha sonra saat düzeyinde planlar. Daha sonra eylem düzeyinde planlar. Planlar revize edilebilir: Bir gözlem bir planla çeliştiğinde, agent etkilenen segmenti yeniden planlar.

### Neden üçü de önemlidir (ablasyon)

Park ve ark. gözlem, düşünce ve planın her birini bırakarak ablasyonlar gerçekleştirdi. Her ablasyon inandırıcılığı zedeliyor:

- **gözlem** olmadan agent bağlamı gözden kaçırır ve eski inançlara göre hareket eder.
- **Düşünme** olmadan agent daha üst düzey inançlar oluşturamaz; etkileşimler sığ kalır.
- **plan** olmadan davranış reaktif gürültüye dönüşür; hedefler dağılır.

İnsan değerlendiricilerden alınan inanılırlık puanları her üçünde de en yüksektir; herhangi birini bırakmak ölçülebilir bir gerileme üretir.

### Sevgililer Günü'nün ortaya çıkışı

Bir agent, Isabella Rodriguez, "14 Şubat saat 17:00'de Hobbs Cafe'de bir Sevgililer Günü partisi düzenlemek istiyor" hedefiyle seribaşı oldu. Diğer 24 agent böyle bir tohum almıyor. Simüle edilmiş günler boyunca:

1. Isabella'nın planı insanları davet etmeyi de içeriyor.
2. Her davet, komşunun hafıza akışında bir gözlem haline gelir.
3. Komşunun yansıması şu inançları doğuruyor: "Isabella parti veriyor."
4. Komşunun planı "14 Şubat'taki partiye katılmayı" içeriyor.
5. Komşular diğer komşularına anlatır. Davet, merkezi koordinasyon olmadan yayılır.
6. 14 Şubat akşam 5'te birkaç agent Hobbs Cafe'de buluşuyor.

Bu, teknik anlamda ortaya çıkıştır: sistem düzeyindeki davranış (taraf), merkezi bir orkestratör olmaksızın yerel etkileşimlerden (ikili davetler + bireysel planlama) ortaya çıkmıştır.

### Belgelenen arıza modları

Park ve ark. açıkça belgeleyin:

- **Uzaysal norm hataları.** Agent'ler kapalı mağazalara giriyor. Agentaynı tek kişilik banyoyu kullanmaya çalışıyorlar. Agentyemek yeme amaçlı olmayan odalarda yemek yiyorlar. Model, sosyal-fiziksel normları yalnızca çevreden çıkarmıyor.
- **Bellek taşması.** Derin simülasyon çalışmaları bellek alma maliyetinin artmasına neden olur. Pratik çözüm: periyodik hafıza sıkıştırması (özetleme ve budama) ve düşük öneme sahip girişlerin azalması.
- **Yansıma halüsinasyonu.** Yansımalar, hafıza akışında mevcut olmayan ilişkileri icat edebilir. Azaltma: kaynak bellek kimliklerini yansıma prompt'lara dahil edin ve alma zamanında doğrulayın.

Bunlar üretimle ilgili arıza modlarıdır: herhangi bir 2026 agent simülasyonu bunları devralır.

### Üç bileşenli uygulama kuralları

1. **Bellek yalnızca ekleme amaçlıdır.** Asla bir bellek girişini değiştirmeyin. Düzeltmeler yeni girişlerdir.
2. **Önem puanları ucuzdur.** Yazma sırasında önemi 1-10 arasında derecelendirmek için LLM'yi arayın. Skoru önbelleğe alın.
3. **Geri alma filtrelenmez, sıralanır.** Birleşik puana göre en iyi; Sert filtreler kullanmayın (bağlamı kaybeder).
4. **Yansıma periyodik olarak çalışır.** İşlenmemiş anıların önem toplamı bir eşiği (e.g., 150) aştığında tetiklenir.
5. **Planlar revize edilebilir.** Yeni bir gözlem bir planla çeliştiğinde, planın tamamını değil yalnızca etkilenen bölümü yeniden oluşturun.

### Smallville'in ötesinde üretken agentler

2024-2026 takip literatürü mimariyi genişletiyor:

- **Politika / pazar araştırması için çoklu-agent sosyal simülasyon.** Smallville benzeri popülasyonlar, özelliklere yanıt olarak kullanıcı davranışını simüle eder. A/B testlerinden daha hızlı; doğruluğu tartışmalıdır.
- **Oyunlar için NPC AI.** Smallville agent'li RPG'ler, yazılı görevler yerine ortaya çıkan hikayeler üretir.
- **Üretken-agent değerlendirme benchmarks.** Metrik, görevin doğruluğundan ziyade, uzun vadede inandırıcılık + davranışın tutarlılığı haline gelir.

Mimari referanstır. Uzantılar bileşenleri değiştirir (bellek için vektör deposu, erişimle artırılmış yansıma, nörosembolik plan) ancak üç parçalı yapıyı korur.

### Çokluagent mühendisliği için bu neden önemlidir?

Smallville, bileşenler doğru olduğunda çoklu-agent ortaya çıkışının ucuz olduğunun kanıtıdır. Mimari artık açık kaynaklı modellerde kopyalandı (daha küçük LLM'ler inandırıcılığını keskin bir şekilde değil, zarif bir şekilde kaybediyor). **Ortaya çıkan sosyal davranışa** ihtiyaç duyan her üretim sistemi bu şekli kullanır. **Sıkı görev yürütmeye** ihtiyaç duyan herhangi bir sistem, bu aşamanın başlarındaki yönetici/rol/ilkel modellerini kullanır.

## Build It — Kendin Geliştir

`code/main.py` , stdlib Python'daki üç bileşeni komut dosyasıyla yazılmış agent politikalarıyla (gerçek LLM yok) uygular. Demo, Sevgililer Günü partisinin ortaya çıkışını minyatür olarak yeniden üretiyor:

- `MemoryStream` — yenilik/önem/alaka düzeyi alımıyla salt ekleme günlüğü.
- `reflect(stream)` — yakın zamandaki yüksek önem taşıyan anılar üzerine yazılmış düşünce.
- `plan(agent_state)` — mevcut inançlara dayalı olarak gün düzeyinde ve saat düzeyinde planlar.
- Senaryo: 5 agents. Agent 1 "akşam 5'te parti verme" ile başlıyor. Simüle edilmiş tıklamalar üzerinden davet yayılır ve agent'lar birleşir.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: tek tek izleme. Son onay işaretiyle, 5 agent'tan en az 3'ü planlarındaki partiyi gösterir ve parti konumunda birleşirler. Tek tohum, herhangi bir orkestratör olmadan koordineli bir varış sağladı.

## Use It — Hazır Araçla Uygula

`outputs/skill-simulation-designer.md` bir üretken-agent simülasyonu tasarlar: agent sayısı, bellek şeması, yansıma ritmi, plan ufku ve değerlendirme metriği.

## Ship It — Kullanıma Sun

Üretim simülasyonları için kurallar:

- **Bellek veritabanıdır.** Uygun ölçekte gerçek bir depo (vektör DB, Postgres) seçin. Bellek içi stdlib prototipler içindir.
- **Geri alma izini günlüğe kaydedin.** Her eylem için, onu yönlendiren en önemli anıları günlüğe kaydedin. Bu sizin hata ayıklama yeteneğinizdir.
- **agent tokens başına bütçe.** Her agent'ın alma + yansıtma + onay başına planı O(k) LLM çağrısıdır. N agents × T tik × tik başına çağrı bütçenizi gölgede bırakabilir.
- **Belleği periyodik olarak sıkıştırın.** Düşük öneme sahip girişleri özetleyin ve budayın. Saklama politikası bir ayrıntı değil, bir tasarım kararıdır.
- **Mekânsal/sosyal norm ihlallerini açıkça tespit edin**. Mimarlık bunları öğrenmiyor.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Partide 3'ten fazla agent'ın bir araya geldiğini doğrulayın. agent'lari 10'a artırın — ortaya çıkma hala devam ediyor mu?
2. Yansıma adımını kaldırın. Davranış neye benziyor? Park 2023'teki ablasyon bulgusunun haritası.
3. Rekabetçi bir başlangıç ​​hedefi belirleyin ("Klaus akşam 5'te bir araştırma konuşması yapmak istiyor"). agent'lar ayrılıyor mu, yoksa tek bir hedef mi baskın çıkıyor? Bunu ne belirliyor?
4. Uzamsal kısıtlamalar ekleyin: Hobbs Cafe en fazla 4 agents tutar. Simülasyon taşmayı sorunsuz bir şekilde ele alıyor mu, yoksa "tek kişilik banyo" arıza modeline mi uyuyor?
5. Park ve ark.'yı okuyun. (arXiv:2304.03442) Bölüm 6 (ortaya çıkan davranış deneyleri). Minyatürünüzde tekrarlanamayan bir davranışı belirleyin. Mimarinin hangi bileşenini geliştirmeniz gerekir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Bellek akışı | "agent'ın günlüğü" | Yalnızca gözlemlerin, eylemlerin, yansımaların ve planların ek günlüğü. |
| Yenilik | "Bellek ne kadar yeni" | Yaşa göre üstel bozunma puanı. |
| Önemi | "agent ne kadar önemsiyor" | Yazma sırasında 1-10 arasında derecelendirilmiştir. Önbelleğe alındı. |
| Uygunluk | "Geçerli sorguyla ne kadar alakalı" | Kosinüs benzerliği (embedding tabanlı). |
| Yansıma | "Üst düzey inanç" | Yakın zamandaki anılardan üretilen sentez, yeni bir anı olarak yeniden sindirilir. |
| Planı | "Gün/saat/eylem ayrıştırması" | Yukarıdan aşağıya plan ağacı. Gözlemler çeliştiğinde revize edilebilir. |
| Smallville | "Park 2023'ün sanal alanı" | 25-agent Sevgililer Günü'nün ortaya çıkmasını sağlayan simülasyon. |
| İnanılırlık | "Kalite ölçütü" | Davranışın makul bir agent gibi görünüp görünmediğine ilişkin insan değerlendirici puanı. |

## Daha Fazla Okuma

- [Park ve ark. — Üretken Agent'ler: İnsan Davranışının Etkileşimli Simülakrları](https://arxiv.org/abs/2304.03442) — referans mimarisi
- [UIST '23 makale sayfası](https://dl.acm.org/doi/10.1145/3586183.3606763) — yayın yeri
- [Smallville kod sürümü](https://github.com/joonspk-research/generative_agents) — Python uygulamasına referans
- [Hayes-Roth 1985 — Kontrol için Bir Kara Tahta Mimarisi](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — yapılandırılmış bellek agent'lar için önceki teknik
