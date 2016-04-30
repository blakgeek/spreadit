+function () {
    'use strict';

    angular.module('bg.spreadit').directive("siImporter", ['$rootScope', directive]);

    function directive($rootScope) {
        var accepts = [];

        if(!!(window.XLSX && XLSX.utils)) {
            accepts.push('.xls', '.xlsx');
        }

        if(!!(window.Papa && Papa.parse)) {
            accepts.push('.csv', '.tsv', '.txt');
        }

        return {
            restrict: 'E',
            scope: {
                id: '@siId'
            },
            controller: controller,
            controllerAs: 'vm',
            templateUrl: '/importer.html',
            link: link
        };

        function controller() {

        }

        function link($scope, $element, $attrs) {

            _.defaults($scope, {
                id: ""
            });

            var element = $element[0];
            element.setAttribute('accepts', accepts.join());
            element.querySelector('input[type="file"]').addEventListener('change', function (e) {
                $rootScope.$emit('si.preview', $scope.id, e.target.files[0]);
            });
        }
    }

}();
