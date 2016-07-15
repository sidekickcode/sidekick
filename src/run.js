/**
 * runs SK in CLI mode.
 */
"use strict";

const git = require("@sidekick/git-helpers");
const log = require("debug")("cli:run");

const _ = require("lodash");
const Promise = require('bluebird');

const EventEmitter = require("events").EventEmitter;

const runner = require("@sidekick/runner");

const userSettings = require('@sidekick/common/userSettings');

const yargs = require("yargs");

const reporters = Object.create(null);
reporters["cli-summary"]  = require("./reporters/cliSummary");
reporters["json-stream"]  = require("./reporters/jsonStream");
reporters["junit"]        = require("./reporters/junit");

module.exports = exports = function() {
  const argv = yargs
    .boolean("ci")
    .boolean("travis")
    .boolean("noCiExitCode")
    .argv;

  const path = argv._[1] || process.cwd();
  const command = flagsToCommand(path, argv);
  if(command instanceof Error) {
    return doExit(1, command.message);
  }

  log("command: %j", command);

  const events = new EventEmitter;

  const reporter = getReporter(command.reporter);

  reporter(events, null, command);

  userSettings.load();

  userSettings.isGitReachable()
    .then(function(){
      git.setGitBin(userSettings.getGitBin());

      return git.findRootGitRepo(command.path)
          .catch(git.NotAGitRepo, function() {
            return doExit(1, "sidekick run must be run on a git repo");
          })
          .then(function createTarget(repoPath) {
            return createGitTarget(command, repoPath, events)
          })
          .catch(fail)
          .then(function(target) {

            log("starting analysis with %j", target);

            return runner.session({
              target: target,
              shouldInstall: command.ci,
              events: events,
            })

          })
          .then((session) => runSession(session, command, events))
    }, function(err){
      return doExit(1, "Cannot run analysis - unable to find git at: " + userSettings.getGitBin());
    });
};

exports.flagsToCommand = flagsToCommand;

function flagsToCommand(path, argv) /*: { versus?: string, compare?: string, ci: Boolean, reporter?: string } | Error */ {

  const cmd = {
    path: path,
    reporter: argv.reporter,
  };

  if(argv.travis && (argv.versus || argv.compare)) {
    return Error("travis integration determines commit range - do not supply --versus or --compare");
  }

  // will later be replaced by commit values
  if(argv.versus) {
    cmd.versus = argv.versus;
  }

  if(argv.compare) {
    cmd.compare = argv.compare;
  }

  cmd.ci = argv.ci;
  cmd.noCiExitCode = argv.noCiExitCode;
  cmd.travis = argv.travis;
  if(cmd.travis === true) {
    cmd.ci = true;
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

function runSession(session, command, events) {
  let heardIssues = false;

  const analysis = session.start();

  analysis.on("start", function(err, data) {
    log('heard analysisStart');
    events.emit("start", err, data, analysis);
  });

  analysis.on("fileAnalyserEnd", emitResultForReporter);

  // when the session is finished, we have no more tasks schedules
  // and node should exit
  process.on('exit', function(code) {
    if(code !== 0) {
      // leave it as is, we're exiting as a result of failure elsewhere
      return;
    }
    const runExitCode = command.noCiExitCode ? 0
                                      : (heardIssues ? 1 : 0);

    log(`run changing process exit code to: ${runExitCode}, heardIssues ${heardIssues}, --no-ci-exit-code=${command.noCiExitCode}`);
    process.exit(runExitCode);
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
      // if running on CI and the analyser that found meta is marked as 'failCiOnError - fail the build
      if(!command.ci || analyser.failCiOnError !== false) {
        heardIssues = heardIssues || issues.meta.length > 0;
      }

      events.emit("result", {
        path: file.path,
        analyser: analyser.analyser,
        analyserVersion: analyser.version,
        analyserDisplayName: analyser.displayName,
        analyserItemType: analyser.itemType,
        issues: issues.meta.map((i) => {
          return _.defaults(_.omit(i, "analyser", "version", "location"), i.location)
        }),
      });
    }
  }
}

function createGitTarget(command, repoPath, events) {
  command = travis(command, events);
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
      return git.parseCommitish(command.repoPath, commitish)
        .catch(function(e) {
          return Error(`cannot parse '${commitish}' as commitish value for '--${name}'`);
        });
    } else {
      return `missing value for '--${name}'`;
    }
  }

  function travis(command, events) {
    if(!command.travis) {
      return command;
    }

    if(process.env.TRAVIS_COMMIT_RANGE) {
      // travis' commit range is '...' incorrectly - https://github.com/travis-ci/travis-ci/issues/4596
      const headBase = process.env.TRAVIS_COMMIT_RANGE.split(/\.{2,3}/);

      events.emit("message", `Travis build. Determined commit comparison to be: ${headBase[0]} to ${headBase[1]}`);

      return _.defaults({
        compare: headBase[0],
        versus: headBase[1],
      }, command);
    } else {
      events.emit("message", `--travis build specified. Flag ignored because we don't appear to be running on TravisCi (no TRAVIS_COMMIT_RANGE env var)`);
    }

    return command;
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
usage: sidekick run [ some/repo/path ] [ --versus commitish ] [ --compare commitish ] [ --reporter npmPackageName|absolutePath ] [ --ci ] [ --travis ] [ --no-ci-exit-code ]

    Runs sidekick in cli mode, reporting results via reporter.

Compare and Versus

    Without a --versus, simply analyses all files in the repo. with --versus compares current working copy 
    (i.e the files in the repo, committed or not) vs specified commit. With both --versus and --compare,
    will analyse changes that have happened since the commit at versus, until the commit at compare.

  Examples

    sidekick run --versus origin/master                # working copy vs latest fetched commit from origin/master
    sidekick run --versus head~5                       # working copy vs 5 commits ago
    sidekick run --compare HEAD --versus head~5        # current commit vs 5 commits ago

CI

    With --ci flag, sidekick will install all analysers specified in your .sidekickrc file. If an analyser relies
    on a config file, e.g. '.eslintrc', these settings will be used. If no config can be found, then the analyser will
    not run.
    
    With --travis flag, sidekick will only analyse code that changed in PR etc (will set --ci to true if not explicitly set to false)

Reporters

    Without --reporter, a summary reporter will be used that totals up the issues found.

    json-stream - a stream of newline delimited JSON: http://ndjson.org

                  e.g {}\\n{}\\n{}

    junit       - junit compatible XML. incremental results, emitting a <testcase> per analyser per file
                  (i.e every (file, analyser) pair), with <failure> elements per issue found.

Exit code

    Will exit with status code 1 if any issues are detected - disable this with --no-ci-exit-code

`;

