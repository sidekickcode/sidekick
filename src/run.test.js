"use strict";
var run = require('../src/run');

describe("run command", function() {
    
  describe("parsing input", function() {
    it("disables travis and compare flags", function() {
      assert.instanceOf(run.flagsToCommand("/some/path", {
        versus: "x", "travis": true,
      }), Error);
    })

    it("supports travis", function() {
      assert.equal(run.flagsToCommand("/some/path", {
        "travis": true,
      }).travis, true);
    })
      
  })

});
