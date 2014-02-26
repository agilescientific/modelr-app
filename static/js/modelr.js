/**
 * 
 */

/*
 * === === === === === === === === Classes ===
 * === === === === === === === === === === === === === === ===
 */

/*
 * Server class
 */
function PlotServer(hostname) {

    // The host hosting plots.
    this.hostname = hostname;

    /*
     * Asynchronously fetch json data from the plotting 
     * server 
     * @param url: Server url to fetch json from.
     * @param callback(data): do something on finish.
     */
    this.get_json = function get_scripts(url, callback) {
        $.getJSON(this.hostname + url, callback);
    }
}



/*
 * Class for building an earth model, mapping an image to rocks
 */
function EarthModel(){
    this.image = image; /* url to png*/
    this.mapping = mapping; /*dict*/
}

EarthModel.prototype.update = function(image, mapping){
    this.image = image;
    this.mapping = mapping;
}


function SeismicModel(server){
    this.server = server;
    this.params = {};
}

SeismicModel.prototype.get_slice_options = function(script, callback){

    url = self.server.hostname + 
	'/cross_section.json?script=' + script;
	
    update = function(data){
	for (var arg in data) {
	    this.params[arg] = data[arg]['default'];
	}
	callback(data);
    }
    $.getJSON(url, update);
}

SeismicModel.prototype.get_seismic_options = function(script, slice,
						      callback){
    
    url = self.server.hostname + 
	'/seismic_info.json?script=' + script + '&slice=' + slice;

    update = function(data){

	for (var arg in data){
	    this.params[arg] = data[arg]['default'];
	}
	callback(data);
    }
    $.getJSON(url, update);
}


SeismicModel.prototype.update = function(attr, value){
    this.params[attr] = value;
}

function PlotModel(server){
    this.server = server;
    this.params = {};
}

PlotModel.prototype.get_plot_options = function(script, callback){

    url = self.server.hostname + 
	'/plot_info.json?script=' + script;

    update = function(data){

	for (var arg in data){
	    this.params[arg] = data[arg]['default'];
	}
	callback(data);
    }
    $.getJSON(url, update);
}



/*
 * Class for building geometry model images
 */
function ModelBuilder(name, script, arguments) {
    
    this.name = name;
    this.script = script;
    this.arguments = arguments;
}


ModelBuilder.prototype.qs = function() {
    var args = this.arguments;

    query_str = '?script=' + this.script;

    for (argname in args) {
	var value = args[argname];
	query_str += '&' + argname + '=' + encodeURIComponent(value);
	}
    return query_str;
}

/*
 * Update the scenario with the default arguments provided by the 
 * plotting server.
 */
ModelBuilder.prototype.default_args=function default_args(argumentss){
    console.log('default_args', argumentss);
    var args = this.info.arguments;

    this.arguments = {};

    for ( var arg in args) {
        this.arguments[arg] = args[arg]['default'];
        if (arg in argumentss) {
            this.arguments[arg] = argumentss[arg];
        }

    }

}

/*
 * Update an argument.
 */
ModelBuilder.prototype.update = function update(attr, value) {
    this.arguments[attr] = value;
    this.on_change();
}

/*
 * Store the current arguments of this scenario on the server.
 */
ModelBuilder.prototype.put = function() {

    var url = this.qs();

    console.log(url);


    function success(url, textStatus, jqXHR) {
        console.log('post', textStatus);
    }

    $.post('/model_builder', {
        'URL' : url    
    }, success);
    $.document.window.href="/dashboard";
}


/*
 * Scenario 'class'
 */
function Scenario(name, script, arguments, rocks) {
    this.name = name;
    this.script = script;
    this.arguments = arguments;
    this.rocks = rocks;
    this.info = null;

}


/*
 * Store the current arguments of this scenario on the server.
 */
Scenario.prototype.put = function put() {

    var data = JSON.stringify({
        'script' : this.script,
        'arguments' : this.arguments
    });
    console.log(data);

    function success(data, textStatus, jqXHR) {
        console.log('post', textStatus);
    }

    $.post('/save_scenario', {
        'name' : this.name,
        'json' : data
    }, success, 'json')
}

/*
 * Get the Scenario from the plotting server. keyed on the 'name' attr of this
 * Scenario.
 */
Scenario.prototype.get = function get() {

    var scenario = this;

    function success(data, textStatus, jqXHR) {
        console.log('success');
        console.log(JSON.stringify(data), textStatus);

        scenario.script = data.script;
        scenario.set_current_script(data.script, data.arguments);

    }

    $.get('/save_scenario', {
        'name' : this.name
    }, success, 'json')
}

/*
 * Update an argument.
 */
Scenario.prototype.update = function update(attr, value) {
    this.arguments[attr] = value;
    this.on_change();
}

/*
 * Update the scenario with the default arguments provided by the 
 * plotting server.
 */
Scenario.prototype.default_args = function default_args(argumentss) {
    console.log('default_args', argumentss);
    var args = this.info.arguments;

    this.arguments = {};

    for ( var arg in args) {
        this.arguments[arg] = args[arg]['default'];
        if (arg in argumentss) {
            this.arguments[arg] = argumentss[arg];
        }

    }

}

/*
 * Create the query string for this Scenario. 
 * (to send to the plotting server)
 * 
 * eq result is ?script=foo.py&arg1=value1
 */
Scenario.prototype.qs = function() {
    var args = this.arguments;

    query_str = '?script=' + this.script;

    for (argname in args) {
        if (this.info.arguments[argname]['type'] == 'rock_properties_type') {
            var value = this.rocks[args[argname]];
        } else {
            var value = args[argname];

        }
        query_str += '&' + argname + '=' + encodeURIComponent(value);
    }

    return query_str;

}

/*
 * === === === === === === === === === === === = Functions ===
 * === === === === === === === === === === === === === === ===
 */

/*
 * Re populate select script with other options. 
 * @param server: a server object.
 * @param selection: selection string or tag 'select' element.
 * 
 */
function populate_scripts(server, url, selection) {

    console.log("populate_scripts!");

    select_script = $(selection);

    // Rmove options
    select_script.find('option').remove();
    console.log(url);
    server.get_json(url, function(data) {

        select_script = $(selection);
        select_script.find('option').remove();

        select_script.append('<option value="" >Scripts </option>');
        select_script.append('<option value="" disabled="true" >========</option>');

        for ( var i = 0; i < data.length; i++) {
            var script_doc = data[i];
            var script = script_doc[0];
            var doc = script_doc[1];
            select_script.append('<option value=' + 
				 script + '>' + script + ' --- ' + 
				 doc.slice(0, 20) + '</option>');
        }

    });

};

// This function is specific to the scenario.html
/*
 * @param sel: is a div to put the resulting form into.
 */
function display_form(sel) {

    var div = $(sel)
    div.children().remove();

    div.append('<form id=script_form action=""></form>');

    form = div.find('form#script_form');
    var data = this.info;

    form.append('<p>' + data.description + '</p>');

    args = data.arguments

    form_text = '<table>';

    for ( var arg in args) {
        form_text += '<tr>';

        var deflt = this.arguments[arg];
        var req = args[arg]['required'];

        if (deflt === null) {
            deflt = '';
        }

        /* form_text += '<td>' + arg + ':</td>';*/
        form_text += '<td>' + args[arg]['help'] + ':</td>';

        if (args[arg]['type'] == 'rock_properties_type') {
            form_text += '<td><select name="'
                    + arg
                    + '" class="script_form rock_selector"><option>Rocks</option><option>==========</option></select></td>';
        } else if (args[arg]['choices'] != null) {

            form_text += '<td><select name="' + arg + '" class="script_form choices_selector">'

            for (idx in args[arg]['choices']) {
                console.log('DEF', args[arg]['choices'][idx], deflt, args[arg]['choices'][idx] == deflt);
                if (args[arg]['choices'][idx] == deflt) {
                    form_text += '<option selected>' + args[arg]['choices'][idx] + '</option>';
                } else{
                    
                    form_text += '<option>' + args[arg]['choices'][idx] + '</option>';
                }
                
            }
            form_text += '</select></td>';

        } else {
            form_text += '<td><input class="script_form" type="text" name="' + arg + '" value="' + deflt
                    + '"></input></td>';
        }
    }

    form_text += '</table>';

    form.append(form_text);

    // inputs = form.find('.script_form');
    // inputs.change(server.input_changed);
    inputs = form.find('.script_form');

    var scenario = this;
    inputs.change(function(ip) {
        scenario.update($(this).attr('name'), $(this).val());
    });

    selectors = form.find('.rock_selector');

    for (rname in server.rocks) {
        rock_prop = server.rocks[rname];

        selectors.append('<option value="' + rname + '">' + rname + '</option>');
    }

    var scenario = this;
    $("select.rock_selector option").filter(function() {
        // may want to use $.trim in here
        var name = $(this).parent().attr('name');

        return $(this).val() == scenario.arguments[name];
    }).attr('selected', true);

    // server.input_changed();

}

/*
 * Get the rocks from a datalist element. inner option elements must contain the
 * elements data-name and data-value eg: <option data-name='NAME'
 * data-value='VALUE' />
 */
function get_rocks(datalist) {
    list_of_rocks = $(datalist).find('option');

    var rcks = {};
    list_of_rocks.each(function(index) {
        var name = $(list_of_rocks[index]).attr('data-name');
        var value = $(list_of_rocks[index]).attr('data-value');

        rcks[name] = value;
    });

    return rcks;
}

function save_scenario(scenario) {

}
