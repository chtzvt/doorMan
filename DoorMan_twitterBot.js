var CONFIG = {
    BOT_NAME: 'in_garage',
    TWITTER_URL: "https://twitter.com/in_garage",
    TWITTER_API_KEYS: {
        consumer_key: ' ',
        consumer_secret: ' ',
        access_token: ' ',
        access_token_secret: ' ',
    },
    COMMAND_RESPONSE_MAP: {
        startup: {
            response: function() {
                return "It's " + getTime() + " and my service has started :) #statusMsg";
            }
        },
        unauthorized: { // Response sent to unauthorized users
            response: function() {
                return "I'm sorry, <USER>, but I'm afraid I can't do that.";
            }
        },
        unknown: { // Default response when commands are not understood
            response: function() {
                return "I'm sorry, <USER>, but I didn't catch that.";
            }
        },
        status: {
            triggers: ["status", "is", "?"],
            response: function() {
                return "<USER> looks like the door is " + (dctl.getStateSync(CONFIG.TARGET_DOOR) === 0 ? "open" : "closed") + " right now.";
            }
        },
        openDoor: {
            triggers: ["open", "activate", "lift"],
            response: function() {
                return "OK <USER>, I'll open the door.";
            }
        },
        closeDoor: {
            triggers: ["close", "shut", "lower"],
            response: function() {
                return "OK <USER>, I'll close the door.";
            }
        },
        cycleDoor: {
            triggers: ["cycle"],
            response: function() {
                return "OK <USER>, I'll cycle the door opener.";
            }
        },
        lockout: {
            triggers: ["lock", "lockout", "emergency", "disable"],
            response: function() {
                return "Sure thing, <USER>, I'll disable smart functionality for the time being.";
            }
        },
        luv: {
            triggers: ["ily", "love", "thank", "thanks", "ty", "thx"],
            response: function() {
                return "<USER> <3";
            }
        },
        doorOpenNotification: {
            response: function() {
                return "Heads up <USER>: it's " + getTime() + " and the garage door appears to have been left open for more than " + Math.floor(CONFIG.MONITOR.DOOR_CHECK_INTERVAL / 1000 / 60) + "min.";
            }
        },
        doorClosedNotification: {
            response: function() {
                return "<USER> It's now " + getTime() + " and the garage door has been closed.";
            }
        }
    },
    AUTHORIZED_USERS: ["charltontrez"],
    DOORMAN_CREDENTIALS: {
        host: 'http://192.168.1.7:8080',
        api_key: 'default'
    },
    TARGET_DOOR: 0, // ID of the door this script is managing (use dctl.enumerateDoorsSync() for a list)
    MONITOR: {
        DOOR_CHECK_INTERVAL: 600000, // 10min default
        LAST_DOOR_STATE: 'unknown',
        DOOR_NOTIFICATION_SENT: false
    },
    IP: process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1",
    PORT: process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8082
};

var http = require('http');
// This bot depends on the twit, natural, and DoorMan client library modules. Install them before running!
var Twit = require('twit');
var natural = require('natural');
var DoorController = require('./lib/DoorMan_doorctl.js');

var dctl = new DoorController(CONFIG.DOORMAN_CREDENTIALS);
var tokenizer = new natural.WordPunctTokenizer();
var T = new Twit(CONFIG.TWITTER_API_KEYS);
var stream = T.stream('statuses/filter', {
    track: '@' + CONFIG.BOT_NAME
});

stream.on('tweet', doorControl);
stream.on('disconnect', function(disconnectMessage) {
    console.info("[" + getTime() + "] DOORBOT_INFO: DISCONNECT from twitter API with msg " + JSON.stringify(disconnectMessage));
    stream.start();
});

setInterval(doorCheck, CONFIG.MONITOR.DOOR_CHECK_INTERVAL);
T.post('statuses/update', {
    status: CONFIG.COMMAND_RESPONSE_MAP.startup.response()
}, function(err, data, response) {
    if (err)
        console.info("[" + getTime() + "] DOORBOT_DEBUG: " + JSON.stringify(err));
});

function doorControl(tweet) {
    //Never reply to self.
    if (tweet.user.screen_name == CONFIG.BOT_NAME)
        return;

    // Check tweet author against user whitelist
    if (isAuthorized(tweet.user.screen_name) === false) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.unauthorized.response(), tweet);
        return;
    }

    // Convert input to lower case for accurate text matching
    tweet.text = tweet.text.toLowerCase();

    // Answer questions about door state first because "is the door open?" =/= "open the door" and we don't want to mix these up.
    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.status.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.status.response(), tweet);
        return;
    }

    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.openDoor.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.openDoor.response(), tweet);
        dctl.open(CONFIG.TARGET_DOOR);
        return;
    }

    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.closeDoor.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.closeDoor.response(), tweet);
        dctl.close(CONFIG.TARGET_DOOR);
        return;
    }

    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.cycleDoor.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.cycleDoor.response(), tweet);
        dctl.cycle(CONFIG.TARGET_DOOR);
        return;
    }

    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.lockout.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.lockout.response(), tweet);
        dctl.lockout(CONFIG.TARGET_DOOR);
        return;
    }

    // Whimsy ;P
    if (containsTriggers(CONFIG.COMMAND_RESPONSE_MAP.luv.triggers, tweet)) {
        sendResponse(CONFIG.COMMAND_RESPONSE_MAP.luv.response(), tweet);
        return;
    }

    // Default responses for gibberish inputs
    sendResponse(CONFIG.COMMAND_RESPONSE_MAP.unknown.response(), tweet);
}

function sendResponse(text, tweet) {
    var params = {
        status: text.replace('<USER>', getUsers(tweet)),
        in_reply_to_status_id: tweet.id_str
    };

    T.post('statuses/update', params, function(err, data, response) {
        if (err)
            console.info("[" + getTime() + "] DOORBOT_DEBUG: " + JSON.stringify(err));
    });
}

function notify(text) {
    var users = "";

    for (var i = 0; i < CONFIG.AUTHORIZED_USERS.length; i++)
        users += '@' + CONFIG.AUTHORIZED_USERS[i] + ' ';

    // remove trailing whitespace
    if (users[users.length - 1] == " ")
        users = users.slice(0, users.length - 1);

    var params = {
        status: text.replace('<USER>', users),
    };

    T.post('statuses/update', params, function(err, data, response) {
        if (err)
            console.info("[" + getTime() + "] DOORBOT_DEBUG: " + JSON.stringify(err));
    });
}

function getUsers(tweet) {
    var mentions = '@' + tweet.user.screen_name + ' ';

    for (var i = 0; i < tweet.entities.user_mentions.length; i++)
        if (tweet.entities.user_mentions[i].screen_name != CONFIG.BOT_NAME)
            mentions += '@' + tweet.entities.user_mentions[i].screen_name + ' ';

        // remove trailing whitespace
    if (mentions[mentions.length - 1] == " ")
        mentions = mentions.slice(0, mentions.length - 1);

    return mentions;
}

function doorCheck() {
    // Set initial door state, halt further state checks.
    if (CONFIG.MONITOR.LAST_DOOR_STATE == 'unknown') {
        CONFIG.MONITOR.LAST_DOOR_STATE = dctl.getStateSync(CONFIG.TARGET_DOOR);
        CONFIG.MONITOR.DOOR_NOTIFICATION_SENT = false;
        return;
    }

    // If current door state is open, the last known state was also open, and the user hs not yet been notified of this.
    if (dctl.getStateSync(CONFIG.TARGET_DOOR) === 0 && CONFIG.MONITOR.LAST_DOOR_STATE === 0 && CONFIG.MONITOR.DOOR_NOTIFICATION_SENT === false) {
        notify(CONFIG.COMMAND_RESPONSE_MAP.doorOpenNotification.response());
        CONFIG.MONITOR.DOOR_NOTIFICATION_SENT = true;
    }

    // If the current door state is closed, the last known door state was open and the user has been previously notified of this.
    if (dctl.getStateSync(CONFIG.TARGET_DOOR) == 1 && CONFIG.MONITOR.LAST_DOOR_STATE === 0 && CONFIG.MONITOR.DOOR_NOTIFICATION_SENT === true) {
        notify(CONFIG.COMMAND_RESPONSE_MAP.doorClosedNotification.response());
        CONFIG.MONITOR.DOOR_NOTIFICATION_SENT = false;
    }

    // Set previous door state to current state.
    CONFIG.MONITOR.LAST_DOOR_STATE = dctl.getStateSync(CONFIG.TARGET_DOOR);
}

// Ensures that user is authorized to send door commands
function isAuthorized(user) {
    return CONFIG.AUTHORIZED_USERS.indexOf(user) >= 0;
}

function getTime() {
    var dt = new Date();
    var hours = (dt.getHours() % 12 || 12);
    var minutes = dt.getMinutes();

    // ensure minutes always 2 digits
    if (dt.getMinutes() < 10)
        minutes = "0" + minutes;

    return hours + ":" + minutes;
}

function containsTriggers(triggers, tweet) {
    var tweetText = tokenizer.tokenize(tweet.text);

    // Scan over each word and check for any matches to trigger words/characters
    for (var i = 0; i < tweetText.length; i++)
        if (triggers.indexOf(tweetText[i]) >= 0)
            return true;

    return false;
}

http.createServer(function(req, res) {
    res.writeHead(301, {
        Location: CONFIG.TWITTER_URL
    });
    res.end();
}).listen(CONFIG.PORT, CONFIG.IP);
