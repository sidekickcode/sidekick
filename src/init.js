/**
 * creates a default .sidekickrc file for a repo.
 */
"use strict";
const path = require("path");

const log = require("debug")("cli:init");

const _ = require("lodash");

const EventEmitter = require("events").EventEmitter;

const fs = require("fs-extra");

const yargs = require("yargs");

const git = require("@sidekick/git-helpers");
const repoConfig = require("@sidekick/common/repoConfig");

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

  const CONFIG_FILE = ".sidekickrc";


  git.findRootGitRepo(process.cwd(), function(err, locationOfRepoRoot){
    if(err){
      log(`Unable to run init: ${err.message}`);
      const errMessage = `Unable to create .sidekickrc. Cannot find repo root, starting in: ${process.cwd()}`;
      doExit(1, errMessage, err);
    }

    const configFileAbsPath = path.join(locationOfRepoRoot, CONFIG_FILE);

    try {
      fs.statSync(configFileAbsPath);
      events.emit("message", `${CONFIG_FILE} already exists for this repo at: ${locationOfRepoRoot}`);
    } catch(e) {
      events.emit("message", `Creating default ${CONFIG_FILE} file..`);
      repoConfig.load(locationOfRepoRoot)
        .then((RC) => {
          const defaultConfig = RC.getContents();
          log(`Default config: ${defaultConfig}`);
          fs.writeFileSync(configFileAbsPath, defaultConfig);
          events.emit("message", `Created .sidekickrc file in ${locationOfRepoRoot}`);
        });
    }
  });
};

function parseInput() /*: { install?: boolean } */ {
  const argv = yargs.argv;

  const cmd = {
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
usage: sidekick init

    Creates a .sidekickrc file in the git root of the current repo.
    
    If sidekick gui is installed, will open the gui to help configure the current repo.
    Otherwise, it will create a .sidekickrc file for the current repo.
    File is created after parsing the current repo to see what analysers could be helpful - use a text editor to change.
    
`;
