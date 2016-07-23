var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

// Client Library interfaces with DoorMan server.
var DoorController = require("../lib/Doorman_DoorCtl.js");

// Default API server is localhost on port 8080, but this can be any server. For example, you might run
// the HAP server on a different networked device than the C.H.I.P. itself.
var dctl = new DoorController({host:'http://localhost:8080', api_key: 'default'});

// By default, we use door ID 0. If you want other doors, their IDs can be retrieved using the dctl.enumerateDoorsSync() method.
var doorTarget = 0;

// Add a few methods that are useful to HAP
dctl.opened = function() {
    var state = dctl.getStateSync(doorTarget) === 0 ? true : false;
    //console.log("DOORMAN_INFO: Query door state: " + ((state === true) ? "open" : "closed"));
    return state;
};

dctl.identify = function() {
    console.log("DOORMAN_INFO: Identified.");
    // You could blink an LED or something here.
};

// Override included status monitor from client lib
dctl.monitorStatus = function() {
    if (dctl.opened()) {
        garage
            .getService(Service.GarageDoorOpener)
            .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
    } else {
        garage
            .getService(Service.GarageDoorOpener)
            .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
    }
};
setInterval(dctl.monitorStatus, 1000);

console.log("DOORMAN_INFO: Initial door state is " + ((dctl.opened() === true) ? "open" : "closed"));

var garageUUID = uuid.generate('hap-nodejs:accessories:garage');
var garage = exports.accessory = new Accessory('Garage Door', garageUUID);

garage.username = "C1:5D:3F:EE:5E:FA";
garage.pincode = "000-00-000";

garage
  .getService(Service.AccessoryInformation)
  .setCharacteristic(Characteristic.Manufacturer, "Trezevant Technologies")
  .setCharacteristic(Characteristic.Model, "Rev-1")
  .setCharacteristic(Characteristic.SerialNumber, "CTIS0042");

garage.on('identify', function(paired, callback) {
  dctl.identify();
  callback();
});

garage
  .addService(Service.GarageDoorOpener, "Garage Door Opener") 
  .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED)
  .getCharacteristic(Characteristic.TargetDoorState)
  .on('set', function(value, callback) {

    if (value == Characteristic.TargetDoorState.CLOSED) {
      dctl.close(doorTarget);
      callback();
    }
    else if (value == Characteristic.TargetDoorState.OPEN) {
      dctl.open(doorTarget);
      callback();
    }
  });

garage
  .getService(Service.GarageDoorOpener)
  .getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', function(callback) {

    var err = null;

    if (dctl.opened()) {
      callback(err, Characteristic.CurrentDoorState.OPEN);
    } else {
      callback(err, Characteristic.CurrentDoorState.CLOSED);
    }
});
