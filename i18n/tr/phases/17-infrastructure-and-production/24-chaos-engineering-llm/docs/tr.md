# LLM Üretimi için Kaos Mühendisliği

> LLM için kaos mühendisliği 2026 yılında kendi disiplinidir. Üretim deneylerini yürütmeden önce ön koşullar: tanımlanmış SLI/SLO, izleme+metrik+log gözlemliliği, otomatik geri dönüş, çalıştırma defterleri, çağrıda bulunma. Mimarlık dört düzlemde bulunur: kontrol (deney programcısı), hedef (hizmetler, alt, veri depoları), güvenlik (kuvarlar + iptal + trafik filtreleri), gözlemsellik (metrikler + izler + günlükler), geri bildirim (SLO ayarlarına). Koruma rayları zorunludur: yanma oranı uyarıları, günlük hata bütçesi yanma> 2 katı beklenirse deneyleri durdurur; bastırma pencereleri + izleme kimliği ilişkisi alarmı gürültüsü çıkarır. Cadence: haftalık küçük kanarya + SLO inceleme; aylık oyun günü + ölüm sonrası; çeyreklik takım arası dayanıklılık denetimi + bağımlılık haritası. LLM'ye özel deneyler: hafıza aşırı yükü, ağ arızası, sunucu kesintileri, yanlış biçimlendirilmiş istekler, KV önbelleği tahrip fırtınaları. Araçlama: Harness Chaos Engineering (LLM'den kaynaklanan öneriler, patlama radyüsünün azaltılması, MCP araç entegrasyonu); LitmusChaos (CNCF); Chaos Mesh (CNCF Kubernetes-native).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy chaos experiment runner)
**Prerequisites:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Beş kaos mühendisliği ön şartını (SLI/SLO, gözlemlenebilirlik, geri dönüş, çalışma defterleri, çağrıda bulunma) belirleyin ve herhangi bir atlamanın neden uygulamayı iptal ettiğini açıklayın.
- Dört düzeni (kontrol, hedef, güvenlik, gözlemlenebilirlik) ve geri bildirim döngüsünü SLO'ya çiz.
- Beş LLM özel deneyi (hüye hafızası aşırı yük, ağ başarısızlığı, sağlayıcı kesinti, yanlış işlenmiş istek, KV tahrip fırtınası) listeleyin.
- Bir araç seçin  Harness, LitmusChaos, Chaos Mesh  verilen yığın.

## Sorun

Geleneksel yığınlarda kaos testi kuruldu. LLM yığınları yeni başarısızlık modlarını ekler. Zehir karakterli bir 4K-token istek, tokenizeciyi 12 saniye boyunca durdurur. Bir yukarı akım sağlayıcısı 429s; geçit girişiniz yeniden dener; servis OOM'larınız tekrar güçlendirilmiş eşzamanlı olarak. Bir KV önbelleği boşaltma fırtınası patlama yükü altında hesaplama doymuş kaskadları yeniden doldurmaya neden olur.

Bu testlerin hiçbiri birim testlerinde görünmüyor. Kaos mühendisliği, kullanıcıların yapmadan önce onları keşfetmenin bir yolu.

## Anlaşım

### Ön koşullar

Üretimdeki kaosı:

1. **SLI/SLO** hizmet düzeyin göstergelerinin ve hedeflerin belirlenmesi.
2. **Observability** izler, metrikler, kayıtlar, ara çubuğa kablo.
3. **Automated rollback** 17 · 20 aşama politika bayrağı geri dönüşü.
4. **Runbooks** yapılandırılmış, 17 · 23.
5. **On-call**- Cevap verecek biri.

Herhangi bir şekilde kayıp kaos gerçek bir olay haline gelir.

### Dört uçak + geri bildirim

**Control plane** deney programcısı (Litmus iş akışı, Kaos Mesh programı, Harness UI).

**Target plane**- Hizmetler, kapsüller, düğümler, yük dengeleyici, veri depoları.

**Safety plane** öldürme anahtarı, baskı pencereleri, patlama radyüsü sınırları, hata bütçesi kapıları.

**Observability plane** normal ölçümler + iz-İD korelasyonu doğal hatalardan oluşan kaosı ayırt etmek için.

**Feedback loop** Bulgular SLO ayarlamalarına, runbook güncellemelerine, kod düzeltmelerine geri döner.

### Koruma rayları zorunludur .

- **Burn-rate alert**Günlük hata bütçesi yanma beklenenin iki katını aşarsa, durak deneyi.
- **Suppression windows**: deney sırasında patlama radyosunda deney dışı uyarıları sessizleştirmek.
- **Trace-ID correlation**: deneylerin neden olduğu tüm hatalar bir etiket taşır, böylece çağrıda bulunarak sonuçlanabilir.

### Beş LLM özel deneyi

1. **Memory overload** yüksek eşzamanlılık ile uzun bağlamlı istekleri göndererek KV önleme fırtınasını zorlamak.

2. **Network failure** İtkinlik geçidi ve sağlayıcı arasındaki bağlantıyı kesin.

3. **Provider outage simulation** OpenAI'den %100 429. Not: yönlendirme Antropic'e geçiş başarısız mı oluyor? (Fase 17 · 16, 19)

4. **Malformed prompt** Tokenizer-stalling payload enjekte (örneğin, derin bir yuva içindeki unicode, büyük UTF-8 kod noktası).

5. **KV eviction storm** vLLM blok bütçesini doymakla zorla çıkarma.

### Cadence

- **Weekly** küçük kanarya deneyleri, belki %5 projed.
- **Monthly** belirli bir senaryoda belirlenmiş oyun günü; takımlar arası katılım; ölüm sonrası.
- **Quarterly** Ekipler arası dayanıklılık denetimi; bağımlılık haritasının güncelleştirilmesi.

### Araçlama

- **Harness Chaos Engineering** Ticari; Yapay zeka kaynaklı deney önerileri; patlama radyüsünün azaltılması; MCP araçlarının entegrasyonu.
- **LitmusChaos** CNCF mezun; Kubernetes çalışma akışına dayalı.
- **Chaos Mesh** CNCF kum kutusu; Kubernetes-devli CRD tarzı.
- **Gremlin** Ticari; geniş destek.
- **AWS FIS**- Ne ?**Azure Chaos Studio** yönetilen bulut sunuşları.

### Küçük başlıyor.

İlk deney: sabit trafik altında bir kod kopyasını öldür. Yeniden yönlendirme ve kurtarma izleyin. Eğer bu işe yarıyorsa ve güvenli görünüyorsa, ağ kaosuna geçin.

İlk LLM özel deneyi: 5 dakika boyunca 429'u bir sunucuya enjekte edin.

### Hatırlamalısın numaralar

- Dört uçak: kontrol, hedef, güvenlik, gözlemlenebilirlik.
- Yanma oranı duraklama: Beklenen günlük bütçe yanma 2 katı.
- Cadence: haftalık kanarya, aylık oyun günü, çeyreklik denetim.
- Beş LLM deneyi: hafıza, ağ, sağlayıcı, yanlış düzenlenmiş istek, KV fırtınası.

```figure
i4-chaos-guard
```

## Kullan

`code/main.py`Güvenlik uçak kapıları ile üç kaos deneyimi simülasyonu yaparak yanma oranı bozulmasını sağlayacak deneylerin raporlarını yapıyoruz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-chaos-plan.md`- Dolu ve olgunluğu göz önüne alındığında ilk üç deneyi ve alet seçer.

## Egzersizler

1. Çık .`code/main.py`Hangi deney yakma oranı kapısını zorlar ve neden?
2. VLLM tabanlı bir RAG hizmetinin ilk beş kaos deneyimi tasarlayın. Başarılılık kriterlerini dahil edin.
3. Yanma oranı uyarısı bir deneyi durdurdu.
4. Yapım sırasında kaosun olması mı yoksa sadece sahnelenmesi mi gerektiğini tartışın.
5. Genel ağ kaosu'nun yeniden üretemeyeceği üç LLM-sözlü başarısızlık modunu isimlendirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SLI / SLO | "service targets" | Indicator + objective; required prerequisite |
| Blast radius | "scope" | Set of services / users affected by experiment |
| Burn-rate alert | "budget gate" | Fires when error-budget burn rate > 2x expected |
| Game day | "monthly drill" | Scheduled cross-team chaos exercise |
| LitmusChaos | "CNCF workflow" | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | "CNCF CRD" | CNCF sandbox Kubernetes-native chaos |
| Harness CE | "commercial AI-assisted" | Harness chaos with AI recommendations |
| Malformed prompt | "tokenizer bomb" | Input that stalls tokenization |
| KV eviction storm | "preemption cascade" | Mass eviction triggering re-prefills |

## Daha Fazla Okumak

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for Large Language Models (Apress, 2026)](https://link.springer.com/book/10.1007/979-8-8688-2827-0)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
