
app.controller('2DCtrl', function ($scope, $http) {
    $scope.popover = {
	title: "Models",
	content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
    };

    // check for saved earth models
    $http.get('/earth_model?all').
        then(function(response) {

            var em = response.data;
            $scope.earthModels = em;
        });
    
    // populate the rocks
    $http.get('/rock?all').
        then(function(response) {
            // this callback will be called asynchronously
            // when the response is available
            var rocks = response.data;
            $scope.rocks = rocks;
        });
             
    console.log($scope.earthModels);
    
    $scope.test = function(model){
	//console.log($scope.savedEarthModel.data);
	//console.log(model);
	console.log(model);
	//console.log($scope.testatt);
	//$scope.savedEarthModel = {data:[3,6,2]};
    };
});
