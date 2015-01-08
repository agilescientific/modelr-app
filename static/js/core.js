/*
Class for interactive core plots
*/

function Core(div, image_height, image_width, material,
	      colour_map, max_depth, title, menu){
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
    */

    this.material = material;
    this.intervals = [];
    this.menu = menu;
    this.colour_map = colour_map;
    this.interval_width = 150;
    this.max_depth = max_depth;
    this.title = title;
    this.total_depth = max_depth/10.

    this.onchange = function(){return};
    // 10 % pad
    var height = image_height-(.1*image_height);

    // Make the scale
    var scale = d3.scale.linear()
        .domain([0,500]) 
        .range([0, height]);

    this.scale = scale; 
    var max_scale = d3.scale.linear()
        .domain([0, max_depth])
        .range([0, height]);

    this.max_scale = max_scale;

    this.canvas = d3.select(div)
	.append("svg")
	.attr("width", image_width)
	.attr("height", image_height);

    this.core_group = this.canvas.append("g")
	.attr("transform","translate(40,40)");

    this.core_group.append("text")
        .attr("class", "menu-label")
	.attr("style", "color:blue")
        .attr("text-anchor", "middle")
        .attr("y", -25) 
        .attr("x", 25)
        .text(title)
	.attr("cursor", "pointer");

    this.core_group.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("x", -50)
        .attr("dy", ".75em")
        .attr("transform", "rotate(-90)")
        .text("depth [m]");

    this.yAxis = d3.svg.axis()
        .scale(this.scale)
        .orient("right")
        .ticks(5);

    // These groups are made in this order for specifically for layering
    this.rects = this.core_group.append("g")
    this.lines = this.core_group.append("g")
    this.circle = this.core_group.append("g")
    
    // Resize drag behaviour
    this.drag = d3.behavior.drag().on("drag", this.dragResize)
        .on("dragend", this.onchange);
    this.scale_drag = d3.behavior.drag().on("drag", this.scaleDrag)
        .on("dragend", this.rescale);

    this.add_interval(0,0,this.total_depth);
    this.add_interval(1, this.total_depth/2,this.total_depth/2);
};

Core.prototype.show_menu = function(){
    $(this.menu).show();
    $(this.menu).dialog();
};



Core.prototype.add_interval = function(i, depth, thickness){
    // adds an interval of depth and thickness under the ith top
    
    // Choose a random material for initialization
    var name_index = Math.floor(Math.random()*this.intervals.length);
    
    // Define a new interval
    var interval = {depth:depth,
                    name: this.material[name_index].name,
		    db_key: this.material[name_index].db_key};
    interval.colour = this.colour_map[interval.name];


    // Check that thickness is defined
    if(typeof thickness !== 'undefined'){
        interval.thickness = thickness;
    };

    // Add to the interval data list
    this.intervals.splice(i+1,0, interval);

    // update the interval thickness
    this.calculate_thickness();

    // update the core plot
    this.update();

};

Core.prototype.calculate_thickness = function(){
    // updates the thickness values of each layer

    var end_point = this.intervals[this.intervals.length-1].depth +
        this.intervals[this.intervals.length-1].thickness;
    for (var i=0; i<this.intervals.length-1; i++) {    
        this.intervals[i].thickness = 
	    this.intervals[i+1].depth - this.intervals[i].depth;
    };
    
    this.intervals[this.intervals.length-1].thickness = end_point - 
        this.intervals[this.intervals.length-1].depth;
};

Core.prototype.slide_scale = function(){
    
    var scale_circle = this.circle.selectAll("circle")
        .data([this.total_depth]);

    scale_circle.attr("cy",function(d){return totalScale(d);});
    
    scale_circle.enter().append("circle")
        .attr("cx",0)
        .attr("cy", function(d){return totalScale(d);})
        .attr("r", "5")
        .attr("stroke","black")
        .attr("stroke-width","3")
        .attr("fill","red") 
        .attr("cursor", "ns-resize")
        .call(this.scale_drag);
};

Core.prototype.scaleDrag = function(){
    
    var old_depth = total_depth;
    // update it
    this.total_depth = this.max_scale.invert(d3.event.y);
    if(this.total_depth > this.max_depth){
        this.total_depth = this.max_depth;
	  }
	  if(this.total_depth < 1){
              this.total_depth=1;
	  }
    
    var scale_factor = this.total_depth / old_depth;
    
    this.intervals[0].thickness *= scale_factor;
    for(var i=1; i < this.intervals.length; i++){
        this.intervals[i].depth = this.intervals[i-1].depth + this.intervals[i-1].thickness; 
        this.intervals[i].thickness *= scale_factor;
    }
    
    var scale_max = this.scale.domain()[1] * scale_factor;
    this.scale.domain([0, scale_max]);
    this.yAxis.scale(this.scale);
    this.core_group.call(this.yAxis);

    //slideScale();
} // end of function


Core.prototype.update_scale = function(){
    
    // Updates the axis scaling
    var total = this.intervals[this.intervals.length -1].depth + 
        this.intervals[this.intervals.length-1].thickness;
    
    this.scale.domain([0,total]);
    this.yAxis = yAxis.scale(this.scale);
    this.core_group.call(yAxis);
};

Core.prototype.update = function(){

    //stupid JS
    var that = this;

    // update the data
    var interval = this.rects.selectAll("rect").data(this.intervals);

    // This updates the existing rectangles
    interval.attr("height", function(d)
		  {return that.update_thickness(d)})
        .attr("y", function(d){
	    return that.update_depth(d)})
        .attr("fill", function(d){return d.color});

    // The enter function allows us to add elements for extra data
    interval.enter().append("rect")
        .attr("y", function(d){
	    return that.update_depth(d)})
        .attr("x",60)
              .attr("fill", function(d)
		    {return d.color})
        .attr("height", function(d){
	    return that.update_thickness(d)})
        .attr("width", this.interval_width)
        .attr("cursor","crosshair")
        .on("click", this.add_top)
        .on("contextmenu", function(d,i){
	    that.delete_interval(d,i)});

    // remove unused layers
    interval.exit().remove();
    	  
    // Tops
    var top = this.lines.selectAll("line")
        .data(this.intervals.slice(1, this.intervals.length));
    
    // existing
    top.attr("y1", function(d){
	return that.update_depth(d)})
        .attr("y2", function(d){
	return that.update_depth(d)});
    
    //for the new elements
    top.enter()
        .append("line")
        .attr("x1", 60).attr("x2", 60 + this.interval_width)
        .attr("y1", function(d){
	    return that.update_depth(d)})
        .attr("y2", function(d){
	    return that.update_depth(d)})
        .attr("style","stroke:rgb(0,0,0);stroke-width:2")
        .attr("cursor", "ns-resize")
        .on("contextmenu", function(d,i){that.delete_top(d,i)})
        .call(this.drag);
    
    top.exit().remove();
    
    // Do the rock menu updates
    var colour_map = d3.select(this.menu).selectAll(".row")
        .data(this.intervals);
	  
    var select = colour_map.html(this.colour_block).append("select")
	.on("change", this.update_rock);

    // add a menu row for every interval
    colour_map.enter().append("div").attr("class","row")
	.html(this.colour_block)
	.append("select").on("change", this.update_rock);

    select = colour_map.selectAll("select");
    var option = select.selectAll("option").data(this.material);

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

    // send out the call backs
    this.onchange();
};


// Functions for D3 callbacks
Core.prototype.update_thickness = function(d){
    return this.scale(d.thickness);
};

Core.prototype.update_depth = function(d){
    return this.scale(d.depth);
};

Core.prototype.update_bottom = function(d) {
    return this.scale(d.depth + d.thickness);
};

Core.prototype.delete_interval = function(d,i){
    // deletes interval d from the ith layer
    
    d3.event.preventDefault();
    // always keep 2 layers
    if (this.intervals.length > 2 & (i > 0)) {
	if (i == (this.intervals.length-1)) {
	    this.intervals[i-1].thickness = 
		d.thickness + d.depth - this.intervals[i-1].depth;
	} // end of inner if
	this.intervals.splice(i,1);
	this.update();
    } // end of outer if
} // end of function delete_intercall



Core.prototype.delete_top = function(d,i){
    d3.event.preventDefault();
    // first interval does not have a top
    this.delete_interval(this.intervals[i+1],i+1);
};

Core.prototype.add_top = function(d,i){
    /*
      adds a top to the core at the ith interval
    param d: core rock attached to the ith interval
    param i: interval to place top
    */

    var bottom = d.depth + d.thickness;
    d.thickness = this.scale.invert(d3.mouse(this)[1]) - d.depth;
    
    var depth = d.depth + d.thickness;
    var thickness = bottom - depth;
    
    add_interval(i, depth, thickness);
};

Core.prototype.colour_block = function(d,i){
    return '<div class="cblock" style="margin0 6px 0 0; background-color:' +d.color+'; display:inline-block"></div>'
}

 // Resize call back
Core.prototype.dragResize = function(d,i){
    var event = d3.event;
    var end_point = d.depth + d.thickness;
    d.depth = this.scale.invert(event.y);
    if(d.depth > end_point){
	d.depth=end_point
    }
    var start_point = this.intervals[i].depth;
    if(d.depth < start_point){
	d.depth = start_point;
    }
    if(i < this.intervals.length-2){
	this.intervals[i+2].depth = end_point;
    } else{
	d.thickness = end_point - d.depth;
    }
    this.update();

} // end of this.dragResize
Core.prototype.update_rock = function(d){
    // updates rock layer and sends data to server
    d.db_key = this.value;
    d.name = this[this.selectedIndex].text;
    d.color = this.colour_map[d.name];
    
    this.update();
} // end of function update_rocl
