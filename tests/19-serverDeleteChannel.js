const { expect } = require("chai");
const { SERVER_CHANNEL_DELETED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('DELETE /api/servers/:serverId/channels/:channelId', function() {


        
    it('Error when member tries to delete the channel', function(done) {

      request.delete(`/api/servers/${global.server._id}/channels/${global.newServerChannelId}`)
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


        
    it('Error when deleting the default channel', function(done) {

      request.delete(`/api/servers/${global.server._id}/channels/${global.newServerChannelId}`)
      .expect(403)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        done();
      });
    })




    it('Delete the channel', function(done) {

      checkEventForBothUsers(SERVER_CHANNEL_DELETED, SERVER_CHANNEL_DELETED).then(([data]) => {
        expect(data.channelId).to.equal(global.newServerChannelId2);
        done()
      });

      request.delete(`/api/servers/${global.server._id}/channels/${global.newServerChannelId2}`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
      });
    })



  });
}