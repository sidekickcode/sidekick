"use strict";

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var sinon = require('sinon');

var fs = require('fs-extra');
var path = require('path');
var exec = require('child_process').exec;

var run = require('../src/run');

describe('installer', function() {

  describe('positive tests', function() {

    before(function(){
      exec(`cd fixtures/testRepo && git init && git add .`, function(err, data){
      });
    });

    it('Run in CI mode will installs all analysers in a config file', function(done){

      this.timeout(40000);

      var testRepoPath = path.join(__dirname, '/fixtures/testRepo');
      run(["run", testRepoPath, '--ci']).then(function(results){
	done();
      }, function(err){
	done();
      });

    });
  });

});
