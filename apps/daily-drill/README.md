# Daily Drill

A static, one-lesson-a-day study app built from this repo's lessons. Each day is one "sheet":

1. **Brief.** The lesson's hook, the problem it solves, its learning objectives, and flip cards for its key terms.
2. **Drill.** The lesson's `quiz.json`, with a per-question timer (10, 20 or 30 seconds, or off). Keys `1`–`4` answer and `Enter` moves on. Lessons without a quiz get questions generated from their Key Terms table.
3. **Review.** Questions you missed come back after 1, 3, 7 and 16 days.
4. **Go deeper.** Links to the web lesson, the source folder and the book volume, the command to run the lesson's code, one exercise, and the lesson's further reading.

You can follow the full course in order or one of the tracks in `learning-paths/`. Progress, streak and the review queue are stored in the browser's `localStorage`.

## Build

The app reads a generated `data.js`. It isn't committed, so build it after cloning or pulling:

```bash
node apps/daily-drill/build-data.mjs              # writes apps/daily-drill/data.js
```

Then open `apps/daily-drill/index.html` in a browser. It has no dependencies and needs no server.

## Single-file build

```bash
node apps/daily-drill/build-data.mjs --standalone  # also writes apps/daily-drill/dist/daily-drill.html
```

`dist/daily-drill.html` has the data inlined (about 2.5 MB), so you can host it anywhere that serves one file.

## Hosting on GitHub Pages

```bash
node apps/daily-drill/build-data.mjs --pages      # writes dist/pages/{index.html,data.js,.nojekyll}
```

Commit the contents of `dist/pages/` as the only files on an orphan `gh-pages` branch and push it. Pushing a `gh-pages` branch turns Pages on with that branch as the source.

Live: https://saintbr.github.io/ai-engineering-from-scratch/

## Hosting on gists

gistpreview.github.io reads files through the gist API, which truncates every file in a gist once the total passes 1 MB. So the page and the data go in two gists:

```bash
gh gist create --public dist/gist/drill-data.json         # 1. data gist; note its id
node apps/daily-drill/build-data.mjs \
  --data-url=https://gist.githubusercontent.com/<user>/<data-id>/raw/drill-data.json
gh gist create --public apps/daily-drill/dist/gist/index.html   # 2. page gist (index.html only)
```

Open `https://gistpreview.github.io/?<page-id>`. When the lessons change, rebuild and run `gh gist edit <data-id> -a dist/gist/drill-data.json`. The raw URL always serves the latest revision, so the page gist only needs updating when `index.html` changes.

Live: https://gistpreview.github.io/?792f17bd621d46b41fe26fa7af4004e4

## Notes

- `index.html` leaves out `<!doctype>`/`<head>` so it can also be published as a Claude Artifact. The standalone build adds them.
- Lessons with neither a quiz nor key terms skip the drill step.
- The Node build script uses only the stdlib (Node 20+).
