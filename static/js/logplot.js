function logPlot(log_group,properties,label,offset, width, 
		 height, colour){




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




    this.update_plot = function update_plot(data){
	


	var dash = false;

	// Set the scale
	var max_val = -1000000;
	var min_val = 200000000;
	for(var log_ind = 0; log_ind < properties.length; log_ind++){
	    var log_max = Math.max.apply(Math,data[properties[log_ind]]);
	    var log_min = Math.min.apply(Math,data[properties[log_ind]]);
	    if(log_min < min_val){
		min_val = log_min;
	    };
	    if(log_max > max_val){
		max_val = log_max;
	    };
	    
	};
	propScale.domain([min_val, 
  			  max_val]);
	tScale.domain(data.t);
	tScale.range(data.scale);
	

	// Clear old plot
	plot.selectAll("path").remove();


	for(var log_ind = 0; log_ind < properties.length; log_ind++){

	    var property = properties[log_ind];

	    var lineFunc = d3.svg.line()
		.x(function(d) {
		    return propScale(d[property]);
		})
		.y(function(d) {
		    return tScale(d.t);
		});

	 

	    var paired_data = [];

	    for(var i=0; i < data[property].length; i++){
		var point = {};
		point[property] = data[property][i]||0;
		point["t"] = data.t[i];

  		paired_data[i] = point;
	    } // end of for



	    var line = plot.append("path")
		.attr("d", lineFunc(paired_data))
		.attr('stroke', colour)
		.attr('stroke-width', 1)
		.attr('fill', 'none');
	    if(dash){
		line.style("stroke-dasharray", ("3, 3"));
	    };

	    dash = true;
	};
    }; // end of function update_plot
};






























