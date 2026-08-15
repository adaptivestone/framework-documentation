# Image Resizing

Image resizing for the framework, shipped as a separate package: [@adaptivestone/framework-module-resize](https://www.npmjs.com/package/@adaptivestone/framework-module-resize). Upload only the **original**; generate resized variants with [`sharp`](https://sharp.pixelplumbing.com).

It runs in two shapes. **Eager** generates variants inline at upload and needs nothing but storage — no queue, no worker, no extra model. **Lazy** defers generation to a background worker, so uploads stay fast and only the sizes actually requested get built. Both drive the same resize core and write the same `previews[]` shape, so you can start eager and switch later with no data migration.

Everything the module touches — queue transport, storage, media store, lock provider — is a **swappable driver** wired in one constructor literal.

## Installation

```bash
npm i @adaptivestone/framework-module-resize
```

Requires Node `>=24` and the framework/mongoose peers (mandatory). The AWS SDKs are **optional peers** — install only the driver you use. Each is resolved **only** when you import its driver subpath, so the main entry never loads the AWS SDKs, and a missing peer fails loudly at your own import line at bootstrap, not at first I/O.

| You use… | Also install |
|---|---|
| **Local filesystem storage** (`/storage/fs.js`) | nothing |
| **S3 storage** (`/storage/s3.js`) | `@aws-sdk/client-s3` `@aws-sdk/s3-request-presigner` |
| **SQS transport** (`/transports/sqs.js`) | `@aws-sdk/client-sqs` `sqs-consumer` |
| Mongo transport / framework media store / framework locks | nothing |

## Quick start (eager + local filesystem)

The smallest thing that works. No queue, no worker, no `ResizeTask` model — just storage and your media model.

**1. Construct the Resizer** after `Server.init()` (or lazily on first request — never in `src/server.ts` before `startServer()`):

```ts
import { Resizer } from '@adaptivestone/framework-module-resize';
import { LocalFsStorage } from '@adaptivestone/framework-module-resize/storage/fs.js';

export const resizer = new Resizer({
  storage: new LocalFsStorage({
    rootDir: './var/media',      // files land here
    publicBaseUrl: '/media',     // URL prefix for publicUrl()
  }),
});
```

`storage` is the one **required** option — both the read path (`publicUrl`) and generation (`download`/`upload`) need it. Omitting it throws a `ResizeSetupError` at construction rather than a confusing `TypeError` later.

**2. Set your media model name** in `src/config/resize.ts` — the one required config field:

```ts
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';

export default {
  ...defaultResizeConfig,
  mediaModelName: 'File', // your host media model, e.g. 'File' or 'Media'
};
```

**3. Generate at upload**, and **read** wherever you build a DTO:

```ts
// upload handler — after media.original is stored
const { created, failed } = await resizer.generate({
  media: fileDoc,
  sizes: [{ width: 320, height: 320 }, { fit: true }],
});

// read path
const { decision } = await resizer.resolve({
  media: fileDoc,
  sizes: [{ width: 320, height: 320 }, { fit: true }],
});
```

That is a complete working setup. `LocalFsStorage` is also the right answer for tests and CI — no AWS, no mocks.

### Scaffold the integration files

The framework discovers models and commands by scanning your `src/` folder, so a few thin files must live in your app:

```bash
npx @adaptivestone/framework-module-resize resize-scaffold --eager
```

`--eager` emits the filesystem-storage construction site and skips the queue files entirely. Drop the flag to get the full lazy set. Files land in `process.cwd()` (or `--out <dir>`) and are **never overwritten** without `--force`:

| File | What it is | Eager |
|---|---|---|
| `src/resizer.ts` | the construction site — `new Resizer({ … })` | ✅ |
| `src/config/resize.ts` | editable config that spreads the module defaults | ✅ |
| `src/models/ResizeTask.ts` | thin `class ResizeTask extends ResizeTaskModel {}` shim | lazy only |
| `src/commands/ResizeWorker.ts` | one-line re-export of the module's worker command | lazy only |

The shims are **not vendored copies** — schema and behavior stay in the npm package (auto-updates, no drift). Other flags: `--check` (CI drift check), `--eject` (full editable model), `--force`, `--out <dir>`.

### The media schema

Your media model must carry `original` (incl. `width`/`height`) and `previews[]` (incl. `filters`/`fit`). That schema is host-owned; to avoid drift the module exports an **opt-in** `as const` fragment you can spread in:

```ts
import { resizeMediaSchemaFragment } from '@adaptivestone/framework-module-resize';

class File extends BaseModel {
  static get modelSchema() { return { ...existingFields, ...resizeMediaSchemaFragment } as const; }
}
```

## How it works

```
upload ─▶ store the ORIGINAL only (no previews baked in)
       ─▶ eager: generate() now  ·  lazy: nothing  ·  pre-warm: enqueue the catalog
  read ─▶ resolve({ media, sizes }) ─┬─ ready?   → return the URL now
                                     └─ missing? → (lazy) enqueue + return a placeholder
worker ─▶ download original → beforeSteps → per-variant resize + variantSteps + encode → upload
       ─▶ append preview to the media doc
```

Generated **previews** live as metadata on the host's media document (`previews[]`) — the source of truth for what is ready. `resolve()` returns a **decision** (`ready[]` + `missing[]`) and never blocks on `sharp`, which keeps image work off your HTTP handlers.

## When listings are huge (lazy / queue)

Once a catalog is large enough that generating everything at upload is wasteful, move generation to a worker. Same core, same stored shape — you add a transport, a worker process, and (for Mongo) the `ResizeTask` model.

**1. Add a transport and storage** to the constructor:

```ts
// src/resizer.ts — imported by src/server.ts so it runs in EVERY process (API + worker)
import { Resizer } from '@adaptivestone/framework-module-resize';
import { MongoTransport } from '@adaptivestone/framework-module-resize/transports/mongo.js';
import { S3Storage } from '@adaptivestone/framework-module-resize/storage/s3.js';

export const resizer = new Resizer({
  transport: new MongoTransport(),           // or new SqsTransport({ queueUrl, region })
  storage: new S3Storage({
    bucketPublic: 'my-cdn',
    bucketPrivate: 'my-originals',
    publicBaseUrl: 'https://cdn.example.com',
  }),
  // mediaStore / lockProvider omitted → framework-backed defaults
  pipelines: {
    default: {},
    listing: { beforeSteps: [blurPlates] },  // async detector, applied once to the source
  },
  hooks: {
    resolveSizes:     (sizes, ctx) => ctx.entity === 'event' ? [...sizes, { fit: true }] : sizes,
    formatPublicUrls: (decision, ctx) => toHostDto(decision, ctx),   // your response shape
  },
});
```

:::warning Use `publicBaseUrl`, not `publicUrl`

The S3 option is **`publicBaseUrl`**. The old `publicUrl` name still works for one minor but is deprecated — it collides with the `publicUrl(ref)` *method* every storage driver implements, which silently breaks anyone who copies the option literal into a class.

:::

**2. Import it once from `src/server.ts`** so it runs in both the API and worker processes:

```ts
import './resizer.ts';
```

**3. Run the worker** as a separate process (gated by `worker.enabled`):

```bash
npm run cli ResizeWorker
```

**4. Read** from your DTO builders. No `app` argument — the module reads the ambient app instance. `resolve` returns both the raw `decision` and the `output` of your `formatPublicUrls` hook:

```ts
import { resizer } from '../resizer.ts';   // or: getResizer()

const { output } = await resizer.resolve({
  media: fileDoc,
  pipeline: 'listing',
  sizes: [
    { width: 1760, height: 990 },
    { width: 620 },
    { fit: true },
    { width: 300, height: 300, filters: { blur: 40 } },
  ],
  ctx: { entity: 'event', isOwner },
});
return output;
```

:::note `output` is `undefined` without a hook

If you registered no `formatPublicUrls` tap — or every tap threw — `output` is `undefined`, **not** the raw decision. The module will never hand `{ ready, missing }` to your frontend as if it were a DTO. Read `decision` yourself, or use `formatPictureUrls` below.

:::

`resolve` enqueues missing variants only when a transport exists: **`enqueueMissing` defaults to `true` with a transport and `false` without one**, so an eager-only host never enqueues-or-logs on every read. Pass it explicitly to override per call:

```ts
await resizer.resolve({ media, sizes, enqueueMissing: false });  // read-only; never queue
```

## Modes: eager vs pre-warm vs lazy

All three drive the **same resize core** and write the same `previews[]` shape, so you can switch later with no data migration, or mix them.

| | **Eager** | **Pre-warm** | **Lazy** |
|---|---|---|---|
| Generate | inline at upload via `generate()` | at upload; `prewarm()` enqueues the catalog | on first read; `resolve()` enqueues missing |
| Needs | storage + media model only — **no** queue/worker | transport + `ResizeWorker` + `ResizeTask` + locks | same as pre-warm |
| Best for | low/bursty volume, small fully-used catalogs | fast uploads **and** a warm cache by first read | high volume, large catalogs, fast uploads |

:::tip Start eager

Eager is a complete, first-class mode — not a toy. Reach for the queue when your catalogs get big enough that building every size at upload wastes real work. The stored shape is identical either way.

:::

**Pre-warm** keeps the lazy wiring but pushes the catalog into the queue at upload, so previews are usually ready by the first read. It never blocks and never throws — with no transport it logs once and returns `{ enqueued: 0 }`:

```ts
await resizer.prewarm({ media: fileDoc, sizes: getListingSizes(), pipeline: 'listing' });
// → { enqueued } = how many variants were handed to the queue
```

**Eager** generates synchronously (and `ctx` reaches pipeline steps here, unlike the queued worker):

```ts
const { created, failed } = await resizer.generate({
  media: fileDoc,
  sizes: getEventMediaSizes(),
  pipeline: 'listing',
  // persist: true (default) → $push previews + backfill dims; false → returns them for you to store
});
```

### Reading the `generate` result

`created` is **only what this call made** — not the full set on the document. A second `generate` with the same catalog returns `{ created: [], failed: 0 }` because everything already exists. Treat an empty `created` as *"nothing new was needed"*, never as failure:

| Case | Result |
|---|---|
| Every requested variant already stored | `{ created: [], failed: 0 }` — success |
| SVG original (pass-through, never rasterized) | `{ created: [], failed: 0 }` — success |
| Some variants failed | no throw; `failed > 0`, `created` holds the rest |
| No `media.original` | throws `ResizeNoOriginalError` |
| Every requested variant failed | throws `ResizeGenerateError` |

## Errors

Every error the module throws extends **`ResizeError`**, so one check separates "the resize module rejected this" from a `sharp` crash or an S3 timeout. The subclass answers what to do about it:

| Class | What it means | What to do |
|---|---|---|
| `ResizeSetupError` | wiring/bootstrap is wrong | fix your code; retrying never helps |
| `ResizeConfigError` | host config invalid or violates an invariant | crash at boot |
| `ResizeMediaError` | this media record is unusable | skip it; don't retry |
| ` └ ResizeNoOriginalError` | `generate` called with no `original` | upload the source first |
| `ResizeGenerateError` | the operation produced nothing | inspect `failed` / `requested` |
| `ResizeStorageError` | transient storage I/O | a retry may help |
| `ResizeSecurityError` | a refusal (path traversal, cross-bucket) | never retry; log loudly |

```ts
import { ResizeError, ResizeNoOriginalError } from '@adaptivestone/framework-module-resize';

try {
  await resizer.generate({ media, sizes });
} catch (err) {
  if (err instanceof ResizeNoOriginalError) return badRequest('upload the image first');
  if (ResizeError.isResizeError(err)) return badRequest(err.message);   // any module rejection
  throw err;                                                            // not ours — let it bubble
}
```

Each error also carries a stable machine-readable `err.code` (`RESIZE_NO_ORIGINAL`, `RESIZE_FS_PATH_TRAVERSAL`, …) for logging and alerting.

:::note Prefer `isResizeError` over `instanceof` across package boundaries

If two copies of the package end up in one `node_modules` tree, the class identities differ and `instanceof` silently returns `false`. `ResizeError.isResizeError(err)` checks a registered symbol instead, so it keeps working.

:::

## Drivers & seams

Four seams, each a single active strategy fixed at construction. Two default to framework-backed drivers when omitted, so a standard host wires only `storage` (+ `transport` if lazy). Every driver lives behind its own package subpath, so the core entry never loads driver deps.

| Seam | Option | Shipped | Subpath import |
|---|---|---|---|
| Storage | `storage` **(required)** | `LocalFsStorage`, `S3Storage` | `…/storage/fs.js`, `…/storage/s3.js` |
| Queue transport | `transport?` | `MongoTransport`, `SqsTransport` | `…/transports/mongo.js`, `…/transports/sqs.js` |
| Media store | `mediaStore?` | `FrameworkMediaStore` (default) | `…/mediaStore/framework.js` |
| Lock provider | `lockProvider?` | `FrameworkLockProvider` (default) | `…/locks/framework.js` |

Reach the process-wide instance anywhere via `getResizer()` (throws a `ResizeSetupError` if none was constructed).

**Custom driver = implement the interface.** Any seam takes a plain object (or class) that satisfies its contract — no `app` parameter; it closes over its own client:

```ts
new Resizer({ /* … */, storage: {
  download: (ref) => s3.getObject(ref.bucket!, ref.key),
  upload: async ({ key, body, contentType, visibility }) => {
    const bucket = visibility === 'public' ? 'my-cdn' : 'my-originals';
    await s3.putObject(bucket, key, body, contentType);
    return { bucket, key };               // ← persisted onto the preview/original
  },
  publicUrl: (ref) => `https://cdn.example.com/${ref.key}`,   // pure; no I/O
  signedUrl: (ref, ttl) => s3.getSignedUrl(ref.bucket!, ref.key, ttl),
}});
```

Contract types (`ResizeStorage`, `QueueTransport`, `MediaStore`, `LockProvider`, …) are exported from the main entry. The shipped driver options are listed in the [README](https://github.com/adaptivestone/framework-module-resize#drivers--seams).

## Helpers

Small exports that save every host from rewriting the same glue:

```ts
import {
  formatPictureUrls, isCatalogCovered, resizeMediaPaths,
} from '@adaptivestone/framework-module-resize';
```

**`formatPictureUrls(decision, { id?, mediaType? })`** builds a generic `<picture>`-shaped map from a decision — a convenience, not a mandated DTO. Filtered variants are excluded; `sizeKey` stays whatever your identity already is:

```ts
{ mediaType?, id?, sizes: { [sizeKey]: { [format]: { url, contentType } } } }
```

**`isCatalogCovered(media, sizes, formats)`** returns `true` when every identity already exists (or the original is an SVG) — use it to skip a no-op `generate`/`prewarm`.

**`resizeMediaPaths`** is the `['original', 'previews'] as const` list of fields the module reads, for your `.select()`. Append your own:

```ts
File.find(query).select([...resizeMediaPaths, 'mediaType', 'name']).lean();
```

## Pipelines & hooks

**Pipelines** are named per-media-type pixel work, selected per read call by name. The worker runs in a separate process, so the task carries only the pipeline **name** — the worker resolves the functions from its own registry.

```ts
pipelines: {
  photo: {
    beforeSteps:  [detectAndBlurPlates, detectAndBlurFaces],  // run ONCE on the source, before any resize
    variantSteps: [(img, { variant }) => variant.filters?.blur ? img.blur(Number(variant.filters.blur)) : img],
  },
  avatar: {},                                                 // no special processing
}
// later / from another module: getResizer().registerPipeline('premium', { … })  (last-wins per name)
```

- **`beforeSteps`** — ordered, awaited, once per task on the source buffer. The home for detection metadata and pixel redaction (plate/face blur) that must apply to every variant. A throwing step fails the task.
- **`variantSteps`** — ordered per-variant chain, after resize, before encode. The home for keyed `filters` and anything sized relative to the output.

:::warning Watermark in variantSteps

Put a watermark in `variantSteps`, **not** `beforeSteps`. Baked onto the original once, a watermark scales down with each variant and becomes unreadable on small sizes.

:::

:::note ctx does NOT cross the queue

In the lazy worker `ctx === {}` — the task carries only `{ mediaId, pipeline, previews }`. Durable per-media data a step needs must be read from the loaded `media` doc. The full caller `ctx` reaches steps **only** in eager mode (`generate`, same process).

:::

**Hooks** are the cross-cutting seams. Taps run in registration order, awaited sequentially, and are error-isolated (a throwing tap is logged, never breaks the read/worker flow).

| Hook | Kind | Runs where |
|---|---|---|
| `resolveSizes` | waterfall | read path (real `ctx`) |
| `beforeEnqueue` | waterfall | read path (real `ctx`) |
| `formatPublicUrls` | waterfall | read path (real `ctx`) |
| `onPreviewGenerated` | observer | worker (`ctx === {}`) |
| `afterTaskComplete` | observer | worker (`ctx === {}`) |
| `onTaskFailed` | observer | per failed attempt (will retry) |
| `onTaskDeadLettered` | observer | task exhausted `maxAttempts` (host can alert/page) |

Register at construction (`hooks:`) or later via `getResizer().hook(name, fn)`. Taps are **typed** (`HookSignatures`): each name infers its exact signature, so a wrong argument or return shape is a compile error instead of a silent `any`. In every observer the `task` argument is the transport-agnostic `LeasedTask` (`{ taskId, mediaId, pipeline, previews }`) on **both** transports — never a raw driver document — so a host tap is portable. Every observer is **also** mirrored on the framework event bus as `resize:<name>` (fire-and-forget) for ecosystem subscribers.

## Sizes & identity

A size becomes a canonical **size key** via `getSizeKey`, and the full lookup/lock **identity** is `sizeKey:format:filterSig`. Filters are part of identity (empty → `none`), so a blurred variant is a distinct object.

| Size input | Size key | Meaning |
|---|---|---|
| `{ width: 300, height: 300 }` | `300x300` | cropped (cover) |
| `{ width: 620 }` | `620w` | width-only (banner/strip) |
| `{ height: 400 }` | `400h` | height-only |
| `{ fit: true }` | `fit` | uncropped ("contain"), bounded by `config.maxSize` |
| `{ width: 300, height: 300, filters: { blur: 40 } }` | `300x300` + `blur:40` in identity | keyed alternate rendering |

The **host owns the size catalogs** per entity, injected via `resolveSizes` + per-call `sizes`.

:::warning Security: the catalog is an allowlist

Never pass raw client-supplied dimensions into `sizes` — resolve them against a fixed per-entity catalog first, or you invite arbitrary-resize resource abuse. The module owns the identity key; the host owns which sizes are permitted.

:::

## Configuration

`src/config/resize.ts` (scaffolded, editable) spreads the module defaults and is deep-merged over them by `getResizeConfig()` — override any knob at any depth. **Arrays REPLACE**; nested objects merge field-by-field. The most-touched knobs:

| Key | Default | Notes |
|---|---|---|
| `mediaModelName` | — (**required**) | your host media model name (`'File'`/`'Media'`) |
| `formats` | `['jpeg','webp','avif']` | generated formats |
| `maxSize` | `{ width: 2000, height: 1200 }` | the `fit` cap |
| `encode.quality` | `{ jpeg: 80, webp: 82, avif: 64 }` | per-format — never reuse one int across codecs |
| `worker.enabled` | `false` | gate the worker process (env-driven in host) |
| `queue.maxAttempts` | `5` | delivery count before dead-letter (like SQS `maxReceiveCount`) |
| `queue.taskTimeoutMs` | `600000` | `handleTask` is raced against this; on timeout the task is failed and the slot freed (Mongo transport) |

Storage buckets/URLs and the SQS queue URL are **not** config — they are driver options passed to `new LocalFsStorage({...})` / `new S3Storage({...})` / `new SqsTransport({...})`. See the [full config reference](https://github.com/adaptivestone/framework-module-resize#config-reference) for every knob (encode, limits, queue lease/backoff, worker concurrency).

## Operations

**`ResizeTask` lifecycle** (Mongo transport): `pending → processing → completed | dead`. Retries are capped at `queue.maxAttempts`, then the task is **dead-lettered** (`status:'dead'`) — the lease never reclaims a task past the cap, so no crash-loop runs forever. (SQS uses its native DLQ instead.)

**Dead-letter replay** is a host op — reset the row:

```ts
ResizeTask.updateOne({ _id }, { $set: { status: 'pending', attempts: 0, leaseExpiresAt: null } });
```

**Delivery is at-least-once** (both transports); the worker is **idempotent** — re-running a task for an already-generated identity skips via the existing-preview check, never duplicates.

:::warning SVG sanitization is host-owned

**SVG originals are pass-through** — when `original.contentType === 'image/svg+xml'` the read path serves the original at every requested size/format and never resizes or enqueues. Sanitize SVGs at upload, before storing.

:::

## Host responsibilities

The module owns the resize core; the host owns everything domain-specific:

- The public **response DTO shape** (via `formatPublicUrls`, or `formatPictureUrls` as a starting point).
- **Which domain models** attach media and the **size catalogs** per entity (via `resolveSizes` + per-call `sizes` — treat catalogs as allowlists).
- **Data migration** from any legacy preview schema.
- **Domain image analysis** — NSFW/object detection, plate/face blur, watermark, masking (inject via pipeline `beforeSteps`/`variantSteps`).
- **Permissions** — who may delete/replace media; the host may opt a read into a signed-original URL via `ctx`.
- **SVG sanitization** and **deleting media / storage cleanup** (the module appends previews but never deletes them).

For the exhaustive tables (every driver option, config knob, and hook signature) see the [README](https://github.com/adaptivestone/framework-module-resize#readme).
