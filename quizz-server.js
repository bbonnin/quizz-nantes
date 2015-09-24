var express = require('express'),
    bodyParser = require('body-parser'),
    app = express(),
    http = require('http'),
    port = process.env.PORT || 8000,
    MongoClient = require('mongodb').MongoClient,
    syncRequest = require('sync-request');
    _ = require('lodash');

var questionTime = 10; // 10 sec
var users = {};
var quizzStarted = false;
var timeoutQuizzStart = undefined;
var questionTimeout = undefined;
var currentQuestionId = -1;
readAQuestion();
var questions = [];
/*var questions = [{
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
}];*/
var userAnswers = [];

// MongoDB connection
//
var quizzdb = undefined;
//var url = 'mongodb://localhost:27017/quizz';
var url = 'mongodb://quizz:quizz@ds051943.mongolab.com:51943/quizz';
MongoClient.connect(url, function (err, db) {
    if (!err) {
        console.log(" * Connected correctly to mongodb");
        quizzdb = db;
    }
});

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

    socket.on('play quizz', function() {

        if (!quizzStarted) {
            if (!timeoutQuizzStart) {
                // Start a timer, after the end of it, the quizz will start
                setTimeout(startQuizz, 10000);  
                timeoutQuizzStart = { start: Date.now(), delay: 10000 };
            }

            console.log(' >> quizz not started');
            socket.emit('quizz not started', {
                msg: 'Le quizz va bienôt démarrer, merci de patienter',
                users: users,
                startIn:  getTimeLeft(timeoutQuizzStart) });
        }
    });

    socket.on('user connect', function(nickname) {
        console.log(' << new user : ' + nickname);
        socket.nickname = nickname;
        users[nickname] = { nickname : nickname, score : 0, socketId: socket.id };

        if (quizzStarted) {
            /*socket.emit('quizz started', { 
                msg: 'Un quizz est démarré, vous commencerez avec la prochaine question',
                users: users });*/
        }
        else {
            if (_.size(users) == 1) {
                // Start a timer, after the end of it, the quizz will start
                setTimeout(startQuizz, 10000);  
                timeoutQuizzStart = { start: Date.now(), delay: 10000 };
            }

            console.log(' >> quizz not started');
            socket.emit('quizz not started', {
                msg: 'Le quizz va bienôt démarrer, merci de patienter',
                users: users,
                startIn:  getTimeLeft(timeoutQuizzStart) });
        }
    });

    socket.on('user disconnect', function(nickname) {
        console.log(' << user disconnect : ' + nickname);
        delete users[nickname];

        console.log(' >> user list : ' + nickname);
        socket.broadcast.emit('user list', {
            users: users
        });

        if (_.size(users) == 0) {
            reinitQuizz();
        }
    });

    socket.on('user answer', function (userAnswer) {
        console.log(' << user answer : ' + userAnswer);
        // userAnswer.answerId, userAnswer.nickname
        if (questionTimeout) { // Answers are still accepted
            userAnswers.push(userAnswer);
        }
        else {
            console.log(' * too late for ' + userAnswer.nickname);
        }
    });

    socket.on('geoloc', function (data) {
        console.log(' << geoloc : ' + data.searchName);
        quizzdb.collection('voies').find({$text:{$search:"\"" + data.searchName + "\""}}).toArray(function (err, docs) {
        //quizzdb.collection('voies').find({}, {limit:5}).toArray(function (err, docs) {
            if (!err) {
                console.log(' * street count :' + docs.length);
                var apiUrl = 'http://www.mapquestapi.com/geocoding/v1/address';
                var apiQuery = 'key=PLRbAR4aEep1sfWbuGw9cXWBwwRAGBGa&inFormat=json&json={"location":';
                var streets = [];
                for (var i=0; i<Math.min(docs.length, 5); i++) {
                    var json = '{"location":{"street": "' + docs[i].LIBELLE + 
                        '","city":"' + docs[i].COMMUNE + '","country":"FR"}}';
                    var qs = { key: 'PLRbAR4aEep1sfWbuGw9cXWBwwRAGBGa', inFormat: 'json', json: json };
                    var resp = syncRequest('GET', apiUrl, {qs:qs});
                    var respObj = JSON.parse(resp.getBody().toString());
                 
                    streets.push({ id: i, 
                        street: respObj.results[0].locations[0].street,
                        city: respObj.results[0].locations[0].adminArea5,
                        coord: respObj.results[0].locations[0].latLng
                    });
                }

                socket.emit('geoloc list', { streets: streets });
            }
            else {
                console.log(' !!! err mongodb : ' + err);
            }
        });
    });

    socket.on('reload_db', function (userAnswer) {
        console.log(' << reload db');
        readAQuestion();
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

    setTimeout(startQuizz, 30000);  
    timeoutQuizzStart = { start: Date.now(), delay: 30000 };
}

function startQuizz() {
    console.log(' >> start quizz');
    quizzStarted = true;
    io.sockets.emit('quizz started', {
        msg: 'Le quizz démarre !'
    });

    setTimeout(sendQuestion, 5000);
    
}

function sendQuestion() {
    console.log(' >> new question');
    io.sockets.emit('new question', { 
        question: questions[++currentQuestionId].question,
        timeleft: questionTime
    });

    setTimeout(processQuestionTimeout, 1000);
    questionTimeout = { start: Date.now(), delay: questionTime * 2000 };
}

function processQuestionTimeout() {
    var timeleft = getTimeLeft(questionTimeout);
    console.log(' * question timeleft : ' + timeleft);
    if (timeleft <= 0) { // No more time
        questionTimeout = undefined;
        var winners = processUserAnswers();
        console.log(' >> question answer');
        io.sockets.emit('question answer', {
             answer: questions[currentQuestionId].answer,
             winners: winners
        });

        if (currentQuestionId+1 === questions.length) {
            console.log(' >> end quizz');
            setTimeout(function () {
                io.sockets.emit('end quizz', users);
                reinitQuizz();
            }, 15000);
        }
        else {
            setTimeout(sendQuestion, 15000);
        }
    }
    else {
        var percent = 100 - (100 * (questionTime - timeleft) / questionTime); // Pfffffffffffffffff...
        console.log(' >> question timeleft');
        io.sockets.emit('question timeleft', { timeleft: timeleft, percent: percent , userAnswers: getUsersWithGoodAnswer() });
        setTimeout(processQuestionTimeout, 1000);

    }

}

function getUsersWithGoodAnswer() {
    var usersWithGoodAnswer = [];

    _.forEach(userAnswers, function (userAnswer) {
        if (userAnswer.answerId === questions[currentQuestionId].answer.id) {
            usersWithGoodAnswer.push(userAnswer.nickname);
        }
    });

    return usersWithGoodAnswer;    
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
    if (timeout) {
        var now = Date.now();
        var timeleft = Math.ceil((timeout.start + timeout.delay - now) / 2000);
        console.log(' * timeleft: ' + timeleft + ' sec');
        //return Math.ceil((timeout._idleStart + timeout._idleTimeout - Date.now()) / 1000);
        return timeleft;
    }
    return 0;
}

var findDocuments = function(db, callback) {
    // Get the documents collection
    var collection = db.collection('questions');
    // Find some documents
    collection.find({}).toArray(function(err, docs) {
        console.log(docs);
        questions = docs;
        callback(docs);
    });
}

function readAQuestion(){
    var MongoClient = require('mongodb').MongoClient;

    // Connection URL
    var url = 'mongodb://quizz:quizz@ds051943.mongolab.com:51943/quizz';
    // Use connect method to connect to the Server
    MongoClient.connect(url, function(err, db) {
        console.log("Connected correctly to server");


                    findDocuments(db, function() {
                        db.close();
                    });

    });

}
/* TODO

*/ 