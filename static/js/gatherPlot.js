function gatherPlot(svg_group, offset, key, label,seis_menu){




    $(seis_menu).hide();

    $("#frequency").on("change", function (){
	$("#frequency-label").text($("#frequency").val())
    }
		      );


    var tScale = d3.scale.linear()
	.range([0, 3.5]);

    var thetaScale = d3.scale.linear()
	.range([0,10]);

    var plot = svg_group.append("g")
	.attr("transform", "translate("+offset.toString()+",0)");





    // Axis labels
    plot.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "middle")
	.attr("y", -25)
	.attr("x", 25)
	.text(label)
	.on("click", show_menu)
	.attr("cursor", "pointer");



    this.update_plot = function update_plot(data, height){
	

	// Clear the plot
	plot.selectAll("path").remove();

	// Set the time and theta scales
	tScale.domain(data.t);
	thetaScale.domain(data.theta);

	tScale.range(data.scale);

	for(var wiggle_hack=0;wiggle_hack<2;wiggle_hack++){
	    // Plot each trace in the data
	    for(var trace_ind=0; trace_ind < data.theta.length;
		trace_ind++){

		var trace = data[key][trace_ind];
		var theta = data.theta[trace_ind];
		
		// Make a data pair for the current trace
		var paired_data = [];
		for(var i=0; i < trace.length; i++){
		    var point = {};
		    point["amplitude"] = trace[i]||0;
		    point["t"] = data.t[i];
		    
  		    paired_data[i] = point;
		} // end of for


		// Make a scale for the trace amplitude
		var ampScale = d3.scale.linear().domain([-1,1]);
		ampScale.range([thetaScale(theta)-50, 
				thetaScale(theta) + 50]);

		// Line drawing function
		var synthFill = d3.svg.area()
		    .x0(0)
		    .x1(function(d) {
			return ampScale(d.amplitude);
		    })
		    .y(function(d) {
			return tScale(d.t);
		    });
		var lineFunc = d3.svg.line()
		    .x(function(d) {
			return ampScale(d.amplitude);
		    })
		    .y(function(d) {
			return tScale(d.t);
		    });
		

		// Draw the trace
		plot.append("path")
		    .attr("class", 'wiggle-fill')
		    .attr("d", lineFunc(paired_data));
		
		/// Rather than slapping a rect on top
		// I think it would be better to use a clipPath
		plot.append("rect")
	    	    .attr("x", ampScale(0))
		    .attr("y", tScale(0))
		    .attr("width", ampScale(1))
		    .attr("height", height)
		    .attr("fill", 'white')
		    .attr("stroke", 'white');
		
		if(wiggle_hack == 1){
		    plot.append("path")
			.attr("class", 'wiggle-line')
			.attr("d", lineFunc(paired_data));
		};
	    };
	};
    };

    function show_menu(){
	$(seis_menu).show();
	$(seis_menu).dialog();
    };


};
