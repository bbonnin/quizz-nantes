var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    http = require('http'),
    port = 8000;

var users = [];

// Express configuration
//
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Start the HTTP server
//
var httpServer = http.Server(app);
httpServer.listen(port, function() {
    console.log('You can test by opening: "localhost:' + port + '"');
});

// Socket IO processing
//
var io = require('socket.io').listen(httpServer);
io.on('connection', function(socket) {
    socket.on('user connect', function(nickname) {
        console.log('new user : ' + nickname);
        socket.nickname = nickname;
        users.push(nickname);
    });
});

