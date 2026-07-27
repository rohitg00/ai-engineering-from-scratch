# Zihin Teorisi ve Acil Koordinasyon

> Li ve ark. (arXiv:2310.10701), işbirlikçi bir metin oyununda LLM agent'larin **ortaya çıkan yüksek düzey Zihin Teorisi** (ZK) sergilediğini - başka bir agent'ın üçüncü bir agent'ın inançları hakkında neye inandığına dair mantık yürüttüğünü - ancak bağlam yönetimi ve halüsinasyon nedeniyle uzun ufuklu planlamada başarısız olduklarını gösterdi. Riedl (arXiv:2510.05174) bir popülasyon genelinde yüksek dereceli sinerjiyi ölçtü ve **yalnızca** ZK-prompt koşulunun kimliğe bağlı farklılaşma ve hedefe yönelik tamamlayıcılık ürettiğini buldu; düşük kapasiteli LLM'ler yalnızca sahte bir görünüm gösterir. Yani koordinasyonun ortaya çıkışı prompt-şartlıdır ve modele bağımlıdır, özgür değildir. Bu ders, minimum ZK farkındalığına sahip bir agent uygular, ZK prompting ile veya ZK prompt olmadan işbirliğine dayalı bir görevi yürütür ve Riedl 2025 protokolüne göre koordinasyon deltasını ölçer.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 07 (Zihin ve Tartışma Topluluğu), Aşama 16 · 17 (Üretken Agent'ler)
**Süre:** ~75 dakika

## Sorun

Çoklu-agent koordinasyonu genellikle büyülü görünür: agent'lar işi böler, birbirlerini öngörür, fazlalıktan kaçınır. Genellikle bu "ortaya çıkış" prompt mühendisliğinin bir artifact'sidir - birisi agent'lara "koordine olmalarını" söylemiştir. prompt'u kaldırın, koordinasyonu kaldırın.

Riedl'ın 2025 bulgusu daha katı: kontrollü koşullar altında, koordinasyon yalnızca agent'lar **diğer agent'larin zihinleri** (ZK) hakkında muhakeme yapmaya promptedildiğinde ortaya çıkar. ZK prompt olmadan, güçlü modeller bile istatistiksel kontrollerden sağ çıkamayan koordinasyon kalıpları gösterir. Bu, üretim açısından önemlidir: Ekipler, prompt'a bağımlı ve kırılgan olan "çoklu-agent koordinasyon" özellikleri sunar.

Bu ders ZK'yı belirli bir yetenek (inançlar hakkında inançlar hakkında akıl yürütme) olarak ele alır, minimum ZK farkındalığını oluşturur agent ve gerçek koordinasyonun neye benzediğini ve prompt giyinmenin neye benzediğini ölçer.

## Konsept

### ZK ne anlama geliyor

Gelişim psikolojisi: 3 yaşındaki bir çocuk herkesin iç dünyasının kendisininkiyle eşleştiğini düşünüyor. 5 yaşındaki bir çocuk başkalarının farklı inançlara sahip olduğunu anlar. 7 yaşındaki bir çocuk inançlarla ilgili inançlarla ilgili gerekçeler sunuyor ("topun bardağın altında olduğunu düşündüğümü düşünüyor"). Bunlar sıfırıncı, birinci ve ikinci derece ZK'dır.

LLM agent'lar için ToM siparişleri şu şekilde eşlenir:

- **Sıfırıncı derece:** diğerlerinin modeli yok. agent yalnızca kendi gözlemlerine göre hareket eder.
- **Birinci derece:** agent birbirlerinin agent inançlarının bir modeline sahiptir. "Alice X'e inanıyor."
- **İkinci derece:** agent yinelenen inançları modeller. "Alice, Bob'un X'e inandığına inanıyor."

Li ve diğerleri. 2023, birinci ve ikinci dereceden ZK'nın LLM agent'larde işbirlikçi oyunlarda ortaya çıktığını, ancak uzun ufuk ve güvenilmez iletişimle bozulduğunu buldu.

### Kısaca Sally-Anne testi

1985'te yapılan bir yanlış inanç testi: Sally A sepetine bir bilye koyuyor ve çıkıyor. Anne onu sepet B'ye taşıyor. Sally döndüğünde nereye bakacak? Birinci dereceden ZK'sı olan bir çocuk sepet A diyor (Sally'nin inancı gerçeklikten farklı). Olmayan bir çocuk sepet B diyor.

GPT-4 dönemi Yüksek Lisans'ları, açıkça ifade edildiğinde Sally-Anne tarzı testleri geçiyor. Anlatı uzun olduğunda, sahne birkaç kez değiştiğinde veya soru dolaylı olarak ifade edildiğinde başarısız olurlar. Üretim Yüksek Lisansında ZK'nin pratik 2026 durumu budur.

### Riedl'in koordinasyon ölçümü

Riedl (arXiv:2510.05174) popülasyon ölçeğinde bir test oluşturdu: N agents, ortak bir amaç, değişken prompt koşullar. Ölçüm:

1. **Kimliğe bağlı farklılaşma.** agent'lar zaman içinde istikrarlı rol ayrımları geliştirir mi?
2. **Hedefe yönelik tamamlayıcılık.** agent'larin eylemleri birbirini kopyalamak yerine birbirini tamamlıyor mu (farklı alt görevler)?
3. **Üst düzey sinerji.** Grubun hiçbir alt kümenin başaramadığı başarıyı elde edip edemediğini gösteren istatistiksel bir ölçüm.

Sonuç: yalnızca ZK prompt koşulu altında üç metriğin tümü taban çizgisinin üzerinde sinyal üretir. ZK prompting olmadan, metrikler orta kapasiteli modeller için şansa yakın durur. Büyük modeller açık ZK prompt'leme olmadan bir miktar koordinasyon gösterir ancak etki açık prompt'lemeden daha küçüktür.

### Koordinasyon yanılsaması

İstatistiksel kontroller olmadan, demolardaki "ortaya çıkan koordinasyon" genellikle şunları yansıtır:

- Koordinasyon içinde çalışan Prompt mühendislik ("birlikte çalışın" diyen sistem prompt'lar).
- Gözlemci önyargısı (beklediğimiz modelleri görüyoruz).
- Başarılı çalışmaların post-hoc seçimi.

Ölçülebilir bir sinyal olmaksızın "ortaya çıkan koordinasyonu" pazarlayan üretim sistemleri, pazarlama olarak değerlendirilmelidir. Hak talebinde bulunmadan önce ölçün.

### Minimum ZK farkındalığına sahip bir agent

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

`other_models` özelliği ToM durumudur. Birinci dereceden ZK sadece bir seviyede kalır. İkinci dereceden ekler `other_models[i][other_models_of_j]` — benim agent i'nin agent j'nin inandığını düşündüğüm şey.

### Uzun ufuk neden acı verir

Li ve diğerleri. belge: bağlam sınırları agent'ların hangi inancın kime ait olduğunu unutmasına neden olur. Halüsinasyon, diğer-agent modellerine yanlış inançlar ekler. Her ikisi de zamanla artan "X düşündüğünü sanıyordum" hataları üretiyor.

Belgede ve 2024-2026 takiplerinde belgelenen azaltımlar:

- **prompt'da açık ZK durumu.** Yapılandırılmış format: `{agent_id: belief_list}`. Kimlik-inanç bağını korumak için geri çağırmayı zorlar.
- **Daha kısa muhakeme zincirleri.** Tur başına daha az ZK güncellemesi, bileşik halüsinasyonu azaltır.
- **Harici ZK deposu.** Modeli Yüksek Lisans bağlamı dışında tutun; tur başına yalnızca ilgili parçaları enjekte edin.

### Üretimde ZK'nin başarısız olduğu yer

- **Düşmanca ayarlar.** İyi ZK'ye sahip Agent'lerin manipüle edilmesi daha kolaydır (onların sizin hakkınızda modelini modelleyebilir, sonra da istismar edebilirsiniz).
- **Heterojen takımlar.** Modeller farklı olduğunda, tek bir rakip için çalışan ZK modeli genelleme yapmaz.
- **Temel gerçeğe dayalı görevler.** ZK inançlarla ilgilidir; doğruluk gerçeklere bağlıysa ZK dikkat dağıtıcı olabilir.

### Gerçekten ölçebileceğiniz koordinasyon

Bir takımın koordinasyonunun prompt-giydirilmiş olmaktan ziyade gerçek olduğuna dair üç pratik sinyal:

1. **Zaman içinde tamamlayıcılık.** Çok turlu bir görevde, agent'ların eylemleri ayrık alt görevleri kapsıyor mu?
2. **Beklenti.** agent A'nın T+1 virajındaki hareketi, B'nin T+2 virajındaki hareketi hakkında doğru çıkan bir tahmine mi bağlı?
3. **Düzeltme.** A, B'nin inancını T virajında ​​yanlış okuduğunda, A, T+2 virajında ​​düzeltme yapar mı?

Bunlar, kayıtlı bir çoklu-agent sisteminde ölçülebilir. Bunlar "koordinasyon" anlatısının asıl versiyonudur.

## Build It — Kendin Geliştir

`code/main.py` şunu uygular:

- `ToMAgent` — kendi inançlarını ve başkalarına göre-agent inanç modellerini izler.
- İşbirliğine dayalı bir görev: üç agent, üç kutudan üç token toplamalıdır; her kutu bir token tutabilir. Agent'lar iletişim kuramıyor; birbirlerinin eylemlerinden niyet çıkarırlar.
- İki konfigürasyon: `zeroth_order` (ZK yok) ve `first_order` (tek seviyeli inanç modeliyle ZK).
- 200'den fazla rastgele denemenin ölçümü: tamamlanma oranı, çoğaltma oranı (aynı kutuyu hedefleyen iki agents), tamamlanmaya kadar ortalama dönüşler.

Koşmak:

```
python3 code/main.py
```

Beklenen çıktı: ~%35 oranında sıfırıncı dereceden agent tekrarlanan çaba ve denemelerin ~%60'ını 10 turda tamamlamak. Birinci derece ZK agent'lar ~%5 oranında kopyalanır ve ~%95 oranında tamamlanır. Delta ölçülebilir koordinasyon etkisidir.

## Use It — Hazır Araçla Uygula

`outputs/skill-tom-auditor.md` , çokluagent sistemin "acil koordinasyon" iddiasını denetleyen bir beceridir. prompt pansumanını, bir kontrole göre istatistiksel anlamlılığı ve ölçülen tamamlayıcılığı kontrol eder.

## Ship It — Kullanıma Sun

Koordinasyon talepleri kontrol listesi:

- **Kontrol koşulu.** Sisteminizin prompt koordinasyonu olmayan bir versiyonu. Her ikisini de ölçün.
- **İstatistiksel test.** Sistem ve kontrol arasındaki fark, metriğinize göre `p < 0.05` noktasında anlamlı mı?
- **Tamamlayıcılık ölçüsü.** Yalnızca nihai başarı değil, zaman içinde eylem ayrılığı.
- **Arıza durumu günlüğü.** agentyanlış koordinatlandırıldığında ZK durumu nasıl görünür?
- **Model kapasitesinin açıklanması.** Daha küçük modellerde etki ortadan kalkıyorsa bunu söyleyin.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Birinci dereceden ZK'nin çoğaltma oranını ~7 kat azalttığını doğrulayın. 5 agent ve 5 kutuya ölçeklendirdiğinizde boşluk devam ediyor mu?
2. İkinci dereceden ZK'yi uygulayın (agent A, B'nin C hakkında ne düşündüğünü modeller). Birinci sıraya göre gelişiyor mu? Hangi görevlerde?
3. ZK durumuna bir **halüsinasyon** enjekte edin: tur başına bir inancı rastgele çevirin. Bu birinci derece performansı ne kadar düşürür?
4. Li ve ark.'nı okuyun. (arXiv:2310.10701). "Uzun ufuk bozulması" bulgusunu yeniden üretin: Sıralar 10'dan 30'a çıktıkça, birinci derece ZK performansınız nasıl değişiyor?
5. Riedl 2025'i okuyun (arXiv:2510.05174). Yüksek dereceli sinerji istatistiğini simülasyon günlüklerinize uygulayın. Etki ZK prompt koşulu olmadan mevcut mu?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Zihin Teorisi | "Başkalarının Zihnini Anlamak" | Başka bir agent'ın inançlarını modelleme kapasitesi. Sıraya göre derecelendirilir (0, 1, 2+). |
| Sally-Anne testi | "Yanlış inanç testi" | 1985 gelişim psikolojisi; Yüksek Lisans'lar sade versiyonları geçer, karmaşık versiyonlarda başarısız olur. |
| Birinci dereceden ZK | "A X'e inanıyor" | Birbirlerinin gerçekler hakkındaki inançlarını modellemek. |
| İkinci dereceden ZK | "A, B'nin X'e inandığına inanıyor" | Özyinelemeli modelleme bir seviye daha derindir. |
| Kimliğe bağlı farklılaşma | "Zaman içinde rollerin istikrarlı olması" | Riedl'in metriği: roller kalıcıdır, rastgele değil. |
| Hedefe yönelik tamamlayıcılık | "Ayrık eylemler" | Agent'lar aynı alt görevleri değil, farklı alt görevleri hedefler. |
| Yüksek dereceli sinerji | "Grup tüm alt kümeleri aşıyor" | Gerçek koordinasyon için Riedl'in istatistiksel ölçüsü. |
| Koordinasyon yanılsaması | "Koordineli görünüyor" | Prompt-ölçülebilir bir sinyal olmaksızın giyimli koordinasyon görünümü. |

## Daha Fazla Okuma

- [Li ve ark. — Büyük Dil Modelleri aracılığıyla ÇokluAgent İşbirliği için Zihin Teorisi](https://arxiv.org/abs/2310.10701) — işbirlikçi oyunlarda ortaya çıkan ZK; uzun ufuk arıza modları
- [Riedl — ÇokluAgent Dil Modellerinde Acil Koordinasyon](https://arxiv.org/abs/2510.05174) — nüfus ölçeğinde ölçüm; ZK prompting yük taşıma durumudur
- [Premack & Woodruff — Şempanzenin bir zihin teorisi var mı?](https://www.cambridge.org/core/journals/behavioral-and-brain-sciences/article/does-the-chimpanzee-have-a-theory-of-mind/1E96B02CD9850E69AF20F81FA7EB3595) — ZK kavramının 1978'deki kökeni
- [Baron-Cohen, Leslie, Frith — Otistik çocuğun bir zihin teorisi var mı?](https://doi.org/10.1016/0010-0277(85)90022-8) — Sally-Anne makalesi (1985)
