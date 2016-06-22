/**
 * outputs status info.
 */
"use strict";
const path = require('path');

const log = require("debug")("cli:config");

const _ = require("lodash");

const EventEmitter = require("events").EventEmitter;

const analyserManager = require("@sidekick/analyser-manager");
const os = require("@sidekick/common/os");
const userSettings = require("@sidekick/common/userSettings");

const yargs = require("yargs");

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
  
  if(command.git){
    events.emit('message', `Setting git path to: ${command.git}`);
    userSettings.setProperty('gitBin', command.git);
    userSettings.save();
  } else {
    //return config info
    AM.init()
      .then(() => {
        userSettings.load();
        const installedAnalysers = AM.getAllInstalledAnalysers();
        var output = `\nSidekick config settings:\n`;
        events.emit('message', output);

        output = `  Sidekick analysers installed: ${installedAnalysers.length > 0 ? 'OK' : 'NO (run \'sidekick analysers --install\' to install).'}`;
        events.emit('message', output, installedAnalysers.length > 0 ? 'green' : 'yellow');

        userSettings.isGitReachable()
          .then(function(){
            log('git found OK: ');
            output = `  Sidekick can find git:        OK\n`;
            events.emit('message', output, 'green');
          }, function(err){
            log(`Cannot find git at: ${userSettings.getGitBin()}.`, err);
            output = `  Sidekick can find git:        NO (cannot find git at: ${userSettings.getGitBin()}).\n`;
            events.emit('message', output, 'yellow');
          });
      });
  }
};

function parseInput() /*: { git?: string } */ {
  const argv = yargs.argv;

  const cmd = {
    reporter: argv.reporter,
  };

  if(argv.git) {
    cmd.git = argv.git;
  }

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
usage: sidekick config [ --git ]

    Returns config information about Sidekick, e.g.
    
      Sidekick can find git:        OK
      Sidekick analysers installed: OK
    
    We have 2 pre-requisites for correct operation: 
      1) You need to have git available.
      2) You need to install our analysers.
    
Git

    If git is already installed and can be reached in the terminal then you are good to go!
    Otherwise, you will need to tell Sidekick where git has been installed to:
      
      sidekick config --git=/some/path/to/git

Analysers
    
    usage: sidekick analysers
    Please see the help for the 'analysers' command for more info.
    
`;

/*
 function isGitAvailable() {
 var property = userSettings.getProperty("gitBin");
 return validGit(property || "git");
 }

 function validGit(gitPath) {
 return ng.$q(function(resolve, reject) {
 childProcess.exec(gitPath + " --version", function(err, stdout) {
 if(err) {
 reject(err)
 } else {
 var isGit = /\bgit\b/.test(stdout);
 // if we're here, something is either git or pretending to be git :)
 isGit ? resolve() : reject(new Error("not git"));
 }
 });
 });
 }*/
