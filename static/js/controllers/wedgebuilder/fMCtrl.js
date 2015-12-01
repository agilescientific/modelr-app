app.controller('fMCtrl', function ($scope, modelBuilder) {
	
	// Define default variables
	var lineFunction = d3.svg.line()                         
		.x(function(d) { return d.x; })
  	.y(function(d) { return d.y; });

  var margin = {top: 50, right: 40, bottom: 30, left: 40};
  $scope.wWidth = $('.fWM').width() - margin.left - margin.right;
    //yWidth = $('.fWM').width() * 0.40 - margin.left - margin.right,
  $scope.yHeight = 400 - margin.top - margin.bottom;

	// Create scales
	var wXScale = d3.scale.linear().domain([0, $scope.wWidth]).range([0, $scope.wWidth]);
	//var yXScale = d3.scale.linear().domain([50, yWidth]).range([0, yWidth ]);
 	var yScale = d3.scale.linear().domain([0, $scope.yHeight]).range([0, $scope.yHeight]);

	// Create axis
	var wXAxis = d3.svg.axis().scale(wXScale).orient('top').ticks(3);
	//var yXAxis = d3.svg.axis().scale(yXScale).orient('top').ticks(4);
	var yAxis = d3.svg.axis().scale(yScale).orient('left').ticks(3);

	$scope.leftLinePos = $scope.wWidth * 0.15;
	$scope.rightLinePos = $scope.wWidth * 0.85;

  $scope.wPaths = [];
  //$scope.yPaths = [];
 	$scope.aBot = 75;
 	$scope.bTop = 250;
 	$scope.yDifAB = $scope.bTop - $scope.aBot;
 	$scope.count = 1;

	var circleDrag = d3.behavior.drag()
	  .origin(Object)
	  .on("drag", moveCircle);

	$scope.linesOn = true;

	$scope.addWedgePaths = function(){
		$scope.wedgePaths = [];
		// Draw W Paths
		for(var i = 0; i < $scope.wPaths.length; i++){
	 		var color = "";
			if(i % 2 == 0){
				color = '#996633'; 
			} else {
				color = '#ecd9c6';
			}
			var path = $scope.wModel.append('path')
				.attr('id', 'path' + i)
				.attr('d', lineFunction($scope.wPaths[i]))
				.style('stroke-width', 1)
				.attr('fill', color);
			$scope.wedgePaths.push(path);
		}
	};

	$scope.drawPaths = function(){

 		// Transition the paths
		for(var i = 0; i < $scope.wedgePaths.length; i++){
			//console.log($scope.wedgePaths[i]);
			$scope.wedgePaths[i]
				.transition()
				.duration(5)
				.attr('d', lineFunction($scope.wPaths[i]));
		}

		// Move the botLine
		$scope.botLine
			.attr('y1', $scope.bTop)
			.attr('y2', $scope.bTop);

		// Move the topLine
		$scope.topLine
			.attr('y1', $scope.aBot)
			.attr('y2', $scope.aBot);

		// Move the rightLine
		$scope.rightLine
			.attr('x1', $scope.rightLinePos)
			.attr('x2', $scope.rightLinePos);

		// Move the leftLine
		$scope.leftLine
			.attr('x1', $scope.leftLinePos)
			.attr('x2', $scope.leftLinePos);

		// Move the leftLineCir
		$scope.leftLineCir
			.attr('cx', $scope.leftLinePos)
			.attr('cy', $scope.aBot);

		// Move the rightLineCir
		$scope.rightLineCir
			.attr('cx', $scope.rightLinePos)
			.attr('cy', $scope.bTop);
	};

	$scope.addMeasureLines = function(){
		// Create left measure line
		$scope.leftLine = $scope.wModel.append('line')
			.attr('class', 'guideLine')
			.attr('x1', $scope.leftLinePos)
			.attr('y1', 0)
			.attr('x2', $scope.leftLinePos)
			.attr('y2', $scope.yHeight)
			.style('stroke', 'black')
			.style('stroke-dasharray', '4,4');

		// Create right measure line
		$scope.rightLine = $scope.wModel.append('line')
			.attr('class', 'guideLine')
			.attr('x1', $scope.rightLinePos)
			.attr('y1', 0)
			.attr('x2', $scope.rightLinePos)
			.attr('y2', $scope.yHeight)
			.style('stroke', 'black')
			.style('stroke-dasharray', '4,4');

		// Create top measure line
		$scope.topLine = $scope.wModel.append('line')
			.attr('class', 'guideLine')
			.attr('x1', 0)
			.attr('y1', $scope.aBot)
			.attr('x2', $scope.wWidth)
			.attr('y2', $scope.aBot)
			.style('stroke', 'black')
			.style('stroke-dasharray', '4,4');

		// Create bottom measure line
		$scope.botLine = $scope.wModel.append('line')
			.attr('class', 'guideLine')
			.attr('x1', 0)
			.attr('y1', $scope.bTop)
			.attr('x2', $scope.wWidth)
			.attr('y2', $scope.bTop)
			.style('stroke', 'black')
			.style('stroke-dasharray', '4,4');
	};

	$scope.addMeasureHandles = function(){
		// Create leftLine measure handle
		$scope.leftLineCir = $scope.wModel.append('circle')
			.attr('class', 'leftCircle')
			.attr('cx', $scope.leftLinePos)
			.attr('cy', $scope.aBot)
			.attr('r', 7)
			.style('cursor', 'move')
			.call(circleDrag);

		// Create right line measure handle
		$scope.rightLineCir = $scope.wModel.append('circle')
			.attr('class', 'rightCircle')
			.attr('cx', $scope.rightLinePos)
			.attr('cy', $scope.bTop)
			.attr('r', 7)
			.style('cursor', 'move')
			.call(circleDrag);
	};

	$scope.createWedgePaths = function(){
 		$scope.wPaths = [];
 		$scope.wPaths.push(
			[
		  	{"x":$scope.leftLinePos,"y":$scope.aBot},
		  	{"x":$scope.rightLinePos,"y":$scope.aBot},
		  	{"x":$scope.wWidth,"y":$scope.aBot, "hidden": true},
		  	{"x":$scope.wWidth,"y":$scope.aBot + $scope.yDifAB / $scope.count},
		  	{"x":$scope.rightLinePos,"y":$scope.aBot + $scope.yDifAB / $scope.count},
			]
		);
		for(var i = 0; i < $scope.count - 1; i++){
		var path = [];
		var ll = $scope.wPaths[$scope.wPaths.length - 1];
		for(var j = 0; j < ll.length; j++){
			if(j == 0){
				path.push({"x":ll[j].x, "y":ll[j].y});
			} else {
				path.push({"x":ll[j].x, "y":ll[j].y + $scope.yDifAB / $scope.count});
			}
		}
			$scope.wPaths.push(path);
		}
 	};

	$scope.toggleLines = function(){
		if($scope.linesOn == true){
			d3.selectAll('.guideLine').style('display', 'block');
			d3.selectAll('circle').style('display', 'block');
		} else {
			d3.selectAll('.guideLine').style('display', 'none');
			d3.selectAll('circle').style('display', 'none');
		}
	};

	// Create the base wedge svg
	$scope.container = d3.select(".fWM").append("svg")
		.attr('class', 'mcontainer')
	  .attr('width', $('.fWM').width())
	  .attr('height', $scope.yHeight + margin.top + margin.bottom)
	  .style('border', '1px solid grey');

	// add xWAxis
  $scope.container.append("g")
  	.attr('class', 'x axis')
	  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .call(wXAxis)
      .append("text")
      .attr("y", -35)
      .attr('x', $scope.wWidth / 2)
      .attr("dy", ".71em")
      .style("text-anchor", "middle")
      .text("X");

  // add yAxis 
  $scope.container.append('g')
  	.attr('class', 'y axis')
  	.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
  	.call(yAxis);

 	// add xYAxis
  // $scope.container.append('g')
  // 	.attr('class', 'x axis')
	 //  .attr('transform', 'translate(' + (margin.left + $scope.wWidth + 10) + ',' + margin.top + ')')
  //   .call(yXAxis)
  //     .append("text")
  //     .attr("y", -35)
  //     .attr('x', yWidth / 2)
  //     .attr("dy", ".71em")
  //     .style("text-anchor", "middle")
  //     .text("Y");

  // Create Wedge Model SVG
	$scope.mModel = $scope.container.append("g")
	  .attr('width', $scope.wWidth)
	  .attr('height', $scope.yHeight)
	  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	$scope.wModel = $scope.mModel.append("svg")
		.attr('class', 'fWModel')
	  .attr('width', $scope.wWidth)
	  .attr('height', $scope.yHeight)
	  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

	// $scope.wModel.append('line')
	// 	.attr('class', 'guideLine')
	// 	.attr('x1', $scope.wWidth)
	// 	.attr('y1', 0)
	// 	.attr('x2', $scope.wWidth)
	// 	.attr('y2', $scope.yHeight)
	// 	.style('stroke', 'black')
	// 	.style('stroke-width', 20)
	// 	.style("stroke-dasharray", "4,2");

	// Create Wedge Model Background fill
	$scope.wModel.append('rect')
		.attr('width', $scope.wWidth)
		.attr('height', $scope.yHeight)
		.style('fill', '#00cc99');

	$scope.createWedgePaths();
	console.log($scope.wPaths);
	$scope.addWedgePaths();
	$scope.addMeasureLines();
	$scope.addMeasureHandles();
	$scope.drawPaths();

	// Draw paths and collect them in an array 		// Draw Y Paths
	 // 	for(var i = 0; i < $scope.yPaths.length; i++){
	 // 		var color = "";
		// 	if(i % 2 == 0){
		// 		color = '#996633'; 
		// 	} else {
		// 		color = '#ecd9c6';
		// 	}
		// 	$scope.yModel.append('path')
		// 		.attr('d', lineFunction($scope.yPaths[i]))
		// 		.style('stroke-width', 1)
		// 		.attr('fill', color);
		// }

	// Create Y Model SVG
	// $scope.yModel = $scope.container.append("g")
	//   .attr('width', yWidth)
	//   .attr('$scope.yHeight', $scope.yHeight)
	//   .attr('transform', 'translate(' + ($scope.wWidth + margin.left + 10) + ',' + margin.top + ')')
	//   .style('border', '1px solid grey');

	// Create Y Model Background fill
	// $scope.yModel.append('rect')
	// 	.attr('width', yWidth)
	// 	.attr('$scope.yHeight', $scope.yHeight)
	// 	.style('fill', '#00cc99');

	$scope.changeValue = function(){
 		$scope.yDifAB = $scope.bTop - $scope.aBot;
 		// if($scope.modelType === 'sym'){
 		// 	$scope.createSymPaths();
 		// } else if($scope.modelType === 'bot'){
 		// 	$scope.createBotPaths();
 		// } else {
 		// 	$scope.createTopPaths();
 		// }
 		$scope.createWedgePaths();
 		$scope.drawPaths();
 	};

 	$scope.changeType = function(type){
 		$scope.modelType = type;
 		if(type === 'sym'){
 			$scope.createSymPaths();
 		} else if(type === 'bot'){
 			$scope.createBotPaths();
 		} else {
 			$scope.createTopPaths();
 		}
 	};

 	$scope.createSymPaths = function(){
 		// Add default path
 		$scope.yPaths = [];
		$scope.yPaths.push(
			[
				{"x":0, "y": $scope.aBot},
				{"x":yWidth, "y":$scope.aBot},
				{"x":yWidth, "y":$scope.aBot + $scope.yDifAB / $scope.count},
				{"x":0, "y": $scope.aBot + ($scope.yDifAB / 2) / $scope.count}
			]
		);

	 	for(var i = 0; i < $scope.count - 1; i++){
	 		var ll = $scope.yPaths[$scope.yPaths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[3].y},
					{"x":yWidth, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.yDifAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":yWidth, "y":ll[1].y},
					{"x":yWidth, "y":ll[1].y + $scope.yDifAB / $scope.count},
					{'x':0, 'y':ll[2].y + ($scope.yDifAB / 2) / $scope.count}
				];
			}
	 		$scope.yPaths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	$scope.createTopPaths = function(){
 		// Add default bot path
 		$scope.yPaths = [];
		$scope.yPaths.push(
			[
				{"x":yWidth, "y": $scope.aBot + $scope.yDifAB / $scope.count},
				{"x":yWidth, "y":$scope.aBot},
				{"x":0, "y":$scope.aBot + $scope.yDifAB / $scope.count},
			]
		);

	 	for(var i = 0; i < $scope.count; i++){
	 		var ll = $scope.yPaths[$scope.yPaths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[0].y},
					{"x":yWidth, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.yDifAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":yWidth, "y":ll[1].y},
					{"x":yWidth, "y":ll[1].y + $scope.yDifAB / $scope.count},
				];
			}
	 		$scope.yPaths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	$scope.createBotPaths = function(){
 		// Add default bot path
 		$scope.yPaths = [];
		$scope.yPaths.push(
			[
				{"x":0, "y": $scope.aBot},
				{"x":yWidth, "y":$scope.aBot},
				{"x":yWidth, "y":$scope.aBot + $scope.yDifAB / $scope.count},
			]
		);

	 	for(var i = 0; i < $scope.count; i++){
	 		var ll = $scope.yPaths[$scope.yPaths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[0].y},
					{"x":yWidth, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.yDifAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":yWidth, "y":ll[1].y},
					{"x":yWidth, "y":ll[1].y + $scope.yDifAB / $scope.count},
				];
			}
	 		$scope.yPaths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	// NEED THIS PLUGGED IN MY BEN!
 	$scope.saveModel = function(){

		var model = {};
		model.paths = $scope.yPaths;

		// Clear guide lines from image
		d3.selectAll('.guideLine').style('display', 'none');

	  var svg = d3.select(".fWModel").node(),
	      img = new Image(),
	      serializer = new XMLSerializer(),
	      svgStr = serializer.serializeToString(svg);

	  img.src = 'data:image/svg+xml;base64,'+window.btoa(svgStr);

    // You could also use the actual string without base64 encoding it:
    //img.src = "data:image/svg+xml;utf8," + svgStr;

    // UNCOMMENT THIS IF YOU WANNA TEST AND SEE WHAT THE IMAGE LOOKS LIKE WHEN SAVED TO CANVAS
    // var canvas = document.createElement("canvas");
    // document.body.appendChild(canvas);

    // canvas.width = $scope.wWidth;
    // canvas.height = $scope.yHeight;
    // canvas.getContext("2d").drawImage(img,0,0);


	};

	function moveCircle(){
		var m = d3.mouse(this);
		var x, y;

		// Check to see if we are in bounds for x
		if(m[0] > $scope.wWidth){
			x = $scope.wWidth;
		} else if(m[0] < 0){
			x = 0;
		} else {
			x = m[0];
		}

		// Check to see if we are in bounds for y
		if(m[1] > $scope.yHeight){
			y = $scope.yHeight;
		} else if(m[1] < 0){
			y = 0;
		} else {
			y = m[1];
		}

		var obj = d3.select(this);
		obj.attr('cx', x)
			.attr('cy', y);

		if(obj.attr('class') === 'leftCircle'){
			$scope.$apply(function(){
				$scope.aBot = y;
				if(x < $scope.rightLinePos){
					$scope.leftLinePos = x;
				} else {
					$scope.leftLinePos = $scope.rightLinePos;
				}
			});
		} else {
			$scope.$apply(function(){
				$scope.bTop = y;

				if(x > $scope.leftLinePos){
					$scope.rightLinePos = x;
				} else {
					$scope.rightLinePos = $scope.leftLinePos;
				}
			});
		}
		$scope.changeValue();
	};
});