"use strict";

const SAM = require('analyser-manager');
const _ = require('lodash');
const Promise = require('bluebird');

const EventEmitter = require('events');
const inherits = require('util').inherits;
const path = require('path');

const repoConfig = require("../../../core/config/repoConfig");

module.exports = exports = Installer;

function Installer(isCI) {
  var self = this;
  var analyserInstallDir = isCI ? path.join(__dirname, '/installed') : undefined; //don't override for non CI

  //on CI, install analysers to a subdir of our current location, otherwise the AM knows where to put things
  const AnalyserManager = new SAM(analyserInstallDir);

  EventEmitter.call(self);

  self.installAnalysers = function(repoPath) {
    return getConfig(repoPath)
      .then(function(config) {
        var allAnalysers = AnalyserManager.getAllAnalysersForConfig(config);

        AnalyserManager.on('downloading', function (data) {self.emit('downloading', data);});
        AnalyserManager.on('downloaded', function (data) {self.emit('downloaded', data);});
        AnalyserManager.on('installing', function (data) {self.emit('installing', data);});
        AnalyserManager.on('installed', function (data) {self.emit('installed', data);});

        var installPromises = _.map(allAnalysers, function (analyser) {
          return AnalyserManager.installAnalyser(analyser.name, analyser.version)
            .then(function (config) {
              //config contains {path, config} add to analyser to be {path, config, name, failCiOnError, version}
              return _.defaults(config, analyser);
            }, function (err) {
              //install failed
            });
        });

        return Promise.all(installPromises);
      });

    function getConfig(repoPath) {
      return new Promise(function(resolve, reject){
        var config = repoConfig.load(repoPath);
        resolve(config);
      });
/*      return RepoConfig.load(repoPath)
        .catch(function (e) {
          self.emit("error", e);
          return Promise.reject(e);
        });*/
    }
  }
}

inherits(Installer, EventEmitter);
