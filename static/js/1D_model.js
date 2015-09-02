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
    var heightScale = d3.scale.linear()
        .range([0, height])
        .domain([0,1]);
    var widthScale = d3.scale.linear()
        .range([0, width])
        .domain([0,1]);
   
    // Rock core
    var core_width = widthScale(0.15);
    var core_height = heightScale(0.8);
    var core_x = widthScale(0);
    var core_y = heightScale(0.1);

    var axisPlot = g3.plot('.plot')
            .setHeight(core_height)
            .setWidth(5)
            .setYTitle("depth [m]")
            .toggleXAxis(false)
            .setMargin(core_y,30,30,widthScale(.18))
            .setYDomain([0,1000])
            .draw();

    var canvas = d3.select(axisPlot.svg.node().parentNode);
    var core_group = canvas.append("g")
            .attr("transform", "translate(" + core_x.toString() +"," +
                  core_y.toString()+ ")");

    var rock_core = new FluidSub(core_group, core_width, 
                                 core_height,
                                 rocks, fluids,
                                 rock_colour_map,rock_colour_map,
                                 rock_menu_div,
                                 onchange=update_data);

   
        

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
    zPLog = undefined
    synthLog = undefined;

    $.ajax(server + "/data.json?type=seismic&script=fluid_sub.py",
       {type: "GET", data: {payload: JSON.stringify({seismic: seismic, earth_model: earth_model})},
        success: function success(data){

            var width = 65;
            // Create VP Plot
            var vpPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setWidth(width)
                .setXTitle("Vp")
                .setMargin(core_y,10,30,10)
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
                .setHeight(core_height)
                .setWidth(width)
                .setXTitle("Vs")
                .setMargin(core_y,10,30,10)
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
                .setHeight(core_height)
                .setWidth(width)
                .setMargin(core_y,10,30,10)
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
                .setMargin(core_y,30,30,30)
                .setHeight(core_height)
                .setWidth(5)
                .setYTitle("time [s]")
                .toggleXAxis(false)
                .setYDomain(data["t_lim"])
                .draw();

            // Create Zp Plot
            var zPPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setMargin(core_y,10,30,10)
                .setWidth(width)
                .setXTitle("Zp")
                .toggleYAxis(false)
                .setXDomain(data["rpp_lim"])
                .setYDomain(data["t_lim"])
                .draw();

            // Create Zp Log
            zPLog = g3.log(zPPlot, data["rpp"])
                .setYInt(data["dt"])
                .setColor("black")
                .draw();

            // Create Synth Plot
            var synthLim = [d3.min(data["theta"]) - 10, d3.max(data["theta"]) + 10];
            var synthPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setMargin(core_y,40,30,10)
                .setWidth(width)
                .setXTitle("Synth")
                .toggleYAxis(false)
                .setXDomain(synthLim)
                .setYDomain(data["t_lim"])
                .draw();

            synthLog = g3.wiggle(synthPlot, data["synth"])
                .setYInt(data["dt"])
                .setXMin(0)
                .setSampleRate(3)
                .setGain(50)
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
                    var synthLim = [d3.min(data["theta"]) - 10, d3.max(data["theta"]) + 10];
                    vpLog.reDraw(data["vp"], data["vp_lim"], data["z_lim"]);
                    vsLog.reDraw(data["vs"], data["vs_lim"], data["z_lim"]);
                    rhoLog.reDraw(data["rho"], data["rho_lim"], data["z_lim"]);
                    zPLog.reDraw(data["rpp"], data["rpp_lim"], data["t_lim"]);
                    synthLog.reDraw(data["synth"], synthLim, data["t_lim"]);
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


