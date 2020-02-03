module.exports = {
  events      : new Events.EventEmitter(),
  connection  : null,
  srvName     : null,
  authKey     : null,
  stored      : null,
  
  initialized : false,
  isConnected : false,
  loggedIn    : false,
  doReconnect : true,
  
  reconnectAttempts : 0,
  
  init : function() {
    this.initialized = true;
    this.events.on('auth-success', () => {
      Logger.info('Successfully connected to CTMyAdmin!', 'API');
      this.events.emit('connection');      
    });
  },
  
  connect : function(srvName = null, authKey = null) {
    if (this.isConnected)
      return;
    
    if (!this.initialized)
      this.init();
    
    this.srvName = this.srvName || srvName || null;
    this.authKey = this.authKey || authKey || null;

    Logger.info('Try connecting to CTMyAdmin...', 'API');
    this.connection = Net.createConnection({ port: Config.ports.apiServer }, (connection) => this.onConnection(connection));
    this.connection.on('error', (err)  => this.onError(err));	
    this.connection.on('data',  (data) => this.onData(data));
    this.connection.on('close', ()     => this.onDisconnect());
  },
  
  disconnect : function() {
    if (!this.isConnected) return;
    this.doReconnect = false;
    this.connection.end();
  },
  
  reconnect : function() {
    if (!this.doReconnect) return;
    let delay = 5;
    if (this.reconnectAttempts > 50)	timeout = 10;
    if (this.reconnectAttempts > 100)	timeout = 15;
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay * 1000);
  },
  
  emit : function(...args) {
    if (!this.isConnected || !this.connection.writable)
      return;
    
    let evt = args.shift();
      
    let jsonData = null, packet = {
        evt   : evt,
        args	: args
    };
    
    try          { jsonData = JSON.stringify(packet) }
    catch (err)  { Logger.error(err, 'API')	}
    
    if (jsonData)
      this.connection.write(jsonData + '\n');
  },
    
  onError : function (err) {
    if (err.code === 'ECONNREFUSED')  return;
    if (err.code === 'ECONNRESET')    return;
    Logger.error(err, 'API');
  },
  
  onData : function (data) {
    let packets = data.toString().split('\n');
   
    for (let i in packets) {
      if (packets[i].length < 1) continue;
      
      if (i == (packets.length -1) && packets[i].length > 1) {
        this.stored = packets[i];
        return;
      }
      
      let packet = null;
          
      try         { packet = JSON.parse(packets[i]) }
      catch (err) { Logger.error(err, 'API') }
      
      if (!packet || typeof (packet.evt) !== 'string' || typeof (packet.args) !== 'object') {
        FS.writeFileSync('malformed.txt', packets[i]);
        Logger.warn('received malformed packet', 'API');
        continue;
      }
      
      Logger.debug(packet, 'API')
      
      // #packet
      this.events.emit('packet', packet);
      
      let args = packet.args;
      args.unshift(packet.evt);
      
      // #%server-events%
      this.events.emit.apply(this.events, args);
    }
  },
  
  onConnection : function () {
    this.isConnected = true;
    this.doReconnect = true;
    this.reconnectAttempts = 0;   

    this.emit('auth', 'ct-wrapper', this.srvName, this.authKey);
  },
  
  onDisconnect : function () {
    if (!this.isConnected)
      Logger.warn('Unable to connect to CTMyAdmin!', 'API');
    else {
      Logger.warn('Lost connection to CTMyAdmin!', 'API');

      this.isConnected = false;
      this.events.emit('disconnect');  
    }
    
    if (this.doReconnect)
      this.reconnect();  
  }
};