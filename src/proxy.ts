import { getNodeList, listen, Node, Action } from "./discovery";

const host = process.env.HOST || "localhost";
const processIds: {[id: string]: string} = {}

const proxy = require('redbird')({
  port: Number(process.env.PORT || 80),
  resolvers: [function (host: string, url: string) {
    const matchedProcessId = url.match(/^\/([a-zA-Z0-9\-]+)\/[a-zA-Z0-9\-]+/);
    if (matchedProcessId && matchedProcessId[1]) {
      return processIds[matchedProcessId[1]];
    }
  }]
});

function register(node: Node) {
  const address = `http://${node.address}`;
  processIds[node.processId] = address;
  proxy.register(host, address);
}

function unregister(node: Node) {
  const address = processIds[node.processId];
  delete processIds[node.processId];
  proxy.unregister(host, address);
}

// listen for node additions and removals through Redis
listen((action: Action, node: Node) => {
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
