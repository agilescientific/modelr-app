setup1D = function(rock_div,
                   rocks, fluids, rock_colour_map, max_depth,
                   rock_menu_div,plot_div, ref_menu_div, 
                   seismic_menu_div, server){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";

    // total canvas dimensions
    var width = 900;
    var height = 600;
 // Make height and width scales for convenient placement
    heightScale = d3.scale.linear()
        .range([0, height])
        .domain([0,1]);
    widthScale = d3.scale.linear()
        .range([0, width])
        .domain([0,1]);
    // initialize the canvas
    var canvas = d3.select(plot_div).append("svg")
            .attr("height", height)
            .attr("width", widthScale(.3));

   

    // Rock core
    core_width = widthScale(0.2);
    core_height = heightScale(0.8);
    core_x = widthScale(0);
    core_y = heightScale(0.1);

    var core_group = canvas.append("g")
            .attr("transform", "translate(" + core_x.toString() +"," +
                  core_y.toString()+ ")");

    var rock_core = new FluidSub(core_group, core_width, 
                                 height,
                                 rocks, fluids,
                                 rock_colour_map,rock_colour_map,
                                 rock_menu_div,
                                 onchange=update_data);

    // Make the log plots
    //var logXOffset = widthScale(0.3);
    //var logYOffset = heightScale(0.1);
    //var log_group = canvas.append("g").attr("id", "log-group")
     //       .attr("transform", "translate(" + logXOffset.toString() +',' +
    //              logYOffset.toString() + ")");

    //var logWidth = d3.scale.linear()
    //        .range([0, widthScale(0.2)])   // OUTPUT position
     //       .domain([0, 1]);               // INPUT data

    // Draw the time axis
    //var tScale = d3.scale.linear()
    //        .range(0, heightScale(0.9));
    //var tAxis = d3.svg.axis()
    //        .orient("right")
    //        .ticks(5);

    // function logPlot() API
    // log_group, properties, label, offset, width, height, colour

    //var vpPlot = new logPlot(log_group, [1, 2], "Vp",
    //                         logWidth(0.2), // offset
    //                         logWidth(0.2), heightScale(0.8), "black");

    //var vsPlot = new logPlot(log_group, [3, 4], "Vs",
    //                         logWidth(0.5), //offset
    //                         logWidth(0.2),heightScale(0.8), "red");

    //var rhoPlot = new logPlot(log_group, [5,6], "\u03C1",
    //                          logWidth(0.8),  //offset
    //                          logWidth(0.2), heightScale(0.8),
    //                          "blue");

    //var aiOffset =  widthScale(.55);
    //var ai_group = canvas.append("g")
    //        .attr("transform", "translate(" + aiOffset.toString() +',' +
    //              logYOffset.toString() + ")");
    //var aiPlot = new logPlot(ai_group, [1, 2], "Zp",
     //                        logWidth(.2),  logWidth(.2),
    //                         heightScale(.8), "black");


    // Make the gather plots
    //var gatherXOffset = widthScale(.68);
    //var gatherYOffset = heightScale(.1);
    //var gather_group = canvas.append("g").attr("id", "gather-group")
    //        .attr("transform", "translate(" + gatherXOffset.toString() +',' +
    //              gatherYOffset.toString() + ")");

//    var seismicPlot = new gatherPlot(gather_group, 0,
  //                                   heightScale(.8),
  //                                   'traces',
  //                                   'F\u2080 synthetic',
  //                                   seismic_menu_div);
    
    // var seismicsubPlot = new gatherPlot(gather_group,widthScale(.15),
    //                                     heightScale(.8),
    //                                     'traces_sub', 
    //                                     'Fs synthetic',
    //                                     seismic_menu_div);

    // // Axis label (done horizontally then rotated)
    // ai_group.append("text")
    //     .attr("class", "y-label")
    //     .attr("text-anchor", "end")
    //     .attr("y", widthScale(-.025))
    //     .attr("x",heightScale(-.0))
    //     .attr("dy", ".75em")
    //     .attr("transform", "rotate(-90)")
    //     .text("time [s]");
        

    var offset = 10;
    var frequency = $("#frequency").val();

    var seismic = {frequency: frequency,
                   wavelet: "ricker",
                   theta: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
                   dt: 0.001};
    
    var earth_model = rock_core.intervals();

    var vpLog = undefined,
    vsLog = undefined,
    rhoLog = undefined,
    zPLog = undefined;

    $.ajax(server + "/data.json?type=seismic&script=fluid_sub.py",
       {type: "GET", data: {payload: JSON.stringify({seismic: seismic, earth_model: earth_model})},
        success: function success(data){

            var height = 520;
            // Create Axis Plot
            var axisPlot = g3.plot('.plot')
                .setHeight(height)
                .setWidth(10)
                .setYTitle("depth [m]")
                .toggleXAxis(false)
                .setMargin(50,30,30,30)
                .setYDomain(data["z_lim"])
                .draw();

            // Create VP Plot
            var vpPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(height)
                .setWidth(100)
                .setXTitle("Vp")
                .toggleYAxis(false)
                .setYDomain(data["z_lim"])
                .setXDomain(data["vp_lim"])
                .draw();

            // Create VP Log 
            vpLog = g3.log(vpPlot, data["vp"])
            .setColor("red")
            .draw();

            // Create VS Plot
            var vsPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(height)
                .setWidth(100)
                .setXTitle("Vs")
                .toggleYAxis(false)
                .setYDomain(data["z_lim"])
                .setXDomain(data["vs_lim"])
                .draw();

            // Create VP Log
            vsLog = g3.log(vsPlot, data["vs"])
                .setColor("blue")
                .draw();

            // Create Rho Plot
            var rhoPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(height)
                .setWidth(100)
                .setXTitle("\u03C1")
                .toggleYAxis(false)
                .setYDomain(data["z_lim"])
                .setXDomain(data["rho_lim"])
                .draw();

            // Create Rho Log
            rhoLog = g3.log(rhoPlot, data["rho"])
                .setColor("green")
                .draw();

            // Create T Plot
            var tPlot = g3.plot('.plot')
                .setMargin(50, 30, 30, 40)
                .setHeight(600)
                .setWidth(10)
                .setYTitle("time [s]")
                .toggleXAxis(false)
                .setYDomain(data["t_lim"])
                .draw();

            // Create Zp Plot
            var zPPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(600)
                .setWidth(100)
                .setXTitle("Zp")
                .toggleYAxis(false)
                .setYDomain(data["t_lim"])
                .setXDomain(data["rpp_lim"])
                .draw();

            // Create Zp Log
            console.log(data["rpp"]);
            zPLog = g3.log(zPPlot, data["rpp"])
                .setYInt(0.001)
                .setColor("black")
                .draw();

            console.log(data);
        }
    });


    //update_data();

    function update_data(){
        var offset = 10;
        var frequency = $("#frequency").val();

        var seismic = {frequency: frequency,
                       wavelet: "ricker",
                       theta: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
                       dt: 0.001};
        
        var earth_model = rock_core.intervals();

        $.ajax(server + "/data.json?type=seismic&script=fluid_sub.py",
               {type: "GET", data: {payload: JSON.stringify({seismic: seismic, earth_model: earth_model})},
                success: function success(data){
                    
                    vpLog.reDraw(data["vp"]);
                    vsLog.reDraw(data["vs"]);
                    rhoLog.reDraw(data["rho"]);
                    zPLog.reDraw(data["rpp"]);
                    // vpPlot.update_plot(data["log_data"], data["z"]);
                    // vsPlot.update_plot(data["log_data"], data["z"]);
                    // rhoPlot.update_plot(data["log_data"], data["z"]);

                    // seismicPlot.update_plot(data["synth"],data["theta"],
                    //                         data["t"]);
                    // seismicsubPlot.update_plot(data["synth_sub"],
                    //                            data["theta"],
                    //                            data["t"]);
                    
                    // aiPlot.update_plot(data["rpp"], data["t"]);
                    // tScale.domain([data.t[0], data.t[data.t.length-1]]);
                    // tScale.range([0, core_height]);
                    
                    // tAxis.scale(tScale);
                    // ai_group.call(tAxis);
                }
               }
              );
    }; // end of function update_data
};


