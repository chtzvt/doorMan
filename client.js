var req = require('requests');
var dsync = require('deasync');

function DoorController(config) {
    this.controller_host = config.host;
    this.statusMonitors = {};
}

DoorController.prototype.open = function(doorId) {
    this.sendCommand('open', doorId);
}

DoorController.prototype.close = function(doorId) {
    this.sendCommand('close', doorId);
}

DoorController.prototype.cycle = function(doorId) {
    this.sendCommand('cycle', doorId);
}

DoorController.prototype.lockout = function(doorId) {
    this.sendCommand('lockout', doorId);
}

// Asynchronously queries API for state of specified door.
// State: true/false -> open/closed
DoorController.prototype.getState = function(doorId, callback) {
    request.get(this.controller_host + '/get/state?id=' + doorId, function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with error: ' + error);
            return;
        }

        body = JSON.parse(body);

        if (!body.error)
	    cb(null, body.state);
        else {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' failed with error: ' + JSON.stringify(body));
            cb(body.error, undefined);
	}

    }.bind({
        id: doorId,
	cb: callback
    }));
}

// Synchronously queries API for state of specified door.
// State: true/false -> open/closed
// Does nothing on error.
DoorController.prototype.getStateSync = function(doorId) {
    var state;
    request.get(this.controller_host + '/get/state?id=' + doorId, function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with error: ' + error);
            return;
        }

        body = JSON.parse(body);

        if (!body.error)
            state = body.state;
        else
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' failed with error: ' + JSON.stringify(body));
    }.bind({
        id: doorId
    }));

    while (state === undefined) {
        dsync.runLoopOnce();
    }

    return state;
}

// Synchronously queries API for IDs of available doors.
DoorController.prototype.enumerateDoorsSync = function() {
    var doors;
    request.get(this.controller_host + '/get/doors_list', function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.log('[doorControl] ENUMERATE DOORS: got status code ' + response.statusCode + ' and exited with error: ' + error);
            return;
        }

        body = JSON.parse(body);

        if (!body.error)
            doors = body.doors;
        else
            console.log('[doorControl] ENUMERATE DOORS: failed with error: ' + JSON.stringify(body));
    });

    while (doors === undefined) {
        dsync.runLoopOnce();
    }

    return doors;
}

// Monitors the status of the specified door at the specified interval, returns event emitter.
DoorController.prototype.monitorStatus = function(doorId, timeout) {
    var emitter = new(require('events').EventEmitter);

    this.statusMonitors[doorId] = {
        monitor: emitter,
        monitorId: 0,
        statusMonitorInterval: timeout,
        lastKnownState: this.getStateSync(doorId)
    }

    this.statusMonitors[doorId].monitorId = setInterval(watchState.bind(doorId, this.statusMonitors[doorId]), timeout);

    return this.doorId.monitor;
}

// Destroys status monitor of specified ID
DoorController.prototype.destroyMonitor = function(monitorId) {
    return clearInterval(monitorId);
}

var watchState = function(doorId, doorInfo) {
    request.get(this.controller_host + '/get/state?id=' + doorId, function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.log('[doorControl] QUERY STATE id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with error: ' + error);
            return;
        }

        body = JSON.parse(body);

        // API errors will return an error key in responses and set state to "error"
        if (body.error) {
            em.emit("error");
            dc.lastKnownState = "error";
            return;
        }

        // API Lockout will emit a lockout event.
        if (body.lockout) {
            em.emit("lockout");
            dc.lastKnownState = "lockout";
            return;
        }

        // if current state is open and last known state was closed then emit open event
        if (body.state === true && lastState === !body.state) {
            em.emit("open");
            dc.lastKnownState = true;
            return;
        }

        // if current state is closed and last known state was open then emit close event
        if (body.state === false && lastState === !body.state) {
            em.emit("close");
            dc.lastKnownState = false;
            return;
        }

    }.bind({
        em: doorInfo.monitor,
        lastState: doorInfo.lastKnownState
    }));
}

// Sends open/close/lockout/etc command to API for specified door. Performs no success checks or error handling.
DoorController.prototype.sendCommand = function(command, doorId) {
    request(this.controller_host + '/set/' + cmd + '?id=' + doorId, function(error, response, body) {
        if (error || response.statusCode != 200) {
            console.log('[doorControl] OPEN id: ' + this.id + ' got status code ' + response.statusCode + ' and exited with error: ' + error);
            return;
        }
    }.bind({
        id: doorId
    }));
}

module.exports = DoorController;
