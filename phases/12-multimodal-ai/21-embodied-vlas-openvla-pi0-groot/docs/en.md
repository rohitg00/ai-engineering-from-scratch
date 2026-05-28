# Embodied VLAs: RT-2、OpenVLA、π0、GR00T

> modelがwebsite上のrecipeを読み、kitchen robotで実行した最初の例がRT-2（Google DeepMind, 2023年7月）でした。RT-2はactionsをtext tokensとしてdiscretizeし、web dataとrobot-action dataでVLMをco-fine-tuneし、web-scale vision-language knowledgeがrobotic controlへtransferすることを示しました。OpenVLA（2024年6月）はopen 7B referenceを提供しました。Physical Intelligenceのπ0 series（2024-2025）はflow-matching action expertsを追加しました。NVIDIAのGR00T N1（2025年3月）は、humanoid robots向けにdual-system（System 1 / System 2）controlをscaleさせました。VLA primitive、つまりvision-language-actionを扱い、見て、読み、行動するsingle modelは、このphaseのunderstanding modelsとPhase 15のautonomous systemsをつなぐbridgeです。

**種別:** 学習
**言語:** Python (stdlib、action tokenizer + VLA inference skeleton)
**前提条件:** Phase 12 · 05 (LLaVA)、Phase 15 (Autonomous Systems、参照)
**所要時間:** 約180分

## 学習目標

- action tokenizationを説明する。discrete bin encoding（RT-2）、FAST efficient action tokens、continuous flow-matching actions（π0）。
- web + robot dataのco-fine-tuningが、novel tasksへのgeneral-knowledge transferを保つ理由を説明する。
- 同じrobot taskで、OpenVLA（open 7B Llama+VLM）、π0（flow-matching）、GR00T N1（dual-system）を比較する。
- Open X-Embodiment datasetと、RT-X training corpusとしての役割を説明する。

## 問題

natural language instructionから家事をこなすrobotは、1970年代から研究targetでした。2020年代の答えがvision-language-action（VLA）modelです。VQAで使うVLM architectureと同じですが、outputはtextではなくactions（joint torques、end-effector poses、discrete commands）です。

VLA固有のchallenge:

1. Action spacesはcontinuous（joint angles、forces）でhigh-dimensional（7-DOF arm + 3-DOF gripper = 10 dims at 30 Hz）。
2. Robot-specific training dataは少ない。Open X-Embodimentは約1M trajectories、web text-imageは5B+。
3. Control frequencyが重要。30 Hz control loopはactionあたり33ms budgetを意味する。
4. Safety。誤ったactionはhardware、人間、propertyを傷つける。

## コンセプト

### Action tokenization (RT-2)

RT-2のtrickは、各joint targetをquantized text tokenとして表すことです。normalized [-1, 1] rangeを256 binsへdiscretizeし、各binをvocabulary IDへmapします。10-DOF actionは、各control stepで10 tokensになります。

PaLM-X VLMを次のmixtureでco-fine-tuneします。

- Web image-text pairs（captioning、VQA）。
- Robot demonstrations。actionはtokensとして表す。

modelは「pick up the red cube」（language）→ image（vision）→ 10-token action sequence（discretized joint targets）を見る。web pretrainingによりgeneral-knowledge transferが保たれるため、RT-2はtraining dataに"fast-moving"がなくても「fast-moving objectの方へ動け」に従えます。

RT-2 paperではinferenceは3-5 Hzで、VLMのautoregressive decodeが制約でした。

### OpenVLA — open 7B reference

OpenVLA（Kim et al., 2024年6月）はopen-weightsのRT-2相当です。7B Llama backbone、DINOv2 + SigLIP dual vision encoder、256 binsのaction tokenizationを使います。

Open X-Embodiment（22 robotsにまたがる970k trajectories）でtrainingされています。新しいrobotへadaptするためのLoRA fine-tuning supportもあります。

InferenceはA100 + quantizationで4-5 Hzです。slow manipulationには十分ですが、high-frequency controlには足りません。

### FAST tokenizer — faster action decode

Pertsch et al.（2024）は、discrete-bin tokenizationが非効率だと示しました。多くのactionsはbin-spaceの狭い領域に集まります。FAST（Frequency-domain Action Sequence Tokenizer）は、DCTでaction sequencesをcompressし、そのcoefficientsをquantizeします。

30-step action trajectoryは、300 discrete-bin tokensではなく約10 FAST tokensになります。quality lossなしにinferenceが3-5x速くなります。

### π0とflow-matching actions

Physical Intelligenceのπ0（Black et al., 2024年10月）は、discrete action tokensをflow-matching action expertに置き換えます。

- small action transformerがVLM hidden statesを読み、rectified flowでcontinuous 50-step action sequenceを出力する。
- action headはflow-matching lossでtrainingし、VLM pretrainingは変えない。
- inference: 約5 denoising stepsでfull action sequenceをemitし、実質50 Hz controlになる。

π0のclaimは、広いmanipulation task suiteでOpenVLAとOctoを上回るというものです。continuous-action formulationは、discretizationが壊すsmoothnessを保ちます。

π0.5とπ0-FASTはincremental upgradesです。π0-FASTはFAST tokenizationとflow matchingを組み合わせます。

### GR00T N1 — humanoid向けdual-system

NVIDIAのGR00T N1（2025年3月）は、humanoid robots（>30 DOF、full-body）向けに作られています。

- System 2: scene + instructionを読み、約1 Hzでhigh-level subgoalsを生成するlarge VLM。
- System 1: subgoalsにconditionされたlow-level 50-100 Hz joint commandsを生成するsmall action-head transformer。

この分割はKahnemanのfast-and-slow thinkingに対応します。System 2がplanし、System 1がactします。利点は、遅いVLM-sized planningがfast controlをblockせず、System 1をlatencyのために小さく保てることです。

GR00T N1.7（2025年後半）はdata scalingを改善しました。GR00TはOmniverse由来のsim-to-real dataでfine-tuneされます。

### Open X-Embodiment

training dataです。RT-X（2023年10月）は22 datasetsを集め、22 robotsにまたがる1M trajectoriesを構成しました。Open X-Embodimentは誰もが使うcorpusです。

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table。
- 各sample: (robot state, camera views, instruction, action sequence)。
- Training hygiene: action spaceをunifyし、joint rangesをnormalizeし、camerasをresizeする。

OpenVLAとπ0はOpen X-Embodimentでtrainingします。特定robotへのdomain gapは、100-1000 task-specific demosでLoRA fine-tuningして閉じます。

### Co-fine-tuning vs robot-only

Co-fine-tuningはweb VQA dataとrobot trajectoriesを混ぜます。ratioが重要です。VQAが多すぎるとmodelはactionsを忘れ、robot dataが多すぎるとgeneral knowledgeを失います。

RT-2のratioは約1:1です。OpenVLAはweb-to-robotで約0.5:1です。π0も近いです。正確なratioはdataset sizeごとにtuneするhyperparameterです。

Robot-only trainingは、out-of-distribution instructionで失敗するtask-specific modelsを作ります。co-fine-tuningは、「pick up the red cube（demo内）」と「左から3番目に大きいobjectを持ち上げて（novel phrasing）」の差を埋めます。

### Safety and action limits

production VLAには必ず次があります。

- Hard joint limits（specを超えてtorqueしない）。
- Velocity limits（soft clipping）。
- Workspace bounds（end-effectorがtableから出ない）。
- novel tasks向けhuman-in-the-loop approval。

これらはVLAの外側にあるcontrol-layer checksです。VLA outputはsuggestionであり、commandではありません。

## 使ってみる

`code/main.py`:

- 256-bin action tokenizationとde-tokenizationを実装する。
- DCT + quantizationに基づくFAST tokenizerをsketchする。
- discrete-bin、FAST、continuous-flowの間で、action stepあたりtoken-countを比較する。
- RT-2 → OpenVLA → π0 → GR00Tのlineage summaryを出力する。

## 成果物

このレッスンは`outputs/skill-vla-action-format-picker.md`を作ります。robot task（manipulation、navigation、humanoid whole-body）を受け取り、discrete-bin + RT-2、FAST + OpenVLA、flow-matching + π0、dual-system + GR00Tのどれを選ぶか決めます。

## 演習

1. 10-DOF armを30 Hz control rateで動かします。256 binsのdiscrete-bin tokenizationは1秒あたり何tokensをemitしますか。7B VLMは追いつけますか。

2. FAST tokenizationは30-step trajectoriesを約10 tokensへcompressします。trajectoryにhigh-frequency motion（例: drumming）がある場合、userは何を失いますか。

3. π0のflow-matching headは約5 stepsでdenoiseします。OpenVLAの4-5 Hz autoregressive decodeとthroughputを比較してください。

4. GR00TのSystem 1 / System 2 splitはKahnemanに対応しています。bipedal walkingに役立つかもしれない別のsplit（System 3?）を提案してください。

5. dataset curationに関するOpen X-Embodiment Section 4を読んでください。domain leakageを防ぐ3つのcuration rulesを挙げてください。

## 重要用語

| Term | よく言われる表現 | 実際の意味 |
|------|-----------------|------------|
| VLA | "Vision-language-action" | image + instructionを受け取りaction commandsを出すmodel |
| Action tokenization | "Discrete bins" | continuous joint targetsをdimごとに256 binsへquantizeし、それぞれをvocab IDにする |
| FAST tokenizer | "Frequency action tokens" | DCT + quantizeで30-step trajectoriesを約10 tokensへcompressする |
| Co-fine-tune | "Mix web + robot" | general knowledgeを保つため、web VQA dataとrobot demosを一緒にtrainingする |
| Flow-matching action head | "π0 continuous output" | rectified flowで50-step action sequenceを出すsmall transformer |
| System 1 / System 2 | "Dual-system control" | large VLMがゆっくりplanし、small action headが速くactするGR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset。training corpus |

## 参考文献

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
