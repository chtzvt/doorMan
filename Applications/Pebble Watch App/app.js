var UI = require('ui');
var ajax = require('ajax');

var CONFIG = {
    host: "http://<IP HERE>",
    port: 8080,
    door_id: 0,
    api_key: 'default'
};

var main = new UI.Card({
    title: 'Garage Door Control',
    subtitle: 'Getting status...',
    subtitleColor: 'blue',
    bodyColor: '#ffffff'
});

main.show();

ajax({
    url: CONFIG.host + ":" + CONFIG.port + "/get/state?id=" + CONFIG.door_id + "&api_key=" + CONFIG.api_key,
    type: 'json',
    method: 'get',
    port: CONFIG.port
}, function(data) {
    main.subtitle((data.state === 0 ? "Open" : "Closed") + (data.lockout === true ? " (LOCK)" : ""));
});

main.on('click', 'up', function(e) {
    ajax({
        url: CONFIG.host + ":" + CONFIG.port + "/set/open?id=" + CONFIG.door_id + "&api_key=" + CONFIG.api_key,
        type: 'json',
        method: 'get',
        port: CONFIG.port
    });
});

main.on('click', 'select', function(e) {
    ajax({
        url: CONFIG.host + ":" + CONFIG.port + "/set/cycle?id=" + CONFIG.door_id + "&api_key=" + CONFIG.api_key,
        type: 'json',
        method: 'get',
        port: CONFIG.port
    });
});

main.on('click', 'down', function(e) {
    ajax({
        url: CONFIG.host + ":" + CONFIG.port + "/set/close?id=" + CONFIG.door_id + "&api_key=" + CONFIG.api_key,
        type: 'json',
        method: 'get',
        port: CONFIG.port
    });
});

