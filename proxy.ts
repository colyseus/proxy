require('dotenv').config(); // load .env file
import { getNodeList, listen, Node, Action } from "./discovery";

const booleanString: {[k: string]: boolean} = {
  // true
  'true': true, 'yes': true, '1': true,

  // false
  'false': false, 'no': false, '0': false,
}

const host = process.env.HOST || "localhost";
const processIds: {[id: string]: string} = {}

/**
 * SSL
 */
const additionalOptions: any = {};
if (process.env.SSL_KEY) {
  additionalOptions.ssl = {
    port: process.env.SSL_PORT || 443,
    key: process.env.SSL_KEY,
    cert: process.env.SSL_CERT,
    http2: booleanString[process.env.USE_HTTP2 || "false"]
  };
}

/**
 * Initialize proxy
 */
const proxy = require('redbird')({
  port: Number(process.env.PORT || 80),
  resolvers: [function (host: string, url: string) {
    const matchedProcessId = url.match(/\/([a-zA-Z0-9\-_]+)\/[a-zA-Z0-9\-_]+\?/);
    if (matchedProcessId && matchedProcessId[1]) {
      return processIds[matchedProcessId[1]];
    }
  }],
  ...additionalOptions
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
