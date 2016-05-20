"use strict";

const VERSION = require("../package.json").version;

const log = require("debug")("cli");

const yargs = require("yargs");
const tracking = require("@sidekick/common/tracking");

exports.run = run;

// safe lookup w/o proto
const commands = Object.create(null);
commands.version = showVersion;
commands.help = helpCommand;
commands.open = require("./open");
commands.run = require("./run");
commands.analysers = require("./analysers");
commands.config = require("./config");
commands.init = require('./init');

const help = 
` 
Usage: sidekick <command> [ arg, ... ]

  sidekick run [ some/repo/path ] [ --versus commitish ] [ --compare commitish (default: working copy) ] [ --reporter npmPackageName|absolutePath ]  [ --ci ] [ --travis ] [ --no-ci-exit-code ]

    runs sidekick in cli mode, reporting results via reporter. will exit with status code 1 if any isues are detected 
    - disable this with --no-ci-exit-code

    without a --versus, simply analyses all files in the repo. with --versus compares current working copy (i.e the files
    in the repo, commited or not) vs specified commit. With both --versus and --compare, will analyse changes
    that have happened since the commit at versus, until the commit at compare.

    sidekick run --versus origin/master                # working copy vs latest fetched commit from origin/master
    sidekick run --versus head~5                       # working copy vs 5 commits ago
    sidekick run --compare HEAD --versus head~5        # current commit vs 5 commits ago
    sk run --travis                                    # travis integration - only analyses code that changed in PR etc (will set --ci if not set to false)

    CI

      With --ci flag, sidekick will install all analysers specified in your .sidekickrc file. If an analyser relies
      on a config file, e.g. '.eslintrc', these settings will be used. If no config can be found, then the analyser will
      not run.
    
    With --travis flag, sidekick will only analyse the files that changed in the commit that started the travis build.

  sidekick config [ --git ]
  
    outputs config information on the Sidekick installation
    
    with --git will set the path to your git installation

  sidekick analysers [ --install ]
  
    outputs information on the installed analysers
    
    with --install will install all available analysers

  sidekick init
  
    Creates a .sidekickrc file in the git root of the current repo.
    
    If sidekick gui is installed, will open the gui to help configure the current repo.
    Otherwise, it will create a .sidekickrc file for the current repo.
    File is created after parsing the current repo to see what analysers could be helpful - use a text editor to change.

  sidekick help [ command ]
  sidekick command -h --help

    shows this dialog, or more detailed help on a command if available

  sidekick version

    reports the version (also sidekick -v sidekick --version)
    
You can chat to us about sidekick at:  https://gitter.im/sidekickcode/support
You can raise issues with sidekick at: https://github.com/sidekickcode/tracker/issues

sidekick version ${VERSION}`;

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
    handleUnexpectedException(err);
  });


  if(typeof fn === "function") {
    if(yargs.argv.h || yargs.argv.help) {
      return helpCommand(yargs);
    }

    try {
      fn(yargs);
    } catch(e) {
      handleUnexpectedException(e);
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
  process.stderr.write("sk suffered an unexpected error", () => {
    process.exit(1);
  });
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
  process.stdout.write(help, () => {
    process.exit(1);
  });
}

if(require.main === module) {
  run();
}

function write(m) {
  console.log(m);
}
