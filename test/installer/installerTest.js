"use strict";

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var sinon = require('sinon');

var fs = require('fs-extra');
var path = require('path');

var Installer = require('../../src/analysers/installer');

describe('installer', function() {

  describe('positive tests', function() {

    var TEST_ANALYSERS_INSTALL_DIR = path.join(__dirname, '../fixtures/analysers');

    before(function(){
      fs.removeSync(TEST_ANALYSERS_INSTALL_DIR);
    });

    it('Installs all analysers in a config file', function(done){
      var installer = new Installer(TEST_ANALYSERS_INSTALL_DIR);

      var downloading = sinon.spy();
      installer.on('downloading', downloading);

      var downloaded = sinon.spy();
      installer.on('downloaded', downloaded);

      var installing = sinon.spy();
      installer.on('installing', installing);

      var installed = sinon.spy();
      installer.on('installed', installed);

      var testRepoPath = path.join(__dirname, '../fixtures/testRepo');

      var prom = installer.installAnalysers(testRepoPath)
        .then(function(results){
          expect(downloading.called).to.be.true;
          expect(downloaded.called).to.be.true;
          expect(installing.called).to.be.true;
          expect(installed.called).to.be.true;

          expect(results.length).to.equal(3);
          done();
        });
      expect(prom).to.eventually.resolve;

    });
  });
});
