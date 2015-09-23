/*$(function() {

var socket = io();

$('#connect').submit(function() {
    socket.emit('user connect', $('#nickname').val());
    $('#connectionPart').hide();
    $('#quizzPart').show();
    return false;
});

socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
});

});*/


var quizzApp = angular.module('quizzApp', ['ngRoute']);

quizzApp.factory('socket', ['$rootScope', function ($rootScope) {
    var socket = io.connect();

    return {
        on: function (eventName, callback) {
            function wrapper() {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            }

            socket.on(eventName, wrapper);

            return function () {
                socket.removeListener(eventName, wrapper);
            }
        },

        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            })
        }
    }
}]);

quizzApp.config(['$routeProvider', function($routeProvider){
    $routeProvider
        .when('/', {
            templateUrl : '/',
            controller : 'quizzController'
        })
}]);

quizzApp.controller('quizzController', function($scope, socket) {

    $scope.reinit_state = function(msg){
        $scope.state = {login_in : true, waiting_quizz : false, question : false, answer_question : false, end_question : false, end_quiz : false};
        console.log(msg);
    }

    $scope.reinit_state("Init controller");

    $scope.nickname;
    $scope.answer = "";
    $scope.question = {};
    $scope.userAnswers = [];
    $scope.answerId = -1;
    $scope.goodAnswerId = -1;
    $scope.winner;

    //$scope.progress = 0;

    //Unused in UI for the moment
    $scope.message;
    $scope.waitMessage;

    //Connexion button
    $scope.connect = function () {
        socket.emit('user connect', $scope.nickname);
        //Switching screens
        $scope.state.login_in = false
        $scope.state.waiting_quizz = true;
    };

    //Waiting for new question
    socket.on('new question', function (data) {
        $scope.events.push({ name: 'new question', data: data });
        if($scope.state.waiting_quizz || $scope.state.end_question || $scope.state.end_quiz) {
            console.log('Showing question ' + JSON.stringify(data));
            $scope.goodAnswerId = -1;
            $scope.answerId = -1;

            //Hidding answers
            $scope.answer = decodeURIComponent(data.question.wikipediaUrl);

            $scope.intitule = '';
            var wordsToRemove = data.question.removeTerms;
            $scope.question = data.question;
            for (var i=0; i<wordsToRemove.length; i++) {
                var re = new RegExp(wordsToRemove[i], 'gi');
                $scope.question.intitule = $scope.question.intitule.replace(re,"xxxxx");;
            }

            $scope.intitule = $scope.question.intitule;


            $scope.userAnswers = [];
            //Update progress bar
            $scope.update_time_left(100);

            //Updating the page status
            $scope.state.waiting_quizz = false;
            $scope.state.question = true;
            $scope.state.answer_question =false;
            $scope.state.end_question=false;
            data.searchName = "";
            $scope.streets = [];
        }else{
            console.log("new question was not expected");
        }
    });

    //Heler function for progress bar
    $scope.update_time_left = function(pct){
        console.log('uppdating status bar '+pct);
        var progress_element = document.querySelector('#p3');
        progress_element.addEventListener('mdl-componentupgraded', function () {
            this.MaterialProgress.setProgress(pct);
            this.MaterialProgress.setBuffer(100);
        });
        progress_element.MaterialProgress.setProgress(pct);
    }

    //Listening to update progress bar
    socket.on('question timeleft', function (data) {
        $scope.events.push({ name: 'question timeleft', data: data });
        if($scope.state.question || $scope.state.answer_question) {
            console.log('Updating timeleft and winners  ' + JSON.stringify(data));
            $scope.userAnswers = data.userAnswers;
            $scope.update_time_left(data.percent);
        }else{
            console.log('question timeleft was not expected');
        }
    });

    //Clicking on anwser
    $scope.user_answer = function (id) {
        if($scope.state.answer_question){
            console.log('already answer');
        }else{
            console.log('answering ' + id);
            socket.emit('user answer', { answerId: id, nickname: $scope.nickname });
            //Ask user to wait
            //Save answer
            $scope.answerId = id;
            //TODO Desactivate answares
            $scope.state.question = false;
            $scope.state.answer_question = true;

        }
    };

    //Listening to end the question
    socket.on('question answer', function (data) {
        $scope.events.push({ name: 'question answer', data: data });
        if($scope.state.question || $scope.state.answer_question) {
            console.log('Question is over ' + JSON.stringify(data));
            $scope.update_time_left(0);
            $scope.goodAnswerId = data.answer.id;
            $scope.state.question = false;
            $scope.state.end_question = true;
            $scope.state.answer_question = false;
            $scope.answers = data.answers;
            $scope.userAnswers = [];
            angular.forEach(data.winners, function (user, key) {
                $scope.userAnswers.push(user.nickname);
            });
            $scope.searchName = $scope.question.answers[$scope.goodAnswerId];
            $scope.geoloc_test();

        }else{
            console.log('question answer was not expected');
        }
    });

    //Listening to end of quizz
    socket.on('end quizz', function (data) {
        console.log(' * end quizz event received : data=' + JSON.stringify(data));
        if($scope.state.end_question) {
            console.log('Quizz is over ' + JSON.stringify(data));
            //TODO Extract winner
            $scope.state.end_quiz = true;
            $scope.state.end_question = false;
            $scope.state.answer_question = false;
            var maxScore = -1;
            angular.forEach(data, function (user, key) {
                if(user.score > maxScore){
                    maxScore = user.score;
                    $scope.winner = user;
                }
            });


        }else{
            console.log('end quizz was not expected');
        }
    });

    $scope.disconnect = function () {
        socket.emit('user disconnect', $scope.nickname);
        $scope.events = [];
        $scope.reinit_state('disconnect');

    };


    //Non managed methods
    $scope.events = [];
    $scope.searchName = "";
    $scope.streets = [];
    $scope.visibleStreetView=-1;

    $scope.connect_test = function () {
        $scope.nickname = 'anonymous_' + Date.now();
        socket.emit('user connect', $scope.nickname);
    };

    $scope.disconnect_test = function () {
        socket.emit('user disconnect', $scope.nickname);
        $scope.events = [];
    };

    $scope.answer_test = function () {
        socket.emit('user answer', { answerId: 0, nickname: $scope.nickname });
    };

    $scope.play_test = function () {
        socket.emit('play quizz');
    };
    $scope.reload_db = function () {
        socket.emit('reload_db');
    }

    $scope.geoloc_test = function () {
        socket.emit('geoloc', { searchName: $scope.searchName });
    };
    
    socket.on('geoloc list', function (data) {
        console.log(' +-+ geoloc list : data=' + JSON.stringify(data));
        $scope.visibleStreetView=-1;
        $scope.streets = data.streets;
        $scope.setVisibleStreetView(0);
    });

    $scope.setVisibleStreetView = function (id) {
        $scope.visibleStreetView = id;
    };

    $scope.getStreetView = function (coord) {
        return 'https://maps.googleapis.com/maps/api/streetview?size=600x300&location=' 
            + coord.lat + ',' + coord.lng + '&heading=151.78&pitch=-0.76&key=AIzaSyDkkzT98LmL4Xx9sXcHLpn6GbDFDMcSMGQ';
    };

    socket.on('quizz started', function (data) {
        console.log(' * quizz started event received : data=' + JSON.stringify(data));
        $scope.message = data.msg;
        $scope.waitMessage = undefined;
        $scope.events.push({ name: 'quizz started', data: data });
        $scope.state = {login_in : false, waiting_quizz : true, question : false, answer_question : false, end_question : false, end_quiz : false};
    });

    socket.on('quizz not started', function (data) {
        console.log(' * quizz not started event received : data=' + JSON.stringify(data));
        $scope.waitMessage = data.msg;
        $scope.events.push({ name: 'quizz not started', data: data });
    });

    socket.on('user list', function (data) {
        console.log(' * user list event received : data=' + JSON.stringify(data));
        $scope.events.push({ name: 'user list', data: data });
    });
    
});
