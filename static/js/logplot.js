function logPlot(log_group, properties, label,
                 offset, width, height, colour){

    // Offset this curve
    var t = "translate("+offset.toString()+",0)";
    var plot = log_group.append("g")
        .attr("transform", t);

    // Append axis labels
    plot.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "start")
        .attr("y", -0.05*height)
        .attr("x", 0)
        .text(label);

    // Do the plot!
    this.update_plot = function update_plot(data, z){

    var subbed = false;

    // Get the min and max from each pair of logs.
    // First we need this helper function.
    var getCol = function (arr, col){
       var column = [];
       for(var i=0; i<arr.length; i++){
          column.push(arr[i][col]);
       }
       return column;
    };

    var max_val = -200000000;
    var min_val =  200000000;
    for (var log_ind=0; log_ind<properties.length; log_ind++){

        var this_index = properties[log_ind];
        var this_log = getCol(data, this_index);

        var log_max = Math.max.apply(null, this_log);
        var log_min = Math.min.apply(null, this_log);

        if (log_min < min_val) {
          min_val = log_min;
        }
        if (log_max > max_val) {
          max_val = log_max;
        }
    }

    // Set up the scales
    var propScale = d3.scale.linear() 
        .range([0, width])             // OUTPUT position
        .domain([min_val, max_val]);   // INPUT data
    
    var zScale = d3.scale.linear()
            .range([0, height])                // OUTPUT position
            .domain([z[0], z[z.length-1]]); // INPUT data

    // Clear old plot
    plot.selectAll("path").remove();

    // Now draw the lines
    for (var log_ind=0; log_ind<properties.length; log_ind++) {

        var property = properties[log_ind];

        var lineFunc = d3.svg.line()
        .x(function(d) {
            return propScale(d[property]);
        })
        .y(function(d) {
            return zScale(d[0]);
        });

        // Set the attributes
        var line = plot.append("path")
        .attr("d", lineFunc(data))
        .attr('stroke', colour)
        .attr('stroke-width', 1)
        .attr('fill', 'none');

        // Adjust the style if this is the subbed curve
        if(subbed){
          line.style("stroke-opacity", 0.5);
        }
        subbed = true;
    }
  }; // end of function update_plot
};
