'use strict';
var app = angular.module('modelr', ['mgcrea.ngStrap', 'ngAnimate','angular-flexslider']);

 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);


app.controller('2DCtrl', function ($scope, $http, $alert) {

    $scope.setDefaults = function(){
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
      $scope.gain = 1;
      $scope.gainStr = "1";
      $scope.maxGain = "10";

      // TODO get from app before so we get the prod url
      $scope.server = 'http://localhost:8081';

      $scope.theta = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
      $scope.popover = {
       title: "Models",
       content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
      };
    };

    $scope.fetchImageModels = function(){
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
    };
    
    $scope.fetchRocks = function(){
      $http.get('/rock?all').
        then(function(response) {
            $scope.rocks = response.data;
        }
      );
    };

    $scope.loadSaved = function(){
      var array = $.map($scope.savedEarthModel.mapping, function(value, index) {
        return [value];
      });

      $scope.curImage.rocks = [];
      for(var i = 0; i < array.length; i++){
        $scope.curImage.rocks.push(array[i]);
      }
    };
    
    $scope.slideClick = function(slider){
    	$scope.curImage = $scope.images[slider.element.currentSlide];
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
            $scope.maxTrace = String(response.data.seismic.length - 1);
            $scope.maxTWT = String(response.data.seismic[0].length - 1);
            $scope.maxOffset = String(response.data.offset_gather.length - 1);
            $scope.updateClicked = true;
          }
        );
    };

    $scope.changeTraceStr = function(){
      $scope.trace = Number($scope.traceStr);
      var arr = [$scope.data.seismic[$scope.trace]];
      $scope.vDLog
        .setXMin($scope.trace)
        .reDraw(
          arr, 
          [0, $scope.data.seismic.length - 1], 
          [0, $scope.data.seismic[0].length - 1]
        );
      var aTArr = getCrossSection($scope.data.seismic, $scope.twt);

      $scope.aTHor
        .reDraw(aTArr);
    };

    $scope.changeTWTStr = function(){
      $scope.twt = Number($scope.twtStr);
      $scope.updateTWT();
    };

    $scope.updateTWT = function(){
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
        .setGain($scope.gain)
        .reDraw(aTArr);

      var aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
      $scope.aOHor
        .setGain($scope.gain)
        .reDraw(aOArr);
    };

    $scope.changeGainStr = function(){
      $scope.gain = Number($scope.gainStr);
      $scope.updateTWT();
    };

    $scope.changeOffsetStr = function(){
      $scope.offset = Number($scope.offsetStr);
      var arr = [$scope.data.offset_gather[$scope.offset]];
      $scope.oGLog
        .setXMin($scope.offset)
        .reDraw(
          arr, 
          [0, $scope.data.offset_gather.length - 1], 
          [0, $scope.data.offset_gather[0].length - 1]
        );
    };

    $scope.plotSeismic = function(data, height, max){
      // Variable Density Plot
      var width = $('.vd_plot').width();
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
          .setXDomain([0, data.seismic.length - 1])
          .setYDomain([0, data.seismic[0].length - 1])
          .setX2Domain([0, data.seismic.length - 1])
          .setY2Domain([0, data.seismic[0].length - 1])
          .draw();
      } else {
        $scope.vDPlot.reDraw(
          [0, data.seismic.length - 1], 
          [0, data.seismic[0].length - 1], 
          [0, data.seismic.length - 1], 
          [0, data.seismic[0].length - 1]
        );
      }

      // Draw Seismic Image
      if(!$scope.seis){
        $scope.seis = g3.seismic($scope.vDPlot, data.seismic)
          .setMax(max)
          .setGain($scope.gain)
          .draw();
      } else {
        $scope.seis
          .setGain($scope.gain)
          .reDraw(data.seismic);
      }
    };

    $scope.plotOffset = function(data, height, max){
      // Offset Gather Plot
      var width = $('.og_plot').width();
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
          .setXDomain([0, data.offset_gather.length - 1])
          .setYDomain([0, data.offset_gather[0].length - 1])
          .setX2Domain([0, data.offset_gather.length - 1])
          .setY2Domain([0, data.offset_gather[0].length - 1])
          .draw();
      } else {
        $scope.oGPlot.reDraw(
          [0, data.offset_gather.length - 1], 
          [0, data.offset_gather[0].length - 1], 
          [0, data.offset_gather.length - 1], 
          [0, data.offset_gather[0].length - 1]
        );
      }

      // Draw Offset Gather Image
      if(!$scope.og){
        $scope.og = g3.seismic($scope.oGPlot, data.offset_gather)
          .setMax(max)
          .setGain($scope.gain)
          .draw();
      } else {
        $scope.og
          .setGain($scope.gain)
          .reDraw(data.offset_gather);
      }
    };

    $scope.plotWavelet = function(data, height, max){
      // Wavelet Gather Plot
      var width = $('.wg_plot').width();
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
          .setXDomain([0, data.wavelet_gather.length - 1])
          .setYDomain([0, data.wavelet_gather[0].length - 1])
          .setX2Domain([0, data.wavelet_gather.length - 1])
          .setY2Domain([0, data.wavelet_gather[0].length - 1])
          .draw();
      } else {
        $scope.wGPlot.reDraw(
          [0, data.wavelet_gather.length - 1], 
          [0, data.wavelet_gather[0].length - 1], 
          [0, data.wavelet_gather.length - 1], 
          [0, data.wavelet_gather[0].length - 1]
        );
      }

      // Draw Wavelet Gather Image
      if(!$scope.wg){
        $scope.wg = g3.seismic($scope.wGPlot, data.wavelet_gather)
          .setMax(max)
          .setGain($scope.gain)
          .draw();
      } else {
        $scope.wg
          .setGain($scope.gain)
          .reDraw(data.wavelet_gather);
      }
    };

    $scope.plotAmplitudeTrace = function(data, height){
      // Amplitude Trace
      var width = $('.at_plot').width();

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
          .setXDomain([0, $scope.data.seismic.length - 1])
          .setYDomain([1, -1])
          .setX2Domain([0, $scope.data.seismic.length - 1])
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
    };

    $scope.plotAmplitudeOffset = function(data, height){
      // Amplitude Offset Plot
      var width = $('.ao_plot').width();
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
          .setXDomain([0, data.offset_gather.length - 1])
          .setYDomain([1, -1])
          .setX2Domain([0, data.offset_gather.length - 1])
          .setY2Domain([1, -1])
          .draw();
      } 

      var aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
      if(!$scope.aOHor){
        $scope.aOHor = g3.horizon($scope.aOPlot, aOArr)
          .setDuration(5)
          .draw();
      } else {
        $scope.aOHor.reDraw(aOArr);
      }
    };

    $scope.plotAmplitudeFreq = function(data, height){
      // Amplitude Freq Plot
      var width = $('.af_plot').width();
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
          .setXDomain([0, data.wavelet_gather.length - 1])
          .setYDomain([0, data.wavelet_gather[0].length - 1])
          .setX2Domain([0, data.wavelet_gather.length - 1])
          .setY2Domain([0, data.wavelet_gather[0].length - 1])
          .draw();
      }
    };

    $scope.plotVDWiggle = function(data){
      // Draw VD Plot Wiggle
      var arr = [data.seismic[$scope.trace]];
      if(!$scope.vDLog){
        $scope.vDLog = g3.wiggle($scope.vDPlot, arr)
          .setXMin($scope.trace)
          .setGain(80)
          .setDuration(5)
          .draw();
      } else {
        $scope.vDLog
          .setXMin($scope.trace)
          .reDraw(
            arr, 
            [0, data.seismic.length - 1], 
            [0, data.seismic[0].length - 1]
          );
      }
    };

    $scope.plotVDHorizon = function(data){
      var xScale = $scope.vDPlot.xScale;
      var yScale = $scope.vDPlot.yScale;
      if(!$scope.vDHor){
        $scope.vDHor = $scope.vDPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(0))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.seismic.length - 1))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.vDHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }
    };

    $scope.plotOffsetWiggle = function(data){
      // Draw Offset Wiggle
      var arr = [data.offset_gather[$scope.offset]];
      if(!$scope.oGLog){
        $scope.oGLog = g3.wiggle($scope.oGPlot, arr)
          .setXMin($scope.offset)
          .setGain(5)
          .setDuration(5)
          .draw();
      } else {
        $scope.oGLog
          .setXMin($scope.offset)
          .reDraw(
            arr, 
            [0, data.offset_gather.length - 1], 
            [0, data.offset_gather[0].length - 1]
          );
      }
    };

    $scope.plotOffsetHorizon = function(data){
      // Draw Offset Horizon
      var xScale = $scope.oGPlot.xScale;
      var yScale = $scope.oGPlot.yScale;
      if(!$scope.oGHor){
        $scope.oGHor = $scope.oGPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(0))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.offset_gather.length - 1))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.oGHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }
    };

    $scope.plotWaveletHorizon = function(data){
      // Draw Wavelet Horizon
      var xScale = $scope.wGPlot.xScale;
      var yScale = $scope.wGPlot.yScale;
      if(!$scope.wGHor){
        $scope.wGHor = $scope.wGPlot.svg.append("line")
          .style("stroke", "green")
          .style("opacity", 1.5)
          .attr("x1", xScale(0))
          .attr("y1", yScale($scope.twt))
          .attr("x2", xScale(data.wavelet_gather.length - 1))
          .attr("y2", yScale($scope.twt));
      } else {
        $scope.wGHor
          .transition()
          .duration(5)
          .attr("y1", yScale($scope.twt))
          .attr("y2", yScale($scope.twt));
      }
    };

    $scope.plot = function(data){

      $scope.data = data;
    	var height = 300;
      var max = getMax(data.max, data.min);
      $scope.plotSeismic(data, height, max);
      $scope.plotOffset(data, height, max);
      $scope.plotWavelet(data, height, max);

      height = 100;
      $scope.plotAmplitudeTrace(data, height);
      $scope.plotAmplitudeOffset(data, height);
      $scope.plotAmplitudeFreq(data, height);
      $scope.plotVDWiggle(data);
      $scope.plotOffsetWiggle(data);
      $scope.plotVDHorizon(data);
      $scope.plotOffsetHorizon(data);
      $scope.plotWaveletHorizon(data);
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

    $scope.setDefaults();
    $scope.fetchImageModels();
    $scope.fetchRocks();
});

// <-- HELPER FUNCTIONS --> //
// Take two numbers and return the abs max of the two
function getMax(a, b){
  if(Math.abs(a) > Math.abs(b)){
    return Math.abs(a);
  } else {
    return Math.abs(b);
  }
}

// Get a row from a columnar matrix
function getCrossSection(matrix, rowIndex){
  var arr = [];
  for(var i = 0; i < matrix.length; i++){
    arr.push(matrix[i][rowIndex]);
  }
  return arr;
}