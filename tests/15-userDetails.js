const { expect } = require("chai");
const { SERVER_JOINED, SERVER_MEMBER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('GET /api/users/:userId', function() {

    it('Get user details', function(done) {
      request.get(`/api/users/${global.user._id}`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        expect(res.body.mutualFriendIds).to.be.an('array')
        expect(res.body.mutualFriendIds).lengthOf(0);
        
        expect(res.body.mutualServerIds).to.be.an('array')
        expect(res.body.mutualServerIds).lengthOf(1);
        expect(res.body.mutualServerIds).to.include(global.server._id);
        
        done();
      });
    })
  });
}