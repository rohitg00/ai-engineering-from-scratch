# पुनः निर्माण और समान साबित करेंः अंतर परीक्षण, बाइट तुलना, और साक्ष्य लूप

> अपने परीक्षणों को पास करने के लिए अपने परीक्षणों पर सहमति साबित करता है, तो समानता एक ग्रिड की जरूरत है कि हर किनारे तक पहुँचता है और स्थानांतरण मास्क के बाद उस मैच बाइट्स.

**Type:** Build
**Languages:** Python, C, TypeScript
**Prerequisites:** Phase 13 · 34 (lifting to pseudocode), Phase 13 · 35 (evidence, confidence, and unknowns)
**Time:** ~110 minutes

## सीखने के लक्ष्य

- निर्देश सूची से पुनर्निर्माण लिखें और सबूत रिकॉर्ड का नाम दें जहां से यह आया था।
- प्रति खतरा एक वर्ग के साथ एक इनपुट ग्रिड बनाएंः शून्य सुरक्षा, नकारात्मक मान, ट्रंकिंग विभाजन, 32-बिट ओवरफ्लो, और एक विभाजन जाल।
- मूल और पुनर्निर्माण को एक कार्यक्रम में चलाएं और एक जाल सहित प्रत्येक सेल को रिकॉर्ड करें।
- मूल ध्वज के साथ पुनर्निर्माण को पुनः संकलित करें और स्थानांतरण फ़ील्ड को छिपाने के बाद फ़ंक्शन बाइट्स की तुलना करें।
- स्थलांतरण बिंदुओं को पढ़ें और उनकी तुलना करें, ताकि गलत शाब्दिक पास नहीं हो सके।
- एक छोटे से स्टूडियो क्लाइंट से rea के MCP सर्वर ड्राइव और अपने सबूत आईडी के साथ प्रत्येक कदम रिकॉर्ड.
- एक विफलता बंद सबूत रिकॉर्ड को तैयार करें जिसका आईडी उसके दावे और सबूत लिंक पर हैश है।

## समस्या

आपने रिया से कार्य के लिए डॉक्यूमेंटरी मांगी थी`percent_change`हमारे `ledger-x86_64-O1.o`Ghidra 12.1.4 एक छद्म कोड लौटा दिया, और एजेंट ने इस C लिखा है सेः

```c
int percent_change(int before, int after) {
    if (before == 0) return 0;
    return (int)(((long)after - before) * 100 / before);
}
```

चार परीक्षण पासः`(100, 150)`50 देता है।`(200, 100)`-50 देता है, `(0, 5)`0 देता है `(50, 100)`100 देता है। एजेंट भी पुनर्निर्माण किया गया।`grade`चार के रूप में `if`रिपोर्ट में कहा गया है कि "सत्यापित" है।

उस रिपोर्ट में निम्नलिखित प्रश्नों में से किसी का भी उत्तर नहीं दिया गया हैः

- मूल वापस क्या आता है जब `(after - before) * 100`32 बिट में फिट नहीं होता है?
- 110 के स्कोर के लिए मूल स्कोर क्या देता है?
- क्या पुनर्निर्माण मूल के समान 16 बाइट्स तक संकलित करता है?
- जब दो संकलित फ़ंक्शंस एक ही बाइट्स रखते हैं, तो क्या उनके स्थानांतरण एक ही स्थिरांक पर अंकित होते हैं?
- पुनर्निर्माण किस सबूत रिकॉर्ड से आया था, और क्या एजेंट ने सूची या छद्म कोड पढ़ा?
- C संकलक के बिना एक मेजबान पर सबूत क्या स्थिति प्राप्त करता है?

इस पाठ में प्रत्येक लक्ष्य एक प्रोग्राम है जिसे हमने लिखा और संकलित किया है। पाठ 32 के दायरे और कानून के नियम अपरिवर्तित लागू होते हैं।

```figure
re-36-prove-equal
```

## साक्ष्य क्या कहते हैं

एजेंट लूप में `code/main.py`स्टूडियो पर 6.5.0 पर छह कॉल किए।`code/fixtures/runs/agent-run.json`सर्वर ने जवाब दिया`initialize`प्रोटोकॉल संस्करण के साथ `2025-11-25`तीन कॉल सबूत रिकॉर्ड लौटा दियाः

| Step | Tool | Time | Evidence id |
|---|---|---|---|
| 2 | `analyze_function percent_change` | 6.31 s | `ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd` |
| 3 | `analyze_function grade` | 0.02 s | `ev_67b6d3f992eaf49a2e16de084b6ebfdd9884e8c5c7f75e175b7bb20f4f748ce1` |
| 4 | `read_bytes 0x1000b4, 20` | 0.00 s | `ev_c26146cfedf4c1ee146d8ff00cfa9a5d3f5335bdd9c97ccf4e1af5f6ea3ed6bc` |

पहले कॉल में गिद्रा आयात और ऑटो-विश्लेषण के लिए भुगतान किया गया। प्रत्येक रिकॉर्ड में`confidence: "observed"`,`authority: "shipped-artifact"`, और वस्तु का SHA-256 ,`9a4a8082ba5e285a732552981a6935e0c5255725664f380e37c44ebfb04d803f`. गिड्रा स्थानांतरित करने योग्य वस्तु को लोड करता है `.text`पर`0x100000`, तो `percent_change`पर बैठता है`0x100000`और `grade`पर`0x100010`. .

 के लिए छद्म कोड`percent_change`है जहां `long`से आया था

```c
undefined1  [16] percent_change(int param_1,int param_2,ulong param_3)
{
  long lVar1;
  undefined1 auVar3 [16];
  if (param_1 != 0) {
    lVar1 = (long)((param_2 - param_1) * 100);
    auVar3._0_8_ = lVar1 / (long)param_1 & 0xffffffff;
    auVar3._8_8_ = lVar1 % (long)param_1 & 0xffffffff;
    return auVar3;
  }
  ...
}
```

डिस्कोम्पाइलर ने देखा`cltd`और `idivl`दोनों लिखें `edx`और `eax`और एक 64-बिट विभाजन के साथ 16 बाइट रिटर्न मान का मॉडल। उसी रिकॉर्ड में सूची कुछ स्पष्ट कहते हैंः

```
0x100000: TEST EDI, EDI
0x100002: JZ 0x0010000d
0x100004: SUB ESI, EDI
0x100006: IMUL EAX, ESI, 0x64
0x100009: CDQ
0x10000a: IDIV EDI
0x10000c: RET
0x10000d: XOR EAX, EAX
0x10000f: RET
```

प्रत्येक ऑपरेशन 32 बिट्स चौड़ा है।`IMUL EAX, ESI, 0x64`32 बिट्स में गुणा और कम आधा रखता है।`CDQ`संकेत-विस्तार `eax`में`edx`और `IDIV EDI`64-बिट जोड़ी को 32-बिट विभाजक द्वारा विभाजित करता है। सूची के बाद एक पुनर्निर्माण है `100 * (after - before) / before`में `int`. .

`grade`रिकॉर्ड एक ही आकार है। छद्म कोड एक तालिका का नाम है,`*(uint *)(&DAT_001000b4 + (ulong)uVar2 * 4)`, और एक अपठनीय डिफ़ॉल्ट अभिव्यक्ति से बनाया गया `0x66666667`. सूची में 10 से विभाजित होने का संकेत है `IMUL RAX, RAX, 0x66666667`,`SAR RCX, 0x22`,`SHR RAX, 0x3f`,`ADD ECX, EAX`. . तो `ADD ECX, -0x6`,`CMP ECX, 0x4`और `JA`6 से 10 तक दसों को रखें।`XOR EAX, EAX`तुलना से पहले डिफ़ॉल्ट 0 है `LEA RCX, [0x1000b4]`और `MOV EAX, dword ptr [RCX + RAX*0x4]`चार बाइट प्रविष्टियों की पांच तालिका पढ़ें।

चरण 4 उन 20 बाइट्स को पढ़ेंः `01000000 02000000 03000000 04000000 04000000`. टेबल है`1, 2, 3, 4, 4`दस के लिए 6, 7, 8, 9, 10. यह है `switch`में `ledger.c`, के साथ `case 10`और `case 9`मूल्य को साझा करना 4.

रेआ के स्वयं के साक्ष्य पृष्ठों में दोनों सबूत सूचीबद्ध और से शुरू हुए `read_bytes`DX-Ball पहला छद्म कोड था`FUN_00406400(void)`बिना स्टैक इनपुट के, और निर्देश दृश्य इसे सुधार दिया. पहले सूची पढ़ें. रिकॉर्ड आईडी का उल्लेख, फिर C लिखें.

## उम्मीदवारों को लिखें

फ़ोल्डर `code/fixtures/candidates/`चार सूची का पालन करें या एक ही कोड के लिए संकलित करें चार विश्वसनीय और गलत हैं, या गलत है एक हाथ से लिखे परीक्षण के रूप में पता चलता है।

| File | Source | What it does |
|---|---|---|
| `percent_change_mul_first.c` | `100 * (after - before) / before` | the listing in C |
| `percent_change_split.c` | `(after * 100 - before * 100) / before` | different text, same bytes after clang folds it |
| `percent_change_wide.c` | `(int)(((long)after - before) * 100 / before)` | the pseudocode's `long`, divides before it wraps |
| `percent_change_div_first.c` | `(after - before) / before * 100` | divides first, so rounding differs |
| `grade_switch.c` | `switch (score / 10)` with the five cases | the original source |
| `grade_table.c` | `unsigned slot = score / 10 - 6; slot < 5 ? points[slot] : 0` | the listing in C |
| `grade_thresholds.c` | `if (score >= 90) return 4; ...` | no upper bound on the top band |
| `grade_case10_wrong.c` | `case 10: return 3;` | one table entry wrong |

प्रत्येक फ़ाइल फिक्स्चर कमांड के साथ संकलित, `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`. संकलित वस्तुओं स्रोतों के बगल में प्रतिबद्ध हैं ताकि परीक्षणों को बिना क्लिंग के एक मेजबान पर चलाया जाए.

## पहला पैरः निष्पादित करें और तुलना करें

मैककिमन की 1998 की परिभाषा में अंतर परीक्षण की आवश्यकता होती है "दो या दो से अधिक तुलनात्मक प्रणालियों" को "मैकेनिकल रूप से उत्पन्न परीक्षण मामलों" से खिलाया जाता है, और एक अलग परिणाम, एक लटकन, या एक दुर्घटना को बग उम्मीदवार के रूप में माना जाता है। उन्होंने कठिन भाग का नाम दियाः "परीक्षण में सबसे बुरी समस्या परीक्षण के परिणाम का आकलन करना है।" मूल कार्य यहाँ का प्रवचन है। हमें सही उत्तर जानने की जरूरत नहीं है। हमें मूल और पुनर्निर्माण की आवश्यकता है कि किसी भी ग्रिड पर असहमति न हो जो हर खतरे तक पहुंचता है।

### ग्रिड का डिज़ाइन

`input_grid()`में `code/main.py`92 कोशिकाओं का निर्माण करता है।`percent_change`यह दस से हर जोड़ी लेता है `before`मान और सात `after`मान:

```
before: 0, 1, -1, 3, -3, 7, 100, -100, 2147483647, -2147483648
after:  0, 5, -5, 105, 536870911, 2147483647, -2147483648
```

के लिए`grade`यह 22 अंक लेता हैः प्रत्येक बैंड के किनारे के दोनों पक्षों, नकारात्मक, 0, 110, और दो `int`सीमाएँ।`classify()`प्रत्येक सेल को टैग करें. ओवरफ्लो में 32 कोशिकाएं हैं, ऋण 17, सीमा 14, सादा 12, और शून्य गार्ड 7. नकारात्मक ट्रंकिंग में 5, गोल 2, स्विच 2 के परे और जाल 1 है।

प्रत्येक वर्ग एक कारण के लिए मौजूद है। शून्य गार्ड कोशिकाओं की जाँच करें`TEST EDI, EDI`शाखा. नकारात्मक कोशिकाओं का परीक्षण ट्रंकिंग विभाजनः सी और `idiv`शून्य की ओर घुमावदार, तो `-9 / 10`0 है और `-10 / 10`-1. घुमावदार कोशिकाओं जांचें कि गुणा विभाजन से पहले होता है, तो `(105 - 100) * 100 / 100`5 से ज्यादा नहीं 0 से ज्यादा प्रवाह कोशिकाओं का निर्माण होता है `(after - before) * 100`एक फंसी सेल के साथ लपेटकर उत्पाद बराबर होता है`INT_MIN`के साथ`before`-1 के बराबर है।

यांग, चेन, ईड और रेगेहर ने Csmith को बिना किसी अनिश्चित व्यवहार के प्रोग्राम उत्पन्न करने के लिए बनाया। अनिश्चित व्यवहार पर एक ओरेकल असहमति शोर है और कभी भी बग रिपोर्ट नहीं है। हस्ताक्षरित ओवरफ्लो सी में अपरिभाषित है। हमारा ओरेकल एक निश्चित व्यवहार वाला एक संकलित वस्तु है, इसलिए ओवरफ्लो कोशिकाएं दायरे में हैं। पाठ यह जानना है कि कौन से कोशिकाएं मानक पर आधारित हैं और कौन से संकलित बाइट्स पर आधारित हैं।

### चालक और जाल

`code/driver.c`stdin से प्रति पंक्ति एक सेल पढ़ता है और इनपुट, मूल परिणाम, और पुनर्निर्माण परिणाम प्रिंट करता है। `build_harness()`उम्मीदवार को `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`x86-64 लिनक्स होस्ट पर मूल फिक्स्चर ऑब्जेक्ट स्वयं है। किसी भी अन्य होस्ट पर यह है`ledger.c`मूल रूप से संकलित, और रिपोर्ट रिकॉर्ड `original_kind: fixture-source`. .

चालक एक `SIGFPE``sigsetjmp`और `siglongjmp`. . के लिए .`before = -1`और `after = 536870911`, अंतर 536870912 है और 32-बिट उत्पाद -2147483648 पर लपेटता है।`idiv`उस लाभांश और -1 के विभाजक के साथ विभाजन त्रुटि अपवाद बढ़ता है। गुणांक 32 बिट्स (इंटेल एसडीएम वॉल्यूम 2, आईडीआईवी) में फिट नहीं होता है। हैंडर इसे रिकॉर्ड किए गए मान में बदल देता है `trap`. .

AArch64 पर, `sdiv`एक ही ऑपरेन्ड के लिए -2147483648 लौटाता है। हमारे रन पर एक arm64 मैक रिकॉर्ड किया है कि ठीक है. Oracle वास्तुकला पर निर्भर करता है, और रिपोर्ट बताता है कि कौन एक चलाया।

### परिणाम

`prove_behaviour(PLAUSIBLE)`निर्माण करता है `long`10 naive cases pass. 28 कोशिकाओं पर ग्रिड विफल रहता है।

| Function | Inputs | Class | Original | Rebuild |
|---|---|---|---|---|
| `percent_change` | 3, 2147483647 | overflow | -133 | -1431655899 |
| `percent_change` | 100, 2147483647 | overflow | -101 | 2147483547 |
| `percent_change` | 2147483647, 5 | overflow | 0 | -99 |
| `grade` | 110 | beyond the switch | 0 | 4 |
| `grade` | 2147483647 | beyond the switch | 0 | 4 |

सभी 26 `percent_change`विफलताएं हैं ओवरफ्लो कोशिकाओं के साथ `|before| > 1`. . के लिए .`before`1 या -1 के बराबर 64-बिट गुणांक लपेटकर मूल्य पर वापस कटौती करता है, इसलिए उन कोशिकाओं को आकस्मिक रूप से सहमत होता है।`grade`विफलता क्योंकि मूल स्विच में दसियों के लिए कोई मामला नहीं है 11 और ऊपर, और `110 / 10`11 है।

`prove_behaviour(EQUAL)`निर्माण करता है `percent_change_mul_first.c`और `grade_switch.c`सभी 92 कोशिकाओं सहमत हैं।`percent_change_div_first.c`चार नाईव मामलों में से दो में विफलता, जो एक ही मामला है एक हाथ से लिखित परीक्षण पता चलता है।

`oracle_disagreements()`एक दूसरी बात की जाँच करता है।`percent_change_model()`और `grade_model()`सूची के पायथन मॉडल हैं, के साथ `wrap32()`32-बिट गुणा के लिए और `idiv32()`वास्तुकला नियम के लिए। रिपोर्ट प्रत्येक सेल पर देखे गए मूल के साथ मॉडल की तुलना करती है। शून्य असहमति का मतलब है कि मॉडल और द्विआधारी प्रत्येक सेल पर सहमत होते हैं। मॉडल व्युत्पन्न सबूत है और रन अवलोकन सबूत है। रिपोर्ट उन्हें अलग-अलग क्षेत्रों में रखती है।

## दूसरा पैरः फिर से संकलन और तुलना करें

एक ग्रिड पर व्यवहार एक पैर है। दूसरा पैर पूछता है कि क्या पुनर्विकास, एक ही संकलक और ध्वज के साथ संकलित, एक ही बाइट्स का उत्पादन करता है। डीएक्स-बॉल परियोजना ने अपने सहायक के लिए "63 मिलान बाइट्स" की सूचना दी। TH04 परियोजना ने 2,139 बाइट्स मिलान की सूचना दी। प्रत्येक ने अपनी अवधि के संकलक का उपयोग किया। rea स्वयं ऐसा नहीं कर सकता। इसका `compare_functions`लाइन-डिफ़्स प्रदाता पाठ और सीमा संलग्न "सम्मेलन अस्पष्ट प्रदाता पाठ है; स्थानांतरण सामान्यीकरण अनुपलब्ध है।"

### वस्तु को पढ़ें

`ElfObject`में `code/main.py`एक ELF64 स्थानांतरित करने योग्य वस्तु के साथ पढ़ता है `struct.unpack_from`यह जादू, 64-बिट वर्ग, छोटे-आदिश डेटा की जाँच करता है,`e_machine`62, तथा `e_type`1. फिर यह खंड के हेडर, स्ट्रिंग टेबल,`.symtab`, और हर `.rela`अनुभाग। फिटिंग में, `percent_change``.text`आकार 16 के साथ 0 का ऑफसेट और `grade`पर`0x10`आकार 46 के साथ।`total``0x40`आकार 31 और `grade_label`पर`0x60`आकार 63 के साथ।

 के 16 बाइट्स`percent_change`हैं`85 ff 74 09 29 fe 6b c6 64 99 f7 ff c3 31 c0 c3`. कार्य में कोई स्थानांतरण नहीं है.`grade`एक है: ऑफसेट `0x26`फ़ंक्शन के अंदर, प्रकार `R_X86_64_PC32`, प्रतीक `.rodata`, अतिरिक्त `0x10`यह 7 बाइट से संबंधित है`leaq`विलय में`0x23`, जिसका अंतिम चार बाइट विस्थापन क्षेत्र है।

### मास्क, फिर रिकॉर्ड की तुलना

एक RELA वस्तु में addend स्थानांतरण रिकॉर्ड में रहता है, और चार क्षेत्र बाइट शून्य हैं।`grade_switch.o`एक सादा बाइट तुलना पास जबकि दो स्थानान्तरण अलग स्थानों का नाम है। `mask_relocations()`दोनों तरफ के क्षेत्र को शून्य करता है वैसे भी, इसलिए एक ही विधि REL वस्तुओं के लिए और Mach-O के लिए लागू होती है, जहां क्षेत्र में addend होता है।

तो `prove_bytes()`स्थानांतरण रिकॉर्ड की तुलना ऑफसेट, प्रकार और लक्ष्य अनुभाग द्वारा करता है। मूल कहता है `.rodata+0x10`और उम्मीदवार कहता है `.rodata-0x4`. जोड़ अलग है क्योंकि उम्मीदवार वस्तु में कोई नहीं है `labels.rel`एक अलग जोड़ एक अलग ऑफसेट है, एक अलग समारोह नहीं है।

### स्थलांतरण बिंदुओं पर स्थिरांक पढ़ें

एक पीसी-संबंधी क्षेत्र के लिए जो अपने निर्देश को समाप्त करता है, सीपीयू अगले निर्देश पते को जोड़ता है, इसलिए लक्ष्य प्रतीक प्लस ऐडेंड प्लस 4 है। मूल में यह है `.rodata+0x14`, और उम्मीदवार में यह है `.rodata+0x0`. .`read_table()`वहाँ पांच 4-बाइट प्रविष्टियों पढ़ता है. दोनों पकड़ .`1, 2, 3, 4, 4`. .

सूची से पांचवीं गिनती आती हैः`CMP ECX, 0x4`के साथ`JA`सूचकांक 0 से 4 तक स्वीकार करता है और `[RCX + RAX*0x4]`प्रति सूचकांक 4 बाइट्स पढ़ता है। `CLAIMS`में `code/main.py``grade`और  के लिए शून्य स्थानांतरण रिकॉर्ड`percent_change`. .

यह चरण TH08 परियोजना द्वारा दस्तावेज किए गए बग के कारण मौजूद है। इसकी पुरानी तुलना "निर्देश के स्थानांतरण क्षेत्र में लक्ष्य पते को पुनः चलाया गया, फिर उस पते पर फ्लोटिंग-लिटरल डेटा की जांच किए बिना निर्देश बाइट्स की तुलना की गई। स्रोत `0.0`इसलिए लक्ष्य के विपरीत सटीक प्रतीत हो सकता है `128.0`" " फिक्स ने 1,548 फ्लोटिंग-लिटरल संदर्भों का ऑडिट किया और बारह और सुधार किए। `grade_case10_wrong.c`यह 46 बाइट्स के बराबर है, और यह तालिका है`1, 2, 3, 4, 3`केवल निरंतर चेक इसे विफल करता है।

### परिणाम

| Candidate | Size | Masked bytes | Relocation records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 vs 16 | equal | none | none | pass |
| `percent_change_split` | 16 vs 16 | equal | none | none | pass |
| `percent_change_wide` | 16 vs 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 vs 18 | size differs | none | none | fail |
| `grade_switch` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_table` | 46 vs 46 | equal | same shape | `1,2,3,4,4` both | pass |
| `grade_thresholds` | 46 vs 39 | size differs | 1 vs 0 | none | fail |
| `grade_case10_wrong` | 46 vs 46 | equal | same shape | `1,2,3,4,4` vs `1,2,3,4,3` | fail |

दो परिणामों को एक दूसरी बार देखने लायक हैं।`percent_change_split.c`अलग स्रोत पाठ और समान बाइट्स है, क्योंकि क्लांग हस्ताक्षरित ओवरफ्लो के रूप में अपरिभाषित और तह `after * 100 - before * 100`एक में गुणा।`grade_table.c`भी बाइट के लिए बाइट मेल खाता है, इसलिए संकलक एक सरणी सूचकांक से एक ही तालिका तक पहुँच गया और एक से `switch`. एक बाइट मैच साबित करता है कि इस संकलक, इन ध्वजों के साथ, उम्मीदवार से एक ही कोड उत्पन्न किया है. यह साबित नहीं करता है कि उम्मीदवार मूल स्रोत पाठ है.

आकार एक निदान है और एक स्वीकृति नहीं। rea के साक्ष्य पृष्ठों सही लंबाई के साथ 1,825 बाइट्स के उम्मीदवार और 467 अलग बाइट्स रिकॉर्ड करते हैं।`wide`पुनर्निर्माण 26 बाइट्स है क्योंकि `movslq`,`imulq`,`cqto`और `idivq`सूची हमें किसी भी संकलन से पहले चौड़ाई बता दिया था।

## एजेंट लूप ओवर रिया

आरईए के एमसीपी टूल में से 65 में सीएलआई कमांड नहीं है, और `verify_reconstruction`उनमें से एक है।`McpStdioClient`में `code/main.py`यह सबसे छोटा ग्राहक है जो उन्हें प्राप्त करता है. यह शुरू होता है`npx -y rea-agents@6.5.0 mcp`, stdin पर प्रति पंक्ति एक JSON-RPC अनुरोध लिखता है, और एक धागे पर stdout से प्रति पंक्ति एक JSON ऑब्जेक्ट पढ़ता है। यह भेजता है `initialize`प्रोटोकॉल संस्करण के साथ `2025-11-25`, तो `notifications/initialized`, तो `tools/call`. प्रति कॉल डिफ़ॉल्ट समय सीमा 330 सेकंड है, वही संख्या rea एक Ghidra ठंड शुरू करने के लिए अनुमति देता है।

`agent_loop()`करता है छह कॉल और रिकॉर्ड प्रत्येकः

```json
{
  "step": 2,
  "tool": "analyze_function",
  "arguments": {"procedure": "percent_change"},
  "seconds": 6.31,
  "is_error": false,
  "evidence_id": "ev_e88b10dc0c6400e51bb6f7fdc3eaea8d2c97cc02463f0db3e6afeefc273197cd",
  "confidence": "observed",
  "authority": "shipped-artifact",
  "limitations": ["Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.", "..."],
  "result_sha256": "..."
}
```

पुरा प्रमाण रिकॉर्ड एक ही फ़ाइल में उनके आईडी के तहत संग्रहीत किए जाते हैं।`table_address()``LEA``grade`सूचीबद्ध और इसे खिलाता है `read_bytes`. .`open_binary`,`get_evidence_bundle`और `close_binary`कोई सबूत रिकॉर्ड नहीं लौटाएं और शून्य आईडी के साथ दर्ज किए जाएं।

`run_agent(live=True)`जब `npx`रास्ते पर है और `GHIDRA_INSTALL_DIR`एक निर्देशिका नाम। अन्यथा यह फिगर फिर से चलाता है और यह कहते हैं कि पर stderr. परीक्षण एक कदम आगे जाते हैं। `code/tests/fake_rea_server.py`एक स्टैंड-इन सर्वर है जो प्रत्येक का जवाब देता है `tools/call`क्लाइंट और लूप प्रत्येक परीक्षण रन पर इसके खिलाफ चलाता है, बिना rea, Ghidra या Java स्थापित.

### क्या rea के सत्यापनकर्ता बता सकते हैं और नहीं कर सकते

वास्तविकता `verify_reconstruction`यह एक फ़ंक्शन के बारे में एक दावा की तुलना करता है प्रदाता पाठ से `compare_functions`. एक व्यवहारिक दावा दो रिकॉर्ड प्रक्रियाओं से पकड़े गए आंकड़ों की तुलना करता है `compare_process_captures`. जब स्रोत रिकॉर्ड में अपूर्ण कॉल कवरेज होता है, तो कॉल के बारे में दावा होता है `unknown`. rea के अंदर कुछ भी एक पुनर्निर्मित समारोह संकलित या अपने इनपुट ग्रिड पर चलाता है. इस पाठ में दो पैरों भाग है कि rea आप के लिए छोड़ देता है.

आरईए के दायित्व की पुस्तिका में प्रमाण रिकॉर्ड की उम्मीद है `predicate_type: "rea.reconstruction-proof"`,`operation: "verify_reconstruction_obligations"`,`confidence: "observed"`और `normalized_result.passed === true`. कोई भी सार्वजनिक वास्तविकता उपकरण इसे उत्सर्जित नहीं करता है.`build_proof()`में `code/main.py`इसे मिंट करेंः

```json
{
  "predicate_type": "rea.reconstruction-proof",
  "operation": "verify_reconstruction_obligations",
  "confidence": "observed",
  "authority": "controlled-replay",
  "normalized_result": {
    "passed": true,
    "status": "pass",
    "claims": [
      {"claim_id": "percent_change.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.behaviour", "kind": "behavioral", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "percent_change.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_e88b10dc..."]},
      {"claim_id": "grade.bytes", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]},
      {"claim_id": "grade.referenced-constants", "kind": "structural-function", "status": "pass", "evidence_ids": ["ev_67b6d3f9..."]}
    ]
  },
  "evidence_links": ["ev_e88b10dc...", "ev_67b6d3f9..."],
  "evidence_id": "ev_..."
}
```

आईडी है `ev_`और आईडी के बिना रिकॉर्ड के SHA-256 के साथ, सॉर्ट कुंजी कॉम्पैक्ट JSON पर। `aggregate()`विफलता से बंद है: `fail`जीतता है, तो `unknown`, और एक खाली दावे सूची है `unknown`. सी संकलक के बिना एक होस्ट पर दो व्यवहार के दावे हैं `unknown`, तो रिकॉर्ड कहता है`unknown`भले ही दोनों बाइट दावा पारित हो जाए। `authority`है `controlled-replay`, क्योंकि सबूत हमारे अपने हर्नल से आता है और केवल वस्तु फ़ाइल से नहीं।

## क्या कहते हैं शोध

लियू, राफ और मिकिन्स्की ने 2026 में नौ कॉन्फ़िगरेशनों में आठ डिकोम्पाइल सिस्टम मापे। जिन उम्मीदवारों ने प्रत्येक परीक्षण में सफलता प्राप्त की है, वे अभी भी फ्यूज इनपुट पर भिन्न हैं। यह दर कुल मिलाकर 4.9 प्रतिशत थी और एक प्रणाली के लिए 13 प्रतिशत तक थी। 300 गिटहब लाइब्रेरी फ़ंक्शंस और 287 सीवीई-आधारित फ़ंक्शंस पर, सबसे मजबूत परिष्करण मॉडल ने गिड्रा की निर्माण दर को 75 प्रतिशत से बढ़ाकर 90 प्रतिशत कर दिया। उसी कार्यों पर व्यवहारिक मैच दर 74 प्रतिशत से घटकर 62 प्रतिशत हो गई। उन्होंने आविष्कार किए गए क्षेत्रों, प्रकारों, कॉलियों और गार्ड्स से कारण का पता लगाया जो पारंपरिक डिकॉम्पिलर द्वारा छोड़े जाने वाले दृश्य अज्ञात को बदलते हैं।

हमारी `percent_change_wide.c`एक प्रकार का प्रयोग किया जाता है।`long`, पुनर्निर्माण ने इसे बनाए रखा, और परिणाम संकलित किया, दस परीक्षण पारित किए, और 26 ओवरफ्लो कोशिकाओं में विफल रहा। ग्रेड-थ्रेशल्ड पुनर्निर्माण एक आविष्कार गार्ड है। दोनों को एलएलएम 4डेकंपिल मीट्रिक के तहत पुनः निष्पादित करने योग्य माना जाएगा, जो आउटपुट को पुनः संकलित करता है और बेंचमार्क के दावों को चलाता है। गिदरा के अपने साइडो-सी ने ह्यूमनईवल-डेकंपिल पर उन दावों का 20.12 प्रतिशत पारित किया।

डेकंपिलबेंच ने 130 वास्तविक कार्यक्रमों से 23,400 फ़ंक्शन मापे। यह पाया कि औद्योगिक डेकंपिलरों की तुलना में कार्यक्षमता सटीकता पर एलएलएम विधियां 52.2 प्रतिशत कम थीं, जिनमें उच्च समझ योग्यता स्कोर थे।

तीन सबूतों का उपयोग क्षेत्र तीन पैरों आप बना सकते हैं. फीनिक्स और ड्रीम आउटपुट को फिर से संकलित करें और मूल कार्यक्रम के परीक्षण चलाएं। मैककिमन और सीस्मिथ मूल के खिलाफ उत्पन्न इनपुट चलाते हैं, जिसमें इनपुट परिभाषित व्यवहार के भीतर रखे जाते हैं। रामोस और एंगलर सीमाबद्ध प्रतीकात्मक निष्पादन के साथ दो सी फ़ंक्शन की जांच करते हैं, जो एक इनपुट आकार तक सभी खोजे गए पथों पर समानता साबित करता है। यह सबक पहले दो को बनाता है। तीसरा है अभ्यास प्रयोगशाला में पाठ 35 के सबूत लेजर जब एक ग्रिड बहुत छोटा है भरोसा करने के लिए.

## इसे बनाओ

मानक पुस्तकालय हर्नेस चलाएंः

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
```

इस तरह, डेमो में दोनों उम्मीदवार जोड़े को संकलित किया जाता है और प्रत्येक के लिए 92 कोशिकाओं को चलाया जाता है। यह आठ उम्मीदवारों को फिर से संकलित करता है, एजेंट रन को फिर से चलाता है, और सबूत रिकॉर्ड को मचाता है। बिना क्लिंग के यह प्रतिबद्ध वस्तुओं को पढ़ता है और व्यवहार के दावों को रिपोर्ट करता है।`unknown`. .

एक arm64 मैक पर अपेक्षित आकारः

```json
{
  "host": "aarch64 Darwin",
  "originalKind": "fixture-source",
  "gridCells": 92,
  "plausible": {"naivePassed": true, "gridMismatches": 28, "oracleDisagreements": 0},
  "equal": {"naivePassed": true, "gridMismatches": 0, "oracleDisagreements": 0},
  "legTwo": {
    "percent_change_mul_first": {"status": "pass", "reasons": []},
    "percent_change_wide": {"status": "fail", "reasons": ["size 16 vs 26 bytes"]},
    "grade_case10_wrong": {"status": "fail", "reasons": ["referenced constants differ: [1, 2, 3, 4, 4] vs [1, 2, 3, 4, 3]"]}
  },
  "agentRun": {"mode": "replayed fixture", "server": {"name": "rea", "version": "6.5.0", "protocolVersion": "2025-11-25"}},
  "proof": {"status": "pass", "evidence_id": "ev_..."}
}
```

पढ़िए `code/main.py`इस क्रम मेंः

1. `wrap32()`,`c_div()`,`idiv32()`और दोनों `*_model()`फ़ंक्शन सूची के पूर्णांक अर्थशास्त्र को धारण करते हैं।
2. `input_grid()`और `classify()`92 कोशिकाओं का निर्माण और टैग।
3. `build_harness()`और `execute()`मूल से एक कार्यक्रम संकलित करें, नाम बदलने वाले उम्मीदवारों, और `driver.c`, फिर कोशिकाओं को चलाएं.
4. `prove_behaviour()`असंगति और मॉडल मतभेदों के साथ पहला चरण रिपोर्ट लौटाता है।
5. `ElfObject`शीर्षक, प्रतीक और `.rela`रिकॉर्ड।`mask_relocations()`और `read_table()`तुलना तैयार करें।
6. `prove_bytes()`आकार, छिपे हुए रेंज, स्थानांतरण आकार और तालिकाओं के साथ दो पैर रिपोर्ट लौटाता है।
7. `McpStdioClient`और `agent_loop()`ड्राइव रिया और रिकॉर्ड प्रत्येक कदम.
8. `build_proof()`और `aggregate()`असफल बंद रिकॉर्ड को नमाज़ में रखा गया है।

## इसका प्रयोग करें

एक नए कार्य के बराबर साबित करने के लिए, इन चरणों को दोहराएंः

1. लाओ `analyze_function`कार्य के लिए और सबूत आईडी दर्ज करें। प्यूडोकोड से पहले सूची पढ़ें।
2. सूची के संचालन चौड़ाई से उम्मीदवार लिखें। मूल के कार्य नाम को रखें।
3. सूची में प्रत्येक गुणा, जोड़, घटा और विभाजित करें। ग्रिड इनपुट जोड़े जो प्रत्येक को अपनी चौड़ाई पर लपेटते हैं।
4. सूची में प्रत्येक तुलना निरंतर के दोनों पक्षों को जोड़ें।`grade`जो घटाने के बाद 6 और 4 थे।
5. लक्ष्य पर फंस सकता है कि प्रत्येक विभाजक जोड़ें, और रिकॉर्ड किस वास्तुकला ग्रिड चलाया।
6. दोनों पैरों को चलाएं और स्थिति से पहले कारणों को पढ़ें।
7. उम्मीदवार के पास सबूत रिकॉर्ड रखें।`evidence_links`एक पाठक को बताएं कि दावे का रिकॉर्ड किस पर आधारित है।

किसी भी संकलक अद्यतन के बाद दोनों पैरों को फिर से चलाएं। एक बाइट मैच एक सेट ध्वज के साथ एक संकलक के बारे में एक कथन है।

## इंटरैक्टिव लैब

### लैब एः मॉडल और रन

`code`निर्देशिका, खुला पायथनः

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code
python3 -q
```

दौड़ें:

```python
from main import *
percent_change_model(3, INT_MAX)
percent_change_model(-1, 536870911, "x86_64")
percent_change_model(-1, 536870911, "aarch64")
report = prove_behaviour(PLAUSIBLE)
report.naive_passed, len(report.mismatches), report.mismatches[0]
```

पहला कॉल -133 देता है, लपेटा हुआ उत्पाद 3 से विभाजित होता है। दूसरा देता है `'trap'`और तीसरा -2147483648 देता है। रिपोर्ट में दस भोले मामले पारित किए गए और 28 ग्रिड सेल विफल रहे। तुलना करें।`report.oracle_disagreements`एक खाली सूची के साथ।

### लैब बीः ऑब्जेक्ट पढ़ें

```python
obj = ElfObject(ORIGINAL_OBJECT)
grade = obj.function("grade")
grade.size, grade.data[0x26:0x2a].hex(), grade.relocations
read_table(obj, grade.relocations[0], 5, 4)
```

फ़ील्ड बाइट्स `00000000`. स्थानान्तरण के नाम `.rodata`अतिरिक्त के साथ `0x10`, और टेबल पढ़ता है `[1, 2, 3, 4, 4]`. .

### लैब सीः एक निरंतर तोड़

```python
report = prove_bytes("grade", CANDIDATES / "grade_case10_wrong.o")
report.masked_equal, report.relocations_match, report.tables_equal, report.reasons()
```

बाइट्स मेल खाते हैं, रिकॉर्ड मेल खाते हैं, और तालिकाओं नहीं. अब संपादित करें `grade_case10_wrong.c`तो `case 10`4 फिर से लौटाता है, इसे फिक्स्चर कमांड के साथ फिर से संकलित करें, और स्थिति परिवर्तन को देखने के लिए `pass`. .

### लैब डी: ड्राइव rea

रिया 6.5.0 और गिदरा 12.1.4 स्थापित के साथः

```bash
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
python3 code/main.py --live
GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec \
JAVA_HOME=/opt/homebrew/opt/openjdk@21 \
npx tsx code/main.ts --live
```

पहला `analyze_function`Ghidra ऑब्जेक्ट आयात करते समय कुछ सेकंड लगते हैं। नए सबूत आईडी की तुलना किए गए रन के साथ करें। एक ही विश्लेषण प्रोफ़ाइल के तहत एक ही बाइट एक ही आईडी देते हैं, क्योंकि आईडी एक सामग्री हैश है जो फ़ाइल पथ को बाहर करता है।

## अभ्यास प्रयोगशाला

दोनों पैरों को बढ़ाकर `total`और `grade_label`एक ही वस्तु से।

आवश्यकताएँः

- के लिए`total`एक शून्य संख्या, एक नकारात्मक संख्या, एक तत्व, और 32 बिट्स के साथ कुल जोड़ें।
- के लिए`grade_label`, फ़ंक्शन कॉल करता है `grade`इनलाइन और पढ़ता है `labels.rel`, एक तालिका में अपने स्वयं के स्थानान्तरण के साथ पांच सापेक्ष स्ट्रिंग ऑफसेट `.rela.rodata`. .
- एक जोड़ें `CLAIMS` के लिए प्रविष्टि`grade_label`दो स्थानांतरण और पांच 4-बाइट प्रविष्टियों की एक तालिका के साथ, और प्रविष्टियों के संकेतों की स्ट्रिंग की तुलना करें।
- रिकॉर्ड करें कि मॉडल और रन किस पर असहमत हैं, यदि कोई है, और सूची से प्रत्येक को समझाएं।
- प्रूफ रिकॉर्ड में प्रति फीट प्रति फ़ंक्शन एक दावा जोड़ें और समग्र विफलता-बंद रखें।

सफलता का अर्थ है कि प्रमाण रिकॉर्ड चार कार्यों को सूचीबद्ध करता है, प्रत्येक दावे में प्रमाण आईडी है, और `grade_label`जब एक लेबल स्ट्रिंग अलग हो तो विफल होता है।

## ग्रेड लैब

इस पाठ के फिक्स्चर के बारे में पांच प्रश्न. प्रत्येक उत्तर को आपके द्वारा निर्मित कोड के साथ खोजें, फिर इसे लिखें `code/lab_answers.json`. संख्याओं को संख्याओं या हेक्स स्ट्रिंग के रूप में लिखें जैसे `"0x40"`, और JSON सूची के रूप में सूची।

1. `t1`: percent_change_model(3, 105) पर x86_64.
2. `t2`: percent_change_model(0, 5) पर x86_64.
3. `t3`: grade_model(100) ।
4. `t4`: input_grid में कोशिकाओं की संख्या() ।
5. `t5`: ग्रिड कोशिकाओं की संख्या जहां x86_64 मॉडल फंस जाता है।

अपने उत्तरों की जाँच करेंः

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/lab.py
npx tsx code/lab.ts
```

चेकर प्रत्येक अपेक्षित मूल्य की गणना करता है `code/main.py`यह प्रिंट करता है`PASS`,`FAIL`या `TODO`प्रत्येक कार्य के लिए और एक स्कोर, और यह 0 से केवल जब सभी पांच पास छोड़ देता है। `python3 code/lab.py my-answers.json`एक और फ़ाइल की जाँच करता है। `code/tests/test_lab.py`यह साबित करता है कि जांचकर्ता सही उत्तरों को स्वीकार करता है और गलत उत्तरों को अस्वीकार करता है।

### इसे चलते देखें

[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)यह सबक एक ऐसा कदम है जो उस दावे को एक सत्यापित करने में मदद करता है।

## आउटपुट कौशल

यह सबक हमें फल देता है`outputs/skill-rebuild-and-prove-equal.md`. इसका उपयोग कार्य सबूत और एक उम्मीदवार को दो-पैर का प्रमाण और प्रमाण रिकॉर्ड में बदलने के लिए करें। कौशल के लिए छद्म कोड से पहले सूचीबद्ध करना आवश्यक है, प्रत्येक जोखिम वर्ग के साथ एक ग्रिड, स्थानांतरण मुखौटा और एक निरंतर जांच, और एक विफलता बंद संश्लेषण।

## जाँचें

डेमो और परीक्षण सूट चलाएंः

```bash
cd phases/13-tools-and-protocols/36-rebuild-and-prove-equal
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

35 परीक्षणों से पता चलता हैः

- `c_div()`शून्य की ओर ट्रंक करता है और `wrap32()`दो के पूरक के बाद
- मॉडल -133 के लिए देता है `(3, INT_MAX)`,`trap`x86-64 पर फंसी सेल और AArch64 पर -2147483648 के लिए
- ग्रिड में 92 कोशिकाएं और हर जोखिम वर्ग हैं, और भोले मामलों हर कठिन वर्ग से बचें
- ELF रीडर रिकॉर्ड किए गए ऑफसेट और आकारों पर चार फ़ंक्शन पाता है
- `percent_change`कोई स्थानांतरण के बिना 16 बाइट है और `grade`एक है`R_X86_64_PC32`पर`0x26`
- स्थानांतरण क्षेत्र बाइट शून्य हैं और इस RELA वस्तु में कोई परिवर्तन नहीं है
- सभी आठ प्रतिबद्ध उम्मीदवारों को अपेक्षित स्थिति प्राप्त होती है, जिसमें दर्ज कारणों के साथ
- `grade_case10_wrong`छिपे बाइट्स पारित करता है और केवल निरंतर जांच विफल
- रिकॉर्ड किए गए पैर-एक रन में दस भोले पास, 28 असंगतियां और शून्य मॉडल मतभेद दिखाए गए हैं
- एक संकलक के साथ, दोनों जोड़े एक ही परिणाम के साथ पुनर्निर्माण और पुनः चलाने
- एजेंट द्वारा संचालित किए गए वस्तु को SHA-256 द्वारा क्रमशः `ev_`हर सबूत चरण पर आईडी
- `read_bytes`रिकॉर्ड ईएलएफ पाठक की तालिका के बराबर है
- क्लाइंट नकली सर्वर चलाता है और रिकॉर्ड करता है एक ही सबूत आईडी के रूप में असली रन
- सर्वर से त्रुटि परिणाम रन रिकॉर्ड में जाता है
- `aggregate()`विफलता से बंद हो गया है और प्रमाण आईडी अपनी सामग्री से पुनः गणना करता है

## उत्पादन विफलता मोड

| Failure | What the weak report says | What the harness must prove |
|---|---|---|
| Rebuild keeps the decompiler's `long` | "ten tests pass" | 26 overflow cells differ from the original |
| Thresholds replace a switch | "every grade band passes" | 110 and larger return 0 in the original |
| Divide before multiply | "formula is algebraically equal" | rounding cells differ, naive cases fail |
| Trap cell skipped | "no crashes" | x86-64 raises `#DE`, AArch64 returns `INT_MIN`, the report names the host |
| Byte compare without masking | "bytes equal" | relocation records name different offsets |
| Masking without reading constants | "bytes equal after masking" | `1,2,3,4,3` differs from `1,2,3,4,4` |
| Size taken as acceptance | "same length" | differing bytes inside the same length |
| Different compiler or flags | "bytes differ, rebuild wrong" | the same source gives different bytes, so the compare is void |
| Model treated as observation | "model agrees" | the run is observed, the model is derived, disagreements are listed |
| Claim without evidence id | "verified" | every claim links an `ev_` record of the function it covers |
| No compiler on the CI host | "passed" | behaviour claims are `unknown` and the aggregate is `unknown` |
| Pseudocode read as source | "decompiler says long" | the listing shows `IMUL EAX`, `CDQ`, `IDIV EDI` |

## परिचालन नियम

सूची से पुनर्निर्माण लिखें और उस रिकॉर्ड का नाम दें, जो आया था। इसे मूल के खिलाफ एक ग्रिड पर चलाएं जो प्रत्येक मध्यवर्ती को लपेटता है और प्रत्येक तुलना स्थिर को पार करता है। इसे मूल ध्वजों के साथ फिर से संकलित करें, स्थानांतरण क्षेत्रों को मास्क करें, रिकॉर्ड की तुलना करें, और वे निरंतर पढ़ें। प्रत्येक दावे को इसकी सबूत आईडी के साथ रिकॉर्ड करें, और एक अप्रत्याशित दावे को अज्ञात रहने दें।

## आगे पढ़ना

- [McKeeman, Differential Testing for Software, Digital Technical Journal 10(1), 1998](https://www.cs.tufts.edu/comp/150FP/archive/bill-mckeeman/DifferentailTesting.pdf)
- [Yang, Chen, Eide, Regehr, Finding and Understanding Bugs in C Compilers, PLDI 2011](https://doi.org/10.1145/1993498.1993532)
- [Ramos, Engler, Practical, Low-Effort Equivalence Verification of Real Code, CAV 2011](https://doi.org/10.1007/978-3-642-22110-1_55)
- [Schwartz, Lee, Woo, Brumley, Native x86 Decompilation Using Semantics-Preserving Structural Analysis, USENIX Security 2013](https://www.usenix.org/conference/usenixsecurity13/technical-sessions/presentation/schwartz)
- [Liu, Raff, Micinski, When LLM Decompilers Recompile More and Preserve Less, arXiv 2609.05370, 2026](https://arxiv.org/abs/2609.05370)
- [Gao et al., DecompileBench, Findings of ACL 2025](https://aclanthology.org/2025.findings-acl.1194/)
- [Tan et al., LLM4Decompile, arXiv 2403.05286, 2024](https://arxiv.org/abs/2403.05286)
- [System V gABI, Chapter 4, Relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html)
- [x86-64 psABI repository, relocation types](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Intel 64 and IA-32 Architectures Software Developer's Manual, Volume 2, IDIV](https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html)
- [Arm Architecture Reference Manual for A-profile, DDI 0487, SDIV](https://developer.arm.com/documentation/ddi0487/latest)
- [rea 6.5.0 MCP contracts](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/mcp-contracts.md)
- [rea 6.5.0 reconstruction obligation ledgers](https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/reconstruction-obligation-ledgers.md)
