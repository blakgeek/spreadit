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
                groupUnknownColumns: '=?siGroupUnknownColumns'
            },
            controller: ['$scope', '$element', '$attrs', controller],
            controllerAs: 'vm',
            templateUrl: '/columnManager.html',
            link: link
        };

        function controller($scope, $element, $attrs) {

            _.defaults($scope, {
                id: "",
                columns: [],
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

            $scope.$watch('hasHeader', function() {

                if($file && self.active) {
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
                reader.onload = function (e) {
                    var content = e.target.result;
                    if (supports.xls && isExcel(content)) {
                        preparseExcel(content);
                    } else if (supports.csv) {
                        preparseCSV(file);
                    }
                };

                reader.readAsBinaryString(file);
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
                    $data: data
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
                            $data: data,
                            $file: $file
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
        }

        function link($scope, $element, $attrs, controller) {

        }
    }

}();
