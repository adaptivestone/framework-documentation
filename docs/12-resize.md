# Image Resizing

Image resizing for the framework, shipped as [@adaptivestone/framework-module-resize](https://www.npmjs.com/package/@adaptivestone/framework-module-resize). Your app stores the original image and its location on a media document. The module uses `sharp` to create previews, uploads them through your storage driver, and appends their metadata to that document's `previews[]`.

Choose when to generate previews:

| Mode | Your app calls | Where image processing happens | What the caller waits for |
|---|---|---|---|
| **Eager** | `generate()` after saving the upload | In the calling process | Download, resize, upload, and persistence |
| **Lazy** | `resolve()` while building a response | In a separate worker, for missing variants | Read hooks and any lock/queue/signing work; no image processing |
| **Pre-warm** | `prewarm()` after saving the upload | In a separate worker, for the supplied catalog | Hooks and lock/queue writes; no image processing |

All three share the same resize core and stored preview shape. You can mix them: pre-warm common thumbnails, then lazily generate less-used sizes. Eager needs no queue or worker. Lazy and pre-warm need both.

## Installation

```bash
npm i @adaptivestone/framework-module-resize
```

Requires Node `>=24`, `@adaptivestone/framework` (`^5.0.1`), and `mongoose`. The AWS dependencies are optional peers, needed only when you import their driver:

| Driver | Also install |
|---|---|
| `LocalFsStorage`, `MongoTransport`, framework media store/locks | No additional peers |
| `S3Storage` | `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner` |
| `SqsTransport` | `npm i @aws-sdk/client-sqs sqs-consumer` |

## Quick start (eager + local filesystem)

Use this when you want upload processing to finish with previews ready. The upload waits for image processing; listing reads use `resolve()` and never run `sharp`.

### 1. Scaffold the integration files

Run in your host app's root after installation:

```bash
npx resize-scaffold --eager
```

| File | Purpose |
|---|---|
| `src/resizer.ts` | One `Resizer` construction site, with `LocalFsStorage` wired |
| `src/config/resize.ts` | Host configuration, including the media model name |

Without `--eager`, the scaffold also creates `src/models/ResizeTask.ts` and `src/commands/ResizeWorker.ts` for the [lazy setup](#when-listings-are-huge-lazy--queue). The lazy `src/resizer.ts` has a storage placeholder that you must replace.

Existing files are preserved. Use `--out <dir>` to change the destination, `--check` to check the lazy shims in CI (`--check --eager` for eager), and `--eject` for an editable task model. `--force` overwrites files. The scaffold also appends a package-guide pointer to your app's `AGENTS.md`; `--agents claude|print|skip` changes that behavior.

### 2. Configure the media model and storage

Set your actual model name in `src/config/resize.ts`:

```ts
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';

export default {
  ...defaultResizeConfig,
  mediaModelName: 'File',
};
```

Your media model must store `original` and `previews[]`. Add the exported fragment to your existing model schema:

```ts
import { resizeMediaSchemaFragment } from '@adaptivestone/framework-module-resize';

// Inside your existing media model class:
static get modelSchema() {
  return { ...existingFields, ...resizeMediaSchemaFragment } as const;
}
```

`existingFields` means your model's current schema fields. At upload, persist the original's storage `key` (and `bucket` for S3), `contentType`, and preferably its display-oriented `width`/`height`. The module does not implement an upload endpoint or save the original for you. Pass a media document with `id` or `_id` to the resize APIs.

The eager scaffold's storage configuration is:

```ts
// src/resizer.ts
import { Resizer } from '@adaptivestone/framework-module-resize';
import { LocalFsStorage } from '@adaptivestone/framework-module-resize/storage/fs.js';

export const resizer = new Resizer({
  storage: new LocalFsStorage({
    rootDir: './var/media',
    publicBaseUrl: '/media',
  }),
});
```

Your web server must serve `./var/media` at `/media`; the driver only reads/writes files and builds URLs. It uses one public tree for originals and previews, and does not enforce private storage. Use S3 with separate buckets or a custom driver if originals must stay private.

### 3. Initialize once per process

Create the `Resizer` after framework initialization, before calling resize APIs. For a standard HTTP entry, insert the dynamic import between initialization and startup:

```ts
// src/server.ts — keep your existing Server options and other setup.
const server = new Server(folderConfig);
await server.init();
await import('./resizer.ts');
await server.startServer();
```

`Server` and `folderConfig` are the imports already used by your host entry. `startServer()` also calls `init()`; the second initialization is a no-op. Use this dynamic import instead of a top-level `import './resizer.ts'`, which executes before the entry's initialization code.

Construct **one `Resizer` per process**. A second construction throws. In DTO builders and upload handlers, import `getResizer()` from the package to access that instance.

### 4. Generate at upload and read the stored previews

Define a fixed catalog in your app and reuse it on upload and read:

```ts
// src/mediaSizes.ts
import type { SizeInput } from '@adaptivestone/framework-module-resize';

export const listingSizes: SizeInput[] = [{ width: 320, height: 320 }];
export const detailSizes: SizeInput[] = [{ width: 620 }, { fit: true }];
```

With the default formats, one size means three variants: JPEG, WebP, and AVIF.

```ts
// Upload handler — fileDoc and fileDoc.original are already saved.
import { getResizer } from '@adaptivestone/framework-module-resize';
import { listingSizes } from './mediaSizes.ts'; // adjust the relative path

const { created, failed } = await getResizer().generate({
  media: fileDoc,
  sizes: listingSizes,
});
```

```ts
// DTO builder — fileDoc is the loaded media document.
import { formatPictureUrls, getResizer } from '@adaptivestone/framework-module-resize';
import { listingSizes } from './mediaSizes.ts'; // adjust the relative path

const { decision } = await getResizer().resolve({
  media: fileDoc,
  sizes: listingSizes,
});
const picture = formatPictureUrls(decision, {
  id: String(fileDoc.id ?? fileDoc._id),
});
```

`generate()` persists by default and appends its new previews to the supplied `fileDoc`, so a same-request `resolve()` can see them. [Check `failed` and handle generation errors](#reading-the-generate-result). Without a transport, `resolve()` only reads: a size you did not generate stays missing.

## How it works

For one photo requested at `320×320` with default formats:

1. Your app saves the original and its media document.
2. A DTO builder calls `resolve({ media, sizes: listingSizes })`.
3. `resolve()` checks that supplied document for each size + format + filters combination. Existing previews become `decision.ready` entries with URLs. Unavailable variants become `decision.missing` entries without URLs.
4. In lazy mode, it acquires dispatch locks and hands the missing variants that win their locks to the transport as **one task for this media**. It awaits that work, then returns the decision. It does not wait for the worker.
5. The worker loads the media document by ID, downloads the original, generates and uploads previews, and appends their metadata to `previews[]`.
6. A later request loads the updated media document and calls `resolve()` again. The new previews are now ready.

The module supplies no placeholder image, image-serving route, browser polling, or automatic response refresh. Your UI chooses what to display when a URL is absent. Reload or invalidate cached media/DTO data after generation if you want an already-open page to pick up the previews.

## When listings are huge (lazy / queue)

Use lazy generation when building every allowed size at upload would waste work, or when uploads must avoid image processing. It does **not** automatically make a large listing query cheap: each `resolve()` still checks one media document and may perform lock and queue writes. Paginate your query and request only the sizes used on that page.

This example uses MongoDB for the queue and S3 for images. Keep your existing storage driver if it is already suitable; filesystem storage requires the API and worker to share the same files and URL mapping.

### 1. Add the queue files

```bash
npx resize-scaffold
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

The scaffold adds the `ResizeTask` model and `ResizeWorker` command under your host's `src/` folder so the framework can discover them. They delegate to the package; keep those shims rather than copying the implementation. If you previously scaffolded eager mode, your existing `src/resizer.ts` and config are preserved: edit them as shown next.

Use the [media schema from the quick start](#2-configure-the-media-model-and-storage). With `MongoTransport`, both processes also need the framework `Lock` model and the `ResizeTask` model. Ensure the task model's indexes are created through your normal database deployment process; the active-request unique index is required for durable enqueue deduplication.

### 2. Wire the transport and storage

Replace the constructor in your existing construction site:

```ts
// src/resizer.ts
import { Resizer } from '@adaptivestone/framework-module-resize';
import { MongoTransport } from '@adaptivestone/framework-module-resize/transports/mongo.js';
import { S3Storage } from '@adaptivestone/framework-module-resize/storage/s3.js';

export const resizer = new Resizer({
  transport: new MongoTransport(),
  storage: new S3Storage({
    bucketPublic: 'my-cdn',
    bucketPrivate: 'my-originals',
    publicBaseUrl: 'https://cdn.example.com',
  }),
});
```

Replace the bucket names and CDN URL with yours; AWS credentials and region come from the SDK's normal configuration, or you can pass a configured `client`. Previews are uploaded with public visibility. The buckets, access policy, and CDN must already be configured by your app/deployment. `publicBaseUrl` only builds URLs; it does not make a bucket public. The old S3 option `publicUrl` is deprecated.

Omitted `mediaStore` and `lockProvider` use the framework-backed drivers. The API and worker must use the same media database, queue, and storage locations.

### 3. Enable the worker in its process

```ts
// src/config/resize.ts
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';

export default {
  ...defaultResizeConfig,
  mediaModelName: 'File',
  worker: {
    ...defaultResizeConfig.worker,
    enabled: process.env.RESIZE_WORKER === 'true',
  },
};
```

`RESIZE_WORKER` is an environment variable **read by this host config**, not a variable the module reads automatically. Without this mapping, setting it has no effect. The default `worker.enabled` is `false`. It gates worker execution; API reads can still enqueue while it is false.

If your media model is named `Media`, set `mediaModelName: 'Media'` and add `static fileRef = 'Media'` to the scaffolded `ResizeTask` subclass so its Mongo reference matches.

### 4. Initialize the API and CLI separately, then start the worker

Use the [HTTP bootstrap shown above](#3-initialize-once-per-process). The worker starts through `src/cli.ts`, so importing the construction site only from `src/server.ts` does not initialize it in the worker.

For the standard framework CLI entry:

```ts
// src/cli.ts
import Cli from '@adaptivestone/framework/Cli.js';
import folderConfig from './folderConfig.ts';

const cli = new Cli(folderConfig);
// Load configuration before constructing the Resizer. The selected command
// still controls model initialization through isShouldInitModels.
await cli.server.init({ isSkipModelInit: true, isSkipModelLoading: true });
await import('./resizer.ts');
const result = await cli.run();
process.exit(result ? 0 : 1);
```

Keep the scaffolded worker command re-export. It requests model initialization and uses the active `Resizer` when it runs. Launch it alongside your API as a separate, long-running process:

```bash
RESIZE_WORKER=true npm run cli ResizeWorker
```

Setting `worker.enabled` does not start a worker inside the API. Run the command and keep it supervised by your process manager/container deployment.

### 5. Resolve the current page's media

Select `original` and `previews` along with the fields your DTO needs. `resolve()` uses the document you pass; it does not reload missing fields from MongoDB.

```ts
import {
  formatPictureUrls, getResizer, resizeMediaPaths,
} from '@adaptivestone/framework-module-resize';
import { listingSizes } from './mediaSizes.ts'; // adjust the relative path

// File is your host media model; query is your authorized listing filter.
const files = await File.find(query)
  .select([...resizeMediaPaths, 'mediaType', 'name'])
  .limit(20)
  .lean(); // _id remains selected

const pictures = [];
for (const file of files) {
  const { decision } = await getResizer().resolve({
    media: file,
    sizes: listingSizes,
  });
  pictures.push(formatPictureUrls(decision, { id: String(file._id) }));
}
```

Add your app's normal pagination. This example processes a bounded page sequentially; if you parallelize DTO work, bound that concurrency too. Passing a whole catalog to every listing read requests that whole catalog, even if the browser displays only one thumbnail. Browser `loading="lazy"` does not defer backend enqueue work that already ran while building the response.

For a raster original larger than `320×320`, with no previews or hooks and all dispatch locks available, one media read requests three variants in one task. A page of 20 such media can enqueue 20 tasks covering 60 variants. Only missing identities are requested on later reads.

### 6. Handle the first response and verify the next one

Before the worker finishes, the example above produces a picture with `sizes: {}` for an image with no ready variants. Show your own placeholder or omit the image. If only JPEG is ready, the map contains that JPEG immediately; the worker can fill WebP and AVIF later.

`formatPictureUrls()` maps **ready, unfiltered** entries. It does not add placeholders or a pending flag. For a custom DTO, map `decision` yourself or register a `formatPublicUrls` hook and read `output`. Without a hook, or if every formatting tap throws, `output` is `undefined`.

`decision.missing` describes unavailable variants after the `beforeEnqueue` hook. It is **not a queue receipt**: variants may remain missing because another request holds their dispatch locks, enqueueing is disabled, the original has no key, or a queue operation failed. `resolve()` logs internal failures and returns safely; an empty `missing` array alone is not proof that every requested size is ready.

To verify the setup, save one raster original, request its thumbnail, and inspect the `ResizeTask` row and media document. After the worker runs, `previews[]` should contain the generated entries. Fetch the media again, repeat the read, and open a returned URL. The original in-memory object from the first request is not updated by a separate worker.

### Keeping large reads predictable

- Use small, fixed catalogs per view: list thumbnails for listing pages, larger sizes for detail pages. Never accept arbitrary client dimensions.
- Pre-warm frequently used sizes after upload if the first listing response should usually have an image. Queue completion before the first read is not guaranteed.
- For reads that must avoid dispatch locks and queue writes, pass `enqueueMissing: false`. Arrange generation separately with `prewarm()` or `generate()`, or use a later read with enqueueing enabled.

```ts
const { decision } = await getResizer().resolve({
  media: fileDoc,
  sizes: listingSizes,
  enqueueMissing: false,
});
```

This still evaluates hooks and any authorized original signing. With a transport, `enqueueMissing` defaults to `true`; without one it defaults to `false`. Setting it to `true` cannot create a missing transport.

## Modes: eager vs pre-warm vs lazy

The wiring above supports all three calls. There is no global mode switch: the method you call determines when work happens.

**Pre-warm:** after both the original object and media document are saved, queue the catalog you expect to need:

```ts
const { enqueued } = await getResizer().prewarm({
  media: fileDoc,
  sizes: listingSizes,
});
```

`prewarm()` awaits hooks, dispatch locks, and the transport call, but no image processing. It catches internal failures and returns `{ enqueued: 0 }`. With missing variants and no transport it warns and returns zero. `enqueued` counts variants handed successfully to the transport after lock filtering, **not** new task rows or completed previews. Mongo may reuse an identical active task. Zero can mean already covered, SVG pass-through, no original key, no transport, held locks, or a failure; inspect the media and logs to distinguish these cases.

Both pre-warm and lazy require a worker and transport. Only Mongo requires `ResizeTask`; SQS uses its own queue and DLQ. SQS still uses the framework media store and locks unless you replace those drivers.

**Eager:** await generation in the calling process, including when the `Resizer` also has a transport:

```ts
const { created, failed } = await getResizer().generate({
  media: fileDoc,
  sizes: listingSizes,
  // persist: false skips database persistence; image uploads still happen.
});
```

Eager does not acquire queue/worker locks. Existing identities on the supplied document are skipped, but concurrent eager calls are not serialized for you. Both `generate()` and `prewarm()` skip stored identities and SVG originals; they do not use `resolve()`'s [original-already-fits shortcut](#originals-and-private-access).

### Reading the `generate` result

`created` contains only this call's new previews. With default persistence, a repeat call using the updated document skips identities that already exist:

| Case | Result |
|---|---|
| All requested variants stored, empty catalog, or SVG original | `{ created: [], failed: 0 }` |
| Some per-variant operations fail and others succeed | Returns successful `created` entries and `failed > 0` |
| Original absent or without a usable key | Throws `ResizeNoOriginalError` |
| Per-variant errors leave no successful previews | Throws `ResizeGenerateError` |
| Source download, metadata validation, `beforeSteps`, or persistence fails | Rejects with that error; handle it in the upload flow |

Treat an empty `created` with zero failures as a successful no-op. With `persist: false`, save the returned preview metadata yourself if subsequent reads should find those objects.

## Errors

Errors defined by this package extend **`ResizeError`**. Dependency or host pipeline failures can also propagate from `generate()` without that brand. `resolve()` and `prewarm()` catch and log internal failures; their return values are not error reports. Setup errors such as calling `getResizer()` before construction occur outside that guard. The error classes describe package rejections:

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

Four driver contracts control storage, queueing, media persistence, and locks. A standard host supplies `storage` and, for queued work, `transport`. The other two default to framework-backed implementations. S3 and SQS use separate subpath imports so the main entry does not require their optional AWS peers.

| Seam | Option | Shipped | Subpath import |
|---|---|---|---|
| Storage | `storage` **(required)** | `LocalFsStorage`, `S3Storage` | `…/storage/fs.js`, `…/storage/s3.js` |
| Queue transport | `transport?` | `MongoTransport`, `SqsTransport` | `…/transports/mongo.js`, `…/transports/sqs.js` |
| Media store | `mediaStore?` | `FrameworkMediaStore` (default) | `…/mediaStore/framework.js` |
| Lock provider | `lockProvider?` | `FrameworkLockProvider` (default) | `…/locks/framework.js` |

Reach the process-wide instance anywhere via `getResizer()` (throws a `ResizeSetupError` if none was constructed).

**Custom drivers** can be plain objects or classes that implement the exported contract. A driver closes over its own client; no `app` argument is passed. Storage implements `download`, `upload`, and a pure `publicUrl`; `signedUrl` and `canServeOriginalPublicly` are optional. Implement the visibility check when your driver can prove an original is public. Without that check, `resolve()` conservatively treats originals as private. Generated previews are uploaded with `visibility: 'public'`.

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

**`isCatalogCovered(media, sizes, formats)`** checks stored identities (or SVG pass-through). It does not check storage objects, queue state, original access, or run hooks. If your hooks add sizes, checking only the unexpanded catalog is not enough to decide whether to skip `generate()`/`prewarm()`.

**`resizeMediaPaths`** is the `['original', 'previews'] as const` list of fields the module reads, for your `.select()`. Append your own:

```ts
File.find(query).select([...resizeMediaPaths, 'mediaType', 'name']).lean();
```

## Pipelines & hooks

**Pipelines** contain your image-processing steps. Select one with `pipeline` on `resolve()`, `prewarm()`, or `generate()`; the default name is `default`. The queue stores only the name, so register the same pipeline functions in the worker construction site. An unknown name resolves to an empty pipeline and does not throw.

```ts
// Register in shared setup after constructing the Resizer in each process.
import { getResizer } from '@adaptivestone/framework-module-resize';

getResizer().registerPipeline('photo', {
  variantSteps: [
    (img, { variant }) => variant.filters?.blur
      ? img.blur(Number(variant.filters.blur))
      : img,
  ],
});

// In your DTO builder, request the rendering from a fixed host catalog.
const { decision } = await getResizer().resolve({
  media: fileDoc,
  pipeline: 'photo',
  sizes: [{ width: 300, height: 300, filters: { blur: 40 } }],
});
```

Map this filtered `decision` in your own DTO; `formatPictureUrls()` excludes filtered variants. Registering a pipeline again replaces the previous definition for that name.

- **`beforeSteps`** — ordered, awaited, once per task on the source buffer. The home for detection metadata and pixel redaction (plate/face blur) that must apply to every variant. A throwing step fails the task.
- **`variantSteps`** — ordered per-variant chain, after resize, before encode. The home for keyed `filters` and anything sized relative to the output.

:::warning Watermark in variantSteps

Put a watermark in `variantSteps`, **not** `beforeSteps`. Baked onto the original once, a watermark scales down with each variant and becomes unreadable on small sizes.

:::

:::note ctx does NOT cross the queue

In the lazy worker `ctx === {}` — the task carries only `{ mediaId, pipeline, previews }`. Persist per-media data needed by `beforeSteps` on the media document; those steps receive the loaded `media`. `variantSteps` receive only `variant` and `ctx`, so queued per-variant settings must be carried in the allowed `filters` or pipeline configuration. The full caller `ctx` reaches steps **only** in eager mode (`generate`, same process).

:::

**Hooks** are the cross-cutting seams. Taps run in registration order, awaited sequentially, and are error-isolated (a throwing tap is logged, never breaks the read/worker flow).

| Hook | Kind | Runs where |
|---|---|---|
| `resolveSizes` | waterfall | `resolve()`, `prewarm()`, and `generate()`; caller `ctx` |
| `beforeEnqueue` | waterfall | `resolve()` (even with enqueueing disabled) and `prewarm()`; caller `ctx` |
| `formatPublicUrls` | waterfall | `resolve()` only; caller `ctx` |
| `onPreviewGenerated` | observer | After persistence, in worker or eager mode; `ctx === {}` |
| `afterTaskComplete` | observer | worker (`ctx === {}`) |
| `onTaskFailed` | observer | Mongo retryable failed attempt; SQS handler failure |
| `onTaskDeadLettered` | observer | Mongo terminal failure or exhausted attempts; SQS DLQ needs separate monitoring |

Register at construction (`hooks:`) or later via `getResizer().hook(name, fn)`. Taps are **typed** (`HookSignatures`): each name infers its exact signature, so a wrong argument or return shape is a compile error instead of a silent `any`. Task observers receive the transport-agnostic `LeasedTask` (`{ taskId, mediaId, pipeline, previews }`) on **both** transports — never a raw driver document — so a host tap is portable. Every observer is **also** mirrored on the framework event bus as `resize:<name>` (fire-and-forget) for ecosystem subscribers.

## Sizes & identity

A size becomes a canonical **size key** via `getSizeKey`. Within one media document, previews match by size key + format + canonical filters; dispatch and worker locks also include the media ID. Filters distinguish alternate renderings. They do not apply an effect by themselves: your pipeline must implement what `{ blur: 40 }` means.

| Size input | Size key | Meaning |
|---|---|---|
| `{ width: 300, height: 300 }` | `300x300` | cropped (cover) |
| `{ width: 620 }` | `620w` | width-only (banner/strip) |
| `{ height: 400 }` | `400h` | height-only |
| `{ fit: true }` | `fit` | uncropped ("contain"), bounded by `config.maxSize` |
| `{ width: 300, height: 300, filters: { blur: 40 } }` | `300x300` + `blur:40` in identity | keyed alternate rendering |

The **host owns the size catalogs** per entity, injected via `resolveSizes` + per-call `sizes`.

**Pipeline names are not part of stored preview identity.** Two pipelines requesting the same media + size + format + filters reuse the same preview and locks. Use distinct filters for different renderings, including on reads. A change to pipeline code or encode quality does not invalidate existing previews automatically; manage regeneration/invalidation in the host.

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
| `worker.concurrency` | `4` | Parallel variants per generation call/task; also applies to eager generation |
| `worker.sharpConcurrency` | `1` | Sharp/libvips concurrency configured when the worker starts |
| `queue.maxAttempts` | `5` | Mongo delivery attempts before dead-letter |
| `queue.taskTimeoutMs` | `600000` | `handleTask` is raced against this; on timeout the task is failed and the slot freed (Mongo transport) |

Storage buckets/URLs and the SQS queue URL are **not** config — they are driver options passed to `new LocalFsStorage({...})` / `new S3Storage({...})` / `new SqsTransport({...})`. See the [full config reference](https://github.com/adaptivestone/framework-module-resize#config-reference) for every knob (encode, limits, queue lease/backoff, worker concurrency).

## Originals and private access

Existing preview metadata takes priority for raster images. If a preview is absent, `resolve()` can use the original only in these cases:

- **SVG:** `original.contentType === 'image/svg+xml'` or `original.format === 'svg'`. It passes through untouched for all requested sizes/formats and is never rasterized or enqueued. Sanitize SVG at upload in your app.
- **A raster original already fits:** the request has both width and height, no filters, and no `fit: true`; the original dimensions are known and neither exceeds the requested box. Width-only, height-only, and `fit` requests do not use this shortcut. Pipeline steps do not run on an original-backed response.

Both require a publicly servable original or an authorized signed URL. The shipped S3 driver recognizes its public bucket; private originals are not exposed anonymously. With a signing-capable driver, server-derived `ctx.isOwner` or `ctx.isAdmin` enables a five-minute signed original URL. Do not trust those flags from client input. Failed signing cannot fall back to a public URL for a private original. A private SVG that cannot be served returns no ready or missing variants, because there is no raster fallback.

An original-backed entry has `isOriginal: true`. Its `format` is the requested slot, while `contentType` describes the actual original bytes; use `contentType` when building HTML `<source type>` values. These access rules apply to originals. Generated previews are uploaded as public objects, so authorize which media may be processed and returned in your host.

## Operations

With **MongoTransport**, a task moves from `pending` to `processing`. Success marks it `completed`; a retryable failure returns it to `pending` with exponential backoff. Exhausted attempts mark it `dead`. An existing media row without a usable original key is dead-lettered on the first attempt; a deleted media row is a logged no-op completion.

Completed does not guarantee that every requested variant exists: partial generation success persists the good previews and completes the task. Failed variants and variants skipped because of worker-lock contention remain missing and can be requested by a later `resolve()` or `prewarm()`.

Dispatch locks suppress concurrent requests per variant. Mongo also reuses identical active requests using a canonical `requestKey` and a partial unique index. That request key includes media ID, pipeline, and the variants surviving dispatch locks; a different or overlapping catalog can be a separate task. Legacy tasks without a key remain valid. This is not one permanent task per image, nor an exactly-once guarantee: delivery is at-least-once, and the worker skips identities already stored on the loaded media document.

The Mongo worker processes one task at a time per process; `worker.concurrency` limits parallel variants **within that task**, not the number of tasks polled. Scale worker processes to process more media concurrently. Keep `queue.lockTtlMs.worker <= queue.leaseMs`; config validation rejects the opposite. The default model expires completed rows after roughly 24 hours and dead rows after roughly 30 days through Mongo TTL indexes.

After fixing a dead task's cause, you can load the current media and call `prewarm()` with your fixed catalog to request the still-missing variants again. A dead/completed row does not block a fresh active task. Dead-letter replay and monitoring are host operations.

With **SqsTransport**, configure visibility timeout, heartbeat, retry delivery count, and DLQ/redrive in SQS/the driver. Mongo settings such as `queue.maxAttempts` and `queue.taskTimeoutMs` do not configure SQS. The module emits failure and completion hooks for SQS handling, but does not observe the queue's DLQ transitions or emit `onTaskDeadLettered` for them.

### Troubleshooting lazy generation

| Symptom | Check |
|---|---|
| Worker exits with “disabled” | Add the env mapping in host config and launch with `RESIZE_WORKER=true` |
| Worker reports no Resizer or no transport | Initialize `src/resizer.ts` in the CLI process and configure its transport |
| Missing variants, no task rows | Check `enqueueMissing`, the original key, the `ResizeTask`/`Lock` models, dispatch locks, hooks, and enqueue error logs |
| Tasks stay pending | Check the worker process, its enablement, and whether API/worker use the same database/queue |
| Tasks fail repeatedly | Inspect worker logs, original storage access, registered pipeline code, and media limits |
| Task completed but a size is absent | Check partial failures/skipped locks; compare the requested size, format, and filters with stored previews |
| Previews exist in Mongo but the response is empty | Select `original` and `previews`, reload stale documents/caches, and map `decision` if no formatting hook is registered |
| Returned URLs give 404/403 | Check storage/CDN/public access configuration; readiness is based on metadata, not an object-existence probe |

## Host responsibilities

The module owns the resize core; the host owns everything domain-specific:

- The public **response DTO shape** (via `formatPublicUrls`, or `formatPictureUrls` as a starting point).
- **Which domain models** attach media and the **size catalogs** per entity (via `resolveSizes` + per-call `sizes` — treat catalogs as allowlists).
- **Data migration** from any legacy preview schema.
- **Domain image analysis** — NSFW/object detection, plate/face blur, watermark, masking (inject via pipeline `beforeSteps`/`variantSteps`).
- **Permissions** — who may delete/replace media; the host may opt a read into a signed-original URL via `ctx`.
- **SVG sanitization** and **deleting media / storage cleanup** (the module appends previews but never deletes them).

For the exhaustive tables (every driver option, config knob, and hook signature) see the [README](https://github.com/adaptivestone/framework-module-resize#readme).
