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
            .toggleYAxis(false)
            .toggleY2Axis(true)
            .setY2Domain([0, 1000])
            .setMargin(core_y,30,30,widthScale(.18))
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

    // var vpPlot = undefined
    // tPlot = undefined,
    // rhoPlot = undefined,
    // vPPlot = undefined,
    // zPPlot = undefined,
    // vpLog = undefined,
    // vsLog = undefined,
    // rhoLog = undefined,
    // zPLog = undefined,
    // synthLog = undefined;
    var vpPlot, tPlot, rhoPlot, vPPlot, VPPlot, vpLog, vsLog, rhoLog, zPLog, SynthLog;

    $.ajax(server + "/data.json?type=seismic&script=fluid_sub.py",
       {type: "GET", data: {payload: JSON.stringify({seismic: seismic, earth_model: earth_model})},
        success: function success(data){

            var width = 120;
            //Create VP Plot
            vpPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setWidth(width)
                .setXTitle("Vp")
                .setMargin(core_y,10,30,10)
                .setYTickFormat("")
                .setYDomain(data["z_lim"])
                .setXDomain(data["vp_lim"])
                .draw();

            // Creat VPsub Log
            vpSubLog = g3.log(vpPlot, data["vp_sub"])
              .setColor("#CC0099")
              .draw();

            // Create VP Log 
            vpLog = g3.log(vpPlot, data["vp"])
            .setColor("red")
            .draw();

            // Create VS Plot
            vsPlot = g3.plot('.plot')
              .setXTicks(3)
              .setHeight(core_height)
              .setWidth(width)
              .setXTitle("Vs")
              .setMargin(core_y,10,30,10)
              .setYTickFormat("")
              .setYDomain(data["z_lim"])
              .setXDomain(data["vs_lim"])
              .draw();

            // Create VS Sub Log
            vsSubLog = g3.log(vsPlot, data["vs_sub"])
              .setColor("#0099FF")
              .draw();

            // Create VS Log
            vsLog = g3.log(vsPlot, data["vs"])
              .setColor("blue")
              .draw();

            // Create Rho Plot
            rhoPlot = g3.plot('.plot')
              .setXTicks(3)
              .setHeight(core_height)
              .setWidth(width)
              .setMargin(core_y,10,30,10)
              .setXTitle("\u03C1")
              .setYTickFormat("")
              .setYDomain(data["z_lim"])
              .setXDomain(data["rho_lim"])
              .draw();

            // Create Rho Sub
            rhoSubLog = g3.log(rhoPlot, data["rho_sub"])
              .setColor("#00FF00")
              .draw();

            // Create Rho Log
            rhoLog = g3.log(rhoPlot, data["rho"])
              .setColor("green")
              .draw();

            // Create T Plot
            tPlot = g3.plot('.plot')
              .setMargin(core_y,30,30,30)
              .setHeight(core_height)
              .setWidth(5)
              .setYTitle("time [s]")
              .setYTickFormat("")
              .toggleYAxis(false)
              .toggleY2Axis(true)
              .setY2Domain(data["t_lim"])
              .draw();

            // Create Zp Plot
            zPPlot = g3.plot('.plot')
              .setXTicks(3)
              .setHeight(core_height)
              .setMargin(core_y,10,30,10)
              .setWidth(width)
              .setXTitle("Zp")
              .setYTickFormat("")
              .setXDomain(data["rpp_lim"])
              .setYDomain(data["t_lim"])
              .draw();

            // Create Zp Sub
            zPSubLog = g3.log(zPPlot, data["rpp_sub"])
              .setYInt(data["dt"])
              .setColor("grey")
              .draw();

            // Create Zp Log
            zPLog = g3.log(zPPlot, data["rpp"])
              .setYInt(data["dt"])
              .setColor("black")
              .draw();

            // Create Synth Plot
            var synthLim = [d3.min(data["theta"]) - 10, d3.max(data["theta"]) + 10];
            var sub = 0;
            var synthPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setMargin(core_y,10,30,10)
                .setWidth(width)
                .setXTitle("F\u2080 synthetic")
                .setYTickFormat("")
                .setXDomain(synthLim)
                .setYDomain(data["t_lim"])
                .draw();

            // Create Synth Sub Plot
            var synthSubPlot = g3.plot('.plot')
                .setXTicks(3)
                .setHeight(core_height)
                .setMargin(core_y,10,30,10)
                .setWidth(width)
                .setXTitle("Fs synthetic")
                .setYTickFormat("")
                .setXDomain(synthLim)
                .setYDomain(data["t_lim"])
                .draw();

            // Create Synth Sub Log
            synthSubLog = g3.wiggle(synthSubPlot, data["synth_sub"])
              .setYInt(data["dt"])
              .setXMin(0)
              .setSampleRate(3)
              .setGain(50)
              .draw();

            // Create Synth Log
            synthLog = g3.wiggle(synthPlot, data["synth"])
              .setYInt(data["dt"])
              .setXMin(0)
              .setSampleRate(3)
              .setGain(50)
              .draw();
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

            vpPlot.reDraw(data["vp_lim"], data["z_lim"]);
            vpLog.reDraw(data["vp"]);
            vpSubLog.reDraw(data["vp_sub"]);
            
            vsPlot.reDraw(data["vs_lim"], data["z_lim"]);
            vsLog.reDraw(data["vs"]);
            vsSubLog.reDraw(data["vs_sub"]);
            
            rhoPlot.reDraw(data["rho_lim"], data["z_lim"]);
            rhoLog.reDraw(data["rho"]);
            rhoSubLog.reDraw(data["rho_sub"], data["rho_lim"], data["z_lim"]);
            
            tPlot.reDraw(null, null, null, data["t_lim"]);
            
            zPPlot.reDraw(data["rpp_lim"], data["t_lim"]);
            zPLog.reDraw(data["rpp"]);
            zPSubLog.reDraw(data["rpp_sub"]);
            
            var delay=600;
            var synthLim = [d3.min(data["theta"]) - 10, d3.max(data["theta"]) + 10];
            // Put a delay on the more complex operation so it doesn't affect the animation too bad
            setTimeout(function(){
              synthLog.reDraw(data["synth"], synthLim, data["t_lim"]);
              synthSubLog.reDraw(data["synth_sub"], synthLim, data["t_lim"]);
            }, delay); 
          }
        }
      );
    }; // end of function update_data
};