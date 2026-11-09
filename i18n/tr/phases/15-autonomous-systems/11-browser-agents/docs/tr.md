# Tarayıcı Ajanları ve Uzun Uzaylı Web Görevleri

> ChatGPT ajanı ( Temmuz 2025) Operatör ve derin araştırmaları bir tarayıcı/terminal ajanına birleştirdi ve BrowseComp SOTA'yı %68,9'a koydu. OpenAI, 31 Ağustos 2025'te Operator'u ürün katmanında birleştirmeyi kapattı. Anthropic'in Vercept satın alımı, OSWorld'deki Claude Sonnet'i %15'ten %72,5'e yükseltti. WebArena-Verified (ServiceNow, ICLR 2026) orijinal WebArena'da ~11.3% yanlış negatif oranı sabitledi ve 258-iş Hard alt kümesini gönderdi. Sayılar gerçek. OpenAI'nin hazırlık başkanı açıkça, tarayıcı ajanlarına dolaylı bir şekilde enjeksiyon yapmanın "tamamen düzeltilebilecek bir hata olmadığını" belirtti. 2025  2026 saldırıları: Tainted Memories (Atlas CSRF), HashJack (Cato Networks), ve Perplexity Comet'te tek tıkla kaçırmalar.

**Type:** Learn
**Languages:** Python (stdlib, indirect prompt-injection attack surface model), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## Sorun

Bir tarayıcı ajansı, güvenilmeyen içeriği okuyan ve sonuçta eylemler yapan uzun uzayda bir ajan. Ajanın ziyaret ettiği her sayfa, kullanıcı tarafından yazılmamış bir giriş. Her sayfada her form potansiyel bir komut kanalıdır. 20252026 saldırı korpusu bunun hipotetik olmadığını göstermektedir: Zararlı Hatırlar bir saldırganın saldırganın hafızasına kötü niyetli talimatları bir yapılmış sayfa üzerinden bağlamasını sağlar; HashJack, ajanın ziyaret ettiği URL parçalarında komutları gizler; Kafasızlık Komet kaçıranları tek bir tıklama yapar.

OpenAI'nin hazırlık başkanı sessiz kısmını yüksek sesle söyledi: dolaylı enjeksiyon "tamamen düzeltilebilecek bir hata değildir". Bu saldırının nedeni, ajanın okuma-işleme sınırında yaşadığından, mimari açıdan bulanık olmasıdır.

Bu ders saldırı yüzeyini, referans manzarasını (BrowseComp, OSWorld, WebArena-Verified) adlandırır ve 14 ve 18 derslerde gerçek savunma hakkında düşünmeniz için en az bir dolaylı enjeksiyon senaryosunu modellemektedir.

## Anlaşım

### 2026 manzarası, her sistem için bir paragraf

**ChatGPT agent (OpenAI).**Temmuz 2025'te başlatıldı. Operatör (yarayı) ve Derin Araştırma (çok saatlik araştırma) birleştirir. 31 Ağustos 2025'te bağımsız Operatör kapatıldı.

**Claude Sonnet + Vercept (Anthropic).**Anthropic'in Vercept satın alımı bilgisayar kullanım yeteneklerine odaklandı. Claude Sonnet'i OSWorld'de %15'ten %72.5'e taşıdı.

**Gemini 3 Pro with Browser Use (DeepMind).**Tarayıcı Kullanım entegrasyonu bilgisayar kullanım kontrollerini gönderir; FSF v3 (Epril 2026, Ders 20) özellikle ML T&K alanında özerkliği izler.

**WebArena-Verified (ServiceNow, ICLR 2026).**İyi belgelenmiş bir sorunu düzeltir: orijinal WebArena'da ~11.3% yanlış negatif oranı vardı (gerçekten çözülmemiş işaretlenmiş görevler). Verified sürüm insan tarafından kurate edilmiş başarı kriterlerine göre yeniden derecelendirir ve 258-iş Hard alt kümesini ekler (ICLR 2026 makalesi, openreview.net/forum?id=94tlGxmqkN).

### BrowseComp vs OSWorld vs WebArena

| Benchmark | What it measures | Horizon |
|---|---|---|
| BrowseComp | Finding specific facts on the open web under time pressure | minutes |
| OSWorld | Agent operating a full desktop (mouse, keyboard, shell) | tens of minutes |
| WebArena-Verified | Transactional web tasks in simulated sites | minutes |
| Hard subset | WebArena-Verified tasks with multi-page state transitions | tens of minutes |

Farklı eksiler. Yüksek bir BrowseComp puanı ajanın gerçekleri bulduğunu söyler; ajanın bir uçuş rezervasyonu yapabileceğini söylemez. OSWorld puanı "benim masaüstü'mde çalışıyor mu?"

### Saldırı yüzeyi, isimlendirilmiş

1. **Indirect prompt injection.**Güvenilmeyen sayfa içeriği talimatları içerir. Ajan onları okuyor. Ajan onları yürütüyor. Kamu örnekleri: 2024 Kai Greshake et al., 2025 Temedeki Hatıralar kağıdı, 2026 HashJack (Cato Networks).
2. **URL fragment / query injection.**- Evet .`#fragment`Arama URL'nin bir arama dizisi veya arama dizisi komutları içerir. Hiç görünür olarak gösterilmedi; hala ajanın bağlamında.
3. **Memory-binding attacks.**Page, ajanı sürekli bir bellek yazmasını talimatlandırır (Durable State'i 12. ders kapsar).
4. **CSRF-shaped attacks on authenticated sessions.**Bozuk Hatıralar sınıfı: ajan bir yerlerde giriş yapmıştır; saldırganın sayfası, ajanın kullanıcı çerezleriyle gerçekleştirdiği durum değişikliği isteklerini yayınlar.
5. **One-click hijack.**Görünüşe göre zararsız bir düğme, ajanın takip ettiği bir yük üzerinde.
6. **Content-Security-Policy holes in the agent's host surface.**Rendering ve araç katmanları kendileri saldırı vektörleri olabilir; tarayıcı-bir tarayıcı-a-agent yığın geniş.

### Neden "tamamen patchable değil"

Saldırı ajanın kapasitesine göre izomorf. Ajan işini yapmak için güvenilmeyen içeriği okumalı. Ajanın okuduğu herhangi bir içerik talimat içerir. Ajanın takip ettiği herhangi bir talimat, kullanıcı'nın gerçek talebiyle yanlış uyumlu olabilir. Savunma (güven sınırları, sınıflandırıcılar, araç izinleri, sonuçta uygulanmış eylemler için HITL) saldırının maliyetini artırır ve patlama radyusunu azaltır. Sınıf kapanmaz.

Bu, Lob teoreması ile aynı mantık örneğidir (Daahi 8): ajan bir sonraki tokenin güvenli olduğunu kanıtlayamaz; sadece güvenli olmayan tokenlerin daha fazla tespit edilebileceği bir sistem kurar.

### Aslında gemiler için savunma duruşu

- **Read / write boundary.**Okuyucu hiçbir zaman sonuçlandırıcı değildir. Yazı (bir form göndermek, içerik yayınlamak, yan etkileri olan bir aracı çağırmak) başlatıcı içerik güven sınırının dışında geldiğinde yeni insan onayını gerektirir.
- **Tool allowlist per task.**Ajan tarayabilmektedir; bu araç görev için açıkça etkinleştirilmedikçe bir banka transferini başlatamaz.
- **Session isolation.**Browser ajanı seansları sadece kapsamlı kimlik bilgileri ile çalıştırılır. Hiçbir üretim yazarı, kişisel e-posta yok.
- **Content sanitizer.**Get HTML, model bağlamına bağlanmadan önce bilinen kötü desenlerden çıkarılır. (Kolay saldırıları azaltır; karmaşık yararlı yükleri durdurmaz.)
- **HITL on consequential actions.**Teklif ve sonra görev biçimi (Denevi 15).
- **Canary tokens on memory.**Eğer bir hafıza girişinin ateşlenmesi durumunda, kullanıcı onu görür (Denevi 14).

```figure
injection-boundary
```

## Kullan

`code/main.py`Bu sayfa, üç sentetik sayfaya karşı çalışan küçük bir tarayıcı ajanı modellemektedir. Bir sayfa iyi huylu, biri görünür metinde doğrudan bir önlenme enjeksiyon blobu, biri URL parçacığı enjeksiyonu (görünmez ama ajanın bağlamında).

## Gönder

`outputs/skill-browser-agent-trust-boundary.md`önerilirken, bir tarayıcı ajanı dağıtımının kapsamını belirler: hangi güven bölgeleri ile temas edilir, ne yazma yetkisi vardır ve ilk çalışmadan önce hangi savunmalar yapılmalıdır.

## Egzersizler

1. Çık .`code/main.py`.Sanifiseci hangi saldırıyı yakalar ama okuma/yazma sınırı değil ve hangi saldırıyı sadece okuma/yazma sınırı yakalar.

2. HashJack tarzı URL fragman enjeksiyonu bir sınıfı tespit etmek için sanitizer'i uzatın.

3. Bildiğiniz bir tarayıcı ajansı iş akışı seçin (örneğin "uçuş rezervasyonu"). Her okuyucu ve yazmayı listeleyin.

4. WebArena-verified ICLR 2026 kağıdı okuyun.

5. Bir tarayıcı ajanı ayarlaması için bir hafıza kanaryası tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Indirect prompt injection | "Bad page text" | Untrusted content in a page the agent reads contains instructions the agent executes |
| Tainted Memories | "Memory attack" | Agent writes an attacker-supplied instruction to durable memory; triggered next session |
| HashJack | "URL fragment attack" | Payload hidden in URL fragment / query string is in the agent's context but not visibly rendered |
| One-click hijack | "Bad button" | Visible affordance rides a follow-on payload the agent executes |
| BrowseComp | "Web search benchmark" | Finding specific facts on the open web; minute-scale horizon |
| OSWorld | "Desktop benchmark" | Full OS control; multi-step GUI tasks |
| WebArena-Verified | "Fixed web-task benchmark" | ServiceNow's regraded WebArena with Hard subset |
| Read/write boundary | "Side-effect gate" | Reading never consequential; writing requires fresh approval if content is out-of-trust |

## Daha Fazla Okumak

- [OpenAI — Introducing ChatGPT agent](https://openai.com/index/introducing-chatgpt-agent/)Operator ve derin araştırmaların birleşmesi; BrowseComp SOTA.
- [OpenAI — Computer-Using Agent](https://openai.com/index/computer-using-agent/) ChatGPT ajanı olan Operator soy ve mimarlık.
- [Zhou et al. — WebArena](https://webarena.dev/) orijinal referans değerini.
- [WebArena-Verified (OpenReview)](https://openreview.net/forum?id=94tlGxmqkN) ICLR 2026 sabit alt kümelerli kağıt.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) bilgisayar kullanımı ajanları için saldırı yüzey tartışmasını içerir.
