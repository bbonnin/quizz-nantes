var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var users = [];

app.use(express.static(__dirname + '/public'));


io.on('connection', function(socket) {
    socket.on('user connect', function(nickname) {
    	console.log('new user : ' + nickname);
        socket.nickname = nickname;
        users.push(nickname);
    });
});

http.listen(8000, function(){
    console.log('Open localhost:8000');
});


