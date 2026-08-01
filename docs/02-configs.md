# Configs

Every modern application runs on multiple environments and should have the ability to configure itself without changing the code.

## Config Files

Config files are located in ‘src/config/\{filename\}.(js|ts)’. Each config file is mostly unique, and you should refer to the module documentation (or the framework config section).

:::note

Config files are part of the [framework inheritance process](03-files-inheritance.md).

:::

## Environment Variables

Out of the box, the framework supports environment variables with [process.loadEnvFile](https://nodejs.org/api/process.html#processloadenvfilepath). This is part of Node.js since v20.12.0.

The framework will grab and parse the .env file in the root of the project directory to fill environment variables.

The sample project ships with a basic .env.example file.

:::tip

Do not use environment variables in the code. Use them only inside config files. This will allow you to track variables and split configs and the codebase.

:::

:::tip

Do not push the .env file to the version control system, as it can contain passwords and keys. The file should be unique per environment.
:::

:::tip

Try not to overload the .env file with configuration and keep only private data in it. To manage non-private data, check the [NODE_ENV](#node_env) section.
:::

## NODE_ENV

Depending on the NODE_ENV environment variable, the framework will load additional config files. Data from these files will be merged into the main config with an overwrite.

This is useful when you want to have something that depends on the environment but do not want to overload the .env file.

Also, it's a good practice to keep the basic config in files rather than in the .env file.

**Example:**

```js title="/src/config/sample.ts"
export default {
  variable1: 1,
  variable2: 2,
};
```

```js title="/src/config/sample.production.ts"
export default {
  variable2: 3,
  variable3: 4,
};
```

On a NON-production environment:

```js
const sampleConfig = this.app.getConfig("sample");
//     variable1: 1,
//     variable2: 2
```

On a PRODUCTION environment:

```js
const sampleConfig = this.app.getConfig("sample");
//     variable1: 1,
//     variable2: 3, <-- DIFFERENT
//     variable3: 4  <-- NEW
```

You can use the same approach for different environments (dev, stage, testing, etc.).

## API

```ts
getConfig(configName: string): Record<string, unknown>;
updateConfig(configName: string, config: Record<string, unknown>): Record<string, unknown>;
```

Returns the config based on the config name. It also caches it in memory.

```js
const sampleConfig = this.app.getConfig("sample");
```

Updates the config based on the config name. Returns the updated config.

```js
const sampleConfig = this.app.updateConfig("sample", {
  variableToUpdate: 3,
  anotherVariable: 4,
});
```

## Typed config

The base `getConfig(name)` signature is `Record<string, unknown>`, but the
framework's [type generation](10-cli.md) (`node src/cli.ts generatetypes`) emits
a `genTypes.d.ts` that types each call against your **actual** config file — so
`this.app.getConfig("http").port` is precise, with no cast.

The type is derived from the config's runtime **shape**, not its values, so a
secret value is never written into the generated file. A key read straight from
the environment with **no default** is a special case: at generation time
`process.env.X` may be unset, so the framework reads it from the config
**source** and types it honestly as `string | undefined`.

```ts title="/src/config/hubspot.ts"
export default {
  apiKey: process.env.HUBSPOT_API_KEY, // typed: string | undefined
  region: process.env.HUBSPOT_REGION ?? "eu", // has a default → typed: string
  baseUrl: "https://api.hubspot.com", // literal → typed: string
};
```

```ts
const { apiKey } = this.app.getConfig("hubspot");
// apiKey is `string | undefined` — guard it; no `as` cast needed
if (!apiKey) {
  throw new Error("HUBSPOT_API_KEY is not set");
}
```

:::tip

If a value is guaranteed present (you assert it at boot), add a non-null
assertion in the config so the generated type is `string`:

```ts
apiKey: process.env.HUBSPOT_API_KEY!, // typed: string
```

:::

:::note

Recovery follows only inline `process.env.X` reads in a config's own
default-exported object. A key whose env read is spread in from another config
(`{ ...baseConfig }`) or hidden behind an indirection isn't followed across that
boundary. Regenerate after changing a config's shape; `generatetypes --check`
fails CI if the committed types are stale.

:::

### Generated array and object shapes

Codegen widens a homogeneous array to a reusable array type. Its type therefore
describes the kind of entries the config contains without freezing the number
of entries that happened to be loaded during generation:

```ts title="/src/config/assets.ts"
export default {
  origins: ["https://one.example", "https://two.example"],
  dimensions: [
    [300, 300],
    [1080, 1080],
  ],
  endpoints: [
    { hostname: "one.example", secure: true },
    { hostname: "two.example", secure: false },
  ],
};
```

The generated shapes are `string[]`, `number[][]`, and
`{ hostname: string; secure: boolean }[]`, respectively. A production override
can therefore contain a different number of entries without creating a false
fixed-length tuple error.

Arrays whose entries have different generated types remain tuples. For example,
`["retries", 3]` becomes `[string, number]`, preserving the useful positional
types. An empty array becomes `unknown[]`: a runtime empty value provides no
evidence from which codegen could infer its element type.

Generated object properties remain exact. The framework intentionally does not
add a `[key: string]` index signature, because that would allow misspelled keys
and falsely claim that every possible string exists. When iterating a finite
generated object, narrow `Object.keys()` back to its real keys:

```ts
const { endpointsByRegion } = this.app.getConfig("assets");
const keys = Object.keys(endpointsByRegion) as Array<
  keyof typeof endpointsByRegion
>;

for (const key of keys) {
  const endpoint = endpointsByRegion[key];
}
```

If a config value is genuinely an open string dictionary rather than a finite
object, declare a local `Record<string, Value>` contract at that dynamic access
boundary. Codegen sees only the keys present in the loaded runtime value and
cannot safely infer that arbitrary future keys are supported.
