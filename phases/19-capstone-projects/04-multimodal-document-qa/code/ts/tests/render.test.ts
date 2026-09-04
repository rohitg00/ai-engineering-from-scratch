import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderDocument, renderIndex } from "../src/render.js";
import { getFixture } from "../src/fixtures.js";

describe("escapeHtml", () => {
  it("escapes the five hostile chars", () => {
    assert.equal(escapeHtml("<a href=\"x\">'&\"</a>"), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&quot;&lt;/a&gt;");
  });

  it("returns the input unchanged when there is nothing to escape", () => {
    assert.equal(escapeHtml("hello world"), "hello world");
  });
});

describe("renderIndex", () => {
  it("lists both fixture documents as links", () => {
    const html = renderIndex();
    assert.match(html, /<a href="\/document\/10k-acme-2025">/);
    assert.match(html, /<a href="\/document\/nature-paper-2026">/);
    assert.match(html, /Capstone 04 viewer/);
  });
});

describe("renderDocument", () => {
  it("inlines a JSON payload for canvas overlay drawing", () => {
    const doc = getFixture("10k-acme-2025");
    assert.ok(doc);
    const html = renderDocument(doc);
    assert.match(html, /const DATA = \{/);
    assert.match(html, /"pageWidth":1224/);
    assert.match(html, /<canvas class="overlay"/);
  });

  it("escapes hostile content in title + query", () => {
    const html = renderDocument({
      id: "x",
      title: "<script>alert(1)</script>",
      pageWidth: 100,
      pageHeight: 100,
      pageImageUrl: "/static/x.png",
      query: "q?",
      answer: "a.",
      evidence: [],
    });
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it("escapes hostile content in query field", () => {
    const html = renderDocument({
      id: "y",
      title: "ok",
      pageWidth: 100,
      pageHeight: 100,
      pageImageUrl: "/static/y.png",
      query: "<script>alert(2)</script>",
      answer: "a.",
      evidence: [],
    });
    assert.ok(!html.includes("<script>alert(2)</script>"));
    assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  });
});
