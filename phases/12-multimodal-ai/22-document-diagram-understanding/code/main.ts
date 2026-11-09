// Lesson: Document and Diagram Understanding (phase 12 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/22-document-diagram-understanding/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/22-document-diagram-understanding/code/main.ts

export {};

type BBox = [number, number, number, number];

class Token {
  constructor(public text: string, public bbox: BBox) {}
}

function mockPage(): Token[] {
  return [
    new Token("INVOICE", [100, 50, 300, 80]),
    new Token("ACME Co.", [100, 100, 250, 130]),
    new Token("Item", [100, 200, 200, 230]),
    new Token("Widget A", [100, 240, 250, 270]),
    new Token("Price", [400, 200, 500, 230]),
    new Token("$120.00", [400, 240, 500, 270]),
    new Token("Total", [400, 400, 500, 430]),
    new Token("$1,245.00", [400, 440, 550, 470]),
  ];
}

function stringHash(s: string): number {
  let h = 0x811c9dc5;
  for (const b of Buffer.from(s, "utf8")) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

interface LayoutInput {
  textIds: number[];
  bboxStream: BBox[];
  patchIds: number[];
}

function layoutlmInput(tokens: Token[], patchGrid: [number, number] = [16, 16]): LayoutInput {
  const textIds = tokens.map((t) => stringHash(t.text) % 10000);
  const bboxStream = tokens.map((t) => t.bbox);
  const nPatches = patchGrid[0] * patchGrid[1];
  const patchIds = Array.from({ length: nPatches }, (_, i) => i);
  return { textIds, bboxStream, patchIds };
}

function donutSchema(task = "invoice"): object {
  const schemas: Record<string, object> = {
    invoice: {
      vendor: "<string>",
      invoice_number: "<string>",
      line_items: [{ description: "<string>", quantity: "<int>", price: "<float>" }],
      total: "<float>",
      currency: "<string>",
    },
    form: {
      form_id: "<string>",
      fields: [{ name: "<string>", value: "<string>", confidence: "<float>" }],
    },
  };
  return schemas[task] ?? {};
}

function tokenBudget(): void {
  console.log("\nINPUT TOKEN BUDGET PER PAGE (A4 at 300 DPI, ~2500x3500 px)");
  console.log("-".repeat(60));
  const rows: [string, number, string][] = [
    ["OCR pipeline + LayoutLMv3", 512, "text + bbox + small image"],
    ["Donut (OCR-free)", 4096, "swin encoder, ~4k patches"],
    ["Nougat (paper pages)", 4096, "896x896, 4-tile AnyRes"],
    ["VLM AnyRes 4-tile (LLaVA)", 2880, "336 tiles + thumbnail"],
    ["VLM native 2048 (Qwen2.5-VL)", 8192, "native resolution"],
    ["VLM native 2576 (Claude 4.7)", 12000, "frontier, best accuracy"],
  ];
  console.log(`  ${"stack".padEnd(28)}${"tokens".padEnd(10)}  note`);
  for (const [name, toks, note] of rows) console.log(`  ${name.padEnd(28)}${String(toks).padEnd(10)}  ${note}`);
}

function demoPipelineOutput(): void {
  console.log("\nLAYOUTLMv3-STYLE INPUT (invoice page)");
  console.log("-".repeat(60));
  const tokens = mockPage();
  const data = layoutlmInput(tokens);
  console.log(`  text_ids[0:4]    : [${data.textIds.slice(0, 4).join(", ")}]...`);
  const boxes = data.bboxStream.slice(0, 2).map((b) => "(" + b.join(", ") + ")");
  console.log(`  bbox_stream[0:2] : [${boxes.join(", ")}]`);
  console.log(`  patch_ids count  : ${data.patchIds.length}`);

  console.log("\nDONUT SCHEMA (invoice)");
  console.log("-".repeat(60));
  const schema = donutSchema("invoice");
  console.log(JSON.stringify(schema, null, 2));
}

function erasTable(): void {
  console.log("\nTHREE ERAS OF DOCUMENT AI");
  console.log("-".repeat(60));
  const rows: [string, string, string][] = [
    ["Era 1 OCR pipeline", "Tesseract, TrOCR, LayoutLMv3", "deterministic"],
    ["Era 2 OCR-free", "Donut, Nougat, DocLLM", "generalist less"],
    ["Era 3 VLM-native", "Qwen2.5-VL, PaliGemma 2, Claude 4.7", "frontier 2026"],
  ];
  for (const [era, examples, trait] of rows) console.log(`  ${era.padEnd(20)}${examples.padEnd(36)}${trait}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("DOCUMENT AND DIAGRAM UNDERSTANDING (Phase 12, Lesson 22)");
  console.log("=".repeat(60));

  demoPipelineOutput();
  tokenBudget();
  erasTable();

  console.log("\nRECIPE PICKER");
  console.log("-".repeat(60));
  console.log("  10M invoices/day     : OCR pipeline + LayoutLMv3, cheap");
  console.log("  scientific papers    : Nougat for math, VLM for figures");
  console.log("  mixed + handwriting  : VLM-native (PaliGemma 2 or Qwen2.5-VL)");
  console.log("  regulated            : OCR + VLM cross-check, auditable");
}

main();
