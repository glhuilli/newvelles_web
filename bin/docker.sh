# rebuild the container with new code (version X)
# Note that version X should be N+1 where N is the max version in docker images
docker build -t newvelles-web-container:vX .

# run container locally
docker run -p 5000:5000 newvelles-web-container:vX

# revisit docker images 
docker images
