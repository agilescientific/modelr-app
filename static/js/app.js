'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate','angular-flexslider']);
 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);

app.controller('2DCtrl', function ($scope, $http) {

    $scope.zDomain = ['depth', 'time'];
    $scope.zAxisDomain = 'depth';

    $scope.server = 'http://localhost:8081'

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

        $scope.update_data();
    };

    $scope.update_data = function(){

        var image = $scope.curImage;
        var mapping = {};
        for( var i =0; i < image.rocks.length; i++){
            mapping[image.colours[i]] = image.rocks[i];
        };
        
        var earth_model = {mapping: mapping,
                           image: image.image,
                           z: 100.0,
                           x: 1000.0,
                           theta:[0]};
        
        var seismic = {frequency: 20.0,
                       wavelet: "ricker", dt: .001};

        var payload = JSON.stringify({earth_model: earth_model,
                                      seismic: seismic});

        var data = {seismic: seismic,
                    earth_model: earth_model};

        $http.get($scope.server + '/data.json?type=seismic&script=convolution_model.py&payload=' + payload).
            then(function(response){
            	$scope.seismic = response.data;
            	$scope.plot(response.data);
            });
    };

    $scope.plot = function(data){
    	console.log(data);
    	var max;
    	
    	if(Math.abs(data.max) > Math.abs(data.min)){
    		max = Math.abs(data.max);
    	} else {
    		max = Math.abs(data.min);
    	}

    	var height = 300;
    	var width = 200;
    	var vDPlot = g3.plot('.seis_plot')
	        .setHeight(height)
	        .setWidth(width)
	        .toggleX2Axis(true)
	        .toggleY2Axis(true)
	        .setXTickFormat("")
	        .setY2TickFormat("")
	        .setX2TickFormat("")
	        .setMargin(50,50,50,50)
	        //.toggleYAxis(false)
	       	.setXDomain([0, data.seismic.length])
	        .setYDomain([0, data.seismic[0].length])
	        .setX2Domain([0, data.seismic.length])
	        .setY2Domain([0, data.seismic[0].length])
	        .draw();

	    // var vDLog = g3.wiggle(vDPlot, data.seismic)
	    //     //.setYInt(data.dt)
	    //     //.setXInt(data.dx)
	    //     //.setSampleRate(1)
	    //     //.setSkip(10)
	    //     .setGain(50)
	    //     .draw();

	    var seismic = g3.seismic(vDPlot, data.seismic)
	    	.setMax(max)
	    	.setGain(100)
	    	.draw();
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
