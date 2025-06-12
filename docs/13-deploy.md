# Deploy

There are multiple ways to deploy your app.

## On a Server

This is the simplest way. There are multiple options here, but we are recommending a PM2 + Nginx setup.

### PM2 Setup

You need to install PM2 and make it autoload.

```bash
npm install pm2@latest -g
pm2 startup
```

Then load your code to the server and go to the server directory.

```bash
NODE_ENV=production pm2 start --name YOUR_APP_NAME src/index.js
pm2 save
```

That is all from the Node.js side. The app is already there and listening on localhost:3300.

### Nginx Setup

```
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

The Dockerfile can look like this:

```dockerfile
FROM node:latest
RUN mkdir -p /opt/app && chown -R node:node /opt/app
WORKDIR /opt/app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci
COPY --chown=node:node src/ ./src/
EXPOSE 3300
CMD [ "node", "src/index.ts"]
```

To build it, use:

```bash
docker build --platform --platform linux/amd64,linux/arm64 -t YOUR_REPO_NAME:TAG .
```

You can also use `buildx`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_REPO_NAME:TAG . --push
```

Then you can run it:

```bash
docker run -it -p 3300:3300 YOUR_REPO_NAME:TAG
```
