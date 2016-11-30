'use strict';

/*
    I am using a 9ms timeout timer to protect from GUI reading / reacting to any data sent after status byte 2 arrives.
    The exact time should be 10ms, but consider that everything in js is asynchronous and the serial API will also create
    some delay, i think 9ms is a reasonable value to use.

    It might be worth nothing that there might be need for a special "enter" routine since after the serial connection
    is opened the protocol expects to receive the 1 status byte, if we are in a middle of transmission after status byte 2
    which we missed, this might create some problems.
*/

var kissProtocol = {
    GET_TELEMETRY:  0x20,
    GET_INFO:       0x21,
    ESC_INFO:       0x22,
    GET_SETTINGS:   0x30,
    SET_SETTINGS:   0x10,
    MOTOR_TEST:     0x11,

    block:                  false,
    ready:                  false,
    receiving:              false,
    state:                  0,
    packetLength:           0,
    packetBuffer:           null,
    packetBufferU8:         null,
    packetBytesReceived:    0,
    packetCrc:              0,
    packetCrcCounter:       0,
    processingRequest:      null,
    data:                   [],
    requests:               [],
    errCase:                  0,
RequestInterval:   0,
    ReceiveTimeout:   0,
};

kissProtocol.read = function (readInfo) {
    var self = this;
    var data = new Uint8Array(readInfo.data);
    var dataLength = data.length;
    for (var i = 0; i < dataLength; i++) {
        if (this.block) continue; // skip any data until the timeout expires
	
        if (this.receiving) {
            switch (this.state) {
                case 0:
                    // wait for start byte
                    if (data[i] == 5) this.state++;
                    else this.state = 0;
		    
		    this.errCase++;
		    if(this.errCase > 3){
			    this.receiving = false;
			    this.errCase = 0;
			    this.state = 0;
			    //console.log('kissProtocol: reset errCase');
		    }
                    break;
                case 1:
                    // amount of bytes, reset variables to default state and prepare buffers
                    this.packetLength = data[i];
                    this.packetBuffer = new ArrayBuffer(this.packetLength);
                    this.packetBufferU8 = new Uint8Array(this.packetBuffer);
                    this.packetBytesReceived = 0;
                    this.packetCrc = 0;
                    this.packetCrcCounter = 0;
                    this.state++;
                    break;
                case 2:
                    // save received data in buffer and increase crc
                    this.packetBufferU8[this.packetBytesReceived] = data[i];
                    this.packetBytesReceived++;
                    this.packetCrc += data[i];
                    this.packetCrcCounter++;

                    if (this.packetBytesReceived >= this.packetLength) this.state++;
                    break;
                case 3:
                    // calculate crc, if crc matches -> process data, otherwise log an crc error
                    if (Math.floor(this.packetCrc / this.packetCrcCounter) == data[i]) {
                        if (this.data[this.processingRequest.code]) {
                            this.data[this.processingRequest.code]['buffer'] = this.packetBuffer;
                            this.data[this.processingRequest.code]['callback'] = this.processingRequest.callback;
                        } else {
                            this.data[this.processingRequest.code] = {'buffer': this.packetBuffer, 'callback': this.processingRequest.callback};
                        }

                        this.processPacket(this.processingRequest.code, this.data[this.processingRequest.code]);
                    } else {
			this.receiving = false;
		        this.state = 0;
                        console.log('kissProtocol: CRC Failed for last operation');
			return;
                    }

                    this.requests.splice(0, 1);
                    this.receiving = false;
                    this.state = 0;
                    break;

                default:
                    console.log('Unknown state detected: ' + this.state);
            }
        }
    }
   kissProtocol.proceedRequest();
};

kissProtocol.send = function (code, data, callback) {
    var bufferOut = new ArrayBuffer(data.length);
    var bufferView = new Uint8Array(bufferOut);

    bufferView.set(data, 0);

    this.requests.push({
        'code': code,
        'buffer': bufferOut,
        'callback': (callback) ? callback : false
    });
    kissProtocol.proceedRequest();
};

kissProtocol.proceedRequest = function() {
	if (!this.receiving){
		this.ready = true;
		if (this.requests.length) {
			this.processingRequest = this.requests[0];
			this.receiving = true;
			this.errCase = 0;		
			serial.send(this.processingRequest.buffer, function (sendInfo) {
				kissProtocol.proceedRequest();
			});
		}
		if(this.ReceiveTimeout != 0 ){
			clearTimeout(this.ReceiveTimeout);
			this.ReceiveTimeout = 0;
		}
		this.ReceiveTimeout =  window.setTimeout(function(){kissProtocol.receiving = false;},5000); 
	}
}

kissProtocol.processPacket = function (code, obj) {
    var data = new DataView(obj.buffer, 0);

    switch (code) {
        case this.GET_TELEMETRY:
            if (!obj.RXcommands) {
                obj.RXcommands = [];
                obj.GyroXYZ = [];
                obj.ACCXYZ = [];
                obj.angle = [];
                obj.GyroRaw = [];
                obj.ACCRaw = [];
                obj.ACCtrim = [];
                obj.ACCAng = [];
                obj.PWMOutVals = [];
				obj.ESC_Telemetrie0 = [];
				obj.ESC_Telemetrie1 = [];
				obj.ESC_Telemetrie2 = [];
				obj.ESC_Telemetrie3 = [];
				obj.ESC_Telemetrie4 = [];
				obj.ESC_Telemetrie5 = [];
				obj.ESC_TelemetrieStats = [];
            }

            obj.RXcommands[0] = 1000 + ((data.getInt16(0, 0) / 1000) * 1000);
            obj.RXcommands[1] = 1500 + ((data.getInt16(2, 0) / 1000) * 500);
            obj.RXcommands[2] = 1500 + ((data.getInt16(4, 0) / 1000) * 500);
            obj.RXcommands[3] = 1500 + ((data.getInt16(6, 0) / 1000) * 500);
            obj.RXcommands[4] = 1500 + ((data.getInt16(8, 0) / 1000) * 500);
            obj.RXcommands[5] = 1500 + ((data.getInt16(10, 0) / 1000) * 500);
            obj.RXcommands[6] = 1500 + ((data.getInt16(12, 0) / 1000) * 500);
            obj.RXcommands[7] = 1500 + ((data.getInt16(14, 0) / 1000) * 500);
            obj.Armed = data.getUint8(16);
            obj.LiPoVolt = data.getInt16(17, 0) /1000;
            obj.GyroXYZ[0] = data.getInt16(19, 0);
            obj.GyroXYZ[1] = data.getInt16(21, 0);
            obj.GyroXYZ[2] = data.getInt16(23, 0);
            obj.ACCXYZ[0] = data.getInt16(25, 0);
            obj.ACCXYZ[1] = data.getInt16(27, 0);
            obj.ACCXYZ[2] = data.getInt16(29, 0);
            obj.angle[0] = data.getInt16(31, 0) / 1000;
            obj.angle[1] = data.getInt16(33, 0) / 1000;
            obj.angle[2] = data.getInt16(35, 0) / 1000;
            obj.I2C_Errors = data.getInt16(37, 0);
            obj.calibGyroDone = data.getInt16(39, 0);
            obj.failsave = data.getUint8(41);
            obj.debug = data.getUint16(42, 0) / 1000;
            obj.foundRX = data.getUint8(44);

            obj.GyroRaw[0] = data.getInt16(45, 0) / 1000;
            obj.GyroRaw[1] = data.getInt16(47, 0) / 1000;
            obj.GyroRaw[2] = data.getInt16(49, 0) / 1000;
            obj.ACCRaw[0] = data.getInt16(51, 0) / 1000;
            obj.ACCRaw[1] = data.getInt16(53, 0) / 1000;
            obj.ACCRaw[2] = data.getInt16(55, 0) / 1000;
            obj.ACCtrim[0] = data.getInt16(57, 0) / 1000;
            obj.ACCtrim[1] = data.getInt16(59, 0) / 1000;
            obj.ACCAng[0] = data.getInt16(61, 0) / 1000;
            obj.ACCAng[1] = data.getInt16(63, 0) / 1000;
            obj.mode = data.getUint8(65);
            obj.debug = data.getUint16(66, 0) / 1000;
            obj.PWMOutVals[0] = data.getInt16(68, 0);
            obj.PWMOutVals[1] = data.getInt16(70, 0);
            obj.PWMOutVals[2] = data.getInt16(72, 0);
            obj.PWMOutVals[3] = data.getInt16(74, 0);
            obj.PWMOutVals[4] = data.getInt16(76, 0);
            obj.PWMOutVals[5] = data.getInt16(78, 0);
            obj.debug2 = data.getUint16(80, 0) / 1000;
            obj.idleTime = data.getUint8(82);
	    
            obj.ESC_Telemetrie0[0] = data.getInt16(83, 0);
            obj.ESC_Telemetrie0[1] = data.getInt16(85, 0);
            obj.ESC_Telemetrie0[2] = data.getInt16(87, 0);
            obj.ESC_Telemetrie0[3] = data.getInt16(89, 0);
            obj.ESC_Telemetrie0[4] = data.getInt16(91, 0);
	    
            obj.ESC_Telemetrie1[0] = data.getInt16(93, 0);
            obj.ESC_Telemetrie1[1] = data.getInt16(95, 0);
            obj.ESC_Telemetrie1[2] = data.getInt16(97, 0);
            obj.ESC_Telemetrie1[3] = data.getInt16(99, 0);
            obj.ESC_Telemetrie1[4] = data.getInt16(101, 0);
	    
            obj.ESC_Telemetrie2[0] = data.getInt16(103, 0);
            obj.ESC_Telemetrie2[1] = data.getInt16(105, 0);
            obj.ESC_Telemetrie2[2] = data.getInt16(107, 0);
            obj.ESC_Telemetrie2[3] = data.getInt16(109, 0);
            obj.ESC_Telemetrie2[4] = data.getInt16(111, 0);
	    
            obj.ESC_Telemetrie3[0] = data.getInt16(113, 0);
            obj.ESC_Telemetrie3[1] = data.getInt16(115, 0);
            obj.ESC_Telemetrie3[2] = data.getInt16(117, 0);
            obj.ESC_Telemetrie3[3] = data.getInt16(119, 0);
            obj.ESC_Telemetrie3[4] = data.getInt16(121, 0);
	    
            obj.ESC_Telemetrie4[0] = data.getInt16(123, 0);
            obj.ESC_Telemetrie4[1] = data.getInt16(125, 0);
            obj.ESC_Telemetrie4[2] = data.getInt16(127, 0);
            obj.ESC_Telemetrie4[3] = data.getInt16(129, 0);
            obj.ESC_Telemetrie4[4] = data.getInt16(131, 0);
	    
            obj.ESC_Telemetrie5[0] = data.getInt16(133, 0);
            obj.ESC_Telemetrie5[1] = data.getInt16(135, 0);
            obj.ESC_Telemetrie5[2] = data.getInt16(137, 0);
            obj.ESC_Telemetrie5[3] = data.getInt16(139, 0);
            obj.ESC_Telemetrie5[4] = data.getInt16(141, 0);
	
            obj.ESC_TelemetrieStats[0] = data.getInt16(142, 0);
            obj.ESC_TelemetrieStats[1] = data.getInt16(144, 0);
            obj.ESC_TelemetrieStats[2] = data.getInt16(146, 0);
            obj.ESC_TelemetrieStats[3] = data.getInt16(148, 0);
            obj.ESC_TelemetrieStats[4] = data.getInt16(150, 0);
	    	obj.ESC_TelemetrieStats[5] = data.getInt16(152, 0);
            break;
        case this.GET_SETTINGS:
            if (!obj.G_P) {
                obj.G_P = [];
                obj.G_I = [];
                obj.G_D = [];
                obj.ACCtrim = [];
                obj.RC_Rate = [];
                obj.RPY_Expo = [];
                obj.RPY_Curve = [];
                obj.ACCZero = [];
	        	obj.SN = [];
				obj.TPA = [];
				obj.RGB = [];
				obj.CBO = [];
				obj.AUX = [];
            }

            obj.G_P[0] = data.getUint16(0, 0) / 1000;
            obj.G_P[1] = data.getUint16(2, 0) / 1000;
            obj.G_P[2] = data.getUint16(4, 0) / 1000;

            obj.G_I[0] = data.getUint16(6, 0) / 1000;
            obj.G_I[1] = data.getUint16(8, 0) / 1000;
            obj.G_I[2] = data.getUint16(10, 0) / 1000;

            obj.G_D[0] = data.getUint16(12, 0) / 1000;
            obj.G_D[1] = data.getUint16(14, 0) / 1000;
            obj.G_D[2] = data.getUint16(16, 0) / 1000;

            obj.A_P = data.getUint16(18, 0) / 1000;
            obj.A_I = data.getUint16(20, 0) / 1000;
            obj.A_D = data.getUint16(22, 0) / 1000;
            obj.ACCtrim[0] = data.getInt16(24, 0) / 1000;
            obj.ACCtrim[1] = data.getInt16(26, 0) / 1000;

            obj.RC_Rate[0] = data.getInt16(28, 0) / 1000;
            obj.RC_Rate[1] = data.getInt16(30, 0) / 1000;
            obj.RC_Rate[2] = data.getInt16(32, 0) / 1000;
            obj.RPY_Expo[0] = data.getInt16(34, 0) / 1000;
            obj.RPY_Expo[1] = data.getInt16(36, 0) / 1000;
            obj.RPY_Expo[2] = data.getInt16(38, 0) / 1000;
            obj.RPY_Curve[0] = data.getInt16(40, 0) / 1000;
            obj.RPY_Curve[1] = data.getInt16(42, 0) / 1000;
            obj.RPY_Curve[2] = data.getInt16(44, 0) / 1000;
			obj.ver = data.getUint8(92);
            obj.RXType = data.getInt16(46, 0);
            obj.PPMchanOrder = data.getInt16(48, 0);
            obj.CopterType = data.getInt16(50, 0);
            obj.Active3DMode = data.getInt16(52, 0);
            obj.ESConeshot125 = data.getInt16(54, 0);
            obj.MinCommand16 = data.getInt16(56, 0)+1000;
            obj.MidCommand16 = data.getInt16(58, 0)+1000;
            obj.MinThrottle16 = data.getInt16(60, 0)+1000;
            obj.MaxThrottle16 = data.getInt16(62, 0)+1000;
	    	obj.TYmid16 = data.getInt16(64, 0);
	    	obj.TYinv8 = data.getUint8(66, 0);
            obj.ACCZero[0] = data.getInt16(67, 0);
            obj.ACCZero[1] = data.getInt16(69, 0);
            obj.ACCZero[2] = data.getInt16(71, 0);
            obj.AUX[0] = data.getUint8(73);
            obj.AUX[1] = data.getUint8(74);
            obj.AUX[2] = data.getUint8(75);
            obj.AUX[3] = data.getUint8(76);
            if (obj.ver < 104) {
            	obj.aux1Funk = data.getUint8(73);
            	obj.aux2Funk = data.getUint8(74);
            	obj.aux3Funk = data.getUint8(75);
            	obj.aux4Funk = data.getUint8(76);
            }
	    	obj.maxAng = data.getUint16(77) / 14.3;
	    	obj.LPF = data.getUint8(79);
	    
	    	obj.SN[0] = data.getUint8(80);
	    	obj.SN[1] = data.getUint8(81);
	    	obj.SN[2] = data.getUint8(82);
	    	obj.SN[3] = data.getUint8(83);
	    	obj.SN[4] = data.getUint8(84);
	    	obj.SN[5] = data.getUint8(85);
	    	obj.SN[6] = data.getUint8(86);
	    	obj.SN[7] = data.getUint8(87);
	    	obj.SN[8] = data.getUint8(88);
	    	obj.SN[9] = data.getUint8(89);
	    	obj.SN[10] = data.getUint8(90);
	    	obj.SN[11] = data.getUint8(91);
	    
	    	//obj.ver = data.getUint8(92);
	    
            obj.TPA[0] = data.getUint16(93, 0) / 1000;
            obj.TPA[1] = data.getUint16(95, 0) / 1000;
            obj.TPA[2] = data.getUint16(97, 0) / 1000;
	    	obj.ESConeshot42 = data.getUint8(99);
	    	obj.failsaveseconds = data.getUint8(100);
	    	if (obj.ver > 100){
		    	obj.BoardRotation = data.getUint8(101);
		    	obj.isActive = data.getUint8(102);
		    	obj.actKey = 0;
	    	}
	    	if(obj.ver > 101){
		    	obj.CustomTPAInfluence = data.getUint8(103);
		    	obj.TPABP1 = data.getUint8(104);
		    	obj.TPABP2 = data.getUint8(105);
		    	obj.TPABPI1 = data.getUint8(106);
		    	obj.TPABPI2 = data.getUint8(107);
		    	obj.TPABPI3 = data.getUint8(108);
		    	obj.TPABPI4 = data.getUint8(109);
		    
		    	obj.BatteryInfluence = data.getUint8(110);
		    	obj.voltage1 = data.getInt16(111, 0) / 10;
		    	obj.voltage2 = data.getInt16(113, 0) / 10;
		    	obj.voltage3 = data.getInt16(115, 0) / 10;
		    	obj.voltgePercent1 = data.getUint8(117);
		    	obj.voltgePercent2 = data.getUint8(118);
		    	obj.voltgePercent3 = data.getUint8(119);
	    	}
	    	obj.loggerConfig = 0;
	    	obj.secret = 0;
	    	obj.vbatAlarm = 0;
	    	obj.debugVariables = 0;
	    	
	    	if (obj.ver > 102){
	        	obj.secret = data.getUint8(120);
	        	obj.loggerConfig = data.getUint8(121);
	    	} 
	    	if (obj.ver > 103){
	        	obj.RGB[0] = data.getUint8(122);
	        	obj.RGB[1] = data.getUint8(123);
	        	obj.RGB[2] = data.getUint8(124);
	        	obj.vbatAlarm = data.getUint16(125, 0) / 10;
	        	
	        	obj.CBO[0] = data.getInt16(127, 0);
	        	obj.CBO[1] = data.getInt16(129, 0);
	        	obj.CBO[2] = data.getInt16(131, 0);
	        	
	        	obj.AUX[4] = data.getUint8(133);
	        	
	        	obj.lapTimerTypeAndInterface = data.getUint8(134);
	        	obj.lapTimerTransponderId = data.getUint16(135, 0);

	        	obj.loggerDebugVariables =  data.getUint8(137);
	    	} 
	    	kissProtocol.upgradeTo104(obj);
            break;
        case this.SET_SETTINGS:
            console.log('Settings saved');
            break;
            
        case this.MOTOR_TEST:
            console.log('Motor test');
            break;
            
        case this.GET_INFO:
            var p = 0;
            obj.escInfo = [];
            obj.escInfoCount = 0;
            obj.firmvareVersion = kissProtocol.readString(data, p);
            p += obj.firmvareVersion.length + 1;
          
          	if (p < data.byteLength) { 
            	// if we have data left
   				obj.escInfoCount =  data.getUint8(p++);
   				for (var i = 0; i < obj.escInfoCount; i++) {
   					var info = { SN: '', version: 0, type: 'UNKNOWN ESC' };
   					var SN = [];
   					var CPUID = '';
   					for (var j = 0; j < 12; j++) SN[j] = data.getUint8(p++);
   				
        			for (var r = 0; r < 4; r++) {
           				CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
        			}
        			CPUID += '-';
        			for (var r = 4; r < 8; r++) {
            			CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
       				}
        			CPUID += '-';
        			for (var r = 8; r < 12; r++) {
            			CPUID += ((SN[r] < 16) ? '0' : '') + SN[r].toString(16).toUpperCase();
        			}
        			info.SN = CPUID;
   					info.version  = data.getUint8(p++) / 100;
   					var found = info.version!=0;
   					info.version += String.fromCharCode(data.getUint8(p++));
   					var type = +data.getUint8(p++);
   					if (type == 1) {
   						info.type='KISS 8A';
   					} else if (type == 2) {
   						info.type='KISS 16A';
   					} else if (type == 3) {
   						info.type='KISS 24A';
   					}
   					if (!found) info = undefined;
   					obj.escInfo[i] = info;
   				}
   			}	
   			 
            break;

        case this.ESC_INFO:
            break;
 
         default:
            console.log('Unknown code received: ' + code);
    }

    if (obj.callback) obj.callback();
};

kissProtocol.preparePacket = function (code, obj) {
    var buffer = new ArrayBuffer(255); // clean buffer!
    var blen = 0;
    
    var data = new DataView(buffer, 0);
    
    var crc = 0;
    var crcCounter = 0;

    switch (code) {
        case this.SET_SETTINGS:
        
        	kissProtocol.downgradeFrom104(obj);
        	
        	//console.log(obj);
        
            data.setUint16(0, obj.G_P[0] * 1000, 0);
            data.setUint16(2, obj.G_P[1] * 1000, 0);
            data.setUint16(4, obj.G_P[2] * 1000, 0);

            data.setUint16(6, obj.G_I[0] * 1000, 0);
            data.setUint16(8, obj.G_I[1] * 1000, 0);
            data.setUint16(10, obj.G_I[2] * 1000, 0);

            data.setUint16(12, obj.G_D[0] * 1000, 0);
            data.setUint16(14, obj.G_D[1] * 1000, 0);
            data.setUint16(16, obj.G_D[2] * 1000, 0);

            data.setUint16(18, obj.A_P * 1000, 0);
            data.setUint16(20, obj.A_I * 1000, 0);
            data.setUint16(22, obj.A_D * 1000, 0);
            data.setInt16(24, obj.ACCtrim[0] * 1000, 0);
            data.setInt16(26, obj.ACCtrim[1] * 1000, 0);

            data.setInt16(28, obj.RC_Rate[0] * 1000, 0);
            data.setInt16(30, obj.RC_Rate[1] * 1000, 0);
            data.setInt16(32, obj.RC_Rate[2] * 1000, 0);
            data.setInt16(34, obj.RPY_Expo[0] * 1000, 0);
            data.setInt16(36, obj.RPY_Expo[1] * 1000, 0);
            data.setInt16(38, obj.RPY_Expo[2] * 1000, 0);
            data.setInt16(40, obj.RPY_Curve[0] * 1000, 0);
            data.setInt16(42, obj.RPY_Curve[1] * 1000, 0);
            data.setInt16(44, obj.RPY_Curve[2] * 1000, 0);

            data.setInt16(46, obj.RXType, 0);
            data.setInt16(48, obj.PPMchanOrder, 0);
            data.setInt16(50, obj.CopterType, 0);
            data.setInt16(52, obj.Active3DMode, 0);
            data.setInt16(54, obj.ESConeshot125, 0);
            data.setInt16(56, obj.MinCommand16-1000, 0);
            data.setInt16(58, obj.MidCommand16-1000, 0);
            data.setInt16(60, obj.MinThrottle16-1000, 0);
            data.setInt16(62, obj.MaxThrottle16-1000, 0);
	    	data.setInt16(64, obj.TYmid16, 0);
	    	data.setUint8(66, obj.TYinv8, 0);
            data.setInt16(67, obj.ACCZero[0], 0);
            data.setInt16(69, obj.ACCZero[1], 0);
            data.setInt16(71, obj.ACCZero[2], 0);

            if (obj.ver>103) {
           		data.setUint8(73, obj.AUX[0]);
            	data.setUint8(74, obj.AUX[1]);
            	data.setUint8(75, obj.AUX[2]);
            	data.setUint8(76, obj.AUX[3]);
            } else {
            	data.setUint8(73, obj.aux1Funk);
            	data.setUint8(74, obj.aux2Funk);
            	data.setUint8(75, obj.aux3Funk);
            	data.setUint8(76, obj.aux4Funk);
            }
 	    	data.setUint16(77, obj.maxAng * 14.3);
	    	data.setUint8(79, obj.LPF);
	
            data.setUint16(80, obj.TPA[0] * 1000, 0);
            data.setUint16(82, obj.TPA[1] * 1000, 0);
            data.setUint16(84, obj.TPA[2] * 1000, 0);
	    	data.setUint8(86, obj.ESConeshot42,0);
	    	data.setUint8(87, obj.failsaveseconds,0);
	    	blen=88;

	    	if (obj.ver > 100){
	    		if (!obj.isActive) {
	    			console.log('The controller is not activated, let activate it with ' + obj.actKey);
	    			data.setUint16(88, obj.actKey>>16,0);
	    			data.setUint16(90, (obj.actKey&0xFFFF),0);
	    		} else {
	    			console.log('The controller is active');
	    			data.setUint16(88, 0, 0);
	    			data.setUint16(90, 0, 0);
	    		}
		    	data.setUint8(92, obj.BoardRotation, 0);
		    	blen=93;
	    	}

	    	if (obj.ver > 101){
		    	data.setUint8(93, obj.CustomTPAInfluence);
		    	data.setUint8(94, obj.TPABP1);
		    	data.setUint8(95, obj.TPABP2);
		    	data.setUint8(96, obj.TPABPI1);
		    	data.setUint8(97, obj.TPABPI2);
		    	data.setUint8(98, obj.TPABPI3);
		    	data.setUint8(99, obj.TPABPI4);
		    	data.setUint8(100, obj.BatteryInfluence);
		    	data.setUint16(101, obj.voltage1 * 10, 0);
		    	data.setUint16(103, obj.voltage2 * 10, 0);
		    	data.setUint16(105, obj.voltage3 * 10, 0);
		    	data.setUint8(107, obj.voltgePercent1);
		    	data.setUint8(108, obj.voltgePercent2);
		    	data.setUint8(109, obj.voltgePercent3);
		    	blen=110;
	    	}
	    	if (obj.ver > 102) {
	    		data.setUint8(110, obj.secret);
	    		data.setUint8(111, obj.loggerConfig);
	    		blen=112;
	    	}

	    	if (obj.ver > 103) {
	    		data.setUint8(112, obj.RGB[0]);
	    		data.setUint8(113, obj.RGB[1]);
	    		data.setUint8(114, obj.RGB[2]);
	    		data.setUint16(115, obj.vbatAlarm * 10, 0);
	    		data.setInt16(117, obj.CBO[0]);
	    		data.setInt16(119, obj.CBO[1]);
	    		data.setInt16(121, obj.CBO[2]);
	    		data.setUint8(123, obj.AUX[4]);
	    		data.setUint8(124, obj.lapTimerTypeAndInterface);
	    		data.setUint16(125, obj.lapTimerTransponderId, 0);
	    		data.setUint8(127, obj.loggerDebugVariables);
	    		
	    		blen=136;
	    	}
            break;
            
          case this.MOTOR_TEST:
          	 	data.setUint8(0, obj.motorTestEnabled, 0);
          	 	data.setUint8(1, obj.motorTest[0], 0);
          	 	data.setUint8(2, obj.motorTest[1], 0);
          	 	data.setUint8(3, obj.motorTest[2], 0);
          	 	data.setUint8(4, obj.motorTest[3], 0);
          	 	data.setUint8(5, obj.motorTest[4], 0);
          	 	data.setUint8(6, obj.motorTest[5], 0);
          	 	blen=7;
          break; 
          
          case this.ESC_INFO:
          	
          break;     
    }
	
	var bufferU8 = new Uint8Array(buffer);
    var outputBuffer = new ArrayBuffer(blen + 4);
    var outputU8 = new Uint8Array(outputBuffer);
    
    outputU8[0] = code; // was 0x10
    outputU8[1] = 5;
    outputU8[2] = blen;
    
    for (var i = 0; i < blen; i++) {
        outputU8[i + 3] = bufferU8[i];
        crc += bufferU8[i];
        crcCounter++;
    }
    outputU8[outputU8.length - 1] = Math.floor(crc / crcCounter);

    return outputU8;
};

kissProtocol.readString = function(buffer, offset) {
	 var ret = "";
	 for (var i = offset; i < buffer.byteLength ; i++) {
	 	if (buffer.getUint8(i, 0) != 0) ret += String.fromCharCode(buffer.getUint8(i)); else break;
	 }
	 return ret;
};

kissProtocol.readBytesAsString = function(buffer, offset, len) {
	 var ret = "";
	 for (var i = offset; i < (offset+len) ; i++) {
	 	ret += String.fromCharCode(buffer.getUint8(i));
	 }
	 return ret;
};


kissProtocol.upgradeTo104 = function(tmp) {
	if (tmp.ver < 104) {
		console.log('Data version: ' + tmp.ver);
		var bo = +tmp['BoardRotation'];
		console.log('Board Rotation: ' + bo);
		tmp['CBO'] = [0, 0, 0];
		tmp['AUX'] = [0, 0, 0, 0, 0];
		if (bo==4) tmp['CBO'][2]=45;
		else if (bo==2) tmp['CBO'][2]=90;
		else if (bo==5) tmp['CBO'][2]=135;
		else if (bo==1) tmp['CBO'][2]=180;
		else if (bo==7) tmp['CBO'][2]=-45;
		else if (bo==3) tmp['CBO'][2]=-90;
		else if (bo==6) tmp['CBO'][2]=-135;
		tmp['BoardRotation']=0;
		for (var i=1; i<=4; i++) {
			var c = +tmp['aux'+i+'Funk'];
			console.log('aux'+i+'Funk: ' + c);
			if (c==1)  tmp['AUX'][0]=(i * 16) + 5;
			if (c==12) tmp['AUX'][0]=(i * 16) + 3;
			if (c==13) tmp['AUX'][0]=(i * 16) + 1;
			if (c==2)  tmp['AUX'][1]=(i * 16) + 5;
			if (c==11) tmp['AUX'][2]=(i * 16) + 5;
			if (c==14) tmp['AUX'][3]=(i * 16) + 5;
			if (c==6)  tmp['AUX'][4]=(i * 16) + 5;
		}
	}
}

kissProtocol.upgradeTo104 = function(tmp) {
	if (tmp.ver < 104) {
		console.log('Data version: ' + tmp.ver + ' upgrading to 104');
		var bo = +tmp['BoardRotation'];
		console.log('Board Rotation: ' + bo);
		tmp['CBO'] = [0, 0, 0];
		tmp['AUX'] = [0, 0, 0, 0, 0];
		if (bo==4) tmp['CBO'][2]=45;
		else if (bo==2) tmp['CBO'][2]=90;
		else if (bo==5) tmp['CBO'][2]=135;
		else if (bo==1) tmp['CBO'][2]=180;
		else if (bo==7) tmp['CBO'][2]=-45;
		else if (bo==3) tmp['CBO'][2]=-90;
		else if (bo==6) tmp['CBO'][2]=-135;
		tmp['BoardRotation']=0;
		for (var i=1; i<=4; i++) {
			var c = +tmp['aux'+i+'Funk'];
			console.log('aux'+i+'Funk: ' + c);
			
			if (c==1)  tmp['AUX'][0]=(i * 16) + 5;
			if (c==12) tmp['AUX'][0]=(i * 16) + 3;
			if (c==13) tmp['AUX'][0]=(i * 16) + 1;
			if (c==2)  tmp['AUX'][1]=(i * 16) + 5;
			if (c==11) tmp['AUX'][2]=(i * 16) + 5;
			if (c==14) tmp['AUX'][3]=(i * 16) + 5;
			if (c==3)  tmp['AUX'][4]=(i * 16) + 5;
		}
	}
}

kissProtocol.downgradeFrom104 = function(tmp) {
	if (tmp.ver < 104) {
		console.log('Data version: ' + tmp.ver + ' downgrade from 104');
		tmp['BoardRotation']=0;
		if (tmp.ver<103) {
			if (tmp['CBO'][2]==180) tmp['BoardRotation']=1;
		} else {
			if (tmp['CBO'][2]==180) tmp['BoardRotation']=1;
			else if (tmp['CBO'][2]==45) tmp['BoardRotation']=4;
			else if (tmp['CBO'][2]==90) tmp['BoardRotation']=2;
			else if (tmp['CBO'][2]==135) tmp['BoardRotation']=5;
			else if (tmp['CBO'][2]==-45) tmp['BoardRotation']=7;
			else if (tmp['CBO'][2]==-90) tmp['BoardRotation']=3;
			else if (tmp['CBO'][2]==-135) tmp['BoardRotation']=6;
		}
		if (tmp['AUX'][0] != 0) {
			var k = tmp['AUX'][0] >> 4;
			var m = 1;
			if ((tmp['AUX'][0] & 15) == 3) m = 12;
			if ((tmp['AUX'][0] & 15) == 1) m = 13;
			tmp['aux'+k+'Funk'] = m;
		}
		if (tmp['AUX'][1] != 0) {
			var k = tmp['AUX'][1] >> 4;
			tmp['aux'+k+'Funk'] = 2;
		}
		if (tmp['AUX'][2] != 0) {
			var k = tmp['AUX'][2] >> 4;
			tmp['aux'+k+'Funk'] = 11;
		}
		if (tmp['AUX'][3] != 0) {
			var k = tmp['AUX'][3] >> 4;
			tmp['aux'+k+'Funk'] = 14;
		}
		if (tmp['AUX'][4] != 0) {
			var k = tmp['AUX'][4] >> 4;
			tmp['aux'+k+'Funk'] = 3;
		}
	}
}

kissProtocol.disconnectCleanup = function () {
    this.ready = false;
    this.receiving = false;
    this.data = [];
    this.requests = [];
};