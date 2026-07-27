# Hiyerarşik Mimari ve Başarısızlık Modu

> Hiyerarşik yönetici iç içedir. Yönetici agent, alt yöneticilerin çalışanlara göre üzerindedir. CrewAI `Process.hierarchical` ders kitabı versiyonudur: bir `manager_llm` dinamik olarak görevleri devreder ve çıktıları doğrular. LangGraph eşdeğeri `create_supervisor(create_supervisor(...))`'dir. Görevin gerçek bir organizasyon şeması olması doğal bir kalıptır. Bu aynı zamanda yönetimsel döngüye dönüşme olasılığı en yüksek olan kalıptır - yöneticilerin agent işi kötü ataması, alt çıktıları yanlış yorumlaması veya fikir birliğine varamaması. Sıralı çoğu zaman onu yener.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 16 · 05 (Süpervizör Modeli)
**Süre:** ~60 dakika

## Sorun

Denetleyici modeli bir kez yerine oturduğunda, doğal olarak bir sonraki adım şu olur: "Peki ya işçilerin kendileri de yönetici ise?" Takımların alt takımları vardır; Şirketlerin departmanları vardır. Hiyerarşik mimariler bunu yansıtır.

Sorun: LLM yöneticileri insan yöneticilerle aynı değildir. Bir insan yöneticinin, raporlarının ne bildiği konusunda sabit öncelikleri vardır. Bir Yüksek Lisans yöneticisi, kuruluşun içeriğine göre her fırsatta yeniden mantık yürütür. Bu bağlamda küçük bir sapma ve tüm ağacın işi yanlış dağıtması.

## Konsept

### Şekil

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

Her dahili düğüm planlar, delege eder ve sentezler. Yalnızca yapraklar işe yarar.

### Parladığı yer

- **Kuruluş eşlemesini temizleyin.** Gerçek görev departmana aitse ("belgeyi yasal olarak inceleyin, finans belgeyi inceleyin, mühendislik belgeyi inceleyin, ardından yönetici için özetleyin"), hiyerarşi açıktır.
- **Yerel özetleme.** Her alt yönetici, ekibinin çıktısını üst yönetici görmeden sentezler. Üst düzey yönetici on beş çalışan çıktısı yerine üç alt yönetici özetini görüyor.

### Kırıldığı yer

2026 otopsilerinde bulmaya devam eden üç arıza modu:

1. **Görev atama hatası.** Yönetici hedefi okur, ayrıştırma halüsinasyonu görür ve yetkiyi yanlış alt yöneticiye verir. Alt yönetici itaatkar bir şekilde kendisine verilen şey üzerinde çalıştığından, hata yalnızca üst sentezde ortaya çıkar; bir insanın yakalayabileceği yerden bir seviye daha uzaktadır.
2. **Çıktının yanlış yorumlanması.** Alt yönetici "X talebi doğrulanamıyor" ifadesini veriyor. Üst düzey yönetici durumu "X iddiası onaylanmadı" şeklinde özetliyor. Anlam her düzeyde sürüklenir.
3. **Uzlaşı döngüleri.** İki alt yönetici aynı fikirde değil; üst düzey yönetici onlardan uzlaşmalarını ister; yeniden yetki verirler; işçiler yeniden çalışıyor; alt yöneticiler biraz farklı yanıtlar veriyor; döngü. CrewAI'nin `Process.hierarchical` 'si adım limitleriyle buna karşı koruma sağlar, ancak limitin kendisi artık bir hiper parametredir.

### Karar verici soru

Sıralı (doğrusal boru hattı) vs hiyerarşik: Görevinizin gerçekten bağımsız alt ekipleri var mı, yoksa ağaç gibi görünen doğrusal bir akış mı? İkincisi ise sıralı kullanın. İlki ise hiyerarşik ancak bütçeyi açık mutabakat kuralları kullanın.

### Rol-framework uygulaması

CrewAI'den `Process.hierarchical` uzman ekipler üzerinden bir yönetici LLM'ye bağlantı kuruyor. Yönetici:

- üst düzey görevi alır,
- mürettebata alt görevler atar,
- mürettebat çıktılarını değerlendirir,
- kabul edilip edilmeyeceğine, yeniden devredileceğine veya yineleneceğine karar verir.

Belgeler: https://docs.crewai.com/en/introduction (Temel Kavramlar altında "Hiyerarşik Süreç"i arayın).

### Grafik-framework uygulaması

LangGraph iç içe geçmiş `create_supervisor` çağrıları kullanır. İç denetçinin kendi grafiği vardır; dış denetçi iç grafiği opak bir düğüm olarak ele alır. Bu, hata ayıklama açısından CrewAI'den daha temizdir (her grafikte ayrı ayrı adım atabilirsiniz) ancak ağacın dinamik yeniden şekillendirilmesini ifade etmek daha zordur.

Referans: https://reference.langchain.com/python/langgraph-supervisor.

## Build It — Kendin Geliştir

`code/main.py` 3 seviyeli bir hiyerarşi çalıştırır:

- üst düzey yönetici: bir görevi "mühendislik" ve "hukuk" dallarına ayırır,
- mühendislik alt yöneticisi: "ön uç" ve "arka uç" çalışanlara ayrılır,
- yasal alt yönetici: bir işçi.

Demo, mutlu yolu (herkes aynı fikirde) üst düzey yöneticinin ayrıştırmasının "yasal" kelimesini "finans" olarak yanlış etiketlediği ve hataların art arda izlediğini **karmaşık bir yol** ile karşılaştırıyor - alt yönetici itaatkar bir şekilde finans işini yapıyor, üst düzey sentezleyici finans bulgularını rapor ediyor, orijinal hukuki soru cevapsız kalıyor.

Koşmak:

```
python3 code/main.py
```

Çıktı, her iki yolu da "ne istendi" ve "neyin teslim edildiği" şeklinde net bir şekilde yan yana gösterir.

## Use It — Hazır Araçla Uygula

`outputs/skill-hierarchy-fitness.md` , belirli bir görevin hiyerarşik mi, sıralı mı yoksa düz denetleyici mi kullanması gerektiğini değerlendirir. Girdiler: görev tanımı, organizasyon yapısı, mutabakat bütçesi. Çıktı: Korunulacak belirli arıza modlarıyla birlikte model önerisi.

## Ship It — Kullanıma Sun

Hiyerarşik gönderim yapıyorsanız:

- **Ağaç derinliğini 2 olarak sınırlayın.** Üç düzey zaten çoğu hatayı observability'dan gizliyor.
- **Açık mutabakat bütçesi.** Üst yöneticinin taahhütte bulunmasından önce maksimum tur sayısını belirleyin. Genellikle 2.
- **Her sentezin kaynağı.** Her düğümün özeti, onu hangi yaprak çıktılarının ürettiğini belirtmelidir.
- **Ayrışma sapması konusunda uyarı.** Yöneticinin adım başına ayrıştırmasını kaydedin; Kullanıcı sorgusuna göre farklılık gösterir. Ayrıştırma artık sorguyu kapsamıyorsa bir uyarı tetikleyin.

## Egzersizler

1. `code/main.py` komutunu çalıştırın ve mutlu ile tedirgin olanı karşılaştırın. En üst çıktının kullanıcının sorusundan tamamen farklılaşması için yöneticinin kaç düzeyde devredilmesi gerekir?
2. Üçüncü bir düzey ekleyin (üst → alt → alt alt → çalışan). Derinlik arttıkça bozulan yolun ne sıklıkta kendini düzelttiğini ve tamamen farklılaştığını ölçün.
3. Her alt yöneticiye, orijinal kullanıcı sorusunun her zaman değiştirilmeden sorulduğu bir "kanarya" çalışanı uygulayın. Ayrışma sapmasını tespit etmek için kanarya cevabını kullanın. Kanarya sentezlenen cevaba katılmadığında yönetici nasıl tepki vermelidir?
4. CrewAI'nin `Process.hierarchical` belgelerini okuyun. CrewAI'nin uyguladığı somut bir korkuluk belirleyin (adım sınırı, yönetici_llm kısıtlaması) ve hangi arıza modunu hedeflediğini açıklayın.
5. Yuvalanmış LangGraph denetçilerini CrewAI hiyerarşik yapısıyla karşılaştırın. Hangisi mutabakat döngülerinin tespit edilmesini daha ucuz hale getirir?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Hiyerarşik | "Kuruluş şeması modeli" | Denetçiler, denetçiler üzerinde; yalnızca yapraklar işe yarar. |
| Yönetici Yüksek Lisans | "Patron" | Dahili bir düğümde ayrıştıran, atayan ve doğrulayan LLM. |
| Ayrışma kayması | "Patron komployu kaybetti" | Üst düzey yöneticinin bölünmesi artık asıl soruyu kapsamıyor. |
| Mutabakat döngüsü | "Sonsuz toplantılar" | Alt yöneticiler aynı fikirde değil; en iyi yeniden delegeler; işçiler yeniden çalışıyor; bütçe bitene kadar döngü. |
| Derinlik-2 tavan | "2 seviyeden daha derine inmeyin" | Ampirik korkuluk: 3+ seviye çöker observability. |
| Kanarya sorusu | "Her düzeyde temel gerçek" | Sapmayı tespit etmek için her zaman orijinal sorgunun değiştirilmeden sorulduğu bir çalışan. |
| Menşe zinciri | "Kim ne dedi" | Her sentezden, onu üreten yaprak çıktılarına kadar uzanan iz. |

## Daha Fazla Okuma

- [CrewAI tanıtımı — Process.hierarchical](https://docs.crewai.com/en/introduction) — bir yönetici Yüksek Lisans Yüksek Lisansı ile hiyerarşik ders kitabı
- [LangGraph gözetmen referansı](https://reference.langchain.com/python/langgraph-supervisor) — `create_supervisor` aracılığıyla iç içe geçmiş gözetmen
- [Antropik mühendislik — Araştırma sistemi](https://www.anthropic.com/engineering/multi-agent-research-system) — Antropik neden kasten hiyerarşik süpervizör yerine düz süpervizörü seçti?
- [Cemri ve ark. — Çoklu-Agent Yüksek Lisans Sistemleri Neden Başarısız Olur?](https://arxiv.org/abs/2503.13657) — MAST taksonomisi; Koordinasyon başarısızlıkları bölümü, ayrışma sapmasını belgeliyor
