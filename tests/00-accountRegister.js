module.exports = function () {
  describe('(Create 2 Accounts) POST /api/users/register', function() {
    it('responds with token', function(done) {
      global.email = Math.random() + "@test.com"
      request.post(`/api/users/register`)
      .send({email: global.email, username: "user1", password: "test123"})
      .expect(200)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        } else {
          global.userToken = res.body.token;
          done();
        }
      });
    });
    // create 2 accounts to test other routes.
    it('responds with another token', function(done) {
      global.email2 = Math.random() + "@test.com"
      request.post(`/api/users/register`)
      .send({email: global.email2, username: "user2", password: "test123"})
      .expect(200)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        } else {
          global.userToken2 = res.body.token;
          done();
        }
      });
    });
    it('Send bad request to check errors.', function(done) {
      request.post(`/api/users/register`)
      .send({})
      .expect(400)
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