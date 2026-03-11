# Release notes

## 1.3.0

- reduce memory usage in `platapi build` by switching the runtime build path to a lighter transpile-only TypeScript flow
- reduce memory usage in `platapi generate:docs` by reusing one schema generator and limiting `ts-morph` to the discovered route files
- add built-in heap support for heavy commands on Node 22+ with `--max-old-space-size`, `PLATAPI_MAX_OLD_SPACE_SIZE`, and `PLATAPI_NODE_OPTIONS`
- add `PLATAPI_DEBUG_MEMORY=1` for phase-level memory logging during heavy commands
- add `yarn test:build-docs` to run a single synthetic integration test that logs RSS for docs generation and build
- remove Husky from the publish path so publishing only depends on the package build itself
