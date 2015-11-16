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

	// Drag function
	var drag = d3.behavior.drag()
	  .origin(Object)
	  .on("drag", redraw);

	drawTops();

	function drawTops(){
		$scope.tops = [];
		for(var i = $scope.paths.length - 1; i >= 0; i--){
			var top = vis.append('g').attr('class', i);

			top.color = $scope.pathColors[i];
			top.append('path')
				.attr('id', "top" + i)
				.attr('d', area($scope.paths[i]))
				.style('stroke-width', 1)
				.attr('fill', $scope.pathColors[i])
				.style('stroke', 'black');

			top.selectAll("circle" + i)
				.data($scope.paths[i])
				.enter().append("circle")
				.style('fill', 'black')
				.attr('class', function(d, j){ return j;})
				.attr('cx', function(d){ return d.x; })
				.attr('cy', function(d){ return d.y; })
				.attr('r', 7)
				.style('cursor', 'move')
				.call(drag);

			$scope.tops.push(top);
		}
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

	function redraw(){
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