function logPlot(log_group,property,label,offset, width, 
		 height, colour,dash){




    var propScale = d3.scale.linear() 
	.range([0,20]);
 
    var tScale = d3.scale.linear()
	.range([0, 20]);

    var plot = log_group.append("g")
	.attr("transform", "translate("+offset.toString()+",0)");

    // Axis labels
    plot.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "start")
	.attr("y", -.05*height)
	.attr("x", 2)
	.text(label);


    var lineFunc = d3.svg.line()
	.x(function(d) {
	    return propScale(d[property]);
	})
	.y(function(d) {
	    return tScale(d.t);
	});

    this.update_plot = function update_plot(data){
	



	var paired_data = [];

	for(var i=0; i < data[property].length; i++){
	    var point = {};
	    point[property] = data[property][i]||0;
	    point["t"] = data.t[i];

  	    paired_data[i] = point;
	} // end of for

	propScale.domain([Math.min.apply(Math,data[property]), 
  			  Math.max.apply(Math,data[property])]);

	tScale.domain(data.t);
	tScale.range(data.scale);
	

	plot.selectAll("path").remove();

	var line = plot.append("path")
            .attr("d", lineFunc(paired_data))
            .attr('stroke', colour)
            .attr('stroke-width', 1)
            .attr('fill', 'none');
	if(dash){
	    line.style("stroke-dasharray", ("3, 3"));
	};
    }; // end of function update_plot
};






























