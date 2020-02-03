/* PM2 config file */

module.exports = {
  apps : [
    /**
     * Colyseus processes
     */
    {
      name      : 'colyseus-app',
      script    : 'index.ts',
      exec_interpreter: "ts-node",
      watch     : false,
      instances : 3,
      exec_mode : 'fork',
      port      : 8080,
      env: {
        NODE_ENV: 'development',
        DEBUG: 'colyseus:errors,colyseus:matchmaking'
      },
    },

    /**
     * Proxy process
     */
    {
      port: 8000,
      name: 'proxy',
      script: './node_modules/@colyseus/proxy/bin/proxy',
      instances: 1, // os.cpus().length,
      exec_mode: 'fork',
      env: {
        // Required options:
        // HOST: "staging.raftwars.io",
        REDIS_URL: process.env.REDIS_URL,

        // // SSL (optional)
        // SSL_KEY: "/Users/endel/.localhost-ssl/localhost.key",
        // SSL_CERT: "/Users/endel/.localhost-ssl/localhost.crt",
      }
    }],

};
