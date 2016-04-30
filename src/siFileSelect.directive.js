+function () {
    'use strict';

    angular.module('bg.spreadit').directive("siFileSelect", ['$rootScope', directive]);

    function directive($rootScope) {
        var accepts = [];

        if(!!(window.XLSX && XLSX.utils)) {
            accepts.push('.xls', '.xlsx');
        }

        if(!!(window.Papa && Papa.parse)) {
            accepts.push('.csv', '.tsv', '.txt');
        }

        return {
            restrict: 'EA',
            scope: {
                id: '@?siFileSelect'
            },
            link: link
        };

        function link($scope, $element, $attrs) {

            var element = $element[0];
            var fileEl = $element;
            var isFileInput = element.tagName.toLowerCase() === 'input' && $attrs.type && $attrs.type.toLowerCase() === 'file';

            if (!isFileInput) {
                fileEl = angular.element('<input type="file">');
                var label = angular.element('<label>upload</label>');
                label.css('visibility', 'hidden').css('position', 'absolute').css('overflow', 'hidden')
                    .css('width', '0px').css('height', '0px').css('border', 'none')
                    .css('margin', '0px').css('padding', '0px').attr('tabindex', '-1');
                document.body.appendChild(label.append(fileEl)[0]);
                $element.on('click', function() {
                    fileEl[0].click();
                });
            }

            fileEl.attr('accepts', accepts.join());
            fileEl.on('change', onChange);

            function onChange(e) {
                $rootScope.$emit('si.preview', $scope.id, e.target.files[0]);
            }
        }
    }

}();
