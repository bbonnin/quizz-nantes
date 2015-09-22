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
        console.log(msg)
    }

    $scope.reinit_state("Init controller");
    $scope.message;
    $scope.waitMessage;
    $scope.nickname;
    $scope.question = {};
    $scope.answers;
    $scope.winners;
    $scope.progress = 0;

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
            $scope.question = data.question;
            $scope.update_time_left(0);
            $scope.state.waiting_quizz = false;
            $scope.state.question = true;
        }else{
            $scope.reinit_state("new question was not expected");
        }
    });


    $scope.update_time_left = function(pct){
        console.log('uppdating status bar '+pct);
        var progress_element = document.querySelector('#p3');
        progress_element.addEventListener('mdl-componentupgraded', function () {
            this.MaterialProgress.setProgress(pct);
            this.MaterialProgress.setBuffer(100);
        });
        progress_element.MaterialProgress.setProgress(70);
    }
    //Listening to update progress bar
    socket.on('question timeleft', function (data) {
        $scope.events.push({ name: 'question timeleft', data: data });
        if($scope.state.question) {
            console.log('Updating timeleft and winners  ' + JSON.stringify(data));
            //TODO Manage the winners
            //$scope.update_time_left(data.timeleft);
            //TODO Set a real timeleft
            $scope.update_time_left(50);
        }else{
            console.log('question timeleft was not expected');
        }
    });

    //Clicking on anwser
    $scope.user_answer = function () {
        if($scope.state.answer_question){
            console.log('already answer');
        }else{
            socket.emit('user answer', { answerId: 0, nickname: $scope.nickname });
            //Ask user to wait
            //TODO Desactivate answares
            $scope.state.answer_question = true;
        }
    };

    //Listening to end the question
    socket.on('question answer', function (data) {
        $scope.events.push({ name: 'question answer', data: data });
        if($scope.state.question) {
            console.log('Question is over ' + JSON.stringify(data));
            $scope.state.question = false;
            $scope.state.end_question = true;
            $scope.answers = data.answers;
            $scope.winners = data.winners;
        }else{
            $scope.reinit_state('question answer was not expected');
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

        }else{
            $scope.reinit_state('end quizz was not expected');
        }
    });

    $scope.disconnect = function () {
        socket.emit('user disconnect', $scope.nickname);
        $scope.events = [];
        $scope.reinit_state('user disconnect');
    };


    //Non managed methods
    $scope.events = [];

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

    socket.on('quizz started', function (data) {
        console.log(' * quizz started event received : data=' + JSON.stringify(data));
        $scope.message = data.msg;
        $scope.waitMessage = undefined;
        $scope.events.push({ name: 'quizz started', data: data });
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

/*
 socket.on('quizz started', function (data) {
 console.log('quizz started event received : data=' + JSON.stringify(data));
 $scope.message = data.msg;
 $scope.waitMessage = undefined;
 });

 socket.on('quizz not started', function (data) {
 console.log('quizz not started event received : data=' + JSON.stringify(data));
 $scope.waitMessage = data.msg;
 });
 */