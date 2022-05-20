module.exports = function () {
  describe('(Add user 2 from user 1) POST /api/friends/add', function() {

    it('responds with friend data', function(done) {
      request.post(`/api/friends/add`)
      .send({username: global.user2.username, tag: global.user2.tag})
      .expect(200)
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