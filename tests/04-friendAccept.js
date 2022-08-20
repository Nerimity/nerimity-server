const {FRIEND_REQUEST_ACCEPTED}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('POST /api/friends/:friendId', function() {

    it('Accept friend request', function(done) {

      checkEventForBothUsers(FRIEND_REQUEST_ACCEPTED, FRIEND_REQUEST_ACCEPTED).then(() => done());

      request.post(`/api/friends/${user.id}`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    });

    it('Error when accepting the friend request again', function(done) {
      request.post(`/api/friends/${user.id}`)
      .expect(400)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        } else {
          done();
        }
      });
    });
  });
}