/**
 * shared test scenario for testing reporters
 *
 */
"use strict";

const EventEmitter = require("events").EventEmitter;
const _ = require("lodash");

exports.create = function(extraEvents) {
  const emitter = new EventEmitter;

  const events = [
    {
      name: "result",
      data: {
        analyser: "blubHint",
        path: "blub.js",
        issues: [
          { message: "oh no" },
          { message: "bad thing" },
        ]
       }
    },
    {
      name: "error",
      data: {
        analyser: "blubHint",
        path: "blub.js",
        error: {
          message: "Terrible",
        },
      },
    },
    {
      name: "error",
      data: {
        analyser: "blubHint",
        path: "blub.js",
        error: {
          message: "crash",
          stdout: "",
          stderr: "Everything is horrible!",
        },
      },
    },
  ].concat(extraEvents || []);

  events.push({
      name: "end",
      data: {}
  });

  emitter.eventsByName = _.groupBy(events, _.property("name"));
  

  emitter.start = function() {

    setImmediate(step);

    function step() {
      if(events.length) {
        const next = events.shift();
        emitter.emit(next.name, next.data);
        

        setImmediate(step);
      }
    }
  };

  return emitter;
}
