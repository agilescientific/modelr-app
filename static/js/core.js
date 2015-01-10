/*
  Class for interactive core plots
*/

function Core(div, image_height, image_width, material,
	      colour_map, max_depth, title, menu,
	      axis, onchange){
    /*
      param div: div object that will hold the core plot
      param image_height: Height in pixels of the core image
      param image_width: The width in pixels of the image
      param material: List of core materials to use for interval 
      building.
      param colour_map: Dict mapping material names to colours
      param max_depth: Maximum allowed depth of the core plot.
      param title: Title for the plot
      param menu: div object for the menu gui.
      param axis: bool specifying whether to put an axis
    */

    var material = material;
    var intervals = [];

    var menu = menu;
    var colour_map = colour_map;
    var interval_width = 100;
    var max_depth = max_depth;
    var title = title;
    var total_depth = max_depth/10.
    var axis = axis;

   
    // 10 % pad
    var height = image_height-(.1*image_height);

    // Make the scale
    var scale = d3.scale.linear()
        .domain([0,total_depth]) 
        .range([0, height]);

    
    var max_scale = d3.scale.linear()
        .domain([0, max_depth])
        .range([0, height]);



    var canvas = d3.select(div)
	.append("svg")
	.attr("width", image_width)
	.attr("height", image_height);



    var core_group = canvas.append("g");
    if(axis){
	    core_group.attr("transform","translate(40,40)");
	var x_offset = 60;
    } else{
	core_group.attr("transform","translate(0,40)");
	var x_offset = 0;
    };

    core_group.append("text")
        .attr("class", "menu-label")
	.attr("style", "color:blue")
        .attr("text-anchor", "beginning")
        .attr("y", -25) 
        .attr("x", 25)
        .text(title)
	.attr("cursor", "pointer")
	.on("click", show_menu);


    // These groups are made in this order for specifically for layering
    var rects = core_group.append("g");
    var lines = core_group.append("g");

    if(axis){
	core_group.append("text")
            .attr("class", "y-label")
            .attr("text-anchor", "end")
            .attr("y", -25)
            .attr("x", -50)
            .attr("dy", ".75em")
            .attr("transform", "rotate(-90)")
            .text("depth [m]");

  
	var yAxis = d3.svg.axis()
            .scale(scale)
            .orient("right")
            .ticks(5);
	core_group.call(yAxis);
	var circle = core_group.append("g")

    };



    
    // Resize drag behaviour

    var drag = d3.behavior.drag().on("drag", dragResize)
        .on("dragend", function(){
	    onchange(intervals);});
    var scale_drag = d3.behavior.drag().on("drag", scaleDrag)
        .on("dragend", rescale);

    add_interval(0,0,total_depth);
    add_interval(1, total_depth/2,total_depth/2);

    if(axis){
	slide_scale();
    };

    show_menu();

    function show_menu(){
	$(menu).show();
	$(menu).dialog();
    };


    function rescale(){
	calculate_thickness();
	update();
    };

    function add_interval(i, depth, thickness){
	// adds an interval of depth and thickness under the ith top
	
	// Choose a random material for initialization
	var name_index = i % material.length
	
	// Define a new interval
	var interval = {depth:depth,
			name: material[name_index].name,
			db_key: material[name_index].db_key};
	interval.colour = colour_map[interval.name];


	// Check that thickness is defined
	if(typeof thickness !== 'undefined'){
            interval.thickness = thickness;
	};

	// Add to the interval data list
	intervals.splice(i+1,0, interval);

	// update the interval thickness
	calculate_thickness();

	onchange(intervals);
	// update the core plot
	update();

    };

    function calculate_thickness(){
	// updates the thickness values of each layer
	
	var end_point = intervals[intervals.length-1].depth +
            intervals[intervals.length-1].thickness;
	for (var i=0; i<intervals.length-1; i++) {    
            intervals[i].thickness = 
		intervals[i+1].depth - intervals[i].depth;
	};
	
	intervals[intervals.length-1].thickness = end_point - 
            intervals[intervals.length-1].depth;
    };

    function slide_scale(){
	
	var scale_circle = circle.selectAll("circle")
            .data([total_depth]);
	
	scale_circle.attr("cy",function(d){return max_scale(d);});
	
	scale_circle.enter().append("circle")
            .attr("cx",0)
            .attr("cy", function(d){return max_scale(d);})
            .attr("r", "5")
            .attr("stroke","black")
            .attr("stroke-width","3")
            .attr("fill","red") 
            .attr("cursor", "ns-resize")
            .call(scale_drag);
    };

    function scaleDrag(){
	
	var old_depth = total_depth;
	// update it
	total_depth = max_scale.invert(d3.event.y);
	if(total_depth > max_depth){
            total_depth = max_depth;
	}
	if(total_depth < 1){
            total_depth=1;
	}
	
	var scale_factor = total_depth / old_depth;
	
	intervals[0].thickness *= scale_factor;
	for(var i=1; i < intervals.length; i++){
            intervals[i].depth = intervals[i-1].depth + intervals[i-1].thickness; 
            intervals[i].thickness *= scale_factor;
	}
	
	var scale_max = scale.domain()[1] * scale_factor;
	scale.domain([0, scale_max]);
	if(axis){
	    yAxis.scale(scale);
	    core_group.call(yAxis);

	    slide_scale();
	};
    } // end of function


    function update_scale(){
	
	// Updates the axis scaling
	var total = intervals[intervals.length -1].depth + 
            intervals[intervals.length-1].thickness;
	
	scale.domain([0,total]);
	if(axis){
	    yAxis = yAxis.scale(scale);
	    core_group.call(yAxis);
	};
    };

    function update(){



	// update the data
	var interval = rects.selectAll("rect").data(intervals);

	// This updates the existing rectangles
	interval.attr("height", update_thickness)
            .attr("y", update_depth)
            .attr("fill", function(d){return d.colour});

	// The enter function allows us to add elements for extra data
	interval.enter().append("rect")
            .attr("y", update_depth)
            .attr("x",x_offset)
            .attr("fill", function(d)
		  {return d.colour})
            .attr("height",update_thickness)
            .attr("width", interval_width)
            .attr("cursor","crosshair")
            .on("click", add_top)
            .on("contextmenu", delete_interval);

	// remove unused layers
	interval.exit().remove();
    	
	// Tops
	var top = lines.selectAll("line")
            .data(intervals.slice(1, intervals.length));
	
	// existing
	top.attr("y1", update_depth)
            .attr("y2",update_depth);
	
	//for the new elements
	top.enter()
            .append("line")
            .attr("x1", x_offset).attr("x2", x_offset + 
				       interval_width)
            .attr("y1", update_depth)
            .attr("y2", update_depth)
            .attr("style","stroke:rgb(0,0,0);stroke-width:2")
            .attr("cursor", "ns-resize")
            .on("contextmenu", delete_top)
            .call(drag);
	
	top.exit().remove();
	
	// Do the rock menu updates
	var colour_map = d3.select(menu).selectAll(".row")
            .data(intervals);
	
	var select = colour_map.html(colour_block).append("select")
	    .on("change", update_rock);

	// add a menu row for every interval
	colour_map.enter().append("div").attr("class","row")
	    .html(colour_block)
	    .append("select").on("change", update_rock);

	select = colour_map.selectAll("select");
	var option = select.selectAll("option").data(material);

	// add the material to the drop down list
	option.enter().append("option")
	    .text(function(d){return d.name;})
	    .attr("value",function(d)
		  {return d.db_key;})
	    .property("selected", function(){
		var key = d3.select(this.parentNode).datum().db_key;
		if(key == this.value){
		    return true} else{
			return false}
	    });
	
	// Delete left over elements
	colour_map.exit().remove();

    };


    // Functions for D3 callbacks
    function update_thickness(d){
	return scale(d.thickness);
    };

    function update_depth(d){
	return scale(d.depth);
    };

    function update_bottom(d) {
	return scale(d.depth + d.thickness);
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
	    update();
	    onchange(intervals);
	} // end of outer if
    } // end of function delete_intercall



    function delete_top(d,i){
	d3.event.preventDefault();
	// first interval does not have a top
	delete_interval(intervals[i+1],i+1);
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

    function colour_block(d,i){
	return '<div class="cblock" style="margin0 6px 0 0; background-color:' +d.colour+'; display:inline-block"></div>'
    }

    // Resize call back
    function dragResize(d,i){
	var event = d3.event;
	var end_point = d.depth + d.thickness;
	d.depth = scale.invert(event.y);
	if(d.depth > end_point){
	    d.depth=end_point
	}
	var start_point = intervals[i].depth;
	if(d.depth < start_point){
	    d.depth = start_point;
	}
	if(i < intervals.length-2){
	    intervals[i+2].depth = end_point;
	} else{
	    d.thickness = end_point - d.depth;
	}

	calculate_thickness();
	update();

    } // end of dragResize
    function update_rock(d){
	// updates rock layer and sends data to server
	d.db_key = this.value;
	d.name = this[this.selectedIndex].text;
	d.colour = colour_map[d.name];
	onchange(intervals);
	update();
    } // end of function update_rocl
};
