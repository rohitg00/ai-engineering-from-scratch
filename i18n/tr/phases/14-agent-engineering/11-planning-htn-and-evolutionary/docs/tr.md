# HTN ve Evrim Araştırması ile Planlama

> Simbolik planlama, planın kanıtlanabilir doğru olduğu durumları ele alır. Evolyyonel kod arama, fitness fonksiyonunun makine kontrol edilebileceği durumları ele alır. ChatHTN (2025) ve AlphaEvolve (2025) LLM ile eşleştirildiğinde her birinin neyi açtığını gösterir.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 02 (ReWOO and Plan-and-Execute)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Yerarşik Görev Ağlarını Açıklayın: görevler, yöntemler, operatörler, ön koşullar, etkileri.
- ChatHTN'in hibrit döngüsü  LLM geri dönüş parçalanması ile sembolik aramaları tanımlayın.
- AlphaEvolve'in evrimsel döngüsünü ve neden sadece bir programatik değerlendirici ile çalışırken açıklayın.
- Oyuncak HTN planlayıcısı ve STDlib'de oyuncak evrimsel arama uygulaması.

## Sorun

ReWOO (Deneyim 02), Plan- ve- Yürütme ve ReAct çoğu ajan planlamasını kapsar.

1. **Plans with provable correctness.**Programlama, uçuş yolu, uyumluluk iş akışları  planın yapısal olarak sağlam olması gerekir.
2. **Optimizations with a machine-checkable fitness function.**Matrix çarpımı, programlama heuristikleri, kompiliç geçişi  hedef "doğru bir plan" değil "en iyi plan"dır.

HTN planlaması ve AlphaEvolve iki farklı sorunu çözüyor.

## Anlaşım

### Yerarşik Görev Ağı

HTN:

- **Tasks** bileşik (bozulması gereken) ve ilkel (birbirle çalıştırılabilir).
- **Methods** bir karmaşık görevi ön koşullarla alt görevlere ayırmanın yolları.
- **Operators** Ön koşulları ve etkileri olan ilkel eylemler.
- **State** bir dizi gerçek.

Planlama: bir hedef görevi ve bir başlangıç durumunu vererek, ön koşulları sıradan olarak karşılanan ilkel operatörlere bir parçalanma bul.

HTN, LLM'lerden daha eski ve hala kanıtlanabilir doğru planlar için bir referans.

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) sembolik HTN ile LLM sorularını birbirine bağlar:

1. Mevcut karma görevi mevcut yöntemlerle parçalamaya çalışın.
2. Eğer hiçbir yöntem kullanılmazsa, LLM'ye sor: "Nasıl parçalanırsın?`task`Devletten`s`"Bunu nasıl yapabilirim?"
3. LLM cevabını aday alt görevlere çevirin.
4. Operatör şeması ile doğrulanır; geçersiz parçalanmalar reddedilmektedir.
5. Tekrar yap.

Makale'nin merkezi iddiası: üretilen her plan kanıtlanabilir sağlamdır çünkü LLM önerileri yalnızca aday parçalanmalar olarak girer, asla doğrudan plan düzenlemeleri olarak girmez.

Online yöntem öğrenimi (OpenReview `gwYEDY9j2x`, 2025 takip) LLM üretilen parçalanmaları geri dönüş yoluyla genelleştiren bir öğrenci ekler  LLM sorgu sıklığını %75'e kadar azaltır.

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, Haziran 2025) farklı bir canavar: Gemini 2.0 Flash/Pro ansambli tarafından düzenlenen evrimci kod arama.

Çubuk:

1. Bir tohum programı + program değerlendirici ile başlayın (fitness puanını gönderir).
2. LLM'lerin birliği mutasyon önerir.
3. Mutasyonları değerlendiriciyle geçirin.
4. En iyisini tut, tekrar mutasyon yap.

Yayınlanan kazançlar:

- Strassen'in 4x4 kompleks matris çarpımı için 56 yıl içinde ilk iyileşme (48 skalar çarpım).
- %0,7'i, bir Borg programlama heuristiği ile Google hesaplarını kurtarmış.
- Sınırlı bir iş yükünde FlashAttention'un hızlanması %32'dir.

Zor kısıtlama: fitness fonksiyonu makine kontrol edilebilir olmalıdır.

### Ne zaman kullanılır

| Problem class | Use | Why |
|---------------|-----|-----|
| Scheduling with hard constraints | HTN + ChatHTN | Provable soundness |
| Compiler optimization | AlphaEvolve | Machine-checkable fitness |
| Multi-step task execution | ReAct / ReWOO | LLM in the loop, no formal guarantees |
| Code improvement with tests | AlphaEvolve | Tests are the evaluator |
| Policy-bound automation | HTN | Preconditions encode policy |

### Bu kalıp yanlış gittiğinde

- **HTN without operators.**Ön koşul/etki şemeleri olmadan sağlamlık iddiası çökür. ChatHTN'in "LLM parçalanmayı önerir" şeması geçersiz hareketleri reddetmeyi gerektirir.
- **AlphaEvolve without a real evaluator.**"Kodu daha iyi mi diye LLM'ye sor" fitness fonksiyonu değildir. değerlendirici belirleyici ve hızlı olmalıdır.
- **Over-engineering.**Çoğu ajan görevi de gerekmez.

```figure
htn-tree-expand
```

## Yapın

`code/main.py`İki oyuncak kullanıyor:

- Operatörler, yöntemler, ön koşullar, etkileri ve bir `LLMFallback`Bu, bir karmaşık görev ile hiçbir yöntem eşleşmediğinde çalışmaya başlıyor. "LLM" bir senaryolı parçalanıcıdır, bu yüzden planlayıcı çevrimdışı çalışmaktadır.
- Aritmetik programları üzerinde bir evrimsel arama: çıkışını en aza indirgenmiş ifadeyi büyütmek`|f(x) - target|`değerlendirici belirleyici.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz HTN planlayıcısının bir karmaşık görevi (orta plan LLM geri dönüşü ile) ve evrimsel döngüün hedef bir ifade üzerinde birleşmesini gösterir.

## Kullan

- **HTN planners** `pyhop`- Evet .`SHOP3`Ya da alanlardaki politikaların uygulanması için kendi yapınız.
- **ChatHTN** araştırma kodu; örneği (simbolik + LLM geri dönüş) herhangi bir HTN planlayıcısına temiz bir şekilde aktarır.
- **AlphaEvolve** DeepMind kağıdı; örneği (ensemble + evaluator) yeniden üretilebilir. OpenEvolve ve benzeri açık kaynak çatalları ortaya çıkmaktadır.
- **Agent frameworks** henüz birinci sınıf HTN veya AlphaEvolve'i göndermeyin.

## Gönder

`outputs/skill-hybrid-planner.md`LLM rolünün açıkça kapsamına sahip bir hibrit planlama asası (HTN veya evrimsel) oluşturur.

## Egzersizler

1. HTN planlayıcısını geriye doğru izleme ile uzatın: bir operatörün koşulu çalıştırma sırasında başarısız olduğunda, geri dönüp bir sonraki yöntemi deneyin.
2. ChatHTN ' e LLM-metod kaşını ekleyin: LLM görevleri çözerken `T`Devlet biçiminde `P`Sonraki görüşmede yöntem kütüphanesini kontrol et.
3. Evrimsel arama değerlendiricisini gerçek bir test kümesine değiştirin. 20 test vakalarını geçen bir sıralama fonksiyonunu geliştirin; nesillerin konverjense raporunu yapın.
4. AlphaEvolve'in değerlendirici tasarım notlarını okuyun. İlgilendiğiniz bir alan için değerlendirici tasarlayın (SQL sorgu optimizasyonu, test-suite en azlaştırması, dağıtım YAML).
5. Birleştir: bir karmaşık görevi alt görevlere ayırmak için HTN kullanın, sonra her alt görevin ilkel operatöründe evrimsel arama kullanın. Nerede parlıyor, nerede aşırı mühendislik yapıyor?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| HTN | "Hierarchical planner" | Task decomposition with operators, preconditions, effects |
| Method | "Decomposition rule" | Way to break a compound task into subtasks |
| Operator | "Primitive action" | Concrete step with precondition and effect |
| ChatHTN | "LLM + HTN" | Symbolic planner asks LLM when no method matches |
| AlphaEvolve | "Evolutionary code search" | Ensemble LLMs mutate code; deterministic evaluator selects |
| Fitness function | "Evaluator" | Deterministic, machine-checkable score over outputs |
| Online method learning | "Cached LLM decomposition" | Store + generalize LLM plans to cut query cost |

## Daha Fazla Okumak

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) sembolik + LLM hibrit planlayıcısı
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) LLM mutasyonları ile evrimsel kod arama
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Bir planlamacıya karşı basit bir döngüye ne zaman ulaşmak
