import { Room, Client } from "colyseus";
import crypto from "crypto";

export class MyRoom extends Room {
  maxClients = 4;

  onCreate (options: any) {
    this.setSimulationInterval(() =>
      this.broadcast(crypto.randomBytes(2048).toString()), 100);
  }

  onJoin (client: Client, options: any) {
  }

  onLeave (client: Client, consented: boolean) {
  }

  onDispose() {
    return new Promise((resolve) => setTimeout(resolve, 10000));
  }

}
