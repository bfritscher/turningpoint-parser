FROM bfritscher/nodejs-grunt-bower
RUN mkdir -p /app
COPY package.json /app/package.json
COPY Gruntfile.js /app/Gruntfile.js
COPY tslint.json /app/tslint.json
WORKDIR /app
RUN npm install
#RUN grunt

#VOLUME ["/amc/projects"]

# Define default command.
#CMD ["supervisor", "--watch", "/amc/dist", "dist/server.js"]
