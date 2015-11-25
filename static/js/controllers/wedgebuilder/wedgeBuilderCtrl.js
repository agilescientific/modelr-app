app.controller('wedgeModelCtrl', function ($scope, $rootScope, modelBuilder) {

	var width = $('.wModel').width();
	var height = 600;
	var topHeight = 50;

	var lineFunction = d3.svg.line()                         
		.x(function(d) { return d.x; })
  	.y(function(d) { return d.y; });

	$scope.vis = d3.select(".wModel").append("svg")
	  .attr("width", width)
	  .attr("height", height)
	  .style('border', '1px solid grey');

	// Drag functions
	var circleDrag = d3.behavior.drag()
	  .origin(Object)
	  .on("drag", moveCircle);

	$scope.paths = [];
	var a = [
		{"x":0, "y":0, "hidden": true},
    {"x":width,"y":0, "hidden": true},
    {"x":width,"y":height - height * 0.75, "hidden": true},
    {"x":0, "y":height - height * 0.75, "hidden": true}
	];

	var b = [
		{"x":0, "y":height - height * 0.75, "hidden": true},
    {"x":width * 0.15,"y":height - height * 0.75, "hidden": false},
    {"x":width * 0.85,"y":height - height * 0.25, "hidden": false},
    {"x":width, "y":height - height * 0.25, "hidden": true},
    {"x":width, "y":height, "hidden": true},
    {"x":0, "y":height, "hidden": true},
	];

	var c = [
    {"x":width * 0.15,"y":height - height * 0.75, "hidden": true},
    {"x":width,"y":height - height * 0.75, "hidden": true},
    {"x":width,"y":height - height * 0.25, "hidden": true},
    {"x":width * 0.85,"y":height - height * 0.25, "hidden": true},
	];

	// var d = [
 //    {"x":width * 0.15,"y":height - height * 0.75, "hidden": true},
 //    {"x":width,"y":height - height * 0.75, "hidden": true},
 //    {"x":width,"y":height - height * 0.65, "hidden": true},
 //    {"x":width * 0.85,"y":height - height * 0.65, "hidden": true},
	// ];

	$scope.colors = ['pink', 'purple', 'green', 'grey'];
	//$scope.paths.push(a);

	// Add coupling
	// $scope.paths[2][1].coupled = [
	// 	{"i":2, "j": 0, "type":'y'},
	// 	{"i":0, "j": 2, "type":'y'},
	// 	{"i":0, "j": 3, "type":'y'},
	// 	{"i":1, "j": 1, "type": 'y'},
	// 	{"i":1, "j": 0, "type": 'both'}
	// ];
	// $scope.paths[2][2].coupled = [
	// 	{"i": 2, "j": 3, "type":'y'},
	// 	{"i": 1, "j": 2, "type": 'y'}, 
	// 	{"i": 1, "j": 3, "type":'both'}
	// ];

// green #ccffcc
	var count = 8;

	var aBottom = height - height * 0.75;
	var bTop = height - height * 0.25;
	var difAB = bTop - aBottom;

	var slice = [
  	{"x":width * 0.15,"y":aBottom, "hidden": true},
  	{"x":width * 0.85,"y":aBottom, "hidden": true},
  	{"x":width,"y":aBottom, "hidden": true},
  	{"x":width,"y":aBottom + difAB / count, "hidden": true},
  	{"x":width * 0.85,"y":aBottom + difAB / count, "hidden": true},
	];

	$scope.paths.push(slice);
	b[1].coupled = [{"i": 0, "j": 0, "type":'both'}];
	b[2].coupled = [];

	for(var i = 0; i < count - 1; i++){
		var path = [];
		var ll = $scope.paths[$scope.paths.length - 1];
		for(var j = 0; j < ll.length; j++){
			if(j == 0){
				path.push({"x":ll[j].x, "y":ll[j].y, "hidden": true});
				b[1].coupled.push({"i": i + 1, "j": j, "type":'both'});
			} else {
				path.push({"x":ll[j].x, "y":ll[j].y + difAB / count, "hidden": true});
			}
		}
		$scope.paths.push(path);
	}
	$scope.paths.push(a);
	b[1].coupled.push(
		{"i": $scope.paths.length - 1, "j": 2, "type":'y'},
		{"i": $scope.paths.length - 1, "j": 3, "type":'y'}
	);

	$scope.paths.push(b);
	$scope.paths[$scope.paths.length - 1][1].coupled
		.push({"i": $scope.paths.length - 1, "j": 0, "type":'y'});
	$scope.paths[$scope.paths.length - 1][2].coupled
		.push({"i": $scope.paths.length - 1, "j": 3, "type":'y'});

	$scope.drawPaths = function(){
		var color = '';
		for(var i = 0; i < $scope.paths.length; i++){
			if(i == $scope.paths.length - 2 || i == $scope.paths.length - 1){
				color = '#00cc99';
			} else {
				if(i % 2 == 0){
					color = '#996633'; 
				} else {
					color = '#ecd9c6';
				}
			}
			//var color = '#'+Math.floor(Math.random()*16777215).toString(16)
			var top = $scope.vis.append('g')
				.attr('class', i);
			modelBuilder.drawPath(top, $scope.paths[i], i, color);
			modelBuilder.drawCircles(top, $scope.paths[i], i);
			d3.selectAll('#circle' + i).call(circleDrag);
		}
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

		// Get the new bottom of the A section
		var aBottom = $scope.paths[$scope.paths.length - 2][2].y;

		// Get the new top of the B section
		var bTop = $scope.paths[$scope.paths.length - 1][3].y;

		// Get the difference between the top of the B section and bottom of the A section
		var difAB = bTop - aBottom;

		// Change root slice
		for(var i = 0; i < $scope.paths[0].length; i++){
			if(i < 3){
				$scope.paths[0][i].y = aBottom;
			} else {
				$scope.paths[0][i].y = aBottom + difAB / count;
			}
			if(i === 1 || i === 4){
				$scope.paths[0][i].x = $scope.paths[$scope.paths.length - 1][2].x;
			}
		}

		for(var w = 1; w < $scope.paths.length - 2; w++){
			for(var p = 1; p < $scope.paths[w].length; p++){
				$scope.paths[w][p].y = $scope.paths[w - 1][p].y + difAB / count;
				if(p === 1 || p === 4){
					$scope.paths[w][p].x = $scope.paths[$scope.paths.length - 1][2].x;
				}
			}
		}

		var parent = d3.select(this.parentNode);
		var i = parent.attr('class'), j = obj.attr('class');
		$scope.paths[i][j].x = x;
		$scope.paths[i][j].y = y;
		if($scope.paths[i][j].coupled){
			var cPaths = $scope.paths[i][j].coupled;
			for(var k = 0; k < cPaths.length; k++){

				if(cPaths[k].type == 'y'){
					$scope.paths[cPaths[k].i][cPaths[k].j].y = y;
				} else if(cPaths[k].type == 'x'){
					$scope.paths[cPaths[k].i][cPaths[k].j].x = x;
				} else {
					$scope.paths[cPaths[k].i][cPaths[k].j].y = y;
					$scope.paths[cPaths[k].i][cPaths[k].j].x = x;
				}
			}
		}
		
		for(var i = 0; i < $scope.paths.length; i++){
			var path = d3.select('#path' + i);
			path.transition().duration(5).attr('d', lineFunction($scope.paths[i])).ease('linear');
		}
	};

	$scope.drawPaths();

});