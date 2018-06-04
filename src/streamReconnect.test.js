"use strict";

var reconnect = require("./streamReconnect");
var net = require("net");
var PORT = 19922;
var _ = require("lodash");
var chai = require("chai");
var assert = chai.assert;

describe("streamReconnect", function() {

  it("limits retries", function(done) {
    var attempt = 0;
    reconnect(function(err, connections, cb) {
      attempt += 1;
      cb(net.connect({ port: PORT }));
    }, {
      maxAttempts: 3,
      error: function(err) {
        assert.match(err.message, /too-many/);
        assert.equal(attempt, 3);
        done();
      },
    });
  });

  it("fires an initial connection", function(done) {
    reconnect(function(err, count) {
      assert.isUndefined(err);
      assert.equal(count, 0);
      done();
    }, {
      error: done,
    });
  });

  it("passes errors to the getStream function", function(done) {
    reconnect(function(err, count, cb) {
      if(err) {
        assert.match(err.message, /ECONNREFUSED/);
        done();
      }

      cb(net.connect({port: PORT}));
    }, {
      maxAttempts: 2,
      error: _.noop,
    });
  });
    
});
