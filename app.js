global.FS         = require('fs');
global.Path       = require('path');
global.Net        = require('net');
global.Events     = require('events');
global.IsRunning  = require('is-running');
global.DateFormat = require('dateformat');
global.Express    = require('express');

global.ConfigLoader   = require('./util/configloader');
global.Config         = ConfigLoader.getConfig() || process.exit(0);
global.Logger         = require('./util/logger');
global.MySQL          = require('./util/database');
global.APIClient      = require('./util/apiclient');
global.ServerWrapper  = require('./wrapper');

global.Server = null;
global.interrupted = false;

function wrap(srvName, options) {
  Logger.info('CT-Wrapper startet.');
 
  //APIClient.connect(srvName, Config.authKey); // Connection to CTMyAdmin
  Server = new ServerWrapper(srvName); // Wraps MC-Server

  // CTMA -> Wrapper
  APIClient.events.on('input',   (data)   => Server.input(data) .catch(err => APIClient.emit('server-error', err.message)));
  APIClient.events.on('start',   ()       => Server.start()     .catch(err => APIClient.emit('server-error', err.message)));
  APIClient.events.on('stop',    ()       => Server.stop()      .catch(err => APIClient.emit('server-error', err.message)));
  APIClient.events.on('restart', ()       => Server.restart()   .catch(err => APIClient.emit('server-error', err.message)));
  APIClient.events.on('kill',    (signal) => Server.kill(signal).catch(err => APIClient.emit('server-error', err.message)));

  // Wrapper -> CTMA
  Server.events.on('error',        (err)          => APIClient.emit('server-error', err.message));
  Server.events.on('state',        (state)        => APIClient.emit('server-state', state));
  Server.events.on('output',       (line, logLvl) => APIClient.emit('server-output', line, logLvl));
  Server.events.on('start',        ()             => APIClient.emit('server-start'));
  Server.events.on('restart',      ()             => APIClient.emit('server-restart'));
  Server.events.on('online',       ()             => APIClient.emit('server-online'));
  Server.events.on('shutdown',     ()             => APIClient.emit('server-shutdown'));
  Server.events.on('close',        ()             => APIClient.emit('server-close'));

  Server.start(options).catch(err => {
    APIClient.emit('server-error', err.message);
    Logger.error(err);
    setTimeout(() => process.exit(0), 1000);
  });
}

function handleInterrupt() {
  if (interrupted) return;
  interrupted = true;
  
  Logger.warn('CTMyAdmin was interrupted.');
  
  if (Server && Server.state > 0 && Server.state < 5) {
    Server.events.on('close', () => process.exit(0));
    
    if (Server.state === 2 || Server.state === 3) {
      Logger.warn('Shutting down Minecraft-Server... (SIGINT)');
      if (Server.state === 2) Server.stop();
    }
    
    if (Server.state === 1 || Server.state === 4) {
      Logger.warn('Minecraft Server is starting... Waiting until finishing startup before shutting down.');
      Server.events.on('online', () => {
        Logger.warn('Shutting down Minecraft-Server... (SIGINT)');
        Server.stop();
      });
    }

    return;
  }
  
  setTimeout(function() {
    process.exit(0);
  }, 2000);
}

process.on('uncaughtException', (err) => Logger.error(err));
process.on('SIGINT',            ()    => handleInterrupt());
process.on('SIGTERM',           ()    => handleInterrupt());

if (!process.argv[2]) {
  Logger.error('You have to provide a servername!');
  process.exit(0);
}

var options = {};

if (process.argv.indexOf('--forceKill') !== -1)
  options['forceKill'] = true;

if (process.argv.indexOf('--noRestart') !== -1)
  options['noRestart'] = true;

if (process.argv.indexOf('--forceUpgrade') !== -1)
  options['forceUpgrade'] = true;

wrap(process.argv[2], options);
