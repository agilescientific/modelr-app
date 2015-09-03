'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate']);
 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);