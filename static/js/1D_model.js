setup1D = function(rock_div,
		   rocks, fluids, rock_colour_map, max_depth,
		   rock_menu_div,plot_div, ref_menu_div, 
		   seismic_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";

    // total canvas dimensions
    var width = 600;
    var height = 600;

    // initialize the canvas
    var canvas = d3.select(plot_div).append("svg")
	.attr("height", height)
	.attr("width", width);

    // Make height and width scales for convenient placement
    heightScale = d3.scale.linear().range([0, height])
	.domain([0,1]);
    widthScale = d3.scale.linear().range([0,width])
	.domain([0,1]);



    // Rock core
    core_width = widthScale(0.25);
    core_height = heightScale(.8);
    core_x = widthScale(0);
    core_y = heightScale(.1);

    var core_group = canvas.append("g")
	.attr("transform", "translate(" + core_x.toString() +"," +
	      core_y.toString()+ ")")

    var rock_core = new FluidSub(core_group, core_width, 
				 core_height,
				 rocks, fluids,
				 rock_colour_map,rock_colour_map,
				 rock_menu_div,
				 onchange=update_data);




    // Setup the log plots
    var plot_svg = d3.select(plot_div).append("svg")
	.attr("height", height)
	.attr("width", width);


    var logXOffset = widthScale(.1);
    var logYOffset = heightScale(0);
    var log_group = plot_svg.append("g").attr("id", "log-group")
	.attr("transform", "translate(" + logXOffset.toString() +',' +
	      logYOffset.toString() + ")");

    console.log(logXOffset);

    // Draw the time axis
    var tScale = d3.scale.linear()
	.range(0, .9*height);
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


    var log_width = 20;
    var vpPlot = new logPlot(log_group, "vp", "",40, log_width,"black",
			     false);
    var vpsubPlot = new logPlot(log_group, "vp_sub", "V\u209A",
				40, log_width, "black", true);

    var vsPlot = new logPlot(log_group, "vs", "",80, "red", false);
    var vssubPlot = new logPlot(log_group, "vs_sub", "V\u209B",80, 
				"red",
				true);

    var rhoPlot = new logPlot(log_group, "rho","", 120, "blue", 
			      false);
    var rhosubPlot = new logPlot(log_group, "rho_sub","\u03C1", 120, 
			      "blue", true);


    var seismicPlot = new gatherPlot(log_group, 200,'traces',
				     'F\u2080 synthetic',
				     seismic_menu_div);

    var seismicsubPlot = new gatherPlot(log_group,360,'traces_sub', 
					'F\u209B synthetic',
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
		  seismicsubPlot.update_plot(data,
					     .9*rock_image_height);
	
		  tScale.domain(data.t);
		  tScale.range(data.scale);
		  
		  tAxis.scale(tScale);
		  log_group.call(tAxis);
	      }
	     );
    }; // end of function update_data
};





