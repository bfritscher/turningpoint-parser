///<reference path="../typings/tsd.d.ts" />

require('source-map-support').install();
import fs = require('fs');
import path = require('path');
import cors = require('cors');
import express = require('express');
import bodyParser = require('body-parser');
import multiparty = require('connect-multiparty');
//import jwt = require('jsonwebtoken');
//import expressJwt = require('express-jwt');


import turningpointParser = require('./turningpointparser');

var multipartMiddleware = multiparty();
var app = express();
var server = require('http').Server(app);

app.use(cors({
    origin: true,
    credentials: true,
    exposedHeaders: ['Accept-Ranges', 'Content-Encoding', 'Content-Length', 'Content-Range']
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({limit: '50mb'}));

app.use(express.static(__dirname + '/public'));
app.use(express.static(path.resolve(__dirname, '../app/public')));

app.get('/sessions', (req, res) => {
    turningpointParser.getSessions().then((sessions) => {
       res.json(sessions);
    });
});

app.get('/participantLists', (req, res) => {
    turningpointParser.getParticipantLists().then((result) => {
       res.json(result);
    });
});

app.get('/participantLists/:name', (req, res) => {
    turningpointParser.getParticipantListDetail(req.params.name).then((result) => {
        res.json(result);
    });
});

app.get('/cube', (req, res) => {
    turningpointParser.getCube().then((sessions) => {
       res.json(sessions);
    });
});

app.post('/upload', multipartMiddleware, (req: multiparty.Request, res) => {
    turningpointParser.parseZip(req.files.file.path, () => {
        // don't forget to delete all req.files when don
        fs.unlinkSync(req.files.file.path);
        res.sendStatus(200);
    });
});

server.listen(process.env.SERVER_PORT, '0.0.0.0');
server.on('listening', function(){
    console.log('server listening on port %d in %s mode', server.address().port, app.settings.env);
});
