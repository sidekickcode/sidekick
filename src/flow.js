/**
 * helpers for CLI processes
 */
"use strict";

const Promise = require("bluebird");
const RepoConfig = require("@sidekick/common/repoConfig");

exports.Exit = Exit;

// runs a sequence of functions that will return a Exit instance
// if they desire and exit with a certain code
exports.runValidations = function runValidations(vals, log) {

  return step();

  function step() {
    return Promise.try(function() {
      if(vals.length === 0) {
        return Promise.resolve(true);
      } else {
        var validation = vals.shift();
        log("running " + validation.name);

        return validation()
        .then(function(exit) {
          return exit instanceof Exit ? exit : step();
        });
      }
    });
  }
};

exports.hasConfigValidation = function hasConfig(path) {
  return RepoConfig.load(path)
  .catch(SyntaxError, function(err) {
    return new Exit(1, `could not parse ".sidekickrc" as JSON, "${err.message}"`);
  })
  .catch(function(err) {
    const msg = missingConfigErrorMessages(err);
    return new Exit(1, `sidekick hook present, ${msg}.`);
  });

  function missingConfigErrorMessages(err) {
    switch(err.code) {
    case "ENOENT":
      return `but there is no ".sidekickrc" file in the root of this repo. run "sk init" to create one, or "sk remove" to remove the hook`;
    case "EACCES":
    case "EPERM":
      return `but had issues opening ".sidekickrc" (file permissions?)`;
    default:
      return `had an unexpected issue when opening ".sidekickrc" (${err.code || err.message}). run "sk init" to create a ".sidekickrc" file`;
    }
  }
};

// value object
function Exit(code, message) {
  this.code = code;
  this.message = message;
  this.debug = new Error().stack;

  this.isBad = function() {
    return code !== 0;
  };
}

