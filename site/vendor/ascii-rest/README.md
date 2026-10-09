# Canvas glyph painter

`canvas.js` adapts the glyph atlas and changed-cell painting from `src/mount.ts` in https://github.com/bas3line/ascii at commit `2572c2612fee106858f47aec139e3657f79f3a63`.

Copyright (c) 2026 bas3line. Distributed under the MIT license in `LICENSE`.

The adapter paints prepared text/color frames on one persistent canvas. It retains character sizing, palette rendering and changed-cell drawing, while the course controller owns playback, accessibility preferences, visibility, and cleanup. It performs no network requests.

The loss landscape and self-attention visualizations in `site/motion-lessons/` are original course examples. No ascii.rest scene or shape generators are included.
