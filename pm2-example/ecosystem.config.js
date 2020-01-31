const os = require('os');

module.exports = {
  apps: [{
    name: "proxy",
    script: "./node_modules/@colyseus/proxy/bin/proxy",
    instances: os.cpus().length,
    exec_mode: 'fork',
    env: {
      // Required options:
      REDIS_URL: "127.0.0.1:6379",

      // SSL (optional)
      SSL_KEY: "/etc/certs/example.com/privkey.pem",
      SSL_CERT: "/etc/certs/example.com/fullchain.pem",
      SSL_PORT: 443,

      // Optional:
      PORT: 80,
    }
  }]
}
