# Yerarşik Mimarlık ve Başarısızlık Modu

> Yerarşik, yöneticilerden yöneticilerden yöneticilerden çalışanlardan daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla yöneticilerden daha fazla`Process.hierarchical`ders kitabı versiyonu: a `manager_llm`LangGraph eşdeğeri `create_supervisor(create_supervisor(...))`Bu, iş gerçek bir org çizelgesinde olduğu zaman doğal bir kalıptır. Aynı zamanda yönetimsel döngüye düşeceği en olası kalıptır.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern)
**Time:** ~60 minutes

## Sorun

Bir kez yönetici örneği tıklandığında, doğal bir sonraki adım "işçilerin kendileri yönetici ise ne olacak?"

Sorun: LLM yöneticileri insan yöneticileriyle aynı değildir. Bir insan yöneticisi raporlarının bildikleri konusunda sabit geçmişlere sahiptir. LLM yöneticisi her dönüşü, org'u bağlamında olan her şeyden yeniden akla getirir. Bu bağlamda küçük bir sürükleme ve tüm ağaç işyi yanlış yerleştirir.

## Anlam

### Şekil

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Her iç düğüm planlar, delegeler ve sentezler.

### # Parladığı yerde #

- **Clear org mapping.**Eğer gerçek görev bölümselse ("dokümanı yasal olarak incelemek, finansal olarak incelemek, mühendislik olarak incelemek, sonra exec için özetlemek") hiyerarşi açıkça görülür.
- **Local summarization.**Her alt yöneticiler, üst yöneticiler tarafından görmeden önce takımlarının çıkışını sentezler.

### Kırık olduğu yerlerde

2026'da yapılan ölüm sonrası testler üç başarısızlık modunu bulmaya devam ediyor:

1. **Task assignment error.**Yöneticisi hedefi okuyor, bir parçalanmayı halüsinasyonlar yapar ve yanlış alt yöneticisine delegasyon yapar. Alt yöneticinin verilen şeyi itaatle çalıştığı için hata sadece en üst sentezde ortaya çıkar.
2. **Output misinterpretation.**Alt yöneticisi "X iddiasını doğrulayamıyor". Top yöneticisi "X iddiası onaylanmamış" olarak özetler.
3. **Consensus loops.**İki alt yöneticinin görüşleri farklıdır; üst yöneticiler onları uzlaşmaları için çağırır; onlar yeniden görevlendirilir; işçiler yeniden çalışırlar; alt yöneticiler biraz farklı cevaplar verir; döngü. CrewAI'nin `Process.hierarchical`Bu konuda adım sınırları ile korunmak gerekir, ama sınırın kendisi artık bir hiperparametre.

### Önemli soru

Sıralı (lineer boru hattı) vs hiyerarşik: göreviniz aslında bağımsız alt takımlara sahip mi, yoksa bir ağaç gibi davranan bir çizgi akış mıdır?

### Rol çerçevesinin uygulanması

CrewAI'nin `Process.hierarchical`Müdür, uzman ekipler üzerinden bir yöneticinin LLM'sini bağlar.

- En üst düzey görev alır,
- mürettebatlara alt görevler verir,
- mürettebatın çıkışlarını değerlendirir,
- kabul, yeniden devretme veya tekrarlama karar verir.

Belge: https://docs.crewai.com/en/introduction(Közel kavramlar altında "Hiyerarşik süreç" için bakınız).

### Grafik çerçevesinin uygulanması

LangGraph , yuva yapılmış kullanıyor .`create_supervisor`İç yöneticinin kendi grafikleri vardır; dış yöneticisi iç grafikleri açık olmayan bir düğüm olarak değerlendirir. Bu, debugging için CrewAI'den daha temizdir (her grafikleri ayrı ayrı geçebilirsiniz), ancak ağacın dinamik yeniden şekillendirilmesini ifade etmek daha zordur.

İpucu: https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## Yapın

`code/main.py`3 seviye hiyerarşi vardır:

- üst düzey yöneticisi: bir görevi "muhendislik" ve " hukuki" bölümlere ayırır.
- Mühendislik alt yöneticisi: "frontend" ve "backend" işçilere ayrılır,
- Yasal alt yöneticisi: bir işçi.

Demo mutlu yolla karşıtlık gösterir (herkes aynı fikirde)**perturbed path**Yöneticinin ayrıştırılması "yasal" olarak "maliye" olarak yanlış etiketlediği ve hata kaskasasını izlediği yerde  alt yöneticinin itaatli bir şekilde finans işi yapması, üst sentezörün finans bulgularını rapor etmesi, orijinal yasal sorunun cevabı kalmamış kalması.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktım, her iki yolun da açık bir yan yana "ne istendi" vs. "ne teslim edildi" gösterir.

## Kullan

`outputs/skill-hierarchy-fitness.md`Görevlerin hiyerarşik, sıradan veya düz yönetici kullanılması gerektiğini değerlendirir. Girişler: görev açıklaması, org yapısı, uzlaşma bütçesi. Çıktı: belirli başarısızlık modlarına karşı korunmak için bir model önerisi.

## Gönder

Eğer hiyerarşik bir gemi varsa:

- **Cap tree depth at 2.**Üç seviyede zaten çoğu hata gözlemlenebilirlikten gizlenir.
- **Explicit reconciliation budget.**Yöneticinin en üst düzey görevlerini yapmadan önce en fazla bir sayı ayarlayın.
- **Provenance on every synthesis.**Her düğümün özetinde hangi yaprak çıkışı üretildiğini belirtmek gerekir.
- **Alert on decomposition drift.**Yöneticinin parçalanmasını adım adım kaydet; kullanıcı sorguyla karşılaştırın.

## Egzersizler

1. Çık .`code/main.py`Yukarı çıkışın kullanıcı sorusundan tamamen farklı olması için kaç düzeyde yöneticinin teslim olması gerekir?
2. Üçüncü bir seviye ekleyin (yukarı → alt → alt → işçi). Bozuklu yolun derinlik büyüdükçe ne kadar sıklıkla kendini düzelttiğini ölçün.
3. Her alt yöneticide, orijinal kullanıcı sorusu her zaman değişmeden sorulan bir "kanar" işçisi uygulayın.
4. CrewAI'nin yazısını okuyun.`Process.hierarchical`CrewAI'nin uyguladığı bir beton koruma rayı (adım sınırı, manager_llm kısıtlaması) tanımlayın ve hangi başarısızlık modunu hedeflemesini açıklayın.
5. Yatağındaki LangGraph denetleyicilerini CrewAI hiyerarşikleriyle karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Hierarchical | "Org chart pattern" | Supervisors over supervisors; only leaves do work. |
| Manager LLM | "The boss" | The LLM that decomposes, assigns, and validates at an internal node. |
| Decomposition drift | "The boss lost the plot" | Top manager's split no longer covers the original question. |
| Reconciliation loop | "Endless meetings" | Sub-managers disagree; top re-delegates; workers re-run; loop until budget exhausted. |
| Depth-2 ceiling | "Don't go deeper than 2 levels" | Empirical guardrail: 3+ levels collapses observability. |
| Canary question | "Ground truth at every level" | A worker that is always asked the original query unchanged, to detect drift. |
| Provenance chain | "Who said what" | Trace from each synthesis back to the leaf outputs that produced it. |

## Daha Fazla Okumak

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) Yöneticisi ile ders kitabı hiyerarşik LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) Yörüngede bulunan bir gözetmen tarafından`create_supervisor`
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system) Antropic neden hiyerarşikten daha fazla flat supervisor seçti
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) MAST taksonomisi; koordinasyon hataları bölümü
