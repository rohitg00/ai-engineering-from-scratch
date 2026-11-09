# Gözetmen / Orkestratör-İşçi Örneği

> Bir lider ajan planlar ve delegeler; uzman işçiler paralel bağlamlarda yürütür ve rapor verir. Bu, Anthropic'in Araştırma sisteminin arkasındaki bir örnektir (Claude Opus 4 öncülük olarak, Sonnet 4 subagent olarak), iç araştırma değerlendirmelerinde tek ajan Opus 4'e göre +90.2% olarak ölçülmüştür. Anthropic'in mühendislik yazısı, BrowseComp'deki farklılığın %80'inin sadece token kullanımı ile açıklandığını bildirir. Bu ders, ilklerden denetleme örneğini oluşturur ve 2026'da üretim dağıtımlarından mühendislik derslerini kapsar.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## Sorun

Araştırma tek ajan sistemlerinin başarısız olduğu prototip bir görevdir. "23-2026 yılları arasında çok ajan sistemlerinde ne değişmiştir?" diye sorarsanız, tek ajan beş makaleyi sıradan okuyor, bağlamının yarısını metinleriyle dolduruyor ve sonra hepsini birlikte düşünüyor. Beşinciye ulaştığında ilk makaleyi unutuyor. Paralelleşemez.

Gözetmen örneği bunu düzeltir: bir lider ajanı arama planlıyor, her alt soruyu bir işçiye delegeler ediyor ve sentezler. Her işçi dar bir soru için kendi 200k jeton penceresini alır. Önder asla çiğ kağıtları görmez  sadece işçi özetlerini.

Anthropic'in üretim Araştırma sistemi, iç araştırma değerlendirmelerinin %90.2'si ile tek bir Opus 4'ün karşılaştırıldığını bildirir. Aynı yayın, BrowseComp'in %80'inin sadece *token kullanımı* ile açıklandığını belirtir.

## Anlam

### - Şekil

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

Ögürlük asla hammaddeyi okumayı, işçiler birbirlerinin çalışmalarını, ögürün sentezlenmesi kadar görmez.

### Neden kazanıyor?

Üç mekanizma:

1. **Fresh context per subagent.**"FIPA-ACL mirası"nı keşfeden bir işçi, 40 bin tokeni taşımaz.
2. **Specialization via prompt.**Önderin emri "şehirlen ve sentezlen" değil, " araştır". Her çalışanın emri dar: "X'de ne değişmiş bul. "
3. **Parallelism.**İşçiler aynı anda çalışıyorlar.`max(worker_times) + plan + synthesis`- Hayır .`sum(worker_times)`- Evet .

### Mühendislik dersleri (Antropik 2025)

Anthropic yazısı, 2026 yılı için hâlâ geçerli olan birkaç üretim dersi listelerini listeler:

- **Scale effort to query complexity.**Basit sorular: bir ajan, 3-10 araç çağrısı. Karmaşık sorular: 10+ ajan.
- **Broad then narrow.**Önce geniş alt sorulara ayrılır, sonra cevap derinliği gerekirse, her alt soruya daha fazla işçi doğurur.
- **Rainbow deployments.**Agentler uzun süredir ve devletlidir. Geleneksel mavi-yeşil işe yaramaz. Antropik gökkuşağı kullanır: eski sürümler boşalırken yeni sürümlerin yavaş yavaş yayılması.
- **Token usage dominates.**Multi-agent, tek-agent tokenlerinin 15x'idir. Sadece görev değeri maliyeti haklı çıkarırsa çalıştırın.

### Grafik-devlik dönüş

LangGraph başlangıçta bir `langgraph-supervisor`Yüksek düzeyde bir kütüphane ile `create_supervisor`LangChain, 2025 yılında tavsiyede yardımcı olanlara yardımcı olmak için, yönetici modelini doğrudan araç çağrısı yoluyla uygulamaya yöneltti. Çünkü araç çağrısı, yönetici'nin gördüğü şey üzerinde daha fazla kontrol sağlar.

### Başarısız modları

- **Lead hallucinates the plan.**Eğer lider gerçek soruyu çözemeden alt sorular ortaya çıkarsa, işçiler yanlış hedefe doğru bir araştırma yaparlar.
- **Workers over-explore.**Açık bir kapsam sınırları olmadan, işçiler kendilerine verilen alt sorunun ötesine doğru ilerler ve sentez aşamasını kirletirler.
- **Synthesis conflicts.**İki işçi çelişkili gerçekleri iletir. Önder ya tekrar sormalıdır (bir yuvarlak ekle) veya anlaşmazlığı açıkça not etmelidir.

### Müdürün yanıldığında

- **Sequential tasks.**Eğer adım 2'nin adım 1'in çıkışına gerçekten ihtiyacı varsa paralellik hiçbir şey satın almaz.
- **Simple queries.**Tek ajan, işçilerin doğurulmasından önce liderin "skala çaba" kontrolünü kullanın.
- **Strict determinism.**Gözetmen, LLM tarafından seçilen bir delegasyon kullanır.

```figure
supervisor-hierarchy
```

## Yapın

`code/main.py`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             `threading`. Önder bir soruyu alt sorulara parçalayır, işçiler her alt soruya eş zamanlı olarak çalışır ve önder sentez eder. Gerçek LLM'ler yoktur  işçiler getirip toplamak simüle etmek için yazılmıştır.

Ana yapı:

- `Lead.plan(query)`Bir soruyu 3 alt soruya ayırır.
- `Worker.run(sub_q)`sahte bir özet gönderir (prodüksiyonda herhangi bir araç kullanan bir ajan olabilir).
- `Lead.run(query)`İşçilerin iplerini, bağlarını ve sentezlerini teker teker teker.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktılık planı, paralel işçi izlerini başlangıç/sonluk zaman damgaları ve son sentezi gösterir. Duvar saati kazanır: 0.3 saniyelik üç işçi 0.35 saniye içinde koştu, 0.9 değil.

## Kullan

`outputs/skill-supervisor-designer.md`Kullanıcı sorguyu alır ve bir denetim örneği tasarımı üretir: lider sistem sorgu, işçi rolleri, alt sorgu parçalanma kuralları ve sentez şablonu.

## Gönder

Gözetmenlik örneğini kullanmadan önce kontrol listesi:

- **Model pairing.**Dönüşüm düzeyi modeli üzerinde liderlik (Opus sınıfı, `o3`Daha hızlı ve daha ucuz bir model üzerinde çalışanlar (Sonet, `o4-mini`)
- **Worker timeout.**2x ortalama çalışma süresinden fazla çalışan herkes öldürülür; lider ya daha dar bir kapsamla yeniden doğar ya da olmadan devam eder.
- **Token cap per worker.**Zor bir sınır (sayın 10x beklenen sentez giriş) kaçak bir işçinin bütçeyi patlatmasını engeller.
- **Observability.**Önderin planını, her çalışanın araç çağrısını ve sentezi takip edin.
- **Rainbow rollout.**Devletlerin uzun süreli ajanları, sıcak değişim değil, yavaş yavaş bir sürüm geçişine ihtiyaç duyarlar.

## Egzersizler

1. Çık .`code/main.py`Bu demo'da, hangi işçi sayısında, atlama maliyeti paralel tasarruftan daha fazla mı?
2. İşçi zamanlaması uygulayın: 0.5 saniyeden uzun süre çalışan herhangi bir işçiyi öldürün ve kalan sonuçları sentezleştirin.
3. Önderin sentezine çatışma tespit adımını ekleyin: iki işçi çelişkili cevaplar verirse, önder bir tanesini seçmek yerine anlaşmazlığı not eder. LLM'yi çağırmadan çelişkiyi nasıl tespit edersiniz?
4. Anthropic'in Araştırma-Sistem Mühendisliği yazısını okuyun.
5. LangGraph'in karşılaştırması `create_supervisor`(Memleket) vs. yeni araç çağrısı önerisi. Bu size denetçinin gördüğü şeylerin üzerinde daha iyi bir kontrol sağlar. Neden Anthropic açıkça sadece alt cevapları ve ham işçi bağlamını senteze geçirir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | An orchestrator agent that plans, delegates, and synthesizes. Does not do the work itself. |
| Worker | "Subagent" | A focused agent invoked by the supervisor with narrow scope and its own context window. |
| Orchestrator-worker | "Supervisor pattern" | Same thing, different name. The 2026 literature uses both. |
| Fresh context | "Clean window" | A worker's context starts from its system prompt and assigned question, not the lead's history. |
| Rainbow deployment | "Gradual rollout" | Long-running stateful agents need versioned drain-and-replace, not blue-green. |
| Token dominance | "Context is the variable" | 80% of research-eval variance comes from total tokens used, not model choice, per Anthropic. |
| Scale effort | "Match agent count to complexity" | Lead estimates query difficulty, spawns 1 vs 10+ workers accordingly. |
| Synthesis conflict | "Workers disagree" | Two workers return contradictory facts; the lead must surface disagreement, not silently pick one. |

## Daha Fazla Okumak

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) denetim modelinin üretim referansı
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Araç çağıran denetçi artık önerilen form
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) 2026 üretiminde hala kullanılan miras yardımcı
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) Transfer tabanlı denetim varianti
