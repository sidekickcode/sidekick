"use strict";

const textUi = require("./textUi");

const events = require("events");

const log = require("debug")("prepushUiNonTty");

module.exports = exports = run;

function run(setup) {

  const main = setup.main;
  const prepush = setup.prepush;
  const pushDefinition = setup.push;
  const prefix = "push-process:" + pushDefinition.id + ":";

  const api = new events.EventEmitter;

  main.once(prefix + "end", function(err, pushResult) {
    if(err) {
      console.error("error while running sidekick: " + err);
    } else {
      var output = textUi.banner([
        "PUSH COMPLETE",
        "Push completed successfully in SidekickJS app :)",
        "",
        "Git reports an error when its push is cancelled. We cancel git's push so we can push after the fix commit. TL;DR it's fine, your code was pushed.",
      ], {
        width: 50,
      });

      console.log(output);
      api.emit("exit", 0);
    }
  });

  prepush.on("exitOptionalSkipping", function(exit) {
    console.error(exit.message);
    api.emit("exit", exit.code);
  });

  prepush.on("handOffToGui", function(event) {
    console.log(event.message);
  });

  return api;
}
