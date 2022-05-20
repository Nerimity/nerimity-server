module.exports = function () {
  describe('(Login to an account) POST /api/users/login', function() {
    it('responds with token', function(done) {
      request.post(`/api/users/login`)
      .send({email: global.email, password: "test123"})
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

    it('Send bad request to check errors.', function(done) {
      request.post(`/api/users/login`)
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