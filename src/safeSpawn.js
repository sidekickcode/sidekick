/**
 * child_process.spawn with extra assurances the process started correctly
 *
 * we give assurances via simple contract the other process follows to let us know when it's ready:
 *
 * if up and everything is ok, output this line
 *
 *    { up: true }\n
 *
 * if failing for a known reason, output the following line
 *
 *    { error: "error string }\n
 *
 * this is designed for use with processes that are expected to be up for a while for later communication
 */
"use strict";

const spawn = require("child_process").spawn;
const _ = require("lodash");
var Promise = require("bluebird");

module.exports = exports = Promise.method(spawner);

function spawner(cmd, args, spawnOpts, opts) {
  if (!opts || isNaN(opts.timeout)) {
    throw new Error("requires opts.timeout in milliseconds");
  }

  var spawnOptions = _.defaults(spawnOpts || {}, {
    detached: true,
  });

  var spawned = new Promise(function (resolve, reject) {
    var child = spawn(cmd, args, spawnOptions);

    if (opts.onCreate) {
      opts.onCreate(child);
    }

    child.once("exit", function (code, signal) {
      var error = new Error("ChildExit");
      error.code = code;
      error.signal = signal;
      fail(error);
    });

    child.once("error", fail);

    var buf = "";
    child.stdout.on("data", listenForUp);

    setTimeout(function () {
      if (!spawned.isResolved()) {
        fail(new Error("Timeout"));
      }
    }, opts.timeout);

    return;


    function listenForUp(data) {
      buf += data;

      var nextLineIndex;
      while (nextLineIndex = buf.indexOf("\n"), nextLineIndex !== -1) {
        var nextLine = buf.slice(0, nextLineIndex);
        var b4 = buf;
        buf = buf.slice(nextLineIndex + 1);

        try {
          var parsed = JSON.parse(nextLine);
        } catch (e) {
          // not our line
          continue;
        }

        if (parsed.up) {
          resolve(child);
          return;
        } else if (parsed.error) {
          var error = new Error("ExplicitFailure");
          error.reason = parsed.error;
          fail(error);

          return;
        } else {
          // not the message we're looking for
        }
      }
    }

    function fail(err) {
      cleanup();
      reject(err);
    }

    function cleanup() {
      child.stdout.removeAllListeners();
      child.removeAllListeners();

      // we want to exit even if child never does
      child.unref();

      // tell it to give up
      child.kill();

      child = null;
    }

  });

  return spawned;
}
