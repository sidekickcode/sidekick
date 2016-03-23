"use strict";

// NOTE - do not require anything else before logs, to ensure all
// logs go to correct place
//const settings = require("../../common/settings");
const VERSION = require("../package.json").version;

const log = require("debug")("cli");

const yargs = require("yargs");
const tracking = require("@sidekick/common/tracking");

exports.run = run;

// safe lookup w/o proto
const commands = Object.create(null);
commands.version = showVersion;
commands.help = helpCommand;
commands.run = require("./run");


const help = 
`usage: sk <command> [ arg, ... ]

  sk run [ some/repo/path ] [ --versus commitish ] [ --compare commitish (default: working copy) ] [ --reporter npmPackageName|absolutePath ] [ --no-ci-exit-code ]

    runs sk in cli mode, reporting results via reporter. will exit with status code 1 if any isues are detected - disable this with --no-ci-exit-code

    without a --versus, simply analyses all files in the repo. with --versus compares current working copy (i.e the files
    in the repo, commited or not) vs specified commit. With both --versus and --compare, will analyse changes
    that have happened since the commit at versus, until the commit at compare.

    sk run --versus origin/master                # working copy vs latest fetched commit from origin/master
    sk run --versus head~5                       # working copy vs 5 commits ago
    sk run --compare HEAD --versus head~5        # current commit vs 5 commits ago

  sk help [ command ]
  sk command -h --help

    shows this dialog, or more detailed help on a command if available

  sk version

    reports the version (also sk -v sk --version)

sk version ${VERSION}`;

function run() {
  const cmd = yargs.argv._[0];
  const fn = commands[cmd];

  log('  ***  CLI STARTUP ***  ');

  tracking.start({
    version: VERSION,
  });

  process.on("exit", function(code) {
    log("exit " + code);
  });

  process.on("uncaughtException", handleUnexpectedException);

  process.on("unhandledRejection", function(err) {
    log("unhandled promise rejection! " + err.stack || err);
    tracking.error(err);
  });


  if(typeof fn === "function") {
    if(yargs.argv.h || yargs.argv.help) {
      return helpCommand(yargs);
    }

    try {
      fn(yargs);
    } catch(e) {
      handleUnexpectedException(e);
      console.error("sk suffered an unexpected error");
      process.exit(1);
    }
  } else {
    if(yargs.argv.v || yargs.argv.version) {
      showVersion();
    } else {
      failWithHelp(cmd);
    }
  }
}

function handleUnexpectedException(err) {
  log("uncaughtException! " + err.stack || err);
  tracking.error(err);
}

function showHelp() {
  write(help);
}

function helpCommand(yargs) {
  const argv = yargs.argv;
  const cmd = argv._[1];
  const command = commands[cmd];
  if(command) {
    if(command.help) {
      write(command.help);
    } else {
      write(`there is no additional help for the '${cmd}' command beyond the below\n`);
      failWithHelp(cmd);
    }
  } else {
    showHelp();
  }
}

function showVersion() {
  write(`sidekick ${VERSION}`);
}

function failWithHelp(cmd) {
  if(cmd) {
    write(`'${cmd}' is not a sidekick command, see usage:\n`);
  }
  write(help);
  process.exit(1);
}

if(require.main === module) {
  run();
}

function write(m) {
  console.log(m);
}
