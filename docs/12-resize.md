# Image Resizing

`@adaptivestone/framework-module-resize` creates resized copies of images for your framework app. For example, you upload a `2400×1600` photo once, then generate a `320×320` thumbnail for a listing and a larger image for its detail page.

Your app passes the uploaded bytes to the module, which stores the **original image file** unchanged and returns its location; your app saves that on a **media document** such as `File`. The module reads that original, resizes it with `sharp`, uploads the generated files, and adds their metadata to the document's `previews[]`. Your app then asks the module for URLs to include in its responses.

A **preview** is a generated image file. A **variant** is one requested combination of size, output format, and optional filters. One `320×320` size in JPEG, WebP, and AVIF means **three variants and up to three generated files** for the same original photo.

The module supplies the image processing and optional queue integration. Your app supplies the upload endpoint, media model, storage access, response shape, and UI.

The usual path for our `2400×1600` photo and one `320×320` WebP thumbnail is:

<div className="resize-diagram" role="region" aria-label="From an uploaded original to a displayable preview" tabIndex={0}>

```mermaid
flowchart TB
  accTitle: From an uploaded original to a displayable preview
  accDescr: The host saves the original and media document. Generation uploads a preview file and appends its metadata. A read of the updated media produces a URL that the frontend uses to download the preview.
  Original["Original saved by your app<br/>2400 × 1600 PNG"] --> Generate["generate() or worker<br/>Resize + encode"]
  Generate --> File["Storage<br/>320 × 320 WebP file"]
  Generate --> Metadata["Media document<br/>previews[] metadata"]
  Metadata --> Read["resolve() with updated media<br/>Build ready URLs"]
  Read --> Frontend["Your frontend<br/>Fetch the image by URL"]
  File -. "Image bytes via that URL" .-> Frontend
```

</div>

The file lives in storage; `previews[]` contains metadata about it. `resolve()` turns that metadata into ready URLs without processing image pixels. These diagrams show successful generation with default persistence; [original handling](#originals-and-private-access) and [errors](#errors) are described below.

## Choose a workflow {/* #modes-eager-vs-pre-warm-vs-lazy */}

| You want… | Call | What happens before it returns | Return value |
|---|---|---|---|
| Previews ready when upload processing finishes | `generate()` — **eager** | Downloads the original, generates/uploads previews, and saves their metadata | `{ created, failed }`: new preview metadata objects and a failure count |
| A fast upload that starts background generation | `prewarm()` — **pre-warm** | Hands missing variants to a queue; the worker generates them later | `{ enqueued }`: number of variants handed to the transport |
| The same, but the upload must know every variant is ready or queued | `enqueueRequired()` — **strict pre-warm** | Queues missing variants and confirms each one | `{ status, ready, accepted, notRequired, unconfirmed, tasks, issues }` |
| To generate only the sizes requested by readers | `resolve()` with a transport — **lazy** | Finds ready URLs and requests missing variants through the queue | `{ decision, output }`: availability now and an optional custom response |

**Every workflow uses `resolve()` to read image URLs.** In eager mode it reads previews you already generated. In pre-warm mode it reads what the worker has finished. In lazy mode it also starts generation when a preview is missing.

There is no global mode switch. The method you call determines when generation happens. You can pre-warm common thumbnails and lazily request less-used detail sizes. Start with eager if you can wait for image processing at upload; add the queue when you need background generation.

## Choose sizes, formats, and types {/* #sizes--identity */}

Define a fixed **catalog**: an array of sizes your app allows. Reuse it when generating and reading so both calls request the same variants.

```ts
// src/mediaSizes.ts
import type { PreviewFormat, SizeInput } from '@adaptivestone/framework-module-resize';

export const thumbnailSizes: SizeInput[] = [{ width: 320, height: 320 }];
export const detailSizes: SizeInput[] = [{ width: 620 }, { fit: true }];

// The examples on this page choose one format so each thumbnail is one file.
export const previewFormats: PreviewFormat[] = ['webp'];
```

### Size inputs

Dimensions are numbers in pixels. `sizeKey` is the string the module builds to identify that size in stored metadata and response maps; you pass dimensions, not a `sizeKey`, to the public methods.

| `SizeInput` | Generated `sizeKey` | Requested image |
|---|---|---|
| `{ width: 320, height: 320 }` | `320x320` | A square, cropped from the center to fill the box |
| `{ width: 620 }` | `620w` | Width 620, height calculated to preserve aspect ratio |
| `{ height: 400 }` | `400h` | Height 400, width calculated to preserve aspect ratio |
| `{ fit: true }` | `fit` | The whole image, without cropping or enlargement, inside `config.maxSize` (default `2000×1200`) |

For a `2400×1600` original, those requests produce `320×320`, approximately `620×413`, `600×400`, and `1800×1200` respectively. Stored `actualWidth`/`actualHeight` describe the encoded result. The generation limits can cap requested dimensions. With `fit: true`, the fit box comes from config; do not add width/height expecting to change that box.

Only `fit` explicitly prevents enlargement during generation. On reads, some small originals can be served directly; see [original handling](#originals-and-private-access).

Never pass arbitrary client dimensions into `sizes`. Map a client choice such as “thumbnail” to your fixed catalog. Otherwise callers can request unlimited resize work.

### Output formats and content types

`PreviewFormat` is a Sharp output format id. The defaults are these three:

| Value in `formats` | Generated file | Generated `contentType` | Useful when… |
|---|---|---|---|
| `'jpeg'` | JPEG | `image/jpeg` | You need a JPEG output/fallback. Transparency is flattened onto a background, white by default. |
| `'webp'` | WebP | `image/webp` | Your client accepts WebP, including images with transparency. |
| `'avif'` | AVIF | `image/avif` | Your client accepts AVIF or you offer it as another `<picture>` source. |

Use Sharp format ids: `'jpeg'`, not `'jpg'`, and `'webp'`, not `'image/webp'`. `contentType` is the MIME type used when serving the file. Another format supported by your Sharp build (for example `'png'` or `'tiff'`) can be generated once you add it to `formats` **and** give it an `encode.formats` entry; see [configuration](#configuration). SVG originals are converted to these raster formats like any other original; SVG is never a generated format.

If you omit per-call `formats`, the module uses config, whose default is `['jpeg', 'webp', 'avif']`. Our examples explicitly use `previewFormats = ['webp']`. To generate all three, change that shared array and use it on both generation and reads. Three sizes in three formats can require nine preview files per photo. Requesting AVIF on a later read does not convert a stored WebP file; it requires its own variant.

### TypeScript types you will use

These are exported types; use `import type` from the main package entry. Most call sites can let TypeScript infer results.

| Type | Use it for |
|---|---|
| `MediaLike` | The media document passed to `media`; your model may have additional fields |
| `Original` | Original file location (`storageRef`) and metadata on `media.original`; returned by `uploadOriginal()` |
| `UploadOriginalOpts` | A typed `uploadOriginal()` request |
| `SizeInput[]` | Your allowed size catalog |
| `PreviewFormat[]` | Your selected output formats |
| `Preview` / `Preview[]` | Generated file metadata; `generate().created` is a `Preview[]` |
| `GenerateOpts` / `GenerateResult` | A typed `generate()` request/result |
| `PrewarmOpts` | A typed `prewarm()` request; its result is `{ enqueued: number }` |
| `EnqueueRequiredOpts` / `EnqueueRequiredResult` | A typed `enqueueRequired()` request/result |
| `ResolveOpts` / `ReadDecision` | A typed `resolve()` request and its `decision` object |
| `ReadyEntry` / `MissingPreview` | Individual items in `decision.ready` / `decision.missing` |
| `PictureUrls` | The URL map returned by the optional `formatPictureUrls()` helper |

For example, a reusable reader can accept `media: MediaLike` and return `Promise<PictureUrls>`. It does not need the full type of your app's `File` model.

## Set up the module {/* #quick-start-eager--local-filesystem */}

The following setup supports eager generation and reading. The [lazy section](#when-listings-are-huge-lazy--queue) adds a queue and worker to it.

### 1. Install and scaffold {/* #installation */}

Requires Node `>=24`, `@adaptivestone/framework` (`^5.0.1`), and `mongoose`. From your host app's root:

```bash
npm i @adaptivestone/framework-module-resize
```

The resize module ships its own setup generator, **`resize-scaffold`**, as a package executable. Run it from this package explicitly:

```bash
npm exec --package=@adaptivestone/framework-module-resize -- resize-scaffold --eager
```

`--package` names the module that provides the executable. Everything after `--` is the command and its arguments; `--eager` tells the generator to create the eager integration files. Run this in the host app where you installed the module.

The scaffold creates editable `src/resizer.ts` and `src/config/resize.ts`. Existing files are preserved. Without `--eager`, it also creates the task model and worker command, and leaves a required storage placeholder in `src/resizer.ts`.

### 2. Prepare the media model {/* #2-configure-the-media-model-and-storage */}

The module needs a saved media document with `id` or `_id`, an `original` storage location, and a `previews[]` array. The default media store loads and updates that document in MongoDB.

Add `resizeMediaSchemaFragment` to your model's schema. For example, a minimal host model is:

```ts
// src/models/File.ts — keep your own fields when adapting an existing model.
import { BaseModel } from '@adaptivestone/framework/modules/BaseModel.js';
import { resizeMediaSchemaFragment } from '@adaptivestone/framework-module-resize';

export default class File extends BaseModel {
  static get modelSchema() {
    return {
      name: { type: String },
      ...resizeMediaSchemaFragment,
    } as const;
  }
}
```

A media document passed to the module has this shape. This illustrates an already-saved record with a local filesystem original; use your actual document in calls:

```ts
import type { MediaLike } from '@adaptivestone/framework-module-resize';

const media: MediaLike = {
  id: '65f000000000000000000001',
  original: {
    // The storage driver's locator, returned by uploadOriginal(). The name is random.
    storageRef: { path: 'originals/4f1c9a0b.png', visibility: 'private' },
    format: 'png',
    contentType: 'image/png',
    size: 482113,
    width: 2400,
    height: 1600,
  },
  previews: [],
};
```

`original` is the value `uploadOriginal()` returns ([step 5](#original-upload)); save it unchanged. `storageRef` belongs to the storage driver: `LocalFsStorage` stores `{ path, visibility }`, `S3Storage` stores `{ bucket, key }`. Do not build it by hand. Framework `BaseModel` keeps empty objects inside it (`minimize: false`); keep that option if you define the schema with Mongoose directly. If dimensions are missing, generation backfills them. Save the media document before calling `generate()` or `prewarm()`; the module does not create it for you.

### 3. Configure the model name and storage

```ts
// src/config/resize.ts
import type { FrameworkResizeConfig } from '@adaptivestone/framework-module-resize/framework.js';
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';

export default {
  ...defaultResizeConfig,
  mediaModelName: 'File', // Match your actual media model name.
} satisfies FrameworkResizeConfig;
```

The config must be complete, so always spread the defaults. Constructing the `Resizer` validates it and throws `ResizeConfigError` for a missing or invalid value, including keys removed since 0.2 (see [configuration](#configuration)).

The eager scaffold uses local filesystem storage:

```ts
// src/resizer.ts
import { createFrameworkResizer } from '@adaptivestone/framework-module-resize/framework.js';
import { LocalFsStorage } from '@adaptivestone/framework-module-resize/storage/fs.js';

export const resizer = createFrameworkResizer({
  storage: new LocalFsStorage({
    rootDir: './var/media',
    publicBaseUrl: '/media',
  }),
});
```

`createFrameworkResizer` comes from the module's framework adapter (`…/framework.js`). It reads `src/config/resize.ts` and adds the app logger and the framework media store, so you pass only the storage. (The package's main entry has no framework code at all; see [without the framework](#without-the-framework).)

With the sample original, the source file lives at `./var/media-private/originals/4f1c9a0b.png`. Private originals go to `privateRootDir`, which defaults to a sibling folder named after `rootDir` plus `-private`. Generated previews go under `./var/media`. Configure your web server to serve **only** `./var/media` at `/media`, never the private folder. The driver reads/writes files and builds URLs; it does not mount an HTTP route.

### 4. Initialize once per process {/* #3-initialize-once-per-process */}

Construct the `Resizer` after framework initialization. Adapt your HTTP entry, retaining its existing options and other setup:

```ts
// src/server.ts
import Server from '@adaptivestone/framework/server.js';
import folderConfig from './folderConfig.ts';

const server = new Server(folderConfig);
await server.init();
await import('./resizer.ts');
await server.startServer();
```

The dynamic import runs the construction after `init()`. A top-level `import './resizer.ts'` would execute before the entry's initialization code. `startServer()` calls `init()` again, which is a no-op once initialized.

Construct each `Resizer` once per process. Most apps need one: `getResizer()` returns it in handlers and DTO builders. An app that needs different storage, media models or formats constructs more, each with its own `name` and, if its settings differ, its own config file, and reads them with `getResizer(name)`. Constructing the same name twice throws. The CLI/worker needs its own initialization, shown in the lazy setup.

```ts
// src/resizer.ts — a second Resizer next to the default one
import { createFrameworkResizer } from '@adaptivestone/framework-module-resize/framework.js';

export const listings = createFrameworkResizer({
  name: 'listings',
  configName: 'resizeListings', // reads src/config/resizeListings.ts (a complete config, like resize.ts)
  storage: listingsStorage, // any storage driver
});

// elsewhere: getResizer('listings').generate({ media, sizes })
```

### 5. Store the original at upload {/* #original-upload */}

In your upload handler, pass the received bytes to `uploadOriginal()` and save the result on the media document:

```ts
import { getResizer } from '@adaptivestone/framework-module-resize';

// fileDoc is the media document for this upload; buffer holds the uploaded bytes.
fileDoc.original = await getResizer().uploadOriginal({
  body: buffer,          // Buffer or Uint8Array
  visibility: 'private', // originals stay private; generated previews are public
});
await fileDoc.save();
```

`uploadOriginal()` reads the format and dimensions from the bytes with Sharp, stores the bytes **unchanged** under a random name, and returns an `Original`: `storageRef`, `format`, `contentType`, `size`, and `width`/`height` when known. It does not create the media document or queue any work.

- Input is checked against `upload.maxBytes` (default 25 MiB) and `upload.formats` (default JPEG, PNG, WebP, AVIF, GIF, SVG). Invalid, unsupported or oversized input throws `ResizeOriginalError`; a storage failure throws `ResizeStorageError`.
- SVG must use `visibility: 'private'`; a public SVG upload is rejected. See [originals](#originals-and-private-access).
- The optional `namespace` groups objects under a prefix, for example `` namespace: `users/${user.id}` ``. It is a placement hint, not access control.

## Eager: generate previews now {/* #reading-the-generate-result */}

Use `generate()` after saving the uploaded original and media document. The call waits for image processing, uploads, and (by default) saving preview metadata. It runs in the calling process and needs no queue or worker.

<div className="resize-diagram resize-diagram--sequence" role="region" aria-label="Eager generation waits for previews to be saved" tabIndex={0}>

```mermaid
sequenceDiagram
  accTitle: Eager generation waits for previews to be saved
  accDescr: The app awaits generate. The resizer reads the original, processes the image, uploads the preview, and saves its metadata before returning created and failed. The app can then resolve the updated media to obtain a ready URL.
  participant App as Your app
  participant Resizer
  participant Data as Files + media
  App->>Resizer: generate()
  Resizer->>Data: Read original file
  Data-->>Resizer: Original bytes
  Resizer->>Resizer: Resize + encode
  Resizer->>Data: Upload preview<br/>Save metadata
  Data-->>Resizer: Saved
  Resizer-->>App: created: [preview]<br/>failed: 0
  App->>Resizer: resolve()
  Resizer-->>App: URL in decision.ready
```

</div>

For the one-WebP example, `generate()` returns only after that file and its metadata have been saved. There is no queue in this flow.

```ts
// In your upload handler, after fileDoc and fileDoc.original are saved.
import { getResizer } from '@adaptivestone/framework-module-resize';
import { previewFormats, thumbnailSizes } from './mediaSizes.ts'; // adjust the path

const { created, failed } = await getResizer().generate({
  media: fileDoc,
  sizes: thumbnailSizes,
  formats: previewFormats,
});

console.info('New preview files:', created.length);
if (failed > 0) {
  console.warn(`${failed} variants failed; inspect resize logs`);
}
```

### What `created` and `failed` mean

| Field | Type | Meaning |
|---|---|---|
| `created` | `Preview[]` — an array of objects | Metadata for each new preview file successfully generated and uploaded **by this call**. `created.length` is the number of new files. |
| `failed` | `number` | Count of individual variants whose processing, encoding, or upload failed. It is neither an error object nor an array. |

With our one-size, one-format example, successful generation returns an object like this (the generated file name is illustrative):

```json
{
  "created": [
    {
      "storageRef": { "path": "previews/8d0e2b7c.webp", "visibility": "public" },
      "sizeKey": "320x320",
      "format": "webp",
      "contentType": "image/webp",
      "requestedWidth": 320,
      "requestedHeight": 320,
      "actualWidth": 320,
      "actualHeight": 320
    }
  ],
  "failed": 0
}
```

`created[0]` describes an uploaded image: `storageRef` is the storage driver's locator for it (`{ path, visibility }` for local files, `{ bucket, key }` for S3); `sizeKey` and `format` identify the variant; `actualWidth`/`actualHeight` describe the encoded file. Filtered variants carry `filters`, and a fit variant carries `fit: true`. The object contains **metadata, not file bytes or a browser URL**. Use `resolve()` below for URLs.

With default `persist: true`, the new metadata is already appended to the database's `previews[]` and to the supplied `fileDoc.previews` when the call returns. Do not append it again. Existing previews are skipped and are not included in `created` or counted as failures.

If you change the example to request JPEG, WebP, and AVIF, these are the possible outcomes for a valid original (raster or SVG):

| What happened | What you receive |
|---|---|
| All three are new and succeed | `created.length === 3`, `failed === 0` |
| JPEG exists; WebP and AVIF are new and succeed | `created.length === 2`, `failed === 0` |
| Two new files succeed; one fails | `created.length === 2`, `failed === 1`; the successes are kept |
| All three already exist | `{ created: [], failed: 0 }` |
| All three new variants fail | A thrown `ResizeGenerateError`; no result object is returned |

`failed` does not identify the failed variants or contain error messages; inspect logs and compare the requested catalog with stored previews. An empty catalog also returns `{ created: [], failed: 0 }` for a valid original.

With `persist: false`, files are still uploaded, but metadata is neither saved to MongoDB nor appended to your supplied document. Store the returned `created` yourself if later reads should find those files.

`generate()` can also throw on missing originals, source download/validation, a `beforeSteps` failure, or database persistence. `failed` does not replace `try/catch`; see [errors](#errors). Eager calls use no queue/worker locks, even when a transport exists, so concurrent calls are not serialized for you.

## Read URLs in any mode {/* #reading-the-resolve-result */}

Call `resolve()` wherever your app builds a response. It receives the loaded media document and the sizes/formats this view needs. It never runs `sharp`.

```ts
import { formatPictureUrls, getResizer } from '@adaptivestone/framework-module-resize';
import { previewFormats, thumbnailSizes } from './mediaSizes.ts'; // adjust the path

const { decision, output } = await getResizer().resolve({
  media: fileDoc,
  sizes: thumbnailSizes,
  formats: previewFormats,
});

const picture = formatPictureUrls(decision, {
  id: String(fileDoc.id ?? fileDoc._id),
});
```

### What `decision`, `ready`, `missing`, and `output` mean

| Field | Type | Meaning |
|---|---|---|
| `decision` | `ReadDecision` — an object | Groups the ready and missing variants for **this read**. |
| `decision.ready` | `ReadyEntry[]` — an array | Entries with image URLs available now. Each includes `sizeKey`, `format`, `url`, and available `contentType`. Generated entries include `preview` metadata; original-backed entries have `isOriginal: true`. |
| `decision.missing` | `MissingPreview[]` — an array | Requested variants that cannot currently be served, after the `beforeEnqueue` hook. Each describes a size/format and optional filters; there is no URL. |
| `output` | `unknown` | Whatever your optional `formatPublicUrls` hook returned. Without a hook, or if every formatting tap throws, it is `undefined`. |

If the WebP thumbnail exists, `decision.ready[0].url` contains its URL. The `formatPictureUrls()` call groups the ready, unfiltered entries into the following response map (example key):

```json
{
  "id": "65f000000000000000000001",
  "sizes": {
    "320x320": {
      "webp": {
        "url": "/media/previews/8d0e2b7c.webp",
        "contentType": "image/webp"
      }
    }
  }
}
```

Your frontend can use `picture.sizes['320x320']?.webp?.url` as an image URL. With multiple formats, use the available URLs in your `<picture>`/image component and use each entry's `contentType` for its MIME type. The helper does not create images, placeholders, or a pending flag.

### What happens before a preview exists

For our `2400×1600` raster original with no previews, no hooks, and no internal read error, the read result looks like this:

```ts
// Example return value from resolve().
const result = {
  decision: {
    ready: [],
    missing: [
      {
        sizeKey: '320x320',
        format: 'webp',
        requestedWidth: 320,
        requestedHeight: 320,
      },
    ],
  },
  output: undefined,
};
```

There is no thumbnail URL yet. `formatPictureUrls()` returns an empty `sizes: {}` map for that media. Your UI should omit the image or show its own placeholder.

With a configured transport, `resolve()` attempts to enqueue missing variants by default. Without one, it only reads; you must call `generate()` separately to create the missing file. To prevent enqueueing for a particular read, pass `enqueueMissing: false`.

`missing` is an availability list, **not a queue receipt or a list of failed jobs**. The transport may fail, another request may hold the dispatch locks, or enqueueing may be disabled. `resolve()` logs internal failures and returns safely; an empty `missing` array alone is not proof that every requested variant is ready. Check ready URLs and logs.

`resolve()` awaits hooks and any lock, queue, or authorized signing work. It does not wait for the worker. A worker does not update this returned object or the media object already in your process. Fetch the updated document and resolve again to see newly generated previews.

### When to use `output`

Mapping `decision` with `formatPictureUrls()` is enough for the examples above. If you want `resolve()` to return your app's response shape automatically, register a formatting hook once after construction:

```ts
import { formatPictureUrls, getResizer } from '@adaptivestone/framework-module-resize';

getResizer().hook('formatPublicUrls', (decision) => formatPictureUrls(decision));
```

Now `output` is the map returned by that hook (without an `id` in this example). It is typed `unknown` because hooks can return any host response shape. Calling `formatPictureUrls()` yourself does not populate `output`.

`resolve()` never returns `created`, `failed`, `enqueued`, or a task ID. Its job is to describe what can be served now, regardless of how generation was started.

## Lazy: generate missing previews in a worker {/* #when-listings-are-huge-lazy--queue */}

Keep the media model, size catalog, storage, and HTTP initialization from the setup above. Lazy mode adds a **transport** (the queue driver) and a separate **worker process** that consumes its tasks. Your upload handler saves the original and media document without calling `generate()`.

### 1. Add Mongo queue support

Run the same generator shipped by the resize module, this time without `--eager`:

```bash
npm exec --package=@adaptivestone/framework-module-resize -- resize-scaffold
```

This adds `src/models/ResizeTask.ts` and `src/commands/ResizeWorker.ts`. They delegate to the package; keep those thin files rather than copying the implementation. Existing eager files are preserved, so edit your existing constructor to add the transport:

```ts
// src/resizer.ts — replaces the eager constructor.
import {
  createFrameworkMongoTransport,
  createFrameworkResizer,
} from '@adaptivestone/framework-module-resize/framework.js';
import { LocalFsStorage } from '@adaptivestone/framework-module-resize/storage/fs.js';

export const resizer = createFrameworkResizer({
  transport: createFrameworkMongoTransport(), // the ResizeTask model + queue timing from your config
  storage: new LocalFsStorage({
    rootDir: './var/media',
    publicBaseUrl: '/media',
  }),
});
```

The API and worker must share the same database, queue, and image storage. With local storage that means access to the same filesystem tree; for workers on other machines, configure shared storage or [S3](#drivers--seams).

Mongo mode uses the host media model, scaffolded `ResizeTask` model, and framework `Lock` model. Ensure the task model's indexes are created through your normal database deployment process. If your media model is named `Media`, set `mediaModelName: 'Media'` in config and `static fileRef = 'Media'` in the scaffolded `ResizeTask` subclass.

### 2. Allow the worker to run

Set **`worker.enabled: true`** in the host config to permit the worker command to run. The module default is `false`.

```ts
// src/config/resize.ts
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';

export default {
  ...defaultResizeConfig,
  mediaModelName: 'File',
  worker: {
    ...defaultResizeConfig.worker,
    enabled: true,
  },
};
```

This boolean permits worker execution; it does not start a worker in the API. You still launch the separate command below. The API and worker can share this config, and API reads can enqueue regardless of `worker.enabled`.

### 3. Initialize the CLI and start the worker

`src/server.ts` initializes your HTTP process. The worker runs through `src/cli.ts`, so it needs its own `Resizer` construction before the command runs:

```ts
// src/cli.ts
import Cli from '@adaptivestone/framework/Cli.js';
import folderConfig from './folderConfig.ts';

const cli = new Cli(folderConfig);
// Load config first. The selected command still controls model initialization.
await cli.server.init({ isSkipModelInit: true, isSkipModelLoading: true });
await import('./resizer.ts');
const result = await cli.run();
process.exit(result ? 0 : 1);
```

The scaffolded `ResizeWorker` command requests model initialization and uses the active `Resizer`. Run it alongside the API:

```bash
npm run cli ResizeWorker
```

This is a long-running process; keep it supervised by your process manager/container deployment. Starting the API alone does not run it.

#### Named queues {/* #named-queues */}

Every task records the `Resizer` that created it and the **queue** it waits in. A queue is just a name; when none is given it is `'default'`.

| What you want | How |
|---|---|
| Send one Resizer's work to another queue | `new Resizer({ …, queue: 'bulk' })` |
| Send one call's work to another queue | `prewarm({ media, sizes, queue: 'bulk' })`; `resolve()` and `enqueueRequired()` accept `queue` too |
| Consume the default queue | `npm run cli ResizeWorker` (consumes only `'default'`) |
| Consume another queue | `npm run cli ResizeWorker -- --queue=bulk` (consumes only `'bulk'`) |

A common split keeps uploads and reads on `'default'` and sends a large backfill to `'bulk'` with its own worker, so the backfill never delays fresh uploads. The same request queued on two queues becomes two tasks.

Any number of workers, on any number of servers, can consume one queue; each task is held by one worker at a time. If a worker dies mid-task, its lease expires and another worker takes the task, so delivery is at-least-once and generation skips previews that already exist.

One worker process serves **every** `Resizer` constructed in it and runs each task with the Resizer named in it. Those Resizers must share one transport instance; otherwise the worker refuses to start (`RESIZE_WORKER_TRANSPORTS_DIFFER`). Construct every Resizer in both the API and the worker process: a task for a Resizer the worker does not know fails with `RESIZE_NO_RESIZER` and eventually dead-letters.

### 4. Read using `resolve()`

Use the [same read example](#reading-the-resolve-result): pass your loaded media document, `thumbnailSizes`, and `previewFormats`. No special lazy-read method is needed. With the transport configured, missing variants are enqueued by default.

The return value is still **`{ decision, output }`**: ready URLs and missing variants now, not the worker's eventual generation result. You will not receive `created` or `failed` from a lazy read.

### How background generation works {/* #how-it-works */}

Lazy reads and pre-warming use the same background path; the caller starts it at different times:

<div className="resize-diagram resize-diagram--sequence" role="region" aria-label="Lazy and pre-warm calls do not wait for background generation" tabIndex={0}>

```mermaid
sequenceDiagram
  accTitle: Queueing and background generation are separate
  accDescr: Resolve on a read or prewarm after upload enqueues a missing thumbnail and returns its own result without waiting for generation. A separate worker takes the task, creates the preview, and saves metadata. A later resolve with freshly loaded media returns a ready URL.
  participant App as Your app
  participant Resizer
  participant Queue
  participant Worker
  alt Lazy: a reader needs a thumbnail
    App->>Resizer: resolve()
    Resizer->>Queue: Enqueue missing WebP
    Queue-->>Resizer: Accepted
    Resizer-->>App: ready: []<br/>missing: [WebP]
  else Pre-warm: an upload was saved
    App->>Resizer: prewarm()
    Resizer->>Queue: Enqueue missing WebP
    Queue-->>Resizer: Accepted
    Resizer-->>App: enqueued: 1
  end
  Note over App,Worker: The caller does not wait for image generation
  Queue->>Worker: Task becomes available
  Worker->>Worker: Load media + original
  Worker->>Worker: Resize + upload<br/>Append previews[]
  Note over App,Worker: After generation: reload the media on a later request
  App->>Resizer: resolve()
  Resizer-->>App: URL in decision.ready
```

</div>

The queue example assumes one missing thumbnail, a successful enqueue, and no hooks. The worker may start as soon as the task is queued; the diagram separates its work to show what the caller awaits. The lazy return label abbreviates `decision.ready` and `decision.missing`; `output` is `undefined` without a formatting hook. `prewarm()` returns only its count.

For one photo missing its `320×320` WebP thumbnail:

1. Your DTO builder calls `resolve()`. It finds no matching stored preview.
2. It acquires a dispatch lock for that variant and passes it to the transport in one task for this media. It awaits that queue work.
3. It returns `ready: []` and a `missing` entry. Your app can respond with its own placeholder.
4. The worker loads the media by ID, downloads the original, generates/uploads the WebP, and appends its metadata to `previews[]`.
5. A later request loads the updated media and calls `resolve()` again. The ready entry now has a URL.

Multiple missing variants for one media are grouped into one enqueue call after lock filtering. Three missing formats can be one task, not three. The module does not poll the browser, refresh an already-returned DTO, or invalidate your app's caches. Arrange a fresh read if an open page should pick up completed work.

### For large listing pages

Resolve the current page's media and request only the sizes shown by that view. `resolve()` reads the document supplied by the caller; it does not fetch missing `original`/`previews` fields from MongoDB.

```ts
import {
  formatPictureUrls, getResizer, resizeMediaPaths,
} from '@adaptivestone/framework-module-resize';
import { previewFormats, thumbnailSizes } from './mediaSizes.ts'; // adjust the path

// File is your host model; query includes your access and pagination filters.
const files = await File.find(query)
  .select([...resizeMediaPaths, 'name'])
  .limit(20)
  .lean(); // Keep _id selected.

const pictures = [];
for (const file of files) {
  const { decision } = await getResizer().resolve({
    media: file,
    sizes: thumbnailSizes,
    formats: previewFormats,
  });
  pictures.push(formatPictureUrls(decision, { id: String(file._id) }));
}
```

A page of 20 uncached photos with one thumbnail format can request 20 variants in up to 20 tasks. With three formats it can request 60 variants in up to 20 tasks. Existing previews, held locks, hooks, and original handling can reduce those counts.

The example processes a bounded page sequentially. If you parallelize reads, bound that concurrency too: queueing involves I/O. Browser `loading="lazy"` does not defer backend queue writes already performed while building the response. Use `enqueueMissing: false` for reads that must avoid dispatch locks and queue writes, and arrange generation separately. Hooks and any authorized original signing still run.

## Pre-warm: request background generation at upload {/* #reading-the-prewarm-result */}

Use the **same transport and worker setup as lazy mode**, but call `prewarm()` after saving the original and media document. This gives the worker a head start before the first reader arrives. It does not guarantee generation finishes before that read. See the [shared queue flow diagram](#how-it-works).

```ts
import { getResizer } from '@adaptivestone/framework-module-resize';
import { previewFormats, thumbnailSizes } from './mediaSizes.ts'; // adjust the path

const { enqueued } = await getResizer().prewarm({
  media: fileDoc,
  sizes: thumbnailSizes,
  formats: previewFormats,
});
```

### What `enqueued` means

`enqueued` is a **number of variants handed successfully to the transport by this call**, after dispatch-lock filtering. Our one-size, one-WebP example returns this if the thumbnail is missing, its lock is acquired, and the transport accepts it:

```json
{ "enqueued": 1 }
```

With all three formats missing and accepted, it returns `{ enqueued: 3 }`, even though those variants are grouped into one task for that media. Mongo may reuse an identical active task, so this is neither a count of new task rows nor a count of generated files.

`prewarm()` waits for hooks, locks, and the transport call, then returns. **There are no `created` or `failed` fields**: image processing happens later in the worker. Use worker logs/task observers to monitor failures. To display previews, load the updated media and call `resolve()`.

`{ enqueued: 0 }` means this call reported no variants handed successfully to the transport. It can mean all variants already exist, held locks, no original `storageRef`, no transport, or a logged internal failure. Zero alone cannot distinguish those cases. `prewarm()` catches internal failures so queue problems do not reject the upload flow. When you need to tell them apart, use `enqueueRequired()` below.

You can pre-warm just thumbnails and let detail-page reads lazily request larger variants. `generate()` and `prewarm()` both skip stored identities; neither uses the [original-already-fits shortcut](#originals-and-private-access) used by `resolve()`.

### When the upload must know the work is queued {/* #enqueue-required */}

`enqueueRequired()` takes the same options as `prewarm()`, but reports every requested variant instead of a count:

```ts
import { getResizer } from '@adaptivestone/framework-module-resize';

const result = await getResizer().enqueueRequired({
  media: fileDoc,
  sizes: thumbnailSizes,
  formats: previewFormats,
});

if (result.status === 'incomplete') {
  // result.unconfirmed lists the variants with no confirmed task;
  // result.issues says why, and whether a retry can help (issue.retryable).
}
```

| `status` | Meaning |
|---|---|
| `'ready'` | Nothing needs queueing, and at least one requested variant is already stored |
| `'accepted'` | Every variant that needs queueing is covered by a confirmed task (`result.tasks` holds the task IDs) |
| `'not-required'` | Nothing is stored and nothing needs queueing: the request was empty (`reason: 'empty-request'`), or the `beforeEnqueue` hook removed everything (`reason: 'filtered'`) |
| `'incomplete'` | At least one variant has no confirmed task, for example no transport, no original, or a lock held elsewhere; see `unconfirmed` and `issues` |

The arrays `ready`, `accepted`, `notRequired`, and `unconfirmed` split the requested catalog. A lock held by another request never counts as queued. With Mongo, the module checks the active task rows to confirm such variants; SQS cannot, so those variants come back `unconfirmed` with a retryable issue. Delivery is still at-least-once, not exactly-once. Unlike `prewarm()`, `enqueueRequired()` is not wrapped in a never-throw guard: a media without `id`/`_id`, for example, throws.

## Method inputs at a glance

| Option | Methods | Type and meaning |
|---|---|---|
| `media` | All, required | `MediaLike`: your loaded/saved media document, including `id` or `_id`. "All" means `generate()`, `prewarm()`, `enqueueRequired()`, and `resolve()`. |
| `sizes` | All, required | `SizeInput[]`: the fixed catalog for this operation |
| `formats` | All, optional | `PreviewFormat[]`: overrides the configured formats for this call |
| `pipeline` | All, optional | `string`: registered processing name; defaults to `'default'` |
| `ctx` | All, optional | `Record<string, unknown>`: caller context for hooks; eager steps receive it too. It is not stored in queue tasks. |
| `persist` | `generate()` only | `boolean`, default `true`: whether to save generated metadata; `false` still uploads files |
| `enqueueMissing` | `resolve()` only | `boolean`: defaults to `true` with a transport and `false` without one |

Setting `enqueueMissing: true` cannot create a missing transport. Passing a pipeline name does not create its processing functions; register them in the processes that generate images.

## Storage and queue drivers {/* #drivers--seams */}

Supply drivers when constructing a `Resizer`. `storage` is required. `transport` is optional for eager hosts. `createFrameworkResizer` adds the framework media store, and with a transport the framework lock provider; pass your own to replace them.

| Constructor option | Shipped implementations | Purpose |
|---|---|---|
| `storage` | `LocalFsStorage`, `S3Storage` | Read originals, upload previews, build URLs |
| `transport` | `MongoTransport`, `SqsTransport` | Accept tasks and run the worker's consumption loop |
| `mediaStore` | `FrameworkMediaStore` | Load media and append preview metadata; checks `mediaModelName` when the worker starts |
| `lockProvider` | `FrameworkLockProvider` | Coordinate dispatch and worker attempts |

### S3 storage

Install the optional peers when using S3:

```bash
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Replace the storage option in your existing construction site:

```ts
import { S3Storage } from '@adaptivestone/framework-module-resize/storage/s3.js';

const storage = new S3Storage({
  bucketPublic: 'my-cdn',
  bucketPrivate: 'my-originals',
  publicBaseUrl: 'https://cdn.example.com',
});
// Pass this as `storage` to the existing new Resizer({ ... }).
```

Use your real bucket names and CDN URL. Credentials/region come from the AWS SDK configuration, or pass a configured `client`. The host creates the buckets and access/CDN policies. `publicBaseUrl` builds URLs; it does not make a bucket public. The old option name `publicUrl` is deprecated.

S3 stores `{ bucket, key }` (plus `namespace` when you pass one) in `storageRef`. Private originals go to `bucketPrivate`, which must differ from `bucketPublic`; a private upload without a distinct private bucket throws. Generated previews go to `bucketPublic`. Reads and downloads accept only these two buckets, so a tampered `bucket` value cannot reach another bucket. API and worker must use compatible storage settings and permissions.

### SQS instead of Mongo tasks

```bash
npm i @aws-sdk/client-sqs sqs-consumer
```

```ts
import { SqsTransport } from '@adaptivestone/framework-module-resize/transports/sqs.js';

const transport = new SqsTransport({
  queueUrl: 'https://sqs.eu-west-1.amazonaws.com/123456789012/resize', // the 'default' queue
  queues: { bulk: 'https://sqs.eu-west-1.amazonaws.com/123456789012/resize-bulk' }, // optional
  region: 'eu-west-1',
});
// Pass this as `transport` to the existing new Resizer({ ... }).
```

Use your actual queue URL/region and run the same worker command. `queueUrl` serves the `'default'` [queue](#named-queues); `queues` maps other queue names to their URLs, and an unknown name throws `RESIZE_SQS_QUEUE_UNKNOWN`. SQS does not require the Mongo `ResizeTask` model. It still uses the framework media store and locks unless you replace those drivers. Configure visibility timeout, heartbeat, retries, and DLQ/redrive in SQS/the driver; Mongo queue settings do not configure them.

Custom drivers implement the exported `ResizeStorage`, `QueueTransport`, `MediaStore`, or `LockProvider` contract. They can be objects or classes and close over their own clients; no `app` argument is passed.

- **Storage:** `storageRef` is opaque to the module. Your driver returns any JSON-compatible locator from `upload()` and receives it back unchanged in `download()`, `publicUrl()`, and `signedUrl()`. `upload()` also receives optional hints: `namespace` from `uploadOriginal()`, or `parentRef` (the original's ref) when the worker stores a preview. The optional `canServeOriginalPublicly` tells the reader whether an original is public; without it, originals are treated as private.
- **Media store:** implement `load` and `appendPreviews`. The optional `verify()` runs once when the worker starts; throw there to stop the worker before it takes any task.
- **Queue transport:** `enqueue(task)` receives `{ resizer, queue, mediaId, pipeline, previews }`; store `resizer` and `queue` with the task. `startWorker(handle, { signal, queue, onEvent })` consumes only that queue, hands `handle` tasks that carry `resizer` and `queue` (missing means `'default'`), and reports `onEvent('completed' | 'failed' | 'deadLettered', task, error?)` instead of calling hooks; the worker routes each event to the owning Resizer. An optional `findActive(task)` lets `enqueueRequired()` confirm work queued by another request.

See the package [driver reference](https://github.com/adaptivestone/framework-module-resize#drivers--seams) for all options and subpaths.

## Custom processing: pipelines, filters, and hooks {/* #pipelines--hooks */}

Most apps can use the default resize/encode behavior without registering anything here.

A **pipeline** is named image-processing code. `beforeSteps` receive the source buffer, loaded media, metadata, and context; they run once per generation call/task before resizing. `variantSteps` receive the Sharp image plus `variant`/`ctx`; they run per variant after resize and before encoding. Put watermarks in `variantSteps` so their size is appropriate for each output.

A **filter** is a host-defined value identifying an alternate rendering. `{ blur: 40 }` does not blur anything by itself: your pipeline must implement that meaning.

```ts
// Register after construction in shared setup (API and worker).
import { getResizer } from '@adaptivestone/framework-module-resize';

getResizer().registerPipeline('photo', {
  variantSteps: [
    (img, { variant }) => variant.filters?.blur
      ? img.blur(Number(variant.filters.blur))
      : img,
  ],
});

// In a DTO builder: request a fixed, allowed alternate rendering.
const { decision } = await getResizer().resolve({
  media: fileDoc,
  pipeline: 'photo',
  sizes: [{ width: 320, height: 320, filters: { blur: 40 } }],
  formats: ['webp'],
});
```

Map this filtered decision yourself; `formatPictureUrls()` deliberately excludes filtered entries because its size/format map cannot distinguish them.

Within a media document, preview identity is **Resizer + pipeline + size key + format + canonical filters**. Each generated preview records the `resizer` and `pipeline` that rendered it, so `pipeline: 'watermark'` and `pipeline: 'default'` keep separate previews of the same photo at the same size, and so do two Resizers. A preview stored without these fields belongs to the default Resizer and pipeline. Changing pipeline code or encode quality does not invalidate existing previews automatically; give the pipeline a new name (for example `watermark-v2`) to regenerate its images.

Queued tasks carry the pipeline name and requested variants, not functions or `ctx`. Register the processing code in the worker too. An unknown name uses an empty pipeline and does not throw. Queued steps receive `ctx === {}`; persist per-media data for `beforeSteps` on the media document, and carry per-variant settings in your allowed filters. Eager `generate()` passes the caller's real context to both kinds of steps.

**Hooks** customize method inputs, responses, or observation. Register with `getResizer().hook(name, fn)` or the constructor's `hooks` option. Signatures are inferred from the hook name.

| Hook | When it runs | What it returns |
|---|---|---|
| `resolveSizes` | `generate()`, `prewarm()`, and `resolve()`; caller context | The size array to use |
| `beforeEnqueue` | `prewarm()` and `resolve()` (even with enqueueing disabled); caller context | The missing-variant array to keep |
| `formatPublicUrls` | `resolve()`; caller context | The value returned as `output` |
| `onPreviewGenerated` | After persistence in eager/worker generation; context `{}` | Ignored; receives the new `Preview` |
| `afterTaskComplete` | After a queued task stored every requested variant | Ignored; receives `LeasedTask` and context `{}` |
| `onTaskFailed` | Mongo retryable attempt or SQS handler failure | Ignored; receives task, error, and context `{}` |
| `onTaskDeadLettered` | Mongo terminal/exhausted task | Ignored; receives task, error, and context `{}` |

Taps run in registration order and are awaited. Thrown hook errors are logged and isolated. Observers also emit framework events named `resize:<hookName>`. SQS DLQ transitions are not observed by this module and do not emit `onTaskDeadLettered`.

## Originals and private access

Generated previews are public objects. The host must authorize which media may be processed and returned. Original files have these additional read rules:

- **SVG is untrusted input.** An SVG file can carry scripts and external references, so the module never serves SVG markup, not even to the owner. `uploadOriginal()` accepts SVG only with `visibility: 'private'`. Generation (eager or worker) renders it into your raster formats like any other original, and reads return those raster previews. Until they exist, SVG variants appear in `decision.missing` and are queued like raster ones. Rendering does not load files or URLs referenced inside the SVG. The stored private original is not sanitized; do not serve it yourself.
- **A raster original already fits:** when no preview exists, a request with both width and height, no filters, and no `fit: true` can use the original if its known dimensions are both within the box. Width-only, height-only, and fit requests do not use this shortcut. Pipeline steps do not run on an original-backed response.

An original must be publicly servable or accessible through an authorized signed URL. The S3 driver recognizes its public bucket and does not expose private originals anonymously. With a signing-capable driver, server-derived `ctx.isOwner` or `ctx.isAdmin` permits a five-minute signed original URL. Do not accept these flags from client input. Failed signing has no public-URL fallback for a private original. These original-backed reads apply to raster originals only; an SVG original is never returned.

Original-backed entries have `isOriginal: true`. Their `format` is the requested slot, while `contentType` describes the original bytes; use the latter for HTML MIME types.

## Without the framework {/* #without-the-framework */}

The package's main entry contains no framework code, so it also runs in a plain Node app. Construct every part yourself:

```ts
import { Resizer, runWorker } from '@adaptivestone/framework-module-resize';
import defaultResizeConfig from '@adaptivestone/framework-module-resize/config/resize.js';
import { MongoTransport } from '@adaptivestone/framework-module-resize/transports/mongo.js';

const resizer = new Resizer({
  config: { ...defaultResizeConfig, formats: ['webp'] },
  logger: console,
  storage,       // a shipped or custom storage driver
  mediaStore,    // load(id) + appendPreviews(id, previews) over your database
  transport: new MongoTransport({ model: ResizeTask }), // optional: queued modes only
  lockProvider,  // required with a transport
});

// Worker process:
await runWorker({ signal: shutdownController.signal });
```

`ResizeTask` is your own mongoose model with the fields and indexes of the package's `models/ResizeTask.js`. The framework adapter (`…/framework.js`) is just this wiring done for you.

## Configuration

The host's `src/config/resize.ts` spreads the module defaults from `@adaptivestone/framework-module-resize/config/resize.js` and adds `mediaModelName` plus your changes (`satisfies FrameworkResizeConfig`). A second Resizer can read its own file through `createFrameworkResizer({ configName: 'resizeListings' })`. The framework merges `resize.<NODE_ENV>.ts` (for example `resize.production.ts`) over that file: nested objects merge field by field and arrays **replace**. The module does not merge again. It validates the final object when `new Resizer()` runs and throws `ResizeConfigError` for anything missing or invalid. Per-call `formats` overrides `formats`.

| Option | Default | Meaning |
|---|---|---|
| `mediaModelName` | Required | Your host media model name |
| `formats` | `['jpeg', 'webp', 'avif']` | Formats generated when a call omits `formats`; each needs an `encode.formats` entry |
| `upload.maxBytes` | `26214400` (25 MiB) | Largest original `uploadOriginal()` accepts |
| `upload.formats` | `['jpeg', 'png', 'webp', 'avif', 'gif', 'svg']` | Original formats `uploadOriginal()` accepts, detected from the bytes |
| `maxSize` | `{ width: 2000, height: 1200 }` | Bounding box for `fit: true` |
| `encode.formats` | `jpeg: { quality: 80, mozjpeg: true, chromaSubsampling: '4:2:0' }`, `webp: { quality: 82, effort: 4 }`, `avif: { quality: 64, effort: 4 }` | Options passed to Sharp's encoder per format; quality numbers are not comparable across formats. `{}` keeps Sharp's defaults. |
| `encode.flatten` | `{ formats: ['jpeg'], background: '#ffffff' }` | Formats whose transparent pixels are flattened onto `background` |
| `limits.processingTimeoutSeconds` | `30` | Timeout for each Sharp operation |
| `worker.enabled` | `false` | Whether the worker command is permitted to run |
| `worker.concurrency` | `4` | Parallel variants per generation call/task, including eager calls |
| `worker.sharpConcurrency` | `1` | Sharp/libvips concurrency set when the worker starts |
| `queue.maxAttempts` | `5` | Mongo attempts before dead-letter |
| `queue.taskTimeoutMs` | `600000` | Mongo task timeout in milliseconds |

To change one encoder setting, spread the nested defaults:

```ts
encode: {
  ...defaultResizeConfig.encode,
  formats: { ...defaultResizeConfig.encode.formats, avif: { quality: 55, effort: 4 } },
},
```

Keys renamed since 0.2 now fail validation with `RESIZE_CONFIG_REMOVED_KEY` instead of being silently ignored:

| 0.2 key | Use instead |
|---|---|
| `webpAvifOnly: true` | `formats: ['webp', 'avif']` |
| `encode.quality.<format>` | `encode.formats.<format>.quality` |
| `encode.effort.<format>` | `encode.formats.<format>.effort` |
| `encode.mozjpeg`, `encode.chromaSubsampling` | `encode.formats.jpeg.mozjpeg`, `encode.formats.jpeg.chromaSubsampling` |
| `encode.flattenBackground` | `encode.flatten.background` |

Keep `queue.lockTtlMs.worker <= queue.leaseMs`; validation rejects the opposite. Storage buckets/URLs and SQS options belong on their drivers, not in resize config. See the [full config reference](https://github.com/adaptivestone/framework-module-resize#config-reference) for encode settings, limits, and queue timing.

## Errors

`generate()` can throw. `resolve()` and `prewarm()` catch and log internal failures, returning a safe read result or `{ enqueued: 0 }`; their results are not detailed error reports. Calling `getResizer()` before construction is a separate setup error outside those method guards.

| Error | Meaning |
|---|---|
| `ResizeSetupError` | Missing/duplicate Resizer or incorrect wiring |
| `ResizeConfigError` | Invalid or incomplete config, a removed 0.2 key, or a `mediaModelName` that names no registered model |
| `ResizeNoOriginalError` | Original absent or without a `storageRef`; extends `ResizeMediaError` |
| `ResizeOriginalError` | `uploadOriginal()` input is empty, unreadable, of a disabled format, or over a limit; extends `ResizeMediaError` |
| `ResizeMediaError` | Unusable media/source, including metadata/size validation failures |
| `ResizeGenerateError` | Eager generation produced no new previews, or a queued task left variants missing; carries numeric `failed` and `requested`, plus the `missing` identities |
| `ResizeStorageError` | Package-defined storage failure |
| `ResizeSecurityError` | Refused storage access, such as traversal or an unapproved bucket |

For example, distinguish an all-variants failure when handling eager generation:

```ts
import { getResizer, ResizeGenerateError } from '@adaptivestone/framework-module-resize';
import { previewFormats, thumbnailSizes } from './mediaSizes.ts'; // adjust the path

try {
  const result = await getResizer().generate({
    media: fileDoc,
    sizes: thumbnailSizes,
    formats: previewFormats,
  });
  console.info(`${result.created.length} new files, ${result.failed} variant failures`);
} catch (error) {
  if (error instanceof ResizeGenerateError) {
    console.error(`${error.failed} of ${error.requested} new variants failed`);
  }
  throw error; // Let your upload handler's error policy decide the response.
}
```

Package-defined errors extend `ResizeError` and have a stable `code`. Dependency or host pipeline failures may propagate without that type. Use `ResizeError.isResizeError(error)` to recognize package errors across duplicated package installations, where `instanceof` may not match.

## Helpers

- `formatPictureUrls(decision, { id?, mediaType? })` returns a `PictureUrls` map of ready, unfiltered URLs. It performs no generation or persistence.
- `resizeMediaPaths` is `['original', 'previews'] as const`; spread it into query projections and retain `id`/`_id`.
- `isCatalogCovered(media, sizes, formats, scope?)` returns whether every requested identity is stored, for the default Resizer and pipeline unless you pass `scope` (for example `{ resizer: 'default', pipeline: 'watermark' }`). It does not check storage objects, queue state, original permissions, or execute hooks. If hooks add sizes, checking only the unexpanded catalog is insufficient to skip generation.

The scaffold also supports `--check` for lazy integration files (`--check --eager` for eager), `--out <dir>`, `--eject` for an editable task model, and `--force` to overwrite existing files. By default it appends a guide pointer to the host's `AGENTS.md`; `--agents claude|print|skip` changes that behavior.

## Queue behavior and troubleshooting {/* #operations */}

Mongo tasks move `pending → processing → completed`, or return to `pending` with retry backoff. Exhausted attempts become `dead`. An existing media row without an original `storageRef` is dead-lettered on its first attempt; a deleted media row is a logged no-op completion.

A task completes only when **every requested variant is stored**. If some variants fail, the successful previews are saved, and the task fails with `ResizeGenerateError` (code `RESIZE_WORKER_INCOMPLETE`, listing the `missing` identities). It then retries with backoff; the next attempt generates only what is still missing. Variants that keep failing reach the dead-letter state. A completed task therefore means its whole request is ready.

Dispatch locks suppress concurrent requests per variant. Mongo also reuses identical active requests through a canonical `requestKey` and a partial unique index. That key includes media ID, pipeline, and the variants that survived dispatch locks. Different/overlapping catalogs may create separate tasks; legacy tasks without a key remain valid. Delivery is at-least-once, with the worker skipping identities already stored on the loaded media document.

The Mongo worker consumes one task at a time per process; `worker.concurrency` controls parallel variants within that task. Run more worker processes to process more media concurrently. Completed rows expire after roughly 24 hours and dead rows after roughly 30 days through the default model's TTL indexes. After fixing a dead task's cause, reload the media and call `prewarm()` with the allowed catalog to request what remains missing. Dead/completed rows do not block a fresh active request.

| Symptom | Check |
|---|---|
| Worker exits with “disabled” | Set `worker.enabled: true` in the host `src/config/resize.ts` |
| Worker reports no Resizer/transport | Construct the Resizer in the CLI process and configure its transport |
| Worker stops at start with `RESIZE_CONFIG_MEDIA_MODEL_UNKNOWN` | `mediaModelName` must name a model registered in the worker process |
| `new Resizer()` throws `RESIZE_CONFIG_REMOVED_KEY` | Rename the 0.2 key as shown in [configuration](#configuration) |
| Missing variants but no task rows | `enqueueMissing`, original `storageRef`, task/lock models, hooks, held dispatch locks, and enqueue logs; `enqueueRequired()` reports the reason per variant |
| Tasks remain pending | Worker process/enablement, matching API/worker database, and a worker for that task's queue (`--queue=<name>`) |
| Worker logs `RESIZE_NO_RESIZER` for a task | Construct that Resizer in the worker process too |
| Tasks repeatedly fail | Original access, image limits, registered pipeline code, and worker logs; `RESIZE_WORKER_INCOMPLETE` errors list the `missing` variants |
| A size is missing but no task is active | The request never included it: compare the requested size/format/filters with stored previews, or check for a dead task |
| Mongo has previews, response is empty | Query projection, stale media/DTO caches, and formatting of `decision`/`output` |
| Returned URL gives 404/403 | Filesystem/CDN/bucket access; readiness is based on metadata, not an object-existence probe |

To verify your first setup, save one raster original, generate/request one thumbnail, and inspect its `previews[]`. With a queue, also inspect the task and worker logs. Fetch the media again, resolve it, and open the returned URL.

Your app owns media replacement/invalidation, deletion of storage objects, access checks, and cache refresh. The module appends previews and does not clean up storage when media is deleted.
