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

            $scope.$watch('model.type', function(newValue) {
                drawChart();
            });

            $scope.$watch('model.foundset.serverSize', function(newValue) {
                if ($scope.model.source == 'foundset') {

                    var wanted = Math.min(newValue, 10);
                    if (wanted > $scope.model.foundset.viewPort.size) {
                        $scope.model.foundset.loadRecordsAsync(0, wanted);
                    }
                    drawChart();
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
                    drawChart();
                }
            });

            /* draw the chart when the value in foundset changes */
            $scope.$watchCollection('model.foundset.viewPort.rows', function(newValue) {
                drawChart();
            });

            function drawChart() {
                var labels = [];
                var dataset = {
                    label: "My First dataset",
                    backgroundColor: ['#5DA5DA',
                        '#FAA43A',
                        '#60BD68',
                        '#F17CB0',
                        '#B2912F',
                        '#B276B2',
                        '#DECF3F',
                        '#F15854',
                        '#4D4D4D'
                    ],
                    borderColor: [],
                    borderWidth: [],
                    hoverBackgroundColor: [],
                    hoverBorderColor: [],
                    hoverBorderWidth: [],
                    data: []
                };
                if (!$scope.model.foundset) return;

                var rows = $scope.model.foundset.viewPort.rows
                for (var i = 0; i < rows.length; i++) {
                    var row = rows[i]

                    labels.push(row.label ? row.label : row.value);
                    dataset.data.push(row.value);
                    if (row.backgroundColor) {
                        dataset.backgroundColor[i] = row.backgroundColor;
                    }
                    dataset.borderColor.push(row.borderColor ? row.borderColor : "#888");
                    dataset.borderWidth.push(row.borderWidth ? row.borderWidth : 1);
                    if (row.hoverBackgroundColor) dataset.hoverBackgroundColor.push(row.hoverBackgroundColor);
                    if (row.hoverBorderColor) dataset.hoverBorderColor.push(row.hoverBorderColor);
                    if (row.hoverBorderWidth) dataset.hoverBorderWidth.push(row.hoverBorderWidth);
                }

                $scope.model.node = {
                    type: $scope.model.type,
                    data: { labels: labels, datasets: [dataset] },
                    options: { responsive: false }
                };

            }
        },
        link: function($scope, $element, $attrs) {
            var tmp;
            var str;
            //refresh the chart
            function refreshChart() {
                if (!$scope.model.node) {
                    return;
                }

                // destroy the chart each time
                if ($scope.model.chart) {
                    $scope.model.chart.destroy();
                }

                //we need to pass a fresh node object to the chart each time we paint it as the library Chart.js
                // modifies the node object. On a second show if the node object has not changed, we pass it the same node object,
                //which this time is already once modified by the chart library and it will not draw the graph
                if (tmp !== $scope.model.node) {
                    tmp = $scope.model.node;
                    str = JSON.stringify($scope.model.node);
                }

                var x = JSON.parse(str);
                x.options.onClick = handleClick;
                var element = document.getElementById($scope.model.svyMarkupId + '-wrapper');
                var canvas = document.getElementById($scope.model.svyMarkupId);
                if (!canvas) return;
                var ctx = canvas.getContext("2d");
                // ctx.clearRect(0, 0, canvas.width, canvas.height);

                var parent = canvas.parentNode.parentNode;

                canvas.width = parent.offsetWidth;
                canvas.height = parent.offsetHeight;

                //find function callback params in options and create functions.
                var findFnInObj = function(obj) {
                    if (obj.isFunction == true) {
                        var fn = obj.name + "_func = new Function ("
                        for (var j = 0; j < obj.params.length; j++) {
                            fn += '"' + obj.params[j] + '"';
                            if (j == obj.params.length - 1) {
                                fn += ')';
                            } else {
                                fn += ',';
                            }

                        }
                        eval(fn);
                        return window[obj.name + "_func"];
                    }
                    //if value found is function, re set the key value.
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

                findFnInObj(x.options);
                // if we are not using a stylesheet make the width/height 100% to use all the space available.					
                if (element.className.length == 0) {
                    element.style.width = '100%';
                    element.style.height = '100%';
                }

                x.options.responsive = true;
                x.options.maintainAspectRatio = false;

                $scope.model.chart = new Chart(ctx, {
                    type: x.type,
                    data: x.data,
                    options: x.options
                });

            }

            //when window is resized redraw the chart

            var rtime;
            var timeout = false;
            var delta = 200;
            $(window).resize(function() {
                rtime = new Date();
                if (timeout === false) {
                    timeout = true;
                    setTimeout(resizeend, delta);
                }
            });

            function resizeend() {
                if (new Date() - rtime < delta) {
                    setTimeout(resizeend, delta);
                } else {
                    timeout = false;
                    if ($scope.model.chart) {
                        refreshChart();
                    }
                }
            }

            //if the data model node changes redraw the chart
            $scope.$watchCollection('model.node', function(newValue, oldValue) {
                refreshChart();
            });

            //handle click events.
            function handleClick(e) {
                var activePoints = $scope.model.chart.getElementsAtEvent(e);
                var firstPoint = activePoints[0];
                var label = $scope.model.chart.data.labels[firstPoint._index];
                var value = $scope.model.chart.data.datasets[firstPoint._datasetIndex].data[firstPoint._index];
                $scope.handlers.onClick(firstPoint._index, label, value);
            }

        },
        templateUrl: 'svychartjs/chart/chart.html'
    };
})
