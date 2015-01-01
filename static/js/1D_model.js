setup1D = function(model_div, plot_div, db_rocks){ 

    // Define the constants
    var image_height = 350;
    var height = 300;
    var width = 170;
    var plot_height = 350;
    var plot_width = 400;
    var rock_width = 60;
    var color_index = 0;
    var layer = 1;
    var rocks = [];
    var rock_names = db_rocks;
    var colors=['#CCAA99','#BBAADD',"#AACCDD", "#CC99AA", "#AAAACC"];
    var offset = 25;
    var select, option
    
    // Make the scale
    var yscale = d3.scale.linear()
	.domain([0,500]) 
	.range([offset, height]);
    var vsScale = d3.scale.linear() 
	.range([0,75]);
    var vpScale = d3.scale.linear()
	.range([0, 75]);
    var rhoScale = d3.scale.linear()
	.range([0, 75]);
    var zScale = d3.scale.linear()
	.range([0, height]);
    
    // Make some objects
    var layer_svg = d3.select(model_div).append("svg")
        .attr("width", width)
        .attr("height", image_height)

    // Main image group, translated so we have space for an axis	
    var layer_group = layer_svg.append("g")
	.attr("id", "layer-group")
	.attr("transform","translate(40,0)");


    // Axis label (done horizontally then rotated)
    layer_svg.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", 6)
	.attr("x", -50)
	.attr("dy", ".75em")
	.attr("transform", "rotate(-90)")
	.text("depth [m]");
    
    // Make some axes
    var yAxis = d3.svg.axis()
	.scale(yscale)
	.orient("right")
	.ticks(5);

    var rhoAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    var vsAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    var vpAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    var zAxis = d3.svg.axis()
	.orient("left")
	.ticks(5);

    //add it to the main plot		  
    layer_group.call(yAxis);
    
    // These groups are made in this order for specifically for layering
    var rects = layer_group.append("g").attr("id", "rects");
    var lines = layer_group.append("g").attr("id", "lines");
  
    // Resize drag behaviour
    var drag = d3.behavior.drag().on("drag", dragResize)
	                         .on("dragend", update_data);
    // Add the default first layers
    add_rock(0);
    add_rock(1);

    // Setup the plot
    var plot_svg = d3.select(plot_div).append("svg")
	         .attr("height", plot_height)
	         .attr("width", plot_width);
    var log_group = plot_svg.append("g").attr("id", "log-group")
	                    .attr("transform", "translate(40,40)");
    var rho_g = log_group.append("g")
	        .attr("transform", "translate(0,0)")
    var vs_g = log_group.append("g")
	.attr("transform", "translate(100,0)")
    var vp_g = log_group.append("g")
	.attr("transform", "translate(200,0)")

    // Axis labels
    rho_g.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", -25)
	.attr("x", 20)
	.text("rho");
    vp_g.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", -25)
	.attr("x", 20)
	.text("vp");
    vs_g.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y",-25)
	.attr("x", 20)
	.text("vs");


    var vpFunc = d3.svg.line()
	.x(function(d) {
	    return vpScale(d.vp);
	})
	.y(function(d) {
	    return zScale(d.z);
	});
    var vsFunc = d3.svg.line()
	.x(function(d) {
	    return vsScale(d.vs);
	})
	.y(function(d) {
	    return zScale(d.z);
	});
    var rhoFunc = d3.svg.line()
	.x(function(d) {
	    return rhoScale(d.rho);
	})
	.y(function(d) {
	    return zScale(d.z);
	});

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

	//update the table
	var colour_col = d3.select("#colour-entry").selectAll(".row")
                                                   .data(rocks);

	colour_col.html(colour_block);

	colour_col.enter().append("div").attr("class", "row")
	                                .html(colour_block);
	colour_col.exit().remove();

	var depth_col = d3.select("#depth-entry").selectAll(".row")
	    .data(rocks);
	depth_col.text(function(d){return d.depth.toFixed(2)});

	depth_col.enter().append("div").attr("class","row")
	                 .text(function(d){return d.depth.toFixed(2)});
	depth_col.exit().remove();

	var thickness_col = d3.select("#thickness-entry")
	    .selectAll(".row")
	    .data(rocks);
	thickness_col.text(function(d){return d.thickness.toFixed(2)});

	thickness_col.enter().append("div").attr("class","row")
	                 .text(function(d){return d.thickness.toFixed(2)});
	thickness_col.exit().remove();

	var rock_col = d3.select("#rock-entry").selectAll(".row")
                         .data(rocks);
	var row = rock_col.enter().append("div").attr("class","row");

	var select = row.append("select")
	                .on("change", update_rock)
	

	var option = select.selectAll("option").data(db_rocks);
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
	rock_col.exit().remove();

    };

    function update_plot(data){

	var data  = JSON.parse(data);
	var paired_data = [];
	for(var i=0; i < data.vp.length; i++){
	    paired_data[i] = {vp:data.vp[i], vs:data.vs[i],
			      rho:data.rho[i], z:data.z[i]};
	};


	rhoScale.domain([Math.min.apply(Math,data.rho), 
			 Math.max.apply(Math,data.rho)]);
	vpScale.domain([Math.min.apply(Math,data.vp), 
			Math.max.apply(Math,data.vp)]);
	vsScale.domain([Math.min.apply(Math,data.vs), 
			Math.max.apply(Math,data.vs)]);
	zScale.domain([data.z[0], data.z[data.z.length-1]]);

	zAxis.scale(zScale);
	log_group.call(zAxis);
	rhoAxis.scale(rhoScale);
	rho_g.call(rhoAxis);
	vsAxis.scale(vsScale);
	vs_g.call(vsAxis);
	vpAxis.scale(vpScale);
	vp_g.call(vpAxis);

	d3.selectAll("path").remove();
	rho_g.append("path")
                .attr("d", rhoFunc(paired_data))
		      .attr('stroke', 'blue')
	              .attr('stroke-width', 2)
	              .attr('fill', 'none');
	vs_g.append("path")
                .attr("d", vsFunc(paired_data))
	        .attr('stroke', 'green')
	        .attr('stroke-width', 2)
	        .attr('fill', 'none');
	vp_g.append("path")
                .attr("d", vpFunc(paired_data))
	        .attr('stroke', 'red')
	        .attr('stroke-width', 2)
	        .attr('fill', 'none');
    };

    function update_data(){

	$.get("/1D_model_data",{data:JSON.stringify(rocks)}, 
	      update_plot);
    };



    function update_rock(d){
	// updates rock layer and sends data to server
	d.db_key = this.value;
	d.name = this[this.selectedIndex].text;

	update_data();
    }

    function update_scale(){
	// Updates the axis scaling
	var total = rocks[rocks.length -1].depth + rocks[rocks.length-1].thickness;
	yscale.domain([0, total*1.2]);

	yAxis = yAxis.scale(yscale);
	layer_group.call(yAxis);

    }

    function delete_rock(d,i){
	d3.event.preventDefault();
	if (rocks.length > 1){
	    rocks.splice(i,1);


	    updateRocks();
	    update_data();
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
    
    function colour_block(d,i){
	return '<div class="cblock" style="margin0 6px 0 0; background-color:' +d.color+'; display:inline-block"></div>'
    }

    function add_top(d,i){
	// adds an interface top at the mouse click position
	
	d.thickness = yscale.invert(d3.mouse(this)[1]) - d.depth;

	add_rock(i);
    }
	
    function add_rock(i){
	// adds a rock to the model at position i + 1

	var name_index = Math.floor(Math.random()*db_rocks.length);

	var rock = {thickness: 50,
		    color: colors[color_index],
                    name: db_rocks[name_index].name,
		    db_key: db_rocks[name_index].db_key};

	if (rocks.length == 0){
	    rock.depth = 0
	} else {
	    rock.depth = rocks[rocks.length - 1].depth +
		rocks[rocks.length-1].thickness};

	
	rocks.splice(i+1,0,rock);

	updateRocks();
	update_data();

	color_index++;
	color_index = color_index % colors.length;
	layer++;

    };
};
