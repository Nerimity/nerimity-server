const io = require('socket.io-client');
const {AUTHENTICATED, AUTHENTICATE_ERROR}  = require('../build/common/ClientEventNames');
const {AUTHENTICATE} = require('../build/common/ServerEventNames');

module.exports = function () {
  describe('Socket Authentication', function() {
    it('responds with user data', function(done) {

      global.socket = io.connect('http://localhost:80', {transports: ['websocket']})
      global.socket.on('connect', () => {
        global.socket.emit(AUTHENTICATE, {token: global.userToken})
      });
      global.socket.on(AUTHENTICATED, (data) => {
        global.user = data.user;
        done()
      });
      global.socket.on(AUTHENTICATE_ERROR, (error) => {
        done(new Error(error));
      });
    });

    it('responds with second user data', function(done) {

      global.socket2 = io.connect('http://localhost:80', {transports: ['websocket']})
      global.socket2.on('connect', () => {
        global.socket2.emit(AUTHENTICATE, {token: global.userToken2})
      });
      global.socket2.on(AUTHENTICATED, (data) => {
        global.user2 = data.user;
        done()
      });
      global.socket2.on(AUTHENTICATE_ERROR, (error) => {
        done(new Error(error));
      });
    });


    it('throws an error with bad token.' , function(done) {

      global.socket2 = io.connect('http://localhost:80', {transports: ['websocket']})
      global.socket2.on('connect', () => {
        global.socket2.emit(AUTHENTICATE, {token: "1234"})
      });
      global.socket2.on(AUTHENTICATE_ERROR, (error) => {
        done();
      });
    });
  });

}