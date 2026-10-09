'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-4-3', {
  height: 458,
  title: 'From spec.yaml to a signed artifact and into a sandbox',
  desc: 'Row one, captured: the hello-mixin directory with spec.yaml and files, validated by sbx kit validate and packed by sbx kit pack into hello-mixin.zip. Row two, from the help text and not run: sbx kit sign with a key writes kit.sig.bundle beside spec.yaml, and sbx kit push with the sign flag pushes the manifest to an HTTPS registry with a signature referrer and a provenance referrer. Row three, not run: sbx kit verify and sbx kit provenance read those referrers back, beside the four settings that admit a kit. Row four, captured: sbx create with the kit flag builds m101-kit with tree installed and HELLO.md copied, sbx kit add appends env-mixin to m101-demo in a swap container, and sbx kit add refuses hello-mixin because it declares files.',
}, f => {
  f.kicker(20, 18, 'author and package (12-validate.txt, 12-pack.txt)');
  const dir = f.box({ x: 20, y: 28, w: 140, h: 52, hue: 'green', title: 'hello-mixin/', sub: ['spec.yaml, files/'] });
  const validate = f.box({ x: 180, y: 28, w: 130, h: 52, hue: 'blue', title: 'sbx kit validate', sub: ['VALID (directory)'], titleSize: 12, pad: 6 });
  const pack = f.box({ x: 330, y: 28, w: 130, h: 52, hue: 'blue', title: 'sbx kit pack -o', sub: ['Packed artifact to'], titleSize: 12, pad: 8 });
  const zip = f.box({ x: 480, y: 28, w: 140, h: 52, hue: 'green', title: 'hello-mixin.zip', sub: ['spec.yaml and files/'], pad: 8 });
  f.arrow(dir.right(), [validate.x - 1, dir.cy], { style: 'call' });
  f.arrow(validate.right(), [pack.x - 1, dir.cy], { style: 'call' });
  f.arrow(pack.right(), [zip.x - 1, dir.cy], { style: 'write' });

  f.kicker(110, 118, 'sign and publish (help-sbx, not run)');
  const sign = f.box({ x: 20, y: 128, w: 160, h: 66, hue: 'blue', dash: 'dashed', title: 'sbx kit sign --key', sub: ['writes kit.sig.bundle', 'beside spec.yaml'], titleSize: 12 });
  const push = f.box({ x: 200, y: 128, w: 180, h: 66, hue: 'blue', dash: 'dashed', title: 'sbx kit push --sign', sub: ['DIR REF, form chosen by', 'schemaVersion 1 or 2'], titleSize: 12 });
  const registry = f.box({ x: 400, y: 128, w: 220, h: 66, hue: 'grey', dash: 'dashed', title: 'HTTPS registry', sub: ['manifest, config, one layer', 'signature + provenance referrers'], titleSize: 12 });
  f.arrow([dir.cx, 80], [dir.cx, 127], { style: 'call' });
  f.arrow(sign.right(), [push.x - 1, sign.cy], { style: 'call' });
  f.arrow(push.right(), [registry.x - 1, sign.cy], { style: 'write', label: 'push' });

  f.kicker(20, 232, 'read back (not run)');
  const verify = f.box({ x: 300, y: 242, w: 140, h: 52, hue: 'blue', dash: 'dashed', title: 'sbx kit verify', sub: ['--key cosign.pub'], titleSize: 12 });
  const provenance = f.box({ x: 460, y: 242, w: 160, h: 52, hue: 'blue', dash: 'dashed', title: 'sbx kit provenance', sub: ['UNSIGNED or VERIFIED'], titleSize: 12, pad: 8 });
  f.arrow([registry.cx - 50, 194], [verify.cx, 241], { style: 'reply', packet: false });
  f.arrow([registry.cx + 50, 194], [provenance.cx, 241], { style: 'reply', packet: false });
  f.box({ x: 20, y: 242, w: 276, h: 52, hue: 'teal', title: 'settings that admit a kit', sub: ['kit.allowedSources, kit.requireSignature,', 'kit.trustedSigners, kit.allowLocalKits'], titleSize: 12 });

  f.kicker(20, 332, 'consume (12-run-kit.txt, 12-kit-add.txt, 12-kit-add-files.txt)');
  f.box({ x: 20, y: 342, w: 200, h: 70, hue: 'blue', title: 'sbx create shell --kit', sub: ['m101-kit: tree installed,', 'HELLO.md, allow example.com'], titleSize: 12, pad: 8 });
  f.box({ x: 236, y: 342, w: 190, h: 70, hue: 'blue', title: 'sbx kit add env-mixin', sub: ['m101-demo recreated in a', 'swap container, variable set'], titleSize: 12, pad: 8 });
  f.box({ x: 442, y: 342, w: 178, h: 70, hue: 'rose', title: 'sbx kit add hello-mixin', sub: ['refused: the kit', 'declares files'], titleSize: 11.5, pad: 8 });
  f.text(20, 440, 'Dashed boxes come from the help text and were not run. Every solid box is in capture/out/12-*.', { size: 11, serif: true, hue: 'ink-soft' });
});
