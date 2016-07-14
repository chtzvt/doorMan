var request = require('http');
var dsync = require('deasync');

var controller_host = "";
var statusMonitors = {};

function DoorController(config) {
    controller_host = config.host;
}

DoorController.prototype.open = function(doorId) {
    this.sendCommand('open', doorId);
};

DoorController.prototype.close = function(doorId) {
    this.sendCommand('close', doorId);
};

DoorController.prototype.cycle = function(doorId) {
    this.sendCommand('cycle', doorId);
};

DoorController.prototype.lockout = function(doorId) {
    this.sendCommand('lockout', doorId);
};

// Asynchronously queries API for state of specified door.
// State: true/false -> open/closed
DoorController.prototype.getState = function(doorId, callback) {
    request.get(controller_host + '/get/state?id=' + doorId, function(response) {
        if (response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with an error.');
            return;
        }

        var body = '';
        response.on('data', function(d) {
            body += d;
        });

        response.on('end', function() {

            body = JSON.parse(body);

            if (!body.error)
                cb(null, body.state);
            else {
                console.log('[doorControl] QUERY STATE id: ' + this.id + ' failed with error: ' + JSON.stringify(body));
                cb(body.error, undefined);
            }
        }.bind({
            body: body,
            id: this.id,
            cb: cb
        }));

    }.bind({
        id: doorId,
        cb: callback
    }));
};

// Synchronously queries API for state of specified door.
// State: true/false -> open/closed
// Does nothing on error.
DoorController.prototype.getStateSync = function(doorId) {
    var state;
    request.get(controller_host + '/get/state?id=' + doorId, function(response) {
        if (response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with an error.');
            return;
        }

        var body = '';
        response.on('data', function(d) {
            body += d;
        });

        response.on('end', function() {

            body = JSON.parse(body);

            if (!body.error)
                state = body.state;
            else
                console.log('[doorControl] QUERY STATE id: ' + id + ' failed with error: ' + JSON.stringify(body));
        }.bind({
            body: body,
            state: state,
            id: this.id
        }));
    }.bind({
        id: doorId
    }));

    while (state === undefined) {
        dsync.runLoopOnce();
    }

    return state;
};

// Synchronously queries API for IDs of available doors.
DoorController.prototype.enumerateDoorsSync = function() {
    var doors;
    request.get(controller_host + '/get/list', function(response) {
        if (response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + id + ' got status code ' + response.statusCode + ' and exited with an error.');
            return;
        }

        var body = '';
        response.on('data', function(d) {
            body += d;
        });

        response.on('end', function() {

            body = JSON.parse(body);

            if (!body.error)
                doors = body;
            else
                console.log('[doorControl] QUERY STATE id: ' + id + ' failed with error: ' + JSON.stringify(body));
        }.bind({
            body: body,
            doors:doors,
        }));
    }.bind({doors:doors}));

    while (doors === undefined) {
        dsync.runLoopOnce();
    }

    return doors;
};

// Monitors the status of the specified door at the specified interval, returns event emitter.
DoorController.prototype.monitorStatus = function(doorId, timeout) {
    var emitter = new(require('events').EventEmitter);

    statusMonitors[doorId] = {
        monitor: emitter,
        monitorId: 0,
	doorId: doorId,
        statusMonitorInterval: timeout,
        lastKnownState: this.getStateSync(doorId)
    };

    statusMonitors[doorId].monitorId = setInterval(watchState, timeout, doorId, statusMonitors[doorId]);

    return statusMonitors[doorId].monitor;
};

DoorController.prototype.getMonitor = function(doorId) {
    return statusMonitors[doorId];
};

// Destroys status monitor of specified ID
DoorController.prototype.destroyMonitor = function(monitorId) {
    return clearInterval(monitorId);
};

var watchState = function(doorId, doorInfo) {
    request.get(controller_host + '/get/state?id=' + doorId, function(response) {
        if (response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + id + ' got status code ' + response.statusCode + ' and exited with an error.');
            return;
        }

        var body = '';
        response.on('data', function(d) {
            body += d;
        });

        response.on('end', function() {

            body = JSON.parse(body);

            // API errors will return an error key in responses and set state to "error"
            if (body.error && statusMonitors[this.door.doorId].lastKnownState != "error") {
                em.emit("error");
                statusMonitors[this.door.doorId].lastKnownState = "error";
                return;
            }

            // API Lockout will emit a lockout event.
            if (body.lockout && statusMonitors[this.door.doorId].lastKnownState != "lockout") {
                em.emit("lockout");
                statusMonitors[this.door.doorId].lastKnownState = "lockout";
                return;
            }

            // if current state is open and last known state was closed then emit open event
            if (body.state === 1 && statusMonitors[this.door.doorId].lastKnownState === !body.state && body.lockout === false) {
                em.emit("open");
                statusMonitors[this.door.doorId].lastKnownState = 0;
                return;
            }

            // if current state is closed and last known state was open then emit close event
            if (body.state === 0 && statusMonitors[this.door.doorId].lastKnownState === !body.state && body.lockout === false) {
                em.emit("close");
                statusMonitors[this.door.doorId].lastKnownState = 1;
            }

        }.bind({
            body: body,
            em: this.door.monitor,
            door: this.door
        }));

    }.bind({
        door: doorInfo
    }));
};

// Sends open/close/lockout/etc command to API for specified door. Performs no success checks or error handling.
DoorController.prototype.sendCommand = function(command, doorId) {
    request.get(controller_host + '/set/' + command + '?id=' + doorId, function(response) {
        if (response.statusCode != 200) {
            console.log('[doorControl] OPEN id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with an error.');
            return;
        }
    }.bind({
        id: doorId
    }));
};

module.exports = DoorController;
