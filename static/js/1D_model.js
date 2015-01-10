setup1D = function(rock_div, rock_image_height, rock_image_width,
		   rocks, rock_colour_map, max_depth,
		   rock_menu_div, fluid_div, fluid_menu_div,
		   plot_div, data_div, ref_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";


    // Rock core
    var rock_core = new Core(rock_div, rock_image_height, 
			 rock_image_width,
			 rocks, rock_colour_map, max_depth, 
			 rock_title,
			 rock_menu_div, true,update_data);


    // Fluid core
    var fluid_core = new Core(fluid_div, rock_image_height, 
			  rock_image_width,
			  rocks, rock_colour_map, max_depth, 
			  fluid_title,
			  fluid_menu_div, false,
			  update_data);

    // Setup the log plots
    var plot_svg = d3.select(plot_div).append("svg")
	.attr("height", rock_image_height)
	.attr("width", 400);
    var log_group = plot_svg.append("g").attr("id", "log-group")
	.attr("transform", "translate(40,40)");

    var tScale = d3.scale.linear()
	.range(0, .9*rock_image_height);

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

    vpPlot = new logPlot(log_group, "vp", "Vp",40, "black");
    vsPlot = new logPlot(log_group, "vs", "Vs",100, "red");
    rhoPlot = new logPlot(log_group, "rho","Rho", 160, "blue");

  
    var reflectPlot = new refPlot(log_group, "reflectivity", "Ref",
			      220, "black", ref_menu_div);

    update_data();
    function update_data(){
	
	var offset = $("#offset-slide").val();
	var frequency = $("#frequency-slide").val();

	var rock_intervals = rock_core.intervals;
	var fluid_intervals = fluid_core.intervals;

	$.get("/1D_model_data",{rock_data:JSON.stringify(rock_intervals),
				fluid_data:JSON.stringify(fluid_intervals),
				height: rock_image_height*.9,
				offset: offset,
				frequency: frequency},
	      function(data){

		  data = JSON.parse(data);
		  vpPlot.update_plot(data);
		  vsPlot.update_plot(data);
		  rhoPlot.update_plot(data);
		  reflectPlot.update_plot(data, .9*rock_image_height);
		  
		  tScale.domain(data.t);
		  tScale.range(data.scale);
		  tAxis.scale(tScale);
		  log_group.call(tAxis);
	      }
	     );
    }; // end of function update_data
};

 

 
