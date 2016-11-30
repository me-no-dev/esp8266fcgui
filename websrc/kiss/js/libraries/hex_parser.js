'use strict';

// input = string
// result = if hex file is valid, result is an object
//          if hex file wasn't valid (crc check failed on any of the lines), result will be false
function read_hex_file(data) {
    data = data.split("\n");

    // check if there is an empty line in the end of hex file, if there is, remove it
    if (data[data.length - 1] == "") {
        data.pop();
    }

    var hexfile_valid = true; // if any of the crc checks failed, this variable flips to false

    var result = {
        data: [],
        end_of_file: false,
        bytes_total: 0,
        start_linear_address: 0
    };

    var extended_linear_address = 0;
    var next_address = 0;

    for (var i = 0; i < data.length && hexfile_valid; i++) {
        // each byte is represnted by two chars
        var byte_count = parseInt(data[i].substr(1, 2), 16);
        var address = parseInt(data[i].substr(3, 4), 16);
        var record_type = parseInt(data[i].substr(7, 2), 16);
        var content = data[i].substr(9, byte_count * 2); // still in string format
        var checksum = parseInt(data[i].substr(9 + byte_count * 2, 2), 16); // (this is a 2's complement value)

        switch (record_type) {
            case 0x00: // data record
                if (address != next_address || next_address == 0) {
                    result.data.push({
                        'address': extended_linear_address + address,
                        'bytes': 0,
                        'data': []
                    });
                }

                // store address for next comparison
                next_address = address + byte_count;

                // process data
                var crc = byte_count + parseInt(data[i].substr(3, 2), 16) + parseInt(data[i].substr(5, 2), 16) + record_type;
                for (var needle = 0; needle < byte_count * 2; needle += 2) { // * 2 because of 2 hex chars per 1 byte
                    var num = parseInt(content.substr(needle, 2), 16); // get one byte in hex and convert it to decimal
                    var data_block = result.data.length - 1;

                    result.data[data_block].data.push(num);
                    result.data[data_block].bytes++;

                    crc += num;
                    result.bytes_total++;
                }

                // change crc to 2's complement
                crc = (~crc + 1) & 0xFF;

                // verify
                if (crc != checksum) {
                    hexfile_valid = false;
                }
                break;
            case 0x01: // end of file record
                result.end_of_file = true;
                break;
            case 0x02: // extended segment address record
                // not implemented
                if (parseInt(content, 16) != 0) { // ignore if segment is 0
                    console.log('extended segment address record found - NOT IMPLEMENTED !!!');
                }
                break;
            case 0x03: // start segment address record
                // not implemented
                if (parseInt(content, 16) != 0) { // ignore if segment is 0
                    console.log('start segment address record found - NOT IMPLEMENTED !!!');
                }
                break;
            case 0x04: // extended linear address record
                extended_linear_address = (parseInt(content.substr(0, 2), 16) << 24) | parseInt(content.substr(2, 2), 16) << 16;
                break;
            case 0x05: // start linear address record
                result.start_linear_address = parseInt(content, 16)
                break;
        }
    }

    if (result.end_of_file && hexfile_valid) {
        return result;
    } else {
        return false;
    }
}


/*
 *	Parse hex file, suitable for the bootloader flashing
 */
function parseBootloaderHexFile(hexFile) {
    var pages = [];
    var ByteArr = [];
    var BlockName = "";
    var BlockStartSign = 0;
    var hexFileArr = hexFile.replace(/(?:\r\n|\r|\n)/g, '').split(':');
    for (var i = 0; i < hexFileArr.length; i++) {
        var lineArr = hexFileArr[i].split("");
        if (i == 3) {
            if (parseInt(lineArr[3]) == 4) {
                BlockName = 'page';
                BlockStartSign = 70;
            } else if (parseInt(lineArr[3]) == 8) {
                BlockName = 'block';
                BlockStartSign = 69;
            } else {
                console.log('this hexfile cant be loaded as it is not bootloder conform');
                pages = [];
                return;
            }
        }
        if (parseInt('0x' + lineArr[6] + lineArr[7]) == 0) {
            for (var y = 8; y < lineArr.length - 2; y += 2) {
                ByteArr.push(parseInt('0x' + lineArr[y] + lineArr[y + 1]));
            }
        }
    }
    var pagecounter = 0;
    var pageBytecounter = 0;
    var crc = 0;

    // resize to full pages
    var fittingpages = Math.ceil(ByteArr.length / 64);
    var leftBytes = (fittingpages * 64) - (ByteArr.length);
    console.log('loaded: ' + ByteArr.length + ' bytes');
    for (var i = 0; i < leftBytes; i++) {
        ByteArr.push(255);
    }
    console.log(BlockName + ' conform: ' + ByteArr.length + ' bytes, ' + ByteArr.length / 64 + ' ' + BlockName + 's');

    for (var i = 0; i < ByteArr.length; i++) {
        if (pageBytecounter == 0) {
            pages[pagecounter] = [];
            crc = update_crc8(BlockStartSign, 0);
            pages[pagecounter].push(BlockStartSign);
            pages[pagecounter].push(BlockStartSign);
            pages[pagecounter].push(BlockStartSign);

            crc = update_crc8((pagecounter & 0xFF), crc);
            pages[pagecounter].push((pagecounter & 0xFF));
            pages[pagecounter].push((pagecounter & 0xFF));
            pages[pagecounter].push((pagecounter & 0xFF));

            crc = update_crc8((pagecounter >> 8), crc);
            pages[pagecounter].push((pagecounter >> 8));
            pages[pagecounter].push((pagecounter >> 8));
            pages[pagecounter].push((pagecounter >> 8));

            if (pagecounter < (ByteArr.length / 64) - 1) {
                crc = update_crc8(0, crc);
                pages[pagecounter].push(0);
                pages[pagecounter].push(0);
                pages[pagecounter].push(0);
            } else {
                crc = update_crc8(255, crc);
                pages[pagecounter].push(255);
                pages[pagecounter].push(255);
                pages[pagecounter].push(255);
            }
        }
        crc = update_crc8(ByteArr[i], crc);
        pages[pagecounter].push(ByteArr[i]);
        pages[pagecounter].push(ByteArr[i]);
        pages[pagecounter].push(ByteArr[i]);
        pageBytecounter++;
        if (pageBytecounter == 64) {
            pageBytecounter = 0;
            pages[pagecounter].push(crc);
            pages[pagecounter].push(crc);
            pages[pagecounter].push(crc);
            pagecounter++;
        }
    }
    return pages;
}

function update_crc8(crc, crc_seed) {
    var crc_u = crc;
    var i = 0;
    crc_u ^= crc_seed;
    for (i = 0; i < 8; i++) {
        crc_u = (crc_u & 0x80) ? 0x7 ^ (crc_u << 1) : (crc_u << 1);
        if (crc_u > 256) crc_u -= 256;
    }
    return (crc_u);
}