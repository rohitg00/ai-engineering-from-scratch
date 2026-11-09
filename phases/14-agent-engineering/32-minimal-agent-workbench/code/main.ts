// Lesson: The Minimal Agent Workbench (phase 14 / lesson 32)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/32-minimal-agent-workbench/docs/en.md
// Run: npx tsx phases/14-agent-engineering/32-minimal-agent-workbench/code/main.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "workdir");

const AGENTS_MD = `# AGENTS.md

This repo runs with a workbench. Read these before acting:

1. \`agent_state.json\`: where the last session stopped.
2. \`task_board.json\`: what is in flight, what is next.
3. \`docs/agent-rules.md\`: startup, scope, definition of done (load on demand).

Definition of done: the task referenced by \`agent_state.active_task_id\` has
\`status == "done"\` on \`task_board.json\` and the verification command listed in
its \`acceptance\` has exited 0.

Verification command: \`python3 -m pytest -x\`
`;

interface AgentState {
  active_task_id: string | null;
  touched_files: string[];
  assumptions: string[];
  blockers: string[];
  next_action: string;
}

interface Task {
  id: string;
  goal: string;
  owner: string;
  acceptance: string[];
  status: string;
}

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyList(xs: string[]): string {
  return "[" + xs.map(pyStr).join(", ") + "]";
}

function newState(activeTaskId: string | null): AgentState {
  return { active_task_id: activeTaskId, touched_files: [], assumptions: [], blockers: [], next_action: "" };
}

function newTask(id: string, goal: string, owner: string, acceptance: string[], status = "todo"): Task {
  return { id, goal, owner, acceptance, status };
}

function dump(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}

function writeInitial(statePath: string, boardPath: string, agentsPath: string): void {
  if (!existsSync(agentsPath)) writeFileSync(agentsPath, AGENTS_MD);
  if (!existsSync(statePath)) writeFileSync(statePath, dump(newState(null)));
  if (!existsSync(boardPath)) {
    const board = [
      newTask("T-001", "add input validation to /signup", "builder", [
        "pytest test_app.py::test_signup_rejects_short_password",
      ]),
      newTask("T-002", "document the new /signup contract", "builder", ["docs/api.md mentions /signup constraints"]),
    ];
    writeFileSync(boardPath, dump(board));
  }
}

function loadState(statePath: string): AgentState {
  const raw = JSON.parse(readFileSync(statePath, "utf8")) as AgentState;
  return { ...newState(null), ...raw };
}

function loadBoard(boardPath: string): Task[] {
  const raw = JSON.parse(readFileSync(boardPath, "utf8")) as Task[];
  return raw.map((t) => newTask(t.id, t.goal, t.owner, t.acceptance, t.status ?? "todo"));
}

function saveState(statePath: string, state: AgentState): void {
  writeFileSync(statePath, dump(state));
}

function saveBoard(boardPath: string, board: Task[]): void {
  writeFileSync(boardPath, dump(board));
}

function runOneTurn(state: AgentState, board: Task[]): [AgentState, Task[]] {
  if (state.active_task_id === null) {
    const nxt = board.find((t) => t.status === "todo");
    if (nxt === undefined) {
      state.next_action = "no work on the board, idle";
      return [state, board];
    }
    nxt.status = "in_progress";
    state.active_task_id = nxt.id;
    state.next_action = `start work on ${nxt.id}: ${nxt.goal}`;
    return [state, board];
  }

  const active = board.find((t) => t.id === state.active_task_id);
  if (active === undefined) {
    state.active_task_id = null;
    state.next_action = "active task missing from board; resetting and picking new work";
    return [state, board];
  }
  if (!state.touched_files.includes("app.py")) {
    state.touched_files.push("app.py");
    state.next_action = `add test for ${active.id} acceptance`;
    return [state, board];
  }

  if (!state.touched_files.includes("test_app.py")) {
    state.touched_files.push("test_app.py");
    state.next_action = `run verification command for ${active.id}`;
    return [state, board];
  }

  active.status = "done";
  state.active_task_id = null;
  state.touched_files = [];
  state.next_action = "pick next task from board";
  return [state, board];
}

function main(): void {
  mkdirSync(ROOT, { recursive: true });
  const statePath = join(ROOT, "agent_state.json");
  const boardPath = join(ROOT, "task_board.json");
  const agentsPath = join(ROOT, "AGENTS.md");

  writeInitial(statePath, boardPath, agentsPath);
  let state = loadState(statePath);
  let board = loadBoard(boardPath);

  console.log("before turn:");
  console.log(`  active task : ${state.active_task_id ?? "None"}`);
  console.log(`  next action : ${pyStr(state.next_action)}`);
  console.log(`  todo on board: ${pyList(board.filter((t) => t.status === "todo").map((t) => t.id))}`);

  [state, board] = runOneTurn(state, board);
  saveState(statePath, state);
  saveBoard(boardPath, board);

  console.log("\nafter turn:");
  console.log(`  active task : ${state.active_task_id ?? "None"}`);
  console.log(`  touched     : ${pyList(state.touched_files)}`);
  console.log(`  next action : ${pyStr(state.next_action)}`);
  console.log(`  board status: [${board.map((t) => `(${pyStr(t.id)}, ${pyStr(t.status)})`).join(", ")}]`);
}

main();
