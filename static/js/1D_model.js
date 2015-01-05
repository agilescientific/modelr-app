setup1D = function(model_div, plot_div, db_rocks, 
		   colour_map, rock_menu){ 

    // Define the constants
    var image_height = 500,
    height = 450,
    width = 170,
    plot_height = 500,
    plot_width = 400,
    rock_width = 150,
    color_index = 0,
    layer = 1,
    rocks = [],
    rock_names = db_rocks,
    colors=['#CCAA99','#BBAADD',"#AACCDD", "#CC99AA", "#AAAACC"],
    offset = 25,
    total_depth = 1000,
    max_depth = 10000;

    
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
    var layer_svg = d3.select(model_div)
        .append("svg")
        .attr("width", width)
        .attr("height", image_height);

    // Main image group, translated so we have space for an axis  
    var layer_group = layer_svg.append("g")
        .attr("id", "layer-group")
        .attr("transform","translate(40,40)");

    layer_group.append("text")
        .attr("class", "menu-label")
	.attr("style", "color:blue")
        .attr("text-anchor", "middle")
        .attr("y", -25)
        .attr("x", 25)
        .text("Model")
	.attr("cursor", "pointer")
	.on("click", showRockSelect);



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


    var vp_g = log_group.append("g")
        .attr("transform", "translate(40,0)")
    var vs_g = log_group.append("g")
        .attr("transform", "translate(100,0)")
    var rho_g = log_group.append("g")
        .attr("transform", "translate(160,0)")
    var ref_g = log_group.append("g")
        .attr("transform", "translate(220,0)")
    var synth_g = log_group.append("g")
        .attr("transform", "translate(280,0)")


    // Axis labels
    rho_g.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("y", -25)
        .attr("x", 25)
        .text("rho");
    vp_g.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("y", -25)
        .attr("x", 25)
        .text("Vp");
    vs_g.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("y",-25)
        .attr("x", 25)
        .text("Vs");
    ref_g.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("y",-25)
        .attr("x", 25)
        .text("RC");
    synth_g.append("text")
        .attr("class", "menu-label")
        .attr("text-anchor", "middle")
        .attr("y",-25)
        .attr("x", 25)
        .text("Syn")
	.attr("cursor", "pointer")
	.on("click",showSeismicMenu)
;

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

    // Not required if draw with sticks
    // instead of plotting line.
    // var refFunc = d3.svg.line()
    // .x(function(d) {
    //     return refScale(d.reflectivity);
    // })
    // .y(function(d) {
    //     return tScale(d.t);
    // });
    
    var synthFill = d3.svg.area()
	.x0(0)
	.x1(function(d) {
	    return synthScale(d.synthetic);
	})
	.y(function(d) {
	    return tScale(d.t);
	})

    
    var synthFunc = d3.svg.line()
	.x(function(d) {
	    return synthScale(d.synthetic);
	})
	.y(function(d) {
	    return tScale(d.t);
	});




    $("#frequency-slide").val(10);
    $("#frequency-slide").on("change",
			     update_data);
    $("#offset-slide").val(0);
    $("#offset-slide").on("change",
			     update_data);
    // Add the default first layers
    add_rock(0, 0, total_depth);
    add_rock(1, total_depth/2, total_depth/2);

    $("#rock-select-div").dialog();

    $("#seismic-menu").dialog();

      // Resize call back
      function dragResize(d,i){

	  var event  = d3.event;
	  var end_point = d.depth + d.thickness;
	  
	  d.depth = yscale.invert(event.y);
	  
	  if(d.depth > end_point){
	      d.depth=end_point
	  }    

	  var start_point = rocks[i].depth;

	  if(d.depth < start_point){
              d.depth = start_point;
	  }
	  
	  if(i < rocks.length-2){
              rocks[i+2].depth = end_point;
	  } else{
              d.thickness = end_point - d.depth;
	  }

	  updateRocks();

      } // end of dragResize
      
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
	  }

	  var scale_max = yscale.domain()[1] * scale_factor;
	  yscale.domain([0, scale_max]);
	  yAxis.scale(yscale);
	  layer_group.call(yAxis);

	  slideScale();
      } // end of function

      function rescale() {
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
	  
	  var colour_map = d3.select("#rock-select-div").selectAll(".row")
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
	  
      } // end of function updateRocks
      
      function showRockSelect(){
	  
	  d3.event.preventDefault();
	  $("#rock-select-div").show();
	  $("#rock-select-div").dialog()
      }

      function showSeismicMenu(){
	  
	  d3.event.preventDefault();
	  $("#seismic-menu").show();
	  $("#seismic-menu").dialog()
      }
      
      
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
      } // end of function showSelect

      function update_plot(data){

  	  var data  = JSON.parse(data);
	  console.log("Data", data.reflectivity.length, data.reflectivity);

  	  var paired_data = [];
  	  for(var i=0; i < data.vp.length; i++){
  	      paired_data[i] = {vp:data.vp[i]||0,
				vs:data.vs[i]||0,
  				rho:data.rho[i]||0, 
  				reflectivity:data.reflectivity[i]||0,
  				synthetic:data.synthetic[i]||0,
  				t:data.t[i]};
	  } // end of for

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
  	  
	  d3.selectAll("path").remove();
	  d3.selectAll("rect.rc-stick").remove();

	  vp_g.append("path")
              .attr("d", vpFunc(paired_data))
              .attr('stroke', 'red')
              .attr('stroke-width', 1)
              .attr('fill', 'none');

	  vs_g.append("path")
              .attr("d", vsFunc(paired_data))
              .attr('stroke', 'green')
              .attr('stroke-width', 1)
              .attr('fill', 'none');

  	  rho_g.append("path")
              .attr("d", rhoFunc(paired_data))
              .attr('stroke', 'blue')
              .attr('stroke-width', 1)
              .attr('fill', 'none');

	  // Draw sticks for the reflectivities, instead of a line
	  ref_g.selectAll("rect")
              .data(data.reflectivity)
              .enter()
              .append("rect")
              .attr("class", "rc-stick")
              .attr("x", function(d) {
		  if (d > 0) {
                      return refScale(0);
		  } else {
                      return refScale(0) + d*100; // -ve d
		  }
              })
              .attr("y", function(d, i) {
                  return i * (height / data.reflectivity.length);
              })
              .attr("width", function(d) {
                  return Math.abs(d*100);
              })
              .attr("height", height / (1.2*data.reflectivity.length));

	  // Testing sticks instead of line
	  // ref_g.append("path")
	  //           .attr("d", refFunc(paired_data))
	  //         .attr('stroke', 'black')
	  //         .attr('opacity', 0.5)
	  //         .attr('stroke-width', 1)
	  //         .attr('fill', 'none');

	  synth_g.append("path")
              .attr("class", 'wiggle-fill')
              .attr("d", synthFill(paired_data));

	  // Rather than slapping a rect on top
	  // I think it would be better to use a clipPath
	  synth_g.append("rect")
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", synthScale(0))
              .attr("height", height)
              .attr("fill", 'white');


	  synth_g.append("path")
              .attr("class", 'wiggle-line')
              .attr("d", synthFunc(paired_data));
	  layer_group.call(yAxis);

      } // end of function update_plot


      function update_data(){

	  var offset = $("#offset-slide").val();
	  var frequency = $("#frequency-slide").val();

	  $.get("/1D_model_data",{data:JSON.stringify(rocks),
				  height: height,
				  offset: offset,
				  frequency: frequency}, 
		update_plot);
      } // end of function update_data

      function update_rock(d){
	  // updates rock layer and sends data to server
	  d.db_key = this.value;
	  d.name = this[this.selectedIndex].text;
	  d.color = colour_map[d.name];

	  updateRocks();
	  update_data();
      } // end of function update_rocl

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
	  
      } // end of function update_scale
      
      function delete_top(d,i){
	  d3.event.preventDefault();
	  // first rock does not have a top
	  delete_rock(rocks[i+1],i+1);
      }

      function delete_rock(d,i){
	  d3.event.preventDefault();
	  // always keep 2 layers
	  if (rocks.length > 2 & (i > 0)) {
	      if (i == (rocks.length-1)) {
		  rocks[i-1].thickness = d.thickness + d.depth - rocks[i-1].depth;
	      } // end of inner if
	      rocks.splice(i,1);
	      updateRocks();
	      update_data();
	  } // end of outer if
      } // end of function delete_rock

      function calculate_thickness(){
	  var end_point = rocks[rocks.length-1].depth +
              rocks[rocks.length-1].thickness;
	  for (var i=0; i<rocks.length-1; i++) {    
              rocks[i].thickness = rocks[i+1].depth - rocks[i].depth;
	  }

	  rocks[rocks.length-1].thickness = end_point - 
              rocks[rocks.length-1].depth;
      }

      // Functions for D3 callbacks
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
                      name: db_rocks[name_index].name,
		      db_key: db_rocks[name_index].db_key};
	  rock.color = colour_map[rock.name];

	  if(typeof thickness !== 'undefined'){
              rock.thickness = thickness;
	  }

	  rocks.splice(i+1,0,rock);

	  updateRocks();
	  update_data();

	  color_index++;
	  color_index = color_index % colors.length;
	  layer++;
	  update_scale();

      } // end of function add_rock

     }; // end of function statement
