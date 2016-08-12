/**
 * messaging to gui
 */

const settings = require("@sidekick/common/settings");
const os = require("@sidekick/common/os");

const spawner = require("./safeSpawn");
const spawnApp = process.env.DEVELOPMENT ? devSpawn : realSpawn;
const Promise = require("bluebird");
const fs = Promise.promisifyAll(require("fs"));

const GUI_TIMEOUT_MILLI = 2500;

const log = require("debug")("guiControl");

const _ = require("lodash");

exports.launch = launch;

function launch() {
  return spawnApp()
  .then(function(child) {
    // we want to exit without gui exiting
    child.unref();
  });
}


function devSpawn() {
  log('dev spawn of ui');

  const skGuiPath = __dirname + "/../../../sidekick/sk-deployed/build";

  return spawnWith('/usr/bin/env', [
    "npm", "run", "appDev"
  ], {
    cwd: skGuiPath,
  })
  .catch((e) => e.code === "ENOENT", function(e) {
    const msg = `can't find sk-gui repo for dev launch at '${skGuiPath}': ${e.message}`;
    log(msg);
    throw Error(msg); 
  });
}

function realSpawn() {
  const path = process.MAIN_PROCESS_PATH || "/Applications/Sidekick.app/Contents/MacOS/Electron";
  return spawnWith(path, [settings.port()]);
}

function spawnWith(cmd, args, opts) {
  var strippedEnv = _.omit(process.env, 'ELECTRON_RUN_AS_NODE');

  return spawner(cmd, args, _.defaults(opts || {}, {
    // pass through our env - important so it can resolve node etc (in dev)
    env: _.defaults({
      NO_AUTO_SHOW_GUI: true,
    }, strippedEnv),
  }), {
    timeout: GUI_TIMEOUT_MILLI,
    onCreate: function(child) {
      if(process.env.DEBUG) {
        child.stdout.on("data", function(data) {
          log("child stdout:" + data);
        });

        child.stderr.on("data", function(data) {
          log("child stdout:" + data);
        });
      }
    },
  });
}

