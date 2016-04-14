/**
 * CLI output - writes directly to stdout
 */
"use strict";

const chalk = require('chalk');
const _ = require('lodash');
const Spinner = require('cli-spinner').Spinner;
const debug = require('debug')('cliSummary');

const readline = require("readline");

const SUCCESS_TICK = chalk.green("✔");

module.exports = exports = reporter;

const Readable = require("stream").Readable;
const defaultOutput = (x) => console.log(x);


const MESSAGE_TYPE = {
  INFO : 'cyan',
  ERROR : 'yellow',
  TITLE: 'magenta'
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

  emitter.on("start", function(err, data, analysis /*: Analysis */){
    if(command.ci) {
      outputString('Starting analysis');
    } else {
      spinner = new Spinner('Analysing..');
      spinner.start();
    }
    var langCount; // = analysis.plan.raw.byAnalysers.length;
    var analyserCount;
    var fileCount;

    //debug('analysis: ' + langCount + " : " + analyserCount + " : " + fileCount);
    // broken
    return;

    var fileStr = pluralise('file', fileCount);
    var analyserStr = pluralise('analyser', analyserCount);
    var timeStr = ` (should take about ${timeToRun(fileCount)})`;
    var title = `${chalk.green('Sidekick')} is running ${analyserCount} ${analyserStr} against ${fileCount} ${fileStr}${timeStr}.`;
    outputString(title);


    function timeToRun(fileCount){
      if(fileCount < 60){
        return `${fileCount} ${pluralise('second', fileCount)}`;
      } else if(fileCount <=90) {
        return 'a minute and a half';
      } else {
        return `${parseInt( Math.floor(fileCount / 60))} minutes`;
      }
    }
  });

  emitter.on("result", function(meta){
    metas.push(meta);
    processed ++;
  });

  emitter.on("error", function(err){
    errors.push(err);
  });

  emitter.on("end", function(){
    outputSummary(getSummariesByAnalyser());
  });

  //todo needs to be 1 line per analyser
  emitter.on('downloading', function(data){
    data = data[0];
    if(data.canFailCi){
      canFail.push(data.analyser);
    }
    outputString(`Downloading analyser: ${data.analyser} (${data.version})`);
    installLines[data.analyser] = curInstallerLine;
    curInstallerLine ++;
  });
  emitter.on('downloaded', function(data){
    data = data[0];
    outputString(`Downloaded analyser: ${data.analyser}`);
  });
  emitter.on('installing', function(data){
    data = data[0];
    outputString(`Installing analyser: ${data.analyser}`);
  });
  emitter.on('installed', function(data){
    data = data[0];
    outputString(SUCCESS_TICK + ` Installed analyser: ${data.analyser}`);
  });

  function outputString(x, colour) {
    if(colour){
      try{
          console.log(chalk[colour](x));
      } catch(err){
        outputJson(err);
      }
    } else {
      output(x);
    }
  }
  function outputJson(x) {
    output(JSON.stringify(x));
  }

  function outputLine(str, line){
    const TO_THE_RIGHT_OF_CURSOR = 1;
    readline.moveCursor(process.stdout, 0, 3 - line);
    readline.clearLine(process.stdout, TO_THE_RIGHT_OF_CURSOR);
    cursor.write(str);
  }

  function getMetaByAnalyser(analyser){
    return _.values(_.groupBy(metas, 'analyser')[analyser]);
  }

  function getSummariesByAnalyser(){
    var issuesByAnalyser = _.groupBy(metas, 'analyser');
    var errByAnalyser = _.groupBy(errors, 'analyser');

    return _.map(issuesByAnalyser, function(value, key){
      var analyserName = value[0].analyserDisplayName || key;
      var summary = `-- ${analyserName} ${getDashes(analyserName)}`;  //format is [-- analyserName ----------] (dashes fill upto 30 chars)

      var errStr = '.';
      if(numErrorsForAnalyser(key) > 0){
        var numErrors = errByAnalyser[key].length;
        errStr = ` (but couldn\'t analyse ${numErrors} ${pluralise('file', numErrors)}).`;
      }

      var totalIssues = _.reduce(value, function(acc, perFile){
        return acc + perFile.issues.length;
      }, 0);

      debug('val: ' + JSON.stringify(value));

      //some analysers specify an itemType for their annotations, e.g. 'security violation'
      var itemType = value[0].analyserItemType || 'issue';  //each annotation for an analyser will have the same itemType (if specified)
      var itemTypeStr = pluralise(itemType, totalIssues);
      var details = `We found ${totalIssues} ${itemTypeStr}${errStr}`;
      var failIssues = _.indexOf(canFail, analyserName) !== -1 ? totalIssues : 0;

      return {title: summary, details: details, analyser: key, totalIssues: totalIssues, failIssues: failIssues};
    });

    function numErrorsForAnalyser(analyser){
      if(_.keys(errByAnalyser).length > 0){
        if(errByAnalyser[analyser]){
          return errByAnalyser[analyser].length;
        } else {
          return 0;
        }
      } else {
        return 0;
      }
    }

    function getDashes(analyserName){
      const LINE_LENGTH = 28;
      if(analyserName.length < LINE_LENGTH){
        return Array(LINE_LENGTH - analyserName.length).join('-');
      } else {
        return '';
      }
    }
  }

  function outputMeta(summary) {
    outputString(' ');
    outputString('Analysis results:', MESSAGE_TYPE.TITLE);

    summary.forEach(function(summaryLine){
      outputString(summaryLine.title, MESSAGE_TYPE.INFO);
      outputString(summaryLine.details + '\n', MESSAGE_TYPE.ERROR);

      var analyserMeta = getMetaByAnalyser(summaryLine.analyser);

      analyserMeta.forEach(function(meta){
        if(meta.issues.length > 0){
          outputString(meta.path);
          outputString(prettifyMeta(meta), MESSAGE_TYPE.ERROR);
        }
      });
      outputString('', MESSAGE_TYPE.INFO);
    });

    function prettifyMeta(meta){
      var issues = '';
      meta.issues.forEach(function(issue){
        issues += `Line ${issue.startLine}: ${issue.message}\n`;
      });
      return issues;
    }

  }

  function outputSummary(summary) {
    if(!command.ci) {
      spinner.stop(true); //clear console spinner line
    }
    outputMeta(summary);

    var totalIssues = _.reduce(summary, function(acc, val){
      return acc + val.totalIssues;
    }, 0);

    var failIssues = _.reduce(summary, function(acc, val){
      return acc + val.failIssues;
    }, 0);

    if(command.ci){
      outputString(`Analysis summary: ${failIssues} ${pluralise('issue', failIssues)} found that will break the build (${totalIssues} other ${pluralise('issue', totalIssues)} found)`, MESSAGE_TYPE.TITLE);
    } else {
      outputString(`Analysis summary: ${totalIssues} ${pluralise('issue', totalIssues)} found`, MESSAGE_TYPE.TITLE);
    }

    summary.forEach(function(summaryLine){
      outputString(`  ${summaryLine.title} ${getCanFailStr(summaryLine.analyser)}`, MESSAGE_TYPE.INFO);
      outputString('  ' + summaryLine.details + '\n', MESSAGE_TYPE.ERROR);
    });

    function getCanFailStr(analyserName){
      if(command.ci && _.indexOf(canFail, analyserName) !== -1){
        return `(will fail build)`;
      } else {
        return '';
      }
    }
  }
}

function pluralise(str, count){
  var suffix = 's'; //e.g. issue becomes issues
  if(_.endsWith(str, 'y')){
    suffix = 'ies'; //e.g. dependency becomes dependencies
    return count === 1 ? str : str.substr(0, str.length - 1) + suffix;
  } else {
    return count === 1 ? str : str + suffix;
  }

}
