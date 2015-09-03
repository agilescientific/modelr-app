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

	$scope.model1 = {title: "Model 1", color: "#fef", data:[
		{ rock:'rock1', color: "#fef" }, 
		{ rock: 'rock2', color: "#fae" }, 
		{ rock: 'rock3', color: "#00f" }]};

	$scope.model2 = {title: "Model 2", data:[
		{ rock:'rock1', color: "#fef" }]};

	$scope.earthModels = [$scope.model1, $scope.model2];
    $scope.popover = {
	title: "Models",
	content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
    };

    // check for saved earth models
    // $http.get('/earth_model?all').
    //     then(function(response) {

    //         var em = response.data;
    //         $scope.earthModels = em;
    //     });
    
    // populate the rocks
    $http.get('/rock?all').
        then(function(response) {
            // this callback will be called asynchronously
            // when the response is available
            var rocks = response.data;
            $scope.rocks = rocks;
        });
             
    console.log($scope.earthModels);
    
    $scope.test = function(model){

    };
});
