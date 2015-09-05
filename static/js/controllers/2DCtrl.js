
app.controller('2DCtrl', function ($scope, $http) {

    $scope.zDomain = ['depth', 'time'];
    $scope.zAxisDomain = 'depth';
    $scope.zRange = 1000;
    $scope.server = 'http://localhost:8081';

    $scope.theta = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    $scope.popover = {
	title: "Models",
	content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
    };

    $http.get('/image_model?all').
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
    
    $scope.slideClick = function(slider){
    	$scope.curImage = $scope.images[slider.element.currentSlide];
    };

    //$scope.saveModel = function(){
    //	$scope.zRange;
   // 	$scope.earthModelName;
    //	$scope.zAxisDomain;
    //};

    $scope.updatePlot = function(){
        $scope.update_data();
    };

    $scope.update_data = function(){

        var image = $scope.curImage;
       
        var mapping = {};
        for( var i =0; i < image.rocks.length; i++){
            mapping[image.colours[i]] = image.rocks[i];
        }
        var earth_model = $scope.makeEarthModelStruct();
        
        var seismic = {frequency: 20.0,
                       wavelet: "ricker", dt: 0.001};

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
    	//$scope.result = true;
    	if(Math.abs(data.max) > Math.abs(data.min)){
    	    max = Math.abs(data.max);
    	} else {
    	    max = Math.abs(data.min);
    	}

    	var height = 300;
    	var width = $('.vd_plot').width();
    	console.log(width);
    	var vDPlot = g3.plot('.vd_plot')
	        .setHeight(height)
	        .setWidth(width - 30)
	        .toggleX2Axis(true)
	        .toggleY2Axis(true)
	        .setXTickFormat("")
	        .setY2TickFormat("")
	//.setX2TickFormat("")
	        .setMargin(10,10,20,20)
	       	.setXDomain([0, data.seismic.length])
	        .setYDomain([0, data.seismic[0].length])
	        .setX2Domain([0, data.seismic.length])
	        .setY2Domain([0, data.seismic[0].length])
	        .draw();

	// var vDLog = g3.wiggle(vDPlot, data.seismic[34])
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

	width = $('.og_plot').width();
	var wGPlot = g3.plot('.og_plot')
		.setHeight(height)
		.setWidth(width - 30)
		.toggleX2Axis(true)
		.toggleY2Axis(true)
		.setXTickFormat("")
		.setYTickFormat("")
		.setY2TickFormat("")
	//.setX2TickFormat("")
		.setMargin(10,10,20,20)
		.setXDomain([0, data.offset_gather.length])
		.setYDomain([0, data.offset_gather[0].length])
		.setX2Domain([0, data.offset_gather.length])
		.setY2Domain([0, data.offset_gather[0].length])
		.draw();

	var og = g3.seismic(wGPlot, data.offset_gather)
		.setMax(max)
		.setGain(100)
		.draw();

    	width = $('.wg_plot').width();
	wGPlot = g3.plot('.wg_plot')
		.setHeight(height)
		.setWidth(width - 30)
		.toggleX2Axis(true)
		.toggleY2Axis(true)
		.setXTickFormat("")
		.setYTickFormat("")
		.setY2TickFormat("")
	//.setX2TickFormat("")
		.setMargin(10,10,20,20)
		.setXDomain([0, data.wavelet_gather.length])
		.setYDomain([0, data.wavelet_gather[0].length])
		.setX2Domain([0, data.wavelet_gather.length])
		.setY2Domain([0, data.wavelet_gather[0].length])
		.draw();

	var wg = g3.seismic(wGPlot, data.wavelet_gather)
		.setMax(max)
		.setGain(100)
		.draw();

    };

    $scope.makeEarthModelStruct = function(){

        var image = $scope.curImage;
        var mapping = {};
        for( var i =0; i < image.rocks.length; i++){
            mapping[image.colours[i]] = image.rocks[i];
        }
        
        var data = {image: $scope.curImage.image,
                    mapping: mapping,
                    image_key: $scope.curImage.key,
                    zrange: $scope.zRange,
                    domain: $scope.zAxisDomain,
                    theta: $scope.theta,
                    name: $scope.earthModelName};
        return(data);
    };
    
    $scope.saveModel = function(){

       
        
        var data = $scope.makeEarthModelStruct();

        $http.post('/earth_model', data).
            then(function(response){
                $scope.curImage.earth_models.push(response.data);
            });
    };
});
