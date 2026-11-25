# AI Engineering Landscape

An open map of the tools AI engineers build with. It lists open source and closed source tools, grouped by the job each one does. The page is at [aiengineeringfromscratch.com/landscape](https://aiengineeringfromscratch.com/landscape).

Listing is free. One tool is one small JSON file in [`entries/`](entries/).

## Add your tool

Pick the path that suits you. All three end in the same place.

### 1. Use the form (about two minutes)

1. Open the [Add your tool](https://aiengineeringfromscratch.com/landscape#add) form.
2. Fill in six fields. The X account is optional. The form checks them as you type.
3. Select **Open pull request on GitHub**. GitHub opens a new file with your entry filled in.
4. Select **Commit changes**, then **Create pull request**. GitHub makes the fork for you.

You do not clone the repository, and you do not write JSON by hand.

### 2. Add the file yourself

Create `landscape/entries/<your-tool>.json`:

```json
{
  "name": "Acme Evals",
  "url": "https://acme.dev",
  "category": "evaluation",
  "description": "Runs evaluation suites against model outputs and reports regressions.",
  "open_source": true,
  "repo": "https://github.com/acme/evals",
  "logo_url": "https://acme.dev/logo.svg"
}
```

Then check it:

```bash
node site/build-landscape.js --check
```

### 3. Open an issue

Not on GitHub day to day? [Send the details in an issue](https://github.com/rohitg00/ai-engineering-from-scratch/issues/new?template=landscape_tool.yml). A maintainer adds the entry.

## Fields

| Field | Required | Rule |
|---|---|---|
| `name` | yes | The tool name, 60 characters or fewer. |
| `url` | yes | The tool's website, `https://` only. |
| `category` | yes | One id from [`categories.json`](categories.json). |
| `also` | no | Up to three more category ids, for a tool that does several jobs. A maintainer sets this. |
| `description` | yes | One sentence that says what the tool does. 200 characters or fewer. It ends with a period. No rankings and no claims. |
| `open_source` | yes | `true` or `false`. |
| `repo` | open source only | The public source repository on GitHub, GitLab or Codeberg. |
| `x` | no | The tool's X handle, without the `@`. |
| `logo_url` | one of the two | A link to your SVG or PNG logo. A job copies it into the repository after merge. |
| `logo` | one of the two | `<your-tool>.svg` or `<your-tool>.png`, when you add the file to `site/logos/landscape/` in the same pull request. |

The file name is the tool's id. Use lowercase letters, digits and hyphens.

## Logos

- SVG or PNG, 100 KB or smaller. SVG is preferred.
- A PNG is at least 48 pixels on each side. 128 pixels or more looks sharp.
- A square mark works best. Each logo sits on a white tile.
- An SVG has no scripts, no embedded images and no links to outside files. The check rejects those.
- Logos are trademarks of their owners. Add a logo only when you have the right to share it.

## Categories

Categories sit in six groups: models and compute, developer tools, data and retrieval, agent infrastructure, voice and media, and agent products. The full list with ids is in [`categories.json`](categories.json). Chat assistants, agents from big labs and coding agents are separate categories, because a lab's chat app, its agent product and its coding agent are different tools.

Tools in a category are in alphabetical order. A maintainer can pin tools to the start of a category with the `pinned` list in `categories.json`, show a tool at a larger size with `featured`, and mark a sponsor with `sponsors`.

To propose a new category, open an issue first. A category needs at least three tools that fit no existing one.

## Listing rules

1. **Open source tools** need a public repository with 2,500 or more stars.
2. **Closed source tools** need a live product on their own domain and public documentation. Preview hosts such as `vercel.app` are not accepted.
3. **One entry per tool**, in the one category where it fits best.
4. **Someone who works on the tool submits it.** A maintainer can also add a tool.
5. **Listing is free.** It is separate from [sponsorship](../SPONSORS.md). Sponsors of the course are shown at a larger size and marked as sponsors.
6. **Links carry `rel="nofollow"`.** A listing is not a backlink.
7. **Stale entries are removed.** A tool with no release or commit for 12 months leaves the map.
8. **One tool per pull request.** Bulk and automated submissions are closed.

A maintainer merges valid entries within 7 days.

## How it is built

`site/build-landscape.js` reads `categories.json` and every file in `entries/`, checks each entry against the rules in `site/landscape-rules.js`, and writes `site/landscape-data.js` for the page. The form on the page uses the same rules file, so the form and the check always agree.

| Command | What it does |
|---|---|
| `node site/build-landscape.js --check` | Checks every entry and logo file. No network. |
| `node site/build-landscape.js --check --remote` | Also downloads each pending `logo_url` and checks the file. |
| `node site/build-landscape.js --fetch-logos` | Saves each pending `logo_url` into `site/logos/landscape/`. |
| `node site/build-landscape.js --stars <entry files>` | Reads the star count of each open source repository and fails below 2,500. CI runs it on the entries a pull request adds or changes. |
| `node site/build-landscape.js` | Writes `site/landscape-data.js`. |
| `node --test site/test_landscape.js` | Runs the tests. |

`site/landscape-data.js` is generated. Do not commit it.

## Data sources

The first agent product and agent infrastructure entries were seeded from [The AI Agent Market Map](https://assistantbenchmark.com/articles/the-ai-agent-market-map) by Assistant Benchmark. Seeded PNG logos are each product's own site icon, or the GitHub avatar of the project's organization.
