// Lesson: Benchmarks: WebArena and OSWorld (phase 14 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/20-benchmarks-webarena-osworld/docs/en.md
// Run: npx tsx phases/14-agent-engineering/20-benchmarks-webarena-osworld/code/main.ts

interface Item {
  name: string;
  price: number;
}

interface Order {
  oid: string;
  items: Map<string, number>;
  total: number;
}

class ShoppingApp {
  items = new Map<string, Item>([
    ["sku-001", { name: "headphones", price: 199 }],
    ["sku-002", { name: "keyboard", price: 129 }],
    ["sku-003", { name: "mouse", price: 59 }],
  ]);
  cart = new Map<string, number>();
  orders: Order[] = [];

  listItems(): ({ sku: string } & Item)[] {
    return [...this.items.entries()].map(([sku, meta]) => ({ sku, ...meta }));
  }

  addToCart(sku: string, qty = 1): string {
    if (!this.items.has(sku)) return "error: unknown sku";
    this.cart.set(sku, (this.cart.get(sku) ?? 0) + qty);
    return `added ${qty} x ${sku}`;
  }

  removeFromCart(sku: string): string {
    if (!this.cart.has(sku)) return "error: not in cart";
    this.cart.delete(sku);
    return `removed ${sku}`;
  }

  checkout(): string {
    if (this.cart.size === 0) return "error: empty cart";
    let total = 0;
    for (const [sku, qty] of this.cart) total += this.items.get(sku)!.price * qty;
    const oid = `ord-${String(this.orders.length + 1).padStart(3, "0")}`;
    this.orders.push({ oid, items: new Map(this.cart), total });
    this.cart = new Map();
    return oid;
  }
}

interface Task {
  tid: string;
  description: string;
  agent: (app: ShoppingApp) => string[];
  goldSteps: number;
  success: (app: ShoppingApp) => boolean;
}

function agentTask1(app: ShoppingApp): string[] {
  const trace: string[] = [];
  trace.push(`list_items -> ${app.listItems().length} items`);
  trace.push(`add_to_cart sku-001 -> ${app.addToCart("sku-001")}`);
  trace.push(`checkout -> ${app.checkout()}`);
  return trace;
}

function agentTask2(app: ShoppingApp): string[] {
  const trace: string[] = [];
  trace.push("list_items");
  app.listItems();
  trace.push(`add_to_cart sku-002 -> ${app.addToCart("sku-002")}`);
  trace.push(`add_to_cart sku-003 -> ${app.addToCart("sku-003")}`);
  trace.push(`checkout -> ${app.checkout()}`);
  return trace;
}

function agentTask3(app: ShoppingApp): string[] {
  const trace: string[] = [];
  trace.push("list_items");
  app.listItems();
  trace.push(`add_to_cart sku-001 -> ${app.addToCart("sku-001")}`);
  trace.push(`add_to_cart sku-002 -> ${app.addToCart("sku-002")}`);
  trace.push("revised_choice: remove keyboard");
  trace.push(`remove_from_cart sku-002 -> ${app.removeFromCart("sku-002")}`);
  trace.push(`add_to_cart sku-003 -> ${app.addToCart("sku-003")}`);
  trace.push(`checkout -> ${app.checkout()}`);
  return trace;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("WEBARENA/OSWORLD-STYLE HARNESS: Phase 14, Lesson 20");
  console.log("=".repeat(70));

  const tasks: Task[] = [
    {
      tid: "buy_headphones",
      description: "buy the headphones",
      agent: agentTask1,
      goldSteps: 3,
      success: (app) => app.orders.some((o) => o.items.get("sku-001") === 1),
    },
    {
      tid: "buy_bundle",
      description: "buy keyboard + mouse as a bundle",
      agent: agentTask2,
      goldSteps: 4,
      success: (app) => app.orders.some((o) => o.items.get("sku-002") === 1 && o.items.get("sku-003") === 1),
    },
    {
      tid: "revised_order",
      description: "swap keyboard for mouse mid-order",
      agent: agentTask3,
      goldSteps: 5,
      success: (app) =>
        app.orders.some(
          (o) => o.items.get("sku-001") === 1 && o.items.get("sku-003") === 1 && !o.items.has("sku-002"),
        ),
    },
  ];

  let totalSuccess = 0;
  let totalSteps = 0;
  let totalGold = 0;
  for (const task of tasks) {
    const app = new ShoppingApp();
    const trace = task.agent(app);
    const ok = task.success(app);
    const steps = trace.length;
    const efficiency = steps / task.goldSteps;
    console.log(`\n[${task.tid}] ${task.description}`);
    console.log(`  success: ${ok ? "True" : "False"}`);
    console.log(`  steps:   ${steps}  (gold ${task.goldSteps}, efficiency ${efficiency.toFixed(2)}x)`);
    for (const line of trace) console.log(`    - ${line}`);
    if (ok) totalSuccess += 1;
    totalSteps += steps;
    totalGold += task.goldSteps;
  }

  console.log("\naggregate");
  console.log(`  success rate:     ${totalSuccess}/${tasks.length}`);
  console.log(`  step efficiency:  ${(totalSteps / totalGold).toFixed(2)}x over gold`);
  console.log();
  console.log("WebArena: execution-based, gym APIs, state check decides success.");
  console.log("OSWorld-Human: gold trajectories reveal 1.4-2.7x step inefficiency.");
}

main();
