import csv, io, math, html


def parse_table(text, roles):
    """Return {rows,roles,missing}; roles requires group,value,unit strings naming CSV columns and a display unit. Rows retain raw values plus group and number (float or None for blanks). Reject duplicate headers, ragged rows, blank groups and non-finite numbers."""
    raise NotImplementedError("Implement parse_table using API.md and the stage lesson")


def aggregate(table, reducer="sum", periods=None, grammar="bar"):
    """Return chart spec {schema_version,grammar,reducer,unit,points,axis,source_rows,missing_values}. Reducers: sum,mean,count (nonblank values). Supplied unique periods define order and expose absent groups as null. Reject omitted observed groups. Axis always includes zero."""
    raise NotImplementedError("Implement aggregate using API.md and the stage lesson")


def annotate(spec, requests):
    """Return a copied spec with annotations [{group,value,text}]. Requests {group,text} must identify a nonmissing point; generated text appends the exact plotted value and unit. Reject duplicate or unknown groups."""
    raise NotImplementedError("Implement annotate using API.md and the stage lesson")


def render_svg(spec):
    """Render a standalone accessible SVG with title, desc, explicit zero baseline, values, unit and missing-point labels. Line charts break across missing points. All supplied text is XML-escaped; no JavaScript or external resources."""
    raise NotImplementedError("Implement render_svg using API.md and the stage lesson")
