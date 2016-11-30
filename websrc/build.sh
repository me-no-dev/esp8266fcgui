#!/bin/bash

KISS_STYLES="kiss/js/libraries/jquery.minicolors.css kiss/content/welcome.css kiss/content/configuration.css kiss/content/data_output.css kiss/content/rates.css kiss/content/tpa.css kiss/js/plugins/jquery.kiss.aux.css kiss/main.css"
KISS_SCRIPTS="kiss/js/libraries/jquery-2.1.3.min.js kiss/js/libraries/three.min.js kiss/js/input_validation.js kiss/js/gui.js kiss/js/websocket_serial.js kiss/js/serial.js kiss/js/connection_handler.js kiss/js/protocol.js kiss/js/libraries/hex_parser.js kiss/main.js kiss/content/welcome.js kiss/content/configuration.js kiss/content/advanced.js kiss/content/data_output.js kiss/js/plugins/jquery.kiss.rates.chart.js kiss/js/plugins/jquery.kiss.model.js kiss/js/plugins/jquery.kiss.tpa.chart.js kiss/js/plugins/jquery.kiss.aux.js kiss/content/rates.js kiss/content/tpa.js kiss/js/libraries/jquery.minicolors.min.js"

BF_STYLES="bf/main.css bf/js/libraries/jquery.nouislider.min.css bf/js/libraries/jquery.nouislider.pips.min.css bf/js/libraries/flightindicators.css bf/tabs/landing.css bf/tabs/setup.css bf/tabs/help.css bf/tabs/ports.css bf/tabs/configuration.css bf/tabs/pid_tuning.css bf/tabs/receiver.css bf/tabs/servos.css bf/tabs/gps.css bf/tabs/motors.css bf/tabs/led_strip.css bf/tabs/sensors.css bf/tabs/cli.css bf/tabs/onboard_logging.css bf/tabs/adjustments.css bf/tabs/auxiliary.css bf/tabs/failsafe.css bf/tabs/osd.css bf/tabs/transponder.css bf/css/fonts.css bf/css/dropdown-lists/css/style_lists.css bf/js/libraries/switchery/switchery.css bf/js/libraries/jbox/jBox.css"
BF_SCRIPTS="bf/js/locale.js bf/js/libraries/q.js bf/js/libraries/jquery-2.1.4.min.js bf/js/libraries/jquery-ui-1.11.4.min.js bf/js/libraries/d3.min.js bf/js/libraries/jquery.nouislider.all.min.js bf/js/libraries/three/three.min.js bf/js/libraries/three/Projector.js bf/js/libraries/three/CanvasRenderer.js bf/js/libraries/jquery.flightindicators.js bf/js/libraries/semver.js bf/js/libraries/jbox/jBox.min.js bf/js/libraries/switchery/switchery.js bf/js/libraries/bluebird.min.js bf/js/libraries/jquery.ba-throttle-debounce.min.js bf/js/libraries/inflection.min.js bf/js/injected_methods.js bf/js/port_handler.js bf/js/port_usage.js bf/js/serial.js bf/js/gui.js bf/js/model.js bf/js/serial_backend.js bf/js/data_storage.js bf/js/fc.js bf/js/msp/MSPCodes.js bf/js/msp.js bf/js/msp/MSPHelper.js bf/js/protocols/stm32.js bf/js/localization.js bf/js/boards.js bf/js/RateCurve.js bf/js/Features.js bf/main.js bf/tabs/landing.js bf/tabs/setup.js bf/tabs/help.js bf/tabs/ports.js bf/tabs/configuration.js bf/tabs/pid_tuning.js bf/tabs/receiver.js bf/tabs/auxiliary.js bf/tabs/adjustments.js bf/tabs/servos.js bf/tabs/gps.js bf/tabs/motors.js bf/tabs/led_strip.js bf/tabs/sensors.js bf/tabs/cli.js bf/tabs/onboard_logging.js bf/tabs/failsafe.js bf/tabs/osd.js bf/tabs/transponder.js"

OUT_DIR="../data"

rm -rf "$OUT_DIR"
mkdir "$OUT_DIR"
mkdir "$OUT_DIR/images"

### Start KISS
cat "kiss/tmpl/1.html" > "$OUT_DIR/kiss.html"
for style in `echo "$KISS_STYLES"`; do
	cat "$style" >> "$OUT_DIR/kiss.html"
done
cat "kiss/tmpl/2.html" >> "$OUT_DIR/kiss.html"
for script in `echo "$KISS_SCRIPTS"`; do
	cat "$script" >> "$OUT_DIR/kiss.html"
done
cat "kiss/tmpl/3.html" >> "$OUT_DIR/kiss.html"

cp -r kiss/images/* "$OUT_DIR/images/"

mkdir -p "$OUT_DIR/content"
cp kiss/content/*.html "$OUT_DIR/content/"

cp "kiss/PRESET_PID.txt" "$OUT_DIR/PRESET_PID.txt"
### End KISS

### Start BetaFlight
cat "bf/tmpl/1.html" > "$OUT_DIR/betaflight.html"
for style in `echo "$BF_STYLES"`; do
	cat "$style" >> "$OUT_DIR/betaflight.html"
done
cat "bf/tmpl/2.html" >> "$OUT_DIR/betaflight.html"
for script in `echo "$BF_SCRIPTS"`; do
	cat "$script" >> "$OUT_DIR/betaflight.html"
done
cat "bf/tmpl/3.html" >> "$OUT_DIR/betaflight.html"

cp -r bf/images/* "$OUT_DIR/images/"

mkdir -p "$OUT_DIR/tabs"
cp bf/tabs/*.html "$OUT_DIR/tabs/"

mkdir -p "$OUT_DIR/models"
cp bf/models/*.json "$OUT_DIR/models/"

mkdir -p "$OUT_DIR/osd"
cp bf/osd/*.mcm "$OUT_DIR/osd/"

cp "bf/changelog.html" "$OUT_DIR/changelog.html"
### End BetaFlight

cp "index.html" "$OUT_DIR/index.html"

find out -name '*.DS*' -exec rm {} \;

for file in `find $OUT_DIR | grep -v gif`; do
	if [ -f "$file" ]; then
		gzip "$file"
	fi
done
