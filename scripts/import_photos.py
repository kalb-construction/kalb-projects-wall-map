#!/usr/bin/env python3
"""
Import project photographs and wire them into the wall map.

    python3 scripts/import_photos.py <inbox-dir> [--write]

`inbox-dir` holds one subfolder per project, named by Kalb job number:

    inbox/
        26102/ IMG_7110.jpg IMG_7109.jpg ...
        26104/ ...
        blak-cheyenne-warehouse/ ...        # ids work too, for BLAK

For each folder it optimises the images into public/renders/<id>/ and sets
`photos[]` on the matching project in public/data/projects.json.

Why a script and not by hand: photos arrive in batches of 28, they arrive
again whenever a job progresses, and the wall's smoothness depends on them
being consistently sized. Doing that by eye 28 times invites one 6 MB
original slipping through and stalling a crossfade on the lobby display.

Dry run by default. Nothing is written without --write.
"""
import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data" / "projects.json"
RENDERS = ROOT / "public" / "renders"

# 1500 px on the long edge is ample for a 1080p wall and keeps a project's
# whole set under ~1.5 MB, so a crossfade never waits on a decode.
MAX_EDGE = 1500
QUALITY = 82
# A curated handful reads better on a wall than an exhaustive album, and
# keeps the attract loop moving.
MAX_PER_PROJECT = 6
EXTS = {".jpg", ".jpeg", ".png", ".heic", ".webp"}


def optimise(src: Path, dst: Path) -> int:
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    return dst.stat().st_size


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    write = "--write" in sys.argv
    if not args:
        sys.exit(__doc__)
    inbox = Path(args[0]).resolve()
    if not inbox.is_dir():
        sys.exit(f"not a directory: {inbox}")

    projects = json.loads(DATA.read_text())
    # Match on id first, then job number — BLAK rows use slug ids.
    by_key = {}
    for p in projects:
        by_key[str(p["id"]).lower()] = p
        by_key.setdefault(str(p["number"]).lower(), p)

    total_bytes = 0
    touched, missing = [], []

    for folder in sorted(inbox.iterdir()):
        if not folder.is_dir():
            continue
        key = folder.name.strip().lower()
        project = by_key.get(key)
        if project is None:
            missing.append(folder.name)
            continue

        shots = sorted(f for f in folder.iterdir() if f.suffix.lower() in EXTS)
        if not shots:
            missing.append(f"{folder.name} (no images)")
            continue
        kept = shots[:MAX_PER_PROJECT]

        rel = []
        for n, src in enumerate(kept, start=1):
            out = RENDERS / project["id"] / f"{project['id']}-{n}.jpg"
            rel.append(f"./renders/{project['id']}/{out.name}")
            if write:
                total_bytes += optimise(src, out)

        if write:
            project["photos"] = rel
        touched.append(
            f"  {project['id']:<24} {project['name'][:38]:<40} "
            f"{len(kept)}/{len(shots)} photos"
        )

    print(f"\nInbox: {inbox}")
    print(f"Matched {len(touched)} project(s):")
    print("\n".join(touched) if touched else "  (none)")
    if missing:
        print(f"\nNo matching project for {len(missing)} folder(s):")
        for m in missing:
            print(f"  {m}")
        print("  ^ folder names must be a job number (26102) or an id.")

    if not write:
        print("\nDry run — nothing written. Re-run with --write.")
        return 0

    DATA.write_text(json.dumps(projects, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {total_bytes / 1_048_576:.1f} MB into {RENDERS}")
    print(f"Updated {DATA}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
