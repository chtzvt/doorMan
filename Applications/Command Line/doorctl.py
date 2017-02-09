#!/usr/bin/env python
import urllib2, json, sys

CONFIG = {
    'API_KEY': ' ',
    'API_HOST': 'http://<ip>',
    'DOOR_TARGET': 0
}

def main():
    if 'open' in sys.argv:
	print 'sent open: %s' % sendCmd('/set/open')

    if 'close' in sys.argv:
	print 'sent close: %s' % sendCmd('/set/close')

    if 'cycle' in sys.argv:
	print 'sent cycle: %s' % sendCmd('/set/cycle')

    if 'lockout' in sys.argv:
	print 'sent lockout: %s' % sendCmd('/set/lockout')

    if 'status' in sys.argv:
	checkStatus()

    if 'state' in sys.argv:
        checkStatus()

    if 'open' or 'close' or 'cycle' or 'lockout' or 'status' or 'state' in sys.argv:
        sys.exit(0)

    print "usage:\n    doorctl open|close|cycle|lockout|status|help"

def checkStatus():
    ul2 = urllib2.build_opener(urllib2.HTTPHandler(debuglevel=0))
    api_data = {
        'method': '/get/state',
        'door_id': CONFIG['DOOR_TARGET'],
        'api_key': CONFIG['API_KEY']
    }
    postData = json.dumps(api_data)
    try:
        api_response = json.loads(ul2.open(CONFIG['API_HOST'], postData).read())
        if(api_response['state'] == 0):
            response_text = 'open'
        else:
            response_text = 'closed'
        if(api_response['lockout']):
            response_text += ' and locked'
    except Exception:
	response_text = "query state failed"
    print response_text

def sendCmd(cmd):
    ul2 = urllib2.build_opener(urllib2.HTTPHandler(debuglevel=0))
    api_data = {
        'method': cmd,
        'door_id': CONFIG['DOOR_TARGET'],
        'api_key': CONFIG['API_KEY']
    }
    postData = json.dumps(api_data)
    try:
        api_response = json.loads(ul2.open(CONFIG['API_HOST'], postData).read())
    except Exception: 
	api_response = {'command_sent': 'failed'}
    return api_response['command_sent']

if __name__ == "__main__":
    main()
