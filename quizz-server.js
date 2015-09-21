var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    http = require('http'),
    port = 8000,
    _ = require('lodash');

var users = {};
var quizzStarted = false;
var timeout = undefined;
var questionId = 0;

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
        users[nickname] = { nickname : nickname, score : 0, socketId: socket.id };

        if (quizzStarted) {
            socket.emit('quizz started', { 
                msg: 'Un quizz est démarré, vous commencerez avec la prochaine question',
                users: users });
        }
        else {
            if (_.size(users) == 1) {
                // Start a timer, after the end of it, the quizz will start
                timeout = setTimeout(startQuizz, 10000);    
            }

            socket.emit('quizz not started', {
                msg: 'Le quizz va bienôt démarrer, merci de patienter',
                users: users,
                startIn:  getTimeLeft(timeout) });
        }
    });

    socket.on('user disconnect', function(nickname) {
        console.log('user left : ' + nickname);
        delete users[nickname];
        socket.broadcast.emit('user list', {
            users: users
        });

        if (_.size(users) == 0) {
            reinitQuizz();
        }
    });
});

//----------------------------------------------
// Quizz management functions
//----------------------------------------------
function reinitQuizz() {
    console.log('reinit quizz');
    quizzStarted = false;
    timeout = undefined;
    questionId = 0;
}

function startQuizz() {
    quizzStarted = true;
    io.sockets.emit('quizz started', {
        msg: 'Le quizz démarre !'
    });

    setTimeout(sendQuestion, 5000);
}

function sendQuestion() {
    io.sockets.emit('new question', {
        questionId: ++questionId,
        question: 'Oh la belle question',
        responses: [
            { response: 'une belle réponse' },
            { response: 'une autre réponse (moins belle)' },
            { response: 'la bonne réponse' }
        ],
        // Bad parameters :-)
        goodResponse: 2,
        wikipediaUrl: 'https://fr.wikipedia.org/w/api.php?action=query&format=json&titles=Jules%20Verne&prop=extracts&explaintext=true&exintro=true'
    });
}


//----------------------------------------------
// Utilities functions
//----------------------------------------------

function getTimeLeft(timeout) {
    return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
}