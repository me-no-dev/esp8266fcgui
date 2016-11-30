(function($) {
	var PLUGIN_NAME = 'kiss.aux',
        pluginData = function(obj) {
            return obj.data(PLUGIN_NAME);
        };

    var privateMethods = {
    		build : function(self) {
    			var data = pluginData(self);
    			var c = "";
    			c+='<dt class="kiss-aux-function">' + data.name + '</dt>';
                c+='<dd class="kiss-aux-function"><select class="kiss-aux-channel">';
                c+='<option value="0">--</option>';
                c+='<option value="1">AUX1</option>';
                c+='<option value="2">AUX2</option>';
                c+='<option value="3">AUX3</option>';
                c+='<option value="4">AUX4</option>';
                c+='</select><select class="kiss-aux-mode">';
                c+='<option value="0">--</option>';
                c+='<option value="1">Low</option>';
                c+='<option value="2">Low + Medium</option>';
                c+='<option value="3">Medium</option>';
                c+='<option value="4">Medium + High</option>';
                c+='<option value="5">High</option>';
                if (data.knob) c+='<option value="6">Knob</option>';
                c+='</select></dd>'; 
    			self.append(c);
    			$("select", self).on("change", function() {
    				data.value = (parseInt($(".kiss-aux-channel", self).val()) << 4) + parseInt($(".kiss-aux-mode", self).val());
    				privateMethods.changeModeState(self);
    			});
    			if (data.change !== undefined) $("select", self).on("change", data.change);
    			privateMethods.changeValue(self);
    		},
    		changeValue : function(self) {
    			var data = pluginData(self);
    			if (data.value !== undefined) {
    				$(".kiss-aux-channel", self).val(data.value >> 4);
    				$(".kiss-aux-mode", self).val(data.value & 0xf);
    				privateMethods.changeModeState(self);
    			} 
    		},
    		changeModeState : function(self) {
    			var data = pluginData(self);
				if (data.value >> 4 == 0) $(".kiss-aux-mode", self).hide();
				else $(".kiss-aux-mode", self).show();
    		}
    };

    var publicMethods = {
        init : function(options) {
            return this.each(function() {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                    	name: '',
                    	knob: false,
                    	value: 0
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);
               
            });
        },
        destroy : function() {
            return this.each(function() {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        value : function() {
        	var self = $(this),
            data = pluginData(self);
        	if ((data.value >> 4 == 0) || ((data.value & 15) == 0)) return 0;
        	else return data.value;
        },
        setValue : function(newValue) {
        	var self = $(this);
            var data = pluginData(self);
            data.value = newValue;
            privateMethods.changeValue(self);
        },
    };

    $.fn.kissAux = function(method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' +  method + '] not available in $.kissAux');
        }
    };
})(jQuery);