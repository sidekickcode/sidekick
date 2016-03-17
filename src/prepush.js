"use strict";

const yargs = require("yargs");
const uuid = require("uuid");

// TODO is the ttys module really needed?
var ttys;
if(process.stdout.isTTY) {
  ttys = require("ttys");
} else {
  ttys = process;
}

const readline = require("readline");
const stdin = require("easy-stdin");
const git = require("../git");
const RepoConfig = require("../../common/repo-config");
const chalk = require("chalk");
const green = chalk.green;
const EventEmitter = require("events").EventEmitter;

const flow = require("./flow");
const runValidations = flow.runValidations;
const Exit = flow.Exit;

const prepushUi = require("./prepush-ui");

const Promise = require("bluebird");

const _ = require("lodash");

const MainProcess = require("../MainProcess");

// long timeout, as we're probably booting UI
const MAIN_TIMEOUT = 25000;

const log = require("../../common/log").derive({ tags: ["prepush"] });

module.exports = exports = function() {

  const events = new EventEmitter;
  var skipped = false;

  stdin(function(err, stdinContents) {
    if(err) {
      return fail(err);
    }

    const cwd = process.cwd();

    runPrepush(cwd, stdinContents);
  });

  return;


  function runPrepush(cwd, stdinContents) {
    git.findRootGitRepo(cwd)
    .error(git.NotAGitRepo, function() {
      doExit(1, "sidekick git hooks must be run in a git repo");
    })
    .then(function() {
      return git.prepush(yargs.argv._.slice(1), stdinContents, cwd)
      .then(validateAndPrepare)
      .then(function(exitOrPush) {
        if(exitOrPush instanceof Exit) {
          const exit = exitOrPush;

          if(exit.code === 0) {
            return doExit(0, exit.message);
          }

          exitOptionallySkipping(exit);
        } else {
          return prepush(exitOrPush);
        }
      });
    })
    .catch(fail)
  }

  function doExit(code, message, error) {
    log(`exiting with code '${code}' with msg '${message}' ` + (error ? error.stack : ""));
    if(message) {
      outputError(message);
    }

    process.exit(code);
  }

  function errorWithCode(code) {
    return function(err) {
      return err.code === code;
    }
  }

  function validateAndPrepare(pushInfo) {
    if(pushInfo.actions.length === 0) {
      log("no actions in push");
      return new Exit(0);
    }

    const targets = _.where(pushInfo.actions, actionSupportedByPushSystem);

    // nothing to do
    if(targets.length === 0) {
      log("no updates in push");
      return new Exit(0);
    }

    // TODO remove when we support multiple pushes
    if(targets.length > 1) {
      return new Exit(1, "sidekick currently only supports pushing to one branch at a time.");
    }

    const target = targets[0];

    log("about to run validations");

    // TODO in future, don't enforce this but save work as we can't analyse
    return runValidations([isFastForwardOrCreate, _.partial(flow.hasConfigValidation, pushInfo.repoPath), isPushingCurrentBranch], log)
      .then(function(exit) {
        return exit instanceof Exit ? exit : pushInfo;
      });

    function isFastForwardOrCreate() {
      if(target.type === git.CREATE_BRANCH) {
        return Promise.resolve(true);
      }

      return git.branchTipContainsAncestorAsync(pushInfo.repoPath, { ancestor: target.remoteSha, tip: target.localSha })
      .then(function(yes) {
        if(!yes) {
          return new Exit(1, "sidekick only supports fast-forward pushes - please merge with remote first");
        }
      });
    }

    function isPushingCurrentBranch() {
      return git.getCurrentBranch(pushInfo.repoPath)
      .then(function(current) {
        if(current !== target.localBranch) {
          return new Exit(1, "sidekick currently only supports push from the current branch");
        }
      });
    }
  }

  function fail(err) {
    log.error("UNEXPECTED FAILURE " + (err ? (err.stack || err) : " without error passed"));
    doExit(1, "sidekick suffered an unexpected failure", err);
  }

  function prepush(pushInfo) {
    log('prepush: ' + JSON.stringify(pushInfo));

    const id = uuid();
    const cmd = _.defaults({
      id: id,
      type: "push",
    }, pushInfo);


    cmd.actions = cmd.actions.map(function(action) {
      if(actionSupportedByPushSystem(action)) {
        return _.defaults({
          id: uuid(),
        }, action);
      }
      return action;
    });

    const main = MainProcess.acquire({
      error: fail,
    });

    const ui = prepushUi({
      main: main,
      prepush: events,
      push: cmd,
    });

    ui.on("exit", function(code) {
      log("ui asked for exit " + code);
      doExit(code);
    });

    ui.on("skip", function() {
      doExit(0);
    });

    if(_.some(cmd.actions, requiresGuiPicking)) {
      bootGuiToPickComparison();
    } else {
      startAnalysis();
    }

    return;

    function bootGuiToPickComparison() {
      events.emit("handOffToGui", {
        message: "can't guess which branch to compare with, booting GUI to compare",
      });

      main.call("intent", {
        timeout: MAIN_TIMEOUT,
        type: "pickComparisonTarget",
        push: cmd,
      })
      .done(function() {
        doExit(1);
      }, function(err) {
        exitOptionallySkipping(new Exit(1, "sidekick could not boot to pick comparison target"));
      });
    }

    function startAnalysis() {
      events.emit("start");

      log("sending pushStart");
      main.call({
        timeout: MAIN_TIMEOUT,
      }, "pushStart", cmd)
      .catch(fail);
    }
  }

  function exitOptionallySkipping(exit) {
    events.emit("exitOptionalSkipping", exit);
  }

};

function actionSupportedByPushSystem(action) {
  return action.type === git.UPDATE_BRANCH ||
         action.type === git.CREATE_BRANCH;
}

function output(m) {
  console.log(m);
}

function outputError(m) {
  console.error(m);
}

function prepushDescription(actions) {
  return actions.map(function(action) {
    if(action.type === git.UPDATE_BRANCH) {
      return `Push to ${action.remoteRef} from ${action.localRef} queued for analysis.`;
    }
    return `skipping ${action.type} to ${action.remoteRef}`;
  }).join("\n");
}

function requiresGuiPicking(action) {
  return action.type === git.CREATE_BRANCH;
}


