const { expect } = require("chai");
const { SERVER_JOINED, SERVER_MEMBER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers/invites/:inviteId', function() {

    it('Join the server using the invite code', function(done) {

      checkEventForBothUsers(SERVER_MEMBER_JOINED, SERVER_JOINED).then(() => done());

      request.post(`/api/servers/invites/${global.serverInvite.code}`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
      });
    })


    it('Error when Joining the server twice', function(done) {
      request.post(`/api/servers/invites/${global.serverInvite.code}`)
      .expect(400)
      .set('Authorization', global.userToken2)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        done();
      });
    })
  });
}