"use strict";

const fs = require("fs");
const PrepushHook = require("./prepush-hook-file");
const Promise = require("bluebird");
const log = require("../../common/log").derive({ tags: ["remove"] });
const git = require("../git");
const path = require("path");

module.exports = exports = Promise.method(runRemove);

exports._interpret = interpret;

function runRemove() {
  return gather(process.cwd())
  .spread(interpret)
  .then(function(exitOrCommand) {
    if(exitOrCommand instanceof Exit) {
      return exitOrCommand;
    }
    return write(exitOrCommand);
  })
  .then(handleExit)
  .catch(function(err) {
    log.error(err.stack || err);
    handleExit(new Exit(1, "unxpected error"));
  });
}

function gather(repoPath) {
  var isRepo = git.findRootGitRepo(repoPath) 
  var hookPath = repoPath + "/.git/hooks/pre-push";

  var hookFile = isRepo.then(function(path) {
    return fs.readFileSync(hookPath, { encoding: "utf8" });
  });

  return Promise.settle([
    hookPath,
    isRepo,
    hookFile,
  ])
}

// return Exit|Command
function interpret(path, isRepo, hookFile) {
  if(isRepo.isRejected()) {
    return new Exit(0, "this isn't a git repo, nothing to do");
  }

  if(hookFile.isRejected()) {
    const e = hookFile.reason();
    switch(e.code) {
    case "ENOENT":
      return new Exit(0, "no pre-push hook present, nothing to do");
    default:
      return new Exit(1, `unexpected error ${e.code || e.message} reading hook at ".git/hooks/pre-push"`);
    }
  }

  var commented = PrepushHook.withComment();
  if(hookFile.value().indexOf(commented) === -1) {
    return new Exit(0, "sidekick not installed in hook file, nothing to do");
  }

  var withoutHook = hookFile.value().replace(commented, "");

  return {
    command: "replace",
    path: path.value(),
    newContent:  withoutHook,
  };
}

function write(writeCommand) {
  return Promise.try(function() {
    fs.writeFileSync(writeCommand.path, writeCommand.newContent);
    return new Exit(0, "sidekick git hooks removed");
  })
  .catch(function(e) {
    return new Exit(1, `could not clean up git hooks, got error ${e.code || e.message}`);
  })
}

function handleExit(exit) {
  console[exit.isBad() ? "error" : "log"](exit.message);

  // FIXME hack around non-sync logging
  setTimeout(process.exit, 25, exit.code);
}


function Exit(code, message) {
  this.code = code;
  this.message = message;
  this.debug = new Error().stack;

  this.isBad = function() {
    return code !== 0;
  }
}

