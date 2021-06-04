# rebuild the container with new code (version X)
docker build -t newvelles-web-container:vX .

# run container locally
docker run -p 5000:5000 newvelles-web-container:vX

# revisit docker images 
docker images
