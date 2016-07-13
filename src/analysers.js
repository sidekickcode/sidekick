/**
 * outputs information on the installed analysers in CLI mode.
 */
"use strict";
const path = require('path');

const log = require("debug")("cli:analysers");

const _ = require("lodash");
const Promise = require('bluebird');

const EventEmitter = require("events").EventEmitter;

const analyserManager = require("@sidekick/analyser-manager");
const os = require("@sidekick/common/os");

const yargs = require("yargs");

const proxy = require("proxytron");

const reporters = Object.create(null);
reporters["cli-summary"]  = require("./reporters/cliSummary");
reporters["json-stream"]  = require("./reporters/jsonStream");
reporters["junit"]        = require("./reporters/junit");

module.exports = exports = function() {
  const command = parseInput();
  log("command: %j", command);

  const events = new EventEmitter;

  const reporter = getReporter(command.reporter);

  reporter(events, null, command);

  const INSTALL_LOCATION = path.join(os.userDataPath(), '/installed_analysers');
  const AM = new analyserManager(INSTALL_LOCATION);

  if(command.installAnalysers){
    events.emit('message', 'Fetching list of analysers to install..');

    proxy({
      from: AM,
      to: events,
      events: {
        downloading: null,
        downloaded: null,
        installing: null,
        installed: null,
      }
    });

    AM.init()
      .then(() => {
        log('analysers: ' + JSON.stringify(_.values(AM.ALL_ANALYSERS)));
        const analyserList = getAllAnalysers(_.values(AM.ALL_ANALYSERS));
        log('analysers: ' + JSON.stringify(analyserList));
        events.emit('message', `Found ${analyserList.length} analysers to install.\n`);
        Promise.all(_.map(analyserList, (analyser) => {
          log('installing analyser: ' + JSON.stringify(analyser));
          return AM.installAnalyser(analyser, true); //force install of latest
        }))
          .then(() => {
            events.emit('message', '\nInstalled all analysers.');
          })
      });
  } else {
    log('fetching analyser list');
    AM.init()
      .then(() => {
        //return list of installed analysers
        const allInstalledAnalysers = AM.getAllInstalledAnalysers();
        log('have installed analysers: ' + JSON.stringify(allInstalledAnalysers));
        const analyserList = allInstalledAnalysers.join('\n  ');
        events.emit('message', `\nWe found ${allInstalledAnalysers.length} installed analysers:\n\n  ${analyserList}\n`);
      });
  }

  function getAllAnalysers(analyserConfigs){
    return _.map(analyserConfigs, function(analyserConfig){
      log('analyserConfig: ' + JSON.stringify(analyserConfig));
      return {name: analyserConfig.config.analyser,
        version: 'latest'}
    })
  }

};

function parseInput() /*: { install?: boolean } */ {
  const argv = yargs
      .boolean("install")
      .argv;

  const cmd = {
    installAnalysers : argv.install,
    reporter: argv.reporter,
  };
  return cmd;
}


function getReporter(name) {
  // default to summary report
  if(!name) {
    return reporters["cli-summary"];
  }

  const reporter = reporters[name];
  if(reporter) {
    return reporter;
  }

  try {
    return require(name);
  } catch(e) {
    console.error(`couldn't load reporter '${name}': ${e.stack}`);
    doExit(1);
  }
}

function outputError(e) {
  console.error(e);
}

function errorWithCode(code) {
  return function(err) {
    return err.code === code;
  };
}

function doExit(code, message, error) {
  log(`exiting with code '${code}' with msg '${message}' ` + (error ? error.stack : ""));
  if(message) {
    outputError(message);
  }

  process.exit(code);
}

function fail(err) {
  log("UNEXPECTED FAILURE " + (err ? (err.stack || err) : " without error passed"));
  doExit(1, "sidekick suffered an unexpected failure", err);
}

exports.help = `
usage: sidekick analysers [ --install ]

    Returns information about the installed analysers.
    
Installation

    With the --install flag, all available analysers will be installed (latest versions).
`;
