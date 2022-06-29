const {USER_PRESENCE_UPDATE}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('POST /api/users/presence', function() {

    it('Emit user presence to friend', function(done) {
      this.timeout(60000);


      checkEventForBothUsers(USER_PRESENCE_UPDATE, USER_PRESENCE_UPDATE).then(() => done());

      request.post(`/api/users/presence`)
      .expect(200)
      .send({status: 2})
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