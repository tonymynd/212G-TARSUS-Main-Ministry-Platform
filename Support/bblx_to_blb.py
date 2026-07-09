#!/usr/bin/env python3
"""Convert e-Sword .bblx (SQLite) Bible modules to BLB markdown + Tarsus JSON."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

# Standard Protestant canon — matches kjv-bible-blb folder layout
BOOKS = [
    # (id, testament, folder, english_name, display_abbr, anchor_prefix)
    (1, "OT", "01-Genesis", "Genesis", "Gen", "Ge"),
    (2, "OT", "02-Exodus", "Exodus", "Exo", "Ex"),
    (3, "OT", "03-Leviticus", "Leviticus", "Lev", "Le"),
    (4, "OT", "04-Numbers", "Numbers", "Num", "Nu"),
    (5, "OT", "05-Deuteronomy", "Deuteronomy", "Deu", "Dt"),
    (6, "OT", "06-Joshua", "Joshua", "Jos", "Js"),
    (7, "OT", "07-Judges", "Judges", "Jdg", "Jg"),
    (8, "OT", "08-Ruth", "Ruth", "Rut", "Ru"),
    (9, "OT", "09-1-Samuel", "1 Samuel", "1Sa", "1Sa"),
    (10, "OT", "10-2-Samuel", "2 Samuel", "2Sa", "2Sa"),
    (11, "OT", "11-1-Kings", "1 Kings", "1Ki", "1Ki"),
    (12, "OT", "12-2-Kings", "2 Kings", "2Ki", "2Ki"),
    (13, "OT", "13-1-Chronicles", "1 Chronicles", "1Ch", "1Ch"),
    (14, "OT", "14-2-Chronicles", "2 Chronicles", "2Ch", "2Ch"),
    (15, "OT", "15-Ezra", "Ezra", "Ezr", "Er"),
    (16, "OT", "16-Nehemiah", "Nehemiah", "Neh", "Ne"),
    (17, "OT", "17-Esther", "Esther", "Est", "Es"),
    (18, "OT", "18-Job", "Job", "Job", "Jb"),
    (19, "OT", "19-Psalms", "Psalms", "Psa", "Ps"),
    (20, "OT", "20-Proverbs", "Proverbs", "Pro", "Pr"),
    (21, "OT", "21-Ecclesiastes", "Ecclesiastes", "Ecc", "Ec"),
    (22, "OT", "22-Song-of-Solomon", "Song of Solomon", "Son", "So"),
    (23, "OT", "23-Isaiah", "Isaiah", "Isa", "Is"),
    (24, "OT", "24-Jeremiah", "Jeremiah", "Jer", "Je"),
    (25, "OT", "25-Lamentations", "Lamentations", "Lam", "La"),
    (26, "OT", "26-Ezekiel", "Ezekiel", "Eze", "Ez"),
    (27, "OT", "27-Daniel", "Daniel", "Dan", "Da"),
    (28, "OT", "28-Hosea", "Hosea", "Hos", "Ho"),
    (29, "OT", "29-Joel", "Joel", "Joe", "Jl"),
    (30, "OT", "30-Amos", "Amos", "Amo", "Am"),
    (31, "OT", "31-Obadiah", "Obadiah", "Oba", "Ob"),
    (32, "OT", "32-Jonah", "Jonah", "Jon", "Jo"),
    (33, "OT", "33-Micah", "Micah", "Mic", "Mi"),
    (34, "OT", "34-Nahum", "Nahum", "Nah", "Na"),
    (35, "OT", "35-Habakkuk", "Habakkuk", "Hab", "Hb"),
    (36, "OT", "36-Zephaniah", "Zephaniah", "Zep", "Zp"),
    (37, "OT", "37-Haggai", "Haggai", "Hag", "Hg"),
    (38, "OT", "38-Zechariah", "Zechariah", "Zec", "Ze"),
    (39, "OT", "39-Malachi", "Malachi", "Mal", "Ma"),
    (40, "NT", "01-Matthew", "Matthew", "Mat", "Mt"),
    (41, "NT", "02-Mark", "Mark", "Mar", "Mk"),
    (42, "NT", "03-Luke", "Luke", "Luk", "Lk"),
    (43, "NT", "04-John", "John", "Joh", "Jn"),
    (44, "NT", "05-Acts", "Acts", "Act", "Ac"),
    (45, "NT", "06-Romans", "Romans", "Rom", "Ro"),
    (46, "NT", "07-1-Corinthians", "1 Corinthians", "1Co", "1Co"),
    (47, "NT", "08-2-Corinthians", "2 Corinthians", "2Co", "2Co"),
    (48, "NT", "09-Galatians", "Galatians", "Gal", "Ga"),
    (49, "NT", "10-Ephesians", "Ephesians", "Eph", "Ep"),
    (50, "NT", "11-Philippians", "Philippians", "Phi", "Ph"),
    (51, "NT", "12-Colossians", "Colossians", "Col", "Cl"),
    (52, "NT", "13-1-Thessalonians", "1 Thessalonians", "1Th", "1Th"),
    (53, "NT", "14-2-Thessalonians", "2 Thessalonians", "2Th", "2Th"),
    (54, "NT", "15-1-Timothy", "1 Timothy", "1Ti", "1Ti"),
    (55, "NT", "16-2-Timothy", "2 Timothy", "2Ti", "2Ti"),
    (56, "NT", "17-Titus", "Titus", "Tit", "Ti"),
    (57, "NT", "18-Philemon", "Philemon", "Phm", "Pm"),
    (58, "NT", "19-Hebrews", "Hebrews", "Heb", "He"),
    (59, "NT", "20-James", "James", "Jam", "Ja"),
    (60, "NT", "21-1-Peter", "1 Peter", "1Pe", "1Pe"),
    (61, "NT", "22-2-Peter", "2 Peter", "2Pe", "2Pe"),
    (62, "NT", "23-1-John", "1 John", "1Jo", "1Jo"),
    (63, "NT", "24-2-John", "2 John", "2Jo", "2Jo"),
    (64, "NT", "25-3-John", "3 John", "3Jo", "3Jo"),
    (65, "NT", "26-Jude", "Jude", "Jud", "Jd"),
    (66, "NT", "27-Revelation", "Revelation", "Rev", "Re"),
]

BOOK_BY_ID = {b[0]: b for b in BOOKS}


def clean_scripture(raw: str) -> str:
    """Strip e-Sword RTF-ish markup and normalize whitespace."""
    text = raw.replace("\r", " ").replace("\n", " ")

    # Italic supplied words -> [word] (matches KJV BLB bracket convention)
    text = re.sub(r"\{\\i\s+([^}]+)\}", r"[\1]", text)

    # Bold section headings (e.g. Psalm superscriptions) -> plain with em dash prefix
    text = re.sub(r"\{\\b\s+([^}]+)\}", r"— \1 —", text)

    # Color/format wrappers used by some modules (e.g. RVG10 {\cf6 ...})
    text = re.sub(r"\{\\cf\d+\s*([^}]*)\}", r"\1", text)

    # Generic RTF groups with plain inner text (unwrap, keep content)
    text = re.sub(r"\{\\[a-zA-Z]+\d*\s*([^}]*)\}", r"\1", text)

    # Remove any remaining RTF groups
    text = re.sub(r"\{[^}]*\}", "", text)

    # RTF control words (e.g. \par, \tab)
    text = re.sub(r"\\[a-zA-Z]+\d*", " ", text)

    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def load_verses(bblx_path: Path) -> list[tuple[int, int, int, str]]:
    conn = sqlite3.connect(bblx_path)
    cur = conn.cursor()
    cur.execute(
        "SELECT Book, Chapter, Verse, Scripture FROM Bible ORDER BY Book, Chapter, Verse"
    )
    rows = [(b, c, v, clean_scripture(s)) for b, c, v, s in cur.fetchall()]
    conn.close()
    return rows


def write_blb_markdown(
    verses: list[tuple[int, int, int, str]], output_dir: Path
) -> int:
    """Write chapter markdown files; returns file count."""
    grouped: dict[tuple[int, int], list[tuple[int, str]]] = defaultdict(list)
    for book_id, chapter, verse, text in verses:
        grouped[(book_id, chapter)].append((verse, text))

    file_count = 0
    for (book_id, chapter), vlist in sorted(grouped.items()):
        meta = BOOK_BY_ID[book_id]
        testament, folder, english_name, abbr, anchor = meta[1], meta[2], meta[3], meta[4], meta[5]
        book_slug = folder.split("-", 1)[1]
        book_dir = output_dir / testament / folder
        book_dir.mkdir(parents=True, exist_ok=True)

        chapter_file = book_dir / f"{book_slug}-Chapter-{chapter:02d}.md"
        lines: list[str] = []
        for verse_num, text in sorted(vlist, key=lambda x: x[0]):
            lines.append(
                f"{abbr} {chapter}:{verse_num}  {text} ^{anchor}{chapter}-{verse_num}"
            )
            lines.append("")
            lines.append("---")
            lines.append("")

        chapter_file.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
        file_count += 1

    return file_count


def write_tarsus_json(
    verses: list[tuple[int, int, int, str]], output_path: Path
) -> dict[str, int]:
    """Write bible.json structure for Tarsus API."""
    bible: dict[str, list[dict]] = defaultdict(list)
    for book_id, chapter, verse, text in verses:
        meta = BOOK_BY_ID[book_id]
        english_name = meta[3]
        bible[english_name].append(
            {
                "ref": f"{english_name} {chapter}:{verse}",
                "book": english_name,
                "chapter": chapter,
                "verse": verse,
                "text": text,
            }
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as fh:
        json.dump(dict(bible), fh, ensure_ascii=False, indent=2)

    return {"books": len(bible), "verses": len(verses)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert e-Sword .bblx to BLB + JSON")
    parser.add_argument(
        "--bblx",
        type=Path,
        default=Path(__file__).parent / "RV1602P.bblx",
        help="Path to .bblx SQLite file",
    )
    parser.add_argument(
        "--blb-out",
        type=Path,
        default=Path(r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\rv1602p-bible-blb"),
        help="Output directory for BLB markdown chapters",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "src" / "data" / "bible-rv1602p.json",
        help="Output path for Tarsus JSON bible",
    )
    args = parser.parse_args()

    if not args.bblx.exists():
        raise SystemExit(f"BBLX file not found: {args.bblx}")

    print(f"Reading {args.bblx} ...")
    verses = load_verses(args.bblx)
    print(f"Loaded {len(verses)} verses")

    md_count = write_blb_markdown(verses, args.blb_out)
    print(f"Wrote {md_count} chapter markdown files to {args.blb_out}")

    stats = write_tarsus_json(verses, args.json_out)
    print(f"Wrote JSON ({stats['books']} books, {stats['verses']} verses) to {args.json_out}")


if __name__ == "__main__":
    main()
