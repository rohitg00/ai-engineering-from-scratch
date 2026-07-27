# Çoklu-Agent Tartışma ve İşbirliği

> Du ve ark. (ICML 2024, "Society of Minds"), bağımsız olarak yanıtlar öneren N model örneğini çalıştırır, ardından yakınsamak için R turları üzerinden birbirini yinelemeli olarak eleştirir. Gerçekliği, kurallara uymayı ve akıl yürütmeyi geliştirir. Seyrek topoloji, token maliyetle tam ağı yener.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 12 (İş Akışı Modelleri), Aşama 14 · 05 (Kendini Geliştirme ve Eleştirme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Tartışma protokolünü açıklayın: N teklif sahibi, R turu, ortak bir cevap üzerinde birleşir.
- Tartışmanın neden gerçekçiliği, kurallara uymayı ve akıl yürütmeyi geliştirdiğini açıklayın.
- Seyrek topolojiyi açıklayın: her tartışmacının birbirini görmesi gerekmez.
- Tam örgü ve seyrek değişkenlere sahip, komut dosyasıyla yazılmış bir LLM üzerinde bir stdlib tartışması uygulayın; token maliyetini ve doğruluğunu ölçün.

## Sorun

Kendini Arıtma (Ders 05) kendini eleştiren bir modeldir; grup düşüncesini riske atar. ELEŞTİRİ (Ders 05) dış araçlardaki eleştiriyi temel alır - her zaman mevcut değildir. Tartışma üçüncü bir modu ortaya çıkarır: çoklu örnekler, çapraz eleştiri, anlaşmazlık yoluyla yakınlaşma.

## Konsept

### Zihinler Topluluğu (Du ve diğerleri, ICML 2024)

- N model örneği bağımsız olarak aynı soruya yanıtlar önerir.
- R turlarında her model diğerlerinin önerilerini okur ve eleştirir.
- Modeller eleştirilere göre cevaplarını günceller.
- R turlarından sonra yakınsak cevabı döndürün.

Orijinal deneylerde maliyet nedeniyle N=3, R=2 kullanıldı. Doğruluk, zorlu problemlerde (MMLU, GSM8K, Satranç Hareketi Geçerliliği, biyografi oluşturma) daha fazla agent ve daha fazla turla artar.

Çapraz model kombinasyonları, tek model tartışmalarını yener: ChatGPT + Bard birlikte > ikisi de tek başına.

### Seyrek topoloji

"Seyrek İletişim Topolojisi ile Çoklu-Agent Tartışmasının Geliştirilmesi" (arXiv:2406.11776, 2024-2025), tam örgülü tartışmanın her zaman optimal olmadığını gösterdi. Seyrek topolojiler (yıldız, halka, hub ve bağlı bileşen), daha düşük token maliyetle doğruluğu karşılayabilir. Her tartışmacı akranlarının yalnızca bir alt kümesini görür.

Çıkarımlar:

- Tam ağ N=5, R=3 = 5 × 3 = 15 öneri, her biri 4 eş okuma = 60 eleştiri işlemi.
- Yıldız N=5, R=3 (bir hub + 4 jant teli) = 15 teklif, jant telleri yalnızca hub'ı okur = 12 eleştiri işlemi.

### Tartışma yardımcı olduğunda

- **Gerçeklik.** N sayıda bağımsız öneri, çapraz kontrol halüsinasyonu azaltır.
- **Kurallara uyma.** Satranç hamlesinin geçerliliği — bir model bir kuralı kaçırır, diğerleri onu yakalar.
- **Açık uçlu akıl yürütme.** Birden fazla çerçeve, doğru cevabı daraltır.

### Tartışma acı verdiğinde

- **Gecikmeye duyarlı UX.** N × R seri turları, sahip olamayabileceğiniz gecikmedir.
- **Maliyete duyarlı ölçek.** Soru başına N × R tokens.
- **Basit gerçeklere dayalı aramalar.** Bir arama, beş tartışmadan daha ucuzdur.

### 2026 pratik örnekleme

- **Antropik orkestratör-işçiler** (Ders 12) — sentez adımlı tartışmanın bir çeşidi.
- **LangGraph süpervizörü** (Ders 13) — merkezi yönlendirici + uzmanlar agent'lar tartışmayı bir düğüm olarak uygulayabilir.
- **OpenAI Agent'nin SDK'sı** (Ders 16) — agent'nin yinelemeli eleştiri için ileri geri aktarımı.
- **Çoklu-agent değerlendirmeler** — değerlendirme sinyali için ikili tartışma + değerlendirici-iyileştirici.

### Bu modelin yanlış gittiği yer

- **Yakınsama çöküşü.** Tüm agent'ler ilk yanlış cevapta birleşir. Gerekli anlaşmazlık turlarıyla azaltın.
- **Hub arızası.** Yıldız topolojisinde, kötü bir hub herkesi bozar. Birden fazla hub'ı döndürün veya kullanın.
- **Prompt homojenleştirme.** Tüm agent'ler aynı prompt'yi kullanır; aynı cevapları veriyorlar. Çeşitli prompt'leri ve/veya modelleri kullanın.

## İnşa Et

`code/main.py` stdlib tartışmasını uygular:

- `Debater` sınıfı (tartışmacı başına fikir ayrılığıyla birlikte kodlanmış LLM).
- `FullMeshDebate` ve `SparseDebate` koşucu.
- Üç soru: bir gerçek, bir kurala dayalı, bir akıl yürütme.
- Metrikler: yakınsak cevap, yakınsamaya giden turlar, toplam eleştiri operasyonları.

Çalıştır:

```
python3 code/main.py
```

Çıktı: protokol başına doğruluk ve maliyet; seyrek, 2/3 soruda tam örgüyü daha düşük maliyetle eşleştirir.

## Kullan onu

- 2-3 kişilik basit tartışmalar için **antropik orkestratör-işçiler**.
- Kontrol noktası belirlemeyle durum bilgisi olan çok yönlü tartışma için **LangGraph**.
- Araştırma veya özel doğruluk garantileri için **Özel**.

## Gönderin

`outputs/skill-debate.md`, yapılandırılabilir topoloji, N, R ve bir yakınsama kuralı ile çoklu-agent tartışmasını destekler.

## Egzersizler

1. "Zorunlu anlaşmazlık" kuralını uygulayın: 1. turda her tartışmacı farklı bir teklif sunmalıdır. Yakınsama hızı üzerindeki etkiyi ölçün.
2. Güven ağırlıklı bir toplama ekleyin: Tartışmacılar geri döner (cevap, güven); güvene göre toplayıcı ağırlıkları. Yardımcı oluyor mu?
3. Bir "agent"'yi, farklı görüşlere sahip farklı bir komut dosyasıyla yazılmış LLM ile değiştirin. Heterojenlik doğruluğu artırır mı?
4. 3 sorunuzda tam örgü ve seyrek için token maliyetini ölçün. Arsa maliyeti ve doğruluk.
5. Zihinler Derneği makalesini okuyun. Oyuncağınızı N=5, R=3'e taşıyın. Ne kırılıyor? Neler iyileşir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Tartışma | "Çoklu-agent eleştiri" | N teklif sahibi, R çapraz eleştiri turu, yakınsama |
| Tam örgü | "Herkes herkesi okur" | Her tartışmacı her turda her akranını okur |
| Seyrek topoloji | "Sınırlı eşgörünüm" | Tartışmacılar akranlarının yalnızca bir alt kümesini okuyor |
| Hub-ve-bağlantı birimi | "Yıldız topolojisi" | Merkezi bir tartışmacı olan N-1'in konuşmacıları yalnızca merkezi okuyor |
| Yakınsama | "Anlaşma" | Tartışmacılar ortak bir cevapta birleşiyor |
| Zihinler Topluluğu | "Du ve diğerleri tartışma makalesi" | ICML 2024 çoklu-agent tartışma yöntemi |

## Daha Fazla Okuma

- [Du ve diğerleri, Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — kanonik çoklu-agent tartışması
- [Seyrek İletişim Topolojisi (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) — seyrek topoloji sonuçları
- [Antropik, Etkili Agentler Oluşturma](https://www.anthropic.com/research/building-effective-agents) — bir tartışma çeşidi olarak orkestratör-çalışanlar
- [Madaan ve diğerleri, Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — tek modelli özeleştiri karşılığı
