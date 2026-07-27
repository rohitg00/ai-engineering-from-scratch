# Akıl Derneği ve Çoklu-Agent Tartışma

> Minsky'nin 1986'daki önermesi -istihbarat uzmanlardan oluşan bir toplumdur- her on yılda bir yeniden keşfediliyor. 2023'te Du ve ark. bunu somut bir algoritmaya dönüştürdü: birden fazla LLM örneği yanıtlar önerir, birbirlerinin yanıtlarını okur, eleştirir ve günceller. N tur boyunca sıfır atışlı CoT'yi geride bırakan bir fikir birliğine varırlar ve altı akıl yürütme ve gerçekçilik görevi üzerinde düşünürler. İki bulgu önemlidir: hem **çoklu agents** hem de **çoklu turlar** bağımsız olarak katkıda bulunur. Toplum tek-agent monoloğu yener; çok turlu değişim tek seferlik oylamayı yener.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 04 (İlkel Model)
**Süre:** ~60 dakika

## Sorun

Kendi kendine tutarlılık (bir modeli birçok kez örnekleyin ve çoğunluğun cevabını alın) yapabileceğiniz en ucuz muhakeme geliştirmesidir. Çalışıyor ama çabuk doluyor. Örneklerinizi ikiye katlayabilirsiniz ve başka bir anlamlı sıçrama göremezsiniz.

Tartışma doygunluğu bozar. Bir modelden alınan N adet bağımsız örnek yerine, N adet agent birbirinin mantığını okur ve revize eder. Örnekler arasındaki korelasyon düşer (artık i.i.d değildirler) ve yakınsama noktası genellikle i.i.d olduğunda doğrudur. oylama kesinlikle yanlıştı.

## Konsept

### Du ve ark. 2023 algoritması

arXiv:2305.14325'ten (ICML 2024):

1. Her N agent, soruya bir başlangıç ​​cevabı üretir.
2. r = 2..R turu için: her agent'a diğer agent'larin r-1 turundaki cevapları gösterilir ve "bunları dikkate alarak güncel cevabınızı verin."
3. R ​​turlarından sonra nihai yanıtlara çoğunluk oyu verin.

Makale MMLU, GSM8K, biyografiler, MATH ve gerçeklik benchmark'lar üzerine testler yapmaktadır. Tartışma sürekli olarak CoT ve Kendini Düşünme'yi yener.

### İki bağımsız düğme

Aynı makaleden ablasyonlar:

- **Agent tek başına sayım** (1 tur, N'nin çoğunluk oyu) çoğu görevde tekli-agent'ı yener, ancak platolardadır.
- **Yalnızca yuvarlak sayım** (1 agent kendi önceki akıl yürütmesini görerek) pek yardımcı olmaz — yansımanın bilinen zayıflığı.
- **İkisi birlikte** büyük sıçramalar yaratır. Birden fazla agent arasındaki çok turlu değişim kazancı artırır.

### Neden işe yarıyor?

İki mekanizma:

1. **Anlaşmazlığa maruz kalma.** Bir agent, başka bir agent'ın muhakeme zincirini farklı bir sonuca sahip olarak gördüğünde, ya gerekçelendirmeli ya da güncellemelidir. Her iki durumda da r+1 turunun bağlamı r turundan daha zengindir.
2. **İlişkili hata azaltma.** Kendi kendine tutarlılıkta, tüm örnekler aynı modelden gelir, dolayısıyla hatalar birbiriyle ilişkilidir; ortalamayı kendinizden emin bir şekilde yanlış bir cevaba dönüştürürsünüz. Farklı modeller veya farklı tohumlar birbiriyle ilişkilidir. Farklı *tartışılan görüşler* ilişkiyi daha da bozuyor.

### Heterojen tartışma

A-HMAD ve ilgili takipler, farklı agent'lar için *farklı temel modeller* kullanır. Llama + Claude + GPT tartışması monokültürün çöküşünü azaltır (Ders 26) çünkü bir model ailesinin ilişkili hataları diğerleri tarafından paylaşılmaz.

Dezavantajı: Bir tartışmaya katılan zayıf bir model, fikir birliğini yanlış cevaba doğru sürükleyebilir (bkz. "Delirmeli miyiz?", arXiv:2311.17371).

### NLSOM — 129-agent uzantısı

Zhuge ve ark. ("Doğal Dil Tabanlı Zihin Toplumlarında Zihin Fırtınaları", arXiv:2305.17066) bu fikri 129 üyeli topluluğa ölçeklendirdi. Sonuç: Uzmanlaşma ve kendi kendini organize etme ölçekle birlikte ortaya çıkıyor ve sistem, görsel soru yanıtlama gibi görevlerde tekli agent'tan daha iyi performans gösteriyor.

### Arıza modları

- ** Dalkavukluk çağlayanı.** Tüm agent'lar, hangisi agent kulağa en güvenli geliyorsa onu erteler. Tartışma en yüksek sese kadar çöküyor. Promptrakip rolleri üstlenmek ("bir agent karşıt pozisyonu savunmalıdır") yardımcı olur.
- **Konu kayması.** Pek çok turda yapılan tartışmalar asıl sorudan sapıyor. Azaltma: soruyu her turda yeniden enjekte edin.
- **Hesaplama artışı.** N agents × R tur = N·R LLM çağrıları, her biri büyüyen bir bağlama sahiptir. 5-agent, 5 turlu bir tartışma, büyüyen bağlamda 25 çağrıdır. Soru başına maliyet, tek bir CoT çağrısının 10 katını aşabilir.

## Build It — Kendin Geliştir

`code/main.py` , her agent'ın farklı (muhtemelen yanlış) bir cevapla başladığı bir matematik sorusu üzerinde 3-agent × 3 turluk bir tartışma yürütür. Agent'ler kodlanmıştır; her "güncelleme", kodlanmış bir güven ile ağırlıklandırılan komşuların cevaplarının ortalaması alınarak yapılır. Yakınsama, yuvarlak günlükte görülebilir.

Demo iki temel etkiyi gösteriyor:

- Tek bir değişim turu agent'ları doğru cevaba yaklaştırır.
- 2. turdan sonraki ekstra turlar azalan getirileri gösteriyor (Du ve diğerlerinin platosuyla eşleşiyor).

Koşmak:

```
python3 code/main.py
```

## Use It — Hazır Araçla Uygula

`outputs/skill-debate-configurator.md` yeni bir görev için bir tartışma yapılandırır: agent'larin sayısı, tur sayısı, heterojenlik (aynı model vs karışık), rol ataması (simetrik vs tek düşmanlı). Ayrıca koşmadan önce token maliyetini de tahmin eder.

## Ship It — Kullanıma Sun

Tartışma gönderirseniz:

- **Turların üst sınırı 3'tedir.** Du ve ark. 3 tur göster kazancın çoğunu yakalar. Daha fazlası kalite değil maliyettir.
- **agent'ların üst sınırı 5'tir.** 5'ten sonra bağlam şişkinliği ve maliyet hakimdir.
- **Varsayılan olarak heterojen.** Havuzda en az iki farklı temel model.
- **Düşmanca görüş.** Bir agent promptne olursa olsun aynı fikirde değil. Dalkavukluğu bozar.
- **Her turu günlüğe kaydedin.** Ara turları gizleyen tartışma sistemlerinde hata ayıklanamaz veya denetlenemez.

## Egzersizler

1. `code/main.py` komutunu çalıştırın, ardından tur sayısını 5'e ayarlayın ve azalan dönüşleri izleyin. Ek yakınsama hangi turda durur?
2. Düşman rolü olan dördüncü bir agent ekleyin: her zaman mevcut çoğunluğa katılmıyorum. Bu yakınsamayı bozuyor mu yoksa geliştiriyor mu?
3. Tur başına anlaşma puanını çizin (yazdırın) (çoğunluk cevabındaki agent'larin kesri). Ne zaman 1.0'a ulaşır ve bu "doğru" ile eşdeğer midir?
4. Du ve ark.'nı okuyun. Bölüm 4 ablasyonlar. Bu kodu kullanarak "agents-yalnızca" ve "yalnızca turlar" ile "her ikisi" sonucunu çoğaltın.
5. "Delirmeli miyiz?" konusunu okuyun. (arXiv:2311.17371) ve karşılıklı tartışmanın ötesinde iki tartışma çeşidini listeleyin — e.g., yargıç liderliğinde, tartışma zinciri, çekişmeli.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Akıl Derneği | "Minsky'nin fikri" | Etkileşim halindeki uzmanlar olarak zeka; 1986'daki çerçeveleme artık Yüksek Lisans tartışmasıyla işlevsel hale getirildi. |
| Çoklu-agent tartışma | "Agentlar tartışıyor" | N agent'lar teklifte bulunur, birbirlerini eleştirir, R turları üzerinde değişiklik yapar, çoğunluk oyu verir. |
| Konsensüs | "Kabul ediyorlar" | Epistemik gerçek değil - yalnızca çoğunluğa göre kesirli yanıt. Kesinlikle yanlış olabilir. |
| Turlar | "Adımları değiştir" | Bir tur = her agent diğerlerini okur ve bir kez güncellenir. |
| Heterojen tartışma | "Model ailelerini karıştırın" | Hataları ayrıştırmak için farklı temel modellerin kullanılması. |
| Dalkavukluk çağlayanı | "Herkes gürültülü olanla aynı fikirde" | Doğruluğuna bakılmaksızın agent'ların en kendinden emin olan agent'a saygı gösterdiği başarısızlığı tartışın. |
| NLSOM | "129-agent toplum" | Doğal dilli zihin toplumu; Zhuge ve arkadaşlarının ölçekli versiyonu. |
| İlişkili hata | "Aynı model, aynı hata" | Kendi kendine tutarlılık neden doyurur; Farklı görüşler arasındaki tartışma ilişkiyi zayıflatır. |

## Daha Fazla Okuma

- [Du ve ark. — Çokluagent Tartışma](https://arxiv.org/abs/2305.14325) Yoluyla Dil Modellerinde Gerçekliği ve Akıl Yürütmeyi İyileştirme — referans makalesi, ICML 2024
- [Zhuge ve ark. — Doğal Dile Dayalı Zihin Toplumlarında Zihin Fırtınaları](https://arxiv.org/abs/2305.17066) — 129-agent NLSOM
- [Delirmeli miyiz? Yüksek Lisans'lar için ÇokluAgent Tartışma Stratejilerine Bir Bakış](https://arxiv.org/abs/2311.17371) — benchmark'ın tartışma çeşitleri
- [Tartışma projesi sayfası](https://composable-models.github.io/llm_debate/) — Du ve arkadaşlarının kodu, demoları ve ablasyon ayrıntıları
