#/bin/sh

# Remove older version
sudo apt-get remove docker docker-engine docker.io

# Update
sudo apt-get update

# Install packages
sudo apt-get install apt-transport-https ca-certificates curl gnupg2 software-properties-common

# Add docker key
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -

# Finger print
sudo apt-key fingerprint 0EBFCD88

# Add repository
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable"

# Update
sudo apt-get update

# Installing Docker
sudo apt-get install docker-ce

# Verifying the install is successful
sudo docker run hello-world
