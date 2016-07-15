var gpio = require('chip-gpio').Gpio;
var http = require('http');
var url = require('url');

var CONFIG = {
    doors: [ // Object position in array corresponds to door ID.
        {
            id: 0,
            lift_pin: 6,
            sensor_pin: 7,
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

	// Validate request for door availability and 
        if (!/^-?\d+\.?\d*$/.test(call.query.id) || typeof CONFIG.doors[call.query.id] === "undefined" && call.pathname !== "/get/list") {
            	res.writeHead(400);
            	res.end(JSON.stringify({
            	    error: "bad request or door does not exist"
            	}));
	    	return;
        }

        switch (call.pathname) {
            case "/get/state":
                res.writeHead(200);
                var state = {
                    state: CONFIG.doors[call.query.id].sensor_ctl.read() == 1 ? 0 : 1, // flip so that 1 -> closed and 0 -> open
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

            case "/set/open": // Open door ONLY if door currently closed. 
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 0, false);
                break;

            case "/set/close": // Close door ONLY if door currently open.
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 1, false);
                break;

            case "/set/cycle": // Cycle door state by sending command regardless of sensor reading
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, null, true); 
                break;

            case "/set/lockout": // Closes door and disables DoorControl API
                res.writeHead(200);
                res.end(JSON.stringify({
                    command_sent: true
                }));
                tripCircuit(call.query.id, 1, false);
                CONFIG.doors[call.query.id].lockout = true; // set lockout flag
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
// Also sets default GPIO state
function parseConfig() {
    // Instantiate GPIO controller for each door and attach this to the door object.
    for (var i = 0; i < CONFIG.doors.length; i++) {
        CONFIG.doors[i].lift_ctl = new gpio(CONFIG.doors[i].lift_pin, 'high');
        CONFIG.doors[i].sensor_ctl = new gpio(CONFIG.doors[i].sensor_pin, 'in', 'both', {debounceTimeout: 500});
    }

    // Ensure that relay state is OFF on server start, for all doors.
    for (var i = 0; i < CONFIG.doors.length; i++) {
        CONFIG.doors[i].lift_ctl.write(0);
    }
}

// Creates a copy of the door configuration and strips the GPIO control methods from it, as we do not want to include them in the JSON response.
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
// 	initialState - door state that must be satisfied in order to send command (e.g. switch position: 1 -> closed, 0 -> open)
// 	bypass - bypass state check (optional)
function tripCircuit(id, initialState, bypass) {
    if (bypass === true || CONFIG.doors[id].sensor_ctl.read() == initialState) {

        CONFIG.doors[id].lift_ctl.write(0); // Ensure that power is OFF initially.

	CONFIG.doors[id].lift_ctl.write(1); // power ON 

        setTimeout(function() {
	        CONFIG.doors[id].lift_ctl.write(0); 
	}, 2000); // power OFF again after 2 seconds
    }
}
