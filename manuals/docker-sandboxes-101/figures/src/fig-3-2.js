'use strict';

const { figure } = require('../../../_shared/figkit.js');

module.exports = figure('fig-3-2', {
  height: 356,
  title: 'One commit from the clone to the host',
  desc: 'On the left, the host repository at $CAPTURE/fixtures/repo-clone with main at c7dfd56. A read-only virtiofs mount carries it into the sandbox m101-clone at /run/sandbox/source. The agent works in a private clone on an ext4 volume whose origin is that mount, and commits 81e11df. A git push to origin is refused by the read-only mount. git-daemon serves the clone on port 9418, published on a loopback port, and the host remote sandbox-m101-clone fetches it into refs/remotes/sandbox-m101-clone/main and refs/sandboxes/m101-clone/main. After sbx rm, the remote is gone and the refs/sandboxes entry survives.',
}, f => {
  f.kicker(20, 18, 'host · $CAPTURE/fixtures/repo-clone');
  f.kicker(350, 18, 'sandbox m101-clone');

  const repo = f.box({ x: 20, y: 26, w: 270, h: 50, hue: 'green', title: '.git and working tree', sub: 'main at c7dfd56 second' });
  const mount = f.box({ x: 350, y: 26, w: 270, h: 50, hue: 'green', dash: 'dashed', title: '/run/sandbox/source', sub: 'virtiofs ro · Read-only file system' });
  f.arrow(repo.right(), [mount.x - 1, repo.cy], { style: 'call', label: 'bind mount, ro' });

  const clone = f.box({ x: 350, y: 110, w: 270, h: 70, hue: 'green', title: 'private clone, same path', sub: ['/dev/vde ext4 rw · origin = the mount', '81e11df from sandbox'] });
  f.arrow([560, 76], [560, 109], { style: 'call', label: 'git clone' });
  f.arrow([370, 110], [370, 77], { style: 'fail', label: 'git push: unpacker error' });

  const daemon = f.box({ x: 350, y: 214, w: 270, h: 50, hue: 'blue', title: 'git-daemon :9418', sub: 'published as 127.0.0.1:<port>->9418/tcp4' });
  f.arrow([485, 180], [485, 213], { style: 'call', label: 'serves the clone' });

  const remote = f.box({ x: 20, y: 110, w: 270, h: 70, hue: 'teal', title: 'remote sandbox-m101-clone', sub: ['git://127.0.0.1:<port>/repo-clone', 'two fetch refspecs in .git/config'] });
  f.path('M349 239 H320 V145 H291', { style: 'write' });
  f.text(300, 200, 'git fetch sandbox-m101-clone', { size: 11, hue: 'teal', anchor: 'start', knock: true });

  const refs = f.box({ x: 20, y: 214, w: 270, h: 70, hue: 'teal', title: 'after the fetch', sub: ['sandbox-m101-clone/main 81e11df', 'refs/sandboxes/m101-clone/main 81e11df'] });
  f.arrow([155, 180], [155, 213], { style: 'write' });

  f.box({ x: 20, y: 308, w: 600, h: 36, hue: 'grey', title: 'sbx rm: remote and daemon removed, refs/sandboxes/m101-clone/main survives', titleSize: 11.5, weight: 400 });
  f.arrow([155, 284], [155, 307], { style: 'state', packet: false });
  void refs;
  void daemon;
  void clone;
});
