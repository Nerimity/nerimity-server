const {INBOX_OPENED}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('POST /api/users/:userId/open-channel', function() {
    it('Create DM channel for user 1', function(done) {

      global.socket.once(INBOX_OPENED, (inbox) => {
        global.inbox = inbox;
        done()
      })

      request.post(`/api/users/${user2._id}/open-channel`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    });
    it('Create DM channel for user 2', function(done) {

      global.socket2.once(INBOX_OPENED, (inbox) => {
        global.inbox2 = inbox;
        done()
      })

      request.post(`/api/users/${user._id}/open-channel`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    });
  });
}
