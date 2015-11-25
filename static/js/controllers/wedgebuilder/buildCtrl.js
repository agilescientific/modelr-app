app.controller('buildCtrl', function ($scope, $rootScope) { 
	$scope.type = 'none';

	$scope.changeType = function(type){
		$scope.type = type;
	};

});


app.service('modelBuilder', function () { 
	var lineFunction = d3.svg.line()                         
		.x(function(d) { return d.x; })
  	.y(function(d) { return d.y; });

	this.drawPath = function(elem, path, index, color){
		elem.append('path')
			.attr('id', 'path' + index)
			.attr('d', lineFunction(path))
			.style('stroke-width', 1)
			//.style('stroke', 'black')
			.attr('fill', color);
	};

	this.drawCircles = function(elem, path, index){
		for(var i = 0; i < path.length; i++){
			if(path[i].hidden === false){
				elem.append('circle')
					.style('fill', 'black')
					.attr('class', i)
					.attr('id', 'circle' + index)
					.attr('cx', path[i].x)
					.attr('cy', path[i].y)
					.attr('r', 7)
					.style('cursor', 'move');
			}
		}
		// elem.selectAll("circle" + index)
		// 	.data(path)
		// 	.enter().append("circle")
		// 	.style('fill', 'black')
		// 	.attr('class', function(d, j){ return j;})
		// 	.attr('id', function(d, j){ return 'circle' + index;})
		// 	.attr('cx', function(d){ return d.x; })
		// 	.attr('cy', function(d){ return d.y; })
		// 	.attr('r', 7)
		// 	.style('cursor', 'move');
	};

});