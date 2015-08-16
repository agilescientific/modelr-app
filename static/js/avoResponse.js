setupAVO = function(svg_group, properties, label, 
		    offset, width, height, colour){


    // Offset this curve
    var t = "translate("+offset.toString()+",0)";
    var plot = log_group.append("g")
        .attr("transform", t);

    // Append axis labels
    plot.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "start")
        .attr("y", -0.05*height)
        .attr("x", 0)
        .text(label);


    this.update_plot = function update_plot(data, theta){
    
	// Find Max/Min
	
	// Make scales
	
	// Make the axis
	
	// Make the line func
	
	// Clear the data

	// Set the linestyle attributes

}
