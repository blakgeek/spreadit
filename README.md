# Spreadit
## An angular directive inspired by the guys at [Conference Badge](https://www.conferencebadge.com/) for importing a spreadsheet 100% in the browser.

##<a name="install"></a> Install

* <a name="manual"></a>**Manual**: download latest from [here](https://github.com/blakgeek/spreadit/releases/latest)
* <a name="bower"></a>**Bower**:
  * `bower install spreadit --save`
* <a name="npm"></a>**NPM**: `npm install spreadit`

```html
<script src="angular(.min).js"></script>
<script src="spreadit(.min).js"></script>
```


Example HTML:
```html
<script src="angular.min.js"></script>
<script src="spreadit(.min).js"></script>

<button si-file-select="myId">Click Me To Import</button>
<si-column-manager
    si-id="myId"
    si-columns="columnConfigs"
    si-exclude-unknown-columns="false"
    si-sample-size="5"
    si-allow-renaming="true"
    si-change="doStuffWithData($data, $file, $type)">
</si-column-manager>
```
Example Javascript code:
```js
//inject directives and services.
var app = angular.module('superDopeDemo', ['bg.spreadit']);

app.controller('MyCtrl', ['$scope', function ($scope, Upload) {

    $scope.doStuffWithData = function(data, file, type) {

        console.log('file type: %s', type);
        console.log(data);
    };
}]);
```