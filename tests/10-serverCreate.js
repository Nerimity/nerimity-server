const { SERVER_JOINED } = require("../build/common/ClientEventNames");

module.exports = function () {
  describe('POST /api/servers', function() {

    it('Create a server', function(done) {

      
      global.socket.once(SERVER_JOINED, (payload) => {
        global.server = payload.server;
        done()
      })


      request.post(`/api/servers`)
      .send({name: "Test Server"})
      .expect(200)
      .set('Authorization', global.userToken)
      .end(function(err, res) {
        if(err) {
          console.log("ERR", res.body)
          done(err);
        }
      });
    })
  });
}