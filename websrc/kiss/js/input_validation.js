'use strict';

function validateBounds(selector) {
    var inputs = $(selector).not('.validation').not('.no_validation');

    // add spinners
    var spinners = [];

    inputs.each(function () {
        var input = $(this);

        input.addClass('validation').css({'width': input.width() - 20, 'padding-right': parseInt(input.css('padding-right')) + 20});

        var wrapper = $('<div class="validationWrapper"></div>').css({'position': 'relative', 'float': 'left'});
        input.wrap(wrapper);

        var spinner = $('<div class="inputSpinners"><div></div><div></div></div>').css({'left': (input.outerWidth() - parseInt(input.css('border-left-width'))) - 15});
        input.parent().append(spinner);
        spinners.push(spinner);
    });

    var interval;

    function stepUp(trigger) {
        var element = $(trigger),
            disabled = element.is(':disabled'),
            val = parseFloat(element.val()),
            max = parseFloat(element.attr('data-max')),
            step = parseFloat(element.attr('data-step')),
            precision = parseInt(element.attr('data-precision'));

        if (isNaN(val) || disabled) return;
        if (isNaN(precision)) precision = 0;

        var newVal = val + ((!isNaN(step)) ? step : 1);

        if (!isNaN(max)) {
            if (max >= newVal) {
            } else {
                newVal = max;
            }
        }

        element.val(newVal.toFixed(precision)).trigger('input');
    }

    function stepDown(trigger) {
        var element = $(trigger),
            disabled = element.is(':disabled'),
            val = parseFloat(element.val()),
            min = parseFloat(element.attr('data-min')),
            step = parseFloat(element.attr('data-step')),
            precision = parseInt(element.attr('data-precision'));

        if (isNaN(val) || disabled) return;
        if (isNaN(precision)) precision = 0;

        var newVal = val - ((!isNaN(step)) ? step : 1);

        if (!isNaN(min)) {
            if (min <= newVal) {
            } else {
                newVal = min;
            }
        }

        element.val(newVal.toFixed(precision)).trigger('input');
    }

    function spinUp(event) {
        var trigger = $(this).parent().prev();

        if (event.which == 1) { // left click
            interval = setInterval(function () {
                stepUp(trigger);
            }, 200);

            // single click fires here
            stepUp(trigger);
        }
    }

    function spinDown(event) {
        var trigger = $(this).parent().prev();

        if (event.which == 1) { // left click
            interval = setInterval(function () {
                stepDown(trigger);
            }, 200);

            // single click fires here
            stepDown(trigger);
        }
    }

    function spinStop() {
        clearInterval(interval);
    }

    spinners.forEach(function (spinner) {
        $('div:eq(0)', spinner).on('mousedown', spinUp);
        $('div:eq(0)', spinner).on('mouseup', spinStop);
        $('div:eq(1)', spinner).on('mousedown', spinDown);
        $('div:eq(1)', spinner).on('mouseup', spinStop);
    });

    // regular events
    inputs.on('keydown', function (e) {
        // whitelist all that we need for numeric control
        var whitelist = [
            96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, // numpad and standard number keypad
            109, 189, // minus on numpad and in standard keyboard
            8, 46, 9, // backspace, delete, tab
            190, 110, // decimal point
            37, 38, 39, 40, 13 // arrows and enter
        ];

        if (whitelist.indexOf(e.keyCode) == -1) {
            e.preventDefault();
        }
    });

    inputs.on('focus', function (e) {
        var element = $(this),
            val = element.val();

        if (!isNaN(val)) element.data('previousValue', parseFloat(val));
    });

    inputs.on('blur', function (e) {
        var element = $(this),
            val = parseFloat(element.val()),
            precision = element.attr('data-precision');

        if (isNaN(val)) {
            val = element.data('previousValue');
            if (!isNaN(val)) {
                element.val(val);
            } else {
                return;
            }
        }

        if (precision) {
            element.val(val.toFixed(precision));
            // we could probably use an .trigger('input') here, with some smart condition
        }
    });

    inputs.on('paste', function (e) {
        var element = $(this),
            val = parseFloat(e.originalEvent.clipboardData.getData('Text')),
            min = parseFloat(element.attr('data-min')),
            max = parseFloat(element.attr('data-max'));

        if (isNaN(val)) {
            element.val(element.data('previousValue'));
            e.preventDefault();
            return;
        }

        // only adjust minimal end if bound is set
        if (!isNaN(min)) {
            if (val < min) {
                element.val(min);
                e.preventDefault();
                return;
            }
        }

        // only adjust maximal end if bound is set
        if (!isNaN(max)) {
            if (val > max) {
                element.val(max);
                e.preventDefault();
                return;
            }
        }
    });

    inputs.on('input', function (e) {
        var element = $(this),
            val = parseFloat(element.val()),
            min = parseFloat(element.attr('data-min')),
            max = parseFloat(element.attr('data-max')),
            precision = parseInt(element.attr('data-precision'));

        if (isNaN(val)) {
            e.preventDefault();
            return false;
        }

        // only adjust minimal end if bound is set
        if (!isNaN(min)) {
            if (val < min) {
                element.val(min);
                val = min;
                return;
            }
        }

        // only adjust maximal end if bound is set
        if (!isNaN(max)) {
            if (val > max) {
                element.val(max);
                val = max;
                return;
            }
        }
    });
}