const {MESSAGE_CREATED}  = require('../build/common/ClientEventNames');

module.exports = function () {
  describe('POST /api/channels/:channelId/messages', function() {
    it('Send message to user 2', function(done) {

      checkEventForBothUsers(MESSAGE_CREATED, MESSAGE_CREATED).then(() => done());


      request.post(`/api/channels/${inbox.channel.id}/messages`)
      .expect(200)
      .set('Authorization', global.userToken)
      .send({content: 'Hello user 2!'})
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
        global.message = res.body;
      });
    });
    it('Send message to user 1', function(done) {

      checkEventForBothUsers(MESSAGE_CREATED, MESSAGE_CREATED).then(() => done());

      request.post(`/api/channels/${inbox.channel.id}/messages`)
      .expect(200)
      .set('Authorization', global.userToken2)
      .send({content: 'Hello user 1!'})
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
        global.message2 = res.body;
      });
    });
  });
}
