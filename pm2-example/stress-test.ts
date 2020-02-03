import { Client, Room } from "colyseus.js";

// const client = new Client("wss://localhost");
const client = new Client("ws://localhost:8000");
// const client = new Client("ws://testing.raftwars.io");
const connections: Room[] = [];

const numClientsToMatch = 4;

async function joinRanked() {
  const ranked = await client.joinOrCreate("ranked", {});

  ranked.onLeave(() => console.log("left matchmaking"));

  ranked.onMessage((message) => {
    if (typeof(message)==="number") {
      console.log(message + "/" + numClientsToMatch);

    } else {
      console.log("let's consume seat reservation!");

      client.consumeSeatReservation(message).then((room) => {
        console.log("client joined!");
        ranked.send(1);
        room.onLeave(() => {
          connections.splice(connections.indexOf(room), 1);
          console.log("client left!");
        });
        connections.push(room);
      });
    }
  });

  return ranked;
}

async function timeout(ms: number = 50) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  for (let i = 0; i < 50; i++) {
    console.log("Let's join more 2 clients...");
    await Promise.all([joinRanked(), joinRanked()]);

    await timeout(5 + Math.floor(Math.random() * 30));
  }
})();


setInterval(() => console.log("Connections:", connections.length), 5000);
