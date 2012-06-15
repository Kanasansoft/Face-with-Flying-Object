var video;
var display;
var work;

var displayContext;
var workContext;

var videoWidth;
var videoHeight;
var workWidth;
var workHeight;
var displayWidth;
var displayHeight;

var displayScale = 1;
var workScale = 0.125;

var world;
var timeStep = 1.0/60;
var iteration = 1;
var faceBodys = [];
var shapeNumber = 100;

var colorsSet = [
	{"stroke":"#000000","fill":"#ffffff"},
	{"stroke":"#ff0000","fill":"#ffcccc"},
	{"stroke":"#00ff00","fill":"#ccffcc"},
	{"stroke":"#0000ff","fill":"#ccccff"}
];

function attachUserMedia(videoElement) {
	if ("getUserMedia" in navigator) {
		navigator.getUserMedia(
			{audio : true, video : true, toString : function(){return "video, audio";}},
			function(stream) {
				videoElement.src = stream;
			},
			function(e) {
				console.log(err);
			}
		);
	} else if ("webkitGetUserMedia" in navigator) {
		navigator.webkitGetUserMedia(
			{audio : true, video : true, toString : function(){return "video, audio";}},
			function(stream) {
				var url = webkitURL.createObjectURL(stream);
				videoElement.src = url;
			},
			function(e) {
				console.log(err);
			}
		);
	} else {
		console.log("nothing : user stream");
	}
}

function repeat() {

	workContext.drawImage(
		video,
		0, 0, videoWidth, videoHeight,
		0, 0, workWidth,  workHeight
	);

	var imageData = workContext.getImageData(0, 0, workWidth, workHeight);

	var grayscale = ccv.grayscale(work);

	var result = ccv_for_realtime.detect_objects(
		{
			"canvas"        : grayscale,
			"cascade"       : cascade,
			"interval"      : 5,
			"min_neighbors" : 1
		}
	);

	displayContext.drawImage(
		video,
		0, 0, videoWidth,   videoHeight,
		0, 0, displayWidth, displayHeight
	);

	while (faceBodys.length > 0) {
		var faceBody = faceBodys.pop();
		world.DestroyBody(faceBody);
	}

	for (var i = 0, l = result.length; i < l; i++) {

		var rectX      = result[i].x      / workWidth  * displayWidth;
		var rectY      = result[i].y      / workHeight * displayHeight;
		var rectWidth  = result[i].width  / workWidth  * displayWidth;
		var rectHeight = result[i].height / workHeight * displayHeight;

		var sd         = new b2CircleDef();
		sd.radius      = Math.min(rectWidth, rectHeight) / 2 * 1.2;
		sd.restitution = 1;
		sd.density     = 10;
		sd.friction    = 0;
		var bd         = new b2BodyDef();
		bd.AddShape(sd);
		bd.position.Set(rectX + rectWidth / 2, rectY + rectHeight / 2);
		var faceBody   = world.CreateBody(bd);
		faceBodys.push(faceBody);

	}

	world.Step(timeStep, iteration);
	drawFlyingObject(
		world,
		displayContext,
		colorsSet[Math.min(result.length, colorsSet.length)]
	);

	setTimeout(repeat, 30);

}

function drawFlyingObject(world, context, colors) {
	context.strokeStyle = colors.stroke;
	context.fillStyle   = colors.fill;
	for (var body = world.m_bodyList; body; body = body.m_next) {
		if(body.userData != "FlyingObject") {
			continue;
		}
		for (var shape = body.GetShapeList(); shape != null; shape = shape.GetNext()) {
			context.beginPath();
			switch (shape.m_type) {
			case b2Shape.e_circleShape:
				break;
			case b2Shape.e_polyShape:
				var poly            = shape;
				var tV              = b2Math.AddVV(poly.m_position, b2Math.b2MulMV(poly.m_R, poly.m_vertices[0]));
				context.moveTo(tV.x, tV.y);
				for (var i = 0; i < poly.m_vertexCount; i++) {
					var v = b2Math.AddVV(poly.m_position, b2Math.b2MulMV(poly.m_R, poly.m_vertices[i]));
					context.lineTo(v.x, v.y);
				}
				context.lineTo(tV.x, tV.y);
				context.fill();
				break;
			}
			context.stroke();
		}
	}
}

function initialize() {

	work             = document.createElement("canvas");
	workContext      = work.getContext("2d");

	video            = document.getElementById("video");
	display          = document.getElementById("display");
	displayContext   = display.getContext("2d");

	video.addEventListener(
		"playing",
		function(e){

			var style       = window.getComputedStyle(video, null);
			videoWidth      = parseInt(style.width,  10);
			videoHeight     = parseInt(style.height, 10);
			displayWidth    = videoWidth  * displayScale;
			displayHeight   = videoHeight * displayScale;
			workWidth       = videoWidth  * workScale;
			workHeight      = videoHeight * workScale;
			display.width   = displayWidth;
			display.height  = displayHeight;
			work.width      = workWidth;
			work.height     = workHeight;
			display.style.width   = Math.round(displayWidth).toString(10) + "px";
			display.style.height  = Math.round(displayHeight).toString(10) + "px";
			var worldAABB = new b2AABB();
			worldAABB.minVertex.Set(-100, -100);
			worldAABB.maxVertex.Set(displayWidth + 100, displayHeight + 100);
			var gravity = new b2Vec2(0, 0);
			world = new b2World(worldAABB, gravity, false);

			var framePositions = [
				{"x" : -100               , "y" : -100                , "w" : displayWidth + 200 , "h" : 100                },
				{"x" : -100               , "y" : displayHeight + 100 , "w" : displayWidth + 200 , "h" : 100                },
				{"x" : -100               , "y" : -100                , "w" : +100               , "h" : displayHeight + 200},
				{"x" : displayWidth + 100 , "y" : -100                , "w" : +100               , "h" : displayHeight + 200}
			];
			for (var i = 0, l = framePositions.length; i < l; i++) {
				var framePosition = framePositions[i];
				var sd            = new b2BoxDef();
				sd.extents.Set(framePosition.w, framePosition.h);
				sd.restitution    = 1.0;
				sd.friction       = 0;
				var bd            = new b2BodyDef();
				bd.AddShape(sd);
				bd.position.Set(framePosition.x, framePosition.y);
				world.CreateBody(bd);
			}
			for (var i = 0; i < shapeNumber; i++) {
				var sd            = new b2BoxDef();
				sd.extents.Set(5, 5);
				sd.density        = 10;
				sd.restitution    = 0.9;
				sd.friction       = 0;
				var bd            = new b2BodyDef();
				bd.AddShape(sd);
				bd.position.Set(displayWidth / 2, displayHeight / 2);
				var shape         = world.CreateBody(bd);
				shape.userData    = "FlyingObject";
				shape.SetLinearVelocity(
					new b2Vec2(
						(Math.random() - Math.random()) * 1000,
						(Math.random() - Math.random()) * 1000
					)
				);
				shape.SetAngularVelocity((Math.random() - Math.random()) *180);
			}

			repeat();

		},
		false
	);

	attachUserMedia(video);

}

window.addEventListener("load", initialize, false);
