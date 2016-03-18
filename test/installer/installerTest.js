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

  before(function(){
    //analysers are installed into a sub dir of the installer location in CI mode
    //fs.emptyDirSync('../../../../app/cli/ui/analysers/installed');
  });

  it('does stuff', function(done){
    var installer = new Installer(true);

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
