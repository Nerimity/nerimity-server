
module.exports = function () {
  describe('GET /api/channels/:channelId/messages', function() {
    it('Check if there are 2 messages.', function(done) {
      request.get(`/api/channels/${inbox.channel._id}/messages`)
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
          return;
        }
        if (res.body.length !== 2) {
          console.log("ERR", `${res.body.length} messages got created instead of 2.`)
          done(`${res.body.length} messages got created instead of 2.`);
          return
        }
        done();
      });
    });
  });
}
