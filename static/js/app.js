'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate','angular-flexslider']);

 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);


app.controller('2DCtrl', function ($scope, $http, $alert) {

    function getMax(a, b){
      if(Math.abs(a) > Math.abs(b)){
        return Math.abs(a);
      } else {
        return Math.abs(b);
      }
    };


    function getCrossSection(data, slice){
      var arr = [];
      console.log(data.length);
      for(var i = 0; i < data.length; i++){
        arr.push(data[i][slice]);
      }
      return arr;
    }

    $scope.zDomain = ['depth','time'];
    $scope.zAxisDomain = 'depth';
    $scope.zRange = 1000;

    // TODO update from mouse over on seismic plots
    $scope.trace = 10;
    $scope.traceStr = "10";
    $scope.offset = 3;
    $scope.offsetStr = "3";
    $scope.twt = 30;
    $scope.twtStr = "30";

    // TODO get from app before so we get the prod url
    $scope.server = 'http://localhost:8081';

    $scope.theta = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    $scope.popover = {
	   title: "Models",
	   content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
    };

    $http.get('/image_model?all')
      .then(function(response) {
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
      }
    );
    
    // populate the rocks
    $http.get('/rock?all').
        then(function(response) {
            // this callback will be called asynchronously
            // when the response is available
            $scope.rocks = response.data;
        });

    $scope.loadSaved = function(){
      var array = $.map($scope.savedEarthModel.mapping, function(value, index) {
        return [value];
      });

      $scope.curImage.rocks = [];
      for(var i = 0; i < array.length; i++){
        $scope.curImage.rocks.push(array[i]);
      }
    }

    $scope.changeRock = function(){
      //console.log($scope.curImage);
    };
    
    $scope.slideClick = function(slider){
    	$scope.curImage = $scope.images[slider.element.currentSlide];
    };

    $scope.updatePlot = function(){
        $scope.update_data();
    };

    $scope.update_data = function(){

      var earth_model = $scope.makeEarthModelStruct();
        
      var seismic = {
        frequency: 20.0,
        wavelet: "ricker", dt: 0.001
      };

      var data = {
        seismic: seismic,
        earth_model: earth_model,
        trace: $scope.trace,
        offset: $scope.offset
      };

      var payload = JSON.stringify(data);
        $http.get($scope.server + '/data.json?type=seismic&script=convolution_model.py&payload=' + payload)
        .then(function(response){
          $scope.plot(response.data);
          $scope.maxTrace = String(response.data.seismic.length);
          $scope.maxTWT = String(response.data.seismic[0].length);
          $scope.maxOffset = String(response.data.offset_gather.length);
          $scope.updateClicked = true;
        });
    };

    $scope.changeTraceStr = function(){
      $scope.trace = Number($scope.traceStr);
      var arr = [$scope.data.seismic[$scope.trace]];
      $scope.vDLog
        .setXMin($scope.trace)
        .reDraw(
          arr, 
          [1, $scope.data.seismic.length], 
          [1, $scope.data.seismic[0].length]
        );
      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);

      $scope.aTHor
        .reDraw(aTArr);
    };

    $scope.changeTraceNum = function(){
      $scope.traceStr = String($scope.trace);
      var arr = [$scope.data.seismic[$scope.trace]];
      $scope.vDLog
        .setXMin($scope.trace)
        .reDraw(
          arr, 
          [1, $scope.data.seismic.length], 
          [1, $scope.data.seismic[0].length]
        );
      
      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);

      $scope.aTHor
        .reDraw(aTArr);
    }
    $scope.changeTWTStr = function(){

      $scope.twt = Number($scope.twtStr);

      // Update Horizons
      var yScale = $scope.vDPlot.yScale;
      $scope.vDHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      yScale = $scope.oGPlot.yScale;
      $scope.oGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      yScale = $scope.wGPlot.yScale;
      $scope.wGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);
      $scope.aTHor
        .reDraw(aTArr);

      var aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
      console.log(aOArr);
      $scope.aOHor
        .reDraw(aOArr);
    };

    $scope.changeTWTNum = function(){
      $scope.twtStr = String($scope.twt);

      // Update Horizons
      var yScale = $scope.vDPlot.yScale;
      $scope.vDHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      yScale = $scope.oGPlot.yScale;
      $scope.oGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      yScale = $scope.wGPlot.yScale;
      $scope.wGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));

      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);
      $scope.aTHor
        .reDraw(aTArr);

      var aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
      $scope.aOHor
        .reDraw(aOArr);
    }
    $scope.changeGainStr = function(){
      $scope.gain = Number($scope.gainStr);
    };
    $scope.changeGainNum = function(){
      $scope.gainStr = String($scope.gain);
    }
    $scope.changeOffsetStr = function(){
      $scope.offset = Number($scope.offsetStr);
      var arr = [$scope.data.offset_gather[$scope.offset]];
      $scope.oGLog
        .setXMin($scope.offset)
        .reDraw(
          arr, 
          [1, $scope.data.offset_gather.length], 
          [1, $scope.data.offset_gather[0].length]
        );
    };
    $scope.changeOffsetNum = function(){
      $scope.offsetStr = String($scope.offset);
      $scope.oGLog
        .setXMin($scope.offset)
        .reDraw(
          arr, 
          [1, $scope.data.offset_gather.length], 
          [1, $scope.data.offset_gather[0].length]
        );
    }

    $scope.plot = function(data){

      $scope.data = data;
    	var max;
    	if(Math.abs(data.max) > Math.abs(data.min)){
        max = Math.abs(data.max);
    	} else {
        max = Math.abs(data.min);
    	}

    	var height = 300;
    	var width = $('.vd_plot').width();

      // Variable Density Plot
      if(!$scope.vDPlot){
      	$scope.vDPlot = g3.plot('.vd_plot')
          .setHeight(height)
          .setXTitle("spatial cross-section")
          .setYTitle("time [ms]")
          .setWidth(width - 30)
          .toggleX2Axis(true)
          .toggleY2Axis(true)
          .setXTickFormat("")
          .setX2TickFormat("")
          .setY2TickFormat("")
          .setDuration(5)
          .setMargin(30,10,5,40)
         	.setXDomain([1, data.seismic.length])
          .setYDomain([1, data.seismic[0].length])
          .setX2Domain([1, data.seismic.length])
          .setY2Domain([1, data.seismic[0].length])
          .draw();
      } else {
        $scope.vDPlot.reDraw(
          [1, data.seismic.length], 
          [1, data.seismic[0].length], 
          [1, data.seismic.length], 
          [1, data.seismic[0].length]
        );
      }

      // Draw Seismic Image
      if(!$scope.seis){
      	$scope.seis = g3.seismic($scope.vDPlot, data.seismic)
  	    	.setMax(max)
  	    	.setGain(1)
  	    	.draw();
      } else {
        $scope.seis.reDraw(data.seismic);
      }

      // Offset Gather Plot
    	width = $('.og_plot').width();
      if(!$scope.oGPlot){
      	$scope.oGPlot = g3.plot('.og_plot')
      		.setHeight(height)
      		.setWidth(width - 30)
          .setDuration(5)
          .setXTitle("angle gather")
      		.toggleX2Axis(true)
          .setX2Ticks(6)
      		.toggleY2Axis(true)
      		.setXTickFormat("")
          .setX2TickFormat("")
      		.setYTickFormat("")
      		.setY2TickFormat("")
      		.setMargin(30,10,5,30)
      		.setXDomain([1, data.offset_gather.length])
      		.setYDomain([1, data.offset_gather[0].length])
      		.setX2Domain([1, data.offset_gather.length])
      		.setY2Domain([1, data.offset_gather[0].length])
      		.draw();
      } else {
        $scope.oGPlot.reDraw(
          [1, data.offset_gather.length], 
          [1, data.offset_gather[0].length], 
          [1, data.offset_gather.length], 
          [1, data.offset_gather[0].length]
        );
      }

      // Draw Offset Gather Image
      if(!$scope.og){
      	$scope.og = g3.seismic($scope.oGPlot, data.offset_gather)
      		.setMax(max)
      		.setGain(100)
      		.draw();
      } else {
        $scope.og.reDraw(data.offset_gather);
      }

      // Wavelet Gather Plot
      width = $('.wg_plot').width();
      if(!$scope.wGPlot){
      	$scope.wGPlot = g3.plot('.wg_plot')
      		.setHeight(height)
      		.setWidth(width - 30)
          .setDuration(5)
          .setXTitle("wavelet gather")
      		.toggleX2Axis(true)
          .setX2Ticks(6)
      		.toggleY2Axis(true)
      		.setXTickFormat("")
          .setX2TickFormat("")
      		.setYTickFormat("")
      		.setY2TickFormat("")
      		.setMargin(30,10,5,20)
      		.setXDomain([1, data.wavelet_gather.length])
      		.setYDomain([1, data.wavelet_gather[0].length])
      		.setX2Domain([1, data.wavelet_gather.length])
      		.setY2Domain([1, data.wavelet_gather[0].length])
      		.draw();
      } else {
        $scope.wGPlot.reDraw(
          [1, data.wavelet_gather.length], 
          [1, data.wavelet_gather[0].length], 
          [1, data.wavelet_gather.length], 
          [1, data.wavelet_gather[0].length]
        );
      }

      // Draw Wavelet Gather Image
      if(!$scope.wg){
      	$scope.wg = g3.seismic($scope.wGPlot, data.wavelet_gather)
      		.setMax(max)
      		.setGain(100)
      		.draw();
      } else {
        $scope.wg.reDraw(data.wavelet_gather);
      }

      // Amplitude Trace
      width = $('.at_plot').width();
      height = 100;

      if(!$scope.aTPlot){
        $scope.aTPlot = g3.plot('.at_plot')
          .setHeight(height)
          .setYTitle("amplitude")
          .setDuration(5)
          .setWidth(width - 30)
          .setYTicks(6)
          .toggleX2Axis(true)
          .toggleY2Axis(true)
          .setXTickFormat("")
          .setY2TickFormat("")
          .setMargin(5,10,40,40)
          .setXDomain([1, $scope.data.seismic.length])
          .setYDomain([1, -1])
          .setX2Domain([1, $scope.data.seismic.length])
          .setY2Domain([1, -1])
          .draw();
      }

      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);
      if(!$scope.aTHor){
        $scope.aTHor = g3.horizon($scope.aTPlot, aTArr)
          .setDuration(5)
          .draw();
      } else {
        $scope.aTHor.reDraw(aTArr);
      }

      // Amplitude Offset Plot
      width = $('.ao_plot').width();
      if(!$scope.aOPlot){
        $scope.aOPlot = g3.plot('.ao_plot')
          .setHeight(height)
          .setWidth(width - 30)
          .setDuration(5)
          .toggleX2Axis(true)
          .setX2Ticks(6)
          .toggleY2Axis(true)
          .setXTickFormat("")
          .setYTickFormat("")
          .setY2TickFormat("")
          .setMargin(5,10,40,30)
          .setXDomain([1, data.offset_gather.length])
          .setYDomain([1, -1])
          .setX2Domain([1, data.offset_gather.length])
          .setY2Domain([1, -1])
          .draw();
      } 

      //console.log($scope.data.offset_gather);
      var aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
      //console.log(aOArr);
      if(!$scope.aOHor){
        $scope.aOHor = g3.horizon($scope.aOPlot, aOArr)
          .setDuration(5)
          .draw();
      } else {
        $scope.aOHor.reDraw(aOArr);
      }

      // Amplitude Freq Plot
      width = $('.af_plot').width();
      if(!$scope.aFPlot){
        $scope.aFPlot = g3.plot('.af_plot')
          .setHeight(height)
          .setWidth(width - 30)
          .setDuration(5)
          .toggleX2Axis(true)
          .setX2Ticks(6)
          .toggleY2Axis(true)
          .setXTickFormat("")
          .setYTickFormat("")
          .setY2TickFormat("")
          .setMargin(5,10,40,20)
          .setXDomain([1, data.wavelet_gather.length])
          .setYDomain([1, data.wavelet_gather[0].length])
          .setX2Domain([1, data.wavelet_gather.length])
          .setY2Domain([1, data.wavelet_gather[0].length])
          .draw();
      }

      // Draw VD Plot Wiggle
      var arr = [data.seismic[$scope.trace]];
      if(!$scope.vDLog){
        $scope.vDLog = g3.wiggle($scope.vDPlot, arr)
          .setXMin($scope.trace)
          .setGain(100)
          .setDuration(5)
          .draw();
      } else {
        $scope.vDLog
          .setXMin($scope.trace)
          .reDraw(
            arr, 
            [1, data.seismic.length], 
            [1, data.seismic[0].length]
          );
      }

      // Draw VD Horizon
      var xScale = $scope.vDPlot.xScale;
      var yScale = $scope.vDPlot.yScale;

      if(!$scope.vDHor){
        $scope.vDHor = $scope.vDPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(1))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.seismic.length))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.vDHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }

      // Draw Offset Wiggle
      var arr = [data.offset_gather[$scope.offset]];
      if(!$scope.oGLog){
        $scope.oGLog = g3.wiggle($scope.oGPlot, arr)
          .setXMin($scope.offset)
          .setGain(8)
          .setDuration(5)
          .draw();
      } else {
        $scope.oGLog
          .setXMin($scope.offset)
          .reDraw(
            arr, 
            [1, data.offset_gather.length], 
            [1, data.offset_gather[0].length]
          );
      }

      // Draw Offset Horizon
      xScale = $scope.oGPlot.xScale;
      yScale = $scope.oGPlot.yScale;
      if(!$scope.oGHor){
        $scope.oGHor = $scope.oGPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(1))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.offset_gather.length))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.oGHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }

      // Draw Wavelet Horizon
      xScale = $scope.wGPlot.xScale;
      yScale = $scope.wGPlot.yScale;
      if(!$scope.wGHor){
        $scope.wGHor = $scope.wGPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(1))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.wavelet_gather.length))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.wGHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }
    };

    $scope.makeEarthModelStruct = function(){
      var image = $scope.curImage;
      var mapping = {};
      for(var i=0; i < image.rocks.length; i++){
          mapping[image.colours[i]] = image.rocks[i];
      }
      
      var data = {
        image: $scope.curImage.image,
        mapping: mapping,
        image_key: $scope.curImage.key,
        zrange: $scope.zRange,
        domain: $scope.zAxisDomain,
        theta: $scope.theta,
        name: $scope.earthModelName
      };

      return(data);
    };
    
    $scope.saveModel = function(){
      var data = $scope.makeEarthModelStruct();
      $http.post('/earth_model', data)
        .then(function(response){
          $scope.curImage.earth_models.push(response.data);
          $scope.zAxisDomain = 'depth';
          $scope.zRange = 1000;

          var myAlert = $alert({
            title: 'Success:',
            content: 'You have saved your model \'' + $scope.earthModelName + '\'.',
            placement: 'alert-success',
            type: 'success',
            duration: 5,
            show: true
          });
          $scope.earthModelName = "";
      });
    };
});
