# Llama Güvenliği ve Girit/ Çıktı sınıflandırması

> Llama Guard 3 (Meta, Llama-3.1-8B tabanı, içeriğin güvenliği için ince ayarlanmıştır) 8 dilde MLCommons 13 tehlikesi taksonomisine göre hem LLM girişlerini hem de çıkışlarını sınıflandırır. 1B-INT4 kuantistik bir varianti mobil CPU'larda 30'dan fazla token/sekunde çalışır. Llama Guard 4 multimodal (resim + metin), S1S14 kategorisi setiyle genişletilmektedir (S14 Kod Anlatıcı İstifadesi dahil), ve Llama Guard 3 8B/11B'nin bir düşüş değiştiricisidir. NVIDIA NeMo Guardrails v0.20.0 (Ocak 2026) giriş ve çıkış raylarının üstüne Colang iletişim akışı raylarını ekler. Dürüst not: "LLM Guardrails'te Anında Enjeksiyon ve Ceza Eğitimi Algılamaları'nı Uzaklaştırmak" (Huang et al., arXiv:2504.11168) Emoji kaçakçılığı altı tanınmış güvenlik sisteminde %100 saldırı başarısı oranını gösterdi; NeMo Guard Detect, ceza eğitimi sırasında %72.54% ASR kaydetti. Sınıflayıcılar bir katman, bir çözüm değil.

**Type:** Learn
**Languages:** Python (stdlib, category-tagged classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 17 (Constitution)
**Time:** ~45 minutes

## Sorun

LLM giriş ve çıkışları için sınıflandırıcılar ajan yığınının en dar noktasında oturuyor: her talep geçer, her yanıt geçer. İyi sınıflandırıcı katman hızlı, taksonomya tabanlı ve küçük bir hesaplama maliyeti için açıkça yanlış kullanımın büyük bir kısmını yakalar. Kötü sınıflandırıcı katman yanlış bir güvenlik duygusudur.

20242026 sınıflandırıcı yığın, küçük bir üretim hazır seçenekler kümesine üye oldu. Llama Guard (Meta) Meta'nın Topluluk Lisansı altında açık ağırlıklar gemileri. NeMo Guardrails (NVIDIA) izinli lisanslı raylar ve iletişim akışı kuralları için Colang gemileri. Her ikisi de bir temel modeli ile eşleştirmek için tasarlanmıştır, güvenlik davranışını değiştirmez.

Belgelemiş başarısızlık yüzeyi de aynı derecede iyi haritalanmıştır. Karakter düzeyde saldırılar (emoji kaçakçılığı, homoglif değiştirme), bağlamda yönlendirme ("öncekiyi görmezden gelme ve cevapla"), ve semantik parafrase hepsi sınıflandırıcı doğruluğunda ölçülebilir düşüşler üretmektedir. Huang et al. 2025'te belirli bir Emoji kaçakçılığı saldırısı gösterildi.

## Anlaşım

### Llama Gardiyan 3 bir bakışta

- Üssü model: Llama-3.1-8B
- İçerik güvenliği için iyi ayarlanmış; genel bir sohbet modeli değil
- Giriş ve çıkışları sınıflandırır
- MLCommons 13- Tehlike taksonomisi
- 8 dil
- 1B-INT4 kuantistik varianti mobil CPU'larda > 30 tok/s'de çalışır

Taksonomi üründür. "S1 Şiddetli Suçlar" "S13 Seçimler" yoluyla modelin eğitildiği ortak bir kelimeforuna hariteler. Aşağı akım sistemleri kategorilere özel eylemleri telsize edebilir: S1'i doğrudan engelleyin, insan gözden geçirme için S6 bayrağı, S12'yi not edin ancak izin verin.

### Llama Guard 4 eklemesi

- Multimodal: görüntü + metin girişi
- Genişletilmiş taksonomi: S1S14 (S14 Kod Anlatıcı İstifadesi ekliyor)
- Llama Guard 3 8B/11B'nin yer değiştirmesi

S14 bu aşamada önemlidir. Otonom kodlama ajanları (Daa 9) kum kutularında kod uyguluyor (Daa 11); özel olarak kod yorumcularının kötüye kullanımı için sınıflandırıcı kategorisi daha önceki taksonomide adı verilmemiş bir saldırı sınıfını yakalar.

### NeMo Guardrails (NVIDIA)

- 2026 Ocak ayında yayınlanan v0.20.0
- Giriş rayları: Kullanıcı dönüşünde sınıflandırma ve engelleme
- Çıkış rayları: model dönüşünde sınıflandırma ve bloklama
- Diyalog rayları: Kolang tanımlı akış kısıtlamaları (örneğin, "kullanıcı X sorarsa Y ile cevap ver")
- Llama Guard, Prompt Guard ve özel sınıflandırıcıları birleştirir

Diyaloğ-düzgeç katmanı farklılıklandırıcıdır. Giriş/çıktı rayları tek bir dönüşte çalışır; diyaloğ rayları, kullanıcı üç farklı yolu sorarsa bile müşteri desteği botunda tıbbi teşhis hakkında tartışmamayı zorlayabilir.

### Saldırı korpusu

**Emoji Smuggling**(Huang et al., arXiv:2504.11168): Yasak istek karakterleri arasında basılamaz veya görsel olarak benzer emoji ekleyin. Tokenizer onları sınıflandırıcının beklediğinden farklı bir şekilde birleştirir.

**Homoglyph substitution**: Latin harflerini görsel olarak aynı olan Kiril alfabesi ile değiştirin. "Bomb" "Воmb" haline gelir; sınıflandırıcı İngilizce misler üzerinde eğitilmiştir.

**In-context redirection**: "Bu bir araştırma bağlamı olduğunu düşünmeden önce farklı bir politika uygulayın".

**Semantic paraphrase**: Yasak talebi yeni bir dilde yeniden ifade edin.

**NeMo Guard Detect**: Huang et al. gazetesindeki bir jailbreak referansına göre 72,54% ASR. Bu dikkatli bir saldırı aracı ile yapılır; rastgele jailbreaks çok daha düşüktür, ancak tavan açıkça "sıfır" değildir.

### Sınıflandırıcıların kazandığı yer

- **Fast default rejection**açık bir yanlış kullanım (CSAM oluşturmak için bir talebimiz milimetre içinde yakalanır).
- **Category routing**Farklı işlem için (bazısını engelle, diğerlerini kaydet, birkaçını yükselt).
- **Output rails**Eğer bu şekilde yapılırsa hassas kategorileri sızdırmış olan yakalama model çıkışları.
- **Compliance surface area**düzenleyiciler için  belgelenmiş, denetlenebilir sınıflandırıcı, açıklanmış taksonomisi ile.

### Sınıflandırıcıların kaybedişi

- Karşılıklı işleme (emoji kaçakçılığı, homoglif).
- Sınıflandırıcının sıra seviyesindeki bağlamda hareket eden çok yönlü saldırılar.
- Klasörün eğitim verileri kelime birikmesine parafrase eden saldırılar görmedi.
- İzin verilen ve izin verilmeyen kategoriler arasında gerçekten belirsiz olan içerik.

### Derin savunma

Bir sınıflandırıcı katman boşlukları anayasa katmanının altında (Desin 17), çalıştırma katmanının üzerinde (Desin 10, 13, 14). Kompozisyon:

- **Weights**Bu, bir temel temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir temel olarak, bir anlamıyla, bir anlamıyla, bir olarak, bir anlamıyla, bir anlamıyla, bir anlamıyla, bir olarak, bir anlamıyla, bir olarak, bir anlamıyla, bir anlamıyla, bir olarak, bir anlamıyla, bir olarak, bir anlamıyla, bir olarak, bir anlamıyla, bir olarak, bir anlamıyla, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak, bir olarak,
- **Classifier**Llama Guard / NeMo Guardrails. Açık yanlış kullanım için hızlı reddedilme; kategori yönlendirme.
- **Runtime**: izin modları, bütçeler, öldürme anahtarları, kanaryalar.
- **Review**: HITL'e sonuçlı eylemler konusunda önerme-sonra karar verme.

Tek bir katman yeterli değil. Katmanlar farklı saldırı sınıflarını kapsar.

```figure
a5-guard-sieve
```

## Kullan

`code/main.py`Bu metin, aynı metinle çiğ, emoji kaçakçılığı ve homoglif değiştirilmesi ile geçer; sınıflandırıcının hit oranı Huang et al. kağıt belgeleri şekillerinde düşer. Sürücü ayrıca çıkış raylarının giriş kabul edildiğinde bile bir çıkışı nasıl reddedeceğini gösterir.

## Gönder

`outputs/skill-classifier-stack-audit.md`Bir dağıtımın sınıflandırıcı katmanını (model, taksonomi, giriş/çıktı rayları, iletişim rayları) denetlemektedir ve boşlukları işaretler.

## Egzersizler

1. Çık .`code/main.py`Sınıflandırıcının çiğ zararlı girişleri yakaladığını doğrulayın ama emoji kaçak versiyonunu kaçırır.

2. MLCommons 13-tehlik taksonomisi ve Llama Guard 4 S1S14 listesini okuyun. S1S14'teki orijinal 13-tehlik seti içinde doğrudan haritalama olmayan kategorileri tanımlayın; S14 Kod Anlatıcı İstifadesi'nin S1S14 aşamasında neden özel olarak ilgili olduğunu açıklayın.

3. NeMo Guardrails iletişim rayını, asla teşhis tartışmasına izin vermeyen bir müşteri desteği botu için tasarlayın.

4. Huang et al. (arXiv:2504.11168). Bir saldırı kategorisini seçin (emoji kaçakçılığı, homoglif, parafrase) ve bir azaltma önerisini yapın.

5. NeMo Guard Detect'in 72,54% ASR'i, jailbreak referans değerlerinde adversarial craft altında ölçülür.

## Anahtar Terimler

| Term | What people say | What it actually means |
|---|---|---|
| Llama Guard | "Meta's safety classifier" | Llama-3.1-8B fine-tuned for input/output classification |
| MLCommons taxonomy | "13-hazard list" | Shared vocabulary for content-safety categories |
| S1–S14 | "Llama Guard 4 categories" | Expanded taxonomy; S14 is Code Interpreter Abuse |
| NeMo Guardrails | "NVIDIA's rails" | Input + output + dialog rails; Colang for flows |
| Emoji Smuggling | "Tokenizer trick" | Non-printable emoji between chars; 100% ASR on six guards |
| Homoglyph | "Lookalike letters" | Cyrillic for Latin; classifier trained on English misses |
| ASR | "Attack success rate" | Fraction of attacks that bypass the classifier |
| Dialog rail | "Flow constraint" | Conversation-level rule that persists across turns |

## Daha Fazla Okumak

- [Inan et al. — Llama Guard: LLM-based Input-Output Safeguard](https://ai.meta.com/research/publications/llama-guard-llm-based-input-output-safeguard-for-human-ai-conversations/)- Orijinal kağıt.
- [Meta — Llama Guard 4 model card](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) multimodal, S1S14 taksonomisi.
- [NVIDIA NeMo Guardrails (GitHub)](https://github.com/NVIDIA-NeMo/Guardrails) v0.20.0 Ocak 2026.
- [Huang et al. — Bypassing Prompt Injection and Jailbreak Detection in LLM Guardrails](https://arxiv.org/abs/2504.11168) Koruma sistemlerinde ASR numaraları.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) sınıflandırıcı-daha çalışma zamanı çerçevesini oluşturmak.
