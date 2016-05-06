+function() {

    angular.module('bg.spreadit', []);
}();
+function () {
    'use strict';

    angular.module('bg.spreadit').directive("siColumnManager", ['$timeout', '$parse', '$rootScope', directive]);

    function directive($timeout, $parse, $rootScope) {
        var supports = {
            xls: !!(window.XLSX && XLSX.utils),
            csv: !!(window.Papa && Papa.parse)
        };

        return {
            restrict: 'E',
            scope: {
                id: '@?siId',
                callback: '&?siChange',
                columns: '=?siColumns',
                sampleSize: '=?siSampleSize',
                excludeUnknownColumns: '=?siExcludeUnknownColumns',
                allowRenaming: '=?siAllowRenaming',
                // TODO: add support for these flags
                unknownColumnsGroupName: '=?siUnknownColumnsGroupName',
                groupUnknownColumns: '=?siGroupUnknownColumns',
                postProcessors: '=?siPostProcessors'
            },
            controller: ['$scope', '$element', '$attrs', controller],
            controllerAs: 'vm',
            templateUrl: '/columnManager.html'
        };

        function controller($scope, $element, $attrs) {

            _.defaults($scope, {
                id: "",
                columns: [],
                postProcessors: [],
                sampleSize: 3,
                excludeUnknownColumns: false,
                allowCustomRenaming: true,
                unknownColumnGroupName: '$extras',
                groupUnknownColumns: false,
                callback: angular.noop
            });

            var self = this;
            var columnMap = $scope.columns.reduce(function (map, entry) {

                var val;
                if (angular.isString(entry)) {
                    val = {
                        title: entry,
                        property: entry
                    };
                } else {
                    val = entry;
                }

                map[String(val.property).trim().toLowerCase()] = val;
                map[String(val.title).trim().toLowerCase()] = val;
                if (angular.isArray(entry.aliases)) {
                    entry.aliases.forEach(function (alias) {
                        map[String(alias).trim().toLowerCase()] = val;
                    });
                }
                return map;
            }, {});
            var titles = _.flatten($scope.columns.map(function (v) {
                if (angular.isString(v)) {
                    return v;
                } else if (angular.isArray(v.aliases)) {
                    return v.aliases.concat(v.title);
                } else {
                    return v.title;
                }
            })).map(function (v) {
                return String(v).trim().toLowerCase();
            });

            var presult;
            var $file;

            $scope.$watch('hasHeader', function () {

                if ($file && self.active) {
                    parseFile($file);
                }
            });

            this.remap = function (mapping) {

                remap(mapping);
                this.active = false;
                $element.removeClass('active');
            };

            this.cancel = function () {
                this.active = false;
                $element.removeClass('active');
            };

            function isHeader(values) {

                var isIt = $scope.hasHeader || values.some(function (value) {
                        return titles.indexOf(String(value).trim().toLowerCase()) !== -1;
                    });
                $scope.hasHeader = isIt;
                return isIt;
            }

            function isExcel(data) {
                return [0xD0, 0x09, 0x3C, 0x50].indexOf(data.charCodeAt(0)) !== -1;
            }

            function parseFile(file) {

                if (!file) {
                    return;
                }

                var reader = new FileReader();

                if (reader.readAsBinaryString) {

                    reader.onload = function (e) {
                        preparse(file, e.target.result);
                    };

                    reader.readAsBinaryString(file);
                } else {

                    reader.onload = function (e) {

                        /* convert data to binary string */
                        var data = new Uint8Array(e.target.result);
                        var buffer = [];
                        var i;
                        for (i = 0; i < data.length; i++) {
                            buffer[i] = String.fromCharCode(data[i]);
                        }
                        preparse(file, buffer.join(''));
                    };
                    reader.readAsArrayBuffer(file)
                }
            }

            function preparse(file, content) {

                if (supports.xls && isExcel(content)) {
                    preparseExcel(content);
                } else if (supports.csv) {
                    preparseCSV(file);
                }
            }


            function preparseExcel(content) {

                var c;
                var workbook = XLSX.read(content, {
                    type: 'binary',
                    sheetRows: $scope.sampleSize + 1,
                    cellHTML: false,
                    cellFormula: false
                });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var headerRange = XLSX.utils.decode_range(sheet['!ref']);
                var firstRow = [];
                var r = headerRange.s.r;
                for (c = headerRange.s.c; c < headerRange.e.c; c++) {
                    var cell = sheet[XLSX.utils.encode_cell({r: r, c: c})];
                    firstRow.push(cell ? String(cell.v).toLowerCase() : null);
                }

                var headers;
                var i = 1;
                if (!isHeader(firstRow)) {
                    headers = [];
                    for (c = headerRange.s.c; c <= headerRange.e.c; c++) {
                        headers.push('Column ' + i++);
                    }
                }
                var data = XLSX.utils.sheet_to_json(sheet, {
                    header: headers,
                    range: 0
                }).slice(0, 3);

                if ($scope.debug) {
                    window.$spreadIt = {
                        workbook: workbook,
                        sheet: sheet,
                        content: content
                    }
                }
                preview({
                    type: 'excel',
                    raw: content,
                    data: data,
                    headers: headers || Object.keys(data[0])
                });
            }

            function preparseCsvWithHeader(file) {

                Papa.parse(file, {
                    header: true,
                    preview: $scope.sampleSize,
                    complete: function (result) {

                        var headers = Object.keys(result.data[0]);
                        preview({
                            type: 'csv',
                            data: result.data,
                            raw: file,
                            headers: headers
                        });
                    }
                });
            }

            function preparseCsvSansHeader(file) {

                Papa.parse(file, {
                    header: false,
                    preview: $scope.sampleSize,
                    complete: function (result) {

                        var headers = result.data[0].map(function (column, i) {
                            return 'Column ' + (i + 1);
                        });

                        var data = result.data.map(function (columns) {

                            var obj = {};
                            columns.forEach(function (column, i) {
                                obj['Column ' + (i + 1)] = column;
                            });
                            return obj;
                        });
                        preview({
                            type: 'csv',
                            headers: headers,
                            data: data,
                            raw: file
                        });
                    }
                });
            }

            function preparseCSV(file) {
                Papa.parse(file, {
                    preview: 1,
                    complete: function (result) {
                        var firstRow = result.data[0];
                        if (firstRow && isHeader(firstRow)) {
                            preparseCsvWithHeader(file);
                        } else {
                            preparseCsvSansHeader(file);
                        }
                    }
                });
            }

            function parseExcel(content, headers) {
                var c;
                var workbook = XLSX.read(content, {
                    type: 'binary',
                    cellHTML: false,
                    cellFormula: false
                });
                var sheet = workbook.Sheets[workbook.SheetNames[0]];
                var headerRange = XLSX.utils.decode_range(sheet['!ref']);
                var firstRow = [];
                var r = headerRange.s.r;
                for (c = headerRange.s.c; c < headerRange.e.c; c++) {
                    var cell = sheet[XLSX.utils.encode_cell({r: r, c: c})];
                    firstRow.push(cell ? String(cell.v).toLowerCase() : null);
                }

                var data = XLSX.utils.sheet_to_json(sheet, {
                    header: headers,
                    range: isHeader(firstRow) ? 1 : 0
                }).map(function (result) {

                    delete result.$skip$;
                    return result;
                });


                $scope.callback({
                    $type: 'excel',
                    $file: $file,
                    $data: postProcess(data)
                });
            }

            function parseCsv(file, headers) {

                Papa.parse(file, {
                    header: false,
                    complete: function (result) {

                        var firstRow = result.data[0];
                        if (isHeader(firstRow)) {
                            result.data.splice(0, 1);
                        }
                        var data = result.data.map(function (columns) {

                            var obj = {};
                            columns.forEach(function (column, i) {

                                if (headers[i] !== '$skip$') {
                                    obj[headers[i]] = column;
                                }
                            });
                            return obj;
                        });
                        $scope.callback({
                            $type: 'csv',
                            $file: $file,
                            $data: postProcess(data)
                        });
                    }
                });
            }

            function preview(result) {

                $timeout(function () {

                    var preview = self.preview = [];

                    result.headers.forEach(function (header) {

                        var normalizedHeader = header.toLowerCase().trim();
                        var mapping;
                        if (columnMap[normalizedHeader]) {
                            mapping = columnMap[normalizedHeader];
                        } else if ($scope.excludeUnknownColumns) {
                            mapping = {
                                title: 'Ignore This Column',
                                property: '$skip$'
                            }
                        } else {
                            mapping = {
                                title: 'Keep This Column',
                                property: false
                            };
                        }
                        preview.push({
                            header: header,
                            mapping: mapping,
                            custom: header,
                            sample: result.data.map(function (v) {
                                return v[header];
                            })
                        });
                    });
                    var titles = [];
                    if (!$scope.excludeUnknownColumns) {
                        titles.push({
                            title: 'Keep This Column',
                            property: false
                        });
                    }

                    titles.push({
                        title: 'Ignore This Column',
                        property: '$skip$'
                    });

                    if (!$scope.excludeUnknownColumns && $scope.allowCustomRenaming) {
                        titles.push({
                            title: 'Rename This Column',
                            property: '$rename$'
                        });
                    }

                    self.titles = titles.concat($scope.columns.map(function (column) {

                        if (angular.isObject(column)) {
                            return column;
                        }

                        return {
                            title: column,
                            property: column
                        }
                    }));
                    presult = result;
                });
            }

            function remap(mapping) {

                var headers = mapping.map(function (column) {

                    var mapping = column.mapping;
                    if (mapping.property === false) {
                        return column.header;
                    } else if (mapping.property === '$rename$') {
                        return column.custom;
                    } else {
                        return column.mapping.property;
                    }
                });
                if (presult.type === 'csv') {
                    parseCsv(presult.raw, headers);
                } else {
                    parseExcel(presult.raw, headers);
                }
            }

            $rootScope.$on('si.preview', function (e, id, file) {

                if (file && id === $scope.id) {
                    $file = file;
                    $scope.hasHeader = false;
                    parseFile(file);
                    self.active = true;
                    $element.addClass('active');
                }
            });

            function postProcess(data) {

                if(!$scope.postProcessors.length) {
                    return data;
                }

                return data.map(function(obj) {

                    $scope.postProcessors.forEach(function(fn) {
                        fn(obj);
                    });
                    return obj;
                })
            }
        }
    }

}();

+function () {
    'use strict';

    angular.module('bg.spreadit').directive("siDropzone", ['$rootScope', directive]);
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
            templateUrl: '/dropzone.html',
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

+function () {
    'use strict';

    angular.module('bg.spreadit').directive("siFileSelect", ['$rootScope', directive]);
    angular.module('bg.spreadit').directive("siTrigger", ['$rootScope', directive]);

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
            var tagName = element.tagName.toLowerCase();
            var isFileInput = tagName === 'input' && $attrs.type && $attrs.type.toLowerCase() === 'file';
            var isLink = tagName === 'a';

            if (!isFileInput) {
                fileEl = angular.element('<input type="file">');
                var label = angular.element('<label>upload</label>');
                label.css('visibility', 'hidden').css('position', 'absolute').css('overflow', 'hidden')
                    .css('width', '0px').css('height', '0px').css('border', 'none')
                    .css('margin', '0px').css('padding', '0px').attr('tabindex', '-1');
                document.body.appendChild(label.append(fileEl)[0]);
                $element.on('click', function(e) {
                    e.preventDefault();
                    fileEl[0].click();
                });
            }

            if(isLink) {
                $element.attr('href', 'javascript:');
            }

            fileEl.attr('accepts', accepts.join());
            fileEl.on('change', onChange);

            function onChange(e) {
                $rootScope.$emit('si.preview', $scope.id, e.target.files[0]);
            }
        }
    }

}();

+function () {
    'use strict';

    angular.module('bg.spreadit').service("Spreadit", ['$rootScope', service]);

    function service($rootScope) {

    }

}();

angular.module('bg.spreadit').run(['$templateCache', function($templateCache) {
  'use strict';

  $templateCache.put('/columnManager.html',
    "<header class=\"si-column-manager-actions\"><label class=\"si-toggle si-has-header\"><input type=\"checkbox\" ng-model=\"hasHeader\"><i></i> First Row Is A Header</label><span class=\"si-close\" ng-click=\"vm.cancel()\">&times;</span></header><ul class=\"si-column-manager-columns\"><li ng-repeat=\"column in vm.preview track by $index\" class=\"si-column-manager-column\" ng-class=\"{'si-column-ignored': column.mapping.property === '$skip$'}\"><ul class=\"si-column-manager-samples\"><li class=\"si-column-manager-sample-header\"></li><li class=\"si-column-manager-sample si-column-manager-sample-title\">{{column.header}}</li><li ng-repeat=\"sample in column.sample track by $index\" class=\"si-column-manager-sample\">{{sample}}</li></ul><div class=\"si-column-manager-editor\"><label>Import As</label><div class=\"select-group\"><span>{{column.mapping.title}}</span><select ng-options=\"title.title for title in vm.titles track by title.property\" ng-model=\"column.mapping\"></select></div><input ng-model=\"column.custom\" ng-show=\"column.mapping.property === '$rename$'\"></div></li></ul><footer class=\"si-column-manager-actions\"><button class=\"si-import\" ng-click=\"vm.remap(vm.preview)\">Import</button></footer>"
  );


  $templateCache.put('/dropzone.html',
    "<svg class=\"si-icon\" xmlns=\"http://www.w3.org/2000/svg\" height=\"65px\" viewBox=\"0 0 55 65\"><path d=\"M55,22C55,22,55,22,55,22c0-0.2-0.1-0.4-0.2-0.6c0,0,0-0.1-0.1-0.1c-0.1-0.2-0.2-0.4-0.4-0.5l-20-20\n" +
    "    	c-0.2-0.2-0.3-0.3-0.5-0.4c0,0-0.1-0.1-0.1-0.1C33.4,0.2,33.2,0.1,33,0c0,0,0,0,0,0c-0.2,0-0.3,0-0.5,0h-25C3.4,0,0,3.4,0,7.5v50\n" +
    "    	C0,61.6,3.4,65,7.5,65h40c4.1,0,7.5-3.4,7.5-7.5v-35C55,22.3,55,22.2,55,22z M46.5,20h-9c-1.4,0-2.5-1.1-2.5-2.5v-9l5.7,5.7L46.5,20\n" +
    "    	z M24,51v-7h7v7H24z M14,51v-7h7v7H14z M41,41h-7v-7h7V41z M31,41h-7v-7h7V41z M14,34h7v7h-7V34z M24,31v-8h7v8H24z M14,23h7v8h-7\n" +
    "    	V23z M34,44h7v7h-7V44z M41,31h-7v-6.9c1,0.6,2.2,0.9,3.5,0.9H41V31z M47.5,60h-40C6.1,60,5,58.9,5,57.5v-50C5,6.1,6.1,5,7.5,5H30v6\n" +
    "    	H12.5c-0.8,0-1.5,0.7-1.5,1.5v40c0,0.8,0.7,1.5,1.5,1.5h30c0.8,0,1.5-0.7,1.5-1.5V25h6v32.5C50,58.9,48.9,60,47.5,60z\"/></svg><div class=\"message\"><h2>Wanna Import a spreadsheet (Excel or CSV)?</h2><p>Click here or drag and drop your file like it's hot.</p></div><input type=\"file\" accept=\".xlsx,.xls,.csv,.tsv,.txt\">"
  );

}]);
