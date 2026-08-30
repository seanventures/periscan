#!/usr/bin/env python3
"""Aggregate exhaustive panel FINDING blocks into CSV + markdown backlog."""
from __future__ import annotations

import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PERSONAS = ROOT / "personas"
OUT = ROOT / "triage"

HEADER_RE = re.compile(
    r"^###\s*FINDING\s*\|\s*(?P<id>[^|]+)\s*\|\s*(?P<severity>P[0-3])\s*\|\s*"
    r"(?P<type>[^|]+)\s*\|\s*(?P<area>[^|]+)\s*\|\s*(?P<title>.+?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
FIELD_RE = re.compile(
    r"-\s*\*\*(?P<k>[^*]+):\*\*\s*(?P<v>.+?)(?=\n-\s*\*\*|\n###|\n## |\Z)",
    re.DOTALL,
)


def parse_file(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8", errors="replace")
    findings: list[dict] = []
    matches = list(HEADER_RE.finditer(text))
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end]
        fields = {fm.group("k").strip().lower(): fm.group("v").strip() for fm in FIELD_RE.finditer(body)}
        findings.append(
            {
                "id": m.group("id").strip(),
                "severity": m.group("severity").strip().upper(),
                "type": m.group("type").strip().lower(),
                "area": m.group("area").strip().lower(),
                "title": m.group("title").strip(),
                "persona_file": path.name,
                "evidence": fields.get("evidence", ""),
                "problem": fields.get("problem", ""),
                "impact": fields.get("impact", ""),
                "recommendation": fields.get("recommendation", ""),
                "effort": fields.get("effort", ""),
                "zoo": fields.get("zoo-related", fields.get("zoo related", "")),
                "previous": fields.get("previous-panel-link", fields.get("previous panel link", "")),
            }
        )
    return findings


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    all_f: list[dict] = []
    for path in sorted(PERSONAS.glob("*.md")):
        all_f.extend(parse_file(path))

    # Dedup by normalized title
    seen: set[str] = set()
    unique: list[dict] = []
    dupes = 0
    for f in all_f:
        key = re.sub(r"\s+", " ", f["title"].lower())
        if key in seen:
            dupes += 1
            continue
        seen.add(key)
        unique.append(f)

    # CSV
    csv_path = OUT / "MASTER_BACKLOG.csv"
    cols = [
        "id",
        "severity",
        "type",
        "area",
        "title",
        "effort",
        "zoo",
        "previous",
        "persona_file",
        "recommendation",
    ]
    lines = [",".join(cols)]
    for f in unique:
        row = []
        for c in cols:
            val = str(f.get(c, "")).replace('"', "'").replace("\n", " ")
            if "," in val or '"' in val:
                val = f'"{val}"'
            row.append(val)
        lines.append(",".join(row))
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    by_sev = Counter(f["severity"] for f in unique)
    by_type = Counter(f["type"] for f in unique)
    by_area = Counter(f["area"] for f in unique)
    zoo_yes = sum(1 for f in unique if str(f.get("zoo", "")).lower().startswith("y"))

    md = []
    md.append("# Master backlog — exhaustive panel 2026-07-29\n")
    md.append(f"- Raw findings parsed: **{len(all_f)}**")
    md.append(f"- Unique by title: **{len(unique)}** (dupes collapsed: {dupes})")
    md.append(f"- Zoo-related: **{zoo_yes}**")
    md.append("")
    md.append("## By severity\n")
    for k in ("P0", "P1", "P2", "P3"):
        md.append(f"- {k}: {by_sev.get(k, 0)}")
    md.append("\n## By type\n")
    for k, v in by_type.most_common():
        md.append(f"- {k}: {v}")
    md.append("\n## By area (top 20)\n")
    for k, v in by_area.most_common(20):
        md.append(f"- {k}: {v}")
    md.append("\n## All unique findings\n")
    order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    for f in sorted(unique, key=lambda x: (order.get(x["severity"], 9), x["area"], x["id"])):
        md.append(
            f"- **{f['id']}** [{f['severity']}|{f['type']}|{f['area']}] {f['title']} "
            f"_(effort {f['effort'] or '?'} · zoo {f['zoo'] or '?'} · {f['persona_file']})_"
        )
    (OUT / "MASTER_BACKLOG.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"parsed={len(all_f)} unique={len(unique)} zoo={zoo_yes}")
    print(f"wrote {csv_path} and MASTER_BACKLOG.md")


if __name__ == "__main__":
    main()
