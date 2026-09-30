import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const m = await import(
  pathToFileURL(join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
function deck() {
  return {
    sources: [
      {
        id: "s",
        title: "Repair guide",
        text: "Store spare bolts in the green tray. Check the label each Friday.",
      },
    ],
    cards: [
      {
        id: "c",
        sourceId: "s",
        question: "Where are spare bolts stored?",
        answer: "green tray",
        accepted: ["the green tray"],
        start: 0,
        end: 36,
      },
    ],
  };
}

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
test("export writes a real page and reproducible JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "study-test-"));
  try {
    m.exportPractice(deck(), [], "2026-09-01", "2026-09-02", dir);
    const saved = JSON.parse(readFileSync(join(dir, "progress.json"), "utf8"));
    assert.equal(saved.due[0].cardId, "c");
    assert.match(readFileSync(join(dir, "index.html"), "utf8"), /<details>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("HTML escapes question title and source text", () => {
  const d = deck();
  d.cards[0].question = "<img src=x>";
  d.sources[0].title = "<script>bad()</script>";
  const page = m.renderPractice(
    d,
    m.buildProgress(d, [], "2026-09-01"),
    "2026-09-01",
  );
  assert.ok(page.includes("&lt;img"));
  assert.ok(!page.includes("<script>bad()</script>"));
  assert.ok(page.includes("Download attempts JSON"));
  assert.ok(page.includes("Check and record my answer"));
});
test("report cannot predate attempts or initial date", () => {
  const dir = mkdtempSync(join(tmpdir(), "study-test-"));
  try {
    assert.throws(() =>
      m.exportPractice(deck(), [], "2026-09-02", "2026-09-01", dir),
    );
    assert.throws(() =>
      m.exportPractice(
        deck(),
        [{ id: "a", cardId: "c", date: "2026-09-04", answer: "green tray" }],
        "2026-09-01",
        "2026-09-03",
        dir,
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("progress must cover rendered cards", () =>
  assert.throws(() => m.renderPractice(deck(), [], "2026-09-01")));
async function withProvider(proposal, callback) {
  let received;
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    received = JSON.parse(body);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(proposal) } }],
      }),
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await callback(
      `http://127.0.0.1:${server.address().port}/v1/chat/completions`,
      () => received,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
test("real loopback HTTP adapter preserves source and review status", async () => {
  const source = deck().sources[0];
  await withProvider(
    {
      question: "Where?",
      answer: "green tray",
      quote: "Store spare bolts in the green tray.",
    },
    async (url, request) => {
      const p = await m.proposeCard(source, url, "test-model");
      assert.equal(p.status, "review-required");
      assert.equal(
        source.text.slice(p.start, p.end),
        "Store spare bolts in the green tray.",
      );
      assert.equal(request().model, "test-model");
      assert.equal(request().messages[1].content, source.text);
    },
  );
});
test("provider fabricated quote is rejected", async () => {
  await withProvider(
    { question: "Where?", answer: "red tray", quote: "Use a red tray." },
    async (url) => {
      await assert.rejects(() => m.proposeCard(deck().sources[0], url, "m"));
    },
  );
});
test("provider unsupported URL fails before network", async () => {
  await assert.rejects(() =>
    m.proposeCard(deck().sources[0], "file:///tmp/x", "m"),
  );
});

test("practice payload retains prior events and safely embeds source data", () => {
  const d = deck();
  d.sources[0].title = "</script><script>bad()</script>";
  const attempts = [
    { id: "a", cardId: "c", date: "2026-09-01", answer: "green tray" },
  ];
  const page = m.renderPractice(
    d,
    m.buildProgress(d, attempts, "2026-09-01"),
    "2026-09-02",
    attempts,
    "2026-09-01",
  );
  const payload = JSON.parse(
    page.match(
      /<script type="application\/json" id="practice-data">([\s\S]*?)<\/script>/,
    )[1],
  );
  assert.deepEqual(payload.attempts, attempts);
  assert.equal(payload.initialDate, "2026-09-01");
  assert.equal(payload.deck.sources[0].title, d.sources[0].title);
  assert.ok(!page.includes("</script><script>bad()"));
});

import vm from "node:vm";
test("recorded browser answers download in the scheduler event schema", async () => {
  const history = [
    { id: "prior", cardId: "c", date: "2026-09-01", answer: "green tray" },
  ];
  const page = m.renderPractice(
    deck(),
    m.buildProgress(deck(), history, "2026-09-01"),
    "2026-09-02",
    history,
    "2026-09-01",
  );
  const payload = page.match(
    /<script type="application\/json" id="practice-data">([\s\S]*?)<\/script>/,
  )[1];
  const handlers = {};
  const feedback = { textContent: "" };
  const answer = { value: "  GREEN TRAY!  " };
  const download = {
    disabled: true,
    addEventListener: (_, callback) => {
      handlers.download = callback;
    },
  };
  const elements = {
    "practice-data": { textContent: payload },
    "session-status": { textContent: "" },
    "attempt-date": { value: "2026-09-02" },
    "download-attempts": download,
  };
  const article = {
    dataset: { card: "c" },
    querySelector: (selector) =>
      selector === "[data-record]"
        ? {
            addEventListener: (_, callback) => {
              handlers.record = callback;
            },
          }
        : selector === "[data-feedback]"
          ? feedback
          : answer,
  };
  let blob;
  const document = {
    getElementById: (id) => elements[id],
    querySelectorAll: () => [article],
    body: { appendChild() {} },
    createElement: () => ({ click() {}, remove() {} }),
  };
  const script = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  vm.runInNewContext(script, {
    document,
    Blob,
    URL: {
      createObjectURL(value) {
        blob = value;
        return "blob:test";
      },
      revokeObjectURL() {},
    },
    crypto: { randomUUID: () => "new-attempt" },
    setTimeout: (callback) => callback(),
  });
  handlers.record();
  assert.equal(download.disabled, false);
  assert.match(feedback.textContent, /Accepted.*2026-09-04/);
  handlers.download();
  let exported = JSON.parse(await blob.text());
  assert.equal(exported.length, 2);
  assert.deepEqual(exported[1], {
    id: "practice-new-attempt",
    cardId: "c",
    date: "2026-09-02",
    answer: "  GREEN TRAY!  ",
  });
  assert.equal(
    m.buildProgress(deck(), exported, "2026-09-01")[0].due,
    "2026-09-04",
  );
  answer.value = "red tray";
  handlers.record();
  handlers.download();
  exported = JSON.parse(await blob.text());
  assert.equal(exported.length, 2);
  assert.equal(exported[1].answer, "red tray");
  assert.equal(
    m.buildProgress(deck(), exported, "2026-09-01")[0].due,
    "2026-09-03",
  );
});
