# Staging workflow (DataSSD1 TCC)

When agents cannot touch `.git` on `/Volumes/DataSSD1`:

1. Pull latest overlay: `bash ~/periscan-staging/scripts/pull-from-datassd1.sh`
2. Edit under `~/periscan-staging/`
3. Push: `bash ~/periscan-staging/scripts/sync-staging-to-datassd1.sh`
4. Commit from a machine/shell that can access the volume git (or `git -C /Volumes/DataSSD1/test/periscan` outside sandbox)

Lab demo: see `docs/DEMO_LAB_SITE.md`. Teardown: `pnpm lab:stop`.
