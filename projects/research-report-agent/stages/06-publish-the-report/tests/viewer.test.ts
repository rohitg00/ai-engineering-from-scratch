import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { renderReport, escapeHtml, safeUrl } = await import(pathToFileURL(join(process.env.PROJECT_WORKSPACE!, 'viewer/render.ts')).href);
function payload() {
  const text = 'λ😀 Each guest has its own kernel.';
  return { schema_version: 1, question: '<script>alert(1)</script>', sections: [{ heading: 'Overview', sentences: [{ text, cites: ['S1'] }, { text, cites: ['S1'] }] }], snippets: { S1: { id: 'S1', doc_id: 'd1', text, start: 0, end: [...text].length, score: 1 } }, documents: [{ id: 'd1', title: 'Guest kernels', text, source_url: 'https://example.test/kernels', published: '2026-09-28' }], trace: { run_id: 'test', terminal_state: 'completed', counts: {}, budget: {}, steps: [{ name: 'index', ms: 1, detail: {} }] } };
}
test('escapes every HTML delimiter', () => assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;'));
test('rejects executable URL schemes', () => { assert.equal(safeUrl('javascript:alert(1)'), '#'); assert.equal(safeUrl('data:text/html,x'), '#'); });
test('handles Python Unicode code-point offsets', () => assert.match(renderReport(payload()), /λ😀/));
test('uses one footnote per unique citation and unique tooltip ids', () => { const html = renderReport(payload()); assert.equal((html.match(/id="fn-1"/g) || []).length, 1); assert.match(html, /id="evidence-1"/); assert.match(html, /id="evidence-2"/); });
test('provides keyboard-accessible evidence and trace', () => { const html = renderReport(payload()); assert.match(html, /aria-describedby="evidence-1"/); assert.match(html, /role="tooltip"/); assert.match(html, /<details>/); assert.match(html, /<summary>/); });
test('untrusted question remains text', () => { const html = renderReport(payload()); assert.ok(!html.includes('<script>')); assert.match(html, /&lt;script&gt;/); });
test('rejects dangling citations and edited source spans', () => { const p = payload(); p.sections[0].sentences[0].cites = ['S99']; assert.throws(() => renderReport(p), /unresolved citation/); const q = payload(); q.snippets.S1.text = 'changed'; assert.throws(() => renderReport(q), /source span mismatch/); });
