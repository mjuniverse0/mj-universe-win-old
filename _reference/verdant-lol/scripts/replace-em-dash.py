"""Replace U+2014 em dash with plain ASCII hyphen-style text. Skips node_modules."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_PARTS = {"node_modules", ".git"}

EM = "\u2014"


def process(path: pathlib.Path, text: str) -> str:
    if EM not in text:
        return text

    rel = path.as_posix()

    if path.name == "server.js":
        text = text.replace('"—"', '"-"')
        text = text.replace(
            '.replace(/^verdant\\s+external\\s*[—\\-–]\\s*/i, "")',
            '.replace(/^verdant\\s+external\\s*[-\\u2013\\u2014]\\s*/i, "")',
        )

    if "horii-index.html" in rel and "scrambleChars" in text:
        m = re.search(r"(const scrambleChars = ')([^']*)(';)", text)
        if m:
            inner = m.group(2).replace(EM, "|")
            text = text[: m.start()] + m.group(1) + inner + m.group(3) + text[m.end() :]

    text = text.replace(EM, " - ")
    return text


def main():
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(p in SKIP_PARTS for p in path.parts):
            continue
        if path.suffix.lower() not in {
            ".html",
            ".js",
            ".css",
            ".md",
            ".ps1",
            ".conf",
            ".bat",
            ".cpp",
            ".hpp",
            ".py",
            ".toml",
            ".json",
            ".example",
            ".mjs",
            ".cjs",
        }:
            continue
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError:
            continue
        if EM not in raw:
            continue
        updated = process(path, raw)
        if updated != raw:
            path.write_text(updated, encoding="utf-8", newline="\n")
            print(path.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
