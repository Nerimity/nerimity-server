module.exports = {
  apps: [
    {
      name: 'nerimity-server',
      script: 'npm',
      args: 'run start',
      watch: true,
      ignore_watch: ['node_modules', 'dist'],
    },
  ],
};
