# Zihn Teorisi ve Yeni Başlayan Koordinasyon

> Li et al. (arXiv:2310.10701) ortak bir metin oyun sergisinde LLM ajanlarının **emergent high-order Theory of Mind**(ToM)  bir üçüncü ajanın inançları hakkında başka bir ajanın ne düşündüğünü düşünmek  ancak bağlam yönetimi ve halüsinasyon nedeniyle uzun vadede planlamayı başarısız etmek. Riedl (arXiv:2510.05174) bir popülasyonda daha yüksek sıralama sinerjisi ölçtü ve buldu ki **only**ToM-prompt koşulı kimlik bağlantılı farklılık ve hedef odaklı tamamlayıcılık üretir; düşük kapasiteli LLM'ler sadece sahte ortaya çıkış gösterir. Yani, koordinasyon ortaya çıkışı, serbest değil, derhal koşullu ve model bağımlıdır. Bu ders, minimal bir ToM-a karşı bilinçli ajan uyguluyor, ToM'nin teşvik edilmesiyle ve olmadan işbirliği görevini yürütüyor ve Riedl 2025 protokolüne karşı koordinasyon delta ölçüyor.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 17 (Generative Agents)
**Time:** ~75 minutes

## Sorun

Çoklu ajan koordinasyonu genellikle büyülü görünüyor: ajanlar iş gücü bölüşür, birbirlerini öngörür, boşaltmayı önler. Genellikle bu "gelen" bir an önce mühendisliği eseri  birisi ajanlara "koordinasyon" yapmaları için söyledi.

Riedl'in 2025 bulguları daha sıkıdır: kontrol edilen koşullarda, koordinasyon sadece ajanların hakkında düşünmeye teşvik edildiğinde ortaya çıkar **other agents' minds**(ToM). ToM uyarısı olmadan, güçlü modeller bile istatistik kontrollerden geçmeyen koordinasyon kalıplarını gösterir. Bu üretim için önemlidir: ekipler, hız bağımlı ve kırılgan "çok ajan koordinasyonu" özelliklerini gönderir.

Bu ders ToM'ye belirli bir yetenek olarak bakıyor (inanışlar hakkında düşünme), minimal bir ToM-a karşı farkında bir ajan oluşturur ve gerçek koordinasyonun neye benzediğini vs. hızlı giyinmenin neye benzediğini ölçüyor.

## Anlam

### ToM'in anlamı

Gelişme psikolojisi: 3 yaşındaki bir çocuk, herkesin iç dünyası onlarınkiyle eşleşir diye düşünüyor. 5 yaşındaki bir çocuk başkalarının farklı inançlara sahip olduğunu anlıyor. 7 yaşındaki bir çocuk inançlar hakkında inançlar hakkında nedenler ("topun fincanın altında olduğunu düşünüyorum") düşünüyor. Bunlar zeroth, birinci ve ikinci sıradaki ToM.

LLM ajanları için ToM, haritasını:

- **Zeroth-order:**Ajan sadece kendi gözlemlerine dayanarak hareket eder.
- **First-order:**"Alice X'e inanıyor".
- **Second-order:**"Alice Bob'un X'e inandığına inanıyor".

Li ve diğerleri 2023'te ilk ve ikinci sıradaki ToM'nin kooperatif oyunlarda LLM ajanlarında ortaya çıktığını ancak uzun ufaklık ve güvenilir olmayan iletişim ile düştüğünü buldular.

### Sally-Anne testi, kısaca

Bir 1985 sahte inanç testi: Sally bir mermer kuruşuna A koyup ayrılır. Anne onu kuruşuna B'ye taşır.

GPT-4 dönemindeki LLM'ler açıkça ortaya koyduğunda Sally-Anne tarzı testlerini geçiyor. Hikaye uzun olduğunda, sahne birkaç kez değişirken veya soru dolaylı olarak ifade edildiğinde başarısız olurlar.

### Riedl'in koordinasyon ölçümü

Riedl (arXiv:2510.05174) nüfus ölçeğinde bir test inşa etti: N ajanlar, işbirliği amacı, değişken acil koşullar.

1. **Identity-linked differentiation.**Ajanlar zamanla sabit rol ayrımları geliştiriyor mu?
2. **Goal-directed complementarity.**Ajanların eylemleri birbirlerini (farklı alt görevler) ikili değil tamamlıyor mu?
3. **Higher-order synergy.**Bir grupun hiçbir alt kümenin başaramadığı bir şeyi elde edip etmediğinin istatistiksel bir ölçüsü.

Sonuç: sadece ToM istek koşulunda üç metrik de başlangıç hattından yukarı sinyal üretir. ToM isteksiz, ölçüler orta kapasiteli modeller için şansın yakınında kalır. Büyük modeller açık ToM isteksiz bir koordinasyonu gösterir, ancak etki açık isteksiz olmaktan daha küçüktür.

### Koordinasyon yanılsısı

İstatistik kontroller olmadan, gösterilerdeki "özel koordinasyon" genellikle:

- Koordinasyonda pişirilen hızlı mühendislik (sistem uyarıları "birlikte çalışın" diyor).
- Gözlemci tarafsızlığı (bunu beklediğimiz kalıpları görüyoruz).
- Başarılı koşular için post-hoc seçimi.

Ölçülebilir sinyal olmadan "daha gelişmiş koordinasyon" pazarlanan üretim sistemleri pazarlama olarak değerlendirilmelidir.

### En az bir ToM-bilgili ajan.

Yapı:

```
agent state:
  own_beliefs:    {facts the agent believes}
  other_models:   {other_agent_id -> {beliefs_the_agent_attributes_to_them}}
  actions_last_N: [history of others' actions]

observation update:
  - update own_beliefs from direct observation
  - update other_models[agent_id] from their action + prior beliefs

action selection:
  - enumerate candidate actions
  - for each, predict what each other agent will do next given their modeled beliefs
  - pick action that maximizes joint outcome under those predictions
```

- Evet .`other_models`Birinci sırada ToM sadece bir seviyeyi korur.`other_models[i][other_models_of_j]`- Bence Ajan J'nin inandığını düşünüyorum.

### Neden uzun uzayda acı çekiyor?

Li et al. belge: bağlam sınırları ajanların kime ait olduğunu unutmalarına neden olur. Halüsinasyon diğer ajan modelleri için yanlış inançlar ekler. Her ikisi de zamanla karmaşan "X'yi sandım" hataları üretir.

Raporda belgelenmiş hafiflemeler ve 2024-2026 yıllarındaki takipler:

- **Explicit ToM state in the prompt.**Yapılandırılmış format: `{agent_id: belief_list}`Kimlik-için bağını korumak için geri almayı zorlar.
- **Shorter reasoning chains.**Her seferinde daha az ToM güncellemesi bileşik halüsinasyonları azaltır.
- **External ToM store.**Modelli LLM bağlamının dışında tutun; her turda sadece ilgili parçalar enjekte edin.

### ToM'nin üretiminde başarısız olduğu durumlarda

- **Adversarial settings.**İyi ToM'li ajanlar manipüle edilmesi daha kolaydır (senden model olduklarını modelleyebilir, sonra da sömürülebilirsin).
- **Heterogeneous teams.**Modeller farklı olduğunda, bir rakip için çalışan ToM modeli genelleştirmez.
- **Ground-truth-dependent tasks.**ToM inançlarla ilgilidir; eğer doğruluk gerçeklere bağlıysa, ToM dikkat dağıtıcı olabilir.

### Gerçekten ölçülebilecekleri koordinasyon

Takımın koordinasyonu, hemen giyinmek yerine gerçek olduğunu gösteren üç pratik sinyal:

1. **Complementarity over time.**Bir çok dönüşlü görevde, ajanların eylemleri ayrı alt görevleri kapsar mı?
2. **Anticipation.**T+1'deki A ajanının eylemleri doğru olan T+2'deki B'nin eylemleri hakkında bir tahminden mi bağlı?
3. **Correction.**A, T'de B'nin inancını yanlış anladığında, A, T+2'de doğru mu?

Bunlar kayıtlı bir çok ajan sisteminde ölçülebilir. "Koordinasyon" anlatısının içsel versiyonudur.

```figure
sw-theory-of-mind
```

## Yapın

`code/main.py`Uygulamaları:

- `ToMAgent` kendi inançlarını ve diğer ajan inanç modellerini takip eder.
- Bir işbirliği görevi: üç ajan üç kutudan üç token toplamalıdır; her kutu bir token tutabilir.
- İki yapılandırma: `zeroth_order`(ToM yok) ve `first_order`(Bir düzeyde inanç modeli ile ToM).
- 200 randomisasyonlu çalışmanın ölçümü: tamamlama oranı, çoğaltma oranı (iki ajan aynı kutuyu hedef alan), ortalama dönüş tamamlanmaya kadar.

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

Beklenen çıkış: sıfır sıra ajanları %35 oranında çabaları ikiye katlar ve 10 dönüşte denemelerin %60'ını tamamlar.

## Kullan

`outputs/skill-tom-auditor.md`Bir çok ajanlı sistemin "daha gelişmiş koordinasyon" iddiasını denetleyen bir beceri.

## Gönder

Koordinasyon taleplerinin kontrol listesini:

- **Control condition.**Koordinasyon sorusu olmadan sisteminizin bir versiyonu.
- **Statistical test.**Sistem ve kontrol arasındaki fark önemli mi ?`p < 0.05`- Metriklerinize göre mi?
- **Complementarity measure.**Zamanla hareket-karşılaşma, sadece son başarı değil.
- **Failure-case log.**Ajanlar yanlış koordinasyon yaparken, ToM eyaleti nasıl görünür?
- **Model-capacity disclosure.**Eğer daha küçük modellerde etkisi kaybolursa, söyle.

## Egzersizler

1. Çık .`code/main.py`İlk sıralama ToM'nin kopyalama oranını 7 kat azaltmasını onaylayın. 5 ajan ve 5 kutuya kadar ölçeklendirdiğinizde boşluk devam ediyor mu?
2. İkinci sıradaki ToM uygulaması (Agent A, B'nin C'ye ne düşündüğünü modellemektedir).
3. Bir **hallucination**Bu, birinci sıradaki performansı ne kadar düşürüyor?
4. Li et al. (arXiv:2310.10701). "Uzun ufuk degradasyonu" bulgularını yeniden üretin: dönüşler 10'dan 30'a kadar arttıkça, ilk sıra ToM performansınız nasıl değişiyor?
5. Riedl 2025 (arXiv:2510.05174) okuyun. Simülasyon günlüğünüzde yüksek sıralama sinerji istatistiklerini uygulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Theory of Mind | "Understanding others' minds" | The capacity to model another agent's beliefs. Graded by order (0, 1, 2+). |
| Sally-Anne test | "The false-belief test" | 1985 developmental psychology; LLMs pass plain versions, fail complex ones. |
| First-order ToM | "A believes X" | Modeling one other's beliefs about facts. |
| Second-order ToM | "A believes B believes X" | Recursive modeling one level deeper. |
| Identity-linked differentiation | "Stable roles over time" | Riedl's metric: roles persist, not random. |
| Goal-directed complementarity | "Disjoint actions" | Agents target different subtasks, not the same one. |
| Higher-order synergy | "Group exceeds any subset" | Riedl's statistical measure for real coordination. |
| Coordination illusion | "It looks coordinated" | Prompt-dressed appearance of coordination without measurable signal. |

## Daha Fazla Okumak

- [Li et al. — Theory of Mind for Multi-Agent Collaboration via Large Language Models](https://arxiv.org/abs/2310.10701) Kooperatif oyunlarda yeni gelişen ToM; uzun uzayda başarısızlık modları
- [Riedl — Emergent Coordination in Multi-Agent Language Models](https://arxiv.org/abs/2510.05174) Popülasyon ölçeğinde ölçüm; ToM uyarı yük taşıma koşuludur
- [Premack & Woodruff — Does the chimpanzee have a theory of mind?](https://doi.org/10.1017/S0140525X00076512) ToM kavramının 1978'deki kökeni
- [Baron-Cohen, Leslie, Frith — Does the autistic child have a theory of mind?](https://doi.org/10.1016/0010-0277(85)90022-8)  Sally-Anne makalesi (1985)
