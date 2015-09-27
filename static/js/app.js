'use strict';
var app = angular.module('modelr', 
	['mgcrea.ngStrap', 
	'ngAnimate',
	'angular-flexslider']);

 
app.config(['$interpolateProvider', function($interpolateProvider) {
  $interpolateProvider.startSymbol('{[');
  $interpolateProvider.endSymbol(']}');
}]);


app.controller('2DCtrl', function ($scope, $http, $alert, $timeout) {

  $scope.setDefaults = function(){
    $scope.zDomain = ['depth','time'];
    $scope.zAxisDomain = 'depth';
    $scope.zRange = 1000;

    // TODO update from mouse over on seismic plots
    $scope.trace = 1;
    $scope.traceStr = "1";
    $scope.offset = 1;
    $scope.offsetNum = 3;
    $scope.offsetStr = "1";
    $scope.twt = 1;
    $scope.twtStr = "1";
    $scope.gain = 1;
    $scope.gainStr = "1";
    $scope.maxGain = "10";
    $scope.frequency = 20;
    $scope.phase = 180.0;
    $scope.phaseStr = "180";
    $scope.snr = 3.0;
    $scope.snrStr = "3.0"
    $scope.frequencyNum = 20.72;
    $scope.colorRange = ['#FF0000', '#FFF', '#0000FF'];
    
    // TODO get from app before so we get the prod url
    $scope.server = 'http://localhost:8081';

    $scope.theta = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30];
    $scope.popover = {
     title: "Models",
     content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
    };
  };

  $scope.setColorPickers = function(){
      for(var i = 0; i < $scope.colorRange.length; i++){
        var colorp = $('.s-color-' + i).colorpicker()
          .on('changeColor.colorpicker', function(event){
            var index = event.currentTarget.attributes["data-index"].value;
            $(event.currentTarget).css('background-color', $scope.colorRange[index]);
            $scope.colorRange[index] = event.color.toHex();
            console.log($scope.colorRange);
        });
      }
  };

  $scope.removeColor = function(index){
    $scope.colorRange.splice(index, 1);
    $scope.colorDomain.splice(index, 1);
  };

  $scope.addColor = function(){
    $scope.colorRange.push('#FFF');
    $scope.colorDomain.push(0);
    $timeout($scope.setColorPickers, 300);
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

    var arr = $.map($scope.savedEarthModel.mapping, function(value, index) {
      return [value];
    });

    $scope.curImage.rocks = [];
    for(var i = 0; i < arr.length; i++){
      for(var j = 0; j < $scope.rocks.length; j++){
        if(arr[i].rock.name === $scope.rocks[j].name){
          $scope.curImage.rocks.push($scope.rocks[j]);
        }
      }
    }
  };
  
  $scope.slideClick = function(slider){
  	$scope.curImage = $scope.images[slider.element.currentSlide];
  };

  $scope.update_data = function(){
    if($scope.updateClicked === undefined){
      $('#loader').show();
    }

    var earth_model = $scope.makeEarthModelStruct();
    $("html, body").scrollTop($("#plot_header").offset().top);
      
    var seismic = {
      frequency: $scope.frequency,
      wavelet: "ricker", 
      dt: 0.001,
      phase: $scope.phase,
      snr: $scope.snr
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
          console.log(response.data);
          $scope.plot(response.data);
          $scope.maxTrace = String(response.data.seismic.length - 1);
          $scope.maxTWT = String(response.data.seismic[0].length - 1);
          $scope.maxOffset = String(response.data.offset_gather.length - 1);
          $scope.updateClicked = true;
          $('#loader').hide();
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
  };

  $scope.changeTWTStr = function(){
    $scope.twt = Number($scope.twtStr);
    $scope.updateTWT();
  };

  $scope.getMaxAll = function(){
    var max = [];
    var maxT = getMax(d3.max($scope.aTArr) * $scope.gain, d3.min($scope.aTArr) * $scope.gain);
    max.push(maxT);
    var maxO = getMax(d3.max($scope.aOArr) * $scope.gain, d3.min($scope.aOArr) * $scope.gain);
    max.push(maxO);
    var maxF = getMax(d3.max($scope.aFArr) * $scope.gain, d3.min($scope.aFArr) * $scope.gain);
    max.push(maxF);
    return d3.max(max);
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

    $scope.aTArr = getCrossSection($scope.data.seismic, $scope.twt);
    $scope.aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);
    $scope.aFArr = getCrossSection($scope.data.wavelet_gather, $scope.twt);
    
    var maxAll = $scope.getMaxAll();

    if(maxAll > 1){
      $scope.updateAmpPlots(maxAll);
    }

    $scope.aTHor
      .setGain($scope.gain)
      .reDraw($scope.aTArr);

    $scope.aOHor
      .setGain($scope.gain)
      .reDraw($scope.aOArr);

    $scope.aFHor
      .setGain($scope.gain)
      .reDraw($scope.aFArr);
  };

  $scope.updateAmpPlots = function(maxAll){
    $scope.aTPlot
      .reDraw(
        [0, $scope.data.seismic.length - 1], 
        [maxAll,-maxAll], 
        [0, $scope.data.seismic.length - 1], 
        [maxAll,-maxAll]
      );
    $scope.aOPlot
      .reDraw(
        [0, $scope.data.offset_gather.length - 1], 
        [maxAll,-maxAll], 
        [0, $scope.data.offset_gather.length - 1], 
        [maxAll,-maxAll]
      );

    $scope.aFPlot
      .reDraw(
        [0, $scope.data.wavelet_gather.length - 1], 
        [maxAll,-maxAll], 
        [0, $scope.data.wavelet_gather.length - 1], 
        [maxAll,-maxAll]
      );
  };

  $scope.changeGainStr = function(){
    $scope.gain = Number($scope.gainStr);
    $scope.updateTWT();
  };

  $scope.changeOffsetStr = function(){
    $scope.offset = Number($scope.offsetStr);
    $scope.offsetNum = $scope.offset * 3;
    var arr = [$scope.data.offset_gather[$scope.offset]];
    $scope.oGLog
      .setXMin($scope.offset)
      .reDraw(
        arr, 
        [0, $scope.data.offset_gather.length - 1], 
        [0, $scope.data.offset_gather[0].length - 1]
      );
  };

  $scope.changeFrequencyStr = function(){
    $scope.frequency = Number($scope.frequencyStr);
    $scope.frequencyNum = $scope.data.f[$scope.frequency];
    var arr = [$scope.data.wavelet_gather[$scope.frequency]];
    $scope.wGLog
      .setXMin($scope.frequency)
      .reDraw(
        arr, 
        [0, $scope.data.wavelet_gather.length - 1], 
        [0, $scope.data.wavelet_gather[0].length - 1]
      );
  };

  $scope.changePhaseStr = function(){
    $scope.phase = Number($scope.phaseStr);
  };

  $scope.changeNoiseStr = function(){
    $scope.snr = Number($scope.snrStr);
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
        .setMargin(20,10,5,40)
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
        .setColor($scope.colorScale)
        .setGain($scope.gain)
        .draw();
    } else {
      $scope.seis
        .setGain($scope.gain)
        .setColor($scope.colorScale)
        .reDraw(data.seismic);
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

        var drag = d3.behavior.drag()  // capture mouse drag event
          .on('drag', vDCirRedraw);

        var position = [$scope.vDPlot.xScale($scope.trace), $scope.vDPlot.yScale($scope.twt)];
        $scope.vDCir = $scope.vDPlot.svg.append('circle')
          .attr("class", "vdcir")
          .attr("r", 5)
          .attr("cx", position[0])
          .attr("cy", position[1])
          .style("opacity", 0.5)
          .call(drag);

        $(".vdcir").mouseup(function(e){
          e.preventDefault();
          $scope.update_data();
        });
    } else {
      position = [$scope.vDPlot.xScale($scope.trace), $scope.vDPlot.yScale($scope.twt)];
      $scope.vDCir
        .attr("cx", position[0])
        .attr("cy", position[1]);

      $scope.vDHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));
    }
  };

  function vDCirRedraw(){
    var x = Math.floor($scope.vDPlot.xScale.invert(d3.event.x));
    var y = Math.floor($scope.vDPlot.yScale.invert(d3.event.y));

    // Check to make sure we are within the boundaries
    if(x < 0){
      x = 0;
    } else if(x > $scope.data.seismic.length - 1) {
      x = $scope.data.seismic.length - 1;
    }

    if(y < 0){
      y = 0;
    } else if(y > $scope.data.seismic[0].length - 1){
      y = $scope.data.seismic[0].length - 1;
    }

    $scope.traceStr = x.toString();
    $scope.twtStr = y.toString();
    $scope.changeTraceStr();
    $scope.changeTWTStr();
    $scope.wGCir
      .attr("cy", $scope.wGPlot.yScale($scope.twt));
    $scope.oGCir
      .attr("cy", $scope.oGPlot.yScale($scope.twt));
    $scope.vDCir
      .attr("cx", $scope.vDPlot.xScale($scope.trace))
      .attr("cy", $scope.vDPlot.yScale($scope.twt));
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
        .setXTicks(6)
        .toggleY2Axis(true)
        .setXTickFormat("")
        .setX2TickFormat("")
        .setYTickFormat("")
        .setY2TickFormat("")
        .setMargin(20,10,5,30)
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
        .setColor($scope.colorScale)
        .setGain($scope.gain)
        .draw();
    } else {
      $scope.og
        .setGain($scope.gain)
        .setColor($scope.colorScale)
        .reDraw(data.offset_gather);
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

        var drag = d3.behavior.drag()  // capture mouse drag event
          .on('drag', oGCirRedraw);

        var position = [$scope.oGPlot.xScale($scope.offset), $scope.oGPlot.yScale($scope.twt)];
        $scope.oGCir = $scope.oGPlot.svg.append('circle')
          .attr("class", "ogcir")
          .attr("r", 5)
          .attr("cx", position[0])
          .attr("cy", position[1])
          .style("opacity", 0.5)
          .call(drag);

        $(".ogcir").mouseup(function(e){
          e.preventDefault();
          $scope.update_data();
        });
    } else {
      position = [$scope.oGPlot.xScale($scope.offset), $scope.oGPlot.yScale($scope.twt)];
      $scope.oGCir
        .attr("cx", position[0])
        .attr("cy", position[1]);

      $scope.oGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));
    }
  };

  function oGCirRedraw(){
    var x = Math.floor($scope.oGPlot.xScale.invert(d3.event.x));
    var y = Math.floor($scope.oGPlot.yScale.invert(d3.event.y));

    // Check to make sure we are within the boundaries
    if(x < 0){
      x = 0;
    } else if(x > $scope.data.offset_gather.length - 1) {
      x = $scope.data.offset_gather.length - 1;
    }

    if(y < 0){
      y = 0;
    } else if(y > $scope.data.seismic[0].length - 1){
      y = $scope.data.seismic[0].length - 1;
    }

    $scope.offsetStr = x.toString();
    $scope.twtStr = y.toString();
    $scope.changeOffsetStr();
    $scope.changeTWTStr();
    $scope.wGCir
      .attr("cy", $scope.wGPlot.yScale($scope.twt));
    $scope.vDCir
      .attr("cy", $scope.vDPlot.yScale($scope.twt));
    $scope.oGCir
      .attr("cx", $scope.oGPlot.xScale($scope.offset))
      .attr("cy", $scope.oGPlot.yScale($scope.twt));
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
        .setXTicks(6)
        .toggleY2Axis(true)
        .setXTickFormat("")
        .setX2TickFormat("")
        .setYTickFormat("")
        .setY2TickFormat("")
        .setMargin(20,10,5,20)
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
        .setColor($scope.colorScale)
        .setGain($scope.gain)
        .draw();
    } else {
      $scope.wg
        .setColor($scope.colorScale)
        .setGain($scope.gain)
        .reDraw(data.wavelet_gather);
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

        var drag = d3.behavior.drag()  // capture mouse drag event
          .on('drag', wGCirRedraw);

        var position = [$scope.wGPlot.xScale($scope.frequency), $scope.wGPlot.yScale($scope.twt)];
        $scope.wGCir = $scope.wGPlot.svg.append('circle')
          .attr("class", "wgcir")
          .attr("r", 5)
          .attr("cx", position[0])
          .attr("cy", position[1])
          .style("opacity", 0.5)
          .call(drag);

        $(".wgcir").mouseup(function(e){
          e.preventDefault();
          $scope.update_data();
        });
    } else {
      position = [$scope.wGPlot.xScale($scope.frequency), $scope.wGPlot.yScale($scope.twt)];
      $scope.wGCir
        .attr("cx", position[0])
        .attr("cy", position[1]);

      $scope.wGHor
        .transition()
        .duration(5)
        .attr("y1", yScale($scope.twt))
        .attr("y2", yScale($scope.twt));
    }
  };

  function wGCirRedraw(){
    var x = Math.floor($scope.wGPlot.xScale.invert(d3.event.x));
    var y = Math.floor($scope.wGPlot.yScale.invert(d3.event.y));

    // Check to make sure we are within the boundaries
    if(x < 0){
      x = 0;
    } else if(x > $scope.data.wavelet_gather.length - 1) {
      x = $scope.data.wavelet_gather.length - 1;
    }

    if(y < 0){
      y = 0;
    } else if(y > $scope.data.seismic[0].length - 1){
      y = $scope.data.seismic[0].length - 1;
    }

    $scope.frequencyStr = x.toString();
    $scope.twtStr = y.toString();
    $scope.changeFrequencyStr();
    $scope.changeTWTStr();
    $scope.oGCir
      .attr("cy", $scope.oGPlot.yScale($scope.twt));
    $scope.vDCir
      .attr("cy", $scope.vDPlot.yScale($scope.twt));
    $scope.wGCir
      .attr("cx", $scope.wGPlot.xScale($scope.frequency))
      .attr("cy", $scope.wGPlot.yScale($scope.twt));
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
        .setY2Ticks(6)
        .setX2Title("trace")
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

    $scope.aTArr = getCrossSection($scope.data.seismic, $scope.twt);

    if(!$scope.aTHor){
      $scope.aTHor = g3.horizon($scope.aTPlot, $scope.aTArr)
        .setDuration(5)
        .draw();
    } else {
      $scope.aTHor.reDraw($scope.aTArr);
    }
  };

  $scope.changeColor = function(index){
    console.log($scope.colorDomain);
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
        .setX2Title("\u03B8" + "\u00B0")
        .setY2Ticks(6)
        .setYTicks(6)
        .setXTicks(6)
        .setX2Ticks(6)
        .toggleY2Axis(true)
        .setX2TickFormat(function(d, i){
          return $scope.data.theta[d];
        })
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

    $scope.aOArr = getCrossSection($scope.data.offset_gather, $scope.twt);

    if(!$scope.aOHor){
      $scope.aOHor = g3.horizon($scope.aOPlot, $scope.aOArr)
        .setDuration(5)
        .draw();
    } else {
      $scope.aOHor.reDraw($scope.aOArr);
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
        .setX2Title("centre frequency Hz")
        .toggleX2Axis(true)
        .setY2Ticks(6)
        .setYTicks(6)
        .setXTicks(6)
        .setX2Ticks(6)
        .toggleY2Axis(true)
          .setX2TickFormat(function(d, i){
          return Math.floor($scope.data.f[d]);
        })
        .setXTickFormat("")
        .setYTickFormat("")
        .setY2TickFormat("")
        .setMargin(5,10,40,20)
        .setXDomain([0, $scope.data.wavelet_gather.length - 1])
        .setYDomain([1, -1])
        .setX2Domain([0, $scope.data.wavelet_gather.length - 1])
        .setY2Domain([1, -1])
        .draw();
    }

    $scope.aFArr = getCrossSection($scope.data.wavelet_gather, $scope.twt);

    if(!$scope.aFHor){
      $scope.aFHor = g3.horizon($scope.aFPlot, $scope.aFArr)
        .setDuration(5)
        .draw();
    } else {
      $scope.aFHor.reDraw($scope.aFArr);
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

      console.log($scope.vDLog);
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

  $scope.plotWaveletWiggle = function(data){
    // Draw Offset Wiggle
    var arr = [data.wavelet_gather[$scope.frequency]];
    if(!$scope.wGLog){
      $scope.wGLog = g3.wiggle($scope.wGPlot, arr)
        .setXMin($scope.frequency)
        .setGain(22.7)
        .setDuration(5)
        .draw();
    } else {
      $scope.wGLog
        .setXMin($scope.frequency)
        .reDraw(
          arr, 
          [0, data.wavelet_gather.length - 1], 
          [0, data.wavelet_gather[0].length - 1]
        );
    }
  };

  $scope.plot = function(data){
    $scope.data = data;
  	var height = 450;
    var max = getMax(data.max, data.min);
    max = Number(max.toFixed(2));

    if(!$scope.colorDomain){
      $scope.colorDomain = [-max, 0, max];
    }

    $scope.colorScale = d3.scale.linear().domain($scope.colorDomain).range($scope.colorRange);
    $scope.plotSeismic(data, height, max);
    $scope.plotOffset(data, height, max);
    $scope.plotWavelet(data, height, max);

    height = 150;
    $scope.plotAmplitudeTrace(data, height);
    $scope.plotAmplitudeOffset(data, height);
    $scope.plotAmplitudeFreq(data, height);
    $scope.plotVDWiggle(data);
    $scope.plotOffsetWiggle(data);
    $scope.plotWaveletWiggle(data, height);
    $scope.plotVDHorizon(data);
    $scope.plotOffsetHorizon(data);
    $scope.plotWaveletHorizon(data);
    var maxAll = $scope.getMaxAll();

    if(maxAll > 1){
      $scope.updateAmpPlots(maxAll);
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

    if($scope.earthModelName === '' || $scope.earthModelName === undefined){
      var myAlert = $alert({
        title: 'Alert:',
        content: 'Model name is required.',
        placement: 'alert-success',
        type: 'danger',
        duration: 5,
        show: true
      });
      return;
    }

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
  $( document ).ready(function(){
    $scope.setColorPickers();
  });

  $scope.exportCSV = function(){
    var csv = [];
    $.each($scope.data.metadata.moduli, function(key, value) {
      csv.push('"' + key + '"');
      $.each(value, function(k, v) {
        if(k === 'imp'){
          v = (v / 1000000).toFixed(2);
        } else if(k === 'pr'){
          v = v.toFixed(2);
        } else {
          v = (v / 1000000000).toFixed(2);
        }
        csv.push(',"' + v + '"')
      });
      csv.push('\r\n');
    });
    csv = csv.join("");
    var hiddenElement = document.createElement('a');
    hiddenElement.href = 'data:attachment/csv,' + encodeURI(csv);
    hiddenElement.target = '_blank';
    hiddenElement.download = 'export.csv';
    hiddenElement.click();
  };
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