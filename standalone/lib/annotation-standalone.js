/*
	2019-03-23. LM.
	2020-01-16. Last modified.
*/

// Pointers.
var jobs = [];
var layer;
var ticker;
var message;

// State.
var animate = false;
var jobId = 0;
var shift = false;
var submissionId = 0;
var disabled = false;
var timestampStart;
var timestampEnd;

// Configuration.
const imageExtension = ".png";
const canvasHeight = 300;
const vertexRadius = 3;
const nVertices = 30;
const keys = {option:16, previous:37, next:39};
const taskName = "vessel-annotation";
const vertexColor = "#FFFF00";
var concavity = 0;
var concaveLengthThreshold = 0.15 * canvasHeight;
var polygonRadius = 0.1 * canvasHeight;
var toolRadius = 0.2 * canvasHeight;
var isTurk;
var nJobs = 0;
var task;

$(document)
	.keydown(
		function(event) {
			switch (event.keyCode) {
				case keys.option:
					shift = true;
					break;
				case keys.previous:
					previous();
					break;
				case keys.next:
					next();
					break;
			}
		}
	)
	.keyup(
		function(event) {
			switch (event.keyCode) {
				case keys.option:
					shift = false;
					break;
			}
		}
	);

function showError(text, duration = 0) {
	message.css("background-color", "#f44336");
	setMessage(text, duration);
}

function showMessage(text, duration = 0) {
	message.css("background-color", "#2196F3");
	setMessage(text, duration);
}

function setMessage(text, duration = 0) {
	if (ticker != undefined)
		clearInterval(ticker);
	message.text(text);
	if (duration > 0) {
		ticker = setTimeout(
			function() {
				message.text("");
				message.css("visibility", "hidden");
			}, 1000 * duration
		);
	}
	message.css("visibility", message.text() == "" ? "hidden" : "visible");
}

// Layer: GUI components except image, wrapper to some test methods.
function Layer() {
	// Pointers.
	this.container = null;
	this.canvas = null;
	this.context = null;
	this.editor = null;
	this.polygon = null;
	this.tool = null;
	this.vertices = [];
	this.activeVertex = null;
	this.pointerClicked = false;
	this.vertexSelected = false;
	this.animate = true;
	this.job = null;
	
	// State.
	this.animate = true;
	
	// Data.
	this.height = canvasHeight;
	this.width = 0;
	
	var container = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
	var canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
	var context = canvas.getContext("2d");
	var editor = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
	var tool = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
	document.body.appendChild(container);
	container.setAttribute("class", "container");
	container.appendChild(canvas);
	container.appendChild(editor);
	editor.appendChild(polygon);
	editor.appendChild(tool);
	
	container.style.cssText = "position: relative;";
	editor.style.cssText = "position:absolute; left:0px; top:0px; z-index:+2;";
	polygon.setAttribute("stroke-width", 0);
	polygon.setAttribute("fill", "#0000FF");
	polygon.setAttribute("fill-opacity", 0.25);
	tool.setAttribute("cx", this.height / 2);
	tool.setAttribute("cy", this.height / 2);
	tool.setAttribute("rx", toolRadius);
	tool.setAttribute("ry", toolRadius);
	tool.setAttribute("stroke", "#FFFFFF");
	tool.setAttribute("stroke-width", 1);
	tool.setAttribute("fill", "#FFFFFF");
	tool.setAttribute("fill-opacity", 0);
	
	container.layer = this;
	container.addEventListener("mouseleave", hideTool);
	container.addEventListener("touchleave", hideTool);
	container.addEventListener("mouseenter", showTool);
	container.addEventListener("touchenter", showTool);
	
	var vertices = [];
	for (var i = 0; i < nVertices; i++) {
		var vertex = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
		vertex.setAttribute("class", "annotation");
		vertex.setAttribute("data-index", i);
		vertex.setAttribute("rx", vertexRadius);
		vertex.setAttribute("ry", vertexRadius);
		vertex.setAttribute("stroke-width", 0);
		vertex.setAttribute("fill", vertexColor);
		vertex.setAttribute("fill-opacity", 0.85);
		vertices.push(vertex);
		editor.appendChild(vertex);
	}
	
	editor.layer = this;
	editor.addEventListener("mousedown", pointerDown);
	editor.addEventListener("mousemove", pointerMove);
	editor.addEventListener("mouseup", pointerCancel);
	editor.addEventListener("mouseleave", pointerCancel);
	editor.addEventListener("touchstart", pointerDown);
	editor.addEventListener("touchmove", pointerMove);
	editor.addEventListener("touchend", pointerCancel);
	editor.addEventListener("touchleave", pointerCancel);
	editor.addEventListener("touchcancel", pointerCancel);
	
	this.container = container;
	this.canvas = canvas;
	this.context = context;
	this.editor = editor;
	this.polygon = polygon;
	this.tool = tool;
	this.vertices = vertices;
	
	this.setImage = function(image) {
		const layer = this;
		layer.width = image.width / image.height * layer.height;
		layer.canvas.setAttribute("width", layer.width);
		layer.canvas.setAttribute("height", layer.height);
		layer.editor.setAttribute("width", layer.width);
		layer.editor.setAttribute("height", layer.height);
		$(layer.container).css("width", layer.width);
		$(layer.container).css("height", layer.height);
		layer.context.drawImage(image, 0, 0, layer.width, layer.height);
	}
	
	this.setJob = function (job) {
		const layer = this;
		layer.job = job;
		for (var i = 0; i < nVertices; i++) {
			layer.vertices[i].setAttribute("cx", job.vertexPoints[i][0]);
			layer.vertices[i].setAttribute("cy", job.vertexPoints[i][1]);
		}
		recalculate(layer);
		layer.setImage(job.image);
	}
	
	this.showVertices = function(show) {
		const layer = this;
		for (var i = 0; i < nVertices; i++)
			layer.vertices[i].setAttribute("visibility", show ? "visible" : "hidden");
	}
}

// Job: job states, loaded image, test methods.
function Job(file, name, onLoad) {
	// Pointers.
	this.image = new Image();
	this.reader = new FileReader();
	
	// State.
	this.name = name;
	
	// Data.
	this.vertexMoved = [];
	this.vertexPoints = [];
	this.polygonPoints = [];
	this.image.job = this;
	this.reader.job = this;
	this.data = "";
	
	this.reader.onload = function (event) {
		const reader = this;
		const job = reader.job;
		const image = job.image;
		
		image.onload = function() {
			const image = this;
			const job = image.job;
			job.height = image.height;
			job.width = image.width;
			job.resetVertices();
			onLoad(image.job);
		}
		image.src = reader.result;
	}
	this.reader.readAsDataURL(file);
	
	this.getMoved = function() {
		const job = this;
		var valid = true;
		for (var id = 0; id < nVertices && valid; id++) {
			if (!job.vertexMoved[id])
				valid = false;
		}
		return valid;
	}
	
	this.getArea = function() {
		const job = this;
		const nPoints = job.polygonPoints.length;
		var area = 0;
		for (var i = 0; i < nPoints; i++) {
			var j = i + 1 == nPoints ? 0 : i + 1;
			var x0 = job.polygonPoints[i][0];
			var y0 = job.polygonPoints[i][1];
			var x1 = job.polygonPoints[j][0];
			var y1 = job.polygonPoints[j][1];
			area += 0.5 * (x0 - x1) * (y0 + y1);
		}
		return Math.abs(area);
	}
	
	this.resetVertices = function() {
		const job = this;
		var angle = 0; 
		var angleStep = 2 * Math.PI / nVertices;
		for (var i = 0; i < nVertices; i++) {
			var cx = polygonRadius * Math.cos(angle) + job.height / 2;
			var cy = polygonRadius * Math.sin(angle) + job.height / 2;
			angle += angleStep;
			job.vertexMoved[i] = false;
			job.vertexPoints[i] = [cx, cy];
		}
	}
	
	this.setData = function() {
		const job = this;
		job.data = 
			{
				folder: task.folder,
				name: job.name,
				area: job.getArea().round(0.1),
				vertices: job.vertexPoints.permute().round(0.1),
				polygon: job.polygonPoints.permute().round(0.1),
				height: canvasHeight,
				assignmentId: task.assignmentId,
				hitId: task.hitId,
				workerId: task.workerId
			}
	}
}

var nLoadedJobs = 0;
function onLoad(job) {
	nLoadedJobs += 1;
	if (nLoadedJobs == nJobs) {
		layer.setJob(jobs[0]);
		$("information").text("");
		$("#previous").attr("disabled", false);
		$("#next").attr("disabled", false);
		showMessage("Done.", 0.010);
		animate = true;
		frame();
	} else {
		showMessage("Please wait. Loading " + nLoadedJobs + " of " + nJobs);
	}
	job.resetVertices();
}

function recalculate(layer) {
	const job = layer.job;
	job.polygonPoints = concaveman(job.vertexPoints, concavity, concaveLengthThreshold);
	job.animate = true;
	animate = true;
}

function frame() {
	requestAnimationFrame(frame);
	if (animate) {
		animate = false;
		for (var i = 0; i < nJobs; i++) {
			var job = jobs[i];
			if (job.animate) {
				job.animate = false;
				var text = "";
				for (var point of job.polygonPoints)
					text += point[0] + "," + point[1] + " ";
				layer.polygon.setAttribute("points", text);
			}
		}
	}
}

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

Number.prototype.countDecimals = function () {
	return (this % 1) == 0 ? 0 : this.toString().split(".")[1].length;
}

Number.prototype.round = function (resolution) {
	return parseFloat((Math.round(this / resolution) * resolution).toFixed(resolution.countDecimals()));
}

Array.prototype.round = function(resolution) {
	var output = new Array(this.length);
	for (var i = 0; i < output.length; i++)
		output[i] = this[i].round(resolution);
	return output;
}

Array.prototype.permute = function() {
	var nOuter = this.length;
	var nInner = this[0].length;
	var output = new Array(nInner);
	for (var i = 0; i < nInner; i++) {
		output[i] = new Array(nOuter);
		for (var o = 0; o < nOuter; o++)
			output[i][o] = this[o][i];
	}
	return output;
}

URLSearchParams.prototype.getDefault = function(key, alternative = undefined) {
	var val = this.get(key);
	return val == undefined ? alternative : val;
}

function preventMouseScroll(element) {
	if (element.addEventListener) {
		// IE9, Chrome, Safari, Opera
		element.addEventListener("mousewheel", preventDefault, {"passive": false});
		// Firefox
		element.addEventListener("DOMMouseScroll", preventDefault, {"passive": false});
	} else {
		// IE 6/7/8
		element.attachEvent("onmousewheel", preventDefault);
	}
}

function preventDefault(e) {
	e = e || window.event;
	e.preventDefault();
	e.stopPropagation();
	e.returnValue = false;
	return false;
}

function timestamp() {
	const date = new Date();
	return date.getUTCFullYear() + (date.getUTCMonth() + 1).pad(2) + date.getUTCDate().pad(2) + date.getUTCHours().pad(2) + date.getUTCMinutes().pad(2) + date.getUTCSeconds().pad(2) + date.getUTCMilliseconds().pad(3);
}

function selectFolder(e) {
    var files = e.target.files;
	for (var i = 0; i < files.length; i++) {
		var file = files[i];
		var imageName = file.name;
		file.valid = imageName.match(/\.(?:jpg|jpeg|png|gif)$/i) != null;
		nJobs += 1;
	}
	
	if (nJobs > 0) {
		$("#fileUpload").hide();
		const urlParams = new URLSearchParams(window.location.search);
		timestampStart = timestamp();
		var assignmentId = urlParams.getDefault("assignmentId");
		if (assignmentId == undefined) {
			isTurk = false;
			assignmentId = timestampStart;
		} else {
			isTurk = true;
		}
		var relativePath = files[0].webkitRelativePath;
		var folder = relativePath.split("/");
		folder = folder[folder.length - 2];
		task = {
			taskName: taskName,
			folder: folder,
			assignmentId: assignmentId,
			hitId: urlParams.getDefault("hitId", "unavailable"),
			workerId: urlParams.getDefault("workerId", "unavailable")
		};
		
		layer = new Layer();
		var mainDiv = document.getElementById("mainDiv");
		mainDiv.appendChild(layer.container);
		
		for (var i = 0; i < files.length; i++) {
			var file = files[i];
			var imageName = file.name;
			if (file.valid) {
				var job = new Job(file, imageName, onLoad);
				jobs.push(job);
			}
		}
	} else {
		showError("Select a folder or a group of images.", 2);
	}
}

$(document).ready(
	function () {
		message = $("#message");
		$("#previous").attr("disabled", true);
		$("#next").attr("disabled", true);
		$("#submit").attr("disabled", true);
		
		var mainDiv = document.getElementById("mainDiv");
		preventMouseScroll(mainDiv);
		
		$(".container").bind("wheel",
			function(e){
				if (disabled)
					return;
					toolRadius *= Math.sign(e.originalEvent.deltaY) < 0 ? 1.1 : 0.9;
					toolRadius = Math.min(75, Math.max(10, toolRadius));
					layer.tool.setAttribute("rx", toolRadius);
					layer.tool.setAttribute("ry", toolRadius);
			}
		);
		
		$("#previous").click(previous);
		$("#next").click(next);
		
		$("#submit").click(
			function() {
				timestampEnd = timestamp();
				disabled = true;
				submit();
			}
		);
	}
);

function previous() {
	if (disabled)
		return;
	if (jobId > 0) {
		const job = jobs[jobId];
		job.setData();
		jobId -= 1;
		layer.setJob(jobs[jobId]);
		showMessage("Image " + (jobId + 1).pad(3) + " of " + nJobs.pad(3), 0.5);
	}
}

function next() {
	if (disabled)
		return;
	const job = jobs[jobId];
	if (!job.getMoved()) {
		$("#submit").attr("disabled", true);
		showError("Please complete current image first.", 2);
	} else if (jobId + 1 == nJobs) {
		job.setData();
		$("#submit").attr("disabled", false);
		showMessage("Please click submit when ready.");
	} else if (jobId + 1 < nJobs) {
		job.setData();
		jobId += 1;
		layer.setJob(jobs[jobId]);
		showMessage("Image " + (jobId + 1).pad(3) + " of " + nJobs.pad(3), 0.5);
	}
}

function submit() {
	$("#previous").attr("disabled", true);
	$("#next").attr("disabled", true);
	$("#submit").attr("disabled", true);
				
	var text = "";
	for (var i = 0; i < nJobs; i++) {
		var data = jobs[i].data;
		data.start = timestampStart;
		data.end = timestampEnd;
		text += JSON.stringify(data) + "\n";
	}
	const filename = task.folder + ".json";
	download(filename, text);
	showMessage("Done!");
}

function download(filename, text) {
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);
	element.style.display = 'none';
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

function getMousePosition(evt) {
	var CTM = evt.currentTarget.getScreenCTM();
	if (evt.touches) {
		evt = evt.touches[0];
	}
	return {
		x: (evt.clientX - CTM.e) / CTM.a,
		y: (evt.clientY - CTM.f) / CTM.d
	};
}

function pointerDown(evt) {
	if (disabled)
		return;
	const editor = evt.currentTarget;
	const layer = editor.layer;
	const job = editor.layer.job;
	if (evt.button === 0) {
		layer.pointerClicked = true;
		var isTarget = layer.vertices.includes(evt.target);
		if (shift || !isTarget) {
			layer.tool.setAttribute("stroke", "#0000FF");
			layer.tool.setAttribute("stroke-width", 3);
			if (pushVertices(layer, shift)) {
				recalculate(layer);
			}
		} else if (isTarget) {
			layer.vertexSelected = true;
			layer.activeVertex = evt.target;
		}
	} else {
		$("#submit").attr("disabled", true);
		setMessage("");
		job.resetVertices();
		layer.setJob(job);
	}
}

function pointerMove(evt) {
	if (disabled)
		return;
	evt.preventDefault();
	const editor = evt.currentTarget;
	const layer = editor.layer;
	const job = layer.job;
	var pos = getMousePosition(evt);
	layer.tool.setAttribute("cx", pos.x);
	layer.tool.setAttribute("cy", pos.y);
	var changed = false;
	
	if (layer.vertexSelected) {
		var id = parseInt(layer.activeVertex.getAttribute("data-index"));
		job.vertexPoints[id] = [pos.x, pos.y];
		job.vertexMoved[id] = true;
		layer.activeVertex.setAttribute("cx", pos.x);
		layer.activeVertex.setAttribute("cy", pos.y);
		changed = true;
	} else if (layer.pointerClicked) {
		changed = pushVertices(layer, shift);
	}
	if (changed) {
		recalculate(layer);
	}
}

function pointerCancel(evt) {
	if (disabled)
		return;
	var editor = evt.currentTarget;
	const layer = editor.layer;
	const job = layer.job;
	layer.pointerClicked = false;
	layer.tool.setAttribute("stroke", "#FFFFFF");
	layer.tool.setAttribute("stroke-width", 1);
	layer.vertexSelected = false;
	cx0 = null;
	cy0 = null;
}

function hideTool(evt) {
	if (disabled)
		return;
	var container = evt.currentTarget;
	var layer = container.layer;
	var tool = layer.tool;
	tool.setAttribute("visibility", "hidden");
	layer.showVertices(false);
}

function showTool(evt) {
	if (disabled)
		return;
	var container = evt.currentTarget;
	var layer = container.layer;
	var tool = layer.tool;
	tool.setAttribute("visibility", "visible");
	layer.showVertices(true);
}

var cx0 = null;
var cy0 = null;
function pushVertices(layer, mode) {
	if (disabled)
		return;
	const job = layer.job;
	var changed = false;
	var cx = parseFloat(layer.tool.getAttribute("cx"));
	var cy = parseFloat(layer.tool.getAttribute("cy"));
	if (mode) {
		if (cx0 != null && !(cx0 == cx && cy0 == cy)) {
			var dx = cx - cx0;
			var dy = cy - cy0;
			$.each(layer.vertices,
				function(id, vertex) {
					var x1 = job.vertexPoints[id][0];
					var y1 = job.vertexPoints[id][1];
					var dx1 = x1 - cx;
					var dy1 = y1 - cy;
					if (Math.abs(dx1) < 0.85 * toolRadius && Math.abs(dy1) < 0.85 * toolRadius) {
						var x2 = Math.min(layer.width, Math.max(0, x1 + dx));
						var y2 = Math.min(layer.height, Math.max(0, y1 + dy));
						job.vertexPoints[id] = [x2, y2];
						job.vertexMoved[id] = true;
						vertex.setAttribute("cx", x2);
						vertex.setAttribute("cy", y2);
						changed = true;
					}
				}
			);
		}
	} else {
		$.each(layer.vertices,
			function(id, vertex) {
				var x1 = job.vertexPoints[id][0];
				var y1 = job.vertexPoints[id][1];
				var dx1 = x1 - cx;
				var dy1 = y1 - cy;
				if (Math.abs(dx1) < 1 * toolRadius && Math.abs(dy1) < 1 * toolRadius) {
					var angle = Math.atan2(dy1, dx1);
					var x2 = Math.min(layer.width, Math.max(0, cx + toolRadius * Math.cos(angle)));
					var y2 = Math.min(layer.height, Math.max(0, cy + toolRadius * Math.sin(angle)));
					var dx2 = x2 - cx;
					var dy2 = y2 - cy;
					var r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
					var r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
					if (r2 > r1) {
						job.vertexPoints[id] = [x2, y2];
						job.vertexMoved[id] = true;
						vertex.setAttribute("cx", x2);
						vertex.setAttribute("cy", y2);
						changed = true;
					}
				}
			}
		);
	}
	cx0 = cx;
	cy0 = cy;
	return changed;
}