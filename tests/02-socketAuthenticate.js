const io = require('socket.io-client');
const {AUTHENTICATED, AUTHENTICATE_ERROR}  = require('../build/common/ClientEventNames');
const {AUTHENTICATE} = require('../build/common/ServerEventNames');





module.exports = function () {
  describe('Socket Authentication', function() {
    it('responds with user data', function(done) {

      global.socket = io.connect('http://localhost:80', {transports: ['websocket']})
      global.socket.once('connect', () => {
        global.socket.emit(AUTHENTICATE, {token: global.userToken})
      });
      global.socket.once(AUTHENTICATED, (data) => {
        global.user = data.user;
        done()
      });
      global.socket.once(AUTHENTICATE_ERROR, (error) => {
        done(new Error(error));
      });
    });

    it('responds with second user data', function(done) {

      global.socket2 = io.connect('http://localhost:80', {transports: ['websocket']})
      global.socket2.once('connect', () => {
        global.socket2.emit(AUTHENTICATE, {token: global.userToken2})
      });
      global.socket2.once(AUTHENTICATED, (data) => {
        global.user2 = data.user;
        done()
      });
      global.socket2.once(AUTHENTICATE_ERROR, (error) => {
        done(new Error(error));
      });


      global.checkEventForBothUsers = (userOneEvent, userTwoEvent) => new Promise(resolve => {
        let eventCount = 0;
        let eventOneData = null;
        let eventTwoData = null;
        global.socket.once(userOneEvent, (data) => {
          eventCount++;
          eventOneData = data;
          if (eventCount === 2) {
            resolve([eventOneData, eventTwoData]);
          }
        })
        global.socket2.once(userTwoEvent, (data) => {
          eventCount++;
          eventTwoData = data;
          if (eventCount === 2) {
            resolve([eventOneData, eventTwoData]);
          }
        })
      })


    });


    it('throws an error with bad token.' , function(done) {

      const socket = io.connect('http://localhost:80', {transports: ['websocket']})
      socket.on('connect', () => {
        socket.emit(AUTHENTICATE, {token: "1234"})
      });
      socket.on(AUTHENTICATE_ERROR, (error) => {
        done();
      });
    });
  });

}