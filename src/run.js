/**
 * runs SK in CLI mode.
 */
"use strict";

const git = require("@sidekick/git-helpers");
const log = require("debug")("cli:run");

const _ = require("lodash");
const Promise = require('bluebird');

const EventEmitter = require("events").EventEmitter;

const Installer = require('./analysers/installer');
const yargs = require("yargs");

const proxy = require("@sidekick/common/eventHelpers").proxy;
const runner = require("@sidekick/runner");

const reporters = Object.create(null);
reporters["cli-summary"]  = require("./reporters/cliSummary");
reporters["json-stream"]  = require("./reporters/jsonStream");
reporters["junit"]        = require("./reporters/junit");

module.exports = exports = function(argv) {
  const command = parseInput();
  log("command: %j", command);

  const events = new EventEmitter;
  const reporter = getReporter(command.reporter);

  reporter(events);

  return git.findRootGitRepo(command.path)
    .catch(git.NotAGitRepo, function() {
      return doExit(1, "sk run must be run on a git repo");
    })
    .then(function createTarget(repoPath) {
      return createGitTarget(command, repoPath)
    })
    .catch(fail)
    .then(function(target) {

      log("starting analysis with %j", target);

      return runner.session({
        target: target,
        shouldInstall: command.ci,
      })

    })
    .then((session) => runSession(session, command, events))
}

function parseInput() /*: { versus?: string, compare?: string, ci: Boolean, reporter?: string } */ {
  const argv = yargs
    .boolean("ci")
    .argv;

  const path = argv._[1] || process.cwd();
  const cmd = {
    path: path,
    reporter: argv.reporter,
  };

  // will later be replaced by commit values
  if(argv.versus) {
    cmd.versus = argv.versus;
  }

  if(argv.compare) {
    cmd.compare = argv.compare;
  }

  cmd.ci = argv.ci;

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

function runSession(session, command, events) {
  let heardIssues = false;

  const analysis = session.start();

  analysis.on("start", function(err, data) {
    log('heard analysisStart');
    events.emit("start", err, data);
  });

  analysis.on("fileAnalyserEnd", emitResultForReporter);

  // when the session is finished, we have no more tasks schedules
  // and node should exit
  process.on('exit', function() {
    const code = yargs.noCiExitCode ? 0
                                    : (heardIssues ? 1 : 0);
    process.exit(code);
  });

  analysis.on("end", function() {
    log('heard analysisEnd');
    events.emit("end");
  });

  function emitResultForReporter(err, file, analyser, issues) {
    if(err) {
      events.emit("error", {
        path: file.path,
        analyser: analyser.analyser,
        error: err,
      });

    } else {
      if(issues.length > 0) {

        //if running on CI and the analyser that found meta is marked as 'failCiOnError - fail the build
        if(!command.ci || command.analysers[analyser].failCiOnError) {
          heardIssues = true;
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
  }
}

function createGitTarget(command, repoPath) {
  const validated = _.mapValues(_.pick(command, "versus", "compare"), validate);

  return Promise.props(validated)
  .then(function(all) {
    const invalid = _.transform(all, function(invalid, error, name) {
      if(error instanceof Error) {
        invalid[name] = error;
      }
    });

    if(_.isEmpty(invalid)) {
      // extend command with head/base.
      return {
        type: "git",
        path: repoPath,
        compare: all.compare,
        versus: all.versus,
      };

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

