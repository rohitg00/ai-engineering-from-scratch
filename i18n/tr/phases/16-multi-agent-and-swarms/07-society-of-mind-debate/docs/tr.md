# Zihn Topluluğu ve Çoklu Ajanlar Tartışması

> Minsky'nin 1986'daki önemi  zeka uzmanların bir toplumu  her on yılda yeniden keşfedilmektedir. 2023'te Du et al. onu bir somut algoritma haline getirdi: birden fazla LLM örneği cevaplar önerir, birbirlerinin cevaplarını okuyor, eleştirir ve güncelleir. N tur boyunca sıfır çekim CoT'yi yenen bir fikir birliği üzerine toplanır ve altı akıl ve gerçeklik görevleri üzerinde düşünme. İki bulgu önemlidir: her ikisi de **multiple agents**ve **multiple rounds**Toplum tek ajanlı bir monologtan, çok yönlü bir değişim tek atışla oy kullanmaktan daha iyidir.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Sorun

Kendi kendine tutarlılık  bir modelin birçok kez örnek alın ve çoğunlukla yanıt alın  en ucuz mantık geliştirme.

Tartışma doymayı bozar. Bir modelden N bağımsız örneklerin yerine, N ajanlar birbirlerinin mantıklarını okuyor ve gözden geçiriyor. Örnekler arasındaki ilişki düşüyor ( artık id değiller), ve id oylamalarının güvenle yanlış olduğu bir şekilde doğru olan bir dönüş noktası genellikle doğru olur.

## Anlam

### Du et al. 2023 algoritması

ArXiv:2305.14325 (ICML 2024):

1. N ajanların her biri soruya ilk bir cevap verir.
2. Ronde r = 2..R için: her ajan diğer ajanların r-1'li grup cevaplarını gösterir ve "buları göz önünde bulundurarak, güncellenmiş cevapınızı verin" sorulur.
3. R turlarından sonra, son cevapları çoğunlukla oylayın.

MMLU, GSM8K, biyografiler, MATH ve gerçeklik referansları üzerine yapılan kağıt testleri.

### İki bağımsız düğüm

Aynı kağıttan alınan ifadeler:

- **Agent count alone**Bir turda, N'nin çoğunluğu oy kullanır.
- **Round count alone**(Önce düşüncelerini gören 1 ajan)  refleksiyonun bilinen zayıflığını zor yardımcı olur.
- **Both together**Çoklu ajanlar arasındaki çoklu değişim kazancı artırır.

### Neden işe yarıyor?

İki mekanizma:

1. **Exposure to disagreement.**Bir ajan başka bir ajanın akıl zincirini farklı bir sonuca çıkarırken, ya haklı çıkarmak ya da güncellemek zorunda kalır. Her iki durumda da, yuvarlak r + 1 için bağlam yuvarlak r'den daha zengindir.
2. **Correlated error reduction.**Kendi kendine tutarlılık, tüm örnekler aynı modelden gelir, bu nedenle hatalar  güvenle yanlış bir cevap olarak ortalama ilişkilendirir. Farklı modeller veya farklı tohumlar ilişkilendirmeyi bozar. Farklı * tartışılmış görüşler* daha da ilişkilendirmeyi bozar.

### Çeşitli tartışma

A-HMAD ve ilgili takipler farklı ajanlar için *farklı temel modeller* kullanır. Llama + Claude + GPT tartışması, monokultur çöküşünü azaltır (Denevi 26) çünkü bir model ailesinin ilişkili hataları diğerleri tarafından paylaşılamıyor.

Yanlış taraf: bir tartışmalara katılan zayıf bir model, konsensüzi yanlış cevabına doğru sürükleyebilir (bakın "Çılgınlık yapmalı mıyız?", arXiv:2311.17371).

### NLSOM  129-Agent uzantısı

Zhuge et al. ("Doğal Dil Temelindeki Zihn Toplumlarında Zihn Fırtınaları", arXiv:2305.17066) bu fikri 129 üye topluma kadar ölçeklendirdi. Sonuç: uzmanlık ve kendi kendini organize etmek ölçekle ortaya çıkıyor ve sistem görsel soru cevaplama gibi görevlerde tek ajanı üstlenmektedir.

### Başarısızlık modları

- **Sycophancy cascade.**Tüm ajanlar en güvenli olan ajanı tercih eder. Tartışma en yüksek sesle çöker. Karşılıklı roller için teşvik ("bir ajan karşı pozisyonu tartışmalıdır") yardımcı olur.
- **Topic drift.**Birçok tur boyunca tartışmalar orijinal sorudan uzaklaşır.
- **Compute blowup.**N ajan × R turlar = N·R LLM çağrıları, her biri büyüyor bağlamı ile. 5 ajan, 5 tur tartışma büyüyor bağlamda 25 çağrıdır. Her soru için maliyet 10 x tek CoT çağrısı aşabilmektedir.

```figure
multi-agent-debate
```

## Yapın

`code/main.py`Her ajanın farklı (muhtemelen yanlış) bir cevapla başladığı bir matematik sorusu üzerinde 3 ajan × 3 tur tartışma yürütür. Ajanlar  her "daha" yazılarla komşuların cevaplarının ortalama bir yazılı güvenle ağırlıklandırıldığını belirterek yazılır.

Demo iki önemli etkeni gösteriyor:

- Tek bir değişim, ajanları doğru cevaba yaklaştırır.
- İkinci turdan sonraki ek turlarda düşen getiri gösterir (Du et al. plato ile eşleşir).

Çık:

```
python3 code/main.py
npx tsx code/main.ts
```

## Kullan

`outputs/skill-debate-configurator.md`Yeni bir görev için bir tartışma ayarlar: ajan sayısı, tur sayısı, heterogenlik (eşit model vs karışık), rol atama (simetrik vs. tek karşıtlık).

## Gönder

Eğer tartışmaya devam ederseniz:

- **Cap rounds at 3.**Du et al. 3 tur kazancın çoğunu yakalar.
- **Cap agents at 5.**5'in ötesinde bağlam ve maliyet baskısı vardır.
- **Heterogeneous by default.**Havuzda en az iki farklı model var.
- **Adversarial slot.**Bir ajan yine de anlaşmazlığa düştü.
- **Log every round.**Ortalama atışları gizleyen tartışma sistemleri debugging veya denetim yapılamaz.

## Egzersizler

1. Çık .`code/main.py`Bu da bir diğer yöntemi oluşturur.
2. Dördüncü bir ajan ekleyin, karşıtlıklı bir rol oynar: her zaman mevcut çoğunlukla aynı fikirde olmaz.
3. Bir turda anlaşma puanı (çoğunlukla verilen cevapta ajanların bölümü) ne zaman 1.0'a ulaşır ve bu "sağ"a eşdeğer mi?
4. Bölüm 4'ün ablationlarını okuyun. "Agent-only" vs. "Rounds-only" vs. "bütün" sonuçlarını bu kodla tekrarlayın.
5. "Çılgınlık yapmalı mıyız?" (arXiv:2311.17371) ve "doğru-robin" 'den öte iki tartışma varianını listede.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## Daha Fazla Okumak

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) İpucu kağıdı, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129-ajan NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) Referans değerleri tartışma çeşitleri
- [Debate project page](https://composable-models.github.io/llm_debate/) Du et al. ' nin kodu, demoları ve ablation detayları
