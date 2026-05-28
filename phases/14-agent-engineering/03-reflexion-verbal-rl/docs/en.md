# Reflexion: 言語による強化学習

> gradient-based RLでfailure modeを直すには、何千回ものtrialとGPU clusterが必要になる。Reflexion（Shinnら、NeurIPS 2023）はそれを自然言語で行う。失敗したtrialの後、agentはreflectionを書き、episodic memoryに保存し、次のtrialをそのmemoryに条件づける。これはLettaのsleep-time compute、Claude CodeのCLAUDE.md learnings、pro-workflowのlearn-ruleの背後にあるpatternである。

**タイプ:** 構築
**言語:** Python（stdlib）
**前提条件:** フェーズ 14 · 01（Agent Loop）、フェーズ 14 · 02（ReWOO）
**時間:** 約60分

## 学習目標

- Reflexionの3要素（Actor、Evaluator、Self-Reflector）とepisodic memoryの役割を挙げる。
- binary evaluator、reflection buffer、fresh re-attemptを備えたstdlibのReflexion loopを実装する。
- taskに応じてscalar、heuristic、self-evaluated feedback sourceを選ぶ。
- gradient-based RLなら何千回ものtrialが必要になるerrorを、verbal reinforcementがなぜ捕まえられるのか説明する。

## 課題

agentがtaskに失敗する。標準的なRLなら、さらに何千回もtrialを実行し、gradientsを計算し、weightsを更新する。高価で遅く、多くのproduction agentには失敗ごとにtraining budgetなどない。

Reflexion（Shinnら、arXiv:2303.11366）は別の問いを立てる。agentがなぜ失敗したかを考え、その考えをpromptに入れてもう一度試したらどうなるか。weight updateはない。gradientもない。trial間で保存される自然言語だけである。

結果として、ALFWorldではReActや他のnon-fine-tuned baselineを上回る。HotpotQAではReActより改善する。code generation（HumanEval/MBPP）では当時のstate of the artを達成する。しかも単一のgradient stepなしである。

## 考え方

### 3つの構成要素

```
Actor         : trajectoryを生成する（ReAct-style loop）
Evaluator     : trajectoryを採点する - binary、heuristic、またはself-eval
Self-Reflector: failureに関する自然言語reflectionを書く
```

さらに1つのdata structureがある。

```
Episodic memory: prior reflectionsのlist。次のtrialのprompt前半に付ける
```

1つのtrialではActorが実行される。Evaluatorが採点する。scoreが低ければ、Self-Reflectorがreflectionを書く（「質問がXを聞いていると誤読したが実際はYだったため、間違ったtoolを選んだ」など）。reflectionはepisodic memoryに入る。次のtrialはfreshに始まるが、そのreflectionを見る。

### 3種類のevaluator

1. **Scalar** - 外部のbinary signal。ALFWorldは成功/失敗する。HumanEval testsはpass/failする。最も単純でsignalが強い。
2. **Heuristic** - 事前定義したfailure signatures。「agentが同じactionを2回連続で出したらstuckと判定する」「trajectoryが50 stepsを超えたらinefficientと判定する」。
3. **Self-evaluated** - LLMが自身のtrajectoryを採点する。ground truthがないときに必要。signalは弱いため、tool-grounded verification（レッスン05 - CRITIC）と組み合わせるとよい。

2026年のdefaultは混合である。利用可能ならscalar、なければself-eval、safety railsとしてheuristics。

### なぜ一般化するのか

Reflexionは新しいalgorithmというより、名前の付いたpatternである。ほぼすべてのproduction「self-healing」agentは何らかのvariantを実行している。

- Lettaのsleep-time compute（レッスン08）: separate agentが過去のconversationをreflectし、memory blocksへ書く。
- Claude Codeの`CLAUDE.md` / "save memory" pattern: reflectionsをlearningsとして捕捉し、future sessionsの前に付ける。
- pro-workflowの`/learn-rule` command: correctionsを明示的なrulesとして捕捉する。
- LangGraphのreflection nodes: outputを採点し、必要ならrefineへroutingするnode。

これらはすべて同じ洞察から来ている。自然言語は、run間で「failureから何を学んだか」を運ぶのに十分に豊かな媒体である。

### いつ効き、いつ効かないか

Reflexionが効くのは次の場合である。

- 明確なfailure signalがある（test failure、tool error、wrong answer）。
- task classが再現可能である（同じ種類の質問がまた来る）。
- reflectionがtrajectoryを改善する余地がある（十分なaction budgetがある）。

Reflexionが役に立たないのは次の場合である。

- agentがfirst tryですでに成功している。
- failureが外部要因である（network down、tool broken）。「network was down」とreflectしてもfuture runsの役に立たない。
- reflectionが迷信になる。one-off flaky runについてのnarrativeを保存してしまう。

2026年の落とし穴はmemory rotである。reflectionsは蓄積する。一部は古くなり、または間違う。episodic bufferが大きくなるほどre-runは遅くなる。mitigationは、periodic compaction（レッスン06）、reflectionのTTL、または別のsleep-time cleanup agent（Letta）である。

## 構築

`code/main.py`はtoy puzzleでReflexionを実装する。targetに合計が一致する3-element listを生成するtaskである。Actorはcandidate listを出す。Evaluatorはsumをcheckする。Self-Reflectorは何が悪かったかを1行で書く。reflectionは次のtrial用のepisodic memoryに入る。

構成要素:

- `Actor` - reflectionを見ると改善するscripted policy。
- `Evaluator.binary()` - target sumに対するpass/fail。
- `SelfReflector` - failureの1行diagnosisを生成する。
- `EpisodicMemory` - TTL semanticsを持つbounded list。

実行する。

```
python3 code/main.py
```

traceは3 trialsを示す。trial 1は失敗し、reflectionが保存される。trial 2はreflectionを見て改善するがまだ失敗する。trial 3で成功する。baseline run（reflectionなし）と比較すると、baselineはtrial 1のanswerにstuckしたままである。

## 使い方

LangGraphはreflectionをnode patternとして提供している。Claude Codeの`/memory` commandとpro-workflowの`/learn-rule`は、episodic bufferをmarkdown fileとして外部化する。Lettaのsleep-time computeはSelf-Reflectorをdowntimeに実行し、primary agentをlatency-boundのままにする。OpenAI Agents SDKはReflexionを直接は提供しないが、scoreでtrajectoryをrejectするcustom Guardrailと、runsをまたいで残るmemory `Session`で構築できる。

## 出荷

`outputs/skill-reflexion-buffer.md`は、reflection capture、TTL、deduplicationを持つepisodic bufferを作成・維持する。task classとfailureが与えられたら、次のtrialに実際に役立つreflectionを出す（genericな「もっと注意する」ではない）。

## 演習

1. binary evaluatorから、distance metric（targetからどれだけ遠いか）を返すscalar evaluatorへ切り替える。より速く収束するか。
2. reflectionsに10 trialsのTTLを追加する。その時点以降、古いreflectionsは害になるか、それとも助けになるか。
3. heuristic evaluatorを実装する。同じactionが繰り返されたらtrialをstuckと判定する。これはSelf-Reflectorとどう相互作用するか。
4. reflectionsを無視するadversarial ActorでReflexionを実行する。Actorにそれらを気づかせるための最小限のreflection prompt engineeringは何か。
5. Reflexion論文のAlfWorldに関するSection 4を読む。130%のsuccess-rate improvementを概念的に再現する。vanilla ReActとの差分の核心は何か。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------|
| Reflexion | 「Self-correction」 | Shinnら 2023。Actor、Evaluator、Self-Reflectorにepisodic memoryを加える |
| Verbal reinforcement | 「gradientsなしのlearning」 | 次のtrialのprompt前半に付ける自然言語reflection |
| Episodic memory | 「taskごとのreflections」 | 1つのtask classに対するprior reflectionsのbounded buffer |
| Scalar evaluator | 「Binary success signal」 | ground truthから得るpass/failまたはnumeric score |
| Heuristic evaluator | 「Pattern-based detector」 | 事前定義したfailure signatures（例: stuck-loop、too-many-steps） |
| Self-evaluator | 「自分のtraceをLLM-as-judgeで採点」 | ground truthがないときの低signalなfallback。tool-grounded verificationと組み合わせる |
| Memory rot | 「Stale reflections」 | episodic bufferがobsolete entriesで埋まる。compaction/TTLで直す |
| Sleep-time reflection | 「Async self-reflection」 | primary agentを速く保つため、hot pathの外でSelf-Reflectorを実行する |

## 参考資料

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) - 標準論文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) - productionにおけるasync reflection
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - contextの一部としてepisodic bufferを管理する
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) - reflection node pattern
