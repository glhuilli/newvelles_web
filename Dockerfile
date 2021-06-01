# Set base image (host OS)
FROM python:3.8-alpine

# By default, listen on port 5000
EXPOSE 5000/tcp

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
ADD newvelles_web /app/newvelles_web
ADD requirements.txt /app
ADD setup.py /app

# Install any dependencies
RUN cd /app && python setup.py install

# Copy the content of the local src directory to the working directory
COPY index.html .
COPY run.py .

# Specify the command to run on container start
CMD [ "python", "./run.py" ]
