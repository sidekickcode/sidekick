"use strict";

const SAM = require('@sidekick/analyser-manager');
const repoConfig = require('@sidekick/common/repoConfig');

const _ = require('lodash');
const Promise = require('bluebird');

const EventEmitter = require('events');
const inherits = require('util').inherits;
const path = require('path');

module.exports = exports = Installer;

function Installer(analyserInstallLocation) {
  var self = this;

  const AnalyserManager = new SAM(analyserInstallLocation);
  //ensure install location exists
  AnalyserManager.init()
    .catch(function(err){
      throw Error('Unable to initialise AnalyserManager', err);
    });

  EventEmitter.call(self);

  self.installAnalysers = function(repoPath) {
    return repoConfig.load(repoPath)
      .then(function(config) {
        var allAnalysers = repoConfig.getAllAnalysers(config);

        AnalyserManager.on('downloading', function (data) {
          self.emit('downloading', data);}
        );
        AnalyserManager.on('downloaded', function (data) {self.emit('downloaded', data);});
        AnalyserManager.on('installing', function (data) {self.emit('installing', data);});
        AnalyserManager.on('installed', function (data) {self.emit('installed', data);});

        var installPromises = _.map(allAnalysers, function (analyser) {
          return AnalyserManager.installAnalyser(analyser.name, analyser.version)
            .then(function (config) {
              //config contains {path, config} add to analyser to be {path, config, name, failCiOnError, version}
              return _.defaults(config, analyser);
            })
        });

        return Promise.all(installPromises);
      });
  }
}

inherits(Installer, EventEmitter);
