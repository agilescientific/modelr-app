function FluidSub(image_div, image_height, image_width,
		  rocks, fluids, rock_cmap, fluid_cmap){


    var max_depth = 10000.0;
    var total_depth = max_depth * .10;
    
    var plot_height = .9*image_height;
    var y_offset = .05 * image_height;

    var x_offset = .3 * image_width; // space for axis

    var intervals = [];
    
    var rock_width = .2 * image_width ;
    var fluid_width = .2 * image_width;

    // Make the y scales
    var scale = d3.scale.linear()
        .domain([0,total_depth]) 
        .range([y_offset, plot_height]);

    // For adjusting the maximum depth of the scale
    var max_scale = d3.scale.linear()
        .domain([0, max_depth])
        .range([y_offset, plot_height]);


    // Initialize the image canvas
    var canvas = d3.select(image_div)
	.append("svg")
	.attr("width", image_width)
	.attr("height", image_height);

    //------ Main canvas -------------------------//    
    canvas.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "end")
        .attr("y", .2*image_width)
        .attr("x", -50)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("depth [m]");

	


    // scaling circle
    var circle = canvas.append("g");
    

    //-------------------Rock Graphics-------------------

    // Make the rock element grouping
    var y_offset = y_offset;
    var rgroup = canvas.append("g")
	.attr("transform", "translate(" + x_offset.toString() + ",0)");

    // Title/plot label
    rgroup.append("text")
        .attr("class", "menu-label")
	.attr("style", "color:blue")
        .attr("text-anchor", "beginning")
        .attr("y", 0) 
        .attr("x", 25)
        .text("Rocks")
	.attr("cursor", "pointer");

    var yAxis = d3.svg.axis()
        .scale(scale)
        .orient("right")
        .ticks(5);
	rgroup.call(yAxis);

    // These groups are made in this order for specifically for 
    // layering order
    var rock_offset = .3 * image_width;
    var rock_intervals = rgroup.append("g")
	.attr("transform", "translate("+rock_offset.toString() +",0)");
    var rock_tops = rgroup.append("g")
	.attr("transform", "translate("+rock_offset.toString() +",0)"); 

    // Load up to intervals
    add_interval(0,0,total_depth);
    add_interval(1, total_depth/2,total_depth/2);

    // --------------- end of init --------------------------- //

    function add_interval(i, depth, thickness){
	// adds an interval with depth and thickness at the ith layer
	
	// Initialize with a rock
	var rock_ind = i % rocks.length;
	
	var interval = {depth: depth,
			rock: rocks[rock_ind]};
	interval.colour = rock_cmap[interval.rock.name];

	// Check that thickness is defined
	if(typeof thickness !== 'undefined'){
            interval.thickness = thickness;
	};
	
	if(typeof interval.rock.fluid !== 'undefined'){
	    interval.fluid_colour = fluid_cmap[interval.rock.fluid];

	    var fluid_ind = i % fluids.length;
	    interval.subfluids = {depth: depth,
			      fluid: fluids[fluid_ind],
			      thickness: interval.thickness}
	    interval.subfluids.colour = 
		fluid_cmap[interval.subfluids.fluid.name];
	};

	// Add to the interval data list
	intervals.splice(i+1,0, interval);
	
	// update the interval thickness
	calculate_thickness();
	
	// update the core plot
	draw();
    };

    function calculate_thickness(){
	// updates the thickness values in each layer

	// Depth of model
	var end_point = intervals[intervals.length-1].depth +
            intervals[intervals.length-1].thickness;

	// calculation thickness based on depths of tops
	for (var i=0; i<intervals.length-1; i++) {    
            intervals[i].thickness = 
		intervals[i+1].depth - intervals[i].depth;
	};
	
	// Update the last layer
	intervals[intervals.length-1].thickness = end_point - 
            intervals[intervals.length-1].depth;
    };


    function draw(){
	// Updates the d3 associations and redraws the plot

	// -------------------- Rock Graphics --------------//

	var interval = rock_intervals.selectAll("g")
	    .data(intervals);

	var interval_group = interval.enter().append("g")

	interval_group.append("rect")
	    .attr("y", update_depth)
            .attr("fill", function(d)
		  {return d.colour})
            .attr("height",update_thickness)
            .attr("width", rock_width)
            .attr("cursor","crosshair")
	    .on("click", add_top)
            .on("contextmenu", delete_interval);

	    
	var rock_fluid = interval_group.selectAll("#rock_fluid")
	    .data(function(d){
		if (d.rock.fluid){
		    return [d]} else return []})
	    .enter().append("rect")
	    .attr("id", "rock_fluid")
	    .attr("y", update_depth)
            .attr("fill", function(d)
		  {return d.fluid_colour})
            .attr("height",update_thickness)
	    .attr("x", "45")
            .attr("width", "10")
            .attr("cursor","crosshair")

	var fluidsub_group = interval_group.selectAll("#subfluid")
	    .data(function(d){ return [d.subfluids]})
	    .enter().append("rect")
	    .attr("id", "subfluid")
	    .attr("fill", function(d)
		  {return d.colour})
	    .attr("y", update_depth)
            .attr("height",update_thickness)
            .attr("width", "10")
	    .attr("x", "60")
            .attr("cursor","crosshair")

	var a =1;





    };

    // Functions for D3 callbacks
    function update_thickness(d){
	return scale(d.thickness) - y_offset;
    };

    function update_depth(d){
	return scale(d.depth);
    };

    function update_bottom(d) {
	return scale(d.depth + d.thickness);
    };


    function add_top(d,i){
	/*
	  adds a top to the core at the ith interval
	  param d: core rock attached to the ith interval
	  param i: interval to place top
	*/

	var bottom = d.depth + d.thickness;
	d.thickness = scale.invert(d3.mouse(this)[1]) - d.depth;
	
	var depth = d.depth + d.thickness;
	var thickness = bottom - depth;
	
	add_interval(i, depth, thickness);

    };

    function delete_interval(d,i){
	// deletes interval d from the ith layer
	
	d3.event.preventDefault();
	// always keep 2 layers
	if (intervals.length > 2 & (i > 0)) {
	    if (i == (intervals.length-1)) {
		intervals[i-1].thickness = 
		    d.thickness + d.depth - intervals[i-1].depth;
	    } // end of inner if
	    intervals.splice(i,1);
	    calculate_thickness();
	    draw();
	} // end of outer if
    } // end of function delete_intercall

};

