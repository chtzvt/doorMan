import urllib2
import json

CONFIG = {
    'APP_ID': 'amzn1.ask.skill.[...]',
    'API_KEY': 'doorMan API key goes here',
    'API_HOST': 'Domain name or IP address from which DoorMan can be reached',
    'DOOR_TARGET': 0 # Target door (corresponds to your doorman config)
}


def lambda_handler(event, context):
    checkApplicationID(event['session']['application']['applicationId']);

    if (event['request']['intent']['name'] == "GetStatus"):
        status = checkStatus() + "."
        return generateJSON(status, status)
    elif(event['request']['intent']['name'] == "OpenDoor"):
        if(sendCmd('/set/open')):
            return generateJSON("Opening the garage door.", "Garage door was opened.")
    elif(event['request']['intent']['name'] == "CloseDoor"):
        if(sendCmd('/set/close')):
            return generateJSON("Closing the garage door.", "Garage door was closed.")
    elif(event['request']['intent']['name'] == "CycleDoor"):
        if(sendCmd('/set/cycle')):
            return generateJSON("Cycling the garage door.", "Garage door was cycled.")
    else:
        raise ValueError("Invalid intent: " + event['request']['intent']['name'])


def checkStatus():
    ul2 = urllib2.build_opener(urllib2.HTTPHandler(debuglevel=0))
    api_data = {
        'method': '/get/state',
        'door_id': CONFIG['DOOR_TARGET'],
        'api_key': CONFIG['API_KEY']
    }
    postData = json.dumps(api_data)
    api_response = json.loads(ul2.open(CONFIG['API_HOST'], postData).read())
    response_text = "The garage door is "
    if(api_response['state'] == 0):
        response_text += 'open'
    else:
        response_text += 'closed'
    if(api_response['lockout']):
        response_text += ' and locked'
    return response_text


def sendCmd(cmd):
    ul2 = urllib2.build_opener(urllib2.HTTPHandler(debuglevel=0))
    api_data = {
        'method': cmd,
        'door_id': CONFIG['DOOR_TARGET'],
        'api_key': CONFIG['API_KEY']
    }
    postData = json.dumps(api_data)
    api_response = json.loads(ul2.open(CONFIG['API_HOST'], postData).read())
    return api_response['command_sent']


def generateJSON(speechText, cardText):
    return {
      "version": "1.0",
      "response": {
        "outputSpeech": {
          "type": "PlainText",
          "text": speechText
        },
        "card": {
          "content": cardText,
          "title": "Garage Door",
          "type": "Simple"
        },
        "shouldEndSession": True
      },
      "sessionAttributes": {}
    }


def checkApplicationID(id):
    if (id != CONFIG['APP_ID']):
      raise ValueError("Calling App ID does not match whitelist!")
