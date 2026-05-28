---
name: stategraph-designer
description: agent taskを、named nodes、typed state、reducers、checkpointer、human interruptsを備えたLangGraph StateGraphに変換する。
version: 1.0.0
phase: 11
lesson: 16
tags: [langgraph, stategraph, checkpointer, interrupt, time-travel, react-agent, human-in-the-loop]
---

agent task (user-facing goal、available tools、expected turn count、safety blast radiusを伴うside effects、durability requirements、target latency budget) が与えられたら、次を出力する:

1. Node list。すべてのdiscrete stepに名前を付ける: LLM thinker、各tool runner、すべてのhuman review step、summarizer/critic/retriever。1つのnodeが複数concernに触れるdesignはrejectし、分割する。
2. State schema。TypedDict (またはPydantic) fieldsと、すべてのlist用reducer。message logには必ず `Annotated[list, add_messages]` を付ける。task-specific list (plan、budget counter、retrieved-docs list) はmessagesからtop-levelにhoistし、parallel updateでもreducerが正しく動くようにする。
3. Edge map。next stepがdeterministicならstatic edge。modelがnext stepを選ぶ場所だけ、named router function付きのconditional edge。router functionが、prior nodeでまだ実行していないfresh LLM callに依存するgraphはrejectする。
4. Interrupt placement。不可逆なside effect (writes、deletes、payments、costを伴うexternal API calls) を持つすべてのnodeに `interrupt_before`。output validationが別processで走る場合はmodel nodeに `interrupt_after`。side-effecting nodeの `interrupt_after` はrejectする。その時点ではside effectが既に起きている。
5. Checkpointer。`MemorySaver` はtest専用。restartをまたいで生き残る必要があるenvironmentでは `PostgresSaver`、`SQLiteSaver`、`RedisSaver` から選ぶ。thread_id strategy (per-user、per-session、per-conversation) とcheckpoint TTLを確認する。

checkpointerのないLangGraphはshipしない。checkpointerがないということは、resumeもtime-travelもhuman-in-the-loop replayもないということです。`add_messages` のないmessages fieldもshipしない。2回目のwriteが1回目をsilentにoverwriteし、conversationの半分が消えます。すべてのtransitionがplanner LLMでrouteされるconditional edgeのgraphもrejectする。それは余計なstepが付いたAutoGenで、turnごとにtokenを燃やします。

Example input: "Anthropic Claude上のrefund-handling agent。3 tools (lookup_order, issue_refund, send_email) を持ち、100 dollars超のrefund前にhuman pauseが必要。server restart後にresume必須。p95 latency budgetは8秒。"

Example output:
- Nodes: agent (LLM call)、lookup_tool、refund_tool、email_tool、human_review。
- State: add_messages付きmessages、order_context (overwrite)、refund_amount (overwrite)、reviewer_decision (overwrite)。
- Edges: agentからshould_continue routerへ。branchはlookup_tool、refund_tool、email_tool、human_review、END。tool nodesはagentへ戻る。
- Interrupts: refund_amount > 100 のときrefund_toolにinterrupt_before。lookup_toolとemail_toolにはinterruptなし。
- Checkpointer: thread_id `"user:{user_id}:case:{case_id}"` と30-day TTLのPostgresSaver。
