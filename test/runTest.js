"use strict";

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var sinon = require('sinon');

var fs = require('fs-extra');
var path = require('path');

var run = require('../src/run');

describe('installer', function() {

  describe('positive tests', function() {

    before(function(){
      fs.removeSync(path.join(__dirname, '../src/analysers/installed'));
    });

    it('Run in CI mode will installs all analysers in a config file', function(done){

      this.timeout(40000);

      var testRepoPath = path.join(__dirname, '/fixtures/testRepo');
      var testYargs = {"argv": {
        "_": ["run", testRepoPath],
        "ci": true
      }};

      run(testYargs);

    });
  });
});
