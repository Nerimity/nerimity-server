const {FRIEND_REMOVED, FRIEND_REQUEST_SENT, FRIEND_REQUEST_PENDING}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('DELETE /api/friends/:friendId', function() {

    it('Remove the friend', function(done) {

      checkEventForBothUsers(FRIEND_REMOVED, FRIEND_REMOVED).then(() => done());

      request.delete(`/api/friends/${user._id}`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    });

    it('Error when trying to remove friend again', function(done) {
      request.delete(`/api/friends/${user._id}`)
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

    it('Add the friend', function(done) {

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



  });
}