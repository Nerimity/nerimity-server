const { expect } = require("chai");
const { SERVER_UPDATED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers/:serverId', function() {

    it('Update the server', function(done) {

      checkEventForBothUsers(SERVER_UPDATED, SERVER_UPDATED).then(([data]) => {
        expect(data.updated.name).to.equal("Cool Server");
        expect(data.updated.defaultChannel).to.equal(global.newServerChannelId);
        done()
      });

      request.post(`/api/servers/${global.server._id}`)
      .expect(200)
      .send({name: "Cool Server", defaultChannel: global.newServerChannelId})
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
      });
    })

    it('Error when member tries to update the server', function(done) {

      request.post(`/api/servers/${global.server._id}`)
      .expect(403)
      .send({name: "Not Cool Server"})
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