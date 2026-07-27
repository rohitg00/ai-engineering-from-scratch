# Rol Tabanlı Agent Ekip — Roller, Görevler, Süreçler

> Dört temel öğe: Agent, Görev, Mürettebat, Süreç. İki üst düzey şekil: Ekipler (otonom, rol tabanlı işbirliği) ve Akışlar (olay odaklı, deterministik). CrewAI, 2026 referans uygulamasıdır ve belgeleri nettir: "üretime hazır herhangi bir uygulama için bir Akışla başlayın."

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 12 (İş Akışı Modelleri), Aşama 14 · 14 (Aktör Modeli)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- CrewAI'nin dört temel öğesini (Agent, Görev, Mürettebat, Süreç) ve her birinin sahip olduğu şeyleri adlandırın.
- Sıralı, Hiyerarşik ve planlı Konsensüs sürecini ayırt edin; iş yükü başına bir tane seçin.
- Ekipleri (otonom rol tabanlı) Akışlardan (olay odaklı deterministik) ayırın ve belgelerin üretim önerilerini açıklayın.
- `@tool` dekoratörü ve `BaseTool` alt sınıfına sahip tel araçları; Yapılandırılmış çıktılar ve serbest metin arasındaki neden.
- Dört CrewAI bellek türünü adlandırın ve her birinin ne zaman işe yaradığını belirtin.
- Brifing hazırlayacak üçagent kişilik bir stdlib ekibi (araştırmacı, yazar, editör) uygulayın.
- Üç CrewAI başarısızlık modunu tespit edin: prompt-bloat, yönetici-LLM vergisi, kırılgan devir.

## Sorun

Çoklu-agent framework'leri benimseyen takımlar aynı duvara çarptı. Bir demoda "Otonom işbirliği" kulağa harika geliyor. Daha sonra bir müşteri bir hata bildirir ve sizin de deterministik tekrara ihtiyacınız olur. Veya finans, LLM tarafından yönlendirilen bir ekibin çalışma başına maliyetinin ne kadar olduğunu soruyor. Veya çağrı sırasında hangi agent'nin sabah 3'te durduğunu bilmesi gerekiyor.

Serbest biçimli LLM tarafından yönlendirilen ekipler bunların hiçbirine net bir şekilde yanıt vermiyor. Saf DAG'ler hepsine yanıt verir ancak agent beyin fırtınasının ihtiyaç duyduğu keşif şeklini kaybeder.

CrewAI'nin bölünmesi ticaret konusunda dürüst. İşbirliğine dayalı, rol bazlı, keşifsel çalışmalara yönelik ekipler. Olay odaklı, koda ait, denetlenebilir üretime yönelik akışlar. Aynı framework, iki şekil, yüzey başına seçim.

## Konsept

### Dört ilkel

CrewAI'nin yüzeyi küçük. Bunu ezberleyin, gerisi yapılandırmadır.

- **Agent.** `role + goal + backstory + tools + (optional) llm`. Arka hikaye yük taşıyor. agent durduğunda tonu ve muhakemeyi şekillendirir. Araçlar, agent'nin çağırabileceği işlevlerdir (daha fazlası aşağıda).
- **Görev.** `description + expected_output + agent + (optional) context + (optional) output_pydantic`. Yeniden kullanılabilen iş birimi. `expected_output` sözleşmedir. {`context`, çıktıları aktarılan yukarı akış görevlerini listeler. `output_pydantic`, yapılandırılmış bir şekli zorlar.
- **Mürettebat.** Konteyner. `agents` listesine, `tasks` listesine, {`process` ve isteğe bağlı `memory` + `verbose` + `manager_llm` ayarlarına sahiptir.
- **Süreç.** Yürütme stratejisi. Sıralı, Hiyerarşik, Konsensüs (planlı). Koşunun şeklini seçer.

Agent'lar birbirlerini doğrudan görmüyorlar. Görevler agent'lere referans veriyor. Mürettebat görevleri sıralar. Süreç bir sonraki görevi kimin seçeceğine karar verir. Bütün zihinsel model budur.

> **CrewAI 0,86 (2026-05) ile doğrulanmıştır**. Daha yeni sürümler süreç türlerini yeniden adlandırabilir veya birleştirebilir; Belirli bir şekle güvenmeden önce [CrewAI Süreç belgelerini](https://docs.crewai.com/concepts/processes) kontrol edin.

### Sıralı vs Hiyerarşik vs Konsensüs

- **Sıralı.** Görevler bildirim sırasına göre yürütülür. N görevinin çıktısı, N+1 görevi için `context` olarak mevcuttur. En düşük maliyet. En öngörülebilir. Sipariş sabitlendiğinde kullanın.
- **Hiyerarşik.** Bir yönetici Agent (ayrı LLM çağrısı) uzmanlar arasında yönlendirme yapar. CrewAI, yöneticiyi `manager_llm` yapılandırmanızdan veya varsayılandan oluşturur. Yönetici her turda bir sonraki görevi seçer ve reddedebilir veya yeniden yönlendirebilir. Dört veya daha fazla uzmanınız olduğunda ve siparişin gerçekten önceki çıktıya bağlı olduğu durumlarda kullanın.
- **Uzlaşı.** Planlanmıştır, şu anda genel API'de uygulanmamaktadır. Dokümanlar bu adı gelecekteki oylamaya dayalı bir süreç için saklıyor. Bugün ona güvenmeyin.

Hiyerarşik, her uzman görüşmesinin üstüne her turda bir LLM çağrısı (yönetici) ekler. Beş adımlık bir çalıştırmada Token maliyeti üç katına çıkabilir. Yalnızca yönlendirmeye ihtiyacınız olduğunda bunun için ödeme yapın.

### Ekipler ve Akışlar

Bu, dokümanların 2026'da öncülük ettiği çerçevedir.

- **Mürettebat** Yüksek Lisans odaklı özerklik. framework çalışma zamanında şekli seçer. Şunun için iyi: araştırma, beyin fırtınası, ilk taslaklar, yolun cevabın parçası olduğu her yer. Tekrar oynatmak zor. Test edilmesi zor. Prototiplemesi ucuz.
- **Akış.** Sahip olduğunuz olay odaklı grafik. `@start` girişi işaretler. `@listen(topic)`, başka bir adım o konuyu yayınladığında tetiklenen bir adımı işaretler. Her adım sade Python'dur (bir Mürettebatı dahili olarak çağırabilir). Şunun için iyi: üretim. Gözlemlenebilir. Test edilebilir. Deterministik.

Dokümanların 2026 üretim önerisi: Bir Akışla başlayın. Özerkliğin bedelini ödediğinde Mürettebatları Akış adımları içinden `Crew.kickoff()` çağrı olarak katla. Akış size denetim izini verir, Mürettebat ise keşif sağlar. Oluşturun, seçmeyin.

### Araç entegrasyonu

Agent'ya bir araç vermenin üç yolu. Uygun olan en basit olanı seçin.

1. **`@tool` dekoratör.** ​​Saf işlevler araç haline gelir. İmza şemadır; docstring, LLM'nin gördüğü açıklamadır. Tek seferlik yardımcılar için en iyisi.

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` alt sınıfı.** Açık bağımsız değişken şeması, eşzamansız destek ve yeniden denemeler içeren sınıf tabanlı araç. Aracın bir durumu (bir istemci, bir önbellek) olduğunda veya yapılandırılmış argümanlara ihtiyaç duyduğunda kullanın.

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

3. **Yerleşik araç setleri.** CrewAI birinci taraf adaptörler gönderir: `SerperDevTool`, `FileReadTool`, {`DirectoryReadTool`, `CodeInterpreterTool`, `RagTool`, `WebsiteSearchTool`. Tek bir içe aktarma ile kablolu.

Yapılandırılmış çıktılar Pydantic'i kullanır. Göreve `output_pydantic=MyModel` ilet. CrewAI, LLM yanıtını modele göre doğrular ve ya zorlar ya da yeniden dener. Bunu sıkı bir `expected_output` dizesiyle eşleştirin. Serbest metin çıktıları taslaklar için uygundur; Yapılandırılmış çıktılar, aşağı akış Akışlarının tüketebileceği şeylerdir.

### Bellek kancaları

CrewAI, kutudan dört bellek türü çıkarıyor. Şunları oluştururlar: Bir Mürettebat dördünü aynı anda etkinleştirebilir.

> **CrewAI 0,86 (2026-05) ile doğrulanmıştır**. Son sürümler her şeyi bu dört mağazayı kapsayan birleşik bir `Memory` sistemi aracılığıyla yönlendiriyor. Aşağıdaki kavramsal model hala geçerlidir ancak genel sınıf yüzeyi daha yeni sürümlerde tek bir `Memory` giriş noktasına daraltılabilir; mevcut API için [CrewAI hafıza belgelerini]({https://docs.crewai.com/concepts/memory) kontrol edin.

- **Kısa süreli.** Tek bir çalıştırmada konuşma arabelleği. Sonunda silindi.
- **Uzun vadeli.** Çalışmalar boyunca devam etti. Bir vektör DB'sinde saklanır (varsayılan olarak Chroma, değiştirilebilir). Geçerli göreve benzerlik yoluyla alındı.
- **Varlık.** Varlık bazında gerçekler. "Müşteri X kurumsal plan kapsamındadır." Benzerliğe göre değil, varlığa göre anahtarlanmıştır. Koşularda hayatta kalır.
- **Bağlamsal.** Montaj zamanı erişimi. İlgili belleği Agent ihtiyaç duyduğu anda çeker, önceden yüklenmemiş.

Mürettebatta `memory=True` veya tür başına yapılandırmayla etkinleştirin. Yapılandırdığınız bir embeddings sağlayıcısı tarafından desteklenir (varsayılanı OpenAI'dir, yerel ile değiştirilebilir). Bellek, CrewAI'nin daha ince framework'lere karşı gücünü kazandığı yerlerden biridir; saf LangGraph bunların her birini kendiniz bağlamanızı gerektirir.

### Rol bazlı ekipler uygun olduğunda

- Adlandırılmış rollere ve işbirliğine dayalı bir iş akışına sahip üç ila altı agent. Taslak hazırlama, gözden geçirme, planlama, beyin fırtınası.
- LLM'nin bir sonraki adıma ilişkin kararının değerin bir parçası olduğu yönlendirme (Hiyerarşik).
- Herhangi bir yerde ekip, bir grafik tanımını okumaktan ziyade `role + goal + backstory`'yi okumaktan daha mutludur.

### Yapmadıklarında

- Kesin sıralamaya sahip deterministik DAG'ler. LangGraph'ı kullanın (Ders 13). Grafik şekli doğru soyutlamadır; CrewAI'nin rol çerçevesi sürtünmedir.
- İkinci saniyenin altındaki gecikme bütçeleri. Hiyerarşik gidiş-dönüş ekler. Sıralı bile arka hikayeleri ve önceki çıktıları içeren prompt'leri serileştirir.
- Tekli-agent loop'ler. framework'yi atla; bir agent loop (Ders 1) artı bir araç kaydı daha kısadır.

Ders 17 (Agent Framework Takaslar) bunu bir matriste ortaya koyuyor. Kısa versiyon: CrewAI "işbirlikçi rol tabanlı" köşede yer alıyor.

### Bağımlılık şekli

LangChain'den bağımsız. Python 3.10'dan 3.13'e. `uv` kullanır. Yıldız sayısı: bkz. [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) (2026-05 anlık görüntüsü). AWS Bedrock entegrasyonu belgelenmiştir; satıcı benchmark, QA iş yüklerinde LangGraph'a kıyasla önemli bir hızlanma rapor ediyor, ancak metodoloji (dataset, donanım, değerlendirme metriği) yayınlanmadı, bu nedenle framework-satıcı numaralarını yalnızca yön verici olarak değerlendirin.

### Bu modelin yanlış gittiği yer

- **Prompt-arka hikayelerden şişkinlik.** agent başına 2000 kelimelik bir arka plan hikayesi ve beşagent kişilik bir ekip, ilk araç çağrısından önce bağlam bütçesini harcar. Geçmiş hikayeleri 200 kelimenin altında tutun. agent'larda ifadeleri yeniden kullanın; ev stilini beş kez tekrarlamayın.
- **Yönetici-LLM token vergisi.** Hiyerarşik süreç, her uzman çağrısından önce bir yönetici LLM çağrısı ekler. Beş yerine altı LLM çağrısı olan beş görevli bir ekipte yönetici çağrısı, tüm görev listesini ve önceki çıktıları taşır. Yönlendirme çıkışa bağlı olmadığı sürece Sıralıya geçin.
- **Kırılgan aktarımlar.** Görev N'nin `expected_output`'si "bir taslaktır". Görev N+1 bunu `context` olarak okur ve üç bölümü ayrıştırmaya çalışır. Yüksek Lisans dört tane üretti. Aşağı yöndeki Agent reklam kitaplıkları. Görev N'de {`output_pydantic` ile düzeltilerek Görev N+1'in serbest metin yerine yazılan bir nesneyi okuması sağlandı.
- **Ürün olarak ekip.** Serbest biçimli Ekip, Flow ambalajı olmadan üretime gönderildi. Çıkış değişkenliği yüksektir; tekrar oynatmak imkansızdır; çağrı üzerine kötü bir koşuyu iyi bir koşudan ayıramaz. Bir Akışla Sarın.

## İnşa Et

`code/main.py`, her iki şeklin de stdlib versiyonlarını artı üç-agent kişilik bir mürettebatı uygular.

Şekil:

- CrewAI'nin yüzeyiyle eşleşen `Agent`, `Task` veri sınıfı.
- `SequentialCrew.kickoff(inputs)`, çıktıları `context` olarak iş parçacığı olarak işleyerek görevleri bildirim sırasına göre çalıştırır.
- `HierarchicalCrew.kickoff(topic)`, her turda bir sonraki uzmanı seçen bir yönetici Agent ekler ve "bitti"de durur.
- `@start` ve {`@listen(topic)` dekoratörleriyle `Flow`, küçük bir olay döngüsü ve bir iz.
- CrewAI'nin `@tool` şeklini yansıtan `tool(name)` dekoratörü.
- `short_term`, {`long_term`, `entity` mağazalarıyla `Memory`; alay edilen benzerlik numpy'yi kullanır.
- Sahte LLM yanıtları, rol artı giriş öneki ile anahtarlanmış sabit kodlu dizelerdir. Ağ yok. Deterministik.

Somut demo: "agent mühendislik 2026" hakkında bir özet hazırlayan araştırmacı, yazar ve editör ekibi. Araştırmacı kaynakları çeker (alay eder). Yazar taslakları. Editör sıkıyor. Aynı ekip deterministik şekli göstermek için bir Akıştan geçiyor.

Çalıştır:

```bash
python3 code/main.py
```

İzleme şunları kapsar: `context` üzerinden sıralı ekip akışı, yönetici seçimleriyle hiyerarşik ekip (araştırmacı, yazar, editör, ardından "bitti"), açık konularla aynı üç adımı çalıştıran akış (`researched`, {`drafted`, `edited`), `@tool` yoluyla yönlendirilen araç çağrıları ve iki başlama sırasında hayatta kalan uzun süreli hafıza.

Mürettebat izi akıcıdır; yönetici prensipte yeniden sipariş verebilir. Akış izi sabittir. Bu seçim derstir.

## Kullan onu

- Üretim için **Mürettebat Akışı**. Akış `Crew.kickoff()`'ı çağıran bir adım olsa bile. Akış denetim sınırını verir.
- **CrewAI Ekibi (Sıralı)**, özellikle ilk taslaklar ve inceleme döngüleri olmak üzere işbirlikçi çalışmaların net bir şekilde düzenlenmesi için.
- **CrewAI Ekibi (Hiyerarşik)** yönlendirme çıktıya bağlı olduğunda ve dört veya daha fazla uzmanınız olduğunda.
- Açık durum makineleri için **LangGraph** (Ders 13), dayanıklı özgeçmiş, katı sıralama.
- Aktör-model eşzamanlılığı ve hata yalıtımı için **AutoGen v0.4** (Ders 14).
- Aktarma ve korkuluklara sahip OpenAI ilk ürünleri için **OpenAI AgentSDK'sı** (Ders 16).
- **Claude Agent SDK** (Ders 17), altagent'lara ve oturum deposuna sahip Claude-first ürünleri için.

## Gönderin

`outputs/skill-crew-or-flow.md` bir görev için Mürettebat ve Akış'ı seçiyor ve minimum uygulamayı destekliyor. Arka planı olmayan Mürettebat, açık konuların olmadığı Akış, üçten az uzmanın yer aldığı Hiyerarşik konularda sert reddedilmeler.

## Tuzaklar

- **Lezzet olarak arka plan.** Çıktıları şekillendirir. agent başına üç değişkeni test edin; fark gerçektir. Birini seç, dondur.
- **`expected_output` atlanıyor.** Görev başına bir sözleşme olmadığında, aşağı yönlü görevler LLM'nin ürettiği her şeyi alır. Mürettebat koşuyor; denetim başarısız olur.
- **Bellek her zaman açık.** Her çalıştırmada uzun vadeli yazar. Vektör DB büyüyor. Alma işlemi gürültülü oluyor. Scope, gerçeğin kalıcı olduğu görevlere yazar.
- **Yönetici prompt sürüklenmesi.** Hiyerarşik'in yöneticisi prompt örtülüdür. Yönlendirme tuhaflaşırsa ayrıntılı moda bırakın ve okuyun.
- **Mürettebattaki araç yan etkileri.** Bir Mürettebat, bir aracı beklenenden daha fazla kez çağırabilir. POST, DELETE, ödeme bir Akış adımına aittir, asla bir Mürettebat aracına ait değildir.

## Egzersizler

1. Sıralı ekibi bir Akışa dönüştürün. Değişkenliğin azaldığı temas noktalarını sayın. Okunabilirliğin nerede düştüğünü not edin.
2. Mürettebata varlık hafızası ekleyin: Bir müşteri hakkındaki gerçekler, başlama vuruşları boyunca devam eder. Alma işleminin doğru varlığı çektiğini doğrulayın.
3. Yöneticinin, yazarın çıktısı en az üç paragraftan oluşana kadar editöre yönlendirmeyi reddettiği Hiyerarşik bir süreç uygulayın. Yeniden denemeyi takip edin.
4. (Alay edilmiş) bir web araması için bir `BaseTool` alt sınıfını bağlayın. İz şeklini `@tool` dekoratör versiyonuyla karşılaştırın.
5. Düzenleyici görevine `output_pydantic=Brief` ekleyin, burada `Brief`'de {`title`, `summary`, `sections` bulunur. Yazar görevi çıktısının bir kez hatalı biçimlendirilmiş JSON olmasını sağlayın; İzlemede CrewAI'nin yeniden deneme davranışını doğrulayın.
6. CrewAI'nin doküman girişini okuyun. Oyuncağı gerçek `crewai` API'sine taşıyın. Stdlib sürümü hangi garantileri atladı?
7. AgentOps veya Langfuse'u (Ders 24) gerçek bir çalıştırmaya bağlayın. Stdlib sürümünde hangi izleri kaçırdınız?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Agent | "Kişilik" | Rol + hedef + arka plan + araçlar |
| Görev | "İş birimi" | Açıklama + beklenen çıktı + atanan + isteğe bağlı yapılandırılmış çıktı |
| Mürettebat | "Agent takımı" | Agent'lar için Kapsayıcı + Görevler + Süreç |
| Süreç | "Yürütme stratejisi" | Sıralı / Hiyerarşik / Konsensüs (planlanmış) |
| Akış | "Deterministik iş akışı" | Olay odaklı, koda ait, test edilebilir |
| Arka Plan | "Kişilik prompt" | Agent için ton ve karar şekillendirici |
| `@tool` | "İşlev aracı" | Bir işlevi Agent'nin çağırabileceği bir araca dönüştüren dekoratör |
| `BaseTool` | "Sınıf aracı" | Args şeması, yeniden denemeler, zaman uyumsuz destek içeren sınıf tabanlı araç |
| Varlık belleği | "Varlık bazında gerçekler" | Bellek kapsamı bir müşteri/hesap/sorun kapsamına alındı ​​|
| Uzun süreli hafıza | "Çapraz çalıştırma belleği" | Başlangıçlar arasında hayatta kalan vektör destekli bellek |
| Bağlamsal bellek | "Tam zamanında erişim" | Agent ihtiyaç duyduğu anda çekilen bellek |
| Yönetici Yüksek Lisans | "Yönlendirici agent" | Bir sonraki görevi seçen Hiyerarşik süreçte Ekstra LLM |
| `expected_output` | "Görev sözleşmesi" | Agent'ya (ve denetime) hangi şeklin döndürüleceğini söyleyen dize |

## Daha Fazla Okuma

- [CrewAI dokümanlarına giriş](https://docs.crewai.com/en/introduction): kavramlar ve önerilen üretim yolu
- [CrewAI Akış kılavuzu](https://docs.crewai.com/en/concepts/flows): olaya dayalı şekil, `@start`, {`@listen`
- [CrewAI araçları referansı](https://docs.crewai.com/en/concepts/tools): `@tool`, {`BaseTool`, yerleşik araç setleri
- [CrewAI belleği](https://docs.crewai.com/en/concepts/memory): kısa vadeli, uzun vadeli, varlık, bağlamsal
- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents): çoklu-agent ne zaman yardımcı olur ve ne zaman olmaz
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview): durum makinesi alternatifi
