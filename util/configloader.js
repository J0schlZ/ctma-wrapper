module.exports = {
  createDefaultConfig : function () {
    let cfg = {
      "ports" : {
        "web": 8255,
        "api": 8250
      },
      "mysql": {
        "host": "127.0.0.1",
        "user": "minecraft",
        "password": "",
        "db": "ctmyadmin"
      },
      "logFiles": "./logs"
    };
    
    this.saveConfig(cfg);
  },
  
  getConfig : function () {
    if (FS.existsSync('./config.json')) {
      let cfg = null;
      
      try {
        cfg = FS.readFileSync('./config.json').toString();
        cfg = JSON.parse(cfg);
        global.Config = cfg;
        return cfg;
      }
      catch (err) {
        console.log(err.message);
      }
      
      if (cfg === null)
        throw new Error('Unable to read config.json');
    }
    
    this.createDefaultConfig();
    
    console.log('Please edit your config.json!');
    return false;
  },
  
  saveConfig : function(cfg = null) {
    if (cfg)
      FS.writeFileSync('./config.json', JSON.stringify(cfg, null, 2));
    else
      FS.writeFileSync('./config.json', JSON.stringify(Config, null, 2));
  }
};