
app.controller('2DCtrl', function ($scope) {
	$scope.popover = {
		title: "Models",
		content: "Choose a model framework from the carousel below, or use the buttons to the right to upload an image or create a new model with the model builder. then assign the model's rocks and other parameters in the panel to the right."
	};

	//$scope.savedEarthModel = {data:[3,4,5,6,2]};
	$scope.model1 = {title: "Model 1", data:[
		{ rock:'rock1', color: "#fef" }, 
		{ rock: 'rock2', color: "fff" }, 
		{ rock: 'rock3', color: "ddd" }]};
	$scope.model2 = {title: "Model 2", data:[
		{ rock:'rock1', color: "#fef" }]};

	$scope.rocks = ['rock1', 'rock2', 'rock3', 'rock4', 'rock'];

	$scope.earthModels = [$scope.model1, $scope.model2];
	console.log($scope.earthModels);

	$scope.test = function(model){
		//console.log($scope.savedEarthModel.data);
		//console.log(model);
		console.log(model);
		//console.log($scope.testatt);
		//$scope.savedEarthModel = {data:[3,6,2]};
	}

});