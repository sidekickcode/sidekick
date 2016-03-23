/**
 * CLI output - writes directly to stdout
 */
"use strict";

const chalk = require('chalk');
const _ = require('lodash');
const Spinner = require('cli-spinner').Spinner;
//var ttys = require("ttys");

const readline = require("readline");

const SUCCESS_TICK = chalk.green("✔");

module.exports = exports = reporter;

const defaultOutput = (x) => console.log(x);

var metas, errors, spinner, processed, analyserSummaries = [], langCount;

const MESSAGE_TYPE = {
  INFO : 'cyan',
  ERROR : 'yellow',
  TITLE: 'magenta'
};

function reporter(emitter, outputter) {
  const output = outputter || defaultOutput;

  var cursor = readline.createInterface({ input: process.stdin, output: process.stdout });
  //var cursor = readline.createInterface({ input: ttys.stdin, output: ttys.stdout });

  var installLines = {};
  var curInstallerLine = 0;

  emitter.on("start", function(err, analysis /*: Analysis */){
    var fileStr = pluralise('file', data.paths.length);
    var analyserCount = data.analysers.length;
    var analyserStr = pluralise('analyser', analyserCount);

    langCount = data.languages.length;
    var timeStr = ` (should take about ${timeToRun(data.paths.length)})`;
    var title = `${chalk.green('Sidekick')} is running ${analyserCount} ${analyserStr} against ${data.paths.length} ${fileStr}${timeStr}.`;
    outputString(title);

    spinner = new Spinner('Analysing..');
    spinner.start();
    processed = 0;
    metas = [];
    errors = [];

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

  emitter.on("fileProcessed", function(){
    processed ++;
  });

  emitter.on("result", function(meta){
    metas.push(meta);
    processed ++;
  });

  emitter.on("error", function(err){
    errors.push(err);
  });

  emitter.on("end", function(){
    outputSummary();
  });

  //todo needs green ticks and reset to be 1 line per analyser
  emitter.on('downloading', function(data){
    outputString(`Downloading analyser: ${data.analyser}`);
    installLines[data.analyser] = curInstallerLine;
    curInstallerLine ++;
  });
  emitter.on('downloaded', function(data){
    outputString(`Downloaded analyser: ${data.analyser}`);
    //outputLine(`Downloaded analyser: ${data.analyser}`, installLines[data.analyser]);
  });
  emitter.on('installing', function(data){
    outputString(`Installing analyser: ${data.analyser}`);
    //outputLine(`Installing analyser: ${data.analyser}`, installLines[data.analyser]);
  });
  emitter.on('installed', function(data){
    outputString(SUCCESS_TICK + ` Installed analyser: ${data.analyser}`);
    //outputLine(SUCCESS_TICK + ` Installed analyser: ${data.analyser}`, installLines[data.analyser]);
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

  function getSummariesForLang(){
    var issuesByAnalyser = _.groupBy(metas, 'analyser');
    var errByAnalyser = _.groupBy(errors, 'analyser');
    var summariesForLang = [];

    _.forEach(issuesByAnalyser, function(value, key){

      var analyserName = value[0].analyserDisplayName || key;
      var summary = `-- ${analyserName} ${getDashes(analyserName)}`;  //format is [-- analyserName ----------] (dashes fill upto 30 chars)

      var errStr = '.';
      if(numErrorsForAnalyser(key) > 0){
        var numErrors = errByAnalyser[key].length;
        errStr = ` (but couldn\'t analyse ${numErrors} ${pluralise('file', numErrors)}).`;
      }

      //some analysers specify an itemType for their annotations, e.g. 'security violation'
      var itemType = value[0].analyserItemType || 'issue';  //each annotation for an analyser will have the same itemType (if specified)
      var itemTypeStr = pluralise(itemType, value.length);
      var details = `We found ${value.length} ${itemTypeStr}${errStr}`;

      summariesForLang.push({title: summary, details: details});
    });
    return summariesForLang;

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

  function outputSummary(){
    analyserSummaries.push(getSummariesForLang());
    spinner.stop(true); //clear console spinner line

    //when we have run all the analysers for all the languages - show summary
    if(analyserSummaries.length === langCount){
      outputString(' ');
      outputString('Analysis summary:', MESSAGE_TYPE.TITLE);

      analyserSummaries.forEach(function(summariesForLang){
        summariesForLang.forEach(function(summary){
          outputString('  ' + summary.title, MESSAGE_TYPE.INFO);
          outputString('  ' + summary.details + '\n', MESSAGE_TYPE.ERROR);
        });
      });
    }
  }
}

function pluralise(str, count){
  var suffix = 's'; //e.g. issue becomes issues
  if(_.endsWith(str, 'y')){
    suffix = 'ies'; //e.g. dependency becomes dependencies
    return count === 1 ? str : str.substr(0, length(str) - 1) + suffix;
  } else {
    return count === 1 ? str : str + suffix;
  }

}
