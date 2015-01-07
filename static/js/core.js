/*
Class for interactive core plots
*/

function Core(div, image_height, image_width, material, intervals,
	      colour_map, max_depth, title){

    this.material = rocks;
    this.intervals = intervals;
    this.menu = menu;
    this.colour_map = colour_map;
    this.scale = scale;
    this.interval_width = 150;

    // 10 % pad
    var height = image_height-(.1*image_height);

    // Make the scale
    this.scale = d3.scale.linear()
        .domain([0,500]) 
        .range([0, height]);

    this.max_scale = d3.scale.linear()
        .domain([0, max_depth])
        .range([0, height]);

    this.canvas = d3.select(div)
	.append("svg")
	.attr("width", width)
	.attr("height", height);

    this.core_group = this.canvas.append("g");
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
        .scale(yscale)
        .orient("right")
        .ticks(5);

    // this.core_group.call(this.yAxis);

    // These groups are made in this order for specifically for layering
    this.rects = this.core_group.append("g")
    this.lines = this.core_group.append("g")
    this.circle = this.core_group.append("g")
    
    // Resize drag behaviour
    this.drag = d3.behavior.drag().on("drag", dragResize)
        .on("dragend", this.onchange);
    this.scale_drag = d3.behavior.drag().on("drag", scaleDrag)
        .on("dragend", this.rescale);
};

Core.prototype.show_menu(){
    this.menu.show();
    this.menu.dialog();
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

Core.prototype.calculate_thickness(){
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

Core.prototype.slide_scale(){
    
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

Core.prototype.update_scale = function(){
    
    // Updates the axis scaling
    var total = this.intervals[this.intervals.length -1].depth + 
        this.intervals[this.intervals.length-1].thickness;
    
    this.yscale.domain([0,total]);
    this.yAxis = yAxis.scale(yscale);
    this.core_group.call(yAxis);
};

Core.prototype.update(){

    // update the data
    var interval = this.rects.selectAll("rect").data(rocks);

    // This updates the existing rectangles
    interval.attr("height", this.update_thickness)
        .attr("y", this.update_depth)
        .attr("fill", function(d){return d.color});

    // The enter function allows us to add elements for extra data
    interval.enter().append("rect")
        .attr("y", this.update_depth)
        .attr("x",60)
              .attr("fill", function(d)
		    {return d.color})
        .attr("height", this.update_thickness)
        .attr("width", this.interval_width)
        .attr("cursor","crosshair")
        .on("click", this.add_top)
        .on("contextmenu", this.delete_interval);

    // remove unused layers
    interval.exit().remove();
    	  
    // Tops
    var top = this.lines.selectAll("line")
        .data(this.intervals.slice(1, rocks.length));
    
    // existing
    top.attr("y1", this.update_depth)
        .attr("y2", this.update_depth);
    
    //for the new elements
    top.enter()
        .append("line")
        .attr("x1", 60).attr("x2", 60 + this.interval_width)
        .attr("y1", this.update_depth)
        .attr("y2", this.update_depth)
        .attr("style","stroke:rgb(0,0,0);stroke-width:2")
        .attr("cursor", "ns-resize")
        .on("contextmenu", this.delete_top)
        .call(this.drag);
    
    top.exit().remove();
    
    // Do the rock menu updates
    var colour_map = this.menu.selectAll(".row")
        .data(this.intervals);
	  
    var select = colour_map.html(this.colour_block).append("select")
	.on("change", this.update_rock);

    // add a menu row for every interval
    colour_map.enter().append("div").attr("class","row")
	.html(colour_block)
	.append("select").on("change", update_rock);

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
function update_thickness(d){
    return yscale(d.thickness);
};

function update_depth(d){
    return yscale(d.depth);
};

function update_bottom(d){
    return yscale(d.depth + 
		  d.thickness);
};

Core.prototype.delete_interval(d,i){
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
    d.thickness = yscale.invert(d3.mouse(this)[1]) - d.depth;
    
    var depth = d.depth + d.thickness;
    var thickness = bottom - depth;
    
    add_interval(i, depth, thickness);
};

Core.prototype.colour_block = function(d,i){
    return '<div class="cblock" style="margin0 6px 0 0; background-color:' +d.color+'; display:inline-block"></div>'
}


Core.prototype.udpate_rock = function(d){
    // updates rock layer and sends data to server
    d.db_key = this.value;
    d.name = this[this.selectedIndex].text;
    d.color = colour_map[d.name];
    
    this.update();
} // end of function update_rocl
