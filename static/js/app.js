'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate','angular-flexslider']);

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


    $http.get('/image_model').
        then(function(response) {
            $scope.images = response.data;

            if($scope.images.length > 0){
            	$scope.curImage = $scope.images[0];

  		for(var i = 0; i < $scope.images.length; i++){
  		    $scope.images[i].rocks = [];
  		    for(var j = 0; j < $scope.images[i].colours.length; j++){
  			var rand = $scope.rocks[Math.floor(Math.random() * $scope.rocks.length)];
  			$scope.images[i].rocks.push(rand);
  		    }
  		}
            }
            console.log($scope.images);
        }
            );
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

    $scope.plot = function(data){

        // Seismic plotting
    };

    
    $scope.slideClick = function(slider){
    	$scope.curImage = $scope.images[slider.element.currentSlide];
    };

    $scope.update_data = function(){

        var mapping = $scope.mapping;
        var image = $scope.image;

        var earth_model = {mapping: mapping,
                           image: image,
                           z: $scope.z,
                           x: $scope.x,
                           theta:[0,3,6,9,12,15,18,21,24,27,30]};
        
        var seismic = {frequency: $scope.frequency,
                       wavelet: "ricker", dt: .001};

        var data = {seismic: seismic,
                    earth_model: earth_model};

        $http.post($scope.server + '/data.json', data).
            then(plot);
    };
    
    $scope.save_earthmodel = function(){

        var data = {mapping: $scope.mapping,
                    image_key: $scope.image.key,
                    z: $scope.z,
                    x: $scope.x,
                    theta:[0,3,6,9,12,15,18,21,24,27,30]};

        $http.post('/earth_model', data).
            then(function(response){
                // Notify the success;
            });
    };
});
