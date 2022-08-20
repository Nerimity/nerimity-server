const { expect } = require("chai");
const { SERVER_CHANNEL_CREATED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers/:serverId/channels', function() {

    it('Create a server channel.', function(done) {

      checkEventForBothUsers(SERVER_CHANNEL_CREATED, SERVER_CHANNEL_CREATED).then(() => done());

      request.post(`/api/servers/${global.server.id}/channels`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        global.newServerChannelId = res.body.id;
      });
    })

    it('Create another server channel.', function(done) {

      checkEventForBothUsers(SERVER_CHANNEL_CREATED, SERVER_CHANNEL_CREATED).then(() => done());

      request.post(`/api/servers/${global.server.id}/channels`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        global.newServerChannelId2 = res.body.id;
      });
    })

    it('Error when member tries to create a server channel', function(done) {

      request.post(`/api/servers/${global.server.id}/channels`)
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
  });
}