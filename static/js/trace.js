function tracePlot(log_group,property,label,offset, colour,
		   seis_menu){

   
    $(seis_menu).hide();

    var propScale = d3.scale.linear() 
	.range([0,50]);
 
    var tScale = d3.scale.linear()
	.range([0, 50]);

    var plot = log_group.append("g")
	.attr("transform", "translate("+offset.toString()+",0)");

    var synthFill = d3.svg.area()
	.x0(0)
	.x1(function(d) {
	    return propScale(d.synthetic);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
    var lineFunc = d3.svg.line()
	.x(function(d) {
	    return propScale(d[property]);
	})
	.y(function(d) {
	    return tScale(d.t);
	});

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
	
	plot.selectAll("path").remove();

	plot.append("path")
	    .attr("class", 'wiggle-fill')
	    .attr("d", synthFill(paired_data));

	// Rather than slapping a rect on top
	// I think it would be better to use a clipPath
	plot.append("rect")
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", propScale(0))
	    .attr("height", height)
	    .attr("fill", 'white');
	plot.append("path")
	    .attr("class", 'wiggle-line')
	    .attr("d", lineFunc(paired_data));
    }; // end of function update_plot
    
    
    function show_menu(){
	$(seis_menu).show();
	$(seis_menu).dialog();
    };
};






























