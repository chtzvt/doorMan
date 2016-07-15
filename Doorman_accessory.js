var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;

// this interfaces with the garage door opener API
var DoorController = require("../dctl.js");
var dctl = new DoorController({host:'http://localhost:8080'});
var doorTarget = dctl.enumerateDoorsSync().list[0].id || 0;

dctl.opened = function() {
	var state = dctl.getStateSync(doorTarget) == 0 ? true : false;
	console.log("check door state: open? : " + state);
	return state;
};
dctl.identify = function() {
    console.log("Identified.");
//    dctl.cycle();
};


console.log("Initial state is: " + dctl.opened);

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

      garage
        .getService(Service.GarageDoorOpener)
        .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
    }
    else if (value == Characteristic.TargetDoorState.OPEN) {
      dctl.open(doorTarget);
      callback();

      garage
        .getService(Service.GarageDoorOpener)
        .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
    }
  });

garage
  .getService(Service.GarageDoorOpener)
  .getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', function(callback) {

    var err = null;

    if (dctl.opened()) {
      console.log("Query state: door open");
      callback(err, Characteristic.CurrentDoorState.OPEN);
    } else {
      console.log("Query state: door closed");
      callback(err, Characteristic.CurrentDoorState.CLOSED);
    }
});

