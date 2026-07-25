// PM2 process definition — `pm2 start ecosystem.config.cjs --env production`
module.exports = {
  apps: [
    {
      name: "amia-bot",
      script: "dist/index.js",
      exec_mode: "fork", // a Discord gateway connection must not be clustered
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      // Wait longer between restarts each time instead of hot-looping on a
      // persistent failure (e.g. bad credentials).
      exp_backoff_restart_delay: 1000,
      max_memory_restart: "500M",
      time: true, // timestamp PM2's own log lines
      merge_logs: true,
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
