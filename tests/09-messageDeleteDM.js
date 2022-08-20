
module.exports = function () {
  describe('DELETE /api/channels/:channelId/messages/:messageId', function() {
    it('Don\'t allow user to delete friends message.', function(done) {
      request.delete(`/api/channels/${inbox.channel.id}/messages/${message2.id}`)
      .expect(403)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          done(err);
          return;
        }
        done();
      });
    });
    it('Delete own Message', function(done) {
      request.delete(`/api/channels/${inbox.channel.id}/messages/${message.id}`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          done(err);
          return;
        }
        done();
      });
    });
    it('Check if there is 1 message.', function(done) {
      request.get(`/api/channels/${inbox.channel.id}/messages`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        if (res.body.length !== 1) {
          console.log("ERR", "There should be 1 message.")
          done("There should be 1 message.");
          return
        }
        done();
      });
    });
  });
}
