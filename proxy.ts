import fs from "fs";
import http from "http";
import https from "https";
import httpProxy from "http-proxy";
import { getNodeList, listen, Node, Action } from "./discovery";

const HTTPS_PORT = 443;
const HTTP_PORT = Number(process.env.PORT || 80);
const SOCKET_TIMEOUT = Number(process.env.SOCKET_TIMEOUT || 30000); // 30 seconds default socket timeout

const processIds: { [id: string]: httpProxy } = {}

let currProxy: number = 0;
const proxies: httpProxy[] = [];

http.globalAgent = new http.Agent({ keepAlive: true });
https.globalAgent = new https.Agent({ keepAlive: true });

function getProxy (url: string) {
  let proxy: httpProxy | undefined;

  /**
   * Initialize proxy
   */
  const matchedProcessId = url.match(/\/([a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]+\?/);
  if (matchedProcessId && matchedProcessId[1]) {
    proxy = processIds[matchedProcessId[1]];
  }

  if (proxy) {
    console.debug("Room is at proxy", proxies.indexOf(proxy));
    return proxy;

  } else {
    currProxy = (currProxy + 1) % proxies.length;
    console.debug("Using proxy", currProxy, url);
    return proxies[currProxy];
  }
}

function register(node: Node) {
  // skip if already registered
  if (processIds[node.processId]) { return; }

  const [host, port] = node.address!.split(":");

  const proxy = httpProxy.createProxy({
    agent: http.globalAgent,
    target: { host, port },
    ws: true
  });

  proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
    /**
     * Prevent stale socket connections / memory-leaks
     */
    socket.on('timeout', () => {
      console.log("Socket timed out.");
      socket.end();
      socket.destroy();
    });
    socket.setTimeout(SOCKET_TIMEOUT);
  });

  proxy.on("error", (err, req) => {
    console.error(`Proxy error during: ${req.url}`);
    console.error(err.stack);
  });

  processIds[node.processId] = proxy;
  proxies.push(proxy);

  currProxy = proxies.length - 1;
}

function unregister(node: Node) {
  const proxy = processIds[node.processId];

  proxies.splice(proxies.indexOf(proxy), 1);
  delete processIds[node.processId];

  currProxy = proxies.length - 1;
}

// listen for node additions and removals through Redis
listen((action: Action, node: Node) => {
  console.debug("LISTEN", action, node);
  if (action === 'add') {
    register(node);

  } else if (action == 'remove') {
    unregister(node);
  }
})

// query pre-existing nodes
getNodeList().
  then(nodes => nodes.forEach(node => register(node))).
  catch(err => console.error(err));

const reqHandler = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const proxy = getProxy(req.url!);

  if (proxy) {
    proxy.web(req, res);

  } else {
    console.error("No proxy available!", processIds);
  }
};

const server = (process.env.SSL_KEY && process.env.SSL_CERT)
  // HTTPS
  ? https.createServer({
    key: fs.readFileSync(process.env.SSL_KEY, 'utf8'),
    cert: fs.readFileSync(process.env.SSL_CERT, 'utf8'),
  }, reqHandler)
  // HTTP
  : http.createServer(reqHandler);

server.on('error', (err) => {
  console.error(`Server error: ${err.stack}`);
});

server.on('upgrade', (req, socket, head) => {
  const proxy = getProxy(req.url!);

  if (proxy) {
    proxy.ws(req, socket, head);

  } else {
    console.error("No proxy available!", processIds);
  }
});

server.on('listening', () => console.debug("@colyseus/proxy listening at", JSON.stringify(server.address())));

/**
 * Create HTTP -> HTTPS redirection server.
 */
if (server instanceof https.Server) {
  server.listen(HTTPS_PORT);

  const httpServer = http.createServer((req, res) => {
    res.writeHead(301, { "Location": "https://" + req.headers['host']! + req.url });
    res.end();
  });
  httpServer.on('listening', () => console.debug("@colyseus/proxy http -> https listening at", 80));
  httpServer.listen(HTTP_PORT);

} else {
  server.listen(HTTP_PORT);
}
