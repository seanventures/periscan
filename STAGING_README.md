# Periscan local staging (TCC-safe)

macOS sometimes blocks agents from reading `.git` on `/Volumes/DataSSD1`.  
**Edit here first, then sync to the volume checkout.**

| Path | Role |
|------|------|
| `~/periscan-staging` | Local disk staging (this tree — **partial** overlay of changed files) |
| `/Volumes/DataSSD1/test/periscan` | Canonical full checkout |

## Sync commands

```bash
# Local → DataSSD1 (after editing staging)
bash ~/periscan-staging/scripts/sync-staging-to-datassd1.sh

# DataSSD1 → local (refresh staging from volume before edit)
bash ~/periscan-staging/scripts/pull-from-datassd1.sh
```

## Lab demo (run from DataSSD1 checkout)

```bash
cd /Volumes/DataSSD1/test/periscan
pnpm lab:up
pnpm lab:dev
pnpm lab:demo-up
pnpm lab:stop
```

## Do not

- Treat staging as a full clone (no full `node_modules` / `.git` here by default)
- Invent scorecard 5.0 / 95 without Slice E rescore
