module.exports = {
  apps: [
    {
      name: 'nerimity-api',
      script: 'npm',
      args: 'run start-api',
      watch: true,
      ignore_watch: ['node_modules', 'dist'],
    },
    {
      name: 'nerimity-ws',
      script: 'npm',
      args: 'run start-ws',
      watch: true,
      ignore_watch: ['node_modules', 'dist'],
    },
  ],
};
