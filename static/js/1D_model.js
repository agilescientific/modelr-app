setup1D = function(rock_div, rock_image_height, rock_image_width,
		   rocks, fluids, rock_colour_map, max_depth,
		   rock_menu_div,plot_div, ref_menu_div, 
		   seismic_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";

    // Rock core
    var rock_core = new FluidSub(rock_div, rock_image_height, 
				 rock_image_width,
				 rocks, fluids,
				 rock_colour_map,rock_colour_map,
				 rock_menu_div,
				 onchange=update_data);

    // Setup the log plots
    var plot_svg = d3.select(plot_div).append("svg")
	.attr("height", rock_image_height)
	.attr("width", 600);
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

    var vpPlot = new logPlot(log_group, "vp", "Vp",40, "black",
			     false);
    var vpsubPlot = new logPlot(log_group, "vp_sub", "Vp",
				40, "black", true);

    var vsPlot = new logPlot(log_group, "vs", "Vs",80, "red", false);
    var vssubPlot = new logPlot(log_group, "vs_sub", "Vs",80, "red",
				true);

    var rhoPlot = new logPlot(log_group, "rho","Rho", 120, "blue", 
			      false);
    var rhosubPlot = new logPlot(log_group, "rho_sub","Rho", 120, 
			      "blue", true);


    var seismicPlot = new gatherPlot(log_group, 200,'traces','F0',
				     seismic_menu_div);

    var seismicsubPlot = new gatherPlot(log_group,360,'traces_sub', 
					'Fsub',
					seismic_menu_div);

    update_data();

    function update_data(){
	var offset = 10;
	var frequency = $("#frequency").val();
	var rock_intervals = rock_core.intervals;

var json_load = {rock_data:JSON.stringify(rock_intervals),
		 height: rock_image_height*.9,
		 offset: offset,
		 frequency: frequency};
	$.post("/1D_model_data",json_load,
	      function(data){
		  data = JSON.parse(data);

		  vpPlot.update_plot(data);
		  vsPlot.update_plot(data);

		  rhoPlot.update_plot(data);
		  rhosubPlot.update_plot(data);
	
		  vpsubPlot.update_plot(data);
		  vssubPlot.update_plot(data);
	
		  seismicPlot.update_plot(data,.9*rock_image_height);
		  seismicsubPlot.update_plot(data,.9*rock_image_height);
	
		  tScale.domain(data.t);
		  tScale.range(data.scale);
		  
		  tAxis.scale(tScale);
		  log_group.call(tAxis);
	      }
	     );
    }; // end of function update_data
};





