
var AudioSystem =
{
	microphoneActive : false,
	microphoneConnected : false,
	previousAudioVolume : 1.0,

    init : function (bufferSize)
    {
        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        this.audioContext = new window.AudioContext();
        this.sampleRate = this.audioContext.sampleRate;
        this.bufferSize = bufferSize;
        this.timePerSample = 1/this.sampleRate;
        this.oldXSamples = new Float32Array(this.bufferSize);
		this.oldYSamples = new Float32Array(this.bufferSize);
    	this.smoothedXSamples = new Float32Array(Filter.nSmoothedSamples);
    	this.smoothedYSamples = new Float32Array(Filter.nSmoothedSamples);

    	if (!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia))
    	{
    		microphoneOutput.value = " unavailable in this browser";
    	}
    },

    startSound : function()
    {
    	var audioElement = document.getElementById("audioElement");
    	this.source = this.audioContext.createMediaElementSource(audioElement);
		this.audioVolumeNode = this.audioContext.createGain();

		this.generator = this.audioContext.createScriptProcessor(this.bufferSize, 0, 2);
		this.generator.onaudioprocess = SignalGenerator.generate;

        this.scopeNode = this.audioContext.createScriptProcessor(this.bufferSize, 2, 2);
        this.scopeNode.onaudioprocess = doScriptProcessor;
        this.source.connect(this.scopeNode);
    	this.generator.connect(this.scopeNode);

        this.scopeNode.connect(this.audioVolumeNode);
        this.audioVolumeNode.connect(this.audioContext.destination);
    },

    tryToGetMicrophone : function()
    {
        if (this.microphoneActive)
        {
			if (!this.microphoneConnected)
			{
				AudioSystem.microphone.connect(AudioSystem.scopeNode);
				this.microphoneConnected = true;
			}
			this.mutePlaybackForMicrophone();
            return;
        }

    	var constraints = {audio:  { mandatory: { echoCancellation: false }}};
    	//var constraints = {audio: {echoCancellation: false} };
    	navigator.getUserMedia = navigator.getUserMedia ||
                         navigator.webkitGetUserMedia ||
                         navigator.mozGetUserMedia;
        if (navigator.getUserMedia)
        {
			navigator.getUserMedia(constraints, onStream, function(){selectMicrophoneSource(false);});
       	}
       	else
       	{
       		micCheckbox.checked = false;
       	}
    },

	disconnectMicrophone : function()
	{
		if (!this.microphone || !this.microphoneConnected) return;
		this.microphone.disconnect();
		this.microphoneConnected = false;
	},

	mutePlaybackForMicrophone : function()
	{
		var currentVolume = parseFloat(audioVolume.value);
		if (currentVolume > 0) this.previousAudioVolume = currentVolume;
		audioVolume.value = 0.0;
		audioVolume.oninput();
		if (this.audioVolumeNode) this.audioVolumeNode.gain.value = 0.0;
	},

	restorePlaybackVolume : function()
	{
		audioVolume.value = this.previousAudioVolume;
		audioVolume.oninput();
		if (this.audioVolumeNode) this.audioVolumeNode.gain.value = this.previousAudioVolume;
	},

	resumeFilePlayback : function(audioElement)
	{
		this.restorePlaybackVolume();
		var resumeContext = this.audioContext.state === "suspended"
			? this.audioContext.resume()
			: Promise.resolve();
		return resumeContext.then(function()
		{
			return audioElement.play();
		}).catch(function() {});
	}
}



onStream = function(stream)
{
    if (!micCheckbox.checked)
    {
		stream.getTracks().forEach(function(track){ track.stop(); });
		return;
    }
    AudioSystem.microphoneActive = true;
	  AudioSystem.microphone = AudioSystem.audioContext.createMediaStreamSource(stream);
	  AudioSystem.microphone.connect(AudioSystem.scopeNode);
	AudioSystem.microphoneConnected = true;

    AudioSystem.mutePlaybackForMicrophone();
};

var SignalGenerator =
{
	oldA : 1.0,
	oldB : 1.0,
	timeInSamples : 0,

	generate : function(event)
	{
		var xOut = event.outputBuffer.getChannelData(0);
		var yOut = event.outputBuffer.getChannelData(1);
		var newA = controls.aValue * Math.pow(10.0, controls.aExponent);
		var newB = controls.bValue * Math.pow(10.0, controls.bExponent);
		var oldA = SignalGenerator.oldA;
		var oldB = SignalGenerator.oldB;
		var PI = Math.PI;
		var cos = Math.cos;
		var sin = Math.sin;
		var xFunc = eval("(function xFunc(){return "+controls.xExpression+";})");
		var yFunc = eval("(function yFunc(){return "+controls.yExpression+";})");
		var bufferSize = AudioSystem.bufferSize;
		var timeInSamples = SignalGenerator.timeInSamples;
		var sampleRate = AudioSystem.sampleRate;
		var x = 0.0;
		var y = 0.0;
		if (!controls.signalGeneratorOn)
		{
			for (var i=0; i<bufferSize; i++)
			{
				xOut[i] = 0;
				yOut[i] = 0;
			}
		}
		else if ((newA == oldA) && (newB == oldB))
		{
			var n = timeInSamples;
			for (var i=0; i<bufferSize; i++)
			{
				var t = n/sampleRate;
				var a = newA;
				var b = newB;
				x = xFunc();
				y = yFunc();
				xOut[i] = x;
				yOut[i] = y;
				n += 1;
			}
		}
		else
		{
			var n = timeInSamples;
			for (var i=0; i<bufferSize; i++)
			{
				var t = n/sampleRate;

				var a = oldA;
				var b = oldB;
				var oldX = xFunc();
				var oldY = yFunc();
				a = newA;
				b = newB;
				var newX = xFunc();
				var newY = yFunc();
				var alpha_z = i/bufferSize;
				x = oldX*(1.0-alpha_z)+newX*alpha_z;
				y = oldY*(1.0-alpha_z)+newY*alpha_z;

				xOut[i] = x;
				yOut[i] = y;
				n += 1;
			}
		}

		SignalGenerator.timeInSamples += AudioSystem.bufferSize;
		SignalGenerator.oldA = newA;
		SignalGenerator.oldB = newB;
	}

}

var Filter =
{
	lanczosTweak : 1.5,

	init : function(bufferSize, a, steps)
	{
		this.bufferSize = bufferSize;
    	this.a = a;
    	this.steps = steps;
    	this.radius = a * steps;
    	this.nSmoothedSamples = this.bufferSize*this.steps + 1;
    	this.allSamples = new Float32Array(2*this.bufferSize);

    	this.createLanczosKernel();
    },


	generateSmoothedSamples : function (oldSamples, samples, smoothedSamples)
	{
		//this.createLanczosKernel();
		var bufferSize = this.bufferSize;
		var allSamples = this.allSamples;
		var nSmoothedSamples = this.nSmoothedSamples;
		var a = this.a;
		var steps = this.steps;
		var K = this.K;

		for (var i=0; i<bufferSize; i++)
		{
			allSamples[i] = oldSamples[i];
			allSamples[bufferSize+i] = samples[i];
		}

		/*for (var s= -a+1; s<a; s++)
		{
			for (var r=0; r<steps; r++)
			{
				if (r==0 && !(s==0)) continue;
				var kernelPosition = -r+s*steps;
				if (kernelPosition<0) k = K[-kernelPosition];
				else k = K[kernelPosition];

				var i = r;
				var pStart = bufferSize - 2*a + s;
				var pEnd = pStart + bufferSize;
				for (var p=pStart; p<pEnd; p++)
				{
					smoothedSamples[i] += k * allSamples[p];
					i += steps;
				}
			}
		}*/

		var pStart = bufferSize - 2*a;
		var pEnd = pStart + bufferSize;
		var i = 0;
		for (var position=pStart; position<pEnd; position++)
		{
			smoothedSamples[i] = allSamples[position];
			i += 1;
			for (var r=1; r<steps; r++)
			{
				var smoothedSample = 0;
				for (var s= -a+1; s<a; s++)
				{
					var sample = allSamples[position+s];
					var kernelPosition = -r+s*steps;
					if (kernelPosition<0) smoothedSample += sample * K[-kernelPosition];
					else smoothedSample += sample * K[kernelPosition];
				}
				smoothedSamples[i] = smoothedSample;
				i += 1;
			}
		}

		smoothedSamples[nSmoothedSamples-1] = allSamples[2*bufferSize-2*a];
	},

    createLanczosKernel : function ()
    {
    	this.K = new Float32Array(this.radius);
    	this.K[0] = 1;
    	for (var i =1; i<this.radius; i++)
    	{
    		var piX = (Math.PI * i) / this.steps;
    		var sinc = Math.sin(piX)/piX;
    		var window = this.a * Math.sin(piX/this.a) / piX;
    		this.K[i] = sinc*Math.pow(window, this.lanczosTweak);
    	}
    }
}

var UI =
{
	sidebarWidth : 360,

	init : function()
	{
		var kHzText = (AudioSystem.sampleRate/1000).toFixed(1)+"kHz";
		document.getElementById("samplerate").innerHTML=kHzText;
        mainGain.oninput();
        trigger.oninput();
		this.xInput = document.getElementById("xInput");
		this.yInput = document.getElementById("yInput");
		this.xInput.value = controls.xExpression;
        this.yInput.value = controls.yExpression;
	},

	compile : function() //doesn't compile anything anymore
	{
		controls.xExpression = this.xInput.value;
		controls.yExpression = this.yInput.value;
	}
}

var Render =
{
	debug : 0,

	init : function()
	{
		this.canvas = document.getElementById("crtCanvas");
		this.onResize();
		window.onresize = this.onResize;
		window.gl = this.canvas.getContext("webgl", {preserveDrawingBuffer: true},  { alpha: false } );
		gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		gl.enable(gl.BLEND);
		gl.blendEquation( gl.FUNC_ADD );
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.colorMask(true, true, true, true);
		var ext1 = gl.getExtension('OES_texture_float');
		var ext2 = gl.getExtension('OES_texture_float_linear');
		//this.ext = gl.getExtension('OES_texture_half_float');
		//this.ext2 = gl.getExtension('OES_texture_half_float_linear');
		this.fadeAmount = 0.2*AudioSystem.bufferSize/512;


		this.fullScreenQuad = new Float32Array([
			-1, 1, 1, 1,  1,-1,  // Triangle 1
			-1, 1, 1,-1, -1,-1   // Triangle 2
		  	]);

		this.simpleShader = this.createShader("vertex","fragment");
		this.simpleShader.vertexPosition = gl.getAttribLocation(this.simpleShader, "vertexPosition");
		this.simpleShader.colour = gl.getUniformLocation(this.simpleShader, "colour");

		this.lineShader = this.createShader("gaussianVertex","gaussianFragment");
		this.lineShader.aStart = gl.getAttribLocation(this.lineShader, "aStart");
		this.lineShader.aEnd = gl.getAttribLocation(this.lineShader, "aEnd");
		this.lineShader.aIdx = gl.getAttribLocation(this.lineShader, "aIdx");
		this.lineShader.uGain = gl.getUniformLocation(this.lineShader, "uGain");
		this.lineShader.uSize = gl.getUniformLocation(this.lineShader, "uSize");
		this.lineShader.uInvert = gl.getUniformLocation(this.lineShader, "uInvert");
		this.lineShader.uIntensity = gl.getUniformLocation(this.lineShader, "uIntensity");
		this.lineShader.uNEdges = gl.getUniformLocation(this.lineShader, "uNEdges");
		this.lineShader.uFadeAmount = gl.getUniformLocation(this.lineShader, "uFadeAmount");
		this.lineShader.uScreen = gl.getUniformLocation(this.lineShader, "uScreen");
		this.lineShader.uCanvasAspect = gl.getUniformLocation(this.lineShader, "uCanvasAspect");
		this.lineShader.uSweepOn = gl.getUniformLocation(this.lineShader, "uSweepOn");

		this.outputShader = this.createShader("outputVertex","outputFragment");
		this.outputShader.aPos = gl.getAttribLocation(this.outputShader, "aPos");
		this.outputShader.uTexture0 = gl.getUniformLocation(this.outputShader, "uTexture0");
		this.outputShader.uTexture1 = gl.getUniformLocation(this.outputShader, "uTexture1");
		this.outputShader.uTexture2 = gl.getUniformLocation(this.outputShader, "uTexture2");
		this.outputShader.uTexture3 = gl.getUniformLocation(this.outputShader, "uTexture3");
		this.outputShader.uTexture4 = gl.getUniformLocation(this.outputShader, "uTexture4");
		this.outputShader.uTexture5 = gl.getUniformLocation(this.outputShader, "uTexture5");
		this.outputShader.uExposure = gl.getUniformLocation(this.outputShader, "uExposure");
		this.outputShader.uCoreColour = gl.getUniformLocation(this.outputShader, "uCoreColour");
		this.outputShader.uHaloColour = gl.getUniformLocation(this.outputShader, "uHaloColour");
		this.outputShader.uBackgroundColour = gl.getUniformLocation(this.outputShader, "uBackgroundColour");
		this.outputShader.uEmissionRamp = gl.getUniformLocation(this.outputShader, "uEmissionRamp");
		this.outputShader.uContrast = gl.getUniformLocation(this.outputShader, "uContrast");
		this.outputShader.uBlackPoint = gl.getUniformLocation(this.outputShader, "uBlackPoint");
		this.outputShader.uGraticuleIntensity = gl.getUniformLocation(this.outputShader, "uGraticuleIntensity");
		this.outputShader.uOpticalPolish = gl.getUniformLocation(this.outputShader, "uOpticalPolish");
		this.outputShader.uOpticalTime = gl.getUniformLocation(this.outputShader, "uOpticalTime");
		this.outputShader.uViewportSize = gl.getUniformLocation(this.outputShader, "uViewportSize");
		this.outputShader.uCanvasAspect = gl.getUniformLocation(this.outputShader, "uCanvasAspect");

		this.texturedShader = this.createShader("texturedVertex","texturedFragment");
		this.texturedShader.aPos = gl.getAttribLocation(this.texturedShader, "aPos");
		this.texturedShader.uTexture0 = gl.getUniformLocation(this.texturedShader, "uTexture0");

		this.blurShader = this.createShader("texturedVertex","blurFragment");
		this.blurShader.aPos = gl.getAttribLocation(this.blurShader, "aPos");
		this.blurShader.uTexture0 = gl.getUniformLocation(this.blurShader, "uTexture0");
		this.blurShader.uOffset = gl.getUniformLocation(this.blurShader, "uOffset");

		this.vertexBuffer = gl.createBuffer();
		this.setupTextures();
	},

	setupArrays : function(nPoints)
	{
		this.nPoints = nPoints;
		this.nEdges = this.nPoints-1;

		this.quadIndexBuffer = gl.createBuffer();
		var indices = new Float32Array(4*this.nEdges);
		for (var i=0; i<indices.length; i++)
		{
			indices[i] = i;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadIndexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		this.vertexIndexBuffer = gl.createBuffer();
		var len = this.nEdges * 2 * 3,
		indices = new Uint16Array(len);
		for (var i = 0, pos = 0; i < len;)
		{
			indices[i++] = pos;
			indices[i++] = pos + 2;
			indices[i++] = pos + 1;
			indices[i++] = pos + 1;
			indices[i++] = pos + 2;
			indices[i++] = pos + 3;
			pos += 4;
		}
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


		this.scratchVertices = new Float32Array(8*nPoints);
	},

	setupTextures : function()
	{
		this.frameBuffer = gl.createFramebuffer();
		this.lineTexture = this.makeTexture(1024, 1024);
		this.freshLineTexture = this.makeTexture(1024, 1024);
		this.blur1Texture = this.makeTexture(256,256);
		this.blur2Texture = this.makeTexture(256, 256);
		this.blur3Texture = this.makeTexture(32, 32);
		this.blur4Texture = this.makeTexture(32, 32);
		this.graticuleTexture = this.makeTexture(1024, 1024);
		this.onResize();
		this.screenTexture = this.loadTexture('noise.jpg');
	},

	onResize : function()
	{
		var windowWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0)
		var windowHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0)
		var canvasWidth;
		var canvasHeight;
		if (document.body.classList.contains('full-screen-mode'))
		{
			var fullScreenAspect = controls.aspectWidth/controls.aspectHeight;
			canvasWidth = Math.min(windowWidth, windowHeight*fullScreenAspect);
			canvasHeight = canvasWidth/fullScreenAspect;
		}
		else
		{
			var availableWidth = Math.max(1, windowWidth-UI.sidebarWidth-70);
			var availableHeight = Math.max(1, windowHeight-21);
			var aspectRatio = controls.aspectWidth/controls.aspectHeight;
			canvasWidth = Math.min(availableWidth, availableHeight*aspectRatio);
			canvasHeight = canvasWidth/aspectRatio;
		}
		Render.canvas.width = Math.floor(canvasWidth);
		Render.canvas.height = Math.floor(canvasHeight);
		if (Render.lineTexture)
		{
			Render.resizeRenderTextures();
		}

	},

	resizeRenderTextures : function()
	{
		var aspect = this.canvas.width/this.canvas.height;
		var dimensions = function(size)
		{
			if (aspect >= 1) return [size, Math.max(1, Math.round(size/aspect))];
			return [Math.max(1, Math.round(size*aspect)), size];
		};
		var lineSize = dimensions(1024);
		this.resizeTexture(this.freshLineTexture, lineSize[0], lineSize[1]);
		var tightGlowSize = dimensions(256);
		var wideGlowSize = dimensions(32);
		this.resizeTexture(this.lineTexture, lineSize[0], lineSize[1]);
		this.resizeTexture(this.blur1Texture, tightGlowSize[0], tightGlowSize[1]);
		this.resizeTexture(this.blur2Texture, tightGlowSize[0], tightGlowSize[1]);
		this.resizeTexture(this.blur3Texture, wideGlowSize[0], wideGlowSize[1]);
		this.resizeTexture(this.blur4Texture, wideGlowSize[0], wideGlowSize[1]);
		this.resizeTexture(this.graticuleTexture, lineSize[0], lineSize[1]);
		this.drawGrid();
	},

	drawLineTexture : function(xPoints, yPoints)
	{
    	this.fadeAmount = Math.pow(0.5, controls.persistence)*0.2*AudioSystem.bufferSize/512 ;
		this.activateTargetTexture(this.freshLineTexture);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		this.drawLine(xPoints, yPoints);
		this.activateTargetTexture(this.lineTexture);
		this.fade();
		//gl.clear(gl.COLOR_BUFFER_BIT);
		this.drawLine(xPoints, yPoints);
	},

	drawCRT : function(timeStamp)
	{
		this.setNormalBlending();

		this.activateTargetTexture(this.blur1Texture);
		this.setShader(this.texturedShader);
		this.drawTexture(this.lineTexture);

		//horizontal blur 256x256
		this.activateTargetTexture(this.blur2Texture);
		this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [1.0/this.blur2Texture.width, 0.0]);
		this.drawTexture(this.blur1Texture);

		//vertical blur 256x256
		this.activateTargetTexture(this.blur1Texture);
		//this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [0.0, 1.0/this.blur1Texture.height]);
		this.drawTexture(this.blur2Texture);

		//preserve blur1 for later
		this.activateTargetTexture(this.blur3Texture);
		this.setShader(this.texturedShader);
		this.drawTexture(this.blur1Texture);

		//horizontal blur 64x64
		this.activateTargetTexture(this.blur4Texture);
		this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [1.0/this.blur4Texture.width, 0.0]);
		this.drawTexture(this.blur3Texture);

		//vertical blur 64x64
		this.activateTargetTexture(this.blur3Texture);
		//this.setShader(this.blurShader);
		gl.uniform2fv(this.blurShader.uOffset, [0.0, 1.0/this.blur3Texture.height]);
		this.drawTexture(this.blur4Texture);

		this.activateTargetTexture(null);
		this.setShader(this.outputShader);
		var brightness = Math.pow(2, controls.exposureStops-2.0);
		//if (controls.disableFilter) brightness *= Filter.steps;
		gl.uniform1f(this.outputShader.uExposure, brightness);
		gl.uniform1f(this.outputShader.uCanvasAspect, this.canvas.width/this.canvas.height);
		gl.uniform3fv(this.outputShader.uCoreColour, this.getColourFromHex(controls.coreColor));
		gl.uniform3fv(this.outputShader.uHaloColour, this.getColourFromHex(controls.haloColor));
		gl.uniform3fv(this.outputShader.uBackgroundColour, this.getColourFromHex(controls.backgroundColor));
		gl.uniform1f(this.outputShader.uEmissionRamp, controls.emissionRamp);
		gl.uniform1f(this.outputShader.uContrast, controls.contrast);
		gl.uniform1f(this.outputShader.uBlackPoint, controls.blackPoint);
		gl.uniform1f(this.outputShader.uGraticuleIntensity, controls.graticuleIntensity);
		gl.uniform1f(this.outputShader.uOpticalPolish, controls.opticalPolish ? 1.0 : 0.0);
		gl.uniform1f(this.outputShader.uOpticalTime, (timeStamp || 0)*0.001);
		gl.uniform2f(this.outputShader.uViewportSize, this.canvas.width, this.canvas.height);
		this.drawTexture(this.lineTexture, this.blur1Texture, this.blur3Texture, this.screenTexture, this.graticuleTexture, this.freshLineTexture);
	},

	getColourFromHex : function(hexColour)
	{
		var hex = hexColour.replace('#', '');
		return [
			parseInt(hex.substring(0,2), 16)/255,
			parseInt(hex.substring(2,4), 16)/255,
			parseInt(hex.substring(4,6), 16)/255
		];
	},

	activateTargetTexture : function(texture)
	{
		if (texture)
		{
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
			gl.viewport(0, 0, texture.width, texture.height);
		}
		else
		{
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		}
		this.targetTexture = texture;
	},

	setShader : function(program)
	{
		this.program = program;
		gl.useProgram(program);
	},

	drawTexture : function(texture0, texture1, texture2, texture3, texture4, texture5)
	{
		//gl.useProgram(this.program);
		gl.enableVertexAttribArray(this.program.aPos);

    	gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, texture0);
		gl.uniform1i(this.program.uTexture0, 0);

		if (texture1)
		{
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, texture1);
			gl.uniform1i(this.program.uTexture1, 1);
		}

		if (texture2)
		{
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, texture2);
			gl.uniform1i(this.program.uTexture2, 2);
		}

		if (texture3)
		{
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, texture3);
			gl.uniform1i(this.program.uTexture3, 3);
		}

		if (texture4)
		{
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, texture4);
			gl.uniform1i(this.program.uTexture4, 4);
		}

		if (texture5)
		{
			gl.activeTexture(gl.TEXTURE5);
			gl.bindTexture(gl.TEXTURE_2D, texture5);
			gl.uniform1i(this.program.uTexture5, 5);
		}

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
   		gl.bufferData(gl.ARRAY_BUFFER, this.fullScreenQuad, gl.STATIC_DRAW);
		gl.vertexAttribPointer(this.program.aPos, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(this.program.aPos);

	},

	drawLine : function(xPoints, yPoints)
	{
		this.setAdditiveBlending();

		var scratchVertices = this.scratchVertices;
		//this.totalLength = 0;
		var nPoints = xPoints.length;
		for (var i=0; i<nPoints; i++)
		{
			var p = i*8;
			scratchVertices[p]=scratchVertices[p+2]=scratchVertices[p+4]=scratchVertices[p+6]=xPoints[i];
			scratchVertices[p+1]=scratchVertices[p+3]=scratchVertices[p+5]=scratchVertices[p+7]=yPoints[i];
			/*if (i>0)
			{
				var xDelta = xPoints[i]-xPoints[i-1];
				if (xDelta<0) xDelta = -xDelta;
				var yDelta = yPoints[i]-yPoints[i-1];
				if (yDelta<0) yDelta = -yDelta;
				this.totalLength += xDelta + yDelta;
			}*/
		}
		//testOutputElement.value = this.totalLength;

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, scratchVertices, gl.STATIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);

		var program = this.lineShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.aStart);
		gl.enableVertexAttribArray(program.aEnd);
		gl.enableVertexAttribArray(program.aIdx);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
		gl.vertexAttribPointer(program.aStart, 2, gl.FLOAT, false, 0, 0);
		gl.vertexAttribPointer(program.aEnd, 2, gl.FLOAT, false, 0, 8*4);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadIndexBuffer);
		gl.vertexAttribPointer(program.aIdx, 1, gl.FLOAT, false, 0, 0);

    	gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.screenTexture);
		gl.uniform1i(program.uScreen, 0);

		gl.uniform1f(program.uSize, 0.015);
		gl.uniform1f(program.uGain, Math.pow(2.0,controls.mainGain)*450/512);
		gl.uniform1f(program.uCanvasAspect, this.canvas.width/this.canvas.height);
		gl.uniform1f(program.uSweepOn, controls.sweepOn ? 1.0 : 0.0);
		if (controls.invertXY) gl.uniform1f(program.uInvert, -1.0);
		else gl.uniform1f(program.uInvert, 1.0);
		if (controls.disableFilter) gl.uniform1f(program.uIntensity, 0.005*(Filter.steps+1.5));
		// +1.5 needed above for some reason for the brightness to match
		else gl.uniform1f(program.uIntensity, 0.005);
		gl.uniform1f(program.uFadeAmount, this.fadeAmount);
		gl.uniform1f(program.uNEdges, this.nEdges);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.vertexIndexBuffer);
    	var nEdgesThisTime = (xPoints.length-1);

    	/*if (this.totalLength > 300)
    	{
    		nEdgesThisTime *= 300/this.totalLength;
    		nEdgesThisTime = Math.floor(nEdgesThisTime);
		}*/

    	gl.drawElements(gl.TRIANGLES, nEdgesThisTime * 6, gl.UNSIGNED_SHORT, 0);

		gl.disableVertexAttribArray(program.aStart);
		gl.disableVertexAttribArray(program.aEnd);
		gl.disableVertexAttribArray(program.aIdx);
	},

	fade : function(alpha)
	{
		this.setNormalBlending();

		var program = this.simpleShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
   		gl.bufferData(gl.ARRAY_BUFFER, this.fullScreenQuad, gl.STATIC_DRAW);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		gl.uniform4fv(program.colour, [0.0, 0.0, 0.0, this.fadeAmount]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		gl.disableVertexAttribArray(program.vertexPosition);
	},

	loadTexture : function(fileName)
	{
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		// Fill with grey pixel, as placeholder until loaded
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([128, 128, 128, 255]));
		// Asynchronously load an image
		var image = new Image();
		image.src = fileName;
		image.addEventListener('load', function()
		{
		  	// Now that the image has loaded make copy it to the texture.
		  	gl.bindTexture(gl.TEXTURE_2D, texture);
		  	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.generateMipmap(gl.TEXTURE_2D);
			//hardcoded:
			texture.width = texture.height = 512;
		});
		return texture;
	},

	drawGrid : function()
	{
		if (!this.graticuleTexture) return;
		this.activateTargetTexture(this.graticuleTexture);
		gl.clearColor(0.0, 0.0, 0.0, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (!controls.grid) return;
		this.setNormalBlending();
		this.setShader(this.simpleShader);

		var verticalDivisions = 8;
		var aspect = this.canvas.width/Math.max(1, this.canvas.height);
		var horizontalDivisions = Math.max(2, Math.round(verticalDivisions*aspect));
		var regular = [];
		var centre = [];
		var ticks = [];
		var xStep = 2/horizontalDivisions;
		var yStep = 2/verticalDivisions;
		var tickX = 10/Math.max(1, this.canvas.width);
		var tickY = 10/Math.max(1, this.canvas.height);

		for (var xIndex=0; xIndex<=horizontalDivisions; xIndex++)
		{
			var x = -1+xIndex*xStep;
			var xTarget = (horizontalDivisions%2===0 && xIndex===horizontalDivisions/2) ? centre : regular;
			xTarget.push(x, -1, x, 1);
			for (var yTick=1; yTick<verticalDivisions*5; yTick++)
			{
				if (yTick%5===0) continue;
				var ty = -1+yTick*yStep/5;
				ticks.push(x-tickX, ty, x+tickX, ty);
			}
		}

		for (var yIndex=0; yIndex<=verticalDivisions; yIndex++)
		{
			var y = -1+yIndex*yStep;
			var yTarget = (yIndex===verticalDivisions/2) ? centre : regular;
			yTarget.push(-1, y, 1, y);
			for (var xTick=1; xTick<horizontalDivisions*5; xTick++)
			{
				if (xTick%5===0) continue;
				var tx = -1+xTick*xStep/5;
				ticks.push(tx, y-tickY, tx, y+tickY);
			}
		}

		var drawSegments = function(data, intensity)
		{
			if (!data.length) return;
			var vertices = new Float32Array(data);
			gl.enableVertexAttribArray(Render.program.vertexPosition);
			gl.bindBuffer(gl.ARRAY_BUFFER, Render.vertexBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
			gl.vertexAttribPointer(Render.program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.uniform4fv(Render.program.colour, [intensity, 0.0, 0.0, 1.0]);
			gl.lineWidth(1.0);
			gl.drawArrays(gl.LINES, 0, vertices.length/2);
			gl.disableVertexAttribArray(Render.program.vertexPosition);
		};

		drawSegments(regular, 0.20);
		drawSegments(ticks, 0.24);
		drawSegments(centre, 0.36);
	},

	makeTexture : function(width, height)
	{
		var texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
		//gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, Render.ext.HALF_FLOAT_OES, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.bindTexture(gl.TEXTURE_2D, null);
		texture.width = width;
		texture.height = height;
		return texture;
	},

	resizeTexture : function(texture, width, height)
	{
		if (texture.width === width && texture.height === height) return;
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
		gl.bindTexture(gl.TEXTURE_2D, null);
		texture.width = width;
		texture.height = height;
	},

	xactivateTargetTexture : function(ctx, texture)
	{
		gl.bindRenderbuffer(gl.RENDERBUFFER, ctx.renderBuffer);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, ctx.frameBuffer.width, ctx.frameBuffer.height);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ctx.renderBuffer);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindRenderbuffer(gl.RENDERBUFFER, null);
	},

	drawSimpleLine : function(xSamples, ySamples, colour)
	{
		var nVertices = xSamples.length;
		var vertices = new Float32Array(2*nVertices);
		for (var i=0; i<nVertices; i++)
		{
			vertices[2*i] = xSamples[i];
			vertices[2*i+1] = ySamples[i];
		}

		this.setAdditiveBlending();

		var program = this.simpleShader;
		gl.useProgram(program);
		gl.enableVertexAttribArray(program.vertexPosition);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
   		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
		gl.vertexAttribPointer(program.vertexPosition, 2, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		if (colour=="green") gl.uniform4fv(program.colour, [0.01, 0.1, 0.01, 1.0]);
		else if (colour == "red") gl.uniform4fv(program.colour, [0.1, 0.01, 0.01, 1.0]);

		gl.lineWidth(3.0);
		gl.drawArrays(gl.LINE_STRIP, 0, nVertices);
	},

	setAdditiveBlending : function()
	{
		//gl.blendEquation( gl.FUNC_ADD );
		gl.blendFunc(gl.ONE, gl.ONE);
	},

	setNormalBlending : function()
	{
		//gl.blendEquation( gl.FUNC_ADD );
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	},

	createShader : function(vsTag, fsTag)
	{
		if (!this.supportsWebGl())
		{
			throw new Error('createShader: no WebGL context');
		}

		var vsSource = document.getElementById(vsTag).firstChild.nodeValue;
		var fsSource = document.getElementById(fsTag).firstChild.nodeValue;

		var vs = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vs, vsSource);
		gl.compileShader(vs);
		if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
		{
			var infoLog = gl.getShaderInfoLog(vs);
			gl.deleteShader(vs);
			throw new Error('createShader, vertex shader compilation:\n' + infoLog);
		}

		var fs = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fs, fsSource);
		gl.compileShader(fs);
		if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
		{
			var infoLog = gl.getShaderInfoLog(fs);
			gl.deleteShader(vs);
			gl.deleteShader(fs);
			throw new Error('createShader, fragment shader compilation:\n' + infoLog);
		}

		var program = gl.createProgram();

		gl.attachShader(program, vs);
		gl.deleteShader(vs);

		gl.attachShader(program, fs);
		gl.deleteShader(fs);

		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		{
			var infoLog = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error('createShader, linking:\n' + infoLog);
		}

		return program;
	},

	supportsWebGl : function()
	{
		// from https://github.com/Modernizr/Modernizr/blob/master/feature-detects/webgl.js
		var canvas = document.createElement('canvas'),
			supports = 'probablySupportsContext' in canvas ? 'probablySupportsContext' : 'supportsContext';
		if (supports in canvas)
		{
			return canvas[supports]('webgl') || canvas[supports]('experimental-webgl');
		}
		return 'WebGLRenderingContext' in window;
	}
}

var sweepPosition = -1.0;
var belowTrigger = false;

function doScriptProcessor(event)
{
	var xSamplesRaw = event.inputBuffer.getChannelData(0);
	var ySamplesRaw = event.inputBuffer.getChannelData(1);
	var xOut = event.outputBuffer.getChannelData(0);
	var yOut = event.outputBuffer.getChannelData(1);

	var length = xSamplesRaw.length;
	for (var i=0; i<length; i++)
	{
		xSamples[i] = xSamplesRaw[i];// + (Math.random()-0.5)*controls.noise/2000;
		ySamples[i] = ySamplesRaw[i];// + (Math.random()-0.5)*controls.noise/2000;
	}

    if (controls.sweepOn)
    {
        var gain = Math.pow(2.0,controls.mainGain);
        var sweepAspect = Render.canvas.width/Render.canvas.height;
        var sweepMinTime = controls.sweepMsDiv*10/1000;
        var triggerValue = controls.sweepTriggerValue;
        for (var i=0; i<length; i++)
        {
            // The line shader preserves square signal geometry by dividing x by
            // the viewport aspect. Cancel that only for the sweep time axis so
            // its symmetric phase fills the rectangular viewport.
            xSamples[i] = sweepPosition*sweepAspect/gain;
            sweepPosition += 2*AudioSystem.timePerSample/sweepMinTime;
            var crossedTrigger = belowTrigger && ySamples[i]>=triggerValue;
            if (sweepPosition > 1.0 || (sweepPosition > 0.95 && crossedTrigger))
                sweepPosition = -1.0;
            belowTrigger = ySamples[i]<triggerValue;
        }
    }

	if (!controls.freezeImage)
	{
		if (!controls.disableFilter)
		{
			Filter.generateSmoothedSamples(AudioSystem.oldXSamples, xSamples, AudioSystem.smoothedXSamples);
			Filter.generateSmoothedSamples(AudioSystem.oldYSamples, ySamples, AudioSystem.smoothedYSamples);

			if (!controls.swapXY) Render.drawLineTexture(AudioSystem.smoothedXSamples, AudioSystem.smoothedYSamples);
			else Render.drawLineTexture(AudioSystem.smoothedYSamples, AudioSystem.smoothedXSamples);
		}
		else
		{
			if (!controls.swapXY) Render.drawLineTexture(xSamples, ySamples);
			else Render.drawLineTexture(ySamples, xSamples);
		}
	}

	for (var i = 0; i<length; i++)
	{
		AudioSystem.oldXSamples[i] = xSamples[i];
		AudioSystem.oldYSamples[i] = ySamples[i];
		xOut[i] = xSamplesRaw[i];
		yOut[i] = ySamplesRaw[i];
	}

	AudioSystem.audioVolumeNode.gain.value = controls.audioVolume;
}

function drawCRTFrame(timeStamp)
{
	Render.drawCRT(timeStamp);
	requestAnimationFrame(drawCRTFrame);
}

var xSamples = new Float32Array(1024);
var ySamples = new Float32Array(1024);
UI.init();
Render.init();
Controls.setupControls();

var appActivated = false;

var activateApp = function(event)
{
	if (appActivated) return;
	appActivated = true;
	document.removeEventListener("pointerdown", activateApp, true);
	document.removeEventListener("keydown", activateApp, true);
	document.removeEventListener("click", activateApp, true);
	//Filter.init(512, 10, 4);
	Filter.init(1024, 8, 6);
	AudioSystem.init(1024);
	Render.setupArrays(Filter.nSmoothedSamples);
	AudioSystem.startSound();
	AudioSystem.audioContext.resume().catch(function() {});
	if (event && event.type === "keydown" && micCheckbox.checked)
	{
		AudioSystem.tryToGetMicrophone();
		var startMessage = document.getElementById("clicktostart");
		if (startMessage) startMessage.remove();
	}
	requestAnimationFrame(drawCRTFrame);
};

document.addEventListener("pointerdown", activateApp, true);
document.addEventListener("keydown", activateApp, true);
document.addEventListener("click", activateApp, true);
