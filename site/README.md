# Run the course website locally

The website is static and has no package dependencies. From the repository root:

```sh
node site/build.js
python -m http.server 4173 --directory site
```

Open <http://localhost:4173>. Use `python3` instead of `python` on systems where that is the Python command.

The build generates `site/data.js`, `site/materials.js`, and `site/course/`. The last two are ignored by Git because they are rebuilt from the course files already in this repository. Serve the site over HTTP instead of opening `index.html` directly so lesson and quiz files can be loaded by the browser.

Progress, reading position, theme, and reading preferences are stored only in the current browser with `localStorage`. No account or backend is required.

Run the progress tracker check with:

```sh
node site/tests/progress.test.js
```
