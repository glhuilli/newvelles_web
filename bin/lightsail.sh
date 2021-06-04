# Create lightsail container service MICRO
aws lightsail create-container-service --service-name newvelles-web-service --power micro --scale 1

# Push Docker container to lightsail container (version X)
aws lightsail push-container-image --service-name newvelles-web-service --label newvelles-web-container --image newvelles-web-container:vX

# Deploy container to lightsail 
aws lightsail create-container-service-deployment --service-name newvelles-web-service --containers file://containers.json --public-endpoint file://public-endpoint.json

# Check status of deployment 
aws lightsail get-container-services --service-name newvelles-web-service

# Delete container 
aws lightsail delete-container-service --service-name newvelles-web-service
