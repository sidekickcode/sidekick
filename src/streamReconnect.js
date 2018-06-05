/**
 * stream reconnection behaviour - will reconnect on "close", "end" or "error" event
 * of stream
 *
 *     type reconnect = reconnect(connector, options: { delay = 250, maxAttempts = 50)
 *     type connector = (error: Error | null, reconnectCount: number, getStream: streamCallback) => void
 *     type streamCallback = (stream: Stream) => void
 */

var _ = require("lodash");

module.exports = exports = reconnect;

function reconnect(getStream, opts) {
  var stream;
  var reconnectNumber = 0;
  var stopped = false;

  opts = _.defaults(opts || {}, {
    delay: 250,
    maxAttempts: 50,
  });

  if (!opts.error) {
    throw new Error("must provide error handler");
  }

  process.nextTick(connect);

  return {
    stop: stop,
  };

  function connect(error) {
    if (stopped) {
      return;
    }

    // are we done on this connection attempt?
    var reconnecting = false;

    if (reconnectNumber >= opts.maxAttempts) {
      return opts.error(new Error("too-many-attempts"));
    }

    getStream(error, reconnectNumber, function (newStream) {
      stream = newStream;

      stream.once("close", retry);
      stream.once("end", retry);
      stream.once("error", retry);
    });

    reconnectNumber += 1;

    function retry(err) {
      if (reconnecting) {
        return;
      }

      // last stream failed, so cleanup, then retry
      stream.removeListener("error", retry);
      stream.removeListener("end", retry);
      stream.removeListener("close", retry);

      reconnecting = true;
      connect(err);
    }
  }

  function stop() {
    stopped = true;

  }

}
