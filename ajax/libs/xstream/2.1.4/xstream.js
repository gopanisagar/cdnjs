(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.xstream = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var empty = {};
function noop() { }
function copy(a) {
    var l = a.length;
    var b = Array(l);
    for (var i = 0; i < l; ++i) {
        b[i] = a[i];
    }
    return b;
}
var emptyListener = {
    _n: noop,
    _e: noop,
    _c: noop,
};

function internalizeProducer(producer) {
    producer._start =
        function _start(il) {
            il.next = il._n;
            il.error = il._e;
            il.complete = il._c;
            this.start(il);
        };
    producer._stop = producer.stop;
}
function invoke(f, args) {
    switch (args.length) {
        case 0: return f();
        case 1: return f(args[0]);
        case 2: return f(args[0], args[1]);
        case 3: return f(args[0], args[1], args[2]);
        case 4: return f(args[0], args[1], args[2], args[3]);
        case 5: return f(args[0], args[1], args[2], args[3], args[4]);
        default: return f.apply(void 0, args);
    }
}
function compose2(f1, f2) {
    return function composedFn(arg) {
        return f1(f2(arg));
    };
}
function and(f1, f2) {
    return function andFn(t) {
        return f1(t) && f2(t);
    };
}
var CombineListener = (function () {
    function CombineListener(i, p) {
        this.i = i;
        this.p = p;
        p.ils.push(this);
    }
    CombineListener.prototype._n = function (t) {
        var p = this.p;
        if (!p.out)
            return;
        var vals = p.vals;
        p.hasVal[this.i] = true;
        vals[this.i] = t;
        if (!p.ready) {
            p.up();
        }
        if (p.ready) {
            try {
                p.out._n(invoke(p.project, vals));
            }
            catch (e) {
                p.out._e(e);
            }
        }
    };
    CombineListener.prototype._e = function (err) {
        var out = this.p.out;
        if (!out)
            return;
        out._e(err);
    };
    CombineListener.prototype._c = function () {
        var p = this.p;
        if (!p.out)
            return;
        if (--p.ac === 0) {
            p.out._c();
        }
    };
    return CombineListener;
}());
var CombineProducer = (function () {
    function CombineProducer(project, streams) {
        this.project = project;
        this.streams = streams;
        this.out = emptyListener;
        this.ils = [];
        this.ready = false;
        this.hasVal = new Array(streams.length);
        this.vals = new Array(streams.length);
        this.ac = streams.length;
    }
    CombineProducer.prototype.up = function () {
        for (var i = this.hasVal.length - 1; i >= 0; i--) {
            if (!this.hasVal[i]) {
                return;
            }
        }
        this.ready = true;
    };
    CombineProducer.prototype._start = function (out) {
        this.out = out;
        var streams = this.streams;
        for (var i = streams.length - 1; i >= 0; i--) {
            streams[i]._add(new CombineListener(i, this));
        }
    };
    CombineProducer.prototype._stop = function () {
        var streams = this.streams;
        for (var i = streams.length - 1; i >= 0; i--) {
            streams[i]._remove(this.ils[i]);
        }
        this.out = null;
        this.ils = [];
        this.ready = false;
        this.hasVal = new Array(streams.length);
        this.vals = new Array(streams.length);
        this.ac = streams.length;
    };
    return CombineProducer;
}());
var FromArrayProducer = (function () {
    function FromArrayProducer(a) {
        this.a = a;
    }
    FromArrayProducer.prototype._start = function (out) {
        var a = this.a;
        for (var i = 0, l = a.length; i < l; i++) {
            out._n(a[i]);
        }
        out._c();
    };
    FromArrayProducer.prototype._stop = function () {
    };
    return FromArrayProducer;
}());
exports.FromArrayProducer = FromArrayProducer;
var FromPromiseProducer = (function () {
    function FromPromiseProducer(p) {
        this.p = p;
        this.on = false;
    }
    FromPromiseProducer.prototype._start = function (out) {
        var prod = this;
        this.on = true;
        this.p.then(function (v) {
            if (prod.on) {
                out._n(v);
                out._c();
            }
        }, function (e) {
            out._e(e);
        }).then(null, function (err) {
            setTimeout(function () { throw err; });
        });
    };
    FromPromiseProducer.prototype._stop = function () {
        this.on = false;
    };
    return FromPromiseProducer;
}());
exports.FromPromiseProducer = FromPromiseProducer;
var MergeProducer = (function () {
    function MergeProducer(streams) {
        this.streams = streams;
        this.out = emptyListener;
        this.ac = streams.length;
    }
    MergeProducer.prototype._start = function (out) {
        this.out = out;
        var streams = this.streams;
        for (var i = streams.length - 1; i >= 0; i--) {
            streams[i]._add(this);
        }
    };
    MergeProducer.prototype._stop = function () {
        var streams = this.streams;
        for (var i = streams.length - 1; i >= 0; i--) {
            streams[i]._remove(this);
        }
        this.out = null;
        this.ac = streams.length;
    };
    MergeProducer.prototype._n = function (t) {
        this.out._n(t);
    };
    MergeProducer.prototype._e = function (err) {
        this.out._e(err);
    };
    MergeProducer.prototype._c = function () {
        if (--this.ac === 0) {
            this.out._c();
        }
    };
    return MergeProducer;
}());
exports.MergeProducer = MergeProducer;
var PeriodicProducer = (function () {
    function PeriodicProducer(period) {
        this.period = period;
        this.intervalID = -1;
        this.i = 0;
    }
    PeriodicProducer.prototype._start = function (stream) {
        var self = this;
        function intervalHandler() { stream._n(self.i++); }
        this.intervalID = setInterval(intervalHandler, this.period);
    };
    PeriodicProducer.prototype._stop = function () {
        if (this.intervalID !== -1)
            clearInterval(this.intervalID);
        this.intervalID = -1;
        this.i = 0;
    };
    return PeriodicProducer;
}());
exports.PeriodicProducer = PeriodicProducer;
var DebugOperator = (function () {
    function DebugOperator(spy, ins) {
        if (spy === void 0) { spy = null; }
        this.spy = spy;
        this.ins = ins;
        this.out = null;
    }
    DebugOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    DebugOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
    };
    DebugOperator.prototype._n = function (t) {
        if (this.spy) {
            try {
                this.spy(t);
            }
            catch (e) {
                this.out._e(e);
            }
        }
        else {
            console.log(t);
        }
        this.out._n(t);
    };
    DebugOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    DebugOperator.prototype._c = function () {
        this.out._c();
    };
    return DebugOperator;
}());
exports.DebugOperator = DebugOperator;
var DropOperator = (function () {
    function DropOperator(max, ins) {
        this.max = max;
        this.ins = ins;
        this.out = null;
        this.dropped = 0;
    }
    DropOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    DropOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
        this.dropped = 0;
    };
    DropOperator.prototype._n = function (t) {
        if (this.dropped++ >= this.max)
            this.out._n(t);
    };
    DropOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    DropOperator.prototype._c = function () {
        this.out._c();
    };
    return DropOperator;
}());
exports.DropOperator = DropOperator;
var OtherIL = (function () {
    function OtherIL(out, op) {
        this.out = out;
        this.op = op;
    }
    OtherIL.prototype._n = function (t) {
        this.op.end();
    };
    OtherIL.prototype._e = function (err) {
        this.out._e(err);
    };
    OtherIL.prototype._c = function () {
        this.op.end();
    };
    return OtherIL;
}());
var EndWhenOperator = (function () {
    function EndWhenOperator(o, 
        ins) {
        this.o = o;
        this.ins = ins;
        this.out = null;
        this.oil = emptyListener; 
    }
    EndWhenOperator.prototype._start = function (out) {
        this.out = out;
        this.o._add(this.oil = new OtherIL(out, this));
        this.ins._add(this);
    };
    EndWhenOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.o._remove(this.oil);
        this.out = null;
        this.oil = null;
    };
    EndWhenOperator.prototype.end = function () {
        this.out._c();
    };
    EndWhenOperator.prototype._n = function (t) {
        this.out._n(t);
    };
    EndWhenOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    EndWhenOperator.prototype._c = function () {
        this.end();
    };
    return EndWhenOperator;
}());
exports.EndWhenOperator = EndWhenOperator;
var FilterOperator = (function () {
    function FilterOperator(passes, ins) {
        this.passes = passes;
        this.ins = ins;
        this.out = null;
    }
    FilterOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    FilterOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
    };
    FilterOperator.prototype._n = function (t) {
        try {
            if (this.passes(t))
                this.out._n(t);
        }
        catch (e) {
            this.out._e(e);
        }
    };
    FilterOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    FilterOperator.prototype._c = function () {
        this.out._c();
    };
    return FilterOperator;
}());
exports.FilterOperator = FilterOperator;
var FCIL = (function () {
    function FCIL(out, op) {
        this.out = out;
        this.op = op;
    }
    FCIL.prototype._n = function (t) {
        this.out._n(t);
    };
    FCIL.prototype._e = function (err) {
        this.out._e(err);
    };
    FCIL.prototype._c = function () {
        this.op.less();
    };
    return FCIL;
}());
var FlattenConcOperator = (function () {
    function FlattenConcOperator(ins) {
        this.ins = ins;
        this.active = 1; 
        this.out = null;
    }
    FlattenConcOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    FlattenConcOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.active = 1;
        this.out = null;
    };
    FlattenConcOperator.prototype.less = function () {
        if (--this.active === 0) {
            this.out._c();
        }
    };
    FlattenConcOperator.prototype._n = function (s) {
        this.active++;
        s._add(new FCIL(this.out, this));
    };
    FlattenConcOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    FlattenConcOperator.prototype._c = function () {
        this.less();
    };
    return FlattenConcOperator;
}());
exports.FlattenConcOperator = FlattenConcOperator;
var FIL = (function () {
    function FIL(out, op) {
        this.out = out;
        this.op = op;
    }
    FIL.prototype._n = function (t) {
        this.out._n(t);
    };
    FIL.prototype._e = function (err) {
        this.out._e(err);
    };
    FIL.prototype._c = function () {
        this.op.inner = null;
        this.op.less();
    };
    return FIL;
}());
var FlattenOperator = (function () {
    function FlattenOperator(ins) {
        this.ins = ins;
        this.inner = null; 
        this.il = null; 
        this.open = true;
        this.out = null;
    }
    FlattenOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    FlattenOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.inner = null;
        this.il = null;
        this.open = true;
        this.out = null;
    };
    FlattenOperator.prototype.less = function () {
        if (!this.open && !this.inner)
            this.out._c();
    };
    FlattenOperator.prototype._n = function (s) {
        var _a = this, inner = _a.inner, il = _a.il;
        if (inner && il)
            inner._remove(il);
        (this.inner = s)._add(this.il = new FIL(this.out, this));
    };
    FlattenOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    FlattenOperator.prototype._c = function () {
        this.open = false;
        this.less();
    };
    return FlattenOperator;
}());
exports.FlattenOperator = FlattenOperator;
var FoldOperator = (function () {
    function FoldOperator(f, seed, ins) {
        this.f = f;
        this.seed = seed;
        this.ins = ins;
        this.out = null;
        this.acc = seed;
    }
    FoldOperator.prototype._start = function (out) {
        this.out = out;
        out._n(this.acc);
        this.ins._add(this);
    };
    FoldOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
        this.acc = this.seed;
    };
    FoldOperator.prototype._n = function (t) {
        try {
            this.out._n(this.acc = this.f(this.acc, t));
        }
        catch (e) {
            this.out._e(e);
        }
    };
    FoldOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    FoldOperator.prototype._c = function () {
        this.out._c();
    };
    return FoldOperator;
}());
exports.FoldOperator = FoldOperator;
var LastOperator = (function () {
    function LastOperator(ins) {
        this.ins = ins;
        this.out = null;
        this.has = false;
        this.val = empty;
    }
    LastOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    LastOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
        this.has = false;
        this.val = empty;
    };
    LastOperator.prototype._n = function (t) {
        this.has = true;
        this.val = t;
    };
    LastOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    LastOperator.prototype._c = function () {
        var out = this.out;
        if (this.has) {
            out._n(this.val);
            out._c();
        }
        else {
            out._e('TODO show proper error');
        }
    };
    return LastOperator;
}());
exports.LastOperator = LastOperator;
var MFCIL = (function () {
    function MFCIL(out, op) {
        this.out = out;
        this.op = op;
    }
    MFCIL.prototype._n = function (t) {
        this.out._n(t);
    };
    MFCIL.prototype._e = function (err) {
        this.out._e(err);
    };
    MFCIL.prototype._c = function () {
        this.op.less();
    };
    return MFCIL;
}());
var MapFlattenConcOperator = (function () {
    function MapFlattenConcOperator(mapOp) {
        this.mapOp = mapOp;
        this.active = 1; 
        this.out = null;
    }
    MapFlattenConcOperator.prototype._start = function (out) {
        this.out = out;
        this.mapOp.ins._add(this);
    };
    MapFlattenConcOperator.prototype._stop = function () {
        this.mapOp.ins._remove(this);
        this.active = 1;
        this.out = null;
    };
    MapFlattenConcOperator.prototype.less = function () {
        if (--this.active === 0) {
            this.out._c();
        }
    };
    MapFlattenConcOperator.prototype._n = function (v) {
        this.active++;
        try {
            this.mapOp.project(v)._add(new MFCIL(this.out, this));
        }
        catch (e) {
            this.out._e(e);
        }
    };
    MapFlattenConcOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    MapFlattenConcOperator.prototype._c = function () {
        this.less();
    };
    return MapFlattenConcOperator;
}());
exports.MapFlattenConcOperator = MapFlattenConcOperator;
var MFIL = (function () {
    function MFIL(out, op) {
        this.out = out;
        this.op = op;
    }
    MFIL.prototype._n = function (t) {
        this.out._n(t);
    };
    MFIL.prototype._e = function (err) {
        this.out._e(err);
    };
    MFIL.prototype._c = function () {
        this.op.inner = null;
        this.op.less();
    };
    return MFIL;
}());
var MapFlattenOperator = (function () {
    function MapFlattenOperator(mapOp) {
        this.mapOp = mapOp;
        this.inner = null; 
        this.il = null; 
        this.open = true;
        this.out = null;
    }
    MapFlattenOperator.prototype._start = function (out) {
        this.out = out;
        this.mapOp.ins._add(this);
    };
    MapFlattenOperator.prototype._stop = function () {
        this.mapOp.ins._remove(this);
        this.inner = null;
        this.il = null;
        this.open = true;
        this.out = null;
    };
    MapFlattenOperator.prototype.less = function () {
        if (!this.open && !this.inner) {
            this.out._c();
        }
    };
    MapFlattenOperator.prototype._n = function (v) {
        var _a = this, inner = _a.inner, il = _a.il;
        if (inner && il)
            inner._remove(il);
        try {
            (this.inner = this.mapOp.project(v))._add(this.il = new MFIL(this.out, this));
        }
        catch (e) {
            this.out._e(e);
        }
    };
    MapFlattenOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    MapFlattenOperator.prototype._c = function () {
        this.open = false;
        this.less();
    };
    return MapFlattenOperator;
}());
exports.MapFlattenOperator = MapFlattenOperator;
var MapOperator = (function () {
    function MapOperator(project, ins) {
        this.project = project;
        this.ins = ins;
        this.out = null;
    }
    MapOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    MapOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
    };
    MapOperator.prototype._n = function (t) {
        try {
            this.out._n(this.project(t));
        }
        catch (e) {
            this.out._e(e);
        }
    };
    MapOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    MapOperator.prototype._c = function () {
        this.out._c();
    };
    return MapOperator;
}());
exports.MapOperator = MapOperator;
var FilterMapOperator = (function (_super) {
    __extends(FilterMapOperator, _super);
    function FilterMapOperator(passes, project, ins) {
        _super.call(this, project, ins);
        this.passes = passes;
    }
    FilterMapOperator.prototype._n = function (v) {
        if (this.passes(v)) {
            _super.prototype._n.call(this, v);
        }
        ;
    };
    return FilterMapOperator;
}(MapOperator));
exports.FilterMapOperator = FilterMapOperator;
var MapToOperator = (function () {
    function MapToOperator(val, ins) {
        this.val = val;
        this.ins = ins;
        this.out = null;
    }
    MapToOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    MapToOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
    };
    MapToOperator.prototype._n = function (t) {
        this.out._n(this.val);
    };
    MapToOperator.prototype._e = function (err) {
        this.out._e(err);
    };
    MapToOperator.prototype._c = function () {
        this.out._c();
    };
    return MapToOperator;
}());
exports.MapToOperator = MapToOperator;
var ReplaceErrorOperator = (function () {
    function ReplaceErrorOperator(fn, ins) {
        this.fn = fn;
        this.ins = ins;
        this.out = empty;
    }
    ReplaceErrorOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    ReplaceErrorOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
    };
    ReplaceErrorOperator.prototype._n = function (t) {
        this.out._n(t);
    };
    ReplaceErrorOperator.prototype._e = function (err) {
        try {
            this.ins._remove(this);
            (this.ins = this.fn(err))._add(this);
        }
        catch (e) {
            this.out._e(e);
        }
    };
    ReplaceErrorOperator.prototype._c = function () {
        this.out._c();
    };
    return ReplaceErrorOperator;
}());
exports.ReplaceErrorOperator = ReplaceErrorOperator;
var StartWithOperator = (function () {
    function StartWithOperator(ins, value) {
        this.ins = ins;
        this.value = value;
        this.out = emptyListener;
    }
    StartWithOperator.prototype._start = function (out) {
        this.out = out;
        this.out._n(this.value);
        this.ins._add(out);
    };
    StartWithOperator.prototype._stop = function () {
        this.ins._remove(this.out);
        this.out = null;
    };
    return StartWithOperator;
}());
exports.StartWithOperator = StartWithOperator;
var TakeOperator = (function () {
    function TakeOperator(max, ins) {
        this.max = max;
        this.ins = ins;
        this.out = null;
        this.taken = 0;
    }
    TakeOperator.prototype._start = function (out) {
        this.out = out;
        this.ins._add(this);
    };
    TakeOperator.prototype._stop = function () {
        this.ins._remove(this);
        this.out = null;
        this.taken = 0;
    };
    TakeOperator.prototype._n = function (t) {
        var out = this.out;
        if (!out)
            return;
        if (this.taken++ < this.max - 1) {
            out._n(t);
        }
        else {
            out._n(t);
            out._c();
            this._stop();
        }
    };
    TakeOperator.prototype._e = function (err) {
        var out = this.out;
        if (!out)
            return;
        out._e(err);
    };
    TakeOperator.prototype._c = function () {
        var out = this.out;
        if (!out)
            return;
        out._c();
    };
    return TakeOperator;
}());
exports.TakeOperator = TakeOperator;
var Stream = (function () {
    function Stream(producer) {
        this._stopID = empty;
        
        this.combine = function combine(project) {
            var streams = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                streams[_i - 1] = arguments[_i];
            }
            streams.unshift(this);
            return Stream.combine.apply(Stream, [project].concat(streams));
        };
        this._prod = producer;
        this._ils = [];
    }
    Stream.prototype._n = function (t) {
        var a = this._ils;
        var L = a.length;
        if (L == 1)
            a[0]._n(t);
        else {
            var b = copy(a);
            for (var i = 0; i < L; i++)
                b[i]._n(t);
        }
    };
    Stream.prototype._e = function (err) {
        var a = this._ils;
        var L = a.length;
        if (L == 1)
            a[0]._e(err);
        else {
            var b = copy(a);
            for (var i = 0; i < L; i++)
                b[i]._e(err);
        }
        this._x();
    };
    Stream.prototype._c = function () {
        var a = this._ils;
        var L = a.length;
        if (L == 1)
            a[0]._c();
        else {
            var b = copy(a);
            for (var i = 0; i < L; i++)
                b[i]._c();
        }
        this._x();
    };
    Stream.prototype._x = function () {
        if (this._ils.length === 0)
            return;
        if (this._prod)
            this._prod._stop();
        this._ils = [];
    };
    
    Stream.prototype.addListener = function (listener) {
        if (typeof listener.next !== 'function'
            || typeof listener.error !== 'function'
            || typeof listener.complete !== 'function') {
            throw new Error('stream.addListener() requires all three next, error, ' +
                'and complete functions.');
        }
        listener._n = listener.next;
        listener._e = listener.error;
        listener._c = listener.complete;
        this._add(listener);
    };
    
    Stream.prototype.removeListener = function (listener) {
        this._remove(listener);
    };
    Stream.prototype._add = function (il) {
        var a = this._ils;
        a.push(il);
        if (a.length === 1) {
            if (this._stopID !== empty) {
                clearTimeout(this._stopID);
                this._stopID = empty;
            }
            var p = this._prod;
            if (p)
                p._start(this);
        }
    };
    Stream.prototype._remove = function (il) {
        var a = this._ils;
        var i = a.indexOf(il);
        if (i > -1) {
            a.splice(i, 1);
            var p_1 = this._prod;
            if (p_1 && a.length <= 0) {
                this._stopID = setTimeout(function () { return p_1._stop(); });
            }
        }
    };
    
    Stream.create = function (producer) {
        if (producer) {
            if (typeof producer.start !== 'function'
                || typeof producer.stop !== 'function') {
                throw new Error('producer requires both start and stop functions');
            }
            internalizeProducer(producer); 
        }
        return new Stream(producer);
    };
    
    Stream.createWithMemory = function (producer) {
        if (producer) {
            internalizeProducer(producer); 
        }
        return new MemoryStream(producer);
    };
    
    Stream.never = function () {
        return new Stream({ _start: noop, _stop: noop });
    };
    
    Stream.empty = function () {
        return new Stream({
            _start: function (il) { il._c(); },
            _stop: noop,
        });
    };
    
    Stream.throw = function (error) {
        return new Stream({
            _start: function (il) { il._e(error); },
            _stop: noop,
        });
    };
    
    Stream.of = function () {
        var items = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i - 0] = arguments[_i];
        }
        return Stream.fromArray(items);
    };
    
    Stream.fromArray = function (array) {
        return new Stream(new FromArrayProducer(array));
    };
    
    Stream.fromPromise = function (promise) {
        return new Stream(new FromPromiseProducer(promise));
    };
    
    Stream.periodic = function (period) {
        return new Stream(new PeriodicProducer(period));
    };
    
    Stream.merge = function () {
        var streams = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            streams[_i - 0] = arguments[_i];
        }
        return new Stream(new MergeProducer(streams));
    };
    
    Stream.prototype.map = function (project) {
        var p = this._prod;
        if (p instanceof FilterOperator) {
            return new Stream(new FilterMapOperator(p.passes, project, p.ins));
        }
        if (p instanceof FilterMapOperator) {
            return new Stream(new FilterMapOperator(p.passes, compose2(project, p.project), p.ins));
        }
        if (p instanceof MapOperator) {
            return new Stream(new MapOperator(compose2(project, p.project), p.ins));
        }
        return new Stream(new MapOperator(project, this));
    };
    
    Stream.prototype.mapTo = function (projectedValue) {
        return new Stream(new MapToOperator(projectedValue, this));
    };
    
    Stream.prototype.filter = function (passes) {
        var p = this._prod;
        if (p instanceof FilterOperator) {
            return new Stream(new FilterOperator(and(passes, p.passes), p.ins));
        }
        return new Stream(new FilterOperator(passes, this));
    };
    
    Stream.prototype.take = function (amount) {
        return new Stream(new TakeOperator(amount, this));
    };
    
    Stream.prototype.drop = function (amount) {
        return new Stream(new DropOperator(amount, this));
    };
    
    Stream.prototype.last = function () {
        return new Stream(new LastOperator(this));
    };
    
    Stream.prototype.startWith = function (initial) {
        return new Stream(new StartWithOperator(this, initial));
    };
    
    Stream.prototype.endWhen = function (other) {
        return new Stream(new EndWhenOperator(other, this));
    };
    
    Stream.prototype.fold = function (accumulate, seed) {
        return new Stream(new FoldOperator(accumulate, seed, this));
    };
    
    Stream.prototype.replaceError = function (replace) {
        return new Stream(new ReplaceErrorOperator(replace, this));
    };
    
    Stream.prototype.flatten = function () {
        var p = this._prod;
        return new Stream(p instanceof MapOperator || p instanceof FilterMapOperator ?
            new MapFlattenOperator(p) :
            new FlattenOperator(this));
    };
    
    Stream.prototype.flattenConcurrently = function () {
        var p = this._prod;
        return new Stream(p instanceof MapOperator || p instanceof FilterMapOperator ?
            new MapFlattenConcOperator(p) :
            new FlattenConcOperator(this));
    };
    
    Stream.prototype.merge = function (other) {
        return Stream.merge(this, other);
    };
    
    Stream.prototype.compose = function (operator) {
        return operator(this);
    };
    
    Stream.prototype.remember = function () {
        var _this = this;
        return new MemoryStream({
            _start: function (il) { _this._prod._start(il); },
            _stop: function () { _this._prod._stop(); },
        });
    };
    
    Stream.prototype.imitate = function (other) {
        other._add(this);
    };
    
    Stream.prototype.debug = function (spy) {
        if (spy === void 0) { spy = null; }
        return new Stream(new DebugOperator(spy, this));
    };
    
    Stream.prototype.shamefullySendNext = function (value) {
        this._n(value);
    };
    
    Stream.prototype.shamefullySendError = function (error) {
        this._e(error);
    };
    
    Stream.prototype.shamefullySendComplete = function () {
        this._c();
    };
    
    Stream.combine = function combine(project) {
        var streams = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            streams[_i - 1] = arguments[_i];
        }
        return new Stream(new CombineProducer(project, streams));
    };
    return Stream;
}());
exports.Stream = Stream;
var MemoryStream = (function (_super) {
    __extends(MemoryStream, _super);
    function MemoryStream(producer) {
        _super.call(this, producer);
        this._has = false;
    }
    MemoryStream.prototype._n = function (x) {
        this._v = x;
        this._has = true;
        _super.prototype._n.call(this, x);
    };
    MemoryStream.prototype._add = function (il) {
        if (this._has) {
            il._n(this._v);
        }
        _super.prototype._add.call(this, il);
    };
    return MemoryStream;
}(Stream));
exports.MemoryStream = MemoryStream;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Stream;

},{}],2:[function(require,module,exports){
"use strict";
var core_1 = require('./core');
exports.Stream = core_1.Stream;
exports.MemoryStream = core_1.MemoryStream;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = core_1.Stream;

},{"./core":1}]},{},[2])(2)
});