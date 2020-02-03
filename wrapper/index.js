var { spawn } = require('child_process');

class ServerHandler
{ 
  constructor (serverName) {    
    this.name = serverName;
    this.state = 0; // 0: closed, 1: starting, 2: online, 3: shutdown, 4: restart, 5: error
    this.events = new Events.EventEmitter();
    this.scheduler = null;
    this.childProcess = null;
    
    this.events.on('error', (err) => {
      Logger.debug('#error');
      Logger.error(err);
    });

    this.events.on('state', (state) => {
      Logger.debug('#state (' + state + ')');
      
      MySQL.query("UPDATE `" + Config.mysql.db + "`.`server` SET `state` = " + parseInt(state) + ", `online` = " + ((state == 3) ? 1 : 0) + " WHERE `name` = '" + this.name + "'", function(err) {
        if (err) Logger.error(err);
      });
    });
    
    this.events.on('start', () => {
      Logger.debug('#start');
    });
    
    this.events.on('online', () => {
      Logger.debug('#online');
    });

    this.events.on('shutdown', () => {
      Logger.debug('#shutdown');
    });
    
    this.events.on('restart', () => {
      Logger.debug('#restart');
    });
    
    this.events.on('kill', () => {
      Logger.debug('#kill');
    });
    
    this.events.on('close', () => {
      Logger.debug('#close');
    });
  }
  
  getFromDb (serverName) {
    return new Promise((resolve, reject) => {
      MySQL.query("SELECT * FROM `" + Config.mysql.db + "`.`server` WHERE `name` = " + MySQL.escape(serverName), (err, rows, fields) => {
        if (err) {
          Logger.error(err);
          reject(new Error('Database Error'), null);
          return;
        }
        
        if (rows.length < 1)
          reject(new Error('No server named "' + serverName + '" was found'), null);
        else if (rows.length > 1)
          reject(new Error('There are multible servers named "' + serverName + '"'), null);
        else {
          let serverInfo = Object.assign({}, rows[0]);
          serverInfo.javaParams = this.parseOptionalJavaParams(serverInfo.javaParams);
          serverInfo.startParams = this.buildStartParams(serverInfo);
          Object.assign(this, serverInfo);
          resolve();
        }
      });
    });
  }
  
  parseOptionalJavaParams (_params) {
    let params = [];
    if (typeof(_params) !== 'string' || _params.replace(/\s/gi, '').length < 1)
      return [];
    _params = (_params + '\n').replace(/\r\n/gi, '\n').split('\n');
    for (var i in _params) {
      if (_params[i].length < 1) continue;
      params.push(_params[i]);
    }
    return params;
  }
  
  checkIfRunning (pid, forceKill = false) {
    return new Promise((resolve, reject) => {
      var killSignalSent = false;
      var checkCount = 0;
      
      if (pid > 0 && IsRunning(pid)) {
        if (forceKill) {
          Logger.warn('Server is already running trying a graceful shutdown...');
          Logger.warn('Stopping PID: ' + pid + ' with signal: SIGTERM...');
          process.kill(pid, 'SIGTERM');
          
          var interval = setInterval(() => {
            checkCount++;
            
            if (!IsRunning(pid)) {
              Logger.warn('PID: ' + pid + ' stopped.');
              clearInterval(interval);
              resolve();
              return;
            }
            
            if (!killSignalSent && checkCount > 10) {
              Logger.warn('Graceful shutdown failed! (Server is not responding)');
              Logger.warn('Stopping PID: ' + pid + ' with signal: SIGKILL...');
              process.kill(pid, 'SIGKILL');
              killSignalSent = true;
            }
          }, 1000);
        }
        else
          reject(new Error('Server is already running. PID: ' + pid));
      }
      else
        resolve();
    });
 }
  
  start (options) {
    return new Promise((resolve, reject) => {
      if (this.state !== 0) {
        reject(new Error('Server already running'));
        return;
      }
      
      this.getFromDb(this.name)
      // TODO: Check heartbeat
        .then(() => this.checkIfRunning(this.pid, (options.forceKill == true)))
        
        .then(() => {
          this.state = 1;
          this.events.emit('state', this.state);
          this.events.emit('start');
          
          // Do forceUpgrade if requested
          if (options.forceUpgrade == true) {
            this.startParams.push('--forceUpgrade');
            options.noRestart = true;
          }
          
          // Create working directory
          if (!FS.existsSync(this.path))
            FS.mkdirSync(this.path);
        
          // Write eula-file
          FS.writeFileSync(this.path + '/eula.txt', 'eula=true');
        
          // Create or update server.properties
          this.properties = this.setProperties(this.path, {
            'server-name'   : this.name,
            'server-port'   : this.mcPort,
            'max-players'   : this.maxPlayers,
            'enable-query'  : this.queryEnabled ? true : false,
            'query.port'    : this.queryPort,
            'enable-rcon'   : this.rconPassword ? (this.rconEnabled ? true : false) : false,
            'rcon.port'     : this.rconPort,
            'rcon.password' : this.rconPassword
          });
          
          this.shutdownAnnounced = false;
          
          this.scheduler = setInterval(() => {
            let date = new Date(),
                hours = parseInt(date.getHours());
            
            if (options.noRestart !== true && this.state === 2) {
              if (!this.shutdownAnnounced && (hours == 1 || hours == 13 || hours == 7 || hours == 19)) {
                if (parseInt(date.getMinutes()) > 44 && this.name != 'lobby')
                  this.announceShutdown();
                
                if (parseInt(date.getMinutes()) > 49 && this.name == 'lobby')
                  this.announceShutdown();
              }
            }
          }, 1000);
          
          Logger.info('Starting Minecraft-Server...');
        
          if (this.pid > 0 && IsRunning(this.pid))
            Logger.warn('RENNT NOCH!');
        
          this.childProcess = spawn('java', this.startParams, {
            uid       : (this.gid > 0) ? this.gid : null,
            gid       : (this.gid > 0) ? this.gid : null,  
            cwd       : this.path,
            detached  : true
          });
          
          this.childProcess.stdout.on('data', (output) =>  this.parseOutput(output));
          this.childProcess.stderr.on('data', (output) =>  this.parseOutput(output));
          this.childProcess.on('close', (code) => this.onChildProcessClosed(code));
          this.pid = this.childProcess.pid;
          
          let timestamp = Math.floor(new Date() / 1000);
          MySQL.query("UPDATE `" + Config.mysql.db + "`.`server` SET " +
            "`pid`            = " + this.pid + ", " +
            "`uid`            = " + this.uid + ", " + 
            "`gid`            = " + this.gid + ", " +
            "`lastStart`      = " + timestamp + ", "+
            "`lastActive`     = " + timestamp + " " +
          "WHERE `name` = '" + this.name + "'", function(err) {
            if (err) Logger.error(err);
          });
          
          resolve();
        })
        .catch(err => {
          reject(err);
        });
    });
  }
  
  stop () {
    return new Promise((resolve, reject) => {
      if (this.state !== 2 && this.state !== 5) {
        reject(new Error('Server is not running'));
        return;
      }
      
      clearInterval(this.scheduler);
      
      this.childProcess.stdin.write('minecraft:stop\n');
      this.state = 3;
      this.events.emit('state', this.state);
      this.events.emit('shutdown');
      resolve();
    });
  }
  
  restart () {
    return new Promise((resolve, reject) => {
      if (this.state !== 2 && this.state !== 5) {
        reject(new Error('Server is not running'));
        return;
      }
      
      this.childProcess.stdin.write('minecraft:stop\n');
      this.state = 4;
      this.events.emit('state', this.state);
      this.events.emit('restart');
      resolve();
    });
  }
  
  kill (signal = 'SIGKILL') {
    return new Promise((resolve, reject) => {
      if (this.state < 1) {
        reject(new Error('Server is not running'));
        return;
      }
      
      this.childProcess.kill(signal);
      this.state = 0;
      this.events.emit('state', this.state);
      this.events.emit('kill');
      resolve();
    });
  }
  
  input (data) {
    if (this.state !== 2)
      return false;

    if (data.charAt(0) === '/')
      data = data.replace(/\//g, '');
    
    switch (data) {
      case 'restart', 'minecraft:restart' : me.restart(); return;
      case 'stop',    'minecraft:stop'    : me.stop(); return;
    }
    
   this.childProcess.stdin.write(data + '\n');
  }
  
  onChildProcessClosed (code) {
    if (this.state == 4) {
      this.start();
      return;
    }
    
    this.state = 0;
    this.events.emit('state', this.state);
    this.events.emit('close');
    setTimeout(() => process.exit(0), 2000);
  }
  
  setProperties (path, newProperties) {
    let properties = this.readProperties(path);
    for (let key in newProperties)
      properties[key] = newProperties[key];
    this.writeProperties(path, properties);
    return properties;
  }

  writeProperties (path, properties) {
    let data = '';
    for (let key in properties) {
      if (properties[key] !== null)
        data += key + '=' + properties[key] + '\r\n';
    }
    FS.writeFileSync(path + '/server.properties', data);
  }

  readProperties (path) {
    let data, properties = {};
    try {
      data = FS.readFileSync(path + '/server.properties').toString();
      data = data.replace(/\r\n/gi, '\n');
      data = data.split('\n');
    }
    catch (ex) {
      return properties;
    }
    for (let i in data) {
      if (data[i].charAt(0) === '#' || data[i].indexOf('=') === -1) continue;
      let property = data[i].split('=');
      let key	= property[0],
          val		= property[1];

      val = (val === 'true') ? true : val;
      val = (val === 'false') ? false : val;
      properties[key] = val;
    }
    return properties;
  }
  
  announceShutdown () {
    if (this.shutdownAnnounced)
      return false;

    this.shutdownAnnounced = true;
    
    this.input('tellraw @a [{"text":"Achtung:","color":"dark_red"},{"text":" Server wird in ","color":"gold"},{"text":"15 Min.","color":"yellow"},{"text":" neu gestartet","color":"gold"}]');
    Logger.info('Shutdown in 15 minutes');
    
    setTimeout(() => {
      this.input('tellraw @a [{"text":"Achtung:","color":"dark_red"},{"text":" Server wird in ","color":"gold"},{"text":"10 Min.","color":"yellow"},{"text":" neu gestartet","color":"gold"}]');
      Logger.info('Shutdown in 10 minutes');
    }, 1000*60*5);

    setTimeout(() => {
      this.input('tellraw @a [{"text":"Achtung:","color":"dark_red"},{"text":" Server wird in ","color":"gold"},{"text":"5 Min.","color":"yellow"},{"text":" neu gestartet","color":"gold"}]');
      Logger.info('Shutdown in 5 minutes');
    }, 1000*60*10);

    setTimeout(() => {
      this.input('tellraw @a [{"text":"Achtung:","color":"dark_red"},{"text":" Server wird in ","color":"gold"},{"text":"1 Min.","color":"yellow"},{"text":" neu gestartet","color":"gold"}]');
      Logger.info('Shutdown in 1 minute');
    }, 1000*60*14);

    setTimeout(() => {
      this.input('tellraw @a [{"text":"Achtung:","color":"dark_red"},{"text":" Server wird ","color":"gold"},{"text":"JETZT","color":"yellow"},{"text":" neu gestartet","color":"gold"}]');
      Logger.info('Shutdown NOW!');
      
      setTimeout(() => {
        this.stop();
      }, 1000);
    }, 1000*60*15);
  }
  
  /****************
   *  Prototypes  *
   ****************/
  
  // !PROTOTYPE! (overwritten by child classes)
  buildStartParams (serverInfo) {
    let params = []
    params.push('-Xms' + serverInfo.maxRam);
    params.push('-Xmx' + serverInfo.maxRam)
    
    for (var i in serverInfo.javaParams)
      params.push(serverInfo.javaParams[i]);
    
    params.push('-jar', serverInfo.jarPath);
    params.push('-W', serverInfo.worldPath);
    return params;
  }
  
  // !PROTOTYPE! (overwritten by child classes)
  parseOutput (output) {
    let lines = output.toString().replace(/^\s+|\s+$/g, '').replace(/\r\n/g, '\n').split('\n');

    for (let i in lines) {
      let line = lines[i],
          logLevel = 'info',
          match = /^(?:\[\d\d:\d\d:\d\d\s([A-Z]{0,})]:\s(.*)$)|(?:\[\d\d:\d\d:\d\d\]\s?\[(?:.*)\/([A-Z]{0,})]:\s(.*)$)/gim.exec(line);
    
      if (match) {
        logLevel = (match[1] || match[3] || 'info').toLowerCase(),
        line = match[2] || match[4];
      }

      if (!line) {
        console.log(output.toString());
        Logger.error(new Error('failed trying to parse server-ouput'));
        return;
      }
      
      this.events.emit('output', line, logLevel);
      this.handleOutput(line, logLevel);
    }
  }
  
  // !PROTOTYPE! (overwritten by child classes)
  handleOutput (line, logLevel) {
    let match;
    
    Logger[logLevel](line, 'Bukkit');
    
    // Matching minecraft version
    match = /^Starting\sminecraft\sserver\sversion\s([a-z0-9.]{0,12})$/gi.exec(line);
    if (match) {
      this.serverVersion = match[1];
      return;
    }
    
    // Matching name and version of server
    match = /^This\sserver\sis\srunning\s([a-z0-9-]{0,})\sversion\s(.*)\s\(MC:\s(.*)\)\s\(Implementing\sAPI\sversion(.*)\)$/gi.exec(line);
    if (match) {
      this.serverVersion = match[2] || 'unkown';
      this.mcVersion = this.mcVersion || match[3] || 'unkown';
      this.apiVersion = match[4] || 'unkown';
      
      if (match[2].toLowerCase().indexOf('spigot') !== -1)
        this.serverName = 'Spigot';
      else if (match[2].toLowerCase().indexOf('bukkit') !== -1)
        this.serverName = 'Bukkit';
      else if (['paper', 'glowstone'].indexOf(match[1].toLowerCase()) !== -1)
        this.serverName = match[1];
      else
        this.serverName =  'unkown';
      return;
    }
    
    // Matching server port
    match = /^Starting\sMinecraft\sserver\son\s(.*):([0-9]{0,})$/gi.exec(line);
    if (match) {
      let ip = match[1],
          port = match[2];
          
      // TODO: Check if port correct
      return;
    }
    
    // Matching when server is ready
    match = /^Done\s\(([.0-9]{0,})s\)!\sFor\shelp,\stype\s"help"$/gi.exec(line);
    if (match) {
      this.startupDuration = match[1];
      Logger.info('Done! MC-Server listening at port: ' + this.mcPort);
      Logger.info('Server-Version: ' + this.serverName + '(' + this.serverVersion + ')');
      Logger.info('MC-Version: ' + this.mcVersion);
      this.state = 2;
      this.events.emit('state', this.state);
      this.events.emit('online');
      return;
    }
    
    // Matching 'port in use'
    match = /^\*\*\*\*\sFAILED\sTO\sBIND\sTO\sPORT!$/gi.exec(line);
    if (match) {      
      this.state = 5;
      this.events.emit('state', this.state);
      this.events.emit('error', new Error('Failed to bind to port ' + this.mcPort + '!'));
      this.kill('SIGINT');
      setTimeout(() => process.exit(0), 1000);
      return;
    }
    
    if (line.toLowerCase().startsWith('error:')) {
      this.state = 5;
      this.events.emit('state', this.state);
      this.events.emit('error', new Error(line.replace(/Error:[\s]?/i, '')));
      this.kill('SIGINT');
      setTimeout(() => process.exit(0), 1000);
      return;
    }
  }
}

module.exports = ServerHandler;