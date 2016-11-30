'use strict';
var mspHelper;

$(document).ready(function () {

    GUI.updateManualPortVisibility = function(){
        $('#port-override-option').hide();
        $('select#baud').show();
    };

    GUI.updateManualPortVisibility();

    $('div#port-picker #port').change(function (target) {
        GUI.updateManualPortVisibility();
    });

    $('div.connect_controls a.connect').click(function () {
        if (GUI.connect_lock != true) { // GUI control overrides the user control

            var clicks = $(this).data('clicks');
            var selected_baud = parseInt($('div#port-picker #baud').val());
            var selected_port = String($('div#port-picker #port').val());
            if (selected_port != '0') {
                if (!clicks) {
                    console.log('Connecting to: ' + selected_port);
                    GUI.connecting_to = selected_port;

                    // lock port select & baud while we are connecting / connected
                    $('div#port-picker #port, div#port-picker #baud, div#port-picker #delay').prop('disabled', true);
                    $('div.connect_controls a.connect_state').text(getLocalizedMessage('connecting'));


                    serial.connect(selected_port, {bitrate: selected_baud}, onOpen);
                } else {
                    GUI.timeout_kill_all();
                    GUI.interval_kill_all();
                    GUI.tab_switch_cleanup();
                    GUI.tab_switch_in_progress = false;

                    serial.disconnect(onClosed);

                    var wasConnected = CONFIGURATOR.connectionValid;

                    GUI.connected_to = false;
                    CONFIGURATOR.connectionValid = false;
                    GUI.allowedTabs = GUI.defaultAllowedTabsWhenDisconnected.slice();
                    MSP.disconnect_cleanup();
                    PortUsage.reset();

                    // Reset various UI elements
                    $('span.i2c-error').text(0);
                    $('span.cycle-time').text(0);
                    if (CONFIG.flightControllerVersion !== '' && semver.gte(CONFIG.flightControllerVersion, "3.0.0"))
                        $('span.cpu-load').text('');

                    // unlock port select & baud
                    $('div#port-picker #port').prop('disabled', false);
                    if (!GUI.auto_connect) $('div#port-picker #baud').prop('disabled', false);

                    // reset connect / disconnect button
                    $('div.connect_controls a.connect').removeClass('active');
                    $('div.connect_controls a.connect_state').text(getLocalizedMessage('connect'));
                   
                    // reset active sensor indicators
                    sensor_status(0);

                    if (wasConnected) {
                        // detach listeners and remove element data
                        $('#content').empty();
                    }

                    $('#tabs .tab_landing a').click();
                }

                $(this).data("clicks", !clicks);
            }
        }
    });

    PortHandler.initialize();
    PortUsage.initialize();
});




function onOpen(openInfo) {
    if (openInfo) {
        // update connected_to
        GUI.connected_to = GUI.connecting_to;

        // reset connecting_to
        GUI.connecting_to = false;

        GUI.log(getLocalizedMessage('serialPortOpened', [openInfo.connectionId]));

        serial.onReceive.addListener(read_serial);

        // disconnect after 10 seconds with error if we don't get IDENT data
        GUI.timeout_add('connecting', function () {
            if (!CONFIGURATOR.connectionValid) {
                GUI.log(getLocalizedMessage('noConfigurationReceived'));

                $('div.connect_controls a.connect').click(); // disconnect
            }
        }, 10000);

        FC.resetState();
        MSP.listen(update_packet_error);
        mspHelper = new MspHelper();
        MSP.listen(mspHelper.process_data.bind(mspHelper));
        
        // request configuration data
        MSP.send_message(MSPCodes.MSP_API_VERSION, false, false, function () {
            GUI.log(getLocalizedMessage('apiVersionReceived', [CONFIG.apiVersion]));

            if (semver.gte(CONFIG.apiVersion, CONFIGURATOR.apiVersionAccepted)) {

                MSP.send_message(MSPCodes.MSP_FC_VARIANT, false, false, function () {
                    if (CONFIG.flightControllerIdentifier === 'BTFL') {
                        MSP.send_message(MSPCodes.MSP_FC_VERSION, false, false, function () {

                            GUI.log(getLocalizedMessage('fcInfoReceived', [CONFIG.flightControllerIdentifier, CONFIG.flightControllerVersion]));

                            MSP.send_message(MSPCodes.MSP_BUILD_INFO, false, false, function () {

                                GUI.log(getLocalizedMessage('buildInfoReceived', [CONFIG.buildInfo]));

                                MSP.send_message(MSPCodes.MSP_BOARD_INFO, false, false, function () {

                                    GUI.log(getLocalizedMessage('boardInfoReceived', [CONFIG.boardIdentifier, CONFIG.boardVersion]));

                                    MSP.send_message(MSPCodes.MSP_UID, false, false, function () {
                                        GUI.log(getLocalizedMessage('uniqueDeviceIdReceived', [CONFIG.uid[0].toString(16) + CONFIG.uid[1].toString(16) + CONFIG.uid[2].toString(16)]));

                                        // continue as usually
                                        CONFIGURATOR.connectionValid = true;
                                        GUI.allowedTabs = GUI.defaultAllowedTabsWhenConnected.slice();
                                        if (semver.lt(CONFIG.apiVersion, "1.4.0")) {
                                            GUI.allowedTabs.splice(GUI.allowedTabs.indexOf('led_strip'), 1);
                                        }

                                        onConnect();

                                        $('#tabs ul.mode-connected .tab_setup a').click();
                                    });
                                });
                            });
                        });
                    } else {
                        GUI.show_modal(getLocalizedMessage('warningTitle'),
                            getLocalizedMessage('firmwareTypeNotSupported'));

                        connectCli();
                    }
                });
            } else {
                GUI.show_modal(getLocalizedMessage('warningTitle'),
                    getLocalizedMessage('firmwareVersionNotSupported', [CONFIGURATOR.apiVersionAccepted]));

                connectCli();
            }
        });
    } else {
        console.log('Failed to open serial port');
        GUI.log(getLocalizedMessage('serialPortOpenFail'));

        $('div#connectbutton a.connect_state').text(getLocalizedMessage('connect'));
        $('div#connectbutton a.connect').removeClass('active');

        // unlock port select & baud
        $('div#port-picker #port, div#port-picker #baud, div#port-picker #delay').prop('disabled', false);

        // reset data
        $('div#connectbutton a.connect').data("clicks", false);
    }
}

function connectCli() {
    CONFIGURATOR.connectionValid = true; // making it possible to open the CLI tab
    GUI.allowedTabs = ['cli'];
    onConnect();
    $('#tabs .tab_cli a').click();
}

function onConnect() {
    GUI.timeout_remove('connecting'); // kill connecting timer
    $('div#connectbutton a.connect_state').text(getLocalizedMessage('disconnect')).addClass('active');
    $('div#connectbutton a.connect').addClass('active');
    $('#tabs ul.mode-disconnected').hide();
    $('#tabs ul.mode-connected-cli').show();
    
    if (CONFIG.flightControllerVersion !== '') {
        BF_CONFIG.features = new Features(CONFIG);

        $('#tabs ul.mode-connected').show();

        if (semver.gte(CONFIG.flightControllerVersion, "2.9.1")) {
            MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false);
        } else {
            MSP.send_message(MSPCodes.MSP_STATUS, false, false);

            if (semver.gte(CONFIG.flightControllerVersion, "2.4.0")) {
                CONFIG.numProfiles = 2;
                $('.tab-pid_tuning select[name="profile"] .profile3').hide();
            } else {
                CONFIG.numProfiles = 3;
                $('.tab-pid_tuning select[name="rate_profile"]').hide();
            }
        }
    
        MSP.send_message(MSPCodes.MSP_DATAFLASH_SUMMARY, false, false);

        startLiveDataRefreshTimer();
    }
    
    var sensor_state = $('#sensor-status');
    sensor_state.show(); 
    
    var port_picker = $('#portsinput');
    port_picker.hide(); 

    var dataflash = $('#dataflash_wrapper_global');
    dataflash.show();
}

function onClosed(result) {
    if (result) { // All went as expected
        GUI.log(getLocalizedMessage('serialPortClosedOk'));
    } else { // Something went wrong
        GUI.log(getLocalizedMessage('serialPortClosedFail'));
    }

    $('#tabs ul.mode-connected').hide();
    $('#tabs ul.mode-connected-cli').hide();
    $('#tabs ul.mode-disconnected').show();

    var sensor_state = $('#sensor-status');
    sensor_state.hide();
    
    var port_picker = $('#portsinput');
    port_picker.show(); 
    
    var dataflash = $('#dataflash_wrapper_global');
    dataflash.hide();
    
    var battery = $('#quad-status_wrapper');
    battery.hide();
    
    MSP.clearListeners();
}

function read_serial(info) {
    if (!CONFIGURATOR.cliActive) {
        MSP.read(info);
    } else if (CONFIGURATOR.cliActive) {
        TABS.cli.read(info);
    }
}

function sensor_status(sensors_detected) {
    // initialize variable (if it wasn't)
    if (!sensor_status.previous_sensors_detected) {
        sensor_status.previous_sensors_detected = -1; // Otherwise first iteration will not be run if sensors_detected == 0
    }

    // update UI (if necessary)
    if (sensor_status.previous_sensors_detected == sensors_detected) {
        return;
    }

    // set current value
    sensor_status.previous_sensors_detected = sensors_detected;

    var e_sensor_status = $('div#sensor-status');

    if (have_sensor(sensors_detected, 'acc')) {
        $('.accel', e_sensor_status).addClass('on');
        $('.accicon', e_sensor_status).addClass('active');

    } else {
        $('.accel', e_sensor_status).removeClass('on');
        $('.accicon', e_sensor_status).removeClass('active');
    }

    if (true) { // Gyro status is not reported by FC
        $('.gyro', e_sensor_status).addClass('on');
        $('.gyroicon', e_sensor_status).addClass('active');
    } else {
        $('.gyro', e_sensor_status).removeClass('on');
        $('.gyroicon', e_sensor_status).removeClass('active');
    }

    if (have_sensor(sensors_detected, 'baro')) {
        $('.baro', e_sensor_status).addClass('on');
        $('.baroicon', e_sensor_status).addClass('active');
    } else {
        $('.baro', e_sensor_status).removeClass('on');
        $('.baroicon', e_sensor_status).removeClass('active');
    }

    if (have_sensor(sensors_detected, 'mag')) {
        $('.mag', e_sensor_status).addClass('on');
        $('.magicon', e_sensor_status).addClass('active');
    } else {
        $('.mag', e_sensor_status).removeClass('on');
        $('.magicon', e_sensor_status).removeClass('active');
    }

    if (have_sensor(sensors_detected, 'gps')) {
        $('.gps', e_sensor_status).addClass('on');
	$('.gpsicon', e_sensor_status).addClass('active');
    } else {
        $('.gps', e_sensor_status).removeClass('on');
        $('.gpsicon', e_sensor_status).removeClass('active');
    }

    if (have_sensor(sensors_detected, 'sonar')) {
        $('.sonar', e_sensor_status).addClass('on');
        $('.sonaricon', e_sensor_status).addClass('active');
    } else {
        $('.sonar', e_sensor_status).removeClass('on');
        $('.sonaricon', e_sensor_status).removeClass('active');
    }
}

function have_sensor(sensors_detected, sensor_code) {
    switch(sensor_code) {
        case 'acc':
            return bit_check(sensors_detected, 0);
        case 'baro':
            return bit_check(sensors_detected, 1);
        case 'mag':
            return bit_check(sensors_detected, 2);
        case 'gps':
            return bit_check(sensors_detected, 3);
        case 'sonar':
            return bit_check(sensors_detected, 4);
    }
    return false;
}

function update_dataflash_global() {
    var supportsDataflash = DATAFLASH.totalSize > 0;
    if (supportsDataflash){

         $(".noflash_global").css({
             display: 'none'
         }); 

         $(".dataflash-contents_global").css({
             display: 'block'
         }); 
	     
         $(".dataflash-free_global").css({
             width: (100-(DATAFLASH.totalSize - DATAFLASH.usedSize) / DATAFLASH.totalSize * 100) + "%",
             display: 'block'
         });
         $(".dataflash-free_global div").text('Dataflash: free ' + formatFilesize(DATAFLASH.totalSize - DATAFLASH.usedSize));
    } else {
         $(".noflash_global").css({
             display: 'block'
         }); 

         $(".dataflash-contents_global").css({
             display: 'none'
         }); 
    }      

}

function startLiveDataRefreshTimer() {
    // live data refresh
    GUI.timeout_add('data_refresh', function () { update_live_status(); }, 100);
}
    
function update_live_status() {
    
    var statuswrapper = $('#quad-status_wrapper');

    $(".quad-status-contents").css({
       display: 'inline-block'
    });
    
    if (GUI.active_tab != 'cli') {
        MSP.send_message(MSPCodes.MSP_BOXNAMES, false, false);
        if (semver.gte(CONFIG.flightControllerVersion, "2.9.1"))
        	MSP.send_message(MSPCodes.MSP_STATUS_EX, false, false);
        else
        	MSP.send_message(MSPCodes.MSP_STATUS, false, false);
        MSP.send_message(MSPCodes.MSP_ANALOG, false, false);
    }
    
    var active = ((Date.now() - ANALOG.last_received_timestamp) < 300);

    for (var i = 0; i < AUX_CONFIG.length; i++) {
       if (AUX_CONFIG[i] == 'ARM') {
               if (bit_check(CONFIG.mode, i))
                       $(".armedicon").css({
                               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="28 -43 141.7 141.7" style="enable-background:new 28 -43 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#FFCC00;} </style> <g> <g> <path class="st0" d="M157.1,71.9l-52-97.5c-1.3-2.4-3.8-4-6.6-4c-2.8,0-5.3,1.5-6.6,4L39.6,71.9c-1.2,2.3-1.2,5.1,0.2,7.4 c1.4,2.3,3.8,3.7,6.5,3.7h104.3c2.6,0,5.1-1.4,6.4-3.7C158.3,77,158.4,74.2,157.1,71.9L157.1,71.9z M98.5,67.9 c-4.1,0-7.5-3.3-7.5-7.5c0-4.1,3.4-7.5,7.5-7.5c4.1,0,7.5,3.4,7.5,7.5C106,64.6,102.6,67.9,98.5,67.9L98.5,67.9z M106,38 c0,4.2-3.4,7.5-7.5,7.5c-4.1,0-7.5-3.3-7.5-7.5V8c0-4.1,3.4-7.5,7.5-7.5c4.1,0,7.5,3.4,7.5,7.5V38z M106,38"/> </g> </g> </svg>)'
                           });
               else
                       $(".armedicon").css({
                               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="28 -43 141.7 141.7" style="enable-background:new 28 -43 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#818180;} </style> <g> <g> <path class="st0" d="M157.1,71.9l-52-97.5c-1.3-2.4-3.8-4-6.6-4c-2.8,0-5.3,1.5-6.6,4L39.6,71.9c-1.2,2.3-1.2,5.1,0.2,7.4 c1.4,2.3,3.8,3.7,6.5,3.7h104.3c2.6,0,5.1-1.4,6.4-3.7C158.3,77,158.4,74.2,157.1,71.9L157.1,71.9z M98.5,67.9 c-4.1,0-7.5-3.3-7.5-7.5c0-4.1,3.4-7.5,7.5-7.5c4.1,0,7.5,3.4,7.5,7.5C106,64.6,102.6,67.9,98.5,67.9L98.5,67.9z M106,38 c0,4.2-3.4,7.5-7.5,7.5c-4.1,0-7.5-3.3-7.5-7.5V8c0-4.1,3.4-7.5,7.5-7.5c4.1,0,7.5,3.4,7.5,7.5V38z M106,38"/> </g> </g> </svg>)'
                           });
       }
       if (AUX_CONFIG[i] == 'FAILSAFE') {
               if (bit_check(CONFIG.mode, i))
                       $(".failsafeicon").css({
                               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="28 -43 141.7 141.7" style="enable-background:new 28 -43 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#E60000;} </style> <g> <path class="st0" d="M98.9,87l60.9-61.9c0.8-0.8,1.2-1.9,1.1-3l0,0C156.7-8.4,130.5-32,98.9-32c-31.5,0-57.7,23.5-62,53.8v0.1V22 l0,0c-0.1,1,0.3,2.1,1.1,2.9l42.9,43.8 M107,68.2l14.8-49.6c3.3-4.7,8.7-7.8,14.9-7.8c7.2,0,13.4,4.2,16.4,10.3L107,68.2z M83.7,19 c3.2-4.9,8.8-8.2,15.2-8.2c6.2,0,11.7,3.1,15,7.9L99,68.7L83.7,19z M44.5,20.8c3-6,9.1-10.1,16.2-10.1c6.2,0,11.7,3.1,14.9,7.8 l15.1,49.4L44.5,20.8z"/> </g> </svg>)'
                           });
               else
                       $(".failsafeicon").css({
                               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="28 -43 141.7 141.7" style="enable-background:new 28 -43 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#818181;} </style> <g> <path class="st0" d="M98.9,87l60.9-61.9c0.8-0.8,1.2-1.9,1.1-3l0,0C156.7-8.4,130.5-32,98.9-32c-31.5,0-57.7,23.5-62,53.8v0.1V22 l0,0c-0.1,1,0.3,2.1,1.1,2.9l42.9,43.8 M107,68.2l14.8-49.6c3.3-4.7,8.7-7.8,14.9-7.8c7.2,0,13.4,4.2,16.4,10.3L107,68.2z M83.7,19 c3.2-4.9,8.8-8.2,15.2-8.2c6.2,0,11.7,3.1,15,7.9L99,68.7L83.7,19z M44.5,20.8c3-6,9.1-10.1,16.2-10.1c6.2,0,11.7,3.1,14.9,7.8  l15.1,49.4L44.5,20.8z"/> </g> </svg>)'
                           });
       }
    }
    if (ANALOG != undefined) {
    var nbCells = Math.floor(ANALOG.voltage / MISC.vbatmaxcellvoltage) + 1;   
    if (ANALOG.voltage == 0)
           nbCells = 1;
   
       var min = MISC.vbatmincellvoltage * nbCells;
       var max = MISC.vbatmaxcellvoltage * nbCells;
       var warn = MISC.vbatwarningcellvoltage * nbCells;
       
       $(".battery-status").css({
          width: ((ANALOG.voltage - min) / (max - min) * 100) + "%",
          display: 'inline-block'
       });
   
       if (active) {
           $(".linkicon").css({
               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="-70 0 141.7 141.7" style="enable-background:new -70 0 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#FFBB00;} </style> <g> <g> <path class="st0" d="M49.1,65.3l-21,21c-11.6,11.6-30.4,11.6-42,0c-1.8-1.8-3.3-3.9-4.5-6l9.8-9.8c0.5-0.5,1-0.7,1.6-1.1 c0.7,2.3,1.9,4.5,3.7,6.3c5.8,5.8,15.2,5.8,21,0l21-21c5.8-5.8,5.8-15.2,0-21s-15.2-5.8-21,0l-7.5,7.5c-6.1-2.4-12.6-3-18.9-2.1 L7.2,23.2c11.6-11.6,30.4-11.6,42,0C60.7,35,60.7,53.8,49.1,65.3L49.1,65.3z M-6.4,99.8l-7.5,7.5c-5.8,5.8-15.2,5.8-21,0 s-5.8-15.2,0-21l21-21c5.8-5.8,15.2-5.8,21,0c1.8,1.8,3,4,3.7,6.3c0.6-0.3,1.1-0.6,1.6-1l9.8-9.7c-1.2-2.1-2.7-4.2-4.5-6 c-11.6-11.6-30.4-11.6-42,0l-21,21c-11.6,11.6-11.6,30.4,0,42c11.6,11.6,30.4,11.6,42,0L12.6,102C6.2,102.8-0.3,102.2-6.4,99.8 L-6.4,99.8z"/> </g> </g> </svg>)'
           });
       } else {
           $(".linkicon").css({
               'background-image': 'url(data:image/svg+xml;utf8,<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="28 -43 141.7 141.7" style="enable-background:new 28 -43 141.7 141.7;" xml:space="preserve"> <style type="text/css"> .st0{fill:#818180;} </style> <g> <g> <path class="st0" d="M146.1,18.3l-21,21c-11.6,11.6-30.4,11.6-42,0c-1.8-1.8-3.3-3.9-4.5-6l9.8-9.8c0.5-0.5,1-0.7,1.6-1.1 c0.7,2.3,1.9,4.5,3.7,6.3c5.8,5.8,15.2,5.8,21,0l21-21c5.8-5.8,5.8-15.2,0-21s-15.2-5.8-21,0l-7.5,7.5c-6.1-2.4-12.6-3-18.9-2.1 l15.9-15.9c11.6-11.6,30.4-11.6,42,0C157.7-12,157.7,6.8,146.1,18.3L146.1,18.3z M90.6,52.8l-7.5,7.5c-5.8,5.8-15.2,5.8-21,0 s-5.8-15.2,0-21l21-21c5.8-5.8,15.2-5.8,21,0c1.8,1.8,3,4,3.7,6.3c0.6-0.3,1.1-0.6,1.6-1l9.8-9.7c-1.2-2.1-2.7-4.2-4.5-6 c-11.6-11.6-30.4-11.6-42,0l-21,21c-11.6,11.6-11.6,30.4,0,42s30.4,11.6,42,0L109.6,55C103.2,55.8,96.7,55.2,90.6,52.8L90.6,52.8z "/> </g> </g> </svg>)'
           });
       } 
       
       if (ANALOG.voltage < warn) {
           $(".battery-status").css('background-color', '#D42133');
       } else  {
           $(".battery-status").css('background-color', '#59AA29');
       }
       
       $(".battery-legend").text(ANALOG.voltage + " V");
    }

    statuswrapper.show();
    GUI.timeout_remove('data_refresh');
    startLiveDataRefreshTimer();
}

function specificByte(num, pos) {
    return 0x000000FF & (num >> (8 * pos));
}

function bit_check(num, bit) {
    return ((num >> bit) % 2 != 0);
}

function bit_set(num, bit) {
    return num | 1 << bit;
}

function bit_clear(num, bit) {
    return num & ~(1 << bit);
}

function update_dataflash_global() {
    function formatFilesize(bytes) {
        if (bytes < 1024) {
            return bytes + "B";
        }
        var kilobytes = bytes / 1024;
        
        if (kilobytes < 1024) {
            return Math.round(kilobytes) + "kB";
        }
        
        var megabytes = kilobytes / 1024;
        
        return megabytes.toFixed(1) + "MB";
    }
  
    var supportsDataflash = DATAFLASH.totalSize > 0;

    if (supportsDataflash){
        $(".noflash_global").css({
           display: 'none'
        }); 

        $(".dataflash-contents_global").css({
           display: 'block'
        }); 
	     
        $(".dataflash-free_global").css({
           width: (100-(DATAFLASH.totalSize - DATAFLASH.usedSize) / DATAFLASH.totalSize * 100) + "%",
           display: 'block'
        });
        $(".dataflash-free_global div").text('Dataflash: free ' + formatFilesize(DATAFLASH.totalSize - DATAFLASH.usedSize));
     } else {
        $(".noflash_global").css({
           display: 'block'
        }); 

        $(".dataflash-contents_global").css({
           display: 'none'
        }); 
     }      
}
