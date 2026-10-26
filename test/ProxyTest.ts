import assert from "assert";
import http from "http";
import net from "net";

const PROXY_PORT = 18080;

describe("Proxy", () => {
    let upstream: http.Server;

    before((done) => {
        // stub service discovery so the proxy has one node and never touches Redis
        upstream = http.createServer((req, res) => res.end("ok")).listen(0, () => {
            const discoveryPath = require.resolve("../discovery");
            require.cache[discoveryPath] = {
                id: discoveryPath, filename: discoveryPath, loaded: true,
                exports: {
                    getNodeList: async () => [{ processId: "p1", address: `127.0.0.1:${(upstream.address() as net.AddressInfo).port}` }],
                    listen: () => {},
                    cleanUpNode: async () => {},
                },
            } as any;
            process.env.PORT = String(PROXY_PORT);
            process.env.IP = "127.0.0.1";
            require("../proxy");
            setTimeout(done, 200);
        });
    });

    after(() => upstream.close());

    function rawRequest(raw: string): Promise<string> {
        return new Promise((resolve) => {
            let data = "";
            const socket: net.Socket = net.connect(PROXY_PORT, "127.0.0.1", () => socket.write(raw));
            socket.on("data", (chunk: Buffer) => data += chunk);
            socket.on("close", () => resolve(data));
            socket.on("error", () => resolve(data));
            setTimeout(() => { socket.destroy(); resolve(data); }, 300);
        });
    }

    it("proxies a valid request", async () => {
        assert.ok((await rawRequest("GET / HTTP/1.1\r\nHost: x\r\n\r\n")).startsWith("HTTP/1.1 200"));
    });

    it("survives an invalid URL in an HTTP request", async () => {
        const response = await rawRequest("GET http://[::1 HTTP/1.1\r\nHost: x\r\n\r\n");
        assert.ok(response.startsWith("HTTP/1.1 400"), response);
        assert.ok((await rawRequest("GET / HTTP/1.1\r\nHost: x\r\n\r\n")).startsWith("HTTP/1.1 200"));
    });

    it("survives an invalid URL in a WebSocket upgrade", async () => {
        await rawRequest("GET http://[::1 HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n");
        assert.ok((await rawRequest("GET / HTTP/1.1\r\nHost: x\r\n\r\n")).startsWith("HTTP/1.1 200"));
    });
});