# @colyseus/proxy

Proxy and Service Discovery for Colyseus

<img src="architecture.png?raw=true" alt="Architecture representation" />

For a quickstart see [Configuring Proxy + Colyseus + PM2](#configuring-proxy--colyseus--pm2)

# Running the Proxy

The easiest way to get `@colyseus/proxy` running is to install it globally.

This can be done by running:

```
npm install -g @colyseus/proxy
```

Edit your runtime environment to contain the following environment variables:

- `PORT` is the port the proxy will be running on.
- `REDIS_URL` is the path to the same Redis instance you're using on Colyseus' processes.

Once installed it can be run with

```
colyseus-proxy
```

# Running the Proxy From Source

Clone, this project and install its dependencies:

```
git clone https://github.com/colyseus/proxy.git
cd proxy
npm install
```

Edit your environment to contain the following environment variables:

- `PORT` is the port the proxy will be running on.
- `REDIS_URL` is the path to the same Redis instance you're using on Colyseus' processes.

Start the proxy server:

```
npx ts-node proxy.ts
```

# Configuring Proxy + Colyseus + PM2

- Install `@colyseus/proxy` (`npm install --save @colyseus/proxy`)
- Configure `RedisPresence`
- Configure `MongooseDriver`
- Bind each instance of the server on a different port
- Use PM2 to manage Colyseus and Proxy instances

Configure the colyseus application:

```typescript
import { Server, RedisPresence } from "colyseus";
import { MongooseDriver } from "colyseus/lib/matchmaker/drivers/MongooseDriver"

// binds each instance of the server on a different port.
const PORT = Number(process.env.PORT) + Number(process.env.NODE_APP_INSTANCE);

const gameServer = new Server({
    presence: new RedisPresence({
        url: "redis://127.0.0.1:6379/0"
    }),
    driver: new MongooseDriver(),
})

gameServer.listen(PORT);
console.log("Listening on", PORT);
```

It's recommended to use PM2 to manage your server instances. PM2 allows to scale
Node.js processes up and down within your server.
PM2 can also be used to manage and scale up the proxy instances.

```
npm install -g pm2
```

Use the following `ecosystem.config.js` configuration:

```javascript
// ecosystem.config.js
const os = require('os');
module.exports = {
    apps: [
         {
            port        : 80,
            name        : "colyseus-proxy",
            script      : "./node_modules/@colyseus/proxy/bin/proxy",
            instances   : 1, // scale this up if the proxy becomes the bottleneck
            exec_mode   : 'cluster',
            env: {
                PORT: 80,
                REDIS_URL: "redis://127.0.0.1:6379/0"
            }
        },
        {
            port        : 8080,
            name        : "colyseus",
            script      : "lib/index.js", // your entrypoint file
            watch       : true,           // optional
            instances   : os.cpus().length,
            exec_mode   : 'fork',         // IMPORTANT: do not use cluster mode.
            env: {
                DEBUG: "colyseus:errors",
                NODE_ENV: "production",
            }
        }
    ]
}
```

Now you're ready to start multiple Colyseus proceses.

```
pm2 start
```

> If you're using TypeScript, compile your project before running `pm2 start`,
> via `npx tsc`.

You should see the following output, depending on the amount of processes your
server have:

```
[PM2][WARN] Applications colyseus not running, starting...
[PM2] App [colyseus] launched (2 instances)
┌──────────┬────┬─────────┬────────┬───┬─────┬───────────┐
│ Name     │ id │ mode    │ status │ ↺ │ cpu │ memory    │
├──────────┼────┼─────────┼────────┼───┼─────┼───────────┤
│ proxy    │ 0  │ cluster │ online │ 0 │ 0%  │ 7.4 MB    │
│ colyseus │ 1  │ fork    │ online │ 0 │ 0%  │ 15.4 MB   │
│ colyseus │ 2  │ fork    │ online │ 0 │ 0%  │ 12.3 MB   │
└──────────┴────┴─────────┴────────┴───┴─────┴───────────┘
Use `pm2 show <id|name>` to get more details about an app
```

Now, run `pm2 logs` to check if you don't have any errors.


## LICENSE

MIT
