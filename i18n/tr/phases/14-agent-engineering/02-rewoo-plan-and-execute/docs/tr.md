# ReWOO ve Planlama ve İcra: Çekilme Planlaması

> ReAct, düşünce ve eylemleri bir akışta birbirine çeviriyor. ReWOO onları ayırır: bir büyük plan önceden, sonra uygulayın. 5 kat daha az token, HotpotQA'da +4% doğruluk, ve planlayıcıyı 7B modeline distill edebilirsiniz. Plan-and-Execute onu genelleştirdi; Plan-and-Act web navigasyonuna kadar ölçeklendirdi.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- ReWOO'nun Planlayıcı / İşçi / Çözücü bölünmesinin neden jetonları koruduğunu ve ReAct'in birbirine karışmış döngüsüne göre dayanıklılığını arttırdığını açıklayın.
- Bir plan DAG, bir bağımlılık siparişinde uygulayıcı ve işçi çıkışlarını oluşturan bir çözücü uygulayın  tüm stdlib.
- Bir görevin ne zaman plan-sonra-ürüten vs. birbirine karışmış ReAct olarak çalıştırılmasını 2026 "beş iş akışı örneği" çerçevesini kullanarak karar verin (Anthropic).
- Plan-and-Act'in sentetik plan verilerine uzun vadede web veya mobil görevler için ne zaman ihtiyaç duyduğunu anlayın.

## Sorun

ReAct'in birbirine karışmış düşünce- eylem- gözlem döngüsü basit ve esnektir, ancak her araç çağrısı önceki düşünceler de dahil olmak üzere tüm önceki bağlamı taşımalıdır. Token kullanımı derinlik ile kat kat büyüyor. Daha da kötüsü: bir araç döngünün ortasında başarısız olduğunda, model tüm planı hata gözleminden yeniden çıkarmalıdır.

ReWOO (Xu et al., arXiv:2305.18323, Mayıs 2023) bunu fark etti ve bir bahis yaptı: tüm şeyi önceden planlayın, paralel olarak kanıt alın, sonunda cevap yazın. Bir LLM planlama çağrısı, N aracı kanıt için çağrısı (parale olabilir), bir LLM çözme çağrısı. Ticaret daha az esnekliktir (plan statiktir) çok daha iyi token verimliliği ve daha net bir başarısızlık modları için.

## Anlaşım

### Üç rolü

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planlayıcı bir DAG üretir. Her düğüm bir aracı, argümanlarını ve hangi önceki düğümlerden bağlıdır (tıpkı `#E1`- Evet .`#E2`İşçiler düğümleri topolojik sırada yürütürler.

### Neden 5 kat daha az token ?

ReAct, adım sayısıyla birlikte hızlı uzunluk çizgisel olarak büyür. 10 adımda, uyarı 1 artı eylem 1 artı gözlem 1 artı düşünce 2 artı eylem 2 artı gözlem 2 ve benzeri şeyleri içerir. Her ara adım da orijinal uyarıyı redundant olarak içerir.

ReWOO bir planlayıcı uyarısı (büyük), N küçük işçi uyarısı (her biri sadece araç çağrısı, zincir yok) ve bir çözücü uyarısı ödüyor. HotpotQA'da kağıt, +4 mutlak doğruluk elde ederken ~ 5 kat daha az token ölçer.

### Neden daha sağlam

ReAct'te işçi 3 başarısız olursa, döngü hatanın ortasında mantık yürütmelidir. ReWOO'da işçi 3 bir hata dizisini gönderir; çözücü onu orijinal planla bağlamda görür ve zarifçe düşürebilir. Başarısızlık yerleşimi adım adım değil, düğüm başına gerçekleşir.

### Planer destilasyonu

Kağıtın ikinci sonucu: planlayıcı gözlem görmediği için, bir planlayıcı çıkışlarına 175.B öğretmeninden 7B modelini ince ayarlayabilirsiniz. Küçük model planlama yapar; büyük model çıkarma için gerek yoktur. Bu artık standart  2026 birçok üretim ajanı küçük bir planlayıcı ve büyük bir uygulayıcı kullanır veya tersine.

### Planlama ve uygulama (2023)

LangChain ekibi'nin Ağustos 2023'te yayınladığı yayın ReWOO'yu bir örnekteki isimle genelleştirdi: Plan-and-Execute. Ön planlayıcı bir adım listesi yayınlar, uygulayıcı her adımı yürütür, bir seçmeli yeniden planlayıcı sonuçları gözlemledikten sonra gözden geçirebilir. Bu ReAct'e ReWOO'ya daha yakındır (ön planlayıcı gözlemleri tekrar planlamaya getiriyor), ancak token tasarruflarını korur.

### Plan ve Yasa (Erdogan et al., arXiv:2503.09572, ICML 2025)

Plan-and-Act, uzun uzayda web ve mobil ajanlara kalıpları ölçeklendirir. Ana katkıda sentetik plan verileri bulunur: etiketlenen bir yoldaki jeneratör, planın açık olduğu yerlerde eğitim verilerini üretir. Tek bir ReAct yoldaki tutarlılık kaybedilirken WebArena benzeri görevlerde 3050 adımdan sonra çalışmaya devam eden planlayıcı modellerini ince ayarlamak için kullanılır.

### Hangisini seçmek için ne zaman

| Pattern | When |
|---------|------|
| ReAct | Short tasks, unknown environment, need reactive exception handling |
| ReWOO | Structured tasks with known tools, token-sensitive, parallelizable evidence |
| Plan-and-Execute | Like ReWOO but with replanning after partial execution |
| Plan-and-Act | Long-horizon (>30 steps), web/mobile/computer-use |
| Tree of Thoughts | Search is worth paying for (Lesson 04) |

Anthropic'in Aralık 2024 yönergesi: En basitle başlayın. Görev bir araç çağrısı ve bir özet ise, ReWOO'yu oluşturmayın. Görev 40 adımlı bir araştırma görevi ise, ReAct'i tek başına yapmayın.

```figure
rewoo-plan
```

## Yapın

`code/main.py`ReWOO oyuncak uyguluyor:

- `Planner` planı bir istekle bir plan gününü yayınlayan bir senaryo politikası.
- `Worker` her düğümün araç çağrısını kayıt kayıtları üzerinden gönderir.
- `Solver` Kanıtları okuyan ve son cevabı veren yazılı bir kompozisyon.
- Bağımlılık çözümü  gibi referanslar `#E1`Daha önceki işçi üretimi ile değiştirilmiştir.

Demo, "Fransa başkenti nüfusunun milyonlara yuvarlanarak ne kadar olduğunu" iki adımlı bir plan kullanarak cevaplar: (1) başkenti araştırın, (2) nüfus araştırın, sonra çözün.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Trace önce tüm planı, sonra işçi sonuçlarını, sonra çözücü bileşimi gösterir. Token sayısını (kaykaynak sayısını bastırırırız) ReAct tarzı bir karıştırılmış koşuya karşılaştırın  ReWOO bu tür yapılandırılmış görevlerde kazanır.

## Kullan

LangGraph, bir tarif olarak Plan-and-Execute (`create_react_agent`CrewAI'nin Akışları, kalıpı doğrudan kodlar: görevleri önceden tanımlar ve Flow DAG onları gerçekleştirir. Plan- ve-Act'in sentetik veri yaklaşımı hala çoğunlukla araştırma; çalıştırma zaman kalıpı (aşık plan DAG) LangGraph ve CrewAI Akışları aracılığıyla üretimde gemi.

## Gönder

`outputs/skill-rewoo-planner.md`Bir araç kataloğu verilen bir kullanıcı istekinden bir ReWOO plan DAG oluşturur. Bir uygulayıcıya teslim edilmeden önce planı (siklik, her referans çözüldü, her araç var) doğruluyor.

## Egzersizler

1. İki paralel grupla 6 düğümlü DAG'de ne kazanır?
2. Bir işçi bir hata gönderirse ateşleyen bir yeniden planlama düğümünü ekleyin.
3. Değiştir `Planner`Küçük bir modelle (7B sınıfı) ve tutmak `Solver`Sonundan sonuna kaliteyi karşılaştırın  bölünme nerede başarısız olur?
4. Planlayıcı destilasyonu üzerine ReWOO makalesinin 4. bölümünü okuyun. 175B -> 7B sonucu konseptel olarak yeniden üretin: hangi eğitim verilerine ihtiyacınız var ve plan kalitesini nasıl puanlıyorsunuz?
5. Oyuncakları Plan ve Eylem'in yörüngesi şekline aktarın: plan bir dizi, bir DAG değil. Hangi ödeme değişir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | Plan, then fetch evidence in parallel, then solve — no observations in the planning prompt |
| Plan-and-Execute | "LangChain's plan-execute pattern" | ReWOO with an optional replanner node after execution |
| Plan-and-Act | "Scaled plan-execute" | Explicit planner/executor split with synthetic plan training data for long-horizon tasks |
| Evidence reference | "#E1, #E2, ..." | Plan-node placeholder substituted with prior worker output at dispatch time |
| Planner distillation | "Small planner, big executor" | Fine-tune a small model on planner traces from a large teacher |
| Token efficiency | "Fewer round trips" | 5x fewer tokens on HotpotQA vs ReAct in the paper |
| DAG executor | "Topological dispatcher" | Runs plan nodes in dependency order; parallel at each level |

## Daha Fazla Okumak

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) Kanonik kağıt
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) Sintitik planlarla ölçekli planlamacı-öğreticisi
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) Çerçeve tarifi
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) işe yarayan en basit örneği seçin
