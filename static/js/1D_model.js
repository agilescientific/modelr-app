setup1D = function(rock_div, rock_image_height, rock_image_width,
		   rocks, fluids, rock_colour_map, max_depth,
		   rock_menu_div, fluid_div, fluid_menu_div,
		   plot_div, ref_menu_div, seismic_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";

    // Rock core
    var rock_core = new FluidSub(rock_div, rock_image_height, 
				 rock_image_width,
				 rocks, fluids,
				 rock_colour_map,rock_colour_map,
				 onchange=update_data);

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

    var vpPlot = new logPlot(log_group, "vp", "Vp",40, "black");
    var vsPlot = new logPlot(log_group, "vs", "Vs",80, "red");
    var rhoPlot = new logPlot(log_group, "rho","Rho", 120, "blue");
    var kPlot = new logPlot(log_group, "sw","Sw", 160, "green");
    var reflectPlot = new refPlot(log_group, "reflectivity", "Ref",
				  200, "black", ref_menu_div);
    var seismicPlot = new tracePlot(log_group, "synthetic", "Syn",
				    280, "black", seismic_menu_div);

    update_data();

    function update_data(){
	var offset = 10;
	var frequency = 15;
	var rock_intervals = rock_core.intervals;

	$.get("/1D_model_data",{rock_data:JSON.stringify(rock_intervals),
				height: rock_image_height*.9,
				offset: offset,
				frequency: frequency},
	      function(data){
		  data = JSON.parse(data);
		  vpPlot.update_plot(data);
		  vsPlot.update_plot(data);
		  rhoPlot.update_plot(data);
		  reflectPlot.update_plot(data, .9*rock_image_height);
		  seismicPlot.update_plot(data,.9*rock_image_height);
		  kPlot.update_plot(data, .9*rock_image_height);
		  tScale.domain(data.t);
		  tScale.range(data.scale);
		  tAxis.scale(tScale);
		  log_group.call(tAxis);
	      }
	     );
    }; // end of function update_data
};





