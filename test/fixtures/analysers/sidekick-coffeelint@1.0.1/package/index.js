"use strict";

const sidekickAnalyser = require("sidekick-analyser");
const stripJsonComments = require("strip-json-comments");

const lint = require("coffeelint").lint;

const annotationDefaults = {analyserName: 'coffeelint'};
const configFileName = 'coffeelint.json';

if(require.main === module) {
  execute();
}
module.exports = exports = execute;

function execute() {
  sidekickAnalyser(function(setup) {
    var config;

    var conf = (setup.configFiles || {})[configFileName];
    if(conf) {
      try {
        config = JSON.parse(stripJsonComments(conf));
      } catch(e) {
        // FIXME need some way of signalling
        console.error("can't parse config");
        console.error(e);
      }
    }

    if(!config) {
      config = {};
    }

    var results = run(setup.content, config);
    console.log(JSON.stringify({ meta: results }));
  });
}

function run(content, config) {
  content = content.replace(/^\uFEFF/, ""); // Remove potential Unicode BOM.

  try {
    var errors = lint(content, config);
    return errors.map(format);
  } catch (err) {
    console.error("failed to analyse");
    console.log({ error: err });
    process.exit(1);
  }
}

function format(err) {
  return {
    location: {
      analyser: annotationDefaults.analyserName,
      startLine: err.lineNumber - 1,
      startCharacter: 0,
      endLine: err.lineNumber - 1,
      endCharacter: 0,
    },
    message: err.message,
    kind: err.rule,
  };
}
