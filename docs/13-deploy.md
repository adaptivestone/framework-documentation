# Deployment and process lifecycle

Run each application process through exactly one supervisor. Docker,
Kubernetes, systemd, and PM2 already manage replica count and restarts, so they
should normally run the framework's single-process server entry. Use the
framework cluster runner only when one Node primary should supervise multiple
workers on the same host.

Do not nest supervisors. For example, do not run `runCluster()` inside PM2
cluster mode or start several clustered processes in one Kubernetes pod.

## Single process under an external supervisor (recommended)

Keep server construction in a dedicated module:

```ts title="src/server.ts"
import Server from '@adaptivestone/framework/server.js';
import folderConfig from './folderConfig.ts';

const server = new Server(folderConfig);
await server.startServer();
```

Run that entry directly:

```bash
NODE_ENV=production node src/server.ts
```

### PM2

Install PM2 and configure it to start with the host:

```bash
npm install pm2@latest -g
pm2 startup
```

Start one application process. PM2 owns its restart lifecycle:

```bash
NODE_ENV=production pm2 start src/server.ts --name YOUR_APP_NAME
pm2 save
```

If you choose PM2's own cluster mode, continue to run `src/server.ts`; do not
also use the framework cluster runner.

## Framework cluster runner

For a standalone Node deployment on one host, use the public Node-only
`runCluster()` helper:

```ts title="src/index.ts"
import { runCluster } from '@adaptivestone/framework/cluster.js';

await runCluster(
  async () => {
    // Dynamic import is important: this callback runs only in workers, so the
    // primary never constructs a Server or opens application connections.
    await import('./server.ts');
  },
  {
    workers: 'auto',
    shutdownTimeoutMs: 30_000,
  },
);
```

Start it without file watching:

```bash
NODE_ENV=production node src/index.ts
```

The primary forks the configured workers and the callback executes only in
those workers. An abnormal worker exit is restarted after a fixed safety delay;
exceeding the framework's fixed rolling crash limit shuts down the cluster with
a non-zero exit status. A clean worker exit is not restarted. Backoff, jitter,
and rolling-deployment policy belong to an external process supervisor and are
deliberately not part of this API.

On `SIGTERM` or `SIGINT`, the primary stops scheduling restarts and forwards the
signal to every worker. Each framework server stops accepting requests and
drains its open connections. Workers still alive after `shutdownTimeoutMs` are
force-terminated and the primary exits non-zero.

`workers: 'auto'` uses Node's available parallelism. A positive integer pins
the worker count. Early lifecycle messages use `console` by default. Pass an
`onEvent` callback to send structured primary, worker-exit, shutdown, and error
events to an observability provider before the application itself exists.

### Which entry should I run?

| Deployment | Entry | Process-count owner |
|---|---|---|
| Docker/Kubernetes | `src/server.ts` | Orchestrator |
| systemd | `src/server.ts` | systemd/unit replicas |
| PM2 fork or cluster mode | `src/server.ts` | PM2 |
| Standalone multi-core host | `src/index.ts` with `runCluster()` | Framework cluster primary |

## Nginx

The Node process listens on localhost port 3300 in the default configuration.
Proxy requests to it from Nginx:

```nginx
server {

	root /var/www/YOUR_FOLDER/src/public;

	server_name YOUR_SERVER_NAME;

	location / {
		# First attempt to serve request as file, then
		# as directory, then fall back to displaying a 404.
		try_files $uri $uri/ @backend;
	}

	location @backend {
		proxy_pass http://localhost:3300;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header  X-Forwarded-For $remote_addr;
		proxy_cache_bypass $http_upgrade;
	}

}
```

## Docker

You can create a Docker image with all your data and run it on any server, including Kubernetes.

Run one Node process per container and let the orchestrator scale replicas. The
Dockerfile can look like this:

```dockerfile
FROM node:latest
RUN mkdir -p /opt/app && chown -R node:node /opt/app
WORKDIR /opt/app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci
COPY --chown=node:node src/ ./src/
EXPOSE 3300
CMD ["node", "src/server.ts"]
```

To build it, use:

```bash
docker build --platform linux/amd64 -t YOUR_REPO_NAME:TAG .
```

You can also use `buildx`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_REPO_NAME:TAG . --push
```

Then you can run it:

```bash
docker run -it -p 3300:3300 YOUR_REPO_NAME:TAG
```
