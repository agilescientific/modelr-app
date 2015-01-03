setup1D = function(model_div, plot_div, db_rocks){ 

    // Define the constants
    var image_height = 500;
    var height = 450;
    var width = 170;
    var plot_height = 500;
    var plot_width = 400;
    var rock_width = 150;
    var color_index = 0;
    var layer = 1;
    var rocks = [];
    var rock_names = db_rocks;
    var colors=['#CCAA99','#BBAADD',"#AACCDD", "#CC99AA", "#AAAACC"];
    var offset = 25;
    var total_depth = 1000;
    var max_depth = 10000;

    
    // Make the scale
    var yscale = d3.scale.linear()
	.domain([0,500]) 
	.range([0, height]);
    var vsScale = d3.scale.linear() 
	.range([0,50]);
    var vpScale = d3.scale.linear()
	.range([0, 50]);
    var rhoScale = d3.scale.linear()
	.range([0, 50]);
    var refScale = d3.scale.linear()
	.range([0, 50]);
    var synthScale = d3.scale.linear()
	.range([0, 50]);
    var tScale = d3.scale.linear()
	.range([0, height])
    var totalScale = d3.scale.linear()
	.domain([0, max_depth])
	.range([0, height]);
	
    // Make some objects
    var layer_svg = d3.select(model_div).append("svg")
        .attr("width", width)
        .attr("height", image_height)

    // Main image group, translated so we have space for an axis	
    var layer_group = layer_svg.append("g")
	.attr("id", "layer-group")
	.attr("transform","translate(40,40)");


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

    //add it to the main plot		  
    layer_group.call(yAxis);
    
    // These groups are made in this order for specifically for layering
    var rects = layer_group.append("g").attr("id", "rects");
    var lines = layer_group.append("g").attr("id", "lines");
    var circle = layer_group.append("g").attr("id", "circle");
  
    // Resize drag behaviour
    var drag = d3.behavior.drag().on("drag", dragResize)
	                         .on("dragend", update_data);
    var scale_drag = d3.behavior.drag().on("drag", scaleDrag)
	                               .on("dragend", rescale);


    // Setup the plot
    var plot_svg = d3.select(plot_div).append("svg")
	         .attr("height", plot_height)
	         .attr("width", plot_width);
    var log_group = plot_svg.append("g").attr("id", "log-group")
	                    .attr("transform", "translate(40,40)");
    
    /*
      var rhoAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    var vsAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    var vpAxis = d3.svg.axis()
	.orient("top")
	.ticks(1);
    */

    var tAxis = d3.svg.axis()
	.orient("right")
	.ticks(5);
   // Axis label (done horizontally then rotated)
    plot_svg.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", 6)
	.attr("x", -50)
	.attr("dy", ".75em")
	.attr("transform", "rotate(-90)")
	.text("time [s]");


    var rho_g = log_group.append("g")
	        .attr("transform", "translate(40,0)")
    var vs_g = log_group.append("g")
	.attr("transform", "translate(100,0)")
    var vp_g = log_group.append("g")
	.attr("transform", "translate(160,0)")
    var ref_g = log_group.append("g")
	.attr("transform", "translate(220,0)")
    var synth_g = log_group.append("g")
	.attr("transform", "translate(280,0)")

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
    ref_g.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y",-25)
	.attr("x", 20)
	.text("ref");
    synth_g.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y",-25)
	.attr("x", 20)
	.text("synth");

    //log_group.call(tScale);

    var vpFunc = d3.svg.line()
	.x(function(d) {
	    return vpScale(d.vp);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
    var vsFunc = d3.svg.line()
	.x(function(d) {
	    return vsScale(d.vs);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
    var rhoFunc = d3.svg.line()
	.x(function(d) {
	    return rhoScale(d.rho);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
    var refFunc = d3.svg.line()
	.x(function(d) {
	    return refScale(d.reflectivity);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
	var synthFill = d3.svg.area()
	.x0(0)
    .x1(function(d) {
	    return synthScale(d.synthetic);
	})
	.y(function(d) {
	    return tScale(d.t);
	});
    var synthFunc = d3.svg.line()
	.x(function(d) {
	    return synthScale(d.synthetic);
	})
	.y(function(d) {
	    return tScale(d.t);
	});

    // Add the default first layers
    add_rock(0, 0, total_depth);
    add_rock(1, total_depth/2, total_depth/2);



    // Resize call back
    function dragResize(d,i){

	var event  = d3.event;
	var end_point = d.depth + d.thickness;
	
	d.depth = yscale.invert(event.y);
	
	if(d.depth > end_point){d.depth=end_point};
	    

	var start_point = rocks[i].depth;
	 
	
	if(d.depth < start_point){
	    d.depth = start_point;
	};
	
	if(i < rocks.length-2){
	    rocks[i+2].depth = end_point;
	} else{
	    d.thickness = end_point - d.depth;
	};

	updateRocks();
    };
    
    function scaleDrag(){

	var old_depth = total_depth;
	// update it
	total_depth = totalScale.invert(d3.event.y);
	if(total_depth > max_depth){
	    total_depth = max_depth;
	}
	if(total_depth < 1){
	    total_depth=1;
	}

	var scale_factor = total_depth / old_depth;

	rocks[0].thickness *= scale_factor;
	for(var i=1; i < rocks.length; i++){
	    rocks[i].depth = rocks[i-1].depth + rocks[i-1].thickness; 
	    rocks[i].thickness *= scale_factor;
	};


	var scale_max = yscale.domain()[1] * scale_factor;
	yscale.domain([0, scale_max]);
	yAxis.scale(yscale);
	layer_group.call(yAxis);

	slideScale();
	
    }

    function rescale(){
	update_scale();
	updateRocks();
	update_data();
	
    }

    // Updates the data and redraws
    function updateRocks(){

	// Update the interval thickness
	calculate_thickness();


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
	    .attr("cursor","crosshair")
	    .on("click", add_top)
	    .on("contextmenu", delete_rock);
	
	rect.exit().remove();

	// Interface lines
	var interfaceLine = lines.selectAll("line")
	    .data(rocks.slice(1, rocks.length));
	
	// existing
	interfaceLine.attr("y1", update_depth)
	    .attr("y2", update_depth);

	//for the new elements
	interfaceLine.enter()
	    .append("line")
	    .attr("x1", 60).attr("x2", 60 + rock_width)
	    .attr("y1", update_depth)
	    .attr("y2", update_depth)
	    .attr("style","stroke:rgb(0,0,0);stroke-width:2")
	    .attr("cursor", "ns-resize")
	    .on("contextmenu", delete_top)
	    .call(drag);


	interfaceLine.exit().remove();

	
	//update the table
	var colour_map = d3.select("#colour-map").selectAll(".row")
                                                   .data(rocks);
	var select = colour_map.html(colour_block).append("select")
	    .on("change", update_rock);


	colour_map.enter().append("div").attr("class", 
					      "row")
	    .html(colour_block)
	    .append("select").on("change", update_rock);
	
	select = colour_map.selectAll("select");

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
	colour_map.exit().remove();

	slideScale();

    };

    function slideScale(){
	var scale_circle = circle.selectAll("circle")
	    .data([total_depth]);
	scale_circle.attr("cy",function(d){return totalScale(d);});

	scale_circle.enter().append("circle")
	    .attr("cx",0)
	    .attr("cy", function(d){return totalScale(d);})
	    .attr("r", "5")
	    .attr("stroke","black")
	    .attr("stroke-width","3")
	    .attr("fill","red") 
	    .attr("cursor", "ns-resize")
	    .call(scale_drag);
    };

    function update_plot(data){

	var data  = JSON.parse(data);
	var paired_data = [];
	for(var i=0; i < data.vp.length; i++){
	    paired_data[i] = {vp:data.vp[i], vs:data.vs[i],
			      rho:data.rho[i], 
			      reflectivity:data.reflectivity[i],
			      synthetic:data.synthetic[i],
			      t:data.t[i]};
	};


	rhoScale.domain([Math.min.apply(Math,data.rho), 
			 Math.max.apply(Math,data.rho)]);
	vpScale.domain([Math.min.apply(Math,data.vp), 
			Math.max.apply(Math,data.vp)]);
	vsScale.domain([Math.min.apply(Math,data.vs), 
			Math.max.apply(Math,data.vs)]);
	synthScale.domain([Math.min.apply(Math,data.synthetic), 
			Math.max.apply(Math,data.synthetic)]);
	refScale.domain([Math.min.apply(Math,data.reflectivity), 
			Math.max.apply(Math,data.reflectivity)]);

	tScale.domain(data.t);
	tScale.range(data.scale);


	tAxis.scale(tScale);
	log_group.call(tAxis);
	
	/*
	rhoAxis.scale(rhoScale);
	rho_g.call(rhoAxis);
	vsAxis.scale(vsScale);
	vs_g.call(vsAxis);
	vpAxis.scale(vpScale);
	vp_g.call(vpAxis);
	*/

	d3.selectAll("path").remove();
	rho_g.append("path")
            .attr("d", rhoFunc(paired_data))
		    .attr('stroke', 'blue')
	        .attr('stroke-width', 1)
	        .attr('fill', 'none');
	vs_g.append("path")
            .attr("d", vsFunc(paired_data))
	        .attr('stroke', 'green')
	        .attr('stroke-width', 1)
	        .attr('fill', 'none');
	vp_g.append("path")
            .attr("d", vpFunc(paired_data))
	        .attr('stroke', 'red')
	        .attr('stroke-width', 1)
	        .attr('fill', 'none');
	ref_g.append("path")
            .attr("d", refFunc(paired_data))
	        .attr('stroke', 'black')
	        .attr('stroke-width', 1)
	        .attr('fill', 'none');
    synth_g.append("path")
            .attr("class", 'wiggle-fill')
            .attr("d", synthFill(paired_data));

    // Rather than slapping a rect on top
    // I think it would be better to use a clipPath
    // but first I want to get the flipping fill shape done
    synth_g.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", synthScale(0))
            .attr("height", height)
            .attr("opacity", '0.7')
            .attr("fill", 'white');

    synth_g.append("path")
	        .attr("class", 'wiggle-line')
            .attr("d", synthFunc(paired_data));

	layer_group.call(yAxis);

    };

    function update_data(){

	$.get("/1D_model_data",{data:JSON.stringify(rocks),
				height: height}, 
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
	var total = rocks[rocks.length -1].depth + 
	    rocks[rocks.length-1].thickness;

	/*
	if(yscale.domain()[1] < 1.2*total){
	    yscale.domain([0, total*1.2]);
	};

	if(yscale.domain()[1] > 2*total){
	    yscale.domain([0, 1.2*total]);
	};
	*/
	yscale.domain([0,total]);
	yAxis = yAxis.scale(yscale);
	layer_group.call(yAxis);
	

    }
    
    function delete_top(d,i){

	d3.event.preventDefault();

	// first rock does not have a top
	delete_rock(rocks[i+1],i+1);
    };

    function delete_rock(d,i){
	d3.event.preventDefault();

	// always keep 2 layers
	if (rocks.length > 2 & (i > 0)){

	    if(i == (rocks.length-1)){
		rocks[i-1].thickness = d.thickness + d.depth -
		    rocks[i-1].depth;
	    };

	    rocks.splice(i,1);

	    updateRocks();
	    update_data();
	};
    }


    function calculate_thickness(){

	var end_point = rocks[rocks.length-1].depth +
	    rocks[rocks.length-1].thickness;

	for(var i=0; i<rocks.length-1; i++){
	    
	    rocks[i].thickness = rocks[i+1].depth - rocks[i].depth;
	};
	rocks[rocks.length-1].thickness = end_point - 
	    rocks[rocks.length-1].depth;
    }

    // FUnctions for D3 callbacks
    function update_thickness(d){
	return yscale(d.thickness);
    }

    function update_depth(d){
	return yscale(d.depth);
    }
    
    function update_bottom(d){
	return yscale(d.depth + 
		      d.thickness);
    }

    function colour_block(d,i){
	return '<div class="cblock" style="margin0 6px 0 0; background-color:' +d.color+'; display:inline-block"></div>'
    }

    function add_top(d,i){
	// adds an interface top at the mouse click position
	var bottom = d.depth + d.thickness;
	d.thickness = yscale.invert(d3.mouse(this)[1]) - d.depth;

	var depth = d.depth + d.thickness;
	var thickness = bottom - depth;

	add_rock(i, depth, thickness);
    }
	
    function add_rock(i, depth, thickness){
	// adds a rock to the model at position i + 1

	var name_index = Math.floor(Math.random()*db_rocks.length);

	var rock = {depth:depth,
		    color: colors[color_index],
                    name: db_rocks[name_index].name,
		    db_key: db_rocks[name_index].db_key};

	if(typeof thickness !== 'undefined'){
	    rock.thickness = thickness;
	};

	rocks.splice(i+1,0,rock);

	updateRocks();
	update_data();

	color_index++;
	color_index = color_index % colors.length;
	layer++;
	update_scale();

    };
};
