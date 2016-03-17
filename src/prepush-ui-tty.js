/**
 * UI for prepush
 */
"use strict";

const _ = require("lodash");
const log = require("../../common/log");

const events = require("events");

const readline = require("readline");

const chalk = require("chalk");
const green = chalk.green;
const yellow = chalk.yellow;

const SUCCESS_TICK = chalk.green("✔");

const MainProcess = require("../MainProcess");

module.exports = exports = pushUi;

exports._runUi = runUi;

const PUSH_CANCELLED_MESSAGE = exports.PUSH_CANCELLED_MESSAGE =
`\nCancelling push... (↓ ${green("don't worry")} - 'error:' below is just telling you that you decided not to continue with the push)\n`;

const COMPLETE_MESSSAGE =
`${green("Sidekick")} ↓ ${green("PUSHED")} - we cancelled the original push to switch it for the one with your fixes, so git correctly reports the original 'failed to push'
`;

function pushUi(setup) {
  // use tty module to ensure we end up with a tty in the slightly weird git hook environment
  var ttys = require("ttys");

  setup.cursor = readline.createInterface({ input: ttys.stdin, output: ttys.stdout });

  return runUi(setup);
}

function runUi(setup) {

  const main = setup.main;
  const prepush = setup.prepush;

  const cursor = setup.cursor;
  const pushDefinition = setup.push;

  let lineDy = 0;
  let lineDx = 0;

  const state = {
    analysed: null,
    total: null,
    issuesInModifiedLines: null,
    uiOpened: false,
    action: "",
    status: "unstarted",
    // null = unknown, then bool
    success: null,
    userInput: "",
    issueCount: 0,
  };

  const commands = {
    s: _.once(skip),
    o: _.once(open),
  };

  const api = new events.EventEmitter;

  function init() {
    listenForEvents();
    listenForTerm();
    renderAnalysis(state);
    observePush();
    handleInput();
  }

  init();

  return api;

  function handleInput() {
    cursor.input.resume();

    cursor.input.on("data", function(data) {
      log("got data " + data);
      data.toString().split("").forEach(function(c) {
        const cmd = commands[c];
        if(cmd) {
          log("command: " + cmd.name);
          cmd();
          renderAnalysis();
        }
      });

      // hide the characters
      readline.moveCursor(process.stdout, -data.length, 0);
      readline.clearLine(process.stdout, 1);
    });
  }

  function listenForEvents() {
    prepush.on("exitOptionallySkipping", exitOptionallySkipping);
    prepush.on("handOffToGui", handOff);
  }
  function exitOptionallySkipping(exit) {
    // output the message
    write(exit.message);

    cursor.question("\nPush without analysis? (y/n): ", function(a) {
      const skip = a.trim() === "y";
      if(skip) {
        exit(0);
      } else {
        exitWithMessage(1, prepushUi.PUSH_CANCELLED_MESSAGE);
      }
    });
  }

  function handOff(event) {
    write(`${event.message} (s) to skip and push`);
  }

  function exitWithMessage(code, msg) {
    write(msg);
    exit(code);
  }

  function observePush() {

    const pushProcess = main.getActor(pushDefinition.id);

    pushProcess.once("started", function() {
      log("heard push started");
    });

    pushProcess.once("end", function(err, pushResult) {
      if(err) {
        state.error = err;
        skipDueToFailure();
      } else {
        completeExit(pushResult);
      }
    });

    pushProcess.once("initialAnalysesEnd", function() {
      log("heard initialAnalysesEnd");
      state.success = true;
      renderAnalysis();

      if(!state.issuesInModifiedLines && state.success && !state.uiOpened) {
        noIssuesFoundExit();
      }
    });

    pushProcess.once("firstIssueInModifiedLines", function() {
      log("first issue detected");
      state.issuesInModifiedLines = true;
      renderAnalysis();
    });

    pushProcess.on("updateStarted", function(update) {
      log("heard update start: " + update.id);

      const updateProcess = main.getActor(update.id);
      updateProcess.on("progress", progress);

      updateProcess.on("result", metaFound);

      updateProcess.once("end", function(err) {
        log("heard end");
        updateProcess.removeListener("progress", progress);
        state.status = "complete";
        renderAnalysis()
      });

      function progress(update) {
        log("got update process");
        state.status = "started";


        state.total = update.total;
        // TODO kludge for analysed > total, which needs to be fixed upstream
        state.analysed = Math.min(update.total, update.analysed);
        renderAnalysis();
      }

      function metaFound(meta) {
        log("got meta");
        state.issueCount++;
        renderAnalysis();
      }
    });
  }

  function open() {
    state.uiOpened = true;
    main.call("pushReviewUi", pushDefinition.id);
    renderAnalysis();
  }

  function skip() {
    api.emit("skip");

    main.call("pushSkip", pushDefinition.id);
    exit(0);
  }

  function fail(err) {
    if(err.message === "working-copy-unclean") {
      renderUnclean();
    } else if(err.message === "branch-not-current") {
      renderNotCurrentBranch();
    } else {
      log.error(err && (err.stack || err));
      exit(1);
    }
  }

  function skipDueToFailure() {
    reset();
    skipOrContinue(`${green('Sidekick')} analysis failed unexpectedly, push anyway?`);
  }

  function renderUnclean() {
    reset();
    skipOrContinue("You have unsaved changes in your working copy (modified or un-tracked files). Sidekick doesn't support this at present to keep your work safe.\n\nStash or create a temporary branch to enable analysis\n\nSkip analysis and push anyway?");
  }

  function renderNotCurrentBranch() {
    skipOrContinue("You're pushing to a branch you currently haven't checked out. Sidekick will support this, but we've decided against switching branches automatically for now. Please checkout the branch before pushing\n\nSkip analysis and push anyway?");
  }

  function skipOrContinue(question) {
    cursor.question(question + " (y/n)\n>", shouldPush);
  }

  function shouldPush(answer) {
    const yes = /^\s*y\s*$/.test(answer);
    if(!yes) {
      console.error(PUSH_CANCELLED_MESSAGE);
    }
    exit(yes ? 0 : 1);
  }


  function renderAnalysis(state) {
    reset();
    writeLine(`${analysisStatusText()}`); //Sidekick started..
    writeLine(optionsText());             //(o) to open ui, (s) to skip
    writeLine(``);                        //
    writeLine(header());                  //  Analysis summary:
    writeLine(progressText());            //  2 of 12 files analysed
    writeLine(actionText());              //  issues found in modified lines
    writeLine(``);                        //
    writeLine(footer());                  //Opening UI so you can fix..
  }

  function optionsText() {
    var options = [];

    if(!state.issuesInModifiedLines && !state.uiOpened) {
      options.push("(o) to open review UI");
    }

    options.push("(s) to skip analysis and push");

    return options.join(", ");
  }

  function progressText(){
    if(state.status === 'started' || state.status === 'complete') {
      return `  ${state.analysed}/${state.total} modified files analysed.`;
    } else {
      return '';
    }

  }

  function analysisStatusText() {
    switch(state.status) {
    case "waiting":
    case "unstarted": return `${green('Sidekick')} starting up..`;
    case "complete": return `${green('Sidekick')} finished.`;
    case "started": return `${green('Sidekick')} running..`;
    default:
      throw new Error(`unknown state ${state.status}`);
    }
  }

  function header(){
    return `  ${chalk.magenta('Analysis summary:')}`;
  }

  function footer() {
    if(state.issuesInModifiedLines){
      return "Opening the UI so you can fix..";
    } else {
      return '';
    }
  }

  function actionText() {
    //2 char indent to allow for icons
    if(state.status === "unstarted") {
      return `  ${green('All good so far')}.`;
    } else {
      if(!state.issuesInModifiedLines){
        return `  ${state.success ? SUCCESS_TICK + " " : "  "}${green('All good')} - continuing with push.`;
      } else {
        return `  ${yellow(state.issueCount + ' issues')} found in modified lines.`;
      }
    }
  }

  function reset() {
    readline.moveCursor(process.stdout, -lineDx, -lineDy);
    readline.clearScreenDown(process.stdout);
    lineDy = 0;
    lineDx = 0;
  }

  function writeLine(line) {
    cursor.write(line + "\n")
    lineDy += 1;
  }

  function listenForTerm() {
    cursor.on('SIGINT', function() {
      exit(1);
    })
  }

  function exit(code) {
    api.emit("exit", code);
  }

  function noIssuesFoundExit() {
    exit(0);
  }

  function completeExit(pushResult) {
    reset();
    if(pushResult === "pushed") {
      writeLine(COMPLETE_MESSSAGE);
      exit(1);
    } else {
      // we didn't add anything to push, so leave it to git
      exit(0);
    }
  }

  function write(line) {
    cursor.write(line + "\n");
  }

}
