function logPlot(log_group,property,label,offset, colour){

   

    var propScale = d3.scale.linear() 
	.range([0,50]);
 
    var tScale = d3.scale.linear()
	.range([0, 50]);

    var plot = log_group.append("g")
	.attr("transform", "translate("+offset.toString()+",0)");

    // Axis labels
    plot.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "middle")
	.attr("y", -25)
	.attr("x", 25)
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

	plot.append("path")
            .attr("d", lineFunc(paired_data))
            .attr('stroke', colour)
            .attr('stroke-width', 1)
            .attr('fill', 'none');

    }; // end of function update_plot
};






























