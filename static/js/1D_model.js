setup1D = function(rock_div, rock_image_height, rock_image_width,
		   rocks, rock_colour_map, max_depth,
		   rock_menu_div, fluid_div, fluid_menu_div){

    var rock_title = "Rock core";
    var fluid_title = "Fluid core";
    // Rock core
    Core(rock_div, rock_image_height, rock_image_width,
	 rocks, rock_colour_map, max_depth, rock_title,
	 rock_menu_div);

    // Fluid core
    Core(fluid_div, rock_image_height, rock_image_width,
	 rocks, rock_colour_map, max_depth, fluid_title,
	 fluid_menu_div);
};

 

 
