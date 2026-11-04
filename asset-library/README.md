# Asset staging library

This folder is for source archives, extracted working copies, license records and review previews. It is not a runtime asset dump.

## Rules

1. Record the package, exact author/source URL, version/date, individual license, attribution and redistribution restrictions in `../asset-licenses.json` before use.
2. Preserve source archives and `LICENSE`/`SOURCE.md` files in `originals/` when rights allow. Downloads, extracted files and originals are git-ignored by default to avoid committing large or unreviewed archives.
3. Do not add assets to `public/assets/` or `asset-manifest.json` until the package has passed license and visual-compatibility review.
4. Catalog perspective, pixel/frame dimensions, grid size, anchor/pivot, transparency, directions and animations; never infer interchangeable character layers from unrelated sprites.
5. Keep previews in `previews/`, review notes in `ASSET_REPORT.md`, and only approved runtime files in `public/assets/`.

The folders currently contain no downloaded or approved third-party material.
