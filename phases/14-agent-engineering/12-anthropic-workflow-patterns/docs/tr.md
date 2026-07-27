# Anthropic'in İş Akışı Modelleri: Karmaşık Yerine Basit

> Schluntz ve Zhang (Anthropic, Aralık 2024) iş akışlarını (önceden tanımlanmış yollar) agent'lerden (dinamik araç kullanımı) ayırıyor. Beş iş akışı modeli çoğu durumu kapsar. Doğrudan API çağrılarıyla başlayın. agent'leri yalnızca adımlar tahmin edilemediğinde ekleyin.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Anthropic'in beş iş akışı modelini adlandırın: prompt zincirleme, yönlendirme, paralelleştirme, orkestratör-çalışanlar, değerlendirici-optimizasyon.
- agent-iş akışına karşı iş akışı ayrımını ve her birinin mühendislik maliyetini açıklayın.
- agent üzerinden iş akışının ne zaman seçileceğini belirleyin (ve tam tersi).
- Stdlib'deki beş modelin tümünü komut dosyasıyla yazılmış bir LLM'ye karşı uygulayın.

## Sorun

Ekipler, tek bir işlev çağrısı gerektiren sorunlar için çoklu agent framework'lere ulaşır. Maliyet gerçektir: framework'ler, prompt'leri gizleyen, kontrol akışını gizleyen ve vaktinden önce karmaşıklığa davetiye çıkaran katmanlar ekler. Schluntz ve Zhang'ın Aralık 2024'teki gönderisi, sektörde en çok alıntı yapılan gönderidir: Basit başlayın, ancak maliyetini karşıladığında karmaşıklığı artırın.

## Konsept

### İş Akışları ve agent'ler

- **İş akışı.** Önceden tanımlanmış kod yolları aracılığıyla düzenlenen LLM'ler ve araçlar. Mühendisler grafiğin sahibidir.
- **Agent.** LLM'ler dinamik olarak kendi araçlarını yönlendirir ve kendi adımlarını atar. Model grafiğin sahibidir.

Her ikisinin de yeri var. İş akışları daha ucuz, daha hızlı ve hata ayıklaması daha kolaydır. Agent'ler açık uçlu sorunların kilidini açar ancak arıza modlarının akıl yürütmesini zorlaştırır.

### Genişletilmiş LLM

Beş modelin hepsinin temeli: Arama (geri alma), araçlar (eylemler), bellek (kalıcılık) olmak üzere üç özelliğe bağlı bir LLM. Herhangi bir API çağrısı bunları kullanabilir.

### Beş model

1. **Prompt zincirleme.** Çağrı 1'in çıktısı, çağrı 2'ye girdidir. Bir görevin temiz bir doğrusal ayrışması olduğunda kullanın. Adımlar arasında isteğe bağlı programatik kapılar.

2. **Yönlendirme.** Bir sınıflandırıcı LLM, hangi alt LLM'nin veya aracın çağrılacağını seçer. Kategorik olarak farklı girdilerin farklı işlemlere ihtiyaç duyduğu durumlarda kullanın (kademe 1 desteği, geri ödeme, hata ve satış).

3. **Paralelleştirme.** N LLM çağrılarını aynı anda çalıştırın ve sonuçları toplayın. İki şekil: bölümleme (farklı parçalar) ve oylama (aynı prompt, N sayıda çalışma, çoğunluk/sentez).

4. **Orkestratör-çalışanlar.** Bir orkestratör LLM, hangi çalışanların (aynı zamanda LLM'lerin) çalıştırılacağına dinamik olarak karar verir ve çıktılarını sentezler. agent loop'lere benzer ancak orkestratör süresiz olarak döngü yapmaz.

5. **Değerlendirici-iyileştirici.** Bir LLM bir cevap önerir, başka bir LLM bunu değerlendirir. Değerlendirici geçene kadar tekrarlayın. Bu, Kendini Arıtmanın (Ders 05) genelleştirilmiş halidir.

### İş akışlarının agent'leri geride bıraktığı yer

- **Tahmin edilebilir görevler.** Adımları sıralayabiliyorsanız yapmalısınız.
- **Maliyete bağlı görevler.** İş akışlarında sınırlı adım sayıları vardır; agent'ler spiral şeklinde hareket edebilir.
- **Uyumla bağlantılı görevler.** Denetçiler grafiğin gidişatından sonuç çıkarmak değil, grafiği okumak ister.

### agent'lerin iş akışlarını geride bıraktığı yer

- **Açık uçlu araştırma.** Bir sonraki adımın ne zaman atılacağı, son adımın ne getirdiğine bağlıdır.
- **Değişken uzunluktaki görevler.** Adım sayısının bilinmediği dakikalardan saatlere kadar çalışma süresi.
- **Yeni alanlar.** Henüz doğru iş akışını bilmiyorsanız; önce keşif yapın, sonra kodlayın.

### Bağlam mühendisliği arkadaşı

"AI agent'ler için etkili bağlam mühendisliği" (Anthropic 2025) bitişik disiplini resmileştiriyor: 200k penceresi bir kapsayıcı değil, bir bütçedir. Neler dahil edilmeli, ne zaman sıkıştırılmalı, bağlamın büyümesine ne zaman izin verilmeli. Bağlam sıkıştırmayla ilgili Aşama 14 dersinde ayrıntılı olarak ele alınmıştır (yeniden numaralandırmadan önce bu müfredattaki Aşama 14 önceki ders 06).

## İnşa Et

`code/main.py`, beş iş akışı modelinin tümünü bir `ScriptedLLM`'ye karşı uygular:

- `prompt_chain(input, steps)` — sıralı.
- `route(input, classifier, handlers)` — sınıflandırma + gönderim.
- `parallel_vote(prompt, n, aggregator)` — N çalıştırma, toplama.
- `orchestrator_workers(task, workers)` — orkestratör çalışanları seçer.
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` — geçişe kadar döngü.

Çalıştır:

```
python3 code/main.py
```

Her desen kendi izini yazdırır. Desen başına toplam kod satırı ~10-15'tir; bir framework'nin maliyeti binlerle ölçülür.

## Kullan onu

- Çoğu görev için doğrudan API çağrıları.
- Framework yalnızca desen gerçekten dayanıklı duruma (LangGraph), aktör-model eşzamanlılığına (AutoGen v0.4) veya rol şablonlamaya (CrewAI) ihtiyaç duyduğunda.
- Claude Code koşum takımı şeklini yeniden oluşturmadan istediğinizde Claude Agent SDK'ya ulaşın.

## Gönderin

`outputs/skill-workflow-picker.md`, karar gerekçesi ve iş akışlarının yetersiz kalması durumunda agent'ye yönelik yeniden düzenleme yolu da dahil olmak üzere belirli bir görev tanımı için doğru modeli seçer.

## Egzersizler

1. Yönlendirmeyi bir güven eşiğiyle uygulayın. Eşiğin altında -> insana ilet. 1. aşama destek kullanım senaryosu için eşik nereye ulaşır?
2. `parallel_vote`'ye bir zaman aşımı ekleyin. Bir çağrı kilitlendiğinde ne olur? Eksik oyları nasıl topluyorsunuz?
3. `evaluator_optimizer`'yi haydut haline getirin: yinelemeler boyunca en iyi 2 çıktıyı koruyun, böylece geç iyi bir sonucun üzerine geç kötü bir sonuç yazılmaz.
4. prompt zincirlemeyi yönlendirmeyle birleştirin: bir yönlendirici üç zincirden birini seçer. Tek bir büyük prompt alternatifine kıyasla token maliyetini ölçün.
5. Üretim özelliklerinizden birini seçin. İş akışı grafiğini çizin. Count steps. agent burada gerçekten daha iyi olur mu?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| İş Akışı | "Önceden tanımlanmış akış" | Yüksek Lisans ve takım çağrılarının mühendise ait grafiği |
| Agent | "Otonom Yapay Zeka" | Modele ait grafik; dinamik takım yönü |
| Artırılmış Yüksek Lisans | "Araçlarla Yüksek Lisans" | Yüksek Lisans + arama + araçlar + hafıza; atom birimi |
| Prompt zincirleme | "Sıralı aramalar" | Çağrının çıkışı N, çağrının girişidir N+1 |
| Yönlendirme | "Sınıflandırıcı gönderimi" | Girişi hangi zincirin/modelin işleyeceğini seçin |
| Paralelleştirme | "Fan out" | N eşzamanlı çağrı; bölümlere ayırarak veya oylayarak toplayın |
| Orkestratör-çalışanlar | "Gönderici agent" | Orkestratör LLM, uzman LLM'leri dinamik olarak seçiyor |
| Değerlendirici-iyileştirici | "Teklif sahibi + yargıç" | Değerlendirici başarılı olana kadar yineleyin; Kendini İyileştirme genelleştirilmiş |

## Daha Fazla Okuma

- [Antropik, Etkili Agent Oluşturma (Aralık 2024)](https://www.anthropic.com/research/building-effective-agents) — beş iş akışı modeli
- [AI agent'ler için Antropik, Etkili bağlam mühendisliği](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — yardımcı disiplin
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — durum bilgisi olan grafiklerin maliyetini karşıladığı zaman
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — ürünleştirilmiş orkestratör-çalışan modeli
