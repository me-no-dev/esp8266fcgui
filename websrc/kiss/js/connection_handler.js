'use strict';

$(document).ready(function () {
    $('#portArea a.connect').click(function () {
        if (GUI.connectLock != true) {
            var clicks = $(this).data('clicks');
            var selectedPort = "KISS ESP8266";

            if (selectedPort != '0') {
                if (!clicks) {
                    console.log('Connecting to: ' + selectedPort);
                    GUI.connectingTo = selectedPort;
                    $('a.connect').text('Connecting');
                    serial = getSerialDriverForPort(selectedPort);
                    serial.connect(selectedPort, {bitrate: 115200}, connected);
                } else {
                    GUI.timeoutKillAll();
                    GUI.intervalKillAll();
                    GUI.contentSwitchCleanup();
                    GUI.contentSwitchInProgress = false;

                    serial.disconnect(disconnected);
                    kissProtocol.disconnectCleanup();

                    GUI.connectedTo = false;

                    // reset connect / disconnect button
                    $(this).text('Connect');
                    $(this).removeClass('active');

                    $('#navigation li:not([data-name="welcome"])').removeClass('unlocked');


                    if (GUI.activeContent != 'firmware') {
                        $('#content').empty();
                        // load welcome content
                        CONTENT.welcome.initialize();
                    }
                }

                $(this).data("clicks", !clicks);
            }
        }
    });

    function connected(openInfo) {
        if (openInfo) {
            // update connectedTo
            GUI.connectedTo = GUI.connectingTo;

            // reset connectingTo
            GUI.connectingTo = false;

            $('a.connect').text('Disconnect').addClass('active');

            // start reading
            serial.onReceive.addListener(function (info) {
                kissProtocol.read(info);
            });

            CONTENT.configuration.initialize();

            // unlock navigation
            $('#navigation li').addClass('unlocked');
        } else {
            console.log('Failed to open serial port');

            $('a.connect').text('Connect');
            $('a.connect').removeClass('active');

            // reset data
            $('a.connect').data("clicks", false);
        }
    }

    function disconnected(result) {
        if (result) { // All went as expected
        } else { // Something went wrong
        }
    }
});