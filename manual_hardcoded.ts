/**
 * This is a hardcoded alternative to using proxies + Colyseus.
 */
const processIds: {[id: string]: string} = {
  '0': "http://127.0.0.1:9000",
  '1': "http://127.0.0.1:9001",
  '2': "http://127.0.0.1:9002",
  '3': "http://127.0.0.1:9003"
}

const proxy = require('redbird')({
  port: Number(process.env.PORT || 80),
  resolvers: [function (host: string, url: string) {
    const matchedProcessId = url.match(/^\/([a-zA-Z0-9\-]+)\/[a-zA-Z0-9\-]+/);
    if (matchedProcessId && matchedProcessId[1]) {
      return processIds[matchedProcessId[1]];
    }
  }]
});

/**
 * Match-making
 */
proxy.register("localhost", "http://127.0.0.1:9000");
proxy.register("localhost", "http://127.0.0.1:9001");
proxy.register("localhost", "http://127.0.0.1:9002");
proxy.register("localhost", "http://127.0.0.1:9003");
