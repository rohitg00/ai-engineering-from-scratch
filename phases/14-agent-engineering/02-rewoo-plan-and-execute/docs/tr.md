# ReWOO ve Planla ve Yürüt: Ayrılmış Planlama

> ReAct düşünce ve eylemi tek bir akışta birleştirir. ReWOO onları ayırıyor: Önce büyük bir plan, sonra uygulama. 5 kat daha az token, HotpotQA'da +%4 doğruluk ve planlayıcıyı 7B modeline ayırabilirsiniz. Planla ve Uygula bunu genelleştirdi; Planla ve Harekete Geç bunu web navigasyonuna ölçeklendirdi.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- ReWOO'nun Planlayıcı/İşçi/Çözücü ayrımının neden token'leri kurtardığını ve ReAct'in aralıklı döngüsü üzerinde sağlamlığı geliştirdiğini açıklayın.
- Bir DAG planı, bağımlılık emri veren bir uygulayıcı ve çalışan çıktılarını oluşturan bir çözücüyü uygulayın - tümü stdlib.
- 2026 "beş iş akışı modeli" çerçevesini (Antropik) kullanarak bir görevin ne zaman planla-sonra-yürüt olarak veya aralıklı ReAct olarak çalıştırılacağına karar verin.
- Uzun vadeli web veya mobil görevler için Planla ve Harekete Geç'in sentetik plan verilerine ne zaman ihtiyaç duyulduğunun farkına varın.

## Sorun

ReAct'in aralıklı düşünce-eylem-gözlem döngüsü basit ve esnektir, ancak her araç çağrısının, önceki tüm düşünceler de dahil olmak üzere önceki bağlamın tamamını taşıması gerekir. Token kullanımı derinlikle birlikte ikinci dereceden artar. Daha da kötüsü: Bir araç döngünün ortasında başarısız olduğunda modelin tüm planı hata gözleminden yeniden türetmesi gerekir.

ReWOO (Xu ve diğerleri, arXiv:2305.18323, Mayıs 2023) bunu fark etti ve bir iddiaya girdi: Her şeyi önceden planlayın, paralel olarak kanıt toplayın, cevabı en sonunda yazın. Plan yapmak için bir LLM çağrısı, N aracı kanıt gerektirir (paralel olabilir), çözmek için bir LLM çağrısı. Çok daha iyi token verimliliği ve daha net arıza modları için ticaret daha az esnekliktir (plan statiktir).

## Konsept

### Üç rol

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planlayıcı bir DAG üretir. Her düğüm bir aracı, onun bağımsız değişkenlerini ve bağlı olduğu önceki düğümleri (`#E1`, `#E2` gibi referanslar) adlandırır. İşçiler düğümleri topolojik sıraya göre yürütürler. Çözücü her şeyi birbirine diker.

### Neden 5 kat daha az token

ReAct, prompt uzunluğunu adım sayısıyla doğrusal olarak artırır. 10. adımda prompt, düşünce 1 artı eylem 1 artı gözlem 1 artı düşünce 2 artı eylem 2 artı gözlem 2 vb. içerir. Her ara adım ayrıca yedekli olarak orijinal prompt'yi içerir.

ReWOO bir planlayıcı prompt (büyük), N küçük işçi prompt (her biri yalnızca araç çağrısı, zincir yok) ve bir çözücü prompt öder. HotpotQA'da makale ~5 kat daha az token ölçerken +4 mutlak doğruluk puanı alıyor.

### Neden daha sağlamdır

Çalışan 3, ReAct'te başarısız olursa, döngünün, akışın ortasındaki hatanın nedenini açıklaması gerekir. ReWOO'da işçi 3 bir hata dizesi döndürür; Çözücü bunu orijinal plan bağlamında görür ve zarif bir şekilde bozabilir. Arıza yerelleştirmesi adım başına değil, düğüm başına yapılır.

### Planner damıtma

Makalenin ikinci sonucu: Planlayıcı gözlemleri görmediğinden, 175B öğretmeninin planlayıcı çıktılarına göre 7B modeline ince ayar yapabilirsiniz. Küçük model planlamayı yönetir; inference'de büyük modele ihtiyaç yoktur. Bu artık standarttır; 2026 üretimi agent'lerin çoğu küçük bir planlayıcı ve büyük bir uygulayıcı kullanır veya tam tersi.

### Planla ve Yürüt (2023)

LangChain ekibinin Ağustos 2023'teki gönderisi, ReWOO'yu bir model adı olarak genelleştirdi: Planla ve Yürüt. Ön planlayıcı bir adım listesi yayınlar, uygulayıcı her adımı çalıştırır, isteğe bağlı bir yeniden planlayıcı sonuçları gözlemledikten sonra revize edebilir. Bu, ReWOO'dan ziyade ReAct'e daha yakındır (yeniden planlama, gözlemleri planlamaya geri getirir) ancak token tasarruflarını korur.

### Planla ve Harekete Geç (Erdoğan ve diğerleri, arXiv:2503.09572, ICML 2025)

Planla ve Harekete Geç, modeli uzun ufuklu web ve mobil agent'lere ölçeklendirir. Temel katkı sentetik plan verileridir: etiketli bir yörünge oluşturucu, planın açık olduğu yerde eğitim verileri üretir. Tek bir ReAct yörüngesinin tutarlılığını kaybettiği WebArena benzeri görevlerde 30-50 adımdan sonra çalışmaya devam eden planlayıcı modellerine ince ayar yapmak için kullanılır.

### Hangisini ne zaman seçmeli

| Desen | Ne zaman |
|---------|------|
| Tepki | Kısa görevler, bilinmeyen ortam, reaktif istisna yönetimi gerekiyor |
| ReWOO | Bilinen araçlarla yapılandırılmış görevler, token'ye duyarlı, paralelleştirilebilir kanıtlar |
| Planla ve Yürüt | ReWOO'ya benzer ancak kısmi yürütme sonrasında yeniden planlama ile |
| Planla ve Harekete Geç | Uzun ufuk (>30 adım), web/mobil/bilgisayar kullanımı |
| Düşünce Ağacı | Arama, ödemeye değerdir (Ders 04) |

Anthropic'in Aralık 2024 kılavuzu: en basitinden başlayın. Görev bir araç çağrısı artı bir özetse ReWOO oluşturmayın. Görev 40 adımlık bir araştırma ödeviyse ReAct'i tek başınıza yapmayın.

## İnşa Et

`code/main.py` bir oyuncak ReWOO uyguluyor:

- `Planner` — prompt'den bir DAG planı yayan komut dosyasıyla yazılmış bir politika.
- `Worker` — her düğümün araç çağrısını kayıt defteri aracılığıyla gönderir.
- `Solver` — delilleri okuyan ve nihai bir cevap üreten senaryolu kompozisyon.
- Bağımlılık çözümü — `#E1` gibi referanslar daha önceki çalışan çıktılarıyla değiştirilir.

Demo, "Fransa'nın başkentinin milyonlara yuvarlanmış nüfusu nedir?" sorusunu yanıtlıyor. iki adımlı bir plan kullanarak: (1) başkenti araştırın, (2) nüfusu araştırın, sonra çözün.

Çalıştır:

```
python3 code/main.py
```

İz, önce tam planı, ardından çalışan sonuçlarını ve ardından çözücü kompozisyonunu gösterir. token sayısını (kabaca bir karakter sayımı yazdırıyoruz) ReAct tarzı aralıklı çalıştırmayla karşılaştırın - ReWOO bu tür yapılandırılmış görevlerde kazanır.

## Kullan onu

LangGraph, Planla ve Yürüt'ü bir tarif olarak sunar (ReAct için `create_react_agent`, planla-yürüt için özel grafikler). CrewAI'nin Akışları modeli doğrudan kodlar: görevleri önceden tanımlarsınız ve Flow DAG bunları yürütür. Planla ve Harekete Geç'in sentetik veri yaklaşımı hâlâ çoğunlukla araştırma niteliğindedir; çalışma zamanı modeli (açık plan DAG), LangGraph ve CrewAI Flows aracılığıyla üretime gönderilir.

## Gönderin

`outputs/skill-rewoo-planner.md`, bir araç kataloğu verildiğinde kullanıcı isteğinden bir ReWOO planı DAG'ı oluşturur. Bir uygulayıcıya teslim edilmeden önce planı doğrular (döngüsel değildir, her referans çözümlenir, her araç mevcuttur).

## Egzersizler

1. Bağımsız plan düğümleri için çalışan yürütmesini paralelleştirin. 2 paralel gruba sahip 6 düğümlü bir DAG size ne kazandırır?
2. Herhangi bir çalışanın hata vermesi durumunda devreye girecek bir yeniden planlama düğümü ekleyin. ReWOO'yu Planla ve Yürüt'e dönüştüren en küçük değişiklik nedir?
3. `Planner`'yi küçük bir modelle (7B sınıfı) değiştirin ve `Solver`'yi sınır modelinde tutun. Uçtan uca kaliteyi karşılaştırın; bölünme nerede başarısız oluyor?
4. Planlayıcı damıtmayla ilgili ReWOO makalesinin 4. Bölümünü okuyun. 175B -> 7B sonucunu kavramsal olarak yeniden oluşturun: Hangi eğitim verilerine ihtiyacınız var ve plan kalitesini nasıl puanlıyorsunuz?
5. Oyuncağı Planla ve Harekete Geç'in yörünge şekline yerleştirin: plan bir DAG değil, bir dizidir. Hangi değiş tokuşlar değişir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| ReWOO | "Gözlem olmadan akıl yürütme" | Planlayın, ardından paralel olarak kanıt toplayın ve çözün — planlamada gözlem yok prompt |
| Planla ve Yürüt | "LangChain'in planla-yürüt modeli" | Yürütme sonrasında isteğe bağlı yeniden planlama düğümüyle ReWOO |
| Planla ve Harekete Geç | "Ölçeklendirilmiş plan-uygulama" | Uzun vadeli görevler için sentetik plan eğitim verileriyle açık planlayıcı/yürütücü ayrımı |
| Kanıt referansı | "#E1, #E2, ..." | Plan düğümü yer tutucusu, dağıtım zamanında önceki çalışan çıktısıyla değiştirildi |
| Planlayıcı damıtma | "Küçük planlayıcı, büyük uygulayıcı" | Büyük bir öğretmenden planlayıcı izlerine küçük bir modele ince ayar yapın |
| Token verimlilik | "Daha az gidiş dönüş" | Makalede ReAct'e kıyasla HotpotQA'da 5 kat daha az token |
| DAG yürütücüsü | "Topolojik dağıtıcı" | Plan düğümlerini bağımlılık sırasına göre çalıştırır; her seviyede paralel |

## Daha Fazla Okuma

- [Xu ve diğerleri, ReWOO: Akıl Yürütmeyi Gözlemlerden Ayırmak (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) — kanonik makale
- [Erdoğan ve diğerleri, Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) — sentetik planlara sahip ölçekli planlayıcı-yürütücü
- [LangGraph Planla ve Yürüt öğreticisi](https://docs.langchain.com/oss/python/langgraph/overview) — framework tarifi
- [Antropik, Etkili Agent'ler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — işe yarayan en basit modeli seçin
