/**
 * connect to main processes's RPC
 */
"use strict";

var net = require("net");
var rpc = require("rpcjs");
var actors = require("rpcjs/actors");
var settings = require("@sidekick/common/settings");
var gui = require("./gui-control");
var Promise = require("bluebird");
var _ = require("lodash");
var log = require("debug")("MainProxy");
var reconnect = require("./streamReconnect");
var streamTransport = require("rpcjs/transports/streamTransport");


// singleton
var client;

exports.get = function() {
  if(!client) {
    throw new Error("not initialised");
  }
  return client;
};

exports.acquire = function(opts) {
  if(client) {
    throw new Error("already initialised");
  }

  client = rpc.client(_.defaults(opts || {}, {
    name: "cli2main",
    Promise: Promise,
  }));

  var bufferedTransport = new BufferedTransport;

  client.setSend(bufferedTransport.send);

  actors.mixin(client);

  var reconnector = reconnect(attemptConnection, {
    maxAttempts: 2,
    error: function(err) {
      // we're done
      throw err;
    },
  });

  return client;

  function attemptConnection(err, reconnectCount, cb) {
    log("attempting to connect to main, retries %d, err '%s'", reconnectCount, err && err.message);
    if(reconnectCount === 0) {
      // initial attempt
      connect();
    } else if(err) {
      // other end isn't up yet
      if(err.code === "ECONNREFUSED") {
        log("booting main");
        launchGui();
      } else {
        // we're done
        throw err;
      }
    } else {
      // we have 2 attempts - initial, which might succeed, then second where we have
      // an error. if we are not on first attempt, or reconnecting after failure, something is up!
      throw new Error("AssertionError<TooManyRetries>");
    }

    function launchGui() {
      gui.launch()
        .then(function() {
          log("heard gui up");
          connect();
          reconnector.stop();
        })
        .catch(function(err) {
          log("spawn fail", err);
          throw new Error("CouldNotSpawnMain");
        });
    }

    function connect() {
      log("connecting");

      var stream = net.connect({
        port: settings.port(),
      }, function() {
        log("connected");

        var disconnect = streamTransport.incoming(client, stream);
        bufferedTransport.setSend(_.partial(streamTransport.send, stream));

        stream.once("end", function() {
          log("cli2main stream ended");
        });

        stream.on("error", logErr);
      });

      cb(stream);

      function logErr(err) {
        log("cli2main stream error", err);
      }
    }
  }
};

function BufferedTransport() {
  var buf = [];
  var realSend;

  this.send = function(x) {
    if(realSend) {
      realSend(x);
    } else {
      buf.push(x);
    }
  };

  this.setSend = function(to) {
    realSend = to;

    send();

    function send() {
      if(buf.length > 0) {
        process.nextTick(function() {
          var msg = buf.shift();
          realSend(msg);
          send();
        });
      } else {
        buf = null;
      }
    }
  };
}
