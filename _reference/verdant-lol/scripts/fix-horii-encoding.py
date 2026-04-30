"""Fix typographic Unicode in horii index.html that breaks CSS var() and quotes."""
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
s = path.read_text(encoding="utf-8")
s = s.replace("var(\u2013", "var(--")  # var(–bg) -> var(--bg)
s = s.replace("\u2018", "'")
s = s.replace("\u2019", "'")
path.write_text(s, encoding="utf-8")
print("fixed:", path)
