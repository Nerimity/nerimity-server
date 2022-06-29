const {INBOX_OPENED}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('POST /api/users/:userId/open-channel', function() {
    it('Return the channel and emit inbox opened event.', function(done) {

      global.socket.once(INBOX_OPENED, () => {
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
  });
}