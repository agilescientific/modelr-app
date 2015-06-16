setup1D = function(rock_div,
		   rocks, fluids, rock_colour_map, max_depth,
		   rock_menu_div,plot_div, ref_menu_div, 
		   seismic_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";

    // total canvas dimensions
    var width = 900;
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
    core_width = widthScale(0.2);
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




    // Make the log plots
    var logXOffset = widthScale(.4);
    var logYOffset = heightScale(.1);
    var log_group = canvas.append("g").attr("id", "log-group")
	.attr("transform", "translate(" + logXOffset.toString() +',' +
	      logYOffset.toString() + ")");

    var logWidth = d3.scale.linear()
	.range([0, widthScale(.2)]).domain([0,1]);

    // Draw the time axis
    var tScale = d3.scale.linear()
	.range(0, heightScale(.9));
    var tAxis = d3.svg.axis()
	.orient("right")
	.ticks(5);

    // Axis label (done horizontally then rotated)
    log_group.append("text")
	.attr("class", "y-label")
	.attr("text-anchor", "end")
	.attr("y", widthScale(-.025))
	.attr("x",heightScale(-.08))
	.attr("dy", ".75em")
	.attr("transform", "rotate(-90)")
	.text("time [s]");


    
    var vpPlot = new logPlot(log_group, ["vp", "vp_sub"], "V\u209A",
			     logWidth(.2), 
			     logWidth(.2),heightScale(.8),"black");


    var vsPlot = new logPlot(log_group, ["vs", "vs_sub"], "V\u209B",
			     logWidth(.5), 
			     logWidth(.2),heightScale(.8), "red");

    var rhoPlot = new logPlot(log_group, ["rho","rho_sub"], 
			      "\u03C1",
			      logWidth(.8),
			      logWidth(.2), heightScale(.8),
			      "blue");
   




    // Make the gather plots
    var gatherXOffset = widthScale(.65);
    var gatherYOffset = heightScale(.1);
    var gather_group = canvas.append("g").attr("id", "log-group")
	.attr("transform", "translate(" + gatherXOffset.toString() +',' +
	      gatherYOffset.toString() + ")");



    var seismicPlot = new gatherPlot(gather_group, 0,
				     heightScale(.8),
				     'traces',
				     'F\u2080 synthetic',
				    
				     seismic_menu_div);
    
    var seismicsubPlot = new gatherPlot(gather_group,widthScale(.15),
					heightScale(.8),
					'traces_sub', 
					'F\u209B synthetic',
					seismic_menu_div);

    update_data();

    function update_data(){
	var offset = 10;
	var frequency = $("#frequency").val();
	var rock_intervals = rock_core.intervals;

	var json_load = {rock_data:JSON.stringify(rock_intervals),
		 height: heightScale(.8),
		 offset: offset,
		 frequency: frequency};

	$.post("/1D_model_data",json_load,
	      function(data){
		  data = JSON.parse(data);

		  vpPlot.update_plot(data);
		  vsPlot.update_plot(data);
		  rhoPlot.update_plot(data);
	
		  seismicPlot.update_plot(data,.9*height);
		  seismicsubPlot.update_plot(data,
					     .9*height);
	
		  tScale.domain(data.t);
		  tScale.range(data.scale);
		  
		  tAxis.scale(tScale);
		  log_group.call(tAxis);
	      }
	     );
    }; // end of function update_data
};





