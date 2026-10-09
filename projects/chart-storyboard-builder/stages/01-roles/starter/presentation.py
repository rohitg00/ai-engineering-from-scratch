import html, json
from pathlib import Path


def page(title, sections, path, review=None):
    """Write standalone accessible HTML. Review data is downloadable and edited as JSON."""
    blocks = []
    for heading, rows in sections:
        if not isinstance(rows, list):
            rows = [rows]
        keys = list(dict.fromkeys((k for r in rows if isinstance(r, dict) for k in r)))
        table = (
            "<thead><tr>"
            + "".join(
                ('<th scope="col">' + html.escape(str(k)) + "</th>" for k in keys)
            )
            + "</tr></thead><tbody>"
        )
        for row in rows:
            table += (
                "<tr>"
                + "".join(
                    (
                        "<td>"
                        + html.escape(
                            json.dumps(row.get(k), ensure_ascii=False)
                            if isinstance(row.get(k), (dict, list))
                            else str(row.get(k, ""))
                        )
                        + "</td>"
                        for k in keys
                    )
                )
                + "</tr>"
            )
        blocks.append(
            "<section><h2>"
            + html.escape(heading)
            + '</h2><div class="scroll"><table>'
            + table
            + "</tbody></table></div></section>"
        )
    panel = ""
    if review is not None:
        panel = (
            '<section><h2>Review decisions</h2><p>Edit this JSON, then download it. Re-run the CLI with --decisions decisions.json to validate and consume your review.</p><label for="decisions">Decisions JSON</label><textarea id="decisions" rows="14">'
            + html.escape(json.dumps(review, indent=2, ensure_ascii=False))
            + '</textarea><button id="download">Download decisions.json</button><output id="status" aria-live="polite"></output></section>'
        )
    js = "document.querySelector('#filter').addEventListener('input',e=>document.querySelectorAll('tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())));const b=document.querySelector('#download');if(b)b.addEventListener('click',()=>{try{const raw=document.querySelector('#decisions').value;JSON.parse(raw);const a=document.createElement('a');const u=URL.createObjectURL(new Blob([raw],{type:'application/json'}));a.href=u;a.download='decisions.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);document.querySelector('#status').textContent='Downloaded. Re-run the CLI to validate these decisions.';}catch(e){document.querySelector('#status').textContent=e.message;}});"
    css = ":root{color-scheme:light dark;font:17px/1.55 system-ui}body{max-width:1100px;margin:0 auto;padding:28px;background:light-dark(#f7f8fb,#15191f);color:light-dark(#202837,#e7edf5)}h1{font-size:clamp(1.8rem,5vw,3rem);line-height:1.1}section{margin:28px 0;padding:20px;border:1px solid #7c879a;border-radius:12px}.scroll{overflow:auto;max-width:100%}table{border-collapse:collapse;width:100%;min-width:640px}td,th{min-width:8rem;text-align:left;padding:10px;border-bottom:1px solid #7c879a;vertical-align:top}td{max-width:420px;overflow-wrap:anywhere}textarea{box-sizing:border-box;width:100%;font:14px/1.5 monospace}input,button{font:inherit;padding:10px}button{cursor:pointer;margin:10px 0}output{display:block}svg{display:block;min-width:640px;max-width:100%;height:auto}"
    Path(path).write_text(
        '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
        + html.escape(title)
        + "</title><style>"
        + css
        + "</style><body><header><p>AI Engineering from Scratch / local artifact</p><h1>"
        + html.escape(title)
        + '</h1><label for="filter">Search evidence </label><input id="filter" type="search"></header>'
        + "".join(blocks)
        + panel
        + "<script>"
        + js
        + "</script></body></html>",
        encoding="utf-8",
    )
