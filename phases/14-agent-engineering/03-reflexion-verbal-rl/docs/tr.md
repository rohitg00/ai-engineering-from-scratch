# Yansıma: Sözel Takviyeli Öğrenme

> Gradient tabanlı RL'nin, bir arıza modunu düzeltmek için binlerce denemeye ve bir GPU kümesine ihtiyacı vardır. Reflexion (Shinn ve diğerleri, NeurIPS 2023) bunu doğal dilde yapar: Her başarısız denemeden sonra, agent bir yansıma yazar, bunu epizodik hafızada saklar ve bir sonraki denemeyi bu hafızaya göre koşullandırır. Bu, Letta'nın uyku zamanı hesaplamasının, Claude Code'un CLAUDE.md öğrenmelerinin ve iş akışı yanlısı öğrenme kuralının arkasındaki modeldir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 01 (Agent Loop), Aşama 14 · 02 (ReWOO)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Yansımanın üç bileşenini (Aktör, Değerlendirici, Kendini Yansıtan) ve olaysal belleğin rolünü adlandırın.
- İkili değerlendirici, yansıma arabelleği ve yeni yeniden denemelerle bir stdlib Reflexion döngüsü uygulayın.
- Belirli bir görev için skaler, buluşsal ve kendi kendini değerlendiren geri bildirim kaynakları arasından seçim yapın.
- gradient tabanlı RL'nin düzeltmek için binlerce denemeye ihtiyaç duyduğu hataları neden sözlü takviyenin yakaladığını açıklayın.

## Sorun

Bir agent bir görevde başarısız olur. Standart RL'de binlerce deneme daha yapar, gradient'leri hesaplar, ağırlıkları güncellersiniz. Pahalı, yavaş ve çoğu üretime sahip agent'lerin her arıza için bir eğitim bütçesi yoktur.

Reflexion (Shinn ve diğerleri, arXiv:2303.11366) farklı bir soru sorar: Peki ya agent neden başarısız olduğunu düşünse ve prompt'de bu düşünceyle tekrar denese? Ağırlık güncellemesi yok. gradient yok. Denemeler arasında saklanan sadece doğal dil.

Sonuç: ALFWorld'de ReAct'ı ve diğer ince ayar yapılmamış temel çizgileri geride bırakıyor. HotpotQA'da ReAct'e göre daha iyi olur. Kod oluşturmada (HumanEval/MBPP), o zamanki en son teknolojiyi belirler. Hepsi tek bir gradient adımı olmadan.

## Konsept

### Üç bileşen

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Artı bir veri yapısı:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Bir deneme Aktör'ü çalıştırır. Değerlendirici bunu puanlar. Puan düşükse, Öz-Yansıtıcı bir yansıma üretir ("Yanlış aracı seçtim çünkü soruyu Y hakkında sorurken X hakkında sorulduğu şeklinde yanlış okudum"). Yansıma olaysal belleğe gider. Bir sonraki deneme yeni başlıyor ancak yansımasını görüyor.

### Üç değerlendirici türü

1. **Skaler** — harici bir ikili sinyal. ALFWorld başarılı ya da başarısız. HumanEval testleri başarılı veya başarısız. En basit, en yüksek sinyal.
2. **Sezgisel** — önceden tanımlanmış hata imzaları. "agent aynı eylemi art arda iki kez gerçekleştirdiyse sıkışmış olarak işaretleyin." "Yörünge 50 adımı aşarsa verimsiz olarak işaretleyin."
3. **Kendi kendini değerlendiren** — Yüksek Lisans kendi gidişatını belirler. Temel gerçek mevcut olmadığında gereklidir. Daha zayıf sinyal; araca dayalı doğrulamayla iyi bir şekilde eşleşir (Ders 05 - CRITIC).

2026 varsayılanı bir karışımdır: mevcut olduğunda skaler, olmadığında kendi kendine değerlendirme, güvenlik rayları olarak buluşsal yöntem.

### Bu neden genelleşiyor?

Yansıma, adlandırılmış bir model kadar yeni bir algoritma değildir. Neredeyse her üretim "kendi kendini onaran" agent bazı varyantları çalıştırır:

- Letta'nın uyku zamanı hesaplaması (Ders 08): ayrı bir agent geçmiş konuşmaları yansıtır ve bellek bloklarına yazar.
- Claude Code'un `CLAUDE.md` / "belleği kaydet" modeli: öğrenmeler olarak kaydedilen ve gelecek oturumlara eklenen yansımalar.
- iş akışı yanlısı `/learn-rule` komutu: açık kurallar olarak yakalanan düzeltmeler.
- LangGraph'ın yansıma düğümleri: çıktıyı puanlayan ve gerekirse iyileştirmeye yönlendiren bir düğüm.

Hepsi aynı anlayıştan kaynaklanıyor: Doğal dil, "başarısızlıktan öğrendiklerimi" çalıştırmalar arasında taşıyacak kadar zengin bir ortamdır.

### Ne zaman çalışıyor ve ne zaman çalışmıyor

Yansıma şu durumlarda çalışır:

- Açık bir arıza sinyali var (test hatası, alet hatası, yanlış cevap).
- Görev sınıfı tekrarlanabilir (aynı türde soru tekrar sorulabilir).
- Yansımanın gidişatını iyileştirecek alan var (yeterli eylem bütçesi).

Düşünme şu durumlarda yardımcı olmaz:

- agent zaten ilk denemede başarılı oluyor.
- Arıza haricidir (ağ arızası, araç arızalı) — "ağ arızası" üzerine düşünmek gelecekteki çalıştırmalara yardımcı olmaz.
- Düşünce batıl inanca dönüşüyor; tek seferlik tuhaf bir koşuyla ilgili bir anlatıyı saklıyor.

2026'nın tehlikesi: hafızanın çürümesi. Yansımalar birikir; bazıları eski ya da yanlıştır; Bölümsel arabellek büyüdükçe yeniden çalıştırmalar yavaşlar. Azaltma: periyodik sıkıştırma (Ders 06), yansımalarda TTL veya ayrı bir uyku zamanı temizliği agent (Letta).

```figure
react-trace
```

## İnşa Et

`code/main.py`, Reflexion'ı bir oyuncak yapboz üzerinde uyguluyor: toplamı bir hedefi veren 3 öğeli bir liste üretin. Aktör aday listelerini yayınlıyor; Değerlendirici toplamı kontrol eder; Kendini Yansıtan, neyin yanlış gittiğine dair bir satır yazıyor. Yansıma bir sonraki deneme için olaysal belleğe gider.

Bileşenler:

- `Actor` — yansımaları gördüğünde iyileşen, yazılı bir politika.
- `Evaluator.binary()` — hedef toplam üzerinde başarılı/başarısız.
- `SelfReflector` — arızanın tek satırlık teşhisini oluşturur.
- `EpisodicMemory` — TTL anlambilimine sahip sınırlı bir liste.

Çalıştır:

```
python3 code/main.py
```

İz üç denemeyi gösteriyor. Deneme 1 başarısız olur, bir yansıma saklanır, deneme 2 yansımayı görür ve iyileşir ancak yine de başarısız olur, deneme 3 başarılı olur. Temel bir çalışmayla karşılaştırın (yansıtma yok) - deneme 1'in cevabında takılıp kalıyor.

## Kullan onu

LangGraph yansımayı bir düğüm deseni olarak gönderir. Claude Code'un `/memory` komutu ve iş akışı yanlısı `/learn-rule`, epizodik arabelleği bir işaretleme dosyası olarak dışsallaştırır. Letta'nın uyku zamanı hesaplaması, kapalı kalma süresinde Self-Reflector'ı çalıştırır, böylece birincil agent gecikmeye bağlı kalır. OpenAI Agent SDK'sı Reflexion'u doğrudan göndermez; onu, yörüngeleri puana göre reddeden özel bir Korkuluk ve koşular boyunca hayatta kalan bir `Session` hafıza ile inşa edersiniz.

## Gönderin

`outputs/skill-reflexion-buffer.md` yansıma yakalama, TTL ve veri tekilleştirme özelliklerine sahip epizodik bir arabellek oluşturur ve sürdürür. Bir görev sınıfı ve bir başarısızlık göz önüne alındığında, bir sonraki denemeye gerçekten yardımcı olacak bir yansıma yayar (genel bir "daha dikkatli ol" değil).

## Egzersizler

1. İkili değerlendirmeden mesafe ölçüsünü (hedeften ne kadar uzakta) döndüren skaler değerlendiriciye geçin. Daha hızlı mı birleşiyor?
2. Yansımalara 10 denemeden oluşan bir TTL ekleyin. Bu noktadan sonra eski düşünceler acı verir mi yoksa yardımcı olur mu?
3. Sezgisel değerlendiriciyi uygulayın: aynı eylem tekrarlanırsa denemeyi takılıp kalmış olarak işaretleyin. Bu, Kendini Yansıtıcı ile nasıl etkileşime giriyor?
4. Yansımaları göz ardı eden rakip bir Aktör ile Reflexion'ı çalıştırın. Oyuncuyu bunları fark etmeye zorlayan minimum yansıma prompt mühendisliği nedir?
5. AlfWorld hakkındaki Reflexion makalesinin 4. Bölümünü okuyun. %130'luk başarı oranındaki iyileşmeyi kavramsal olarak yeniden üretin: Vanilya ReAct'e karşı anahtar delta nedir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Yansıma | "Kendi kendini düzeltme" | Shinn ve diğerleri. 2023 — Aktör, Değerlendirici, Kendini Yansıtan ve epizodik hafıza |
| Sözlü takviye | "gradient'ler olmadan Öğrenme" | Bir sonraki denemenin prompt |
| Epizodik hafıza | "Görev başına yansımalar" | Bir görev sınıfı için önceki yansımaların sınırlı arabelleği |
| Skaler değerlendirici | "İkili başarı sinyali" | Başarılı/başarısız veya temel gerçeğe dayalı sayısal puan |
| Sezgisel değerlendirici | "Desen tabanlı dedektör" | Önceden tanımlanmış hata imzaları (e.g. sıkışmış döngü, çok fazla adım) |
| Öz değerlendirici | "Yargıç olarak yüksek lisans kendi izinde" | Temel gerçek olmadığında düşük sinyal geri dönüşü — araca dayalı doğrulamayla eşleştirin |
| Bellek çürümesi | "Bayat yansımalar" | Epizodik arabellek eski girdilerle dolar; sıkıştırma/TTL ile düzeltme |
| Uyku zamanı yansıması | "Async kendini yansıtma" | Birincil agent'nin hızlı kalması için Self-Reflector'ı sıcak yolun dışında çalıştırın |

## Daha Fazla Okuma

- [Shinn ve diğerleri, Reflexion: Sözlü Takviyeli Öğrenme ile Dil Agents (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) — standart makale
- [Letta, Uyku Zamanı Hesaplaması](https://www.letta.com/blog/sleep-time-compute) — üretimde eşzamansız yansıma
- [AI agent'ler için Antropik, Etkili bağlam mühendisliği](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — bağlamın bir parçası olarak epizodik arabelleği yönetme
- [LangGraph'a genel bakış](https://docs.langchain.com/oss/python/langgraph/overview) — yansıma düğümü modeli
