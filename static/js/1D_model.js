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
    heightScale = d3.scale.linear()
      .range([0, height])
      .domain([0,1]);
    widthScale = d3.scale.linear()
      .range([0, width])
      .domain([0,1]);

    // Rock core
    core_width = widthScale(0.2);
    core_height = heightScale(0.8);
    core_x = widthScale(0);
    core_y = heightScale(0.1);

    var core_group = canvas.append("g")
    .attr("transform", "translate(" + core_x.toString() +"," +
          core_y.toString()+ ")");

    var rock_core = new FluidSub(core_group, core_width, 
                 core_height,
                 rocks, fluids,
                 rock_colour_map,rock_colour_map,
                 rock_menu_div,
                 onchange=update_data);

    // Make the log plots
    var logXOffset = widthScale(0.3);
    var logYOffset = heightScale(0.1);
    var log_group = canvas.append("g").attr("id", "log-group")
    .attr("transform", "translate(" + logXOffset.toString() +',' +
          logYOffset.toString() + ")");

    var logWidth = d3.scale.linear()
        .range([0, widthScale(0.2)])   // OUTPUT position
        .domain([0, 1]);               // INPUT data

    // Draw the time axis
    var tScale = d3.scale.linear()
    .range(0, heightScale(0.9));
    var tAxis = d3.svg.axis()
    .orient("right")
    .ticks(5);

    // function logPlot() API
    // log_group, properties, label, offset, width, height, colour

    var vpPlot = new logPlot(log_group, [1, 2], "Vp",
                 logWidth(0.2), // offset
                 logWidth(0.2), heightScale(0.8), "black");

    var vsPlot = new logPlot(log_group, [3, 4], "Vs",
                 logWidth(0.5), //offset
                 logWidth(0.2),heightScale(0.8), "red");

    var rhoPlot = new logPlot(log_group, [5,6], "\u03C1",
                  logWidth(0.8),  //offset
                  logWidth(0.2), heightScale(0.8),
                  "blue");

    var aiOffset =  widthScale(.55);
    var ai_group = canvas.append("g")
    .attr("transform", "translate(" + aiOffset.toString() +',' +
          logYOffset.toString() + ")");
    var aiPlot = new logPlot(ai_group, [1, 2], "Zp",
                 logWidth(.2),  logWidth(.2),
                 heightScale(.8), "black");


    // Make the gather plots
    var gatherXOffset = widthScale(.68);
    var gatherYOffset = heightScale(.1);
    var gather_group = canvas.append("g").attr("id", "gather-group")
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
                    'Fs synthetic',
                    seismic_menu_div);

    // Axis label (done horizontally then rotated)
    ai_group.append("text")
    .attr("class", "y-label")
    .attr("text-anchor", "end")
    .attr("y", widthScale(-.025))
    .attr("x",heightScale(-.0))
    .attr("dy", ".75em")
    .attr("transform", "rotate(-90)")
    .text("time [s]");


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

          vpPlot.update_plot(data["log_data"], data["z"],
                     data["z_scale"]);
          vsPlot.update_plot(data["log_data"], data["z"],
                     data["z_scale"]);
          rhoPlot.update_plot(data["log_data"], data["z"],
                      data["z_scale"]);
    
         

          seismicPlot.update_plot(data["synth"],data["theta"],
                      data["t"], data["scale"],
                      .9*height);
          seismicsubPlot.update_plot(data["synth_sub"],
                         data["theta"],
                         data["t"], data["scale"],
                         .9*height);
    
          aiPlot.update_plot(data["ai_data"], data["t"],
                     data["scale"]);
          tScale.domain(data.t);
          tScale.range(data.scale);
          
          tAxis.scale(tScale);
          ai_group.call(tAxis);
          }
         );
    }; // end of function update_data
};





