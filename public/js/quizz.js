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


    socket.on('quizz started', function (data) {
        console.log('quizz started event received : data=' + JSON.stringify(data));
        $scope.message = data.msg;
        $scope.waitMessage = undefined;
    });  

    socket.on('quizz not started', function (data) {
        console.log('quizz not started event received : data=' + JSON.stringify(data));
        $scope.waitMessage = data.msg;
    });  

    $scope.connect = function () {
        socket.emit('user connect', $scope.nickname);
        $scope.connected = true;
    };

    $scope.disconnect = function () {
        socket.emit('user disconnect', $scope.nickname);
        $scope.connected = false;
    };
    
});
