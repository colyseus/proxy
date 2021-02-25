import http from "http";
import { Room, Client, Delayed, matchMaker } from "colyseus";

interface MatchmakingGroup {
  averageRank: number;
  clients: ClientStat[],
  priority?: boolean;

  ready?: boolean;
  confirmed?: number;

  // cancelConfirmationTimeout?: Delayed;
}

interface ClientStat {
  client: Client;
  waitingTime: number;
  options?: any;
  group?: MatchmakingGroup;
  rank: number;
  confirmed?: boolean;
}

export class RankedLobbyRoom extends Room {
  /**
   * If `allowUnmatchedGroups` is true, players inside an unmatched group (that
   * did not reached `numClientsToMatch`, and `maxWaitingTime` has been
   * reached) will be matched together. Your room should fill the remaining
   * spots with "bots" on this case.
   */
  allowUnmatchedGroups: boolean = false

  /**
   * Evaluate groups for each client at interval
   */
  evaluateGroupsInterval = 2000;

  /**
   * Groups of players per iteration
   */
  groups: MatchmakingGroup[] = [];

  /**
   * name of the room to create
   */
  roomToCreate = "my_room";

  /**
   * after this time, create a match with a bot
   */
  maxWaitingTime = 15 * 1000;

  /**
   * after this time, try to fit this client with a not-so-compatible group
   */
  maxWaitingTimeForPriority?: number = 10 * 1000;

  /**
   * number of players on each match
   */
  numClientsToMatch = 4;

  // /**
  //  * after a group is ready, clients have this amount of milliseconds to confirm
  //  * connection to the created room
  //  */
  // cancelConfirmationAfter = 5000;

  /**
   * rank and group cache per-player
   */
  stats: ClientStat[] = [];

  onCreate(options: any) {
    if (options.maxWaitingTime) {
      this.maxWaitingTime = options.maxWaitingTime;
    }

    if (options.numClientsToMatch) {
      this.numClientsToMatch = options.numClientsToMatch;
    }

    this.onMessage("confirm", (client: Client, message: any) => {
      const stat = this.stats.find(stat => stat.client === client);

      if (stat && stat.group && typeof (stat.group.confirmed) === "number") {
        stat.confirmed = true;
        stat.group.confirmed++;
        stat.client.leave();
      }
    })

    /**
     * Redistribute clients into groups at every interval
     */
    this.setSimulationInterval(() => this.redistributeGroups(), this.evaluateGroupsInterval);
  }

  onAuth(client: Client, options: any, request: http.IncomingMessage) {
    const ip = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
    console.log({ip});
    return true;
  }

  onJoin(client: Client, options: any) {
    this.stats.push({
      client: client,
      rank: options.rank,
      waitingTime: 0,
      options
    });

    client.send("clients", 1);
  }

  createGroup() {
    let group: MatchmakingGroup = { clients: [], averageRank: 0 };
    this.groups.push(group);
    return group;
  }

  redistributeGroups() {
    // re-set all groups
    this.groups = [];

    const stats = this.stats.sort((a, b) => a.rank - b.rank);

    let currentGroup: MatchmakingGroup = this.createGroup();
    let totalRank = 0;

    for (let i = 0, l = stats.length; i < l; i++) {
      const stat = stats[i];
      stat.waitingTime += this.clock.deltaTime;

      /**
       * do not attempt to re-assign groups for clients inside "ready" groups
       */
      if (stat.group && stat.group.ready) {
        continue;
      }

      /**
       * Force this client to join a group, even if rank is incompatible
       */
      if (
        this.maxWaitingTimeForPriority !== undefined &&
        stat.waitingTime >= this.maxWaitingTimeForPriority
      ) {
        currentGroup.priority = true;
      }

      if (
        currentGroup.averageRank > 0 &&
        !currentGroup.priority
      ) {
        const diff = Math.abs(stat.rank - currentGroup.averageRank);
        const diffRatio = (diff / currentGroup.averageRank);

        /**
         * TODO: MAGIC NUMBERS ARE NOT WELCOME HERE!
         * figure out how to identify the diff ratio that makes sense
         */
        if (diffRatio > 2) {
          currentGroup = this.createGroup();
          totalRank = 0;
        }
      }

      stat.group = currentGroup;
      currentGroup.clients.push(stat);

      totalRank += stat.rank;
      currentGroup.averageRank = totalRank / currentGroup.clients.length;

      if (
        (currentGroup.clients.length === this.numClientsToMatch) ||

        /**
         * Match long-waiting clients with bots
         * FIXME: peers of this group may be entered short ago
         */
        (stat.waitingTime >= this.maxWaitingTime && this.allowUnmatchedGroups)
      ) {
        currentGroup.ready = true;
        currentGroup = this.createGroup();
        totalRank = 0;
      }
    }

    this.checkGroupsReady();
  }

  async checkGroupsReady() {
    await Promise.all(
      this.groups
        .map(async (group) => {
          if (group.ready) {
            group.confirmed = 0;

            /**
             * Create room instance in the server.
             */
            const room = await matchMaker.createRoom(this.roomToCreate, {});

            await Promise.all(group.clients.map(async (client) => {
              const matchData = await matchMaker.reserveSeatFor(room, client.options);

              /**
               * Send room data for new WebSocket connection!
               */
              client.client.send("seat", matchData);
            }));

            // /**
            //  * Cancel & re-enqueue clients if some of them couldn't confirm connection.
            //  */
            // group.cancelConfirmationTimeout = this.clock.setTimeout(() => {
            //   group.clients.forEach(stat => {
            //     this.send(stat.client, 0);
            //     stat.group = undefined;
            //     stat.waitingTime = 0;
            //   });
            // }, this.cancelConfirmationAfter);

          } else {
            /**
             * Notify all clients within the group on how many players are in the queue
             */
            group.clients.forEach(client => {
              client.client.send("clients", group.clients.length);
            });
          }
        })
    );
  }

  onLeave(client: Client, consented: boolean) {
    const index = this.stats.findIndex(stat => stat.client === client);
    this.stats.splice(index, 1);
  }

  onDispose() {
  }

}
