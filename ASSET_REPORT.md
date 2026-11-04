# Asset library audit

**Audit date:** 2026-11-04

**Integrated third-party assets:** 0

**Packages downloaded:** 0

**Packages approved for production:** 0

## Findings

- GitHub API access was available for `Tiddybub/2d-assets`. Repository metadata reported the `main` branch, approximately **1,091,130 KB** of repository data, and repository license metadata `NOASSERTION`. Its README describes 1,101 packs as CC0 and says each pack contains a `SOURCE.md` with the author, license, and source page. This is recorded as an upstream claim, not blanket clearance: no asset files were downloaded, and each candidate's `SOURCE.md` plus original source still requires review.
- The full Tiddybub repository was deliberately not cloned. It is about 1.09 GB, mostly far beyond the needs of the first region, and the user's instruction is to assess candidates before downloading large libraries.
- The itch.io and Kenney hosts are not in the outbound-host allowlist for this workspace. Attempts to reach the supplied itch.io and kenney.nl pages failed at the network layer. Those packages were not downloaded and their current terms were not independently verified. Other user-listed sources are catalogued as pending under the same no-assumption policy.
- No sprites, audio, fonts, or generated stand-ins have been placed in `public/assets/`. The manifest remains empty until a real package is reviewed and selected.

## Catalog files

- `asset-catalog.json` — machine-readable approved asset records; currently empty.
- `asset-manifest.json` — intended runtime allowlist and region groups; currently empty.
- `asset-licenses.json` — source-level access and license audit, including pending items and the Tiddybub repository metadata.
- `asset-library/README.md` — staging rules and directory convention.

## Next asset pass

1. Manually provide a small candidate archive (preferably a town/isometric environment and one compatible character/enemy set) or enable network access to the creator's package page.
2. Preserve the original archive and its license/source files under `asset-library/originals/` (the directory is git-ignored by default so large originals are not committed).
3. Audit the exact package version, author, license, attribution and redistribution terms; do not infer a package license from price or the library name.
4. Record perspective, tile/frame dimensions, pivot, directions, animation and palette; create a preview and only copy approved runtime files into `public/assets/`.
5. Keep the world renderer's logical and visual coordinates separate. The PtDesigns 256x128 geometry described in the project brief must not be mixed as though it were a 16x16 top-down tileset.

No inaccessible download is represented as obtained or cleared.
