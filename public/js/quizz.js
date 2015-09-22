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

    $scope.connected = false;
    $scope.answer = false;
    $scope.nickname = 'anonymous_' + new Date().getTime();
    $scope.events = [];

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

    socket.on('new question', function (data) {
        console.log(' * new question event received : data=' + JSON.stringify(data));
        $scope.events.push({ name: 'new question', data: data });
    });

    socket.on('question answer', function (data) {
        console.log(' * question answer event received : data=' + JSON.stringify(data));
        $scope.events.push({ name: 'question answer', data: data });
    });

    socket.on('end quizz', function (data) {
        console.log(' * end quizz event received : data=' + JSON.stringify(data));
        $scope.events.push({ name: 'end quizz', data: data });
    });

    socket.on('question timeleft', function (data) {
        console.log(' * question timeleft event received : data=' + JSON.stringify(data));
        $scope.events.push({ name: 'question timeleft', data: data });
    });

    $scope.connect = function () {
        socket.emit('user connect', $scope.nickname);
        $scope.connected = true;
    };

    $scope.disconnect = function () {
        socket.emit('user disconnect', $scope.nickname);
        $scope.connected = false;
        $scope.events = [];
    };

    $scope.answer = function () {
        socket.emit('user answer', { answerId: 0, nickname: $scope.nickname });
    };
});
