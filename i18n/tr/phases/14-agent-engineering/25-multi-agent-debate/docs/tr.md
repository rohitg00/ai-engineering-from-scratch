# Çoklu Ajanlar Aradışı ve İşbirliği

> Du et al. (ICML 2024, "Zihnlerin Topluluğu") bağımsız olarak cevaplar öneren N model örnekleri yürütür, sonra R turları üzerinde birbirlerini iterici olarak eleştirir. Gerçekliği, kural izlemeyi, mantıklamayı geliştirir.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Tartışma protokolünü açıklayın: N öneriler, R turlar, ortak bir cevap üzerinde birleşti.
- Tartışmaların neden gerçekleri, kuralları ve mantık yürütmeyi iyileştirdiğini açıklayın.
- Kısıtlı topolojiyi açıklayın: her tartışmanın birbirini görmesi gerekmez.
- Skenarlı bir LLM üzerinde tam ve nadir çeşitlerle bir stdlib tartışma uygulayın; token maliyetini doğruluğuna karşı ölçün.

## Sorun

Kendini Temizle (Denevi 05) kendini eleştiren bir modeldir  risk grup düşüncesi. CRITIC (Denevi 05) dış araçlarda eleştirileri temel alıyor  her zaman mevcut değildir. Tartışma üçüncü bir moduyla başlar: birden fazla durum, çapraz eleştiriler, anlaşmazlık yoluyla birleşme.

## Anlaşım

### Zihnlerin Topluluğu (Du et al., ICML 2024)

- N model örnekler aynı soruya bağımsız olarak cevaplar önerir.
- R turlarında, her model diğerlerinin önerilerini okuyor ve eleştirir.
- Modeller eleştirilere dayanarak cevaplarını güncelleyecekler.
- R turlarından sonra, dönüş yanıtını geri verin.

Orijinal deneyler, maliyet nedeniyle N=3, R=2 kullanıldı. Daha fazla ajan ve daha fazla zor sorun üzerinde yuvarlaklık ile doğruluk arttır (MMLU, GSM8K, Satranç Hareket Geçerliliği, biyografi jenerasyonu).

Çeşitli model kombinasyonları tek model tartışmasını yendi: ChatGPT + Bard birlikte > ya yalnız.

### Sparse topolojisi

"Sparse İletişim Topolojisi ile Çoklu Ajan Tartışmasını Geliştirmek" (arXiv:2406.11776, 2024-2025) tam bir ağ tartışmalarının her zaman optimal olmadığını gösterdi.

Etkileri:

- Tam ağ N=5, R=3 = 5 × 3 = 15 önerme, her bir okuma 4 eşya = 60 eleştirel çalışma.
- Yıldız N=5, R=3 (bir merkezi + 4 konuşma) = 15 önerme, konuşma sadece merkezi okuyor = 12 eleştirel operasyon.

### Tartışma yardımı sağladığında

- **Factuality.**Bağımsız önerilerde, çapraz kontrol halüsinasyonları azaltır.
- **Rule-following.**Satranç hareket geçerliliği  bir model bir kural kaçırır, diğerleri onu yakalar.
- **Open-ended reasoning.**Çoklu çerçeveler doğru cevabı daraltır.

### Tartışma acı verdiğinde

- **Latency-sensitive UX.**N × R seri çekimleri, geçicilik için yeterli olmayabilir.
- **Cost-sensitive scale.**Soru başına N × R simgesi.
- **Simple factual lookups.**Bir arama beş tartışmadan daha ucuz.

### 2026 pratik örnekler

- **Anthropic orchestrator-workers**(Düşünme 12)  bir tartışma varianti sentesis aşamasıyla.
- **LangGraph supervisor**(Deneyim 13)  Merkez yönlendiricisi + uzman ajanlar tartışmaları bir düğüm olarak uygulayabilir.
- **OpenAI Agents SDK**(Daahi 16)  ajanlar tekrarlayıcı eleştiriler için ileri geri gönderilir.
- **Multi-agent evals** çift tartışma + değerlendirme sinyali için değerlendirici-optimizeci.

### Bu kalıp yanlış gittiğinde

- **Convergence collapse.**Tüm ajanlar ilk yanlış cevabı ile bir araya gelir.
- **Hub failure.**Yıldız topolojisinde kötü bir merkezi herkesi yozlaştırır.
- **Prompt homogenization.**Tüm ajanlar aynı çağrıdan, aynı cevaplardan, farklı çağrılardan ve/veya modellerden yararlanmaktadır.

```figure
debate-converge
```

## Yapın

`code/main.py`STDlib tartışmasını uyguluyor:

- `Debater`sınıf (debatör görüş süresi ile yazılı LLM).
- `FullMeshDebate`ve `SparseDebate`Koşucular.
- Üç soru: bir gerçek, bir kural tabanlı, bir mantık.
- Metrikler: dönüşümlü cevap, dönüşümlü bir yuvarlak, toplam eleştirel operasyonlar.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Üretim: protokol başına doğru ve maliyet; daha düşük maliyetle 2/3 sorunun tam ağında nadir eşleşmeler.

## Kullan

- **Anthropic orchestrator-workers**2-3 işçi tartışması için.
- **LangGraph**kontrol noktasıyla devletin çok yönlü tartışması için.
- **Custom**Araştırma veya uzman doğruluk garantileri için.

## Gönder

`outputs/skill-debate.md`N, R ve bir yakınlık kuralı ile yapılandırılabilir topoloji ile çoklu ajanlı bir tartışma planı.

## Egzersizler

1. "Güçlü anlaşmazlık" kuralı uygulanmalıdır: 1. turda her tartışmanın farklı bir önerisi bulunmalıdır.
2. Güven ağırlıklı bir toplama ekleyin: tartışanlar geri döner ( yanıt, güven); toplamacı güvenle ağırlık verir.
3. Bir "evliliği" farklı görüşlere sahip farklı bir yazılı LLM ile değiştirmek.
4. 3 sorunuzda tam mesh vs. aralık için token maliyetini ölçün.
5. Zihnlerin Topluluğu'nun makalesini okuyun. Oyuncaklarınızı N=5, R=3'e taşıyin. Neye kapalı?

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## Daha Fazla Okumak

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Kanonik çoklu ajan tartışması
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) Nadir topoloji sonuçları
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) Tartışma variansı olarak orkestrasyoncular
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) Tek model kendi kendini eleştiren karşıt
