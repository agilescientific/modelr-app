setup1D = function(div){ 

    // Define the constants
    var image_height = 350;
    var height = 300;
    var width = 170;
    var rock_width = 60;
    var color_index = 0;
    var layer = 1;
    var rocks = [];
    
    var colors=['#CCAA99','#BBAADD',"#AACCDD", "#CC99AA", "#AAAACC"];
    var offset = 25;
    
    // Make the scale
    var yscale = d3.scale.linear()
	.domain([0,500]) 
	.range([offset, height]);

    
    // Make some objects
    var svg = d3.select(div).append("svg")
        .attr("width", width)
        .attr("height", image_height)

    // Main image group, translated so we have space for an axis	
    var main_group = svg.append("g")
	.attr("id", "main-group")
	.attr("transform","translate(30,0)");

    // Axis label (done horizontally then rotated)
    svg.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", 6)
	.attr("x", -50)
	.attr("dy", ".75em")
	.attr("transform", "rotate(-90)")
	.text("depth [m]")
    
    // Make an axis
    var yAxis = d3.svg.axis()
	.scale(yscale)
	.orient("right")
	.ticks(5)
    //add it to the main plot		  
    main_group.call(yAxis);
    
    // These groups are made in this order for specifically for layering
    var rects = main_group.append("g").attr("id", "rects");
    var lines = main_group.append("g").attr("id", "lines");
    // var circles = main_group.append("g").attr("id", "circles");
    
    // Resize drag behaviour
    var drag = d3.behavior.drag().on("drag", dragResize); 

    // Add the default first layers
    add_rock(0,0);
    add_rock(0,0);


    // Resize call back
    function dragResize(d){
	var event  = d3.event;
	d.thickness = yscale.invert(event.y) - d.depth;
	

	if (d.thickness < 0){d.thickness=0};
	updateRocks();
    };
    
    // Updates the data and redraws
    function updateRocks(){

	// Calculate the depths for each rock
	update_depths();
	// Update the scale
	update_scale();

	// Do the main rectangles first
	var rect = rects.selectAll("rect").data(rocks);
	
	// This updates the existing rectangles
	rect.attr("height", update_thickness)
	    .attr("y", update_depth)
	    .attr("fill", function(d){return d.color});

	// The enter function allows us to add elements for extra data
	rect.enter().append("rect")
	    .attr("y", update_depth)
	    .attr("x",60)
	    .attr("fill", function(d)
		  {return d.color})
	    .attr("height", update_thickness)
	    .attr("width", rock_width)
	    .on("click", add_top)
	    .on("contextmenu", delete_rock);
	
	rect.exit().remove();

	// Interface lines
	var interfaceLine = lines.selectAll("line").data(rocks);
	
	// existing
	interfaceLine.attr("y1", update_offset_bottom)
	    .attr("y2", update_offset_bottom);

	//for the new elements
	interfaceLine.enter().append("line")
	    .attr("x1", 60).attr("x2", 60 + rock_width)
	    .attr("y1", update_offset_bottom)
	    .attr("y2", update_offset_bottom)
	    .attr("style","stroke:rgb(0,0,0);stroke-width:2")
	    .attr("cursor", "ns-resize")
	    .call(drag);

	interfaceLine.exit().remove();

    };

    function update_scale(){
	// Updates the axis scaling
	var total = rocks[rocks.length -1].depth + rocks[rocks.length-1].thickness;
	yscale.domain([0, total*1.2]);

	yAxis = yAxis.scale(yscale);
	main_group.call(yAxis);

    }

    function delete_rock(d,i){
	d3.event.preventDefault();
	if (rocks.length > 1){
	    rocks.splice(i,1);


	    updateRocks();
	};
    }

    function update_depths(){
	// Updates the depth of each layer
	
	rocks[0].depth = 0;
	for (var i =1; i< rocks.length; i++){
	    rocks[i].depth = rocks[i-1].depth + rocks[i-1].thickness;
	};
    };
    

    // FUnctions for D3 callbacks
    function update_thickness(d){
	return yscale(d.thickness) -offset;
    }

    function update_offset_bottom(d){
	return yscale(d.depth + d.thickness);

    };
    function  update_depth(d){
	return yscale(d.depth);
    }
    


    function add_top(d,i){
	// adds an interface top at the mouse click position
	
	d.thickness = yscale.invert(d3.mouse(this)[1]);

	add_rock(i);
    }
	
    function add_rock(i){
	// adds a rock to the model at position i + 1

	var rock = {thickness: 50,
		    color: colors[color_index]};

	if (rocks.length == 0){
	    rock.depth = 0
	} else {
	    rock.depth = rocks[rocks.length - 1].depth +rocks[rocks.length-1].thickness};

	
	rocks.splice(i+1,0,rock);

	updateRocks();
	color_index++;
	color_index = color_index % colors.length;
	layer++;

    };
};
