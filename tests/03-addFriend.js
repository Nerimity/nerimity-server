const {FRIEND_REQUEST_PENDING, FRIEND_REQUEST_SENT}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('(Add user 2 from user 1) POST /api/friends/add', function() {

    it('responds with friend data', function(done) {

      checkEventForBothUsers(FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING).then(() => done());

      request.post(`/api/friends/add`)
      .send({username: global.user2.username, tag: global.user2.tag})
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    });

    it('returns an error when adding the user again.', function(done) {
      request.post(`/api/friends/add`)
      .send({username: global.user2.username, tag: global.user2.tag})
      .expect(400)
      .set('Authorization', global.userToken)
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