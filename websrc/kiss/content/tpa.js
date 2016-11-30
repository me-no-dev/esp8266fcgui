'use strict';

CONTENT.tpa = {

};

CONTENT.tpa.initialize = function(callback) {
    var self = this;

    self.startedUIupdate = 0;
    self.updateTimeout;
    self.settingsFilled = 0;
    self.hasInput = false;

    if (GUI.activeContent != 'tpa') {
        GUI.activeContent = 'tpa';
    }

    function contentChange(mode) {
        if (self.settingsFilled && mode) {
            $('#save').addClass("important saveAct");
        }
        var rowNames = ['roll', 'pitch', 'yaw'];
        var precision = [2, 3, 2];
        var breakpoints = [
              { throttle:   0, influence: 30},
              { throttle:  30, influence: 0},
              { throttle:  50, influence: 0},
              { throttle: 100, influence: 100 }];	
        if ($('input[name="UCTI"]').prop('checked')) {
        	breakpoints = [
        	  { throttle: 0, 									  influence: parseInt($('input[name="BPI1"]').val())},
              { throttle: parseInt($('input[name="BP1"]').val()), influence: parseInt($('input[name="BPI2"]').val())},
              { throttle: parseInt($('input[name="BP2"]').val()), influence: parseInt($('input[name="BPI3"]').val())},
              { throttle: 100, 									  influence: parseInt($('input[name="BPI4"]').val())}];
        }
        
        var vPIDc = 1;
        if ($('input[name="UVPID"]').prop('checked')) {
			var useVoltage = parseFloat($("#simulatedVoltage").val());
			var IV = [parseFloat($('input[name="LV1"]').val()), parseFloat($('input[name="LV2"]').val()), parseFloat($('input[name="LV3"]').val())];
			var IVP = [parseInt($('input[name="LVP1"]').val()), parseInt($('input[name="LVP2"]').val()), parseInt($('input[name="LVP3"]').val())];
			var useRangeFactor = 0;
			if (useVoltage < IV[0]) vPIDc = IVP[0]/100;
			else if(useVoltage < IV[1]){
				useRangeFactor = 1/(IV[1]-IV[0])*(useVoltage-IV[0]);
				vPIDc = (IVP[0]/100)*(1-useRangeFactor)+(IVP[1]/100)*useRangeFactor;
			} else if(useVoltage < IV[2]){
				useRangeFactor = 1/(IV[2]-IV[1])*(useVoltage-IV[1]);
				vPIDc = (IVP[1]/100)*(1-useRangeFactor)+(IVP[2]/100)*useRangeFactor;
			} else vPIDc = IVP[2]/100;
		}
      
        var tmp = vPIDc*100;
        $("#simulatedBatteryInfluence").text(tmp.toFixed(0)+'%');
        
        $("#tpa_chart").kissTPAChart('setBreakpoints', breakpoints);
        var influence = $("#tpa_chart").kissTPAChart('getInfluence');
    	var tpa = [ parseFloat($('tr.TPA input').eq(0).val()), parseFloat($('tr.TPA input').eq(1).val()), parseFloat($('tr.TPA input').eq(2).val()) ];
        for (var x = 0; x < 3; x++) {
        	for (var a = 0; a<3; a++) {
        		var pid = parseFloat($('tr.' + rowNames[x] + ' input').eq(a).val());
        		pid = pid*(1-tpa[a]*influence)*vPIDc;
        		$('tr.' + rowNames[x] + ' td').eq(4+a).children().first().text(pid.toFixed(precision[a]));
        	}
        }
    }

    // get config
    kissProtocol.send(kissProtocol.GET_SETTINGS, [0x30], function() {
    	self.settingsFilled = 1;
        $('#content').load("./content/tpa.html", htmlLoaded);
    });

    function htmlLoaded() {
        // generate receiver bars
        var receiverNames = ['Throttle']
        var receiverChannels = [0];
        var receiverContainer = $('.tpa .receiver .bars');
        var receiverFillArray = [];
        var receiverLabelArray = [];
        self.ESCTelemetry = 0;
        self.startedUIupdate = 0;
        window.clearTimeout(self.updateTimeout);

        validateBounds('.tpa input[type="text"]');

        for (var i = 0; i < receiverNames.length; i++) {
            var name = receiverNames[i];

            receiverContainer.append('\
                <ul>\
                    <li class="name">' + name + '</li>\
                    <li class="meter">\
                        <div class="meter-bar">\
                            <div class="label"></div>\
                            <div class="fill">\
                                <div class="label"></div>\
                            </div>\
                        </div>\
                    </li>\
                </ul>\
            ');
        }

        $('.meter .fill', receiverContainer).each(function() {
            receiverFillArray.push($(this));
        });

        $('.meter', receiverContainer).each(function() {
            receiverLabelArray.push($('.label', this));
        });

        self.barResize = function() {
            var containerWidth = $('.meter:first', receiverContainer).width(),
                labelWidth = $('.meter .label:first', receiverContainer).width(),
                margin = (containerWidth / 2) - (labelWidth / 2);

            for (var i = 0; i < receiverLabelArray.length; i++) {
                receiverLabelArray[i].css('margin-left', margin);
            }
        };

        $(window).on('resize', self.barResize).resize();

        var legendItems = $('dl.legend dd');
        var otherItems = $('dl.otherValues dd')
        var meterScale = {
            'min': 800,
            'max': 2200
        };

        kissProtocol.send(kissProtocol.GET_TELEMETRY, [0x20], function() {
            console.log("Loaded telemetry");
        });

        var data = kissProtocol.data[kissProtocol.GET_SETTINGS];

        function grabData() {
        	 // pid and rates
            // roll
            data['G_P'][0] = parseFloat($('tr.roll input').eq(0).val());
            data['G_I'][0] = parseFloat($('tr.roll input').eq(1).val());
            data['G_D'][0] = parseFloat($('tr.roll input').eq(2).val());
           
            // pitch
            data['G_P'][1] = parseFloat($('tr.pitch input').eq(0).val());
            data['G_I'][1] = parseFloat($('tr.pitch input').eq(1).val());
            data['G_D'][1] = parseFloat($('tr.pitch input').eq(2).val());

            // yaw
            data['G_P'][2] = parseFloat($('tr.yaw input').eq(0).val());
            data['G_I'][2] = parseFloat($('tr.yaw input').eq(1).val());
            data['G_D'][2] = parseFloat($('tr.yaw input').eq(2).val());

            // TPA
            data['TPA'][0] = parseFloat($('tr.TPA input').eq(0).val());
            data['TPA'][1] = parseFloat($('tr.TPA input').eq(1).val());
            data['TPA'][2] = parseFloat($('tr.TPA input').eq(2).val());

            data['CustomTPAInfluence'] = parseInt($('input[name="UCTI"]').prop('checked') ? 1 : 0);
            data['TPABP1'] = parseInt($('input[name="BP1"]').val());
            data['TPABP2'] = parseInt($('input[name="BP2"]').val());
            data['TPABPI1'] = parseInt($('input[name="BPI1"]').val());
            data['TPABPI2'] = parseInt($('input[name="BPI2"]').val());
            data['TPABPI3'] = parseInt($('input[name="BPI3"]').val());
            data['TPABPI4'] = parseInt($('input[name="BPI4"]').val());

            data['BatteryInfluence'] = parseInt($('input[name="UVPID"]').prop('checked') ? 1 : 0);
            data['voltage1'] = parseFloat($('input[name="LV1"]').val());
            data['voltage2'] = parseFloat($('input[name="LV2"]').val());
            data['voltage3'] = parseFloat($('input[name="LV3"]').val());
            data['voltgePercent1'] = parseInt($('input[name="LVP1"]').val());
            data['voltgePercent2'] = parseInt($('input[name="LVP2"]').val());
            data['voltgePercent3'] = parseInt($('input[name="LVP3"]').val());
        }

        function updateUI() {
            var telem = kissProtocol.data[kissProtocol.GET_TELEMETRY];
            
          
            if (!telem) {
                if (GUI.activeContent == 'tpa') self.updateTimeout = window.setTimeout(function() {
                    updateUI();
                }, 5);
                return;
            }
            // update bars with latest data
            var receiverLabelArrayLength = receiverLabelArray.length;
            for (var i = 0; i < receiverLabelArrayLength; i++) {
                var channel = receiverChannels[i];
                receiverFillArray[i].css('width', ((telem['RXcommands'][channel] - meterScale.min) / (meterScale.max - meterScale.min) * 100).clamp(0, 100) + '%');
                receiverLabelArray[i].text(telem['RXcommands'][channel]);
                // redraw charts if needed
                $("#tpa_chart").kissTPAChart('updateRcInput', (telem['RXcommands'][0] - 1000) / 1000);
                contentChange(false);
            }
            var sampleBlock = [];

            var midscale = 1.5;

            if (GUI.activeContent == 'tpa') self.updateTimeout = window.setTimeout(function() {
                fastDataPoll();
            }, 10);
        }

        // setup graph
        $(window).on('resize', self.resizeCanvas).resize();

        function fastDataPoll() {
            kissProtocol.send(kissProtocol.GET_TELEMETRY, [0x20], function() {
                if (GUI.activeContent == 'tpa') {
                    if (self.startedUIupdate == 0) {
                        updateUI();
                    }
                }
            });
        }

        // pids
        // roll
        $('tr.roll input').eq(0).val(data['G_P'][0]);
        $('tr.roll input').eq(1).val(data['G_I'][0]);
        $('tr.roll input').eq(2).val(data['G_D'][0]);
        
        for (var i = 0; i < 3; i++) {
            $('tr.roll input').eq(i).on('input', function() {
                contentChange(true);
            });
        }

        // pitch
        $('tr.pitch input').eq(0).val(data['G_P'][1]);
        $('tr.pitch input').eq(1).val(data['G_I'][1]);
        $('tr.pitch input').eq(2).val(data['G_D'][1]);
        for (var i = 0; i < 3; i++) {
            $('tr.pitch input').eq(i).on('input', function() {
                contentChange(true);
            });
        }

        // yaw
        $('tr.yaw input').eq(0).val(data['G_P'][2]);
        $('tr.yaw input').eq(1).val(data['G_I'][2]);
        $('tr.yaw input').eq(2).val(data['G_D'][2]);
        for (var i = 0; i < 3; i++) {
            $('tr.yaw input').eq(i).on('input', function() {
                contentChange(true);
            });
        }
        
        $('tr.TPA input').eq(0).val(data['TPA'][0]);
        $('tr.TPA input').eq(1).val(data['TPA'][1]);
        $('tr.TPA input').eq(2).val(data['TPA'][2]);
        for (var i = 0; i < 3; i++) {
            $('tr.TPA input').eq(i).on('input', function() {
                contentChange(true);
            });
        }
        
        $('input[name="UCTI"]').on('change', function() {
        	contentChange(true);
            if (parseInt($('input[name="UCTI"]').prop('checked') ? 1 : 0) == 1) {
                $('input[name^="BP"]').removeAttr("disabled");
            } else {
                $('input[name^="BP"]').attr('disabled', 'true');
            }
        });

        $('input[name="UCTI"]').prop('checked', data['CustomTPAInfluence']);
        if (data['CustomTPAInfluence']) {
            $('input[name^="BP"]').removeAttr("disabled");
        }
        $('input[name="BP1"]').val(data['TPABP1']);
        $('input[name="BP2"]').val(data['TPABP2']);
        $('input[name="BPI1"]').val(data['TPABPI1']);
        $('input[name="BPI2"]').val(data['TPABPI2']);
        $('input[name="BPI3"]').val(data['TPABPI3']);
        $('input[name="BPI4"]').val(data['TPABPI4']);

        $('input[name="UVPID"]').on('change', function() {
        	contentChange(true);
            if (parseInt($('input[name="UVPID"]').prop('checked') ? 1 : 0) == 1) {
                $('input[name^="LV"]').removeAttr("disabled");
            } else {
                $('input[name^="LV"]').attr('disabled', 'true');
            }
        });

        $('input[name="UVPID"]').prop('checked', data['BatteryInfluence']);
        if (data['BatteryInfluence']) {
            $('input[name^="LV"]').removeAttr("disabled");
        }
        $('input[name="LV1"]').val(data['voltage1']);
        $('input[name="LV2"]').val(data['voltage2']);
        $('input[name="LV3"]').val(data['voltage3']);
        $('input[name="LVP1"]').val(data['voltgePercent1']);
        $('input[name="LVP2"]').val(data['voltgePercent2']);
        $('input[name="LVP3"]').val(data['voltgePercent3']);

        if (data['BatteryInfluence'] || data['CustomTPAInfluence']) {
            document.body.style.overflow = "scroll";
        }
        
        $('input[name^="BP"]').on("input", function() {
        	 contentChange(true);
        });
        
        $('input[name^="LV"]').on("input", function() {
       	 	contentChange(true);
        });
        
        $('#simulatedVoltage').on('change', function() {
            contentChange(false);
        });
        
        $('#tpa_chart').kissTPAChart();
        
        $(window).on('resize', self.resizeChart).resize();
     
        fastDataPoll();

        $('#save').click(function() {
            grabData();
            $('#save').removeClass("saveAct");
            kissProtocol.send(kissProtocol.SET_SETTINGS, kissProtocol.preparePacket(kissProtocol.SET_SETTINGS, kissProtocol.data[kissProtocol.GET_SETTINGS]));
        });
    }
};


CONTENT.tpa.resizeChart = function() {
	var wrapper = $('#charts');
	console.log("resize chart");
    $('#tpa_chart').kissTPAChart('resize', {width: wrapper.width() });
}

CONTENT.tpa.cleanup = function(callback) {
    $(window).off('resize', this.barResize);
    $(window).off('resize', this.resizeChart);
    if (callback) callback();
};