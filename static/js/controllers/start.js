'use strict';
var app = angular.module('modelr', 
	['mgcrea.ngStrap', 
	'ngAnimate',
	'angular-flexslider']);

app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);

app.directive('jqColorpicker', function(){
  var linkFn = function(scope,element,attrs){
    element.colorpicker().on('changeColor.colorpicker', function(event){
      var child = d3.select(scope.top[0][0].childNodes[0]);
      var parentClass = d3.select(scope.top[0][0]).attr('class');
      scope.$parent.pathColors[parentClass] = event.color.toHex();
      child.style('fill', event.color.toHex());
      $(event.currentTarget).css('background-color', event.color.toHex());
    });
  }

  return {
      restrict:'A',
      link: linkFn
  }
});