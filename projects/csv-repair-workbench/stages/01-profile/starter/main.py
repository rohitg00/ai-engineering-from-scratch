import csv, io, datetime, copy, hashlib, json


def profile(text):
    """Parse CSV text into {columns, rows, profile}; profile maps each column to {missing, unique}. Reject empty/duplicate headers and ragged rows. Preserve cells exactly."""
    raise NotImplementedError("Implement profile using API.md and the stage lesson")


def propose(table, aliases=None, date_columns=None):
    """Return schema_version=1 recipe with ordered trim, alias, date rules. aliases maps column to exact trimmed spelling->canonical spelling. Dates accept ISO or unambiguous DD/MM/YYYY; ambiguous dates await review."""
    raise NotImplementedError("Implement propose using API.md and the stage lesson")


def preview(table, recipe):
    """Return {rows,changes,pending,fingerprint}; row numbers are CSV data rows starting at 1. Changes name row,column,before,after; ambiguous/invalid dates remain unchanged and appear in pending. Never mutate input."""
    raise NotImplementedError("Implement preview using API.md and the stage lesson")


def repair(table, recipe, decisions=None):
    """Return {csv,recipe,changes,pending,fingerprint}. Optional {fingerprint,cells:[{row,column,value}]} resolves pending cells only, rejecting stale fingerprints, duplicate edits and non-ISO replacement dates. Unresolved cells stay original."""
    raise NotImplementedError("Implement repair using API.md and the stage lesson")
