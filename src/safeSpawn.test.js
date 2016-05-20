"use strict";

var spawn = require("./safeSpawn");

describe('safeSpawn', function() {

  this.timeout(150);

  it('is resolved with child process when process outputs up message', function(done) {
    spawnFixture({ OUTPUT_UP: 1 })
    .nodeify(function(err, child) {
      if(err) {
        return done(err);
      }
      assert.isFunction(child.unref);
      done();
    })
  });

  it('is resolved with child process when process outputs up message with garbage around it', function(done) {
    spawnFixture({ OUTPUT_UP_WITH_GARBAGE: 1 })
    .nodeify(function(err, child) {
      if(err) {
        return done(err);
      }
      assert.isFunction(child.unref);
      done();
    })
  });

  it('is rejected if process exits malformed data', function(done) {
    spawnFixture({ OUTPUT_GARBAGE: 1 })
    .nodeify(function(err) {
      done(err ? null : new Error("should have been rejected")); 
    })
  });

  it('is rejected if process exits fail before data', function(done) {
    spawnFixture({ EXIT_WITH: 1 })
    .nodeify(function(err) {
      done(err ? null : new Error("should have been rejected")); 
    })
  });

  it('is rejected if process exits with explit error', function(done) {
    spawnFixture({ EXPLICIT_FAILURE: 1 })
    .nodeify(function(err) {
      if(err) {
        assert.equal(err.reason, "failed, sorry", "should have picked up explicit failure");
        done();
      } else {
        done(new Error("should have been rejected")); 
      }
    })
  });

  it('is rejected if process exits successfully before data', function(done) {
    spawnFixture({ EXIT_WITH: 0 })
    .nodeify(function(err) {
      done(err ? null : new Error("should have been rejected")); 
    })
  });


  it('is rejected with error if process cannot be started', function(done) {
    spawn("/usr/bin/notTHEREREREROAKSDOSKD", [], {}, { timeout: 75 })
    .nodeify(function(err) {
      if(err) {
        assert.notEqual(err.message, "Timeout");
        done();
      } else {
        done(new Error("should have been rejected")); 
      }
    })
  });

  it("is rejected with timeout if process doesn't send up", function(done) {
    spawnFixture({ DO_NOTHING: 1 })
    .nodeify(function(err) {
      if(err) {
        assert.equal(err.message, "Timeout");
        done();
      } else {
        done(new Error("should have been rejected")); 
      }
    })
  });

  function spawnFixture(env) {
    return spawn(process.execPath, [__dirname + "/../test/fixtures/safeSpawnFixture.js"], {
      env: env,
    }, {
      timeout: 130,
    });
  }
})
