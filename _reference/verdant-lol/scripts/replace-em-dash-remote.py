#!/usr/bin/env python3
"""Run on server: replace U+2014 in HTML roots (MJ Universe storefronts)."""
import pathlib

EM = "\u2014"
ROOTS = [
    "/home/mj-universe/htdocs/mj-universe.net",
    "/home/mjuniverse-store/htdocs/mjuniverse.store",
]

for root in ROOTS:
    base = pathlib.Path(root)
    if not base.exists():
        print("skip missing", root)
        continue
    for path in base.rglob("*.html"):
        try:
            t = path.read_text(encoding="utf-8")
        except OSError as e:
            print(path, e)
            continue
        if EM not in t:
            continue
        nt = t.replace(EM, " - ")
        while "  -  " in nt:
            nt = nt.replace("  -  ", " - ")
        path.write_text(nt, encoding="utf-8")
        print("fixed", path)
