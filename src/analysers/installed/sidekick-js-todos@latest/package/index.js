"use strict";

const sidekickAnalyser = require("sidekick-analyser");

const todos = require("js-todos");

const annotationDefaults = {analyserName: 'js-todos'};

if(require.main === module) {
  execute();
}
module.exports = exports = execute;

function execute() {
  sidekickAnalyser(function(setup) {
    var results = run(setup.content, {});
    console.log(JSON.stringify({ meta: results }));
  });
}

function run(content, config) {
  try {
    var errors = todos(content);
    return errors.map(format);
  } catch (err) {
    console.error("failed to analyse");
    console.log({ error: err });
    process.exit(1);
  }
}

function format(todo) {
  return {
    kind: todo.type,
    message: todo.value,
    analyser: annotationDefaults.analyserName,
    location: {
      startLine: todo.loc.start.line - 1,
      endLine: todo.loc.end.line - 1,
      startCharacter: todo.loc.start.column,
      endCharacter: todo.loc.end.column,
    },
  };
}
