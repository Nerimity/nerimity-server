const { expect } = require("chai");
const { SERVER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('GET /api/servers/invites/:inviteId', function() {

    it('Get server invite details', function(done) {
      request.get(`/api/servers/invites/${global.serverInvite.code}`)
      .expect(200)
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