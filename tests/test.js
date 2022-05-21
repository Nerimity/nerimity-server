process.env.TEST = true;
let fs = require('fs');
const {main} = require('../build/index');

let chai = require('chai');
let supertest = require('supertest');


global.expect = chai.expect;

describe('Start Server',() => {
  it('Should return a server object', function (done) {
    this.timeout(60000);
    main().then(server => {
      done()
      
      global.server = server;
      global.request = supertest(server);
      const files = fs.readdirSync("./tests");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file === "index.js") continue;
        require(`./${file}`)?.()
      }
    })
  })
});


