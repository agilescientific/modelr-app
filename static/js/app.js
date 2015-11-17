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
    $scope.twt = 0;
    $scope.twtStr = "0";
    $scope.gain = 1;
    $scope.twt = 0;
    $scope.gainStr = "1";
    $scope.maxGain = "10";
    $scope.frequency = 20;
    $scope.phase = 0.0;
    $scope.phaseStr = "0";
    $scope.snr = 50;
    $scope.snrStr = "50";
    $scope.frequencyNum = 20.72;
    $scope.colorRange = ['#FF0000', '#FFF', '#0000FF'];
    
    $http.get('/backend_url').then(function(response) {
      $scope.server = response.data.hostname;
    });
    
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

    var hash = window.location.hash.substring(1);
    if (hash != ''){
      var params = hash.split('&');
      var image_key = params[0].split('=')[1];

      if(params.length > 1){
        var name = decodeURIComponent(params[1].split('=')[1]);
      }
    }
    
    $http.get('/image_model?all')
      .then(function(response) {
        var images = response.data;
        $scope.images = [];

        if(images.length > 0){
        for(var i = 0; i < images.length; i++){
          var loopIndex = i;
          if(image_key && images[i].key === image_key){
            $scope.images.unshift(images[i]);
            loopIndex = 0;
          } else{
            $scope.images.push(images[i]);
          };

    	    $scope.images[loopIndex].rocks = [];
    	    for(var j = 0; j < $scope.images[loopIndex].colours.length; j++){
    	      var rand = $scope.rocks[Math.floor(Math.random() * $scope.rocks.length)];
            $scope.images[loopIndex].rocks.push(rand);
    	    }
	       }
          $scope.curImage = $scope.images[0];
        }

        if(name){
          for(var i=0; $scope.curImage.earth_models; i++){
            var em = $scope.curImage.earth_models[i];
            if(em.name === name){
              $scope.savedEarthModel = em;
              $scope.loadSaved();
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

    for(var h =0; h < $scope.curImage.colours.length; h++){
      var curColour = $scope.curImage.colours[h];

      dataloop:
      for(var i = 0; i < arr.length; i++){
        rockloop:
        for(var j = 0; j < $scope.rocks.length; j++){
          if((arr[i].rock.db_key === $scope.rocks[j].db_key) &&
             (arr[i].colour === curColour)){
            $scope.curImage.rocks[h] = $scope.rocks[j];
            break dataloop;
          }
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
      frequency: $scope.frequencyNum,
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

          // set better horizon defaults
          if($scope.updateClicked === undefined){
            
             $scope.twt = (response.data.seismic.length / 2) * response.data.dt;
          };
          console.log(response.data);
          $scope.plot(response.data);
          $scope.maxTrace = String(response.data.seismic.length - 1);
          $scope.maxTWT = String((response.data.seismic[0].length - 1) * response.data.dt);
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
      .xTrans($scope.trace)
      .reDraw(
        arr, 
        [0, $scope.data.seismic.length - 1], 
        [0, ($scope.data.seismic[0].length - 1) * $scope.data.dt]
      );
  };

  $scope.changeTWTStr = function(){
    $scope.twt = Number($scope.twtStr);
    $scope.updateTWT();
  };

  $scope.updateTWT = function(){
    // Update Horizons
    var arr = [];
    for(var i = 0; i < $scope.data.seismic.length; i++){ arr.push($scope.twt); }
    $scope.vDHor.reDraw(arr);

    arr = [];
    for(var i = 0; i < $scope.data.offset_gather.length; i++){ arr.push($scope.twt); }
    $scope.oGHor.reDraw(arr);

    arr = [];
    for(var i = 0; i < $scope.data.wavelet_gather.length; i++){ arr.push($scope.twt); }
    $scope.wGHor.reDraw(arr);

    $scope.aTArr = getCrossSection($scope.data.seismic, $scope.twt,
                                   $scope.data.dt);
    $scope.aOArr = getCrossSection($scope.data.offset_gather, $scope.twt,
                                   $scope.data.dt);
    $scope.aFArr = getCrossSection($scope.data.wavelet_gather, $scope.twt,
                                   $scope.data.dt);

    $scope.aTHor.reDraw($scope.aTArr);
    $scope.aOHor.reDraw($scope.aOArr);
    $scope.aFHor.reDraw($scope.aFArr);
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
      .xTrans($scope.offset)
      .reDraw(
        arr, 
        [0, $scope.data.offset_gather.length - 1], 
        [0, ($scope.data.offset_gather[0].length - 1) * $scope.data.dt]
      );
  };

  $scope.changeFrequencyStr = function(){
    $scope.frequency = Number($scope.frequencyStr);
    $scope.frequencyNum = $scope.data.f[$scope.frequency];
    var arr = [$scope.data.wavelet_gather[$scope.frequency]];
    $scope.wGLog
      .xTrans($scope.frequency)
      .reDraw(
        arr, 
        [0, $scope.data.wavelet_gather.length - 1], 
        [0, ($scope.data.wavelet_gather[0].length - 1) * $scope.data.dt]
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
        .height(height)
        .xTitle("spatial cross-section")
        .yTitle("time [ms]")
        .width(width - 30)
        .xTickFormat("")
        .x2TickFormat("")
        .y2TickFormat("")
        .margin(20,10,5,40)
        .xDomain([0, data.seismic.length - 1])
        .yDomain([0, (data.seismic[0].length - 1) * data.dt])
        .draw();
    } else {
      $scope.vDPlot.reDraw(
        [0, data.seismic.length - 1], 
        [0, (data.seismic[0].length - 1) * data.dt]
      );
    }
    // Draw Seismic Image
    if(!$scope.seis){
      $scope.seis = g3.seismic($scope.vDPlot, [data.seismic])
        .max(max)
        .nDColorMap([$scope.colorScale])
        .gain($scope.gain)
        .draw();
    } else {
      $scope.seis
        .gain($scope.gain)
        .nDColorMap([$scope.colorScale])
        .reDraw([data.seismic]);
    }
  };
  
  $scope.plotVDHorizon = function(data){
    var xScale = $scope.vDPlot.xScale();
    var yScale = $scope.vDPlot.yScale();
    var arr = [];
    for(var i = 0; i < data.seismic.length; i++){
      arr.push($scope.twt);
    }
    if(!$scope.vDHor){ 
      $scope.vDHor = g3.horizon($scope.vDPlot, arr).yInt(data.dt).draw();

      // Register drag trigger for wGWigLine
      var wigLineDrag = d3.behavior.drag()
        .on('drag', vDWigLineRedraw);

      // Register drag trigger for wGHorLine
      var horLineDrag = d3.behavior.drag()
      .on('drag', vDHorLineRedraw);

      // Draw invisible line
      $scope.vDWigLine = g3.handle.line(
        $scope.vDPlot, 
        $scope.trace, 
        (data.seismic[0].length - 1)*data.dt,
        $scope.trace,
        0)
        .class('vdwigline')
        .draw();
      $scope.vDWigLine.line().call(wigLineDrag);

      // Draw invisible horizon line
      $scope.vDHorLine = g3.handle.line($scope.vDPlot, 0, 
        $scope.twt, data.seismic.length - 1, $scope.twt).draw();
      $scope.vDHorLine.line().call(horLineDrag);

      // Register mouseup trigger for wgline
      $(".vdwigline").mouseup(function(e){
        e.preventDefault();
        $scope.update_data();
      });
    } else {
      // Redraw the invisible line
      $scope.vDWigLine.reDraw($scope.trace,
                              (data.seismic[0].length - 1) * data.dt,
                              $scope.trace, 0);
      // Redraw invisible horizon
      $scope.vDHorLine.reDraw(0, $scope.twt,
                              data.seismic.length - 1, $scope.twt);
      $scope.vDHor.yInt(data.dt).reDraw(arr);
    }
  };

  function vDWigLineRedraw(){
    var xScale = $scope.vDPlot.xScale();
    var x = Math.floor(xScale.invert(d3.event.x));

    if(x < 0){ x = 0; } 
    else if(x > $scope.data.seismic.length - 1){ x = $scope.data.seismic.length - 1; }

    $scope.traceStr = x.toString();
    $scope.changeTraceStr();
    $scope.vDWigLine.reDraw($scope.trace,
                            ($scope.data.seismic[0].length - 1) * $scope.data.dt,
                            $scope.trace, 0);
  }

  function vDHorLineRedraw(){
    var yScale = $scope.vDPlot.yScale();
    var y = (yScale.invert(d3.event.y));

    if(y < 0){ y = 0; } 
    else if(y > ($scope.data.seismic[0].length - 1) * $scope.data.dt)
    { y = ($scope.data.seismic[0].length - 1) * $scope.data.dt; }

    $scope.twtStr = y.toString();
    $scope.changeTWTStr();
    $scope.wGHorLine.reDraw(0, $scope.twt, $scope.data.wavelet_gather.length - 1, $scope.twt);
    $scope.oGHorLine.reDraw(0, $scope.twt, $scope.data.offset_gather.length - 1, $scope.twt);
    $scope.vDHorLine.reDraw(0, $scope.twt, $scope.data.seismic.length - 1, $scope.twt);
  };

  $scope.plotOffset = function(data, height, max){
    // Offset Gather Plot
    var width = $('.og_plot').width();
    if(!$scope.oGPlot){
      $scope.oGPlot = g3.plot('.og_plot')
        .height(height)
        .width(width - 30)
        .xTitle("angle gather")
        .xTicks(6)
        .x2Ticks(6)
        .xTickFormat("")
        .x2TickFormat("")
        .yTickFormat("")
        .y2TickFormat("")
        .margin(20,10,5,30)
        .xDomain([0, data.offset_gather.length - 1])
        .yDomain([0, (data.offset_gather[0].length - 1)*data.dt])
        .draw();
    } else {
      $scope.oGPlot.reDraw(
        [0, data.offset_gather.length - 1], 
        [0, (data.offset_gather[0].length - 1)*data.dt]
      );
    }

    // Draw Offset Gather Image
    if(!$scope.og){
      $scope.og = g3.seismic($scope.oGPlot, [data.offset_gather])
        .max(max)
        .nDColorMap([$scope.colorScale])
        .gain($scope.gain)
        .draw();
    } else {
      $scope.og
        .gain($scope.gain)
        .nDColorMap([$scope.colorScale])
        .reDraw([data.offset_gather]);
    }
  };

  $scope.plotOffsetHorizon = function(data){
    // Draw Offset Horizon
    var xScale = $scope.oGPlot.xScale();
    var yScale = $scope.oGPlot.yScale();

    var arr = [];
    for(var i = 0; i < data.offset_gather.length; i++){
      arr.push($scope.twt);
    }

    if(!$scope.oGHor){
      $scope.oGHor = g3.horizon($scope.oGPlot, arr).draw();

        // Register drag trigger for wGWigLine
        var wigLineDrag = d3.behavior.drag()
          .on('drag', oGWigLineRedraw);

        // Register drag trigger for wGHorLine
        var horLineDrag = d3.behavior.drag()
          .on('drag', oGHorLineRedraw);

        // Draw invisible line
        $scope.oGWigLine = g3.handle.line(
          $scope.oGPlot, 
          $scope.offset, 
          (data.offset_gather[0].length - 1) * data.dt,
          $scope.offset,
          0)
        .class('ogwigline')
          .draw();
        $scope.oGWigLine.line().call(wigLineDrag);

        // Draw invisible horizon line
        $scope.oGHorLine = g3.handle.line(
          $scope.oGPlot, 
          0, 
          $scope.twt,
          data.offset_gather.length - 1,
          $scope.twt)
          .draw();

        $scope.oGHorLine.line().call(horLineDrag);

        // Register mouseup trigger for wgline
        $(".ogwigline").mouseup(function(e){
          e.preventDefault();
          $scope.update_data();
        });

    } else {
      $scope.oGHor.reDraw(arr);
      // Redraw the invisible line
      $scope.oGWigLine.reDraw($scope.offset,
                              (data.offset_gather[0].length - 1)*data.dt, $scope.offset, 0);
      // Redraw invisible horizon
      $scope.oGHorLine.reDraw(0, $scope.twt,
                              data.offset_gather.length - 1, $scope.twt);
    }
  };

  function oGWigLineRedraw(){
    var xScale = $scope.oGPlot.xScale();
    var yScale = $scope.oGPlot.yScale();
    var x = Math.floor(xScale.invert(d3.event.x));

    if(x < 0){ x = 0; } 
    else if(x > $scope.data.offset_gather.length - 1){
      x = $scope.data.offset_gather.length - 1;
    }

    $scope.offsetStr = x.toString();
    $scope.changeOffsetStr();
    $scope.oGWigLine.reDraw($scope.offset,
                            ($scope.data.offset_gather[0].length - 1) * $scope.data.dt,
                            $scope.offset,0);
  }

  function oGHorLineRedraw(){
    var xScale = $scope.oGPlot.xScale();
    var yScale = $scope.oGPlot.yScale();
    var y = yScale.invert(d3.event.y);

    if(y < 0){ y = 0; } 
    else if(y > ($scope.data.offset_gather[0].length - 1) * $scope.data.dt){ 
      y = ($scope.data.offset_gather[0].length - 1) * $scope.data.dt;
    }

    $scope.twtStr = y.toString();
    $scope.changeTWTStr();
    $scope.wGHorLine.reDraw(0, $scope.twt, $scope.data.wavelet_gather.length - 1, $scope.twt);
    $scope.oGHorLine.reDraw(0, $scope.twt, $scope.data.offset_gather.length - 1, $scope.twt);
    $scope.vDHorLine.reDraw(0, $scope.twt, $scope.data.seismic.length - 1, $scope.twt);
  };

  $scope.plotWavelet = function(data, height, max){
    // Wavelet Gather Plot
    var width = $('.wg_plot').width();
    if(!$scope.wGPlot){
      $scope.wGPlot = g3.plot('.wg_plot')
        .height(height)
        .width(width - 30)
        .xTitle("wavelet gather")
        .xTicks(6)
        .x2Ticks(6)
        .xTickFormat("")
        .x2TickFormat("")
        .yTickFormat("")
        .y2TickFormat("")
        .margin(20,10,5,20)
        .xDomain([0, data.wavelet_gather.length - 1])
        .yDomain([0, (data.wavelet_gather[0].length - 1) * data.dt])
        .draw();
    } else {
      $scope.wGPlot.reDraw(
        [0, data.wavelet_gather.length - 1], 
        [0, (data.wavelet_gather[0].length - 1) * data.dt]
      );
    }

    // Draw Wavelet Gather Image
    if(!$scope.wg){
      $scope.wg = g3.seismic($scope.wGPlot, [data.wavelet_gather])
        .max(max)
        .nDColorMap([$scope.colorScale])
        .gain($scope.gain)
        .draw();
    } else {
      $scope.wg
        .nDColorMap([$scope.colorScale])
        .gain($scope.gain)
        .reDraw([data.wavelet_gather]);
    }
  };

  $scope.plotWaveletHorizon = function(data){
    var arr = [];
    for(var i = 0; i < data.wavelet_gather.length; i++){
      arr.push($scope.twt);
    }

    if(!$scope.wGHor){
      // Draw horizon line
      $scope.wGHor = g3.horizon($scope.wGPlot, arr).draw();
      
      // Register drag trigger for wGWigLine
      var wigLineDrag = d3.behavior.drag()
        .on('drag', wGWigLineRedraw);

      // Register drag trigger for wGHorLine
      var horLineDrag = d3.behavior.drag()
        .on('drag', wGHorLineRedraw);

      // Draw invisible line
      $scope.wGWigLine = g3.handle.line(
        $scope.wGPlot, 
        $scope.frequency, 
        (data.wavelet_gather[0].length - 1)*data.dt,
        $scope.frequency,
        0)
        .class('wgwigline')
        .draw();
      $scope.wGWigLine.line().call(wigLineDrag);

      $scope.wGHorLine = g3.handle.line(
        $scope.wGPlot, 
        0, 
        $scope.twt,
        data.wavelet_gather.length - 1,
        $scope.twt)
        .draw();
      $scope.wGHorLine.line().call(horLineDrag);

      // Register mouseup trigger for wgline
      $(".wgwigline").mouseup(function(e){
        e.preventDefault();
        $scope.update_data();
      });

    } else {
      // Redraw the invisible line
      $scope.wGWigLine.reDraw($scope.frequency,
                              (data.wavelet_gather[0].length - 1)*data.dt, 
        $scope.frequency, 0);
      // Redraw invisible horizon
      $scope.wGHorLine.reDraw(0, $scope.twt, data.wavelet_gather.length - 1, $scope.twt);
      // Redraw horizon
      $scope.wGHor.reDraw(arr);
    }
  };

  function wGWigLineRedraw(){
    var xScale = $scope.wGPlot.xScale();
    var x = Math.floor(xScale.invert(d3.event.x));

    if(x < 0){ x = 0; } 
    else if(x > $scope.data.wavelet_gather.length - 1){
      x = $scope.data.wavelet_gather.length - 1;
    }

    $scope.frequencyStr = x.toString();
    $scope.changeFrequencyStr();
    $scope.wGWigLine.reDraw($scope.frequency,
                            ($scope.data.wavelet_gather[0].length - 1)*$scope.data.dt, 
        $scope.frequency, 0);
  }

  function wGHorLineRedraw(){
    var yScale = $scope.wGPlot.yScale();
    var y = (yScale.invert(d3.event.y));

    if(y < 0){ y = 0; } 
    else if(y > ($scope.data.wavelet_gather[0].length - 1)*$scope.data.dt){
      y = ($scope.data.wavelet_gather[0].length - 1)*$scope.data.dt;
    }

    $scope.twtStr = y.toString();
    $scope.changeTWTStr();
    $scope.wGHorLine.reDraw(0, $scope.twt, $scope.data.wavelet_gather.length - 1, $scope.twt);
    $scope.oGHorLine.reDraw(0, $scope.twt, $scope.data.offset_gather.length - 1, $scope.twt);
    $scope.vDHorLine.reDraw(0, $scope.twt, $scope.data.seismic.length - 1, $scope.twt);
  }

  $scope.plotAmplitudeTrace = function(data, height){
    // Amplitude Trace
    var width = $('.at_plot').width();

    if(!$scope.aTPlot){
      $scope.aTPlot = g3.plot('.at_plot')
        .height(height)
        .yTitle("amplitude")
        .width(width - 30)
        .yTicks(6)
        .y2Ticks(6)
        .xTickFormat("")
        .y2TickFormat("")
        .x2Title("trace")
        .margin(5,10,40,40)
        .xDomain([0, data.seismic.length - 1])
        .yDomain([1, -1])
        .draw();
    }

    $scope.aTArr = getCrossSection(data.seismic, $scope.twt, $scope.data.dt);

    if(!$scope.aTHor){
      $scope.aTHor = g3.horizon($scope.aTPlot, $scope.aTArr).draw();
    } else {
      $scope.aTHor.reDraw($scope.aTArr);
    }
  };

  $scope.plotAmplitudeOffset = function(data, height){
    // Amplitude Offset Plot
    var width = $('.ao_plot').width();
    if(!$scope.aOPlot){
      $scope.aOPlot = g3.plot('.ao_plot')
        .height(height)
        .width(width - 30)
        .x2Title("\u03B8" + "\u00B0")
        .yTicks(6)
        .y2Ticks(6)
        .xTicks(6)
        .x2Ticks(6)
        .xTickFormat("")
        .yTickFormat("")
        .y2TickFormat("")
        .x2TickFormat(function(d, i){
          return $scope.data.theta[d];
        })
        .margin(5,10,40,30)
        .xDomain([0, data.offset_gather.length - 1])
        .yDomain([1, -1])
        .draw();
    } 

    $scope.aOArr = getCrossSection($scope.data.offset_gather, $scope.twt, $scope.data.dt);

    if(!$scope.aOHor){
      $scope.aOHor = g3.horizon($scope.aOPlot, $scope.aOArr).draw();
    } else {
      $scope.aOHor.reDraw($scope.aOArr);
    }
  };

  $scope.plotAmplitudeFreq = function(data, height){

    // Amplitude Freq Plot
    var width = $('.af_plot').width();
    if(!$scope.aFPlot){
      $scope.aFPlot = g3.plot('.af_plot')
        .height(height)
        .width(width - 30)
        .x2Title("centre frequency Hz")
        .yTicks(6)
        .y2Ticks(6)
        .xTicks(6)
        .x2Ticks(6)
        .xTickFormat("")
        .yTickFormat("")
        .y2TickFormat("")
        .x2TickFormat(function(d, i){
          return Math.floor($scope.data.f[d]);
        })
        .margin(5,10,40,20)
        .xDomain([0, $scope.data.wavelet_gather.length - 1])
        .yDomain([1, -1])
        .draw();
    }

    $scope.aFArr = getCrossSection($scope.data.wavelet_gather, $scope.twt, $scope.data.dt);

    if(!$scope.aFHor){
      $scope.aFHor = g3.horizon($scope.aFPlot, $scope.aFArr).draw();
    } else {
      $scope.aFHor.reDraw($scope.aFArr);
    }
  };

  $scope.plotVDWiggle = function(data){
    // Draw VD Plot Wiggle
    var arr = [data.seismic[$scope.trace]];
    if(!$scope.vDLog){
      $scope.vDLog = g3.wiggle($scope.vDPlot, arr)
        .xTrans($scope.trace)
        .xMult(80 * $scope.gain)
        .yMult(data.dt)
        .duration(5)
        .draw();

    } else {
      $scope.vDLog
        .xTrans($scope.trace)
        .xMult(80 * $scope.gain)
        .yMult(data.dt)
        .reDraw(
          arr, 
          [0, data.seismic.length - 1], 
          [0, (data.seismic[0].length - 1)*data.dt]
        );
    }
  };

  $scope.plotOffsetWiggle = function(data){
    // Draw Offset Wiggle
    var arr = [data.offset_gather[$scope.offset]];
    if(!$scope.oGLog){
      $scope.oGLog = g3.wiggle($scope.oGPlot, arr)
        .xTrans($scope.offset)
        .xMult(5 * $scope.gain)
        .yMult(data.dt)
        .draw();
    } else {
      $scope.oGLog
        .xMult(5 * $scope.gain)
        .xTrans($scope.offset)
        .yMult(data.dt)
        .reDraw(
          arr, 
          [0, data.offset_gather.length - 1], 
          [0, (data.offset_gather[0].length - 1)*data.dt]
        );
    }
  };

  $scope.plotWaveletWiggle = function(data){
    // Draw Offset Wiggle
    $scope.frequencyNum = $scope.data.f[$scope.frequency];
    var arr = [data.wavelet_gather[$scope.frequency]];
    if(!$scope.wGLog){
      $scope.wGLog = g3.wiggle($scope.wGPlot, arr)
        .xTrans($scope.frequencyNum)
        .xMult(22.7 * $scope.gain)
        .yMult(data.dt)
        .draw();
    } else {
      $scope.wGLog
        .xTrans($scope.frequency)
        .xMult(22.7 * $scope.gain)
        .yMult(data.dt)
        .reDraw(
          arr, 
          [0, data.wavelet_gather.length - 1], 
          [0, (data.wavelet_gather[0].length - 1)*data.dt]
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
        csv.push(',"' + v + '"');
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
function getCrossSection(matrix, value, sampleRate){
    var arr = [];
    var rowIndex = Math.floor(value / sampleRate);
  for(var i = 0; i < matrix.length; i++){
    arr.push(matrix[i][rowIndex]);
  }
  return arr;

}

app.controller('modelBuilderCtrl', function ($scope, $http, $alert, $timeout) {
	var width = $('.modelb').width();
	var height = 400;
	$scope.pathColors = ['#0ef0ef'];
	var topHeight = 50;
	var line, x, y;
	$scope.editLines = true;

	$scope.paths = [
		[{"x":0, "y":height - topHeight},
	    {"x":width * 0.25,"y":height - topHeight},
	    {"x":width * 0.50,"y":height - topHeight},
	    {"x":width * 0.75, "y":height - topHeight},
	    {"x":width,"y":height - topHeight},
	  ]
	];

	var defaultPath = [
			{"x":0, "y":height},
	    {"x":width * 0.25,"y":height},
	    {"x":width * 0.50,"y":height},
	    {"x":width * 0.75, "y":height},
	    {"x":width,"y":height},
	  ];

	$scope.editToggle = function(){
		if($scope.editLines === false){
			d3.selectAll('circle').style('display', 'none');
			d3.selectAll('path').style('stroke', 'none');
		} else {
			d3.selectAll('circle').style('display', 'block');
			d3.selectAll('path').style('stroke', 'black');
		}
	};

	var vis = d3.select(".modelb").append("svg")
	  .attr("width", width)
	  .attr("height", height)
	  .style('border', '1px solid grey');

	$scope.addTop = function(){

		if($scope.editLines === false){
			$scope.editLines = true;
		}

		if($scope.paths.length > 0){
			var ll = $scope.paths[$scope.paths.length - 1];
		} else {
			var ll = defaultPath;
		}
		var path = [];
		for(var i = 0; i < ll.length; i++){
			path.push({"x":ll[i].x, "y":ll[i].y - topHeight});
		}
		$scope.paths.push(path);
		$scope.pathColors.push('#'+Math.floor(Math.random()*16777215).toString(16));
		drawTops();
	};

	// Area drawing function
	var area = d3.svg.area()
	  .x(function(d) { return d.x; })
	  .y0(height)
	  .y1(function(d) { return d.y; });

	// Drag functions
	var circleDrag = d3.behavior.drag()
	  .origin(Object)
	  .on("drag", moveCircle);

	var nsDrag = d3.behavior.drag()
		.on('drag', nsResize);

	drawTops();

	function drawTops(){
		$scope.tops = [];
		d3.selectAll('g').remove();
		for(var i = $scope.paths.length - 1; i >= 0; i--){
			console.log(i);
			var top = vis.append('g')
			.attr('class', i)
			.on('click', function(d,i){ selectLayer(this);});


			top.color = $scope.pathColors[i];
			top.append('path')
				.attr('id', "top" + i)
				.attr('d', area($scope.paths[i]))
				.style('stroke-width', 1)
				.attr('fill', $scope.pathColors[i])
				.style('stroke', function(d, j){
					if(i === $scope.paths.length - 1){
						return 'black';
					} else {
						return 'none';
					}
				})
				.call(nsDrag);;

			top.selectAll("circle" + i)
				.data($scope.paths[i])
				.enter().append("circle")
				.style('fill', 'black')
				.attr('class', function(d, j){ return j;})
				.attr('id', function(d, j){ return 'circle' + i;})
				.attr('cx', function(d){ return d.x; })
				.attr('cy', function(d){ return d.y; })
				.attr('r', 7)
				.style('cursor', 'move')
				.style('display', function(d, j){
					if(i === $scope.paths.length - 1){
						return 'block';
					} else {
						return 'none';
					}
				})
				.call(circleDrag);

			$scope.tops.push(top);
		}
	};

	function selectLayer(elem){
		elem = d3.select(elem);
		d3.selectAll('circle').style('display', 'none');
		d3.selectAll('path').style('stroke', 'none');
		d3.selectAll('#circle' + elem.attr('class')).style('display', 'block');
		d3.selectAll('#top' + elem.attr('class')).style('stroke', 'black');

		elem.attr('cursor', 'ns-resize')
	};

	$scope.saveModel = function(){
		//Insert json call here
		var model = {};
		model.paths = $scope.paths;
		model.pathColors = $scope.pathColors;
	  var svg = d3.select(".modelb svg").node(),
	      img = new Image(),
	      serializer = new XMLSerializer(),
	      svgStr = serializer.serializeToString(svg);

	    img.src = 'data:image/svg+xml;base64,'+window.btoa(svgStr);

	    // You could also use the actual string without base64 encoding it:
	    //img.src = "data:image/svg+xml;utf8," + svgStr;

	    var canvas = document.createElement("canvas");
	    document.body.appendChild(canvas);

	    canvas.width = 500;
	    canvas.height = 400;
	    canvas.getContext("2d").drawImage(img,0,0);
	};

	$scope.getColor = function(top){
		return d3.select(top[0][0].childNodes[0]).style('fill');
	};

	$scope.deleteTop = function(top){
		var index = d3.select(top[0][0]).attr('class');

		// Remove top
		$scope.tops.splice(index, 1);

		// Remove point set
		$scope.paths.splice(index, 1);

		// Remove color 
		$scope.pathColors.splice(index, 1);

		d3.selectAll('g').remove();
		drawTops();
	};

	function nsResize(){
		var m = d3.mouse(this);
		var parent = d3.select(this.parentNode);
		var index = parent.attr('class');
		var arr = [];

		// Get average y value
		for(var i = 0; i < $scope.paths[index].length; i++){
			arr.push($scope.paths[index][i].y);
		}
		var mean = d3.mean(arr);
		var change = mean - m[1];
		console.log(index);
		for(var i = 0; i < $scope.paths[index].length; i++){
			$scope.paths[index][i].y -= change;
		}
		var path = d3.select('#top' + index);
		path.transition().duration(5).attr('d', area($scope.paths[index])).ease('linear');
		
		var circles = d3.selectAll('#circle' + index);
		circles.data($scope.paths[index])
			.transition()
			.duration(5)
			.attr('cx', function(d){ return d.x; })
			.attr('cy', function(d){ return d.y; });
	};

	function moveCircle(){
		var m = d3.mouse(this);
		var x, y;

		// Check to see if we are in bounds for x
		if(m[0] > width){
			x = width;
		} else if(m[0] < 0){
			x = 0;
		} else {
			x = m[0];
		}

		// Check to see if we are in bounds for y
		if(m[1] > height){
			y = height;
		} else if(m[1] < 0){
			y = 0;
		} else {
			y = m[1];
		}

		var obj = d3.select(this);
			obj.attr('cx', x)
			.attr('cy', y);

		var parent = d3.select(this.parentNode);
		var i = parent.attr('class'), j = obj.attr('class');

		$scope.paths[i][j].x = x;
		$scope.paths[i][j].y = y;
		
		// Get child path (possibly find a better way to do this)
		var path = d3.select(parent[0][0].childNodes[0]);
		path.transition().duration(5).attr('d', area($scope.paths[i])).ease('linear');
	};

});