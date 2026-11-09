# Düşünceler: Sözlü Güçlendirme Öğrenimi

> Gradient tabanlı RL'nin bir başarısızlık modunu düzeltmek için binlerce deneme ve GPU kümesine ihtiyacı var. Refleksiyon (Shinn et al., NeurIPS 2023) bunu doğal dilde yapar: her başarısız denemeden sonra, ajan bir refleksiyon yazar, bölümlü hafızalarda saklar ve sonraki denemeyi o hafıza üzerinde koşullar oluşturur. Letta'nın uyku zaman hesaplaması, Claude Code'un CLAUDE.md öğrenmeleri ve pro-workflow öğrenme kuralı arkasındaki model bu.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 02 (ReWOO)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Refleksyon'un üç bileşenini (Aktör, Değerlendirici, Öz-Refleksör) ve bölümsel hafızanın rolünü söyleyin.
- İkili değerlendirici, refleksyon tamponu ve yeni yeniden denemeler ile stdlib Reflexsion döngüsünü uygulayın.
- Bir görev için skalar, heuristik ve kendi kendine değerlendirilmiş geri bildirim kaynakları arasında seçim yapın.
- Sözlü güçlendirme neden gradient tabanlı RL'nin düzeltmesi için binlerce deney gerektirdiği hataları yakalar açıklayın.

## Sorun

Bir ajan bir görevi başarısız eder. Standart RL'de binlerce deney daha çalıştırır, hesaplama gradientleri, güncelleme ağırlıkları. Pahalı, yavaş ve çoğu üretim ajanının her başarısızlık için eğitim bütçesi yoktur.

Refleksyon (Shinn et al., arXiv:2303.11366) farklı bir soru sorar: Ya ajan neden başarısız olduğunu düşünüp tekrar deneseydi?

Sonuç: ALFWorld'de ReAct ve diğer ince ayarlanmamış temel çizgilerden daha iyi. HotpotQA'da ReAct'ten daha iyi. Kod üretimi (HumanEval/MBPP) için o anda en son teknolojiyi belirler.

## Anlaşım

### Üç bileşen

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

Bir veri yapısı da var:

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

Bir deney Actor'a çalışır. Değerlendirici onu puanlar. Eğer puan düşükse, Self-Reflector bir yansıma üretir ("Y hakkında sorarken soruyu sormak gibi yanlış bir şekilde okuduğum için yanlış araç seçtim"). Yansıma bölüm hafızasına gider.

### Üç değerlendirici türü

1. **Scalar** dış ikili sinyal. ALFWorld başarılı veya başarısız. HumanEval testleri geçer ya da başarısız. En basit, en yüksek sinyal.
2. **Heuristic** önceden belirlenmiş başarısızlık imzası. "Eğer ajan aynı eylemyi iki kez sırayla gerçekleştirdiyse, sıkışmış olarak işaretleyin". "Eğer yörüngenin 50 adımdan fazlası varsa, verimsiz olarak işaretleyin".
3. **Self-evaluated** LLM kendi trajektörünü değerlendirir. Temel gerçeklik bulunmadığında gereklidir. Zayıf sinyal; araç temelli doğrulama ile iyi eşleşir (Denevi 05  CRITIC).

2026 standart bir karışım: mevcut olduğunda skalar, bulunmadığında kendi kendine eşit, güvenlik rayları olarak heuristik.

### Neden bu genelleştirildi

Refleksiyon yeni bir algoritma değil, isimli bir örnektir.

- Letta'nın uyku zamanı hesaplaması (Denevi 08): ayrı bir ajan geçmiş konuşmaları yansıtır ve hafıza bloklarına yazar.
- Claude Code's'ın `CLAUDE.md`/ "hatırayı koru" örneği: öğrenme olarak kaydedilen yansımalar, gelecek seanslara hazırlanmıştır.
- İş akışı için `/learn-rule`Komut: Açık kural olarak kaydedilen düzeltmeler.
- LangGraph'in yansıtıcı düğümleri: Gerekirse geliştirmek için çıkış ve rotaları notlayan bir düğüm.

Hepsi aynı anlayıştan kaynaklanır: Doğal dil, "başarısızlıktan öğrendiklerimi" yarışlar arasında taşımak için yeterince zengin bir araçtır.

### Ne zaman işe yarıyor ne zaman işe yaramadı

Düşünce, aşağıdakilerde çalışır:

- Açık bir hata sinyali var (test başarısızlığı, araç hatası, yanlış cevap).
- Görev sınıfı yeniden üretilebilir (aynı soruyu tekrar sorabilirsiniz).
- Bu düşünce, yolumu iyileştirmek için yer var (yeterli bir eylem bütçesi).

Düşününce:

- Ajan ilk denemede zaten başarılı oluyor.
- Başarısızlık dış (ağ çökmüş, araç bozulmuş)  "ağ çökmüştü" üzerinde yansıtma gelecekteki çalışmalar için yardımcı olmaz.
- Bu yansıma batıl inançlara dönüşür.

2026 tuzağı: hafıza çürüme. Yansımalar birikir; bazıları eskisidir veya yanlış; tekrar çalışmalar episodik tampon büyüdükçe yavaşlar. Yumuşatma: periyodik sıkıştırma (Denevi 06), yansımalar üzerinde TTL veya ayrı bir uyku zaman temizleme aracı (Letta).

```figure
react-trace
```

## Yapın

`code/main.py`Oyuncak bulmaca üzerinde Yönlendirme uyguluyor: bir hedefe toplam 3 element listesini oluşturur. Aktör aday listelerini yayınlar; değerlendirici toplamı kontrol eder; Self-Reflector yanlış giden şey hakkında bir satır yazar. Yönlendirme bir sonraki deneme için bölüm hafızasına gider.

Bileşenler:

- `Actor` bir politika, düşünceler gördüğünde gelişir.
- `Evaluator.binary()` Hedef miktarını geçmek/durdurdurmak.
- `SelfReflector` başarısızlığın tek hatalı bir teşhisini oluşturur.
- `EpisodicMemory` TTL semantikası ile sınırlı bir liste.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

İz üç deneme gösterir. 1 deneme başarısız, bir yansıma depolanır, 2 deneme yansımayı görür ve gelişir ama yine de başarısız olur, 3 deneme başarılı olur.

## Kullan

LangGraph, yansımayı düğüm örneği olarak gönderir.`/memory`Komutanlık ve pro-workflow'lar `/learn-rule`Letta'nın uyku zaman hesaplamaları Otomansı çalıştırır, böylece ana ajan gecikme sürecinde kalır. OpenAI Ajanlar SDK Refleksiyonu doğrudan göndermez; not ve hafıza ile trajektörleri reddeden özel Guardrail ile oluşturulur.`Session`Bu, yolculuklar boyunca hayatta kalır.

## Gönder

`outputs/skill-reflexion-buffer.md`bir görev sınıfı ve bir başarısızlık göz önüne alındığında, aslında bir sonraki deneme yardımcı olan bir yansıma yayar (generik bir "daha dikkatli olun" değil).

## Egzersizler

1. İkili değerlendiriciden, hedeften uzaklık ölçüsünü (ne kadar uzak) geri veren skalar değerlendiriciye geçin.
2. Yönlendirmeler için 10 deney TTL ekleyin.
3. Heuristik değerlendirici uygulamak: Aynı eylem tekrarlanırsa deneyi sıkışmış olarak işaretleyin. Bu, Self-Reflector ile nasıl etkileşim kurar?
4. Yansıtıcıları görmezden gelen bir düşman aktörle Refleksyon'u çalıştırın.
5. AlfWorld'deki Reflexion makalesinin 4. bölümünü okuyun. 130% başarının oranının konseptel olarak yeniden üretilmesi: Delta vs. Vanilla ReAct anahtarı nedir?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Reflexion | "Self-correction" | Shinn et al. 2023 — Actor, Evaluator, Self-Reflector plus episodic memory |
| Verbal reinforcement | "Learning without gradients" | Natural-language reflection prepended to the next trial's prompt |
| Episodic memory | "Per-task reflections" | Bounded buffer of prior reflections for one task class |
| Scalar evaluator | "Binary success signal" | Pass/fail or numeric score from ground truth |
| Heuristic evaluator | "Pattern-based detector" | Predefined failure signatures (e.g. stuck-loop, too-many-steps) |
| Self-evaluator | "LLM-as-judge on own trace" | Lower-signal fallback when no ground truth — pair with tool-grounded verification |
| Memory rot | "Stale reflections" | Episodic buffer fills with obsolete entries; fix with compaction/TTL |
| Sleep-time reflection | "Async self-reflection" | Run Self-Reflector off the hot path so primary agent stays fast |

## Daha Fazla Okumak

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) Kanonik kağıt
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) üretimdeki asinküs yansıması
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) Bölümlü tamponu bağlamın bir parçası olarak yönetmek
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Yansıma düğüm örneği
