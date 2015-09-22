var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    http = require('http'),
    port = 8000,
    _ = require('lodash');

var questionTime = 10; // 10 sec
var users = {};
var quizzStarted = false;
var timeoutQuizzStart = undefined;
var questionTimeout = undefined;
var currentQuestionId = -1;
var questions = [{    
    question: {
        intitule: "blablabla",
        wikipediaUrl: "https://fr.wikipedia.org/w/api.php?action=query&format=json&titles=Jules%20Verne&prop=extracts&explaintext=true&exintro=true",
        removeTerms: ["jules", "verne"],
        answers: [
            "Jules Verne",
            "Jules Ferry",
            "Jules IenneDeLegumes"
        ]
    },
    answer: {
        id: 0,
        link: 'https://www.google.fr/',
        streetView: 'http://streetviewing.fr/'
    }
}, {
    question: {
        intitule: "blobloblo",
        wikipediaUrl: "https://fr.wikipedia.org/w/api.php?action=query&format=json&titles=Marc%20Caro&prop=extracts&explaintext=true&exintro=true",
        removeTerms: ["marc", "caro"],
        answers: [
            "Marc Caro",
            "Marc Unbut",
            "Marc DeCafé"
        ]
    },
    answer: {
        id: 0,
        link: 'https://www.google.fr/',
        streetView: 'http://streetviewing.fr/'
    }
}];
var userAnswers = [];


// Express configuration
//
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Start the HTTP server
//
var httpServer = http.Server(app);
httpServer.listen(port, function() {
    console.log('*** You can test by opening: "localhost:' + port + '" ***');
});

// Socket IO processing
//
var io = require('socket.io').listen(httpServer);

io.on('connection', function(socket) {

    // Events received by the server and the emission of events :
    //  - user connect (P1)
    //    >> quizz started (P1)
    //    >> quizz not started (P1)
    //    >> user list (P2)
    //  - user disconnect (P2)
    //    >> user list (P2)
    //  - user answer (P1)
    //
    // Other emitted events:
    //  - The quizz starts:
    //    >> quizz started
    //  - New question sent to players:
    //    >> new question
    //    >> question timeleft
    //    >> question answer
    //  - End of the game:
    //    >> end quizz


    socket.on('user connect', function(nickname) {
        console.log(' * new user : ' + nickname);
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
                timeoutQuizzStart = setTimeout(startQuizz, 10000);    
            }

            socket.emit('quizz not started', {
                msg: 'Le quizz va bienôt démarrer, merci de patienter',
                users: users,
                startIn:  getTimeLeft(timeoutQuizzStart) });
        }
    });

    socket.on('user disconnect', function(nickname) {
        console.log(' * user left : ' + nickname);
        delete users[nickname];
        socket.broadcast.emit('user list', {
            users: users
        });

        if (_.size(users) == 0) {
            reinitQuizz();
        }
    });

    socket.on('user answer', function (userAnswer) {
        console.log(' * user answer : ' + userAnswer);
        // userAnswer.answerId, userAnswer.nickname
        if (questionTimeout) { // Answers are still accepted
            userAnswers.push(userAnswer);
        }
        else {
            console.log(' * too late for ' + userAnswer.nickname);
        }
    });

});

//----------------------------------------------
// Quizz management functions
//----------------------------------------------
function reinitQuizz() {
    console.log(' * reinit quizz');

    quizzStarted = false;
    timeoutQuizzStart = undefined;
    questionTimeout = undefined;
    currentQuestionId = -1;
    userAnswers = [];

    _.forEach(users, function (user) {
        user.score = 0;
    });
}

function startQuizz() {
    quizzStarted = true;
    io.sockets.emit('quizz started', {
        msg: 'Le quizz démarre !'
    });

    questionTimeout = setTimeout(sendQuestion, 5000);
}

function sendQuestion() {
    io.sockets.emit('new question', { 
        question: questions[++currentQuestionId].question,
        timeleft: questionTime
    });

    setTimeout(processQuestionTimeout, 1000);
}

function processQuestionTimeout() {
    var timeleft = getTimeLeft(questionTimeout);
    if (timeleft <= 0) { // No more time
        questionTimeout = undefined;
        var winners = processUserAnswers();
        io.sockets.emit('question answer', {
             answer: questions[++currentQuestionId].answer,
             winners: winners
        });

        if (currentQuestionId+1 === questions.length) {
            io.sockets.emit('end quizz', users);
            reinitQuizz();
        }
        else {
            setTimeout(sendQuestion, 5000);
        }
    }
    else {
        var percent = 100 - (100 * (questionTime - timeleft) / questionTime); // Pfffffffffffffffff...
        io.sockets.emit('question timeleft', { timeleft: timeleft, percent: percent , userAnswers: userAnswers });
    }
    
}

function processUserAnswers() {
    var score = 5;
    var winners = [];

    _.forEach(userAnswers, function (userAnswer) {
        if (userAnswer.answerId === questions[currentQuestionId].answer.id) {
            users[userAnswer.nickname].score += score;
            winners.push(users[userAnswer.nickname]);
            score -= 2;
        }
    });

    userAnswers = [];

    return winners;
}

//----------------------------------------------
// Utilities functions
//----------------------------------------------

function getTimeLeft(timeout) {
    console.log(' * getTimeLeft : ' + timeout);
    if (timeout) {
        return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
    }
    return 0;
}



/* TODO
*/ 