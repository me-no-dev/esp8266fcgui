'use strict';

var serial = {
    request:         null,
    bytesReceived:   0,
    bytesSent:       0,
    failed:          0,
    url:             'ws://192.168.254.171/ws',//'ws://' + location.host + '/ws',
    ws:              null,
    transmitting:    false,
    outputBuffer:    [],

    connect: function (path, options, callback) {
        var self = this;
        var request = {
            path:           path,
            options:        options,
            callback:       callback,
            fulfilled:      false,
            canceled:       false
        };
        self.request = request;
        console.log("Connecting to " + this.url);
        self.ws = new WebSocket(this.url);
        self.ws.binaryType = 'arraybuffer';
        self.ws.onopen = function() {
            console.log("Connected");
            if (!request.canceled) {
                self.bytesReceived = 0;
                self.bytesSent = 0;
                self.failed = 0;
                request.fulfilled = true;
                self.onReceive.addListener(function logBytesReceived(info) {
                    self.bytesReceived += info.data.byteLength;
                });
                if (request.callback) request.callback({});
            } else if (request.canceled) {
                setTimeout(function initialization() {
                    self.ws.close();
                }, 150);
            } 
        };
                
        self.ws.onmessage = function (evt) { 
            var received_msg = evt.data;
            for (var i = (self.onReceive.listeners.length - 1); i >= 0; i--) {
                if(self.onReceive.listeners[i])
                    self.onReceive.listeners[i]({data:evt.data}); 
            } 
        };
                
        self.ws.onclose = function() { 
            console.log("Connection is closed..."); 
        };
        
        self.ws.onerror = function(evt) {
            
        };
    },
    disconnect: function (callback) {
        var self = this;

        if (self.ws) {
            self.emptyOutputBuffer();
            // remove listeners
            for (var i = (self.onReceive.listeners.length - 1); i >= 0; i--) {
                self.onReceive.removeListener(self.onReceive.listeners[i]);
            }
            for (var i = (self.onReceiveError.listeners.length - 1); i >= 0; i--) {
                self.onReceiveError.removeListener(self.onReceiveError.listeners[i]);
            }
            self.ws.close();
  
            if (callback) callback({});
        } else {
            // connection wasn't opened, so we won't try to close anything
            // instead we will rise canceled flag which will prevent connect from continueing further after being canceled
            self.request.canceled = true;
        }
    },
    getDevices: function (callback) {
        callback(['ESP8266']);
    },
    getInfo: function (callback) {
    },
    getControlSignals: function (callback) {
    },
    setControlSignals: function (signals, callback) {
    },
    send: function (data, callback) {
        var self = this;
        self.outputBuffer.push({'data': data, 'callback': callback});

        function send() {
            // store inside separate variables in case array gets destroyed
            var data = self.outputBuffer[0].data,
                callback = self.outputBuffer[0].callback;

            if (self.ws) {
                self.ws.send(data, { binary: true });
                self.bytesSent += data.length; 
                if (callback) callback({});
                self.outputBuffer.shift();
                if (self.outputBuffer.length) {
                    if (self.outputBuffer.length > 100) {
                        var counter = 0;
                        while (self.outputBuffer.length > 100) {
                            self.outputBuffer.pop();
                            counter++;
                        }
                        console.log('SERIAL: Send buffer overflowing, dropped: ' + counter + ' entries');
                    }
                    send();
                } else {
                    self.transmitting = false;
                }
            }
        }
        if (!self.transmitting) {
            self.transmitting = true;
            send();
        }
    },
    onReceive: {
        listeners: [],
        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                    break;
                }
            }
        }
    },
    onReceiveError: {
        listeners: [],
        addListener: function (functionReference) {
            this.listeners.push(functionReference);
        },
        removeListener: function (functionReference) {
            for (var i = (this.listeners.length - 1); i >= 0; i--) {
                if (this.listeners[i] == functionReference) {
                    this.listeners.splice(i, 1);
                    break;
                }
            }
        }
    },
    emptyOutputBuffer: function () {
        this.outputBuffer = [];
        this.transmitting = false;
    }
};
