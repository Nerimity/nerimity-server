process.env.TEST = true;
let fs = require('fs');
const {main} = require('../build/index');


describe('Serve Server',() => {
  it('Should return server object', function (done) {
    this.timeout(60000);
    main().then(server => {
      done()
      global.server = server;
      const files = fs.readdirSync("./tests");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file === "index.js") continue;
        require(`./${file}`)?.()
      }
    })
  })
});


