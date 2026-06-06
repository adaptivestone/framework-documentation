# Anti-patterns

Common mistakes when working with the framework, and what to do instead. Most of them map to a feature that already solves the problem — reach for the seam, not the workaround.

## Don't hand-edit `.routes.gen.ts`

❌ Editing a generated `<File>.routes.gen.ts` file.
✅ Edit the `routes` getter / `request:` schema, then run `npm run gen`.

Gen files are overwritten on every `npm run gen` (and every `check:types`) — your edits vanish. They're derived from the `routes` getter and the resolved middleware chain, and they're gitignored for that reason. Change the source and regenerate. See [When to run codegen](10-cli.md#when-to-run-codegen).

## Don't `new` a middleware yourself

❌ `middleware: [new Pagination(app, { limit: 20 })]`
✅ `middleware: [[Pagination, { limit: 20 }]]`

Declare middleware as a class, or a `[Class, params]` tuple. The framework instantiates and caches them for you, and reads their static metadata (`provides`, schemas) **without** constructing them. A manual `new` runs constructor side effects at the wrong time and bypasses that caching. See [Middleware](06-Controllers/03-middleware.md).

## Don't mutate `req.body` to "validate"

❌ Reading and normalizing `req.body` by hand inside the handler.
✅ Declare a `request:` (or `query:`) schema; read the validated, cast result from `req.appInfo.request`.

The route schemas validate and coerce before the handler runs, produce a typed `req.appInfo.request` / `req.appInfo.query`, strip unknown keys, and feed codegen (and later OpenAPI). Hand-rolled parsing in the handler gets none of that. See [Validation](06-Controllers/02-routes.md#validation).

## Don't put state in the `routes` getter

❌ A `routes` getter that reads `this.something` assigned in the constructor.
✅ Keep `routes` declarative — list handler methods and inline schemas only.

`npm run gen` reads `routes` through a constructor-free "ghost", so type generation stays free of constructor side effects. If `routes` touches constructor state, codegen falls back to constructing the controller and warns once per class (`ASF_DEP_CTOR_ROUTES`) — and that fallback is removed in v6. Move the state into handlers or a module-level constant. See [Keep `routes` declarative](06-Controllers/02-routes.md#keep-routes-declarative-codegen-reads-it-without-your-constructor).

## Don't reach into raw Express when `req.appInfo` already has it

❌ Re-parsing cookies, re-loading the user, or recomputing pagination in every handler.
✅ Read what middleware already put on `req.appInfo` — `user`, `request`, `query`, `pagination`, `i18n`, plus any field your own middleware declares via `provides`.

`req.appInfo` is the framework's typed request context. Middleware populates it once; handlers and codegen consume it. Reaching around it duplicates work and loses the types. See [Middleware-provided types](06-Controllers/02-routes.md#middleware-provided-types).

## Don't monkey-patch the framework — report it

❌ Copy-pasting a framework file to tweak it, overriding internals to route around a bug, or shimming a private method.
✅ Open an issue at [github.com/adaptivestone/framework/issues](https://github.com/adaptivestone/framework/issues) with a minimal repro.

Local workarounds rot, hide the bug from everyone else, and break on the next update. The framework is built to be extended through supported seams — [file inheritance](03-files-inheritance.md), middleware, `provides`, and config — not patched. If the seam you need is missing, that's worth an issue too.
