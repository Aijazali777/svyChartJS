angular.module('svychartjsChart', ['servoy']).directive('svychartjsChart', function() {
    return {
        restrict: 'E',
        scope: {
            model: '=svyModel'
        },
        controller: function($scope, $element, $attrs) {},
        templateUrl: 'svychartjs/chart/chart.html'
    };
})

angular.module('svychartjsChart', ['servoy']).directive('svychartjsChart', function($timeout, $sabloConstants) {
    return {
        restrict: 'E',
        scope: {
            model: '=svyModel',
            handlers: "=svyHandlers",
            api: "=svyApi",
            svyApi: "=svyServoyapi"
        },
        controller: function($scope, $element, $attrs) {
            var className;
            var element = $element.children().first();
            Object.defineProperty($scope.model, $sabloConstants.modelChangeNotifier, {
                configurable: true,
                value: function(property, value) {
                    switch (property) {
                        case "styleClass":
                            if (className)
                                element.removeClass(className);
                            className = value;
                            if (className)
                                element.addClass(className);
                            break;
                    }
                }
            });
            var destroyListenerUnreg = $scope.$on("$destroy", function() {
                destroyListenerUnreg();
                delete $scope.model[$sabloConstants.modelChangeNotifier];
            });
            // data can already be here, if so call the modelChange function so
            // that it is initialized correctly.
            var modelChangFunction = $scope.model[$sabloConstants.modelChangeNotifier];
            for (key in $scope.model) {
                modelChangFunction(key, $scope.model[key]);
            }

            //if type is updated (re)draw chart
            $scope.$watch('model.type', function(newValue) {
                setupData();
            });

            $scope.$watch('model.foundset.serverSize', function(newValue) {
                if ($scope.model.source == 'foundset') {

                    var wanted = Math.min(newValue, 10);
                    if (wanted > $scope.model.foundset.viewPort.size) {
                        $scope.model.foundset.loadRecordsAsync(0, wanted);
                    }
                    setupData();
                }
            });
            $scope.$watch('model.foundset.viewPort.size', function(newValue) {
                if ($scope.model.source == 'foundset') {

                    if (newValue == 0 && $scope.model.foundset.serverSize > 0) {
                        var wanted = Math.min($scope.model.foundset.serverSize, 10);
                        if (wanted > $scope.model.foundset.viewPort.size) {
                            $scope.model.foundset.loadRecordsAsync(0, wanted);
                        }
                    }
                    setupData();
                }
            });

            /* draw the chart when the value in foundset changes */
            $scope.$watchCollection('model.foundset.viewPort.rows', function(newValue) {
                setupData();
            });

            var setupData = function() {
                var labels = [];
                var dataset = {
                    label: $scope.model.legendLabel,
                    backgroundColor: $scope.model.backgroundColor,
                    borderColor: $scope.model.borderColor,
                    borderWidth: $scope.model.borderWidth,
                    hoverBackgroundColor: $scope.model.hoverBackgroundColor,
                    hoverBorderColor: $scope.model.hoverBorderColor,
                    hoverBorderWidth: $scope.model.hoverBorderWidth,
                    data: []
                };
                if (!$scope.model.foundset) return;

                //add foundset records to dataset for chart.
                var rows = $scope.model.foundset.viewPort.rows
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i];
                    labels.push(row.label ? row.label : row.value);
                    dataset.data.push(row.value);
                }
                //update datamodel
                $scope.model.data = {
                    type: $scope.model.type,
                    data: { labels: labels, datasets: [dataset] }
                };
                $scope.model.options = {
                    responsive: true
                };

            }

        },
        link: function($scope, $element, $attrs) {

            //refresh the chart (if options updated)
            $scope.api.refreshChart = function() {
                if (!$scope.model.data || !$scope.model.options) {
                    return;
                }
                // update the chart if it already exists
                if ($scope.model.chart) {
                    $scope.model.chart.update();
                }
            }

            //(re)draw the chart
            var tmp;
            var str;
            $scope.api.drawChart = function() {
                if (!$scope.model.data) {
                    return;
                }

                if (!$scope.model.options) {
                    $scope.model.options = {};
                }

                // destroy the chart each time
                if ($scope.model.chart) {
                    $scope.model.chart.destroy();
                }

                //we need to pass a fresh node object to the chart each time we paint it as the library Chart.js
                // modifies the node object. On a second show if the node object has not changed, we pass it the same node object,
                //which this time is already once modified by the chart library and it will not draw the graph
                if (tmp !== $scope.model.data) {
                    tmp = $scope.model.data;
                    str = JSON.stringify($scope.model.data);
                }

                var x = JSON.parse(str);
                $scope.model.options.onClick = handleClick;
                var element = document.getElementById($scope.model.svyMarkupId + '-wrapper');
                var canvas = document.getElementById($scope.model.svyMarkupId);
                if (!canvas) return;
                var ctx = canvas.getContext("2d");

                var parent = canvas.parentNode.parentNode;
                canvas.width = parent.offsetWidth;
                canvas.height = parent.offsetHeight;

                //look for function callbacks in options
                var findFnInObj = function(obj) {
                    if (obj.isFunction == true) {
                        var fn = "new Function ("
                        for (var j = 0; j < obj.params.length; j++) {
                            fn += '"' + obj.params[j] + '"';
                            fn += ',';
                        }
                        fn += '"' + obj.expression + '")';
                        return eval(fn);
                    }
                    //if value found is function, re set the key value for that option
                    for (var i in obj) {
                        if (obj.hasOwnProperty(i) && (typeof obj[i] !== 'string')) {
                            var foundFunction = findFnInObj(obj[i]);
                            if (foundFunction) {
                                obj[i] = foundFunction;
                            }
                        }
                    }
                    return null;
                };

                //check if any of the options have callbacks and re-setup options object.
                findFnInObj($scope.model.options);

                // if we are not using a stylesheet make the width/height 100% to use all the space available.                  
                if (element.className.length == 0) {
                    element.style.width = '100%';
                    element.style.height = '100%';
                }
                //by default we will use responsive charts
                if (!$scope.model.options.responsive) {
                    $scope.model.options.responsive = true;
                    $scope.model.options.maintainAspectRatio = false;
                }
                $scope.model.chart = new Chart(ctx, {
                    type: x.type,
                    data: x.data,
                    options: $scope.model.options
                });
            }

            //if the data is updated (re)draw chart
            $scope.$watchCollection('model.data', function(newValue, oldValue) {
                $scope.api.drawChart();
            });

            //if the options are updated redraw the chart
            $scope.$watchCollection('model.options', function(newValue, oldValue) {
                $scope.api.refreshChart();
            });

            //handle click events.
            function handleClick(e) {
                var activePoints = $scope.model.chart.getElementsAtEvent(e);
                var dataset = $scope.model.chart.getDatasetAtEvent(e);
                var datasetIndex = dataset[0]._datasetIndex;                
                var selected = activePoints[datasetIndex];
                if (!selected) return;
                var label = $scope.model.chart.data.labels[selected._index];
                var value = $scope.model.chart.data.datasets[selected._datasetIndex].data[selected._index];
                if ($scope.handlers.onClick) {
                    $scope.handlers.onClick(selected._index, label, value);
                }
            }

        },
        templateUrl: 'svychartjs/chart/chart.html'
    };
})
