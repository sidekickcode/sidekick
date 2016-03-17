/**
 * runs SK in CLI mode.
 */
"use strict";

const git = require("../git");
const EventEmitter = require("events").EventEmitter;

const _ = require("lodash");

const Promise = require('bluebird');

const flow = require("./flow");
const runValidations = flow.runValidations;
const Exit = flow.Exit;

const log = require("../../common/log").derive({ tags: ["run"] });
const analysisSession = require("../../daemon/analysis-session");

const parseCommitish = require("../../daemon/git").parseCommitish;

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

  return git.findRootGitRepo(repoPath)
    .error(git.NotAGitRepo, function() {
      doExit(1, "sk run must be run on a git repo");
    })
    .then(validateAndPrepare)
    .then(function(exitOrResult) {
      if(exitOrResult instanceof Exit) {
        const exit = exitOrResult;

        if(exit.code === 0) {
          return doExit(0, exit.message);
        }

        exitOptionallySkipping(exit);
      } else {
        return analyse(exitOrResult);
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

        reporter(events);

        session.start();
      });
  }


  function exitOptionallySkipping(exit) {
    events.emit("exitOptionalSkipping", exit);
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
  log.error("UNEXPECTED FAILURE " + (err ? (err.stack || err) : " without error passed"));
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
usage: sk run [ some/repo/path ] [ --versus commitish ] [ --compare commitish ] [ --reporter npmPackageName|absolutePath ] [ --no-ci-exit-code ]

    runs sk in cli mode, reporting results via reporter. will exit with status code 1 if any isues are detected - disable this with --no-ci-exit-code

    without a --versus, simply analyses all files in the repo. with --versus compares current working copy (i.e the files
    in the repo, commited or not) vs specified commit. With both --versus and --compare, will analyse changes
    that have happened since the commit at versus, until the commit at compare.

Examples


    sk run --versus origin/master                # working copy vs latest fetched commit from origin/master
    sk run --versus head~5                       # working copy vs 5 commits ago
    sk run --compare HEAD --versus head~5        # current commit vs 5 commits ago

Reporters

    json-stream - a stream of newline deliminated JSON: http://ndjson.org

                  e.g {}\\n{}\\n{}

    junit       - junit compatible XML. incremental results, emitting a <testcase> per analyser per file (i.e every (file, analyser) pair), with
                  <failure> elements per issue found.

`;
