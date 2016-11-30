'use strict';

$(document).ready(function () {
    CONTENT.welcome.initialize();

    $('#navigation li').click(function () {
        var self = this;
        var content = $(self).attr('data-name');
        
    	$("#navigation").removeClass("active-menu");

        function content_ready() {
            GUI.contentSwitchInProgress = false;
        }

        if ($(self).hasClass('unlocked') && GUI.activeContent != content) {
            GUI.contentSwitchInProgress = true;
            GUI.contentSwitchCleanup(function () {
                CONTENT[content].initialize();
            });
        }
    });
    
    $(".navigation-menu-button").on("click", function() {
    	$("#navigation").toggleClass("active-menu");
    });
});

Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this, min), max);
};