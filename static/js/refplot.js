function refPlot(log_group,property,label,offset, colour,
		 ref_menu){

   

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
	.text(label)
	.attr("cursor", "pointer")
	.on("click", show_menu);


    this.update_plot = function update_plot(data, height){
	



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
	
	plot.selectAll("rect.rc-stick").remove();

	// Draw sticks for the reflectivities, instead of a line
	plot.selectAll("rect")
	    .data(data.reflectivity)
	    .enter()
	    .append("rect")
	    .attr("class", "rc-stick")
	    .attr("x", function(d) {
		if (d > 0) {
		    return propScale(0);
		} else {
		    return propScale(0) + d*100; // -ve d
		}
	    })
	    .attr("y", function(d, i) {
		return i * (height / data.reflectivity.length);
	    })
	    .attr("width", function(d) {
		return Math.abs(d*100);
	    })
	    .attr("height", height / (1.2*data.reflectivity.length));
	
    }; // end of function update_plot

    function show_menu(){
	$(ref_menu).show();
	$(ref_menu).dialog();
    };
};






























