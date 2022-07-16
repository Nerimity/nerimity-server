const { SERVER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers/:serverId/invites', function() {

    it('Error when creating invite from a user that is not in the server', function(done) {
      request.post(`/api/servers/${global.server._id}/invites`)
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


    it('Create a server invite', function(done) {
      request.post(`/api/servers/${global.server._id}/invites`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        global.serverInvite = res.body;
        done();
      });
    })
  });
}