import MockRedis from "ioredis-mock";
import { cleanUpNode, getNodeList, listen } from "../discovery";

jest.mock("ioredis", () => MockRedis);

describe("discovery", () => {
    const redis = new MockRedis("redis://127.0.0.1:6379");
    afterEach(redis.flushall);

    it("gets node list", async () => {
        await redis.sadd("colyseus:nodes", "pid1/addr1", "pid2/addr2");

        expect(await getNodeList()).toEqual([
            { processId: "pid1", address: "addr1" },
            { processId: "pid2", address: "addr2" },
        ]);
    });

    it("listens to new nodes", (done) => {
        const cb = jest.fn((action, node) => {
            expect(action).toBe("add");
            expect(node).toEqual({ processId: "pid1", address: "addr1" });
            done();
        });

        listen(cb);

        redis.publish(
            "colyseus:nodes:discovery",
            JSON.stringify("add,pid1/addr1"),
        );
    });

    it("cleans up nodes", async () => {
        await redis.sadd("colyseus:nodes", "pid1/addr1", "pid2/addr2");
        await redis.hset("roomcount", "pid1", 0);
        await redis.hset("roomcount", "pid2", 0);

        await cleanUpNode({ processId: "pid1", address: "addr1" });

        expect(await redis.sismember("colyseus:nodes", "pid1/addr1")).toBe(0);
        expect(await redis.sismember("colyseus:nodes", "pid2/addr2")).toBe(1);

        expect(await redis.hexists("roomcount", "pid1")).toBe(0);
        expect(await redis.hexists("roomcount", "pid2")).toBe(1);
    });
});
