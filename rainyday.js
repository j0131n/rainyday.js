/**
 * Defines a new instance of the rainyday.js.
 * @param element DOM id of the image element used as background image
 * @param opacity opacity attribute value of the glass canvas (default: 1)
 * @param blur blur radius (default: 10)
 * @param fps desired fps for animation
 * @param speed desired speed for rain drops
 */

function RainyDay(options) {
	this.img = document.getElementById(options.element);
	this.opacity = options.opacity || 1;
	this.blurRadius = options.blur || 10;
	this.w = this.img.clientWidth;
	this.h = this.img.clientHeight;
	this.drops = [];

	// prepare canvas elements
	this.canvas = this.prepareCanvas(this.img, options.autoHide);
	this.prepareBackground(this.w, this.h);
	this.prepareGlass();

	// assume defaults
	this.reflection = this.REFLECTION_MINIATURE;
	this.trail = this.TRAIL_DROPS;
	this.gravity = this.GRAVITY_NON_LINEAR;
	this.collision = this.COLLISION_SIMPLE;
	this.VARIABLE_GRAVITY_THRESHOLD = 3;
	this.VARIABLE_GRAVITY_ANGLE = Math.PI / 2;
	this.VARIABLE_GRAVITY_ANGLE_VARIANCE = 0;
	this.VARIABLE_FPS = options.fps;
	this.VARIABLE_FILL_STYLE = '#8ED6FF';
	this.VARIABLE_COLLISIONS = true;
	this.REFLECTION_SCALEDOWN_FACTOR = 5;
	this.REFLECTION_DROP_MAPPING_WIDTH = 200;
	this.REFLECTION_DROP_MAPPING_HEIGHT = 200;
}

/**
 * Create the main canvas over a given element
 * @param element to place the canvas on top of
 * @param autoHide determined whether to hide the canvas on mouse over
 * @returns the canvas
 */
RainyDay.prototype.prepareCanvas = function(element, autoHide) {
	var canvas = document.createElement('canvas');
	canvas.style.position = 'absolute';
	canvas.width = element.clientWidth;
	canvas.height = element.clientHeight;
	canvas.style.left = element.offsetLeft;
	canvas.style.top = element.offsetTop;
	document.getElementsByTagName('body')[0].appendChild(canvas);

	setInterval((function(self) {
		self.checkSize(canvas, element);
	})(this), 500);

	if (autoHide === true) {
		canvas.onmouseover = function() {
			canvas.style.display = 'none';
		};
		element.onmouseleave = function() {
			canvas.style.display = 'block';
		};
	}
	return canvas;
};

/**
 * Periodically check the size of the underlying element
 * @param canvas the canvas
 * @param element the element below
 */

RainyDay.prototype.checkSize = function(canvas, element) {
	if (canvas.style.width !== element.clientWidth) {
		canvas.style.width = element.clientWidth;
	}
	if (canvas.style.height !== element.clientHeight) {
		canvas.style.height = element.clientHeight;
	}
	if (canvas.style.left !== element.offsetLeft) {
		canvas.style.left = element.offsetLeft;
	}
	if (canvas.style.top !== element.offsetTop) {
		canvas.style.top = element.offsetTop;
	}
};

/**
 * Start animation loop
 */
RainyDay.prototype.animateDrops = function() {
	var raf = window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame;
	if (!raf) {
		raf = function(callback) {
			window.setTimeout(callback, 1000 / this.VARIABLE_FPS);
		};
	}
	if (this.addDropCallback) {
		this.addDropCallback();
	}
	// |this.drops| array may be changed as we iterate over drops
	var dropsClone = this.drops.slice();
	var newDrops = [];
	for (var i = 0; i < dropsClone.length; ++i) {
		if (dropsClone[i].animate()) {
			newDrops.push(dropsClone[i]);
		}
	}
	this.drops = newDrops;
	raf(this.animateDrops.bind(this));
};

/**
 * Create the helper canvas for rendering raindrop reflections.
 */
RainyDay.prototype.prepareReflections = function() {
	// new canvas
	this.reflected = document.createElement('canvas');
	this.reflected.width = this.canvas.width / this.REFLECTION_SCALEDOWN_FACTOR;
	this.reflected.height = this.canvas.height / this.REFLECTION_SCALEDOWN_FACTOR;

	var ctx = this.reflected.getContext('2d');

	ctx.drawImage(this.img, 0, 0, this.reflected.width, this.reflected.height);
};

/**
 * Create the glass canvas and position it directly over the main one.
 */
RainyDay.prototype.prepareGlass = function() {
	this.glass = document.createElement('canvas');
	this.glass.width = this.canvas.width;
	this.glass.height = this.canvas.height;
	this.context = this.glass.getContext('2d');
};

/**
 * Creates a new preset object with given attributes.
 * @param min minimum size of a drop
 * @param base base value for randomizing drop size
 * @param quan probability of selecting this preset (must be between 0 and 1)
 * @returns present object with given attributes
 */
RainyDay.prototype.preset = function(min, base, quan) {
	return {
		'min': min,
		'base': base,
		'quan': quan
	};
};

/**
 * Main function for starting rain rendering.
 * @param presets list of presets to be applied
 * @param speed speed of the animation (if not provided or 0 static image will be generated)
 */
RainyDay.prototype.rain = function(presets, speed) {
	// prepare canvas for drop reflections
	if (this.reflection !== this.REFLECTION_NONE) {
		this.prepareReflections();
	}

	if (speed > 0) {

		this.animateDrops();

		// animation
		this.presets = presets;

		this.PRIVATE_GRAVITY_FORCE_FACTOR_Y = (this.VARIABLE_FPS * 0.001) / 25;
		this.PRIVATE_GRAVITY_FORCE_FACTOR_X = ((Math.PI / 2) - this.VARIABLE_GRAVITY_ANGLE) * (this.VARIABLE_FPS * 0.001) / 50;

		// prepare gravity matrix
		if (this.VARIABLE_COLLISIONS) {

			// calculate max radius of a drop to establish gravity matrix resolution
			var maxDropRadius = 0;
			for (var i = 0; i < presets.length; i++) {
				if (presets[i].base + presets[i].min > maxDropRadius) {
					maxDropRadius = Math.floor(presets[i].base + presets[i].min);
				}
			}

			if (maxDropRadius > 0) {
				// initialize the gravity matrix
				var mwi = Math.ceil(this.w / maxDropRadius);
				var mhi = Math.ceil(this.h / maxDropRadius);
				this.matrix = new CollisionMatrix(mwi, mhi, maxDropRadius);
			} else {
				this.VARIABLE_COLLISIONS = false;
			}
		}
		var lastExecutionTime = 0;
		this.addDropCallback = function() {
			var timestamp = new Date().getTime();
			if (timestamp - lastExecutionTime < speed) {
				return;
			}
			lastExecutionTime = timestamp;
			var context = this.canvas.getContext('2d');
			context.clearRect(0, 0, this.canvas.width, this.canvas.height);
			context.drawImage(this.background, 0, 0, this.canvas.width, this.canvas.height);
			var random = Math.random();
			// select matching preset
			var preset;
			for (var i = 0; i < presets.length; i++) {
				if (random < presets[i].quan) {
					preset = presets[i];
					break;
				}
			}
			if (preset) {
				this.putDrop(new Drop(this, Math.random() * this.w, Math.random() * this.h, preset.min, preset.base));
			}
			context.save();
			context.globalAlpha = this.opacity;
			context.drawImage(this.glass, 0, 0, this.canvas.width, this.canvas.height);
			context.restore();
		}.bind(this);

	} else {
		// static picture
		for (var i = 0; i < presets.length; i++) {
			var preset = presets[i];
			for (var c = 0; c < preset.quan; ++c) {
				this.putDrop(new Drop(this, Math.random() * this.w, Math.random() * this.h, preset.min, preset.base));
			}
		}
	}
};

/**
 * Adds a new raindrop to the animation.
 * @param drop drop object to be added to the animation
 */
RainyDay.prototype.putDrop = function(drop) {
	drop.draw();
	if (this.gravity && drop.r > this.VARIABLE_GRAVITY_THRESHOLD) {
		if (this.VARIABLE_COLLISIONS) {
			// put on the gravity matrix
			this.matrix.update(drop);
		}
		this.drops.push(drop);
	}
};

RainyDay.prototype.clearDrop = function(drop, force) {
	var result = drop.clear(force);
	if (result) {
		var index = this.drops.indexOf(drop);
		if (index >= 0) {
			this.drops.splice(index, 1);
		}
	}
	return result;
};

/**
 * Defines a new raindrop object.
 * @param rainyday reference to the parent object
 * @param centerX x position of the center of this drop
 * @param centerY y position of the center of this drop
 * @param min minimum size of a drop
 * @param base base value for randomizing drop size
 */

function Drop(rainyday, centerX, centerY, min, base) {
	this.x = Math.floor(centerX);
	this.y = Math.floor(centerY);
	this.r = (Math.random() * base) + min;
	this.rainyday = rainyday;
	this.context = rainyday.context;
	this.reflection = rainyday.reflected;
}

/**
 * Draws a raindrop on canvas at the current position.
 */
Drop.prototype.draw = function() {
	this.context.save();
	this.context.beginPath();

	var orgR = this.r;
	this.r = 0.95 * this.r;
	if (this.r < 3) {
		this.context.arc(this.x, this.y, this.r, 0, Math.PI * 2, true);
		this.context.closePath();
	} else if (this.colliding || this.yspeed > 2) {
		if (this.colliding) {
			var collider = this.colliding;
			this.r = 1.001 * (this.r > collider.r ? this.r : collider.r);
			this.x += (collider.x - this.x);
			this.colliding = null;
		}

		var yr = 1 + 0.1 * this.yspeed;
		this.context.moveTo(this.x - this.r / yr, this.y);
		this.context.bezierCurveTo(this.x - this.r, this.y - this.r * 2, this.x + this.r, this.y - this.r * 2, this.x + this.r / yr, this.y);
		this.context.bezierCurveTo(this.x + this.r, this.y + yr * this.r, this.x - this.r, this.y + yr * this.r, this.x - this.r / yr, this.y);
	} else {
		this.context.arc(this.x, this.y, this.r * 0.9, 0, Math.PI * 2, true);
		this.context.closePath();
	}

	this.context.clip();

	this.r = orgR;

	if (this.rainyday.reflection) {
		this.rainyday.reflection(this);
	}

	this.context.restore();
};

/**
 * Clears the raindrop region.
 * @param force force stop
 * @returns true if the animation is stopped
 */
Drop.prototype.clear = function(force) {
	this.context.clearRect(this.x - this.r - 1, this.y - this.r - 2, 2 * this.r + 2, 2 * this.r + 2);
	if (force) {
		// forced
		this.terminate = true;
		return true;
	}
	if (this.y - this.r > this.rainyday.h) {
		// over the bottom edge, stop the thread
		return true;
	}
	if ((this.x - this.r > this.rainyday.w) || (this.x + this.r < 0)) {
		// over the right or left edge, stop the thread
		return true;
	}
	return false;
};

/**
 * Moves the raindrop to a new position according to the gravity.
 */
Drop.prototype.animate = function() {
	if (this.terminate) {
		return false;
	}
	var stopped = this.rainyday.gravity(this);
	if (!stopped && this.rainyday.trail) {
		this.rainyday.trail(this);
	}
	if (this.rainyday.VARIABLE_COLLISIONS) {
		var collisions = this.rainyday.matrix.update(this, stopped);
		if (collisions) {
			this.rainyday.collision(this, collisions);
		}
	}
	return !stopped || this.terminate;
};

/**
 * TRAIL function: no trail at all
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_NONE = function() {
	// nothing going on here
};

/**
 * TRAIL function: trail of small drops (default)
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_DROPS = function(drop) {
	if (!drop.trail_y || drop.y - drop.trail_y >= Math.random() * 100 * drop.r) {
		drop.trail_y = drop.y;
		this.putDrop(new Drop(this, drop.x + (Math.random() * 2 - 1) * Math.random(), drop.y - drop.r - 5, Math.ceil(drop.r / 5), 0));
	}
};

/**
 * TRAIL function: trail of unblurred image
 * @param drop raindrop object
 */
RainyDay.prototype.TRAIL_SMUDGE = function(drop) {
	var y = drop.y - drop.r - 3;
	var x = drop.x - drop.r / 2 + (Math.random() * 2);
	if (y < 0 || x < 0) {
		return;
	}
	this.context.drawImage(this.clearbackground, x, y, drop.r, 2, x, y, drop.r, 2);
};

/**
 * GRAVITY function: no gravity at all
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_NONE = function() {
	return true;
};

/**
 * GRAVITY function: linear gravity
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_LINEAR = function(drop) {
	if (this.clearDrop(drop)) {
		return true;
	}

	if (drop.yspeed) {
		drop.yspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
		drop.xspeed += this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
	} else {
		drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
		drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
	}

	drop.y += drop.yspeed;
	drop.draw();
	return false;
};

/**
 * GRAVITY function: non-linear gravity (default)
 * @param drop raindrop object
 * @returns true if the animation is stopped
 */
RainyDay.prototype.GRAVITY_NON_LINEAR = function(drop) {
	if (this.clearDrop(drop)) {
		return true;
	}

	if (drop.collided) {
		drop.collided = false;
		drop.seed = Math.floor(drop.r * Math.random() * this.VARIABLE_FPS);
		drop.skipping = false;
		drop.slowing = false;
	} else if (!drop.seed || drop.seed < 0) {
		drop.seed = Math.floor(drop.r * Math.random() * this.VARIABLE_FPS);
		drop.skipping = drop.skipping === false ? true : false;
		drop.slowing = true;
	}

	drop.seed--;

	if (drop.yspeed) {
		if (drop.slowing) {
			drop.yspeed /= 1.1;
			drop.xspeed /= 1.1;
			if (drop.yspeed < this.PRIVATE_GRAVITY_FORCE_FACTOR_Y) {
				drop.slowing = false;
			}

		} else if (drop.skipping) {
			drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
			drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
		} else {
			drop.yspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_Y * Math.floor(drop.r);
			drop.xspeed += 1 * this.PRIVATE_GRAVITY_FORCE_FACTOR_X * Math.floor(drop.r);
		}
	} else {
		drop.yspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_Y;
		drop.xspeed = this.PRIVATE_GRAVITY_FORCE_FACTOR_X;
	}

	if (this.VARIABLE_GRAVITY_ANGLE_VARIANCE !== 0) {
		drop.xspeed += ((Math.random() * 2 - 1) * drop.yspeed * this.VARIABLE_GRAVITY_ANGLE_VARIANCE);
	}

	drop.y += drop.yspeed;
	drop.x += drop.xspeed;

	drop.draw();
	return false;
};

/**
 * REFLECTION function: no reflection at all
 * @param drop raindrop object
 */
RainyDay.prototype.REFLECTION_NONE = function() {
	this.context.fillStyle = this.VARIABLE_FILL_STYLE;
	this.context.fill();
};

/**
 * REFLECTION function: miniature reflection (default)
 * @param drop raindrop object
 */
RainyDay.prototype.REFLECTION_MINIATURE = function(drop) {
	// this maps the area of size (REFLECTION_DROP_MAPPING_WIDTH * 2, REFLECTION_DROP_MAPPING_HEIGHT * 2)
	// around point (drop.x, drop.y) into the drop area
	var sx = Math.max((drop.x - this.REFLECTION_DROP_MAPPING_WIDTH) / this.REFLECTION_SCALEDOWN_FACTOR, 0);
	var sy = Math.max((drop.y - this.REFLECTION_DROP_MAPPING_HEIGHT) / this.REFLECTION_SCALEDOWN_FACTOR, 0);
	var sw = Math.min(this.REFLECTION_DROP_MAPPING_WIDTH * 2 / this.REFLECTION_SCALEDOWN_FACTOR, this.reflected.width - sx);
	var sh = Math.min(this.REFLECTION_DROP_MAPPING_HEIGHT * 2 / this.REFLECTION_SCALEDOWN_FACTOR, this.reflected.height - sy);
	this.context.drawImage(this.reflected,
		// coordinates of source image
		sx, sy, sw, sh,
		// destination
		drop.x - 1.1 * drop.r,
		drop.y - 1.1 * drop.r,
		drop.r * 2,
		drop.r * 2);
};

/**
 * COLLISION function: default collision implementation
 * @param drop one of the drops colliding
 * @param colllisions list of potential collisions
 */
RainyDay.prototype.COLLISION_SIMPLE = function(drop, collisions) {
	var item = collisions;
	var drop2;
	while (item != null) {
		var p = item.drop;
		if (Math.sqrt(Math.pow(drop.x - p.x, 2) + Math.pow(drop.y - p.y, 2)) < (drop.r + p.r)) {
			drop2 = p;
			break;
		}
		item = item.next;
	}

	if (!drop2) {
		return;
	}

	// rename so that we're dealing with low/high drops
	var higher, lower;
	if (drop.y > drop2.y) {
		higher = drop;
		lower = drop2;
	} else {
		higher = drop2;
		lower = drop;
	}

	this.clearDrop(lower);
	// force stopping the second drop
	this.clearDrop(higher, true);
	this.matrix.remove(higher);
	lower.draw();

	lower.colliding = higher;
	lower.collided = true;
};

/**
 * Resizes canvas, draws original image and applies bluring algorithm.
 * @param width width of the canvas
 * @param height height of the canvas
 */
RainyDay.prototype.prepareBackground = function(width, height) {
	if (width && height) {
		this.canvas.style.width = width + 'px';
		this.canvas.style.height = height + 'px';
		this.canvas.width = width;
		this.canvas.height = height;
	} else {
		width = this.canvas.width;
		height = this.canvas.height;
	}

	this.background = document.createElement('canvas');
	this.background.width = this.canvas.width;
	this.background.height = this.canvas.height;

	this.clearbackground = document.createElement('canvas');
	this.clearbackground.width = this.canvas.width;
	this.clearbackground.height = this.canvas.height;

	var context = this.background.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.drawImage(this.img, 0, 0, width, height);

	context = this.clearbackground.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.drawImage(this.img, 0, 0, width, height);

	if (isNaN(this.blurRadius) || this.blurRadius < 1) {
		return;
	}

	this.stackBlurCanvasRGB(width, height, this.blurRadius);
};

/**
 * Implements the Stack Blur Algorithm (@see http://www.quasimondo.com/StackBlurForCanvas/StackBlurDemo.html).
 * @param width width of the canvas
 * @param height height of the canvas
 * @param radius blur radius
 */
RainyDay.prototype.stackBlurCanvasRGB = function(width, height, radius) {
	
	var shg_table = [
		[0, 9], [1, 11], [2, 12], [3, 13], [5, 14], [7, 15], [11, 16], [15, 17], [22, 18],
		[31, 19], [45, 20], [63, 21], [90, 22], [127, 23], [181, 24]
	];

	var mul_table = [
		512, 512, 456, 512, 328, 456, 335, 512, 405, 328, 271, 456, 388, 335, 292, 512,
		454, 405, 364, 328, 298, 271, 496, 456, 420, 388, 360, 335, 312, 292, 273, 512,
		482, 454, 428, 405, 383, 364, 345, 328, 312, 298, 284, 271, 259, 496, 475, 456,
		437, 420, 404, 388, 374, 360, 347, 335, 323, 312, 302, 292, 282, 273, 265, 512,
		497, 482, 468, 454, 441, 428, 417, 405, 394, 383, 373, 364, 354, 345, 337, 328,
		320, 312, 305, 298, 291, 284, 278, 271, 265, 259, 507, 496, 485, 475, 465, 456,
		446, 437, 428, 420, 412, 404, 396, 388, 381, 374, 367, 360, 354, 347, 341, 335,
		329, 323, 318, 312, 307, 302, 297, 292, 287, 282, 278, 273, 269, 265, 261, 512,
		505, 497, 489, 482, 475, 468, 461, 454, 447, 441, 435, 428, 422, 417, 411, 405,
		399, 394, 389, 383, 378, 373, 368, 364, 359, 354, 350, 345, 341, 337, 332, 328,
		324, 320, 316, 312, 309, 305, 301, 298, 294, 291, 287, 284, 281, 278, 274, 271,
		268, 265, 262, 259, 257, 507, 501, 496, 491, 485, 480, 475, 470, 465, 460, 456,
		451, 446, 442, 437, 433, 428, 424, 420, 416, 412, 408, 404, 400, 396, 392, 388,
		385, 381, 377, 374, 370, 367, 363, 360, 357, 354, 350, 347, 344, 341, 338, 335,
		332, 329, 326, 323, 320, 318, 315, 312, 310, 307, 304, 302, 299, 297, 294, 292,
		289, 287, 285, 282, 280, 278, 275, 273, 271, 269, 267, 265, 263, 261, 259
	];

	radius |= 0;

	var context = this.background.getContext('2d');
	var imageData = context.getImageData(0, 0, width, height);
	var pixels = imageData.data;
	var x, y, i, p, yp, yi, yw, r_sum, g_sum, b_sum,
		r_out_sum, g_out_sum, b_out_sum,
		r_in_sum, g_in_sum, b_in_sum,
		pr, pg, pb, rbs;
	var radiusPlus1 = radius + 1;
	var sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2;

	var stackStart = new BlurStack();
	var stackEnd = new BlurStack();
	var stack = stackStart;
	for (i = 1; i < 2 * radius + 1; i++) {
		stack = stack.next = new BlurStack();
		if (i === radiusPlus1) {
			stackEnd = stack;
		}
	}
	stack.next = stackStart;
	var stackIn = null;
	var stackOut = null;

	yw = yi = 0;

	var mul_sum = mul_table[radius];
	var shg_sum;
	for (var ssi = 0; ssi < shg_table.length; ++ssi) {
		if (radius <= shg_table[ssi][0]) {
			shg_sum = shg_table[ssi - 1][1];
			break;
		}
	}
	
	for (y = 0; y < height; y++) {
		r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;

		r_out_sum = radiusPlus1 * (pr = pixels[yi]);
		g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
		b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);

		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;

		stack = stackStart;

		for (i = 0; i < radiusPlus1; i++) {
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack = stack.next;
		}

		for (i = 1; i < radiusPlus1; i++) {
			p = yi + ((width - 1 < i ? width - 1 : i) << 2);
			r_sum += (stack.r = (pr = pixels[p])) * (rbs = radiusPlus1 - i);
			g_sum += (stack.g = (pg = pixels[p + 1])) * rbs;
			b_sum += (stack.b = (pb = pixels[p + 2])) * rbs;

			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;

			stack = stack.next;
		}

		stackIn = stackStart;
		stackOut = stackEnd;
		for (x = 0; x < width; x++) {
			pixels[yi] = (r_sum * mul_sum) >> shg_sum;
			pixels[yi + 1] = (g_sum * mul_sum) >> shg_sum;
			pixels[yi + 2] = (b_sum * mul_sum) >> shg_sum;

			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;

			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;

			p = (yw + ((p = x + radius + 1) < (width - 1) ? p : (width - 1))) << 2;

			r_in_sum += (stackIn.r = pixels[p]);
			g_in_sum += (stackIn.g = pixels[p + 1]);
			b_in_sum += (stackIn.b = pixels[p + 2]);

			r_sum += r_in_sum;
			g_sum += g_in_sum;
			b_sum += b_in_sum;

			stackIn = stackIn.next;

			r_out_sum += (pr = stackOut.r);
			g_out_sum += (pg = stackOut.g);
			b_out_sum += (pb = stackOut.b);

			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;

			stackOut = stackOut.next;

			yi += 4;
		}
		yw += width;
	}


	for (x = 0; x < width; x++) {
		g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;

		yi = x << 2;
		r_out_sum = radiusPlus1 * (pr = pixels[yi]);
		g_out_sum = radiusPlus1 * (pg = pixels[yi + 1]);
		b_out_sum = radiusPlus1 * (pb = pixels[yi + 2]);

		r_sum += sumFactor * pr;
		g_sum += sumFactor * pg;
		b_sum += sumFactor * pb;

		stack = stackStart;

		for (i = 0; i < radiusPlus1; i++) {
			stack.r = pr;
			stack.g = pg;
			stack.b = pb;
			stack = stack.next;
		}

		yp = width;

		for (i = 1; i < radiusPlus1; i++) {
			yi = (yp + x) << 2;

			r_sum += (stack.r = (pr = pixels[yi])) * (rbs = radiusPlus1 - i);
			g_sum += (stack.g = (pg = pixels[yi + 1])) * rbs;
			b_sum += (stack.b = (pb = pixels[yi + 2])) * rbs;

			r_in_sum += pr;
			g_in_sum += pg;
			b_in_sum += pb;

			stack = stack.next;

			if (i < (height - 1)) {
				yp += width;
			}
		}

		yi = x;
		stackIn = stackStart;
		stackOut = stackEnd;
		for (y = 0; y < height; y++) {
			p = yi << 2;
			pixels[p] = (r_sum * mul_sum) >> shg_sum;
			pixels[p + 1] = (g_sum * mul_sum) >> shg_sum;
			pixels[p + 2] = (b_sum * mul_sum) >> shg_sum;

			r_sum -= r_out_sum;
			g_sum -= g_out_sum;
			b_sum -= b_out_sum;

			r_out_sum -= stackIn.r;
			g_out_sum -= stackIn.g;
			b_out_sum -= stackIn.b;

			p = (x + (((p = y + radiusPlus1) < (height - 1) ? p : (height - 1)) * width)) << 2;

			r_sum += (r_in_sum += (stackIn.r = pixels[p]));
			g_sum += (g_in_sum += (stackIn.g = pixels[p + 1]));
			b_sum += (b_in_sum += (stackIn.b = pixels[p + 2]));

			stackIn = stackIn.next;

			r_out_sum += (pr = stackOut.r);
			g_out_sum += (pg = stackOut.g);
			b_out_sum += (pb = stackOut.b);

			r_in_sum -= pr;
			g_in_sum -= pg;
			b_in_sum -= pb;

			stackOut = stackOut.next;

			yi += width;
		}
	}

	context.putImageData(imageData, 0, 0);

};

/**
 * Defines a new helper object for Stack Blur Algorithm.
 */

function BlurStack() {
	this.r = 0;
	this.g = 0;
	this.b = 0;
	this.next = null;
}

/**
 * Defines a gravity matrix object which handles collision detection.
 * @param x number of columns in the matrix
 * @param y number of rows in the matrix
 * @param r grid size
 */

function CollisionMatrix(x, y, r) {
	this.resolution = r;
	this.xc = x;
	this.yc = y;
	this.matrix = new Array(x);
	for (var i = 0; i <= (x + 5); i++) {
		this.matrix[i] = new Array(y);
		for (var j = 0; j <= (y + 5); ++j) {
			this.matrix[i][j] = new DropItem(null);
		}
	}
}

/**
 * Updates position of the given drop on the collision matrix.
 * @param drop raindrop to be positioned/repositioned
 * @forceDelete if true the raindrop will be removed from the matrix
 * @returns collisions if any
 */
CollisionMatrix.prototype.update = function(drop, forceDelete) {
	if (drop.gid) {
		this.matrix[drop.gmx][drop.gmy].remove(drop);
		if (forceDelete) {
			return null;
		}

		drop.gmx = Math.floor(drop.x / this.resolution);
		drop.gmy = Math.floor(drop.y / this.resolution);
		if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
			return null;
		}
		this.matrix[drop.gmx][drop.gmy].add(drop);

		var collisions = this.collisions(drop);
		if (collisions && collisions.next != null) {
			return collisions.next;
		}
	} else {
		drop.gid = Math.random().toString(36).substr(2, 9);
		drop.gmx = Math.floor(drop.x / this.resolution);
		drop.gmy = Math.floor(drop.y / this.resolution);
		if (!this.matrix[drop.gmx] || !this.matrix[drop.gmx][drop.gmy]) {
			return null;
		}

		this.matrix[drop.gmx][drop.gmy].add(drop);
	}
	return null;
};

/**
 * Looks for collisions with the given raindrop.
 * @param drop raindrop to be checked
 * @returns list of drops that collide with it
 */
CollisionMatrix.prototype.collisions = function(drop) {
	var item = new DropItem(null);
	var first = item;

	item = this.addAll(item, drop.gmx - 1, drop.gmy + 1);
	item = this.addAll(item, drop.gmx, drop.gmy + 1);
	item = this.addAll(item, drop.gmx + 1, drop.gmy + 1);

	return first;
};

/**
 * Appends all found drop at a given location to the given item.
 * @param to item to which the results will be appended to
 * @param x x position in the matrix
 * @param y y position in the matrix
 * @returns last discovered item on the list
 */
CollisionMatrix.prototype.addAll = function(to, x, y) {
	if (x > 0 && y > 0 && x < this.xc && y < this.yc) {
		var items = this.matrix[x][y];
		while (items.next != null) {
			items = items.next;
			to.next = new DropItem(items.drop);
			to = to.next;
		}
	}
	return to;
};

/**
 * Removed the drop from its current position
 * @param drop to be removed
 */
CollisionMatrix.prototype.remove = function(drop) {
	this.matrix[drop.gmx][drop.gmy].remove(drop);
};

/**
 * Defines a linked list item.
 */

function DropItem(drop) {
	this.drop = drop;
	this.next = null;
}

/**
 * Adds the raindrop to the end of the list.
 * @param drop raindrop to be added
 */
DropItem.prototype.add = function(drop) {
	var item = this;
	while (item.next != null) {
		item = item.next;
	}
	item.next = new DropItem(drop);
};

/**
 * Removes the raindrop from the list.
 * @param drop raindrop to be removed
 */
DropItem.prototype.remove = function(drop) {
	var item = this;
	var prevItem = null;
	while (item.next != null) {
		prevItem = item;
		item = item.next;
		if (item.drop.gid === drop.gid) {
			prevItem.next = item.next;
		}
	}
};