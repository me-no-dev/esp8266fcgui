(function($) {
    var PLUGIN_NAME = 'kiss.rates.chart',
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
        calculateDegSec: function(input, rate, grate, usecurve) {
            var setpoint = input;
            var RPY_useRates = 1 - Math.abs(input) * grate;
            var rxRAW = input * 1000;
            var curve = rxRAW * rxRAW / 1000000;
            setpoint = ((setpoint * curve) * usecurve + setpoint * (1 - usecurve)) * (rate / 10);
            return Math.round(((2000 * (1 / RPY_useRates)) * setpoint) * 100) / 100;
        }
    };

    var publicMethods = {
        init: function(options) {
            return this.each(function() {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                        rate: 0,
                        grate: 0,
                        usecurve: 0,
                        axisRate: 0,
                        message: 'rolls'
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
        axisRate: function() {
            return pluginData($(this)).axisRate;
        },
        updateRcInput: function(newValue) {
            var self = $(this);
            var data = pluginData(self);
            var i = newValue;
            if (i < -1) i = -1;
            if (i > 1) i = 1;
            var oldValue = data.rcInput;
            data.rcInput = i;
            if (oldValue != i) {
                publicMethods.refresh(self);
            }
        },
        updateRcRates: function(newValue) {
            var self = $(this);
            var data = pluginData(self);
            data.rate = newValue.rate;
            data.grate = newValue.grate;
            data.usecurve = newValue.usecurve;
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
            context.fillRect(0, 0, width, height);
            context.strokeStyle = "rgb(20, 20, 20)";
            context.beginPath();
            context.moveTo(0, hh);
            context.lineTo(width, hh);
            context.stroke();
            context.beginPath();
            context.moveTo(hw, 0);
            context.lineTo(hw, height);
            context.stroke();
            var maxRotation = privateMethods.calculateDegSec(1, data.rate, data.grate, data.usecurve);
            var canvasScale = maxRotation / hh;
            context.beginPath();
            context.strokeStyle = "rgb(131, 10, 10)";
            for (var i = -1; i <= 1; i += 0.1) {
                var x = width / 2 + i * hw;
                var y = (privateMethods.calculateDegSec(-i, data.rate, data.grate, data.usecurve) / canvasScale) + hh;
                if (i > -1) {
                    context.lineTo(x, y);
                } else {
                    context.moveTo(x, y);
                }
            }
            context.stroke();
            if (data.rcInput !== undefined) {
                var x = width / 2 + data.rcInput * hw;
                var rcInputRotation = privateMethods.calculateDegSec(-data.rcInput, data.rate, data.grate, data.usecurve);
                data.axisRate = rcInputRotation / 360;
                var y = rcInputRotation / canvasScale + hh;
                context.beginPath();
                context.strokeStyle = "rgb(200, 200, 200)";
                context.moveTo(x, y);
                context.lineTo(x, hh);
                context.moveTo(x, y);
                context.lineTo(hw, y);
                context.stroke();
                context.fillStyle = "rgb(131, 10, 10)";
                context.fillRect(x - 2, y - 2, 4, 4);

                var text1 = Math.abs(Math.round(rcInputRotation)) + " °/sec";
                context.font = "12px sans-serif ";
                context.fillStyle = "rgb(71, 71, 71)";
                context.fillText(text1, width - context.measureText(text1).width - 2, height - 14);
                var text2 = Math.abs(Math.round(rcInputRotation * 100 / 360)) / 100 + " " + data.message + "/sec";
                context.fillText(text2, width - context.measureText(text2).width - 2, height - 2);
                context.fillText(data.name, 2, 12);
                
                if (Math.abs(maxRotation)>=2000) {
                	context.fillStyle = "rgba(80,0,0,0.8)";
                    context.fillRect(0, 0, width, height);
                	var text3 = "Max rotation > 2000 °/sec!";
                    context.font = "14px sans-serif ";
                    context.fillStyle = "rgb(255, 255, 255)";
                    context.fillText(text3, (width - context.measureText(text3).width) >> 1, hh + 10);
                    
                	var text4 = "W A R N I N G";
                    context.font = "16px sans-serif ";
                    context.fillStyle = "rgb(255, 255, 255)";
                    context.fillText(text4, (width - context.measureText(text4).width) >> 1, hh - 10 );
                }
            }
        }
    };

    $.fn.kissRatesChart = function(method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissRatesChart');
        }
    };
})(jQuery);