'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate']);
 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);

app.controller('2DCtrl', function ($scope, $http) {

	$scope.zDomain = ['depth', 'time'];
	$scope.zAxisDomain = 'depth';

	$scope.popover = {
		title: "Models",
		content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
	};

    // check for saved earth models
    $http.get('/earth_model?all').
        then(function(response) {
            $scope.earthModels = response.data;
            console.log(response.data);
            //console.log($scope.earthModels);
        });
    
    // populate the rocks
    $http.get('/rock?all').
        then(function(response) {
            // this callback will be called asynchronously
            // when the response is available
            $scope.rocks = response.data;
            console.log($scope.rocks);
        });
    
    $scope.test = function(model){

    };
});
