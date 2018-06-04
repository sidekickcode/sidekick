/**
 * CLI output - writes directly to stdout
 */
"use strict";

const chalk = require("chalk");
const _ = require("lodash");
const Spinner = require("cli-spinner").Spinner;
const debug = require("debug")("cliSummary");

const readline = require("readline");

const os = require("@sidekick/common/os");

const SUCCESS_TICK = chalk.green(os.isPosix() ? "✔" : "√");

module.exports = exports = reporter;

const Readable = require("stream").Readable;
const defaultOutput = (x) => console.log(x);


const MESSAGE_TYPE = {
  INFO: "cyan",
  ERROR: "yellow",
  TITLE: "magenta",
  FATAL: "red",
};

function reporter(emitter, outputter, command) {
  var spinner;
  var processed = 0;

  const metas = [];
  const errors = [];
  const output = outputter || defaultOutput;
  const canFail = [];

  const ignoreInput = new Readable;
  ignoreInput._read = _.noop;

  var cursor = readline.createInterface({ input: ignoreInput, output: process.stdout });

  var installLines = {};
  var curInstallerLine = 0;

  emitter.on("start", function (err, data, analysis /*: Analysis */) {
    if (command.ci) {
      outputString("Starting analysis");
    } else {
      spinner = new Spinner("Analysing..");
      spinner.start();
    }

    try {
      var jobCount = _.reduce(analysis.plan.raw.byAnalysers, function (sum, analysersForLang) {
        return sum + (analysersForLang.analysers.length * analysersForLang.paths.length);
      }, 0);

      if (jobCount === 0) {
        outputString("No files that need to be analysed :-)");
      } else {
        var jobStr = pluralise("job", jobCount);
        var timeStr = ` (should take about ${timeToRun(jobCount)})`;
        var title = `${chalk.green("Sidekick")} is running ${jobCount} analysis ${jobStr}${timeStr}.`;
        outputString(title);
      }

    } catch (e) { } //not the end of the world if we cant get timings

    function timeToRun(fileCount) {
      var realCount = parseInt(fileCount / 3);  //takes about 300ms to do a job
      if (realCount < 20) {
        if (realCount < 1) {
          realCount = 1;  //less than 3 jobs
        }
        return `${realCount} ${pluralise("second", realCount)}`;
      } else if (realCount <= 30) {
        return "30 seconds";
      } else {
        var minutes = parseInt(Math.floor(realCount / 60));
        if (minutes < 1) {
          minutes = 1;
        }
        return `${minutes} ${pluralise("minute", minutes)}`;
      }
    }

  });

  emitter.on("result", function (meta) {
    metas.push(meta);
    processed++;
  });

  emitter.on("error", function (err) {
    errors.push(err);
  });

  emitter.on("end", function () {
    outputSummary(getSummariesByAnalyser());
  });

  emitter.on("message", function (message, colour) {
    outputString(message, colour);
  });

  //TODO needs to be 1 line per analyser
  emitter.on("downloading", function (data) {
    data = data[0];
    debug(JSON.stringify(data));
    if (data.canFailCi) {
      canFail.push(data.analyser);
    }
    outputString(`Downloading analyser: ${data.analyser} (${data.version})`);
    installLines[data.analyser] = curInstallerLine;
    curInstallerLine++;
  });
  emitter.on("downloaded", function (data) {
    data = data[0];
    outputString(`Downloaded analyser: ${data.analyser}`);
  });
  emitter.on("installing", function (data) {
    data = data[0];
    outputString(`Installing analyser: ${data.analyser}`);
  });
  emitter.on("installed", function (data) {
    data = data[0];
    outputString(SUCCESS_TICK + ` Installed analyser: ${data.analyser}`);
  });

  function outputString(x, colour) {
    if (colour) {
      try {
        console.log(chalk[colour](x));
      } catch (err) {
        outputJson(err);
      }
    } else {
      output(x);
    }
  }
  function outputJson(x) {
    output(JSON.stringify(x));
  }

  function outputLine(str, line) {
    const TO_THE_RIGHT_OF_CURSOR = 1;
    readline.moveCursor(process.stdout, 0, 3 - line);
    readline.clearLine(process.stdout, TO_THE_RIGHT_OF_CURSOR);
    cursor.write(str);
  }

  function getMetaByAnalyser(analyser) {
    return _.values(_.groupBy(metas, "analyser")[analyser]);
  }

  function getSummariesByAnalyser() {
    var issuesByAnalyser = _.groupBy(metas, "analyser");
    var errByAnalyser = _.groupBy(errors, "analyser");

    return _.map(issuesByAnalyser, function (value, key) {
      const analyserFullname = value[0].analyser;
      var analyserName = value[0].analyserDisplayName || key;
      var summary = `-- ${analyserName} ${getDashes(analyserName)}`;  //format is [-- analyserName ----------] (dashes fill upto 30 chars)

      var errStr = ".";
      if (numErrorsForAnalyser(key) > 0) {
        var numErrors = errByAnalyser[key].length;
        errStr = `(but couldn't analyse ${numErrors} ${pluralise("file", numErrors)}).`;
      }

      var totalIssues = _.reduce(value, function (acc, perFile) {
        return acc + perFile.issues.length;
      }, 0);

      debug("val: " + JSON.stringify(value));

      //some analysers specify an itemType for their annotations, e.g. 'security violation'
      var itemType = value[0].analyserItemType || "issue";  //each annotation for an analyser will have the same itemType (if specified)
      var itemTypeStr = pluralise(itemType, totalIssues);
      var details = `We found ${totalIssues} ${itemTypeStr}${errStr}`;
      var failIssues = _.indexOf(canFail, analyserFullname) !== -1 ? totalIssues : 0;

      debug(`total: ${totalIssues}, fail: ${failIssues}`);

      return { title: summary, details: details, analyser: key, totalIssues: totalIssues, failIssues: failIssues };
    });

    function numErrorsForAnalyser(analyser) {
      if (_.keys(errByAnalyser).length > 0) {
        if (errByAnalyser[analyser]) {
          return errByAnalyser[analyser].length;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    }

    function getDashes(analyserName) {
      const LINE_LENGTH = 28;
      if (analyserName.length < LINE_LENGTH) {
        return Array(LINE_LENGTH - analyserName.length).join("-");
      } else {
        return "";
      }
    }
  }

  function outputMeta(summary) {
    outputString(" ");
    outputString("Analysis results:", MESSAGE_TYPE.TITLE);

    summary.forEach(function (summaryLine) {
      outputString(summaryLine.title, MESSAGE_TYPE.INFO);
      outputString(summaryLine.details + "\n", MESSAGE_TYPE.ERROR);

      var analyserMeta = getMetaByAnalyser(summaryLine.analyser);

      analyserMeta.forEach(function (meta) {
        if (meta.issues.length > 0) {
          outputString(meta.path);
          outputString(prettifyMeta(meta), MESSAGE_TYPE.ERROR);
        }
      });
      outputString("", MESSAGE_TYPE.INFO);
    });

    function prettifyMeta(meta) {
      var issues = "";
      meta.issues.forEach(function (issue) {
        if (issue.startLine > -1) {
          issues += `Line ${issue.startLine}: ${issue.message}\n`;
        } else {
          issues += `${issue.message}\n`;
        }
      });
      return issues;
    }

  }

  function outputSummary(summary) {
    if (!command.ci) {
      spinner.stop(true); //clear console spinner line
    }
    outputMeta(summary);

    var totalIssues = _.reduce(summary, function (acc, val) {
      return acc + val.totalIssues;
    }, 0);

    var failIssues = _.reduce(summary, function (acc, val) {
      return acc + val.failIssues;
    }, 0);

    if (command.ci) {
      const otherIssues = totalIssues - failIssues;
      outputString(`Analysis summary: ${failIssues > 0 ? chalk.red(failIssues) : failIssues} ${pluralise("issue", failIssues)} found that will fail the build (${otherIssues} other ${pluralise("issue", otherIssues)} found)`, MESSAGE_TYPE.TITLE);
    } else {
      outputString(`Analysis summary: ${totalIssues} ${pluralise("issue", totalIssues)} found`, MESSAGE_TYPE.TITLE);
    }

    summary.forEach(function (summaryLine) {
      outputString(`  ${summaryLine.title} ${getCanFailStr(summaryLine.analyser, summaryLine.failIssues)}`, MESSAGE_TYPE.INFO);
      outputString("  " + summaryLine.details + "\n", MESSAGE_TYPE.ERROR);
    });

    function getCanFailStr(analyserName, failIssues) {
      if (command.ci && _.indexOf(canFail, analyserName) !== -1) {
        if (failIssues > 0) {
          return `${chalk.red("(will fail build)")}`;
        } else {
          return "(will fail build)";
        }
      } else {
        return "";
      }
    }
  }
}

function pluralise(str, count) {
  var suffix = "s"; //e.g. issue becomes issues
  if (_.endsWith(str, "y")) {
    suffix = "ies"; //e.g. dependency becomes dependencies
    return count === 1 ? str : str.substr(0, str.length - 1) + suffix;
  } else {
    return count === 1 ? str : str + suffix;
  }

}
