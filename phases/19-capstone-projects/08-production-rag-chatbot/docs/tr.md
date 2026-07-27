# Capstone 08 — Düzenlenmiş Dikey Sektör için Üretim RAG Chatbot'u

> Harvey, Glean, Mendable ve LlamaCloud, 2026'da aynı üretim biçimini çalıştırıyor. Görseller için docling veya Unstructured ve ColPali ile içerik alın. Hibrit arama. bge-reranker-v2-gemma ile yeniden sıralama yapın. %60-80 isabet oranında prompt önbelleğe almayı kullanarak Claude Sonnet 4.7 ile sentezleyin. Llama Guard 4 ve NeMo Korkuluklarıyla koruyun. Langfuse ve Phoenix ile izleyin. 200 soruluk altın sette RAGAS ile not verin. Düzenlenmiş bir alanda (hukuk, klinik, sigorta) bir tane oluşturduğunuzda, son nokta altın seti, kırmızı takımı ve drift kontrol panelini geçiyor.

**Tür:** Kapak taşı
**Diller:** Python (boru hattı + API), TypeScript (sohbet kullanıcı arayüzü)
**Önkoşullar:** Aşama 5 (NLP), Aşama 7 (transformers), Aşama 11 (LLM mühendisliği), Aşama 12 (multimodal), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P5 · P7 · P11 · P12 · P17 · P18
**Süre:** 30 saat

## Sorun

Düzenlemeye tabi alan RAG (yasal sözleşmeler, klinik deneme protokolleri, sigorta poliçeleri), yatırım getirisinin açık ve risklerin somut olması nedeniyle 2026'nın en çok sevk edilen üretim şeklidir. Harvey (Allen & Overy) bunu yasal olarak inşa etti. Mendable, geliştirici-dokümanlar lezzetini sunar. Glean kurumsal aramayı kapsar. Model şu şekildedir: Yüksek kaliteli içeriği alın, yeniden sıralamayla hibriti alın, alıntı uygulaması ve prompt önbelleğe alma ile sentezleyin, birden fazla güvenlik katmanıyla koruyun ve sapmayı sürekli izleyin.

Sert kısımlar model değildir. Bunlar, yargı yetkisine duyarlı uyumluluk (HIPAA, GDPR, SOC2), alıntı düzeyinde denetlenebilirlik, maliyet kontrolü (prompt önbelleğe alma, isabet oranı yüksek olduğunda %60-90 indirim satın alır), RAGAS sadakati aracılığıyla halüsinasyon tespiti ve kaynak belgeler dizine yetişmeden güncellendiğinde sapma tespitidir. Bu kapak taşı sizden hepsini, yanında kırmızı takım süitiyle birlikte 200 soruluk altın bir set halinde göndermenizi istiyor.

## Konsept

Boru hattının iki tarafı var. **Besleme**: belgeleme veya Yapılandırılmamış, yapılandırılmış belgeleri ayrıştırır; ColPali görsel olarak zengin olanları ele alıyor; parçalar özetleri, etiketleri ve rol tabanlı erişim etiketlerini alır. Vektörler pgvector + pgvectorscale'e (50M vektörlerin altında) veya Qdrant Cloud'a gider; seyrek BM25 yanında koşuyor. **Konuşma**: LangGraph hafızayı ve çoklu dönüşü yönetir; her sorgu hibrit alımı çalıştırır, bge-reranker-v2-gemma-2b ile yeniden sıralama yapar, Claude Sonnet 4.7 (prompt-cached) ile sentezler, çıktıyı Llama Guard 4 ve NeMo Guardrails üzerinden geçirir ve alıntı bağlantılı bir yanıt gönderir.

Değerlendirme yığınının dört katmanı vardır. Doğruluk için **Altın set** (alıntılarla birlikte 200 etiketli Soru-Cevap). Güvenlik için **Kırmızı takım** (jailbreak'ler, PII çıkarma girişimleri, alan dışı sorular). **RAGAS** sadakat / yanıt alaka düzeyi / bağlam hassasiyeti için tur başına otomatik olarak. **Drift kontrol paneli** (Arize Phoenix) haftalık olarak geri alma kalitesini ve halüsinasyon skorunu izliyor.

Prompt önbelleğe alma maliyet unsurudur. Claude 4.5+ ve GPT-5+, önbelleğe alma sistemi prompt'lari + alınan bağlamı destekler. %60-80 isabet oranında sorgu başına maliyet 3-5 kat düşer. Yüksek önbellek isabet oranlarına ulaşmak için ardışık düzenin kararlı önekler (sistem prompt + yeniden sıralanan bağlam ilk) için tasarlanması gerekir.

## Mimarlık

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## Yığın

- Besleme: Unstructured.io veya yapılandırılmış belgeler için belgeleme; Görsel açıdan zengin PDF'ler için ColPali
- Vektör DB: 50M vektörlerin altında pgvector + pgvectorscale; Aksi halde Qdrant Bulutu
- Seyrek: Alan ağırlıklarıyla birlikte Tantivy BM25
- Düzenleme: LlamaIndex İş Akışları (besleme) + LangGraph (konuşma)
- Yeniden sıralama: bge-reranker-v2-gemma-2b kendi kendine barındırılan veya Voyage rerank-2 barındırılan
- Yüksek Lisans: prompt önbelleğe alma ile Claude Sonnet 4.7; yedek Llama 3.3 70B kendi kendine barındırılan
- Eval: RAGAS 0.2 çevrimiçi, halüsinasyon ve jailbreak süitleri için DeepEval
- Observability: Langfuse, açıklama kuyruğuyla birlikte kendi kendine barındırılır; Drift için Arize Phoenix
- Guardrails: Llama Guard 4 giriş/çıkış sınıflandırıcısı, NeMo Guardrails v0.12 politikası, Presidio PII temizleme
- Uyumluluk: parçalar üzerindeki rol tabanlı erişim etiketleri; GDPR/HIPAA için yetki alanı etiketleri

```figure
canary-rollout
```

## Build It — Kendin Geliştir

1. **Besleme.** Derlemenizi (ciddi bir derleme için 1000-10000 belge) Yapılandırılmamış veya belgeleme ile ayrıştırın. Taranmış/görsel ağırlıklı sayfalar için ColPali'yi kullanın. Özetler, rol etiketleri, yetki etiketleri içeren parçalar oluşturun.

2. **Dizin.** pgvector + pgvectorscale'e yoğun embedding'lar (Voyage-3 veya Nomic-embed-v2). Tantivy aracılığıyla BM25 yan indeksi. Yük olarak rol ve yetki alanı filtreleri.

3. **Karma geri alma.** Önce rol+yetki alanına göre filtreleyin; daha sonra paralel yoğun + BM25; karşılıklı derece füzyonu ile birleştirme; yeniden sıralanacak ilk 20; synth'te ilk 5'te.

4. **prompt önbelleğe alma ile sentezleyin.** Sistem prompt + önbellek başlığındaki statik politikalar; bağlam önbellek uzantısı olarak yeniden sıralandı; önbelleğe alınmamış sonek olarak kullanıcı sorusu. Sabit durumda %60-80 önbellek isabet oranını hedefleyin.

5. **Korkuluklar.** Girişte Llama Guard 4; NeMo Guardrails rayları, alan dışı soruları veya politika tarafından yasaklanmış konuları engeller; Presidio, çıktıdaki yanlışlıkla PII'yi temizliyor; alıntı yaptırımı sonrası filtre.

6. **Altın set.** Bir alan uzmanı tarafından (cevap, alıntılar) ile etiketlenmiş 200 Soru/Cevap çifti. Tam alıntı eşleşmesi, yanıt doğruluğu ve aslına uygunluk (RAGAS) üzerinden agent puan alın.

7. **Kırmızı takım.** 50 düşmanca prompt: jailbreak (PAIR, TAP), PII sızma girişimleri, alan dışı, yetki alanları arası sızıntı. Başarılı/başarısız ve önem derecesine göre puanlayın.

8. **Drift kontrol paneli.** Arize Phoenix, haftalık olarak alma kalitesini (nDCG, alıntı doğruluğu) izler. Yüzde 5'lik düşüş uyarısı

9. **Maliyet raporu.** Langfuse: prompt-önbelleğe alma isabet oranı, sorgu başına tokens, aşamaya göre $/sorgu dökümü.

## Use It — Hazır Araçla Uygula

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Ship It — Kullanıma Sun

`outputs/skill-production-rag.md` teslimatı açıklar. Uyumluluk etiketleriyle konuşlandırılan, değerlendirme tablosundan geçirilen ve canlı sapma izlemeyle gözlemlenen, düzenlenmiş alan adındaki bir sohbet robotu.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | RAGAS sadakati + cevap alaka düzeyi | Altın sette çevrimiçi skorlar (200 Soru/Cevap) |
| 20 | Alıntı doğruluğu | Doğrulanabilir kaynak bağlantılarına sahip yanıtların oranı |
| 20 | Korkuluk kapsamı | Llama Guard 4 geçiş oranı + jailbreak paketi sonuçları |
| 20 | Maliyet / gecikme mühendisliği | Prompt-önbellek isabet oranı, p95 gecikmesi, $/query |
| 15 | Drift izleme paneli | Haftalık erişim kalitesi trendine sahip Phoenix canlı kontrol paneli |
| **100** | | |

## Egzersizler

1. Farklı bir yetki alanı altında ikinci bir derlem dilimi oluşturun (e.g., GDPR'nin yanı sıra HIPAA). 20 soruluk yetki alanları arası araştırmada çapraz sızıntıyı önleyen rol+yetki alanı filtrelemesini gösterin.

2. Bir haftalık üretim trafiği boyunca prompt-önbellek isabet oranını ölçün. Hangi sorguların önbellek önekini bozduğunu belirleyin. Yeniden yapılanma.

3. 10k-token özet arabelleğiyle çok dönüşlü bellek ekleyin. Konuşma büyüdükçe sadakatin düşüp düşmediğini ölçün.

4. Claude Sonnet 4.7'yi, kendi kendine barındırılan Llama 3.3 70B ile değiştirin. $/query ve sadakat deltasını ölçün.

5. Bir "emin değilim" modu ekleyin: eğer yeniden sıralanan puanlar bir eşiğin altındaysa, agent yanıt vermek yerine "Güvenli alıntılarım yok" der. Yanlış güvenin azaltılmasını ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Prompt önbelleğe alma | "Önbelleğe alınmış sistem + içerik" | Claude/OpenAI özelliği: önbelleğe alınmış önek token'lar isabet durumunda %60-90 indirimli |
| RAGAS | "RAG değerlendiricisi" | Doğruluk, cevap alaka düzeyi ve bağlam hassasiyetinin otomatik olarak puanlanması |
| Altın set | "Eval olarak etiketlendi" | Alıntılarla birlikte 200'den fazla uzman etiketli Soru-Cevap; temel gerçek |
| Yargı etiketi | "Uyumluluk etiketi" | Parçalara eklenen GDPR/HIPAA/SOC2 kapsamı; alma filtresi tarafından zorunlu kılınır |
| Alıntı sadakati | "Temelli yanıt oranı" | Geri alınabilir kaynak aralıklarıyla desteklenen taleplerin oranı |
| Sürüklenme | "Geri alma kalitesinde bozulma" | nDCG veya alıntı puanındaki haftalık değişiklik; uyarı eşiği %5 |
| Kırmızı takım | "Çekişmeli değerlendirme" | Sürüm öncesi jailbreak, PII çıkarma, alan dışı araştırmalar |

## Daha Fazla Okuma

- [Harvey AI](https://www.harvey.ai) — yasal üretim yığınına referans
- [Glean kurumsal arama](https://www.glean.com) — kurumsal ölçekte RAG'ye referans
- [Düzeltilebilir belgeler](https://mendable.ai) — geliştirici belgeleri RAG referansı
- [LlamaCloud Ayrıştırma + Dizin](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) — yönetilen besleme
- [Antropik prompt önbelleğe alma](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — maliyet düzeyi referansı
- [RAGAS 0.2 belgeleri](https://docs.ragas.io/) — standart RAG değerlendirmesi framework
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — referans kayması observability
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — 2026 güvenlik sınıflandırıcısı
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — politika rayı framework
