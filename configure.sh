read -p "This will configure your C.H.I.P. to run the DoorMan server and related applications. Do you want to continue? [y/n] " -n 1 -r

if [[ $REPLY =~ ^[Yy]$ ]]
then
	echo "***** DOORMAN_SETUP: Making sure that curl and git are installed before continuing..."
	apt-get -y install curl git

	echo "***** DOORMAN_SETUP: Configuring NodeJS repositories for APT..."
	curl -sL https://deb.nodesource.com/setup_4.x | bash -

	echo "***** DOORMAN_SETUP: Installing NodeJS, npm, required libraries, and git..."
	apt-get install -y nodejs build-essential libavahi-compat-libdnssd-dev

	echo "***** DOORMAN_SETUP: Installing PM2 process manager (global)"
	npm install -g pm2 

	echo "***** DOORMAN_SETUP: Installing other global dependencies..."
	npm install node-gyp deasync chip-gpio

	echo -e "\n\n***** DOORMAN_SETUP: System configuration is complete. You are now ready to run the API server and add other applications."
fi
