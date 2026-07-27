# Rol Tabanlı Agent Takımları — Roller, Görevler, Süreçler

> Dört temel öğe: Agent, Görev, Mürettebat, Süreç. İki üst düzey şekil: Ekipler (otonom, rol tabanlı işbirliği) ve Akışlar (olay odaklı, deterministik). CrewAI, 2026 referans uygulamasıdır ve belgeleri nettir: "üretime hazır herhangi bir uygulama için bir Akışla başlayın."

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 12 (İş Akışı Modelleri), Aşama 14 · 14 (Aktör Modeli)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- CrewAI'nin dört temel öğesini (Agent, Görev, Mürettebat, Süreç) ve her birinin sahip olduğu şeyleri adlandırın.
- Sıralı, Hiyerarşik ve planlı Konsensüs sürecini ayırt edin; iş yükü başına bir tane seçin.
- Ekipleri (otonom rol tabanlı) Akışlardan (olay odaklı deterministik) ayırın ve belgelerin üretim önerilerini açıklayın.
- `@tool` dekoratör ve `BaseTool` alt sınıfına sahip tel araçları; Yapılandırılmış çıktılar ve serbest metin arasındaki neden.
- Dört CrewAI bellek türünü adlandırın ve her birinin ne zaman işe yaradığını belirtin.
- Özet üreten bir stdlib üç agent ekibi (araştırmacı, yazar, editör) uygulayın.
- Üç CrewAI arıza modunu tespit edin: prompt-bloat, yönetici-LLM vergisi, kırılgan devir.

## Sorun

Çoklu agent framework'leri benimseyen takımlar aynı duvara çarptı. Bir demoda "Otonom işbirliği" kulağa harika geliyor. Daha sonra bir müşteri bir hata bildirir ve sizin de deterministik tekrara ihtiyacınız olur. Veya finans, LLM tarafından yönlendirilen bir ekibin çalışma başına maliyetinin ne kadar olduğunu soruyor. Veya çağrı sırasında hangi agent'nin sabah 3'te durduğunu bilmesi gerekiyor.

Serbest biçimli LLM tarafından yönlendirilen ekipler bunların hiçbirine net bir şekilde yanıt vermiyor. Saf DAG'ler hepsine cevap verir ancak agent beyin fırtınasının ihtiyaç duyduğu keşif şeklini kaybeder.

CrewAI'nin bölünmesi ticaret konusunda dürüst. İşbirliğine dayalı, rol bazlı, keşifsel çalışmalara yönelik ekipler. Olay odaklı, koda ait, denetlenebilir üretime yönelik akışlar. Aynı framework, iki şekil, yüzey başına seçim.

## Konsept

### Dört ilkel

CrewAI'nin yüzeyi küçük. Bunu ezberleyin, gerisi yapılandırmadır.

- **Agent.** `role + goal + backstory + tools + (optional) llm`. Arka hikaye yük taşıyor. agent durduğunda tonu ve muhakemeyi şekillendirir. Araçlar, agent'nin çağırabileceği işlevlerdir (daha fazlası aşağıda).
- **Görev.** `description + expected_output + agent + (optional) context + (optional) output_pydantic`. Yeniden kullanılabilen iş birimi. `expected_output` sözleşmedir. `context`, çıktıları aktarılan yukarı akış görevlerini listeler. `output_pydantic`, yapılandırılmış bir şekli zorlar.
- **Mürettebat.** Konteyner. `agents` listesine, `tasks`, `process` listesine ve isteğe bağlı `memory` + `verbose` + `manager_llm` ayarlarına sahiptir.
- **Süreç.** Yürütme stratejisi. Sıralı, Hiyerarşik, Konsensüs (planlı). Koşunun şeklini seçer.

Agent'ler birbirlerini doğrudan görmezler. Görevler agent'lere referans verir. Mürettebat görevleri sıralar. Süreç bir sonraki görevi kimin seçeceğine karar verir. Bütün zihinsel model budur.

> **CrewAI 0,86 (2026-05) ile doğrulanmıştır**. Daha yeni sürümler süreç türlerini yeniden adlandırabilir veya birleştirebilir; Belirli bir şekle güvenmeden önce [CrewAI Süreç belgelerini](https://docs.crewai.com/concepts/processes) kontrol edin.

### Sıralı vs Hiyerarşik vs Konsensüs

- **Sıralı.** Görevler bildirim sırasına göre yürütülür. N görevinin çıktısı, N+1 görevine `context` olarak mevcuttur. En düşük maliyet. En öngörülebilir. Sipariş sabitlendiğinde kullanın.
- **Hiyerarşik.** Bir yönetici Agent (ayrı LLM çağrısı) uzmanlar arasında yönlendirme yapar. CrewAI, yöneticiyi `manager_llm` yapılandırmanızdan veya varsayılan bir ayardan oluşturur. Yönetici her turda bir sonraki görevi seçer ve reddedebilir veya yeniden yönlendirebilir. Dört veya daha fazla uzmanınız olduğunda ve siparişin gerçekten önceki çıktıya bağlı olduğu durumlarda kullanın.
- **Uzlaşı.** Planlanmıştır, şu anda genel API'de uygulanmamaktadır. Dokümanlar bu adı gelecekteki oylamaya dayalı bir süreç için saklıyor. Bugün ona güvenmeyin.

Hiyerarşik, her uzman görüşmesinin üstüne her turda bir LLM çağrısı (yönetici) ekler. Token'nin maliyeti beş adımlı bir çalışmada üç katına çıkabilir. Yalnızca yönlendirmeye ihtiyacınız olduğunda bunun için ödeme yapın.

### Ekipler ve Akışlar

Bu, dokümanların 2026'da öncülük ettiği çerçevedir.

- **Mürettebat** Yüksek Lisans odaklı özerklik. framework şekli çalışma zamanında seçer. Şunun için iyi: araştırma, beyin fırtınası, ilk taslaklar, yolun cevabın parçası olduğu her yer. Tekrar oynatmak zor. Test edilmesi zor. Prototiplemesi ucuz.
- **Akış.** Sahip olduğunuz olay odaklı grafik. `@start` girişi işaretler. `@listen(topic)`, başka bir adım bu konuyu yayınladığında tetiklenen bir adımı işaretler. Her adım sade Python'dur (bir Mürettebatı dahili olarak çağırabilir). Şunun için iyi: üretim. Gözlemlenebilir. Test edilebilir. Deterministik.

Dokümanların 2026 üretim önerisi: Bir Akışla başlayın. Özerkliğin bedelini ödediğinde `Crew.kickoff()` Akış adımlarının içinden çağrı yaparken Ekipleri katlayın. Akış size denetim izini verir, Mürettebat ise keşif sağlar. Oluşturun, seçmeyin.

### Araç entegrasyonu

Agent'ye bir araç vermenin üç yolu. Uygun olan en basit olanı seçin.

1. **`@tool` dekoratör.** Saf işlevler araç haline gelir. İmza şemadır; docstring, LLM'nin gördüğü açıklamadır. Tek seferlik yardımcılar için en iyisi.

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` alt sınıfı.** Açık argüman şeması, eşzamansız destek ve yeniden denemeler içeren sınıf tabanlı araç. Aracın bir durumu (bir istemci, bir önbellek) olduğunda veya yapılandırılmış argümanlara ihtiyaç duyduğunda kullanın.

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **Yerleşik araç setleri.** CrewAI birinci taraf adaptörleri gönderir: `SerperDevTool`, `FileReadTool`, `DirectoryReadTool`, `CodeInterpreterTool`, `RagTool`, `WebsiteSearchTool`. Tek bir içe aktarma ile kablolu.

Yapılandırılmış çıktılar Pydantic'i kullanır. Görevde `output_pydantic=MyModel`'yi iletin. CrewAI, LLM yanıtını modele göre doğrular ve ya zorlar ya da yeniden dener. Bunu sıkı bir `expected_output` dizesiyle eşleştirin. Serbest metin çıktıları taslaklar için uygundur; Yapılandırılmış çıktılar, aşağı akış Akışlarının tüketebileceği şeylerdir.

### Bellek kancaları

CrewAI, kutudan dört bellek türü çıkarıyor. Şunları oluştururlar: Bir Mürettebat dördünü aynı anda etkinleştirebilir.

> **CrewAI 0,86 (2026-05) ile doğrulanmıştır**. Son sürümler, her şeyi bu dört mağazayı kapsayan birleşik bir `Memory` sistemi aracılığıyla yönlendiriyor. Aşağıdaki kavramsal model hala geçerlidir, ancak ortak sınıf yüzeyi daha yeni sürümlerde tek bir `Memory` giriş noktasına daraltılabilir; geçerli API için [CrewAI bellek belgelerini](https://docs.crewai.com/concepts/memory) kontrol edin.

- **Kısa süreli.** Tek bir çalıştırmada konuşma arabelleği. Sonunda silindi.
- **Uzun vadeli.** Çalışmalar boyunca devam etti. Bir vektör DB'sinde saklanır (varsayılan olarak Chroma, değiştirilebilir). Geçerli göreve benzerlik yoluyla alındı.
- **Varlık.** Varlık bazında gerçekler. "Müşteri X kurumsal plan kapsamındadır." Benzerliğe göre değil, varlığa göre anahtarlanmıştır. Koşularda hayatta kalır.
- **Bağlamsal.** Montaj zamanı erişimi. İlgili belleği Agent'nin ihtiyaç duyduğu anda çeker, önceden yüklenmemiş.

`memory=True` veya türe göre yapılandırma ile Mürettebatta etkinleştirin. Yapılandırdığınız bir embedding sağlayıcısı tarafından desteklenir (varsayılan olarak OpenAI'dir, yerel olarak değiştirilebilir). Bellek, CrewAI'nin daha ince framework'lere karşı gücünü kazandığı yerlerden biri; saf LangGraph bunların her birini kendiniz bağlamanızı gerektirir.

### Rol bazlı ekipler uygun olduğunda

- Adlandırılmış rollere ve işbirliğine dayalı bir iş akışına sahip üç ila altı agent. Taslak hazırlama, gözden geçirme, planlama, beyin fırtınası.
- LLM'nin bir sonraki adıma ilişkin kararının değerin bir parçası olduğu yönlendirme (Hiyerarşik).
- Herhangi bir yerde ekip, bir grafik tanımını okumaktansa `role + goal + backstory`'yi okumaktan daha mutludur.

### Yapmadıklarında

- Kesin sıralamaya sahip deterministik DAG'ler. LangGraph'ı kullanın (Ders 13). Grafik şekli doğru soyutlamadır; CrewAI'nin rol çerçevesi sürtünmedir.
- İkinci saniyenin altındaki gecikme bütçeleri. Hiyerarşik gidiş-dönüş ekler. Sıralı bile geçmiş hikayeleri ve önceki çıktıları içeren prompt'leri serileştirir.
- Tek agent loop'ler. framework'yi atlayın; agent loop (Ders 1) artı bir araç kaydı daha kısadır.

Ders 17 (Agent Framework Dengeler) bunu bir matriste ortaya koyuyor. Kısa versiyon: CrewAI "işbirlikçi rol tabanlı" köşede yer alıyor.

### Bağımlılık şekli

LangChain'den bağımsız. Python 3.10'dan 3.13'e. `uv`'yi kullanır. Yıldız sayısı: bkz. [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) (2026-05 anlık görüntüsü). AWS Bedrock entegrasyonu belgelenmiştir; satıcı benchmark'ler, QA iş yüklerinde LangGraph'a kıyasla önemli bir hızlanma bildiriyor, ancak metodoloji (dataset, donanım, değerlendirme ölçütü) yayınlanmadı; bu nedenle framework satıcı numaralarını yalnızca yönlendirici olarak değerlendirin.

### Bu modelin yanlış gittiği yer

- **Prompt-arka hikayelerden şişkinlik.** agent başına 2000 kelimelik bir arka hikaye ve beş agent ekibi, ilk araç çağrısından önce bağlam bütçesini yakar. Geçmiş hikayeleri 200 kelimenin altında tutun. agent'lerde ifadeleri yeniden kullanın; ev stilini beş kez tekrarlamayın.
- **Yönetici-LLM token vergisi.** Hiyerarşik süreç, her uzman çağrısından önce bir yönetici LLM çağrısı ekler. Beş yerine altı LLM çağrısı olan beş görevli bir ekipte yönetici çağrısı, tüm görev listesini ve önceki çıktıları taşır. Yönlendirme çıkışa bağlı olmadığı sürece Sıralıya geçin.
- **Kırılgan aktarımlar.** Görev N'nin `expected_output`'si "bir taslaktır". Görev N+1 bunu `context` olarak okur ve üç bölümü ayrıştırmaya çalışır. Yüksek Lisans dört tane üretti. Aşağı akış Agent doğaçlama kitaplıkları. Görev N'de `output_pydantic` ile Görev N+1'in serbest metni değil, yazılan bir nesneyi okumasını sağlayın.
- **Ürün olarak ekip.** Serbest biçimli Ekip, Flow ambalajı olmadan üretime gönderildi. Çıkış değişkenliği yüksektir; tekrar oynatmak imkansızdır; çağrı üzerine kötü bir koşuyu iyi bir koşudan ayıramaz. Bir Akışla Sarın.

## İnşa Et

`code/main.py`, her iki şeklin stdlib versiyonlarını ve ayrıca üç agent ekibini uygular.

Şekil:

- CrewAI'nin yüzeyiyle eşleşen `Agent`, `Task` veri sınıfları.
- `SequentialCrew.kickoff(inputs)`, çıktıları `context` olarak işleyerek görevleri bildirim sırasına göre çalıştırır.
- `HierarchicalCrew.kickoff(topic)`, her turda bir sonraki uzmanı seçen Agent bir yönetici ekler ve "bitti" konumunda durur.
- `@start` ve `@listen(topic)` dekoratörlere sahip `Flow`, küçük bir olay döngüsü ve bir iz.
- CrewAI'nin `@tool` şeklini yansıtan `tool(name)` dekoratörü.
- `short_term`, `long_term`, `entity` mağazalarıyla `Memory`; alay edilen benzerlik numpy'yi kullanır.
- Sahte LLM yanıtları, rol artı giriş öneki ile anahtarlanmış sabit kodlu dizelerdir. Ağ yok. Deterministik.

Somut demo: "agent mühendislik 2026" hakkında kısa bir özet hazırlayan araştırmacı, yazar ve editör ekibi. Araştırmacı kaynakları çeker (alay eder). Yazar taslakları. Editör sıkıyor. Aynı ekip deterministik şekli göstermek için bir Akıştan geçiyor.

Çalıştır:

```bash
python3 code/main.py
```

İzleme şunları kapsar: `context` üzerinden sıralı ekip akışı, yönetici seçimleriyle hiyerarşik ekip (araştırmacı, yazar, editör, ardından "bitti"), açık konularla aynı üç adımı çalıştıran akış (`researched`, `drafted`, `edited`), `@tool` aracılığıyla yönlendirilen araç çağrıları ve iki başlama sırasında hayatta kalan uzun süreli hafıza.

Mürettebat izi akıcıdır; yönetici prensipte yeniden sipariş verebilir. Akış izi sabittir. Bu seçim derstir.

## Kullan onu

- Üretim için **Mürettebat Akışı**. Akış `Crew.kickoff()`'yi çağıran bir adım olsa bile. Akış denetim sınırını verir.
- **CrewAI Ekibi (Sıralı)**, özellikle ilk taslaklar ve inceleme döngüleri olmak üzere işbirlikçi çalışmaların net bir şekilde düzenlenmesi için.
- **CrewAI Ekibi (Hiyerarşik)** yönlendirme çıktıya bağlı olduğunda ve dört veya daha fazla uzmanınız olduğunda.
- Açık durum makineleri için **LangGraph** (Ders 13), dayanıklı özgeçmiş, katı sıralama.
- Aktör-model eşzamanlılığı ve hata izolasyonu için **AutoGen v0.4** (Ders 14).
- Aktarma ve korkuluklara sahip OpenAI ilk ürünleri için **OpenAI Agent SDK'sı** (Ders 16).
- **Claude Agent SDK** (Ders 17), altagent'lere ve oturum deposuna sahip Claude-first ürünleri için.

## Gönderin

`outputs/skill-crew-or-flow.md`, bir görev için Mürettebat ve Akış'ı seçiyor ve minimum uygulamayı destekliyor. Arka planı olmayan Mürettebat, açık konuların olmadığı Akış, üçten az uzmanın yer aldığı Hiyerarşik konularda sert reddedilmeler.

## Tuzaklar

- **Lezzet olarak arka plan.** Çıktıları şekillendirir. agent başına üç değişkeni test edin; fark gerçektir. Birini seç, dondur.
- **`expected_output` atlanıyor.** Görev başına sözleşme olmadığında, alt görevler LLM'nin ürettiği her şeyi alır. Mürettebat koşuyor; denetim başarısız olur.
- **Bellek her zaman açık.** Her çalıştırmada uzun vadeli yazar. Vektör DB büyüyor. Alma işlemi gürültülü oluyor. Scope, gerçeğin kalıcı olduğu görevlere yazar.
- **Yönetici prompt drift.** Hiyerarşik'in yöneticisi prompt örtülüdür. Yönlendirme tuhaflaşırsa ayrıntılı moda bırakın ve okuyun.
- **Mürettebattaki araç yan etkileri.** Bir Mürettebat, bir aracı beklenenden daha fazla kez çağırabilir. POST, DELETE, ödeme bir Akış adımına aittir, asla bir Mürettebat aracına ait değildir.

## Egzersizler

1. Sıralı ekibi bir Akışa dönüştürün. Değişkenliğin azaldığı temas noktalarını sayın. Okunabilirliğin nerede düştüğünü not edin.
2. Mürettebata varlık hafızası ekleyin: Bir müşteri hakkındaki gerçekler, başlama vuruşları boyunca devam eder. Alma işleminin doğru varlığı çektiğini doğrulayın.
3. Yöneticinin, yazarın çıktısı en az üç paragraftan oluşana kadar editöre yönlendirmeyi reddettiği Hiyerarşik bir süreç uygulayın. Yeniden denemeyi takip edin.
4. (Sahte) bir web araması için `BaseTool` alt sınıfını bağlayın. İz şeklini `@tool` dekoratör versiyonuyla karşılaştırın.
5. `Brief`'nin `title`, `summary`, `sections`'ye sahip olduğu düzenleyici görevine `output_pydantic=Brief`'yi ekleyin. Yazar görevi çıktısının bir kez hatalı biçimlendirilmiş JSON olmasını sağlayın; İzlemede CrewAI'nin yeniden deneme davranışını doğrulayın.
6. CrewAI'nin doküman girişini okuyun. Oyuncağı gerçek `crewai` API'sine taşıyın. Stdlib sürümü hangi garantileri atladı?
7. AgentOps veya Langfuse'u (Ders 24) gerçek bir çalıştırmaya bağlayın. Stdlib sürümünde hangi izleri kaçırdınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent | "Kişilik" | Rol + hedef + arka plan + araçlar |
| Görev | "İş birimi" | Açıklama + beklenen çıktı + atanan + isteğe bağlı yapılandırılmış çıktı |
| Mürettebat | "Agent ekibi" | Agent'ler için Kapsayıcı + Görevler + Süreç |
| Süreç | "Yürütme stratejisi" | Sıralı / Hiyerarşik / Konsensüs (planlanmış) |
| Akış | "Deterministik iş akışı" | Olay odaklı, koda ait, test edilebilir |
| Arka Plan | "Kişi prompt" | Agent için ton ve karar şekillendirici |
| `@tool` | "İşlev aracı" | Bir işlevi Agent'nin çağırabileceği bir araca dönüştüren dekoratör |
| `BaseTool` | "Sınıf aracı" | Args şeması, yeniden denemeler, zaman uyumsuz destek içeren sınıf tabanlı araç |
| Varlık belleği | "Varlık bazında gerçekler" | Bellek kapsamı bir müşteri/hesap/sorun kapsamına alındı ​​|
| Uzun süreli hafıza | "Çapraz çalıştırma belleği" | Başlangıçlar arasında hayatta kalan vektör destekli bellek |
| Bağlamsal bellek | "Tam zamanında erişim" | Agent'nin ihtiyaç duyduğu anda çekilen bellek |
| Yönetici Yüksek Lisans | "Yönlendirici agent" | Bir sonraki görevi seçen Hiyerarşik süreçte Ekstra LLM |
| `expected_output` | "Görev sözleşmesi" | Agent'ye (ve denetime) hangi şeklin döndürüleceğini söyleyen dize |

## Daha Fazla Okuma

- [CrewAI belgelerine giriş](https://docs.crewai.com/en/introduction): kavramlar ve önerilen üretim yolu
- [CrewAI Akış kılavuzu](https://docs.crewai.com/en/concepts/flows): olay odaklı şekil, `@start`, `@listen`
- [CrewAI araçları referansı](https://docs.crewai.com/en/concepts/tools): `@tool`, `BaseTool`, yerleşik araç setleri
- [CrewAI belleği](https://docs.crewai.com/en/concepts/memory): kısa vadeli, uzun vadeli, varlık, bağlamsal
- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents): çoklu agent yardımcı olduğunda ve olmadığında
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview): durum makinesi alternatifi
