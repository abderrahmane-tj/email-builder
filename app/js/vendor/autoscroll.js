var autoScroll = function (element_autoScroll, options_autoScroll) {
    function MoreEvents(context){
        this.listeners = {};
        this.__context = context || this;
    }

    MoreEvents.prototype = {
        constructor: MoreEvents,
        on: function(event, listener){
            this.listeners[event] = this.listeners[event] || [];
            this.listeners[event].push(listener);
            return this;
        },
        one: function(event, listener){
            function onceListener(){
                listener.apply(this, arguments);
                this.off(event, onceListener);
                return this;
            }
            return this.on(event, onceListener);
        },
        emit: function(event){
            if(typeof this.listeners[event] === 'undefined' || !this.listeners[event].length)
                return this;

            var args = Array.prototype.slice.call(arguments, 1),
                canRun = this.listeners[event].length;

            do{
                this.listeners[event][--canRun].apply(this.__context, args);
            }while(canRun);

            return this;
        },
        off: function(event, listener){
            if(this.listeners[event] === undefined || !this.listeners[event].length)
                return this;
            this.listeners[event] = this.listeners[event].filter(function(item){
                return item !== listener;
            });
            return this;
        },
        dispose: function(){
            for(var n in this){
                this[n] = null;
            }
        }
    };

    if(!Date.now){ Date.now = function(){ return new Date().getTime() } }

    function LocalDimensions(point, rect){
        for(var n in rect)
            setProp(this, n, rect[n]);

        setProp(this, 'x', point.x - rect.left+1);
        setProp(this, 'y', point.y - rect.top+1);

        setProp(this, 'north', (((rect.bottom - rect.top) / 2)-this.y));
        setProp(this, 'south', ((-(rect.bottom - rect.top) / 2)+this.y));
        setProp(this, 'east', (((rect.right - rect.left) / 2)-this.x));
        setProp(this, 'west', ((-(rect.right - rect.left) / 2)+this.x));


        function setProp(self, name, value){
            Object.defineProperty(self, name, {
                value: value,
                configurable: true,
                writable: false
            });
        }
    }
    function Point(elements){
        var self = this, el = [];

        if(typeof elements.length === 'undefined'){
            elements = [elements];
        }

        for(var i=0; i<elements.length; i++){
            if(elements[i] !== undefined){
                if(typeof elements[i] === 'string'){
                    try{
                        el.push(document.querySelector(e));
                    }catch(err){
                        throw new Error(e + ' is not a valid selector used by pointer.');
                    }
                }else{
                    el.push(elements[i]);
                }

            }
        }

        var pos = {}, direction = {}, rect, local,
            lastmousex=-1, lastmousey=-1, timestamp, mousetravel = 0,
            startX=-1, startY=-1, scrolling = false, buf = 10, timeOut = false,
            downTime;

        var special = {
            hold: []
        };

        this.emitter = new MoreEvents(this);

        this.origin = null;
        this.current = null;
        this.previous = null;

        window.addEventListener('mousedown', onDown, false);
        window.addEventListener('mousemove', onMove, false);
        window.addEventListener("mouseup", onUp, false);

        window.addEventListener('touchstart', onDown, false);
        window.addEventListener('touchmove', onMove, false);
        window.addEventListener('touchend', onUp, false);

        window.addEventListener('scroll', function(e){
            scrolling = true;
            clearTimeout(timeOut)
            timeOut = setTimeout(function(){
                scrolling = false;
            }, 100)
        });

        function onDown(e){

            downTime = Date.now();

            toPoint(e);
            self.down = true;
            self.up = false;
            if(self.current){
                self.origin = self.current;
                self.emitter.emit('down', self.current, local);
            }

            startX = self.x;
            startY = self.y;

        }

        function onMove(e){
            toPoint(e);
            self.emitter.emit('move', self.current, local);
            if(self.down && self.current){
                self.emitter.emit('stroke', self.current, local);
            }
        }

        function onUp(e){
            self.down = false;
            self.up = true;

            if(self.current){
                self.emitter.emit('up', self.current, local);
            }

            if(e.targetTouches){
                //Allow click within buf. A 20x20 square.
                if(!(self.y > (startY - buf) && self.y < (startY + buf) &&
                    self.x > (startX - buf) && self.x < (startX + buf))){
                    //If there is scrolling there was a touch flick.
                    if(!scrolling){
                        //No touch flick so
                        self.previous = null;
                        self.origin = null;
                        e.preventDefault();
                        return false;

                    }
                }
            }

            scrolling = false;
            self.previous = null;
            self.origin = null;
        }

        function toPoint(event){
            var dot, eventDoc, doc, body, pageX, pageY;
            var target, newTarget = null, leaving = null;

            event = event || window.event; // IE-ism
            target = event.target || event.srcElement;

            //Supporting touch
            //http://www.creativebloq.com/javascript/make-your-site-work-touch-devices-51411644
            if(event.targetTouches) {
                event.pageX = event.targetTouches[0].clientX;
                event.pageY = event.targetTouches[0].clientY;
                event.clientX = event.targetTouches[0].clientX;
                event.clientY = event.targetTouches[0].clientY;
            }else

            // If pageX/Y aren't available and clientX/Y are,
            // calculate pageX/Y - logic taken from jQuery.
            // (This is to support old IE)
            if (event.pageX === null && event.clientX !== null) {
                eventDoc = (event.target && event.target.ownerDocument) || document;
                doc = eventDoc.documentElement;
                body = eventDoc.body;

                event.pageX = event.clientX +
                    (doc && doc.scrollLeft || body && body.scrollLeft || 0) -
                    (doc && doc.clientLeft || body && body.clientLeft || 0);
                event.pageY = event.clientY +
                    (doc && doc.scrollTop  || body && body.scrollTop  || 0) -
                    (doc && doc.clientTop  || body && body.clientTop  || 0 );
            }

            if(self.x && self.y){
                if(event.pageX < self.x)
                    direction.h = 'left';
                else if(event.pageX > self.x)
                    direction.h = 'right';
                if(event.pageY < self.y)
                    direction.v = 'up';
                else if(event.pageY > self.y)
                    direction.v = 'down';

                lastmousex = self.x;
                lastmousey = self.y;
            }

            pos = {};
            //Prefer the viewport with clientX, and clientY.
            //pageX, and pageY change too often.
            pos.x = event.clientX;//event.pageX;
            pos.y = event.clientY;//event.pageY;

            if(self.current === null || self.outside(self.current)){
                for(var i=0; i<el.length; i++){
                    if(el[i] === target || self.inside(el[i])){
                        //if(el[i] === target){
                        newTarget = el[i];
                        break;
                    }
                }

                leaving = self.current;
                if(newTarget){
                    self.previous = self.current;
                    self.current = newTarget;
                }
            }
            function getRect(el){
                if(el === window){
                    return {
                        top: 0,
                        left: 0,
                        right: window.innerWidth,
                        bottom: window.innerHeight,
                        width: window.innerWidth,
                        height: window.innerHeight
                    };

                }else{
                    return el.getBoundingClientRect();
                }
            }
            rect = self.current ? getRect(self.current) : null;
            local = rect ? new LocalDimensions(self, rect) : null;

            if(leaving){
                if(!newTarget)
                    self.current = null;
                self.emitter.emit('leave', leaving, local);
            }

            if(newTarget){
                self.emitter.emit('enter', self.current, local);
            }

        }

        //Get speed
        //http://stackoverflow.com/questions/6417036/track-mouse-speed-with-js
        Object.defineProperty(this, 'speedX', {
            get: function(){
                var now = Date.now() / 1000;
                var dt =  now - timestamp;
                var dx = self.x - lastmousex;
                timestamp = now;
                return Math.round(dx / dt);// * 1000);
            }
        });

        Object.defineProperty(this, 'speedY', {
            get: function(){
                var now = Date.now() / 1000;
                var dt =  now - timestamp;
                var dy = self.y - lastmousey;
                timestamp = now;
                return Math.round(dy / dt);// * 1000);
            }
        });

        Object.defineProperty(this, 'x', {
            get: function(){
                return pos.x;
            }
        });

        Object.defineProperty(this, 'y', {
            get: function(){
                return pos.y;
            }
        });

        Object.defineProperty(this, 'h', {
            get: function(){
                return direction.h;
            }
        });

        Object.defineProperty(this, 'v', {
            get: function(){
                return direction.v;
            }
        });

        this.emitter.on('up', function(el, rect){
            if(downTime){
                for(var i=0; i<special.hold.length; i++){
                    if(Date.now() > downTime + (special.hold[i].data || 2000)){
                        special.hold[i].callback.call(this, el, rect);
                    }
                }
            }
            downTime = 0;
        });

        function removeSpecial(event, cb){
            for(var i=0; i<special[event].length; i++){
                if(special[event][i].callback === cb){
                    special[event].splice(i, 1);
                    return;
                }
            }
        }

        function addSpecial(event, data, cb){
            if(typeof cb === 'undefined'){
                cb = data;
                data = null;
            }

            special[event].push({
                data: data,
                callback: cb
            })
        }

        this.on = function(event, cb){
            if(special[event]){
                addSpecial(event, cb, arguments[2]);
                return this;
            }
            this.emitter.on(event, cb);
            return this;
        };

        this.off = function(event, cb){
            if(special[event]){
                removeSpecial(event, cb);
                return this;
            }
            this.emitter.off(event, cb);
            return this;
        };

        this.add = function(element){
            if(typeof element === 'string'){
                try{
                    el.push(document.querySelector(e));
                }catch(err){
                    throw new Error(e + ' is not a valid selector, and can\'t be used add to pointer.');
                }
            }else if(!element){
                throw new Error(e + ' can not be added to pointer.');
            }

            el.push(element);
        };

        this.destroy = function(){
            window.removeEventListener('mousedown', onDown, false);
            window.removeEventListener('mousemove', onMove, false);
            window.removeEventListener('mouseup', onUp, false);

            window.removeEventListener('touchstart', onDown, false);
            window.removeEventListener('touchmove', onMove, false);
            window.removeEventListener('touchend', onUp, false);
            el = null;
            self = null;
            pos = null;
            direction = null;
        };
    }

    Point.prototype = {
        constructor: Point,
        inside: function(el){
            if(!el) throw new TypeError('Cannot be inside '+el);
            function getRect(el){
                if(el === window){
                    return {
                        top: 0,
                        left: 0,
                        right: window.innerWidth,
                        bottom: window.innerHeight,
                        width: window.innerWidth,
                        height: window.innerHeight
                    };

                }else{
                    return el.getBoundingClientRect();
                }
            }
            var rect = getRect(el);
            return (this.y > rect.top && this.y < rect.bottom &&
            this.x > rect.left && this.x < rect.right);
        },
        outside: function(el){
            if(!el) throw new TypeError('Cannot be outside '+el);
            return !this.inside(el);
        }
    };

    function elementFromPoint(x, y){
        //noinspection JSUnresolvedVariable
        if(document.getElementFromPoint)
            return document.getElementFromPoint(x, y);
        else
            return document.elementFromPoint(x, y);
        return null;
    }

    function safeObject(src){
        var obj = {};
        for(var n in src)
            obj[n] = src[n];
        return obj;
    }

    function AutoScroller(elements, options){
        var self = this, pixels = 2;
        options = options || {};

        this.margin = options.margin || -1;
        this.scrolling = false;
        this.scrollWhenOutside = options.scrollWhenOutside || false;

        this.point = new Point(elements);

        if(!isNaN(options.pixels)){
            pixels = options.pixels;
        }

        if(typeof options.autoScroll === 'boolean'){
            this.autoScroll = options.autoScroll ? function(){return true;} : function(){return false;};
        }else if(typeof options.autoScroll === 'undefined'){
            this.autoScroll = function(){return false;};
        }else if(typeof options.autoScroll === 'function'){
            this.autoScroll = options.autoScroll;
        }

        this.destroy = function() {
            this.point.destroy();
        };

        Object.defineProperties(this, {
            down: {
                get: function(){ return self.point.down; }
            },
            interval: {
                get: function(){ return 1/pixels * 1000; }
            },
            pixels: {
                set: function(i){ pixels = i; },
                get: function(){ return pixels; }
            }
        });

        this.point.on('move', function(el, rect){

            if(!el) return;
            if(!self.autoScroll()) return;
            if(!self.scrollWhenOutside && this.outside(el)) return;

            if(self.point.y < rect.top + self.margin){
                autoScrollV(el, -1, rect);
            }else if(self.point.y > rect.bottom - self.margin){
                autoScrollV(el, 1, rect);
            }

            if(self.point.x < rect.left + self.margin){
                autoScrollH(el, -1, rect);
            }else if(self.point.x > rect.right - self.margin){
                autoScrollH(el, 1, rect);
            }
        });

        function autoScrollV(el, amount, rect){
            //if(!self.down) return;
            if(!self.autoScroll()) return;
            if(!self.scrollWhenOutside && self.point.outside(el)) return;
            if(el === window){
                window.scrollTo(el.pageXOffset, el.pageYOffset + amount);
            }else{
                el.scrollTop = el.scrollTop + amount;
            }

            setTimeout(function(){
                if(self.point.y < rect.top + self.margin){
                    autoScrollV(el, amount, rect);
                }else if(self.point.y > rect.bottom - self.margin){
                    autoScrollV(el, amount, rect);
                }
            }, self.interval);
        }

        function autoScrollH(el, amount, rect){
            //if(!self.down) return;
            if(!self.autoScroll()) return;
            if(!self.scrollWhenOutside && self.point.outside(el)) return;
            if(el === window){
                window.scrollTo(el.pageXOffset + amount, el.pageYOffset);
            }else{
                el.scrollLeft = el.scrollLeft + amount;
            }

            setTimeout(function(){
                if(self.point.x < rect.left + self.margin){
                    autoScrollH(el, amount, rect);
                }else if(self.point.x > rect.right - self.margin){
                    autoScrollH(el, amount, rect);
                }
            }, self.interval);
        }

    }

    return new AutoScroller(element_autoScroll, options_autoScroll);
};