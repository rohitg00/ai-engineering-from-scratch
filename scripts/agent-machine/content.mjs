export const CONCEPT = {
  carriage: "CONTEXT",
  intake: "REQUEST",
  memory: "MEMORY",
  retrieval: "RETRIEVAL",
  model: "MODEL",
  tools: "TOOLS",
  verifier: "VERIFIER",
  exit: "OUTPUT",
  printer: "TRACE",
  controller: "RUNTIME · LOOP",
};

const lesson = (path, title) => ({ href: `/lesson?path=${encodeURIComponent(path)}`, title });

export const INFO = {
  carriage: {
    name: "Card carriage",
    is: "The context window. The cards on it are everything the model can see.",
    does: "The carriage carries the request, the saved memory, the retrieved documents and every tool result around the loop. The rack has eight slots, so the context has a fixed size.",
    why: "A model sees only its input. If a fact is not on a card on this carriage, the model cannot use it.",
    without: "With no context assembly, each model call starts empty. The model answers from training data alone.",
    code: "messages = [system, memory, *retrieved_docs, user_request, *tool_results]. Count tokens before each call and drop or summarize the oldest observations first.",
    lesson: lesson("phases/11-llm-engineering/05-context-engineering", "Context Engineering"),
  },
  intake: {
    name: "Intake hopper",
    is: "The request entering the system.",
    does: "The hopper feeds the user's request onto the carriage as the first card. Every later step works for this card.",
    why: "The runtime, not the model, receives the request and decides what to put next to it.",
    without: "Nothing starts. A model with no request card has no task.",
    code: "request = {id, text, user, received_at}. Validate size and type at the edge, before any model call.",
    lesson: lesson("phases/14-agent-engineering/01-the-agent-loop", "The Agent Loop"),
  },
  memory: {
    name: "Memory drum",
    is: "Persistent memory that survives between runs.",
    does: "The drum keeps notes from earlier sessions. Here it holds one preference: report money in USD and give the percent change. The copier puts a copy on the carriage.",
    why: "Memory is different from retrieved documents. It is what the agent learned about this user or task, written by the runtime after earlier runs.",
    without: "The answer still works, but every run starts as a stranger. The user repeats the same preferences each time.",
    code: "memory.read(user_id, scope) before the first turn, memory.write(...) after a verified run. Keep it small and reviewable.",
    lesson: lesson("phases/14-agent-engineering/07-memory-virtual-context-memgpt", "Agent Memory: Virtual Context and Memory Paging"),
  },
  retrieval: {
    name: "Filing cabinet and pick head",
    is: "Retrieval. Private documents the model never saw in training.",
    does: "The runtime turns the request into a query, opens the drawer that matches, and the pick head moves the April and May invoices onto the carriage. The March invoice and the travel policy stay in the drawer.",
    why: "Your invoices are not in the model's weights. The only way the model sees them is a card placed in its context.",
    without: "The model has no numbers. It can only guess, or say that it cannot answer. Turn retrieval off and watch which one reaches the exit.",
    code: "docs = index.search(query, k=2); context += [doc.text with doc.id]. Keep the id so the answer can cite it and the verifier can check it.",
    lesson: lesson("phases/11-llm-engineering/06-rag", "RAG: Retrieval-Augmented Generation"),
  },
  model: {
    name: "Sealed model housing",
    is: "The model. Its knowledge is the sealed drum inside, fixed at training time.",
    does: "The reading head comes down on the cards, reads them, and prints one slip: either a tool call or a draft answer. It does not open drawers or turn cranks. It only proposes.",
    why: "The model is the part that understands language and picks the next move. Everything else on this bench exists because a proposal is not an action and not a checked fact.",
    without: "No proposals. In this simulation the model is a fixed script that reads the cards. No real model runs in your browser.",
    code: "proposal = llm(messages, tools=schemas). The reply is text or a structured tool call. Parse it. Never execute it directly.",
    lesson: lesson("phases/10-llms-from-scratch/13-building-complete-llm-pipeline", "Building a Complete LLM Pipeline"),
  },
  tools: {
    name: "Tool bay",
    is: "Tool execution, with a schema gauge, a permission bolt, a calculator, a timer and three retry flags.",
    does: "The pick head takes the tool call slip through the schema gauge, past the permission bolt, and into the calculator. The calculator computes 15,500 − 12,400 = 3,100 and 3,100 / 12,400 = 25.0%. The result card goes back to the carriage.",
    why: "A tool call is untrusted input written by a model. The schema check rejects malformed arguments. The permission check refuses tools this run must not use. The timer and the retry flags keep a slow tool from hanging the run.",
    without: "With tool access off, the model does the arithmetic itself. In this script it divides by the May total and gets 20.0%, a common percent-change mistake.",
    code: "validate(args, schema) → check policy(tool, user) → call with timeout → retry with backoff, at most 3 attempts → return result or error as an observation.",
    lesson: lesson("phases/14-agent-engineering/06-tool-use-and-function-calling", "Tool Use and Function Calling"),
  },
  verifier: {
    name: "Verifier gauge",
    is: "An external check of the answer, outside the model.",
    does: "The plunger comes down on the answer slip. The verifier recomputes the numbers from the cited invoices. The needle stays at zero on a match and swings on a mismatch. A pass punches the slip.",
    why: "The model that wrote the answer is a poor judge of it. A deterministic check catches arithmetic and grounding errors every time it runs.",
    without: "An unchecked answer goes straight to the exit. It can be right. Nothing proves it. Turn verification off with a failing tool to see a wrong answer leave.",
    code: "assert diff == may - april; assert abs(pct - diff / april * 100) < 0.05; assert set(cites) <= retrieved_ids. On failure, return the reason to the model as feedback.",
    lesson: lesson("phases/14-agent-engineering/38-verification-gates", "Verification Gates"),
  },
  controller: {
    name: "Runtime controller",
    is: "The agent runtime. It owns the loop, the limits and the clock.",
    does: "The counter shows each step. The quadrant shows model turns used out of four. The lap counter shows how many times the carriage went round the loop. The dial shows simulated time.",
    why: "Loops must end. The runtime stops the run when it reaches the turn limit, whatever the model proposes next.",
    without: "A confused model can loop forever and spend without limit. Every production agent needs an iteration cap and a budget.",
    code: "for turn in range(MAX_TURNS): proposal = model(context); ... else: return failure('turn limit'). Track tokens, time and cost per run.",
    lesson: lesson("phases/15-autonomous-systems/13-cost-governors", "Action Budgets, Iteration Caps, Cost Governors"),
  },
  exit: {
    name: "Exit latch and output tray",
    is: "The end of the run. A finished, declined or failed request leaves here.",
    does: "The latch tips the answer slip off the carriage and down the chute into the tray. A punched slip passed the verifier. A plain slip did not.",
    why: "A run must end in a clear state: verified, declined, unchecked or failed. The caller needs to know which.",
    without: "The caller gets text with no status. It cannot tell a checked answer from a guess.",
    code: "return {status, answer, citations, trace_id}. Make the status part of the API contract.",
    lesson: lesson("phases/14-agent-engineering/26-failure-modes-agentic", "Failure Modes: Why Agents Break"),
  },
  printer: {
    name: "Trace printer",
    is: "The execution trace. One line per event, kept after the run ends.",
    does: "The printer writes every step on the paper tape: what happened, at which station, and the simulated time it cost. The list under the machine is the same trace.",
    why: "When an agent gives a wrong answer, the trace is how you find the step that went wrong.",
    without: "You see only the final answer. You cannot tell a retrieval miss from a tool timeout from a model error.",
    code: "Emit one span per step with attributes for the tool, arguments, result, tokens and duration. OpenTelemetry has conventions for this.",
    lesson: lesson("phases/14-agent-engineering/24-agent-observability-platforms", "Agent Observability"),
  },
};

export const PART_ORDER = ["intake", "memory", "retrieval", "model", "tools", "verifier", "exit", "printer", "controller", "carriage"];

export const TOUR = [
  {
    title: "One request, one bench",
    text: "The card that enters on the left is the request: compare the April and May cloud invoices. Watch it ride the carriage round the loop. Every station it stops at does one job.",
    config: {},
    part: "carriage",
  },
  {
    title: "The model only proposes",
    text: "The sealed housing is the model. Its reading head sees only the cards on the carriage. It prints a slip that asks for the calculator. It does not run anything itself.",
    part: "model",
  },
  {
    title: "Tools pass two checks first",
    text: "The slip goes through the schema gauge and past the permission bolt before the calculator turns. The result comes back as a new card, and the carriage goes round again.",
    part: "tools",
  },
  {
    title: "Take away the documents",
    text: "Retrieval is now locked out. The model has no invoices, so it guesses. The verifier finds no evidence for the guess and sends it back. The second answer is an honest refusal.",
    config: { retrieval: false },
    part: "retrieval",
  },
  {
    title: "Turn off the check",
    text: "Now the tool times out on every attempt and the verifier is off. The model falls back to its own arithmetic, divides by the wrong month, and 20.0% leaves the machine. Nothing stopped it.",
    config: { verification: false, fault: "timeout-always" },
    part: "verifier",
  },
  {
    title: "Put the check back",
    text: "Same broken tool, verifier on. The verifier recomputes from the invoices, rejects 20.0%, and returns the reason. The model's second draft says 25.0%, and the slip leaves punched.",
    config: { fault: "timeout-always" },
    part: "controller",
  },
];

export const SCENARIOS = [
  { label: "Healthy run", note: "Retrieve, calculate, verify.", config: {} },
  { label: "No retrieval", note: "The model has no invoices.", config: { retrieval: false } },
  { label: "No retrieval, no verifier", note: "A guess leaves unchecked.", config: { retrieval: false, verification: false } },
  { label: "Tool times out once", note: "One retry recovers.", config: { fault: "timeout-once" } },
  { label: "Tool always times out", note: "Fallback, then the verifier catches it.", config: { fault: "timeout-always" } },
  { label: "Timeouts and no verifier", note: "A wrong answer leaves.", config: { fault: "timeout-always", verification: false } },
  { label: "Malformed tool call", note: "The schema gauge rejects it.", config: { fault: "malformed" } },
  { label: "Tool access denied", note: "The permission bolt holds.", config: { tools: false } },
];
