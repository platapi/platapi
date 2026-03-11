# Development notes

## Heavy command behavior

`platapi build` and `platapi generate:docs` now have a few built-in memory and debugging helpers for local development and CI:

- on Node 22+, PlatAPI automatically applies a `4096MB` heap limit for these heavy commands unless one is already set
- `--max-old-space-size <mb>` overrides the heap limit for a single command
- `PLATAPI_MAX_OLD_SPACE_SIZE=<mb>` sets the default heap limit for heavy commands
- `PLATAPI_NODE_OPTIONS="..."` passes extra Node flags through to the respawned process
- `PLATAPI_DEBUG_MEMORY=1` logs phase-level RSS / heap usage during build and docs generation

Examples:

```bash
platapi build --max-old-space-size 6144
PLATAPI_MAX_OLD_SPACE_SIZE=6144 platapi generate:docs
PLATAPI_NODE_OPTIONS="--trace-gc" platapi build
PLATAPI_DEBUG_MEMORY=1 platapi generate:docs
```

## Memory-focused test workflow

Use this when changing the heavy build/docs paths:

```bash
yarn test:build-docs
```

That test will:

- generate a synthetic large API fixture under `./.tmp/large-api`
- run `generate:docs` against it and log max RSS
- run `build --no-minify` against it and log max RSS
- clean up generated fixture/build output when finished

This gives a single-command regression check for the most memory-sensitive PlatAPI paths.

## Relevant files

- `scripts/platapi.ts` - heavy-command respawn and heap handling
- `scripts/build.ts` - Rollup build path and transpile-only TypeScript transform
- `src/docgen/DocGenerator.ts` - docs generation, ts-morph usage, and schema generation reuse
- `tests/BuildDocsIntegration.test.ts` - synthetic build/docs integration coverage with RSS logging
- `docs/memory-investigation.md` - investigation notes and current before/after measurements
