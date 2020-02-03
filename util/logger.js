const FS = require("FS");
const dateFormat = require("dateformat");

module.exports = {
  logFile : null,
  
  log : function (message, timeStamp = true, prefix = false) {
    prefix = (timeStamp ? '[' + dateFormat(new Date(), "HH:MM:ss") + ']' : '') + (prefix ? '[' + prefix + ']' : '') + (((timeStamp || prefix) && message.toString().charAt(0) !== '[') ? ': ' : '');
    
    if (typeof (message) === 'string')
      console.log(prefix + message);
    else {
      console.log(prefix + ':');
      console.log(message);
    }
    
    FS.appendFile(Config.logFiles + '/' + this.logFile, message + '\r\n', (err) => {
      if (err) throw err;
    });
  },
  
  info : function(message, prefix = false) {
    if (prefix)
      this.log(message, true, prefix + '][INFO');
    else
      this.log(message, true, 'INFO');
  },
  
  warn : function(message, prefix = false) {
    if (prefix)
      this.log(message, true, prefix + '][WARNING');
    else
      this.log(message, true, 'WARNING');
  },
  
  debug : function(message, prefix = false) {
    if (prefix)
      this.log(message, true, prefix + '][DEBUG');
    else
      this.log(message, true, 'DEBUG');
  },
  
  error : function(err, prefix = false) {
    let output;
    if (typeof(err) === 'object' && typeof(err.message) === 'string')
      output = ((typeof(err.code) !== 'undefined') ? err.code : '') + err.stack;
    else
      output = err;
    
    if (typeof(output) === 'string' && output.indexOf('You have an error in your SQL syntax') !== -1)
      output = err.stack;

    if (prefix)
      this.log(output, true, prefix + '][ERROR');
    else
      this.log(output, true, 'ERROR');
  },
  
  getLogFile : function() {
    if (!FS.existsSync(Config.logFiles))
      FS.mkdirSync(Config.logFiles);
    
    if (!this.logFile) {
      let fileCount = 0;
      let date = DateFormat(new Date(), "yyyy-mm-dd");
      let files = FS.readdirSync(Config.logFiles);
      
      for (let i in files) {
        let match = /^[0-9]{4}-[0-9]{2}-[0-9]{2}-([0-9]{1,9})\.log$/gi.exec(files[i]);
        let index = match ? parseInt(match[1]) : null;
        if (match && index > fileCount) fileCount = index;
      }
      
      fileCount++;
      this.logFile = date + '-' + ((fileCount < 10) ? ('0' + fileCount) : fileCount) + '.log';
    }
    
    return this.logFile;
  }
};

module.exports.getLogFile();