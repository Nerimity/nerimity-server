module.exports = {
  apps: [
    {
      name: 'neri-api',
      script: 'npm',
      args: 'run start-api',
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
    },
    {
      name: 'neri-ws',
      script: 'npm',
      args: 'run start-ws',
      watch: false,
      ignore_watch: ['node_modules', 'dist'],
    },
  ],
};
