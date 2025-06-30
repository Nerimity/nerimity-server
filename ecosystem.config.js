module.exports = {
  apps: [
    {
      name: 'neri-api-bun',
      script: 'bun',
      args: 'run bun:start-api-linux',
      watch: false,
    },
    {
      name: 'neri-ws-bun',
      script: 'bun',
      args: 'run bun:start-ws-linux',
      watch: false,
    },
  ],
};
