const { expect } = require("chai");
const { SERVER_CHANNEL_CREATED, SERVER_CHANNEL_UPDATED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers/:serverId/channels/:channelId', function() {

    it('Update the channel', function(done) {

      checkEventForBothUsers(SERVER_CHANNEL_UPDATED, SERVER_CHANNEL_UPDATED).then(([data]) => {
        expect(data.updated.name).to.equal("Cool Channel");
        done()
      });

      request.post(`/api/servers/${global.server.id}/channels/${global.newServerChannelId}`)
      .expect(200)
      .send({name: "Cool Channel"})
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
      });
    })

    it('Error when member tries to update the channel', function(done) {

      request.post(`/api/servers/${global.server.id}/channels/${global.newServerChannelId}`)
      .expect(403)
      .send({name: "Not Cool Channel"})
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