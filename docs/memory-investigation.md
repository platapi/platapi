# PlatAPI memory investigation

## What was growing

- `generate:docs` retained large TypeScript/AST/schema state because it used a process-wide `ts-morph` project and called `typescript-json-schema` once per type via `generateSchema`, which rebuilds schema state repeatedly.
- `build` used Rollup's TypeScript plugin to create a full TypeScript program for the project being bundled. On larger APIs that means holding a large graph of source files, declarations, and diagnostics in memory before Rollup even writes the bundle.
- Minification is still a measurable extra cost during `build`, but the TypeScript program lifecycle was the bigger structural issue in PlatAPI itself.

## Changes made

- `src/docgen/DocGenerator.ts`
  - create a per-run `ts-morph` project instead of a shared global project
  - only add route source files from the active API project
  - build a single `typescript-json-schema` generator and cache schemas by type name
  - delete the temporary schema source file after generation
- `scripts/build.ts`
  - replace `@rollup/plugin-typescript` in the runtime build path with a lightweight transpile-only Rollup plugin backed by `typescript.transpileModule`
  - keep minification optional via `--no-minify`
  - suppress noisy `THIS_IS_UNDEFINED` Rollup warnings
- `scripts/platapi.ts`
  - heavy commands (`build`, `generate:docs`) now respawn through `tsx` with an internal heap setting on Node 22+
  - add `--max-old-space-size <mb>` and `PLATAPI_MAX_OLD_SPACE_SIZE`
  - add `PLATAPI_NODE_OPTIONS` passthrough
- tooling
  - upgraded the packages directly used by `build` / `generate:docs`, including `rollup`, the Rollup plugins, `tsx`, `commander`, `fs-extra`, `lodash`, `ts-morph`, `typescript-json-schema`, and `openapi3-ts`
  - added `yarn test:build-docs` so the synthetic build/docs verification and RSS logging can be collected in one command

## Dependency inventory

Packages directly on the `build` / `generate:docs` path after the refresh:

- CLI/runtime: `commander`, `tsx`, `fs-extra`, `lodash`
- build path: `rollup`, `@rollup/plugin-commonjs`, `@rollup/plugin-json`, `@rollup/plugin-node-resolve`, `@rollup/plugin-terser`, `@optimize-lodash/rollup-plugin`, `typescript`, `tslib`
- docs path: `ts-morph`, `typescript-json-schema`, `openapi3-ts`

`ts-morph` is used heavily in docs generation, not in the Rollup build path. The build command no longer uses the Rollup TypeScript plugin or a full `ts-morph` project.

I also reviewed the current `ts-morph` and `typescript-json-schema` docs while tuning this. The best-performing setup here was still: load only the discovered route files into a single `ts-morph` project, reuse one schema generator, and avoid extra project churn that looked appealing in theory but increased peak RSS on the real repo.

## Memory measurements

Synthetic repro project: `./.tmp/large-api` with 180 generated routes and nested response/body types. Generate it with `node ./scripts/generate-memory-fixture.js`.

| Command | Before | After | Delta | Notes |
| --- | ---: | ---: | ---: | --- |
| `platapi generate:docs` | 463872 KB | 379548 KB | -84324 KB (-18.2%) | peak RSS from `yarn test:build-docs` on the synthetic repro |
| `platapi build` | 1130640 KB | 227504 KB | -903136 KB (-79.9%) | peak RSS on the synthetic repro after latest dependency upgrades |
| `platapi build --no-minify` | 818604 KB | 169432 KB | -649172 KB (-79.3%) | lowest-memory build path measured |

Phase-level heap logs from `PLATAPI_DEBUG_MEMORY=1` on the synthetic repro showed:

- docs growth now happens mainly when the schema program is built (`docs:after-schema-program` around 366 MB RSS)
- build stays small until Rollup bundling begins; the expensive phase is still bundle generation/write, not route discovery or server file generation

## Real-project verification

Using `../spot-api` as a local repro target:

- `generate:docs` now completes on Node 22 without an external `node --max-old-space-size=4096` wrapper
  - peak RSS improved from `874364 KB` to `748524 KB` (`-125840 KB`, about `-14.4%`) on the local `../spot-api` checkout while still completing successfully without the external heap wrapper
- `build` no longer fails early on old-TypeScript syntax parsing, but the current `spot-api` checkout still has an unrelated Rollup error:
  - `"EpayCreateDirectDepositFields" is not exported by "src/types/Claim.ts"`

That means the memory fix is in place, but this specific local `spot-api` checkout still needs that import/export issue resolved before build can complete end-to-end.

## How to verify

From this repo:

```bash
yarn build
yarn test --runInBand
yarn test:build-docs
node ./scripts/generate-memory-fixture.js
/usr/bin/time -v node_modules/.bin/tsx ./scripts/platapi.ts build -c ./.tmp/large-api/api.config.js
/usr/bin/time -v node_modules/.bin/tsx ./scripts/generate-docs.ts -c ./.tmp/large-api/api.config.js -o ./.tmp/large-api/docs.json
```

From `../spot-api`:

```bash
/usr/bin/time -v ../platapi/node_modules/.bin/tsx ../platapi/scripts/platapi.ts generate:docs -c ./api.config.js -o /tmp/spot-api-openapi.json
/usr/bin/time -v ../platapi/node_modules/.bin/tsx ../platapi/scripts/platapi.ts build -c ./api.config.js
```

If you want to tune the heap explicitly without wrapping the command yourself:

```bash
platapi build --max-old-space-size 6144
PLATAPI_MAX_OLD_SPACE_SIZE=6144 platapi generate:docs
PLATAPI_NODE_OPTIONS="--trace-gc" platapi build
```
