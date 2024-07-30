# Deploy

There are mmultiple ways to deploy your app.

## On server

This is a simplest way. There a multiple option there but we are recomending pm2+nginx setup

### Pm2 setup

You need to install pm2 and make it autoload

```bash
npm install pm2@latest -g
pm2 startup
```

Then load you code to server and go to server directory

```bash
NODE_ENV=production pm2 start --name YOUR_APP_NAME src/index.js
pm2 save
```

That all from nodejs side. App already there and listen on a localhost:3000

### Nginx setup

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

You can create an docker image with all you data and run it on any server including kubernetes

docker file can looks like

```dockerfile
FROM node:latest
RUN mkdir -p /opt/app && chown -R node:node /opt/app
WORKDIR /opt/app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci
COPY --chown=node:node src/ ./src/
EXPOSE 3300
CMD [ "node", "src/index.js"]
```

To build it use

```bash
docker build --platform --platform linux/amd64,linux/arm64 -t YOUR_REPO_NAME:TAG .
```

As well you can use buildx

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_REPO_NAME:TAG . --push
```

They you can run it

```bash
docker run -it -p 3300:3300 YOUR_REPO_NAME:TAG
```
