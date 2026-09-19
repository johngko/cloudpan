function setCookie(g, p, m) {
    m || (m = 15768E7);
    path = "/";
    domain = document.domain;
    secure = !1;
    var h = new Date;
    h.setTime(h.getTime());
    h = new Date(h.getTime() + m);
    document.cookie = g + "=" + escape(p) + (m ? ";expires=" + h.toGMTString() : "") + (path ? ";path=" + path : "") + (domain ? ";domain=" + domain : "") + (secure ? ";secure" : "")
}

function getCookie(g) {
    g += "=";
    for (var p = 0; p <= document.cookie.length;) {
        var m = p + g.length;
        if (document.cookie.substring(p, m) == g) return -1 == (endOfCookie = document.cookie.indexOf(";", m)) && (endOfCookie = document.cookie.length), unescape(document.cookie.substring(m, endOfCookie));
        p = document.cookie.indexOf(" ", p) + 1;
        if (0 == p) break
    }
    return ""
}
function _getid(g) {
    return document.getElementById(g)
}
function trim(g) {
    return g.replace(/^\s*|\s*$/g, "")
}

function html_entity_encode(g) {
    g = g.replace(/&/gi, "&amp;");
    g = g.replace(/>/gi, "&gt;");
    g = g.replace(/</gi, "&lt;");
    g = g.replace(/\"/gi, "&quot;");
    return g = g.replace(/\'/gi, "&#039;")
}
function shortstring(g, p) {
    g || (g = "");
    g.length > p && (g = g.substr(0, p) + "...");
    return g
}
function cutstringmiddle(g, p, m, h) {
    if (g.length <= p) return g;
    p = g.substr(0, m);
    g = g.substr(g.length - h, g.length);
    return p + "....." + g
}
var messagetimer = null;

function show_message(g, p, m, h, s) {
    function k() {
        var a = 0;
        if ("number" == typeof window.innerWidth) a = window.innerWidth;
        else var a = document.documentElement.clientWidth,
        b = document.body.clientWidth, a = 0 < a ? a : b;
        a || (a = 0);
        return a
    }
    function f() {
        var a = 0;
        if ("number" == typeof window.innerHeight) a = window.innerHeight;
        else var a = document.documentElement.clientHeight,
        b = document.body.clientHeight, a = 0 < a ? a : b;
        a || (a = 0);
        return a
    }
    function d() {
        var a;
        document.body && document.body.scrollLeft ? a = document.body.scrollLeft : document.documentElement &&
            document.documentElement.scrollLeft && (a = document.documentElement.scrollLeft);
        a || (a = 0);
        return a
    }
    function a() {
        var a;
        document.body && document.body.scrollTop ? a = document.body.scrollTop : document.documentElement && document.documentElement.scrollTop && (a = document.documentElement.scrollTop);
        a || (a = 0);
        return a
    }
    p || (p = 10);
    m || (m = 10);
    h || (h = 5);
    s || (s = 2E3);
    for (var c = 1, b = 1; 4 >= b; b++) {
        var l = "layer_message";
        1 < b && (l = "layer_message" + b);
        if (l = document.getElementById(l)) {
            c = b;
            break
        }
    }
    l.style.left = "1px";
    l.style.top = "1px";
    l.innerHTML =
        "<label>" + g + "</label>";
    l.style.display = "";
    1 == c ? (p = d() + p, m = a() + m) : 2 == c ? (p = d() + (k() - l.clientWidth) / 2, m = a() + (f() - l.clientHeight) / 2) : (p = 3 == c ? document.body.offsetWidth - l.clientWidth - 5 : d() + (k() - l.clientWidth) / 2, m = a() + m);
    p = parseInt(p);
    m = parseInt(m);
    l.style.border = "1px solid #000000";
    l.style.padding = h + "px";
    l.style.left = p + "px";
    l.style.top = m + "px";
    messagetimer && clearTimeout(messagetimer);
    messagetimer = setTimeout(hide_message, s)
}

function hide_message() {
    for (var g = 1; 4 >= g; g++) {
        var p = "layer_message";
        1 < g && (p = "layer_message" + g);
        if (p = document.getElementById(p)) p.style.display = "none"
    }
}
var g_MailParser, g_mht = !1,
    g_iserror = !1;
(function e$$0(p, m, h) {
    function s(d, a) {
        if (!m[d]) {
            if (!p[d]) {
                var c = "function" == typeof require && require;
                if (!a && c) return c(d, !0);
                if (k) return k(d, !0);
                c = Error("Cannot find module '" + d + "'");
                throw c.code = "MODULE_NOT_FOUND", c;
            }
            c = m[d] = {
                exports: {}
            };
            p[d][0].call(c.exports, function(a) {
                var c = p[d][1][a];
                return s(c ? c : a)
            }, c, c.exports, e$$0, p, m, h)
        }
        return m[d].exports
    }
    for (var k = "function" == typeof require && require, f = 0; f < h.length; f++) s(h[f]);
    return s
})({
    1: [function(g, p, m) {}, {}],
    2: [function(g, p, m) {
            p.exports = g(1)
        }, {
            "_empty.js": 1
        }
    ],
    3: [function(g, p, m) {
            function h(e, a, b) {
                if (!(this instanceof h)) return new h(e, a, b);
                var c = typeof e,
                    l;
                if ("number" === c) l = 0 < e ? e >>> 0 : 0;
                else if ("string" === c) {
                    if ("base64" === a) for (e = (e.trim ? e.trim() : e.replace(/^\s+|\s+$/g, "")).replace(K, ""); 0 !== e.length % 4;) e += "=";
                    l = h.byteLength(e, a)
                } else if ("object" === c && null !== e) "Buffer" === e.type && G(e.data) && (e = e.data), l = 0 < +e.length ? Math.floor(+e.length) : 0;
                else throw new TypeError("must start with number, buffer, array or string"); if (this.length > y) throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" +
                        y.toString(16) + " bytes");
                var r;
                h.TYPED_ARRAY_SUPPORT ? r = h._augment(new Uint8Array(l)) : (r = this, r.length = l, r._isBuffer = !0);
                if (h.TYPED_ARRAY_SUPPORT && "number" === typeof e.byteLength) r._set(e);
                else {
                    var q = e;
                    if (G(q) || h.isBuffer(q) || q && "object" === typeof q && "number" === typeof q.length) if (h.isBuffer(e)) for (a = 0; a < l; a++) r[a] = e.readUInt8(a);
                        else for (a = 0; a < l; a++) r[a] = (e[a] % 256 + 256) % 256;
                        else if ("string" === c) r.write(e, 0, a);
                    else if ("number" === c && !h.TYPED_ARRAY_SUPPORT && !b) for (a = 0; a < l; a++) r[a] = 0
                }
                return r
            }
            function s(e,
                a, b, c) {
                for (var l = [], r = 0; r < a.length; r++) l.push(a.charCodeAt(r) & 255);
                return q(l, e, b, c)
            }
            function k(e, a, b) {
                var c = "";
                for (b = Math.min(e.length, b); a < b; a++) c += String.fromCharCode(e[a]);
                return c
            }
            function f(e, a, b) {
                if (0 !== e % 1 || 0 > e) throw new RangeError("offset is not uint");
                if (e + a > b) throw new RangeError("Trying to access beyond buffer length");
            }
            function d(e, a, b, c, l, r) {
                if (!h.isBuffer(e)) throw new TypeError("buffer must be a Buffer instance");
                if (a > l || a < r) throw new TypeError("value is out of bounds");
                if (b + c > e.length) throw new TypeError("index out of range");
            }
            function a(e, a, b, c) {
                0 > a && (a = 65535 + a + 1);
                for (var l = 0, r = Math.min(e.length - b, 2); l < r; l++) e[b + l] = (a & 255 << 8 * (c ? l : 1 - l)) >>> 8 * (c ? l : 1 - l)
            }
            function c(e, a, b, c) {
                0 > a && (a = 4294967295 + a + 1);
                for (var l = 0, r = Math.min(e.length - b, 4); l < r; l++) e[b + l] = a >>> 8 * (c ? l : 3 - l) & 255
            }
            function b(e, a, b, c, l, r) {
                if (a > l || a < r) throw new TypeError("value is out of bounds");
                if (b + c > e.length) throw new TypeError("index out of range");
            }
            function l(e, a, c, l, r) {
                r || b(e, a, c, 4, 3.4028234663852886E38, -3.4028234663852886E38);
                v.write(e, a, c, l, 23, 4);
                return c + 4
            }
            function u(e,
                a, c, l, r) {
                r || b(e, a, c, 8, 1.7976931348623157E308, -1.7976931348623157E308);
                v.write(e, a, c, l, 52, 8);
                return c + 8
            }
            function n(e) {
                for (var a = [], b = 0; b < e.length; b++) {
                    var c = e.charCodeAt(b);
                    if (127 >= c) a.push(c);
                    else {
                        var l = b;
                        55296 <= c && 57343 >= c && b++;
                        c = encodeURIComponent(e.slice(l, b + 1)).substr(1).split("%");
                        for (l = 0; l < c.length; l++) a.push(parseInt(c[l], 16))
                    }
                }
                return a
            }
            function q(e, a, b, c) {
                for (var l = 0; l < c && !(l + b >= a.length || l >= e.length); l++) a[l + b] = e[l];
                return l
            }
            function e(e) {
                try {
                    return decodeURIComponent(e)
                } catch (a) {
                    return String.fromCharCode(65533)
                }
            }
            var r = g("base64-js"),
                v = g("ieee754"),
                G = g("is-array");
            m.Buffer = h;
            m.SlowBuffer = h;
            m.INSPECT_MAX_BYTES = 50;
            h.poolSize = 8192;
            var y = 1073741823;
            h.TYPED_ARRAY_SUPPORT = function() {
                try {
                    var e = new ArrayBuffer(0),
                        a = new Uint8Array(e);
                    a.foo = function() {
                        return 42
                    };
                    return 42 === a.foo() && "function" === typeof a.subarray && 0 === (new Uint8Array(1)).subarray(1, 1).byteLength
                } catch (b) {
                    return !1
                }
            }();
            h.isBuffer = function(e) {
                return !(null == e || !e._isBuffer)
            };
            h.compare = function(e, a) {
                if (!h.isBuffer(e) || !h.isBuffer(a)) throw new TypeError("Arguments must be Buffers");
                for (var b = e.length, c = a.length, l = 0, r = Math.min(b, c); l < r && e[l] === a[l]; l++);
                l !== r && (b = e[l], c = a[l]);
                return b < c ? -1 : c < b ? 1 : 0
            };
            h.isEncoding = function(e) {
                switch (String(e).toLowerCase()) {
                    case "hex":
                    case "utf8":
                    case "utf-8":
                    case "ascii":
                    case "binary":
                    case "base64":
                    case "raw":
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        return !0;
                    default:
                        return !1
                }
            };
            h.concat = function(e, a) {
                if (!G(e)) throw new TypeError("Usage: Buffer.concat(list[, length])");
                if (0 === e.length) return new h(0);
                if (1 === e.length) return e[0];
                var b;
                if (void 0 === a) for (b = a = 0; b < e.length; b++) a += e[b].length;
                var l = new h(a),
                    c = 0;
                for (b = 0; b < e.length; b++) {
                    var r = e[b];
                    r.copy(l, c);
                    c += r.length
                }
                return l
            };
            h.byteLength = function(e, a) {
                var b;
                e += "";
                switch (a || "utf8") {
                    case "ascii":
                    case "binary":
                    case "raw":
                        b = e.length;
                        break;
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        b = 2 * e.length;
                        break;
                    case "hex":
                        b = e.length >>> 1;
                        break;
                    case "utf8":
                    case "utf-8":
                        b = n(e).length;
                        break;
                    case "base64":
                        b = r.toByteArray(e).length;
                        break;
                    default:
                        b = e.length
                }
                return b
            };
            h.prototype.length = void 0;
            h.prototype.parent = void 0;
            h.prototype.toString = function(a, b, l) {
                var c = !1;
                b >>>= 0;
                l = void 0 === l || Infinity === l ? this.length : l >>> 0;
                a || (a = "utf8");
                0 > b && (b = 0);
                l > this.length && (l = this.length);
                if (l <= b) return "";
                for (;;) switch (a) {
                        case "hex":
                            a = b;
                            b = this.length;
                            if (!a || 0 > a) a = 0;
                            if (!l || 0 > l || l > b) l = b;
                            for (b = ""; a < l; a++) c = this[a], c = 16 > c ? "0" + c.toString(16) : c.toString(16), b += c;
                            return b;
                        case "utf8":
                        case "utf-8":
                            a = b;
                            c = b = "";
                            for (l = Math.min(this.length, l); a < l; a++) 127 >= this[a] ? (b += e(c) + String.fromCharCode(this[a]), c = "") : c += "%" + this[a].toString(16);
                            return b + e(c);
                        case "ascii":
                            return k(this, b, l);
                        case "binary":
                            return k(this, b, l);
                        case "base64":
                            return a = b, l = 0 === a && l === this.length ? r.fromByteArray(this) : r.fromByteArray(this.slice(a, l)), l;
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                            l = this.slice(b, l);
                            a = "";
                            for (b = 0; b < l.length; b += 2) a += String.fromCharCode(l[b] + 256 * l[b + 1]);
                            return a;
                        default:
                            if (c) throw new TypeError("Unknown encoding: " + a);
                            a = (a + "").toLowerCase();
                            c = !0
                }
            };
            h.prototype.equals = function(e) {
                if (!h.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
                return 0 === h.compare(this, e)
            };
            h.prototype.inspect = function() {
                var e = "",
                    a = m.INSPECT_MAX_BYTES;
                0 < this.length && (e = this.toString("hex", 0, a).match(/.{2}/g).join(" "), this.length > a && (e += " ... "));
                return "<Buffer " + e + ">"
            };
            h.prototype.compare = function(e) {
                if (!h.isBuffer(e)) throw new TypeError("Argument must be a Buffer");
                return h.compare(this, e)
            };
            h.prototype.get = function(e) {
                console.log(".get() is deprecated. Access using array indexes instead.");
                return this.readUInt8(e)
            };
            h.prototype.set = function(e, a) {
                console.log(".set() is deprecated. Access using array indexes instead.");
                return this.writeUInt8(e, a)
            };
            h.prototype.write = function(e, a, b, l) {
                if (isFinite(a)) isFinite(b) || (l = b, b = void 0);
                else {
                    var c = l;
                    l = a;
                    a = b;
                    b = c
                }
                a = Number(a) || 0;
                c = this.length - a;
                b ? (b = Number(b), b > c && (b = c)) : b = c;
                l = String(l || "utf8").toLowerCase();
                switch (l) {
                    case "hex":
                        a = Number(a) || 0;
                        l = this.length - a;
                        b ? (b = Number(b), b > l && (b = l)) : b = l;
                        l = e.length;
                        if (0 !== l % 2) throw Error("Invalid hex string");
                        b > l / 2 && (b = l / 2);
                        for (l = 0; l < b; l++) {
                            c = parseInt(e.substr(2 * l, 2), 16);
                            if (isNaN(c)) throw Error("Invalid hex string");
                            this[a + l] = c
                        }
                        e = l;
                        break;
                    case "utf8":
                    case "utf-8":
                        e =
                            q(n(e), this, a, b);
                        break;
                    case "ascii":
                        e = s(this, e, a, b);
                        break;
                    case "binary":
                        e = s(this, e, a, b);
                        break;
                    case "base64":
                        e = q(r.toByteArray(e), this, a, b);
                        break;
                    case "ucs2":
                    case "ucs-2":
                    case "utf16le":
                    case "utf-16le":
                        for (var u, c = [], d = 0; d < e.length; d++) u = e.charCodeAt(d), l = u >> 8, u %= 256, c.push(u), c.push(l);
                        e = q(c, this, a, b);
                        break;
                    default:
                        throw new TypeError("Unknown encoding: " + l);
                }
                return e
            };
            h.prototype.toJSON = function() {
                return {
                    type: "Buffer",
                    data: Array.prototype.slice.call(this._arr || this, 0)
                }
            };
            h.prototype.slice = function(e,
                a) {
                var b = this.length;
                e = ~~e;
                a = void 0 === a ? b : ~~a;
                0 > e ? (e += b, 0 > e && (e = 0)) : e > b && (e = b);
                0 > a ? (a += b, 0 > a && (a = 0)) : a > b && (a = b);
                a < e && (a = e);
                if (h.TYPED_ARRAY_SUPPORT) return h._augment(this.subarray(e, a));
                for (var b = a - e, l = new h(b, void 0, !0), c = 0; c < b; c++) l[c] = this[c + e];
                return l
            };
            h.prototype.readUInt8 = function(e, a) {
                a || f(e, 1, this.length);
                return this[e]
            };
            h.prototype.readUInt16LE = function(e, a) {
                a || f(e, 2, this.length);
                return this[e] | this[e + 1] << 8
            };
            h.prototype.readUInt16BE = function(e, a) {
                a || f(e, 2, this.length);
                return this[e] << 8 |
                    this[e + 1]
            };
            h.prototype.readUInt32LE = function(e, a) {
                a || f(e, 4, this.length);
                return (this[e] | this[e + 1] << 8 | this[e + 2] << 16) + 16777216 * this[e + 3]
            };
            h.prototype.readUInt32BE = function(e, a) {
                a || f(e, 4, this.length);
                return 16777216 * this[e] + (this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3])
            };
            h.prototype.readInt8 = function(e, a) {
                a || f(e, 1, this.length);
                return this[e] & 128 ? -1 * (255 - this[e] + 1) : this[e]
            };
            h.prototype.readInt16LE = function(e, a) {
                a || f(e, 2, this.length);
                var b = this[e] | this[e + 1] << 8;
                return b & 32768 ? b | 4294901760 : b
            };
            h.prototype.readInt16BE = function(e, a) {
                a || f(e, 2, this.length);
                var b = this[e + 1] | this[e] << 8;
                return b & 32768 ? b | 4294901760 : b
            };
            h.prototype.readInt32LE = function(e, a) {
                a || f(e, 4, this.length);
                return this[e] | this[e + 1] << 8 | this[e + 2] << 16 | this[e + 3] << 24
            };
            h.prototype.readInt32BE = function(e, a) {
                a || f(e, 4, this.length);
                return this[e] << 24 | this[e + 1] << 16 | this[e + 2] << 8 | this[e + 3]
            };
            h.prototype.readFloatLE = function(e, a) {
                a || f(e, 4, this.length);
                return v.read(this, e, !0, 23, 4)
            };
            h.prototype.readFloatBE = function(e, a) {
                a || f(e, 4, this.length);
                return v.read(this, e, !1,
                    23, 4)
            };
            h.prototype.readDoubleLE = function(e, a) {
                a || f(e, 8, this.length);
                return v.read(this, e, !0, 52, 8)
            };
            h.prototype.readDoubleBE = function(e, a) {
                a || f(e, 8, this.length);
                return v.read(this, e, !1, 52, 8)
            };
            h.prototype.writeUInt8 = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 1, 255, 0);
                h.TYPED_ARRAY_SUPPORT || (e = Math.floor(e));
                this[a] = e;
                return a + 1
            };
            h.prototype.writeUInt16LE = function(e, b, l) {
                e = +e;
                b >>>= 0;
                l || d(this, e, b, 2, 65535, 0);
                h.TYPED_ARRAY_SUPPORT ? (this[b] = e, this[b + 1] = e >>> 8) : a(this, e, b, !0);
                return b + 2
            };
            h.prototype.writeUInt16BE = function(e, b, l) {
                e = +e;
                b >>>= 0;
                l || d(this, e, b, 2, 65535, 0);
                h.TYPED_ARRAY_SUPPORT ? (this[b] = e >>> 8, this[b + 1] = e) : a(this, e, b, !1);
                return b + 2
            };
            h.prototype.writeUInt32LE = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 4, 4294967295, 0);
                h.TYPED_ARRAY_SUPPORT ? (this[a + 3] = e >>> 24, this[a + 2] = e >>> 16, this[a + 1] = e >>> 8, this[a] = e) : c(this, e, a, !0);
                return a + 4
            };
            h.prototype.writeUInt32BE = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 4, 4294967295, 0);
                h.TYPED_ARRAY_SUPPORT ? (this[a] = e >>> 24, this[a + 1] = e >>> 16, this[a + 2] = e >>> 8, this[a + 3] = e) : c(this, e,
                    a, !1);
                return a + 4
            };
            h.prototype.writeInt8 = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 1, 127, -128);
                h.TYPED_ARRAY_SUPPORT || (e = Math.floor(e));
                0 > e && (e = 255 + e + 1);
                this[a] = e;
                return a + 1
            };
            h.prototype.writeInt16LE = function(e, b, l) {
                e = +e;
                b >>>= 0;
                l || d(this, e, b, 2, 32767, -32768);
                h.TYPED_ARRAY_SUPPORT ? (this[b] = e, this[b + 1] = e >>> 8) : a(this, e, b, !0);
                return b + 2
            };
            h.prototype.writeInt16BE = function(e, b, l) {
                e = +e;
                b >>>= 0;
                l || d(this, e, b, 2, 32767, -32768);
                h.TYPED_ARRAY_SUPPORT ? (this[b] = e >>> 8, this[b + 1] = e) : a(this, e, b, !1);
                return b + 2
            };
            h.prototype.writeInt32LE = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 4, 2147483647, -2147483648);
                h.TYPED_ARRAY_SUPPORT ? (this[a] = e, this[a + 1] = e >>> 8, this[a + 2] = e >>> 16, this[a + 3] = e >>> 24) : c(this, e, a, !0);
                return a + 4
            };
            h.prototype.writeInt32BE = function(e, a, b) {
                e = +e;
                a >>>= 0;
                b || d(this, e, a, 4, 2147483647, -2147483648);
                0 > e && (e = 4294967295 + e + 1);
                h.TYPED_ARRAY_SUPPORT ? (this[a] = e >>> 24, this[a + 1] = e >>> 16, this[a + 2] = e >>> 8, this[a + 3] = e) : c(this, e, a, !1);
                return a + 4
            };
            h.prototype.writeFloatLE = function(e, a, b) {
                return l(this, e, a, !0, b)
            };
            h.prototype.writeFloatBE = function(e,
                a, b) {
                return l(this, e, a, !1, b)
            };
            h.prototype.writeDoubleLE = function(e, a, b) {
                return u(this, e, a, !0, b)
            };
            h.prototype.writeDoubleBE = function(e, a, b) {
                return u(this, e, a, !1, b)
            };
            h.prototype.copy = function(e, a, b, l) {
                b || (b = 0);
                l || 0 === l || (l = this.length);
                a || (a = 0);
                if (l !== b && 0 !== e.length && 0 !== this.length) {
                    if (l < b) throw new TypeError("sourceEnd < sourceStart");
                    if (0 > a || a >= e.length) throw new TypeError("targetStart out of bounds");
                    if (0 > b || b >= this.length) throw new TypeError("sourceStart out of bounds");
                    if (0 > l || l > this.length) throw new TypeError("sourceEnd out of bounds");
                    l > this.length && (l = this.length);
                    e.length - a < l - b && (l = e.length - a + b);
                    l -= b;
                    if (1E3 > l || !h.TYPED_ARRAY_SUPPORT) for (var c = 0; c < l; c++) e[c + a] = this[c + b];
                    else e._set(this.subarray(b, b + l), a)
                }
            };
            h.prototype.fill = function(e, a, b) {
                e || (e = 0);
                a || (a = 0);
                b || (b = this.length);
                if (b < a) throw new TypeError("end < start");
                if (b !== a && 0 !== this.length) {
                    if (0 > a || a >= this.length) throw new TypeError("start out of bounds");
                    if (0 > b || b > this.length) throw new TypeError("end out of bounds");
                    if ("number" === typeof e) for (; a < b; a++) this[a] = e;
                    else {
                        e = n(e.toString());
                        for (var l = e.length; a < b; a++) this[a] = e[a % l]
                    }
                    return this
                }
            };
            h.prototype.toArrayBuffer = function() {
                if ("undefined" !== typeof Uint8Array) {
                    if (h.TYPED_ARRAY_SUPPORT) return (new h(this)).buffer;
                    for (var e = new Uint8Array(this.length), a = 0, b = e.length; a < b; a += 1) e[a] = this[a];
                    return e.buffer
                }
                throw new TypeError("Buffer.toArrayBuffer not supported in this browser");
            };
            var t = h.prototype;
            h._augment = function(e) {
                e.constructor = h;
                e._isBuffer = !0;
                e._get = e.get;
                e._set = e.set;
                e.get = t.get;
                e.set = t.set;
                e.write = t.write;
                e.toString = t.toString;
                e.toLocaleString = t.toString;
                e.toJSON = t.toJSON;
                e.equals = t.equals;
                e.compare = t.compare;
                e.copy = t.copy;
                e.slice = t.slice;
                e.readUInt8 = t.readUInt8;
                e.readUInt16LE = t.readUInt16LE;
                e.readUInt16BE = t.readUInt16BE;
                e.readUInt32LE = t.readUInt32LE;
                e.readUInt32BE = t.readUInt32BE;
                e.readInt8 = t.readInt8;
                e.readInt16LE = t.readInt16LE;
                e.readInt16BE = t.readInt16BE;
                e.readInt32LE = t.readInt32LE;
                e.readInt32BE = t.readInt32BE;
                e.readFloatLE = t.readFloatLE;
                e.readFloatBE = t.readFloatBE;
                e.readDoubleLE = t.readDoubleLE;
                e.readDoubleBE = t.readDoubleBE;
                e.writeUInt8 = t.writeUInt8;
                e.writeUInt16LE = t.writeUInt16LE;
                e.writeUInt16BE = t.writeUInt16BE;
                e.writeUInt32LE = t.writeUInt32LE;
                e.writeUInt32BE = t.writeUInt32BE;
                e.writeInt8 = t.writeInt8;
                e.writeInt16LE = t.writeInt16LE;
                e.writeInt16BE = t.writeInt16BE;
                e.writeInt32LE = t.writeInt32LE;
                e.writeInt32BE = t.writeInt32BE;
                e.writeFloatLE = t.writeFloatLE;
                e.writeFloatBE = t.writeFloatBE;
                e.writeDoubleLE = t.writeDoubleLE;
                e.writeDoubleBE = t.writeDoubleBE;
                e.fill = t.fill;
                e.inspect = t.inspect;
                e.toArrayBuffer = t.toArrayBuffer;
                return e
            };
            var K =
                /[^+\/0-9A-z]/g
        }, {
            "base64-js": 4,
            ieee754: 5,
            "is-array": 6
        }
    ],
    4: [function(g, p, m) {
            (function(h) {
                function s(f) {
                    f = f.charCodeAt(0);
                    if (43 === f) return 62;
                    if (47 === f) return 63;
                    if (48 > f) return -1;
                    if (58 > f) return f - 48 + 52;
                    if (91 > f) return f - 65;
                    if (123 > f) return f - 97 + 26
                }
                var k = "undefined" !== typeof Uint8Array ? Uint8Array : Array;
                h.toByteArray = function(f) {
                    function d(a) {
                        u[n++] = a
                    }
                    var a, c, b, l, u;
                    if (0 < f.length % 4) throw Error("Invalid string. Length must be a multiple of 4");
                    a = f.length;
                    l = "=" === f.charAt(a - 2) ? 2 : "=" === f.charAt(a - 1) ? 1 : 0;
                    u =
                        new k(3 * f.length / 4 - l);
                    c = 0 < l ? f.length - 4 : f.length;
                    var n = 0;
                    for (a = 0; a < c; a += 4) b = s(f.charAt(a)) << 18 | s(f.charAt(a + 1)) << 12 | s(f.charAt(a + 2)) << 6 | s(f.charAt(a + 3)), d((b & 16711680) >> 16), d((b & 65280) >> 8), d(b & 255);
                    2 === l ? (b = s(f.charAt(a)) << 2 | s(f.charAt(a + 1)) >> 4, d(b & 255)) : 1 === l && (b = s(f.charAt(a)) << 10 | s(f.charAt(a + 1)) << 4 | s(f.charAt(a + 2)) >> 2, d(b >> 8 & 255), d(b & 255));
                    return u
                };
                h.fromByteArray = function(f) {
                    var d, a = f.length % 3,
                        c = "",
                        b, l;
                    d = 0;
                    for (l = f.length - a; d < l; d += 3) b = (f[d] << 16) + (f[d + 1] << 8) + f[d + 2], b = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >>
                            18 & 63) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >> 12 & 63) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >> 6 & 63) + "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b & 63), c += b;
                    switch (a) {
                        case 1:
                            b = f[f.length - 1];
                            c += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >> 2);
                            c += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b << 4 & 63);
                            c += "==";
                            break;
                        case 2:
                            b = (f[f.length - 2] << 8) +
                                f[f.length - 1], c += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >> 10), c += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b >> 4 & 63), c += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charAt(b << 2 & 63), c += "="
                    }
                    return c
                }
            })("undefined" === typeof m ? this.base64js = {} : m)
        }, {}
    ],
    5: [function(g, p, m) {
            m.read = function(h, s, k, f, d) {
                var a;
                a = 8 * d - f - 1;
                var c = (1 << a) - 1,
                    b = c >> 1,
                    l = -7;
                d = k ? d - 1 : 0;
                var u = k ? -1 : 1,
                    n = h[s + d];
                d += u;
                k = n & (1 << -l) - 1;
                n >>= -l;
                for (l += a; 0 < l; k = 256 *
                    k + h[s + d], d += u, l -= 8);
                a = k & (1 << -l) - 1;
                k >>= -l;
                for (l += f; 0 < l; a = 256 * a + h[s + d], d += u, l -= 8);
                if (0 === k) k = 1 - b;
                else {
                    if (k === c) return a ? NaN : Infinity * (n ? -1 : 1);
                    a += Math.pow(2, f);
                    k -= b
                }
                return (n ? -1 : 1) * a * Math.pow(2, k - f)
            };
            m.write = function(h, s, k, f, d, a) {
                var c, b = 8 * a - d - 1,
                    l = (1 << b) - 1,
                    u = l >> 1,
                    n = 23 === d ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
                a = f ? 0 : a - 1;
                var q = f ? 1 : -1,
                    e = 0 > s || 0 === s && 0 > 1 / s ? 1 : 0;
                s = Math.abs(s);
                isNaN(s) || Infinity === s ? (s = isNaN(s) ? 1 : 0, f = l) : (f = Math.floor(Math.log(s) / Math.LN2), 1 > s * (c = Math.pow(2, -f)) && (f--, c *= 2), s = 1 <= f + u ? s + n / c : s + n * Math.pow(2,
                    1 - u), 2 <= s * c && (f++, c /= 2), f + u >= l ? (s = 0, f = l) : 1 <= f + u ? (s = (s * c - 1) * Math.pow(2, d), f += u) : (s = s * Math.pow(2, u - 1) * Math.pow(2, d), f = 0));
                for (; 8 <= d; h[k + a] = s & 255, a += q, s /= 256, d -= 8);
                f = f << d | s;
                for (b += d; 0 < b; h[k + a] = f & 255, a += q, f /= 256, b -= 8);
                h[k + a - q] |= 128 * e
            }
        }, {}
    ],
    6: [function(g, p, m) {
            var h = Object.prototype.toString;
            p.exports = Array.isArray || function(s) {
                return !!s && "[object Array]" == h.call(s)
            }
        }, {}
    ],
    7: [function(g, p, m) {
            (function(h) {
                function s(a) {
                    return function() {
                        var c = [];
                        return {
                            update: function(a, l) {
                                h.isBuffer(a) || (a = new h(a, l));
                                c.push(a);
                                return this
                            },
                            digest: function(b) {
                                var l = h.concat(c),
                                    l = a(l);
                                c = null;
                                return b ? l.toString(b) : l
                            }
                        }
                    }
                }
                var k = g("sha.js"),
                    f = s(g("./md5")),
                    d = s(g("ripemd160"));
                p.exports = function(a) {
                    return "md5" === a ? new f : "rmd160" === a ? new d : k(a)
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "./md5": 11,
            buffer: 3,
            ripemd160: 27,
            "sha.js": 29
        }
    ],
    8: [function(g, p, m) {
            (function(h) {
                function s(d, a) {
                    if (!(this instanceof s)) return new s(d, a);
                    this._opad = l;
                    this._alg = d;
                    var c = "sha512" === d ? 128 : 64;
                    a = this._key = h.isBuffer(a) ? a : new h(a);
                    a.length > c ? a = k(d).update(a).digest() :
                        a.length < c && (a = h.concat([a, f], c));
                    for (var b = this._ipad = new h(c), l = this._opad = new h(c), u = 0; u < c; u++) b[u] = a[u] ^ 54, l[u] = a[u] ^ 92;
                    this._hash = k(d).update(b)
                }
                var k = g("./create-hash"),
                    f = new h(128);
                f.fill(0);
                p.exports = s;
                s.prototype.update = function(d, a) {
                    this._hash.update(d, a);
                    return this
                };
                s.prototype.digest = function(d) {
                    var a = this._hash.digest();
                    return k(this._alg).update(this._opad).update(a).digest(d)
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "./create-hash": 7,
            buffer: 3
        }
    ],
    9: [function(g, p, m) {
            (function(h) {
                var s = new h(4);
                s.fill(0);
                p.exports = {
                    hash: function(k, f, d, a) {
                        h.isBuffer(k) || (k = new h(k));
                        var c = k;
                        0 !== c.length % 4 && (c = h.concat([c, s], c.length + (4 - c.length % 4)));
                        for (var b = [], l = a ? c.readInt32BE : c.readInt32LE, u = 0; u < c.length; u += 4) b.push(l.call(c, u));
                        k = f(b, 8 * k.length);
                        d = new h(d);
                        a = a ? d.writeInt32BE : d.writeInt32LE;
                        for (f = 0; f < k.length; f++) a.call(d, k[f], 4 * f, !0);
                        return d
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    10: [function(g, p, m) {
            (function(h) {
                function s() {
                    var d = [].slice.call(arguments).join(" ");
                    throw Error([d, "we accept pull requests\nhttp://github.com/dominictarr/crypto-browserify"].join("\n"));
                }
                var k = g("./rng");
                m.createHash = g("./create-hash");
                m.createHmac = g("./create-hmac");
                m.randomBytes = function(d, a) {
                    if (a && a.call) try {
                            a.call(this, void 0, new h(k(d)))
                    } catch (c) {
                        a(c)
                    } else return new h(k(d))
                };
                m.getHashes = function() {
                    return ["sha1", "sha256", "sha512", "md5", "rmd160"]
                };
                var f = g("./pbkdf2")(m);
                m.pbkdf2 = f.pbkdf2;
                m.pbkdf2Sync = f.pbkdf2Sync;
                g("browserify-aes/inject")(m, p.exports);
                (function(d, a) {
                    for (var c in d) a(d[c], c)
                })(["createCredentials", "createSign", "createVerify", "createDiffieHellman"], function(d) {
                    m[d] = function() {
                        s("sorry,", d, "is not implemented yet")
                    }
                })
            }).call(this, g("buffer").Buffer)
        }, {
            "./create-hash": 7,
            "./create-hmac": 8,
            "./pbkdf2": 33,
            "./rng": 34,
            "browserify-aes/inject": 17,
            buffer: 3
        }
    ],
    11: [function(g, p, m) {
            function h(b, l) {
                b[l >> 5] |= 128 << l % 32;
                b[(l + 64 >>> 9 << 4) + 14] = l;
                for (var c = 1732584193, n = -271733879, q = -1732584194, e = 271733878, r = 0; r < b.length; r += 16) var h = c,
                g = n, y = q, t = e, c = k(c, n, q, e, b[r + 0], 7, -680876936), e = k(e, c, n, q, b[r + 1], 12, -389564586), q = k(q, e, c, n, b[r + 2], 17, 606105819), n = k(n, q, e, c, b[r + 3], 22, -1044525330), c =
                    k(c, n, q, e, b[r + 4], 7, -176418897), e = k(e, c, n, q, b[r + 5], 12, 1200080426), q = k(q, e, c, n, b[r + 6], 17, -1473231341), n = k(n, q, e, c, b[r + 7], 22, -45705983), c = k(c, n, q, e, b[r + 8], 7, 1770035416), e = k(e, c, n, q, b[r + 9], 12, -1958414417), q = k(q, e, c, n, b[r + 10], 17, -42063), n = k(n, q, e, c, b[r + 11], 22, -1990404162), c = k(c, n, q, e, b[r + 12], 7, 1804603682), e = k(e, c, n, q, b[r + 13], 12, -40341101), q = k(q, e, c, n, b[r + 14], 17, -1502002290), n = k(n, q, e, c, b[r + 15], 22, 1236535329), c = f(c, n, q, e, b[r + 1], 5, -165796510), e = f(e, c, n, q, b[r + 6], 9, -1069501632), q = f(q, e, c, n, b[r + 11], 14, 643717713),
                n = f(n, q, e, c, b[r + 0], 20, -373897302), c = f(c, n, q, e, b[r + 5], 5, -701558691), e = f(e, c, n, q, b[r + 10], 9, 38016083), q = f(q, e, c, n, b[r + 15], 14, -660478335), n = f(n, q, e, c, b[r + 4], 20, -405537848), c = f(c, n, q, e, b[r + 9], 5, 568446438), e = f(e, c, n, q, b[r + 14], 9, -1019803690), q = f(q, e, c, n, b[r + 3], 14, -187363961), n = f(n, q, e, c, b[r + 8], 20, 1163531501), c = f(c, n, q, e, b[r + 13], 5, -1444681467), e = f(e, c, n, q, b[r + 2], 9, -51403784), q = f(q, e, c, n, b[r + 7], 14, 1735328473), n = f(n, q, e, c, b[r + 12], 20, -1926607734), c = s(n ^ q ^ e, c, n, b[r + 5], 4, -378558), e = s(c ^ n ^ q, e, c, b[r + 8], 11, -2022574463),
                q = s(e ^ c ^ n, q, e, b[r + 11], 16, 1839030562), n = s(q ^ e ^ c, n, q, b[r + 14], 23, -35309556), c = s(n ^ q ^ e, c, n, b[r + 1], 4, -1530992060), e = s(c ^ n ^ q, e, c, b[r + 4], 11, 1272893353), q = s(e ^ c ^ n, q, e, b[r + 7], 16, -155497632), n = s(q ^ e ^ c, n, q, b[r + 10], 23, -1094730640), c = s(n ^ q ^ e, c, n, b[r + 13], 4, 681279174), e = s(c ^ n ^ q, e, c, b[r + 0], 11, -358537222), q = s(e ^ c ^ n, q, e, b[r + 3], 16, -722521979), n = s(q ^ e ^ c, n, q, b[r + 6], 23, 76029189), c = s(n ^ q ^ e, c, n, b[r + 9], 4, -640364487), e = s(c ^ n ^ q, e, c, b[r + 12], 11, -421815835), q = s(e ^ c ^ n, q, e, b[r + 15], 16, 530742520), n = s(q ^ e ^ c, n, q, b[r + 2], 23, -995338651),
                c = d(c, n, q, e, b[r + 0], 6, -198630844), e = d(e, c, n, q, b[r + 7], 10, 1126891415), q = d(q, e, c, n, b[r + 14], 15, -1416354905), n = d(n, q, e, c, b[r + 5], 21, -57434055), c = d(c, n, q, e, b[r + 12], 6, 1700485571), e = d(e, c, n, q, b[r + 3], 10, -1894986606), q = d(q, e, c, n, b[r + 10], 15, -1051523), n = d(n, q, e, c, b[r + 1], 21, -2054922799), c = d(c, n, q, e, b[r + 8], 6, 1873313359), e = d(e, c, n, q, b[r + 15], 10, -30611744), q = d(q, e, c, n, b[r + 6], 15, -1560198380), n = d(n, q, e, c, b[r + 13], 21, 1309151649), c = d(c, n, q, e, b[r + 4], 6, -145523070), e = d(e, c, n, q, b[r + 11], 10, -1120210379), q = d(q, e, c, n, b[r + 2], 15,
                    718787259), n = d(n, q, e, c, b[r + 9], 21, -343485551), c = a(c, h), n = a(n, g), q = a(q, y), e = a(e, t);
                return [c, n, q, e]
            }
            function s(b, c, d, n, q, e) {
                b = a(a(c, b), a(n, e));
                return a(b << q | b >>> 32 - q, d)
            }
            function k(a, c, d, n, q, e, r) {
                return s(c & d | ~c & n, a, c, q, e, r)
            }
            function f(a, c, d, n, q, e, r) {
                return s(c & n | d & ~n, a, c, q, e, r)
            }
            function d(a, c, d, n, q, e, r) {
                return s(d ^ (c | ~n), a, c, q, e, r)
            }
            function a(a, c) {
                var d = (a & 65535) + (c & 65535);
                return (a >> 16) + (c >> 16) + (d >> 16) << 16 | d & 65535
            }
            var c = g("./helpers");
            p.exports = function(a) {
                return c.hash(a, h, 16)
            }
        }, {
            "./helpers": 9
        }
    ],
    12: [function(g,
            p, m) {
            (function(h) {
                p.exports = function(s, k, f, d) {
                    f /= 8;
                    d = d || 0;
                    for (var a = 0, c = 0, b = new h(f), l = new h(d), u = 0, n, q;;) {
                        n = s.createHash("md5");
                        0 < u++ && n.update(q);
                        n.update(k);
                        q = n.digest();
                        n = 0;
                        if (0 < f) for (; 0 !== f && n !== q.length;) b[a++] = q[n], f--, n++;
                        if (0 < d && n !== q.length) for (; 0 !== d && n !== q.length;) l[c++] = q[n], d--, n++;
                        if (0 === f && 0 === d) break
                    }
                    for (n = 0; n < q.length; n++) q[n] = 0;
                    return {
                        key: b,
                        iv: l
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    13: [function(g, p, m) {
            (function(h) {
                function s(a) {
                    var b;
                    return a > c || 0 > a ? (b = Math.abs(a) % c, 0 >
                        a ? c - b : b) : a
                }
                function k(a) {
                    var b, c, q;
                    b = c = 0;
                    for (q = a.length; 0 <= q ? c < q : c > q; b = 0 <= q ? ++c : --c) a[b] = 0;
                    return !1
                }
                function f() {
                    this.SBOX = [];
                    this.INV_SBOX = [];
                    this.SUB_MIX = function() {
                        var a, b;
                        b = [];
                        for (a = 0; 4 > a; ++a) b.push([]);
                        return b
                    }();
                    this.INV_SUB_MIX = function() {
                        var a, b;
                        b = [];
                        for (a = 0; 4 > a; ++a) b.push([]);
                        return b
                    }();
                    this.init();
                    this.RCON = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54]
                }
                function d(a) {
                    for (var b = a.length / 4, c = Array(b), q = -1; ++q < b;) c[q] = a.readUInt32BE(4 * q);
                    return c
                }
                function a(a) {
                    this._key = d(a);
                    this._doReset()
                }
                var c = Math.pow(2,
                    32);
                f.prototype.init = function() {
                    var a, b, c, q, e, r, d, f, h;
                    h = [];
                    for (a = b = 0; 256 > b; a = ++b) 128 > a ? h.push(a << 1) : h.push(a << 1 ^ 283);
                    for (f = d = c = 0; 256 > f; ++f) a = d ^ d << 1 ^ d << 2 ^ d << 3 ^ d << 4, a = a >>> 8 ^ a & 255 ^ 99, this.SBOX[c] = a, this.INV_SBOX[a] = c, q = h[c], e = h[q], r = h[e], b = 257 * h[a] ^ 16843008 * a, this.SUB_MIX[0][c] = b << 24 | b >>> 8, this.SUB_MIX[1][c] = b << 16 | b >>> 16, this.SUB_MIX[2][c] = b << 8 | b >>> 24, this.SUB_MIX[3][c] = b, b = 16843009 * r ^ 65537 * e ^ 257 * q ^ 16843008 * c, this.INV_SUB_MIX[0][a] = b << 24 | b >>> 8, this.INV_SUB_MIX[1][a] = b << 16 | b >>> 16, this.INV_SUB_MIX[2][a] =
                            b << 8 | b >>> 24, this.INV_SUB_MIX[3][a] = b, 0 === c ? c = d = 1 : (c = q ^ h[h[h[r ^ q]]], d ^= h[h[d]]);
                    return !0
                };
                var b = new f;
                a.blockSize = 16;
                a.prototype.blockSize = a.blockSize;
                a.keySize = 32;
                a.prototype.keySize = a.keySize;
                a.ivSize = a.blockSize;
                a.prototype.ivSize = a.ivSize;
                a.prototype._doReset = function() {
                    var a, c, d, q, e, r;
                    c = this._key;
                    a = c.length;
                    this._nRounds = a + 6;
                    q = 4 * (this._nRounds + 1);
                    this._keySchedule = [];
                    for (d = r = 0; 0 <= q ? r < q : r > q; d = 0 <= q ? ++r : --r) this._keySchedule[d] = d < a ? c[d] : (e = this._keySchedule[d - 1], 0 === d % a ? (e = e << 8 | e >>> 24, e = b.SBOX[e >>>
                            24] << 24 | b.SBOX[e >>> 16 & 255] << 16 | b.SBOX[e >>> 8 & 255] << 8 | b.SBOX[e & 255], e ^= b.RCON[d / a | 0] << 24) : 6 < a && 4 === d % a ? e = b.SBOX[e >>> 24] << 24 | b.SBOX[e >>> 16 & 255] << 16 | b.SBOX[e >>> 8 & 255] << 8 | b.SBOX[e & 255] : void 0, this._keySchedule[d - a] ^ e);
                    this._invKeySchedule = [];
                    for (a = c = 0; 0 <= q ? c < q : c > q; a = 0 <= q ? ++c : --c) d = q - a, e = this._keySchedule[d - (a % 4 ? 0 : 4)], this._invKeySchedule[a] = 4 > a || 4 >= d ? e : b.INV_SUB_MIX[0][b.SBOX[e >>> 24]] ^ b.INV_SUB_MIX[1][b.SBOX[e >>> 16 & 255]] ^ b.INV_SUB_MIX[2][b.SBOX[e >>> 8 & 255]] ^ b.INV_SUB_MIX[3][b.SBOX[e & 255]];
                    return !0
                };
                a.prototype.encryptBlock = function(a) {
                    a = d(new h(a));
                    a = this._doCryptBlock(a, this._keySchedule, b.SUB_MIX, b.SBOX);
                    var c = new h(16);
                    c.writeUInt32BE(a[0], 0);
                    c.writeUInt32BE(a[1], 4);
                    c.writeUInt32BE(a[2], 8);
                    c.writeUInt32BE(a[3], 12);
                    return c
                };
                a.prototype.decryptBlock = function(a) {
                    a = d(new h(a));
                    var c = [a[3], a[1]];
                    a[1] = c[0];
                    a[3] = c[1];
                    a = this._doCryptBlock(a, this._invKeySchedule, b.INV_SUB_MIX, b.INV_SBOX);
                    c = new h(16);
                    c.writeUInt32BE(a[0], 0);
                    c.writeUInt32BE(a[3], 4);
                    c.writeUInt32BE(a[2], 8);
                    c.writeUInt32BE(a[1], 12);
                    return c
                };
                a.prototype.scrub = function() {
                    k(this._keySchedule);
                    k(this._invKeySchedule);
                    k(this._key)
                };
                a.prototype._doCryptBlock = function(a, b, c, d) {
                    var e, r, f, h, k, g, m, p, x;
                    e = a[0] ^ b[0];
                    r = a[1] ^ b[1];
                    f = a[2] ^ b[2];
                    h = a[3] ^ b[3];
                    a = 4;
                    p = 1;
                    for (x = this._nRounds; 1 <= x ? p < x : p > x; 1 <= x ? ++p : --p) k = c[0][e >>> 24] ^ c[1][r >>> 16 & 255] ^ c[2][f >>> 8 & 255] ^ c[3][h & 255] ^ b[a++], g = c[0][r >>> 24] ^ c[1][f >>> 16 & 255] ^ c[2][h >>> 8 & 255] ^ c[3][e & 255] ^ b[a++], m = c[0][f >>> 24] ^ c[1][h >>> 16 & 255] ^ c[2][e >>> 8 & 255] ^ c[3][r & 255] ^ b[a++], h = c[0][h >>> 24] ^ c[1][e >>> 16 & 255] ^ c[2][r >>> 8 & 255] ^ c[3][f & 255] ^ b[a++],
                    e = k, r = g, f = m;
                    k = (d[e >>> 24] << 24 | d[r >>> 16 & 255] << 16 | d[f >>> 8 & 255] << 8 | d[h & 255]) ^ b[a++];
                    g = (d[r >>> 24] << 24 | d[f >>> 16 & 255] << 16 | d[h >>> 8 & 255] << 8 | d[e & 255]) ^ b[a++];
                    m = (d[f >>> 24] << 24 | d[h >>> 16 & 255] << 16 | d[e >>> 8 & 255] << 8 | d[r & 255]) ^ b[a++];
                    h = (d[h >>> 24] << 24 | d[e >>> 16 & 255] << 16 | d[r >>> 8 & 255] << 8 | d[f & 255]) ^ b[a++];
                    return [s(k), s(g), s(m), s(h)]
                };
                m.AES = a
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    14: [function(g, p, m) {
            (function(h) {
                function s() {
                    k.call(this)
                }
                var k = g("stream").Transform,
                    f = g("inherits");
                p.exports = s;
                f(s, k);
                s.prototype.update = function(d, a, c) {
                    this.write(d, a);
                    for (d = new h(""); a = this.read();) d = h.concat([d, a]);
                    c && (d = d.toString(c));
                    return d
                };
                s.prototype.final = function(d) {
                    this.end();
                    for (var a = new h(""), c; c = this.read();) a = h.concat([a, c]);
                    d && (a = a.toString(d));
                    return a
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3,
            inherits: 36,
            stream: 51
        }
    ],
    15: [function(g, p, m) {
            (function(h) {
                function s(b, e, c) {
                    if (!(this instanceof s)) return new s(b, e, c);
                    a.call(this);
                    this._cache = new k;
                    this._last = void 0;
                    this._cipher = new d.AES(e);
                    this._prev = new h(c.length);
                    c.copy(this._prev);
                    this._mode = b
                }
                function k() {
                    if (!(this instanceof k)) return new k;
                    this.cache = new h("")
                }
                function f(a) {
                    var e = a[15];
                    if (16 !== e) return a.slice(0, 16 - e)
                }
                var d = g("./aes"),
                    a = g("./cipherBase"),
                    c = g("inherits"),
                    b = g("./modes"),
                    l = g("./streamCipher"),
                    u = g("./EVP_BytesToKey");
                c(s, a);
                s.prototype._transform = function(a, e, b) {
                    for (this._cache.add(a); a = this._cache.get();) a = this._mode.decrypt(this, a), this.push(a);
                    b()
                };
                s.prototype._flush = function(a) {
                    var e = this._cache.flush();
                    if (!e) return a;
                    this.push(f(this._mode.decrypt(this,
                        e)));
                    a()
                };
                k.prototype.add = function(a) {
                    this.cache = h.concat([this.cache, a])
                };
                k.prototype.get = function() {
                    if (16 < this.cache.length) {
                        var a = this.cache.slice(0, 16);
                        this.cache = this.cache.slice(16);
                        return a
                    }
                    return null
                };
                k.prototype.flush = function() {
                    if (this.cache.length) return this.cache
                };
                var n = {
                    ECB: g("./modes/ecb"),
                    CBC: g("./modes/cbc"),
                    CFB: g("./modes/cfb"),
                    OFB: g("./modes/ofb"),
                    CTR: g("./modes/ctr")
                };
                p.exports = function(a) {
                    function e(e, a, c) {
                        e = b[e];
                        if (!e) throw new TypeError("invalid suite type");
                        "string" === typeof c &&
                            (c = new h(c));
                        "string" === typeof a && (a = new h(a));
                        if (a.length !== e.key / 8) throw new TypeError("invalid key length " + a.length);
                        if (c.length !== e.iv) throw new TypeError("invalid iv length " + c.length);
                        return "stream" === e.type ? new l(n[e.mode], a, c, !0) : new s(n[e.mode], a, c)
                    }
                    return {
                        createDecipher: function(c, l) {
                            var d = b[c];
                            if (!d) throw new TypeError("invalid suite type");
                            d = u(a, l, d.key, d.iv);
                            return e(c, d.key, d.iv)
                        },
                        createDecipheriv: e
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "./EVP_BytesToKey": 12,
            "./aes": 13,
            "./cipherBase": 14,
            "./modes": 18,
            "./modes/cbc": 19,
            "./modes/cfb": 20,
            "./modes/ctr": 21,
            "./modes/ecb": 22,
            "./modes/ofb": 23,
            "./streamCipher": 24,
            buffer: 3,
            inherits: 36
        }
    ],
    16: [function(g, p, m) {
            (function(h) {
                function s(a, b, e) {
                    if (!(this instanceof s)) return new s(a, b, e);
                    d.call(this);
                    this._cache = new k;
                    this._cipher = new f.AES(b);
                    this._prev = new h(e.length);
                    e.copy(this._prev);
                    this._mode = a
                }
                function k() {
                    if (!(this instanceof k)) return new k;
                    this.cache = new h("")
                }
                var f = g("./aes"),
                    d = g("./cipherBase"),
                    a = g("inherits"),
                    c = g("./modes"),
                    b = g("./EVP_BytesToKey"),
                    l = g("./streamCipher");
                a(s, d);
                s.prototype._transform = function(a, b, e) {
                    for (this._cache.add(a); a = this._cache.get();) a = this._mode.encrypt(this, a), this.push(a);
                    e()
                };
                s.prototype._flush = function(a) {
                    var b = this._cache.flush();
                    this.push(this._mode.encrypt(this, b));
                    this._cipher.scrub();
                    a()
                };
                k.prototype.add = function(a) {
                    this.cache = h.concat([this.cache, a])
                };
                k.prototype.get = function() {
                    if (15 < this.cache.length) {
                        var a = this.cache.slice(0, 16);
                        this.cache = this.cache.slice(16);
                        return a
                    }
                    return null
                };
                k.prototype.flush = function() {
                    for (var a =
                        16 - this.cache.length, b = new h(a), e = -1; ++e < a;) b.writeUInt8(a, e);
                    return h.concat([this.cache, b])
                };
                var u = {
                    ECB: g("./modes/ecb"),
                    CBC: g("./modes/cbc"),
                    CFB: g("./modes/cfb"),
                    OFB: g("./modes/ofb"),
                    CTR: g("./modes/ctr")
                };
                p.exports = function(a) {
                    function d(a, b, f) {
                        a = c[a];
                        if (!a) throw new TypeError("invalid suite type");
                        "string" === typeof f && (f = new h(f));
                        "string" === typeof b && (b = new h(b));
                        if (b.length !== a.key / 8) throw new TypeError("invalid key length " + b.length);
                        if (f.length !== a.iv) throw new TypeError("invalid iv length " +
                                f.length);
                        return "stream" === a.type ? new l(u[a.mode], b, f) : new s(u[a.mode], b, f)
                    }
                    return {
                        createCipher: function(e, l) {
                            var f = c[e];
                            if (!f) throw new TypeError("invalid suite type");
                            f = b(a, l, f.key, f.iv);
                            return d(e, f.key, f.iv)
                        },
                        createCipheriv: d
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "./EVP_BytesToKey": 12,
            "./aes": 13,
            "./cipherBase": 14,
            "./modes": 18,
            "./modes/cbc": 19,
            "./modes/cfb": 20,
            "./modes/ctr": 21,
            "./modes/ecb": 22,
            "./modes/ofb": 23,
            "./streamCipher": 24,
            buffer: 3,
            inherits: 36
        }
    ],
    17: [function(g, p, m) {
            p.exports = function(h, s) {
                s =
                    s || {};
                var k = g("./encrypter")(h);
                s.createCipher = k.createCipher;
                s.createCipheriv = k.createCipheriv;
                k = g("./decrypter")(h);
                s.createDecipher = k.createDecipher;
                s.createDecipheriv = k.createDecipheriv;
                var f = g("./modes");
                s.listCiphers = function() {
                    return Object.keys(f)
                }
            }
        }, {
            "./decrypter": 15,
            "./encrypter": 16,
            "./modes": 18
        }
    ],
    18: [function(g, p, m) {
            m["aes-128-ecb"] = {
                cipher: "AES",
                key: 128,
                iv: 0,
                mode: "ECB",
                type: "block"
            };
            m["aes-192-ecb"] = {
                cipher: "AES",
                key: 192,
                iv: 0,
                mode: "ECB",
                type: "block"
            };
            m["aes-256-ecb"] = {
                cipher: "AES",
                key: 256,
                iv: 0,
                mode: "ECB",
                type: "block"
            };
            m["aes-128-cbc"] = {
                cipher: "AES",
                key: 128,
                iv: 16,
                mode: "CBC",
                type: "block"
            };
            m["aes-192-cbc"] = {
                cipher: "AES",
                key: 192,
                iv: 16,
                mode: "CBC",
                type: "block"
            };
            m["aes-256-cbc"] = {
                cipher: "AES",
                key: 256,
                iv: 16,
                mode: "CBC",
                type: "block"
            };
            m.aes128 = m["aes-128-cbc"];
            m.aes192 = m["aes-192-cbc"];
            m.aes256 = m["aes-256-cbc"];
            m["aes-128-cfb"] = {
                cipher: "AES",
                key: 128,
                iv: 16,
                mode: "CFB",
                type: "stream"
            };
            m["aes-192-cfb"] = {
                cipher: "AES",
                key: 192,
                iv: 16,
                mode: "CFB",
                type: "stream"
            };
            m["aes-256-cfb"] = {
                cipher: "AES",
                key: 256,
                iv: 16,
                mode: "CFB",
                type: "stream"
            };
            m["aes-128-ofb"] = {
                cipher: "AES",
                key: 128,
                iv: 16,
                mode: "OFB",
                type: "stream"
            };
            m["aes-192-ofb"] = {
                cipher: "AES",
                key: 192,
                iv: 16,
                mode: "OFB",
                type: "stream"
            };
            m["aes-256-ofb"] = {
                cipher: "AES",
                key: 256,
                iv: 16,
                mode: "OFB",
                type: "stream"
            };
            m["aes-128-ctr"] = {
                cipher: "AES",
                key: 128,
                iv: 16,
                mode: "CTR",
                type: "stream"
            };
            m["aes-192-ctr"] = {
                cipher: "AES",
                key: 192,
                iv: 16,
                mode: "CTR",
                type: "stream"
            };
            m["aes-256-ctr"] = {
                cipher: "AES",
                key: 256,
                iv: 16,
                mode: "CTR",
                type: "stream"
            }
        }, {}
    ],
    19: [function(g, p, m) {
            var h = g("../xor");
            m.encrypt = function(s, k) {
                var f = h(k, s._prev);
                s._prev = s._cipher.encryptBlock(f);
                return s._prev
            };
            m.decrypt = function(s, k) {
                var f = s._prev;
                s._prev = k;
                var d = s._cipher.decryptBlock(k);
                return h(d, f)
            }
        }, {
            "../xor": 25
        }
    ],
    20: [function(g, p, m) {
            (function(h) {
                function s(f, d, a) {
                    var c = d.length,
                        b = k(d, f._cache);
                    f._cache = f._cache.slice(c);
                    f._prev = h.concat([f._prev, a ? d : b]);
                    return b
                }
                var k = g("../xor");
                m.encrypt = function(f, d, a) {
                    for (var c = new h(""), b; d.length;) if (0 === f._cache.length && (f._cache = f._cipher.encryptBlock(f._prev), f._prev = new h("")),
                            f._cache.length <= d.length) b = f._cache.length, c = h.concat([c, s(f, d.slice(0, b), a)]), d = d.slice(b);
                        else {
                            c = h.concat([c, s(f, d, a)]);
                            break
                        }
                    return c
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "../xor": 25,
            buffer: 3
        }
    ],
    21: [function(g, p, m) {
            (function(h) {
                function s(f) {
                    var d = f._cipher.encryptBlock(f._prev);
                    f = f._prev;
                    for (var a = f.length, c; a--;) if (c = f.readUInt8(a), 255 === c) f.writeUInt8(0, a);
                        else {
                            c++;
                            f.writeUInt8(c, a);
                            break
                        }
                    return d
                }
                var k = g("../xor");
                m.encrypt = function(f, d) {
                    for (; f._cache.length < d.length;) f._cache = h.concat([f._cache,
                                s(f)
                        ]);
                    var a = f._cache.slice(0, d.length);
                    f._cache = f._cache.slice(d.length);
                    return k(d, a)
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "../xor": 25,
            buffer: 3
        }
    ],
    22: [function(g, p, m) {
            m.encrypt = function(h, s) {
                return h._cipher.encryptBlock(s)
            };
            m.decrypt = function(h, s) {
                return h._cipher.decryptBlock(s)
            }
        }, {}
    ],
    23: [function(g, p, m) {
            (function(h) {
                function s(f) {
                    f._prev = f._cipher.encryptBlock(f._prev);
                    return f._prev
                }
                var k = g("../xor");
                m.encrypt = function(f, d) {
                    for (; f._cache.length < d.length;) f._cache = h.concat([f._cache, s(f)]);
                    var a =
                        f._cache.slice(0, d.length);
                    f._cache = f._cache.slice(d.length);
                    return k(d, a)
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "../xor": 25,
            buffer: 3
        }
    ],
    24: [function(g, p, m) {
            (function(h) {
                function s(d, a, c, b) {
                    if (!(this instanceof s)) return new s(d, a, c);
                    f.call(this);
                    this._cipher = new k.AES(a);
                    this._prev = new h(c.length);
                    this._cache = new h("");
                    this._secCache = new h("");
                    this._decrypt = b;
                    c.copy(this._prev);
                    this._mode = d
                }
                var k = g("./aes"),
                    f = g("./cipherBase");
                g("inherits")(s, f);
                p.exports = s;
                s.prototype._transform = function(d, a, c) {
                    c(null,
                        this._mode.encrypt(this, d, this._decrypt))
                };
                s.prototype._flush = function(d) {
                    this._cipher.scrub();
                    d()
                }
            }).call(this, g("buffer").Buffer)
        }, {
            "./aes": 13,
            "./cipherBase": 14,
            buffer: 3,
            inherits: 36
        }
    ],
    25: [function(g, p, m) {
            (function(h) {
                p.exports = function(s, k) {
                    for (var f = Math.min(s.length, k.length), d = new h(f), a = -1; ++a < f;) d.writeUInt8(s[a] ^ k[a], a);
                    return d
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    26: [function(g, p, m) {
            (function(h) {
                p.exports = function(s) {
                    function k(f, d, a, c, b) {
                        if ("number" !== typeof a) throw new TypeError("Iterations not a number");
                        if (0 > a) throw new TypeError("Bad iterations");
                        if ("number" !== typeof c) throw new TypeError("Key length not a number");
                        if (0 > c) throw new TypeError("Bad key length");
                        b = b || "sha1";
                        h.isBuffer(f) || (f = new h(f));
                        h.isBuffer(d) || (d = new h(d));
                        var l, k = 1,
                            n, q, e = new h(c),
                            r = new h(d.length + 4);
                        d.copy(r, 0, 0, d.length);
                        for (var g = 1; g <= k; g++) {
                            r.writeUInt32BE(g, d.length);
                            var m = s.createHmac(b, f).update(r).digest();
                            if (!l && (l = m.length, q = new h(l), k = Math.ceil(c / l), n = c - (k - 1) * l, c > (Math.pow(2, 32) - 1) * l)) throw new TypeError("keylen exceeds maximum length");
                            m.copy(q, 0, 0, l);
                            for (var y = 1; y < a; y++) for (var m = s.createHmac(b, f).update(m).digest(), t = 0; t < l; t++) q[t] ^= m[t];
                            q.copy(e, (g - 1) * l, 0, g == k ? n : l)
                        }
                        return e
                    }
                    return {
                        pbkdf2: function(f, d, a, c, b, l) {
                            "function" === typeof b && (l = b, b = void 0);
                            if ("function" !== typeof l) throw Error("No callback provided to pbkdf2");
                            setTimeout(function() {
                                var h;
                                try {
                                    h = k(f, d, a, c, b)
                                } catch (n) {
                                    return l(n)
                                }
                                l(void 0, h)
                            })
                        },
                        pbkdf2Sync: k
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    27: [function(g, p, m) {
            (function(h) {
                function g(a, b) {
                    return a << b | a >>> 32 - b
                }
                p.exports = function(l) {
                    var u = [1732584193, 4023233417, 2562383102, 271733878, 3285377520];
                    "string" == typeof l && (l = new h(l, "utf8"));
                    for (var n = l, q = [], e = 0, r = 0; e < n.length; e++, r += 8) q[r >>> 5] |= n[e] << 24 - r % 32;
                    n = 8 * l.length;
                    l = 8 * l.length;
                    q[n >>> 5] |= 128 << 24 - n % 32;
                    q[(n + 64 >>> 9 << 4) + 14] = (l << 8 | l >>> 24) & 16711935 | (l << 24 | l >>> 8) & 4278255360;
                    for (l = 0; l < q.length; l += 16) {
                        for (var n = u, e = q, r = l, v = 0; 16 > v; v++) {
                            var m = r + v,
                                y = e[m];
                            e[m] = (y << 8 | y >>> 24) & 16711935 | (y << 24 | y >>> 8) & 4278255360
                        }
                        for (var t = y = m = void 0, p = void 0, C = void 0, x = void 0, A = void 0, D = void 0,
                                E = void 0, H = void 0, x = m = n[0], A = y = n[1], D = t = n[2], E = p = n[3], H = C = n[4], w = void 0, v = 0; 80 > v; v += 1) w = m + e[r + k[v]] | 0, w = 16 > v ? w + ((y ^ t ^ p) + c[0]) : 32 > v ? w + ((y & t | ~y & p) + c[1]) : 48 > v ? w + (((y | ~t) ^ p) + c[2]) : 64 > v ? w + ((y & p | t & ~p) + c[3]) : w + ((y ^ (t | ~p)) + c[4]), w |= 0, w = g(w, d[v]), w = w + C | 0, m = C, C = p, p = g(t, 10), t = y, y = w, w = x + e[r + f[v]] | 0, w = 16 > v ? w + ((A ^ (D | ~E)) + b[0]) : 32 > v ? w + ((A & E | D & ~E) + b[1]) : 48 > v ? w + (((A | ~D) ^ E) + b[2]) : 64 > v ? w + ((A & D | ~A & E) + b[3]) : w + ((A ^ D ^ E) + b[4]), w |= 0, w = g(w, a[v]), w = w + H | 0, x = H, H = E, E = g(D, 10), D = A, A = w;
                        w = n[1] + t + E | 0;
                        n[1] = n[2] + p + H | 0;
                        n[2] = n[3] + C + x |
                            0;
                        n[3] = n[4] + m + A | 0;
                        n[4] = n[0] + y + D | 0;
                        n[0] = w
                    }
                    for (l = 0; 5 > l; l++) q = u[l], u[l] = (q << 8 | q >>> 24) & 16711935 | (q << 24 | q >>> 8) & 4278255360;
                    q = [];
                    for (l = 0; l < 32 * u.length; l += 8) q.push(u[l >>> 5] >>> 24 - l % 32 & 255);
                    return new h(q)
                };
                var k = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13],
                    f = [5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2,
                            10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
                    ],
                    d = [11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6],
                    a = [8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11],
                    c = [0, 1518500249,
                            1859775393, 2400959708, 2840853838
                    ],
                    b = [1352829926, 1548603684, 1836072691, 2053994217, 0]
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    28: [function(g, p, m) {
            p.exports = function(h) {
                function g(k, f) {
                    this._block = new h(k);
                    this._finalSize = f;
                    this._blockSize = k;
                    this._s = this._len = 0
                }
                g.prototype.init = function() {
                    this._len = this._s = 0
                };
                g.prototype.update = function(k, f) {
                    "string" === typeof k && (k = new h(k, f || "utf8"));
                    for (var d = this._len += k.length, a = this._s = this._s || 0, c = 0, b = this._block; a < d;) {
                        for (var l = Math.min(k.length, c + this._blockSize -
                            a % this._blockSize) - c, g = 0; g < l; g++) b[a % this._blockSize + g] = k[g + c];
                        a += l;
                        c += l;
                        0 === a % this._blockSize && this._update(b)
                    }
                    this._s = a;
                    return this
                };
                g.prototype.digest = function(h) {
                    var f = 8 * this._len;
                    this._block[this._len % this._blockSize] = 128;
                    this._block.fill(0, this._len % this._blockSize + 1);
                    f % (8 * this._blockSize) >= 8 * this._finalSize && (this._update(this._block), this._block.fill(0));
                    this._block.writeInt32BE(f, this._blockSize - 4);
                    f = this._update(this._block) || this._hash();
                    return h ? f.toString(h) : f
                };
                g.prototype._update = function() {
                    throw Error("_update must be implemented by subclass");
                };
                return g
            }
        }, {}
    ],
    29: [function(g, p, m) {
            m = p.exports = function(h) {
                var k = m[h];
                if (!k) throw Error(h + " is not supported (we accept pull requests)");
                return new k
            };
            p = g("buffer").Buffer;
            var h = g("./hash")(p);
            m.sha1 = g("./sha1")(p, h);
            m.sha256 = g("./sha256")(p, h);
            m.sha512 = g("./sha512")(p, h)
        }, {
            "./hash": 28,
            "./sha1": 30,
            "./sha256": 31,
            "./sha512": 32,
            buffer: 3
        }
    ],
    30: [function(g, p, m) {
            var h = g("util").inherits;
            p.exports = function(g, k) {
                function f() {
                    if (a.length) return a.pop().init();
                    if (!(this instanceof f)) return new f;
                    this._w =
                        d;
                    k.call(this, 64, 56);
                    this._h = null;
                    this.init()
                }
                var d = new("undefined" === typeof Int32Array ? Array : Int32Array)(80),
                    a = [];
                h(f, k);
                f.prototype.init = function() {
                    this._a = 1732584193;
                    this._b = 4023233417;
                    this._c = 2562383102;
                    this._d = 271733878;
                    this._e = 3285377520;
                    k.prototype.init.call(this);
                    return this
                };
                f.prototype._POOL = a;
                f.prototype._update = function(a) {
                    var b, l, d, f, h, e, r, k, g, s;
                    b = e = this._a;
                    l = r = this._b;
                    d = k = this._c;
                    f = g = this._d;
                    h = s = this._e;
                    for (var t = this._w, m = 0; 80 > m; m++) {
                        var p = m,
                            x;
                        16 > m ? x = a.readInt32BE(4 * m) : (x = t[m - 3] ^ t[m -
                            8] ^ t[m - 14] ^ t[m - 16], x = x << 1 | x >>> 31);
                        p = t[p] = x;
                        x = b << 5 | b >>> 27;
                        var A;
                        A = 20 > m ? l & d | ~l & f : 40 > m ? l ^ d ^ f : 60 > m ? l & d | l & f | d & f : l ^ d ^ f;
                        p = (x + A | 0) + ((h + p | 0) + (20 > m ? 1518500249 : 40 > m ? 1859775393 : 60 > m ? -1894007588 : -899497514) | 0) | 0;
                        h = f;
                        f = d;
                        d = l << 30 | l >>> 2;
                        l = b;
                        b = p
                    }
                    this._a = b + e | 0;
                    this._b = l + r | 0;
                    this._c = d + k | 0;
                    this._d = f + g | 0;
                    this._e = h + s | 0
                };
                f.prototype._hash = function() {
                    100 > a.length && a.push(this);
                    var c = new g(20);
                    c.writeInt32BE(this._a | 0, 0);
                    c.writeInt32BE(this._b | 0, 4);
                    c.writeInt32BE(this._c | 0, 8);
                    c.writeInt32BE(this._d | 0, 12);
                    c.writeInt32BE(this._e |
                        0, 16);
                    return c
                };
                return f
            }
        }, {
            util: 54
        }
    ],
    31: [function(g, p, m) {
            var h = g("util").inherits;
            p.exports = function(g, k) {
                function f() {
                    this.init();
                    this._w = c;
                    k.call(this, 64, 56)
                }
                function d(a, c) {
                    return a >>> c | a << 32 - c
                }
                var a = [1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993, 2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987, 1925078388, 2162078206, 2614888103, 3248222580, 3835390401, 4022224774, 264347078, 604807628, 770255983, 1249150122, 1555081692, 1996064986, 2554220882, 2821834349, 2952996808, 3210313671,
                        3336571891, 3584528711, 113926993, 338241895, 666307205, 773529912, 1294757372, 1396182291, 1695183700, 1986661051, 2177026350, 2456956037, 2730485921, 2820302411, 3259730800, 3345764771, 3516065817, 3600352804, 4094571909, 275423344, 430227734, 506948616, 659060556, 883997877, 958139571, 1322822218, 1537002063, 1747873779, 1955562222, 2024104815, 2227730452, 2361852424, 2428436474, 2756734187, 3204031479, 3329325298
                ],
                    c = Array(64);
                h(f, k);
                f.prototype.init = function() {
                    this._a = 1779033703;
                    this._b = -1150833019;
                    this._c = 1013904242;
                    this._d = -1521486534;
                    this._e = 1359893119;
                    this._f = -1694144372;
                    this._g = 528734635;
                    this._h = 1541459225;
                    this._len = this._s = 0;
                    return this
                };
                f.prototype._update = function(b) {
                    var c = this._w,
                        f, h, q, e, r, k, g, s, t, m;
                    f = this._a | 0;
                    h = this._b | 0;
                    q = this._c | 0;
                    e = this._d | 0;
                    r = this._e | 0;
                    k = this._f | 0;
                    g = this._g | 0;
                    s = this._h | 0;
                    for (var p = 0; 64 > p; p++) {
                        t = p;
                        if (16 > p) m = b.readInt32BE(4 * p);
                        else {
                            m = c[p - 2];
                            m = (d(m, 17) ^ d(m, 19) ^ m >>> 10) + c[p - 7];
                            var x;
                            x = c[p - 15];
                            x = d(x, 7) ^ d(x, 18) ^ x >>> 3;
                            m = m + x + c[p - 16]
                        }
                        t = c[t] = m;
                        m = r;
                        m = d(m, 6) ^ d(m, 11) ^ d(m, 25);
                        t = s + m + (r & k ^ ~r & g) + a[p] + t;
                        s = f;
                        m = (d(s, 2) ^
                            d(s, 13) ^ d(s, 22)) + (f & h ^ f & q ^ h & q);
                        s = g;
                        g = k;
                        k = r;
                        r = e + t;
                        e = q;
                        q = h;
                        h = f;
                        f = t + m
                    }
                    this._a = f + this._a | 0;
                    this._b = h + this._b | 0;
                    this._c = q + this._c | 0;
                    this._d = e + this._d | 0;
                    this._e = r + this._e | 0;
                    this._f = k + this._f | 0;
                    this._g = g + this._g | 0;
                    this._h = s + this._h | 0
                };
                f.prototype._hash = function() {
                    var a = new g(32);
                    a.writeInt32BE(this._a, 0);
                    a.writeInt32BE(this._b, 4);
                    a.writeInt32BE(this._c, 8);
                    a.writeInt32BE(this._d, 12);
                    a.writeInt32BE(this._e, 16);
                    a.writeInt32BE(this._f, 20);
                    a.writeInt32BE(this._g, 24);
                    a.writeInt32BE(this._h, 28);
                    return a
                };
                return f
            }
        }, {
            util: 54
        }
    ],
    32: [function(g, p, m) {
            var h = g("util").inherits;
            p.exports = function(g, k) {
                function f() {
                    this.init();
                    this._w = c;
                    k.call(this, 128, 112)
                }
                function d(a, c, d) {
                    return a >>> d | c << 32 - d
                }
                var a = [1116352408, 3609767458, 1899447441, 602891725, 3049323471, 3964484399, 3921009573, 2173295548, 961987163, 4081628472, 1508970993, 3053834265, 2453635748, 2937671579, 2870763221, 3664609560, 3624381080, 2734883394, 310598401, 1164996542, 607225278, 1323610764, 1426881987, 3590304994, 1925078388, 4068182383, 2162078206, 991336113, 2614888103, 633803317,
                        3248222580, 3479774868, 3835390401, 2666613458, 4022224774, 944711139, 264347078, 2341262773, 604807628, 2007800933, 770255983, 1495990901, 1249150122, 1856431235, 1555081692, 3175218132, 1996064986, 2198950837, 2554220882, 3999719339, 2821834349, 766784016, 2952996808, 2566594879, 3210313671, 3203337956, 3336571891, 1034457026, 3584528711, 2466948901, 113926993, 3758326383, 338241895, 168717936, 666307205, 1188179964, 773529912, 1546045734, 1294757372, 1522805485, 1396182291, 2643833823, 1695183700, 2343527390, 1986661051, 1014477480, 2177026350,
                        1206759142, 2456956037, 344077627, 2730485921, 1290863460, 2820302411, 3158454273, 3259730800, 3505952657, 3345764771, 106217008, 3516065817, 3606008344, 3600352804, 1432725776, 4094571909, 1467031594, 275423344, 851169720, 430227734, 3100823752, 506948616, 1363258195, 659060556, 3750685593, 883997877, 3785050280, 958139571, 3318307427, 1322822218, 3812723403, 1537002063, 2003034995, 1747873779, 3602036899, 1955562222, 1575990012, 2024104815, 1125592928, 2227730452, 2716904306, 2361852424, 442776044, 2428436474, 593698344, 2756734187, 3733110249,
                        3204031479, 2999351573, 3329325298, 3815920427, 3391569614, 3928383900, 3515267271, 566280711, 3940187606, 3454069534, 4118630271, 4000239992, 116418474, 1914138554, 174292421, 2731055270, 289380356, 3203993006, 460393269, 320620315, 685471733, 587496836, 852142971, 1086792851, 1017036298, 365543100, 1126000580, 2618297676, 1288033470, 3409855158, 1501505948, 4234509866, 1607167915, 987167468, 1816402316, 1246189591
                ],
                    c = Array(160);
                h(f, k);
                f.prototype.init = function() {
                    this._a = 1779033703;
                    this._b = -1150833019;
                    this._c = 1013904242;
                    this._d = -1521486534;
                    this._e = 1359893119;
                    this._f = -1694144372;
                    this._g = 528734635;
                    this._h = 1541459225;
                    this._al = -205731576;
                    this._bl = -2067093701;
                    this._cl = -23791573;
                    this._dl = 1595750129;
                    this._el = -1377402159;
                    this._fl = 725511199;
                    this._gl = -79577749;
                    this._hl = 327033209;
                    this._len = this._s = 0;
                    return this
                };
                f.prototype._update = function(b) {
                    var c = this._w,
                        f, h, q, e, r, k, g, s, m, p, C, x, A, D, E, H;
                    f = this._a | 0;
                    h = this._b | 0;
                    q = this._c | 0;
                    e = this._d | 0;
                    r = this._e | 0;
                    k = this._f | 0;
                    g = this._g | 0;
                    s = this._h | 0;
                    m = this._al | 0;
                    p = this._bl | 0;
                    C = this._cl | 0;
                    x = this._dl | 0;
                    A = this._el |
                        0;
                    D = this._fl | 0;
                    E = this._gl | 0;
                    H = this._hl | 0;
                    for (var w = 0; 80 > w; w++) {
                        var z = 2 * w,
                            I, B;
                        if (16 > w) I = c[z] = b.readInt32BE(4 * z), B = c[z + 1] = b.readInt32BE(4 * z + 4);
                        else {
                            B = c[z - 30];
                            var F = c[z - 30 + 1];
                            I = d(B, F, 1) ^ d(B, F, 8) ^ B >>> 7;
                            var L = d(F, B, 1) ^ d(F, B, 8) ^ d(F, B, 7);
                            B = c[z - 4];
                            var F = c[z - 4 + 1],
                                N = d(B, F, 19) ^ d(F, B, 29) ^ B >>> 6,
                                F = d(F, B, 19) ^ d(B, F, 29) ^ d(F, B, 6),
                                J = c[z - 14],
                                O = c[z - 32],
                                M = c[z - 32 + 1];
                            B = L + c[z - 14 + 1];
                            I = I + J + (B >>> 0 < L >>> 0 ? 1 : 0);
                            B += F;
                            I = I + N + (B >>> 0 < F >>> 0 ? 1 : 0);
                            B += M;
                            I = I + O + (B >>> 0 < M >>> 0 ? 1 : 0);
                            c[z] = I;
                            c[z + 1] = B
                        }
                        var N = f & h ^ f & q ^ h & q,
                            O = m & p ^ m & C ^ p & C,
                            L = d(f, m, 28) ^
                                d(m, f, 2) ^ d(m, f, 7),
                            F = d(m, f, 28) ^ d(f, m, 2) ^ d(f, m, 7),
                            J = d(r, A, 14) ^ d(r, A, 18) ^ d(A, r, 9),
                            R = d(A, r, 14) ^ d(A, r, 18) ^ d(r, A, 9),
                            M = a[z],
                            P = a[z + 1],
                            S = r & k ^ ~r & g,
                            Q = A & D ^ ~A & E,
                            z = H + R,
                            J = s + J + (z >>> 0 < H >>> 0 ? 1 : 0),
                            z = z + Q,
                            J = J + S + (z >>> 0 < Q >>> 0 ? 1 : 0),
                            z = z + P,
                            J = J + M + (z >>> 0 < P >>> 0 ? 1 : 0),
                            z = z + B,
                            J = J + I + (z >>> 0 < B >>> 0 ? 1 : 0);
                        B = F + O;
                        I = L + N + (B >>> 0 < F >>> 0 ? 1 : 0);
                        s = g;
                        H = E;
                        g = k;
                        E = D;
                        k = r;
                        D = A;
                        A = x + z | 0;
                        r = e + J + (A >>> 0 < x >>> 0 ? 1 : 0) | 0;
                        e = q;
                        x = C;
                        q = h;
                        C = p;
                        h = f;
                        p = m;
                        m = z + B | 0;
                        f = J + I + (m >>> 0 < z >>> 0 ? 1 : 0) | 0
                    }
                    this._al = this._al + m | 0;
                    this._bl = this._bl + p | 0;
                    this._cl = this._cl + C | 0;
                    this._dl = this._dl + x | 0;
                    this._el = this._el + A | 0;
                    this._fl = this._fl + D | 0;
                    this._gl = this._gl + E | 0;
                    this._hl = this._hl + H | 0;
                    this._a = this._a + f + (this._al >>> 0 < m >>> 0 ? 1 : 0) | 0;
                    this._b = this._b + h + (this._bl >>> 0 < p >>> 0 ? 1 : 0) | 0;
                    this._c = this._c + q + (this._cl >>> 0 < C >>> 0 ? 1 : 0) | 0;
                    this._d = this._d + e + (this._dl >>> 0 < x >>> 0 ? 1 : 0) | 0;
                    this._e = this._e + r + (this._el >>> 0 < A >>> 0 ? 1 : 0) | 0;
                    this._f = this._f + k + (this._fl >>> 0 < D >>> 0 ? 1 : 0) | 0;
                    this._g = this._g + g + (this._gl >>> 0 < E >>> 0 ? 1 : 0) | 0;
                    this._h = this._h + s + (this._hl >>> 0 < H >>> 0 ? 1 : 0) | 0
                };
                f.prototype._hash = function() {
                    function a(b, d, f) {
                        c.writeInt32BE(b,
                            f);
                        c.writeInt32BE(d, f + 4)
                    }
                    var c = new g(64);
                    a(this._a, this._al, 0);
                    a(this._b, this._bl, 8);
                    a(this._c, this._cl, 16);
                    a(this._d, this._dl, 24);
                    a(this._e, this._el, 32);
                    a(this._f, this._fl, 40);
                    a(this._g, this._gl, 48);
                    a(this._h, this._hl, 56);
                    return c
                };
                return f
            }
        }, {
            util: 54
        }
    ],
    33: [function(g, p, m) {
            var h = g("pbkdf2-compat/pbkdf2");
            p.exports = function(g, k) {
                k = k || {};
                var f = h(g);
                k.pbkdf2 = f.pbkdf2;
                k.pbkdf2Sync = f.pbkdf2Sync;
                return k
            }
        }, {
            "pbkdf2-compat/pbkdf2": 26
        }
    ],
    34: [function(g, p, m) {
            (function(h, s) {
                (function() {
                    var k = ("undefined" ===
                        typeof window ? h : window) || {};
                    _crypto = k.crypto || k.msCrypto || g("crypto");
                    p.exports = function(f) {
                        if (_crypto.getRandomValues) return f = new s(f), _crypto.getRandomValues(f), f;
                        if (_crypto.randomBytes) return _crypto.randomBytes(f);
                        throw Error("secure random number generation not supported by this browser\nuse chrome, FireFox or Internet Explorer 11");
                    }
                })()
            }).call(this, "undefined" !== typeof global ? global : "undefined" !== typeof self ? self : "undefined" !== typeof window ? window : {}, g("buffer").Buffer)
        }, {
            buffer: 3,
            crypto: 2
        }
    ],
    35: [function(g, p, m) {
            function h() {
                this._events = this._events || {};
                this._maxListeners = this._maxListeners || void 0
            }
            function s(f) {
                return "function" === typeof f
            }
            function k(f) {
                return "object" === typeof f && null !== f
            }
            p.exports = h;
            h.EventEmitter = h;
            h.prototype._events = void 0;
            h.prototype._maxListeners = void 0;
            h.defaultMaxListeners = 10;
            h.prototype.setMaxListeners = function(f) {
                if ("number" !== typeof f || 0 > f || isNaN(f)) throw TypeError("n must be a positive number");
                this._maxListeners = f;
                return this
            };
            h.prototype.emit = function(f) {
                var d,
                    a, c, b;
                this._events || (this._events = {});
                if ("error" === f && (!this._events.error || k(this._events.error) && !this._events.error.length)) {
                    d = arguments[1];
                    if (d instanceof Error) throw d;
                    throw TypeError('Uncaught, unspecified "error" event.');
                }
                a = this._events[f];
                if (void 0 === a) return !1;
                if (s(a)) switch (arguments.length) {
                        case 1:
                            a.call(this);
                            break;
                        case 2:
                            a.call(this, arguments[1]);
                            break;
                        case 3:
                            a.call(this, arguments[1], arguments[2]);
                            break;
                        default:
                            d = arguments.length;
                            c = Array(d - 1);
                            for (b = 1; b < d; b++) c[b - 1] = arguments[b];
                            a.apply(this,
                                c)
                } else if (k(a)) {
                    d = arguments.length;
                    c = Array(d - 1);
                    for (b = 1; b < d; b++) c[b - 1] = arguments[b];
                    a = a.slice();
                    d = a.length;
                    for (b = 0; b < d; b++) a[b].apply(this, c)
                }
                return !0
            };
            h.prototype.addListener = function(f, d) {
                var a;
                if (!s(d)) throw TypeError("listener must be a function");
                this._events || (this._events = {});
                this._events.newListener && this.emit("newListener", f, s(d.listener) ? d.listener : d);
                this._events[f] ? k(this._events[f]) ? this._events[f].push(d) : this._events[f] = [this._events[f], d] : this._events[f] = d;
                k(this._events[f]) && !this._events[f].warned &&
                    (a = void 0 !== this._maxListeners ? this._maxListeners : h.defaultMaxListeners) && 0 < a && this._events[f].length > a && (this._events[f].warned = !0, console.error("(node) warning: possible EventEmitter memory leak detected. %d listeners added. Use emitter.setMaxListeners() to increase limit.", this._events[f].length), "function" === typeof console.trace && console.trace());
                return this
            };
            h.prototype.on = h.prototype.addListener;
            h.prototype.once = function(f, d) {
                function a() {
                    this.removeListener(f, a);
                    c || (c = !0, d.apply(this, arguments))
                }
                if (!s(d)) throw TypeError("listener must be a function");
                var c = !1;
                a.listener = d;
                this.on(f, a);
                return this
            };
            h.prototype.removeListener = function(f, d) {
                var a, c, b;
                if (!s(d)) throw TypeError("listener must be a function");
                if (!this._events || !this._events[f]) return this;
                a = this._events[f];
                b = a.length;
                c = -1;
                if (a === d || s(a.listener) && a.listener === d) delete this._events[f], this._events.removeListener && this.emit("removeListener", f, d);
                else if (k(a)) {
                    for (; 0 < b--;) if (a[b] === d || a[b].listener && a[b].listener === d) {
                            c = b;
                            break
                        }
                    if (0 >
                        c) return this;
                    1 === a.length ? (a.length = 0, delete this._events[f]) : a.splice(c, 1);
                    this._events.removeListener && this.emit("removeListener", f, d)
                }
                return this
            };
            h.prototype.removeAllListeners = function(f) {
                var d;
                if (!this._events) return this;
                if (!this._events.removeListener) return 0 === arguments.length ? this._events = {} : this._events[f] && delete this._events[f], this;
                if (0 === arguments.length) {
                    for (d in this._events) "removeListener" !== d && this.removeAllListeners(d);
                    this.removeAllListeners("removeListener");
                    this._events = {};
                    return this
                }
                d = this._events[f];
                if (s(d)) this.removeListener(f, d);
                else for (; d.length;) this.removeListener(f, d[d.length - 1]);
                delete this._events[f];
                return this
            };
            h.prototype.listeners = function(f) {
                return this._events && this._events[f] ? s(this._events[f]) ? [this._events[f]] : this._events[f].slice() : []
            };
            h.listenerCount = function(f, d) {
                return f._events && f._events[d] ? s(f._events[d]) ? 1 : f._events[d].length : 0
            }
        }, {}
    ],
    36: [function(g, p, m) {
            p.exports = "function" === typeof Object.create ? function(h, g) {
                h.super_ = g;
                h.prototype =
                    Object.create(g.prototype, {
                    constructor: {
                        value: h,
                        enumerable: !1,
                        writable: !0,
                        configurable: !0
                    }
                })
            } : function(h, g) {
                h.super_ = g;
                var k = function() {};
                k.prototype = g.prototype;
                h.prototype = new k;
                h.prototype.constructor = h
            }
        }, {}
    ],
    37: [function(g, p, m) {
            p.exports = Array.isArray || function(h) {
                return "[object Array]" == Object.prototype.toString.call(h)
            }
        }, {}
    ],
    38: [function(g, p, m) {
            (function(h) {
                function g(a, c) {
                    for (var b = 0, d = a.length - 1; 0 <= d; d--) {
                        var f = a[d];
                        "." === f ? a.splice(d, 1) : ".." === f ? (a.splice(d, 1), b++) : b && (a.splice(d, 1), b--)
                    }
                    if (c) for (; b--; b) a.unshift("..");
                    return a
                }
                function k(a, c) {
                    if (a.filter) return a.filter(c);
                    for (var b = [], d = 0; d < a.length; d++) c(a[d], d, a) && b.push(a[d]);
                    return b
                }
                var f = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                m.resolve = function() {
                    for (var a = "", c = !1, b = arguments.length - 1; - 1 <= b && !c; b--) {
                        var d = 0 <= b ? arguments[b] : h.cwd();
                        if ("string" !== typeof d) throw new TypeError("Arguments to path.resolve must be strings");
                        d && (a = d + "/" + a, c = "/" === d.charAt(0))
                    }
                    a = g(k(a.split("/"), function(a) {
                        return !!a
                    }), !c).join("/");
                    return (c ? "/" : "") + a || "."
                };
                m.normalize = function(a) {
                    var c = m.isAbsolute(a),
                        b = "/" === d(a, -1);
                    (a = g(k(a.split("/"), function(a) {
                        return !!a
                    }), !c).join("/")) || c || (a = ".");
                    a && b && (a += "/");
                    return (c ? "/" : "") + a
                };
                m.isAbsolute = function(a) {
                    return "/" === a.charAt(0)
                };
                m.join = function() {
                    var a = Array.prototype.slice.call(arguments, 0);
                    return m.normalize(k(a, function(a, b) {
                        if ("string" !== typeof a) throw new TypeError("Arguments to path.join must be strings");
                        return a
                    }).join("/"))
                };
                m.relative = function(a, c) {
                    function b(a) {
                        for (var e = 0; e < a.length && "" === a[e]; e++);
                        for (var b = a.length - 1; 0 <= b && "" === a[b]; b--);
                        return e > b ? [] : a.slice(e, b - e + 1)
                    }
                    a = m.resolve(a).substr(1);
                    c = m.resolve(c).substr(1);
                    for (var d = b(a.split("/")), f = b(c.split("/")), h = Math.min(d.length, f.length), k = h, e = 0; e < h; e++) if (d[e] !== f[e]) {
                            k = e;
                            break
                        }
                    h = [];
                    for (e = k; e < d.length; e++) h.push("..");
                    h = h.concat(f.slice(k));
                    return h.join("/")
                };
                m.sep = "/";
                m.delimiter = ":";
                m.dirname = function(a) {
                    var c = f.exec(a).slice(1);
                    a = c[0];
                    c = c[1];
                    if (!a && !c) return ".";
                    c && (c = c.substr(0, c.length - 1));
                    return a + c
                };
                m.basename = function(a, c) {
                    var b =
                        f.exec(a).slice(1)[2];
                    c && b.substr(-1 * c.length) === c && (b = b.substr(0, b.length - c.length));
                    return b
                };
                m.extname = function(a) {
                    return f.exec(a).slice(1)[3]
                };
                var d = "b" === "ab".substr(-1) ? function(a, c, b) {
                        return a.substr(c, b)
                    } : function(a, c, b) {
                        0 > c && (c = a.length + c);
                        return a.substr(c, b)
                    }
            }).call(this, g("_process"))
        }, {
            _process: 39
        }
    ],
    39: [function(g, p, m) {
            function h() {}
            g = p.exports = {};
            g.nextTick = function() {
                var h = "undefined" !== typeof window && window.postMessage && window.addEventListener;
                if ("undefined" !== typeof window && window.setImmediate) return function(d) {
                        return window.setImmediate(d)
                };
                var k = [];
                if ("undefined" !== typeof window && window.MutationObserver) {
                    var f = document.createElement("div");
                    (new MutationObserver(function() {
                        var d = k.slice();
                        k.length = 0;
                        d.forEach(function(a) {
                            a()
                        })
                    })).observe(f, {
                        attributes: !0
                    });
                    return function(d) {
                        k.length || f.setAttribute("yes", "no");
                        k.push(d)
                    }
                }
                return h ? (window.addEventListener("message", function(d) {
                    var a = d.source;
                    a !== window && null !== a || "process-tick" !== d.data || (d.stopPropagation(), 0 < k.length && k.shift()())
                }, !0), function(d) {
                    k.push(d);
                    window.postMessage("process-tick",
                        "*")
                }) : function(d) {
                    setTimeout(d, 0)
                }
            }();
            g.title = "browser";
            g.browser = !0;
            g.env = {};
            g.argv = [];
            g.on = h;
            g.addListener = h;
            g.once = h;
            g.off = h;
            g.removeListener = h;
            g.removeAllListeners = h;
            g.emit = h;
            g.binding = function(h) {
                throw Error("process.binding is not supported");
            };
            g.cwd = function() {
                return "/"
            };
            g.chdir = function(h) {
                throw Error("process.chdir is not supported");
            }
        }, {}
    ],
    40: [function(g, p, m) {
            p.exports = g("./lib/_stream_duplex.js")
        }, {
            "./lib/_stream_duplex.js": 41
        }
    ],
    41: [function(g, p, m) {
            (function(h) {
                function s(b) {
                    if (!(this instanceof s)) return new s(b);
                    a.call(this, b);
                    c.call(this, b);
                    b && !1 === b.readable && (this.readable = !1);
                    b && !1 === b.writable && (this.writable = !1);
                    this.allowHalfOpen = !0;
                    b && !1 === b.allowHalfOpen && (this.allowHalfOpen = !1);
                    this.once("end", k)
                }
                function k() {
                    this.allowHalfOpen || this._writableState.ended || h.nextTick(this.end.bind(this))
                }
                p.exports = s;
                var f = Object.keys || function(a) {
                        var c = [],
                            d;
                        for (d in a) c.push(d);
                        return c
                    }, d = g("core-util-is");
                d.inherits = g("inherits");
                var a = g("./_stream_readable"),
                    c = g("./_stream_writable");
                d.inherits(s,
                    a);
                (function(a, c) {
                    for (var d = 0, f = a.length; d < f; d++) c(a[d], d)
                })(f(c.prototype), function(a) {
                    s.prototype[a] || (s.prototype[a] = c.prototype[a])
                })
            }).call(this, g("_process"))
        }, {
            "./_stream_readable": 43,
            "./_stream_writable": 45,
            _process: 39,
            "core-util-is": 46,
            inherits: 36
        }
    ],
    42: [function(g, p, m) {
            function h(k) {
                if (!(this instanceof h)) return new h(k);
                s.call(this, k)
            }
            p.exports = h;
            var s = g("./_stream_transform");
            p = g("core-util-is");
            p.inherits = g("inherits");
            p.inherits(h, s);
            h.prototype._transform = function(h, f, d) {
                d(null, h)
            }
        }, {
            "./_stream_transform": 44,
            "core-util-is": 46,
            inherits: 36
        }
    ],
    43: [function(g, p, m) {
            (function(h) {
                function s(a, e) {
                    a = a || {};
                    var b = a.highWaterMark;
                    this.highWaterMark = b || 0 === b ? b : 16384;
                    this.highWaterMark = ~~this.highWaterMark;
                    this.buffer = [];
                    this.length = 0;
                    this.pipes = null;
                    this.pipesCount = 0;
                    this.calledRead = this.reading = this.endEmitted = this.ended = this.flowing = !1;
                    this.sync = !0;
                    this.readableListening = this.emittedReadable = this.needReadable = !1;
                    this.objectMode = !! a.objectMode;
                    this.defaultEncoding = a.defaultEncoding || "utf8";
                    this.ranOut = !1;
                    this.awaitDrain = 0;
                    this.readingMore = !1;
                    this.encoding = this.decoder = null;
                    a.encoding && (C || (C = g("string_decoder/").StringDecoder), this.decoder = new C(a.encoding), this.encoding = a.encoding)
                }
                function k(a) {
                    if (!(this instanceof k)) return new k(a);
                    this._readableState = new s(a, this);
                    this.readable = !0;
                    t.call(this)
                }
                function f(b, d, f, r, h) {
                    var l;
                    l = f;
                    var k = null;
                    G.isBuffer(l) || "string" === typeof l || null === l || void 0 === l || d.objectMode || (k = new TypeError("Invalid non-string/buffer chunk"));
                    (l = k) ? b.emit("error",
                        l) : null === f || void 0 === f ? (d.reading = !1, d.ended || (d.decoder && !d.ended && (f = d.decoder.end()) && f.length && (d.buffer.push(f), d.length += d.objectMode ? 1 : f.length), d.ended = !0, 0 < d.length ? a(b) : e(b))) : d.objectMode || f && 0 < f.length ? d.ended && !h ? (f = Error("stream.push() after EOF"), b.emit("error", f)) : d.endEmitted && h ? (f = Error("stream.unshift() after end event"), b.emit("error", f)) : (!d.decoder || h || r || (f = d.decoder.write(f)), d.length += d.objectMode ? 1 : f.length, h ? d.buffer.unshift(f) : (d.reading = !1, d.buffer.push(f)), d.needReadable &&
                        a(b), c(b, d)) : h || (d.reading = !1);
                    return !d.ended && (d.needReadable || d.length < d.highWaterMark || 0 === d.length)
                }
                function d(a, e) {
                    if (0 === e.length && e.ended) return 0;
                    if (e.objectMode) return 0 === a ? 0 : 1;
                    if (null === a || isNaN(a)) return e.flowing && e.buffer.length ? e.buffer[0].length : e.length;
                    if (0 >= a) return 0;
                    if (a > e.highWaterMark) {
                        var b = a;
                        if (8388608 <= b) b = 8388608;
                        else {
                            b--;
                            for (var c = 1; 32 > c; c <<= 1) b |= b >> c;
                            b++
                        }
                        e.highWaterMark = b
                    }
                    if (a > e.length) {
                        if (e.ended) return e.length;
                        e.needReadable = !0;
                        return 0
                    }
                    return a
                }
                function a(a) {
                    var e =
                        a._readableState;
                    e.needReadable = !1;
                    e.emittedReadable || (e.emittedReadable = !0, e.sync ? h.nextTick(function() {
                        a.emit("readable")
                    }) : a.emit("readable"))
                }
                function c(a, e) {
                    e.readingMore || (e.readingMore = !0, h.nextTick(function() {
                        for (var b = e.length; !e.reading && !e.flowing && !e.ended && e.length < e.highWaterMark && (a.read(0), b !== e.length);) b = e.length;
                        e.readingMore = !1
                    }))
                }
                function b(a) {
                    return function() {
                        var e = a._readableState;
                        e.awaitDrain--;
                        0 === e.awaitDrain && l(a)
                    }
                }
                function l(a) {
                    function e(a, d, f) {
                        !1 === a.write(c) && b.awaitDrain++
                    }
                    var b = a._readableState,
                        c;
                    for (b.awaitDrain = 0; b.pipesCount && null !== (c = a.read());) if (1 === b.pipesCount ? e(b.pipes, 0, null) : r(b.pipes, e), a.emit("data", c), 0 < b.awaitDrain) return;
                    0 === b.pipesCount ? (b.flowing = !1, 0 < y.listenerCount(a, "data") && n(a)) : b.ranOut = !0
                }
                function m() {
                    this._readableState.ranOut && (this._readableState.ranOut = !1, l(this))
                }
                function n(a, e) {
                    if (a._readableState.flowing) throw Error("Cannot switch to old mode now.");
                    var b = e || !1,
                        c = !1;
                    a.readable = !0;
                    a.pipe = t.prototype.pipe;
                    a.on = a.addListener = t.prototype.on;
                    a.on("readable", function() {
                        c = !0;
                        for (var e; !b && null !== (e = a.read());) a.emit("data", e);
                        null === e && (c = !1, a._readableState.needReadable = !0)
                    });
                    a.pause = function() {
                        b = !0;
                        this.emit("pause")
                    };
                    a.resume = function() {
                        b = !1;
                        c ? h.nextTick(function() {
                            a.emit("readable")
                        }) : this.read(0);
                        this.emit("resume")
                    };
                    a.emit("readable")
                }
                function q(a, e) {
                    var b = e.buffer,
                        c = e.length,
                        d = !! e.decoder,
                        f = !! e.objectMode;
                    if (0 === b.length) return null;
                    if (0 === c) c = null;
                    else if (f) c = b.shift();
                    else if (!a || a >= c) c = d ? b.join("") : G.concat(b, c), b.length = 0;
                    else if (a <
                        b[0].length) f = b[0], c = f.slice(0, a), b[0] = f.slice(a);
                    else if (a === b[0].length) c = b.shift();
                    else for (var c = d ? "" : new G(a), l = 0, h = 0, r = b.length; h < r && l < a; h++) {
                            var f = b[0],
                                k = Math.min(a - l, f.length);
                            d ? c += f.slice(0, k) : f.copy(c, l, 0, k);
                            k < f.length ? b[0] = f.slice(k) : b.shift();
                            l += k
                    }
                    return c
                }
                function e(a) {
                    var e = a._readableState;
                    if (0 < e.length) throw Error("endReadable called on non-empty stream");
                    !e.endEmitted && e.calledRead && (e.ended = !0, h.nextTick(function() {
                        e.endEmitted || 0 !== e.length || (e.endEmitted = !0, a.readable = !1, a.emit("end"))
                    }))
                }

                function r(a, e) {
                    for (var b = 0, c = a.length; b < c; b++) e(a[b], b)
                }
                p.exports = k;
                var v = g("isarray"),
                    G = g("buffer").Buffer;
                k.ReadableState = s;
                var y = g("events").EventEmitter;
                y.listenerCount || (y.listenerCount = function(a, e) {
                    return a.listeners(e).length
                });
                var t = g("stream"),
                    K = g("core-util-is");
                K.inherits = g("inherits");
                var C;
                K.inherits(k, t);
                k.prototype.push = function(a, e) {
                    var b = this._readableState;
                    "string" !== typeof a || b.objectMode || (e = e || b.defaultEncoding, e !== b.encoding && (a = new G(a, e), e = ""));
                    return f(this, b, a, e, !1)
                };
                k.prototype.unshift = function(a) {
                    return f(this, this._readableState, a, "", !0)
                };
                k.prototype.setEncoding = function(a) {
                    C || (C = g("string_decoder/").StringDecoder);
                    this._readableState.decoder = new C(a);
                    this._readableState.encoding = a
                };
                k.prototype.read = function(b) {
                    var c = this._readableState;
                    c.calledRead = !0;
                    var f = b;
                    if ("number" !== typeof b || 0 < b) c.emittedReadable = !1;
                    if (0 === b && c.needReadable && (c.length >= c.highWaterMark || c.ended)) return a(this), null;
                    b = d(b, c);
                    if (0 === b && c.ended) return f = null, 0 < c.length && c.decoder && (f = q(b, c), c.length -= f.length),
                    0 === c.length && e(this), f;
                    var l = c.needReadable;
                    c.length - b <= c.highWaterMark && (l = !0);
                    if (c.ended || c.reading) l = !1;
                    l && (c.reading = !0, c.sync = !0, 0 === c.length && (c.needReadable = !0), this._read(c.highWaterMark), c.sync = !1);
                    l && !c.reading && (b = d(f, c));
                    f = 0 < b ? q(b, c) : null;
                    null === f && (c.needReadable = !0, b = 0);
                    c.length -= b;
                    0 !== c.length || c.ended || (c.needReadable = !0);
                    c.ended && !c.endEmitted && 0 === c.length && e(this);
                    return f
                };
                k.prototype._read = function(a) {
                    this.emit("error", Error("not implemented"))
                };
                k.prototype.pipe = function(a, e) {
                    function c(a) {
                        a ===
                            g && f()
                    }
                    function d() {
                        a.end()
                    }
                    function f() {
                        a.removeListener("close", k);
                        a.removeListener("finish", q);
                        a.removeListener("drain", t);
                        a.removeListener("error", r);
                        a.removeListener("unpipe", c);
                        g.removeListener("end", d);
                        g.removeListener("end", f);
                        a._writableState && !a._writableState.needDrain || t()
                    }
                    function r(e) {
                        g.unpipe(a);
                        a.removeListener("error", r);
                        0 === y.listenerCount(a, "error") && a.emit("error", e)
                    }
                    function k() {
                        a.removeListener("finish", q);
                        g.unpipe(a)
                    }
                    function q() {
                        a.removeListener("close", k);
                        g.unpipe(a)
                    }
                    var g =
                        this,
                        n = this._readableState;
                    switch (n.pipesCount) {
                        case 0:
                            n.pipes = a;
                            break;
                        case 1:
                            n.pipes = [n.pipes, a];
                            break;
                        default:
                            n.pipes.push(a)
                    }
                    n.pipesCount += 1;
                    var s = e && !1 === e.end || a === h.stdout || a === h.stderr ? f : d;
                    if (n.endEmitted) h.nextTick(s);
                    else g.once("end", s);
                    a.on("unpipe", c);
                    var t = b(g);
                    a.on("drain", t);
                    if (a._events && a._events.error) v(a._events.error) ? a._events.error.unshift(r) : a._events.error = [r, a._events.error];
                    else a.on("error", r);
                    a.once("close", k);
                    a.once("finish", q);
                    a.emit("pipe", g);
                    n.flowing || (this.on("readable",
                        m), n.flowing = !0, h.nextTick(function() {
                        l(g)
                    }));
                    return a
                };
                k.prototype.unpipe = function(a) {
                    var e = this._readableState;
                    if (0 === e.pipesCount) return this;
                    if (1 === e.pipesCount) {
                        if (a && a !== e.pipes) return this;
                        a || (a = e.pipes);
                        e.pipes = null;
                        e.pipesCount = 0;
                        this.removeListener("readable", m);
                        e.flowing = !1;
                        a && a.emit("unpipe", this);
                        return this
                    }
                    if (!a) {
                        a = e.pipes;
                        var b = e.pipesCount;
                        e.pipes = null;
                        e.pipesCount = 0;
                        this.removeListener("readable", m);
                        e.flowing = !1;
                        for (var c = 0; c < b; c++) a[c].emit("unpipe", this);
                        return this
                    }
                    a: {
                        for (var c =
                            e.pipes, b = 0, d = c.length; b < d; b++) if (c[b] === a) {
                                c = b;
                                break a
                            }
                        c = -1
                    }
                    if (-1 === c) return this;
                    e.pipes.splice(c, 1);
                    e.pipesCount -= 1;
                    1 === e.pipesCount && (e.pipes = e.pipes[0]);
                    a.emit("unpipe", this);
                    return this
                };
                k.prototype.on = function(e, b) {
                    var c = t.prototype.on.call(this, e, b);
                    "data" !== e || this._readableState.flowing || n(this);
                    if ("readable" === e && this.readable) {
                        var d = this._readableState;
                        d.readableListening || (d.readableListening = !0, d.emittedReadable = !1, d.needReadable = !0, d.reading ? d.length && a(this, d) : this.read(0))
                    }
                    return c
                };
                k.prototype.addListener = k.prototype.on;
                k.prototype.resume = function() {
                    n(this);
                    this.read(0);
                    this.emit("resume")
                };
                k.prototype.pause = function() {
                    n(this, !0);
                    this.emit("pause")
                };
                k.prototype.wrap = function(a) {
                    var e = this._readableState,
                        b = !1,
                        c = this;
                    a.on("end", function() {
                        if (e.decoder && !e.ended) {
                            var a = e.decoder.end();
                            a && a.length && c.push(a)
                        }
                        c.push(null)
                    });
                    a.on("data", function(d) {
                        e.decoder && (d = e.decoder.write(d));
                        e.objectMode && (null === d || void 0 === d) || !(e.objectMode || d && d.length) || c.push(d) || (b = !0, a.pause())
                    });
                    for (var d in a) "function" ===
                            typeof a[d] && "undefined" === typeof this[d] && (this[d] = function(e) {
                            return function() {
                                return a[e].apply(a, arguments)
                            }
                        }(d));
                    r(["error", "close", "destroy", "pause", "resume"], function(e) {
                        a.on(e, c.emit.bind(c, e))
                    });
                    c._read = function(e) {
                        b && (b = !1, a.resume())
                    };
                    return c
                };
                k._fromList = q
            }).call(this, g("_process"))
        }, {
            _process: 39,
            buffer: 3,
            "core-util-is": 46,
            events: 35,
            inherits: 36,
            isarray: 37,
            stream: 51,
            "string_decoder/": 52
        }
    ],
    44: [function(g, p, m) {
            function h(d, a) {
                this.afterTransform = function(c, b) {
                    var d;
                    d = a._transformState;
                    d.transforming = !1;
                    var f = d.writecb;
                    f ? (d.writechunk = null, d.writecb = null, null !== b && void 0 !== b && a.push(b), f && f(c), d = a._readableState, d.reading = !1, (d.needReadable || d.length < d.highWaterMark) && a._read(d.highWaterMark), d = void 0) : d = a.emit("error", Error("no writecb in Transform class"));
                    return d
                };
                this.transforming = this.needTransform = !1;
                this.writechunk = this.writecb = null
            }
            function s(d) {
                if (!(this instanceof s)) return new s(d);
                f.call(this, d);
                this._transformState = new h(d, this);
                var a = this;
                this._readableState.needReadable = !0;
                this._readableState.sync = !1;
                this.once("finish", function() {
                    "function" === typeof this._flush ? this._flush(function(c) {
                        k(a, c)
                    }) : k(a)
                })
            }
            function k(d, a) {
                if (a) return d.emit("error", a);
                var c = d._transformState;
                if (d._writableState.length) throw Error("calling transform done when ws.length != 0");
                if (c.transforming) throw Error("calling transform done when still transforming");
                return d.push(null)
            }
            p.exports = s;
            var f = g("./_stream_duplex");
            p = g("core-util-is");
            p.inherits = g("inherits");
            p.inherits(s, f);
            s.prototype.push = function(d, a) {
                this._transformState.needTransform = !1;
                return f.prototype.push.call(this, d, a)
            };
            s.prototype._transform = function(d, a, c) {
                throw Error("not implemented");
            };
            s.prototype._write = function(d, a, c) {
                var b = this._transformState;
                b.writecb = c;
                b.writechunk = d;
                b.writeencoding = a;
                b.transforming || (d = this._readableState, (b.needTransform || d.needReadable || d.length < d.highWaterMark) && this._read(d.highWaterMark))
            };
            s.prototype._read = function(d) {
                d = this._transformState;
                null !== d.writechunk && d.writecb && !d.transforming ?
                    (d.transforming = !0, this._transform(d.writechunk, d.writeencoding, d.afterTransform)) : d.needTransform = !0
            }
        }, {
            "./_stream_duplex": 41,
            "core-util-is": 46,
            inherits: 36
        }
    ],
    45: [function(g, p, m) {
            (function(h) {
                function s(a, e, b) {
                    this.chunk = a;
                    this.encoding = e;
                    this.callback = b
                }
                function k(a, e) {
                    a = a || {};
                    var b = a.highWaterMark;
                    this.highWaterMark = b || 0 === b ? b : 16384;
                    this.objectMode = !! a.objectMode;
                    this.highWaterMark = ~~this.highWaterMark;
                    this.finished = this.ended = this.ending = this.needDrain = !1;
                    this.decodeStrings = !1 !== a.decodeStrings;
                    this.defaultEncoding = a.defaultEncoding || "utf8";
                    this.length = 0;
                    this.writing = !1;
                    this.sync = !0;
                    this.bufferProcessing = !1;
                    this.onwrite = function(a) {
                        m(e, a)
                    };
                    this.writecb = null;
                    this.writelen = 0;
                    this.buffer = [];
                    this.errorEmitted = !1
                }
                function f(a) {
                    var e = g("./_stream_duplex");
                    if (!(this instanceof f || this instanceof e)) return new f(a);
                    this._writableState = new k(a, this);
                    this.writable = !0;
                    G.call(this)
                }
                function d(a, e, b) {
                    var c = Error("write after end");
                    a.emit("error", c);
                    h.nextTick(function() {
                        b(c)
                    })
                }
                function a(a, e, b, c) {
                    var d = !0;
                    if (!r.isBuffer(b) && "string" !== typeof b && null !== b && void 0 !== b && !e.objectMode) {
                        var f = new TypeError("Invalid non-string/buffer chunk");
                        a.emit("error", f);
                        h.nextTick(function() {
                            c(f)
                        });
                        d = !1
                    }
                    return d
                }
                function c(a, e, b, c, d) {
                    e.objectMode || !1 === e.decodeStrings || "string" !== typeof b || (b = new r(b, c));
                    r.isBuffer(b) && (c = "buffer");
                    var f = e.objectMode ? 1 : b.length;
                    e.length += f;
                    var h = e.length < e.highWaterMark;
                    h || (e.needDrain = !0);
                    e.writing ? e.buffer.push(new s(b, c, d)) : (e.writelen = f, e.writecb = d, e.writing = !0, e.sync = !0, a._write(b,
                        c, e.onwrite), e.sync = !1);
                    return h
                }
                function b(a, e, b, c, d) {
                    b ? h.nextTick(function() {
                        d(c)
                    }) : d(c);
                    a._writableState.errorEmitted = !0;
                    a.emit("error", c)
                }
                function l(a) {
                    a.writing = !1;
                    a.writecb = null;
                    a.length -= a.writelen;
                    a.writelen = 0
                }
                function m(a, e) {
                    var c = a._writableState,
                        d = c.sync,
                        f = c.writecb;
                    l(c);
                    if (e) b(a, c, d, e, f);
                    else {
                        var r = c.ending && 0 === c.length && !c.finished && !c.writing;
                        r || c.bufferProcessing || !c.buffer.length || q(a, c);
                        d ? h.nextTick(function() {
                            n(a, c, r, f)
                        }) : n(a, c, r, f)
                    }
                }
                function n(a, b, c, d) {
                    !c && 0 === b.length && b.needDrain &&
                        (b.needDrain = !1, a.emit("drain"));
                    d();
                    c && e(a, b)
                }
                function q(a, e) {
                    e.bufferProcessing = !0;
                    for (var b = 0; b < e.buffer.length; b++) {
                        var c = e.buffer[b],
                            d = c.chunk,
                            f = a,
                            r = e,
                            h = d,
                            l = c.encoding,
                            c = c.callback;
                        r.writelen = e.objectMode ? 1 : d.length;
                        r.writecb = c;
                        r.writing = !0;
                        r.sync = !0;
                        f._write(h, l, r.onwrite);
                        r.sync = !1;
                        if (e.writing) {
                            b++;
                            break
                        }
                    }
                    e.bufferProcessing = !1;
                    b < e.buffer.length ? e.buffer = e.buffer.slice(b) : e.buffer.length = 0
                }
                function e(a, e) {
                    var b = e.ending && 0 === e.length && !e.finished && !e.writing;
                    b && (e.finished = !0, a.emit("finish"));
                    return b
                }
                p.exports = f;
                var r = g("buffer").Buffer;
                f.WritableState = k;
                var v = g("core-util-is");
                v.inherits = g("inherits");
                var G = g("stream");
                v.inherits(f, G);
                f.prototype.pipe = function() {
                    this.emit("error", Error("Cannot pipe. Not readable."))
                };
                f.prototype.write = function(e, b, f) {
                    var h = this._writableState,
                        l = !1;
                    "function" === typeof b && (f = b, b = null);
                    r.isBuffer(e) ? b = "buffer" : b || (b = h.defaultEncoding);
                    "function" !== typeof f && (f = function() {});
                    h.ended ? d(this, h, f) : a(this, h, e, f) && (l = c(this, h, e, b, f));
                    return l
                };
                f.prototype._write = function(a, e, b) {
                    b(Error("not implemented"))
                };
                f.prototype.end = function(a, b, c) {
                    var d = this._writableState;
                    "function" === typeof a ? (c = a, b = a = null) : "function" === typeof b && (c = b, b = null);
                    "undefined" !== typeof a && null !== a && this.write(a, b);
                    if (!d.ending && !d.finished) {
                        a = c;
                        d.ending = !0;
                        e(this, d);
                        if (a) if (d.finished) h.nextTick(a);
                            else this.once("finish", a);
                        d.ended = !0
                    }
                }
            }).call(this, g("_process"))
        }, {
            "./_stream_duplex": 41,
            _process: 39,
            buffer: 3,
            "core-util-is": 46,
            inherits: 36,
            stream: 51
        }
    ],
    46: [function(g, p, m) {
            (function(h) {
                function g(h) {
                    return "object" ===
                        typeof h && null !== h
                }
                m.isArray = function(h) {
                    return Array.isArray(h)
                };
                m.isBoolean = function(h) {
                    return "boolean" === typeof h
                };
                m.isNull = function(h) {
                    return null === h
                };
                m.isNullOrUndefined = function(h) {
                    return null == h
                };
                m.isNumber = function(h) {
                    return "number" === typeof h
                };
                m.isString = function(h) {
                    return "string" === typeof h
                };
                m.isSymbol = function(h) {
                    return "symbol" === typeof h
                };
                m.isUndefined = function(h) {
                    return void 0 === h
                };
                m.isRegExp = function(h) {
                    return g(h) && "[object RegExp]" === Object.prototype.toString.call(h)
                };
                m.isObject =
                    g;
                m.isDate = function(h) {
                    return g(h) && "[object Date]" === Object.prototype.toString.call(h)
                };
                m.isError = function(h) {
                    return g(h) && ("[object Error]" === Object.prototype.toString.call(h) || h instanceof Error)
                };
                m.isFunction = function(h) {
                    return "function" === typeof h
                };
                m.isPrimitive = function(h) {
                    return null === h || "boolean" === typeof h || "number" === typeof h || "string" === typeof h || "symbol" === typeof h || "undefined" === typeof h
                };
                m.isBuffer = function(g) {
                    return h.isBuffer(g)
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    47: [function(g,
            p, m) {
            p.exports = g("./lib/_stream_passthrough.js")
        }, {
            "./lib/_stream_passthrough.js": 42
        }
    ],
    48: [function(g, p, m) {
            var h = g("stream");
            m = p.exports = g("./lib/_stream_readable.js");
            m.Stream = h;
            m.Readable = m;
            m.Writable = g("./lib/_stream_writable.js");
            m.Duplex = g("./lib/_stream_duplex.js");
            m.Transform = g("./lib/_stream_transform.js");
            m.PassThrough = g("./lib/_stream_passthrough.js")
        }, {
            "./lib/_stream_duplex.js": 41,
            "./lib/_stream_passthrough.js": 42,
            "./lib/_stream_readable.js": 43,
            "./lib/_stream_transform.js": 44,
            "./lib/_stream_writable.js": 45,
            stream: 51
        }
    ],
    49: [function(g, p, m) {
            p.exports = g("./lib/_stream_transform.js")
        }, {
            "./lib/_stream_transform.js": 44
        }
    ],
    50: [function(g, p, m) {
            p.exports = g("./lib/_stream_writable.js")
        }, {
            "./lib/_stream_writable.js": 45
        }
    ],
    51: [function(g, p, m) {
            function h() {
                s.call(this)
            }
            p.exports = h;
            var s = g("events").EventEmitter;
            g("inherits")(h, s);
            h.Readable = g("readable-stream/readable.js");
            h.Writable = g("readable-stream/writable.js");
            h.Duplex = g("readable-stream/duplex.js");
            h.Transform = g("readable-stream/transform.js");
            h.PassThrough =
                g("readable-stream/passthrough.js");
            h.Stream = h;
            h.prototype.pipe = function(h, f) {
                function d(a) {
                    h.writable && !1 === h.write(a) && n.pause && n.pause()
                }
                function a() {
                    n.readable && n.resume && n.resume()
                }
                function c() {
                    q || (q = !0, h.end())
                }
                function b() {
                    q || (q = !0, "function" === typeof h.destroy && h.destroy())
                }
                function l(a) {
                    g();
                    if (0 === s.listenerCount(this, "error")) throw a;
                }
                function g() {
                    n.removeListener("data", d);
                    h.removeListener("drain", a);
                    n.removeListener("end", c);
                    n.removeListener("close", b);
                    n.removeListener("error", l);
                    h.removeListener("error",
                        l);
                    n.removeListener("end", g);
                    n.removeListener("close", g);
                    h.removeListener("close", g)
                }
                var n = this;
                n.on("data", d);
                h.on("drain", a);
                h._isStdio || f && !1 === f.end || (n.on("end", c), n.on("close", b));
                var q = !1;
                n.on("error", l);
                h.on("error", l);
                n.on("end", g);
                n.on("close", g);
                h.on("close", g);
                h.emit("pipe", n);
                return h
            }
        }, {
            events: 35,
            inherits: 36,
            "readable-stream/duplex.js": 40,
            "readable-stream/passthrough.js": 47,
            "readable-stream/readable.js": 48,
            "readable-stream/transform.js": 49,
            "readable-stream/writable.js": 50
        }
    ],
    52: [function(g,
            p, m) {
            function h(a) {
                return a.toString(this.encoding)
            }
            function s(a) {
                this.charLength = (this.charReceived = a.length % 2) ? 2 : 0
            }
            function k(a) {
                this.charLength = (this.charReceived = a.length % 3) ? 3 : 0
            }
            var f = g("buffer").Buffer,
                d = f.isEncoding || function(a) {
                    switch (a && a.toLowerCase()) {
                        case "hex":
                        case "utf8":
                        case "utf-8":
                        case "ascii":
                        case "binary":
                        case "base64":
                        case "ucs2":
                        case "ucs-2":
                        case "utf16le":
                        case "utf-16le":
                        case "raw":
                            return !0;
                        default:
                            return !1
                    }
                };
            g = m.StringDecoder = function(a) {
                this.encoding = (a || "utf8").toLowerCase().replace(/[-_]/,
                    "");
                if (a && !d(a)) throw Error("Unknown encoding: " + a);
                switch (this.encoding) {
                    case "utf8":
                        this.surrogateSize = 3;
                        break;
                    case "ucs2":
                    case "utf16le":
                        this.surrogateSize = 2;
                        this.detectIncompleteChar = s;
                        break;
                    case "base64":
                        this.surrogateSize = 3;
                        this.detectIncompleteChar = k;
                        break;
                    default:
                        this.write = h;
                        return
                }
                this.charBuffer = new f(6);
                this.charLength = this.charReceived = 0
            };
            g.prototype.write = function(a) {
                for (var c = ""; this.charLength;) {
                    c = a.length >= this.charLength - this.charReceived ? this.charLength - this.charReceived : a.length;
                    a.copy(this.charBuffer, this.charReceived, 0, c);
                    this.charReceived += c;
                    if (this.charReceived < this.charLength) return "";
                    a = a.slice(c, a.length);
                    var c = this.charBuffer.slice(0, this.charLength).toString(this.encoding),
                        b = c.charCodeAt(c.length - 1);
                    if (55296 <= b && 56319 >= b) this.charLength += this.surrogateSize, c = "";
                    else {
                        this.charReceived = this.charLength = 0;
                        if (0 === a.length) return c;
                        break
                    }
                }
                this.detectIncompleteChar(a);
                var d = a.length;
                this.charLength && (a.copy(this.charBuffer, 0, a.length - this.charReceived, d), d -= this.charReceived);
                c += a.toString(this.encoding, 0, d);
                d = c.length - 1;
                b = c.charCodeAt(d);
                return 55296 <= b && 56319 >= b ? (b = this.surrogateSize, this.charLength += b, this.charReceived += b, this.charBuffer.copy(this.charBuffer, b, 0, b), a.copy(this.charBuffer, 0, 0, b), c.substring(0, d)) : c
            };
            g.prototype.detectIncompleteChar = function(a) {
                for (var c = 3 <= a.length ? 3 : a.length; 0 < c; c--) {
                    var b = a[a.length - c];
                    if (1 == c && 6 == b >> 5) {
                        this.charLength = 2;
                        break
                    }
                    if (2 >= c && 14 == b >> 4) {
                        this.charLength = 3;
                        break
                    }
                    if (3 >= c && 30 == b >> 3) {
                        this.charLength = 4;
                        break
                    }
                }
                this.charReceived =
                    c
            };
            g.prototype.end = function(a) {
                var c = "";
                a && a.length && (c = this.write(a));
                this.charReceived && (a = this.encoding, c += this.charBuffer.slice(0, this.charReceived).toString(a));
                return c
            }
        }, {
            buffer: 3
        }
    ],
    53: [function(g, p, m) {
            p.exports = function(h) {
                return h && "object" === typeof h && "function" === typeof h.copy && "function" === typeof h.fill && "function" === typeof h.readUInt8
            }
        }, {}
    ],
    54: [function(g, p, m) {
            (function(h, s) {
                function k(a, e) {
                    var b = {
                        seen: [],
                        stylize: d
                    };
                    3 <= arguments.length && (b.depth = arguments[2]);
                    4 <= arguments.length && (b.colors =
                        arguments[3]);
                    r(e) ? b.showHidden = e : e && m._extend(b, e);
                    y(b.showHidden) && (b.showHidden = !1);
                    y(b.depth) && (b.depth = 2);
                    y(b.colors) && (b.colors = !1);
                    y(b.customInspect) && (b.customInspect = !0);
                    b.colors && (b.stylize = f);
                    return c(b, a, b.depth)
                }
                function f(a, e) {
                    var b = k.styles[e];
                    return b ? "[" + k.colors[b][0] + "m" + a + "[" + k.colors[b][1] + "m" : a
                }
                function d(a, e) {
                    return a
                }
                function a(a) {
                    var e = {};
                    a.forEach(function(a, b) {
                        e[a] = !0
                    });
                    return e
                }
                function c(d, f, h) {
                    if (d.customInspect && f && A(f.inspect) && f.inspect !== m.inspect && (!f.constructor ||
                        f.constructor.prototype !== f)) {
                        var r = f.inspect(h, d);
                        G(r) || (r = c(d, r, h));
                        return r
                    }
                    if (r = b(d, f)) return r;
                    var g = Object.keys(f),
                        k = a(g);
                    d.showHidden && (g = Object.getOwnPropertyNames(f));
                    if (x(f) && (0 <= g.indexOf("message") || 0 <= g.indexOf("description"))) return l(f);
                    if (0 === g.length) {
                        if (A(f)) return d.stylize("[Function" + (f.name ? ": " + f.name : "") + "]", "special");
                        if (t(f)) return d.stylize(RegExp.prototype.toString.call(f), "regexp");
                        if (C(f)) return d.stylize(Date.prototype.toString.call(f), "date");
                        if (x(f)) return l(f)
                    }
                    var r =
                        "",
                        s = !1,
                        v = ["{", "}"];
                    e(f) && (s = !0, v = ["[", "]"]);
                    A(f) && (r = " [Function" + (f.name ? ": " + f.name : "") + "]");
                    t(f) && (r = " " + RegExp.prototype.toString.call(f));
                    C(f) && (r = " " + Date.prototype.toUTCString.call(f));
                    x(f) && (r = " " + l(f));
                    if (0 === g.length && (!s || 0 == f.length)) return v[0] + r + v[1];
                    if (0 > h) return t(f) ? d.stylize(RegExp.prototype.toString.call(f), "regexp") : d.stylize("[Object]", "special");
                    d.seen.push(f);
                    g = s ? p(d, f, h, k, g) : g.map(function(a) {
                        return n(d, f, h, k, a, s)
                    });
                    d.seen.pop();
                    return q(g, r, v)
                }
                function b(a, e) {
                    if (y(e)) return a.stylize("undefined",
                            "undefined");
                    if (G(e)) {
                        var b = "'" + JSON.stringify(e).replace(/^"|"$/g, "").replace(/'/g, "\\'").replace(/\\"/g, '"') + "'";
                        return a.stylize(b, "string")
                    }
                    if (v(e)) return a.stylize("" + e, "number");
                    if (r(e)) return a.stylize("" + e, "boolean");
                    if (null === e) return a.stylize("null", "null")
                }
                function l(a) {
                    return "[" + Error.prototype.toString.call(a) + "]"
                }
                function p(a, e, b, c, d) {
                    for (var f = [], h = 0, r = e.length; h < r; ++h) Object.prototype.hasOwnProperty.call(e, String(h)) ? f.push(n(a, e, b, c, String(h), !0)) : f.push("");
                    d.forEach(function(d) {
                        d.match(/^\d+$/) ||
                            f.push(n(a, e, b, c, d, !0))
                    });
                    return f
                }
                function n(a, e, b, d, f, h) {
                    var r, l;
                    e = Object.getOwnPropertyDescriptor(e, f) || {
                        value: e[f]
                    };
                    e.get ? l = e.set ? a.stylize("[Getter/Setter]", "special") : a.stylize("[Getter]", "special") : e.set && (l = a.stylize("[Setter]", "special"));
                    Object.prototype.hasOwnProperty.call(d, f) || (r = "[" + f + "]");
                    l || (0 > a.seen.indexOf(e.value) ? (l = null === b ? c(a, e.value, null) : c(a, e.value, b - 1), -1 < l.indexOf("\n") && (l = h ? l.split("\n").map(function(a) {
                        return "  " + a
                    }).join("\n").substr(2) : "\n" + l.split("\n").map(function(a) {
                        return "   " +
                            a
                    }).join("\n"))) : l = a.stylize("[Circular]", "special"));
                    if (y(r)) {
                        if (h && f.match(/^\d+$/)) return l;
                        r = JSON.stringify("" + f);
                        r.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/) ? (r = r.substr(1, r.length - 2), r = a.stylize(r, "name")) : (r = r.replace(/'/g, "\\'").replace(/\\"/g, '"').replace(/(^"|"$)/g, "'"), r = a.stylize(r, "string"))
                    }
                    return r + ": " + l
                }
                function q(a, e, b) {
                    var c = 0;
                    return 60 < a.reduce(function(a, e) {
                        c++;
                        0 <= e.indexOf("\n") && c++;
                        return a + e.replace(/\u001b\[\d\d?m/g, "").length + 1
                    }, 0) ? b[0] + ("" === e ? "" : e + "\n ") + " " + a.join(",\n  ") +
                        " " + b[1] : b[0] + e + " " + a.join(", ") + " " + b[1]
                }
                function e(a) {
                    return Array.isArray(a)
                }
                function r(a) {
                    return "boolean" === typeof a
                }
                function v(a) {
                    return "number" === typeof a
                }
                function G(a) {
                    return "string" === typeof a
                }
                function y(a) {
                    return void 0 === a
                }
                function t(a) {
                    return K(a) && "[object RegExp]" === Object.prototype.toString.call(a)
                }
                function K(a) {
                    return "object" === typeof a && null !== a
                }
                function C(a) {
                    return K(a) && "[object Date]" === Object.prototype.toString.call(a)
                }
                function x(a) {
                    return K(a) && ("[object Error]" === Object.prototype.toString.call(a) ||
                        a instanceof Error)
                }
                function A(a) {
                    return "function" === typeof a
                }
                function D(a) {
                    return 10 > a ? "0" + a.toString(10) : a.toString(10)
                }
                function E() {
                    var a = new Date,
                        e = [D(a.getHours()), D(a.getMinutes()), D(a.getSeconds())].join(":");
                    return [a.getDate(), I[a.getMonth()], e].join(" ")
                }
                var H = /%[sdj%]/g;
                m.format = function(a) {
                    if (!G(a)) {
                        for (var e = [], b = 0; b < arguments.length; b++) e.push(k(arguments[b]));
                        return e.join(" ")
                    }
                    for (var b = 1, c = arguments, d = c.length, e = String(a).replace(H, function(a) {
                            if ("%%" === a) return "%";
                            if (b >= d) return a;
                            switch (a) {
                                case "%s":
                                    return String(c[b++]);
                                case "%d":
                                    return Number(c[b++]);
                                case "%j":
                                    try {
                                        return JSON.stringify(c[b++])
                                    } catch (e) {
                                        return "[Circular]"
                                    }
                                default:
                                    return a
                            }
                        }), f = c[b]; b < d; f = c[++b]) e = null !== f && K(f) ? e + (" " + k(f)) : e + (" " + f);
                    return e
                };
                m.deprecate = function(a, e) {
                    if (y(s.process)) return function() {
                            return m.deprecate(a, e).apply(this, arguments)
                    };
                    if (!0 === h.noDeprecation) return a;
                    var b = !1;
                    return function() {
                        if (!b) {
                            if (h.throwDeprecation) throw Error(e);
                            h.traceDeprecation ? console.trace(e) : console.error(e);
                            b = !0
                        }
                        return a.apply(this, arguments)
                    }
                };
                var w = {}, z;
                m.debuglog = function(a) {
                    y(z) && (z = h.env.NODE_DEBUG || "");
                    a = a.toUpperCase();
                    if (!w[a]) if ((new RegExp("\\b" + a + "\\b", "i")).test(z)) {
                            var e = h.pid;
                            w[a] = function() {
                                var b = m.format.apply(m, arguments);
                                console.error("%s %d: %s", a, e, b)
                            }
                        } else w[a] = function() {};
                    return w[a]
                };
                m.inspect = k;
                k.colors = {
                    bold: [1, 22],
                    italic: [3, 23],
                    underline: [4, 24],
                    inverse: [7, 27],
                    white: [37, 39],
                    grey: [90, 39],
                    black: [30, 39],
                    blue: [34, 39],
                    cyan: [36, 39],
                    green: [32, 39],
                    magenta: [35, 39],
                    red: [31, 39],
                    yellow: [33,
                            39
                    ]
                };
                k.styles = {
                    special: "cyan",
                    number: "yellow",
                    "boolean": "yellow",
                    undefined: "grey",
                    "null": "bold",
                    string: "green",
                    date: "magenta",
                    regexp: "red"
                };
                m.isArray = e;
                m.isBoolean = r;
                m.isNull = function(a) {
                    return null === a
                };
                m.isNullOrUndefined = function(a) {
                    return null == a
                };
                m.isNumber = v;
                m.isString = G;
                m.isSymbol = function(a) {
                    return "symbol" === typeof a
                };
                m.isUndefined = y;
                m.isRegExp = t;
                m.isObject = K;
                m.isDate = C;
                m.isError = x;
                m.isFunction = A;
                m.isPrimitive = function(a) {
                    return null === a || "boolean" === typeof a || "number" === typeof a || "string" ===
                        typeof a || "symbol" === typeof a || "undefined" === typeof a
                };
                m.isBuffer = g("./support/isBuffer");
                var I = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
                m.log = function() {
                    console.log("%s - %s", E(), m.format.apply(m, arguments))
                };
                m.inherits = g("inherits");
                m._extend = function(a, e) {
                    if (!e || !K(e)) return a;
                    for (var b = Object.keys(e), c = b.length; c--;) a[b[c]] = e[b[c]];
                    return a
                }
            }).call(this, g("_process"), "undefined" !== typeof global ? global : "undefined" !== typeof self ? self : "undefined" !== typeof window ? window : {})
        }, {
            "./support/isBuffer": 53,
            _process: 39,
            inherits: 36
        }
    ],
    55: [function(g, p, m) {
            p.exports.strtotime = function(h, g) {
                var k, f, d, a = "";
                f = "";
                a = h.replace(/\s{2,}|^\s|\s$/g, " ");
                a = a.replace(/[    \r\n]/g, "");
                if ("now" == a) return (new Date).getTime() / 1E3;
                if (isNaN(f = Date.parse(a))) g = g ? new Date(1E3 * g) : new Date;
                else return f / 1E3;
                a = a.toLowerCase();
                d = {
                    sun: 0,
                    mon: 1,
                    tue: 2,
                    wed: 3,
                    thu: 4,
                    fri: 5,
                    sat: 6
                };
                var c = {
                    jan: 0,
                    feb: 1,
                    mar: 2,
                    apr: 3,
                    may: 4,
                    jun: 5,
                    jul: 6,
                    aug: 7,
                    sep: 8,
                    oct: 9,
                    nov: 10,
                    dec: 11
                };
                if (f = a.match(/^(\d{2,4}-\d{2}-\d{2})(?:\s(\d{1,2}:\d{2}(:\d{2})?)?(?:\.(\d+))?)?$/)) {
                    f[2] ?
                        f[3] || (f[2] += ":00") : f[2] = "00:00:00";
                    d = f[1].split(/-/g);
                    for (k in c) c[k] == d[1] - 1 && (d[1] = k);
                    d[0] = parseInt(d[0], 10);
                    d[0] = 0 <= d[0] && 69 >= d[0] ? "20" + (10 > d[0] ? "0" + d[0] : d[0] + "") : 70 <= d[0] && 99 >= d[0] ? "19" + d[0] : d[0] + "";
                    return parseInt(this.strtotime(d[2] + " " + d[1] + " " + d[0] + " " + f[2]) + (f[4] ? f[4] / 1E3 : ""), 10)
                }
                f = a.match(/([+-]?\d+\s(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?|sun\.?|sunday|mon\.?|monday|tue\.?|tuesday|wed\.?|wednesday|thu\.?|thursday|fri\.?|friday|sat\.?|saturday)|(last|next)\s(years?|months?|weeks?|days?|hours?|min|minutes?|sec|seconds?|sun\.?|sunday|mon\.?|monday|tue\.?|tuesday|wed\.?|wednesday|thu\.?|thursday|fri\.?|friday|sat\.?|saturday))(\sago)?/gi);
                if (!f) return !1;
                for (k = 0; k < f.length; k++) {
                    a: {
                        var a = f[k].split(" "),
                            b = a[2] && "ago" == a[2],
                            c = (c = "last" == a[0] ? -1 : 1) * (b ? -1 : 1);
                        switch (a[0]) {
                            case "last":
                            case "next":
                                switch (a[1].substring(0, 3)) {
                                    case "yea":
                                        g.setFullYear(g.getFullYear() + c);
                                        break;
                                    case "mon":
                                        g.setMonth(g.getMonth() + c);
                                        break;
                                    case "wee":
                                        g.setDate(g.getDate() + 7 * c);
                                        break;
                                    case "day":
                                        g.setDate(g.getDate() + c);
                                        break;
                                    case "hou":
                                        g.setHours(g.getHours() + c);
                                        break;
                                    case "min":
                                        g.setMinutes(g.getMinutes() + c);
                                        break;
                                    case "sec":
                                        g.setSeconds(g.getSeconds() + c);
                                        break;
                                    default:
                                        b = void 0, "undefined" != typeof(b = d[a[1].substring(0, 3)]) && (b -= g.getDay(), 0 === b ? b = 7 * c : 0 < b ? "last" == a[0] && (b -= 7) : "next" == a[0] && (b += 7), g.setDate(g.getDate() + b))
                                }
                                break;
                            default:
                                if (/\d+/.test(a[0])) switch (c *= parseInt(a[0], 10), a[1].substring(0, 3)) {
                                        case "yea":
                                            g.setFullYear(g.getFullYear() + c);
                                            break;
                                        case "mon":
                                            g.setMonth(g.getMonth() + c);
                                            break;
                                        case "wee":
                                            g.setDate(g.getDate() + 7 * c);
                                            break;
                                        case "day":
                                            g.setDate(g.getDate() + c);
                                            break;
                                        case "hou":
                                            g.setHours(g.getHours() + c);
                                            break;
                                        case "min":
                                            g.setMinutes(g.getMinutes() +
                                                c);
                                            break;
                                        case "sec":
                                            g.setSeconds(g.getSeconds() + c)
                                } else {
                                    a = !1;
                                    break a
                                }
                        }
                        a = !0
                    }
                    if (!a) return !1
                }
                return g.getTime() / 1E3
            }
        }, {}
    ],
    56: [function(g, p, m) {
            (function(h, m) {
                function k(a) {
                    f.call(this);
                    this.writable = !0;
                    this.options = a || {
                        changed:'by warlee',
                        defaultCharset:'UTF-8',
                        debug:false
                    };
                    this._state = q.header;
                    this._remainder = "";
                    this._currentNode = this.mimeTree = this._createMimeNode();
                    this._currentNode.priority = "normal";
                    this._fileNames = {};
                    this._multipartTree = [];
                    this.mailData = {};
                    this._lineCounter = 0;
                    this._headersSent = this._lineFeed = !1;
                    this._isMbox = -1
                }
                var f = g("stream").Stream,
                    d = g("util"),
                    a = g("mimelib"),
                    c = g("./datetime"),
                    b = g("encoding"),
                    l = g("./streams"),
                    u = g("crypto"),
                    n = g("mime");
                p.exports.MailParser = k;
                var q = {
                    header: 1,
                    body: 2,
                    finished: 3
                };
                d.inherits(k, f);
                k.prototype.write = function(a, b) {
                    this._write(a, b) && ("function" == typeof setImmediate ? setImmediate(this._process.bind(this)) : h.nextTick(this._process.bind(this)));
                    return !0
                };
                k.prototype.end = function(a, b) {
                    this._write(a, b);
                    this.options.debug && this._remainder && console.log("REMAINDER: " + this._remainder);
                    "function" == typeof setImmediate ?
                        setImmediate(this._process.bind(this, !0)) : h.nextTick(this._process.bind(this, !0))
                };
                k.prototype._write = function(a, b) {
                    "string" == typeof a && (a = new m(a, b));
                    a = a && a.toString("binary") || "";
                    this._lineFeed && "\n" === a.charAt(0) && (a = a.substr(1));
                    this._lineFeed = "\r" === a.substr(-1);
                    return a && a.length ? (this._remainder += a, !0) : !1
                };
                k.prototype._process = function(a) {
                    a = !! a;
                    var b = this._remainder.split(/\r?\n|\r/),
                        c, d, f;
                    a || (this._remainder = b.pop(), 1048576 < this._remainder.length && (this._remainder = this._remainder.replace(/(.{1048576}(?!\r?\n|\r))/g,
                        "$&\n")));
                    d = 0;
                    for (f = b.length; d < f; d++) {
                        c = b[d];
                        this.options.unescapeSMTP && ".." == c.substr(0, 2) && (c = c.substr(1));
                        !0 === this._isMbox && c.match(/^\>+From /) && (c = c.substr(1));
                        this.options.debug && console.log("LINE " + ++this._lineCounter + " (" + this._state + "): " + c);
                        if (150 < this._currentNode.headers.length) {
                            g_iserror = !0;
                            break
                        }
                        this._state == q.header && !0 === this._processStateHeader(c) || this._state != q.body || this._processStateBody(c)
                    }
                    a && (this._state == q.header && this._remainder && (this._processStateHeader(this._remainder),
                        this._headersSent || (this.emit("headers", this._currentNode.parsedHeaders), this._headersSent = !0)), (this._currentNode.content || this._currentNode.stream) && this._finalizeContents(), this._state = q.finished, "function" == typeof setImmediate ? setImmediate(this._processMimeTree.bind(this)) : h.nextTick(this._processMimeTree.bind(this)))
                };
                k.prototype._processStateHeader = function(a) {
                    var b = this._currentNode.headers.length - 1,
                        c = !1;
                    if (!a.length) return 0 <= b && this._processHeaderLine(b), this._headersSent || (this.emit("headers",
                            this._currentNode.parsedHeaders), this._headersSent = !0), this._state = q.body, 0 <= b && this._processHeaderLine(b), this._currentNode.parentNode || this._currentNode.meta.contentType || (this._currentNode.meta.contentType = "text/plain"), !(c = 0 <= ["text/plain", "text/html", "text/calendar"].indexOf(this._currentNode.meta.contentType || "")) || this._currentNode.meta.contentDisposition && "inline" != this._currentNode.meta.contentDisposition ? c && !(0 <= ["attachment", "inline"].indexOf(this._currentNode.meta.contentDisposition)) ||
                            this._currentNode.meta.mimeMultipart || (this._currentNode.attachment = !0) : this._currentNode.attachment = !1, this._currentNode.attachment && (this._currentNode.meta.generatedFileName = this._generateFileName(this._currentNode.meta.fileName, this._currentNode.meta.contentType), this._currentNode.meta.contentId = this._currentNode.meta.contentId || u.createHash("md5").update(this._currentNode.meta.generatedFileName).digest("hex") + "@mailparser", a = this._currentNode.meta.generatedFileName.split(".").pop().toLowerCase(),
                            "application/octet-stream" == this._currentNode.meta.contentType && n.lookup(a) && (this._currentNode.meta.contentType = n.lookup(a)), a = this._currentNode.meta, this.options.streamAttachments ? (this._currentNode.stream = "base64" == this._currentNode.meta.transferEncoding ? new l.Base64Stream : "quoted-printable" == this._currentNode.meta.transferEncoding ? new l.QPStream("binary") : "uuencode" == this._currentNode.meta.transferEncoding ? new l.UUEStream("binary") : new l.BinaryStream, a.stream = this._currentNode.stream, this.emit("attachment",
                            a)) : this._currentNode.content = void 0), !0;
                    a.match(/^\s+/) && 0 <= b ? this._currentNode.headers[b] += " " + a.trim() : (this._currentNode.headers.push(a.trim()), 0 <= b && this._processHeaderLine(b));
                    return !1
                };
                k.prototype._processStateBody = function(a) {
                    var b, c, d = !1;
                    if ("--" == a.substr(0, 2)) for (b = 0, c = this._multipartTree.length; b < c; b++) if (a == "--" + this._multipartTree[b].boundary) {
                                (this._currentNode.content || this._currentNode.stream) && this._finalizeContents();
                                c = this._createMimeNode(this._multipartTree[b].node);
                                this._multipartTree[b].node.childNodes.push(c);
                                this._currentNode = c;
                                this._state = q.header;
                                d = !0;
                                break
                            } else if (a == "--" + this._multipartTree[b].boundary + "--") {
                        (this._currentNode.content || this._currentNode.stream) && this._finalizeContents();
                        this._currentNode = this._multipartTree[b].node.parentNode ? this._multipartTree[b].node.parentNode : this._multipartTree[b].node;
                        this._state = q.body;
                        d = !0;
                        break
                    }
                    if (d) return !0;
                    0 <= ["text/plain", "text/html", "text/calendar"].indexOf(this._currentNode.meta.contentType || "") && !this._currentNode.attachment ? this._handleTextLine(a) :
                        this._currentNode.attachment && this._handleAttachmentLine(a);
                    return !1
                };
                k.prototype._processHeaderLine = function(e) {
                    var b, d;
                    e = e || 0;
                    if ((b = this._currentNode.headers[e]) && "string" == typeof b && !(!this._headersSent && 0 > this._isMbox && (this._isMbox = !! b.match(/^From /)))) {
                        d = b.split(":");
                        b = d.shift().toLowerCase().trim();
                        d = d.join(":").trim();
                        switch (b) {
                            case "content-type":
                                this._parseContentType(d);
                                break;
                            case "mime-version":
                                this._currentNode.useMIME = !0;
                                break;
                            case "date":
                                this._currentNode.meta.date = new Date(d);
                                if ("[object Date]" !=
                                    Object.prototype.toString.call(this._currentNode.meta.date) || "Invalid Date" == this._currentNode.meta.date.toString()) this._currentNode.meta.date = c.strtotime(d) && new Date(1E3 * c.strtotime(d));
                                break;
                            case "to":
                                this._currentNode.to = this._currentNode.to && this._currentNode.to.length ? this._currentNode.to.concat(a.parseAddresses(d)) : a.parseAddresses(d);
                                break;
                            case "from":
                                this._currentNode.from = this._currentNode.from && this._currentNode.from.length ? this._currentNode.from.concat(a.parseAddresses(d)) : a.parseAddresses(d);
                                break;
                            case "reply-to":
                                this._currentNode.replyTo = this._currentNode.replyTo && this._currentNode.replyTo.length ? this._currentNode.replyTo.concat(a.parseAddresses(d)) : a.parseAddresses(d);
                                break;
                            case "cc":
                                this._currentNode.cc = this._currentNode.cc && this._currentNode.cc.length ? this._currentNode.cc.concat(a.parseAddresses(d)) : a.parseAddresses(d);
                                break;
                            case "bcc":
                                this._currentNode.bcc = this._currentNode.bcc && this._currentNode.bcc.length ? this._currentNode.bcc.concat(a.parseAddresses(d)) : a.parseAddresses(d);
                                break;
                            case "x-priority":
                            case "x-msmail-priority":
                            case "importance":
                                d = this._parsePriority(d);
                                this._currentNode.priority = d;
                                break;
                            case "message-id":
                                this._currentNode.meta.messageId = this._trimQuotes(d);
                                this._currentNode.messageId = this._currentNode.meta.messageId;
                                break;
                            case "references":
                                this._parseReferences(d);
                                break;
                            case "in-reply-to":
                                this._parseInReplyTo(d);
                                break;
                            case "thread-index":
                                this._currentNode.meta.threadIndex = d;
                                break;
                            case "content-transfer-encoding":
                                this._currentNode.meta.transferEncoding = d.toLowerCase();
                                break;
                            case "subject":
                                this._currentNode.subject = this._encodeString(d);
                                break;
                            case "content-disposition":
                                this._parseContentDisposition(d);
                                break;
                            case "content-id":
                                this._currentNode.meta.contentId = this._trimQuotes(d);
                                break;
                            case "content-location":
                                this._currentNode.meta.contentId = d
                        }
                        this._currentNode.parsedHeaders[b] ? (Array.isArray(this._currentNode.parsedHeaders[b]) || (this._currentNode.parsedHeaders[b] = [this._currentNode.parsedHeaders[b]]), this._currentNode.parsedHeaders[b].push(this._replaceMimeWords(d))) :
                            this._currentNode.parsedHeaders[b] = this._replaceMimeWords(d);
                        this._currentNode.headers[e] = {
                            key: b,
                            value: d
                        }
                    }
                };
                k.prototype._createMimeNode = function(a) {
                    return {
                        parentNode: a || this._currentNode || null,
                        headers: [],
                        parsedHeaders: {},
                        meta: {},
                        childNodes: []
                    }
                };
                k.prototype._parseHeaderLineWithParams = function(a) {
                    var b, c, d = {};
                    c = a.match(/(?:[^;"]+|"[^"]*")+/g) || \u00c2[a];
                    d.defaultValue = c.shift().toLowerCase();
                    for (var f = 0, h = c.length; f < h; f++) a = c[f].split("="), b = a.shift().trim().toLowerCase(), a = a.join("=").trim(), a = this._trimQuotes(a),
                    d[b] = a;
                    return d
                };
                k.prototype._parseContentType = function(a) {
                    var b;
                    if (a = this._parseHeaderLineWithParams(a)) a.defaultValue ? (a.defaultValue = a.defaultValue.toLowerCase(), this._currentNode.meta.contentType = a.defaultValue, "multipart/" == a.defaultValue.substr(0, 10) && (this._currentNode.meta.mimeMultipart = a.defaultValue.substr(10))) : this._currentNode.meta.contentType = "application/octet-stream", a.charset && (a.charset = a.charset.toLowerCase(), "win-" == a.charset.substr(0, 4) ? a.charset = "windows-" + a.charset.substr(4) :
                            "ks_c_5601-1987" == a.charset ? a.charset = "cp949" : a.charset.match(/^utf\d/) ? a.charset = "utf-" + a.charset.substr(3) : a.charset.match(/^latin[\-_]?\d/) ? a.charset = "iso-8859-" + a.charset.replace(/\D/g, "") : a.charset.match(/^(us\-)?ascii$/) && (a.charset = "utf-8"), this._currentNode.meta.charset = a.charset), a.format && (this._currentNode.meta.textFormat = a.format.toLowerCase()), a.delsp && (this._currentNode.meta.textDelSp = a.delsp.toLowerCase()), a.boundary && (this._currentNode.meta.mimeBoundary = a.boundary), a.method && (this._currentNode.meta.method =
                            a.method), !this._currentNode.meta.fileName && (b = this._detectFilename(a)) && (this._currentNode.meta.fileName = b), a.boundary && (this._currentNode.meta.mimeBoundary = a.boundary, this._multipartTree.push({
                            boundary: a.boundary,
                            node: this._currentNode
                        }));
                    return a
                };
                k.prototype._detectFilename = function(a) {
                    var b = "",
                        c = 0;
                    if (a.name) return this._replaceMimeWords(a.name);
                    if (a.filename) return this._replaceMimeWords(a.filename);
                    if (a["name*"]) b = a["name*"];
                    else if (a["filename*"]) b = a["filename*"];
                    else if (a["name*0*"]) for (; a["name*" +
                            c + "*"];) b += a["name*" + c+++"*"];
                    else if (a["filename*0*"]) for (; a["filename*" + c + "*"];) b += a["filename*" + c+++"*"];
                    return b && (b = b.split("'"), a = b.shift(), b = b.pop()) ? this._replaceMimeWords(this._replaceMimeWords("=?" + (a || "us-ascii") + "?Q?" + b.replace(/%/g, "=") + "?=")) : ""
                };
                k.prototype._parseContentDisposition = function(a) {
                    if (a = this._parseHeaderLineWithParams(a)) if (a.defaultValue && (this._currentNode.meta.contentDisposition = a.defaultValue.trim().toLowerCase()), a = this._detectFilename(a)) this._currentNode.meta.fileName =
                                a
                };
                k.prototype._parseReferences = function(a) {
                    this._currentNode.references = (this._currentNode.references || []).concat((a || "").toString().trim().split(/\s+/).map(this._trimQuotes.bind(this)))
                };
                k.prototype._parseInReplyTo = function(a) {
                    this._currentNode.inReplyTo = (this._currentNode.inReplyTo || []).concat((a || "").toString().trim().split(/\s+/).map(this._trimQuotes.bind(this)))
                };
                k.prototype._parsePriority = function(a) {
                    a = a.toLowerCase().trim();
                    if (isNaN(parseInt(a, 10))) switch (a) {
                            case "non-urgent":
                            case "low":
                                return "low";
                            case "urgent":
                            case "hight":
                                return "high"
                    } else if (a = parseInt(a, 10) || 0, 3 != a) return 3 < a ? "low" : "high";
                    return "normal"
                };
                k.prototype._handleTextLine = function(a) {
                    0 <= ["quoted-printable", "base64"].indexOf(this._currentNode.meta.transferEncoding) || "flowed" != this._currentNode.meta.textFormat ? this._currentNode.content = "string" != typeof this._currentNode.content ? a : this._currentNode.content + ("\n" + a) : "string" != typeof this._currentNode.content ? this._currentNode.content = a : this._currentNode.content.match(/[ ]$/) ? "flowed" ==
                        this._currentNode.meta.textFormat && this._currentNode.content.match(/(^|\n)-- $/) ? this._currentNode.content += "\n" + a : ("yes" == this._currentNode.meta.textDelSp && (this._currentNode.content = this._currentNode.content.replace(/[ ]+$/, "")), this._currentNode.content += a) : this._currentNode.content += "\n" + a
                };
                k.prototype._handleAttachmentLine = function(a) {
                    this._currentNode.attachment && (this._currentNode.stream ? this._currentNode.streamStarted ? this._currentNode.stream.write(new m("\r\n" + a, "binary")) : (this._currentNode.streamStarted = !0, this._currentNode.stream.write(new m(a, "binary"))) : "content" in this._currentNode && (this._currentNode.content = "string" != typeof this._currentNode.content ? a : this._currentNode.content + ("\r\n" + a)))
                };
                k.prototype._finalizeContents = function() {
                    var e;
                    this._currentNode.content && (this._currentNode.attachment ? ("quoted-printable" == this._currentNode.meta.transferEncoding ? "text/css" == this._currentNode.meta.contentType && (this._currentNode.content = a.decodeQuotedPrintable(this._currentNode.content, !1, this._currentNode.meta.charset ||
                        this.options.defaultCharset || "iso-8859-1")) : "base64" != this._currentNode.meta.transferEncoding && ("uuencode" == this._currentNode.meta.transferEncoding ? (e = new l.UUEStream("binary"), this._currentNode.content = e.decode(new m(this._currentNode.content, "binary"))) : this._currentNode.content = new m(this._currentNode.content, "binary")), this._currentNode.checksum = u.createHash("md5"), this._currentNode.checksum.update(this._currentNode.content), this._currentNode.meta.checksum = this._currentNode.checksum.digest("hex"),
                        this._currentNode.meta.length = this._currentNode.content.length) : ("text/html" == this._currentNode.meta.contentType && (this._currentNode.meta.charset = this._detectHTMLCharset(this._currentNode.content) || this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1"), "quoted-printable" == this._currentNode.meta.transferEncoding ? (this._currentNode.content = a.decodeQuotedPrintable(this._currentNode.content, !1, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1"), "flowed" == this._currentNode.meta.textFormat &&
                        (this._currentNode.content = "yes" == this._currentNode.meta.textDelSp ? this._currentNode.content.replace(/(^|\n)-- \n/g, "$1-- \x00").replace(/ \n/g, "").replace(/(^|\n)-- \u0000/g, "$1-- \n") : this._currentNode.content.replace(/(^|\n)-- \n/g, "$1-- \x00").replace(/ \n/g, " ").replace(/(^|\n)-- \u0000/g, "$1-- \n"))) : this._currentNode.content = "base64" == this._currentNode.meta.transferEncoding ? a.decodeBase64(this._currentNode.content, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1") : this._convertStringToUTF8(this._currentNode.content)));
                    this._currentNode.stream && (e = this._currentNode.stream.end() || {}, e.checksum && (this._currentNode.meta.checksum = e.checksum), e.length && (this._currentNode.meta.length = e.length))
                };
                k.prototype._processMimeTree = function() {
                    var a = {}, b, c;
                    this.mailData = {
                        html: [],
                        text: [],
                        calendar: [],
                        attachments: []
                    };
                    this.mimeTree.meta.mimeMultipart ? this._walkMimeTree(this.mimeTree) : this._processMimeNode(this.mimeTree, 0);
                    if (this.mailData.html.length) for (b = 0, c = this.mailData.html.length; b < c; b++)!a.html && this.mailData.html[b].content ?
                            a.html = this.mailData.html[b].content : this.mailData.html[b].content && (a.html = this._concatHTML(a.html, this.mailData.html[b].content));
                    if (this.mailData.text.length) for (b = 0, c = this.mailData.text.length; b < c; b++)!a.text && this.mailData.text[b].content ? a.text = this.mailData.text[b].content : this.mailData.text[b].content && (a.text += this.mailData.text[b].content);
                    if (this.mailData.calendar.length) for (a.alternatives = [], b = 0, c = this.mailData.calendar.length; b < c; b++) a.alternatives.push(this.mailData.calendar[b].content);
                    a.headers = this.mimeTree.parsedHeaders;
                    this.mimeTree.subject && (a.subject = this.mimeTree.subject);
                    this.mimeTree.references && (a.references = this.mimeTree.references);
                    this.mimeTree.messageId && (a.messageId = this.mimeTree.messageId);
                    this.mimeTree.inReplyTo && (a.inReplyTo = this.mimeTree.inReplyTo);
                    this.mimeTree.priority && (a.priority = this.mimeTree.priority);
                    this.mimeTree.from && (a.from = this.mimeTree.from);
                    this.mimeTree.replyTo && (a.replyTo = this.mimeTree.replyTo);
                    this.mimeTree.to && (a.to = this.mimeTree.to);
                    this.mimeTree.cc &&
                        (a.cc = this.mimeTree.cc);
                    this.mimeTree.bcc && (a.bcc = this.mimeTree.bcc);
                    this.mimeTree.meta.date && (a.date = this.mimeTree.meta.date);
                    if (this.mailData.attachments.length) for (a.attachments = [], b = 0, c = this.mailData.attachments.length; b < c; b++) a.attachments.push(this.mailData.attachments[b].content);
                    "function" == typeof setImmediate ? setImmediate(this.emit.bind(this, "end", a)) : h.nextTick(this.emit.bind(this, "end", a))
                };
                k.prototype._walkMimeTree = function(a, b) {
                    b = b || 1;
                    for (var c = 0, d = a.childNodes.length; c < d; c++) this._processMimeNode(a.childNodes[c],
                            b, a.meta.mimeMultipart), this._walkMimeTree(a.childNodes[c], b + 1)
                };
                k.prototype._processMimeNode = function(a, b, c) {
                    var d;
                    b = b || 0;
                    if (a.attachment) {
                        if (a.meta = a.meta || {}, a.content && (a.meta.content = a.content), this.mailData.attachments.push({
                            content: a.meta || {},
                            level: b
                        }), this.options.showAttachmentLinks && "mixed" == c && this.mailData.html.length) for (c = 0, d = this.mailData.html.length; c < d; c++) if (this.mailData.html[c].level == b) {
                                    this._joinHTMLAttachment(this.mailData.html[c], a.meta);
                                    break
                                }
                    } else switch (a.meta.contentType) {
                            case "text/html":
                                if ("mixed" ==
                                    c && this.mailData.html.length) for (c = 0, d = this.mailData.html.length; c < d; c++) if (this.mailData.html[c].level == b) {
                                            this._joinHTMLNodes(this.mailData.html[c], a.content);
                                            return
                                        }
                                g_mht && 0 != this.mailData.html.length || this.mailData.html.push({
                                    content: this._updateHTMLCharset(a.content || ""),
                                    level: b
                                });
                                break;
                            case "text/plain":
                                this.mailData.text.push({
                                    content: a.content || "",
                                    level: b
                                });
                                break;
                            case "text/calendar":
                                a.content && (a.meta.content = a.content), this.mailData.calendar.push({
                                    content: a.meta || {},
                                    level: b
                                })
                    }
                };
                k.prototype._joinHTMLNodes = function(a, b) {
                    var c = !1;
                    b = (b || "").toString("utf-8").trim();
                    b = b.replace(/^\s*<\!doctype( [^>]*)?>/gi, "");
                    b = b.replace(/<head( [^>]*)?>(.*)<\/head( [^>]*)?>/gi, "").replace(/<\/?html( [^>]*)?>/gi, "").trim();
                    b.replace(/<body(?: [^>]*)?>(.*)<\/body( [^>]*)?>/gi, function(a, e) {
                        b = e.trim()
                    });
                    a.content = (a.content || "").toString("utf-8").trim();
                    a.content = a.content.replace(/<\/body( [^>]*)?>/i, function(a) {
                        c = !0;
                        return "<br/>\n" + b + a
                    });
                    c || (a.content += "<br/>\n" + b)
                };
                k.prototype._joinHTMLAttachment = function(a, b) {
                    var c = !1,
                        d = b.generatedFileName.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
                        f;
                    f = '\n<div class="mailparser-attachment"><a href="cid:' + b.contentId + '">&lt;' + d + "&gt;</a></div>";
                    a.content = (a.content || "").toString("utf-8").trim();
                    a.content = a.content.replace(/<\/body\b[^>]*>/i, function(a) {
                        c = !0;
                        return "<br/>\n" + f + a
                    });
                    c || (a.content += "<br/>\n" + f)
                };
                k.prototype._concatHTML = function(a, b) {
                    var c = "",
                        d = "";
                    a = (a || "").toString("utf-8");
                    b = (b || "").toString("utf-8");
                    if (!b) return a;
                    if (!a) return b;
                    a.substr(0,
                        1024).replace(/\r?\n/g, "\x00").match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*?>/i) ? c = a : b.substr(0, 1024).replace(/\r?\n/g, "\x00").match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*?>/i) && (c = b);
                    c && c.replace(/\r?\n/g, "\x00").replace(/^[\s\u0000]*(<\!doctype\b[^>]*?>)?[\s\u0000]*<(html|head)\b[^>]*>.*?<\/(head)\b[^>]*>(.*?<body\b[^>]*>)?/i, function(a) {
                        var b = a.match(/^[\s\u0000]*(<\!doctype\b[^>]*?>)/i),
                            e = a.match(/<html\b[^>]*?>/i),
                            c = a.match(/<head\b[^>]*?>/i),
                            f = a.match(/<body\b[^>]*?>/i),
                            b = b && b[1] && b[1] + "\n" || "",
                            e = e && e[0] || "<head>",
                            c = c && c[0] || "<head>",
                            f = f && f[0] || "<body>";
                        a = a.replace(/<[\!\/]?(doctype|html|head|body)\b[^>]*?>/ig, "\x00").replace(/\u0000+/g, "\n").trim();
                        d = b + e + "\n" + c + (a ? a + "\n" : "") + "</head>\n" + f + "\n"
                    });
                    a = a.replace(/\r?\n/g, "\x00").replace(/[\s\u0000]*<head\b[^>]*>.*?<\/(head|body)\b[^>]*>/gi, "").replace(/[\s\u0000]*<[\!\/]?(doctype|html|body)\b[^>]*>[\s\u0000]*/gi, "").replace(/\u0000/g, "\n");
                    b = b.replace(/\r?\n/g, "\x00").replace(/[\s\u0000]*<head\b[^>]*>.*?<\/(head|body)\b[^>]*>/gi,
                        "").replace(/[\s\u0000]*<[\!\/]?(doctype|html|body)\b[^>]*>[\s\u0000]*/gi, "").replace(/\u0000/g, "\n");
                    return d + a + b + (d ? (a || b ? "\n" : "") + "</body>\n</html>" : "")
                };
                k.prototype._convertString = function(a, c, d) {
                    d = (d || "utf-8").toUpperCase();
                    c = (c || "utf-8").toUpperCase();
                    a = "string" == typeof a ? new m(a, "binary") : a;
                    return d == c ? a : a = b.convert(a, d, c)
                };
                k.prototype._convertStringToUTF8 = function(a) {
                    return a = this._convertString(a, this._currentNode.meta.charset || this.options.defaultCharset || "iso-8859-1").toString("utf-8")
                };
                k.prototype._encodeString = function(a) {
                    return a = this._replaceMimeWords(this._convertStringToUTF8(a))
                };
                k.prototype._replaceMimeWords = function(b) {
                    return b.replace(/(=\?[^?]+\?[QqBb]\?[^?]*\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1").replace(/\=\?[^?]+\?[QqBb]\?[^?]*\?=/g, function(b) {
                        return a.decodeMimeWord(b.replace(/\s/g, ""))
                    }.bind(this))
                };
                k.prototype._trimQuotes = function(a) {
                    a = (a || "").trim();
                    if ('"' == a.charAt(0) && '"' == a.charAt(a.length - 1) || "'" == a.charAt(0) && "'" == a.charAt(a.length - 1) || "<" == a.charAt(0) &&
                        ">" == a.charAt(a.length - 1)) a = a.substr(1, a.length - 2);
                    return a
                };
                k.prototype._generateFileName = function(a, b) {
                    var c;
                    c = "";
                    var d;
                    b && (c = (c = n.extension(b)) ? "." + c : "");
                    a = (a || "attachment" + c).toString().split(/[\/\\]+/).pop().replace(/^\.+/, "") || "attachment";
                    d = a.replace(/(?:\-\d+)+(\.[^.]*)$/, "$1") || "attachment";
                    d in this._fileNames ? (this._fileNames[d]++, c = a.substr((a.lastIndexOf(".") || 0) + 1), a = c == a ? a + ("-" + this._fileNames[d]) : a.substr(0, a.length - c.length - 1) + "-" + this._fileNames[d] + "." + c) : this._fileNames[d] = 0;
                    return a
                };
                k.prototype._updateHTMLCharset = function(a) {
                    return a = a.replace(/\n/g, "\x00").replace(/<meta[^>]*>/gi, function(a) {
                        return a.match(/http\-equiv\s*=\s*"?content\-type/i) ? '<meta http-equiv="content-type" content="text/html; charset=utf-8" />' : a.match(/\scharset\s*=\s*['"]?[\w\-]+["'\s>\/]/i) ? '<meta charset="utf-8"/>' : a
                    }).replace(/\u0000/g, "\n")
                };
                k.prototype._detectHTMLCharset = function(a) {
                    var b, c, d;
                    "string" != typeof a && (a = a.toString("ascii"));
                    if (d = a.match(/<meta\s+http-equiv=["']content-type["'][^>]*?>/i)) c =
                            d[0];
                    c && (b = c.match(/charset\s?=\s?([a-zA-Z\-_:0-9]*);?/)) && (b = (b[1] || "").trim().toLowerCase());
                    !b && (d = a.match(/<meta\s+charset=\S{0,4}["']([^'"<\/]*?)["']/i)) && (b = (d[1] || "").trim().toLowerCase());
                    return b
                };
                g_MailParser = g("mailparser").MailParser
            }).call(this, g("_process"), g("buffer").Buffer)
        }, {
            "./datetime": 55,
            "./streams": 57,
            _process: 39,
            buffer: 3,
            crypto: 10,
            encoding: 58,
            mailparser: 56,
            mime: 77,
            mimelib: 78,
            stream: 51,
            util: 54
        }
    ],
    57: [function(g, p, m) {
            (function(h) {
                function m() {
                    a.call(this);
                    this.writable = !0;
                    this.checksum =
                        u.createHash("md5");
                    this.length = 0;
                    this.current = ""
                }
                function k(b) {
                    a.call(this);
                    this.writable = !0;
                    this.checksum = u.createHash("md5");
                    this.length = 0;
                    this.charset = b || "UTF-8";
                    this.current = void 0
                }
                function f(b) {
                    a.call(this);
                    this.writable = !0;
                    this.checksum = u.createHash("md5");
                    this.length = 0;
                    this.charset = b || "UTF-8";
                    this.current = ""
                }
                function d(b) {
                    a.call(this);
                    this.writable = !0;
                    this.checksum = u.createHash("md5");
                    this.length = 0;
                    this.buf = [];
                    this.buflen = 0;
                    this.charset = b || "UTF-8";
                    this.current = void 0
                }
                var a = g("stream").Stream,
                    c = g("util"),
                    b = g("mimelib"),
                    l = g("encoding"),
                    u = g("crypto"),
                    n = g("uue");
                p.exports.Base64Stream = m;
                p.exports.QPStream = k;
                p.exports.BinaryStream = f;
                p.exports.UUEStream = d;
                c.inherits(m, a);
                m.prototype.write = function(a) {
                    this.handleInput(a);
                    return !0
                };
                m.prototype.end = function(a) {
                    this.handleInput(a);
                    this.emit("end");
                    return {
                        length: this.length,
                        checksum: this.checksum.digest("hex")
                    }
                };
                m.prototype.handleInput = function(a) {
                    if (a && a.length) {
                        a = (a || "").toString("utf-8");
                        var b = 0;
                        this.current += a.replace(/[^\w\+\/=]/g, "");
                        a = new h(this.current.substr(0,
                            this.current.length - this.current.length % 4), "base64");
                        a.length && (this.length += a.length, this.checksum.update(a), this.emit("data", a));
                        this.current = (b = this.current.length % 4) ? this.current.substr(-b) : ""
                    }
                };
                c.inherits(k, a);
                k.prototype.write = function(a) {
                    this.handleInput(a);
                    return !0
                };
                k.prototype.end = function(a) {
                    this.handleInput(a);
                    this.flush();
                    this.emit("end");
                    return {
                        length: this.length,
                        checksum: this.checksum.digest("hex")
                    }
                };
                k.prototype.handleInput = function(a) {
                    a && a.length && (a = (a || "").toString("utf-8"), a.match(/^\r\n/) &&
                        (a = a.substr(2)), this.current = "string" != typeof this.current ? a : this.current + ("\r\n" + a))
                };
                k.prototype.flush = function() {
                    var a = b.decodeQuotedPrintable(this.current, !1, this.charset);
                    "binary" != this.charset.toLowerCase() && (a = "utf-8" != this.charset.toLowerCase() ? l.convert(a, "utf-8", this.charset) : new h(a, "utf-8"));
                    this.length += a.length;
                    this.checksum.update(a);
                    this.emit("data", a)
                };
                c.inherits(f, a);
                f.prototype.write = function(a) {
                    a && a.length && (this.length += a.length, this.checksum.update(a), this.emit("data", a));
                    return !0
                };
                f.prototype.end = function(a) {
                    a && a.length && this.emit("data", a);
                    this.emit("end");
                    return {
                        length: this.length,
                        checksum: this.checksum.digest("hex")
                    }
                };
                c.inherits(d, a);
                d.prototype.write = function(a) {
                    this.buf.push(a);
                    this.buflen += a.length;
                    return !0
                };
                d.prototype.end = function(a) {
                    a && this.write(a);
                    this.flush();
                    this.emit("end");
                    return {
                        length: this.length,
                        checksum: this.checksum.digest("hex")
                    }
                };
                d.prototype.flush = function() {
                    var a = this.decode(h.concat(this.buf, this.buflen));
                    this.length += a.length;
                    this.checksum.update(a);
                    this.emit("data", a)
                };
                d.prototype.decode = function(a) {
                    var b;
                    b = a.slice(0, Math.min(a.length, 1024)).toString().split(/\s/)[2] || "";
                    if (!b) return new h(0);
                    a = n.decodeFile(a.toString("ascii").replace(/\r\n/g, "\n"), b);
                    "binary" != this.charset.toLowerCase() && "utf-8" != this.charset.toLowerCase() && (a = l.convert(a, "utf-8", this.charset));
                    return a
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3,
            crypto: 10,
            encoding: 58,
            mimelib: 78,
            stream: 51,
            util: 54,
            uue: 83
        }
    ],
    58: [function(g, p, m) {
            (function(h) {
                function m(a, b, d) {
                    return "UTF-8" == b ?
                        f.decode(a, d) : "UTF-8" == d ? f.encode(a, b) : f.encode(f.decode(a, d), b)
                }
                function k(a) {
                    return (a || "").toString().trim().replace(/^latin[\-_]?(\d+)$/i, "ISO-8859-$1").replace(/^win(?:dows)?[\-_]?(\d+)$/i, "WINDOWS-$1").replace(/^utf[\-_]?(\d+)$/i, "UTF-$1").replace(/^ks_c_5601\-1987$/i, "CP949").replace(/^us[\-_]?ascii$/i, "ASCII").toUpperCase()
                }
                var f = g("iconv-lite"),
                    d;
                try {
                    d = g("iconv").Iconv
                } catch (a) {}
                p.exports.convert = function(a, b, f, g) {
                    f = k(f || "UTF-8");
                    b = k(b || "UTF-8");
                    a = a || "";
                    var n;
                    "UTF-8" != f && "string" == typeof a &&
                        (a = new h(a, "binary"));
                    if (f === b) n = "string" === typeof a ? new h(a) : a;
                    else if (d && !g) try {
                            g = a;
                            var q;
                            q = (new d(f, b + "//TRANSLIT//IGNORE")).convert(g);
                            n = q.slice(0, q.length)
                    } catch (e) {
                        console.log(e);
                        try {
                            n = m(a, b, f)
                        } catch (r) {
                            console.log(r), n = a
                        }
                    } else try {
                            n = m(a, b, f)
                    } catch (p) {
                        console.log(p), n = a
                    }
                    "string" == typeof n && (n = new h(n, "utf-8"));
                    return n
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3,
            "iconv-lite": 76
        }
    ],
    59: [function(g, p, m) {
            (function(h) {
                function g(a) {
                    this.options = a;
                    if (!a) throw Error("DBCS codec is called without the data.");
                    if (!a.table) throw Error("Encoding '" + a.encodingName + "' has no data.");
                    var c = a.table();
                    this.decodeTables = [];
                    this.decodeTables[0] = n.slice(0);
                    this.decodeTableSeq = [];
                    for (var d = 0; d < c.length; d++) this._addDecodeChunk(c[d]);
                    this.defaultCharUnicode = a.iconv.defaultCharUnicode;
                    this.encodeTable = [];
                    this.encodeTableSeq = [];
                    var f = {};
                    if (a.encodeSkipVals) for (d = 0; d < a.encodeSkipVals.length; d++) for (var h = a.encodeSkipVals[d], c = h.from; c <= h.to; c++) f[c] = !0;
                    this._fillEncodeTable(0, 0, f);
                    for (var k in a.encodeAdd || {}) this._setEncodeChar(k.charCodeAt(0),
                            a.encodeAdd[k]);
                    this.defCharSB = this.encodeTable[0][a.iconv.defaultCharSingleByte.charCodeAt(0)];
                    this.defCharSB === b && (this.defCharSB = this.encodeTable[0]["?"]);
                    this.defCharSB === b && (this.defCharSB = 63);
                    if ("function" === typeof a.gb18030) {
                        this.gb18030 = a.gb18030();
                        a = this.decodeTables.length;
                        k = this.decodeTables[a] = n.slice(0);
                        f = this.decodeTables.length;
                        h = this.decodeTables[f] = n.slice(0);
                        for (d = 129; 254 >= d; d++) for (var q = this.decodeTables[p - this.decodeTables[0][d]], c = 48; 57 >= c; c++) q[c] = p - a;
                        for (d = 129; 254 >= d; d++) k[d] =
                                p - f;
                        for (d = 48; 57 >= d; d++) h[d] = l
                    }
                }
                function k(a) {
                    for (var d = new h(a.length * (this.gb18030 ? 4 : 3)), f = this.leadSurrogate, g = this.seqObj, l = -1, k = 0, n = 0;;) {
                        if (-1 === l) {
                            if (k == a.length) break;
                            var q = a.charCodeAt(k++)
                        } else q = l, l = -1; if (55296 <= q && 57344 > q) if (56320 > q) if (-1 === f) {
                                    f = q;
                                    continue
                                } else f = q, q = b;
                                else -1 !== f ? (q = 65536 + 1024 * (f - 55296) + (q - 56320), f = -1) : q = b;
                        else -1 !== f && (l = q, q = b, f = -1);
                        var m = b;
                        if (void 0 !== g && q != b) {
                            var p = g[q];
                            if ("object" === typeof p) {
                                g = p;
                                continue
                            } else "number" == typeof p ? m = p : void 0 == p && (p = g[-1], void 0 !== p && (m =
                                    p, l = q));
                            g = void 0
                        } else if (0 <= q) {
                            p = this.encodeTable[q >> 8];
                            void 0 !== p && (m = p[q & 255]);
                            if (-10 >= m) {
                                g = this.encodeTableSeq[-10 - m];
                                continue
                            }
                            if (m == b && this.gb18030 && (p = c(this.gb18030.uChars, q), -1 != p)) {
                                m = this.gb18030.gbChars[p] + (q - this.gb18030.uChars[p]);
                                d[n++] = 129 + Math.floor(m / 12600);
                                m %= 12600;
                                d[n++] = 48 + Math.floor(m / 1260);
                                m %= 1260;
                                d[n++] = 129 + Math.floor(m / 10);
                                m %= 10;
                                d[n++] = 48 + m;
                                continue
                            }
                        }
                        m === b && (m = this.defaultCharSingleByte);
                        256 > m ? d[n++] = m : (65536 > m ? d[n++] = m >> 8 : (d[n++] = m >> 16, d[n++] = m >> 8 & 255), d[n++] = m & 255)
                    }
                    this.seqObj =
                        g;
                    this.leadSurrogate = f;
                    return d.slice(0, n)
                }
                function f() {
                    if (-1 !== this.leadSurrogate || void 0 !== this.seqObj) {
                        var a = new h(10),
                            b = 0;
                        if (this.seqObj) {
                            var c = this.seqObj[-1];
                            void 0 !== c && (256 > c ? a[b++] = c : (a[b++] = c >> 8, a[b++] = c & 255));
                            this.seqObj = void 0
                        } - 1 !== this.leadSurrogate && (a[b++] = this.defaultCharSingleByte, this.leadSurrogate = -1);
                        return a.slice(0, b)
                    }
                }
                function d(a) {
                    var d = new h(2 * a.length),
                        f = this.nodeIdx,
                        g = this.prevBuf,
                        k = this.prevBuf.length,
                        n = -this.prevBuf.length;
                    0 < k && (g = h.concat([g, a.slice(0, 10)]));
                    for (var q =
                        0, m = 0; q < a.length; q++) {
                        f = this.decodeTables[f][0 <= q ? a[q] : g[q + k]];
                        if (!(0 <= f)) if (f === b) q = n, f = this.defaultCharUnicode.charCodeAt(0);
                            else if (f === l) f = 0 <= n ? a.slice(n, q + 1) : g.slice(n + k, q + 1 + k), f = 12600 * (f[0] - 129) + 1260 * (f[1] - 48) + 10 * (f[2] - 129) + (f[3] - 48), n = c(this.gb18030.gbChars, f), f = this.gb18030.uChars[n] + f - this.gb18030.gbChars[n];
                        else if (f <= p) {
                            f = p - f;
                            continue
                        } else if (-10 >= f) {
                            for (var n = this.decodeTableSeq[-10 - f], s = 0; s < n.length - 1; s++) f = n[s], d[m++] = f & 255, d[m++] = f >> 8;
                            f = n[n.length - 1]
                        } else throw Error("Unknown table value when decoding: " +
                                val);
                        65535 < f && (f -= 65536, n = 55296 + Math.floor(f / 1024), d[m++] = n & 255, d[m++] = n >> 8, f = 56320 + f % 1024);
                        d[m++] = f & 255;
                        d[m++] = f >> 8;
                        f = 0;
                        n = q + 1
                    }
                    this.nodeIdx = f;
                    this.prevBuf = 0 <= n ? a.slice(n) : g.slice(n + k);
                    return d.slice(0, m).toString("ucs2")
                }
                function a() {
                    for (var a = ""; 0 < this.prevBuf.length;) {
                        var a = a + this.defaultCharUnicode,
                            b = this.prevBuf.slice(1);
                        this.prevBuf = new h(0);
                        this.nodeIdx = 0;
                        0 < b.length && (a += d.call(this, b))
                    }
                    this.nodeIdx = 0;
                    return a
                }
                function c(a, b) {
                    if (a[0] > b) return -1;
                    for (var c = 0, d = a.length; c < d - 1;) {
                        var f = c + Math.floor((d -
                            c + 1) / 2);
                        a[f] <= b ? c = f : d = f
                    }
                    return c
                }
                m._dbcs = function(a) {
                    return new g(a)
                };
                for (var b = -1, l = -2, p = -1E3, n = Array(256), q = 0; 256 > q; q++) n[q] = b;
                g.prototype.encoder = function(a) {
                    return {
                        write: k,
                        end: f,
                        leadSurrogate: -1,
                        seqObj: void 0,
                        encodeTable: this.encodeTable,
                        encodeTableSeq: this.encodeTableSeq,
                        defaultCharSingleByte: this.defCharSB,
                        gb18030: this.gb18030,
                        findIdx: c
                    }
                };
                g.prototype.decoder = function(b) {
                    return {
                        write: d,
                        end: a,
                        nodeIdx: 0,
                        prevBuf: new h(0),
                        decodeTables: this.decodeTables,
                        decodeTableSeq: this.decodeTableSeq,
                        defaultCharUnicode: this.defaultCharUnicode,
                        gb18030: this.gb18030
                    }
                };
                g.prototype._getDecodeTrieNode = function(a) {
                    for (var c = []; 0 < a; a >>= 8) c.push(a & 255);
                    0 == c.length && c.push(0);
                    for (var d = this.decodeTables[0], f = c.length - 1; 0 < f; f--) {
                        var h = d[c[f]];
                        if (h == b) d[c[f]] = p - this.decodeTables.length, this.decodeTables.push(d = n.slice(0));
                        else if (h <= p) d = this.decodeTables[p - h];
                        else throw Error("Overwrite byte in " + this.options.encodingName + ", addr: " + a.toString(16));
                    }
                    return d
                };
                g.prototype._addDecodeChunk = function(a) {
                    for (var b = parseInt(a[0], 16), c = this._getDecodeTrieNode(b),
                            b = b & 255, d = 1; d < a.length; d++) {
                        var f = a[d];
                        if ("string" === typeof f) for (var h = 0; h < f.length;) {
                                var g = f.charCodeAt(h++);
                                if (55296 <= g && 56320 > g) {
                                    var l = f.charCodeAt(h++);
                                    if (56320 <= l && 57344 > l) c[b++] = 65536 + 1024 * (g - 55296) + (l - 56320);
                                    else throw Error("Incorrect surrogate pair in " + this.options.encodingName + " at chunk " + a[0]);
                                } else if (4080 < g && 4095 >= g) {
                                    for (var g = 4095 - g + 2, l = [], n = 0; n < g; n++) l.push(f.charCodeAt(h++));
                                    c[b++] = -10 - this.decodeTableSeq.length;
                                    this.decodeTableSeq.push(l)
                                } else c[b++] = g
                        } else if ("number" === typeof f) for (g =
                                c[b - 1] + 1, h = 0; h < f; h++) c[b++] = g++;
                        else throw Error("Incorrect type '" + typeof f + "' given in " + this.options.encodingName + " at chunk " + a[0]);
                    }
                    if (255 < b) throw Error("Incorrect chunk in " + this.options.encodingName + " at addr " + a[0] + ": too long" + b);
                };
                g.prototype._getEncodeBucket = function(a) {
                    a >>= 8;
                    void 0 === this.encodeTable[a] && (this.encodeTable[a] = n.slice(0));
                    return this.encodeTable[a]
                };
                g.prototype._setEncodeChar = function(a, c) {
                    var d = this._getEncodeBucket(a),
                        f = a & 255; - 10 >= d[f] ? this.encodeTableSeq[-10 - d[f]][-1] =
                        c : d[f] == b && (d[f] = c)
                };
                g.prototype._setEncodeSequence = function(a, c) {
                    var d = a[0],
                        f = this._getEncodeBucket(d),
                        h = d & 255,
                        g; - 10 >= f[h] ? g = this.encodeTableSeq[-10 - f[h]] : (g = {}, f[h] !== b && (g[-1] = f[h]), f[h] = -10 - this.encodeTableSeq.length, this.encodeTableSeq.push(g));
                    for (f = 1; f < a.length - 1; f++) h = g[d], "object" === typeof h ? g = h : (g = g[d] = {}, void 0 !== h && (g[-1] = h));
                    d = a[a.length - 1];
                    g[d] = c
                };
                g.prototype._fillEncodeTable = function(a, b, c) {
                    a = this.decodeTables[a];
                    for (var d = 0; 256 > d; d++) {
                        var f = a[d],
                            h = b + d;
                        c[h] || (0 <= f ? this._setEncodeChar(f,
                            h) : f <= p ? this._fillEncodeTable(p - f, h << 8, c) : -10 >= f && this._setEncodeSequence(this.decodeTableSeq[-10 - f], h))
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    60: [function(g, p, m) {
            p.exports = {
                shiftjis: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/shiftjis.json")
                    },
                    encodeAdd: {
                        "": 92,
                        "\u203e": 126
                    },
                    encodeSkipVals: [{
                            from: 60736,
                            to: 63808
                        }
                    ]
                },
                csshiftjis: "shiftjis",
                mskanji: "shiftjis",
                sjis: "shiftjis",
                "windows-31j": "shiftjis",
                "x-sjis": "shiftjis",
                windows932: "shiftjis",
                932: "shiftjis",
                cp932: "shiftjis",
                eucjp: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/eucjp.json")
                    },
                    encodeAdd: {
                        "": 92,
                        "\u203e": 126
                    }
                },
                gb2312: "cp936",
                gb231280: "cp936",
                gb23121980: "cp936",
                csgb2312: "cp936",
                csiso58gb231280: "cp936",
                euccn: "cp936",
                isoir58: "gbk",
                windows936: "cp936",
                936: "cp936",
                cp936: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp936.json")
                    }
                },
                gbk: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp936.json").concat(g("./tables/gbk-added.json"))
                    }
                },
                xgbk: "gbk",
                gb18030: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp936.json").concat(g("./tables/gbk-added.json"))
                    },
                    gb18030: function() {
                        return g("./tables/gb18030-ranges.json")
                    }
                },
                chinese: "gb18030",
                windows949: "cp949",
                949: "cp949",
                cp949: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp949.json")
                    }
                },
                cseuckr: "cp949",
                csksc56011987: "cp949",
                euckr: "cp949",
                isoir149: "cp949",
                korean: "cp949",
                ksc56011987: "cp949",
                ksc56011989: "cp949",
                ksc5601: "cp949",
                windows950: "cp950",
                950: "cp950",
                cp950: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp950.json")
                    }
                },
                big5: "big5hkscs",
                big5hkscs: {
                    type: "_dbcs",
                    table: function() {
                        return g("./tables/cp950.json").concat(g("./tables/big5-added.json"))
                    }
                },
                cnbig5: "big5hkscs",
                csbig5: "big5hkscs",
                xxbig5: "big5hkscs"
            }
        }, {
            "./tables/big5-added.json": 66,
            "./tables/cp936.json": 67,
            "./tables/cp949.json": 68,
            "./tables/cp950.json": 69,
            "./tables/eucjp.json": 70,
            "./tables/gb18030-ranges.json": 71,
            "./tables/gbk-added.json": 72,
            "./tables/shiftjis.json": 73
        }
    ],
    61: [function(g, p, m) {
            g = [g("./internal"), g("./utf16"), g("./utf7"), g("./sbcs-codec"), g("./sbcs-data"), g("./sbcs-data-generated"), g("./dbcs-codec"), g("./dbcs-data")];
            for (var h = 0; h < g.length; h++) {
                p = g[h];
                for (var s in p) m[s] = p[s]
            }
        }, {
            "./dbcs-codec": 59,
            "./dbcs-data": 60,
            "./internal": 62,
            "./sbcs-codec": 63,
            "./sbcs-data": 65,
            "./sbcs-data-generated": 64,
            "./utf16": 74,
            "./utf7": 75
        }
    ],
    62: [function(g, p, m) {
            (function(h) {
                function m() {
                    return new l(this.enc)
                }
                function k() {
                    return {
                        write: f,
                        end: function() {},
                        enc: this.enc
                    }
                }
                function f(a) {
                    return new h(a, this.enc)
                }
                function d() {
                    return {
                        write: a,
                        end: c,
                        prevStr: ""
                    }
                }
                function a(a) {
                    a = this.prevStr + a;
                    var b = a.length - a.length % 4;
                    this.prevStr = a.slice(b);
                    a = a.slice(0, b);
                    return new h(a, "base64")
                }
                function c() {
                    return new h(this.prevStr,
                        "base64")
                }
                var b = new h([255, 254]);
                p.exports = {
                    utf8: {
                        type: "_internal",
                        enc: "utf8"
                    },
                    cesu8: {
                        type: "_internal",
                        enc: "utf8"
                    },
                    unicode11utf8: {
                        type: "_internal",
                        enc: "utf8"
                    },
                    ucs2: {
                        type: "_internal",
                        enc: "ucs2",
                        bom: b
                    },
                    utf16le: {
                        type: "_internal",
                        enc: "ucs2",
                        bom: b
                    },
                    binary: {
                        type: "_internal",
                        enc: "binary"
                    },
                    base64: {
                        type: "_internal",
                        enc: "base64"
                    },
                    hex: {
                        type: "_internal",
                        enc: "hex"
                    },
                    _internal: function(a) {
                        if (!a || !a.enc) throw Error("Internal codec is called without encoding type.");
                        return {
                            encoder: "base64" == a.enc ? d : k,
                            decoder: m,
                            enc: a.enc,
                            bom: a.bom
                        }
                    }
                };
                var l = g("string_decoder").StringDecoder;
                l.prototype.end || (l.prototype.end = function() {})
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3,
            string_decoder: 52
        }
    ],
    63: [function(g, p, m) {
            (function(h) {
                function g(a) {
                    return {
                        write: k,
                        end: function() {},
                        encodeBuf: this.encodeBuf
                    }
                }
                function k(a) {
                    for (var c = new h(a.length), b = 0; b < a.length; b++) c[b] = this.encodeBuf[a.charCodeAt(b)];
                    return c
                }
                function f(a) {
                    return {
                        write: d,
                        end: function() {},
                        decodeBuf: this.decodeBuf
                    }
                }
                function d(a) {
                    for (var c = this.decodeBuf, b = new h(2 * a.length),
                            d = 0, f = 0, g = 0, k = a.length; g < k; g++) d = 2 * a[g], f = 2 * g, b[f] = c[d], b[f + 1] = c[d + 1];
                    return b.toString("ucs2")
                }
                m._sbcs = function(a) {
                    if (!a) throw Error("SBCS codec is called without the data.");
                    if (!a.chars || 128 !== a.chars.length && 256 !== a.chars.length) throw Error("Encoding '" + a.type + "' has incorrect 'chars' (must be of len 128 or 256)");
                    if (128 === a.chars.length) {
                        for (var c = "", b = 0; 128 > b; b++) c += String.fromCharCode(b);
                        a.chars = c + a.chars
                    }
                    var c = new h(a.chars, "ucs2"),
                        d = new h(65536);
                    d.fill(a.iconv.defaultCharSingleByte.charCodeAt(0));
                    for (b = 0; b < a.chars.length; b++) d[a.chars.charCodeAt(b)] = b;
                    return {
                        encoder: g,
                        decoder: f,
                        encodeBuf: d,
                        decodeBuf: c
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    64: [function(g, p, m) {
            p.exports = {
                437: "cp437",
                737: "cp737",
                775: "cp775",
                850: "cp850",
                852: "cp852",
                855: "cp855",
                856: "cp856",
                857: "cp857",
                858: "cp858",
                860: "cp860",
                861: "cp861",
                862: "cp862",
                863: "cp863",
                864: "cp864",
                865: "cp865",
                866: "cp866",
                869: "cp869",
                874: "windows874",
                922: "cp922",
                1046: "cp1046",
                1124: "cp1124",
                1125: "cp1125",
                1129: "cp1129",
                1133: "cp1133",
                1161: "cp1161",
                1162: "cp1162",
                1163: "cp1163",
                1250: "windows1250",
                1251: "windows1251",
                1252: "windows1252",
                1253: "windows1253",
                1254: "windows1254",
                1255: "windows1255",
                1256: "windows1256",
                1257: "windows1257",
                1258: "windows1258",
                28591: "iso88591",
                28592: "iso88592",
                28593: "iso88593",
                28594: "iso88594",
                28595: "iso88595",
                28596: "iso88596",
                28597: "iso88597",
                28598: "iso88598",
                28599: "iso88599",
                28600: "iso885910",
                28601: "iso885911",
                28603: "iso885913",
                28604: "iso885914",
                28605: "iso885915",
                28606: "iso885916",
                windows874: {
                    type: "_sbcs",
                    chars: "€����…�����������‘’“”•–—�������� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
                },
                win874: "windows874",
                cp874: "windows874",
                windows1250: {
                    type: "_sbcs",
                    chars: "€�‚�„…†‡�‰Š‹ŚŤŽŹ�‘’“”•–—�™š›śťžź ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż°±˛ł´µ¶·¸ąş»Ľ˝ľżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
                },
                win1250: "windows1250",
                cp1250: "windows1250",
                windows1251: {
                    type: "_sbcs",
                    chars: "ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—�™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕїАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
                },
                win1251: "windows1251",
                cp1251: "windows1251",
                windows1252: {
                    type: "_sbcs",
                    chars: "€�‚ƒ„…†‡ˆ‰Š‹Œ�Ž��‘’“”•–—˜™š›œ�žŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
                },
                win1252: "windows1252",
                cp1252: "windows1252",
                windows1253: {
                    type: "_sbcs",
                    chars: "€�‚ƒ„…†‡�‰�‹�����‘’“”•–—�™�›���� ΅Ά£¤¥¦§¨©�«¬­®―°±²³΄µ¶·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
                },
                win1253: "windows1253",
                cp1253: "windows1253",
                windows1254: {
                    type: "_sbcs",
                    chars: "€�‚ƒ„…†‡ˆ‰Š‹Œ����‘’“”•–—˜™š›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
                },
                win1254: "windows1254",
                cp1254: "windows1254",
                windows1255: {
                    type: "_sbcs",
                    chars: "€�‚ƒ„…†‡ˆ‰�‹�����‘’“”•–—˜™�›���� ¡¢£₪¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾¿ְֱֲֳִֵֶַָֹ�ֻּֽ־ֿ׀ׁׂ׃װױײ׳״�������אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
                },
                win1255: "windows1255",
                cp1255: "windows1255",
                windows1256: {
                    type: "_sbcs",
                    chars: "€پ‚ƒ„…†‡ˆ‰ٹ‹Œچژڈگ‘’“”•–—ک™ڑ›œ‌‍ں ،¢£¤¥¦§¨©ھ«¬­®¯°±²³´µ¶·¸¹؛»¼½¾؟ہءآأؤإئابةتثجحخدذرزسشصض×طظعغـفقكàلâمنهوçèéêëىيîïًٌٍَôُِ÷ّùْûü‎‏ے"
                },
                win1256: "windows1256",
                cp1256: "windows1256",
                windows1257: {
                    type: "_sbcs",
                    chars: "€�‚�„…†‡�‰�‹�¨ˇ¸�‘’“”•–—�™�›�¯˛� �¢£¤�¦§Ø©Ŗ«¬­®Æ°±²³´µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž˙"
                },
                win1257: "windows1257",
                cp1257: "windows1257",
                windows1258: {
                    type: "_sbcs",
                    chars: "€�‚ƒ„…†‡ˆ‰�‹Œ����‘’“”•–—˜™�›œ��Ÿ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
                },
                win1258: "windows1258",
                cp1258: "windows1258",
                iso88591: {
                    type: "_sbcs",
                    chars: " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
                },
                cp28591: "iso88591",
                iso88592: {
                    type: "_sbcs",
                    chars: " Ą˘Ł¤ĽŚ§¨ŠŞŤŹ­ŽŻ°ą˛ł´ľśˇ¸šşťź˝žżŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢßŕáâăäĺćçčéęëěíîďđńňóôőö÷řůúűüýţ˙"
                },
                cp28592: "iso88592",
                iso88593: {
                    type: "_sbcs",
                    chars: " Ħ˘£¤�Ĥ§¨İŞĞĴ­�Ż°ħ²³´µĥ·¸ışğĵ½�żÀÁÂ�ÄĊĈÇÈÉÊËÌÍÎÏ�ÑÒÓÔĠÖ×ĜÙÚÛÜŬŜßàáâ�äċĉçèéêëìíîï�ñòóôġö÷ĝùúûüŭŝ˙"
                },
                cp28593: "iso88593",
                iso88594: {
                    type: "_sbcs",
                    chars: " ĄĸŖ¤ĨĻ§¨ŠĒĢŦ­Ž¯°ą˛ŗ´ĩļˇ¸šēģŧŊžŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎĪĐŅŌĶÔÕÖ×ØŲÚÛÜŨŪßāáâãäåæįčéęëėíîīđņōķôõö÷øųúûüũū˙"
                },
                cp28594: "iso88594",
                iso88595: {
                    type: "_sbcs",
                    chars: " ЁЂЃЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђѓєѕіїјљњћќ§ўџ"
                },
                cp28595: "iso88595",
                iso88596: {
                    type: "_sbcs",
                    chars: " ���¤�������،­�������������؛���؟�ءآأؤإئابةتثجحخدذرزسشصضطظعغ�����ـفقكلمنهوىيًٌٍَُِّْ�������������"
                },
                cp28596: "iso88596",
                iso88597: {
                    type: "_sbcs",
                    chars: " ‘’£€₯¦§¨©ͺ«¬­�―°±²³΄΅Ά·ΈΉΊ»Ό½ΎΏΐΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡ�ΣΤΥΦΧΨΩΪΫάέήίΰαβγδεζηθικλμνξοπρςστυφχψωϊϋόύώ�"
                },
                cp28597: "iso88597",
                iso88598: {
                    type: "_sbcs",
                    chars: " �¢£¤¥¦§¨©×«¬­®¯°±²³´µ¶·¸¹÷»¼½¾��������������������������������‗אבגדהוזחטיךכלםמןנסעףפץצקרשת��‎‏�"
                },
                cp28598: "iso88598",
                iso88599: {
                    type: "_sbcs",
                    chars: " ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏĞÑÒÓÔÕÖ×ØÙÚÛÜİŞßàáâãäåæçèéêëìíîïğñòóôõö÷øùúûüışÿ"
                },
                cp28599: "iso88599",
                iso885910: {
                    type: "_sbcs",
                    chars: " ĄĒĢĪĨĶ§ĻĐŠŦŽ­ŪŊ°ąēģīĩķ·ļđšŧž―ūŋĀÁÂÃÄÅÆĮČÉĘËĖÍÎÏÐŅŌÓÔÕÖŨØŲÚÛÜÝÞßāáâãäåæįčéęëėíîïðņōóôõöũøųúûüýþĸ"
                },
                cp28600: "iso885910",
                iso885911: {
                    type: "_sbcs",
                    chars: " กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
                },
                cp28601: "iso885911",
                iso885913: {
                    type: "_sbcs",
                    chars: " ”¢£¤„¦§Ø©Ŗ«¬­®Æ°±²³“µ¶·ø¹ŗ»¼½¾æĄĮĀĆÄÅĘĒČÉŹĖĢĶĪĻŠŃŅÓŌÕÖ×ŲŁŚŪÜŻŽßąįāćäåęēčéźėģķīļšńņóōõö÷ųłśūüżž’"
                },
                cp28603: "iso885913",
                iso885914: {
                    type: "_sbcs",
                    chars: " Ḃḃ£ĊċḊ§Ẁ©ẂḋỲ­®ŸḞḟĠġṀṁ¶ṖẁṗẃṠỳẄẅṡÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŴÑÒÓÔÕÖṪØÙÚÛÜÝŶßàáâãäåæçèéêëìíîïŵñòóôõöṫøùúûüýŷÿ"
                },
                cp28604: "iso885914",
                iso885915: {
                    type: "_sbcs",
                    chars: " ¡¢£€¥Š§š©ª«¬­®¯°±²³Žµ¶·ž¹º»ŒœŸ¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
                },
                cp28605: "iso885915",
                iso885916: {
                    type: "_sbcs",
                    chars: " ĄąŁ€„Š§š©Ș«Ź­źŻ°±ČłŽ”¶·žčș»ŒœŸżÀÁÂĂÄĆÆÇÈÉÊËÌÍÎÏĐŃÒÓÔŐÖŚŰÙÚÛÜĘȚßàáâăäćæçèéêëìíîïđńòóôőöśűùúûüęțÿ"
                },
                cp28606: "iso885916",
                cp437: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm437: "cp437",
                csibm437: "cp437",
                cp737: {
                    type: "_sbcs",
                    chars: "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρσςτυφχψ░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀ωάέήϊίόύϋώΆΈΉΊΌΎΏ±≥≤ΪΫ÷≈°∙·√ⁿ²■ "
                },
                ibm737: "cp737",
                csibm737: "cp737",
                cp775: {
                    type: "_sbcs",
                    chars: "ĆüéāäģåćłēŖŗīŹÄÅÉæÆōöĢ¢ŚśÖÜø£Ø×¤ĀĪóŻżź”¦©®¬½¼Ł«»░▒▓│┤ĄČĘĖ╣║╗╝ĮŠ┐└┴┬├─┼ŲŪ╚╔╩╦╠═╬Žąčęėįšųūž┘┌█▄▌▐▀ÓßŌŃõÕµńĶķĻļņĒŅ’­±“¾¶§÷„°∙·¹³²■ "
                },
                ibm775: "cp775",
                csibm775: "cp775",
                cp850: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
                },
                ibm850: "cp850",
                csibm850: "cp850",
                cp852: {
                    type: "_sbcs",
                    chars: "ÇüéâäůćçłëŐőîŹÄĆÉĹĺôöĽľŚśÖÜŤťŁ×čáíóúĄąŽžĘę¬źČş«»░▒▓│┤ÁÂĚŞ╣║╗╝Żż┐└┴┬├─┼Ăă╚╔╩╦╠═╬¤đĐĎËďŇÍÎě┘┌█▄ŢŮ▀ÓßÔŃńňŠšŔÚŕŰýÝţ´­˝˛ˇ˘§÷¸°¨˙űŘř■ "
                },
                ibm852: "cp852",
                csibm852: "cp852",
                cp855: {
                    type: "_sbcs",
                    chars: "ђЂѓЃёЁєЄѕЅіІїЇјЈљЉњЊћЋќЌўЎџЏюЮъЪаАбБцЦдДеЕфФгГ«»░▒▓│┤хХиИ╣║╗╝йЙ┐└┴┬├─┼кК╚╔╩╦╠═╬¤лЛмМнНоОп┘┌█▄Пя▀ЯрРсСтТуУжЖвВьЬ№­ыЫзЗшШэЭщЩчЧ§■ "
                },
                ibm855: "cp855",
                csibm855: "cp855",
                cp856: {
                    type: "_sbcs",
                    chars: "אבגדהוזחטיךכלםמןנסעףפץצקרשת�£�×����������®¬½¼�«»░▒▓│┤���©╣║╗╝¢¥┐└┴┬├─┼��╚╔╩╦╠═╬¤���������┘┌█▄¦�▀������µ�������¯´­±‗¾¶§÷¸°¨·¹³²■ "
                },
                ibm856: "cp856",
                csibm856: "cp856",
                cp857: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèïîıÄÅÉæÆôöòûùİÖÜø£ØŞşáíóúñÑĞğ¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ºªÊËÈ�ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµ�×ÚÛÙìÿ¯´­±�¾¶§÷¸°¨·¹³²■ "
                },
                ibm857: "cp857",
                csibm857: "cp857",
                cp858: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ "
                },
                ibm858: "cp858",
                csibm858: "cp858",
                cp860: {
                    type: "_sbcs",
                    chars: "ÇüéâãàÁçêÊèÍÔìÃÂÉÀÈôõòÚùÌÕÜ¢£Ù₧ÓáíóúñÑªº¿Ò¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm860: "cp860",
                csibm860: "cp860",
                cp861: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèÐðÞÄÅÉæÆôöþûÝýÖÜø£Ø₧ƒáíóúÁÍÓÚ¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm861: "cp861",
                csibm861: "cp861",
                cp862: {
                    type: "_sbcs",
                    chars: "אבגדהוזחטיךכלםמןנסעףפץצקרשת¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm862: "cp862",
                csibm862: "cp862",
                cp863: {
                    type: "_sbcs",
                    chars: "ÇüéâÂà¶çêëèïî‗À§ÉÈÊôËÏûù¤ÔÜ¢£ÙÛƒ¦´óú¨¸³¯Î⌐¬½¼¾«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm863: "cp863",
                csibm863: "cp863",
                cp864: {
                    type: "_sbcs",
                    chars: "\x00\b\t\n\x0B\f\r !\"#$٪&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~°·∙√▒─│┼┤┬├┴┐┌└┘β∞φ±½¼≈«»ﻷﻸ��ﻻﻼ� ­ﺂ£¤ﺄ��ﺎﺏﺕﺙ،ﺝﺡﺥ٠١٢٣٤٥٦٧٨٩ﻑ؛ﺱﺵﺹ؟¢ﺀﺁﺃﺅﻊﺋﺍﺑﺓﺗﺛﺟﺣﺧﺩﺫﺭﺯﺳﺷﺻﺿﻁﻅﻋﻏ¦¬÷×ﻉـﻓﻗﻛﻟﻣﻧﻫﻭﻯﻳﺽﻌﻎﻍﻡﹽّﻥﻩﻬﻰﻲﻐﻕﻵﻶﻝﻙﻱ■�"
                },
                ibm864: "cp864",
                csibm864: "cp864",
                cp865: {
                    type: "_sbcs",
                    chars: "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø₧ƒáíóúñÑªº¿⌐¬½¼¡«¤░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
                },
                ibm865: "cp865",
                csibm865: "cp865",
                cp866: {
                    type: "_sbcs",
                    chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ "
                },
                ibm866: "cp866",
                csibm866: "cp866",
                cp869: {
                    type: "_sbcs",
                    chars: "������Ά�·¬¦‘’Έ―ΉΊΪΌ��ΎΫ©Ώ²³ά£έήίϊΐόύΑΒΓΔΕΖΗ½ΘΙ«»░▒▓│┤ΚΛΜΝ╣║╗╝ΞΟ┐└┴┬├─┼ΠΡ╚╔╩╦╠═╬ΣΤΥΦΧΨΩαβγ┘┌█▄δε▀ζηθικλμνξοπρσςτ΄­±υφχ§ψ΅°¨ωϋΰώ■ "
                },
                ibm869: "cp869",
                csibm869: "cp869",
                cp922: {
                    type: "_sbcs",
                    chars: " ¡¢£¤¥¦§¨©ª«¬­®‾°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏŠÑÒÓÔÕÖ×ØÙÚÛÜÝŽßàáâãäåæçèéêëìíîïšñòóôõö÷øùúûüýžÿ"
                },
                ibm922: "cp922",
                csibm922: "cp922",
                cp1046: {
                    type: "_sbcs",
                    chars: "ﺈ×÷ﹱ■│─┐┌└┘ﹹﹻﹽﹿﹷﺊﻰﻳﻲﻎﻏﻐﻶﻸﻺﻼ ¤ﺋﺑﺗﺛﺟﺣ،­ﺧﺳ٠١٢٣٤٥٦٧٨٩ﺷ؛ﺻﺿﻊ؟ﻋءآأؤإئابةتثجحخدذرزسشصضطﻇعغﻌﺂﺄﺎﻓـفقكلمنهوىيًٌٍَُِّْﻗﻛﻟﻵﻷﻹﻻﻣﻧﻬﻩ�"
                },
                ibm1046: "cp1046",
                csibm1046: "cp1046",
                cp1124: {
                    type: "_sbcs",
                    chars: " ЁЂҐЄЅІЇЈЉЊЋЌ­ЎЏАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя№ёђґєѕіїјљњћќ§ўџ"
                },
                ibm1124: "cp1124",
                csibm1124: "cp1124",
                cp1125: {
                    type: "_sbcs",
                    chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёҐґЄєІіЇї·√№¤■ "
                },
                ibm1125: "cp1125",
                csibm1125: "cp1125",
                cp1129: {
                    type: "_sbcs",
                    chars: " ¡¢£¤¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
                },
                ibm1129: "cp1129",
                csibm1129: "cp1129",
                cp1133: {
                    type: "_sbcs",
                    chars: " ກຂຄງຈສຊຍດຕຖທນບປຜຝພຟມຢຣລວຫອຮ���ຯະາຳິີຶືຸູຼັົຽ���ເແໂໃໄ່້໊໋໌ໍໆ�ໜໝ₭����������������໐໑໒໓໔໕໖໗໘໙��¢¬¦�"
                },
                ibm1133: "cp1133",
                csibm1133: "cp1133",
                cp1161: {
                    type: "_sbcs",
                    chars: "��������������������������������่กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู้๊๋€฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛¢¬¦ "
                },
                ibm1161: "cp1161",
                csibm1161: "cp1161",
                cp1162: {
                    type: "_sbcs",
                    chars: "€…‘’“”•–— กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
                },
                ibm1162: "cp1162",
                csibm1162: "cp1162",
                cp1163: {
                    type: "_sbcs",
                    chars: " ¡¢£€¥¦§œ©ª«¬­®¯°±²³Ÿµ¶·Œ¹º»¼½¾¿ÀÁÂĂÄÅÆÇÈÉÊË̀ÍÎÏĐÑ̉ÓÔƠÖ×ØÙÚÛÜỮßàáâăäåæçèéêë́íîïđṇ̃óôơö÷øùúûüư₫ÿ"
                },
                ibm1163: "cp1163",
                csibm1163: "cp1163",
                maccroatian: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®Š™´¨≠ŽØ∞±≤≥∆µ∂∑∏š∫ªºΩžø¿¡¬√ƒ≈Ć«Č… ÀÃÕŒœĐ—“”‘’÷◊�©⁄¤‹›Æ»–·‚„‰ÂćÁčÈÍÎÏÌÓÔđÒÚÛÙıˆ˜¯πË˚¸Êæˇ"
                },
                maccyrillic: {
                    type: "_sbcs",
                    chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°¢£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµ∂ЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
                },
                macgreek: {
                    type: "_sbcs",
                    chars: "Ä¹²É³ÖÜ΅àâä΄¨çéèêë£™îï•½‰ôö¦­ùûü†ΓΔΘΛΞΠß®©ΣΪ§≠°·Α±≤≥¥ΒΕΖΗΙΚΜΦΫΨΩάΝ¬ΟΡ≈Τ«»… ΥΧΆΈœ–―“”‘’÷ΉΊΌΎέήίόΏύαβψδεφγηιξκλμνοπώρστθωςχυζϊϋΐΰ�"
                },
                maciceland: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûüÝ°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤ÐðÞþý·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
                },
                macroman: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
                },
                macromania: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ĂŞ∞±≤≥¥µ∂∑∏π∫ªºΩăş¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›Ţţ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
                },
                macthai: {
                    type: "_sbcs",
                    chars: "«»…“”�•‘’� กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู﻿​–—฿เแโใไๅๆ็่้๊๋์ํ™๏๐๑๒๓๔๕๖๗๘๙®©����"
                },
                macturkish: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸĞğİıŞş‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙ�ˆ˜¯˘˙˚¸˝˛ˇ"
                },
                macukraine: {
                    type: "_sbcs",
                    chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ†°Ґ£§•¶І®©™Ђђ≠Ѓѓ∞±≤≥іµґЈЄєЇїЉљЊњјЅ¬√ƒ≈∆«»… ЋћЌќѕ–—“”‘’÷„ЎўЏџ№Ёёяабвгдежзийклмнопрстуфхцчшщъыьэю¤"
                },
                koi8r: {
                    type: "_sbcs",
                    chars: "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ё╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡Ё╢╣╤╥╦╧╨╩╪╫╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
                },
                koi8u: {
                    type: "_sbcs",
                    chars: "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґ╝╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪Ґ╬©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
                },
                koi8ru: {
                    type: "_sbcs",
                    chars: "─│┌┐└┘├┤┬┴┼▀▄█▌▐░▒▓⌠■∙√≈≤≥ ⌡°²·÷═║╒ёє╔ії╗╘╙╚╛ґў╞╟╠╡ЁЄ╣ІЇ╦╧╨╩╪ҐЎ©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
                },
                koi8t: {
                    type: "_sbcs",
                    chars: "қғ‚Ғ„…†‡�‰ҳ‹ҲҷҶ�Қ‘’“”•–—�™�›�����ӯӮё¤ӣ¦§���«¬­®�°±²Ё�Ӣ¶·�№�»���©юабцдефгхийклмнопярстужвьызшэщчъЮАБЦДЕФГХИЙКЛМНОПЯРСТУЖВЬЫЗШЭЩЧЪ"
                },
                armscii8: {
                    type: "_sbcs",
                    chars: " �և։)(»«—.՝,-֊…՜՛՞ԱաԲբԳգԴդԵեԶզԷէԸըԹթԺժԻիԼլԽխԾծԿկՀհՁձՂղՃճՄմՅյՆնՇշՈոՉչՊպՋջՌռՍսՎվՏտՐրՑցՒւՓփՔքՕօՖֆ՚�"
                },
                rk1048: {
                    type: "_sbcs",
                    chars: "ЂЃ‚ѓ„…†‡€‰Љ‹ЊҚҺЏђ‘’“”•–—�™љ›њқһџ ҰұӘ¤Ө¦§Ё©Ғ«¬­®Ү°±Ііөµ¶·ё№ғ»әҢңүАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
                },
                tcvn: {
                    type: "_sbcs",
                    chars: "\x00ÚỤỪỬỮ\b\t\n\x0B\f\rỨỰỲỶỸÝỴ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ÀẢÃÁẠẶẬÈẺẼÉẸỆÌỈĨÍỊÒỎÕÓỌỘỜỞỠỚỢÙỦŨ ĂÂÊÔƠƯĐăâêôơưđẶ̀̀̉̃́àảãáạẲằẳẵắẴẮẦẨẪẤỀặầẩẫấậèỂẻẽéẹềểễếệìỉỄẾỒĩíịòỔỏõóọồổỗốộờởỡớợùỖủũúụừửữứựỳỷỹýỵỐ"
                },
                georgianacademy: {
                    type: "_sbcs",
                    chars: "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰჱჲჳჴჵჶçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
                },
                georgianps: {
                    type: "_sbcs",
                    chars: "‚ƒ„…†‡ˆ‰Š‹Œ‘’“”•–—˜™š›œŸ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿აბგდევზჱთიკლმნჲოპჟრსტჳუფქღყშჩცძწჭხჴჯჰჵæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"
                },
                pt154: {
                    type: "_sbcs",
                    chars: "ҖҒӮғ„…ҶҮҲүҠӢҢҚҺҸҗ‘’“”•–—ҳҷҡӣңқһҹ ЎўЈӨҘҰ§Ё©Ә«¬ӯ®Ҝ°ұІіҙө¶·ё№ә»јҪҫҝАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя"
                },
                viscii: {
                    type: "_sbcs",
                    chars: "\x00ẲẴẪ\b\t\n\x0B\f\rỶỸỴ !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ẠẮẰẶẤẦẨẬẼẸẾỀỂỄỆỐỒỔỖỘỢỚỜỞỊỎỌỈỦŨỤỲÕắằặấầẩậẽẹếềểễệốồổỗỠƠộờởịỰỨỪỬơớƯÀÁÂÃẢĂẳẵÈÉÊẺÌÍĨỳĐứÒÓÔạỷừửÙÚỹỵÝỡưàáâãảăữẫèéêẻìíĩỉđựòóôõỏọụùúũủýợỮ"
                },
                iso646cn: {
                    type: "_sbcs",
                    chars: "\x00\b\t\n\x0B\f\r !\"#¥%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
                },
                iso646jp: {
                    type: "_sbcs",
                    chars: "\x00\b\t\n\x0B\f\r !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[¥]^_`abcdefghijklmnopqrstuvwxyz{|}‾��������������������������������������������������������������������������������������������������������������������������������"
                },
                hproman8: {
                    type: "_sbcs",
                    chars: " ÀÂÈÊËÎÏ´ˋˆ¨˜ÙÛ₤¯Ýý°ÇçÑñ¡¿¤£¥§ƒ¢âêôûáéóúàèòùäëöüÅîØÆåíøæÄìÖÜÉïßÔÁÃãÐðÍÌÓÒÕõŠšÚŸÿÞþ·µ¶¾—¼½ªº«■»±�"
                },
                macintosh: {
                    type: "_sbcs",
                    chars: "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ�ÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ"
                },
                ascii: {
                    type: "_sbcs",
                    chars: "��������������������������������������������������������������������������������������������������������������������������������"
                },
                tis620: {
                    type: "_sbcs",
                    chars: "���������������������������������กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรฤลฦวศษสหฬอฮฯะัาำิีึืฺุู����฿เแโใไๅๆ็่้๊๋์ํ๎๏๐๑๒๓๔๕๖๗๘๙๚๛����"
                }
            }
        }, {}
    ],
    65: [function(g, p, m) {
            p.exports = {
                10029: "maccenteuro",
                maccenteuro: {
                    type: "_sbcs",
                    chars: "ÄĀāÉĄÖÜáąČäčĆćéŹźĎíďĒēĖóėôöõúĚěü†°Ę£§•¶ß®©™ę¨≠ģĮįĪ≤≥īĶ∂∑łĻļĽľĹĺŅņŃ¬√ńŇ∆«»… ňŐÕőŌ–—“”‘’÷◊ōŔŕŘ‹›řŖŗŠ‚„šŚśÁŤťÍŽžŪÓÔūŮÚůŰűŲųÝýķŻŁżĢˇ"
                },
                808: "cp808",
                ibm808: "cp808",
                cp808: {
                    type: "_sbcs",
                    chars: "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№€■ "
                },
                ascii8bit: "ascii",
                usascii: "ascii",
                "ansix3.4": "ascii",
                "ansix3.41968": "ascii",
                "ansix3.41986": "ascii",
                csascii: "ascii",
                cp367: "ascii",
                ibm367: "ascii",
                isoir6: "ascii",
                iso646us: "ascii",
                "iso646.irv": "ascii",
                us: "ascii",
                latin1: "iso88591",
                latin2: "iso88592",
                latin3: "iso88593",
                latin4: "iso88594",
                latin5: "iso88599",
                latin6: "iso885910",
                latin7: "iso885913",
                latin8: "iso885914",
                latin9: "iso885915",
                latin10: "iso885916",
                csisolatin1: "iso88591",
                csisolatin2: "iso88592",
                csisolatin3: "iso88593",
                csisolatin4: "iso88594",
                csisolatincyrillic: "iso88595",
                csisolatinarabic: "iso88596",
                csisolatingreek: "iso88597",
                csisolatinhebrew: "iso88598",
                csisolatin5: "iso88599",
                csisolatin6: "iso885910",
                l1: "iso88591",
                l2: "iso88592",
                l3: "iso88593",
                l4: "iso88594",
                l5: "iso88599",
                l6: "iso885910",
                l7: "iso885913",
                l8: "iso885914",
                l9: "iso885915",
                l10: "iso885916",
                isoir14: "iso646jp",
                isoir57: "iso646cn",
                isoir100: "iso88591",
                isoir101: "iso88592",
                isoir109: "iso88593",
                isoir110: "iso88594",
                isoir144: "iso88595",
                isoir127: "iso88596",
                isoir126: "iso88597",
                isoir138: "iso88598",
                isoir148: "iso88599",
                isoir157: "iso885910",
                isoir166: "tis620",
                isoir179: "iso885913",
                isoir199: "iso885914",
                isoir203: "iso885915",
                isoir226: "iso885916",
                cp819: "iso88591",
                ibm819: "iso88591",
                cyrillic: "iso88595",
                arabic: "iso88596",
                arabic8: "iso88596",
                ecma114: "iso88596",
                asmo708: "iso88596",
                greek: "iso88597",
                greek8: "iso88597",
                ecma118: "iso88597",
                elot928: "iso88597",
                hebrew: "iso88598",
                hebrew8: "iso88598",
                turkish: "iso88599",
                turkish8: "iso88599",
                thai: "iso885911",
                thai8: "iso885911",
                celtic: "iso885914",
                celtic8: "iso885914",
                isoceltic: "iso885914",
                tis6200: "tis620",
                "tis620.25291": "tis620",
                "tis620.25330": "tis620",
                1E4: "macroman",
                10006: "macgreek",
                10007: "maccyrillic",
                10079: "maciceland",
                10081: "macturkish",
                cspc8codepage437: "cp437",
                cspc775baltic: "cp775",
                cspc850multilingual: "cp850",
                cspcp852: "cp852",
                cspc862latinhebrew: "cp862",
                cpgr: "cp869",
                msee: "cp1250",
                mscyrl: "cp1251",
                msansi: "cp1252",
                msgreek: "cp1253",
                msturk: "cp1254",
                mshebr: "cp1255",
                msarab: "cp1256",
                winbaltrim: "cp1257",
                cp20866: "koi8r",
                20866: "koi8r",
                ibm878: "koi8r",
                cskoi8r: "koi8r",
                cp21866: "koi8u",
                21866: "koi8u",
                ibm1168: "koi8u",
                strk10482002: "rk1048",
                tcvn5712: "tcvn",
                tcvn57121: "tcvn",
                gb198880: "iso646cn",
                cn: "iso646cn",
                csiso14jisc6220ro: "iso646jp",
                jisc62201969ro: "iso646jp",
                jp: "iso646jp",
                cshproman8: "hproman8",
                r8: "hproman8",
                roman8: "hproman8",
                xroman8: "hproman8",
                ibm1051: "hproman8",
                mac: "macintosh",
                csmacintosh: "macintosh"
            }
        }, {}
    ],
    66: [function(g, p, m) {
            p.exports = [
                ["8740", "䏰䰲䘃䖦䕸𧉧䵷䖳𧲱䳢𧳅㮕䜶䝄䱇䱀𤊿𣘗𧍒𦺋𧃒䱗𪍑䝏䗚䲅𧱬䴇䪤䚡𦬣爥𥩔𡩣𣸆𣽡晍囻"],
                ["8767", "綕夝𨮹㷴霴𧯯寛𡵞媤㘥𩺰嫑宷峼杮薓𩥅瑡璝㡵𡵓𣚞𦀡㻬"],
                ["87a1", "𥣞㫵竼龗𤅡𨤍𣇪𠪊𣉞䌊蒄龖鐯䤰蘓墖靊鈘秐稲晠権袝瑌篅枂稬剏遆㓦珄𥶹瓆鿇垳䤯呌䄱𣚎堘穲𧭥讏䚮𦺈䆁𥶙箮𢒼鿈𢓁𢓉𢓌鿉蔄𣖻䂴鿊䓡𪷿拁灮鿋"],
                ["8840", "㇀", 4, "𠄌㇅𠃑𠃍㇆㇇𠃋𡿨㇈𠃊㇉㇊㇋㇌𠄎㇍㇎ĀÁǍÀĒÉĚÈŌÓǑÒ࿿Ê̄Ế࿿Ê̌ỀÊāáǎàɑēéěèīíǐìōóǒòūúǔùǖǘǚ"],
                ["88a1", "ǜü࿿ê̄ế࿿ê̌ềêɡ⏚⏛"],
                ["8940", "𪎩𡅅"],
                ["8943", "攊"],
                ["8946", "丽滝鵎釟"],
                ["894c",
                        "𧜵撑会伨侨兖兴农凤务动医华发变团声处备夲头学实実岚庆总斉柾栄桥济炼电纤纬纺织经统缆缷艺苏药视设询车轧轮"
                ],
                ["89a1", "琑糼緍楆竉刧"],
                ["89ab", "醌碸酞肼"],
                ["89b0", "贋胶𠧧"],
                ["89b5", "肟黇䳍鷉鸌䰾𩷶𧀎鸊𪄳㗁"],
                ["89c1", "溚舾甙"],
                ["89c5", "䤑马骏龙禇𨑬𡷊𠗐𢫦两亁亀亇亿仫伷㑌侽㹈倃傈㑽㒓㒥円夅凛凼刅争剹劐匧㗇厩㕑厰㕓参吣㕭㕲㚁咓咣咴咹哐哯唘唣唨㖘唿㖥㖿嗗㗅"],
                ["8a40",
                        "𧶄唥"
                ],
                ["8a43", "𠱂𠴕𥄫喐𢳆㧬𠍁蹆𤶸𩓥䁓𨂾睺𢰸㨴䟕𨅝𦧲𤷪擝𠵼𠾴𠳕𡃴撍蹾𠺖𠰋𠽤𢲩𨉖𤓓"],
                ["8a64", "𠵆𩩍𨃩䟴𤺧𢳂骲㩧𩗴㿭㔆𥋇𩟔𧣈𢵄鵮頕"],
                ["8a76", "䏙𦂥撴哣𢵌𢯊𡁷㧻𡁯"],
                ["8aa1", "𦛚𦜖𧦠擪𥁒𠱃蹨𢆡𨭌𠜱"],
                ["8aac", "䠋𠆩㿺塳𢶍"],
                ["8ab2", "𤗈𠓼𦂗𠽌𠶖啹䂻䎺"],
                ["8abb", "䪴𢩦𡂝膪飵𠶜捹㧾𢝵跀嚡摼㹃"],
                ["8ac9", "𪘁𠸉𢫏𢳉"],
                ["8ace", "𡃈𣧂㦒㨆𨊛㕸𥹉𢃇噒𠼱𢲲𩜠㒼氽𤸻"],
                ["8adf", "𧕴𢺋𢈈𪙛𨳍𠹺𠰴𦠜羓𡃏𢠃𢤹㗻𥇣𠺌𠾍𠺪㾓𠼰𠵇𡅏𠹌"],
                ["8af6", "𠺫𠮩𠵈𡃀𡄽㿹𢚖搲𠾭"],
                ["8b40", "𣏴𧘹𢯎𠵾𠵿𢱑𢱕㨘𠺘𡃇𠼮𪘲𦭐𨳒𨶙𨳊閪哌苄喹"],
                ["8b55", "𩻃鰦骶𧝞𢷮煀腭胬尜𦕲脴㞗卟𨂽醶𠻺𠸏𠹷𠻻㗝𤷫㘉𠳖嚯𢞵𡃉𠸐𠹸𡁸𡅈𨈇𡑕𠹹𤹐𢶤婔𡀝𡀞𡃵𡃶垜𠸑"],
                ["8ba1", "𧚔𨋍𠾵𠹻𥅾㜃𠾶𡆀𥋘𪊽𤧚𡠺𤅷𨉼墙剨㘚𥜽箲孨䠀䬬鼧䧧鰟鮍𥭴𣄽嗻㗲嚉丨夂𡯁屮靑𠂆乛亻㔾尣彑忄㣺扌攵歺氵氺灬爫丬犭𤣩罒礻糹罓𦉪㓁"],
                ["8bde", "𦍋耂肀𦘒𦥑卝衤见𧢲讠贝钅镸长门𨸏韦页风飞饣𩠐鱼鸟黄歯龜丷𠂇阝户钢"],
                ["8c40", "倻淾𩱳龦㷉袏𤅎灷峵䬠𥇍㕙𥴰愢𨨲辧釶熑朙玺𣊁𪄇㲋𡦀䬐磤琂冮𨜏䀉橣𪊺䈣蘏𠩯稪𩥇𨫪靕灍匤𢁾鏴盙𨧣龧矝亣俰傼丯众龨吴綋墒壐𡶶庒庙忂𢜒斋"],
                ["8ca1", "𣏹椙橃𣱣泿"],
                ["8ca7", "爀𤔅玌㻛𤨓嬕璹讃𥲤𥚕窓篬糃繬苸薗龩袐龪躹龫迏蕟駠鈡龬𨶹𡐿䁱䊢娚"],
                ["8cc9", "顨杫䉶圽"],
                ["8cce",
                        "藖𤥻芿𧄍䲁𦵴嵻𦬕𦾾龭龮宖龯曧繛湗秊㶈䓃𣉖𢞖䎚䔶"
                ],
                ["8ce6", "峕𣬚諹屸㴒𣕑嵸龲煗䕘𤃬𡸣䱷㥸㑊𠆤𦱁諌侴𠈹妿腬顖𩣺弻"],
                ["8d40", "𠮟"],
                ["8d42", "𢇁𨥭䄂䚻𩁹㼇龳𪆵䃸㟖䛷𦱆䅼𨚲𧏿䕭㣔𥒚䕡䔛䶉䱻䵶䗪㿈𤬏㙡䓞䒽䇭崾嵈嵖㷼㠏嶤嶹㠠㠸幂庽弥徃㤈㤔㤿㥍惗愽峥㦉憷憹懏㦸戬抐拥挘㧸嚱"],
                ["8da1", "㨃揢揻搇摚㩋擀崕嘡龟㪗斆㪽旿晓㫲暒㬢朖㭂枤栀㭘桊梄㭲㭱㭻椉楃牜楤榟榅㮼槖㯝橥橴橱檂㯬檙㯲檫檵櫔櫶殁毁毪汵沪㳋洂洆洦涁㳯涤涱渕渘温溆𨧀溻滢滚齿滨滩漤漴㵆𣽁澁澾㵪㵵熷岙㶊瀬㶑灐灔灯灿炉𠌥䏁㗱𠻘"],
                ["8e40", "𣻗垾𦻓焾𥟠㙎榢𨯩孴穉𥣡𩓙穥穽𥦬窻窰竂竃燑𦒍䇊竚竝竪䇯咲𥰁笋筕笩𥌎𥳾箢筯莜𥮴𦱿篐萡箒箸𥴠㶭𥱥蒒篺簆簵𥳁籄粃𤢂粦晽𤕸糉糇糦籴糳糵糎"],
                ["8ea1", "繧䔝𦹄絝𦻖璍綉綫焵綳緒𤁗𦀩緤㴓緵𡟹緥𨍭縝𦄡𦅚繮纒䌫鑬縧罀罁罇礶𦋐駡羗𦍑羣𡙡𠁨䕜𣝦䔃𨌺翺𦒉者耈耝耨耯𪂇𦳃耻耼聡𢜔䦉𦘦𣷣𦛨朥肧𨩈脇脚墰𢛶汿𦒘𤾸擧𡒊舘𡡞橓𤩥𤪕䑺舩𠬍𦩒𣵾俹𡓽蓢荢𦬊𤦧𣔰𡝳𣷸芪椛芳䇛"],
                ["8f40", "蕋苐茚𠸖𡞴㛁𣅽𣕚艻苢茘𣺋𦶣𦬅𦮗𣗎㶿茝嗬莅䔋𦶥莬菁菓㑾𦻔橗蕚㒖𦹂𢻯葘𥯤葱㷓䓤檧葊𣲵祘蒨𦮖𦹷𦹃蓞萏莑䒠蒓蓤𥲑䉀𥳀䕃蔴嫲𦺙䔧蕳䔖枿蘖"],
                ["8fa1", "𨘥𨘻藁𧂈蘂𡖂𧃍䕫䕪蘨㙈𡢢号𧎚虾蝱𪃸蟮𢰧螱蟚蠏噡虬桖䘏衅衆𧗠𣶹𧗤衞袜䙛袴袵揁装睷𧜏覇覊覦覩覧覼𨨥觧𧤤𧪽誜瞓釾誐𧩙竩𧬺𣾏䜓𧬸煼謌謟𥐰𥕥謿譌譍誩𤩺讐讛誯𡛟䘕衏貛𧵔𧶏貫㜥𧵓賖𧶘𧶽贒贃𡤐賛灜贑𤳉㻐起"],
                ["9040", "趩𨀂𡀔𤦊㭼𨆼𧄌竧躭躶軃鋔輙輭𨍥𨐒辥錃𪊟𠩐辳䤪𨧞𨔽𣶻廸𣉢迹𪀔𨚼𨔁𢌥㦀𦻗逷𨔼𧪾遡𨕬𨘋邨𨜓郄𨛦邮都酧㫰醩釄粬𨤳𡺉鈎沟鉁鉢𥖹銹𨫆𣲛𨬌𥗛"],
                ["90a1", "𠴱錬鍫𨫡𨯫炏嫃𨫢𨫥䥥鉄𨯬𨰹𨯿鍳鑛躼閅閦鐦閠濶䊹𢙺𨛘𡉼𣸮䧟氜陻隖䅬隣𦻕懚隶磵𨫠隽双䦡𦲸𠉴𦐐𩂯𩃥𤫑𡤕𣌊霱虂霶䨏䔽䖅𤫩灵孁霛靜𩇕靗孊𩇫靟鐥僐𣂷𣂼鞉鞟鞱鞾韀韒韠𥑬韮琜𩐳響韵𩐝𧥺䫑頴頳顋顦㬎𧅵㵑𠘰𤅜"],
                ["9140", "𥜆飊颷飈飇䫿𦴧𡛓喰飡飦飬鍸餹𤨩䭲𩡗𩤅駵騌騻騐驘𥜥㛄𩂱𩯕髠髢𩬅髴䰎鬔鬭𨘀倴鬴𦦨㣃𣁽魐魀𩴾婅𡡣鮎𤉋鰂鯿鰌𩹨鷔𩾷𪆒𪆫𪃡𪄣𪇟鵾鶃𪄴鸎梈"],
                ["91a1", "鷄𢅛𪆓𪈠𡤻𪈳鴹𪂹𪊴麐麕麞麢䴴麪麯𤍤黁㭠㧥㴝伲㞾𨰫鼂鼈䮖鐤𦶢鼗鼖鼹嚟嚊齅馸𩂋韲葿齢齩竜龎爖䮾𤥵𤦻煷𤧸𤍈𤩑玞𨯚𡣺禟𨥾𨸶鍩鏳𨩄鋬鎁鏋𨥬𤒹爗㻫睲穃烐𤑳𤏸煾𡟯炣𡢾𣖙㻇𡢅𥐯𡟸㜢𡛻𡠹㛡𡝴𡣑𥽋㜣𡛀坛𤨥𡏾𡊨"],
                ["9240", "𡏆𡒶蔃𣚦蔃葕𤦔𧅥𣸱𥕜𣻻𧁒䓴𣛮𩦝𦼦柹㜳㰕㷧塬𡤢栐䁗𣜿𤃡𤂋𤄏𦰡哋嚞𦚱嚒𠿟𠮨𠸍鏆𨬓鎜仸儫㠙𤐶亼𠑥𠍿佋侊𥙑婨𠆫𠏋㦙𠌊𠐔㐵伩𠋀𨺳𠉵諚𠈌亘"],
                ["92a1", "働儍侢伃𤨎𣺊佂倮偬傁俌俥偘僼兙兛兝兞湶𣖕𣸹𣺿浲𡢄𣺉冨凃𠗠䓝𠒣𠒒𠒑赺𨪜𠜎剙劤𠡳勡鍮䙺熌𤎌𠰠𤦬𡃤槑𠸝瑹㻞璙琔瑖玘䮎𤪼𤂍叐㖄爏𤃉喴𠍅响𠯆圝鉝雴鍦埝垍坿㘾壋媙𨩆𡛺𡝯𡜐娬妸銏婾嫏娒𥥆𡧳𡡡𤊕㛵洅瑃娡𥺃"],
                ["9340", "媁𨯗𠐓鏠璌𡌃焅䥲鐈𨧻鎽㞠尞岞幞幈𡦖𡥼𣫮廍孏𡤃𡤄㜁𡢠㛝𡛾㛓脪𨩇𡶺𣑲𨦨弌弎𡤧𡞫婫𡜻孄蘔𧗽衠恾𢡠𢘫忛㺸𢖯𢖾𩂈𦽳懀𠀾𠁆𢘛憙憘恵𢲛𢴇𤛔𩅍"],
                ["93a1", "摱𤙥𢭪㨩𢬢𣑐𩣪𢹸挷𪑛撶挱揑𤧣𢵧护𢲡搻敫楲㯴𣂎𣊭𤦉𣊫唍𣋠𡣙𩐿曎𣊉𣆳㫠䆐𥖄𨬢𥖏𡛼𥕛𥐥磮𣄃𡠪𣈴㑤𣈏𣆂𤋉暎𦴤晫䮓昰𧡰𡷫晣𣋒𣋡昞𥡲㣑𣠺𣞼㮙𣞢𣏾瓐㮖枏𤘪梶栞㯄檾㡣𣟕𤒇樳橒櫉欅𡤒攑梘橌㯗橺歗𣿀𣲚鎠鋲𨯪𨫋"],
                ["9440", "銉𨀞𨧜鑧涥漋𤧬浧𣽿㶏渄𤀼娽渊塇洤硂焻𤌚𤉶烱牐犇犔𤞏𤜥兹𤪤𠗫瑺𣻸𣙟𤩊𤤗𥿡㼆㺱𤫟𨰣𣼵悧㻳瓌琼鎇琷䒟𦷪䕑疃㽣𤳙𤴆㽘畕癳𪗆㬙瑨𨫌𤦫𤦎㫻"],
                ["94a1", "㷍𤩎㻿𤧅𤣳釺圲鍂𨫣𡡤僟𥈡𥇧睸𣈲眎眏睻𤚗𣞁㩞𤣰琸璛㺿𤪺𤫇䃈𤪖𦆮錇𥖁砞碍碈磒珐祙𧝁𥛣䄎禛蒖禥樭𣻺稺秴䅮𡛦䄲鈵秱𠵌𤦌𠊙𣶺𡝮㖗啫㕰㚪𠇔𠰍竢婙𢛵𥪯𥪜娍𠉛磰娪𥯆竾䇹籝籭䈑𥮳𥺼𥺦糍𤧹𡞰粎籼粮檲緜縇緓罎𦉡"],
                ["9540", "𦅜𧭈綗𥺂䉪𦭵𠤖柖𠁎𣗏埄𦐒𦏸𤥢翝笧𠠬𥫩𥵃笌𥸎駦虅驣樜𣐿㧢𤧷𦖭騟𦖠蒀𧄧𦳑䓪脷䐂胆脉腂𦞴飃𦩂艢艥𦩑葓𦶧蘐𧈛媆䅿𡡀嬫𡢡嫤𡣘蚠蜨𣶏蠭𧐢娂"],
                ["95a1", "衮佅袇袿裦襥襍𥚃襔𧞅𧞄𨯵𨯙𨮜𨧹㺭蒣䛵䛏㟲訽訜𩑈彍鈫𤊄旔焩烄𡡅鵭貟賩𧷜妚矃姰䍮㛔踪躧𤰉輰轊䋴汘澻𢌡䢛潹溋𡟚鯩㚵𤤯邻邗啱䤆醻鐄𨩋䁢𨫼鐧𨰝𨰻蓥訫閙閧閗閖𨴴瑅㻂𤣿𤩂𤏪㻧𣈥随𨻧𨹦𨹥㻌𤧭𤩸𣿮琒瑫㻼靁𩂰"],
                ["9640", "桇䨝𩂓𥟟靝鍨𨦉𨰦𨬯𦎾銺嬑譩䤼珹𤈛鞛靱餸𠼦巁𨯅𤪲頟𩓚鋶𩗗釥䓀𨭐𤩧𨭤飜𨩅㼀鈪䤥萔餻饍𧬆㷽馛䭯馪驜𨭥𥣈檏騡嫾騯𩣱䮐𩥈馼䮽䮗鍽塲𡌂堢𤦸"],
                ["96a1", "𡓨硄𢜟𣶸棅㵽鑘㤧慐𢞁𢥫愇鱏鱓鱻鰵鰐魿鯏𩸭鮟𪇵𪃾鴡䲮𤄄鸘䲰鴌𪆴𪃭𪃳𩤯鶥蒽𦸒𦿟𦮂藼䔳𦶤𦺄𦷰萠藮𦸀𣟗𦁤秢𣖜𣙀䤭𤧞㵢鏛銾鍈𠊿碹鉷鑍俤㑀遤𥕝砽硔碶硋𡝗𣇉𤥁㚚佲濚濙瀞瀞吔𤆵垻壳垊鴖埗焴㒯𤆬燫𦱀𤾗嬨𡞵𨩉"],
                ["9740", "愌嫎娋䊼𤒈㜬䭻𨧼鎻鎸𡣖𠼝葲𦳀𡐓𤋺𢰦𤏁妔𣶷𦝁綨𦅛𦂤𤦹𤦋𨧺鋥珢㻩璴𨭣𡢟㻡𤪳櫘珳珻㻖𤨾𤪔𡟙𤩦𠎧𡐤𤧥瑈𤤖炥𤥶銄珦鍟𠓾錱𨫎𨨖鎆𨯧𥗕䤵𨪂煫"],
                ["97a1", "𤥃𠳿嚤𠘚𠯫𠲸唂秄𡟺緾𡛂𤩐𡡒䔮鐁㜊𨫀𤦭妰𡢿𡢃𧒄媡㛢𣵛㚰鉟婹𨪁𡡢鍴㳍𠪴䪖㦊僴㵩㵌𡎜煵䋻𨈘渏𩃤䓫浗𧹏灧沯㳖𣿭𣸭渂漌㵯𠏵畑㚼㓈䚀㻚䡱姄鉮䤾轁𨰜𦯀堒埈㛖𡑒烾𤍢𤩱𢿣𡊰𢎽梹楧𡎘𣓥𧯴𣛟𨪃𣟖𣏺𤲟樚𣚭𦲷萾䓟䓎"],
                ["9840", "𦴦𦵑𦲂𦿞漗𧄉茽𡜺菭𦲀𧁓𡟛妉媂𡞳婡婱𡤅𤇼㜭姯𡜼㛇熎鎐暚𤊥婮娫𤊓樫𣻹𧜶𤑛𤋊焝𤉙𨧡侰𦴨峂𤓎𧹍𤎽樌𤉖𡌄炦焳𤏩㶥泟勇𤩏繥姫崯㷳彜𤩝𡟟綤萦"],
                ["98a1", "咅𣫺𣌀𠈔坾𠣕𠘙㿥𡾞𪊶瀃𩅛嵰玏糓𨩙𩐠俈翧狍猐𧫴猸猹𥛶獁獈㺩𧬘遬燵𤣲珡臶㻊県㻑沢国琙琞琟㻢㻰㻴㻺瓓㼎㽓畂畭畲疍㽼痈痜㿀癍㿗癴㿜発𤽜熈嘣覀塩䀝睃䀹条䁅㗛瞘䁪䁯属瞾矋売砘点砜䂨砹硇硑硦葈𥔵礳栃礲䄃"],
                ["9940", "䄉禑禙辻稆込䅧窑䆲窼艹䇄竏竛䇏両筢筬筻簒簛䉠䉺类粜䊌粸䊔糭输烀𠳏総緔緐緽羮羴犟䎗耠耥笹耮耱联㷌垴炠肷胩䏭脌猪脎脒畠脔䐁㬹腖腙腚"],
                ["99a1", "䐓堺腼膄䐥膓䐭膥埯臁臤艔䒏芦艶苊苘苿䒰荗险榊萅烵葤惣蒈䔄蒾蓡蓸蔐蔸蕒䔻蕯蕰藠䕷虲蚒蚲蛯际螋䘆䘗袮裿褤襇覑𧥧訩訸誔誴豑賔賲贜䞘塟跃䟭仮踺嗘坔蹱嗵躰䠷軎転軤軭軲辷迁迊迌逳駄䢭飠鈓䤞鈨鉘鉫銱銮銿"],
                ["9a40",
                        "鋣鋫鋳鋴鋽鍃鎄鎭䥅䥑麿鐗匁鐝鐭鐾䥪鑔鑹锭関䦧间阳䧥枠䨤靀䨵鞲韂噔䫤惨颹䬙飱塄餎餙冴餜餷饂饝饢䭰駅䮝騼鬏窃魩鮁鯝鯱鯴䱭鰠㝯𡯂鵉鰺"
                ],
                ["9aa1", "黾噐鶓鶽鷀鷼银辶鹻麬麱麽黆铜黢黱黸竈齄𠂔𠊷𠎠椚铃妬𠓗塀铁㞹𠗕𠘕𠙶𡚺块煳𠫂𠫍𠮿呪吆𠯋咞𠯻𠰻𠱓𠱥𠱼惧𠲍噺𠲵𠳝𠳭𠵯𠶲𠷈楕鰯螥𠸄𠸎𠻗𠾐𠼭𠹳尠𠾼帋𡁜𡁏𡁶朞𡁻𡂈𡂖㙇𡂿𡃓𡄯𡄻卤蒭𡋣𡍵𡌶讁𡕷𡘙𡟃𡟇乸炻𡠭𡥪"],
                ["9b40", "𡨭𡩅𡰪𡱰𡲬𡻈拃𡻕𡼕熘桕𢁅槩㛈𢉼𢏗𢏺𢜪𢡱𢥏苽𢥧𢦓𢫕覥𢫨辠𢬎鞸𢬿顇骽𢱌"],
                ["9b62", "𢲈𢲷𥯨𢴈𢴒𢶷𢶕𢹂𢽴𢿌𣀳𣁦𣌟𣏞徱晈暿𧩹𣕧𣗳爁𤦺矗𣘚𣜖纇𠍆墵朎"],
                ["9ba1", "椘𣪧𧙗𥿢𣸑𣺹𧗾𢂚䣐䪸𤄙𨪚𤋮𤌍𤀻𤌴𤎖𤩅𠗊凒𠘑妟𡺨㮾𣳿𤐄𤓖垈𤙴㦛𤜯𨗨𩧉㝢𢇃譞𨭎駖𤠒𤣻𤨕爉𤫀𠱸奥𤺥𤾆𠝹軚𥀬劏圿煱𥊙𥐙𣽊𤪧喼𥑆𥑮𦭒釔㑳𥔿𧘲𥕞䜘𥕢𥕦𥟇𤤿𥡝偦㓻𣏌惞𥤃䝼𨥈𥪮𥮉𥰆𡶐垡煑澶𦄂𧰒遖𦆲𤾚譢𦐂𦑊"],
                ["9c40", "嵛𦯷輶𦒄𡤜諪𤧶𦒈𣿯𦔒䯀𦖿𦚵𢜛鑥𥟡憕娧晉侻嚹𤔡𦛼乪𤤴陖涏𦲽㘘襷𦞙𦡮𦐑𦡞營𦣇筂𩃀𠨑𦤦鄄𦤹穅鷰𦧺騦𦨭㙟𦑩𠀡禃𦨴𦭛崬𣔙菏𦮝䛐𦲤画补𦶮墶"],
                ["9ca1", "㜜𢖍𧁋𧇍㱔𧊀𧊅銁𢅺𧊋錰𧋦𤧐氹钟𧑐𠻸蠧裵𢤦𨑳𡞱溸𤨪𡠠㦤㚹尐秣䔿暶𩲭𩢤襃𧟌𧡘囖䃟𡘊㦡𣜯𨃨𡏅熭荦𧧝𩆨婧䲷𧂯𨦫𧧽𧨊𧬋𧵦𤅺筃祾𨀉澵𪋟樃𨌘厢𦸇鎿栶靝𨅯𨀣𦦵𡏭𣈯𨁈嶅𨰰𨂃圕頣𨥉嶫𤦈斾槕叒𤪥𣾁㰑朶𨂐𨃴𨄮𡾡𨅏"],
                ["9d40", "𨆉𨆯𨈚𨌆𨌯𨎊㗊𨑨𨚪䣺揦𨥖砈鉕𨦸䏲𨧧䏟𨧨𨭆𨯔姸𨰉輋𨿅𩃬筑𩄐𩄼㷷𩅞𤫊运犏嚋𩓧𩗩𩖰𩖸𩜲𩣑𩥉𩥪𩧃𩨨𩬎𩵚𩶛纟𩻸𩼣䲤镇𪊓熢𪋿䶑递𪗋䶜𠲜达嗁"],
                ["9da1", "辺𢒰边𤪓䔉繿潖檱仪㓤𨬬𧢝㜺躀𡟵𨀤𨭬𨮙𧨾𦚯㷫𧙕𣲷𥘵𥥖亚𥺁𦉘嚿𠹭踎孭𣺈𤲞揞拐𡟶𡡻攰嘭𥱊吚𥌑㷆𩶘䱽嘢嘞罉𥻘奵𣵀蝰东𠿪𠵉𣚺脗鵞贘瘻鱅癎瞹鍅吲腈苷嘥脲萘肽嗪祢噃吖𠺝㗎嘅嗱曱𨋢㘭甴嗰喺咗啲𠱁𠲖廐𥅈𠹶𢱢"],
                ["9e40", "𠺢麫絚嗞𡁵抝靭咔賍燶酶揼掹揾啩𢭃鱲𢺳冚㓟𠶧冧呍唞唓癦踭𦢊疱肶蠄螆裇膶萜𡃁䓬猄𤜆宐茋𦢓噻𢛴𧴯𤆣𧵳𦻐𧊶酰𡇙鈈𣳼𪚩𠺬𠻹牦𡲢䝎𤿂𧿹𠿫䃺"],
                ["9ea1", "鱝攟𢶠䣳𤟠𩵼𠿬𠸊恢𧖣𠿭"],
                ["9ead", "𦁈𡆇熣纎鵐业丄㕷嬍沲卧㚬㧜卽㚥𤘘墚𤭮舭呋垪𥪕𠥹"],
                ["9ec5", "㩒𢑥獴𩺬䴉鯭𣳾𩼰䱛𤾩𩖞𩿞葜𣶶𧊲𦞳𣜠挮紥𣻷𣸬㨪逈勌㹴㙺䗩𠒎癀嫰𠺶硺𧼮墧䂿噼鮋嵴癔𪐴麅䳡痹㟻愙𣃚𤏲"],
                ["9ef5", "噝𡊩垧𤥣𩸆刴𧂮㖭汊鵼"],
                ["9f40", "籖鬹埞𡝬屓擓𩓐𦌵𧅤蚭𠴨𦴢𤫢𠵱"],
                ["9f4f", "凾𡼏嶎霃𡷑麁遌笟鬂峑箣扨挵髿篏鬪籾鬮籂粆鰕篼鬉鼗鰛𤤾齚啳寃俽麘俲剠㸆勑坧偖妷帒韈鶫轜呩鞴饀鞺匬愰"],
                ["9fa1", "椬叚鰊鴂䰻陁榀傦畆𡝭駚剳"],
                ["9fae", "酙隁酜"],
                ["9fb2", "酑𨺗捿𦴣櫊嘑醎畺抅𠏼獏籰𥰡𣳽"],
                ["9fc1", "𤤙盖鮝个𠳔莾衂"],
                ["9fc9", "届槀僭坺刟巵从氱𠇲伹咜哚劚趂㗾弌㗳"],
                ["9fdb",
                        "歒酼龥鮗頮颴骺麨麄煺笔"
                ],
                ["9fe7", "毺蠘罸"],
                ["9feb", "嘠𪙊蹷齓"],
                ["9ff0", "跔蹏鸜踁抂𨍽踨蹵竓𤩷稾磘泪詧瘇"],
                ["a040", "𨩚鼦泎蟖痃𪊲硓咢贌狢獱謭猂瓱賫𤪻蘯徺袠䒷"],
                ["a055", "𡠻𦸅"],
                ["a058", "詾𢔛"],
                ["a05b", "惽癧髗鵄鍮鮏蟵"],
                ["a063", "蠏賷猬霡鮰㗖犲䰇籑饊𦅙慙䰄麖慽"],
                ["a073", "坟慯抦戹拎㩜懢厪𣏵捤栂㗒"],
                ["a0a1", "嵗𨯂迚𨸹"],
                ["a0a6", "僙𡵆礆匲阸𠼻䁥"],
                ["a0ae", "矾"],
                ["a0b0", "糂𥼚糚稭聦聣絍甅瓲覔舚朌聢𧒆聛瓰脃眤覉𦟌畓𦻑螩蟎臈螌詉貭譃眫瓸蓚㘵榲趦"],
                ["a0d4", "覩瑨涹蟁𤀑瓧㷛煶悤憜㳑煢恷"],
                ["a0e2", "罱𨬭牐惩䭾删㰘𣳇𥻗𧙖𥔱𡥄𡋾𩤃𦷜𧂭峁𦆭𨨏𣙷𠃮𦡆𤼎䕢嬟𦍌齐麦𦉫"],
                ["a3c0", "␀", 31, "␡"],
                ["c6a1", "①", 9, "⑴", 9, "ⅰ", 9, "丶丿亅亠冂冖冫勹匸卩厶夊宀巛⼳广廴彐彡攴无疒癶辵隶¨ˆヽヾゝゞ〃仝々〆〇ー［］✽ぁ", 23],
                ["c740", "す", 58, "ァアィイ"],
                ["c7a1", "ゥ", 81, "А", 5, "ЁЖ", 4],
                ["c840", "Л", 26, "ёж", 25, "⇧↸↹㇏𠃌乚𠂊刂䒑"],
                ["c8a1", "龰冈龱𧘇"],
                ["c8cd", "￢￤＇＂㈱№℡゛゜⺀⺄⺆⺇⺈⺊⺌⺍⺕⺜⺝⺥⺧⺪⺬⺮⺶⺼⺾⻆⻊⻌⻍⻏⻖⻗⻞⻣"],
                ["c8f5", "ʃɐɛɔɵœøŋʊɪ"],
                ["f9fe", "￭"],
                ["fa40", "𠕇鋛𠗟𣿅蕌䊵珯况㙉𤥂𨧤鍄𡧛苮𣳈砼杄拟𤤳𨦪𠊠𦮳𡌅侫𢓭倈𦴩𧪄𣘀𤪱𢔓倩𠍾徤𠎀𠍇滛𠐟偽儁㑺儎顬㝃萖𤦤𠒇兠𣎴兪𠯿𢃼𠋥𢔰𠖎𣈳𡦃宂蝽𠖳𣲙冲冸"],
                ["faa1", "鴴凉减凑㳜凓𤪦决凢卂凭菍椾𣜭彻刋刦刼劵剗劔効勅簕蕂勠蘍𦬓包𨫞啉滙𣾀𠥔𣿬匳卄𠯢泋𡜦栛珕恊㺪㣌𡛨燝䒢卭却𨚫卾卿𡖖𡘓矦厓𨪛厠厫厮玧𥝲㽙玜叁叅汉义埾叙㪫𠮏叠𣿫𢶣叶𠱷吓灹唫晗浛呭𦭓𠵴啝咏咤䞦𡜍𠻝㶴𠵍"],
                ["fb40", "𨦼𢚘啇䳭启琗喆喩嘅𡣗𤀺䕒𤐵暳𡂴嘷曍𣊊暤暭噍噏磱囱鞇叾圀囯园𨭦㘣𡉏坆𤆥汮炋坂㚱𦱾埦𡐖堃𡑔𤍣堦𤯵塜墪㕡壠壜𡈼壻寿坃𪅐𤉸鏓㖡够梦㛃湙"],
                ["fba1", "𡘾娤啓𡚒蔅姉𠵎𦲁𦴪𡟜姙𡟻𡞲𦶦浱𡠨𡛕姹𦹅媫婣㛦𤦩婷㜈媖瑥嫓𦾡𢕔㶅𡤑㜲𡚸広勐孶斈孼𧨎䀄䡝𠈄寕慠𡨴𥧌𠖥寳宝䴐尅𡭄尓珎尔𡲥𦬨屉䣝岅峩峯嶋𡷹𡸷崐崘嵆𡺤岺巗苼㠭𤤁𢁉𢅳芇㠶㯂帮檊幵幺𤒼𠳓厦亷廐厨𡝱帉廴𨒂"],
                ["fc40", "廹廻㢠廼栾鐛弍𠇁弢㫞䢮𡌺强𦢈𢏐彘𢑱彣鞽𦹮彲鍀𨨶徧嶶㵟𥉐𡽪𧃸𢙨釖𠊞𨨩怱暅𡡷㥣㷇㘹垐𢞴祱㹀悞悤悳𤦂𤦏𧩓璤僡媠慤萤慂慈𦻒憁凴𠙖憇宪𣾷"],
                ["fca1", "𢡟懓𨮝𩥝懐㤲𢦀𢣁怣慜攞掋𠄘担𡝰拕𢸍捬𤧟㨗搸揸𡎎𡟼撐澊𢸶頔𤂌𥜝擡擥鑻㩦携㩗敍漖𤨨𤨣斅敭敟𣁾斵𤥀䬷旑䃘𡠩无旣忟𣐀昘𣇷𣇸晄𣆤𣆥晋𠹵晧𥇦晳晴𡸽𣈱𨗴𣇈𥌓矅𢣷馤朂𤎜𤨡㬫槺𣟂杞杧杢𤇍𩃭柗䓩栢湐鈼栁𣏦𦶠桝"],
                ["fd40", "𣑯槡樋𨫟楳棃𣗍椁椀㴲㨁𣘼㮀枬楡𨩊䋼椶榘㮡𠏉荣傐槹𣙙𢄪橅𣜃檝㯳枱櫈𩆜㰍欝𠤣惞欵歴𢟍溵𣫛𠎵𡥘㝀吡𣭚毡𣻼毜氷𢒋𤣱𦭑汚舦汹𣶼䓅𣶽𤆤𤤌𤤀"],
                ["fda1", "𣳉㛥㳫𠴲鮃𣇹𢒑羏样𦴥𦶡𦷫涖浜湼漄𤥿𤂅𦹲蔳𦽴凇沜渝萮𨬡港𣸯瑓𣾂秌湏媑𣁋濸㜍澝𣸰滺𡒗𤀽䕕鏰潄潜㵎潴𩅰㴻澟𤅄濓𤂑𤅕𤀹𣿰𣾴𤄿凟𤅖𤅗𤅀𦇝灋灾炧炁烌烕烖烟䄄㷨熴熖𤉷焫煅媈煊煮岜𤍥煏鍢𤋁焬𤑚𤨧𤨢熺𨯨炽爎"],
                ["fe40", "鑂爕夑鑃爤鍁𥘅爮牀𤥴梽牕牗㹕𣁄栍漽犂猪猫𤠣𨠫䣭𨠄猨献珏玪𠰺𦨮珉瑉𤇢𡛧𤨤昣㛅𤦷𤦍𤧻珷琕椃𤨦琹𠗃㻗瑜𢢭瑠𨺲瑇珤瑶莹瑬㜰瑴鏱樬璂䥓𤪌"],
                ["fea1", "𤅟𤩹𨮏孆𨰃𡢞瓈𡦈甎瓩甞𨻙𡩋寗𨺬鎅畍畊畧畮𤾂㼄𤴓疎瑝疞疴瘂瘬癑癏癯癶𦏵皐臯㟸𦤑𦤎皡皥皷盌𦾟葢𥂝𥅽𡸜眞眦着撯𥈠睘𣊬瞯𨥤𨥨𡛁矴砉𡍶𤨒棊碯磇磓隥礮𥗠磗礴碱𧘌辸袄𨬫𦂃𢘜禆褀椂禀𥡗禝𧬹礼禩渪𧄦㺨秆𩄍秔"]
            ]
        }, {}
    ],
    67: [function(g, p, m) {
            p.exports = [
                ["0", "\x00", 127, "€"],
                ["8140", "丂丄丅丆丏丒丗丟丠両丣並丩丮丯丱丳丵丷丼乀乁乂乄乆乊乑乕乗乚乛乢乣乤乥乧乨乪", 5, "乲乴", 9, "乿", 6, "亇亊"],
                ["8180", "亐亖亗亙亜亝亞亣亪亯亰亱亴亶亷亸亹亼亽亾仈仌仏仐仒仚仛仜仠仢仦仧仩仭仮仯仱仴仸仹仺仼仾伀伂", 6, "伋伌伒", 4, "伜伝伡伣伨伩伬伭伮伱伳伵伷伹伻伾", 4, "佄佅佇", 5, "佒佔佖佡佢佦佨佪佫佭佮佱佲併佷佸佹佺佽侀侁侂侅來侇侊侌侎侐侒侓侕侖侘侙侚侜侞侟価侢"],
                ["8240", "侤侫侭侰", 4, "侶", 8, "俀俁係俆俇俈俉俋俌俍俒", 4, "俙俛俠俢俤俥俧俫俬俰俲俴俵俶俷俹俻俼俽俿", 11],
                ["8280", "個倎倐們倓倕倖倗倛倝倞倠倢倣値倧倫倯", 10, "倻倽倿偀偁偂偄偅偆偉偊偋偍偐", 4, "偖偗偘偙偛偝", 7, "偦", 5, "偭", 8, "偸偹偺偼偽傁傂傃傄傆傇傉傊傋傌傎", 20, "傤傦傪傫傭", 4, "傳", 6, "傼"],
                ["8340", "傽", 17, "僐", 5, "僗僘僙僛", 10, "僨僩僪僫僯僰僱僲僴僶", 4, "僼", 9, "儈"],
                ["8380", "儉儊儌", 5, "儓",
                        13, "儢", 28, "兂兇兊兌兎兏児兒兓兗兘兙兛兝", 4, "兣兤兦內兩兪兯兲兺兾兿冃冄円冇冊冋冎冏冐冑冓冔冘冚冝冞冟冡冣冦", 4, "冭冮冴冸冹冺冾冿凁凂凃凅凈凊凍凎凐凒", 5
                ],
                ["8440", "凘凙凚凜凞凟凢凣凥", 5, "凬凮凱凲凴凷凾刄刅刉刋刌刏刐刓刔刕刜刞刟刡刢刣別刦刧刪刬刯刱刲刴刵刼刾剄", 5, "剋剎剏剒剓剕剗剘"],
                ["8480", "剙剚剛剝剟剠剢剣剤剦剨剫剬剭剮剰剱剳", 9, "剾劀劃", 4, "劉", 6, "劑劒劔", 6,
                        "劜劤劥劦劧劮劯劰労", 9, "勀勁勂勄勅勆勈勊勌勍勎勏勑勓勔動勗務", 5, "勠勡勢勣勥", 10, "勱", 7, "勻勼勽匁匂匃匄匇匉匊匋匌匎"
                ],
                ["8540", "匑匒匓匔匘匛匜匞匟匢匤匥匧匨匩匫匬匭匯", 9, "匼匽區卂卄卆卋卌卍卐協単卙卛卝卥卨卪卬卭卲卶卹卻卼卽卾厀厁厃厇厈厊厎厏"],
                ["8580", "厐", 4, "厖厗厙厛厜厞厠厡厤厧厪厫厬厭厯", 6, "厷厸厹厺厼厽厾叀參", 4, "収叏叐叒叓叕叚叜叝叞叡叢叧叴叺叾叿吀吂吅吇吋吔吘吙吚吜吢吤吥吪吰吳吶吷吺吽吿呁呂呄呅呇呉呌呍呎呏呑呚呝",
                        4, "呣呥呧呩", 7, "呴呹呺呾呿咁咃咅咇咈咉咊咍咑咓咗咘咜咞咟咠咡"
                ],
                ["8640", "咢咥咮咰咲咵咶咷咹咺咼咾哃哅哊哋哖哘哛哠", 4, "哫哬哯哰哱哴", 5, "哻哾唀唂唃唄唅唈唊", 4, "唒唓唕", 5, "唜唝唞唟唡唥唦"],
                ["8680", "唨唩唫唭唲唴唵唶唸唹唺唻唽啀啂啅啇啈啋", 4, "啑啒啓啔啗", 4, "啝啞啟啠啢啣啨啩啫啯", 5, "啹啺啽啿喅喆喌喍喎喐喒喓喕喖喗喚喛喞喠", 6, "喨", 8, "喲喴営喸喺喼喿", 4, "嗆嗇嗈嗊嗋嗎嗏嗐嗕嗗",
                        4, "嗞嗠嗢嗧嗩嗭嗮嗰嗱嗴嗶嗸", 4, "嗿嘂嘃嘄嘅"
                ],
                ["8740", "嘆嘇嘊嘋嘍嘐", 7, "嘙嘚嘜嘝嘠嘡嘢嘥嘦嘨嘩嘪嘫嘮嘯嘰嘳嘵嘷嘸嘺嘼嘽嘾噀", 11, "噏", 4, "噕噖噚噛噝", 4],
                ["8780", "噣噥噦噧噭噮噯噰噲噳噴噵噷噸噹噺噽", 7, "嚇", 6, "嚐嚑嚒嚔", 14, "嚤", 10, "嚰", 6, "嚸嚹嚺嚻嚽", 12, "囋", 8, "囕囖囘囙囜団囥", 5, "囬囮囯囲図囶囷囸囻囼圀圁圂圅圇國", 6],
                ["8840", "園", 9, "圝圞圠圡圢圤圥圦圧圫圱圲圴", 4, "圼圽圿坁坃坄坅坆坈坉坋坒",
                        4, "坘坙坢坣坥坧坬坮坰坱坲坴坵坸坹坺坽坾坿垀"
                ],
                ["8880", "垁垇垈垉垊垍", 4, "垔", 6, "垜垝垞垟垥垨垪垬垯垰垱垳垵垶垷垹", 8, "埄", 6, "埌埍埐埑埓埖埗埛埜埞埡埢埣埥", 7, "埮埰埱埲埳埵埶執埻埼埾埿堁堃堄堅堈堉堊堌堎堏堐堒堓堔堖堗堘堚堛堜堝堟堢堣堥", 4, "堫", 4, "報堲堳場堶", 7],
                ["8940", "堾", 5, "塅", 6, "塎塏塐塒塓塕塖塗塙", 4, "塟", 5, "塦", 4, "塭", 16, "塿墂墄墆墇墈墊墋墌"],
                ["8980", "墍", 4, "墔", 4, "墛墜墝墠",
                        7, "墪", 17, "墽墾墿壀壂壃壄壆", 10, "壒壓壔壖", 13, "壥", 5, "壭壯壱売壴壵壷壸壺", 7, "夃夅夆夈", 4, "夎夐夑夒夓夗夘夛夝夞夠夡夢夣夦夨夬夰夲夳夵夶夻"
                ],
                ["8a40", "夽夾夿奀奃奅奆奊奌奍奐奒奓奙奛", 4, "奡奣奤奦", 12, "奵奷奺奻奼奾奿妀妅妉妋妌妎妏妐妑妔妕妘妚妛妜妝妟妠妡妢妦"],
                ["8a80", "妧妬妭妰妱妳", 5, "妺妼妽妿", 6, "姇姈姉姌姍姎姏姕姖姙姛姞", 4, "姤姦姧姩姪姫姭", 11, "姺姼姽姾娀娂娊娋娍娎娏娐娒娔娕娖娗娙娚娛娝娞娡娢娤娦娧娨娪",
                        6, "娳娵娷", 4, "娽娾娿婁", 4, "婇婈婋", 9, "婖婗婘婙婛", 5
                ],
                ["8b40", "婡婣婤婥婦婨婩婫", 8, "婸婹婻婼婽婾媀", 17, "媓", 6, "媜", 13, "媫媬"],
                ["8b80", "媭", 4, "媴媶媷媹", 4, "媿嫀嫃", 5, "嫊嫋嫍", 4, "嫓嫕嫗嫙嫚嫛嫝嫞嫟嫢嫤嫥嫧嫨嫪嫬", 4, "嫲", 22, "嬊", 11, "嬘", 25, "嬳嬵嬶嬸", 7, "孁", 6],
                ["8c40", "孈", 7, "孒孖孞孠孡孧孨孫孭孮孯孲孴孶孷學孹孻孼孾孿宂宆宊宍宎宐宑宒宔宖実宧宨宩宬宭宮宯宱宲宷宺宻宼寀寁寃寈寉寊寋寍寎寏"],
                ["8c80", "寑寔", 8, "寠寢寣實寧審", 4, "寯寱", 6, "寽対尀専尃尅將專尋尌對導尐尒尓尗尙尛尞尟尠尡尣尦尨尩尪尫尭尮尯尰尲尳尵尶尷屃屄屆屇屌屍屒屓屔屖屗屘屚屛屜屝屟屢層屧", 6, "屰屲", 6, "屻屼屽屾岀岃", 4, "岉岊岋岎岏岒岓岕岝", 4, "岤", 4],
                ["8d40", "岪岮岯岰岲岴岶岹岺岻岼岾峀峂峃峅", 5, "峌", 5, "峓", 5, "峚", 6, "峢峣峧峩峫峬峮峯峱", 9, "峼", 4],
                ["8d80", "崁崄崅崈", 5, "崏", 4, "崕崗崘崙崚崜崝崟", 4, "崥崨崪崫崬崯",
                        4, "崵", 7, "崿", 7, "嵈嵉嵍", 10, "嵙嵚嵜嵞", 10, "嵪嵭嵮嵰嵱嵲嵳嵵", 12, "嶃", 21, "嶚嶛嶜嶞嶟嶠"
                ],
                ["8e40", "嶡", 21, "嶸", 12, "巆", 6, "巎", 12, "巜巟巠巣巤巪巬巭"],
                ["8e80", "巰巵巶巸", 4, "巿帀帄帇帉帊帋帍帎帒帓帗帞", 7, "帨", 4, "帯帰帲", 4, "帹帺帾帿幀幁幃幆", 5, "幍", 6, "幖", 4, "幜幝幟幠幣", 14, "幵幷幹幾庁庂広庅庈庉庌庍庎庒庘庛庝庡庢庣庤庨", 4, "庮", 4, "庴庺庻庼庽庿", 6],
                ["8f40", "廆廇廈廋", 5, "廔廕廗廘廙廚廜", 11, "廩廫",
                        8, "廵廸廹廻廼廽弅弆弇弉弌弍弎弐弒弔弖弙弚弜弝弞弡弢弣弤"
                ],
                ["8f80", "弨弫弬弮弰弲", 6, "弻弽弾弿彁", 14, "彑彔彙彚彛彜彞彟彠彣彥彧彨彫彮彯彲彴彵彶彸彺彽彾彿徃徆徍徎徏徑従徔徖徚徛徝從徟徠徢", 5, "復徫徬徯", 5, "徶徸徹徺徻徾", 4, "忇忈忊忋忎忓忔忕忚忛応忞忟忢忣忥忦忨忩忬忯忰忲忳忴忶忷忹忺忼怇"],
                ["9040", "怈怉怋怌怐怑怓怗怘怚怞怟怢怣怤怬怭怮怰", 4, "怶", 4, "怽怾恀恄", 6, "恌恎恏恑恓恔恖恗恘恛恜恞恟恠恡恥恦恮恱恲恴恵恷恾悀"],
                ["9080", "悁悂悅悆悇悈悊悋悎悏悐悑悓悕悗悘悙悜悞悡悢悤悥悧悩悪悮悰悳悵悶悷悹悺悽", 7, "惇惈惉惌", 4, "惒惓惔惖惗惙惛惞惡", 4, "惪惱惲惵惷惸惻", 4, "愂愃愄愅愇愊愋愌愐", 4, "愖愗愘愙愛愜愝愞愡愢愥愨愩愪愬", 18, "慀", 6],
                ["9140", "慇慉態慍慏慐慒慓慔慖", 6, "慞慟慠慡慣慤慥慦慩", 6, "慱慲慳慴慶慸", 18, "憌憍憏", 4, "憕"],
                ["9180", "憖", 6, "憞", 8, "憪憫憭", 9, "憸", 5, "憿懀懁懃", 4, "應懌", 4, "懓懕", 16, "懧", 13, "懶",
                        8, "戀", 5, "戇戉戓戔戙戜戝戞戠戣戦戧戨戩戫戭戯戰戱戲戵戶戸", 4, "扂扄扅扆扊"
                ],
                ["9240", "扏扐払扖扗扙扚扜", 6, "扤扥扨扱扲扴扵扷扸扺扻扽抁抂抃抅抆抇抈抋", 5, "抔抙抜抝択抣抦抧抩抪抭抮抯抰抲抳抴抶抷抸抺抾拀拁"],
                ["9280", "拃拋拏拑拕拝拞拠拡拤拪拫拰拲拵拸拹拺拻挀挃挄挅挆挊挋挌挍挏挐挒挓挔挕挗挘挙挜挦挧挩挬挭挮挰挱挳", 5, "挻挼挾挿捀捁捄捇捈捊捑捒捓捔捖", 7, "捠捤捥捦捨捪捫捬捯捰捲捳捴捵捸捹捼捽捾捿掁掃掄掅掆掋掍掑掓掔掕掗掙",
                        6, "採掤掦掫掯掱掲掵掶掹掻掽掿揀"
                ],
                ["9340", "揁揂揃揅揇揈揊揋揌揑揓揔揕揗", 6, "揟揢揤", 4, "揫揬揮揯揰揱揳揵揷揹揺揻揼揾搃搄搆", 4, "損搎搑搒搕", 5, "搝搟搢搣搤"],
                ["9380", "搥搧搨搩搫搮", 5, "搵", 4, "搻搼搾摀摂摃摉摋", 6, "摓摕摖摗摙", 4, "摟", 7, "摨摪摫摬摮", 9, "摻", 6, "撃撆撈", 8, "撓撔撗撘撚撛撜撝撟", 4, "撥撦撧撨撪撫撯撱撲撳撴撶撹撻撽撾撿擁擃擄擆", 6, "擏擑擓擔擕擖擙據"],
                ["9440", "擛擜擝擟擠擡擣擥擧",
                        24, "攁", 7, "攊", 7, "攓", 4, "攙", 8
                ],
                ["9480", "攢攣攤攦", 4, "攬攭攰攱攲攳攷攺攼攽敀", 4, "敆敇敊敋敍敎敐敒敓敔敗敘敚敜敟敠敡敤敥敧敨敩敪敭敮敯敱敳敵敶數", 14, "斈斉斊斍斎斏斒斔斕斖斘斚斝斞斠斢斣斦斨斪斬斮斱", 7, "斺斻斾斿旀旂旇旈旉旊旍旐旑旓旔旕旘", 7, "旡旣旤旪旫"],
                ["9540", "旲旳旴旵旸旹旻", 4, "昁昄昅昇昈昉昋昍昐昑昒昖昗昘昚昛昜昞昡昢昣昤昦昩昪昫昬昮昰昲昳昷", 4, "昽昿晀時晄", 6,
                        "晍晎晐晑晘"
                ],
                ["9580", "晙晛晜晝晞晠晢晣晥晧晩", 4, "晱晲晳晵晸晹晻晼晽晿暀暁暃暅暆暈暉暊暋暍暎暏暐暒暓暔暕暘", 4, "暞", 8, "暩", 4, "暯", 4, "暵暶暷暸暺暻暼暽暿", 25, "曚曞", 7, "曧曨曪", 5, "曱曵曶書曺曻曽朁朂會"],
                ["9640", "朄朅朆朇朌朎朏朑朒朓朖朘朙朚朜朞朠", 5, "朧朩朮朰朲朳朶朷朸朹朻朼朾朿杁杄杅杇杊杋杍杒杔杕杗", 4, "杝杢杣杤杦杧杫杬杮東杴杶"],
                ["9680", "杸杹杺杻杽枀枂枃枅枆枈枊枌枍枎枏枑枒枓枔枖枙枛枟枠枡枤枦枩枬枮枱枲枴枹",
                        7, "柂柅", 9, "柕柖柗柛柟柡柣柤柦柧柨柪柫柭柮柲柵", 7, "柾栁栂栃栄栆栍栐栒栔栕栘", 4, "栞栟栠栢", 6, "栫", 6, "栴栵栶栺栻栿桇桋桍桏桒桖", 5
                ],
                ["9740", "桜桝桞桟桪桬", 7, "桵桸", 8, "梂梄梇", 7, "梐梑梒梔梕梖梘", 9, "梣梤梥梩梪梫梬梮梱梲梴梶梷梸"],
                ["9780", "梹", 6, "棁棃", 5, "棊棌棎棏棐棑棓棔棖棗棙棛", 4, "棡棢棤", 9, "棯棲棳棴棶棷棸棻棽棾棿椀椂椃椄椆", 4, "椌椏椑椓", 11, "椡椢椣椥", 7, "椮椯椱椲椳椵椶椷椸椺椻椼椾楀楁楃",
                        16, "楕楖楘楙楛楜楟"
                ],
                ["9840", "楡楢楤楥楧楨楩楪楬業楯楰楲", 4, "楺楻楽楾楿榁榃榅榊榋榌榎", 5, "榖榗榙榚榝", 9, "榩榪榬榮榯榰榲榳榵榶榸榹榺榼榽"],
                ["9880", "榾榿槀槂", 7, "構槍槏槑槒槓槕", 5, "槜槝槞槡", 11, "槮槯槰槱槳", 9, "槾樀", 9, "樋", 11, "標", 5, "樠樢", 5, "権樫樬樭樮樰樲樳樴樶", 6, "樿", 4, "橅橆橈", 7, "橑", 6, "橚"],
                ["9940", "橜", 4, "橢橣橤橦", 10, "橲", 6, "橺橻橽橾橿檁檂檃檅", 8, "檏檒", 4, "檘", 7, "檡", 5],
                ["9980", "檧檨檪檭",
                        114, "欥欦欨", 6
                ],
                ["9a40", "欯欰欱欳欴欵欶欸欻欼欽欿歀歁歂歄歅歈歊歋歍", 11, "歚", 7, "歨歩歫", 13, "歺歽歾歿殀殅殈"],
                ["9a80", "殌殎殏殐殑殔殕殗殘殙殜", 4, "殢", 7, "殫", 7, "殶殸", 6, "毀毃毄毆", 4, "毌毎毐毑毘毚毜", 4, "毢", 7, "毬毭毮毰毱毲毴毶毷毸毺毻毼毾", 6, "氈", 4, "氎氒気氜氝氞氠氣氥氫氬氭氱氳氶氷氹氺氻氼氾氿汃汄汅汈汋", 4, "汑汒汓汖汘"],
                ["9b40", "汙汚汢汣汥汦汧汫", 4, "汱汳汵汷汸決汻汼汿沀沄沇沊沋沍沎沑沒沕沖沗沘沚沜沝沞沠沢沨沬沯沰沴沵沶沷沺泀況泂泃泆泇泈泋泍泎泏泑泒泘"],
                ["9b80", "泙泚泜泝泟泤泦泧泩泬泭泲泴泹泿洀洂洃洅洆洈洉洊洍洏洐洑洓洔洕洖洘洜洝洟", 5, "洦洨洩洬洭洯洰洴洶洷洸洺洿浀浂浄浉浌浐浕浖浗浘浛浝浟浡浢浤浥浧浨浫浬浭浰浱浲浳浵浶浹浺浻浽", 4, "涃涄涆涇涊涋涍涏涐涒涖", 4, "涜涢涥涬涭涰涱涳涴涶涷涹", 5, "淁淂淃淈淉淊"],
                ["9c40", "淍淎淏淐淒淓淔淕淗淚淛淜淟淢淣淥淧淨淩淪淭淯淰淲淴淵淶淸淺淽", 7, "渆渇済渉渋渏渒渓渕渘渙減渜渞渟渢渦渧渨渪測渮渰渱渳渵"],
                ["9c80", "渶渷渹渻", 7, "湅", 7, "湏湐湑湒湕湗湙湚湜湝湞湠", 10, "湬湭湯", 14, "満溁溂溄溇溈溊", 4, "溑", 6, "溙溚溛溝溞溠溡溣溤溦溨溩溫溬溭溮溰溳溵溸溹溼溾溿滀滃滄滅滆滈滉滊滌滍滎滐滒滖滘滙滛滜滝滣滧滪", 5],
                ["9d40", "滰滱滲滳滵滶滷滸滺", 7, "漃漄漅漇漈漊", 4, "漐漑漒漖", 9, "漡漢漣漥漦漧漨漬漮漰漲漴漵漷", 6, "漿潀潁潂"],
                ["9d80", "潃潄潅潈潉潊潌潎", 9, "潙潚潛潝潟潠潡潣潤潥潧", 5, "潯潰潱潳潵潶潷潹潻潽",
                        6, "澅澆澇澊澋澏", 12, "澝澞澟澠澢", 4, "澨", 10, "澴澵澷澸澺", 5, "濁濃", 5, "濊", 6, "濓", 10, "濟濢濣濤濥"
                ],
                ["9e40", "濦", 7, "濰", 32, "瀒", 7, "瀜", 6, "瀤", 6],
                ["9e80", "瀫", 9, "瀶瀷瀸瀺", 17, "灍灎灐", 13, "灟", 11, "灮灱灲灳灴灷灹灺灻災炁炂炃炄炆炇炈炋炌炍炏炐炑炓炗炘炚炛炞", 12, "炰炲炴炵炶為炾炿烄烅烆烇烉烋", 12, "烚"],
                ["9f40", "烜烝烞烠烡烢烣烥烪烮烰", 6, "烸烺烻烼烾", 10, "焋", 4, "焑焒焔焗焛", 10, "焧", 7, "焲焳焴"],
                ["9f80",
                        "焵焷", 13, "煆煇煈煉煋煍煏", 12, "煝煟", 4, "煥煩", 4, "煯煰煱煴煵煶煷煹煻煼煾", 5, "熅", 4, "熋熌熍熎熐熑熒熓熕熖熗熚", 4, "熡", 6, "熩熪熫熭", 5, "熴熶熷熸熺", 8, "燄", 9, "燏", 4
                ],
                ["a040", "燖", 9, "燡燢燣燤燦燨", 5, "燯", 9, "燺", 11, "爇", 19],
                ["a080", "爛爜爞", 9, "爩爫爭爮爯爲爳爴爺爼爾牀", 6, "牉牊牋牎牏牐牑牓牔牕牗牘牚牜牞牠牣牤牥牨牪牫牬牭牰牱牳牴牶牷牸牻牼牽犂犃犅", 4, "犌犎犐犑犓", 11, "犠", 11, "犮犱犲犳犵犺",
                        6, "狅狆狇狉狊狋狌狏狑狓狔狕狖狘狚狛"
                ],
                ["a1a1", "　、。·ˉˇ¨〃々—～‖…‘’“”〔〕〈", 7, "〖〗【】±×÷∶∧∨∑∏∪∩∈∷√⊥∥∠⌒⊙∫∮≡≌≈∽∝≠≮≯≤≥∞∵∴♂♀°′″℃＄¤￠￡‰§№☆★○●◎◇◆□■△▲※→←↑↓〓"],
                ["a2a1", "ⅰ", 9],
                ["a2b1", "⒈", 19, "⑴", 19, "①", 9],
                ["a2e5", "㈠", 9],
                ["a2f1", "Ⅰ", 11],
                ["a3a1", "！＂＃￥％", 88, "￣"],
                ["a4a1", "ぁ", 82],
                ["a5a1", "ァ", 85],
                ["a6a1", "Α", 16, "Σ",
                        6
                ],
                ["a6c1", "α", 16, "σ", 6],
                ["a6e0", "︵︶︹︺︿﹀︽︾﹁﹂﹃﹄"],
                ["a6ee", "︻︼︷︸︱"],
                ["a6f4", "︳︴"],
                ["a7a1", "А", 5, "ЁЖ", 25],
                ["a7d1", "а", 5, "ёж", 25],
                ["a840", "ˊˋ˙–―‥‵℅℉↖↗↘↙∕∟∣≒≦≧⊿═", 35, "▁", 6],
                ["a880", "█", 7, "▓▔▕▼▽◢◣◤◥☉⊕〒〝〞"],
                ["a8a1", "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüêɑ"],
                ["a8bd", "ńň"],
                ["a8c0", "ɡ"],
                ["a8c5", "ㄅ", 36],
                ["a940", "〡", 8, "㊣㎎㎏㎜㎝㎞㎡㏄㏎㏑㏒㏕︰￢￤"],
                ["a959",
                        "℡㈱"
                ],
                ["a95c", "‐"],
                ["a960", "ー゛゜ヽヾ〆ゝゞ﹉", 9, "﹔﹕﹖﹗﹙", 8],
                ["a980", "﹢", 4, "﹨﹩﹪﹫"],
                ["a996", "〇"],
                ["a9a4", "─", 75],
                ["aa40", "狜狝狟狢", 5, "狪狫狵狶狹狽狾狿猀猂猄", 5, "猋猌猍猏猐猑猒猔猘猙猚猟猠猣猤猦猧猨猭猯猰猲猳猵猶猺猻猼猽獀", 8],
                ["aa80", "獉獊獋獌獎獏獑獓獔獕獖獘", 7, "獡", 10, "獮獰獱"],
                ["ab40", "獲", 11, "獿", 4, "玅玆玈玊玌玍玏玐玒玓玔玕玗玘玙玚玜玝玞玠玡玣", 5, "玪玬玭玱玴玵玶玸玹玼玽玾玿珁珃",
                        4
                ],
                ["ab80", "珋珌珎珒", 6, "珚珛珜珝珟珡珢珣珤珦珨珪珫珬珮珯珰珱珳", 4],
                ["ac40", "珸", 10, "琄琇琈琋琌琍琎琑", 8, "琜", 5, "琣琤琧琩琫琭琯琱琲琷", 4, "琽琾琿瑀瑂", 11],
                ["ac80", "瑎", 6, "瑖瑘瑝瑠", 12, "瑮瑯瑱", 4, "瑸瑹瑺"],
                ["ad40", "瑻瑼瑽瑿璂璄璅璆璈璉璊璌璍璏璑", 10, "璝璟", 7, "璪", 15, "璻", 12],
                ["ad80", "瓈", 9, "瓓", 8, "瓝瓟瓡瓥瓧", 6, "瓰瓱瓲"],
                ["ae40", "瓳瓵瓸", 6, "甀甁甂甃甅", 7, "甎甐甒甔甕甖甗甛甝甞甠", 4, "甦甧甪甮甴甶甹甼甽甿畁畂畃畄畆畇畉畊畍畐畑畒畓畕畖畗畘"],
                ["ae80", "畝", 7, "畧畨畩畫", 6, "畳畵當畷畺", 4, "疀疁疂疄疅疇"],
                ["af40", "疈疉疊疌疍疎疐疓疕疘疛疜疞疢疦", 4, "疭疶疷疺疻疿痀痁痆痋痌痎痏痐痑痓痗痙痚痜痝痟痠痡痥痩痬痭痮痯痲痳痵痶痷痸痺痻痽痾瘂瘄瘆瘇"],
                ["af80", "瘈瘉瘋瘍瘎瘏瘑瘒瘓瘔瘖瘚瘜瘝瘞瘡瘣瘧瘨瘬瘮瘯瘱瘲瘶瘷瘹瘺瘻瘽癁療癄"],
                ["b040", "癅", 6, "癎", 5, "癕癗", 4, "癝癟癠癡癢癤", 6, "癬癭癮癰", 7, "癹発發癿皀皁皃皅皉皊皌皍皏皐皒皔皕皗皘皚皛"],
                ["b080", "皜", 7, "皥", 8, "皯皰皳皵", 9, "盀盁盃啊阿埃挨哎唉哀皑癌蔼矮艾碍爱隘鞍氨安俺按暗岸胺案肮昂盎凹敖熬翱袄傲奥懊澳芭捌扒叭吧笆八疤巴拔跋靶把耙坝霸罢爸白柏百摆佰败拜稗斑班搬扳般颁板版扮拌伴瓣半办绊邦帮梆榜膀绑棒磅蚌镑傍谤苞胞包褒剥"],
                ["b140", "盄盇盉盋盌盓盕盙盚盜盝盞盠", 4, "盦", 7, "盰盳盵盶盷盺盻盽盿眀眂眃眅眆眊県眎", 10, "眛眜眝眞眡眣眤眥眧眪眫"],
                ["b180", "眬眮眰",
                        4, "眹眻眽眾眿睂睄睅睆睈", 7, "睒", 7, "睜薄雹保堡饱宝抱报暴豹鲍爆杯碑悲卑北辈背贝钡倍狈备惫焙被奔苯本笨崩绷甭泵蹦迸逼鼻比鄙笔彼碧蓖蔽毕毙毖币庇痹闭敝弊必辟壁臂避陛鞭边编贬扁便变卞辨辩辫遍标彪膘表鳖憋别瘪彬斌濒滨宾摈兵冰柄丙秉饼炳"
                ],
                ["b240", "睝睞睟睠睤睧睩睪睭", 11, "睺睻睼瞁瞂瞃瞆", 5, "瞏瞐瞓", 11, "瞡瞣瞤瞦瞨瞫瞭瞮瞯瞱瞲瞴瞶", 4],
                ["b280", "瞼瞾矀", 12, "矎", 8, "矘矙矚矝",
                        4, "矤病并玻菠播拨钵波博勃搏铂箔伯帛舶脖膊渤泊驳捕卜哺补埠不布步簿部怖擦猜裁材才财睬踩采彩菜蔡餐参蚕残惭惨灿苍舱仓沧藏操糙槽曹草厕策侧册测层蹭插叉茬茶查碴搽察岔差诧拆柴豺搀掺蝉馋谗缠铲产阐颤昌猖"
                ],
                ["b340", "矦矨矪矯矰矱矲矴矵矷矹矺矻矼砃", 5, "砊砋砎砏砐砓砕砙砛砞砠砡砢砤砨砪砫砮砯砱砲砳砵砶砽砿硁硂硃硄硆硈硉硊硋硍硏硑硓硔硘硙硚"],
                ["b380", "硛硜硞",
                        11, "硯", 7, "硸硹硺硻硽", 6, "场尝常长偿肠厂敞畅唱倡超抄钞朝嘲潮巢吵炒车扯撤掣彻澈郴臣辰尘晨忱沉陈趁衬撑称城橙成呈乘程惩澄诚承逞骋秤吃痴持匙池迟弛驰耻齿侈尺赤翅斥炽充冲虫崇宠抽酬畴踌稠愁筹仇绸瞅丑臭初出橱厨躇锄雏滁除楚"
                ],
                ["b440", "碄碅碆碈碊碋碏碐碒碔碕碖碙碝碞碠碢碤碦碨", 7, "碵碶碷碸確碻碼碽碿磀磂磃磄磆磇磈磌磍磎磏磑磒磓磖磗磘磚", 9],
                ["b480", "磤磥磦磧磩磪磫磭",
                        4, "磳磵磶磸磹磻", 5, "礂礃礄礆", 6, "础储矗搐触处揣川穿椽传船喘串疮窗幢床闯创吹炊捶锤垂春椿醇唇淳纯蠢戳绰疵茨磁雌辞慈瓷词此刺赐次聪葱囱匆从丛凑粗醋簇促蹿篡窜摧崔催脆瘁粹淬翠村存寸磋撮搓措挫错搭达答瘩打大呆歹傣戴带殆代贷袋待逮"
                ],
                ["b540", "礍", 5, "礔", 9, "礟", 4, "礥", 14, "礵", 4, "礽礿祂祃祄祅祇祊", 8, "祔祕祘祙祡祣"],
                ["b580", "祤祦祩祪祫祬祮祰", 6, "祹祻", 4, "禂禃禆禇禈禉禋禌禍禎禐禑禒怠耽担丹单郸掸胆旦氮但惮淡诞弹蛋当挡党荡档刀捣蹈倒岛祷导到稻悼道盗德得的蹬灯登等瞪凳邓堤低滴迪敌笛狄涤翟嫡抵底地蒂第帝弟递缔颠掂滇碘点典靛垫电佃甸店惦奠淀殿碉叼雕凋刁掉吊钓调跌爹碟蝶迭谍叠"],
                ["b640", "禓", 6, "禛", 11, "禨", 10, "禴", 4, "禼禿秂秄秅秇秈秊秌秎秏秐秓秔秖秗秙", 5, "秠秡秢秥秨秪"],
                ["b680", "秬秮秱", 6, "秹秺秼秾秿稁稄稅稇稈稉稊稌稏", 4, "稕稖稘稙稛稜丁盯叮钉顶鼎锭定订丢东冬董懂动栋侗恫冻洞兜抖斗陡豆逗痘都督毒犊独读堵睹赌杜镀肚度渡妒端短锻段断缎堆兑队对墩吨蹲敦顿囤钝盾遁掇哆多夺垛躲朵跺舵剁惰堕蛾峨鹅俄额讹娥恶厄扼遏鄂饿恩而儿耳尔饵洱二"],
                ["b740",
                        "稝稟稡稢稤", 14, "稴稵稶稸稺稾穀", 5, "穇", 9, "穒", 4, "穘", 16
                ],
                ["b780", "穩", 6, "穱穲穳穵穻穼穽穾窂窅窇窉窊窋窌窎窏窐窓窔窙窚窛窞窡窢贰发罚筏伐乏阀法珐藩帆番翻樊矾钒繁凡烦反返范贩犯饭泛坊芳方肪房防妨仿访纺放菲非啡飞肥匪诽吠肺废沸费芬酚吩氛分纷坟焚汾粉奋份忿愤粪丰封枫蜂峰锋风疯烽逢冯缝讽奉凤佛否夫敷肤孵扶拂辐幅氟符伏俘服"],
                ["b840", "窣窤窧窩窪窫窮", 4, "窴", 10, "竀",
                        10, "竌", 9, "竗竘竚竛竜竝竡竢竤竧", 5, "竮竰竱竲竳"
                ],
                ["b880", "竴", 4, "竻竼竾笀笁笂笅笇笉笌笍笎笐笒笓笖笗笘笚笜笝笟笡笢笣笧笩笭浮涪福袱弗甫抚辅俯釜斧脯腑府腐赴副覆赋复傅付阜父腹负富讣附妇缚咐噶嘎该改概钙盖溉干甘杆柑竿肝赶感秆敢赣冈刚钢缸肛纲岗港杠篙皋高膏羔糕搞镐稿告哥歌搁戈鸽胳疙割革葛格蛤阁隔铬个各给根跟耕更庚羹"],
                ["b940", "笯笰笲笴笵笶笷笹笻笽笿", 5, "筆筈筊筍筎筓筕筗筙筜筞筟筡筣",
                        10, "筯筰筳筴筶筸筺筼筽筿箁箂箃箄箆", 6, "箎箏"
                ],
                ["b980", "箑箒箓箖箘箙箚箛箞箟箠箣箤箥箮箯箰箲箳箵箶箷箹", 7, "篂篃範埂耿梗工攻功恭龚供躬公宫弓巩汞拱贡共钩勾沟苟狗垢构购够辜菇咕箍估沽孤姑鼓古蛊骨谷股故顾固雇刮瓜剐寡挂褂乖拐怪棺关官冠观管馆罐惯灌贯光广逛瑰规圭硅归龟闺轨鬼诡癸桂柜跪贵刽辊滚棍锅郭国果裹过哈"],
                ["ba40", "篅篈築篊篋篍篎篏篐篒篔", 4, "篛篜篞篟篠篢篣篤篧篨篩篫篬篭篯篰篲",
                        4, "篸篹篺篻篽篿", 7, "簈簉簊簍簎簐", 5, "簗簘簙"
                ],
                ["ba80", "簚", 4, "簠", 5, "簨簩簫", 12, "簹", 5, "籂骸孩海氦亥害骇酣憨邯韩含涵寒函喊罕翰撼捍旱憾悍焊汗汉夯杭航壕嚎豪毫郝好耗号浩呵喝荷菏核禾和何合盒貉阂河涸赫褐鹤贺嘿黑痕很狠恨哼亨横衡恒轰哄烘虹鸿洪宏弘红喉侯猴吼厚候后呼乎忽瑚壶葫胡蝴狐糊湖"],
                ["bb40", "籃", 9, "籎", 36, "籵", 5, "籾", 9],
                ["bb80", "粈粊", 6, "粓粔粖粙粚粛粠粡粣粦粧粨粩粫粬粭粯粰粴",
                        4, "粺粻弧虎唬护互沪户花哗华猾滑画划化话槐徊怀淮坏欢环桓还缓换患唤痪豢焕涣宦幻荒慌黄磺蝗簧皇凰惶煌晃幌恍谎灰挥辉徽恢蛔回毁悔慧卉惠晦贿秽会烩汇讳诲绘荤昏婚魂浑混豁活伙火获或惑霍货祸击圾基机畸稽积箕"
                ],
                ["bc40", "粿糀糂糃糄糆糉糋糎", 6, "糘糚糛糝糞糡", 6, "糩", 5, "糰", 7, "糹糺糼", 13, "紋", 5],
                ["bc80", "紑", 14, "紡紣紤紥紦紨紩紪紬紭紮細", 6, "肌饥迹激讥鸡姬绩缉吉极棘辑籍集及急疾汲即嫉级挤几脊己蓟技冀季伎祭剂悸济寄寂计记既忌际妓继纪嘉枷夹佳家加荚颊贾甲钾假稼价架驾嫁歼监坚尖笺间煎兼肩艰奸缄茧检柬碱硷拣捡简俭剪减荐槛鉴践贱见键箭件"],
                ["bd40", "紷", 54, "絯", 7],
                ["bd80", "絸", 32, "健舰剑饯渐溅涧建僵姜将浆江疆蒋桨奖讲匠酱降蕉椒礁焦胶交郊浇骄娇嚼搅铰矫侥脚狡角饺缴绞剿教酵轿较叫窖揭接皆秸街阶截劫节桔杰捷睫竭洁结解姐戒藉芥界借介疥诫届巾筋斤金今津襟紧锦仅谨进靳晋禁近烬浸"],
                ["be40", "継", 12, "綧", 6, "綯", 42],
                ["be80", "線", 32, "尽劲荆兢茎睛晶鲸京惊精粳经井警景颈静境敬镜径痉靖竟竞净炯窘揪究纠玖韭久灸九酒厩救旧臼舅咎就疚鞠拘狙疽居驹菊局咀矩举沮聚拒据巨具距踞锯俱句惧炬剧捐鹃娟倦眷卷绢撅攫抉掘倔爵觉决诀绝均菌钧军君峻"],
                ["bf40", "緻", 62],
                ["bf80", "縺縼", 4, "繂", 4, "繈", 21, "俊竣浚郡骏喀咖卡咯开揩楷凯慨刊堪勘坎砍看康慷糠扛抗亢炕考拷烤靠坷苛柯棵磕颗科壳咳可渴克刻客课肯啃垦恳坑吭空恐孔控抠口扣寇枯哭窟苦酷库裤夸垮挎跨胯块筷侩快宽款匡筐狂框矿眶旷况亏盔岿窥葵奎魁傀"],
                ["c040", "繞", 35, "纃", 23, "纜纝纞"],
                ["c080", "纮纴纻纼绖绤绬绹缊缐缞缷缹缻", 6, "罃罆", 9, "罒罓馈愧溃坤昆捆困括扩廓阔垃拉喇蜡腊辣啦莱来赖蓝婪栏拦篮阑兰澜谰揽览懒缆烂滥琅榔狼廊郎朗浪捞劳牢老佬姥酪烙涝勒乐雷镭蕾磊累儡垒擂肋类泪棱楞冷厘梨犁黎篱狸离漓理李里鲤礼莉荔吏栗丽厉励砾历利傈例俐"],
                ["c140", "罖罙罛罜罝罞罠罣", 4, "罫罬罭罯罰罳罵罶罷罸罺罻罼罽罿羀羂", 7, "羋羍羏", 4, "羕", 4, "羛羜羠羢羣羥羦羨", 6, "羱"],
                ["c180", "羳", 4, "羺羻羾翀翂翃翄翆翇翈翉翋翍翏", 4, "翖翗翙", 5, "翢翣痢立粒沥隶力璃哩俩联莲连镰廉怜涟帘敛脸链恋炼练粮凉梁粱良两辆量晾亮谅撩聊僚疗燎寥辽潦了撂镣廖料列裂烈劣猎琳林磷霖临邻鳞淋凛赁吝拎玲菱零龄铃伶羚凌灵陵岭领另令溜琉榴硫馏留刘瘤流柳六龙聋咙笼窿"],
                ["c240", "翤翧翨翪翫翬翭翯翲翴", 6, "翽翾翿耂耇耈耉耊耎耏耑耓耚耛耝耞耟耡耣耤耫", 5, "耲耴耹耺耼耾聀聁聄聅聇聈聉聎聏聐聑聓聕聖聗"],
                ["c280", "聙聛", 13, "聫", 5, "聲", 11, "隆垄拢陇楼娄搂篓漏陋芦卢颅庐炉掳卤虏鲁麓碌露路赂鹿潞禄录陆戮驴吕铝侣旅履屡缕虑氯律率滤绿峦挛孪滦卵乱掠略抡轮伦仑沦纶论萝螺罗逻锣箩骡裸落洛骆络妈麻玛码蚂马骂嘛吗埋买麦卖迈脉瞒馒蛮满蔓曼慢漫"],
                ["c340", "聾肁肂肅肈肊肍", 5, "肔肕肗肙肞肣肦肧肨肬肰肳肵肶肸肹肻胅胇", 4, "胏", 6, "胘胟胠胢胣胦胮胵胷胹胻胾胿脀脁脃脄脅脇脈脋"],
                ["c380", "脌脕脗脙脛脜脝脟", 12, "脭脮脰脳脴脵脷脹", 4, "脿谩芒茫盲氓忙莽猫茅锚毛矛铆卯茂冒帽貌贸么玫枚梅酶霉煤没眉媒镁每美昧寐妹媚门闷们萌蒙檬盟锰猛梦孟眯醚靡糜迷谜弥米秘觅泌蜜密幂棉眠绵冕免勉娩缅面苗描瞄藐秒渺庙妙蔑灭民抿皿敏悯闽明螟鸣铭名命谬摸"],
                ["c440", "腀", 5, "腇腉腍腎腏腒腖腗腘腛", 4, "腡腢腣腤腦腨腪腫腬腯腲腳腵腶腷腸膁膃", 4, "膉膋膌膍膎膐膒", 5, "膙膚膞", 4, "膤膥"],
                ["c480", "膧膩膫", 7, "膴", 5, "膼膽膾膿臄臅臇臈臉臋臍", 6, "摹蘑模膜磨摩魔抹末莫墨默沫漠寞陌谋牟某拇牡亩姆母墓暮幕募慕木目睦牧穆拿哪呐钠那娜纳氖乃奶耐奈南男难囊挠脑恼闹淖呢馁内嫩能妮霓倪泥尼拟你匿腻逆溺蔫拈年碾撵捻念娘酿鸟尿捏聂孽啮镊镍涅您柠狞凝宁"],
                ["c540", "臔", 14, "臤臥臦臨臩臫臮", 4, "臵", 5, "臽臿舃與", 4, "舎舏舑舓舕", 5, "舝舠舤舥舦舧舩舮舲舺舼舽舿"],
                ["c580", "艀艁艂艃艅艆艈艊艌艍艎艐", 7, "艙艛艜艝艞艠", 7, "艩拧泞牛扭钮纽脓浓农弄奴努怒女暖虐疟挪懦糯诺哦欧鸥殴藕呕偶沤啪趴爬帕怕琶拍排牌徘湃派攀潘盘磐盼畔判叛乓庞旁耪胖抛咆刨炮袍跑泡呸胚培裴赔陪配佩沛喷盆砰抨烹澎彭蓬棚硼篷膨朋鹏捧碰坯砒霹批披劈琵毗"],
                ["c640", "艪艫艬艭艱艵艶艷艸艻艼芀芁芃芅芆芇芉芌芐芓芔芕芖芚芛芞芠芢芣芧芲芵芶芺芻芼芿苀苂苃苅苆苉苐苖苙苚苝苢苧苨苩苪苬苭苮苰苲苳苵苶苸"],
                ["c680", "苺苼", 4, "茊茋茍茐茒茓茖茘茙茝", 9, "茩茪茮茰茲茷茻茽啤脾疲皮匹痞僻屁譬篇偏片骗飘漂瓢票撇瞥拼频贫品聘乒坪苹萍平凭瓶评屏坡泼颇婆破魄迫粕剖扑铺仆莆葡菩蒲埔朴圃普浦谱曝瀑期欺栖戚妻七凄漆柒沏其棋奇歧畦崎脐齐旗祈祁骑起岂乞企启契砌器气迄弃汽泣讫掐"],
                ["c740", "茾茿荁荂荄荅荈荊", 4, "荓荕", 4, "荝荢荰", 6, "荹荺荾", 6, "莇莈莊莋莌莍莏莐莑莔莕莖莗莙莚莝莟莡", 6, "莬莭莮"],
                ["c780", "莯莵莻莾莿菂菃菄菆菈菉菋菍菎菐菑菒菓菕菗菙菚菛菞菢菣菤菦菧菨菫菬菭恰洽牵扦钎铅千迁签仟谦乾黔钱钳前潜遣浅谴堑嵌欠歉枪呛腔羌墙蔷强抢橇锹敲悄桥瞧乔侨巧鞘撬翘峭俏窍切茄且怯窃钦侵亲秦琴勤芹擒禽寝沁青轻氢倾卿清擎晴氰情顷请庆琼穷秋丘邱球求囚酋泅趋区蛆曲躯屈驱渠"],
                ["c840", "菮華菳", 4, "菺菻菼菾菿萀萂萅萇萈萉萊萐萒", 5, "萙萚萛萞", 5, "萩", 7, "萲", 5, "萹萺萻萾",
                        7, "葇葈葉"
                ],
                ["c880", "葊", 6, "葒", 4, "葘葝葞葟葠葢葤", 4, "葪葮葯葰葲葴葷葹葻葼取娶龋趣去圈颧权醛泉全痊拳犬券劝缺炔瘸却鹊榷确雀裙群然燃冉染瓤壤攘嚷让饶扰绕惹热壬仁人忍韧任认刃妊纫扔仍日戎茸蓉荣融熔溶容绒冗揉柔肉茹蠕儒孺如辱乳汝入褥软阮蕊瑞锐闰润若弱撒洒萨腮鳃塞赛三叁"],
                ["c940", "葽", 4, "蒃蒄蒅蒆蒊蒍蒏", 7, "蒘蒚蒛蒝蒞蒟蒠蒢", 12, "蒰蒱蒳蒵蒶蒷蒻蒼蒾蓀蓂蓃蓅蓆蓇蓈蓋蓌蓎蓏蓒蓔蓕蓗"],
                ["c980", "蓘", 4, "蓞蓡蓢蓤蓧", 4, "蓭蓮蓯蓱", 10, "蓽蓾蔀蔁蔂伞散桑嗓丧搔骚扫嫂瑟色涩森僧莎砂杀刹沙纱傻啥煞筛晒珊苫杉山删煽衫闪陕擅赡膳善汕扇缮墒伤商赏晌上尚裳梢捎稍烧芍勺韶少哨邵绍奢赊蛇舌舍赦摄射慑涉社设砷申呻伸身深娠绅神沈审婶甚肾慎渗声生甥牲升绳"],
                ["ca40", "蔃", 8, "蔍蔎蔏蔐蔒蔔蔕蔖蔘蔙蔛蔜蔝蔞蔠蔢", 8, "蔭", 9, "蔾", 4, "蕄蕅蕆蕇蕋", 10],
                ["ca80", "蕗蕘蕚蕛蕜蕝蕟", 4, "蕥蕦蕧蕩",
                        8, "蕳蕵蕶蕷蕸蕼蕽蕿薀薁省盛剩胜圣师失狮施湿诗尸虱十石拾时什食蚀实识史矢使屎驶始式示士世柿事拭誓逝势是嗜噬适仕侍释饰氏市恃室视试收手首守寿授售受瘦兽蔬枢梳殊抒输叔舒淑疏书赎孰熟薯暑曙署蜀黍鼠属术述树束戍竖墅庶数漱"
                ],
                ["cb40", "薂薃薆薈", 6, "薐", 10, "薝", 6, "薥薦薧薩薫薬薭薱", 5, "薸薺", 6, "藂", 6, "藊", 4, "藑藒"],
                ["cb80", "藔藖", 5, "藝", 6, "藥藦藧藨藪", 14, "恕刷耍摔衰甩帅栓拴霜双爽谁水睡税吮瞬顺舜说硕朔烁斯撕嘶思私司丝死肆寺嗣四伺似饲巳松耸怂颂送宋讼诵搜艘擞嗽苏酥俗素速粟僳塑溯宿诉肃酸蒜算虽隋随绥髓碎岁穗遂隧祟孙损笋蓑梭唆缩琐索锁所塌他它她塔"],
                ["cc40", "藹藺藼藽藾蘀", 4, "蘆", 10, "蘒蘓蘔蘕蘗", 15, "蘨蘪", 13, "蘹蘺蘻蘽蘾蘿虀"],
                ["cc80", "虁", 11, "虒虓處", 4, "虛虜虝號虠虡虣", 7, "獭挞蹋踏胎苔抬台泰酞太态汰坍摊贪瘫滩坛檀痰潭谭谈坦毯袒碳探叹炭汤塘搪堂棠膛唐糖倘躺淌趟烫掏涛滔绦萄桃逃淘陶讨套特藤腾疼誊梯剔踢锑提题蹄啼体替嚏惕涕剃屉天添填田甜恬舔腆挑条迢眺跳贴铁帖厅听烃"],
                ["cd40", "虭虯虰虲", 6, "蚃", 6, "蚎", 4, "蚔蚖", 5, "蚞", 4,
                        "蚥蚦蚫蚭蚮蚲蚳蚷蚸蚹蚻", 4, "蛁蛂蛃蛅蛈蛌蛍蛒蛓蛕蛖蛗蛚蛜"
                ],
                ["cd80", "蛝蛠蛡蛢蛣蛥蛦蛧蛨蛪蛫蛬蛯蛵蛶蛷蛺蛻蛼蛽蛿蜁蜄蜅蜆蜋蜌蜎蜏蜐蜑蜔蜖汀廷停亭庭挺艇通桐酮瞳同铜彤童桶捅筒统痛偷投头透凸秃突图徒途涂屠土吐兔湍团推颓腿蜕褪退吞屯臀拖托脱鸵陀驮驼椭妥拓唾挖哇蛙洼娃瓦袜歪外豌弯湾玩顽丸烷完碗挽晚皖惋宛婉万腕汪王亡枉网往旺望忘妄威"],
                ["ce40", "蜙蜛蜝蜟蜠蜤蜦蜧蜨蜪蜫蜬蜭蜯蜰蜲蜳蜵蜶蜸蜹蜺蜼蜽蝀",
                        6, "蝊蝋蝍蝏蝐蝑蝒蝔蝕蝖蝘蝚", 5, "蝡蝢蝦", 7, "蝯蝱蝲蝳蝵"
                ],
                ["ce80", "蝷蝸蝹蝺蝿螀螁螄螆螇螉螊螌螎", 4, "螔螕螖螘", 6, "螠", 4, "巍微危韦违桅围唯惟为潍维苇萎委伟伪尾纬未蔚味畏胃喂魏位渭谓尉慰卫瘟温蚊文闻纹吻稳紊问嗡翁瓮挝蜗涡窝我斡卧握沃巫呜钨乌污诬屋无芜梧吾吴毋武五捂午舞伍侮坞戊雾晤物勿务悟误昔熙析西硒矽晰嘻吸锡牺"],
                ["cf40", "螥螦螧螩螪螮螰螱螲螴螶螷螸螹螻螼螾螿蟁",
                        4, "蟇蟈蟉蟌", 4, "蟔", 6, "蟜蟝蟞蟟蟡蟢蟣蟤蟦蟧蟨蟩蟫蟬蟭蟯", 9
                ],
                ["cf80", "蟺蟻蟼蟽蟿蠀蠁蠂蠄", 5, "蠋", 7, "蠔蠗蠘蠙蠚蠜", 4, "蠣稀息希悉膝夕惜熄烯溪汐犀檄袭席习媳喜铣洗系隙戏细瞎虾匣霞辖暇峡侠狭下厦夏吓掀锨先仙鲜纤咸贤衔舷闲涎弦嫌显险现献县腺馅羡宪陷限线相厢镶香箱襄湘乡翔祥详想响享项巷橡像向象萧硝霄削哮嚣销消宵淆晓"],
                ["d040", "蠤", 13, "蠳", 5, "蠺蠻蠽蠾蠿衁衂衃衆", 5, "衎",
                        5, "衕衖衘衚", 6, "衦衧衪衭衯衱衳衴衵衶衸衹衺"
                ],
                ["d080", "衻衼袀袃袆袇袉袊袌袎袏袐袑袓袔袕袗", 4, "袝", 4, "袣袥", 5, "小孝校肖啸笑效楔些歇蝎鞋协挟携邪斜胁谐写械卸蟹懈泄泻谢屑薪芯锌欣辛新忻心信衅星腥猩惺兴刑型形邢行醒幸杏性姓兄凶胸匈汹雄熊休修羞朽嗅锈秀袖绣墟戌需虚嘘须徐许蓄酗叙旭序畜恤絮婿绪续轩喧宣悬旋玄"],
                ["d140", "袬袮袯袰袲", 4, "袸袹袺袻袽袾袿裀裃裄裇裈裊裋裌裍裏裐裑裓裖裗裚",
                        4, "裠裡裦裧裩", 6, "裲裵裶裷裺裻製裿褀褁褃", 5
                ],
                ["d180", "褉褋", 4, "褑褔", 4, "褜", 4, "褢褣褤褦褧褨褩褬褭褮褯褱褲褳褵褷选癣眩绚靴薛学穴雪血勋熏循旬询寻驯巡殉汛训讯逊迅压押鸦鸭呀丫芽牙蚜崖衙涯雅哑亚讶焉咽阉烟淹盐严研蜒岩延言颜阎炎沿奄掩眼衍演艳堰燕厌砚雁唁彦焰宴谚验殃央鸯秧杨扬佯疡羊洋阳氧仰痒养样漾邀腰妖瑶"],
                ["d240", "褸", 8, "襂襃襅", 24, "襠", 5, "襧", 19, "襼"],
                ["d280", "襽襾覀覂覄覅覇",
                        26, "摇尧遥窑谣姚咬舀药要耀椰噎耶爷野冶也页掖业叶曳腋夜液一壹医揖铱依伊衣颐夷遗移仪胰疑沂宜姨彝椅蚁倚已乙矣以艺抑易邑屹亿役臆逸肄疫亦裔意毅忆义益溢诣议谊译异翼翌绎茵荫因殷音阴姻吟银淫寅饮尹引隐"
                ],
                ["d340", "覢", 30, "觃觍觓觔觕觗觘觙觛觝觟觠觡觢觤觧觨觩觪觬觭觮觰觱觲觴", 6],
                ["d380", "觻", 4, "訁", 5, "計", 21, "印英樱婴鹰应缨莹萤营荧蝇迎赢盈影颖硬映哟拥佣臃痈庸雍踊蛹咏泳涌永恿勇用幽优悠忧尤由邮铀犹油游酉有友右佑釉诱又幼迂淤于盂榆虞愚舆余俞逾鱼愉渝渔隅予娱雨与屿禹宇语羽玉域芋郁吁遇喻峪御愈欲狱育誉"],
                ["d440", "訞", 31, "訿", 8, "詉", 21],
                ["d480", "詟", 25, "詺", 6, "浴寓裕预豫驭鸳渊冤元垣袁原援辕园员圆猿源缘远苑愿怨院曰约越跃钥岳粤月悦阅耘云郧匀陨允运蕴酝晕韵孕匝砸杂栽哉灾宰载再在咱攒暂赞赃脏葬遭糟凿藻枣早澡蚤躁噪造皂灶燥责择则泽贼怎增憎曾赠扎喳渣札轧"],
                ["d540", "誁", 7, "誋", 7, "誔", 46],
                ["d580", "諃", 32, "铡闸眨栅榨咋乍炸诈摘斋宅窄债寨瞻毡詹粘沾盏斩辗崭展蘸栈占战站湛绽樟章彰漳张掌涨杖丈帐账仗胀瘴障招昭找沼赵照罩兆肇召遮折哲蛰辙者锗蔗这浙珍斟真甄砧臻贞针侦枕疹诊震振镇阵蒸挣睁征狰争怔整拯正政"],
                ["d640", "諤", 34, "謈", 27],
                ["d680", "謤謥謧", 30, "帧症郑证芝枝支吱蜘知肢脂汁之织职直植殖执值侄址指止趾只旨纸志挚掷至致置帜峙制智秩稚质炙痔滞治窒中盅忠钟衷终种肿重仲众舟周州洲诌粥轴肘帚咒皱宙昼骤珠株蛛朱猪诸诛逐竹烛煮拄瞩嘱主著柱助蛀贮铸筑"],
                ["d740", "譆", 31, "譧", 4, "譭", 25],
                ["d780", "讇", 24, "讬讱讻诇诐诪谉谞住注祝驻抓爪拽专砖转撰赚篆桩庄装妆撞壮状椎锥追赘坠缀谆准捉拙卓桌琢茁酌啄着灼浊兹咨资姿滋淄孜紫仔籽滓子自渍字鬃棕踪宗综总纵邹走奏揍租足卒族祖诅阻组钻纂嘴醉最罪尊遵昨左佐柞做作坐座"],
                ["d840", "谸", 8, "豂豃豄豅豈豊豋豍", 7, "豖豗豘豙豛", 5, "豣", 6, "豬", 6, "豴豵豶豷豻", 6, "貃貄貆貇"],
                ["d880", "貈貋貍", 6, "貕貖貗貙", 20, "亍丌兀丐廿卅丕亘丞鬲孬噩丨禺丿匕乇夭爻卮氐囟胤馗毓睾鼗丶亟鼐乜乩亓芈孛啬嘏仄厍厝厣厥厮靥赝匚叵匦匮匾赜卦卣刂刈刎刭刳刿剀剌剞剡剜蒯剽劂劁劐劓冂罔亻仃仉仂仨仡仫仞伛仳伢佤仵伥伧伉伫佞佧攸佚佝"],
                ["d940", "貮", 62],
                ["d980", "賭", 32, "佟佗伲伽佶佴侑侉侃侏佾佻侪佼侬侔俦俨俪俅俚俣俜俑俟俸倩偌俳倬倏倮倭俾倜倌倥倨偾偃偕偈偎偬偻傥傧傩傺僖儆僭僬僦僮儇儋仝氽佘佥俎龠汆籴兮巽黉馘冁夔勹匍訇匐凫夙兕亠兖亳衮袤亵脔裒禀嬴蠃羸冫冱冽冼"],
                ["da40", "贎", 14, "贠赑赒赗赟赥赨赩赪赬赮赯赱赲赸", 8, "趂趃趆趇趈趉趌", 4, "趒趓趕", 9, "趠趡"],
                ["da80", "趢趤", 12, "趲趶趷趹趻趽跀跁跂跅跇跈跉跊跍跐跒跓跔凇冖冢冥讠讦讧讪讴讵讷诂诃诋诏诎诒诓诔诖诘诙诜诟诠诤诨诩诮诰诳诶诹诼诿谀谂谄谇谌谏谑谒谔谕谖谙谛谘谝谟谠谡谥谧谪谫谮谯谲谳谵谶卩卺阝阢阡阱阪阽阼陂陉陔陟陧陬陲陴隈隍隗隰邗邛邝邙邬邡邴邳邶邺"],
                ["db40", "跕跘跙跜跠跡跢跥跦跧跩跭跮跰跱跲跴跶跼跾",
                        6, "踆踇踈踋踍踎踐踑踒踓踕", 7, "踠踡踤", 4, "踫踭踰踲踳踴踶踷踸踻踼踾"
                ],
                ["db80", "踿蹃蹅蹆蹌", 4, "蹓", 5, "蹚", 11, "蹧蹨蹪蹫蹮蹱邸邰郏郅邾郐郄郇郓郦郢郜郗郛郫郯郾鄄鄢鄞鄣鄱鄯鄹酃酆刍奂劢劬劭劾哿勐勖勰叟燮矍廴凵凼鬯厶弁畚巯坌垩垡塾墼壅壑圩圬圪圳圹圮圯坜圻坂坩垅坫垆坼坻坨坭坶坳垭垤垌垲埏垧垴垓垠埕埘埚埙埒垸埴埯埸埤埝"],
                ["dc40", "蹳蹵蹷", 4, "蹽蹾躀躂躃躄躆躈", 6, "躑躒躓躕",
                        6, "躝躟", 11, "躭躮躰躱躳", 6, "躻", 7
                ],
                ["dc80", "軃", 10, "軏", 21, "堋堍埽埭堀堞堙塄堠塥塬墁墉墚墀馨鼙懿艹艽艿芏芊芨芄芎芑芗芙芫芸芾芰苈苊苣芘芷芮苋苌苁芩芴芡芪芟苄苎芤苡茉苷苤茏茇苜苴苒苘茌苻苓茑茚茆茔茕苠苕茜荑荛荜茈莒茼茴茱莛荞茯荏荇荃荟荀茗荠茭茺茳荦荥"],
                ["dd40", "軥", 62],
                ["dd80", "輤", 32, "荨茛荩荬荪荭荮莰荸莳莴莠莪莓莜莅荼莶莩荽莸荻莘莞莨莺莼菁萁菥菘堇萘萋菝菽菖萜萸萑萆菔菟萏萃菸菹菪菅菀萦菰菡葜葑葚葙葳蒇蒈葺蒉葸萼葆葩葶蒌蒎萱葭蓁蓍蓐蓦蒽蓓蓊蒿蒺蓠蒡蒹蒴蒗蓥蓣蔌甍蔸蓰蔹蔟蔺"],
                ["de40", "轅", 32, "轪辀辌辒辝辠辡辢辤辥辦辧辪辬辭辮辯農辳辴辵辷辸辺辻込辿迀迃迆"],
                ["de80", "迉", 4, "迏迒迖迗迚迠迡迣迧迬迯迱迲迴迵迶迺迻迼迾迿逇逈逌逎逓逕逘蕖蔻蓿蓼蕙蕈蕨蕤蕞蕺瞢蕃蕲蕻薤薨薇薏蕹薮薜薅薹薷薰藓藁藜藿蘧蘅蘩蘖蘼廾弈夼奁耷奕奚奘匏尢尥尬尴扌扪抟抻拊拚拗拮挢拶挹捋捃掭揶捱捺掎掴捭掬掊捩掮掼揲揸揠揿揄揞揎摒揆掾摅摁搋搛搠搌搦搡摞撄摭撖"],
                ["df40",
                        "這逜連逤逥逧", 5, "逰", 4, "逷逹逺逽逿遀遃遅遆遈", 4, "過達違遖遙遚遜", 5, "遤遦遧適遪遫遬遯", 4, "遶", 6, "遾邁"
                ],
                ["df80", "還邅邆邇邉邊邌", 4, "邒邔邖邘邚邜邞邟邠邤邥邧邨邩邫邭邲邷邼邽邿郀摺撷撸撙撺擀擐擗擤擢攉攥攮弋忒甙弑卟叱叽叩叨叻吒吖吆呋呒呓呔呖呃吡呗呙吣吲咂咔呷呱呤咚咛咄呶呦咝哐咭哂咴哒咧咦哓哔呲咣哕咻咿哌哙哚哜咩咪咤哝哏哞唛哧唠哽唔哳唢唣唏唑唧唪啧喏喵啉啭啁啕唿啐唼"],
                ["e040", "郂郃郆郈郉郋郌郍郒郔郕郖郘郙郚郞郟郠郣郤郥郩郪郬郮郰郱郲郳郵郶郷郹郺郻郼郿鄀鄁鄃鄅", 19, "鄚鄛鄜"],
                ["e080", "鄝鄟鄠鄡鄤", 10, "鄰鄲", 6, "鄺", 8, "酄唷啖啵啶啷唳唰啜喋嗒喃喱喹喈喁喟啾嗖喑啻嗟喽喾喔喙嗪嗷嗉嘟嗑嗫嗬嗔嗦嗝嗄嗯嗥嗲嗳嗌嗍嗨嗵嗤辔嘞嘈嘌嘁嘤嘣嗾嘀嘧嘭噘嘹噗嘬噍噢噙噜噌噔嚆噤噱噫噻噼嚅嚓嚯囔囗囝囡囵囫囹囿圄圊圉圜帏帙帔帑帱帻帼"],
                ["e140", "酅酇酈酑酓酔酕酖酘酙酛酜酟酠酦酧酨酫酭酳酺酻酼醀",
                        4, "醆醈醊醎醏醓", 6, "醜", 5, "醤", 5, "醫醬醰醱醲醳醶醷醸醹醻"
                ],
                ["e180", "醼", 10, "釈釋釐釒", 9, "針", 8, "帷幄幔幛幞幡岌屺岍岐岖岈岘岙岑岚岜岵岢岽岬岫岱岣峁岷峄峒峤峋峥崂崃崧崦崮崤崞崆崛嵘崾崴崽嵬嵛嵯嵝嵫嵋嵊嵩嵴嶂嶙嶝豳嶷巅彳彷徂徇徉後徕徙徜徨徭徵徼衢彡犭犰犴犷犸狃狁狎狍狒狨狯狩狲狴狷猁狳猃狺"],
                ["e240", "釦", 62],
                ["e280", "鈥", 32, "狻猗猓猡猊猞猝猕猢猹猥猬猸猱獐獍獗獠獬獯獾舛夥飧夤夂饣饧",
                        5, "饴饷饽馀馄馇馊馍馐馑馓馔馕庀庑庋庖庥庠庹庵庾庳赓廒廑廛廨廪膺忄忉忖忏怃忮怄忡忤忾怅怆忪忭忸怙怵怦怛怏怍怩怫怊怿怡恸恹恻恺恂"
                ],
                ["e340", "鉆", 45, "鉵", 16],
                ["e380", "銆", 7, "銏", 24, "恪恽悖悚悭悝悃悒悌悛惬悻悱惝惘惆惚悴愠愦愕愣惴愀愎愫慊慵憬憔憧憷懔懵忝隳闩闫闱闳闵闶闼闾阃阄阆阈阊阋阌阍阏阒阕阖阗阙阚丬爿戕氵汔汜汊沣沅沐沔沌汨汩汴汶沆沩泐泔沭泷泸泱泗沲泠泖泺泫泮沱泓泯泾"],
                ["e440", "銨", 5, "銯", 24, "鋉", 31],
                ["e480", "鋩", 32, "洹洧洌浃浈洇洄洙洎洫浍洮洵洚浏浒浔洳涑浯涞涠浞涓涔浜浠浼浣渚淇淅淞渎涿淠渑淦淝淙渖涫渌涮渫湮湎湫溲湟溆湓湔渲渥湄滟溱溘滠漭滢溥溧溽溻溷滗溴滏溏滂溟潢潆潇漤漕滹漯漶潋潴漪漉漩澉澍澌潸潲潼潺濑"],
                ["e540", "錊", 51, "錿", 10],
                ["e580", "鍊", 31, "鍫濉澧澹澶濂濡濮濞濠濯瀚瀣瀛瀹瀵灏灞宀宄宕宓宥宸甯骞搴寤寮褰寰蹇謇辶迓迕迥迮迤迩迦迳迨逅逄逋逦逑逍逖逡逵逶逭逯遄遑遒遐遨遘遢遛暹遴遽邂邈邃邋彐彗彖彘尻咫屐屙孱屣屦羼弪弩弭艴弼鬻屮妁妃妍妩妪妣"],
                ["e640", "鍬", 34, "鎐", 27],
                ["e680", "鎬", 29, "鏋鏌鏍妗姊妫妞妤姒妲妯姗妾娅娆姝娈姣姘姹娌娉娲娴娑娣娓婀婧婊婕娼婢婵胬媪媛婷婺媾嫫媲嫒嫔媸嫠嫣嫱嫖嫦嫘嫜嬉嬗嬖嬲嬷孀尕尜孚孥孳孑孓孢驵驷驸驺驿驽骀骁骅骈骊骐骒骓骖骘骛骜骝骟骠骢骣骥骧纟纡纣纥纨纩"],
                ["e740", "鏎", 7, "鏗", 54],
                ["e780", "鐎", 32, "纭纰纾绀绁绂绉绋绌绐绔绗绛绠绡绨绫绮绯绱绲缍绶绺绻绾缁缂缃缇缈缋缌缏缑缒缗缙缜缛缟缡",
                        6, "缪缫缬缭缯", 4, "缵幺畿巛甾邕玎玑玮玢玟珏珂珑玷玳珀珉珈珥珙顼琊珩珧珞玺珲琏琪瑛琦琥琨琰琮琬"
                ],
                ["e840", "鐯", 14, "鐿", 43, "鑬鑭鑮鑯"],
                ["e880", "鑰", 20, "钑钖钘铇铏铓铔铚铦铻锜锠琛琚瑁瑜瑗瑕瑙瑷瑭瑾璜璎璀璁璇璋璞璨璩璐璧瓒璺韪韫韬杌杓杞杈杩枥枇杪杳枘枧杵枨枞枭枋杷杼柰栉柘栊柩枰栌柙枵柚枳柝栀柃枸柢栎柁柽栲栳桠桡桎桢桄桤梃栝桕桦桁桧桀栾桊桉栩梵梏桴桷梓桫棂楮棼椟椠棹"],
                ["e940", "锧锳锽镃镈镋镕镚镠镮镴镵長", 7, "門", 42],
                ["e980", "閫", 32, "椤棰椋椁楗棣椐楱椹楠楂楝榄楫榀榘楸椴槌榇榈槎榉楦楣楹榛榧榻榫榭槔榱槁槊槟榕槠榍槿樯槭樗樘橥槲橄樾檠橐橛樵檎橹樽樨橘橼檑檐檩檗檫猷獒殁殂殇殄殒殓殍殚殛殡殪轫轭轱轲轳轵轶轸轷轹轺轼轾辁辂辄辇辋"],
                ["ea40", "闌", 27, "闬闿阇阓阘阛阞阠阣", 6, "阫阬阭阯阰阷阸阹阺阾陁陃陊陎陏陑陒陓陖陗"],
                ["ea80", "陘陙陚陜陝陞陠陣陥陦陫陭",
                        4, "陳陸", 12, "隇隉隊辍辎辏辘辚軎戋戗戛戟戢戡戥戤戬臧瓯瓴瓿甏甑甓攴旮旯旰昊昙杲昃昕昀炅曷昝昴昱昶昵耆晟晔晁晏晖晡晗晷暄暌暧暝暾曛曜曦曩贲贳贶贻贽赀赅赆赈赉赇赍赕赙觇觊觋觌觎觏觐觑牮犟牝牦牯牾牿犄犋犍犏犒挈挲掰"
                ],
                ["eb40", "隌階隑隒隓隕隖隚際隝", 9, "隨", 7, "隱隲隴隵隷隸隺隻隿雂雃雈雊雋雐雑雓雔雖", 9, "雡", 6, "雫"],
                ["eb80", "雬雭雮雰雱雲雴雵雸雺電雼雽雿霂霃霅霊霋霌霐霑霒霔霕霗",
                        4, "霝霟霠搿擘耄毪毳毽毵毹氅氇氆氍氕氘氙氚氡氩氤氪氲攵敕敫牍牒牖爰虢刖肟肜肓肼朊肽肱肫肭肴肷胧胨胩胪胛胂胄胙胍胗朐胝胫胱胴胭脍脎胲胼朕脒豚脶脞脬脘脲腈腌腓腴腙腚腱腠腩腼腽腭腧塍媵膈膂膑滕膣膪臌朦臊膻"
                ],
                ["ec40", "霡", 8, "霫霬霮霯霱霳", 4, "霺霻霼霽霿", 18, "靔靕靗靘靚靜靝靟靣靤靦靧靨靪", 7],
                ["ec80", "靲靵靷", 4, "靽", 7, "鞆", 4, "鞌鞎鞏鞐鞓鞕鞖鞗鞙", 4, "臁膦欤欷欹歃歆歙飑飒飓飕飙飚殳彀毂觳斐齑斓於旆旄旃旌旎旒旖炀炜炖炝炻烀炷炫炱烨烊焐焓焖焯焱煳煜煨煅煲煊煸煺熘熳熵熨熠燠燔燧燹爝爨灬焘煦熹戾戽扃扈扉礻祀祆祉祛祜祓祚祢祗祠祯祧祺禅禊禚禧禳忑忐"],
                ["ed40", "鞞鞟鞡鞢鞤", 6, "鞬鞮鞰鞱鞳鞵", 46],
                ["ed80", "韤韥韨韮", 4, "韴韷", 23, "怼恝恚恧恁恙恣悫愆愍慝憩憝懋懑戆肀聿沓泶淼矶矸砀砉砗砘砑斫砭砜砝砹砺砻砟砼砥砬砣砩硎硭硖硗砦硐硇硌硪碛碓碚碇碜碡碣碲碹碥磔磙磉磬磲礅磴礓礤礞礴龛黹黻黼盱眄眍盹眇眈眚眢眙眭眦眵眸睐睑睇睃睚睨"],
                ["ee40", "頏", 62],
                ["ee80", "顎", 32, "睢睥睿瞍睽瞀瞌瞑瞟瞠瞰瞵瞽町畀畎畋畈畛畲畹疃罘罡罟詈罨罴罱罹羁罾盍盥蠲钅钆钇钋钊钌钍钏钐钔钗钕钚钛钜钣钤钫钪钭钬钯钰钲钴钶",
                        4, "钼钽钿铄铈", 6, "铐铑铒铕铖铗铙铘铛铞铟铠铢铤铥铧铨铪"
                ],
                ["ef40", "顯", 5, "颋颎颒颕颙颣風", 37, "飏飐飔飖飗飛飜飝飠", 4],
                ["ef80", "飥飦飩", 30, "铩铫铮铯铳铴铵铷铹铼铽铿锃锂锆锇锉锊锍锎锏锒", 4, "锘锛锝锞锟锢锪锫锩锬锱锲锴锶锷锸锼锾锿镂锵镄镅镆镉镌镎镏镒镓镔镖镗镘镙镛镞镟镝镡镢镤", 8, "镯镱镲镳锺矧矬雉秕秭秣秫稆嵇稃稂稞稔"],
                ["f040", "餈", 4, "餎餏餑", 28, "餯", 26],
                ["f080", "饊", 9, "饖",
                        12, "饤饦饳饸饹饻饾馂馃馉稹稷穑黏馥穰皈皎皓皙皤瓞瓠甬鸠鸢鸨", 4, "鸲鸱鸶鸸鸷鸹鸺鸾鹁鹂鹄鹆鹇鹈鹉鹋鹌鹎鹑鹕鹗鹚鹛鹜鹞鹣鹦", 6, "鹱鹭鹳疒疔疖疠疝疬疣疳疴疸痄疱疰痃痂痖痍痣痨痦痤痫痧瘃痱痼痿瘐瘀瘅瘌瘗瘊瘥瘘瘕瘙"
                ],
                ["f140", "馌馎馚", 10, "馦馧馩", 47],
                ["f180", "駙", 32, "瘛瘼瘢瘠癀瘭瘰瘿瘵癃瘾瘳癍癞癔癜癖癫癯翊竦穸穹窀窆窈窕窦窠窬窨窭窳衤衩衲衽衿袂袢裆袷袼裉裢裎裣裥裱褚裼裨裾裰褡褙褓褛褊褴褫褶襁襦襻疋胥皲皴矜耒耔耖耜耠耢耥耦耧耩耨耱耋耵聃聆聍聒聩聱覃顸颀颃"],
                ["f240", "駺", 62],
                ["f280", "騹", 32, "颉颌颍颏颔颚颛颞颟颡颢颥颦虍虔虬虮虿虺虼虻蚨蚍蚋蚬蚝蚧蚣蚪蚓蚩蚶蛄蚵蛎蚰蚺蚱蚯蛉蛏蚴蛩蛱蛲蛭蛳蛐蜓蛞蛴蛟蛘蛑蜃蜇蛸蜈蜊蜍蜉蜣蜻蜞蜥蜮蜚蜾蝈蜴蜱蜩蜷蜿螂蜢蝽蝾蝻蝠蝰蝌蝮螋蝓蝣蝼蝤蝙蝥螓螯螨蟒"],
                ["f340", "驚", 17, "驲骃骉骍骎骔骕骙骦骩", 6, "骲骳骴骵骹骻骽骾骿髃髄髆", 4, "髍髎髏髐髒體髕髖髗髙髚髛髜"],
                ["f380", "髝髞髠髢髣髤髥髧髨髩髪髬髮髰",
                        8, "髺髼", 6, "鬄鬅鬆蟆螈螅螭螗螃螫蟥螬螵螳蟋蟓螽蟑蟀蟊蟛蟪蟠蟮蠖蠓蟾蠊蠛蠡蠹蠼缶罂罄罅舐竺竽笈笃笄笕笊笫笏筇笸笪笙笮笱笠笥笤笳笾笞筘筚筅筵筌筝筠筮筻筢筲筱箐箦箧箸箬箝箨箅箪箜箢箫箴篑篁篌篝篚篥篦篪簌篾篼簏簖簋"
                ],
                ["f440", "鬇鬉", 5, "鬐鬑鬒鬔", 10, "鬠鬡鬢鬤", 10, "鬰鬱鬳", 7, "鬽鬾鬿魀魆魊魋魌魎魐魒魓魕", 5],
                ["f480", "魛", 32, "簟簪簦簸籁籀臾舁舂舄臬衄舡舢舣舭舯舨舫舸舻舳舴舾艄艉艋艏艚艟艨衾袅袈裘裟襞羝羟羧羯羰羲籼敉粑粝粜粞粢粲粼粽糁糇糌糍糈糅糗糨艮暨羿翎翕翥翡翦翩翮翳糸絷綦綮繇纛麸麴赳趄趔趑趱赧赭豇豉酊酐酎酏酤"],
                ["f540", "魼", 62],
                ["f580", "鮻", 32, "酢酡酰酩酯酽酾酲酴酹醌醅醐醍醑醢醣醪醭醮醯醵醴醺豕鹾趸跫踅蹙蹩趵趿趼趺跄跖跗跚跞跎跏跛跆跬跷跸跣跹跻跤踉跽踔踝踟踬踮踣踯踺蹀踹踵踽踱蹉蹁蹂蹑蹒蹊蹰蹶蹼蹯蹴躅躏躔躐躜躞豸貂貊貅貘貔斛觖觞觚觜"],
                ["f640", "鯜", 62],
                ["f680", "鰛", 32, "觥觫觯訾謦靓雩雳雯霆霁霈霏霎霪霭霰霾龀龃龅", 5, "龌黾鼋鼍隹隼隽雎雒瞿雠銎銮鋈錾鍪鏊鎏鐾鑫鱿鲂鲅鲆鲇鲈稣鲋鲎鲐鲑鲒鲔鲕鲚鲛鲞",
                        5, "鲥", 4, "鲫鲭鲮鲰", 7, "鲺鲻鲼鲽鳄鳅鳆鳇鳊鳋"
                ],
                ["f740", "鰼", 62],
                ["f780", "鱻鱽鱾鲀鲃鲄鲉鲊鲌鲏鲓鲖鲗鲘鲙鲝鲪鲬鲯鲹鲾", 4, "鳈鳉鳑鳒鳚鳛鳠鳡鳌", 4, "鳓鳔鳕鳗鳘鳙鳜鳝鳟鳢靼鞅鞑鞒鞔鞯鞫鞣鞲鞴骱骰骷鹘骶骺骼髁髀髅髂髋髌髑魅魃魇魉魈魍魑飨餍餮饕饔髟髡髦髯髫髻髭髹鬈鬏鬓鬟鬣麽麾縻麂麇麈麋麒鏖麝麟黛黜黝黠黟黢黩黧黥黪黯鼢鼬鼯鼹鼷鼽鼾齄"],
                ["f840", "鳣", 62],
                ["f880", "鴢", 32],
                ["f940",
                        "鵃", 62
                ],
                ["f980", "鶂", 32],
                ["fa40", "鶣", 62],
                ["fa80", "鷢", 32],
                ["fb40", "鸃", 27, "鸤鸧鸮鸰鸴鸻鸼鹀鹍鹐鹒鹓鹔鹖鹙鹝鹟鹠鹡鹢鹥鹮鹯鹲鹴", 9, "麀"],
                ["fb80", "麁麃麄麅麆麉麊麌", 5, "麔", 8, "麞麠", 5, "麧麨麩麪"],
                ["fc40", "麫", 8, "麵麶麷麹麺麼麿", 4, "黅黆黇黈黊黋黌黐黒黓黕黖黗黙黚點黡黣黤黦黨黫黬黭黮黰", 8, "黺黽黿", 6],
                ["fc80", "鼆", 4, "鼌鼏鼑鼒鼔鼕鼖鼘鼚", 5, "鼡鼣", 8, "鼭鼮鼰鼱"],
                ["fd40", "鼲", 4, "鼸鼺鼼鼿", 4, "齅", 10, "齒",
                        38
                ],
                ["fd80", "齹", 5, "龁龂龍", 11, "龜龝龞龡", 4, "郎凉秊裏隣"],
                ["fe40", "兀嗀﨎﨏﨑﨓﨔礼﨟蘒﨡﨣﨤﨧﨨﨩"]
            ]
        }, {}
    ],
    68: [function(g, p, m) {
            p.exports = [
                ["0", "\x00", 127],
                ["8141", "갂갃갅갆갋", 4, "갘갞갟갡갢갣갥", 6, "갮갲갳갴"],
                ["8161", "갵갶갷갺갻갽갾갿걁", 9, "걌걎", 5, "걕"],
                ["8181", "걖걗걙걚걛걝", 18, "걲걳걵걶걹걻", 4, "겂겇겈겍겎겏겑겒겓겕", 6, "겞겢", 5, "겫겭겮겱", 6, "겺겾겿곀곂곃곅곆곇곉곊곋곍", 7, "곖곘", 7, "곢곣곥곦곩곫곭곮곲곴곷",
                        4, "곾곿괁괂괃괅괇", 4, "괎괐괒괓"
                ],
                ["8241", "괔괕괖괗괙괚괛괝괞괟괡", 7, "괪괫괮", 5],
                ["8261", "괶괷괹괺괻괽", 6, "굆굈굊", 5, "굑굒굓굕굖굗"],
                ["8281", "굙", 7, "굢굤", 7, "굮굯굱굲굷굸굹굺굾궀궃", 4, "궊궋궍궎궏궑", 10, "궞", 5, "궥", 17, "궸", 7, "귂귃귅귆귇귉", 6, "귒귔", 7, "귝귞귟귡귢귣귥", 18],
                ["8341", "귺귻귽귾긂", 5, "긊긌긎", 5, "긕", 7],
                ["8361", "긝", 18, "긲긳긵긶긹긻긼"],
                ["8381", "긽긾긿깂깄깇깈깉깋깏깑깒깓깕깗", 4, "깞깢깣깤깦깧깪깫깭깮깯깱",
                        6, "깺깾", 5, "꺆", 5, "꺍", 46, "꺿껁껂껃껅", 6, "껎껒", 5, "껚껛껝", 8
                ],
                ["8441", "껦껧껩껪껬껮", 5, "껵껶껷껹껺껻껽", 8],
                ["8461", "꼆꼉꼊꼋꼌꼎꼏꼑", 18],
                ["8481", "꼤", 7, "꼮꼯꼱꼳꼵", 6, "꼾꽀꽄꽅꽆꽇꽊", 5, "꽑", 10, "꽞", 5, "꽦", 18, "꽺", 5, "꾁꾂꾃꾅꾆꾇꾉", 6, "꾒꾓꾔꾖", 5, "꾝", 26, "꾺꾻꾽꾾"],
                ["8541", "꾿꿁", 5, "꿊꿌꿏", 4, "꿕", 6, "꿝", 4],
                ["8561", "꿢", 5, "꿪", 5, "꿲꿳꿵꿶꿷꿹", 6, "뀂뀃"],
                ["8581", "뀅", 6, "뀍뀎뀏뀑뀒뀓뀕", 6, "뀞", 9, "뀩", 26,
                        "끆끇끉끋끍끏끐끑끒끖끘끚끛끜끞", 29, "끾끿낁낂낃낅", 6, "낎낐낒", 5, "낛낝낞낣낤"
                ],
                ["8641", "낥낦낧낪낰낲낶낷낹낺낻낽", 6, "냆냊", 5, "냒"],
                ["8661", "냓냕냖냗냙", 6, "냡냢냣냤냦", 10],
                ["8681", "냱", 22, "넊넍넎넏넑넔넕넖넗넚넞", 4, "넦넧넩넪넫넭", 6, "넶넺", 5, "녂녃녅녆녇녉", 6, "녒녓녖녗녙녚녛녝녞녟녡", 22, "녺녻녽녾녿놁놃", 4, "놊놌놎놏놐놑놕놖놗놙놚놛놝"],
                ["8741", "놞", 9, "놩", 15],
                ["8761", "놹", 18, "뇍뇎뇏뇑뇒뇓뇕"],
                ["8781", "뇖", 5, "뇞뇠", 7, "뇪뇫뇭뇮뇯뇱", 7, "뇺뇼뇾", 5, "눆눇눉눊눍", 6, "눖눘눚", 5, "눡", 18, "눵", 6, "눽", 26, "뉙뉚뉛뉝뉞뉟뉡", 6, "뉪", 4],
                ["8841", "뉯", 4, "뉶", 5, "뉽", 6, "늆늇늈늊", 4],
                ["8861", "늏늒늓늕늖늗늛", 4, "늢늤늧늨늩늫늭늮늯늱늲늳늵늶늷"],
                ["8881", "늸", 15, "닊닋닍닎닏닑닓", 4, "닚닜닞닟닠닡닣닧닩닪닰닱닲닶닼닽닾댂댃댅댆댇댉", 6, "댒댖", 5, "댝", 54, "덗덙덚덝덠덡덢덣"],
                ["8941", "덦덨덪덬덭덯덲덳덵덶덷덹",
                        6, "뎂뎆", 5, "뎍"
                ],
                ["8961", "뎎뎏뎑뎒뎓뎕", 10, "뎢", 5, "뎩뎪뎫뎭"],
                ["8981", "뎮", 21, "돆돇돉돊돍돏돑돒돓돖돘돚돜돞돟돡돢돣돥돦돧돩", 18, "돽", 18, "됑", 6, "됙됚됛됝됞됟됡", 6, "됪됬", 7, "됵", 15],
                ["8a41", "둅", 10, "둒둓둕둖둗둙", 6, "둢둤둦"],
                ["8a61", "둧", 4, "둭", 18, "뒁뒂"],
                ["8a81", "뒃", 4, "뒉", 19, "뒞", 5, "뒥뒦뒧뒩뒪뒫뒭", 7, "뒶뒸뒺", 5, "듁듂듃듅듆듇듉", 6, "듑듒듓듔듖", 5, "듞듟듡듢듥듧", 4, "듮듰듲", 5, "듹", 26, "딖딗딙딚딝"],
                ["8b41", "딞", 5, "딦딫", 4, "딲딳딵딶딷딹", 6, "땂땆"],
                ["8b61", "땇땈땉땊땎땏땑땒땓땕", 6, "땞땢", 8],
                ["8b81", "땫", 52, "떢떣떥떦떧떩떬떭떮떯떲떶", 4, "떾떿뗁뗂뗃뗅", 6, "뗎뗒", 5, "뗙", 18, "뗭", 18],
                ["8c41", "똀", 15, "똒똓똕똖똗똙", 4],
                ["8c61", "똞", 6, "똦", 5, "똭", 6, "똵", 5],
                ["8c81", "똻", 12, "뙉", 26, "뙥뙦뙧뙩", 50, "뚞뚟뚡뚢뚣뚥", 5, "뚭뚮뚯뚰뚲", 16],
                ["8d41", "뛃", 16, "뛕", 8],
                ["8d61", "뛞", 17, "뛱뛲뛳뛵뛶뛷뛹뛺"],
                ["8d81", "뛻", 4, "뜂뜃뜄뜆", 33,
                        "뜪뜫뜭뜮뜱", 6, "뜺뜼", 7, "띅띆띇띉띊띋띍", 6, "띖", 9, "띡띢띣띥띦띧띩", 6, "띲띴띶", 5, "띾띿랁랂랃랅", 6, "랎랓랔랕랚랛랝랞"
                ],
                ["8e41", "랟랡", 6, "랪랮", 5, "랶랷랹", 8],
                ["8e61", "럂", 4, "럈럊", 19],
                ["8e81", "럞", 13, "럮럯럱럲럳럵", 6, "럾렂", 4, "렊렋렍렎렏렑", 6, "렚렜렞", 5, "렦렧렩렪렫렭", 6, "렶렺", 5, "롁롂롃롅", 11, "롒롔", 7, "롞롟롡롢롣롥", 6, "롮롰롲", 5, "롹롺롻롽", 7],
                ["8f41", "뢅", 7, "뢎", 17],
                ["8f61", "뢠", 7, "뢩", 6, "뢱뢲뢳뢵뢶뢷뢹",
                        4
                ],
                ["8f81", "뢾뢿룂룄룆", 5, "룍룎룏룑룒룓룕", 7, "룞룠룢", 5, "룪룫룭룮룯룱", 6, "룺룼룾", 5, "뤅", 18, "뤙", 6, "뤡", 26, "뤾뤿륁륂륃륅", 6, "륍륎륐륒", 5],
                ["9041", "륚륛륝륞륟륡", 6, "륪륬륮", 5, "륶륷륹륺륻륽"],
                ["9061", "륾", 5, "릆릈릋릌릏", 15],
                ["9081", "릟", 12, "릮릯릱릲릳릵", 6, "릾맀맂", 5, "맊맋맍맓", 4, "맚맜맟맠맢맦맧맩맪맫맭", 6, "맶맻", 4, "먂", 5, "먉", 11, "먖", 33, "먺먻먽먾먿멁멃멄멅멆"],
                ["9141", "멇멊멌멏멐멑멒멖멗멙멚멛멝",
                        6, "멦멪", 5
                ],
                ["9161", "멲멳멵멶멷멹", 9, "몆몈몉몊몋몍", 5],
                ["9181", "몓", 20, "몪몭몮몯몱몳", 4, "몺몼몾", 5, "뫅뫆뫇뫉", 14, "뫚", 33, "뫽뫾뫿묁묂묃묅", 7, "묎묐묒", 5, "묙묚묛묝묞묟묡", 6],
                ["9241", "묨묪묬", 7, "묷묹묺묿", 4, "뭆뭈뭊뭋뭌뭎뭑뭒"],
                ["9261", "뭓뭕뭖뭗뭙", 7, "뭢뭤", 7, "뭭", 4],
                ["9281", "뭲", 21, "뮉뮊뮋뮍뮎뮏뮑", 18, "뮥뮦뮧뮩뮪뮫뮭", 6, "뮵뮶뮸", 7, "믁믂믃믅믆믇믉", 6, "믑믒믔", 35, "믺믻믽믾밁"],
                ["9341", "밃", 4, "밊밎밐밒밓밙밚밠밡밢밣밦밨밪밫밬밮밯밲밳밵"],
                ["9361", "밶밷밹", 6, "뱂뱆뱇뱈뱊뱋뱎뱏뱑", 8],
                ["9381", "뱚뱛뱜뱞", 37, "벆벇벉벊벍벏", 4, "벖벘벛", 4, "벢벣벥벦벩", 6, "벲벶", 5, "벾벿볁볂볃볅", 7, "볎볒볓볔볖볗볙볚볛볝", 22, "볷볹볺볻볽"],
                ["9441", "볾", 5, "봆봈봊", 5, "봑봒봓봕", 8],
                ["9461", "봞", 5, "봥", 6, "봭", 12],
                ["9481", "봺", 5, "뵁", 6, "뵊뵋뵍뵎뵏뵑", 6, "뵚", 9, "뵥뵦뵧뵩", 22, "붂붃붅붆붋", 4, "붒붔붖붗붘붛붝", 6, "붥", 10, "붱", 6, "붹", 24],
                ["9541", "뷒뷓뷖뷗뷙뷚뷛뷝", 11, "뷪", 5,
                        "뷱"
                ],
                ["9561", "뷲뷳뷵뷶뷷뷹", 6, "븁븂븄븆", 5, "븎븏븑븒븓"],
                ["9581", "븕", 6, "븞븠", 35, "빆빇빉빊빋빍빏", 4, "빖빘빜빝빞빟빢빣빥빦빧빩빫", 4, "빲빶", 4, "빾빿뺁뺂뺃뺅", 6, "뺎뺒", 5, "뺚", 13, "뺩", 14],
                ["9641", "뺸", 23, "뻒뻓"],
                ["9661", "뻕뻖뻙", 6, "뻡뻢뻦", 5, "뻭", 8],
                ["9681", "뻶", 10, "뼂", 5, "뼊", 13, "뼚뼞", 33, "뽂뽃뽅뽆뽇뽉", 6, "뽒뽓뽔뽖", 44],
                ["9741", "뾃", 16, "뾕", 8],
                ["9761", "뾞", 17, "뾱", 7],
                ["9781", "뾹", 11, "뿆", 5, "뿎뿏뿑뿒뿓뿕", 6, "뿝뿞뿠뿢",
                        89, "쀽쀾쀿"
                ],
                ["9841", "쁀", 16, "쁒", 5, "쁙쁚쁛"],
                ["9861", "쁝쁞쁟쁡", 6, "쁪", 15],
                ["9881", "쁺", 21, "삒삓삕삖삗삙", 6, "삢삤삦", 5, "삮삱삲삷", 4, "삾샂샃샄샆샇샊샋샍샎샏샑", 6, "샚샞", 5, "샦샧샩샪샫샭", 6, "샶샸샺", 5, "섁섂섃섅섆섇섉", 6, "섑섒섓섔섖", 5, "섡섢섥섨섩섪섫섮"],
                ["9941", "섲섳섴섵섷섺섻섽섾섿셁", 6, "셊셎", 5, "셖셗"],
                ["9961", "셙셚셛셝", 6, "셦셪", 5, "셱셲셳셵셶셷셹셺셻"],
                ["9981", "셼", 8, "솆", 5, "솏솑솒솓솕솗",
                        4, "솞솠솢솣솤솦솧솪솫솭솮솯솱", 11, "솾", 5, "쇅쇆쇇쇉쇊쇋쇍", 6, "쇕쇖쇙", 6, "쇡쇢쇣쇥쇦쇧쇩", 6, "쇲쇴", 7, "쇾쇿숁숂숃숅", 6, "숎숐숒", 5, "숚숛숝숞숡숢숣"
                ],
                ["9a41", "숤숥숦숧숪숬숮숰숳숵", 16],
                ["9a61", "쉆쉇쉉", 6, "쉒쉓쉕쉖쉗쉙", 6, "쉡쉢쉣쉤쉦"],
                ["9a81", "쉧", 4, "쉮쉯쉱쉲쉳쉵", 6, "쉾슀슂", 5, "슊", 5, "슑", 6, "슙슚슜슞", 5, "슦슧슩슪슫슮", 5, "슶슸슺", 33, "싞싟싡싢싥", 5, "싮싰싲싳싴싵싷싺싽싾싿쌁", 6, "쌊쌋쌎쌏"],
                ["9b41", "쌐쌑쌒쌖쌗쌙쌚쌛쌝", 6, "쌦쌧쌪", 8],
                ["9b61", "쌳", 17, "썆", 7],
                ["9b81", "썎", 25, "썪썫썭썮썯썱썳", 4, "썺썻썾", 5, "쎅쎆쎇쎉쎊쎋쎍", 50, "쏁", 22, "쏚"],
                ["9c41", "쏛쏝쏞쏡쏣", 4, "쏪쏫쏬쏮", 5, "쏶쏷쏹", 5],
                ["9c61", "쏿", 8, "쐉", 6, "쐑", 9],
                ["9c81", "쐛", 8, "쐥", 6, "쐭쐮쐯쐱쐲쐳쐵", 6, "쐾", 9, "쑉", 26, "쑦쑧쑩쑪쑫쑭", 6, "쑶쑷쑸쑺", 5, "쒁", 18, "쒕", 6, "쒝", 12],
                ["9d41", "쒪", 13, "쒹쒺쒻쒽", 8],
                ["9d61", "쓆", 25],
                ["9d81", "쓠", 8, "쓪", 5, "쓲쓳쓵쓶쓷쓹쓻쓼쓽쓾씂",
                        9, "씍씎씏씑씒씓씕", 6, "씝", 10, "씪씫씭씮씯씱", 6, "씺씼씾", 5, "앆앇앋앏앐앑앒앖앚앛앜앟앢앣앥앦앧앩", 6, "앲앶", 5, "앾앿얁얂얃얅얆얈얉얊얋얎얐얒얓얔"
                ],
                ["9e41", "얖얙얚얛얝얞얟얡", 7, "얪", 9, "얶"],
                ["9e61", "얷얺얿", 4, "엋엍엏엒엓엕엖엗엙", 6, "엢엤엦엧"],
                ["9e81", "엨엩엪엫엯엱엲엳엵엸엹엺엻옂옃옄옉옊옋옍옎옏옑", 6, "옚옝", 6, "옦옧옩옪옫옯옱옲옶옸옺옼옽옾옿왂왃왅왆왇왉", 6, "왒왖", 5, "왞왟왡",
                        10, "왭왮왰왲", 5, "왺왻왽왾왿욁", 6, "욊욌욎", 5, "욖욗욙욚욛욝", 6, "욦"
                ],
                ["9f41", "욨욪", 5, "욲욳욵욶욷욻", 4, "웂웄웆", 5, "웎"],
                ["9f61", "웏웑웒웓웕", 6, "웞웟웢", 5, "웪웫웭웮웯웱웲"],
                ["9f81", "웳", 4, "웺웻웼웾", 5, "윆윇윉윊윋윍", 6, "윖윘윚", 5, "윢윣윥윦윧윩", 6, "윲윴윶윸윹윺윻윾윿읁읂읃읅", 4, "읋읎읐읙읚읛읝읞읟읡", 6, "읩읪읬", 7, "읶읷읹읺읻읿잀잁잂잆잋잌잍잏잒잓잕잙잛", 4, "잢잧", 4, "잮잯잱잲잳잵잶잷"],
                ["a041", "잸잹잺잻잾쟂", 5, "쟊쟋쟍쟏쟑", 6, "쟙쟚쟛쟜"],
                ["a061", "쟞", 5, "쟥쟦쟧쟩쟪쟫쟭", 13],
                ["a081", "쟻", 4, "젂젃젅젆젇젉젋", 4, "젒젔젗", 4, "젞젟젡젢젣젥", 6, "젮젰젲", 5, "젹젺젻젽젾젿졁", 6, "졊졋졎", 5, "졕", 26, "졲졳졵졶졷졹졻", 4, "좂좄좈좉좊좎", 5, "좕", 7, "좞좠좢좣좤"],
                ["a141", "좥좦좧좩", 18, "좾좿죀죁"],
                ["a161", "죂죃죅죆죇죉죊죋죍", 6, "죖죘죚", 5, "죢죣죥"],
                ["a181", "죦", 14, "죶", 5, "죾죿줁줂줃줇", 4, "줎　、。·‥…¨〃­―∥＼∼‘’“”〔〕〈",
                        9, "±×÷≠≤≥∞∴°′″℃Å￠￡￥♂♀∠⊥⌒∂∇≡≒§※☆★○●◎◇◆□■△▲▽▼→←↑↓↔〓≪≫√∽∝∵∫∬∈∋⊆⊇⊂⊃∪∩∧∨￢"
                ],
                ["a241", "줐줒", 5, "줙", 18],
                ["a261", "줭", 6, "줵", 18],
                ["a281", "쥈", 7, "쥒쥓쥕쥖쥗쥙", 6, "쥢쥤", 7, "쥭쥮쥯⇒⇔∀∃´～ˇ˘˝˚˙¸˛¡¿ː∮∑∏¤℉‰◁◀▷▶♤♠♡♥♧♣⊙◈▣◐◑▒▤▥▨▧▦▩♨☏☎☜☞¶†‡↕↗↙↖↘♭♩♪♬㉿㈜№㏇™㏂㏘℡€®"],
                ["a341", "쥱쥲쥳쥵", 6, "쥽", 10, "즊즋즍즎즏"],
                ["a361", "즑", 6, "즚즜즞", 16],
                ["a381", "즯", 16, "짂짃짅짆짉짋", 4, "짒짔짗짘짛！", 58, "￦］", 32, "￣"],
                ["a441", "짞짟짡짣짥짦짨짩짪짫짮짲", 5, "짺짻짽짾짿쨁쨂쨃쨄"],
                ["a461", "쨅쨆쨇쨊쨎", 5, "쨕쨖쨗쨙", 12],
                ["a481", "쨦쨧쨨쨪", 28, "ㄱ", 93],
                ["a541", "쩇", 4, "쩎쩏쩑쩒쩓쩕", 6, "쩞쩢", 5, "쩩쩪"],
                ["a561", "쩫", 17, "쩾", 5, "쪅쪆"],
                ["a581", "쪇", 16, "쪙", 14, "ⅰ", 9],
                ["a5b0", "Ⅰ", 9],
                ["a5c1", "Α", 16, "Σ", 6],
                ["a5e1", "α", 16, "σ", 6],
                ["a641", "쪨", 19, "쪾쪿쫁쫂쫃쫅"],
                ["a661", "쫆", 5, "쫎쫐쫒쫔쫕쫖쫗쫚", 5, "쫡", 6],
                ["a681", "쫨쫩쫪쫫쫭", 6, "쫵", 18, "쬉쬊─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂┒┑┚┙┖┕┎┍┞┟┡┢┦┧┩┪┭┮┱┲┵┶┹┺┽┾╀╁╃", 7],
                ["a741", "쬋", 4, "쬑쬒쬓쬕쬖쬗쬙", 6, "쬢", 7],
                ["a761", "쬪", 22, "쭂쭃쭄"],
                ["a781", "쭅쭆쭇쭊쭋쭍쭎쭏쭑", 6, "쭚쭛쭜쭞", 5, "쭥", 7, "㎕㎖㎗ℓ㎘㏄㎣㎤㎥㎦㎙",
                        9, "㏊㎍㎎㎏㏏㎈㎉㏈㎧㎨㎰", 9, "㎀", 4, "㎺", 5, "㎐", 4, "Ω㏀㏁㎊㎋㎌㏖㏅㎭㎮㎯㏛㎩㎪㎫㎬㏝㏐㏓㏃㏉㏜㏆"
                ],
                ["a841", "쭭", 10, "쭺", 14],
                ["a861", "쮉", 18, "쮝", 6],
                ["a881", "쮤", 19, "쮹", 11, "ÆÐªĦ"],
                ["a8a6", "Ĳ"],
                ["a8a8", "ĿŁØŒºÞŦŊ"],
                ["a8b1", "㉠", 27, "ⓐ", 25, "①", 14, "½⅓⅔¼¾⅛⅜⅝⅞"],
                ["a941", "쯅", 14, "쯕", 10],
                ["a961", "쯠쯡쯢쯣쯥쯦쯨쯪", 18],
                ["a981", "쯽", 14, "찎찏찑찒찓찕", 6, "찞찟찠찣찤æđðħıĳĸŀłøœßþŧŋŉ㈀", 27, "⒜",
                        25, "⑴", 14, "¹²³⁴ⁿ₁₂₃₄"
                ],
                ["aa41", "찥찦찪찫찭찯찱", 6, "찺찿", 4, "챆챇챉챊챋챍챎"],
                ["aa61", "챏", 4, "챖챚", 5, "챡챢챣챥챧챩", 6, "챱챲"],
                ["aa81", "챳챴챶", 29, "ぁ", 82],
                ["ab41", "첔첕첖첗첚첛첝첞첟첡", 6, "첪첮", 5, "첶첷첹"],
                ["ab61", "첺첻첽", 6, "쳆쳈쳊", 5, "쳑쳒쳓쳕", 5],
                ["ab81", "쳛", 8, "쳥", 6, "쳭쳮쳯쳱", 12, "ァ", 85],
                ["ac41", "쳾쳿촀촂", 5, "촊촋촍촎촏촑", 6, "촚촜촞촟촠"],
                ["ac61", "촡촢촣촥촦촧촩촪촫촭", 11, "촺", 4],
                ["ac81",
                        "촿", 28, "쵝쵞쵟А", 5, "ЁЖ", 25
                ],
                ["acd1", "а", 5, "ёж", 25],
                ["ad41", "쵡쵢쵣쵥", 6, "쵮쵰쵲", 5, "쵹", 7],
                ["ad61", "춁", 6, "춉", 10, "춖춗춙춚춛춝춞춟"],
                ["ad81", "춠춡춢춣춦춨춪", 5, "춱", 18, "췅"],
                ["ae41", "췆", 5, "췍췎췏췑", 16],
                ["ae61", "췢", 5, "췩췪췫췭췮췯췱", 6, "췺췼췾", 4],
                ["ae81", "츃츅츆츇츉츊츋츍", 6, "츕츖츗츘츚", 5, "츢츣츥츦츧츩츪츫"],
                ["af41", "츬츭츮츯츲츴츶", 19],
                ["af61", "칊", 13, "칚칛칝칞칢", 5, "칪칬"],
                ["af81", "칮", 5, "칶칷칹칺칻칽",
                        6, "캆캈캊", 5, "캒캓캕캖캗캙"
                ],
                ["b041", "캚", 5, "캢캦", 5, "캮", 12],
                ["b061", "캻", 5, "컂", 19],
                ["b081", "컖", 13, "컦컧컩컪컭", 6, "컶컺", 5, "가각간갇갈갉갊감", 7, "같", 4, "갠갤갬갭갯갰갱갸갹갼걀걋걍걔걘걜거걱건걷걸걺검겁것겄겅겆겉겊겋게겐겔겜겝겟겠겡겨격겪견겯결겸겹겻겼경곁계곈곌곕곗고곡곤곧골곪곬곯곰곱곳공곶과곽관괄괆"],
                ["b141", "켂켃켅켆켇켉", 6, "켒켔켖", 5, "켝켞켟켡켢켣"],
                ["b161", "켥", 6, "켮켲",
                        5, "켹", 11
                ],
                ["b181", "콅", 14, "콖콗콙콚콛콝", 6, "콦콨콪콫콬괌괍괏광괘괜괠괩괬괭괴괵괸괼굄굅굇굉교굔굘굡굣구국군굳굴굵굶굻굼굽굿궁궂궈궉권궐궜궝궤궷귀귁귄귈귐귑귓규균귤그극근귿글긁금급긋긍긔기긱긴긷길긺김깁깃깅깆깊까깍깎깐깔깖깜깝깟깠깡깥깨깩깬깰깸"],
                ["b241", "콭콮콯콲콳콵콶콷콹", 6, "쾁쾂쾃쾄쾆", 5, "쾍"],
                ["b261", "쾎", 18, "쾢", 5, "쾩"],
                ["b281", "쾪", 5, "쾱", 18, "쿅", 6, "깹깻깼깽꺄꺅꺌꺼꺽꺾껀껄껌껍껏껐껑께껙껜껨껫껭껴껸껼꼇꼈꼍꼐꼬꼭꼰꼲꼴꼼꼽꼿꽁꽂꽃꽈꽉꽐꽜꽝꽤꽥꽹꾀꾄꾈꾐꾑꾕꾜꾸꾹꾼꿀꿇꿈꿉꿋꿍꿎꿔꿜꿨꿩꿰꿱꿴꿸뀀뀁뀄뀌뀐뀔뀜뀝뀨끄끅끈끊끌끎끓끔끕끗끙"],
                ["b341", "쿌", 19, "쿢쿣쿥쿦쿧쿩"],
                ["b361", "쿪", 5, "쿲쿴쿶", 5, "쿽쿾쿿퀁퀂퀃퀅", 5],
                ["b381", "퀋", 5, "퀒", 5, "퀙", 19, "끝끼끽낀낄낌낍낏낑나낙낚난낟날낡낢남납낫", 4, "낱낳내낵낸낼냄냅냇냈냉냐냑냔냘냠냥너넉넋넌널넒넓넘넙넛넜넝넣네넥넨넬넴넵넷넸넹녀녁년녈념녑녔녕녘녜녠노녹논놀놂놈놉놋농높놓놔놘놜놨뇌뇐뇔뇜뇝"],
                ["b441", "퀮", 5, "퀶퀷퀹퀺퀻퀽", 6, "큆큈큊", 5],
                ["b461", "큑큒큓큕큖큗큙", 6, "큡",
                        10, "큮큯"
                ],
                ["b481", "큱큲큳큵", 6, "큾큿킀킂", 18, "뇟뇨뇩뇬뇰뇹뇻뇽누눅눈눋눌눔눕눗눙눠눴눼뉘뉜뉠뉨뉩뉴뉵뉼늄늅늉느늑는늘늙늚늠늡늣능늦늪늬늰늴니닉닌닐닒님닙닛닝닢다닥닦단닫", 4, "닳담답닷", 4, "닿대댁댄댈댐댑댓댔댕댜더덕덖던덛덜덞덟덤덥"],
                ["b541", "킕", 14, "킦킧킩킪킫킭", 5],
                ["b561", "킳킶킸킺", 5, "탂탃탅탆탇탊", 5, "탒탖", 4],
                ["b581", "탛탞탟탡탢탣탥", 6, "탮탲", 5, "탹", 11, "덧덩덫덮데덱덴델뎀뎁뎃뎄뎅뎌뎐뎔뎠뎡뎨뎬도독돈돋돌돎돐돔돕돗동돛돝돠돤돨돼됐되된될됨됩됫됴두둑둔둘둠둡둣둥둬뒀뒈뒝뒤뒨뒬뒵뒷뒹듀듄듈듐듕드득든듣들듦듬듭듯등듸디딕딘딛딜딤딥딧딨딩딪따딱딴딸"],
                ["b641", "턅", 7, "턎", 17],
                ["b661", "턠", 15, "턲턳턵턶턷턹턻턼턽턾"],
                ["b681", "턿텂텆", 5, "텎텏텑텒텓텕", 6, "텞텠텢", 5, "텩텪텫텭땀땁땃땄땅땋때땍땐땔땜땝땟땠땡떠떡떤떨떪떫떰떱떳떴떵떻떼떽뗀뗄뗌뗍뗏뗐뗑뗘뗬또똑똔똘똥똬똴뙈뙤뙨뚜뚝뚠뚤뚫뚬뚱뛔뛰뛴뛸뜀뜁뜅뜨뜩뜬뜯뜰뜸뜹뜻띄띈띌띔띕띠띤띨띰띱띳띵라락란랄람랍랏랐랑랒랖랗"],
                ["b741", "텮", 13, "텽", 6, "톅톆톇톉톊"],
                ["b761", "톋", 20, "톢톣톥톦톧"],
                ["b781", "톩", 6, "톲톴톶톷톸톹톻톽톾톿퇁", 14, "래랙랜랠램랩랫랬랭랴략랸럇량러럭런럴럼럽럿렀렁렇레렉렌렐렘렙렛렝려력련렬렴렵렷렸령례롄롑롓로록론롤롬롭롯롱롸롼뢍뢨뢰뢴뢸룀룁룃룅료룐룔룝룟룡루룩룬룰룸룹룻룽뤄뤘뤠뤼뤽륀륄륌륏륑류륙륜률륨륩"],
                ["b841", "퇐", 7, "퇙", 17],
                ["b861", "퇫", 8, "퇵퇶퇷퇹", 13],
                ["b881", "툈툊", 5, "툑", 24, "륫륭르륵른를름릅릇릉릊릍릎리릭린릴림립릿링마막만많",
                        4, "맘맙맛망맞맡맣매맥맨맬맴맵맷맸맹맺먀먁먈먕머먹먼멀멂멈멉멋멍멎멓메멕멘멜멤멥멧멨멩며멱면멸몃몄명몇몌모목몫몬몰몲몸몹못몽뫄뫈뫘뫙뫼"
                ],
                ["b941", "툪툫툮툯툱툲툳툵", 6, "툾퉀퉂", 5, "퉉퉊퉋퉌"],
                ["b961", "퉍", 14, "퉝", 6, "퉥퉦퉧퉨"],
                ["b981", "퉩", 22, "튂튃튅튆튇튉튊튋튌묀묄묍묏묑묘묜묠묩묫무묵묶문묻물묽묾뭄뭅뭇뭉뭍뭏뭐뭔뭘뭡뭣뭬뮈뮌뮐뮤뮨뮬뮴뮷므믄믈믐믓미믹민믿밀밂밈밉밋밌밍및밑바",
                        4, "받", 4, "밤밥밧방밭배백밴밸뱀뱁뱃뱄뱅뱉뱌뱍뱐뱝버벅번벋벌벎범법벗"
                ],
                ["ba41", "튍튎튏튒튓튔튖", 5, "튝튞튟튡튢튣튥", 6, "튭"],
                ["ba61", "튮튯튰튲", 5, "튺튻튽튾틁틃", 4, "틊틌", 5],
                ["ba81", "틒틓틕틖틗틙틚틛틝", 6, "틦", 9, "틲틳틵틶틷틹틺벙벚베벡벤벧벨벰벱벳벴벵벼벽변별볍볏볐병볕볘볜보복볶본볼봄봅봇봉봐봔봤봬뵀뵈뵉뵌뵐뵘뵙뵤뵨부북분붇불붉붊붐붑붓붕붙붚붜붤붰붸뷔뷕뷘뷜뷩뷰뷴뷸븀븃븅브븍븐블븜븝븟비빅빈빌빎빔빕빗빙빚빛빠빡빤"],
                ["bb41", "틻", 4, "팂팄팆", 5, "팏팑팒팓팕팗", 4, "팞팢팣"],
                ["bb61", "팤팦팧팪팫팭팮팯팱", 6, "팺팾", 5, "퍆퍇퍈퍉"],
                ["bb81", "퍊", 31, "빨빪빰빱빳빴빵빻빼빽뺀뺄뺌뺍뺏뺐뺑뺘뺙뺨뻐뻑뻔뻗뻘뻠뻣뻤뻥뻬뼁뼈뼉뼘뼙뼛뼜뼝뽀뽁뽄뽈뽐뽑뽕뾔뾰뿅뿌뿍뿐뿔뿜뿟뿡쀼쁑쁘쁜쁠쁨쁩삐삑삔삘삠삡삣삥사삭삯산삳살삵삶삼삽삿샀상샅새색샌샐샘샙샛샜생샤"],
                ["bc41", "퍪", 17, "퍾퍿펁펂펃펅펆펇"],
                ["bc61", "펈펉펊펋펎펒",
                        5, "펚펛펝펞펟펡", 6, "펪펬펮"
                ],
                ["bc81", "펯", 4, "펵펶펷펹펺펻펽", 6, "폆폇폊", 5, "폑", 5, "샥샨샬샴샵샷샹섀섄섈섐섕서", 4, "섣설섦섧섬섭섯섰성섶세섹센셀셈셉셋셌셍셔셕션셜셤셥셧셨셩셰셴셸솅소속솎손솔솖솜솝솟송솥솨솩솬솰솽쇄쇈쇌쇔쇗쇘쇠쇤쇨쇰쇱쇳쇼쇽숀숄숌숍숏숑수숙순숟술숨숩숫숭"],
                ["bd41", "폗폙", 7, "폢폤", 7, "폮폯폱폲폳폵폶폷"],
                ["bd61", "폸폹폺폻폾퐀퐂", 5, "퐉", 13],
                ["bd81", "퐗", 5, "퐞",
                        25, "숯숱숲숴쉈쉐쉑쉔쉘쉠쉥쉬쉭쉰쉴쉼쉽쉿슁슈슉슐슘슛슝스슥슨슬슭슴습슷승시식신싣실싫심십싯싱싶싸싹싻싼쌀쌈쌉쌌쌍쌓쌔쌕쌘쌜쌤쌥쌨쌩썅써썩썬썰썲썸썹썼썽쎄쎈쎌쏀쏘쏙쏜쏟쏠쏢쏨쏩쏭쏴쏵쏸쐈쐐쐤쐬쐰"
                ],
                ["be41", "퐸", 7, "푁푂푃푅", 14],
                ["be61", "푔", 7, "푝푞푟푡푢푣푥", 7, "푮푰푱푲"],
                ["be81", "푳", 4, "푺푻푽푾풁풃", 4, "풊풌풎", 5, "풕", 8, "쐴쐼쐽쑈쑤쑥쑨쑬쑴쑵쑹쒀쒔쒜쒸쒼쓩쓰쓱쓴쓸쓺쓿씀씁씌씐씔씜씨씩씬씰씸씹씻씽아악안앉않알앍앎앓암압앗았앙앝앞애액앤앨앰앱앳앴앵야약얀얄얇얌얍얏양얕얗얘얜얠얩어억언얹얻얼얽얾엄",
                        6, "엌엎"
                ],
                ["bf41", "풞", 10, "풪", 14],
                ["bf61", "풹", 18, "퓍퓎퓏퓑퓒퓓퓕"],
                ["bf81", "퓖", 5, "퓝퓞퓠", 7, "퓩퓪퓫퓭퓮퓯퓱", 6, "퓹퓺퓼에엑엔엘엠엡엣엥여역엮연열엶엷염", 5, "옅옆옇예옌옐옘옙옛옜오옥온올옭옮옰옳옴옵옷옹옻와왁완왈왐왑왓왔왕왜왝왠왬왯왱외왹왼욀욈욉욋욍요욕욘욜욤욥욧용우욱운울욹욺움웁웃웅워웍원월웜웝웠웡웨"],
                ["c041", "퓾", 5, "픅픆픇픉픊픋픍", 6, "픖픘", 5],
                ["c061", "픞", 25],
                ["c081",
                        "픸픹픺픻픾픿핁핂핃핅", 6, "핎핐핒", 5, "핚핛핝핞핟핡핢핣웩웬웰웸웹웽위윅윈윌윔윕윗윙유육윤율윰윱윳융윷으윽은을읊음읍읏응", 7, "읜읠읨읫이익인일읽읾잃임입잇있잉잊잎자작잔잖잗잘잚잠잡잣잤장잦재잭잰잴잼잽잿쟀쟁쟈쟉쟌쟎쟐쟘쟝쟤쟨쟬저적전절젊"
                ],
                ["c141", "핤핦핧핪핬핮", 5, "핶핷핹핺핻핽", 6, "햆햊햋"],
                ["c161", "햌햍햎햏햑", 19, "햦햧"],
                ["c181", "햨", 31, "점접젓정젖제젝젠젤젬젭젯젱져젼졀졈졉졌졍졔조족존졸졺좀좁좃종좆좇좋좌좍좔좝좟좡좨좼좽죄죈죌죔죕죗죙죠죡죤죵주죽준줄줅줆줌줍줏중줘줬줴쥐쥑쥔쥘쥠쥡쥣쥬쥰쥴쥼즈즉즌즐즘즙즛증지직진짇질짊짐집짓"],
                ["c241", "헊헋헍헎헏헑헓", 4, "헚헜헞", 5, "헦헧헩헪헫헭헮"],
                ["c261", "헯", 4, "헶헸헺", 5, "혂혃혅혆혇혉", 6, "혒"],
                ["c281", "혖", 5, "혝혞혟혡혢혣혥", 7, "혮", 9, "혺혻징짖짙짚짜짝짠짢짤짧짬짭짯짰짱째짹짼쨀쨈쨉쨋쨌쨍쨔쨘쨩쩌쩍쩐쩔쩜쩝쩟쩠쩡쩨쩽쪄쪘쪼쪽쫀쫄쫌쫍쫏쫑쫓쫘쫙쫠쫬쫴쬈쬐쬔쬘쬠쬡쭁쭈쭉쭌쭐쭘쭙쭝쭤쭸쭹쮜쮸쯔쯤쯧쯩찌찍찐찔찜찝찡찢찧차착찬찮찰참찹찻"],
                ["c341", "혽혾혿홁홂홃홄홆홇홊홌홎홏홐홒홓홖홗홙홚홛홝",
                        4
                ],
                ["c361", "홢", 4, "홨홪", 5, "홲홳홵", 11],
                ["c381", "횁횂횄횆", 5, "횎횏횑횒횓횕", 7, "횞횠횢", 5, "횩횪찼창찾채책챈챌챔챕챗챘챙챠챤챦챨챰챵처척천철첨첩첫첬청체첵첸첼쳄쳅쳇쳉쳐쳔쳤쳬쳰촁초촉촌촐촘촙촛총촤촨촬촹최쵠쵤쵬쵭쵯쵱쵸춈추축춘출춤춥춧충춰췄췌췐취췬췰췸췹췻췽츄츈츌츔츙츠측츤츨츰츱츳층"],
                ["c441", "횫횭횮횯횱", 7, "횺횼", 7, "훆훇훉훊훋"],
                ["c461", "훍훎훏훐훒훓훕훖훘훚", 5,
                        "훡훢훣훥훦훧훩", 4
                ],
                ["c481", "훮훯훱훲훳훴훶", 5, "훾훿휁휂휃휅", 11, "휒휓휔치칙친칟칠칡침칩칫칭카칵칸칼캄캅캇캉캐캑캔캘캠캡캣캤캥캬캭컁커컥컨컫컬컴컵컷컸컹케켁켄켈켐켑켓켕켜켠켤켬켭켯켰켱켸코콕콘콜콤콥콧콩콰콱콴콸쾀쾅쾌쾡쾨쾰쿄쿠쿡쿤쿨쿰쿱쿳쿵쿼퀀퀄퀑퀘퀭퀴퀵퀸퀼"],
                ["c541", "휕휖휗휚휛휝휞휟휡", 6, "휪휬휮", 5, "휶휷휹"],
                ["c561", "휺휻휽", 6, "흅흆흈흊", 5, "흒흓흕흚",
                        4
                ],
                ["c581", "흟흢흤흦흧흨흪흫흭흮흯흱흲흳흵", 6, "흾흿힀힂", 5, "힊힋큄큅큇큉큐큔큘큠크큭큰클큼큽킁키킥킨킬킴킵킷킹타탁탄탈탉탐탑탓탔탕태택탠탤탬탭탯탰탱탸턍터턱턴털턺텀텁텃텄텅테텍텐텔템텝텟텡텨텬텼톄톈토톡톤톨톰톱톳통톺톼퇀퇘퇴퇸툇툉툐투툭툰툴툼툽툿퉁퉈퉜"],
                ["c641", "힍힎힏힑", 6, "힚힜힞", 5],
                ["c6a1", "퉤튀튁튄튈튐튑튕튜튠튤튬튱트특튼튿틀틂틈틉틋틔틘틜틤틥티틱틴틸팀팁팃팅파팍팎판팔팖팜팝팟팠팡팥패팩팬팰팸팹팻팼팽퍄퍅퍼퍽펀펄펌펍펏펐펑페펙펜펠펨펩펫펭펴편펼폄폅폈평폐폘폡폣포폭폰폴폼폽폿퐁"],
                ["c7a1", "퐈퐝푀푄표푠푤푭푯푸푹푼푿풀풂품풉풋풍풔풩퓌퓐퓔퓜퓟퓨퓬퓰퓸퓻퓽프픈플픔픕픗피픽핀필핌핍핏핑하학한할핥함합핫항해핵핸핼햄햅햇했행햐향허헉헌헐헒험헙헛헝헤헥헨헬헴헵헷헹혀혁현혈혐협혓혔형혜혠"],
                ["c8a1", "혤혭호혹혼홀홅홈홉홋홍홑화확환활홧황홰홱홴횃횅회획횐횔횝횟횡효횬횰횹횻후훅훈훌훑훔훗훙훠훤훨훰훵훼훽휀휄휑휘휙휜휠휨휩휫휭휴휵휸휼흄흇흉흐흑흔흖흗흘흙흠흡흣흥흩희흰흴흼흽힁히힉힌힐힘힙힛힝"],
                ["caa1", "伽佳假價加可呵哥嘉嫁家暇架枷柯歌珂痂稼苛茄街袈訶賈跏軻迦駕刻却各恪慤殼珏脚覺角閣侃刊墾奸姦干幹懇揀杆柬桿澗癎看磵稈竿簡肝艮艱諫間乫喝曷渴碣竭葛褐蝎鞨勘坎堪嵌感憾戡敢柑橄減甘疳監瞰紺邯鑑鑒龕"],
                ["cba1", "匣岬甲胛鉀閘剛堈姜岡崗康强彊慷江畺疆糠絳綱羌腔舡薑襁講鋼降鱇介价個凱塏愷愾慨改槪漑疥皆盖箇芥蓋豈鎧開喀客坑更粳羹醵倨去居巨拒据據擧渠炬祛距踞車遽鉅鋸乾件健巾建愆楗腱虔蹇鍵騫乞傑杰桀儉劍劒檢"],
                ["cca1", "瞼鈐黔劫怯迲偈憩揭擊格檄激膈覡隔堅牽犬甄絹繭肩見譴遣鵑抉決潔結缺訣兼慊箝謙鉗鎌京俓倞傾儆勁勍卿坰境庚徑慶憬擎敬景暻更梗涇炅烱璟璥瓊痙硬磬竟競絅經耕耿脛莖警輕逕鏡頃頸驚鯨係啓堺契季屆悸戒桂械"],
                ["cda1", "棨溪界癸磎稽系繫繼計誡谿階鷄古叩告呱固姑孤尻庫拷攷故敲暠枯槁沽痼皐睾稿羔考股膏苦苽菰藁蠱袴誥賈辜錮雇顧高鼓哭斛曲梏穀谷鵠困坤崑昆梱棍滾琨袞鯤汨滑骨供公共功孔工恐恭拱控攻珙空蚣貢鞏串寡戈果瓜"],
                ["cea1", "科菓誇課跨過鍋顆廓槨藿郭串冠官寬慣棺款灌琯瓘管罐菅觀貫關館刮恝括适侊光匡壙廣曠洸炚狂珖筐胱鑛卦掛罫乖傀塊壞怪愧拐槐魁宏紘肱轟交僑咬喬嬌嶠巧攪敎校橋狡皎矯絞翹膠蕎蛟較轎郊餃驕鮫丘久九仇俱具勾"],
                ["cfa1", "區口句咎嘔坵垢寇嶇廐懼拘救枸柩構歐毆毬求溝灸狗玖球瞿矩究絿耉臼舅舊苟衢謳購軀逑邱鉤銶駒驅鳩鷗龜國局菊鞠鞫麴君窘群裙軍郡堀屈掘窟宮弓穹窮芎躬倦券勸卷圈拳捲權淃眷厥獗蕨蹶闕机櫃潰詭軌饋句晷歸貴"],
                ["d0a1", "鬼龜叫圭奎揆槻珪硅窺竅糾葵規赳逵閨勻均畇筠菌鈞龜橘克剋劇戟棘極隙僅劤勤懃斤根槿瑾筋芹菫覲謹近饉契今妗擒昑檎琴禁禽芩衾衿襟金錦伋及急扱汲級給亘兢矜肯企伎其冀嗜器圻基埼夔奇妓寄岐崎己幾忌技旗旣"],
                ["d1a1", "朞期杞棋棄機欺氣汽沂淇玘琦琪璂璣畸畿碁磯祁祇祈祺箕紀綺羈耆耭肌記譏豈起錡錤飢饑騎騏驥麒緊佶吉拮桔金喫儺喇奈娜懦懶拏拿癩", 5, "那樂", 4, "諾酪駱亂卵暖欄煖爛蘭難鸞捏捺南嵐枏楠湳濫男藍襤拉"],
                ["d2a1", "納臘蠟衲囊娘廊", 4, "乃來內奈柰耐冷女年撚秊念恬拈捻寧寗努勞奴弩怒擄櫓爐瑙盧", 5, "駑魯", 10, "濃籠聾膿農惱牢磊腦賂雷尿壘", 7, "嫩訥杻紐勒", 5, "能菱陵尼泥匿溺多茶"],
                ["d3a1", "丹亶但單團壇彖斷旦檀段湍短端簞緞蛋袒鄲鍛撻澾獺疸達啖坍憺擔曇淡湛潭澹痰聃膽蕁覃談譚錟沓畓答踏遝唐堂塘幢戇撞棠當糖螳黨代垈坮大對岱帶待戴擡玳臺袋貸隊黛宅德悳倒刀到圖堵塗導屠島嶋度徒悼挑掉搗桃"],
                ["d4a1", "棹櫂淘渡滔濤燾盜睹禱稻萄覩賭跳蹈逃途道都鍍陶韜毒瀆牘犢獨督禿篤纛讀墩惇敦旽暾沌焞燉豚頓乭突仝冬凍動同憧東桐棟洞潼疼瞳童胴董銅兜斗杜枓痘竇荳讀豆逗頭屯臀芚遁遯鈍得嶝橙燈登等藤謄鄧騰喇懶拏癩羅"],
                ["d5a1", "蘿螺裸邏樂洛烙珞絡落諾酪駱丹亂卵欄欒瀾爛蘭鸞剌辣嵐擥攬欖濫籃纜藍襤覽拉臘蠟廊朗浪狼琅瑯螂郞來崍徠萊冷掠略亮倆兩凉梁樑粮粱糧良諒輛量侶儷勵呂廬慮戾旅櫚濾礪藜蠣閭驢驪麗黎力曆歷瀝礫轢靂憐戀攣漣"],
                ["d6a1", "煉璉練聯蓮輦連鍊冽列劣洌烈裂廉斂殮濂簾獵令伶囹寧岺嶺怜玲笭羚翎聆逞鈴零靈領齡例澧禮醴隷勞怒撈擄櫓潞瀘爐盧老蘆虜路輅露魯鷺鹵碌祿綠菉錄鹿麓論壟弄朧瀧瓏籠聾儡瀨牢磊賂賚賴雷了僚寮廖料燎療瞭聊蓼"],
                ["d7a1", "遼鬧龍壘婁屢樓淚漏瘻累縷蔞褸鏤陋劉旒柳榴流溜瀏琉瑠留瘤硫謬類六戮陸侖倫崙淪綸輪律慄栗率隆勒肋凜凌楞稜綾菱陵俚利厘吏唎履悧李梨浬犁狸理璃異痢籬罹羸莉裏裡里釐離鯉吝潾燐璘藺躪隣鱗麟林淋琳臨霖砬"],
                ["d8a1", "立笠粒摩瑪痲碼磨馬魔麻寞幕漠膜莫邈万卍娩巒彎慢挽晩曼滿漫灣瞞萬蔓蠻輓饅鰻唜抹末沫茉襪靺亡妄忘忙望網罔芒茫莽輞邙埋妹媒寐昧枚梅每煤罵買賣邁魅脈貊陌驀麥孟氓猛盲盟萌冪覓免冕勉棉沔眄眠綿緬面麵滅"],
                ["d9a1", "蔑冥名命明暝椧溟皿瞑茗蓂螟酩銘鳴袂侮冒募姆帽慕摸摹暮某模母毛牟牡瑁眸矛耗芼茅謀謨貌木沐牧目睦穆鶩歿沒夢朦蒙卯墓妙廟描昴杳渺猫竗苗錨務巫憮懋戊拇撫无楙武毋無珷畝繆舞茂蕪誣貿霧鵡墨默們刎吻問文"],
                ["daa1", "汶紊紋聞蚊門雯勿沕物味媚尾嵋彌微未梶楣渼湄眉米美薇謎迷靡黴岷悶愍憫敏旻旼民泯玟珉緡閔密蜜謐剝博拍搏撲朴樸泊珀璞箔粕縛膊舶薄迫雹駁伴半反叛拌搬攀斑槃泮潘班畔瘢盤盼磐磻礬絆般蟠返頒飯勃拔撥渤潑"],
                ["dba1", "發跋醱鉢髮魃倣傍坊妨尨幇彷房放方旁昉枋榜滂磅紡肪膀舫芳蒡蚌訪謗邦防龐倍俳北培徘拜排杯湃焙盃背胚裴裵褙賠輩配陪伯佰帛柏栢白百魄幡樊煩燔番磻繁蕃藩飜伐筏罰閥凡帆梵氾汎泛犯範范法琺僻劈壁擘檗璧癖"],
                ["dca1", "碧蘗闢霹便卞弁變辨辯邊別瞥鱉鼈丙倂兵屛幷昞昺柄棅炳甁病秉竝輧餠騈保堡報寶普步洑湺潽珤甫菩補褓譜輔伏僕匐卜宓復服福腹茯蔔複覆輹輻馥鰒本乶俸奉封峯峰捧棒烽熢琫縫蓬蜂逢鋒鳳不付俯傅剖副否咐埠夫婦"],
                ["dda1", "孚孵富府復扶敷斧浮溥父符簿缶腐腑膚艀芙莩訃負賦賻赴趺部釜阜附駙鳧北分吩噴墳奔奮忿憤扮昐汾焚盆粉糞紛芬賁雰不佛弗彿拂崩朋棚硼繃鵬丕備匕匪卑妃婢庇悲憊扉批斐枇榧比毖毗毘沸泌琵痺砒碑秕秘粃緋翡肥"],
                ["dea1", "脾臂菲蜚裨誹譬費鄙非飛鼻嚬嬪彬斌檳殯浜濱瀕牝玭貧賓頻憑氷聘騁乍事些仕伺似使俟僿史司唆嗣四士奢娑寫寺射巳師徙思捨斜斯柶査梭死沙泗渣瀉獅砂社祀祠私篩紗絲肆舍莎蓑蛇裟詐詞謝賜赦辭邪飼駟麝削數朔索"],
                ["dfa1", "傘刪山散汕珊産疝算蒜酸霰乷撒殺煞薩三參杉森渗芟蔘衫揷澁鈒颯上傷像償商喪嘗孀尙峠常床庠廂想桑橡湘爽牀狀相祥箱翔裳觴詳象賞霜塞璽賽嗇塞穡索色牲生甥省笙墅壻嶼序庶徐恕抒捿敍暑曙書栖棲犀瑞筮絮緖署"],
                ["e0a1", "胥舒薯西誓逝鋤黍鼠夕奭席惜昔晳析汐淅潟石碩蓆釋錫仙僊先善嬋宣扇敾旋渲煽琁瑄璇璿癬禪線繕羨腺膳船蘚蟬詵跣選銑鐥饍鮮卨屑楔泄洩渫舌薛褻設說雪齧剡暹殲纖蟾贍閃陝攝涉燮葉城姓宬性惺成星晟猩珹盛省筬"],
                ["e1a1", "聖聲腥誠醒世勢歲洗稅笹細說貰召嘯塑宵小少巢所掃搔昭梳沼消溯瀟炤燒甦疏疎瘙笑篠簫素紹蔬蕭蘇訴逍遡邵銷韶騷俗屬束涑粟續謖贖速孫巽損蓀遜飡率宋悚松淞訟誦送頌刷殺灑碎鎖衰釗修受嗽囚垂壽嫂守岫峀帥愁"],
                ["e2a1", "戍手授搜收數樹殊水洙漱燧狩獸琇璲瘦睡秀穗竪粹綏綬繡羞脩茱蒐蓚藪袖誰讐輸遂邃酬銖銹隋隧隨雖需須首髓鬚叔塾夙孰宿淑潚熟琡璹肅菽巡徇循恂旬栒楯橓殉洵淳珣盾瞬筍純脣舜荀蓴蕣詢諄醇錞順馴戌術述鉥崇崧"],
                ["e3a1", "嵩瑟膝蝨濕拾習褶襲丞乘僧勝升承昇繩蠅陞侍匙嘶始媤尸屎屍市弑恃施是時枾柴猜矢示翅蒔蓍視試詩諡豕豺埴寔式息拭植殖湜熄篒蝕識軾食飾伸侁信呻娠宸愼新晨燼申神紳腎臣莘薪藎蜃訊身辛辰迅失室實悉審尋心沁"],
                ["e4a1", "沈深瀋甚芯諶什十拾雙氏亞俄兒啞娥峨我牙芽莪蛾衙訝阿雅餓鴉鵝堊岳嶽幄惡愕握樂渥鄂鍔顎鰐齷安岸按晏案眼雁鞍顔鮟斡謁軋閼唵岩巖庵暗癌菴闇壓押狎鴨仰央怏昻殃秧鴦厓哀埃崖愛曖涯碍艾隘靄厄扼掖液縊腋額"],
                ["e5a1", "櫻罌鶯鸚也倻冶夜惹揶椰爺耶若野弱掠略約若葯蒻藥躍亮佯兩凉壤孃恙揚攘敭暘梁楊樣洋瀁煬痒瘍禳穰糧羊良襄諒讓釀陽量養圄御於漁瘀禦語馭魚齬億憶抑檍臆偃堰彦焉言諺孼蘖俺儼嚴奄掩淹嶪業円予余勵呂女如廬"],
                ["e6a1", "旅歟汝濾璵礖礪與艅茹輿轝閭餘驪麗黎亦力域役易曆歷疫繹譯轢逆驛嚥堧姸娟宴年延憐戀捐挻撚椽沇沿涎涓淵演漣烟然煙煉燃燕璉硏硯秊筵緣練縯聯衍軟輦蓮連鉛鍊鳶列劣咽悅涅烈熱裂說閱厭廉念捻染殮炎焰琰艶苒"],
                ["e7a1", "簾閻髥鹽曄獵燁葉令囹塋寧嶺嶸影怜映暎楹榮永泳渶潁濚瀛瀯煐營獰玲瑛瑩瓔盈穎纓羚聆英詠迎鈴鍈零霙靈領乂倪例刈叡曳汭濊猊睿穢芮藝蘂禮裔詣譽豫醴銳隸霓預五伍俉傲午吾吳嗚塢墺奧娛寤悟惡懊敖旿晤梧汚澳"],
                ["e8a1", "烏熬獒筽蜈誤鰲鼇屋沃獄玉鈺溫瑥瘟穩縕蘊兀壅擁瓮甕癰翁邕雍饔渦瓦窩窪臥蛙蝸訛婉完宛梡椀浣玩琓琬碗緩翫脘腕莞豌阮頑曰往旺枉汪王倭娃歪矮外嵬巍猥畏了僚僥凹堯夭妖姚寥寮尿嶢拗搖撓擾料曜樂橈燎燿瑤療"],
                ["e9a1", "窈窯繇繞耀腰蓼蟯要謠遙遼邀饒慾欲浴縟褥辱俑傭冗勇埇墉容庸慂榕涌湧溶熔瑢用甬聳茸蓉踊鎔鏞龍于佑偶優又友右宇寓尤愚憂旴牛玗瑀盂祐禑禹紆羽芋藕虞迂遇郵釪隅雨雩勖彧旭昱栯煜稶郁頊云暈橒殞澐熉耘芸蕓"],
                ["eaa1", "運隕雲韻蔚鬱亐熊雄元原員圓園垣媛嫄寃怨愿援沅洹湲源爰猿瑗苑袁轅遠阮院願鴛月越鉞位偉僞危圍委威尉慰暐渭爲瑋緯胃萎葦蔿蝟衛褘謂違韋魏乳侑儒兪劉唯喩孺宥幼幽庾悠惟愈愉揄攸有杻柔柚柳楡楢油洧流游溜"],
                ["eba1", "濡猶猷琉瑜由留癒硫紐維臾萸裕誘諛諭踰蹂遊逾遺酉釉鍮類六堉戮毓肉育陸倫允奫尹崙淪潤玧胤贇輪鈗閏律慄栗率聿戎瀜絨融隆垠恩慇殷誾銀隱乙吟淫蔭陰音飮揖泣邑凝應膺鷹依倚儀宜意懿擬椅毅疑矣義艤薏蟻衣誼"],
                ["eca1", "議醫二以伊利吏夷姨履已弛彛怡易李梨泥爾珥理異痍痢移罹而耳肄苡荑裏裡貽貳邇里離飴餌匿溺瀷益翊翌翼謚人仁刃印吝咽因姻寅引忍湮燐璘絪茵藺蚓認隣靭靷鱗麟一佚佾壹日溢逸鎰馹任壬妊姙恁林淋稔臨荏賃入卄"],
                ["eda1", "立笠粒仍剩孕芿仔刺咨姉姿子字孜恣慈滋炙煮玆瓷疵磁紫者自茨蔗藉諮資雌作勺嚼斫昨灼炸爵綽芍酌雀鵲孱棧殘潺盞岑暫潛箴簪蠶雜丈仗匠場墻壯奬將帳庄張掌暲杖樟檣欌漿牆狀獐璋章粧腸臟臧莊葬蔣薔藏裝贓醬長"],
                ["eea1", "障再哉在宰才材栽梓渽滓災縡裁財載齋齎爭箏諍錚佇低儲咀姐底抵杵楮樗沮渚狙猪疽箸紵苧菹著藷詛貯躇這邸雎齟勣吊嫡寂摘敵滴狄炙的積笛籍績翟荻謫賊赤跡蹟迪迹適鏑佃佺傳全典前剪塡塼奠專展廛悛戰栓殿氈澱"],
                ["efa1", "煎琠田甸畑癲筌箋箭篆纏詮輾轉鈿銓錢鐫電顚顫餞切截折浙癤竊節絶占岾店漸点粘霑鮎點接摺蝶丁井亭停偵呈姃定幀庭廷征情挺政整旌晶晸柾楨檉正汀淀淨渟湞瀞炡玎珽町睛碇禎程穽精綎艇訂諪貞鄭酊釘鉦鋌錠霆靖"],
                ["f0a1", "靜頂鼎制劑啼堤帝弟悌提梯濟祭第臍薺製諸蹄醍除際霽題齊俎兆凋助嘲弔彫措操早晁曺曹朝條棗槽漕潮照燥爪璪眺祖祚租稠窕粗糟組繰肇藻蚤詔調趙躁造遭釣阻雕鳥族簇足鏃存尊卒拙猝倧宗從悰慫棕淙琮種終綜縱腫"],
                ["f1a1", "踪踵鍾鐘佐坐左座挫罪主住侏做姝胄呪周嗾奏宙州廚晝朱柱株注洲湊澍炷珠疇籌紂紬綢舟蛛註誅走躊輳週酎酒鑄駐竹粥俊儁准埈寯峻晙樽浚準濬焌畯竣蠢逡遵雋駿茁中仲衆重卽櫛楫汁葺增憎曾拯烝甑症繒蒸證贈之只"],
                ["f2a1", "咫地址志持指摯支旨智枝枳止池沚漬知砥祉祗紙肢脂至芝芷蜘誌識贄趾遲直稙稷織職唇嗔塵振搢晉晋桭榛殄津溱珍瑨璡畛疹盡眞瞋秦縉縝臻蔯袗診賑軫辰進鎭陣陳震侄叱姪嫉帙桎瓆疾秩窒膣蛭質跌迭斟朕什執潗緝輯"],
                ["f3a1", "鏶集徵懲澄且侘借叉嗟嵯差次此磋箚茶蹉車遮捉搾着窄錯鑿齪撰澯燦璨瓚竄簒纂粲纘讚贊鑽餐饌刹察擦札紮僭參塹慘慙懺斬站讒讖倉倡創唱娼廠彰愴敞昌昶暢槍滄漲猖瘡窓脹艙菖蒼債埰寀寨彩採砦綵菜蔡采釵冊柵策"],
                ["f4a1", "責凄妻悽處倜刺剔尺慽戚拓擲斥滌瘠脊蹠陟隻仟千喘天川擅泉淺玔穿舛薦賤踐遷釧闡阡韆凸哲喆徹撤澈綴輟轍鐵僉尖沾添甛瞻簽籤詹諂堞妾帖捷牒疊睫諜貼輒廳晴淸聽菁請靑鯖切剃替涕滯締諦逮遞體初剿哨憔抄招梢"],
                ["f5a1", "椒楚樵炒焦硝礁礎秒稍肖艸苕草蕉貂超酢醋醮促囑燭矗蜀觸寸忖村邨叢塚寵悤憁摠總聰蔥銃撮催崔最墜抽推椎楸樞湫皺秋芻萩諏趨追鄒酋醜錐錘鎚雛騶鰍丑畜祝竺筑築縮蓄蹙蹴軸逐春椿瑃出朮黜充忠沖蟲衝衷悴膵萃"],
                ["f6a1", "贅取吹嘴娶就炊翠聚脆臭趣醉驟鷲側仄厠惻測層侈値嗤峙幟恥梔治淄熾痔痴癡稚穉緇緻置致蚩輜雉馳齒則勅飭親七柒漆侵寢枕沈浸琛砧針鍼蟄秤稱快他咤唾墮妥惰打拖朶楕舵陀馱駝倬卓啄坼度托拓擢晫柝濁濯琢琸託"],
                ["f7a1", "鐸呑嘆坦彈憚歎灘炭綻誕奪脫探眈耽貪塔搭榻宕帑湯糖蕩兌台太怠態殆汰泰笞胎苔跆邰颱宅擇澤撑攄兎吐土討慟桶洞痛筒統通堆槌腿褪退頹偸套妬投透鬪慝特闖坡婆巴把播擺杷波派爬琶破罷芭跛頗判坂板版瓣販辦鈑"],
                ["f8a1", "阪八叭捌佩唄悖敗沛浿牌狽稗覇貝彭澎烹膨愎便偏扁片篇編翩遍鞭騙貶坪平枰萍評吠嬖幣廢弊斃肺蔽閉陛佈包匍匏咆哺圃布怖抛抱捕暴泡浦疱砲胞脯苞葡蒲袍褒逋鋪飽鮑幅暴曝瀑爆輻俵剽彪慓杓標漂瓢票表豹飇飄驃"],
                ["f9a1", "品稟楓諷豊風馮彼披疲皮被避陂匹弼必泌珌畢疋筆苾馝乏逼下何厦夏廈昰河瑕荷蝦賀遐霞鰕壑學虐謔鶴寒恨悍旱汗漢澣瀚罕翰閑閒限韓割轄函含咸啣喊檻涵緘艦銜陷鹹合哈盒蛤閤闔陜亢伉姮嫦巷恒抗杭桁沆港缸肛航"],
                ["faa1", "行降項亥偕咳垓奚孩害懈楷海瀣蟹解該諧邂駭骸劾核倖幸杏荇行享向嚮珦鄕響餉饗香噓墟虛許憲櫶獻軒歇險驗奕爀赫革俔峴弦懸晛泫炫玄玹現眩睍絃絢縣舷衒見賢鉉顯孑穴血頁嫌俠協夾峽挾浹狹脅脇莢鋏頰亨兄刑型"],
                ["fba1", "形泂滎瀅灐炯熒珩瑩荊螢衡逈邢鎣馨兮彗惠慧暳蕙蹊醯鞋乎互呼壕壺好岵弧戶扈昊晧毫浩淏湖滸澔濠濩灝狐琥瑚瓠皓祜糊縞胡芦葫蒿虎號蝴護豪鎬頀顥惑或酷婚昏混渾琿魂忽惚笏哄弘汞泓洪烘紅虹訌鴻化和嬅樺火畵"],
                ["fca1", "禍禾花華話譁貨靴廓擴攫確碻穫丸喚奐宦幻患換歡晥桓渙煥環紈還驩鰥活滑猾豁闊凰幌徨恍惶愰慌晃晄榥況湟滉潢煌璜皇篁簧荒蝗遑隍黃匯回廻徊恢悔懷晦會檜淮澮灰獪繪膾茴蛔誨賄劃獲宖橫鐄哮嚆孝效斅曉梟涍淆"],
                ["fda1", "爻肴酵驍侯候厚后吼喉嗅帿後朽煦珝逅勛勳塤壎焄熏燻薰訓暈薨喧暄煊萱卉喙毁彙徽揮暉煇諱輝麾休携烋畦虧恤譎鷸兇凶匈洶胸黑昕欣炘痕吃屹紇訖欠欽歆吸恰洽翕興僖凞喜噫囍姬嬉希憙憘戱晞曦熙熹熺犧禧稀羲詰"]
            ]
        }, {}
    ],
    69: [function(g, p, m) {
            p.exports = [
                ["0", "\x00", 127],
                ["a140", "　，、。．‧；：？！︰…‥﹐﹑﹒·﹔﹕﹖﹗｜–︱—︳╴︴﹏（）︵︶｛｝︷︸〔〕︹︺【】︻︼《》︽︾〈〉︿﹀「」﹁﹂『』﹃﹄﹙﹚"],
                ["a1a1", "﹛﹜﹝﹞‘’“”〝〞‵′＃＆＊※§〃○●△▲◎☆★◇◆□■▽▼㊣℅¯￣＿ˍ﹉﹊﹍﹎﹋﹌﹟﹠﹡＋－×÷±√＜＞＝≦≧≠∞≒≡﹢", 4, "～∩∪⊥∠∟⊿㏒㏑∫∮∵∴♀♂⊕⊙↑↓←→↖↗↙↘∥∣／"],
                ["a240", "＼∕﹨＄￥〒￠￡％＠℃℉﹩﹪﹫㏕㎜㎝㎞㏎㎡㎎㎏㏄°兙兛兞兝兡兣嗧瓩糎▁", 7, "▏▎▍▌▋▊▉┼┴┬┤├▔─│▕┌┐└┘╭"],
                ["a2a1", "╮╰╯═╞╪╡◢◣◥◤╱╲╳０", 9, "Ⅰ", 9, "〡", 8, "十卄卅Ａ", 25, "ａ", 21],
                ["a340", "ｗｘｙｚΑ", 16, "Σ", 6, "α", 16, "σ", 6, "ㄅ", 10],
                ["a3a1", "ㄐ", 25, "˙ˉˊˇˋ"],
                ["a3e1", "€"],
                ["a440", "一乙丁七乃九了二人儿入八几刀刁力匕十卜又三下丈上丫丸凡久么也乞于亡兀刃勺千叉口土士夕大女子孑孓寸小尢尸山川工己已巳巾干廾弋弓才"],
                ["a4a1", "丑丐不中丰丹之尹予云井互五亢仁什仃仆仇仍今介仄元允內六兮公冗凶分切刈勻勾勿化匹午升卅卞厄友及反壬天夫太夭孔少尤尺屯巴幻廿弔引心戈戶手扎支文斗斤方日曰月木欠止歹毋比毛氏水火爪父爻片牙牛犬王丙"],
                ["a540", "世丕且丘主乍乏乎以付仔仕他仗代令仙仞充兄冉冊冬凹出凸刊加功包匆北匝仟半卉卡占卯卮去可古右召叮叩叨叼司叵叫另只史叱台句叭叻四囚外"],
                ["a5a1",
                        "央失奴奶孕它尼巨巧左市布平幼弁弘弗必戊打扔扒扑斥旦朮本未末札正母民氐永汁汀氾犯玄玉瓜瓦甘生用甩田由甲申疋白皮皿目矛矢石示禾穴立丞丟乒乓乩亙交亦亥仿伉伙伊伕伍伐休伏仲件任仰仳份企伋光兇兆先全"
                ],
                ["a640", "共再冰列刑划刎刖劣匈匡匠印危吉吏同吊吐吁吋各向名合吃后吆吒因回囝圳地在圭圬圯圩夙多夷夸妄奸妃好她如妁字存宇守宅安寺尖屹州帆并年"],
                ["a6a1", "式弛忙忖戎戌戍成扣扛托收早旨旬旭曲曳有朽朴朱朵次此死氖汝汗汙江池汐汕污汛汍汎灰牟牝百竹米糸缶羊羽老考而耒耳聿肉肋肌臣自至臼舌舛舟艮色艾虫血行衣西阡串亨位住佇佗佞伴佛何估佐佑伽伺伸佃佔似但佣"],
                ["a740", "作你伯低伶余佝佈佚兌克免兵冶冷別判利刪刨劫助努劬匣即卵吝吭吞吾否呎吧呆呃吳呈呂君吩告吹吻吸吮吵吶吠吼呀吱含吟听囪困囤囫坊坑址坍"],
                ["a7a1", "均坎圾坐坏圻壯夾妝妒妨妞妣妙妖妍妤妓妊妥孝孜孚孛完宋宏尬局屁尿尾岐岑岔岌巫希序庇床廷弄弟彤形彷役忘忌志忍忱快忸忪戒我抄抗抖技扶抉扭把扼找批扳抒扯折扮投抓抑抆改攻攸旱更束李杏材村杜杖杞杉杆杠"],
                ["a840",
                        "杓杗步每求汞沙沁沈沉沅沛汪決沐汰沌汨沖沒汽沃汲汾汴沆汶沍沔沘沂灶灼災灸牢牡牠狄狂玖甬甫男甸皂盯矣私秀禿究系罕肖肓肝肘肛肚育良芒"
                ],
                ["a8a1", "芋芍見角言谷豆豕貝赤走足身車辛辰迂迆迅迄巡邑邢邪邦那酉釆里防阮阱阪阬並乖乳事些亞享京佯依侍佳使佬供例來侃佰併侈佩佻侖佾侏侑佺兔兒兕兩具其典冽函刻券刷刺到刮制剁劾劻卒協卓卑卦卷卸卹取叔受味呵"],
                ["a940", "咖呸咕咀呻呷咄咒咆呼咐呱呶和咚呢周咋命咎固垃坷坪坩坡坦坤坼夜奉奇奈奄奔妾妻委妹妮姑姆姐姍始姓姊妯妳姒姅孟孤季宗定官宜宙宛尚屈居"],
                ["a9a1", "屆岷岡岸岩岫岱岳帘帚帖帕帛帑幸庚店府底庖延弦弧弩往征彿彼忝忠忽念忿怏怔怯怵怖怪怕怡性怩怫怛或戕房戾所承拉拌拄抿拂抹拒招披拓拔拋拈抨抽押拐拙拇拍抵拚抱拘拖拗拆抬拎放斧於旺昔易昌昆昂明昀昏昕昊"],
                ["aa40", "昇服朋杭枋枕東果杳杷枇枝林杯杰板枉松析杵枚枓杼杪杲欣武歧歿氓氛泣注泳沱泌泥河沽沾沼波沫法泓沸泄油況沮泗泅泱沿治泡泛泊沬泯泜泖泠"],
                ["aaa1",
                        "炕炎炒炊炙爬爭爸版牧物狀狎狙狗狐玩玨玟玫玥甽疝疙疚的盂盲直知矽社祀祁秉秈空穹竺糾罔羌羋者肺肥肢肱股肫肩肴肪肯臥臾舍芳芝芙芭芽芟芹花芬芥芯芸芣芰芾芷虎虱初表軋迎返近邵邸邱邶采金長門阜陀阿阻附"
                ],
                ["ab40", "陂隹雨青非亟亭亮信侵侯便俠俑俏保促侶俘俟俊俗侮俐俄係俚俎俞侷兗冒冑冠剎剃削前剌剋則勇勉勃勁匍南卻厚叛咬哀咨哎哉咸咦咳哇哂咽咪品"],
                ["aba1", "哄哈咯咫咱咻咩咧咿囿垂型垠垣垢城垮垓奕契奏奎奐姜姘姿姣姨娃姥姪姚姦威姻孩宣宦室客宥封屎屏屍屋峙峒巷帝帥帟幽庠度建弈弭彥很待徊律徇後徉怒思怠急怎怨恍恰恨恢恆恃恬恫恪恤扁拜挖按拼拭持拮拽指拱拷"],
                ["ac40", "拯括拾拴挑挂政故斫施既春昭映昧是星昨昱昤曷柿染柱柔某柬架枯柵柩柯柄柑枴柚查枸柏柞柳枰柙柢柝柒歪殃殆段毒毗氟泉洋洲洪流津洌洱洞洗"],
                ["aca1", "活洽派洶洛泵洹洧洸洩洮洵洎洫炫為炳炬炯炭炸炮炤爰牲牯牴狩狠狡玷珊玻玲珍珀玳甚甭畏界畎畋疫疤疥疢疣癸皆皇皈盈盆盃盅省盹相眉看盾盼眇矜砂研砌砍祆祉祈祇禹禺科秒秋穿突竿竽籽紂紅紀紉紇約紆缸美羿耄"],
                ["ad40",
                        "耐耍耑耶胖胥胚胃胄背胡胛胎胞胤胝致舢苧范茅苣苛苦茄若茂茉苒苗英茁苜苔苑苞苓苟苯茆虐虹虻虺衍衫要觔計訂訃貞負赴赳趴軍軌述迦迢迪迥"
                ],
                ["ada1", "迭迫迤迨郊郎郁郃酋酊重閂限陋陌降面革韋韭音頁風飛食首香乘亳倌倍倣俯倦倥俸倩倖倆值借倚倒們俺倀倔倨俱倡個候倘俳修倭倪俾倫倉兼冤冥冢凍凌准凋剖剜剔剛剝匪卿原厝叟哨唐唁唷哼哥哲唆哺唔哩哭員唉哮哪"],
                ["ae40", "哦唧唇哽唏圃圄埂埔埋埃堉夏套奘奚娑娘娜娟娛娓姬娠娣娩娥娌娉孫屘宰害家宴宮宵容宸射屑展屐峭峽峻峪峨峰島崁峴差席師庫庭座弱徒徑徐恙"],
                ["aea1", "恣恥恐恕恭恩息悄悟悚悍悔悌悅悖扇拳挈拿捎挾振捕捂捆捏捉挺捐挽挪挫挨捍捌效敉料旁旅時晉晏晃晒晌晅晁書朔朕朗校核案框桓根桂桔栩梳栗桌桑栽柴桐桀格桃株桅栓栘桁殊殉殷氣氧氨氦氤泰浪涕消涇浦浸海浙涓"],
                ["af40", "浬涉浮浚浴浩涌涊浹涅浥涔烊烘烤烙烈烏爹特狼狹狽狸狷玆班琉珮珠珪珞畔畝畜畚留疾病症疲疳疽疼疹痂疸皋皰益盍盎眩真眠眨矩砰砧砸砝破砷"],
                ["afa1",
                        "砥砭砠砟砲祕祐祠祟祖神祝祗祚秤秣秧租秦秩秘窄窈站笆笑粉紡紗紋紊素索純紐紕級紜納紙紛缺罟羔翅翁耆耘耕耙耗耽耿胱脂胰脅胭胴脆胸胳脈能脊胼胯臭臬舀舐航舫舨般芻茫荒荔荊茸荐草茵茴荏茲茹茶茗荀茱茨荃"
                ],
                ["b040", "虔蚊蚪蚓蚤蚩蚌蚣蚜衰衷袁袂衽衹記訐討訌訕訊託訓訖訏訑豈豺豹財貢起躬軒軔軏辱送逆迷退迺迴逃追逅迸邕郡郝郢酒配酌釘針釗釜釙閃院陣陡"],
                ["b0a1", "陛陝除陘陞隻飢馬骨高鬥鬲鬼乾偺偽停假偃偌做偉健偶偎偕偵側偷偏倏偯偭兜冕凰剪副勒務勘動匐匏匙匿區匾參曼商啪啦啄啞啡啃啊唱啖問啕唯啤唸售啜唬啣唳啁啗圈國圉域堅堊堆埠埤基堂堵執培夠奢娶婁婉婦婪婀"],
                ["b140", "娼婢婚婆婊孰寇寅寄寂宿密尉專將屠屜屝崇崆崎崛崖崢崑崩崔崙崤崧崗巢常帶帳帷康庸庶庵庾張強彗彬彩彫得徙從徘御徠徜恿患悉悠您惋悴惦悽"],
                ["b1a1", "情悻悵惜悼惘惕惆惟悸惚惇戚戛扈掠控捲掖探接捷捧掘措捱掩掉掃掛捫推掄授掙採掬排掏掀捻捩捨捺敝敖救教敗啟敏敘敕敔斜斛斬族旋旌旎晝晚晤晨晦晞曹勗望梁梯梢梓梵桿桶梱梧梗械梃棄梭梆梅梔條梨梟梡梂欲殺"],
                ["b240",
                        "毫毬氫涎涼淳淙液淡淌淤添淺清淇淋涯淑涮淞淹涸混淵淅淒渚涵淚淫淘淪深淮淨淆淄涪淬涿淦烹焉焊烽烯爽牽犁猜猛猖猓猙率琅琊球理現琍瓠瓶"
                ],
                ["b2a1", "瓷甜產略畦畢異疏痔痕疵痊痍皎盔盒盛眷眾眼眶眸眺硫硃硎祥票祭移窒窕笠笨笛第符笙笞笮粒粗粕絆絃統紮紹紼絀細紳組累終紲紱缽羞羚翌翎習耜聊聆脯脖脣脫脩脰脤舂舵舷舶船莎莞莘荸莢莖莽莫莒莊莓莉莠荷荻荼"],
                ["b340", "莆莧處彪蛇蛀蚶蛄蚵蛆蛋蚱蚯蛉術袞袈被袒袖袍袋覓規訪訝訣訥許設訟訛訢豉豚販責貫貨貪貧赧赦趾趺軛軟這逍通逗連速逝逐逕逞造透逢逖逛途"],
                ["b3a1", "部郭都酗野釵釦釣釧釭釩閉陪陵陳陸陰陴陶陷陬雀雪雩章竟頂頃魚鳥鹵鹿麥麻傢傍傅備傑傀傖傘傚最凱割剴創剩勞勝勛博厥啻喀喧啼喊喝喘喂喜喪喔喇喋喃喳單喟唾喲喚喻喬喱啾喉喫喙圍堯堪場堤堰報堡堝堠壹壺奠"],
                ["b440", "婷媚婿媒媛媧孳孱寒富寓寐尊尋就嵌嵐崴嵇巽幅帽幀幃幾廊廁廂廄弼彭復循徨惑惡悲悶惠愜愣惺愕惰惻惴慨惱愎惶愉愀愒戟扉掣掌描揀揩揉揆揍"],
                ["b4a1",
                        "插揣提握揖揭揮捶援揪換摒揚揹敞敦敢散斑斐斯普晰晴晶景暑智晾晷曾替期朝棺棕棠棘棗椅棟棵森棧棹棒棲棣棋棍植椒椎棉棚楮棻款欺欽殘殖殼毯氮氯氬港游湔渡渲湧湊渠渥渣減湛湘渤湖湮渭渦湯渴湍渺測湃渝渾滋"
                ],
                ["b540", "溉渙湎湣湄湲湩湟焙焚焦焰無然煮焜牌犄犀猶猥猴猩琺琪琳琢琥琵琶琴琯琛琦琨甥甦畫番痢痛痣痙痘痞痠登發皖皓皴盜睏短硝硬硯稍稈程稅稀窘"],
                ["b5a1", "窗窖童竣等策筆筐筒答筍筋筏筑粟粥絞結絨絕紫絮絲絡給絢絰絳善翔翕耋聒肅腕腔腋腑腎脹腆脾腌腓腴舒舜菩萃菸萍菠菅萋菁華菱菴著萊菰萌菌菽菲菊萸萎萄菜萇菔菟虛蛟蛙蛭蛔蛛蛤蛐蛞街裁裂袱覃視註詠評詞証詁"],
                ["b640", "詔詛詐詆訴診訶詖象貂貯貼貳貽賁費賀貴買貶貿貸越超趁跎距跋跚跑跌跛跆軻軸軼辜逮逵週逸進逶鄂郵鄉郾酣酥量鈔鈕鈣鈉鈞鈍鈐鈇鈑閔閏開閑"],
                ["b6a1", "間閒閎隊階隋陽隅隆隍陲隄雁雅雄集雇雯雲韌項順須飧飪飯飩飲飭馮馭黃黍黑亂傭債傲傳僅傾催傷傻傯僇剿剷剽募勦勤勢勣匯嗟嗨嗓嗦嗎嗜嗇嗑嗣嗤嗯嗚嗡嗅嗆嗥嗉園圓塞塑塘塗塚塔填塌塭塊塢塒塋奧嫁嫉嫌媾媽媼"],
                ["b740",
                        "媳嫂媲嵩嵯幌幹廉廈弒彙徬微愚意慈感想愛惹愁愈慎慌慄慍愾愴愧愍愆愷戡戢搓搾搞搪搭搽搬搏搜搔損搶搖搗搆敬斟新暗暉暇暈暖暄暘暍會榔業"
                ],
                ["b7a1", "楚楷楠楔極椰概楊楨楫楞楓楹榆楝楣楛歇歲毀殿毓毽溢溯滓溶滂源溝滇滅溥溘溼溺溫滑準溜滄滔溪溧溴煎煙煩煤煉照煜煬煦煌煥煞煆煨煖爺牒猷獅猿猾瑯瑚瑕瑟瑞瑁琿瑙瑛瑜當畸瘀痰瘁痲痱痺痿痴痳盞盟睛睫睦睞督"],
                ["b840", "睹睪睬睜睥睨睢矮碎碰碗碘碌碉硼碑碓硿祺祿禁萬禽稜稚稠稔稟稞窟窠筷節筠筮筧粱粳粵經絹綑綁綏絛置罩罪署義羨群聖聘肆肄腱腰腸腥腮腳腫"],
                ["b8a1", "腹腺腦舅艇蒂葷落萱葵葦葫葉葬葛萼萵葡董葩葭葆虞虜號蛹蜓蜈蜇蜀蛾蛻蜂蜃蜆蜊衙裟裔裙補裘裝裡裊裕裒覜解詫該詳試詩詰誇詼詣誠話誅詭詢詮詬詹詻訾詨豢貊貉賊資賈賄貲賃賂賅跡跟跨路跳跺跪跤跦躲較載軾輊"],
                ["b940", "辟農運遊道遂達逼違遐遇遏過遍遑逾遁鄒鄗酬酪酩釉鈷鉗鈸鈽鉀鈾鉛鉋鉤鉑鈴鉉鉍鉅鈹鈿鉚閘隘隔隕雍雋雉雊雷電雹零靖靴靶預頑頓頊頒頌飼飴"],
                ["b9a1",
                        "飽飾馳馱馴髡鳩麂鼎鼓鼠僧僮僥僖僭僚僕像僑僱僎僩兢凳劃劂匱厭嗾嘀嘛嘗嗽嘔嘆嘉嘍嘎嗷嘖嘟嘈嘐嗶團圖塵塾境墓墊塹墅塽壽夥夢夤奪奩嫡嫦嫩嫗嫖嫘嫣孵寞寧寡寥實寨寢寤察對屢嶄嶇幛幣幕幗幔廓廖弊彆彰徹慇"
                ],
                ["ba40", "愿態慷慢慣慟慚慘慵截撇摘摔撤摸摟摺摑摧搴摭摻敲斡旗旖暢暨暝榜榨榕槁榮槓構榛榷榻榫榴槐槍榭槌榦槃榣歉歌氳漳演滾漓滴漩漾漠漬漏漂漢"],
                ["baa1", "滿滯漆漱漸漲漣漕漫漯澈漪滬漁滲滌滷熔熙煽熊熄熒爾犒犖獄獐瑤瑣瑪瑰瑭甄疑瘧瘍瘋瘉瘓盡監瞄睽睿睡磁碟碧碳碩碣禎福禍種稱窪窩竭端管箕箋筵算箝箔箏箸箇箄粹粽精綻綰綜綽綾綠緊綴網綱綺綢綿綵綸維緒緇綬"],
                ["bb40", "罰翠翡翟聞聚肇腐膀膏膈膊腿膂臧臺與舔舞艋蓉蒿蓆蓄蒙蒞蒲蒜蓋蒸蓀蓓蒐蒼蓑蓊蜿蜜蜻蜢蜥蜴蜘蝕蜷蜩裳褂裴裹裸製裨褚裯誦誌語誣認誡誓誤"],
                ["bba1", "說誥誨誘誑誚誧豪貍貌賓賑賒赫趙趕跼輔輒輕輓辣遠遘遜遣遙遞遢遝遛鄙鄘鄞酵酸酷酴鉸銀銅銘銖鉻銓銜銨鉼銑閡閨閩閣閥閤隙障際雌雒需靼鞅韶頗領颯颱餃餅餌餉駁骯骰髦魁魂鳴鳶鳳麼鼻齊億儀僻僵價儂儈儉儅凜"],
                ["bc40",
                        "劇劈劉劍劊勰厲嘮嘻嘹嘲嘿嘴嘩噓噎噗噴嘶嘯嘰墀墟增墳墜墮墩墦奭嬉嫻嬋嫵嬌嬈寮寬審寫層履嶝嶔幢幟幡廢廚廟廝廣廠彈影德徵慶慧慮慝慕憂"
                ],
                ["bca1", "慼慰慫慾憧憐憫憎憬憚憤憔憮戮摩摯摹撞撲撈撐撰撥撓撕撩撒撮播撫撚撬撙撢撳敵敷數暮暫暴暱樣樟槨樁樞標槽模樓樊槳樂樅槭樑歐歎殤毅毆漿潼澄潑潦潔澆潭潛潸潮澎潺潰潤澗潘滕潯潠潟熟熬熱熨牖犛獎獗瑩璋璃"],
                ["bd40", "瑾璀畿瘠瘩瘟瘤瘦瘡瘢皚皺盤瞎瞇瞌瞑瞋磋磅確磊碾磕碼磐稿稼穀稽稷稻窯窮箭箱範箴篆篇篁箠篌糊締練緯緻緘緬緝編緣線緞緩綞緙緲緹罵罷羯"],
                ["bda1", "翩耦膛膜膝膠膚膘蔗蔽蔚蓮蔬蔭蔓蔑蔣蔡蔔蓬蔥蓿蔆螂蝴蝶蝠蝦蝸蝨蝙蝗蝌蝓衛衝褐複褒褓褕褊誼諒談諄誕請諸課諉諂調誰論諍誶誹諛豌豎豬賠賞賦賤賬賭賢賣賜質賡赭趟趣踫踐踝踢踏踩踟踡踞躺輝輛輟輩輦輪輜輞"],
                ["be40", "輥適遮遨遭遷鄰鄭鄧鄱醇醉醋醃鋅銻銷鋪銬鋤鋁銳銼鋒鋇鋰銲閭閱霄霆震霉靠鞍鞋鞏頡頫頜颳養餓餒餘駝駐駟駛駑駕駒駙骷髮髯鬧魅魄魷魯鴆鴉"],
                ["bea1",
                        "鴃麩麾黎墨齒儒儘儔儐儕冀冪凝劑劓勳噙噫噹噩噤噸噪器噥噱噯噬噢噶壁墾壇壅奮嬝嬴學寰導彊憲憑憩憊懍憶憾懊懈戰擅擁擋撻撼據擄擇擂操撿擒擔撾整曆曉暹曄曇暸樽樸樺橙橫橘樹橄橢橡橋橇樵機橈歙歷氅濂澱澡"
                ],
                ["bf40", "濃澤濁澧澳激澹澶澦澠澴熾燉燐燒燈燕熹燎燙燜燃燄獨璜璣璘璟璞瓢甌甍瘴瘸瘺盧盥瞠瞞瞟瞥磨磚磬磧禦積穎穆穌穋窺篙簑築篤篛篡篩篦糕糖縊"],
                ["bfa1", "縑縈縛縣縞縝縉縐罹羲翰翱翮耨膳膩膨臻興艘艙蕊蕙蕈蕨蕩蕃蕉蕭蕪蕞螃螟螞螢融衡褪褲褥褫褡親覦諦諺諫諱謀諜諧諮諾謁謂諷諭諳諶諼豫豭貓賴蹄踱踴蹂踹踵輻輯輸輳辨辦遵遴選遲遼遺鄴醒錠錶鋸錳錯錢鋼錫錄錚"],
                ["c040", "錐錦錡錕錮錙閻隧隨險雕霎霑霖霍霓霏靛靜靦鞘頰頸頻頷頭頹頤餐館餞餛餡餚駭駢駱骸骼髻髭鬨鮑鴕鴣鴦鴨鴒鴛默黔龍龜優償儡儲勵嚎嚀嚐嚅嚇"],
                ["c0a1", "嚏壕壓壑壎嬰嬪嬤孺尷屨嶼嶺嶽嶸幫彌徽應懂懇懦懋戲戴擎擊擘擠擰擦擬擱擢擭斂斃曙曖檀檔檄檢檜櫛檣橾檗檐檠歜殮毚氈濘濱濟濠濛濤濫濯澀濬濡濩濕濮濰燧營燮燦燥燭燬燴燠爵牆獰獲璩環璦璨癆療癌盪瞳瞪瞰瞬"],
                ["c140",
                        "瞧瞭矯磷磺磴磯礁禧禪穗窿簇簍篾篷簌篠糠糜糞糢糟糙糝縮績繆縷縲繃縫總縱繅繁縴縹繈縵縿縯罄翳翼聱聲聰聯聳臆臃膺臂臀膿膽臉膾臨舉艱薪"
                ],
                ["c1a1", "薄蕾薜薑薔薯薛薇薨薊虧蟀蟑螳蟒蟆螫螻螺蟈蟋褻褶襄褸褽覬謎謗謙講謊謠謝謄謐豁谿豳賺賽購賸賻趨蹉蹋蹈蹊轄輾轂轅輿避遽還邁邂邀鄹醣醞醜鍍鎂錨鍵鍊鍥鍋錘鍾鍬鍛鍰鍚鍔闊闋闌闈闆隱隸雖霜霞鞠韓顆颶餵騁"],
                ["c240", "駿鮮鮫鮪鮭鴻鴿麋黏點黜黝黛鼾齋叢嚕嚮壙壘嬸彝懣戳擴擲擾攆擺擻擷斷曜朦檳檬櫃檻檸櫂檮檯歟歸殯瀉瀋濾瀆濺瀑瀏燻燼燾燸獷獵璧璿甕癖癘"],
                ["c2a1", "癒瞽瞿瞻瞼礎禮穡穢穠竄竅簫簧簪簞簣簡糧織繕繞繚繡繒繙罈翹翻職聶臍臏舊藏薩藍藐藉薰薺薹薦蟯蟬蟲蟠覆覲觴謨謹謬謫豐贅蹙蹣蹦蹤蹟蹕軀轉轍邇邃邈醫醬釐鎔鎊鎖鎢鎳鎮鎬鎰鎘鎚鎗闔闖闐闕離雜雙雛雞霤鞣鞦"],
                ["c340", "鞭韹額顏題顎顓颺餾餿餽餮馥騎髁鬃鬆魏魎魍鯊鯉鯽鯈鯀鵑鵝鵠黠鼕鼬儳嚥壞壟壢寵龐廬懲懷懶懵攀攏曠曝櫥櫝櫚櫓瀛瀟瀨瀚瀝瀕瀘爆爍牘犢獸"],
                ["c3a1",
                        "獺璽瓊瓣疇疆癟癡矇礙禱穫穩簾簿簸簽簷籀繫繭繹繩繪羅繳羶羹羸臘藩藝藪藕藤藥藷蟻蠅蠍蟹蟾襠襟襖襞譁譜識證譚譎譏譆譙贈贊蹼蹲躇蹶蹬蹺蹴轔轎辭邊邋醱醮鏡鏑鏟鏃鏈鏜鏝鏖鏢鏍鏘鏤鏗鏨關隴難霪霧靡韜韻類"
                ],
                ["c440", "願顛颼饅饉騖騙鬍鯨鯧鯖鯛鶉鵡鵲鵪鵬麒麗麓麴勸嚨嚷嚶嚴嚼壤孀孃孽寶巉懸懺攘攔攙曦朧櫬瀾瀰瀲爐獻瓏癢癥礦礪礬礫竇競籌籃籍糯糰辮繽繼"],
                ["c4a1", "纂罌耀臚艦藻藹蘑藺蘆蘋蘇蘊蠔蠕襤覺觸議譬警譯譟譫贏贍躉躁躅躂醴釋鐘鐃鏽闡霰飄饒饑馨騫騰騷騵鰓鰍鹹麵黨鼯齟齣齡儷儸囁囀囂夔屬巍懼懾攝攜斕曩櫻欄櫺殲灌爛犧瓖瓔癩矓籐纏續羼蘗蘭蘚蠣蠢蠡蠟襪襬覽譴"],
                ["c540", "護譽贓躊躍躋轟辯醺鐮鐳鐵鐺鐸鐲鐫闢霸霹露響顧顥饗驅驃驀騾髏魔魑鰭鰥鶯鶴鷂鶸麝黯鼙齜齦齧儼儻囈囊囉孿巔巒彎懿攤權歡灑灘玀瓤疊癮癬"],
                ["c5a1", "禳籠籟聾聽臟襲襯觼讀贖贗躑躓轡酈鑄鑑鑒霽霾韃韁顫饕驕驍髒鬚鱉鰱鰾鰻鷓鷗鼴齬齪龔囌巖戀攣攫攪曬欐瓚竊籤籣籥纓纖纔臢蘸蘿蠱變邐邏鑣鑠鑤靨顯饜驚驛驗髓體髑鱔鱗鱖鷥麟黴囑壩攬灞癱癲矗罐羈蠶蠹衢讓讒"],
                ["c640",
                        "讖艷贛釀鑪靂靈靄韆顰驟鬢魘鱟鷹鷺鹼鹽鼇齷齲廳欖灣籬籮蠻觀躡釁鑲鑰顱饞髖鬣黌灤矚讚鑷韉驢驥纜讜躪釅鑽鑾鑼鱷鱸黷豔鑿鸚爨驪鬱鸛鸞籲"
                ],
                ["c940", "乂乜凵匚厂万丌乇亍囗兀屮彳丏冇与丮亓仂仉仈冘勼卬厹圠夃夬尐巿旡殳毌气爿丱丼仨仜仩仡仝仚刌匜卌圢圣夗夯宁宄尒尻屴屳帄庀庂忉戉扐氕"],
                ["c9a1", "氶汃氿氻犮犰玊禸肊阞伎优伬仵伔仱伀价伈伝伂伅伢伓伄仴伒冱刓刉刐劦匢匟卍厊吇囡囟圮圪圴夼妀奼妅奻奾奷奿孖尕尥屼屺屻屾巟幵庄异弚彴忕忔忏扜扞扤扡扦扢扙扠扚扥旯旮朾朹朸朻机朿朼朳氘汆汒汜汏汊汔汋"],
                ["ca40", "汌灱牞犴犵玎甪癿穵网艸艼芀艽艿虍襾邙邗邘邛邔阢阤阠阣佖伻佢佉体佤伾佧佒佟佁佘伭伳伿佡冏冹刜刞刡劭劮匉卣卲厎厏吰吷吪呔呅吙吜吥吘"],
                ["caa1", "吽呏呁吨吤呇囮囧囥坁坅坌坉坋坒夆奀妦妘妠妗妎妢妐妏妧妡宎宒尨尪岍岏岈岋岉岒岊岆岓岕巠帊帎庋庉庌庈庍弅弝彸彶忒忑忐忭忨忮忳忡忤忣忺忯忷忻怀忴戺抃抌抎抏抔抇扱扻扺扰抁抈扷扽扲扴攷旰旴旳旲旵杅杇"],
                ["cb40",
                        "杙杕杌杈杝杍杚杋毐氙氚汸汧汫沄沋沏汱汯汩沚汭沇沕沜汦汳汥汻沎灴灺牣犿犽狃狆狁犺狅玕玗玓玔玒町甹疔疕皁礽耴肕肙肐肒肜芐芏芅芎芑芓"
                ],
                ["cba1", "芊芃芄豸迉辿邟邡邥邞邧邠阰阨阯阭丳侘佼侅佽侀侇佶佴侉侄佷佌侗佪侚佹侁佸侐侜侔侞侒侂侕佫佮冞冼冾刵刲刳剆刱劼匊匋匼厒厔咇呿咁咑咂咈呫呺呾呥呬呴呦咍呯呡呠咘呣呧呤囷囹坯坲坭坫坱坰坶垀坵坻坳坴坢"],
                ["cc40", "坨坽夌奅妵妺姏姎妲姌姁妶妼姃姖妱妽姀姈妴姇孢孥宓宕屄屇岮岤岠岵岯岨岬岟岣岭岢岪岧岝岥岶岰岦帗帔帙弨弢弣弤彔徂彾彽忞忥怭怦怙怲怋"],
                ["cca1", "怴怊怗怳怚怞怬怢怍怐怮怓怑怌怉怜戔戽抭抴拑抾抪抶拊抮抳抯抻抩抰抸攽斨斻昉旼昄昒昈旻昃昋昍昅旽昑昐曶朊枅杬枎枒杶杻枘枆构杴枍枌杺枟枑枙枃杽极杸杹枔欥殀歾毞氝沓泬泫泮泙沶泔沭泧沷泐泂沺泃泆泭泲"],
                ["cd40", "泒泝沴沊沝沀泞泀洰泍泇沰泹泏泩泑炔炘炅炓炆炄炑炖炂炚炃牪狖狋狘狉狜狒狔狚狌狑玤玡玭玦玢玠玬玝瓝瓨甿畀甾疌疘皯盳盱盰盵矸矼矹矻矺"],
                ["cda1",
                        "矷祂礿秅穸穻竻籵糽耵肏肮肣肸肵肭舠芠苀芫芚芘芛芵芧芮芼芞芺芴芨芡芩苂芤苃芶芢虰虯虭虮豖迒迋迓迍迖迕迗邲邴邯邳邰阹阽阼阺陃俍俅俓侲俉俋俁俔俜俙侻侳俛俇俖侺俀侹俬剄剉勀勂匽卼厗厖厙厘咺咡咭咥哏"
                ],
                ["ce40", "哃茍咷咮哖咶哅哆咠呰咼咢咾呲哞咰垵垞垟垤垌垗垝垛垔垘垏垙垥垚垕壴复奓姡姞姮娀姱姝姺姽姼姶姤姲姷姛姩姳姵姠姾姴姭宨屌峐峘峌峗峋峛"],
                ["cea1", "峞峚峉峇峊峖峓峔峏峈峆峎峟峸巹帡帢帣帠帤庰庤庢庛庣庥弇弮彖徆怷怹恔恲恞恅恓恇恉恛恌恀恂恟怤恄恘恦恮扂扃拏挍挋拵挎挃拫拹挏挌拸拶挀挓挔拺挕拻拰敁敃斪斿昶昡昲昵昜昦昢昳昫昺昝昴昹昮朏朐柁柲柈枺"],
                ["cf40", "柜枻柸柘柀枷柅柫柤柟枵柍枳柷柶柮柣柂枹柎柧柰枲柼柆柭柌枮柦柛柺柉柊柃柪柋欨殂殄殶毖毘毠氠氡洨洴洭洟洼洿洒洊泚洳洄洙洺洚洑洀洝浂"],
                ["cfa1", "洁洘洷洃洏浀洇洠洬洈洢洉洐炷炟炾炱炰炡炴炵炩牁牉牊牬牰牳牮狊狤狨狫狟狪狦狣玅珌珂珈珅玹玶玵玴珫玿珇玾珃珆玸珋瓬瓮甮畇畈疧疪癹盄眈眃眄眅眊盷盻盺矧矨砆砑砒砅砐砏砎砉砃砓祊祌祋祅祄秕种秏秖秎窀"],
                ["d040",
                        "穾竑笀笁籺籸籹籿粀粁紃紈紁罘羑羍羾耇耎耏耔耷胘胇胠胑胈胂胐胅胣胙胜胊胕胉胏胗胦胍臿舡芔苙苾苹茇苨茀苕茺苫苖苴苬苡苲苵茌苻苶苰苪"
                ],
                ["d0a1", "苤苠苺苳苭虷虴虼虳衁衎衧衪衩觓訄訇赲迣迡迮迠郱邽邿郕郅邾郇郋郈釔釓陔陏陑陓陊陎倞倅倇倓倢倰倛俵俴倳倷倬俶俷倗倜倠倧倵倯倱倎党冔冓凊凄凅凈凎剡剚剒剞剟剕剢勍匎厞唦哢唗唒哧哳哤唚哿唄唈哫唑唅哱"],
                ["d140", "唊哻哷哸哠唎唃唋圁圂埌堲埕埒垺埆垽垼垸垶垿埇埐垹埁夎奊娙娖娭娮娕娏娗娊娞娳孬宧宭宬尃屖屔峬峿峮峱峷崀峹帩帨庨庮庪庬弳弰彧恝恚恧"],
                ["d1a1", "恁悢悈悀悒悁悝悃悕悛悗悇悜悎戙扆拲挐捖挬捄捅挶捃揤挹捋捊挼挩捁挴捘捔捙挭捇挳捚捑挸捗捀捈敊敆旆旃旄旂晊晟晇晑朒朓栟栚桉栲栳栻桋桏栖栱栜栵栫栭栯桎桄栴栝栒栔栦栨栮桍栺栥栠欬欯欭欱欴歭肂殈毦毤"],
                ["d240", "毨毣毢毧氥浺浣浤浶洍浡涒浘浢浭浯涑涍淯浿涆浞浧浠涗浰浼浟涂涘洯浨涋浾涀涄洖涃浻浽浵涐烜烓烑烝烋缹烢烗烒烞烠烔烍烅烆烇烚烎烡牂牸"],
                ["d2a1",
                        "牷牶猀狺狴狾狶狳狻猁珓珙珥珖玼珧珣珩珜珒珛珔珝珚珗珘珨瓞瓟瓴瓵甡畛畟疰痁疻痄痀疿疶疺皊盉眝眛眐眓眒眣眑眕眙眚眢眧砣砬砢砵砯砨砮砫砡砩砳砪砱祔祛祏祜祓祒祑秫秬秠秮秭秪秜秞秝窆窉窅窋窌窊窇竘笐"
                ],
                ["d340", "笄笓笅笏笈笊笎笉笒粄粑粊粌粈粍粅紞紝紑紎紘紖紓紟紒紏紌罜罡罞罠罝罛羖羒翃翂翀耖耾耹胺胲胹胵脁胻脀舁舯舥茳茭荄茙荑茥荖茿荁茦茜茢"],
                ["d3a1", "荂荎茛茪茈茼荍茖茤茠茷茯茩荇荅荌荓茞茬荋茧荈虓虒蚢蚨蚖蚍蚑蚞蚇蚗蚆蚋蚚蚅蚥蚙蚡蚧蚕蚘蚎蚝蚐蚔衃衄衭衵衶衲袀衱衿衯袃衾衴衼訒豇豗豻貤貣赶赸趵趷趶軑軓迾迵适迿迻逄迼迶郖郠郙郚郣郟郥郘郛郗郜郤酐"],
                ["d440", "酎酏釕釢釚陜陟隼飣髟鬯乿偰偪偡偞偠偓偋偝偲偈偍偁偛偊偢倕偅偟偩偫偣偤偆偀偮偳偗偑凐剫剭剬剮勖勓匭厜啵啶唼啍啐唴唪啑啢唶唵唰啒啅"],
                ["d4a1", "唌唲啥啎唹啈唭唻啀啋圊圇埻堔埢埶埜埴堀埭埽堈埸堋埳埏堇埮埣埲埥埬埡堎埼堐埧堁堌埱埩埰堍堄奜婠婘婕婧婞娸娵婭婐婟婥婬婓婤婗婃婝婒婄婛婈媎娾婍娹婌婰婩婇婑婖婂婜孲孮寁寀屙崞崋崝崚崠崌崨崍崦崥崏"],
                ["d540",
                        "崰崒崣崟崮帾帴庱庴庹庲庳弶弸徛徖徟悊悐悆悾悰悺惓惔惏惤惙惝惈悱惛悷惊悿惃惍惀挲捥掊掂捽掽掞掭掝掗掫掎捯掇掐据掯捵掜捭掮捼掤挻掟"
                ],
                ["d5a1", "捸掅掁掑掍捰敓旍晥晡晛晙晜晢朘桹梇梐梜桭桮梮梫楖桯梣梬梩桵桴梲梏桷梒桼桫桲梪梀桱桾梛梖梋梠梉梤桸桻梑梌梊桽欶欳欷欸殑殏殍殎殌氪淀涫涴涳湴涬淩淢涷淶淔渀淈淠淟淖涾淥淜淝淛淴淊涽淭淰涺淕淂淏淉"],
                ["d640", "淐淲淓淽淗淍淣涻烺焍烷焗烴焌烰焄烳焐烼烿焆焓焀烸烶焋焂焎牾牻牼牿猝猗猇猑猘猊猈狿猏猞玈珶珸珵琄琁珽琇琀珺珼珿琌琋珴琈畤畣痎痒痏"],
                ["d6a1", "痋痌痑痐皏皉盓眹眯眭眱眲眴眳眽眥眻眵硈硒硉硍硊硌砦硅硐祤祧祩祪祣祫祡离秺秸秶秷窏窔窐笵筇笴笥笰笢笤笳笘笪笝笱笫笭笯笲笸笚笣粔粘粖粣紵紽紸紶紺絅紬紩絁絇紾紿絊紻紨罣羕羜羝羛翊翋翍翐翑翇翏翉耟"],
                ["d740", "耞耛聇聃聈脘脥脙脛脭脟脬脞脡脕脧脝脢舑舸舳舺舴舲艴莐莣莨莍荺荳莤荴莏莁莕莙荵莔莩荽莃莌莝莛莪莋荾莥莯莈莗莰荿莦莇莮荶莚虙虖蚿蚷"],
                ["d7a1",
                        "蛂蛁蛅蚺蚰蛈蚹蚳蚸蛌蚴蚻蚼蛃蚽蚾衒袉袕袨袢袪袚袑袡袟袘袧袙袛袗袤袬袌袓袎覂觖觙觕訰訧訬訞谹谻豜豝豽貥赽赻赹趼跂趹趿跁軘軞軝軜軗軠軡逤逋逑逜逌逡郯郪郰郴郲郳郔郫郬郩酖酘酚酓酕釬釴釱釳釸釤釹釪"
                ],
                ["d840", "釫釷釨釮镺閆閈陼陭陫陱陯隿靪頄飥馗傛傕傔傞傋傣傃傌傎傝偨傜傒傂傇兟凔匒匑厤厧喑喨喥喭啷噅喢喓喈喏喵喁喣喒喤啽喌喦啿喕喡喎圌堩堷"],
                ["d8a1", "堙堞堧堣堨埵塈堥堜堛堳堿堶堮堹堸堭堬堻奡媯媔媟婺媢媞婸媦婼媥媬媕媮娷媄媊媗媃媋媩婻婽媌媜媏媓媝寪寍寋寔寑寊寎尌尰崷嵃嵫嵁嵋崿崵嵑嵎嵕崳崺嵒崽崱嵙嵂崹嵉崸崼崲崶嵀嵅幄幁彘徦徥徫惉悹惌惢惎惄愔"],
                ["d940", "惲愊愖愅惵愓惸惼惾惁愃愘愝愐惿愄愋扊掔掱掰揎揥揨揯揃撝揳揊揠揶揕揲揵摡揟掾揝揜揄揘揓揂揇揌揋揈揰揗揙攲敧敪敤敜敨敥斌斝斞斮旐旒"],
                ["d9a1", "晼晬晻暀晱晹晪晲朁椌棓椄棜椪棬棪棱椏棖棷棫棤棶椓椐棳棡椇棌椈楰梴椑棯棆椔棸棐棽棼棨椋椊椗棎棈棝棞棦棴棑椆棔棩椕椥棇欹欻欿欼殔殗殙殕殽毰毲毳氰淼湆湇渟湉溈渼渽湅湢渫渿湁湝湳渜渳湋湀湑渻渃渮湞"],
                ["da40",
                        "湨湜湡渱渨湠湱湫渹渢渰湓湥渧湸湤湷湕湹湒湦渵渶湚焠焞焯烻焮焱焣焥焢焲焟焨焺焛牋牚犈犉犆犅犋猒猋猰猢猱猳猧猲猭猦猣猵猌琮琬琰琫琖"
                ],
                ["daa1", "琚琡琭琱琤琣琝琩琠琲瓻甯畯畬痧痚痡痦痝痟痤痗皕皒盚睆睇睄睍睅睊睎睋睌矞矬硠硤硥硜硭硱硪确硰硩硨硞硢祴祳祲祰稂稊稃稌稄窙竦竤筊笻筄筈筌筎筀筘筅粢粞粨粡絘絯絣絓絖絧絪絏絭絜絫絒絔絩絑絟絎缾缿罥"],
                ["db40", "罦羢羠羡翗聑聏聐胾胔腃腊腒腏腇脽腍脺臦臮臷臸臹舄舼舽舿艵茻菏菹萣菀菨萒菧菤菼菶萐菆菈菫菣莿萁菝菥菘菿菡菋菎菖菵菉萉萏菞萑萆菂菳"],
                ["dba1", "菕菺菇菑菪萓菃菬菮菄菻菗菢萛菛菾蛘蛢蛦蛓蛣蛚蛪蛝蛫蛜蛬蛩蛗蛨蛑衈衖衕袺裗袹袸裀袾袶袼袷袽袲褁裉覕覘覗觝觚觛詎詍訹詙詀詗詘詄詅詒詈詑詊詌詏豟貁貀貺貾貰貹貵趄趀趉跘跓跍跇跖跜跏跕跙跈跗跅軯軷軺"],
                ["dc40", "軹軦軮軥軵軧軨軶軫軱軬軴軩逭逴逯鄆鄬鄄郿郼鄈郹郻鄁鄀鄇鄅鄃酡酤酟酢酠鈁鈊鈥鈃鈚鈦鈏鈌鈀鈒釿釽鈆鈄鈧鈂鈜鈤鈙鈗鈅鈖镻閍閌閐隇陾隈"],
                ["dca1",
                        "隉隃隀雂雈雃雱雰靬靰靮頇颩飫鳦黹亃亄亶傽傿僆傮僄僊傴僈僂傰僁傺傱僋僉傶傸凗剺剸剻剼嗃嗛嗌嗐嗋嗊嗝嗀嗔嗄嗩喿嗒喍嗏嗕嗢嗖嗈嗲嗍嗙嗂圔塓塨塤塏塍塉塯塕塎塝塙塥塛堽塣塱壼嫇嫄嫋媺媸媱媵媰媿嫈媻嫆"
                ],
                ["dd40", "媷嫀嫊媴媶嫍媹媐寖寘寙尟尳嵱嵣嵊嵥嵲嵬嵞嵨嵧嵢巰幏幎幊幍幋廅廌廆廋廇彀徯徭惷慉慊愫慅愶愲愮慆愯慏愩慀戠酨戣戥戤揅揱揫搐搒搉搠搤"],
                ["dda1", "搳摃搟搕搘搹搷搢搣搌搦搰搨摁搵搯搊搚摀搥搧搋揧搛搮搡搎敯斒旓暆暌暕暐暋暊暙暔晸朠楦楟椸楎楢楱椿楅楪椹楂楗楙楺楈楉椵楬椳椽楥棰楸椴楩楀楯楄楶楘楁楴楌椻楋椷楜楏楑椲楒椯楻椼歆歅歃歂歈歁殛嗀毻毼"],
                ["de40", "毹毷毸溛滖滈溏滀溟溓溔溠溱溹滆滒溽滁溞滉溷溰滍溦滏溲溾滃滜滘溙溒溎溍溤溡溿溳滐滊溗溮溣煇煔煒煣煠煁煝煢煲煸煪煡煂煘煃煋煰煟煐煓"],
                ["dea1", "煄煍煚牏犍犌犑犐犎猼獂猻猺獀獊獉瑄瑊瑋瑒瑑瑗瑀瑏瑐瑎瑂瑆瑍瑔瓡瓿瓾瓽甝畹畷榃痯瘏瘃痷痾痼痹痸瘐痻痶痭痵痽皙皵盝睕睟睠睒睖睚睩睧睔睙睭矠碇碚碔碏碄碕碅碆碡碃硹碙碀碖硻祼禂祽祹稑稘稙稒稗稕稢稓"],
                ["df40",
                        "稛稐窣窢窞竫筦筤筭筴筩筲筥筳筱筰筡筸筶筣粲粴粯綈綆綀綍絿綅絺綎絻綃絼綌綔綄絽綒罭罫罧罨罬羦羥羧翛翜耡腤腠腷腜腩腛腢腲朡腞腶腧腯"
                ],
                ["dfa1", "腄腡舝艉艄艀艂艅蓱萿葖葶葹蒏蒍葥葑葀蒆葧萰葍葽葚葙葴葳葝蔇葞萷萺萴葺葃葸萲葅萩菙葋萯葂萭葟葰萹葎葌葒葯蓅蒎萻葇萶萳葨葾葄萫葠葔葮葐蜋蜄蛷蜌蛺蛖蛵蝍蛸蜎蜉蜁蛶蜍蜅裖裋裍裎裞裛裚裌裐覅覛觟觥觤"],
                ["e040", "觡觠觢觜触詶誆詿詡訿詷誂誄詵誃誁詴詺谼豋豊豥豤豦貆貄貅賌赨赩趑趌趎趏趍趓趔趐趒跰跠跬跱跮跐跩跣跢跧跲跫跴輆軿輁輀輅輇輈輂輋遒逿"],
                ["e0a1", "遄遉逽鄐鄍鄏鄑鄖鄔鄋鄎酮酯鉈鉒鈰鈺鉦鈳鉥鉞銃鈮鉊鉆鉭鉬鉏鉠鉧鉯鈶鉡鉰鈱鉔鉣鉐鉲鉎鉓鉌鉖鈲閟閜閞閛隒隓隑隗雎雺雽雸雵靳靷靸靲頏頍頎颬飶飹馯馲馰馵骭骫魛鳪鳭鳧麀黽僦僔僗僨僳僛僪僝僤僓僬僰僯僣僠"],
                ["e140", "凘劀劁勩勫匰厬嘧嘕嘌嘒嗼嘏嘜嘁嘓嘂嗺嘝嘄嗿嗹墉塼墐墘墆墁塿塴墋塺墇墑墎塶墂墈塻墔墏壾奫嫜嫮嫥嫕嫪嫚嫭嫫嫳嫢嫠嫛嫬嫞嫝嫙嫨嫟孷寠"],
                ["e1a1",
                        "寣屣嶂嶀嵽嶆嵺嶁嵷嶊嶉嶈嵾嵼嶍嵹嵿幘幙幓廘廑廗廎廜廕廙廒廔彄彃彯徶愬愨慁慞慱慳慒慓慲慬憀慴慔慺慛慥愻慪慡慖戩戧戫搫摍摛摝摴摶摲摳摽摵摦撦摎撂摞摜摋摓摠摐摿搿摬摫摙摥摷敳斠暡暠暟朅朄朢榱榶槉"
                ],
                ["e240", "榠槎榖榰榬榼榑榙榎榧榍榩榾榯榿槄榽榤槔榹槊榚槏榳榓榪榡榞槙榗榐槂榵榥槆歊歍歋殞殟殠毃毄毾滎滵滱漃漥滸漷滻漮漉潎漙漚漧漘漻漒滭漊"],
                ["e2a1", "漶潳滹滮漭潀漰漼漵滫漇漎潃漅滽滶漹漜滼漺漟漍漞漈漡熇熐熉熀熅熂熏煻熆熁熗牄牓犗犕犓獃獍獑獌瑢瑳瑱瑵瑲瑧瑮甀甂甃畽疐瘖瘈瘌瘕瘑瘊瘔皸瞁睼瞅瞂睮瞀睯睾瞃碲碪碴碭碨硾碫碞碥碠碬碢碤禘禊禋禖禕禔禓"],
                ["e340", "禗禈禒禐稫穊稰稯稨稦窨窫窬竮箈箜箊箑箐箖箍箌箛箎箅箘劄箙箤箂粻粿粼粺綧綷緂綣綪緁緀緅綝緎緄緆緋緌綯綹綖綼綟綦綮綩綡緉罳翢翣翥翞"],
                ["e3a1", "耤聝聜膉膆膃膇膍膌膋舕蒗蒤蒡蒟蒺蓎蓂蒬蒮蒫蒹蒴蓁蓍蒪蒚蒱蓐蒝蒧蒻蒢蒔蓇蓌蒛蒩蒯蒨蓖蒘蒶蓏蒠蓗蓔蓒蓛蒰蒑虡蜳蜣蜨蝫蝀蜮蜞蜡蜙蜛蝃蜬蝁蜾蝆蜠蜲蜪蜭蜼蜒蜺蜱蜵蝂蜦蜧蜸蜤蜚蜰蜑裷裧裱裲裺裾裮裼裶裻"],
                ["e440",
                        "裰裬裫覝覡覟覞觩觫觨誫誙誋誒誏誖谽豨豩賕賏賗趖踉踂跿踍跽踊踃踇踆踅跾踀踄輐輑輎輍鄣鄜鄠鄢鄟鄝鄚鄤鄡鄛酺酲酹酳銥銤鉶銛鉺銠銔銪銍"
                ],
                ["e4a1", "銦銚銫鉹銗鉿銣鋮銎銂銕銢鉽銈銡銊銆銌銙銧鉾銇銩銝銋鈭隞隡雿靘靽靺靾鞃鞀鞂靻鞄鞁靿韎韍頖颭颮餂餀餇馝馜駃馹馻馺駂馽駇骱髣髧鬾鬿魠魡魟鳱鳲鳵麧僿儃儰僸儆儇僶僾儋儌僽儊劋劌勱勯噈噂噌嘵噁噊噉噆噘"],
                ["e540", "噚噀嘳嘽嘬嘾嘸嘪嘺圚墫墝墱墠墣墯墬墥墡壿嫿嫴嫽嫷嫶嬃嫸嬂嫹嬁嬇嬅嬏屧嶙嶗嶟嶒嶢嶓嶕嶠嶜嶡嶚嶞幩幝幠幜緳廛廞廡彉徲憋憃慹憱憰憢憉"],
                ["e5a1", "憛憓憯憭憟憒憪憡憍慦憳戭摮摰撖撠撅撗撜撏撋撊撌撣撟摨撱撘敶敺敹敻斲斳暵暰暩暲暷暪暯樀樆樗槥槸樕槱槤樠槿槬槢樛樝槾樧槲槮樔槷槧橀樈槦槻樍槼槫樉樄樘樥樏槶樦樇槴樖歑殥殣殢殦氁氀毿氂潁漦潾澇濆澒"],
                ["e640", "澍澉澌潢潏澅潚澖潶潬澂潕潲潒潐潗澔澓潝漀潡潫潽潧澐潓澋潩潿澕潣潷潪潻熲熯熛熰熠熚熩熵熝熥熞熤熡熪熜熧熳犘犚獘獒獞獟獠獝獛獡獚獙"],
                ["e6a1",
                        "獢璇璉璊璆璁瑽璅璈瑼瑹甈甇畾瘥瘞瘙瘝瘜瘣瘚瘨瘛皜皝皞皛瞍瞏瞉瞈磍碻磏磌磑磎磔磈磃磄磉禚禡禠禜禢禛歶稹窲窴窳箷篋箾箬篎箯箹篊箵糅糈糌糋緷緛緪緧緗緡縃緺緦緶緱緰緮緟罶羬羰羭翭翫翪翬翦翨聤聧膣膟"
                ],
                ["e740", "膞膕膢膙膗舖艏艓艒艐艎艑蔤蔻蔏蔀蔩蔎蔉蔍蔟蔊蔧蔜蓻蔫蓺蔈蔌蓴蔪蓲蔕蓷蓫蓳蓼蔒蓪蓩蔖蓾蔨蔝蔮蔂蓽蔞蓶蔱蔦蓧蓨蓰蓯蓹蔘蔠蔰蔋蔙蔯虢"],
                ["e7a1", "蝖蝣蝤蝷蟡蝳蝘蝔蝛蝒蝡蝚蝑蝞蝭蝪蝐蝎蝟蝝蝯蝬蝺蝮蝜蝥蝏蝻蝵蝢蝧蝩衚褅褌褔褋褗褘褙褆褖褑褎褉覢覤覣觭觰觬諏諆誸諓諑諔諕誻諗誾諀諅諘諃誺誽諙谾豍貏賥賟賙賨賚賝賧趠趜趡趛踠踣踥踤踮踕踛踖踑踙踦踧"],
                ["e840", "踔踒踘踓踜踗踚輬輤輘輚輠輣輖輗遳遰遯遧遫鄯鄫鄩鄪鄲鄦鄮醅醆醊醁醂醄醀鋐鋃鋄鋀鋙銶鋏鋱鋟鋘鋩鋗鋝鋌鋯鋂鋨鋊鋈鋎鋦鋍鋕鋉鋠鋞鋧鋑鋓"],
                ["e8a1", "銵鋡鋆銴镼閬閫閮閰隤隢雓霅霈霂靚鞊鞎鞈韐韏頞頝頦頩頨頠頛頧颲餈飺餑餔餖餗餕駜駍駏駓駔駎駉駖駘駋駗駌骳髬髫髳髲髱魆魃魧魴魱魦魶魵魰魨魤魬鳼鳺鳽鳿鳷鴇鴀鳹鳻鴈鴅鴄麃黓鼏鼐儜儓儗儚儑凞匴叡噰噠噮"],
                ["e940",
                        "噳噦噣噭噲噞噷圜圛壈墽壉墿墺壂墼壆嬗嬙嬛嬡嬔嬓嬐嬖嬨嬚嬠嬞寯嶬嶱嶩嶧嶵嶰嶮嶪嶨嶲嶭嶯嶴幧幨幦幯廩廧廦廨廥彋徼憝憨憖懅憴懆懁懌憺"
                ],
                ["e9a1", "憿憸憌擗擖擐擏擉撽撉擃擛擳擙攳敿敼斢曈暾曀曊曋曏暽暻暺曌朣樴橦橉橧樲橨樾橝橭橶橛橑樨橚樻樿橁橪橤橐橏橔橯橩橠樼橞橖橕橍橎橆歕歔歖殧殪殫毈毇氄氃氆澭濋澣濇澼濎濈潞濄澽澞濊澨瀄澥澮澺澬澪濏澿澸"],
                ["ea40", "澢濉澫濍澯澲澰燅燂熿熸燖燀燁燋燔燊燇燏熽燘熼燆燚燛犝犞獩獦獧獬獥獫獪瑿璚璠璔璒璕璡甋疀瘯瘭瘱瘽瘳瘼瘵瘲瘰皻盦瞚瞝瞡瞜瞛瞢瞣瞕瞙"],
                ["eaa1", "瞗磝磩磥磪磞磣磛磡磢磭磟磠禤穄穈穇窶窸窵窱窷篞篣篧篝篕篥篚篨篹篔篪篢篜篫篘篟糒糔糗糐糑縒縡縗縌縟縠縓縎縜縕縚縢縋縏縖縍縔縥縤罃罻罼罺羱翯耪耩聬膱膦膮膹膵膫膰膬膴膲膷膧臲艕艖艗蕖蕅蕫蕍蕓蕡蕘"],
                ["eb40", "蕀蕆蕤蕁蕢蕄蕑蕇蕣蔾蕛蕱蕎蕮蕵蕕蕧蕠薌蕦蕝蕔蕥蕬虣虥虤螛螏螗螓螒螈螁螖螘蝹螇螣螅螐螑螝螄螔螜螚螉褞褦褰褭褮褧褱褢褩褣褯褬褟觱諠"],
                ["eba1",
                        "諢諲諴諵諝謔諤諟諰諈諞諡諨諿諯諻貑貒貐賵賮賱賰賳赬赮趥趧踳踾踸蹀蹅踶踼踽蹁踰踿躽輶輮輵輲輹輷輴遶遹遻邆郺鄳鄵鄶醓醐醑醍醏錧錞錈錟錆錏鍺錸錼錛錣錒錁鍆錭錎錍鋋錝鋺錥錓鋹鋷錴錂錤鋿錩錹錵錪錔錌"
                ],
                ["ec40", "錋鋾錉錀鋻錖閼闍閾閹閺閶閿閵閽隩雔霋霒霐鞙鞗鞔韰韸頵頯頲餤餟餧餩馞駮駬駥駤駰駣駪駩駧骹骿骴骻髶髺髹髷鬳鮀鮅鮇魼魾魻鮂鮓鮒鮐魺鮕"],
                ["eca1", "魽鮈鴥鴗鴠鴞鴔鴩鴝鴘鴢鴐鴙鴟麈麆麇麮麭黕黖黺鼒鼽儦儥儢儤儠儩勴嚓嚌嚍嚆嚄嚃噾嚂噿嚁壖壔壏壒嬭嬥嬲嬣嬬嬧嬦嬯嬮孻寱寲嶷幬幪徾徻懃憵憼懧懠懥懤懨懞擯擩擣擫擤擨斁斀斶旚曒檍檖檁檥檉檟檛檡檞檇檓檎"],
                ["ed40", "檕檃檨檤檑橿檦檚檅檌檒歛殭氉濌澩濴濔濣濜濭濧濦濞濲濝濢濨燡燱燨燲燤燰燢獳獮獯璗璲璫璐璪璭璱璥璯甐甑甒甏疄癃癈癉癇皤盩瞵瞫瞲瞷瞶"],
                ["eda1", "瞴瞱瞨矰磳磽礂磻磼磲礅磹磾礄禫禨穜穛穖穘穔穚窾竀竁簅簏篲簀篿篻簎篴簋篳簂簉簃簁篸篽簆篰篱簐簊糨縭縼繂縳顈縸縪繉繀繇縩繌縰縻縶繄縺罅罿罾罽翴翲耬膻臄臌臊臅臇膼臩艛艚艜薃薀薏薧薕薠薋薣蕻薤薚薞"],
                ["ee40",
                        "蕷蕼薉薡蕺蕸蕗薎薖薆薍薙薝薁薢薂薈薅蕹蕶薘薐薟虨螾螪螭蟅螰螬螹螵螼螮蟉蟃蟂蟌螷螯蟄蟊螴螶螿螸螽蟞螲褵褳褼褾襁襒褷襂覭覯覮觲觳謞"
                ],
                ["eea1", "謘謖謑謅謋謢謏謒謕謇謍謈謆謜謓謚豏豰豲豱豯貕貔賹赯蹎蹍蹓蹐蹌蹇轃轀邅遾鄸醚醢醛醙醟醡醝醠鎡鎃鎯鍤鍖鍇鍼鍘鍜鍶鍉鍐鍑鍠鍭鎏鍌鍪鍹鍗鍕鍒鍏鍱鍷鍻鍡鍞鍣鍧鎀鍎鍙闇闀闉闃闅閷隮隰隬霠霟霘霝霙鞚鞡鞜"],
                ["ef40", "鞞鞝韕韔韱顁顄顊顉顅顃餥餫餬餪餳餲餯餭餱餰馘馣馡騂駺駴駷駹駸駶駻駽駾駼騃骾髾髽鬁髼魈鮚鮨鮞鮛鮦鮡鮥鮤鮆鮢鮠鮯鴳鵁鵧鴶鴮鴯鴱鴸鴰"],
                ["efa1", "鵅鵂鵃鴾鴷鵀鴽翵鴭麊麉麍麰黈黚黻黿鼤鼣鼢齔龠儱儭儮嚘嚜嚗嚚嚝嚙奰嬼屩屪巀幭幮懘懟懭懮懱懪懰懫懖懩擿攄擽擸攁攃擼斔旛曚曛曘櫅檹檽櫡櫆檺檶檷櫇檴檭歞毉氋瀇瀌瀍瀁瀅瀔瀎濿瀀濻瀦濼濷瀊爁燿燹爃燽獶"],
                ["f040", "璸瓀璵瓁璾璶璻瓂甔甓癜癤癙癐癓癗癚皦皽盬矂瞺磿礌礓礔礉礐礒礑禭禬穟簜簩簙簠簟簭簝簦簨簢簥簰繜繐繖繣繘繢繟繑繠繗繓羵羳翷翸聵臑臒"],
                ["f0a1",
                        "臐艟艞薴藆藀藃藂薳薵薽藇藄薿藋藎藈藅薱薶藒蘤薸薷薾虩蟧蟦蟢蟛蟫蟪蟥蟟蟳蟤蟔蟜蟓蟭蟘蟣螤蟗蟙蠁蟴蟨蟝襓襋襏襌襆襐襑襉謪謧謣謳謰謵譇謯謼謾謱謥謷謦謶謮謤謻謽謺豂豵貙貘貗賾贄贂贀蹜蹢蹠蹗蹖蹞蹥蹧"
                ],
                ["f140", "蹛蹚蹡蹝蹩蹔轆轇轈轋鄨鄺鄻鄾醨醥醧醯醪鎵鎌鎒鎷鎛鎝鎉鎧鎎鎪鎞鎦鎕鎈鎙鎟鎍鎱鎑鎲鎤鎨鎴鎣鎥闒闓闑隳雗雚巂雟雘雝霣霢霥鞬鞮鞨鞫鞤鞪"],
                ["f1a1", "鞢鞥韗韙韖韘韺顐顑顒颸饁餼餺騏騋騉騍騄騑騊騅騇騆髀髜鬈鬄鬅鬩鬵魊魌魋鯇鯆鯃鮿鯁鮵鮸鯓鮶鯄鮹鮽鵜鵓鵏鵊鵛鵋鵙鵖鵌鵗鵒鵔鵟鵘鵚麎麌黟鼁鼀鼖鼥鼫鼪鼩鼨齌齕儴儵劖勷厴嚫嚭嚦嚧嚪嚬壚壝壛夒嬽嬾嬿巃幰"],
                ["f240", "徿懻攇攐攍攉攌攎斄旞旝曞櫧櫠櫌櫑櫙櫋櫟櫜櫐櫫櫏櫍櫞歠殰氌瀙瀧瀠瀖瀫瀡瀢瀣瀩瀗瀤瀜瀪爌爊爇爂爅犥犦犤犣犡瓋瓅璷瓃甖癠矉矊矄矱礝礛"],
                ["f2a1", "礡礜礗礞禰穧穨簳簼簹簬簻糬糪繶繵繸繰繷繯繺繲繴繨罋罊羃羆羷翽翾聸臗臕艤艡艣藫藱藭藙藡藨藚藗藬藲藸藘藟藣藜藑藰藦藯藞藢蠀蟺蠃蟶蟷蠉蠌蠋蠆蟼蠈蟿蠊蠂襢襚襛襗襡襜襘襝襙覈覷覶觶譐譈譊譀譓譖譔譋譕"],
                ["f340",
                        "譑譂譒譗豃豷豶貚贆贇贉趬趪趭趫蹭蹸蹳蹪蹯蹻軂轒轑轏轐轓辴酀鄿醰醭鏞鏇鏏鏂鏚鏐鏹鏬鏌鏙鎩鏦鏊鏔鏮鏣鏕鏄鏎鏀鏒鏧镽闚闛雡霩霫霬霨霦"
                ],
                ["f3a1", "鞳鞷鞶韝韞韟顜顙顝顗颿颽颻颾饈饇饃馦馧騚騕騥騝騤騛騢騠騧騣騞騜騔髂鬋鬊鬎鬌鬷鯪鯫鯠鯞鯤鯦鯢鯰鯔鯗鯬鯜鯙鯥鯕鯡鯚鵷鶁鶊鶄鶈鵱鶀鵸鶆鶋鶌鵽鵫鵴鵵鵰鵩鶅鵳鵻鶂鵯鵹鵿鶇鵨麔麑黀黼鼭齀齁齍齖齗齘匷嚲"],
                ["f440", "嚵嚳壣孅巆巇廮廯忀忁懹攗攖攕攓旟曨曣曤櫳櫰櫪櫨櫹櫱櫮櫯瀼瀵瀯瀷瀴瀱灂瀸瀿瀺瀹灀瀻瀳灁爓爔犨獽獼璺皫皪皾盭矌矎矏矍矲礥礣礧礨礤礩"],
                ["f4a1", "禲穮穬穭竷籉籈籊籇籅糮繻繾纁纀羺翿聹臛臙舋艨艩蘢藿蘁藾蘛蘀藶蘄蘉蘅蘌藽蠙蠐蠑蠗蠓蠖襣襦覹觷譠譪譝譨譣譥譧譭趮躆躈躄轙轖轗轕轘轚邍酃酁醷醵醲醳鐋鐓鏻鐠鐏鐔鏾鐕鐐鐨鐙鐍鏵鐀鏷鐇鐎鐖鐒鏺鐉鏸鐊鏿"],
                ["f540", "鏼鐌鏶鐑鐆闞闠闟霮霯鞹鞻韽韾顠顢顣顟飁飂饐饎饙饌饋饓騲騴騱騬騪騶騩騮騸騭髇髊髆鬐鬒鬑鰋鰈鯷鰅鰒鯸鱀鰇鰎鰆鰗鰔鰉鶟鶙鶤鶝鶒鶘鶐鶛"],
                ["f5a1",
                        "鶠鶔鶜鶪鶗鶡鶚鶢鶨鶞鶣鶿鶩鶖鶦鶧麙麛麚黥黤黧黦鼰鼮齛齠齞齝齙龑儺儹劘劗囃嚽嚾孈孇巋巏廱懽攛欂櫼欃櫸欀灃灄灊灈灉灅灆爝爚爙獾甗癪矐礭礱礯籔籓糲纊纇纈纋纆纍罍羻耰臝蘘蘪蘦蘟蘣蘜蘙蘧蘮蘡蘠蘩蘞蘥"
                ],
                ["f640", "蠩蠝蠛蠠蠤蠜蠫衊襭襩襮襫觺譹譸譅譺譻贐贔趯躎躌轞轛轝酆酄酅醹鐿鐻鐶鐩鐽鐼鐰鐹鐪鐷鐬鑀鐱闥闤闣霵霺鞿韡顤飉飆飀饘饖騹騽驆驄驂驁騺"],
                ["f6a1", "騿髍鬕鬗鬘鬖鬺魒鰫鰝鰜鰬鰣鰨鰩鰤鰡鶷鶶鶼鷁鷇鷊鷏鶾鷅鷃鶻鶵鷎鶹鶺鶬鷈鶱鶭鷌鶳鷍鶲鹺麜黫黮黭鼛鼘鼚鼱齎齥齤龒亹囆囅囋奱孋孌巕巑廲攡攠攦攢欋欈欉氍灕灖灗灒爞爟犩獿瓘瓕瓙瓗癭皭礵禴穰穱籗籜籙籛籚"],
                ["f740", "糴糱纑罏羇臞艫蘴蘵蘳蘬蘲蘶蠬蠨蠦蠪蠥襱覿覾觻譾讄讂讆讅譿贕躕躔躚躒躐躖躗轠轢酇鑌鑐鑊鑋鑏鑇鑅鑈鑉鑆霿韣顪顩飋饔饛驎驓驔驌驏驈驊"],
                ["f7a1", "驉驒驐髐鬙鬫鬻魖魕鱆鱈鰿鱄鰹鰳鱁鰼鰷鰴鰲鰽鰶鷛鷒鷞鷚鷋鷐鷜鷑鷟鷩鷙鷘鷖鷵鷕鷝麶黰鼵鼳鼲齂齫龕龢儽劙壨壧奲孍巘蠯彏戁戃戄攩攥斖曫欑欒欏毊灛灚爢玂玁玃癰矔籧籦纕艬蘺虀蘹蘼蘱蘻蘾蠰蠲蠮蠳襶襴襳觾"],
                ["f840",
                        "讌讎讋讈豅贙躘轤轣醼鑢鑕鑝鑗鑞韄韅頀驖驙鬞鬟鬠鱒鱘鱐鱊鱍鱋鱕鱙鱌鱎鷻鷷鷯鷣鷫鷸鷤鷶鷡鷮鷦鷲鷰鷢鷬鷴鷳鷨鷭黂黐黲黳鼆鼜鼸鼷鼶齃齏"
                ],
                ["f8a1", "齱齰齮齯囓囍孎屭攭曭曮欓灟灡灝灠爣瓛瓥矕礸禷禶籪纗羉艭虃蠸蠷蠵衋讔讕躞躟躠躝醾醽釂鑫鑨鑩雥靆靃靇韇韥驞髕魙鱣鱧鱦鱢鱞鱠鸂鷾鸇鸃鸆鸅鸀鸁鸉鷿鷽鸄麠鼞齆齴齵齶囔攮斸欘欙欗欚灢爦犪矘矙礹籩籫糶纚"],
                ["f940", "纘纛纙臠臡虆虇虈襹襺襼襻觿讘讙躥躤躣鑮鑭鑯鑱鑳靉顲饟鱨鱮鱭鸋鸍鸐鸏鸒鸑麡黵鼉齇齸齻齺齹圞灦籯蠼趲躦釃鑴鑸鑶鑵驠鱴鱳鱱鱵鸔鸓黶鼊"],
                ["f9a1", "龤灨灥糷虪蠾蠽蠿讞貜躩軉靋顳顴飌饡馫驤驦驧鬤鸕鸗齈戇欞爧虌躨钂钀钁驩驨鬮鸙爩虋讟钃鱹麷癵驫鱺鸝灩灪麤齾齉龘碁銹裏墻恒粧嫺╔╦╗╠╬╣╚╩╝╒╤╕╞╪╡╘╧╛╓╥╖╟╫╢╙╨╜║═╭╮╰╯▓"]
            ]
        }, {}
    ],
    70: [function(g, p, m) {
            p.exports = [
                ["0", "\x00", 127],
                ["8ea1", "｡", 62],
                ["a1a1", "　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈",
                        9, "＋－±×÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇"
                ],
                ["a2a1", "◆□■△▲▽▼※〒→←↑↓〓"],
                ["a2ba", "∈∋⊆⊇⊂⊃∪∩"],
                ["a2ca", "∧∨￢⇒⇔∀∃"],
                ["a2dc", "∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
                ["a2f2", "Å‰♯♭♪†‡¶"],
                ["a2fe", "◯"],
                ["a3b0", "０", 9],
                ["a3c1", "Ａ", 25],
                ["a3e1", "ａ", 25],
                ["a4a1", "ぁ", 82],
                ["a5a1", "ァ", 85],
                ["a6a1", "Α", 16, "Σ", 6],
                ["a6c1", "α", 16, "σ", 6],
                ["a7a1", "А", 5, "ЁЖ", 25],
                ["a7d1",
                        "а", 5, "ёж", 25
                ],
                ["a8a1", "─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
                ["ada1", "①", 19, "Ⅰ", 9],
                ["adc0", "㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
                ["addf", "㍻〝〟№㏍℡㊤", 4, "㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
                ["b0a1", "亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
                ["b1a1", "院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応"],
                ["b2a1", "押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
                ["b3a1", "魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱"],
                ["b4a1", "粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
                ["b5a1", "機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京"],
                ["b6a1", "供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
                ["b7a1", "掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲"],
                ["b8a1", "検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
                ["b9a1", "后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込"],
                ["baa1", "此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
                ["bba1", "察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時"],
                ["bca1", "次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
                ["bda1", "宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償"],
                ["bea1", "勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
                ["bfa1", "拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾"],
                ["c0a1", "澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
                ["c1a1", "繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎"],
                ["c2a1", "臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
                ["c3a1", "叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵"],
                ["c4a1", "帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
                ["c5a1", "邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到"],
                ["c6a1", "董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
                ["c7a1", "如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦"],
                ["c8a1", "函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
                ["c9a1", "鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服"],
                ["caa1", "福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
                ["cba1", "法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満"],
                ["cca1", "漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
                ["cda1", "諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃"],
                ["cea1", "痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
                ["cfa1", "蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
                ["d0a1", "弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
                ["d1a1", "僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨"],
                ["d2a1", "辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
                ["d3a1", "咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉"],
                ["d4a1", "圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
                ["d5a1", "奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓"],
                ["d6a1", "屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
                ["d7a1", "廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚"],
                ["d8a1", "悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
                ["d9a1", "戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼"],
                ["daa1", "據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
                ["dba1", "曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍"],
                ["dca1", "棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
                ["dda1", "檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾"],
                ["dea1", "沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
                ["dfa1", "漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼"],
                ["e0a1", "燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
                ["e1a1", "瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰"],
                ["e2a1", "癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
                ["e3a1", "磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐"],
                ["e4a1", "筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
                ["e5a1", "紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺"],
                ["e6a1", "罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
                ["e7a1", "隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙"],
                ["e8a1", "茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
                ["e9a1", "蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙"],
                ["eaa1", "蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
                ["eba1", "襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫"],
                ["eca1", "譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
                ["eda1", "蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸"],
                ["eea1", "遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
                ["efa1", "錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞"],
                ["f0a1", "陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
                ["f1a1", "顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷"],
                ["f2a1", "髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
                ["f3a1", "鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠"],
                ["f4a1", "堯槇遙瑤凜熙"],
                ["f9a1", "纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德"],
                ["faa1", "忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
                ["fba1", "犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚"],
                ["fca1", "釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
                ["fcf1", "ⅰ", 9, "￢￤＇＂"],
                ["8fa2af", "˘ˇ¸˙˝¯˛˚～΄΅"],
                ["8fa2c2", "¡¦¿"],
                ["8fa2eb", "ºª©®™¤№"],
                ["8fa6e1", "ΆΈΉΊΪ"],
                ["8fa6e7", "Ό"],
                ["8fa6e9", "ΎΫ"],
                ["8fa6ec", "Ώ"],
                ["8fa6f1", "άέήίϊΐόςύϋΰώ"],
                ["8fa7c2", "Ђ", 10, "ЎЏ"],
                ["8fa7f2", "ђ", 10, "ўџ"],
                ["8fa9a1", "ÆĐ"],
                ["8fa9a4", "Ħ"],
                ["8fa9a6", "Ĳ"],
                ["8fa9a8", "ŁĿ"],
                ["8fa9ab", "ŊØŒ"],
                ["8fa9af", "ŦÞ"],
                ["8fa9c1", "æđðħıĳĸłŀŉŋøœßŧþ"],
                ["8faaa1", "ÁÀÄÂĂǍĀĄÅÃĆĈČÇĊĎÉÈËÊĚĖĒĘ"],
                ["8faaba",
                        "ĜĞĢĠĤÍÌÏÎǏİĪĮĨĴĶĹĽĻŃŇŅÑÓÒÖÔǑŐŌÕŔŘŖŚŜŠŞŤŢÚÙÜÛŬǓŰŪŲŮŨǗǛǙǕŴÝŸŶŹŽŻ"
                ],
                ["8faba1", "áàäâăǎāąåãćĉčçċďéèëêěėēęǵĝğ"],
                ["8fabbd", "ġĥíìïîǐ"],
                ["8fabc5", "īįĩĵķĺľļńňņñóòöôǒőōõŕřŗśŝšşťţúùüûŭǔűūųůũǘǜǚǖŵýÿŷźžż"],
                ["8fb0a1", "丂丄丅丌丒丟丣两丨丫丮丯丰丵乀乁乄乇乑乚乜乣乨乩乴乵乹乿亍亖亗亝亯亹仃仐仚仛仠仡仢仨仯仱仳仵份仾仿伀伂伃伈伋伌伒伕伖众伙伮伱你伳伵伷伹伻伾佀佂佈佉佋佌佒佔佖佘佟佣佪佬佮佱佷佸佹佺佽佾侁侂侄"],
                ["8fb1a1", "侅侉侊侌侎侐侒侓侔侗侙侚侞侟侲侷侹侻侼侽侾俀俁俅俆俈俉俋俌俍俏俒俜俠俢俰俲俼俽俿倀倁倄倇倊倌倎倐倓倗倘倛倜倝倞倢倧倮倰倲倳倵偀偁偂偅偆偊偌偎偑偒偓偗偙偟偠偢偣偦偧偪偭偰偱倻傁傃傄傆傊傎傏傐"],
                ["8fb2a1", "傒傓傔傖傛傜傞", 4, "傪傯傰傹傺傽僀僃僄僇僌僎僐僓僔僘僜僝僟僢僤僦僨僩僯僱僶僺僾儃儆儇儈儋儌儍儎僲儐儗儙儛儜儝儞儣儧儨儬儭儯儱儳儴儵儸儹兂兊兏兓兕兗兘兟兤兦兾冃冄冋冎冘冝冡冣冭冸冺冼冾冿凂"],
                ["8fb3a1", "凈减凑凒凓凕凘凞凢凥凮凲凳凴凷刁刂刅划刓刕刖刘刢刨刱刲刵刼剅剉剕剗剘剚剜剟剠剡剦剮剷剸剹劀劂劅劊劌劓劕劖劗劘劚劜劤劥劦劧劯劰劶劷劸劺劻劽勀勄勆勈勌勏勑勔勖勛勜勡勥勨勩勪勬勰勱勴勶勷匀匃匊匋"],
                ["8fb4a1", "匌匑匓匘匛匜匞匟匥匧匨匩匫匬匭匰匲匵匼匽匾卂卌卋卙卛卡卣卥卬卭卲卹卾厃厇厈厎厓厔厙厝厡厤厪厫厯厲厴厵厷厸厺厽叀叅叏叒叓叕叚叝叞叠另叧叵吂吓吚吡吧吨吪启吱吴吵呃呄呇呍呏呞呢呤呦呧呩呫呭呮呴呿"],
                ["8fb5a1", "咁咃咅咈咉咍咑咕咖咜咟咡咦咧咩咪咭咮咱咷咹咺咻咿哆哊响哎哠哪哬哯哶哼哾哿唀唁唅唈唉唌唍唎唕唪唫唲唵唶唻唼唽啁啇啉啊啍啐啑啘啚啛啞啠啡啤啦啿喁喂喆喈喎喏喑喒喓喔喗喣喤喭喲喿嗁嗃嗆嗉嗋嗌嗎嗑嗒"],
                ["8fb6a1", "嗓嗗嗘嗛嗞嗢嗩嗶嗿嘅嘈嘊嘍", 5, "嘙嘬嘰嘳嘵嘷嘹嘻嘼嘽嘿噀噁噃噄噆噉噋噍噏噔噞噠噡噢噣噦噩噭噯噱噲噵嚄嚅嚈嚋嚌嚕嚙嚚嚝嚞嚟嚦嚧嚨嚩嚫嚬嚭嚱嚳嚷嚾囅囉囊囋囏囐囌囍囙囜囝囟囡囤",
                        4, "囱囫园"
                ],
                ["8fb7a1", "囶囷圁圂圇圊圌圑圕圚圛圝圠圢圣圤圥圩圪圬圮圯圳圴圽圾圿坅坆坌坍坒坢坥坧坨坫坭", 4, "坳坴坵坷坹坺坻坼坾垁垃垌垔垗垙垚垜垝垞垟垡垕垧垨垩垬垸垽埇埈埌埏埕埝埞埤埦埧埩埭埰埵埶埸埽埾埿堃堄堈堉埡"],
                ["8fb8a1", "堌堍堛堞堟堠堦堧堭堲堹堿塉塌塍塏塐塕塟塡塤塧塨塸塼塿墀墁墇墈墉墊墌墍墏墐墔墖墝墠墡墢墦墩墱墲壄墼壂壈壍壎壐壒壔壖壚壝壡壢壩壳夅夆夋夌夒夓夔虁夝夡夣夤夨夯夰夳夵夶夿奃奆奒奓奙奛奝奞奟奡奣奫奭"],
                ["8fb9a1", "奯奲奵奶她奻奼妋妌妎妒妕妗妟妤妧妭妮妯妰妳妷妺妼姁姃姄姈姊姍姒姝姞姟姣姤姧姮姯姱姲姴姷娀娄娌娍娎娒娓娞娣娤娧娨娪娭娰婄婅婇婈婌婐婕婞婣婥婧婭婷婺婻婾媋媐媓媖媙媜媞媟媠媢媧媬媱媲媳媵媸媺媻媿"],
                ["8fbaa1", "嫄嫆嫈嫏嫚嫜嫠嫥嫪嫮嫵嫶嫽嬀嬁嬈嬗嬴嬙嬛嬝嬡嬥嬭嬸孁孋孌孒孖孞孨孮孯孼孽孾孿宁宄宆宊宎宐宑宓宔宖宨宩宬宭宯宱宲宷宺宼寀寁寍寏寖", 4, "寠寯寱寴寽尌尗尞尟尣尦尩尫尬尮尰尲尵尶屙屚屜屢屣屧屨屩"],
                ["8fbba1", "屭屰屴屵屺屻屼屽岇岈岊岏岒岝岟岠岢岣岦岪岲岴岵岺峉峋峒峝峗峮峱峲峴崁崆崍崒崫崣崤崦崧崱崴崹崽崿嵂嵃嵆嵈嵕嵑嵙嵊嵟嵠嵡嵢嵤嵪嵭嵰嵹嵺嵾嵿嶁嶃嶈嶊嶒嶓嶔嶕嶙嶛嶟嶠嶧嶫嶰嶴嶸嶹巃巇巋巐巎巘巙巠巤"],
                ["8fbca1", "巩巸巹帀帇帍帒帔帕帘帟帠帮帨帲帵帾幋幐幉幑幖幘幛幜幞幨幪", 4, "幰庀庋庎庢庤庥庨庪庬庱庳庽庾庿廆廌廋廎廑廒廔廕廜廞廥廫异弆弇弈弎弙弜弝弡弢弣弤弨弫弬弮弰弴弶弻弽弿彀彄彅彇彍彐彔彘彛彠彣彤彧"],
                ["8fbda1", "彯彲彴彵彸彺彽彾徉徍徏徖徜徝徢徧徫徤徬徯徰徱徸忄忇忈忉忋忐", 4, "忞忡忢忨忩忪忬忭忮忯忲忳忶忺忼怇怊怍怓怔怗怘怚怟怤怭怳怵恀恇恈恉恌恑恔恖恗恝恡恧恱恾恿悂悆悈悊悎悑悓悕悘悝悞悢悤悥您悰悱悷"],
                ["8fbea1", "悻悾惂惄惈惉惊惋惎惏惔惕惙惛惝惞惢惥惲惵惸惼惽愂愇愊愌愐", 4, "愖愗愙愜愞愢愪愫愰愱愵愶愷愹慁慅慆慉慞慠慬慲慸慻慼慿憀憁憃憄憋憍憒憓憗憘憜憝憟憠憥憨憪憭憸憹憼懀懁懂懎懏懕懜懝懞懟懡懢懧懩懥"],
                ["8fbfa1", "懬懭懯戁戃戄戇戓戕戜戠戢戣戧戩戫戹戽扂扃扄扆扌扐扑扒扔扖扚扜扤扭扯扳扺扽抍抎抏抐抦抨抳抶抷抺抾抿拄拎拕拖拚拪拲拴拼拽挃挄挊挋挍挐挓挖挘挩挪挭挵挶挹挼捁捂捃捄捆捊捋捎捒捓捔捘捛捥捦捬捭捱捴捵"],
                ["8fc0a1", "捸捼捽捿掂掄掇掊掐掔掕掙掚掞掤掦掭掮掯掽揁揅揈揎揑揓揔揕揜揠揥揪揬揲揳揵揸揹搉搊搐搒搔搘搞搠搢搤搥搩搪搯搰搵搽搿摋摏摑摒摓摔摚摛摜摝摟摠摡摣摭摳摴摻摽撅撇撏撐撑撘撙撛撝撟撡撣撦撨撬撳撽撾撿"],
                ["8fc1a1", "擄擉擊擋擌擎擐擑擕擗擤擥擩擪擭擰擵擷擻擿攁攄攈攉攊攏攓攔攖攙攛攞攟攢攦攩攮攱攺攼攽敃敇敉敐敒敔敟敠敧敫敺敽斁斅斊斒斕斘斝斠斣斦斮斲斳斴斿旂旈旉旎旐旔旖旘旟旰旲旴旵旹旾旿昀昄昈昉昍昑昒昕昖昝"],
                ["8fc2a1", "昞昡昢昣昤昦昩昪昫昬昮昰昱昳昹昷晀晅晆晊晌晑晎晗晘晙晛晜晠晡曻晪晫晬晾晳晵晿晷晸晹晻暀晼暋暌暍暐暒暙暚暛暜暟暠暤暭暱暲暵暻暿曀曂曃曈曌曎曏曔曛曟曨曫曬曮曺朅朇朎朓朙朜朠朢朳朾杅杇杈杌杔杕杝"],
                ["8fc3a1", "杦杬杮杴杶杻极构枎枏枑枓枖枘枙枛枰枱枲枵枻枼枽柹柀柂柃柅柈柉柒柗柙柜柡柦柰柲柶柷桒栔栙栝栟栨栧栬栭栯栰栱栳栻栿桄桅桊桌桕桗桘桛桫桮", 4, "桵桹桺桻桼梂梄梆梈梖梘梚梜梡梣梥梩梪梮梲梻棅棈棌棏"],
                ["8fc4a1", "棐棑棓棖棙棜棝棥棨棪棫棬棭棰棱棵棶棻棼棽椆椉椊椐椑椓椖椗椱椳椵椸椻楂楅楉楎楗楛楣楤楥楦楨楩楬楰楱楲楺楻楿榀榍榒榖榘榡榥榦榨榫榭榯榷榸榺榼槅槈槑槖槗槢槥槮槯槱槳槵槾樀樁樃樏樑樕樚樝樠樤樨樰樲"],
                ["8fc5a1", "樴樷樻樾樿橅橆橉橊橎橐橑橒橕橖橛橤橧橪橱橳橾檁檃檆檇檉檋檑檛檝檞檟檥檫檯檰檱檴檽檾檿櫆櫉櫈櫌櫐櫔櫕櫖櫜櫝櫤櫧櫬櫰櫱櫲櫼櫽欂欃欆欇欉欏欐欑欗欛欞欤欨欫欬欯欵欶欻欿歆歊歍歒歖歘歝歠歧歫歮歰歵歽"],
                ["8fc6a1", "歾殂殅殗殛殟殠殢殣殨殩殬殭殮殰殸殹殽殾毃毄毉毌毖毚毡毣毦毧毮毱毷毹毿氂氄氅氉氍氎氐氒氙氟氦氧氨氬氮氳氵氶氺氻氿汊汋汍汏汒汔汙汛汜汫汭汯汴汶汸汹汻沅沆沇沉沔沕沗沘沜沟沰沲沴泂泆泍泏泐泑泒泔泖"],
                ["8fc7a1", "泚泜泠泧泩泫泬泮泲泴洄洇洊洎洏洑洓洚洦洧洨汧洮洯洱洹洼洿浗浞浟浡浥浧浯浰浼涂涇涑涒涔涖涗涘涪涬涴涷涹涽涿淄淈淊淎淏淖淛淝淟淠淢淥淩淯淰淴淶淼渀渄渞渢渧渲渶渹渻渼湄湅湈湉湋湏湑湒湓湔湗湜湝湞"],
                ["8fc8a1", "湢湣湨湳湻湽溍溓溙溠溧溭溮溱溳溻溿滀滁滃滇滈滊滍滎滏滫滭滮滹滻滽漄漈漊漌漍漖漘漚漛漦漩漪漯漰漳漶漻漼漭潏潑潒潓潗潙潚潝潞潡潢潨潬潽潾澃澇澈澋澌澍澐澒澓澔澖澚澟澠澥澦澧澨澮澯澰澵澶澼濅濇濈濊"],
                ["8fc9a1", "濚濞濨濩濰濵濹濼濽瀀瀅瀆瀇瀍瀗瀠瀣瀯瀴瀷瀹瀼灃灄灈灉灊灋灔灕灝灞灎灤灥灬灮灵灶灾炁炅炆炔", 4, "炛炤炫炰炱炴炷烊烑烓烔烕烖烘烜烤烺焃", 4, "焋焌焏焞焠焫焭焯焰焱焸煁煅煆煇煊煋煐煒煗煚煜煞煠"],
                ["8fcaa1", "煨煹熀熅熇熌熒熚熛熠熢熯熰熲熳熺熿燀燁燄燋燌燓燖燙燚燜燸燾爀爇爈爉爓爗爚爝爟爤爫爯爴爸爹牁牂牃牅牎牏牐牓牕牖牚牜牞牠牣牨牫牮牯牱牷牸牻牼牿犄犉犍犎犓犛犨犭犮犱犴犾狁狇狉狌狕狖狘狟狥狳狴狺狻"],
                ["8fcba1", "狾猂猄猅猇猋猍猒猓猘猙猞猢猤猧猨猬猱猲猵猺猻猽獃獍獐獒獖獘獝獞獟獠獦獧獩獫獬獮獯獱獷獹獼玀玁玃玅玆玎玐玓玕玗玘玜玞玟玠玢玥玦玪玫玭玵玷玹玼玽玿珅珆珉珋珌珏珒珓珖珙珝珡珣珦珧珩珴珵珷珹珺珻珽"],
                ["8fcca1", "珿琀琁琄琇琊琑琚琛琤琦琨", 9, "琹瑀瑃瑄瑆瑇瑋瑍瑑瑒瑗瑝瑢瑦瑧瑨瑫瑭瑮瑱瑲璀璁璅璆璇璉璏璐璑璒璘璙璚璜璟璠璡璣璦璨璩璪璫璮璯璱璲璵璹璻璿瓈瓉瓌瓐瓓瓘瓚瓛瓞瓟瓤瓨瓪瓫瓯瓴瓺瓻瓼瓿甆"],
                ["8fcda1", "甒甖甗甠甡甤甧甩甪甯甶甹甽甾甿畀畃畇畈畎畐畒畗畞畟畡畯畱畹", 5, "疁疅疐疒疓疕疙疜疢疤疴疺疿痀痁痄痆痌痎痏痗痜痟痠痡痤痧痬痮痯痱痹瘀瘂瘃瘄瘇瘈瘊瘌瘏瘒瘓瘕瘖瘙瘛瘜瘝瘞瘣瘥瘦瘩瘭瘲瘳瘵瘸瘹"],
                ["8fcea1", "瘺瘼癊癀癁癃癄癅癉癋癕癙癟癤癥癭癮癯癱癴皁皅皌皍皕皛皜皝皟皠皢", 6, "皪皭皽盁盅盉盋盌盎盔盙盠盦盨盬盰盱盶盹盼眀眆眊眎眒眔眕眗眙眚眜眢眨眭眮眯眴眵眶眹眽眾睂睅睆睊睍睎睏睒睖睗睜睞睟睠睢"],
                ["8fcfa1", "睤睧睪睬睰睲睳睴睺睽瞀瞄瞌瞍瞔瞕瞖瞚瞟瞢瞧瞪瞮瞯瞱瞵瞾矃矉矑矒矕矙矞矟矠矤矦矪矬矰矱矴矸矻砅砆砉砍砎砑砝砡砢砣砭砮砰砵砷硃硄硇硈硌硎硒硜硞硠硡硣硤硨硪确硺硾碊碏碔碘碡碝碞碟碤碨碬碭碰碱碲碳"],
                ["8fd0a1", "碻碽碿磇磈磉磌磎磒磓磕磖磤磛磟磠磡磦磪磲磳礀磶磷磺磻磿礆礌礐礚礜礞礟礠礥礧礩礭礱礴礵礻礽礿祄祅祆祊祋祏祑祔祘祛祜祧祩祫祲祹祻祼祾禋禌禑禓禔禕禖禘禛禜禡禨禩禫禯禱禴禸离秂秄秇秈秊秏秔秖秚秝秞"],
                ["8fd1a1", "秠秢秥秪秫秭秱秸秼稂稃稇稉稊稌稑稕稛稞稡稧稫稭稯稰稴稵稸稹稺穄穅穇穈穌穕穖穙穜穝穟穠穥穧穪穭穵穸穾窀窂窅窆窊窋窐窑窔窞窠窣窬窳窵窹窻窼竆竉竌竎竑竛竨竩竫竬竱竴竻竽竾笇笔笟笣笧笩笪笫笭笮笯笰"],
                ["8fd2a1", "笱笴笽笿筀筁筇筎筕筠筤筦筩筪筭筯筲筳筷箄箉箎箐箑箖箛箞箠箥箬箯箰箲箵箶箺箻箼箽篂篅篈篊篔篖篗篙篚篛篨篪篲篴篵篸篹篺篼篾簁簂簃簄簆簉簋簌簎簏簙簛簠簥簦簨簬簱簳簴簶簹簺籆籊籕籑籒籓籙",
                        5
                ],
                ["8fd3a1", "籡籣籧籩籭籮籰籲籹籼籽粆粇粏粔粞粠粦粰粶粷粺粻粼粿糄糇糈糉糍糏糓糔糕糗糙糚糝糦糩糫糵紃紇紈紉紏紑紒紓紖紝紞紣紦紪紭紱紼紽紾絀絁絇絈絍絑絓絗絙絚絜絝絥絧絪絰絸絺絻絿綁綂綃綅綆綈綋綌綍綑綖綗綝"],
                ["8fd4a1", "綞綦綧綪綳綶綷綹緂", 4, "緌緍緎緗緙縀緢緥緦緪緫緭緱緵緶緹緺縈縐縑縕縗縜縝縠縧縨縬縭縯縳縶縿繄繅繇繎繐繒繘繟繡繢繥繫繮繯繳繸繾纁纆纇纊纍纑纕纘纚纝纞缼缻缽缾缿罃罄罇罏罒罓罛罜罝罡罣罤罥罦罭"],
                ["8fd5a1", "罱罽罾罿羀羋羍羏羐羑羖羗羜羡羢羦羪羭羴羼羿翀翃翈翎翏翛翟翣翥翨翬翮翯翲翺翽翾翿耇耈耊耍耎耏耑耓耔耖耝耞耟耠耤耦耬耮耰耴耵耷耹耺耼耾聀聄聠聤聦聭聱聵肁肈肎肜肞肦肧肫肸肹胈胍胏胒胔胕胗胘胠胭胮"],
                ["8fd6a1", "胰胲胳胶胹胺胾脃脋脖脗脘脜脞脠脤脧脬脰脵脺脼腅腇腊腌腒腗腠腡腧腨腩腭腯腷膁膐膄膅膆膋膎膖膘膛膞膢膮膲膴膻臋臃臅臊臎臏臕臗臛臝臞臡臤臫臬臰臱臲臵臶臸臹臽臿舀舃舏舓舔舙舚舝舡舢舨舲舴舺艃艄艅艆"],
                ["8fd7a1", "艋艎艏艑艖艜艠艣艧艭艴艻艽艿芀芁芃芄芇芉芊芎芑芔芖芘芚芛芠芡芣芤芧芨芩芪芮芰芲芴芷芺芼芾芿苆苐苕苚苠苢苤苨苪苭苯苶苷苽苾茀茁茇茈茊茋荔茛茝茞茟茡茢茬茭茮茰茳茷茺茼茽荂荃荄荇荍荎荑荕荖荗荰荸"],
                ["8fd8a1", "荽荿莀莂莄莆莍莒莔莕莘莙莛莜莝莦莧莩莬莾莿菀菇菉菏菐菑菔菝荓菨菪菶菸菹菼萁萆萊萏萑萕萙莭萯萹葅葇葈葊葍葏葑葒葖葘葙葚葜葠葤葥葧葪葰葳葴葶葸葼葽蒁蒅蒒蒓蒕蒞蒦蒨蒩蒪蒯蒱蒴蒺蒽蒾蓀蓂蓇蓈蓌蓏蓓"],
                ["8fd9a1", "蓜蓧蓪蓯蓰蓱蓲蓷蔲蓺蓻蓽蔂蔃蔇蔌蔎蔐蔜蔞蔢蔣蔤蔥蔧蔪蔫蔯蔳蔴蔶蔿蕆蕏", 4, "蕖蕙蕜", 6, "蕤蕫蕯蕹蕺蕻蕽蕿薁薅薆薉薋薌薏薓薘薝薟薠薢薥薧薴薶薷薸薼薽薾薿藂藇藊藋藎薭藘藚藟藠藦藨藭藳藶藼"],
                ["8fdaa1", "藿蘀蘄蘅蘍蘎蘐蘑蘒蘘蘙蘛蘞蘡蘧蘩蘶蘸蘺蘼蘽虀虂虆虒虓虖虗虘虙虝虠", 4, "虩虬虯虵虶虷虺蚍蚑蚖蚘蚚蚜蚡蚦蚧蚨蚭蚱蚳蚴蚵蚷蚸蚹蚿蛀蛁蛃蛅蛑蛒蛕蛗蛚蛜蛠蛣蛥蛧蚈蛺蛼蛽蜄蜅蜇蜋蜎蜏蜐蜓蜔蜙蜞蜟蜡蜣"],
                ["8fdba1", "蜨蜮蜯蜱蜲蜹蜺蜼蜽蜾蝀蝃蝅蝍蝘蝝蝡蝤蝥蝯蝱蝲蝻螃", 6, "螋螌螐螓螕螗螘螙螞螠螣螧螬螭螮螱螵螾螿蟁蟈蟉蟊蟎蟕蟖蟙蟚蟜蟟蟢蟣蟤蟪蟫蟭蟱蟳蟸蟺蟿蠁蠃蠆蠉蠊蠋蠐蠙蠒蠓蠔蠘蠚蠛蠜蠞蠟蠨蠭蠮蠰蠲蠵"],
                ["8fdca1", "蠺蠼衁衃衅衈衉衊衋衎衑衕衖衘衚衜衟衠衤衩衱衹衻袀袘袚袛袜袟袠袨袪袺袽袾裀裊", 4, "裑裒裓裛裞裧裯裰裱裵裷褁褆褍褎褏褕褖褘褙褚褜褠褦褧褨褰褱褲褵褹褺褾襀襂襅襆襉襏襒襗襚襛襜襡襢襣襫襮襰襳襵襺"],
                ["8fdda1", "襻襼襽覉覍覐覔覕覛覜覟覠覥覰覴覵覶覷覼觔", 4, "觥觩觫觭觱觳觶觹觽觿訄訅訇訏訑訒訔訕訞訠訢訤訦訫訬訯訵訷訽訾詀詃詅詇詉詍詎詓詖詗詘詜詝詡詥詧詵詶詷詹詺詻詾詿誀誃誆誋誏誐誒誖誗誙誟誧誩誮誯誳"],
                ["8fdea1", "誶誷誻誾諃諆諈諉諊諑諓諔諕諗諝諟諬諰諴諵諶諼諿謅謆謋謑謜謞謟謊謭謰謷謼譂", 4, "譈譒譓譔譙譍譞譣譭譶譸譹譼譾讁讄讅讋讍讏讔讕讜讞讟谸谹谽谾豅豇豉豋豏豑豓豔豗豘豛豝豙豣豤豦豨豩豭豳豵豶豻豾貆"],
                ["8fdfa1", "貇貋貐貒貓貙貛貜貤貹貺賅賆賉賋賏賖賕賙賝賡賨賬賯賰賲賵賷賸賾賿贁贃贉贒贗贛赥赩赬赮赿趂趄趈趍趐趑趕趞趟趠趦趫趬趯趲趵趷趹趻跀跅跆跇跈跊跎跑跔跕跗跙跤跥跧跬跰趼跱跲跴跽踁踄踅踆踋踑踔踖踠踡踢"],
                ["8fe0a1", "踣踦踧踱踳踶踷踸踹踽蹀蹁蹋蹍蹎蹏蹔蹛蹜蹝蹞蹡蹢蹩蹬蹭蹯蹰蹱蹹蹺蹻躂躃躉躐躒躕躚躛躝躞躢躧躩躭躮躳躵躺躻軀軁軃軄軇軏軑軔軜軨軮軰軱軷軹軺軭輀輂輇輈輏輐輖輗輘輞輠輡輣輥輧輨輬輭輮輴輵輶輷輺轀轁"],
                ["8fe1a1", "轃轇轏轑", 4, "轘轝轞轥辝辠辡辤辥辦辵辶辸达迀迁迆迊迋迍运迒迓迕迠迣迤迨迮迱迵迶迻迾适逄逈逌逘逛逨逩逯逪逬逭逳逴逷逿遃遄遌遛遝遢遦遧遬遰遴遹邅邈邋邌邎邐邕邗邘邙邛邠邡邢邥邰邲邳邴邶邽郌邾郃"],
                ["8fe2a1", "郄郅郇郈郕郗郘郙郜郝郟郥郒郶郫郯郰郴郾郿鄀鄄鄅鄆鄈鄍鄐鄔鄖鄗鄘鄚鄜鄞鄠鄥鄢鄣鄧鄩鄮鄯鄱鄴鄶鄷鄹鄺鄼鄽酃酇酈酏酓酗酙酚酛酡酤酧酭酴酹酺酻醁醃醅醆醊醎醑醓醔醕醘醞醡醦醨醬醭醮醰醱醲醳醶醻醼醽醿"],
                ["8fe3a1", "釂釃釅釓釔釗釙釚釞釤釥釩釪釬", 5, "釷釹釻釽鈀鈁鈄鈅鈆鈇鈉鈊鈌鈐鈒鈓鈖鈘鈜鈝鈣鈤鈥鈦鈨鈮鈯鈰鈳鈵鈶鈸鈹鈺鈼鈾鉀鉂鉃鉆鉇鉊鉍鉎鉏鉑鉘鉙鉜鉝鉠鉡鉥鉧鉨鉩鉮鉯鉰鉵", 4, "鉻鉼鉽鉿銈銉銊銍銎銒銗"],
                ["8fe4a1", "銙銟銠銤銥銧銨銫銯銲銶銸銺銻銼銽銿", 4, "鋅鋆鋇鋈鋋鋌鋍鋎鋐鋓鋕鋗鋘鋙鋜鋝鋟鋠鋡鋣鋥鋧鋨鋬鋮鋰鋹鋻鋿錀錂錈錍錑錔錕錜錝錞錟錡錤錥錧錩錪錳錴錶錷鍇鍈鍉鍐鍑鍒鍕鍗鍘鍚鍞鍤鍥鍧鍩鍪鍭鍯鍰鍱鍳鍴鍶"],
                ["8fe5a1", "鍺鍽鍿鎀鎁鎂鎈鎊鎋鎍鎏鎒鎕鎘鎛鎞鎡鎣鎤鎦鎨鎫鎴鎵鎶鎺鎩鏁鏄鏅鏆鏇鏉", 4, "鏓鏙鏜鏞鏟鏢鏦鏧鏹鏷鏸鏺鏻鏽鐁鐂鐄鐈鐉鐍鐎鐏鐕鐖鐗鐟鐮鐯鐱鐲鐳鐴鐻鐿鐽鑃鑅鑈鑊鑌鑕鑙鑜鑟鑡鑣鑨鑫鑭鑮鑯鑱鑲钄钃镸镹"],
                ["8fe6a1", "镾閄閈閌閍閎閝閞閟閡閦閩閫閬閴閶閺閽閿闆闈闉闋闐闑闒闓闙闚闝闞闟闠闤闦阝阞阢阤阥阦阬阱阳阷阸阹阺阼阽陁陒陔陖陗陘陡陮陴陻陼陾陿隁隂隃隄隉隑隖隚隝隟隤隥隦隩隮隯隳隺雊雒嶲雘雚雝雞雟雩雯雱雺霂"],
                ["8fe7a1", "霃霅霉霚霛霝霡霢霣霨霱霳靁靃靊靎靏靕靗靘靚靛靣靧靪靮靳靶靷靸靻靽靿鞀鞉鞕鞖鞗鞙鞚鞞鞟鞢鞬鞮鞱鞲鞵鞶鞸鞹鞺鞼鞾鞿韁韄韅韇韉韊韌韍韎韐韑韔韗韘韙韝韞韠韛韡韤韯韱韴韷韸韺頇頊頙頍頎頔頖頜頞頠頣頦"],
                ["8fe8a1", "頫頮頯頰頲頳頵頥頾顄顇顊顑顒顓顖顗顙顚顢顣顥顦顪顬颫颭颮颰颴颷颸颺颻颿飂飅飈飌飡飣飥飦飧飪飳飶餂餇餈餑餕餖餗餚餛餜餟餢餦餧餫餱", 4, "餹餺餻餼饀饁饆饇饈饍饎饔饘饙饛饜饞饟饠馛馝馟馦馰馱馲馵"],
                ["8fe9a1", "馹馺馽馿駃駉駓駔駙駚駜駞駧駪駫駬駰駴駵駹駽駾騂騃騄騋騌騐騑騖騞騠騢騣騤騧騭騮騳騵騶騸驇驁驄驊驋驌驎驑驔驖驝骪骬骮骯骲骴骵骶骹骻骾骿髁髃髆髈髎髐髒髕髖髗髛髜髠髤髥髧髩髬髲髳髵髹髺髽髿", 4],
                ["8feaa1", "鬄鬅鬈鬉鬋鬌鬍鬎鬐鬒鬖鬙鬛鬜鬠鬦鬫鬭鬳鬴鬵鬷鬹鬺鬽魈魋魌魕魖魗魛魞魡魣魥魦魨魪", 4, "魳魵魷魸魹魿鮀鮄鮅鮆鮇鮉鮊鮋鮍鮏鮐鮔鮚鮝鮞鮦鮧鮩鮬鮰鮱鮲鮷鮸鮻鮼鮾鮿鯁鯇鯈鯎鯐鯗鯘鯝鯟鯥鯧鯪鯫鯯鯳鯷鯸"],
                ["8feba1", "鯹鯺鯽鯿鰀鰂鰋鰏鰑鰖鰘鰙鰚鰜鰞鰢鰣鰦", 4, "鰱鰵鰶鰷鰽鱁鱃鱄鱅鱉鱊鱎鱏鱐鱓鱔鱖鱘鱛鱝鱞鱟鱣鱩鱪鱜鱫鱨鱮鱰鱲鱵鱷鱻鳦鳲鳷鳹鴋鴂鴑鴗鴘鴜鴝鴞鴯鴰鴲鴳鴴鴺鴼鵅鴽鵂鵃鵇鵊鵓鵔鵟鵣鵢鵥鵩鵪鵫鵰鵶鵷鵻"],
                ["8feca1", "鵼鵾鶃鶄鶆鶊鶍鶎鶒鶓鶕鶖鶗鶘鶡鶪鶬鶮鶱鶵鶹鶼鶿鷃鷇鷉鷊鷔鷕鷖鷗鷚鷞鷟鷠鷥鷧鷩鷫鷮鷰鷳鷴鷾鸊鸂鸇鸎鸐鸑鸒鸕鸖鸙鸜鸝鹺鹻鹼麀麂麃麄麅麇麎麏麖麘麛麞麤麨麬麮麯麰麳麴麵黆黈黋黕黟黤黧黬黭黮黰黱黲黵"],
                ["8feda1", "黸黿鼂鼃鼉鼏鼐鼑鼒鼔鼖鼗鼙鼚鼛鼟鼢鼦鼪鼫鼯鼱鼲鼴鼷鼹鼺鼼鼽鼿齁齃", 4, "齓齕齖齗齘齚齝齞齨齩齭", 4, "齳齵齺齽龏龐龑龒龔龖龗龞龡龢龣龥"]
            ]
        }, {}
    ],
    71: [function(g, p, m) {
            p.exports = {
                uChars: [128, 165, 169, 178, 184, 216, 226, 235, 238, 244, 248, 251, 253, 258, 276, 284, 300, 325, 329, 334, 364, 463, 465, 467, 469, 471, 473, 475, 477, 506, 594, 610, 712, 716, 730, 930, 938, 962, 970, 1026, 1104, 1106, 8209, 8215, 8218, 8222, 8231, 8241, 8244, 8246, 8252, 8365, 8452, 8454, 8458, 8471, 8482, 8556, 8570,
                        8596, 8602, 8713, 8720, 8722, 8726, 8731, 8737, 8740, 8742, 8748, 8751, 8760, 8766, 8777, 8781, 8787, 8802, 8808, 8816, 8854, 8858, 8870, 8896, 8979, 9322, 9372, 9548, 9588, 9616, 9622, 9634, 9652, 9662, 9672, 9676, 9680, 9702, 9735, 9738, 9793, 9795, 11906, 11909, 11913, 11917, 11928, 11944, 11947, 11951, 11956, 11960, 11964, 11979, 12284, 12292, 12312, 12319, 12330, 12351, 12436, 12447, 12535, 12543, 12586, 12842, 12850, 12964, 13200, 13215, 13218, 13253, 13263, 13267, 13270, 13384, 13428, 13727, 13839, 13851, 14617, 14703, 14801, 14816, 14964, 15183, 15471, 15585, 16471, 16736, 17208,
                        17325, 17330, 17374, 17623, 17997, 18018, 18212, 18218, 18301, 18318, 18760, 18811, 18814, 18820, 18823, 18844, 18848, 18872, 19576, 19620, 19738, 19887, 40870, 59244, 59336, 59367, 59413, 59417, 59423, 59431, 59437, 59443, 59452, 59460, 59478, 59493, 63789, 63866, 63894, 63976, 63986, 64016, 64018, 64021, 64025, 64034, 64037, 64042, 65074, 65093, 65107, 65112, 65127, 65132, 65375, 65510, 65536
                ],
                gbChars: [0, 36, 38, 45, 50, 81, 89, 95, 96, 100, 103, 104, 105, 109, 126, 133, 148, 172, 175, 179, 208, 306, 307, 308, 309, 310, 311, 312, 313, 341, 428, 443, 544, 545, 558, 741, 742, 749, 750, 805,
                        819, 820, 7922, 7924, 7925, 7927, 7934, 7943, 7944, 7945, 7950, 8062, 8148, 8149, 8152, 8164, 8174, 8236, 8240, 8262, 8264, 8374, 8380, 8381, 8384, 8388, 8390, 8392, 8393, 8394, 8396, 8401, 8406, 8416, 8419, 8424, 8437, 8439, 8445, 8482, 8485, 8496, 8521, 8603, 8936, 8946, 9046, 9050, 9063, 9066, 9076, 9092, 9100, 9108, 9111, 9113, 9131, 9162, 9164, 9218, 9219, 11329, 11331, 11334, 11336, 11346, 11361, 11363, 11366, 11370, 11372, 11375, 11389, 11682, 11686, 11687, 11692, 11694, 11714, 11716, 11723, 11725, 11730, 11736, 11982, 11989, 12102, 12336, 12348, 12350, 12384, 12393, 12395, 12397,
                        12510, 12553, 12851, 12962, 12973, 13738, 13823, 13919, 13933, 14080, 14298, 14585, 14698, 15583, 15847, 16318, 16434, 16438, 16481, 16729, 17102, 17122, 17315, 17320, 17402, 17418, 17859, 17909, 17911, 17915, 17916, 17936, 17939, 17961, 18664, 18703, 18814, 18962, 19043, 33469, 33470, 33471, 33484, 33485, 33490, 33497, 33501, 33505, 33513, 33520, 33536, 33550, 37845, 37921, 37948, 38029, 38038, 38064, 38065, 38066, 38069, 38075, 38076, 38078, 39108, 39109, 39113, 39114, 39115, 39116, 39265, 39394, 189E3
                ]
            }
        }, {}
    ],
    72: [function(g, p, m) {
            p.exports = [
                ["a140", "", 62],
                ["a180",
                        "", 32
                ],
                ["a240", "", 62],
                ["a280", "", 32],
                ["a2ab", "", 5],
                ["a2e3", "€"],
                ["a2ef", ""],
                ["a2fd", ""],
                ["a340", "", 62],
                ["a380", "", 31, "　"],
                ["a440", "", 62],
                ["a480", "", 32],
                ["a4f4", "", 10],
                ["a540", "", 62],
                ["a580", "", 32],
                ["a5f7", "", 7],
                ["a640", "", 62],
                ["a680", "", 32],
                ["a6b9", "", 7],
                ["a6d9", "", 6],
                ["a6ec", ""],
                ["a6f3", ""],
                ["a6f6", "", 8],
                ["a740", "", 62],
                ["a780", "", 32],
                ["a7c2", "", 14],
                ["a7f2", "", 12],
                ["a896", "", 10],
                ["a8bc", ""],
                ["a8bf", "ǹ"],
                ["a8c1", ""],
                ["a8ea", "", 20],
                ["a958", ""],
                ["a95b", ""],
                ["a95d", ""],
                ["a989", "〾⿰", 11],
                ["a997", "", 12],
                ["a9f0", "", 14],
                ["aaa1", "", 93],
                ["aba1", "", 93],
                ["aca1", "", 93],
                ["ada1", "", 93],
                ["aea1", "", 93],
                ["afa1", "", 93],
                ["d7fa", "", 4],
                ["f8a1", "", 93],
                ["f9a1", "", 93],
                ["faa1", "", 93],
                ["fba1", "", 93],
                ["fca1", "", 93],
                ["fda1", "", 93],
                ["fe50", "⺁⺄㑳㑇⺈⺋㖞㘚㘎⺌⺗㥮㤘㧏㧟㩳㧐㭎㱮㳠⺧⺪䁖䅟⺮䌷⺳⺶⺷䎱䎬⺻䏝䓖䙡䙌"],
                ["fe80", "䜣䜩䝼䞍⻊䥇䥺䥽䦂䦃䦅䦆䦟䦛䦷䦶䲣䲟䲠䲡䱷䲢䴓", 6, "䶮", 93]
            ]
        }, {}
    ],
    73: [function(g, p, m) {
            p.exports = [
                ["0", "\x00", 128],
                ["a1", "｡", 62],
                ["8140", "　、。，．・：；？！゛゜´｀¨＾￣＿ヽヾゝゞ〃仝々〆〇ー―‐／＼～∥｜…‥‘’“”（）〔〕［］｛｝〈", 9, "＋－±×"],
                ["8180", "÷＝≠＜＞≦≧∞∴♂♀°′″℃￥＄￠￡％＃＆＊＠§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓〓"],
                ["81b8",
                        "∈∋⊆⊇⊂⊃∪∩"
                ],
                ["81c8", "∧∨￢⇒⇔∀∃"],
                ["81da", "∠⊥⌒∂∇≡≒≪≫√∽∝∵∫∬"],
                ["81f0", "Å‰♯♭♪†‡¶"],
                ["81fc", "◯"],
                ["824f", "０", 9],
                ["8260", "Ａ", 25],
                ["8281", "ａ", 25],
                ["829f", "ぁ", 82],
                ["8340", "ァ", 62],
                ["8380", "ム", 22],
                ["839f", "Α", 16, "Σ", 6],
                ["83bf", "α", 16, "σ", 6],
                ["8440", "А", 5, "ЁЖ", 25],
                ["8470", "а", 5, "ёж", 7],
                ["8480", "о", 17],
                ["849f", "─│┌┐┘└├┬┤┴┼━┃┏┓┛┗┣┳┫┻╋┠┯┨┷┿┝┰┥┸╂"],
                ["8740",
                        "①", 19, "Ⅰ", 9
                ],
                ["875f", "㍉㌔㌢㍍㌘㌧㌃㌶㍑㍗㌍㌦㌣㌫㍊㌻㎜㎝㎞㎎㎏㏄㎡"],
                ["877e", "㍻"],
                ["8780", "〝〟№㏍℡㊤", 4, "㈱㈲㈹㍾㍽㍼≒≡∫∮∑√⊥∠∟⊿∵∩∪"],
                ["889f", "亜唖娃阿哀愛挨姶逢葵茜穐悪握渥旭葦芦鯵梓圧斡扱宛姐虻飴絢綾鮎或粟袷安庵按暗案闇鞍杏以伊位依偉囲夷委威尉惟意慰易椅為畏異移維緯胃萎衣謂違遺医井亥域育郁磯一壱溢逸稲茨芋鰯允印咽員因姻引飲淫胤蔭"],
                ["8940",
                        "院陰隠韻吋右宇烏羽迂雨卯鵜窺丑碓臼渦嘘唄欝蔚鰻姥厩浦瓜閏噂云運雲荏餌叡営嬰影映曳栄永泳洩瑛盈穎頴英衛詠鋭液疫益駅悦謁越閲榎厭円"
                ],
                ["8980", "園堰奄宴延怨掩援沿演炎焔煙燕猿縁艶苑薗遠鉛鴛塩於汚甥凹央奥往応押旺横欧殴王翁襖鴬鴎黄岡沖荻億屋憶臆桶牡乙俺卸恩温穏音下化仮何伽価佳加可嘉夏嫁家寡科暇果架歌河火珂禍禾稼箇花苛茄荷華菓蝦課嘩貨迦過霞蚊俄峨我牙画臥芽蛾賀雅餓駕介会解回塊壊廻快怪悔恢懐戒拐改"],
                ["8a40", "魁晦械海灰界皆絵芥蟹開階貝凱劾外咳害崖慨概涯碍蓋街該鎧骸浬馨蛙垣柿蛎鈎劃嚇各廓拡撹格核殻獲確穫覚角赫較郭閣隔革学岳楽額顎掛笠樫"],
                ["8a80", "橿梶鰍潟割喝恰括活渇滑葛褐轄且鰹叶椛樺鞄株兜竃蒲釜鎌噛鴨栢茅萱粥刈苅瓦乾侃冠寒刊勘勧巻喚堪姦完官寛干幹患感慣憾換敢柑桓棺款歓汗漢澗潅環甘監看竿管簡緩缶翰肝艦莞観諌貫還鑑間閑関陥韓館舘丸含岸巌玩癌眼岩翫贋雁頑顔願企伎危喜器基奇嬉寄岐希幾忌揮机旗既期棋棄"],
                ["8b40", "機帰毅気汽畿祈季稀紀徽規記貴起軌輝飢騎鬼亀偽儀妓宜戯技擬欺犠疑祇義蟻誼議掬菊鞠吉吃喫桔橘詰砧杵黍却客脚虐逆丘久仇休及吸宮弓急救"],
                ["8b80", "朽求汲泣灸球究窮笈級糾給旧牛去居巨拒拠挙渠虚許距鋸漁禦魚亨享京供侠僑兇競共凶協匡卿叫喬境峡強彊怯恐恭挟教橋況狂狭矯胸脅興蕎郷鏡響饗驚仰凝尭暁業局曲極玉桐粁僅勤均巾錦斤欣欽琴禁禽筋緊芹菌衿襟謹近金吟銀九倶句区狗玖矩苦躯駆駈駒具愚虞喰空偶寓遇隅串櫛釧屑屈"],
                ["8c40", "掘窟沓靴轡窪熊隈粂栗繰桑鍬勲君薫訓群軍郡卦袈祁係傾刑兄啓圭珪型契形径恵慶慧憩掲携敬景桂渓畦稽系経継繋罫茎荊蛍計詣警軽頚鶏芸迎鯨"],
                ["8c80", "劇戟撃激隙桁傑欠決潔穴結血訣月件倹倦健兼券剣喧圏堅嫌建憲懸拳捲検権牽犬献研硯絹県肩見謙賢軒遣鍵険顕験鹸元原厳幻弦減源玄現絃舷言諺限乎個古呼固姑孤己庫弧戸故枯湖狐糊袴股胡菰虎誇跨鈷雇顧鼓五互伍午呉吾娯後御悟梧檎瑚碁語誤護醐乞鯉交佼侯候倖光公功効勾厚口向"],
                ["8d40", "后喉坑垢好孔孝宏工巧巷幸広庚康弘恒慌抗拘控攻昂晃更杭校梗構江洪浩港溝甲皇硬稿糠紅紘絞綱耕考肯肱腔膏航荒行衡講貢購郊酵鉱砿鋼閤降"],
                ["8d80", "項香高鴻剛劫号合壕拷濠豪轟麹克刻告国穀酷鵠黒獄漉腰甑忽惚骨狛込此頃今困坤墾婚恨懇昏昆根梱混痕紺艮魂些佐叉唆嵯左差査沙瑳砂詐鎖裟坐座挫債催再最哉塞妻宰彩才採栽歳済災采犀砕砦祭斎細菜裁載際剤在材罪財冴坂阪堺榊肴咲崎埼碕鷺作削咋搾昨朔柵窄策索錯桜鮭笹匙冊刷"],
                ["8e40", "察拶撮擦札殺薩雑皐鯖捌錆鮫皿晒三傘参山惨撒散桟燦珊産算纂蚕讃賛酸餐斬暫残仕仔伺使刺司史嗣四士始姉姿子屍市師志思指支孜斯施旨枝止"],
                ["8e80", "死氏獅祉私糸紙紫肢脂至視詞詩試誌諮資賜雌飼歯事似侍児字寺慈持時次滋治爾璽痔磁示而耳自蒔辞汐鹿式識鴫竺軸宍雫七叱執失嫉室悉湿漆疾質実蔀篠偲柴芝屡蕊縞舎写射捨赦斜煮社紗者謝車遮蛇邪借勺尺杓灼爵酌釈錫若寂弱惹主取守手朱殊狩珠種腫趣酒首儒受呪寿授樹綬需囚収周"],
                ["8f40", "宗就州修愁拾洲秀秋終繍習臭舟蒐衆襲讐蹴輯週酋酬集醜什住充十従戎柔汁渋獣縦重銃叔夙宿淑祝縮粛塾熟出術述俊峻春瞬竣舜駿准循旬楯殉淳"],
                ["8f80", "準潤盾純巡遵醇順処初所暑曙渚庶緒署書薯藷諸助叙女序徐恕鋤除傷償勝匠升召哨商唱嘗奨妾娼宵将小少尚庄床廠彰承抄招掌捷昇昌昭晶松梢樟樵沼消渉湘焼焦照症省硝礁祥称章笑粧紹肖菖蒋蕉衝裳訟証詔詳象賞醤鉦鍾鐘障鞘上丈丞乗冗剰城場壌嬢常情擾条杖浄状畳穣蒸譲醸錠嘱埴飾"],
                ["9040", "拭植殖燭織職色触食蝕辱尻伸信侵唇娠寝審心慎振新晋森榛浸深申疹真神秦紳臣芯薪親診身辛進針震人仁刃塵壬尋甚尽腎訊迅陣靭笥諏須酢図厨"],
                ["9080", "逗吹垂帥推水炊睡粋翠衰遂酔錐錘随瑞髄崇嵩数枢趨雛据杉椙菅頗雀裾澄摺寸世瀬畝是凄制勢姓征性成政整星晴棲栖正清牲生盛精聖声製西誠誓請逝醒青静斉税脆隻席惜戚斥昔析石積籍績脊責赤跡蹟碩切拙接摂折設窃節説雪絶舌蝉仙先千占宣専尖川戦扇撰栓栴泉浅洗染潜煎煽旋穿箭線"],
                ["9140", "繊羨腺舛船薦詮賎践選遷銭銑閃鮮前善漸然全禅繕膳糎噌塑岨措曾曽楚狙疏疎礎祖租粗素組蘇訴阻遡鼠僧創双叢倉喪壮奏爽宋層匝惣想捜掃挿掻"],
                ["9180", "操早曹巣槍槽漕燥争痩相窓糟総綜聡草荘葬蒼藻装走送遭鎗霜騒像増憎臓蔵贈造促側則即息捉束測足速俗属賊族続卒袖其揃存孫尊損村遜他多太汰詑唾堕妥惰打柁舵楕陀駄騨体堆対耐岱帯待怠態戴替泰滞胎腿苔袋貸退逮隊黛鯛代台大第醍題鷹滝瀧卓啄宅托択拓沢濯琢託鐸濁諾茸凧蛸只"],
                ["9240", "叩但達辰奪脱巽竪辿棚谷狸鱈樽誰丹単嘆坦担探旦歎淡湛炭短端箪綻耽胆蛋誕鍛団壇弾断暖檀段男談値知地弛恥智池痴稚置致蜘遅馳築畜竹筑蓄"],
                ["9280", "逐秩窒茶嫡着中仲宙忠抽昼柱注虫衷註酎鋳駐樗瀦猪苧著貯丁兆凋喋寵帖帳庁弔張彫徴懲挑暢朝潮牒町眺聴脹腸蝶調諜超跳銚長頂鳥勅捗直朕沈珍賃鎮陳津墜椎槌追鎚痛通塚栂掴槻佃漬柘辻蔦綴鍔椿潰坪壷嬬紬爪吊釣鶴亭低停偵剃貞呈堤定帝底庭廷弟悌抵挺提梯汀碇禎程締艇訂諦蹄逓"],
                ["9340", "邸鄭釘鼎泥摘擢敵滴的笛適鏑溺哲徹撤轍迭鉄典填天展店添纏甜貼転顛点伝殿澱田電兎吐堵塗妬屠徒斗杜渡登菟賭途都鍍砥砺努度土奴怒倒党冬"],
                ["9380", "凍刀唐塔塘套宕島嶋悼投搭東桃梼棟盗淘湯涛灯燈当痘祷等答筒糖統到董蕩藤討謄豆踏逃透鐙陶頭騰闘働動同堂導憧撞洞瞳童胴萄道銅峠鴇匿得徳涜特督禿篤毒独読栃橡凸突椴届鳶苫寅酉瀞噸屯惇敦沌豚遁頓呑曇鈍奈那内乍凪薙謎灘捺鍋楢馴縄畷南楠軟難汝二尼弐迩匂賑肉虹廿日乳入"],
                ["9440", "如尿韮任妊忍認濡禰祢寧葱猫熱年念捻撚燃粘乃廼之埜嚢悩濃納能脳膿農覗蚤巴把播覇杷波派琶破婆罵芭馬俳廃拝排敗杯盃牌背肺輩配倍培媒梅"],
                ["9480", "楳煤狽買売賠陪這蝿秤矧萩伯剥博拍柏泊白箔粕舶薄迫曝漠爆縛莫駁麦函箱硲箸肇筈櫨幡肌畑畠八鉢溌発醗髪伐罰抜筏閥鳩噺塙蛤隼伴判半反叛帆搬斑板氾汎版犯班畔繁般藩販範釆煩頒飯挽晩番盤磐蕃蛮匪卑否妃庇彼悲扉批披斐比泌疲皮碑秘緋罷肥被誹費避非飛樋簸備尾微枇毘琵眉美"],
                ["9540", "鼻柊稗匹疋髭彦膝菱肘弼必畢筆逼桧姫媛紐百謬俵彪標氷漂瓢票表評豹廟描病秒苗錨鋲蒜蛭鰭品彬斌浜瀕貧賓頻敏瓶不付埠夫婦富冨布府怖扶敷"],
                ["9580", "斧普浮父符腐膚芙譜負賦赴阜附侮撫武舞葡蕪部封楓風葺蕗伏副復幅服福腹複覆淵弗払沸仏物鮒分吻噴墳憤扮焚奮粉糞紛雰文聞丙併兵塀幣平弊柄並蔽閉陛米頁僻壁癖碧別瞥蔑箆偏変片篇編辺返遍便勉娩弁鞭保舗鋪圃捕歩甫補輔穂募墓慕戊暮母簿菩倣俸包呆報奉宝峰峯崩庖抱捧放方朋"],
                ["9640", "法泡烹砲縫胞芳萌蓬蜂褒訪豊邦鋒飽鳳鵬乏亡傍剖坊妨帽忘忙房暴望某棒冒紡肪膨謀貌貿鉾防吠頬北僕卜墨撲朴牧睦穆釦勃没殆堀幌奔本翻凡盆"],
                ["9680", "摩磨魔麻埋妹昧枚毎哩槙幕膜枕鮪柾鱒桝亦俣又抹末沫迄侭繭麿万慢満漫蔓味未魅巳箕岬密蜜湊蓑稔脈妙粍民眠務夢無牟矛霧鵡椋婿娘冥名命明盟迷銘鳴姪牝滅免棉綿緬面麺摸模茂妄孟毛猛盲網耗蒙儲木黙目杢勿餅尤戻籾貰問悶紋門匁也冶夜爺耶野弥矢厄役約薬訳躍靖柳薮鑓愉愈油癒"],
                ["9740", "諭輸唯佑優勇友宥幽悠憂揖有柚湧涌猶猷由祐裕誘遊邑郵雄融夕予余与誉輿預傭幼妖容庸揚揺擁曜楊様洋溶熔用窯羊耀葉蓉要謡踊遥陽養慾抑欲"],
                ["9780", "沃浴翌翼淀羅螺裸来莱頼雷洛絡落酪乱卵嵐欄濫藍蘭覧利吏履李梨理璃痢裏裡里離陸律率立葎掠略劉流溜琉留硫粒隆竜龍侶慮旅虜了亮僚両凌寮料梁涼猟療瞭稜糧良諒遼量陵領力緑倫厘林淋燐琳臨輪隣鱗麟瑠塁涙累類令伶例冷励嶺怜玲礼苓鈴隷零霊麗齢暦歴列劣烈裂廉恋憐漣煉簾練聯"],
                ["9840", "蓮連錬呂魯櫓炉賂路露労婁廊弄朗楼榔浪漏牢狼篭老聾蝋郎六麓禄肋録論倭和話歪賄脇惑枠鷲亙亘鰐詫藁蕨椀湾碗腕"],
                ["989f", "弌丐丕个丱丶丼丿乂乖乘亂亅豫亊舒弍于亞亟亠亢亰亳亶从仍仄仆仂仗仞仭仟价伉佚估佛佝佗佇佶侈侏侘佻佩佰侑佯來侖儘俔俟俎俘俛俑俚俐俤俥倚倨倔倪倥倅伜俶倡倩倬俾俯們倆偃假會偕偐偈做偖偬偸傀傚傅傴傲"],
                ["9940", "僉僊傳僂僖僞僥僭僣僮價僵儉儁儂儖儕儔儚儡儺儷儼儻儿兀兒兌兔兢竸兩兪兮冀冂囘册冉冏冑冓冕冖冤冦冢冩冪冫决冱冲冰况冽凅凉凛几處凩凭"],
                ["9980", "凰凵凾刄刋刔刎刧刪刮刳刹剏剄剋剌剞剔剪剴剩剳剿剽劍劔劒剱劈劑辨辧劬劭劼劵勁勍勗勞勣勦飭勠勳勵勸勹匆匈甸匍匐匏匕匚匣匯匱匳匸區卆卅丗卉卍凖卞卩卮夘卻卷厂厖厠厦厥厮厰厶參簒雙叟曼燮叮叨叭叺吁吽呀听吭吼吮吶吩吝呎咏呵咎呟呱呷呰咒呻咀呶咄咐咆哇咢咸咥咬哄哈咨"],
                ["9a40", "咫哂咤咾咼哘哥哦唏唔哽哮哭哺哢唹啀啣啌售啜啅啖啗唸唳啝喙喀咯喊喟啻啾喘喞單啼喃喩喇喨嗚嗅嗟嗄嗜嗤嗔嘔嗷嘖嗾嗽嘛嗹噎噐營嘴嘶嘲嘸"],
                ["9a80", "噫噤嘯噬噪嚆嚀嚊嚠嚔嚏嚥嚮嚶嚴囂嚼囁囃囀囈囎囑囓囗囮囹圀囿圄圉圈國圍圓團圖嗇圜圦圷圸坎圻址坏坩埀垈坡坿垉垓垠垳垤垪垰埃埆埔埒埓堊埖埣堋堙堝塲堡塢塋塰毀塒堽塹墅墹墟墫墺壞墻墸墮壅壓壑壗壙壘壥壜壤壟壯壺壹壻壼壽夂夊夐夛梦夥夬夭夲夸夾竒奕奐奎奚奘奢奠奧奬奩"],
                ["9b40", "奸妁妝佞侫妣妲姆姨姜妍姙姚娥娟娑娜娉娚婀婬婉娵娶婢婪媚媼媾嫋嫂媽嫣嫗嫦嫩嫖嫺嫻嬌嬋嬖嬲嫐嬪嬶嬾孃孅孀孑孕孚孛孥孩孰孳孵學斈孺宀"],
                ["9b80", "它宦宸寃寇寉寔寐寤實寢寞寥寫寰寶寳尅將專對尓尠尢尨尸尹屁屆屎屓屐屏孱屬屮乢屶屹岌岑岔妛岫岻岶岼岷峅岾峇峙峩峽峺峭嶌峪崋崕崗嵜崟崛崑崔崢崚崙崘嵌嵒嵎嵋嵬嵳嵶嶇嶄嶂嶢嶝嶬嶮嶽嶐嶷嶼巉巍巓巒巖巛巫已巵帋帚帙帑帛帶帷幄幃幀幎幗幔幟幢幤幇幵并幺麼广庠廁廂廈廐廏"],
                ["9c40", "廖廣廝廚廛廢廡廨廩廬廱廳廰廴廸廾弃弉彝彜弋弑弖弩弭弸彁彈彌彎弯彑彖彗彙彡彭彳彷徃徂彿徊很徑徇從徙徘徠徨徭徼忖忻忤忸忱忝悳忿怡恠"],
                ["9c80", "怙怐怩怎怱怛怕怫怦怏怺恚恁恪恷恟恊恆恍恣恃恤恂恬恫恙悁悍惧悃悚悄悛悖悗悒悧悋惡悸惠惓悴忰悽惆悵惘慍愕愆惶惷愀惴惺愃愡惻惱愍愎慇愾愨愧慊愿愼愬愴愽慂慄慳慷慘慙慚慫慴慯慥慱慟慝慓慵憙憖憇憬憔憚憊憑憫憮懌懊應懷懈懃懆憺懋罹懍懦懣懶懺懴懿懽懼懾戀戈戉戍戌戔戛"],
                ["9d40", "戞戡截戮戰戲戳扁扎扞扣扛扠扨扼抂抉找抒抓抖拔抃抔拗拑抻拏拿拆擔拈拜拌拊拂拇抛拉挌拮拱挧挂挈拯拵捐挾捍搜捏掖掎掀掫捶掣掏掉掟掵捫"],
                ["9d80", "捩掾揩揀揆揣揉插揶揄搖搴搆搓搦搶攝搗搨搏摧摯摶摎攪撕撓撥撩撈撼據擒擅擇撻擘擂擱擧舉擠擡抬擣擯攬擶擴擲擺攀擽攘攜攅攤攣攫攴攵攷收攸畋效敖敕敍敘敞敝敲數斂斃變斛斟斫斷旃旆旁旄旌旒旛旙无旡旱杲昊昃旻杳昵昶昴昜晏晄晉晁晞晝晤晧晨晟晢晰暃暈暎暉暄暘暝曁暹曉暾暼"],
                ["9e40", "曄暸曖曚曠昿曦曩曰曵曷朏朖朞朦朧霸朮朿朶杁朸朷杆杞杠杙杣杤枉杰枩杼杪枌枋枦枡枅枷柯枴柬枳柩枸柤柞柝柢柮枹柎柆柧檜栞框栩桀桍栲桎"],
                ["9e80", "梳栫桙档桷桿梟梏梭梔條梛梃檮梹桴梵梠梺椏梍桾椁棊椈棘椢椦棡椌棍棔棧棕椶椒椄棗棣椥棹棠棯椨椪椚椣椡棆楹楷楜楸楫楔楾楮椹楴椽楙椰楡楞楝榁楪榲榮槐榿槁槓榾槎寨槊槝榻槃榧樮榑榠榜榕榴槞槨樂樛槿權槹槲槧樅榱樞槭樔槫樊樒櫁樣樓橄樌橲樶橸橇橢橙橦橈樸樢檐檍檠檄檢檣"],
                ["9f40", "檗蘗檻櫃櫂檸檳檬櫞櫑櫟檪櫚櫪櫻欅蘖櫺欒欖鬱欟欸欷盜欹飮歇歃歉歐歙歔歛歟歡歸歹歿殀殄殃殍殘殕殞殤殪殫殯殲殱殳殷殼毆毋毓毟毬毫毳毯"],
                ["9f80", "麾氈氓气氛氤氣汞汕汢汪沂沍沚沁沛汾汨汳沒沐泄泱泓沽泗泅泝沮沱沾沺泛泯泙泪洟衍洶洫洽洸洙洵洳洒洌浣涓浤浚浹浙涎涕濤涅淹渕渊涵淇淦涸淆淬淞淌淨淒淅淺淙淤淕淪淮渭湮渮渙湲湟渾渣湫渫湶湍渟湃渺湎渤滿渝游溂溪溘滉溷滓溽溯滄溲滔滕溏溥滂溟潁漑灌滬滸滾漿滲漱滯漲滌"],
                ["e040", "漾漓滷澆潺潸澁澀潯潛濳潭澂潼潘澎澑濂潦澳澣澡澤澹濆澪濟濕濬濔濘濱濮濛瀉瀋濺瀑瀁瀏濾瀛瀚潴瀝瀘瀟瀰瀾瀲灑灣炙炒炯烱炬炸炳炮烟烋烝"],
                ["e080", "烙焉烽焜焙煥煕熈煦煢煌煖煬熏燻熄熕熨熬燗熹熾燒燉燔燎燠燬燧燵燼燹燿爍爐爛爨爭爬爰爲爻爼爿牀牆牋牘牴牾犂犁犇犒犖犢犧犹犲狃狆狄狎狒狢狠狡狹狷倏猗猊猜猖猝猴猯猩猥猾獎獏默獗獪獨獰獸獵獻獺珈玳珎玻珀珥珮珞璢琅瑯琥珸琲琺瑕琿瑟瑙瑁瑜瑩瑰瑣瑪瑶瑾璋璞璧瓊瓏瓔珱"],
                ["e140", "瓠瓣瓧瓩瓮瓲瓰瓱瓸瓷甄甃甅甌甎甍甕甓甞甦甬甼畄畍畊畉畛畆畚畩畤畧畫畭畸當疆疇畴疊疉疂疔疚疝疥疣痂疳痃疵疽疸疼疱痍痊痒痙痣痞痾痿"],
                ["e180", "痼瘁痰痺痲痳瘋瘍瘉瘟瘧瘠瘡瘢瘤瘴瘰瘻癇癈癆癜癘癡癢癨癩癪癧癬癰癲癶癸發皀皃皈皋皎皖皓皙皚皰皴皸皹皺盂盍盖盒盞盡盥盧盪蘯盻眈眇眄眩眤眞眥眦眛眷眸睇睚睨睫睛睥睿睾睹瞎瞋瞑瞠瞞瞰瞶瞹瞿瞼瞽瞻矇矍矗矚矜矣矮矼砌砒礦砠礪硅碎硴碆硼碚碌碣碵碪碯磑磆磋磔碾碼磅磊磬"],
                ["e240", "磧磚磽磴礇礒礑礙礬礫祀祠祗祟祚祕祓祺祿禊禝禧齋禪禮禳禹禺秉秕秧秬秡秣稈稍稘稙稠稟禀稱稻稾稷穃穗穉穡穢穩龝穰穹穽窈窗窕窘窖窩竈窰"],
                ["e280", "窶竅竄窿邃竇竊竍竏竕竓站竚竝竡竢竦竭竰笂笏笊笆笳笘笙笞笵笨笶筐筺笄筍笋筌筅筵筥筴筧筰筱筬筮箝箘箟箍箜箚箋箒箏筝箙篋篁篌篏箴篆篝篩簑簔篦篥籠簀簇簓篳篷簗簍篶簣簧簪簟簷簫簽籌籃籔籏籀籐籘籟籤籖籥籬籵粃粐粤粭粢粫粡粨粳粲粱粮粹粽糀糅糂糘糒糜糢鬻糯糲糴糶糺紆"],
                ["e340", "紂紜紕紊絅絋紮紲紿紵絆絳絖絎絲絨絮絏絣經綉絛綏絽綛綺綮綣綵緇綽綫總綢綯緜綸綟綰緘緝緤緞緻緲緡縅縊縣縡縒縱縟縉縋縢繆繦縻縵縹繃縷"],
                ["e380", "縲縺繧繝繖繞繙繚繹繪繩繼繻纃緕繽辮繿纈纉續纒纐纓纔纖纎纛纜缸缺罅罌罍罎罐网罕罔罘罟罠罨罩罧罸羂羆羃羈羇羌羔羞羝羚羣羯羲羹羮羶羸譱翅翆翊翕翔翡翦翩翳翹飜耆耄耋耒耘耙耜耡耨耿耻聊聆聒聘聚聟聢聨聳聲聰聶聹聽聿肄肆肅肛肓肚肭冐肬胛胥胙胝胄胚胖脉胯胱脛脩脣脯腋"],
                ["e440", "隋腆脾腓腑胼腱腮腥腦腴膃膈膊膀膂膠膕膤膣腟膓膩膰膵膾膸膽臀臂膺臉臍臑臙臘臈臚臟臠臧臺臻臾舁舂舅與舊舍舐舖舩舫舸舳艀艙艘艝艚艟艤"],
                ["e480", "艢艨艪艫舮艱艷艸艾芍芒芫芟芻芬苡苣苟苒苴苳苺莓范苻苹苞茆苜茉苙茵茴茖茲茱荀茹荐荅茯茫茗茘莅莚莪莟莢莖茣莎莇莊荼莵荳荵莠莉莨菴萓菫菎菽萃菘萋菁菷萇菠菲萍萢萠莽萸蔆菻葭萪萼蕚蒄葷葫蒭葮蒂葩葆萬葯葹萵蓊葢蒹蒿蒟蓙蓍蒻蓚蓐蓁蓆蓖蒡蔡蓿蓴蔗蔘蔬蔟蔕蔔蓼蕀蕣蕘蕈"],
                ["e540", "蕁蘂蕋蕕薀薤薈薑薊薨蕭薔薛藪薇薜蕷蕾薐藉薺藏薹藐藕藝藥藜藹蘊蘓蘋藾藺蘆蘢蘚蘰蘿虍乕虔號虧虱蚓蚣蚩蚪蚋蚌蚶蚯蛄蛆蚰蛉蠣蚫蛔蛞蛩蛬"],
                ["e580", "蛟蛛蛯蜒蜆蜈蜀蜃蛻蜑蜉蜍蛹蜊蜴蜿蜷蜻蜥蜩蜚蝠蝟蝸蝌蝎蝴蝗蝨蝮蝙蝓蝣蝪蠅螢螟螂螯蟋螽蟀蟐雖螫蟄螳蟇蟆螻蟯蟲蟠蠏蠍蟾蟶蟷蠎蟒蠑蠖蠕蠢蠡蠱蠶蠹蠧蠻衄衂衒衙衞衢衫袁衾袞衵衽袵衲袂袗袒袮袙袢袍袤袰袿袱裃裄裔裘裙裝裹褂裼裴裨裲褄褌褊褓襃褞褥褪褫襁襄褻褶褸襌褝襠襞"],
                ["e640", "襦襤襭襪襯襴襷襾覃覈覊覓覘覡覩覦覬覯覲覺覽覿觀觚觜觝觧觴觸訃訖訐訌訛訝訥訶詁詛詒詆詈詼詭詬詢誅誂誄誨誡誑誥誦誚誣諄諍諂諚諫諳諧"],
                ["e680", "諤諱謔諠諢諷諞諛謌謇謚諡謖謐謗謠謳鞫謦謫謾謨譁譌譏譎證譖譛譚譫譟譬譯譴譽讀讌讎讒讓讖讙讚谺豁谿豈豌豎豐豕豢豬豸豺貂貉貅貊貍貎貔豼貘戝貭貪貽貲貳貮貶賈賁賤賣賚賽賺賻贄贅贊贇贏贍贐齎贓賍贔贖赧赭赱赳趁趙跂趾趺跏跚跖跌跛跋跪跫跟跣跼踈踉跿踝踞踐踟蹂踵踰踴蹊"],
                ["e740", "蹇蹉蹌蹐蹈蹙蹤蹠踪蹣蹕蹶蹲蹼躁躇躅躄躋躊躓躑躔躙躪躡躬躰軆躱躾軅軈軋軛軣軼軻軫軾輊輅輕輒輙輓輜輟輛輌輦輳輻輹轅轂輾轌轉轆轎轗轜"],
                ["e780", "轢轣轤辜辟辣辭辯辷迚迥迢迪迯邇迴逅迹迺逑逕逡逍逞逖逋逧逶逵逹迸遏遐遑遒逎遉逾遖遘遞遨遯遶隨遲邂遽邁邀邊邉邏邨邯邱邵郢郤扈郛鄂鄒鄙鄲鄰酊酖酘酣酥酩酳酲醋醉醂醢醫醯醪醵醴醺釀釁釉釋釐釖釟釡釛釼釵釶鈞釿鈔鈬鈕鈑鉞鉗鉅鉉鉤鉈銕鈿鉋鉐銜銖銓銛鉚鋏銹銷鋩錏鋺鍄錮"],
                ["e840", "錙錢錚錣錺錵錻鍜鍠鍼鍮鍖鎰鎬鎭鎔鎹鏖鏗鏨鏥鏘鏃鏝鏐鏈鏤鐚鐔鐓鐃鐇鐐鐶鐫鐵鐡鐺鑁鑒鑄鑛鑠鑢鑞鑪鈩鑰鑵鑷鑽鑚鑼鑾钁鑿閂閇閊閔閖閘閙"],
                ["e880", "閠閨閧閭閼閻閹閾闊濶闃闍闌闕闔闖關闡闥闢阡阨阮阯陂陌陏陋陷陜陞陝陟陦陲陬隍隘隕隗險隧隱隲隰隴隶隸隹雎雋雉雍襍雜霍雕雹霄霆霈霓霎霑霏霖霙霤霪霰霹霽霾靄靆靈靂靉靜靠靤靦靨勒靫靱靹鞅靼鞁靺鞆鞋鞏鞐鞜鞨鞦鞣鞳鞴韃韆韈韋韜韭齏韲竟韶韵頏頌頸頤頡頷頽顆顏顋顫顯顰"],
                ["e940", "顱顴顳颪颯颱颶飄飃飆飩飫餃餉餒餔餘餡餝餞餤餠餬餮餽餾饂饉饅饐饋饑饒饌饕馗馘馥馭馮馼駟駛駝駘駑駭駮駱駲駻駸騁騏騅駢騙騫騷驅驂驀驃"],
                ["e980", "騾驕驍驛驗驟驢驥驤驩驫驪骭骰骼髀髏髑髓體髞髟髢髣髦髯髫髮髴髱髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬲魄魃魏魍魎魑魘魴鮓鮃鮑鮖鮗鮟鮠鮨鮴鯀鯊鮹鯆鯏鯑鯒鯣鯢鯤鯔鯡鰺鯲鯱鯰鰕鰔鰉鰓鰌鰆鰈鰒鰊鰄鰮鰛鰥鰤鰡鰰鱇鰲鱆鰾鱚鱠鱧鱶鱸鳧鳬鳰鴉鴈鳫鴃鴆鴪鴦鶯鴣鴟鵄鴕鴒鵁鴿鴾鵆鵈"],
                ["ea40", "鵝鵞鵤鵑鵐鵙鵲鶉鶇鶫鵯鵺鶚鶤鶩鶲鷄鷁鶻鶸鶺鷆鷏鷂鷙鷓鷸鷦鷭鷯鷽鸚鸛鸞鹵鹹鹽麁麈麋麌麒麕麑麝麥麩麸麪麭靡黌黎黏黐黔黜點黝黠黥黨黯"],
                ["ea80", "黴黶黷黹黻黼黽鼇鼈皷鼕鼡鼬鼾齊齒齔齣齟齠齡齦齧齬齪齷齲齶龕龜龠堯槇遙瑤凜熙"],
                ["ed40", "纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏"],
                ["ed80", "塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱"],
                ["ee40", "犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙"],
                ["ee80", "蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"],
                ["eeef", "ⅰ", 9, "￢￤＇＂"],
                ["f040", "", 62],
                ["f080", "", 124],
                ["f140", "", 62],
                ["f180", "", 124],
                ["f240", "", 62],
                ["f280", "", 124],
                ["f340", "", 62],
                ["f380", "", 124],
                ["f440", "", 62],
                ["f480", "", 124],
                ["f540", "", 62],
                ["f580", "", 124],
                ["f640", "", 62],
                ["f680", "", 124],
                ["f740", "", 62],
                ["f780", "", 124],
                ["f840", "", 62],
                ["f880", "", 124],
                ["f940", ""],
                ["fa40", "ⅰ", 9, "Ⅰ", 9, "￢￤＇＂㈱№℡∵纊褜鍈銈蓜俉炻昱棈鋹曻彅丨仡仼伀伃伹佖侒侊侚侔俍偀倢俿倞偆偰偂傔僴僘兊"],
                ["fa80", "兤冝冾凬刕劜劦勀勛匀匇匤卲厓厲叝﨎咜咊咩哿喆坙坥垬埈埇﨏塚增墲夋奓奛奝奣妤妺孖寀甯寘寬尞岦岺峵崧嵓﨑嵂嵭嶸嶹巐弡弴彧德忞恝悅悊惞惕愠惲愑愷愰憘戓抦揵摠撝擎敎昀昕昻昉昮昞昤晥晗晙晴晳暙暠暲暿曺朎朗杦枻桒柀栁桄棏﨓楨﨔榘槢樰橫橆橳橾櫢櫤毖氿汜沆汯泚洄涇浯"],
                ["fb40", "涖涬淏淸淲淼渹湜渧渼溿澈澵濵瀅瀇瀨炅炫焏焄煜煆煇凞燁燾犱犾猤猪獷玽珉珖珣珒琇珵琦琪琩琮瑢璉璟甁畯皂皜皞皛皦益睆劯砡硎硤硺礰礼神"],
                ["fb80", "祥禔福禛竑竧靖竫箞精絈絜綷綠緖繒罇羡羽茁荢荿菇菶葈蒴蕓蕙蕫﨟薰蘒﨡蠇裵訒訷詹誧誾諟諸諶譓譿賰賴贒赶﨣軏﨤逸遧郞都鄕鄧釚釗釞釭釮釤釥鈆鈐鈊鈺鉀鈼鉎鉙鉑鈹鉧銧鉷鉸鋧鋗鋙鋐﨧鋕鋠鋓錥錡鋻﨨錞鋿錝錂鍰鍗鎤鏆鏞鏸鐱鑅鑈閒隆﨩隝隯霳霻靃靍靏靑靕顗顥飯飼餧館馞驎髙"],
                ["fc40", "髜魵魲鮏鮱鮻鰀鵰鵫鶴鸙黑"]
            ]
        }, {}
    ],
    74: [function(g, p, m) {
            (function(h) {
                function g(a) {
                    return {
                        write: k,
                        end: function() {}
                    }
                }
                function k(a) {
                    a = new h(a, "ucs2");
                    for (var b = 0; b < a.length; b += 2) {
                        var c = a[b];
                        a[b] = a[b + 1];
                        a[b + 1] = c
                    }
                    return a
                }
                function f(a) {
                    return {
                        write: d,
                        end: function() {},
                        overflowByte: -1
                    }
                }
                function d(a) {
                    if (0 == a.length) return "";
                    var b = new h(a.length + 1),
                        c = 0,
                        d = 0; - 1 !== this.overflowByte && (b[0] = a[0], b[1] = this.overflowByte, c = 1, d = 2);
                    for (; c < a.length - 1; c += 2, d += 2) b[d] = a[c + 1], b[d + 1] = a[c];
                    this.overflowByte = c == a.length - 1 ? a[a.length - 1] : -1;
                    return b.slice(0, d).toString("ucs2")
                }
                function a(a) {
                    a = a || {};
                    var d = this.getCodec(a.use ||
                        "utf-16be");
                    if (!d.bom) throw Error("iconv-lite: in UTF-16 encoder, 'use' parameter should be either UTF-16BE or UTF16-LE.");
                    return {
                        write: c,
                        end: b,
                        bom: d.bom,
                        internalEncoder: d.encoder(a)
                    }
                }
                function c(a) {
                    a = this.internalEncoder.write(a);
                    this.bom && (a = h.concat([this.bom, a]), this.bom = null);
                    return a
                }
                function b() {
                    return this.internalEncoder.end()
                }
                function l(a) {
                    return {
                        write: p,
                        end: n,
                        internalDecoder: null,
                        initialBytes: [],
                        initialBytesLen: 0,
                        options: a || {},
                        getCodec: this.getCodec
                    }
                }
                function p(a) {
                    if (this.internalDecoder) return this.internalDecoder.write(a);
                    this.initialBytes.push(a);
                    this.initialBytesLen += a.length;
                    return 16 > this.initialBytesLen ? "" : q.call(this)
                }
                function n() {
                    if (this.internalDecoder) return this.internalDecoder.end();
                    var a = q.call(this),
                        b;
                    this.internalDecoder && (b = this.internalDecoder.end());
                    return b && 0 < b.length ? a + b : a
                }
                function q() {
                    var a = h.concat(this.initialBytes);
                    this.initialBytes.length = this.initialBytesLen = 0;
                    if (2 > a.length) return "";
                    var b = this.options.
                    default || "utf-16be";
                    if (254 == a[0] && 255 == a[1]) b = "utf-16be", a = a.slice(2);
                    else if (255 == a[0] &&
                        254 == a[1]) b = "utf-16le", a = a.slice(2);
                    else {
                        for (var c = [0, 0], d = Math.min(a.length - a.length % 2, 64), f = 0; f < d; f += 2) 0 == a[f] && 32 == a[f + 1] && c[0]++, 32 == a[f] && 0 == a[f + 1] && c[1]++;
                        0 < c[0] && 0 == c[1] ? b = "utf-16be" : 0 == c[0] && 0 < c[1] && (b = "utf-16le")
                    }
                    this.internalDecoder = this.getCodec(b).decoder(this.options);
                    return this.internalDecoder.write(a)
                }
                m.utf16be = function(a) {
                    return {
                        encoder: g,
                        decoder: f,
                        bom: new h([254, 255])
                    }
                };
                m.utf16 = function(b) {
                    return {
                        encoder: a,
                        decoder: l,
                        getCodec: b.iconv.getCodec
                    }
                }
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    75: [function(g, p, m) {
            (function(h) {
                function g(a) {
                    return new h(a.replace(l, function(a) {
                        return "+" + ("+" === a ? "" : this.iconv.encode(a, "utf16-be").toString("base64").replace(/=+$/, "")) + "-"
                    }.bind(this)))
                }
                function k(a) {
                    for (var b = "", c = 0, d = this.inBase64, f = this.base64Accum, g = 0; g < a.length; g++) d ? n[a[g]] || (g == c && a[g] == r ? b += "+" : (c = f + a.slice(c, g).toString(), b += this.iconv.decode(new h(c, "base64"), "utf16-be")), a[g] != r && g--, c = g + 1, d = !1, f = "") : a[g] == e && (b += this.iconv.decode(a.slice(c, g), "ascii"), c = g + 1, d = !0);
                    d ? (c = f + a.slice(c).toString(),
                        a = c.length - c.length % 8, f = c.slice(a), c = c.slice(0, a), b += this.iconv.decode(new h(c, "base64"), "utf16-be")) : b += this.iconv.decode(a.slice(c), "ascii");
                    this.inBase64 = d;
                    this.base64Accum = f;
                    return b
                }
                function f() {
                    var a = "";
                    this.inBase64 && 0 < this.base64Accum.length && (a = this.iconv.decode(new h(this.base64Accum, "base64"), "utf16-be"));
                    this.inBase64 = !1;
                    this.base64Accum = "";
                    return a
                }
                function d(a) {
                    for (var b = this.inBase64, c = this.base64Accum, e = this.base64AccumIdx, d = new h(5 * a.length + 10), f = 0, g = 0; g < a.length; g++) {
                        var l = a.charCodeAt(g);
                        32 <= l && 126 >= l ? (b && (0 < e && (f += d.write(c.slice(0, e).toString("base64").replace(/\//g, ",").replace(/=+$/, ""), f), e = 0), d[f++] = r, b = !1), b || (d[f++] = l, 38 === l && (d[f++] = r))) : (b || (d[f++] = 38, b = !0), b && (c[e++] = l >> 8, c[e++] = l & 255, e == c.length && (f += d.write(c.toString("base64").replace(/\//g, ","), f), e = 0)))
                    }
                    this.inBase64 = b;
                    this.base64AccumIdx = e;
                    return d.slice(0, f)
                }
                function a() {
                    var a = new h(10),
                        b = 0;
                    this.inBase64 && (0 < this.base64AccumIdx && (b += a.write(this.base64Accum.slice(0, this.base64AccumIdx).toString("base64").replace(/\//g,
                        ",").replace(/=+$/, ""), b), this.base64AccumIdx = 0), a[b++] = r, this.inBase64 = !1);
                    return a.slice(0, b)
                }
                function c(a) {
                    for (var b = "", c = 0, e = this.inBase64, d = this.base64Accum, f = 0; f < a.length; f++) e ? v[a[f]] || (f == c && a[f] == r ? b += "&" : (c = d + a.slice(c, f).toString().replace(/,/g, "/"), b += this.iconv.decode(new h(c, "base64"), "utf16-be")), a[f] != r && f--, c = f + 1, e = !1, d = "") : 38 == a[f] && (b += this.iconv.decode(a.slice(c, f), "ascii"), c = f + 1, e = !0);
                    e ? (c = d + a.slice(c).toString().replace(/,/g, "/"), a = c.length - c.length % 8, d = c.slice(a), c = c.slice(0,
                        a), b += this.iconv.decode(new h(c, "base64"), "utf16-be")) : b += this.iconv.decode(a.slice(c), "ascii");
                    this.inBase64 = e;
                    this.base64Accum = d;
                    return b
                }
                function b() {
                    var a = "";
                    this.inBase64 && 0 < this.base64Accum.length && (a = this.iconv.decode(new h(this.base64Accum, "base64"), "utf16-be"));
                    this.inBase64 = !1;
                    this.base64Accum = "";
                    return a
                }
                m.utf7 = function(a) {
                    return {
                        encoder: function() {
                            return {
                                write: g,
                                end: function() {},
                                iconv: a.iconv
                            }
                        },
                        decoder: function() {
                            return {
                                write: k,
                                end: f,
                                iconv: a.iconv,
                                inBase64: !1,
                                base64Accum: ""
                            }
                        }
                    }
                };
                for (var l =
                    /[^A-Za-z0-9'\(\),-\.\/:\? \n\r\t]+/g, p = /[A-Za-z0-9\/+]/, n = [], q = 0; 256 > q; q++) n[q] = p.test(String.fromCharCode(q));
                var e = 43,
                    r = 45;
                m.utf7imap = function(e) {
                    return {
                        encoder: function() {
                            return {
                                write: d,
                                end: a,
                                iconv: e.iconv,
                                inBase64: !1,
                                base64Accum: new h(6),
                                base64AccumIdx: 0
                            }
                        },
                        decoder: function() {
                            return {
                                write: c,
                                end: b,
                                iconv: e.iconv,
                                inBase64: !1,
                                base64Accum: ""
                            }
                        }
                    }
                };
                var v = n.slice();
                v[44] = !0
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3
        }
    ],
    76: [function(g, p, m) {
            (function(h, m) {
                var k = p.exports;
                k.encodings = null;
                k.defaultCharUnicode =
                    "�";
                k.defaultCharSingleByte = "?";
                k.encode = function(d, a, c) {
                    d = "" + (d || "");
                    a = k.getCodec(a).encoder(c);
                    d = a.write(d);
                    return (a = a.end()) && 0 < a.length ? m.concat([d, a]) : d
                };
                k.decode = function(d, a, c) {
                    "string" === typeof d && (k.skipDecodeWarning || (console.error("Iconv-lite warning: decode()-ing strings is deprecated. Refer to https://github.com/ashtuchkin/iconv-lite/wiki/Use-Buffers-when-decoding"), k.skipDecodeWarning = !0), d = new m("" + (d || ""), "binary"));
                    a = k.getCodec(a).decoder(c);
                    d = a.write(d);
                    return (a = a.end()) && 0 < a.length ?
                        d + a : d
                };
                k.encodingExists = function(d) {
                    try {
                        return k.getCodec(d), !0
                    } catch (a) {
                        return !1
                    }
                };
                k.toEncoding = k.encode;
                k.fromEncoding = k.decode;
                k._codecDataCache = {};
                k.getCodec = function(d) {
                    k.encodings || (k.encodings = g("../encodings"));
                    for (var a = ("" + d).toLowerCase().replace(/[^0-9a-z]|:\d{4}$/g, ""), c, b;;) {
                        if (c = k._codecDataCache[a]) return c;
                        c = k.encodings[a];
                        switch (typeof c) {
                            case "string":
                                a = c;
                                break;
                            case "object":
                                if (b) for (var f in c) b[f] = c[f];
                                else b = c, b.encodingName = a;
                                a = c.type;
                                break;
                            case "function":
                                return b || (b = {
                                    encodingName: a
                                }),
                                b.iconv = k, c = c.call(k.encodings, b), k._codecDataCache[b.encodingName] = c;
                            default:
                                throw Error("Encoding not recognized: '" + d + "' (searched as: '" + a + "')");
                        }
                    }
                };
                var f = "undefined" !== typeof h && h.versions && h.versions.node;
                f && (f = f.split(".").map(Number), (0 < f[0] || 10 <= f[1]) && g("./streams")(k), g("./extend-node")(k))
            }).call(this, g("_process"), g("buffer").Buffer)
        }, {
            "../encodings": 61,
            "./extend-node": 2,
            "./streams": 2,
            _process: 39,
            buffer: 3
        }
    ],
    77: [function(g, p, m) {
            (function(h, m) {
                function k() {
                    this.types = Object.create(null);
                    this.extensions = Object.create(null)
                }
                var f = g("path");
                g("fs");
                k.prototype.define = function(a) {
                    for (var c in a) {
                        for (var b = a[c], d = 0; d < b.length; d++) h.env.DEBUG_MIME && this.types[b] && console.warn(this._loading.replace(/.*\//, ""), 'changes "' + b[d] + '" extension type from ' + this.types[b] + " to " + c), this.types[b[d]] = c;
                        this.extensions[c] || (this.extensions[c] = b[0])
                    }
                };
                k.prototype.load = function(a) {
                    this._loading = a;
                    var c = {};
                    lines = "".split(/[\r\n]+/);
                    lines.forEach(function(a) {
                        a = a.replace(/\s*#.*|^\s*|\s*$/g, "").split(/\s+/);
                        c[a.shift()] = a
                    });
                    this.define(c);
                    this._loading = null
                };
                k.prototype.lookup = function(a, c) {
                    var b = a.replace(/.*[\.\/\\]/, "").toLowerCase();
                    return this.types[b] || c || this.default_type
                };
                k.prototype.extension = function(a) {
                    a = a.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase();
                    return this.extensions[a]
                };
                var d = new k;
                d.load(f.join(m, "types/mime.types"));
                d.load(f.join(m, "types/node.types"));
                d.default_type = d.lookup("bin");
                d.Mime = k;
                d.charsets = {
                    lookup: function(a, c) {
                        return /^text\//.test(a) ? "UTF-8" : c
                    }
                };
                p.exports = d
            }).call(this,
                g("_process"), "/..\\node_modules\\mime")
        }, {
            _process: 39,
            fs: 1,
            path: 38
        }
    ],
    78: [function(g, p, m) {
            p.exports = g("./lib/mimelib");
            p.exports.contentTypes = g("./lib/content-types");
            p.exports.contentTypesReversed = g("./lib/content-types-reversed")
        }, {
            "./lib/content-types": 80,
            "./lib/content-types-reversed": 79,
            "./lib/mimelib": 81
        }
    ],
    79: [function(g, p, m) {
            p.exports = {
                "application/msword": "doc",
                "application/pdf": "pdf",
                "application/rss+xml": "rss",
                "application/vnd.ms-excel": "xls",
                "application/vnd.ms-powerpoint": "ppt",
                "application/vnd.oasis.opendocument.presentation": "odp",
                "application/vnd.oasis.opendocument.spreadsheet": "ods",
                "application/vnd.oasis.opendocument.text": "odt",
                "application/vnd.sun.xml.calc": "sxc",
                "application/vnd.sun.xml.writer": "sxw",
                "audio/basic": "au",
                "audio/flac": "flac",
                "audio/mid": "mid",
                "audio/mp4": "m4a",
                "audio/mpeg": "mp3",
                "audio/ogg": "ogg",
                "audio/x-aiff": "aif",
                "audio/x-wav": "wav",
                "image/gif": "gif",
                "image/jpeg": "jpg",
                "image/png": "png",
                "image/tiff": "tif",
                "image/vnd.wap.wbmp": "wbmp",
                "image/x-ms-bmp": "bmp",
                "text/calendar": "ics",
                "text/comma-separated-values": "csv",
                "text/css": "css",
                "text/html": "html",
                "text/plain": "txt",
                "text/x-vcard": "vcf",
                "video/mp4": "mp4",
                "video/mpeg": "mpeg",
                "video/ogg": "ogv",
                "video/quicktime": "mov",
                "video/x-msvideo": "avi",
                "application/zip": "zip",
                "application/x-rar-compressed": "rar"
            }
        }, {}
    ],
    80: [function(g, p, m) {
            p.exports = {
                doc: "application/msword",
                docx: "application/msword",
                pdf: "application/pdf",
                rss: "application/rss+xml",
                xls: "application/vnd.ms-excel",
                xlsx: "application/vnd.ms-excel",
                pps: "application/vnd.ms-powerpoint",
                ppt: "application/vnd.ms-powerpoint",
                pptx: "application/vnd.ms-powerpoint",
                odp: "application/vnd.oasis.opendocument.presentation",
                ods: "application/vnd.oasis.opendocument.spreadsheet",
                odt: "application/vnd.oasis.opendocument.text",
                sxc: "application/vnd.sun.xml.calc",
                sxw: "application/vnd.sun.xml.writer",
                au: "audio/basic",
                snd: "audio/basic",
                flac: "audio/flac",
                mid: "audio/mid",
                rmi: "audio/mid",
                m4a: "audio/mp4",
                mp3: "audio/mpeg",
                oga: "audio/ogg",
                ogg: "audio/ogg",
                aif: "audio/x-aiff",
                aifc: "audio/x-aiff",
                aiff: "audio/x-aiff",
                wav: "audio/x-wav",
                gif: "image/gif",
                jpeg: "image/jpeg",
                jpg: "image/jpeg",
                jpe: "image/jpeg",
                png: "image/png",
                tiff: "image/tiff",
                tif: "image/tiff",
                wbmp: "image/vnd.wap.wbmp",
                bmp: "image/x-ms-bmp",
                ics: "text/calendar",
                csv: "text/comma-separated-values",
                css: "text/css",
                htm: "text/html",
                html: "text/html",
                text: "text/plain",
                txt: "text/plain",
                asc: "text/plain",
                diff: "text/plain",
                pot: "text/plain",
                vcf: "text/x-vcard",
                mp4: "video/mp4",
                mpeg: "video/mpeg",
                mpg: "video/mpeg",
                mpe: "video/mpeg",
                ogv: "video/ogg",
                qt: "video/quicktime",
                mov: "video/quicktime",
                avi: "video/x-msvideo",
                zip: "application/zip",
                rar: "application/x-rar-compressed"
            }
        }, {}
    ],
    81: [function(g, p, m) {
            (function(h) {
                function m(a, c) {
                    c = (c || "base64").toString().toLowerCase().trim();
                    if ("qp" == c) {
                        for (var b = 0, d = a.length, f, h, g, e = Math.floor(76 / 3), p = ""; b < d;) if (g = a.substr(b, 76), f = g.match(/\r\n/)) g = g.substr(0, f.index + f[0].length), p += g, b += g.length;
                            else if ("\n" == g.substr(-1)) p += g, b += g.length;
                        else if (f = g.substr(-e).match(/\n.*?$/)) g = g.substr(0, g.length - (f[0].length - 1)), p += g, b += g.length;
                        else {
                            if (g.length > 76 - e && (f = g.substr(-e).match(/[ \t\.,!\?][^ \t\.,!\?]*$/))) g =
                                    g.substr(0, g.length - (f[0].length - 1));
                            else if ("\r" == g.substr(-1)) g = g.substr(0, g.length - 1);
                            else if (g.match(/\=[\da-f]{0,2}$/i)) {
                                if (f = g.match(/\=[\da-f]{0,1}$/i)) g = g.substr(0, g.length - f[0].length);
                                for (; 3 < g.length && g.length < d - b && !g.match(/^(?:=[\da-f]{2}){1,4}$/i) && (f = g.match(/\=[\da-f]{2}$/ig));) {
                                    h = parseInt(f[0].substr(1, 2), 16);
                                    if (128 > h) break;
                                    g = g.substr(0, g.length - 3);
                                    if (192 <= h) break
                                }
                            }
                            b + g.length < d && "\n" != g.substr(-1) ? (76 == g.length && g.match(/\=[\da-f]{2}$/i) ? g = g.substr(0, g.length - 3) : 76 == g.length && (g = g.substr(0,
                                g.length - 1)), b += g.length, g += "=\r\n") : b += g.length;
                            p += g
                        }
                        return p
                    }
                    return k(a, 76)
                }
                function k(a, c) {
                    a = (a || "").toString().trim();
                    return a.replace(new RegExp(".{" + c + "}", "g"), "$&\r\n").trim()
                }
                var f = g("encoding").convert,
                    d = g("addressparser");
                p.exports.foldLine = function(a, c, b, d, f) {
                    return b ? k(a, c || 76) : p.exports.mimeFunctions.foldLine(a, c, !! d, f)
                };
                p.exports.encodeMimeWord = function(a, c, b, d) {
                    return p.exports.mimeFunctions.encodeMimeWord(a, c, d || 0, b)
                };
                p.exports.encodeMimeWords = function(a, c, b, d) {
                    return p.exports.mimeFunctions.encodeMimeWords(a,
                        c, b || 0, d)
                };
                p.exports.decodeMimeWord = function(a) {
                    return p.exports.mimeFunctions.decodeMimeWord(a).toString("utf-8")
                };
                p.exports.parseMimeWords = function(a) {
                    return p.exports.mimeFunctions.decodeMimeWords(a).toString("utf-8")
                };
                p.exports.encodeQuotedPrintable = function(a, c, b) {
                    "string" != typeof c || b || (b = c);
                    return p.exports.mimeFunctions.encodeQuotedPrintable(a, b)
                };
                p.exports.decodeQuotedPrintable = function(a, c, b) {
                    "string" != typeof c || b || (b = c);
                    b = (b || "").toString().toUpperCase().trim();
                    a = p.exports.mimeFunctions.decodeQuotedPrintable(a,
                        "utf-8", b);
                    return "BINARY" == b ? a : a.toString("utf-8")
                };
                p.exports.encodeBase64 = function(a, c) {
                    return p.exports.mimeFunctions.encodeBase64(a, c)
                };
                p.exports.decodeBase64 = function(a, c) {
                    return p.exports.mimeFunctions.decodeBase64(a, "utf-8", c).toString("utf-8")
                };
                p.exports.parseAddresses = function(a) {
                    return [].concat.apply([], [].concat(a).map(d)).map(function(a) {
                        a.name = p.exports.parseMimeWords(a.name);
                        a.group && a.group.forEach(function(a) {
                            a.name = p.exports.parseMimeWords(a.name)
                        });
                        return a
                    })
                };
                p.exports.parseHeaders = function(a) {
                    return p.exports.mimeFunctions.parseHeaderLines(a)
                };
                p.exports.parseHeaderLine = function(a) {
                    if (!a) return {};
                    var c = {};
                    a = a.split(";");
                    for (var b, d = 0, f = a.length; d < f; d++) b = a[d].indexOf("="), 0 > b ? c[d ? "i-" + d : "defaultValue"] = a[d].trim() : c[a[d].substr(0, b).trim().toLowerCase()] = a[d].substr(b + 1).trim();
                    return c
                };
                p.exports.mimeFunctions = {
                    mimeEncode: function(a, c, b) {
                        a = f(a || "", c || "UTF-8", b || "UTF-8");
                        c = [
                            [9],
                            [10],
                            [13],
                            [32],
                            [33],
                            [35, 60],
                            [62],
                            [64, 94],
                            [96, 126]
                        ];
                        b = "";
                        for (var d = 0, g = a.length; d < g; d++) {
                            var h;
                            a: {
                                h =
                                    a[d];
                                for (var k = c.length - 1; 0 <= k; k--) if (c[k].length) {
                                        if (1 == c[k].length && h == c[k][0]) {
                                            h = !0;
                                            break a
                                        }
                                        if (2 == c[k].length && h >= c[k][0] && h <= c[k][1]) {
                                            h = !0;
                                            break a
                                        }
                                    }
                                h = !1
                            }
                            b = h ? b + String.fromCharCode(a[d]) : b + ("=" + (16 > a[d] ? "0" : "") + a[d].toString(16).toUpperCase())
                        }
                        return b
                    },
                    mimeDecode: function(a, c, b) {
                        a = (a || "").toString();
                        c = c || "UTF-8";
                        b = b || "UTF-8";
                        for (var d = (a.match(/\=[\da-fA-F]{2}/g) || []).length, g, k = new h(a.length - 2 * d), m = 0, e = 0, p = a.length; e < p; e++) d = a.charAt(e), "=" == d && (g = a.substr(e + 1, 2)) && /[\da-fA-F]{2}/.test(g) ? (k[m++] =
                                parseInt(g, 16), e += 2) : k[m++] = d.charCodeAt(0);
                        return "BINARY" == b.toUpperCase().trim() ? k : f(k, c, b)
                    },
                    encodeBase64: function(a, c, b) {
                        a = f(a || "", c, b);
                        return m(a.toString("base64"), "base64")
                    },
                    decodeBase64: function(a, c, b) {
                        a = new h((a || "").toString(), "base64");
                        return f(a, c, b)
                    },
                    decodeQuotedPrintable: function(a, c, b) {
                        a = (a || "").toString();
                        a = a.replace(/\=(?:\r?\n|$)/g, "");
                        return this.mimeDecode(a, c, b)
                    },
                    encodeQuotedPrintable: function(a, c, b) {
                        a = this.mimeEncode(a, c, b);
                        a = a.replace(/\r?\n|\r/g, function() {
                            return "\r\n"
                        }).replace(/[\t ]+$/gm, function(a) {
                            return a.replace(/ /g, "=20").replace(/\t/g, "=09")
                        });
                        return m(a, "qp")
                    },
                    encodeMimeWord: function(a, c, b, d, g) {
                        d = (d || "utf-8").toString().toUpperCase().trim();
                        c = (c || "Q").toString().toUpperCase().trim().charAt(0);
                        var h;
                        b && b > 7 + d.length && (b -= 7 + d.length);
                        "Q" == c ? (h = this.mimeEncode(a, d, g), h = h.replace(/[\r\n\t_]/g, function(a) {
                            a = a.charCodeAt(0);
                            return "=" + (16 > a ? "0" : "") + a.toString(16).toUpperCase()
                        }).replace(/\s/g, "_")) : "B" == c && (h = f(a || "", d, g).toString("base64").trim());
                        b && h.length > b && ("Q" == c ? h = this.splitEncodedString(h,
                            b).join("?= =?" + d + "?" + c + "?") : (h = h.replace(new RegExp(".{" + b + "}", "g"), "$&?= =?" + d + "?" + c + "?"), h.substr(-(" =?" + d + "?" + c + "?=").length) == " =?" + d + "?" + c + "?=" && (h = h.substr(0, h.length - (" =?" + d + "?" + c + "?=").length)), h.substr(-(" =?" + d + "?" + c + "?").length) == " =?" + d + "?" + c + "?" && (h = h.substr(0, h.length - (" =?" + d + "?" + c + "?").length))));
                        return "=?" + d + "?" + c + "?" + h + ("?=" == h.substr(-2) ? "" : "?=")
                    },
                    decodeMimeWord: function(a, c) {
                        a = (a || "").toString().trim();
                        var b, d, h;
                        h = a.match(/^\=\?([\w_\-]+)\?([QqBb])\?([^\?]*)\?\=$/i);
                        if (!h) return f(a,
                                c);
                        b = h[1];
                        d = (h[2] || "Q").toString().toUpperCase();
                        a = (h[3] || "").replace(/_/g, " ");
                        return "B" == d ? this.decodeBase64(a, c, b) : "Q" == d ? this.mimeDecode(a, c, b) : a
                    },
                    decodeMimeWords: function(a, c) {
                        a = (a || "").toString().replace(/(=\?[^?]+\?[QqBb]\?[^?]+\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, "$1").replace(/\=\?([\w_\-]+)\?([QqBb])\?[^\?]*\?\=/g, function(a, c, d) {
                            return this.decodeMimeWord(a)
                        }.bind(this));
                        return f(a, c)
                    },
                    foldLine: function(a, c, b, d) {
                        c = c || 76;
                        d = d || Math.floor(c / 5);
                        a = (a || "").toString().trim();
                        for (var f = 0, h =
                                a.length, g = "", e, k; f < h;) {
                            e = a.substr(f, c);
                            if (e.length < c) {
                                g += e;
                                break
                            }
                            if (k = e.match(/^[^\n\r]*(\r?\n|\r)/)) e = k[0], g += e, f += e.length;
                            else {
                                if (k = e.substr(-d).match(/(\s+)[^\s]*$/)) e = e.substr(0, e.length - (k[0].length - (b ? (k[1] || "").length : 0)));
                                else if (k = a.substr(f + e.length).match(/^[^\s]+(\s*)/)) e += k[0].substr(0, k[0].length - (b ? 0 : (k[1] || "").length));
                                g += e;
                                f += e.length;
                                f < h && (g += "\r\n")
                            }
                        }
                        return g
                    },
                    encodeMimeWords: function(a, c, b, d, h) {
                        return f(a || "", "utf-8", h).toString("utf-8").replace(/([^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*(?:\s+[^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*\s*)?)+(?=\s|$)/g, function(a) {
                            return a.length ? this.encodeMimeWord(a, c || "Q", b, d) : ""
                        }.bind(this))
                    },
                    encodeHeaderLine: function(a, c, b, d) {
                        c = this.encodeMimeWords(c, 52, b, d);
                        return this.foldLine(a + ": " + c, 76)
                    },
                    parseHeaderLines: function(a, c) {
                        var b = a.split(/\r?\n|\r/),
                            d = {}, f, h, g, e;
                        for (g = b.length - 1; 0 <= g; g--) g && b[g].match(/^\s/) && (b[g - 1] += "\r\n" + b[g], b.splice(g, 1));
                        g = 0;
                        for (e = b.length; g < e; g++) {
                            h = this.decodeHeaderLine(b[g]);
                            f = (h[0] || "").toString().toLowerCase().trim();
                            h = h[1] || "";
                            if (!c || (c || "").toString().trim().match(/^utf[\-_]?8$/i)) h =
                                    h.toString("utf-8");
                            d[f] ? d[f].push(h) : d[f] = [h]
                        }
                        return d
                    },
                    decodeHeaderLine: function(a, c) {
                        var b = (a || "").toString().replace(/(?:\r?\n|\r)[ \t]*/g, " ").trim().match(/^\s*([^:]+):(.*)$/),
                            d = (b && b[1] || "").trim(),
                            b = (b && b[2] || "").trim(),
                            b = this.decodeMimeWords(b, c);
                        return [d, b]
                    },
                    splitEncodedString: function(a, c) {
                        for (var b, d, f, h = []; a.length;) {
                            b = a.substr(0, c);
                            if (d = b.match(/\=[0-9A-F]?$/i)) b = b.substr(0, d.index);
                            for (f = !1; !f;) if (f = !0, d = a.substr(b.length).match(/^\=([0-9A-F]{2})/i)) d = parseInt(d[1], 16), 194 > d && 127 < d &&
                                        (b = b.substr(0, b.length - 3), f = !1);
                            b.length && h.push(b);
                            a = a.substr(b.length)
                        }
                        return h
                    },
                    parseAddresses: d
                }
            }).call(this, g("buffer").Buffer)
        }, {
            addressparser: 82,
            buffer: 3,
            encoding: 58
        }
    ],
    82: [function(g, p, m) {
            var h = {};
            p.exports = function(g) {
                return h.parse(g)
            };
            h.parse = function(g) {
                var k = [],
                    f = [],
                    d = [];
                (new h.Tokenizer(g)).tokenize().forEach(function(a) {
                    "operator" != a.type || "," != a.value && ";" != a.value ? f.push(a) : (f.length && k.push(f), f = [])
                });
                f.length && k.push(f);
                k.forEach(function(a) {
                    a = h._handleAddress(a);
                    a.length && (d = d.concat(a))
                });
                return d
            };
            h._handleAddress = function(g) {
                var k, f = !1,
                    d = "text",
                    a, c = [],
                    b = {
                        address: [],
                        comment: [],
                        group: [],
                        text: []
                    }, l, m;
                l = 0;
                for (m = g.length; l < m; l++) if (k = g[l], "operator" == k.type) switch (k.value) {
                            case "<":
                                d = "address";
                                break;
                            case "(":
                                d = "comment";
                                break;
                            case ":":
                                d = "group";
                                f = !0;
                                break;
                            default:
                                d = "text"
                    } else k.value && b[d].push(k.value);
                    !b.text.length && b.comment.length && (b.text = b.comment, b.comment = []);
                if (f) b.text = b.text.join(" "), c.push({
                        name: b.text || a && a.name,
                        group: b.group.length ? h.parse(b.group.join(",")) : []
                    });
                else {
                    if (!b.address.length &&
                        b.text.length) {
                        for (l = b.text.length - 1; 0 <= l; l--) if (b.text[l].match(/^[^@\s]+@[^@\s]+$/)) {
                                b.address = b.text.splice(l, 1);
                                break
                            }
                        g = function(a) {
                            if (b.address.length) return a;
                            b.address = [a.trim()];
                            return " "
                        };
                        if (!b.address.length) for (l = b.text.length - 1; 0 <= l && (b.text[l] = b.text[l].replace(/\s*\b[^@\s]+@[^@\s]+\b\s*/, g).trim(), !b.address.length); l--);
                    }!b.text.length && b.comment.length && (b.text = b.comment, b.comment = []);
                    1 < b.address.length && (b.text = b.text.concat(b.address.splice(1)));
                    b.text = b.text.join(" ");
                    b.address =
                        b.address.join(" ");
                    if (!b.address && f) return [];
                    a = {
                        address: b.address || b.text || "",
                        name: b.text || b.address || ""
                    };
                    a.address == a.name && ((a.address || "").match(/@/) ? a.name = "" : a.address = "");
                    c.push(a)
                }
                return c
            };
            h.Tokenizer = function(g) {
                this.str = (g || "").toString();
                this.operatorExpecting = this.operatorCurrent = "";
                this.node = null;
                this.escaped = !1;
                this.list = []
            };
            h.Tokenizer.prototype.operators = {
                '"': '"',
                "(": ")",
                "<": ">",
                ",": "",
                ":": ";"
            };
            h.Tokenizer.prototype.tokenize = function() {
                for (var g, h = [], f = 0, d = this.str.length; f < d; f++) g =
                        this.str.charAt(f), this.checkChar(g);
                this.list.forEach(function(a) {
                    a.value = (a.value || "").toString().trim();
                    a.value && h.push(a)
                });
                return h
            };
            h.Tokenizer.prototype.checkChar = function(g) {
                if ((g in this.operators || "\\" == g) && this.escaped) this.escaped = !1;
                else {
                    if (this.operatorExpecting && g == this.operatorExpecting) {
                        this.node = {
                            type: "operator",
                            value: g
                        };
                        this.list.push(this.node);
                        this.node = null;
                        this.operatorExpecting = "";
                        this.escaped = !1;
                        return
                    }
                    if (!this.operatorExpecting && g in this.operators) {
                        this.node = {
                            type: "operator",
                            value: g
                        };
                        this.list.push(this.node);
                        this.node = null;
                        this.operatorExpecting = this.operators[g];
                        this.escaped = !1;
                        return
                    }
                }
                this.escaped || "\\" != g ? (this.node || (this.node = {
                    type: "text",
                    value: ""
                }, this.list.push(this.node)), this.escaped && "\\" != g && (this.node.value += "\\"), this.node.value += g, this.escaped = !1) : this.escaped = !0
            }
        }, {}
    ],
    83: [function(g, p, m) {
            (function(h) {
                var m = g("fs"),
                    k = g("path"),
                    f = function() {
                        if (!(this instanceof f)) return new f
                    };
                f.prototype.encode = function(d, a) {
                    "undefined" === typeof a && (a = {});
                    if ("string" ===
                        typeof d) "undefined" === typeof a.mode ? a.mode = (m.statSync(d).mode & 511).toString(8) : "string" !== typeof a.mode && (a.mode = a.mode.toString(8)), "undefined" === typeof a.filename && (a.filename = k.basename(d));
                    else if (h.isBuffer(d)) "undefined" === typeof a.mode ? a.mode = "644" : "string" !== typeof a.mode && (a.mode = a.mode.toString(8)), "undefined" === typeof a.filename && (a.filename = "buffer.bin");
                    else throw Error(this.errors.UNKNOWN_SOURCE_TYPE);
                    "undefined" === typeof a.eol && (a.eol = "\n");
                    var c = [];
                    c.push("begin ");
                    c.push(a.mode);
                    c.push(" ");
                    c.push(a.filename);
                    c.push(a.eol);
                    for (var b = 0; b < d.length;) {
                        var f, g, n;
                        if (45 <= d.length - b) for (c.push(String.fromCharCode(77)), f = 0; 15 > f; f++) g = 0, g += d.readUInt8(b) << 16, b++, g += d.readUInt8(b) << 8, b++, g += d.readUInt8(b), b++, n = g >>> 18, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g >>> 12 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g >>> 6 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32));
                        else {
                            c.push(String.fromCharCode(d.length - b + 32));
                            var p = (d.length - b) / 3 | 0;
                            for (f = 0; f < p; f++) g = 0, g += d.readUInt8(b) << 16, b++, g += d.readUInt8(b) << 8, b++, g += d.readUInt8(b), b++, n = g >>> 18, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g >>> 12 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g >>> 6 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32));
                            b < d.length && (g = 0, g += d.readUInt8(b) << 16, b++, b < d.length && (g += d.readUInt8(b) << 8, b++), b < d.length && (g += d.readUInt8(b), b++), n = g >>> 18, 0 === n && (n = 64), c.push(String.fromCharCode(n +
                                32)), n = g >>> 12 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g >>> 6 & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)), n = g & 63, 0 === n && (n = 64), c.push(String.fromCharCode(n + 32)))
                        }
                        c.push(a.eol)
                    }
                    c.push("`");
                    c.push(a.eol);
                    c.push("end");
                    return c.join("")
                };
                f.prototype.decodeFile = function(d, a) {
                    var c = [],
                        b = RegExp(["^begin [0-7]{3} " + a + "\n", "((?:[ -`]+\n)*)`\nend$"].join(""), "gm"),
                        f = !0;
                    do {
                        var g = b.exec(d);
                        null === g ? f = !1 : c.push(g)
                    } while (f);
                    if (0 === c.length) return null;
                    var k = null;
                    c.forEach(function(a) {
                        if (null ===
                            k) if (1 > a[1].length) k = new h(0);
                            else {
                                var b = !1;
                                a = a[1].split("\n");
                                a.pop();
                                a = a.map(function(a) {
                                    if (b) return null;
                                    var c = (a.charCodeAt(0) - 32) % 64;
                                    if (0 === c) return new h(0);
                                    var d = 4 * (c / 3 | 0);
                                    0 !== c % 3 && (d += 4);
                                    if (1 + d > a.length) return b = !0, null;
                                    var c = new h(c),
                                        f, g, k = 1,
                                        l = 0;
                                    for (f = 0; f < (d / 4 | 0); f++) g = 0, g += (a.charCodeAt(k) - 32) % 64 << 18, k++, g += (a.charCodeAt(k) - 32) % 64 << 12, k++, g += (a.charCodeAt(k) - 32) % 64 << 6, k++, g += (a.charCodeAt(k) - 32) % 64, k++, c.writeUInt8(g >>> 16, l, !0), l++, c.writeUInt8(g >>> 8, l, !0), l++, c.writeUInt8(g, l, !0), l++;
                                    return c
                                });
                                b || (k = h.concat(a))
                            }
                    });
                    return k
                };
                f.prototype.errors = {
                    UNKNOWN_SOURCE_TYPE: "The source's type is unknown!"
                };
                p.exports = new f
            }).call(this, g("buffer").Buffer)
        }, {
            buffer: 3,
            fs: 1,
            path: 38
        }
    ]
}, {}, [56]);