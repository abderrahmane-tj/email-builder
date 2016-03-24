var emailApp = angular.module('emailApp');
emailApp.directive('elementControls',
    ['$compile','$timeout','$templateRequest','repositionTooltip','preventBubbling',
        function($compile,$timeout,$templateRequest,repositionTooltip,preventBubbling){
    return {
        restrict: "A",
        scope:true,
        controller:controller,
        link: link
    };

    function controller($scope){
        // function made accessible for directives that require elementControls
        $scope.make = this.make = function (templateName, elementScope) {
            var templateUrl =
                'app/templates/controls/'+templateName+'.template.html';
            $templateRequest(templateUrl).then(function(html) {
                var controls = angular.element(html);
                $compile(controls)(elementScope);
                $scope.controls = controls;
            });
        };
    }

    function link($scope, element, attrs){
        var elementType = element.data('element-type');
        var blockType = element.data('block-type');
        var controllableData = $scope[blockType];
        handleTooltip();
        element.bind('click', handleClickOnContollable);

        //////////////////////////
        function handleTooltip(){
            if(elementType === 'img') {
                afterImgLoad(handleImageTooltip);
            }
        }
        function handleImageTooltip() {
            repositionTooltip();
            if(controllableData.tooltipstered && !element.hasClass('tooltipstered')){
                createTooltip(element,$scope);
                $('[highlight]').off('click', handleClickOnHighlight);
                $('[highlight]').on('click', handleClickOnHighlight);
                delete controllableData.tooltipstered;
            }
        }
        function afterImgLoad(fn){
            element.on('load', function () {
                //if($scope.imgStatus == 'loaded' || $scope.imgStatus == 'error'){
                fn();
                //}
            });
        }
        function handleClickOnContollable(event){
            if(preventBubbling(blockType)){
                return;
            }
            var tooltipstered = $(this).is('.tooltipstered');
            if(tooltipstered){
                console.log('clicked on tooltipstered');
                //delete controllableData.tooltipstered;
                destroyTooltip(element);
            }else{
                // tooltip on current element should be destroyed if user clicks
                // on a [highlight]able element

                createTooltip(element,$scope);
                //controllableData.tooltipstered = true;

                $timeout(function () {
                    $('[highlight]').on('click', handleClickOnHighlight);
                });
            }
        }
        function handleClickOnHighlight(event){
            //todo: check if we can OFF click on highlight, when relinking
            console.log('click on highlight, from element controls');
            $('[highlight]').off('click', handleClickOnHighlight);

            if(element.is(this)){
                return;
            }

            destroyTooltip(element);
        }
    }
    function destroyTooltip(element){
        console.log('destroy tooltip');
        //event.stopPropagation();
        // if element that triggered this does not exist anymore
        if (!jQuery.contains(document, element[0])) {
            console.log('element that triggered this does not exist anymore');
           return;
        }
        if(element.length && element.is('.tooltipstered')){
            element.tooltipster('destroy');
        }
    }
    function createTooltip(element, $scope){
        console.log('create tooltip');
        element.tooltipster({
            content: $scope.controls,
            interactive: true,
            autoClose: false,
            restoration: 'none'
        }).tooltipster('show');
    }
}]);