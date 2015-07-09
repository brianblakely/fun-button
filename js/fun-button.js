/* global PIXI, Polymer */

// Shader rendering.

"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var toCamelCase = function toCamelCase(str, noFirstCap, firstWordCap) {
  str = str.split(/[-_ ]/g);

  if (firstWordCap) {
    str[0] = str[0].toUpperCase();
  }

  return str.map(function (str, dex) {
    return !noFirstCap && dex === 0 || dex > 0 ? str[0].toUpperCase() + str.substr(1) : str;
  }).join("");
};

var Shader = (function () {
  function Shader(src) {
    _classCallCheck(this, Shader);

    this.src = src;
    this.uniforms = Object.assign({}, Shader.standardUniforms);
  }

  _createClass(Shader, [{
    key: "load",

    // Creates filter from shader, loading custom shader code if necessary.
    value: function load() {
      var _this = this;

      return new Promise(function (success, failure) {
        // Keyword shader.
        if (Shader.keywords.has(_this.src)) {
          _this.filter = new PIXI.filters["" + toCamelCase(_this.src) + "Filter"]();

          _this.filter.uniforms = Object.assign(_this.filter.uniforms, Shader.standardUniforms);

          Shader.registry.set(_this.src);

          success(_this);

          return;
        }

        // Custom shader.

        // Already loaded?
        if (Shader.registry.has(_this.src)) {
          _this.createFilter(Shader.registry.get(_this.src));

          success(_this);

          return;
        }

        // Load new custom shader.
        var loader = new PIXI.loaders.Loader();

        loader.add("shader", _this.src);
        loader.once("complete", function (self, resource) {
          _this.createFilter(resource.shader.data);

          Shader.registry.set(_this.src, resource.shader.data);

          success(_this);
        });
        loader.once("error", failure);
        loader.load();
      });
    }
  }, {
    key: "createFilter",

    // Creates filter from custom shader.
    value: function createFilter(shaderData) {
      this.filter = new PIXI.AbstractFilter(null, Shader.standardPrefix + shaderData.replace(/void mainImage\( out vec4 fragColor, in vec2 fragCoord \)/, "void main()").replace(/vUv/g, "vTextureCoord").replace(/fragCoord/g, "vec2(vTextureCoord.x, 1.0 - vTextureCoord.y)").replace(/fragColor =/g, "gl_FragColor =").replace(/fragColor/g, "vColor").replace(/tDiffuse/g, "uSampler").replace(/iChannel0/g, "uSampler"), this.uniforms);
    }
  }, {
    key: "attachTo",

    // Associates shader with button and layer.
    // Returns filter to be applied alongside others in layer.
    value: function attachTo(button, layer) {
      this.button = button;
      this.layer = layer;

      var filter = this.filter;

      filter.padding = this.effectPadding;

      filter.uniforms.iResolution.value[0] = button.width;
      filter.uniforms.iResolution.value[1] = button.height;
      filter.uniforms.iChannelResolution.value[0] = button.width;
      filter.uniforms.iChannelResolution.value[1] = button.height;

      return filter;
    }
  }, {
    key: "start",
    value: function start() {
      var ticker = PIXI.ticker.shared;

      ticker.add(this.tick, this);
    }
  }, {
    key: "tick",
    value: function tick(delta) {
      this.filter.uniforms.time && (this.filter.uniforms.time.value += delta / 1000);
      this.filter.uniforms.iGlobalTime.value += delta / 1000;
      this.filter.uniforms.iChannelTime.value[0] += delta / 1000;

      var d = new Date();
      this.filter.uniforms.iDate.value = [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000];

      this.button.canvas.renderer.render(this.button.canvas.container);
    }
  }, {
    key: "point",
    value: function point(event) {}
  }, {
    key: "stop",
    value: function stop() {
      var ticker = PIXI.ticker.shared;

      ticker.remove(this.tick, this);
    }
  }]);

  return Shader;
})();

Object.defineProperties(Shader, {
  standardPrefix: {
    value: "\n  precision lowp float;\n  uniform sampler2D uSampler;\n  uniform vec3 iResolution;\n  uniform float iGlobalTime;\n  uniform float iChannelTime[4];\n  uniform vec3 iChannelResolution[4];\n  uniform vec4 iMouse;\n  uniform vec4 iDate;\n  uniform float iSampleRate;\n  varying vec2 vTextureCoord;\n  varying vec4 vColor;\n"
    /*`
    `*/
  },
  /*
    Shader Inputs
    uniform vec3      iResolution;           // viewport resolution (in pixels)
    uniform float     iGlobalTime;           // shader playback time (in seconds)
    uniform float     iChannelTime[4];       // channel playback time (in seconds)
    uniform vec3      iChannelResolution[4]; // channel resolution (in pixels)
    uniform vec4      iMouse;                // mouse pixel coords. xy: current (if MLB down), zw: click
    uniform samplerXX iChannel0..3;          // input channel. XX = 2D/Cube
    uniform vec4      iDate;                 // (year, month, day, time in seconds)
    uniform float     iSampleRate;           // sound sample rate (i.e., 44100)
  */
  standardUniforms: {
    value: {
      iResolution: { type: "3f", value: [0, 0, 1] },
      iGlobalTime: { type: "1f", value: 0 },
      iChannelTime: { type: "1fv", value: [0, 0, 0, 0] },
      iChannelResolution: { type: "3fv", value: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      iMouse: { type: "4fv", value: [0, 0, 0, 0] },
      iDate: { type: "4fv", value: [0, 0, 0, 0] },
      iSampleRate: { type: "1f", value: 44100 },

      center: { type: "v2", value: { x: 0.5, y: 0.5 } },
      time: { type: "1f", value: 0 },

      tDiffuse: { type: "t", value: null },
      distortion: { type: "1f", value: 3 },
      distortion2: { type: "1f", value: 5 },
      speed: { type: "1f", value: 0.2 },
      rollSpeed: { type: "1f", value: 0.1 }
    }
  },
  registry: {
    value: new Map()
  },
  keywords: {
    value: new Set(["ascii", "bloom", "blur-dir", "blur", "blur-x", "blur-y", "color-matrix", "color-step", "convolution", "cross-hatch", "displacement", "dot-screen", "drop-shadow", "gray", "invert", "noise", "normal-map", "pixelate", "rgb-split", "sepia", "shockwave", "smart-blur", "tilt-shift-axis", "tilt-shift", "tilt-shift-x", "tilt-shift-y", "twist"])
  }
});
/* global PIXI, Polymer */

// Draw button.

"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var pixiColor = function pixiColor(color) {
  color = color.match(/[0.]{0,}\d+/g);

  return {
    hex: "0x" + ("0" + parseInt(color[0], 10).toString(16)).slice(-2) + ("0" + parseInt(color[1], 10).toString(16)).slice(-2) + ("0" + parseInt(color[2], 10).toString(16)).slice(-2),

    alpha: color[3] || 1
  };
};

var ButtonCanvas = (function () {
  // h = HTML button.
  // s = CSS styles.
  // c = Canvas element.

  function ButtonCanvas(h, s, c) {
    _classCallCheck(this, ButtonCanvas);

    Object.assign(this, { h: h, s: s, c: c });

    this.container = new PIXI.Container();

    this.layers = {
      text: null,
      border: new PIXI.Graphics(),
      background: new PIXI.Container()
    };

    this.draw(h, s, this.layers);

    this.container.mask = this.mask;

    this.container.children = [];

    for (var layer in this.layers) {
      this.container.addChild(this.layers[layer]);
    }

    this.container.children.reverse();

    this.renderer = new PIXI.autoDetectRenderer(h.width, h.height, {
      view: c,
      transparent: true,
      antialias: true,
      resolution: window.devicePixelRatio
    });

    c.style.width = "" + h.width + "px";
    c.style.height = "" + h.height + "px";
    c.style.top = "-" + s["border-width"];
    c.style.left = "-" + s["border-width"];

    h.style.borderColor = "rgba(0,0,0,0)";
    h.style.color = "rgba(0,0,0,0)";
    h.style.background = "none";

    this.renderer.render(this.container);
  }

  _createClass(ButtonCanvas, [{
    key: "draw",
    value: function draw(h, s, l) {
      var _this = this;

      // h = HTML button.
      // s = CSS styles.
      // l = PIXI layers.
      var width = h.width,
          height = h.height,
          bRad = parseInt(s["border-radius"]),
          bCol = pixiColor(s["border-color"]),
          bWid = parseInt(s["border-width"]),
          bgColor = pixiColor(s["background-color"]),
          bgImage = s["background-image"].match(/url\((.*)\)/);

      var rectType = bRad > 0 ? "RoundedRect" : "Rect";

      // Text.
      l.text = new PIXI.Text(h.textContent.trim(), {
        font: "" + s["font-style"] + " " + s["font-weight"] + " " + s["font-size"] + " " + s["font-family"],
        fill: s["color"] // Uses Canvas/CSS color.
      });
      l.text.resolution = window.devicePixelRatio;
      l.text.position.x = width / 2 - l.text.width / 2;
      l.text.position.y = height / 2 - l.text.height / 2;

      // Background.
      var bgRect = new PIXI.Graphics();
      bgRect.beginFill(bgColor.hex, bgColor.alpha);
      bgRect["draw" + rectType](0, 0, width, height, bRad);
      bgRect.endFill();
      l.background.addChild(bgRect);

      if (bgImage) {
        bgImage = bgImage[1];

        var loader = new PIXI.loaders.Loader();
        loader.add("image", bgImage);
        loader.once("complete", function (self, resource) {
          var bgSprite = new PIXI.Sprite(resource.image.texture);

          bgSprite.position.x += bWid;
          bgSprite.position.y += bWid;
          l.background.addChild(bgSprite);

          _this.renderer.render(_this.container);
        });
        loader.load();
      }

      // Border.
      l.border.lineStyle(bWid * 2, bCol.hex, bCol.alpha);
      l.border["draw" + rectType](0, 0, width, height, bRad);

      // Mask.
      var mask = new PIXI.Graphics();
      mask.beginFill(0);
      mask["draw" + rectType](0, 0, width, height, bRad);
      mask.endFill();

      this.mask = mask;
    }
  }]);

  return ButtonCanvas;
})();
/* global PIXI, Polymer, Shader, ButtonCanvas, toCamelCase */

"use strict";

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

var FunButton = Polymer({
  is: "fun-button",
  "extends": "button",

  hostAttributes: {
    role: "button"
  },

  properties: {
    effect: {
      type: String
    },
    downEffect: {
      type: String
    },
    upEffect: {
      type: String
    },
    focusEffect: {
      type: String
    },
    overEffect: {
      type: String
    },
    disabledEffect: {
      type: String
    },
    effectPadding: {
      type: Number
    }
  },

  // Element Lifecycle
  created: function created() {},
  ready: function ready() {
    // `ready` is called after all elements have been configured, but
    // propagates bottom-up. This element's children are ready, but parents
    // are not.
    //
    // This is the point where you should make modifications to the DOM (when
    // necessary), or kick off any processes the element wants to perform.

    this.width = this.offsetWidth;
    this.height = this.offsetHeight;

    this.canvasElement = this.$$("canvas");

    this.canvas = new ButtonCanvas(this, getComputedStyle(this), this.canvasElement);

    // Parse effects.

    this.shaders = {};
    this.garbageShaders = {};

    this.parseEffects();
    this.applyEffect("effect");

    this.stateListeners();
  },
  attached: function attached() {},
  detached: function detached() {},
  attributeChanged: function attributeChanged(name) {
    if (name.includes("effect")) {
      this.parseEffects(toCamelCase(name, true));
    }
  },

  // Element Behavior

  parseEffects: function parseEffects(state) {
    // No argument means parse all effects.
    if (!state) {
      for (var _state in this.properties) {
        this.parseEffects(_state);
      }

      return;
    }

    // Check for blank effects and padding attribute.
    if (this[state] === undefined || state === "effectPadding") {
      return;
    }

    this.garbageShaders[state] = this.shaders[state];

    // Parse effect value and create shaders for each entry.
    this.shaders[state] = {};

    var shaderEntries = this[state].split(/,\s*/);

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = shaderEntries[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var entry = _step.value;

        var shaderArgs = entry.split(/\s+/);

        var src = shaderArgs[0].match(/^(?:url\()?(.*?)\)?$/)[1],
            layer = shaderArgs[1] || "all";

        var shader = new Shader(src);

        this.shaders[state][layer] = this.shaders[state][layer] || [];
        this.shaders[state][layer].push(shader);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator["return"]) {
          _iterator["return"]();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    // Clean up unused layers.
    this.removeEffect(state);
  },

  applyEffect: function applyEffect(state) {
    var _this = this;

    if (!this.shaders[state]) {
      return;
    }

    var _loop = function (layer) {
      Promise.all(_this.shaders[state][layer].map(function (shader) {
        return shader.load();
      })).then(function (shaders) {
        // Wipe existing layer shaders.
        _this.removeEffect(state, layer);

        // Apply all shaders to layer at once.
        var currFilters = _this.canvas.layers[layer].filters,
            addFilters = shaders.map(function (shader) {
          return shader.attachTo(_this, layer);
        });
        if (currFilters) {
          _this.canvas.layers[layer].filters = Array.of.apply(Array, _toConsumableArray(currFilters)).concat(addFilters);
        } else {
          _this.canvas.layers[layer].filters = addFilters;
        }

        _this.shaders[state][layer].forEach(function (shader) {
          return shader.start();
        });
      });
    };

    // Apply effect by layer.
    for (var layer in this.shaders[state]) {
      _loop(layer);
    }
  },

  removeEffect: function removeEffect(state, layer) {
    if (layer in this.shaders[state]) {
      this.shaders[state][layer].forEach(function (shader) {
        return shader.stop();
      });

      //let filter = this.canvas.layers[layer].filters;
      //this.canvas.layers[layer].filters = null;

      return;
    }

    for (var _layer in this.garbageShaders[state]) {
      if (this.shaders[state][_layer]) {
        continue;
      }

      this.garbageShaders[state][_layer].map(function (shader) {
        return shader.stop();
      });
      this.canvas.layers[_layer].filters = null;
      delete this.garbageShaders[state][_layer];
    }
  },

  listeners: {
    down: "downState",
    up: "upState",
    track: "overState"
  },

  stateListeners: function stateListeners() {
    var _this2 = this;

    this.setScrollDirection("all");

    this.addEventListener("mousemove", this.overState);
    this.addEventListener("mouseout", this.outState);

    this.addEventListener("keydown", function (e) {
      if (_this2.isDown) {
        return false;
      }

      if (e.keyCode === 32) {
        _this2.isDown = true;
      }

      _this2.downState();
    });
    this.addEventListener("keyup", function (e) {
      if (e.keyCode !== 32) {
        return false;
      }

      _this2.isDown = false;

      _this2.upState();
    });

    this.addEventListener("focus", this.focusState);
    this.addEventListener("blur", this.blurState);
  },

  downState: function downState(e) {
    this.removeEffect("upEffect");
    this.applyEffect("downEffect");
  },

  upState: function upState(e) {
    this.removeEffect("downEffect");
    this.applyEffect("upEffect");
  },

  focusState: function focusState(e) {
    this.applyEffect("focusEffect");
  },

  blurState: function blurState(e) {
    this.removeEffect("focusEffect");
  },

  overState: function overState(e) {
    if (e.buttons || e.detail && e.detail.hover() !== this.canvasElement) {
      e.preventDefault();
      return false;
    }

    this.applyEffect("overEffect");
  },

  outState: function outState(e) {
    this.removeEffect("overEffect");
  },

  disabledState: function disabledState(e) {
    console.log("disabled!");
  }

});

// `attached` fires once the element and its parents have been inserted
// into a document.
//
// This is a good place to perform any work related to your element's
// visual state or active behavior (measuring sizes, beginning animations,
// loading resources, etc).

// The analog to `attached`, `detached` fires when the element has been
// removed from a document.
//
// Use this to clean up anything you did in `attached`.

//# sourceMappingURL=fun-button.js.map