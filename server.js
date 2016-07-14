var gpio = require('chip-gpio').Gpio;
var sleep = require('sleep').sleep;
var http = require('http');
var url = require('url');

var CONFIG = {
    doors: [ // Object position in array corresponds to door ID.
        {
            id: 0,
            lift_pin: 0,
            sensor_pin: 0,
            lockout: false,
            human_name: "Left Door",
            lift_ctl: {write: ''},
            sensor_ctl: {read: ''}
        }
    ],
    http_port: 8080
};

parseConfig();

http.createServer(function(req, res) {

    if (req.method === "GET") {

        var call = url.parse(req.url, true);

        console.log("Called " + req.url + " for door number: " + call.query.id);

        if (CONFIG.doors[call.query.id] === undefined && call.pathname != "/get/list") {
            res.writeHead(200);
            res.end(JSON.stringify({
                error: "no such door"
            }));
        }

        switch (call.pathname) {
            case "/get/state":
                res.writeHead(200);
                var state = {
                    state: CONFIG.doors[call.query.id].sensor_ctl.read(),
                    lockout: CONFIG.doors[call.query.id].lockout
                };
                res.end(JSON.stringify(state));
                break;

            case "/get/list":
                res.writeHead(200);
                var list = strip_gpioCtl(CONFIG.doors);
                res.end(JSON.stringify({
                    list: list
                }));
                break;

            case "/set/open": // Below may need to be reordered depending on whether this function is exited after res.end is called. 
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 1, false);
                break;

            case "/set/close": // Below may need to be reordered depending on whether this function is exited after res.end is called.
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 0, false);
                break;

            case "/set/cycle": // Below may need to be reordered depending on whether this function is exited after res.end is called.
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, null, true); // Cycle door state by sending command regardless of sensor reading
                break;

            case "/set/lockout": // Below may need to be reordered depending on whether this function is exited after res.end is called.
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 0, false); // Close door.
                CONFIG.doors[call.query.id].lockout = true; // set lockout flag on door.
                break;

            default:
                res.writeHead(400);
                res.end(JSON.stringify({
                    error: "method not implemented"
                }));
        }

        console.log("Completed method " + req.url + " for door number: " + call.query.id);

    } else {
        res.writeHead(400);
        res.end(JSON.stringify({
            error: "malformed request"
        }));
    }

}.bind({
    CONFIG: CONFIG
})).listen(CONFIG.http_port);

// Parses configuration object, configures GPIO control for each door programmatically. 
function parseConfig() {
    // Instantiate GPIO controller for each door and attach this to the door object.
    for (var i = 0; i < CONFIG.doors.length; i++) {
        CONFIG.doors[i].lift_ctl = new Gpio(CONFIG.doors[i].lift_pin, 'out');
        CONFIG.doors[i].sensor_ctl = new Gpio(CONFIG.doors[i].sensor_pin, 'in');
    }
}

// Creates a copy of the door configuration and strips the GPIO control methods from it, as we do not want to include these
// in the JSON response.
function strip_gpioCtl(doors) {
    var strippedList = [];
    for (var i = 0; i < doors.length; i++) {
        var newDoor = JSON.parse(JSON.stringify(doors[i]));
        delete newDoor.lift_ctl;
        delete newDoor.sensor_ctl;
        strippedList[i] = newDoor;
    }
    return strippedList;
}

// Trips circuit based on optional initial condition of door.
// Params:
//	id - id of door to open
// 	initialState - initial state the door MUST be in in order for command to be sent.
// 	bypass - bypass state check (optional)
function tripCircuit(id, initialState, bypass) {
    if (bypass === true || CONFIG.doors[id].sensor_ctl.read() == initialState) {
        // Close relay
        CONFIG.doors[id].lift_ctl.write(1);
        // Sleep for 1 second
        sleep(1000);
        // Open relay
        CONFIG.doors[id].lift_ctl.write(0);
    }
}
