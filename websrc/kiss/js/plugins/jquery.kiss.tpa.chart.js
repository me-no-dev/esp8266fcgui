(function($) {
    var PLUGIN_NAME = 'kiss.tpa.chart',
        pluginData = function(obj) {
            return obj.data(PLUGIN_NAME);
        };

    var privateMethods = {
        build: function(self) {
            var data = pluginData(self);
            var id = self.attr("id");
            var width = self.width();
            var height = self.height();
            var c = $('<canvas>').attr('id', id + "_canvas").attr("width", width).attr("height", height);
            c.appendTo(self);
        },
        calculateTPA: function(input, breakpoints) {
        	var tf = 0;
        	var rf = 0;
        
			if (input > 0.5) tf = (input - 0.5) * 2;
			if (input < 0.3) tf = (0.3 - input);
        	
        	if (breakpoints !== undefined) {
        		if (input < breakpoints[1].throttle/100){
					rf = 1/(breakpoints[1].throttle/100)*input;
					tf = (breakpoints[0].influence/100)*(1-rf)+(breakpoints[1].influence/100)*rf;
        		} else if (input < breakpoints[2].throttle/100){
					rf = 1/((breakpoints[2].throttle-breakpoints[1].throttle)/100)*(input-(breakpoints[1].throttle/100));
					tf = (breakpoints[1].influence/100)*(1-rf)+(breakpoints[2].influence/100)*rf;
        		} else if (input >= breakpoints[2].throttle/100){
					rf = 1/((100-breakpoints[2].throttle)/100)*(input-(breakpoints[2].throttle/100));
					tf = (breakpoints[2].influence/100)*(1-rf)+(breakpoints[3].influence/100)*rf;
				}
        	}
            return  tf;
        }
    };

    var publicMethods = {
        init: function(options) {
            return this.each(function() {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                    	rcInput: 0,
                    	breakpoints : [{ throttle: 0, influence: 30}, { throttle: 30, influence: 0}, { throttle: 50, influence: 0}, {throttle:100, influence: 100}]
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);
                publicMethods.refresh(self);
            });
        },
        destroy: function() {
            return this.each(function() {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        breakpoints: function() {
            return pluginData($(this)).breakpoints;
        },
        updateRcInput: function(newValue) {
            var self = $(this);
            var data = pluginData(self);
            var i = newValue;
            if (i < 0) i = 0;
            if (i > 1) i = 1;
            var oldValue = data.rcInput;
            data.rcInput = i;
            if (oldValue != i) {
                publicMethods.refresh(self);
            }
        },
        setBreakpoints: function(newValue) {
            var self = $(this);
            var data = pluginData(self);
            data.breakpoints = newValue;
            publicMethods.refresh(self);
        },
        getInfluence : function() {
            var data = pluginData($(this));
            return privateMethods.calculateTPA(data.rcInput, data.breakpoints);
        },
        resize: function(params) {
        	   var self = $(this);
               var data = pluginData(self);
               var id = self.attr("id");
               if (params.width !== undefined) {
            	   $(self).prop('width', params.width);
            	   $("#"+ id + "_canvas").prop('width', params.width);
               }
               if (params.height !== undefined) {
            	   $(self).prop('height', params.height);
            	   $("#"+ id + "_canvas").prop('height', params.height);
               }
               publicMethods.refresh(self);
        },
        refresh: function(self) {
            var data = pluginData(self);
            var id = self.attr("id");
            var canvas = document.getElementById(id + "_canvas");
            var context = canvas.getContext('2d');
            context.fillStyle = "rgb(244, 244, 244)";
            var width = canvas.width,
                height = canvas.height,
                hw = width >> 1,
                hh = height >> 1;
                
            var padding = 10;
            var canvasScale = 1.0 / (height-2*padding);
            var th = 2;
                
            context.fillRect(0, 0, width, height);
            
            context.strokeStyle = "rgb(80, 80, 80)";
            
            context.beginPath();
            context.moveTo(padding, height - padding);
            context.lineTo(width - padding, height - padding);
            context.stroke();
            
            for (var i=0; i <= 1; i += 0.1) {
            	 var x = i*(width-2*padding)+padding;
            	 context.beginPath();
                 context.moveTo(x, height-padding-th);
                 context.lineTo(x, height-padding+th);
                 context.stroke();
            }
            
            context.beginPath();
            context.moveTo(padding, padding);
            context.lineTo(padding, height - padding);
            context.stroke();
            
            for (var i=0; i <= 1; i += 0.1) {
            	 var y = height - padding - (i / canvasScale);
            	 context.beginPath();
                 context.moveTo(padding-th, y);
                 context.lineTo(padding+th, y);
                 context.stroke();
           }

           // chart goes here
            context.beginPath();
            context.strokeStyle = "rgb(131, 10, 10)";
            i=0;
            x=0;
            while(x<(width-padding))  {
                var x = i*(width-2*padding)+padding;
                var y = height - padding - (privateMethods.calculateTPA(i, data.breakpoints) / canvasScale);
                if (i > 0) {
                    context.lineTo(x, y);
                } else {
                    context.moveTo(x, y);
                }
                i+=0.01;
            }
            context.stroke();
            
            // throttle marker goes here
            if (data.rcInput !== undefined) {
                var x = padding + data.rcInput * (width - 2*padding);
                var influence = privateMethods.calculateTPA(data.rcInput, data.breakpoints);
                var y = height - padding - (influence / canvasScale);
                context.beginPath();
                context.strokeStyle = "rgb(200, 200, 200)";
                context.moveTo(x, y);
                context.lineTo(x, height-padding);
                context.stroke();
                context.fillStyle = "rgb(131, 10, 10)";
                context.fillRect(x - 2, y - 2, 4, 4);
                var text1 = (influence *100).toFixed(0) + "%";
                var tw = context.measureText(text1).width;
                context.font = "12px sans-serif ";
                context.fillStyle = "rgb(71, 71, 71)";
                var tx = x - tw/2;
                var ty = y - 4;
                if (tx<padding) tx=padding+4;
                if (tx+tw>(width - padding-4)) tx = width-tw-padding-4;
                if (ty<11) ty=11;
                if (ty+11>height) ty=height-11;
                context.fillText(text1, tx, ty);
                
                context.fillText("TPA Influence", padding + 4, padding + 2);
                context.fillText("Throttle", width - padding - context.measureText("Throttle").width, height - padding - 4);
            }
        }
    };

    $.fn.kissTPAChart = function(method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissTPAChart');
        }
    };
})(jQuery);