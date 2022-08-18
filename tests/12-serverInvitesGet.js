const { expect } = require("chai");
const { SERVER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('GET /api/servers/:serverId/invites', function() {

    it('Error when getting invites from a user that is not in the server', function(done) {
      request.get(`/api/servers/${global.server.id}/invites`)
      .expect(403)
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


    it('Get server invites', function(done) {
      request.get(`/api/servers/${global.server.id}/invites`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        expect(res.body).to.be.an('array').lengthOf(1);
        done();
      });
    })
  });
}