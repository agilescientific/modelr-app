app.controller('wMYCtrl', function ($scope, modelBuilder) {

	var width = $('.wMY').width();
	var height = 400;

	// Create the base svg
	$scope.yModel = d3.select(".wMY").append("svg")
	  .attr('width', width)
	  .attr('height', height)
	  .style('border', '1px solid grey');

	// Add a background color
	$scope.yModel.append('rect')
		.attr('width', width)
		.attr('height', height)
		.style('fill', '#00cc99');

	var lineFunction = d3.svg.line()                         
		.x(function(d) { return d.x; })
  	.y(function(d) { return d.y; });

 	$scope.paths = [];
 	$scope.aBot = 100;
 	$scope.bTop = 300;
 	$scope.difAB = $scope.bTop - $scope.aBot;
 	$scope.count = 5;

 	$scope.changeValue = function(){
 		$scope.difAB = $scope.bTop - $scope.aBot;
 		if($scope.modelType === 'sym'){
 			$scope.createSymPaths();
 		} else if($scope.modelType === 'bot'){
 			$scope.createBotPaths();
 		} else {
 			$scope.createTopPaths();
 		}
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
 		$scope.paths = [];
		$scope.paths.push(
			[
				{"x":0, "y": (2*($scope.aBot) + $scope.difAB / $scope.count) / 2},
				{"x":width, "y":$scope.aBot},
				{"x":width, "y":$scope.aBot + $scope.difAB / $scope.count},
			]
		);

	 	for(var i = 0; i < $scope.count - 1; i++){
	 		var ll = $scope.paths[$scope.paths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[0].y},
					{"x":width, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.difAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":width, "y":ll[1].y},
					{"x":width, "y":ll[1].y + $scope.difAB / $scope.count},
				];
			}
	 		$scope.paths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	$scope.createTopPaths = function(){
 		// Add default bot path
 		$scope.paths = [];
		$scope.paths.push(
			[
				{"x":width, "y": $scope.aBot + $scope.difAB / $scope.count},
				{"x":width, "y":$scope.aBot},
				{"x":0, "y":$scope.aBot + $scope.difAB / $scope.count},
			]
		);

	 	for(var i = 0; i < $scope.count; i++){
	 		var ll = $scope.paths[$scope.paths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[0].y},
					{"x":width, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.difAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":width, "y":ll[1].y},
					{"x":width, "y":ll[1].y + $scope.difAB / $scope.count},
				];
			}
	 		$scope.paths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	$scope.createBotPaths = function(){
 		// Add default bot path
 		$scope.paths = [];
		$scope.paths.push(
			[
				{"x":0, "y": $scope.aBot},
				{"x":width, "y":$scope.aBot},
				{"x":width, "y":$scope.aBot + $scope.difAB / $scope.count},
			]
		);

	 	for(var i = 0; i < $scope.count; i++){
	 		var ll = $scope.paths[$scope.paths.length - 1];
	 		if(i % 2 == 0){
				var path = [
				 	{"x":0, "y": ll[0].y},
					{"x":width, "y":ll[2].y},
					{"x":0, "y":ll[0].y + $scope.difAB / $scope.count},
				];
	 		} else {
				var path = [
				 	{"x":0, "y": ll[2].y},
				 	{"x":width, "y":ll[1].y},
					{"x":width, "y":ll[1].y + $scope.difAB / $scope.count},
				];
			}
	 		$scope.paths.push(path);
	 	}
	 	$scope.drawPaths();
 	};

 	$scope.drawPaths = function(){
 		d3.selectAll('path').remove();
	 	for(var i = 0; i < $scope.paths.length; i++){
	 		var color = "";
			if(i % 2 == 0){
				color = '#996633'; 
			} else {
				color = '#ecd9c6';
			}
			$scope.yModel.append('path')
				.attr('d', lineFunction($scope.paths[i]))
				.style('stroke-width', 1)
				.attr('fill', color);
		}
	};
});