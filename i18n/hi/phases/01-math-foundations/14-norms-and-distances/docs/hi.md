# मानदंड और दूरी

> दूरी फ़ंक्शन से पता चलता है कि "समान" का क्या मतलब है। गलत चुनें और सब कुछ नीचे धारा टूट जाता है।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## सीखने के लक्ष्य

- L1, L2, cosine, Mahalanobis, Jaccard को लागू करें, और दूरी कार्यों को खरोंच से संपादित करें
- किसी दिए गए ML कार्य के लिए उपयुक्त दूरी मीट्रिक चुनें और बताएं कि विकल्प विफल क्यों होते हैं
- L1 और L2 मानदंडों को LASSO और Ridge नियमन और उनके ज्यामितीय प्रतिबंध क्षेत्रों से जोड़ें
- यह प्रदर्शित करें कि एक ही डेटासेट विभिन्न मीट्रिक के तहत विभिन्न निकटतम पड़ोसियों का उत्पादन कैसे करता है

## समस्या

आपके पास दो वेक्टर हैं. शायद वे शब्द एम्बेड हैं. शायद वे उपयोगकर्ता प्रोफाइल हैं. शायद वे पिक्सल सरणी हैं. आपको यह जानना होगाः वे कितने करीब हैं?

उत्तर पूरी तरह से निर्भर करता है कि आप किस दूरी समारोह का चयन करते हैं. दो डेटा बिंदु एक मीट्रिक के तहत निकटतम पड़ोसी हो सकते हैं और दूसरे के तहत दूर अलग हो सकते हैं. आपका KNN वर्गीकरण, आपका सिफारिश इंजन, आपका वेक्टर डेटाबेस, आपका क्लस्टरिंग एल्गोरिदम, आपका नुकसान समारोह - वे सभी इस विकल्प पर निर्भर करते हैं। इसे गलत करें और आपका मॉडल गलत चीज के लिए अनुकूलित करता है।

एक सार्वभौमिक दूरी नहीं है। L2 स्थानिक डेटा के लिए काम करता है। कॉसिन समानता एनएलपी पर हावी है। जैकर्ड सेटों को संभालता है। दूरी को संपादित करना स्ट्रिंगों को संभालता है। महलनोबीस सहसंबंधों के लिए खाता है। वास्स्टीन संभावना द्रव्यमान को स्थानांतरित करता है। प्रत्येक "समान" का अर्थ क्या है, इसके बारे में एक अलग धारणा को कोड करता है।

यह सबक हर प्रमुख दूरी फ़ंक्शन को खरोंच से बनाता है, आपको दिखाता है कि प्रत्येक सही उपकरण कब है, और दिखाता है कि आप किस मीट्रिक का उपयोग करते हैं के आधार पर एक ही डेटा पूरी तरह से अलग-अलग पड़ोसी उत्पन्न करता है।

## अवधारणा

### मानकः वेक्टर परिमाण माप

एक मानदंड वेक्टर के "आकार" को मापता है। दो वेक्टरों के बीच प्रत्येक दूरी समारोह को उनके अंतर के मानदंड के रूप में लिखा जा सकता हैः$d(a, b) = \lVert a - b \rVert$तो मानदंडों को समझना दूरी को समझना है।

### L1 Norm (मैनहट्टन दूरी)

L1 मानदंड सभी घटकों के निरपेक्ष मानों का योग है।

```math
\lVert x \rVert_1 = |x_1| + |x_2| + \cdots + |x_n|
```

इसे मैनहट्टन दूरी कहा जाता है क्योंकि यह मापता है कि आप शहर के ग्रिड पर कितनी दूर जाते हैं जहां आप केवल अक्षों के साथ आगे बढ़ सकते हैं। कोई अनुदैर्ध्य नहीं।

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

L1 का उपयोग कब करेंः
- उच्च आयामी दुर्लभ डेटा (पाठ विशेषताएं, एक-गर्म एन्कोडिंग)
- जब आप असाधारण के लिए मजबूत चाहते हैं (एक ही विशाल अंतर हावी नहीं है)
- विशेषता चयन समस्याएं (L1 नियमितता स्परसिटी को बढ़ावा देती है)

L1 नियमितकरण (लासो) से संबंधः जोड़ना $\lVert w \rVert_1$L1 पेनल्टी वजन स्थान में हीरा के आकार के प्रतिबंध क्षेत्र बनाता है, और हीरे के कोनों अक्षों पर स्थित हैं जहां कुछ वजन शून्य हैं।

हानि कार्यों के साथ संबंधः औसत पूर्ण त्रुटि (MAE) भविष्यवाणियों और लक्ष्यों के बीच औसत L1 दूरी है। यह सभी त्रुटियों को रैखिक रूप से दंडित करता है, जिससे यह एमएसई की तुलना में अप्रासंगिक के लिए मजबूत होता है।

### L2 मानदंड (यूक्लिडियन दूरी)

L2 मानदंड सीधी रेखा की दूरी है। वर्ग मूल वर्ग घटकों के योग का है।

```math
\lVert x \rVert_2 = \sqrt{x_1^2 + x_2^2 + \cdots + x_n^2}
```

यह दूरी आप ज्यामिति कक्षा में सीखा है.$n$आयाम।

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

L2 का उपयोग कब करेंः
- निम्न-मध्यम आयाम के निरंतर डेटा
- जब विशेषता पैमाने तुलनात्मक हैं
- भौतिक दूरी (स्थानिक डेटा, सेंसर रीडिंग)
- पिक्सेल स्तर पर छवि समानता

L2 नियमितकरण (रिज) से कनेक्शनः जोड़ना $\lVert w \rVert_2^2$L1 के विपरीत, यह वजन को शून्य तक नहीं धकेलता है। यह सभी वजन को शून्य की ओर समानुपातिक रूप से छोटा करता है। L2 दंड परिपत्र प्रतिबंध क्षेत्रों को बनाता है, इसलिए अक्षों पर कोई कोण नहीं है। वजन छोटे होते हैं लेकिन शायद ही कभी बिल्कुल शून्य होते हैं।

हानि के कार्यों के साथ संबंधः औसत वर्ग त्रुटि (MSE) L2 वर्ग की दूरी का औसत है। वर्गण बड़ी त्रुटियों की तुलना में छोटी त्रुटियों को अधिक भारी दंडित करता है।

```math
\begin{aligned}
\text{MAE (L1 loss):} \quad & |y - \hat{y}| && \text{Linear penalty. Robust to outliers.} \\
\text{MSE (L2 loss):} \quad & (y - \hat{y})^2 && \text{Quadratic penalty. Sensitive to outliers.}
\end{aligned}
```

### सामान्य परिवार

L1 और L2 Lp मानदंड के विशेष मामले हैंः

```math
\lVert x \rVert_p = (|x_1|^p + |x_2|^p + \cdots + |x_n|^p)^{1/p}
```

 के विभिन्न मान$p$विभिन्न आकार के "इकाई गोले" (उत्पत्ति से अधिकतम 1 की दूरी पर सभी बिंदुओं का सेट; नीचे दिए गए आकार उनकी सीमाएं हैं) उत्पन्न करेंः

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-अनंतता मानदंड (चेबिशेव दूरी)

जैसे $p$अनंत के करीब, Lp मानदंड अधिकतम पूर्ण घटक के लिए अभिसरण।

```math
\lVert x \rVert_\infty = \max(|x_1|, |x_2|, \ldots, |x_n|)
```

दो बिंदुओं के बीच की दूरी एक ही आयाम द्वारा निर्धारित की जाती है जहां वे सबसे अधिक भिन्न होते हैं। अन्य सभी आयामों को अनदेखा किया जाता है।

```math
\begin{aligned}
\text{Point } A &= (1, 1) \\
\text{Point } B &= (4, 5) \\[6pt]
L_\infty \text{ distance} &= \max(|4-1|, |5-1|) = \max(3, 4) = 4
\end{aligned}
```

L- इन्फिनिटी का उपयोग कब करेंः
- जब किसी भी एकल आयाम में सबसे खराब विकृति मायने रखती है
- खेल बोर्ड (शतरंज में एक राजा एल-अनंत में चलता हैः किसी भी दिशा में एक कदम की लागत 1)
- विनिर्माण सहिष्णुता (हर आयाम विनिर्देशों के भीतर होना चाहिए)

### कॉसिन समानता और कॉसिन दूरी

कॉसिन समानता दो वेक्टरों के बीच कोण को मापती है, उनकी परिमाणों को अनदेखा करती है।

```math
\text{cos\_sim}(a, b) = \frac{a \cdot b}{\lVert a \rVert_2 \, \lVert b \rVert_2}
```

यह -1 (उपरोधी दिशाओं) से +1 (एक ही दिशा) तक होता है। लंबवत वेक्टरों में कोसिन समानता 0 होती है।

कॉसिन दूरी इसे एक दूरी में परिवर्तित करती हैः कॉसिन_दूरी = 1 - कॉसिन_समानता। यह 0 (समान दिशा) से 2 (उपरोधी दिशा) तक होता है।

```math
\begin{aligned}
& a = (1, 0) \qquad b = (1, 1) \\[6pt]
& \text{cos\_sim} = \frac{1 \cdot 1 + 0 \cdot 1}{1 \cdot \sqrt{2}} = \frac{1}{\sqrt{2}} = 0.707 \\
& \text{cos\_dist} = 1 - 0.707 = 0.293
\end{aligned}
```

क्यों कॉसिन एनएलपी और एम्बेडिंग पर हावी हैः पाठ में, दस्तावेज़ की लंबाई समानता को प्रभावित नहीं करनी चाहिए। बिल्लियों के बारे में एक दस्तावेज जो बिल्लियों के बारे में एक अन्य दस्तावेज की तुलना में दो बार लंबा है, उसे अभी भी "समान" होना चाहिए। कॉसिन समानता परिमाण (लंबाई) को अनदेखा करती है और केवल दिशा की परवाह करती है। एक ही शब्द वितरण के साथ दो दस्तावेज लेकिन अलग लंबाई एक ही दिशा में इंगित करते हैं और कॉसिन समानता 1.0 प्राप्त करते हैं।

कॉसिन समानता का उपयोग कब करेंः
- पाठ समानता (TF-IDF वेक्टर, शब्द एम्बेडेड, वाक्य एम्बेडेड)
- कोई भी क्षेत्र जहां परिमाण शोर है और दिशा संकेत है
- सिफारिश प्रणाली (उपयोगकर्ता वरीयता वेक्टर)
- एम्बेडिंग खोज (वेक्टर डेटाबेस लगभग हमेशा कॉसिन या डॉट उत्पाद का उपयोग करते हैं)

### डॉट उत्पाद समानता बनाम कॉसिन समानता

दो वेक्टरों का बिंदु गुणकः

```math
\begin{aligned}
a \cdot b &= a_1 b_1 + a_2 b_2 + \cdots + a_n b_n \\
&= \lVert a \rVert \, \lVert b \rVert \cos(\text{angle})
\end{aligned}
```

कॉसिन समानता दोनों आयामों द्वारा सामान्यीकृत बिंदु उत्पाद है। जब दोनों वेक्टर पहले से ही इकाई-सामान्य (मगीनता = 1) हैं, तो बिंदु उत्पाद और कॉसिन समानता समान होती है।

```math
\text{If } \lVert a \rVert = 1 \text{ and } \lVert b \rVert = 1: \quad a \cdot b = \cos(\text{angle between } a \text{ and } b)
```

जब वे भिन्न होते हैंः डॉट उत्पाद में परिमाण की जानकारी शामिल होती है। बड़े परिमाण वाले वेक्टर को एक उच्च डॉट उत्पाद स्कोर मिलता है। यह कुछ रिकवरी सिस्टम में मायने रखता है जहां आप चाहते हैं कि "लोकप्रिय" आइटम उच्च रैंक करें। परिमाण एक अप्रत्यक्ष गुणवत्ता या महत्व संकेत के रूप में कार्य करता है।

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

व्यवहार में:
- जब आप शुद्ध दिशात्मक समानता चाहते हैं तो कॉसिन समानता का उपयोग करें
- जब परिमाणों में सार्थक जानकारी हो तो डॉट उत्पाद का उपयोग करें
- कई वेक्टर डेटाबेस (Pinecone, Weaviate, Qdrant) आप उनमें से चुनने के लिए अनुमति देते हैं
- यदि आपके एम्बेडेड L2 सामान्य हैं, तो विकल्प कोई फर्क नहीं पड़ता

### महलनोबी दूरी

यूक्लिडियन दूरी सभी आयामों को समान रूप से व्यवहार करती है, लेकिन यदि आपकी विशेषताएं परस्पर जुड़ी हुई हैं या अलग-अलग पैमाने हैं, तो L2 भ्रामक परिणाम देता है।

महालनोबी दूरी डेटा की सह-विवर्तन संरचना को समझती है।

```math
d_M(x, y) = \sqrt{(x - y)^T S^{-1} (x - y)}
```

कहाँ$S$डेटा का सह-विवर्तन मैट्रिक्स है।

सहजतः महलनॉबी दूरी पहले डेटा को विकोरेट और सामान्यीकृत करती है (सफेद) , फिर उस परिवर्तित स्थान में L2 दूरी की गणना करती है।$S$पहचान मैट्रिक्स (असंबन्धित, इकाई भिन्नता विशेषताएं) है, महलनोबी दूरी यूक्लिडियन दूरी तक कम हो जाती है।

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

महलनोबी दूरी का उपयोग कब करेंः
- अप्रासंगिक पता लगाना (महालनोबीस की औसत से बड़ी दूरी वाले बिंदु अप्रासंगिक हैं)
- वर्गीकरण जब विशेषताओं के अलग-अलग पैमाने और सहसंबंध हों
- जब आपके पास एक विश्वसनीय कोवरिएंस मैट्रिक्स का अनुमान लगाने के लिए पर्याप्त डेटा है
- विनिर्माण में गुणवत्ता नियंत्रण (बहुवचन प्रक्रिया निगरानी)

### जैकार्ड समानता (सेट के लिए)

जैकार्ड समानता उपाय दो सेटों के बीच ओवरलैप करते हैं।

```math
J(A, B) = \frac{|A \cap B|}{|A \cup B|}
```

यह 0 (कोई ओवरलैप नहीं) से 1 (समान सेट) तक होता है। जैकार्ड दूरी = 1 - जैकार्ड समानता।

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

Jaccard का उपयोग कब करेंः
- टैग, श्रेणियों या विशेषताओं के सेट की तुलना
- शब्द उपस्थिति (आवृत्ति नहीं) के आधार पर दस्तावेज़ समानता
- लगभग दोहराव का पता लगाना (जाकार्ड के मिनहाश अनुमान)
- बाइनरी फीचर वेक्टरों की तुलना (उपस्थिति/अभाव डेटा)
- खंडन मॉडल का मूल्यांकन (संघ के पार का चौराहा = जैकार्ड)

### दूरी संपादित करें (लेवेंसस्टाइन दूरी)

संपादन दूरी एक स्ट्रिंग को दूसरे स्ट्रिंग में बदलने के लिए आवश्यक एकल-वर्ण संचालन की न्यूनतम संख्या को गिनती करती है। संचालन हैंः सम्मिलित करें, हटाएं, या प्रतिस्थापित करें।

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

गतिशील प्रोग्रामिंग का उपयोग करके गणना की गई। प्रविष्टि जहां एक मैट्रिक्स भरें $(i, j)$पहली के बीच की दूरी है $i$स्ट्रिंग ए और पहले के वर्ण $j$स्ट्रिंग बी के वर्ण।

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

संपादन दूरी का उपयोग कब करेंः
- वर्तनी जांच और सुधार
- डीएनए अनुक्रम संरेखण (वजनित संचालन के साथ)
- धुंधली स्ट्रिंग मिलान
- भ्रमित पाठ डेटा का डिडप्लिकेशन

### KL विभेदन (दूरी नहीं, बल्कि एक के रूप में प्रयोग किया जाता है)

KL विचलन मापता है कि एक संभावना वितरण दूसरे से कैसे भिन्न होता है। यह पाठ 09 में कवर किया गया है, लेकिन यह इस चर्चा में शामिल है क्योंकि लोग इसे एक "दूरी" के रूप में उपयोग करते हैं, भले ही यह एक नहीं हो।

```math
D_{KL}(P \,\|\, Q) = \sum_x p(x) \log\frac{p(x)}{q(x)}
```

महत्वपूर्ण गुणः KL विचलन सममित नहीं है।

```math
D_{KL}(P \,\|\, Q) \ne D_{KL}(Q \,\|\, P)
```

इसका मतलब यह है कि यह दूरी मीट्रिक की बुनियादी आवश्यकता को पूरा नहीं करता है। यह त्रिकोण असमानता को भी पूरा नहीं करता है। यह एक विचलन है, दूरी नहीं है।

आगे KL $(D_{KL}(P \Vert Q))$"सारा खोज" है: $Q$$P$. .
उल्टा KL $(D_{KL}(Q \Vert P))$"मोड-खोजने वाला": $Q$एक ही मोड पर ध्यान केंद्रित करता है $P$. .

जब आप KL विचलन देखते हैंः
- VAEs (ELBO में KL शब्द लटेंट वितरण को पूर्व की ओर धकेलता है)
- ज्ञान का डिस्टिलिशन (छात्र शिक्षक के वितरण को मेल खाने की कोशिश करता है)
- RLHF (केएल दंड ठीक किए गए मॉडल को बेस मॉडल के करीब रखता है)
- नीति ग्रेडिएंट पद्धति (सीमागत अद्यतन)

### वास्स्टीन दूरी (पृथ्वी के गतिशील दूरी)

वास्स्टीन की दूरी एक संभावना वितरण को दूसरे में बदलने के लिए आवश्यक न्यूनतम "काम" को मापती है। इसे इस तरह सोचेंः यदि एक वितरण गंदगी का ढेर है और दूसरा एक छेद है, तो आपको कितनी गंदगी को स्थानांतरित करना होगा और कितनी दूर?

```math
W(P, Q) = \inf_{\gamma} \mathbb{E}[d(x, y)] \quad \text{(over all transport plans } \gamma\text{)}
```

1D वितरण के लिए, यह संचयी वितरण कार्यों के पूर्ण अंतर के समावेशी को सरल करता हैः

```math
W_1(P, Q) = \int |\text{CDF}_P(x) - \text{CDF}_Q(x)| \, dx
```

वास्स्टीन क्यों मायने रखता हैः
- यह एक सच्ची मीट्रिक है (सिमेट्रिक, त्रिभुज असमानता को संतुष्ट करता है)
- यह तब भी ग्रेडिएंट प्रदान करता है जब वितरण ओवरलैप नहीं करते हैं (केएल विचलन अनंत तक जाता है)
- इस गुण ने इसे वास्स्टीन जीएएन (Wasserstein GANs) का केंद्र बना दिया, जिसने मूल जीएएन की प्रशिक्षण अस्थिरता को हल किया

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

Wasserstein का उपयोग कब करेंः
- GAN प्रशिक्षण (WGAN, WGAN-GP)
- तुलनात्मक वितरण जो ओवरलैप नहीं कर सकते
- परिवहन की इष्टतम समस्याएं
- छवि पुनर्प्राप्ती (रंग हिस्टोग्राम की तुलना)

### क्यों अलग-अलग कामों के लिए अलग-अलग दूरी की आवश्यकता होती है

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using $Q$ instead of $P$ |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### हानि कार्यों से संबंध

हानि फ़ंक्शन भविष्यवाणियों बनाम लक्ष्यों पर लागू दूरी फ़ंक्शन हैं।

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### नियमन से संबंध

नियमन वजन पर हानि कार्य के लिए एक मानक दंड जोड़ता है।

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

L1 में कमतरता क्यों होती है लेकिन L2 में नहीं होतीः 2D वजन स्थान में प्रतिबंध क्षेत्र की कल्पना करें। L1 एक हीरा है, L2 एक वृत्त है। हानि फ़ंक्शन के कंटूर (एललिप्स) को सबसे अधिक संभावना है कि एक कोण पर हीरा को छूना है, जहां एक वजन शून्य है। वे एक चिकनी बिंदु पर वृत्त को छूते हैं, जहां दोनों वजन शून्य नहीं हैं।

### निकटतम पड़ोसी की खोज

प्रत्येक दूरी फ़ंक्शन में निकटतम पड़ोसी खोज समस्या शामिल होती हैः एक क्वेरी बिंदु दिए जाने पर, डेटासेट में निकटतम बिंदुओं को ढूंढें।

निकटतम पड़ोसी खोज है$O(n \cdot d)$ के डेटासेट में प्रति क्वेरी$n$$d$बड़े डेटा सेट के लिए, यह बहुत धीमा है.

निकटतम पड़ोसी (ANN) एल्गोरिदम विशाल गति लाभ के लिए सटीकता की एक छोटी राशि का व्यापार करते हैंः

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

एचएनएसडब्ल्यू (हियरार्मिक नेविगेबल स्मॉल वर्ल्ड) आधुनिक वेक्टर डेटाबेस में प्रमुख एल्गोरिथ्म है। यह एक बहु-स्तरीय ग्राफ बनाता है जहां प्रत्येक नोड अपने अनुमानित निकटतम पड़ोसियों से जुड़ता है। खोज शीर्ष परत (अवकाश, लंबी छलांग) से शुरू होती है और निचले परत (घनत्व, छोटी छलांग) तक गिरती है।

```figure
norm-unit-balls
```

## इसे बनाओ

### चरण 1: सभी मानदंड और दूरी कार्य

देखो`code/distances.py`प्रत्येक फ़ंक्शन को केवल बुनियादी पायथन गणित का उपयोग करके खरोंच से बनाया गया है।`code/distances.ts`एक प्रकार के स्क्रिप्ट पोर्ट के साथ एक ही कार्यों और डेमो है।

### चरण 2: समान डेटा, अलग दूरी, अलग-अलग पड़ोसी

डेमो में `distances.py`एक डेटासेट बनाता है, एक क्वेरी बिंदु चुनता है, और यह दिखाता है कि दूरी मीट्रिक के आधार पर निकटतम पड़ोसी कैसे बदलता है। L1 के तहत "सबसे करीब" बिंदु L2 या कोसिन के तहत निकटतम नहीं हो सकता है।

### चरण 3: समानता खोज को सम्मिलित करना

कोड में एक नकली समाहित समानता खोज शामिल है जो कॉसिन समानता बनाम L2 दूरी का उपयोग करके क्वेरी के लिए सबसे समान "दस्तावेज़" पाता है, जिससे पता चलता है कि रैंकिंग भिन्न हो सकती है।

## इसका प्रयोग करें

सबसे आम व्यावहारिक उपयोगः वेक्टर डेटाबेस में समान वस्तुओं का पता लगाना।

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

जब आप कॉल करते हैं`model.encode(text)`वेक्टर डेटाबेस आपके क्वेरी वेक्टर और प्रत्येक संग्रहीत वेक्टर के बीच कॉसिन समानता (या डॉट उत्पाद) की गणना करता है, सभी की जांच से बचने के लिए एएनएन एल्गोरिदम का उपयोग करके।

## व्यायाम

1. (1, 2, 3) और (4, 0, 6) के बीच L1, L2 और L-अनंत दूरी की गणना करें।$L_\infty \le L_2 \le L_1$यह सुनिश्चित करें कि यह आदेश क्यों गारंटी है।

2. दो वेक्टर बनाएं जहां कॉसिन की समानता अधिक है (> 0.9) लेकिन L2 दूरी बड़ी है (> 10) । ज्यामितीय रूप से समझाएं कि क्या हो रहा है। फिर दो वेक्टर बनाएं जहां कॉसिन की समानता कम है (< 0.3) लेकिन L2 दूरी छोटी है (< 0.5).

3. एक फ़ंक्शन को लागू करें जो डेटासेट और क्वेरी बिंदु लेता है और L1, L2, कोसिन और महलनोबी दूरी के तहत निकटतम पड़ोसी को लौटाता है। एक डेटासेट खोजें जहां सभी चार सहमत नहीं हैं कि कौन सा बिंदु निकटतम है।

4. सीडीएफ विधि का उपयोग करके [0.5, 0.5, 0,0] और [0, 0, 0.5, 0.5] के बीच वास्स्टीन दूरी की गणना करें। फिर इसे [0.25, 0.25, 0.25, 0.25] और [0, 0, 0.5, 0.5] के बीच गणना करें। कौन बड़ा है और क्यों?

5. लगभग जैकार्ड समानता के लिए MinHash को लागू करें। 100 यादृच्छिक सेट उत्पन्न करें, सभी जोड़े के लिए सटीक जैकार्ड की गणना करें, और 50, 100, और 200 हैश फ़ंक्शंस का उपयोग करके MinHash अनुमान के साथ तुलना करें। अनुमान त्रुटि का ग्राफ करें।

### संकेत

**Exercise 1.**अंतर वेक्टर है (-3, 2, -3), तो उस वेक्टर के तीन मानदंडों की गणना के साथ `l1_norm`,`l2_norm`और `linf_norm`. सबूत के लिए, सबसे बड़ी तुलना करें $\lvert d_i \rvert$वर्गों के योग के साथ, और वर्गों के योग को पूर्ण मानों के योग के वर्ग के साथ तुलना करें।

**Exercise 2.**कॉसिन समानता लंबाई को अनदेखा करती है, इसलिए दो वेक्टरों से शुरू करें जो लगभग एक ही दिशा में इंगित करते हैं और उनमें से एक को बहुत लंबा बनाते हैं। दूसरे मामले के लिए, मूल के पास दो छोटे वेक्टरों का उपयोग करें जो विभिन्न दिशाओं में इंगित करते हैं, फिर दोनों स्थितियों की जांच करें`cosine_similarity`और `l2_distance`. .

**Exercise 3.**कॉल`find_nearest_neighbor(query, dataset, distance_fn)`एक बार प्रत्येक के लिए `l1_distance`,`l2_distance`,`cosine_distance`और `mahalanobis_distance`. .`demo_different_neighbors`एक डेटासेट दिखाता है जहां माप असहमत हैं, तो इसे पहले पढ़ें और फिर चार उत्तरों में अंतर होने तक बिंदुओं को बदलें।

**Exercise 4.**प्रत्येक वितरण का संचयी योग लिखें, फिर दो संचयी योगों के पूर्ण अंतर जोड़ें। दोनों हाथों के परिणामों की जांच करें `wasserstein_1d(p, q)`, फिर बड़ी मान को बताएं कि संभावना द्रव्यमान कितनी दूर तक आगे बढ़ना चाहिए।

**Exercise 5.**प्रत्येक हैश फ़ंक्शन के लिए, एक सेट का MinHash हस्ताक्षर उसके तत्वों पर न्यूनतम हैश मूल्य है, और हैश फ़ंक्शन का अंश जहां दो सेट समान न्यूनतम अनुमान प्राप्त करते हैं, उनकी जैकार्ड समानता। प्रत्येक अनुमान की तुलना करें `jaccard_similarity`; त्रुटि लगभग $1/\sqrt{k}$के लिए$k$हैश फ़ंक्शंस।

## प्रमुख शर्तें

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The $p$-th root of the sum of $p$-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as $p$ approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using $Q$ to encode $P$ |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## आगे पढ़ना

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)- अरबों पैमाने पर एएनएन खोज के लिए मेटा की पुस्तकालय
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)- कागज जो पृथ्वी मूवर की दूरी को GANs के लिए पेश किया
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)- मौलिक एएनएन एल्गोरिथ्म
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)- Word2Vec, जहां कोसिन समानता एम्बेडेड के लिए डिफ़ॉल्ट बन गया
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)- स्किकट-लर्न में दूरी मेट्रिक्स और पड़ोसी एल्गोरिदम के लिए व्यावहारिक गाइड
