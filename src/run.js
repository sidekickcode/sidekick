/**
 * runs SK in CLI mode.
 */
"use strict";

const git = require("@sidekick/git-helpers");
const log = require("debug")("cli:run");

const _ = require("lodash");
const Promise = require('bluebird');

const EventEmitter = require("events").EventEmitter;
const path = require('path');

const flow = require("./flow");
const runValidations = flow.runValidations;
const Exit = flow.Exit;
const Installer = require('./analysers/installer');

//const analysisSession = require("../../daemon/analysis-session");

const reporters = Object.create(null);
reporters["cli-summary"]  = require("./reporters/cliSummary");
reporters["json-stream"]  = require("./reporters/jsonStream");
reporters["junit"]        = require("./reporters/junit");

module.exports = exports = function(yargs) {

  log("run command");
  const command = parseInput(yargs);

  const events = new EventEmitter;
  const repoPath = command.repoPath;

  const reporter = getReporter();

  reporter(events);

  return git.findRootGitRepo(repoPath)
    .catch(git.NotAGitRepo, function() {
      doExit(1, "sk run must be run on a git repo");
    })
    .then(validateAndPrepare)
    .then(function(exitOrResult) {
      if(exitOrResult instanceof Exit) {
        const exit = exitOrResult;
        return doExit(exit.code, exit.message);

      } else {
        if(command.ci){
          return runOnCi(repoPath)
            .then(function(analysers) {
              command.analysers = analysers;  //add all the required analysers to the command
              return analyse(exitOrResult)
            })
        } else {
          return analyse(exitOrResult);
        }
      }
    })
    .catch(fail);

  function validateAndPrepare() {
    return runValidations([_.partial(flow.hasConfigValidation, repoPath), commitsDefined], log)
      .then(function(exit) {
        return exit instanceof Exit ? exit : null;
      });
  }

  function commitsDefined() {
    const validated = _.mapValues(_.pick(command, "versus", "compare"), validate);
    return Promise.props(validated)
    .then(function(all) {
      const invalid = _.transform(all, function(invalid, error, name) {
        if(error instanceof Error) {
          invalid[name] = error;
        }
      });

      if(_.isEmpty(invalid)) {
        // extend command with head/base. not ideal to mutate, will do for now
        _.extend(command, all);
      } else {
        return Promise.reject(Error(_.values(invalid).join(", and ")));
      }
    });

    function validate(commitish, name) {
      if(commitish) {
        return parseCommitish(command.repoPath, commitish)
          .catch(function(e) {
            return Error(`cannot parse '${commitish}' as commitsh value for '--${name}'`);
          });
      } else {
        return `missing value for '--${name}'`;
      }
    }
  }

  /**
   * Run on a CI server.
   * Download and install all required analysers
   * @param repoPath abs path to the repo
   * @returns {*}
   */
  function runOnCi(repoPath){

    try {
      var installer = new Installer(path.join(__dirname, '/analysers/installed'));  //install into a subdir of this module's location
      installer.on('downloading', function (data) {
        events.emit('downloading', data);
      });
      installer.on('downloaded', function (data) {events.emit('downloaded', data);});
      installer.on('installing', function (data) {events.emit('installing', data);});
      installer.on('installed', function (data) {events.emit('installed', data);});
    } catch(err) {
      doExit(1, "Unable to acquire AnalyserManager.", err);
    }
    
    return installer.installAnalysers(repoPath)
      .then(function(results){
        return results; //all analysers installed fine
      }, function(err){
        doExit(1, "Unable to install all required analysers.", err);
      })
  }

  function analyse() {
    log("about to analyse", JSON.stringify(command));
    analysisSession.build(repoPath, command.compare, command.versus)
      .then(function(session) {

        const events = new EventEmitter;
        let heardIssues = false;

        session.on("analysisStart", function(err, data) {
          log('heard analysisStart');
          events.emit("start", err, data);
        });

        session.on("fileAnalyserEnd", function(err, file, analyser, issues) {
          if(err) {
            events.emit("error", {
              path: file.path,
              analyser: analyser.analyser,
              error: err,
            });
          } else {
            if(issues.length > 0) {
              heardIssues = true;

              //if running on CI and the analyser that found meta is marked as 'failCiOnError - fail the build
              if(command.ci && command.analysers[analyser].failCiOnError){
                doExit(1, `Sidekick found issues. Analyser '${analyser.displayName}' reported and issue in ${file.path}`);
              }

              events.emit("result", {
                path: file.path,
                analyser: analyser.analyser,
                analyserVersion: analyser.version,
                analyserDisplayName: analyser.displayName,
                analyserItemType: analyser.itemType,
                issues: issues.map((i) => {
                  return _.defaults(_.omit(i, "analyser", "version", "location"), i.location)
                }),
              });
            } else {
              events.emit("fileProcessed", {});
            }
          }
        });

        // when process is all done, we exit
        process.on('exit', function() {
          const code = yargs.noCiExitCode ? 0
                                          : (heardIssues ? 1 : 0);
          process.exit(code);
        });

        session.on("analysisEnd", function() {
          log('heard analysisEnd');
          events.emit("end");
        });

        session.start();
      });
  }

  function getReporter() {
    if(!command.reporter) {
      return reporters["cli-summary"];  //default to summary report
    }

    const reporter = reporters[command.reporter];
    if(reporter) {
      return reporter;
    }

    try {
      return require(command.reporter);
    } catch(e) {
      console.error(`couldn't load reporter '${command.reporter}': ${e.stack}`);
      doExit(1);
    }
  }


};

function fail(err) {
  log("UNEXPECTED FAILURE " + (err ? (err.stack || err) : " without error passed"));
  doExit(1, "sidekick suffered an unexpected failure", err);
}

function parseInput(yargs) {
  const argv = yargs.argv;
  const repoPath = argv._[1] || process.cwd();
  const cmd = {
    repoPath: repoPath,
    reporter: argv.reporter,
  };

  // will later be replaced by commit values
  if(argv.versus) {
    cmd.versus = argv.versus;
  }

  if(argv.compare) {
    cmd.compare = argv.compare;
  }

  if(argv.ci) {
    cmd.ci = argv.ci;
  }

  return cmd;
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

function outputError(e) {
  console.error(e);
}


exports.help = `
usage: sk run [ some/repo/path ] [ --versus commitish ] [ --compare commitish ] [ --reporter npmPackageName|absolutePath ] [ --ci ] [ --no-ci-exit-code ]

    Runs sk in cli mode, reporting results via reporter.

Compare and Versus

    Without a --versus, simply analyses all files in the repo. with --versus compares current working copy (i.e the files
    in the repo, commited or not) vs specified commit. With both --versus and --compare, will analyse changes
    that have happened since the commit at versus, until the commit at compare.

  Examples

    sk run --versus origin/master                # working copy vs latest fetched commit from origin/master
    sk run --versus head~5                       # working copy vs 5 commits ago
    sk run --compare HEAD --versus head~5        # current commit vs 5 commits ago

CI

    With --ci flag, sk will install all analysers specified in your .sidekickrc file. If an analyser relies on a config
    file, e.g. '.eslintrc', these settings will be used. If no config can be found then Sidekick default settings will be used.

Reporters

    Without --reporter, a summary reporter will be used that totals up the issues found.

    json-stream - a stream of newline deliminated JSON: http://ndjson.org

                  e.g {}\\n{}\\n{}

    junit       - junit compatible XML. incremental results, emitting a <testcase> per analyser per file (i.e every (file, analyser) pair), with
                  <failure> elements per issue found.

Exit code

    Will exit with status code 1 if any issues are detected - disable this with --no-ci-exit-code

`;
