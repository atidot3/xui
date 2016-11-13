/*
 * Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 * Copyright (C) 2005-2014, Anthony Minessale II <anthm@freeswitch.org>
 *
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 *
 * The Initial Developer of the Original Code is
 * Anthony Minessale II <anthm@freeswitch.org>
 * Portions created by the Initial Developer are Copyright (C)
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Anthony Minessale II <anthm@freeswitch.org>
 *
 * jquery.FSRTC.js - WebRTC Glue code
 *
 */

(function($) {

    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    function findLine(sdpLines, prefix, substr) {
        return findLineInRange(sdpLines, 0, -1, prefix, substr);
    }

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = (endLine != -1) ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr || sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    }

    // Gets the codec payload type from an a=rtpmap:X line.
    function getCodecPayloadType(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length == 2) ? result[1] : null;
    }
    
    // Returns a new m= line with the specified codec as the first one.
    function setDefaultCodec(mLine, payload) {
        var elements = mLine.split(' ');
        var newLine = [];
        var index = 0;
        for (var i = 0; i < elements.length; i++) {
            if (index === 3) { // Format of media starts from the fourth.
                newLine[index++] = payload; // Put target payload to the first.
            }
            if (elements[i] !== payload) newLine[index++] = elements[i];
        }
        return newLine.join(' ');
    }

    $.FSRTC = function(options) {
        this.options = $.extend({
            useVideo: null,
            useStereo: false,
            userData: null,
	    localVideo: null,
	    screenShare: false,
	    useCamera: "any",
            iceServers: false,
            videoParams: {},
            audioParams: {},
            callbacks: {
                onICEComplete: function() {},
                onICE: function() {},
                onOfferSDP: function() {}
            },
        }, options);

	this.audioEnabled = true;
	this.videoEnabled = true;


        this.mediaData = {
            SDP: null,
            profile: {},
            candidateList: []
        };

	this.constraints = {
	    offerToReceiveAudio: this.options.useSpeak === "none" ? false : true,
	    offerToReceiveVideo: this.options.useVideo ? true : false,
	};

        if (self.options.useVideo) {
            self.options.useVideo.style.display = 'none';
        }

        setCompat();
        checkCompat();
    };

    $.FSRTC.validRes = [];

    $.FSRTC.prototype.useVideo = function(obj, local) {
        var self = this;

        if (obj) {
            self.options.useVideo = obj;
	    self.options.localVideo = local;
	    self.constraints.offerToReceiveVideo = true;
        } else {
            self.options.useVideo = null;
	    self.options.localVideo = null;
	    self.constraints.offerToReceiveVideo = false;
        }

        if (self.options.useVideo) {
            self.options.useVideo.style.display = 'none';
        }
    };

    $.FSRTC.prototype.useStereo = function(on) {
        var self = this;
        self.options.useStereo = on;
    };

    // Sets Opus in stereo if stereo is enabled, by adding the stereo=1 fmtp param.
    $.FSRTC.prototype.stereoHack = function(sdp) {
        var self = this;

        if (!self.options.useStereo) {
            return sdp;
        }

        var sdpLines = sdp.split('\r\n');

        // Find opus payload.
        var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000'), opusPayload;

        if (!opusIndex) {
	    return sdp;
	} else {
            opusPayload = getCodecPayloadType(sdpLines[opusIndex]);
        }

        // Find the payload in fmtp line.
        var fmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());

        if (fmtpLineIndex === null) {
	    // create an fmtp line
	    sdpLines[opusIndex] = sdpLines[opusIndex] + '\r\na=fmtp:' + opusPayload.toString() + " stereo=1; sprop-stereo=1"
	} else {
            // Append stereo=1 to fmtp line.
            sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat('; stereo=1; sprop-stereo=1');
	}

        sdp = sdpLines.join('\r\n');
        return sdp;
    };

    function setCompat() {
    }

    function checkCompat() {
        return true;
    }

    function onStreamError(self, e) {
        console.log('There has been a problem retrieving the streams - did you allow access? Check Device Resolution', e);
        doCallback(self, "onError", e);
    }

    function onStreamSuccess(self, stream) {
        console.log("Stream Success");
        doCallback(self, "onStream", stream);
    }

    function onICE(self, candidate) {
        self.mediaData.candidate = candidate;
        self.mediaData.candidateList.push(self.mediaData.candidate);

        doCallback(self, "onICE");
    }

    function doCallback(self, func, arg) {
        if (func in self.options.callbacks) {
            self.options.callbacks[func](self, arg);
        }
    }

    function onICEComplete(self, candidate) {
        console.log("ICE Complete");
        doCallback(self, "onICEComplete");
    }

    function onChannelError(self, e) {
        console.error("Channel Error", e);
        doCallback(self, "onError", e);
    }

    function onICESDP(self, sdp) {
        self.mediaData.SDP = self.stereoHack(sdp.sdp);
        console.log("ICE SDP");
        doCallback(self, "onICESDP");
    }

    function onAnswerSDP(self, sdp) {
        self.answer.SDP = self.stereoHack(sdp.sdp);
        console.log("ICE ANSWER SDP");
        doCallback(self, "onAnswerSDP", self.answer.SDP);
    }

    function onMessage(self, msg) {
        console.log("Message");
        doCallback(self, "onICESDP", msg);
    }

    FSRTCattachMediaStream = function(element, stream) {
	if (element && element.id && attachMediaStream) {
	    attachMediaStream(element, stream);
	} else {
            if (typeof element.srcObject !== 'undefined') {
		element.srcObject = stream;
	    } else if (typeof element.src !== 'undefined') {
		element.src = URL.createObjectURL(stream);
	    } else {
		console.error('Error attaching stream to element.');
	    }
	}
    }

    
    function onRemoteStream(self, stream) {
        if (self.options.useVideo) {
            self.options.useVideo.style.display = 'block';
        }

        var element = self.options.useAudio;
        console.log("REMOTE STREAM", stream, element);

	FSRTCattachMediaStream(element, stream);
	
        self.options.useAudio.play();
        self.remoteStream = stream;
    }

    function onOfferSDP(self, sdp) {
        self.mediaData.SDP = self.stereoHack(sdp.sdp);
        console.log("Offer SDP");
        doCallback(self, "onOfferSDP");
    }

    $.FSRTC.prototype.answer = function(sdp, onSuccess, onError) {
        this.peer.addAnswerSDP({
            type: "answer",
            sdp: sdp
        },
        onSuccess, onError);
    };

    $.FSRTC.prototype.stopPeer = function() {
        if (self.peer) {
            console.log("stopping peer");
            self.peer.stop();
        }
    }

    $.FSRTC.prototype.stop = function() {
        var self = this;

        if (self.options.useVideo) {
            self.options.useVideo.style.display = 'none';
            self.options.useVideo['src'] = '';
        }

        if (self.localStream) {
            if(typeof self.localStream.stop == 'function') {
                self.localStream.stop();
            } else {
		if (self.localStream.active){
                    var tracks = self.localStream.getTracks();
                    console.log(tracks);
		    tracks.forEach(function(track, index){
			console.log(track);
			track.stop();
		    })
                }
            }
            self.localStream = null;
        }

        if (self.options.localVideo) {
            self.options.localVideo.style.display = 'none';
            self.options.localVideo['src'] = '';
        }

	if (self.options.localVideoStream) {
            if(typeof self.options.localVideoStream.stop == 'function') {
	        self.options.localVideoStream.stop();
            } else {
		if (self.options.localVideoStream.active){
                    var tracks = self.options.localVideoStream.getTracks();
                    console.log(tracks);
		    tracks.forEach(function(track, index){
			console.log(track);
			track.stop();
		    })
                }
            }
        }

        if (self.peer) {
            console.log("stopping peer");
            self.peer.stop();
        }
    };

    $.FSRTC.prototype.getMute = function() {
	var self = this;
	return self.audioEnabled;
    }

    $.FSRTC.prototype.setMute = function(what) {
	var self = this;
	var audioTracks = self.localStream.getAudioTracks();	

	for (var i = 0, len = audioTracks.length; i < len; i++ ) {
	    switch(what) {
	    case "on":
		audioTracks[i].enabled = true;
		break;
	    case "off":
		audioTracks[i].enabled = false;
		break;
	    case "toggle":
		audioTracks[i].enabled = !audioTracks[i].enabled;
	    default:
		break;
	    }

	    self.audioEnabled = audioTracks[i].enabled;
	}

	return !self.audioEnabled;
    }

    $.FSRTC.prototype.getVideoMute = function() {
	var self = this;
	return self.videoEnabled;
    }

    $.FSRTC.prototype.setVideoMute = function(what) {
	var self = this;
	var videoTracks = self.localStream.getVideoTracks();	

	for (var i = 0, len = videoTracks.length; i < len; i++ ) {
	    switch(what) {
	    case "on":
		videoTracks[i].enabled = true;
		break;
	    case "off":
		videoTracks[i].enabled = false;
		break;
	    case "toggle":
		videoTracks[i].enabled = !videoTracks[i].enabled;
	    default:
		break;
	    }

	    self.videoEnabled = videoTracks[i].enabled;
	}

	return !self.videoEnabled;
    }

    $.FSRTC.prototype.createAnswer = function(params) {
        var self = this;
        self.type = "answer";
        self.remoteSDP = params.sdp;
        console.debug("inbound sdp: ", params.sdp);

        function onSuccess(stream) {
            self.localStream = stream;

            self.peer = FSRTCPeerConnection({
                type: self.type,
                attachStream: self.localStream,
                onICE: function(candidate) {
                    return onICE(self, candidate);
                },
                onICEComplete: function() {
                    return onICEComplete(self);
                },
                onRemoteStream: function(stream) {
                    return onRemoteStream(self, stream);
                },
                onICESDP: function(sdp) {
                    return onICESDP(self, sdp);
                },
                onChannelError: function(e) {
                    return onChannelError(self, e);
                },
                constraints: self.constraints,
                iceServers: self.options.iceServers,
                offerSDP: {
                    type: "offer",
                    sdp: self.remoteSDP
                }
            });

            onStreamSuccess(self, stream);
        }

        function onError(e) {
            onStreamError(self, e);
        }

	var mediaParams = getMediaParams(self);

	console.log("Audio constraints", mediaParams.audio);
	console.log("Video constraints", mediaParams.video);

	if (self.options.useVideo && self.options.localVideo) {
            getUserMedia({
		constraints: {
                    audio: false,
                    video: {
			//mandatory: self.options.videoParams,
			//optional: []
                    },
		},
		localVideo: self.options.localVideo,
		onsuccess: function(e) {self.options.localVideoStream = e; console.log("local video ready");},
		onerror: function(e) {console.error("local video error!");}
            });
	}

        getUserMedia({
            constraints: {
		audio: mediaParams.audio,
		video: mediaParams.video
            },
            video: mediaParams.useVideo,
            onsuccess: onSuccess,
            onerror: onError
        });



    };

    function getMediaParams(obj) {

	var audio;

	if (obj.options.useMic && obj.options.useMic === "none") {
	    console.log("Microphone Disabled");
	    audio = false;
	} else if (obj.options.videoParams && obj.options.screenShare) {//obj.options.videoParams.chromeMediaSource == 'desktop') {
	    console.error("SCREEN SHARE", obj.options.videoParams);
	    audio = false;
	} else {
	    audio = {
	    };

	    if (obj.options.audioParams) {
	        audio = obj.options.audioParams;
        }

	    if (obj.options.useMic !== "any") {
		//audio.optional = [{sourceId: obj.options.useMic}]
		audio.deviceId = {exact: obj.options.useMic};
	    }



	}

	if (obj.options.useVideo && obj.options.localVideo) {
            getUserMedia({
		constraints: {
                    audio: false,
                    video: obj.options.videoParams
                    
		},
		localVideo: obj.options.localVideo,
		onsuccess: function(e) {self.options.localVideoStream = e; console.log("local video ready");},
		onerror: function(e) {console.error("local video error!");}
            });
	}

	var video = {};
	var bestFrameRate = obj.options.videoParams.vertoBestFrameRate;
	var minFrameRate = obj.options.videoParams.minFrameRate || 15;
	delete obj.options.videoParams.vertoBestFrameRate;

	if (obj.options.screenShare) {
	    // fix for chrome to work for now, will need to change once we figure out how to do this in a non-mandatory style constraint.
	    var opt = [];
	    opt.push({sourceId: obj.options.useCamera});

	    if (bestFrameRate) {
		opt.push({minFrameRate: bestFrameRate});
		opt.push({maxFrameRate: bestFrameRate});
	    }

	    video = {
		mandatory: obj.options.videoParams,
		optional: opt		
	    };
	} else {

	    video = {
		//mandatory: obj.options.videoParams,
		width: {min: obj.options.videoParams.minWidth, max: obj.options.videoParams.maxWidth},
		height: {min: obj.options.videoParams.minHeight, max: obj.options.videoParams.maxHeight}
	    };
	    
            
	    
	    var useVideo = obj.options.useVideo;

	    if (useVideo && obj.options.useCamera && obj.options.useCamera !== "none") {
		//if (!video.optional) {
		//video.optional = [];
		//}

		
		if (obj.options.useCamera !== "any") {
		    //video.optional.push({sourceId: obj.options.useCamera});
		    video.deviceId = obj.options.useCamera;
		}

		if (bestFrameRate) {
		    //video.optional.push({minFrameRate: bestFrameRate});
		    //video.optional.push({maxFrameRate: bestFrameRate});
		    video.frameRate = {ideal: bestFrameRate, min: minFrameRate, max: 30};
		}

	    } else {
		console.log("Camera Disabled");
		video = false;
		useVideo = false;
	    }
	}

	return {audio: audio, video: video, useVideo: useVideo};
    }
    
    $.FSRTC.prototype.call = function(profile) {
        checkCompat();
	
        var self = this;
	var screen = false;

        self.type = "offer";

	if (self.options.videoParams && self.options.screenShare) { //self.options.videoParams.chromeMediaSource == 'desktop') {
	    screen = true;
	}

        function onSuccess(stream) {
	    self.localStream = stream;
	    
	    if (screen) {
		self.constraints.offerToReceiveVideo = false;
	    }
	    
            self.peer = FSRTCPeerConnection({
                type: self.type,
                attachStream: self.localStream,
                onICE: function(candidate) {
                    return onICE(self, candidate);
                },
                onICEComplete: function() {
                    return onICEComplete(self);
                },
                onRemoteStream: screen ? function(stream) {} : function(stream) {
                    return onRemoteStream(self, stream);
                },
                onOfferSDP: function(sdp) {
                    return onOfferSDP(self, sdp);
                },
                onICESDP: function(sdp) {
                    return onICESDP(self, sdp);
                },
                onChannelError: function(e) {
                    return onChannelError(self, e);
                },
                constraints: self.constraints,
                iceServers: self.options.iceServers,
            });

            onStreamSuccess(self, stream);
        }

        function onError(e) {
            onStreamError(self, e);
        }

	var mediaParams = getMediaParams(self);

	console.log("Audio constraints", mediaParams.audio);
	console.log("Video constraints", mediaParams.video);

	if (mediaParams.audio || mediaParams.video) {

            getUserMedia({
		constraints: {
                    audio: mediaParams.audio,
                video: mediaParams.video
		},
		video: mediaParams.useVideo,
		onsuccess: onSuccess,
		onerror: onError
            });
	} else {
	    onSuccess(null);
	}



        /*
        navigator.getUserMedia({
            video: self.options.useVideo,
            audio: true
        }, onSuccess, onError);
        */

    };

    // DERIVED from RTCPeerConnection-v1.5
    // 2013, @muazkh - github.com/muaz-khan
    // MIT License - https://www.webrtc-experiment.com/licence/
    // Documentation - https://github.com/muaz-khan/WebRTC-Experiment/tree/master/RTCPeerConnection
    
    function FSRTCPeerConnection(options) {
	var gathering = false, done = false;
	var config = {};
        var default_ice = {
	    urls: ['stun:stun.l.google.com:19302']
	};

        if (options.iceServers) {
            if (typeof(options.iceServers) === "boolean") {
		config.iceServers = [default_ice];
            } else {
		config.iceServers = options.iceServers;
	    }
        }

        var peer = new window.RTCPeerConnection(config);

        openOffererChannel();
        var x = 0;

	function ice_handler() {

	    done = true;
	    gathering = null;

            if (options.onICEComplete) {
                options.onICEComplete();
            }
	    
            if (options.type == "offer") {
                options.onICESDP(peer.localDescription);
            } else {
                if (!x && options.onICESDP) {
                    options.onICESDP(peer.localDescription);
                }
            }
        }

        peer.onicecandidate = function(event) {

	    if (done) {
		return;
	    }

	    if (!gathering) {
		gathering = setTimeout(ice_handler, 1000);
	    }
	    
	    if (event) {
		if (event.candidate) {
		    options.onICE(event.candidate);
		}
	    } else {
		done = true;

		if (gathering) {
		    clearTimeout(gathering);
		    gathering = null;
		}

		ice_handler();
	    }
        };

        // attachStream = MediaStream;
        if (options.attachStream) peer.addStream(options.attachStream);

        // attachStreams[0] = audio-stream;
        // attachStreams[1] = video-stream;
        // attachStreams[2] = screen-capturing-stream;
        if (options.attachStreams && options.attachStream.length) {
            var streams = options.attachStreams;
            for (var i = 0; i < streams.length; i++) {
                peer.addStream(streams[i]);
            }
        }

        peer.onaddstream = function(event) {
            var remoteMediaStream = event.stream;

            // onRemoteStreamEnded(MediaStream)
            remoteMediaStream.oninactive = function () {
                if (options.onRemoteStreamEnded) options.onRemoteStreamEnded(remoteMediaStream);
            };

            // onRemoteStream(MediaStream)
            if (options.onRemoteStream) options.onRemoteStream(remoteMediaStream);

            //console.debug('on:add:stream', remoteMediaStream);
        };

        //var constraints = options.constraints || {
	  //  offerToReceiveAudio: true,
	    //offerToReceiveVideo: true   
        //};

        // onOfferSDP(RTCSessionDescription)
        function createOffer() {
            if (!options.onOfferSDP) return;

            peer.createOffer(function(sessionDescription) {
                sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                peer.setLocalDescription(sessionDescription);
                options.onOfferSDP(sessionDescription);
            },
				onSdpError, options.constraints);
        }

        // onAnswerSDP(RTCSessionDescription)
        function createAnswer() {
            if (options.type != "answer") return;

            //options.offerSDP.sdp = addStereo(options.offerSDP.sdp);
            peer.setRemoteDescription(new window.RTCSessionDescription(options.offerSDP), onSdpSuccess, onSdpError);
            peer.createAnswer(function(sessionDescription) {
                sessionDescription.sdp = serializeSdp(sessionDescription.sdp);
                peer.setLocalDescription(sessionDescription);
                if (options.onAnswerSDP) {
                    options.onAnswerSDP(sessionDescription);
                }
            },
            onSdpError);
        }


        if ((options.onChannelMessage) || !options.onChannelMessage) {
            createOffer();
            createAnswer();
        }

        // DataChannel Bandwidth
        function setBandwidth(sdp) {
            // remove existing bandwidth lines
            sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
            sdp = sdp.replace(/a=mid:data\r\n/g, 'a=mid:data\r\nb=AS:1638400\r\n');

            return sdp;
        }

        // old: FF<>Chrome interoperability management
        function getInteropSDP(sdp) {
            var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
            extractedChars = '';

            function getChars() {
                extractedChars += chars[parseInt(Math.random() * 40)] || '';
                if (extractedChars.length < 40) getChars();

                return extractedChars;
            }

            // usually audio-only streaming failure occurs out of audio-specific crypto line
            // a=crypto:1 AES_CM_128_HMAC_SHA1_32 --------- kAttributeCryptoVoice
            if (options.onAnswerSDP) sdp = sdp.replace(/(a=crypto:0 AES_CM_128_HMAC_SHA1_32)(.*?)(\r\n)/g, '');

            // video-specific crypto line i.e. SHA1_80
            // a=crypto:1 AES_CM_128_HMAC_SHA1_80 --------- kAttributeCryptoVideo
            var inline = getChars() + '\r\n' + (extractedChars = '');
            sdp = sdp.indexOf('a=crypto') == -1 ? sdp.replace(/c=IN/g, 'a=crypto:1 AES_CM_128_HMAC_SHA1_80 inline:' + inline + 'c=IN') : sdp;

            return sdp;
        }

        function serializeSdp(sdp) {
            return sdp;
        }

        // DataChannel management
        var channel;

        function openOffererChannel() {
            if (!options.onChannelMessage) return;

            _openOffererChannel();

            return;
        }

        function _openOffererChannel() {
            channel = peer.createDataChannel(options.channel || 'RTCDataChannel', {
                reliable: false
            });

            setChannelEvents();
        }

        function setChannelEvents() {
            channel.onmessage = function(event) {
                if (options.onChannelMessage) options.onChannelMessage(event);
            };

            channel.onopen = function() {
                if (options.onChannelOpened) options.onChannelOpened(channel);
            };
            channel.onclose = function(event) {
                if (options.onChannelClosed) options.onChannelClosed(event);

                console.warn('WebRTC DataChannel closed', event);
            };
            channel.onerror = function(event) {
                if (options.onChannelError) options.onChannelError(event);

                console.error('WebRTC DataChannel error', event);
            };
        }

        function openAnswererChannel() {
            peer.ondatachannel = function(event) {
                channel = event.channel;
                channel.binaryType = 'blob';
                setChannelEvents();
            };

            return;
        }

        // fake:true is also available on chrome under a flag!
        function useless() {
            log('Error in fake:true');
        }

        function onSdpSuccess() {}

        function onSdpError(e) {
            if (options.onChannelError) {
                options.onChannelError(e);
            }
            console.error('sdp error:', e);
        }

        return {
            addAnswerSDP: function(sdp, cbSuccess, cbError) {

                peer.setRemoteDescription(new window.RTCSessionDescription(sdp), cbSuccess ? cbSuccess : onSdpSuccess, cbError ? cbError : onSdpError);
            },
            addICE: function(candidate) {
                peer.addIceCandidate(new window.RTCIceCandidate({
                    sdpMLineIndex: candidate.sdpMLineIndex,
                    candidate: candidate.candidate
                }));
            },

            peer: peer,
            channel: channel,
            sendData: function(message) {
                if (channel) {
                    channel.send(message);
                }
            },

            stop: function() {
                peer.close();
                if (options.attachStream) {
                  if(typeof options.attachStream.stop == 'function') {
                    options.attachStream.stop();
                  } else {
                    options.attachStream.active = false;
                  }
                }
            }

        };
    }

    // getUserMedia
    var video_constraints = {
        //mandatory: {},
        //optional: []
    };

    function getUserMedia(options) {
        var n = navigator,
        media;
        n.getMedia = n.getUserMedia;
        n.getMedia(options.constraints || {
            audio: true,
            video: video_constraints
        },
        streaming, options.onerror ||
        function(e) {
            console.error(e);
        });

        function streaming(stream) {
            if (options.localVideo) {
                options.localVideo['src'] = window.URL.createObjectURL(stream);
		options.localVideo.style.display = 'block';
            }

            if (options.onsuccess) {
                options.onsuccess(stream);
            }

            media = stream;
        }

        return media;
    }

    $.FSRTC.resSupported = function(w, h) {
	for (var i in $.FSRTC.validRes) {
	    if ($.FSRTC.validRes[i][0] == w && $.FSRTC.validRes[i][1] == h) {
		return true;
	    }
	}

	return false;
    }

    $.FSRTC.bestResSupported = function() {
	var w = 0, h = 0;

	for (var i in $.FSRTC.validRes) {
	    if ($.FSRTC.validRes[i][0] >= w && $.FSRTC.validRes[i][1] >= h) {
		w = $.FSRTC.validRes[i][0];
		h = $.FSRTC.validRes[i][1];
	    }
	}

	return [w, h];
    }

    var resList = [[160, 120], [320, 180], [320, 240], [640, 360], [640, 480], [1280, 720], [1920, 1080]];
    var resI = 0;
    var ttl = 0;

    var checkRes = function (cam, func) {

	if (resI >= resList.length) {
            var res = {
               'validRes': $.FSRTC.validRes,
               'bestResSupported': $.FSRTC.bestResSupported()
            };
	    
	    localStorage.setItem("res_" + cam, $.toJSON(res));
	    
	    if (func) return func(res);
	    return;
	}

	var video = {
            //mandatory: {},
            //optional: []
        }	
	//FIXME
	if (cam) {
	    //video.optional = [{sourceId: cam}];
	    video.deviceId = {exact: cam};
	}
	
	w = resList[resI][0];
	h = resList[resI][1];
	resI++;

	video = {
	    width: w,
	    height: h
	    //"minWidth": w,
	    //"minHeight": h,
	    //"maxWidth": w,
	    //"maxHeight": h
	};

	getUserMedia({
	    constraints: {
                audio: ttl++ == 0,
                video: video	    
	    },
	    onsuccess: function(e) {
		e.getTracks().forEach(function(track) {track.stop();});
		console.info(w + "x" + h + " supported."); $.FSRTC.validRes.push([w, h]); checkRes(cam, func);},
	    onerror: function(e) {console.warn( w + "x" + h + " not supported."); checkRes(cam, func);}
        });
    }
    

    $.FSRTC.getValidRes = function (cam, func) {
	var used = [];
	var cached = localStorage.getItem("res_" + cam);
	
	if (cached) {
	    var cache = $.parseJSON(cached);

	    if (cache) {
		$.FSRTC.validRes = cache.validRes;
		console.log("CACHED RES FOR CAM " + cam, cache);
	    } else {
		console.error("INVALID CACHE");
	    }
	    return func ? func(cache) : null;
	}


	$.FSRTC.validRes = [];
	resI = 0;

	checkRes(cam, func);
    }

    $.FSRTC.checkPerms = function (runtime, check_audio, check_video) {
	getUserMedia({
	    constraints: {
		audio: check_audio,
		video: check_video,
	    },
	    onsuccess: function(e) {
		e.getTracks().forEach(function(track) {track.stop();});
		
		console.info("media perm init complete"); 
		if (runtime) {
                    setTimeout(runtime, 100, true);
		}
            },
	    onerror: function(e) {
		if (check_video && check_audio) {
		    console.error("error, retesting with audio params only");
		    return $.FSRTC.checkPerms(runtime, check_audio, false);
		}

		console.error("media perm init error");

		if (runtime) {
		    runtime(false)
		}
	    }
	});
    }

})(jQuery);
/*
 * Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 * Copyright (C) 2005-2014, Anthony Minessale II <anthm@freeswitch.org>
 *
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is jquery.jsonrpclient.js modified for Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 *
 * The Initial Developer of the Original Code is
 * Textalk AB http://textalk.se/
 * Portions created by the Initial Developer are Copyright (C)
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Anthony Minessale II <anthm@freeswitch.org>
 *
 * jquery.jsonrpclient.js - JSON RPC client code
 *
 */
/**
 * This plugin requires jquery.json.js to be available, or at least the methods $.toJSON and
 * $.parseJSON.
 *
 * The plan is to make use of websockets if they are available, but work just as well with only
 * http if not.
 *
 * Usage example:
 *
 *   var foo = new $.JsonRpcClient({ ajaxUrl: '/backend/jsonrpc' });
 *   foo.call(
 *     'bar', [ 'A parameter', 'B parameter' ],
 *     function(result) { alert('Foo bar answered: ' + result.my_answer); },
 *     function(error)  { console.log('There was an error', error); }
 *   );
 *
 * More examples are available in README.md
 */
(function($) {
  /**
   * @fn new
   * @memberof $.JsonRpcClient
   *
   * @param options An object stating the backends:
   *                ajaxUrl    A url (relative or absolute) to a http(s) backend.
   *                socketUrl  A url (relative of absolute) to a ws(s) backend.
   *                onmessage  A socket message handler for other messages (non-responses).
   *                getSocket  A function returning a WebSocket or null.
   *                           It must take an onmessage_cb and bind it to the onmessage event
   *                           (or chain it before/after some other onmessage handler).
   *                           Or, it could return null if no socket is available.
   *                           The returned instance must have readyState <= 1, and if less than 1,
   *                           react to onopen binding.
   */
    $.JsonRpcClient = function(options) {
        var self = this;
        this.options = $.extend({
            ajaxUrl       : null,
            socketUrl     : null, ///< The ws-url for default getSocket.
            onmessage     : null, ///< Other onmessage-handler.
            login         : null, /// auth login
            passwd        : null, /// auth passwd
            sessid        : null,
	    loginParams   : null,
	    userVariables : null,
            getSocket     : function(onmessage_cb) { return self._getSocket(onmessage_cb); }
        }, options);

        self.ws_cnt = 0;

        // Declare an instance version of the onmessage callback to wrap 'this'.
        this.wsOnMessage = function(event) { self._wsOnMessage(event); };
    };

    /// Holding the WebSocket on default getsocket.
    $.JsonRpcClient.prototype._ws_socket = null;

    /// Object <id>: { success_cb: cb, error_cb: cb }
    $.JsonRpcClient.prototype._ws_callbacks = {};

    /// The next JSON-RPC request id.
    $.JsonRpcClient.prototype._current_id = 1;


    $.JsonRpcClient.prototype.speedTest = function (bytes, cb) {
        var socket = this.options.getSocket(this.wsOnMessage);
	if (socket !== null) {
	    this.speedCB = cb;
	    this.speedBytes = bytes;
	    socket.send("#SPU " + bytes);

	    var loops = bytes / 1024;
	    var rem = bytes % 1024;
	    var i;
	    var data = new Array(1024).join(".");
	    for (i = 0; i < loops; i++) {
		socket.send("#SPB " + data);
	    }
	    
	    if (rem) {
		socket.send("#SPB " + data);
	    }

	    socket.send("#SPE");
	}
    };



    /**
     * @fn call
     * @memberof $.JsonRpcClient
     *
     * @param method     The method to run on JSON-RPC server.
     * @param params     The params; an array or object.
     * @param success_cb A callback for successful request.
     * @param error_cb   A callback for error.
     */
    $.JsonRpcClient.prototype.call = function(method, params, success_cb, error_cb) {
    // Construct the JSON-RPC 2.0 request.

        if (!params) {
            params = {};
        }

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        var request = {
            jsonrpc : '2.0',
            method  : method,
            params  : params,
            id      : this._current_id++  // Increase the id counter to match request/response
        };

        if (!success_cb) {
            success_cb = function(e){console.log("Success: ", e);};
        }

        if (!error_cb) {
            error_cb = function(e){console.log("Error: ", e);};
        }

        // Try making a WebSocket call.
        var socket = this.options.getSocket(this.wsOnMessage);
        if (socket !== null) {
            this._wsCall(socket, request, success_cb, error_cb);
            return;
        }

        // No WebSocket, and no HTTP backend?  This won't work.
        if (this.options.ajaxUrl === null) {
            throw "$.JsonRpcClient.call used with no websocket and no http endpoint.";
        }

        $.ajax({
            type     : 'POST',
            url      : this.options.ajaxUrl,
            data     : $.toJSON(request),
            dataType : 'json',
            cache    : false,

            success  : function(data) {
                if ('error' in data) error_cb(data.error, this);
                success_cb(data.result, this);
            },

            // JSON-RPC Server could return non-200 on error
            error    : function(jqXHR, textStatus, errorThrown) {
                try {
                    var response = $.parseJSON(jqXHR.responseText);

                    if ('console' in window) console.log(response);

                    error_cb(response.error, this);
                } catch (err) {
                    // Perhaps the responseText wasn't really a jsonrpc-error.
                    error_cb({ error: jqXHR.responseText }, this);
                }
            }
        });
    };

    /**
     * Notify sends a command to the server that won't need a response.  In http, there is probably
     * an empty response - that will be dropped, but in ws there should be no response at all.
     *
     * This is very similar to call, but has no id and no handling of callbacks.
     *
     * @fn notify
     * @memberof $.JsonRpcClient
     *
     * @param method     The method to run on JSON-RPC server.
     * @param params     The params; an array or object.
     */
    $.JsonRpcClient.prototype.notify = function(method, params) {
        // Construct the JSON-RPC 2.0 request.

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        var request = {
            jsonrpc: '2.0',
            method:  method,
            params:  params
        };

        // Try making a WebSocket call.
        var socket = this.options.getSocket(this.wsOnMessage);
        if (socket !== null) {
            this._wsCall(socket, request);
            return;
        }

        // No WebSocket, and no HTTP backend?  This won't work.
        if (this.options.ajaxUrl === null) {
            throw "$.JsonRpcClient.notify used with no websocket and no http endpoint.";
        }

        $.ajax({
            type     : 'POST',
            url      : this.options.ajaxUrl,
            data     : $.toJSON(request),
            dataType : 'json',
            cache    : false
        });
    };

    /**
     * Make a batch-call by using a callback.
     *
     * The callback will get an object "batch" as only argument.  On batch, you can call the methods
     * "call" and "notify" just as if it was a normal $.JsonRpcClient object, and all calls will be
     * sent as a batch call then the callback is done.
     *
     * @fn batch
     * @memberof $.JsonRpcClient
     *
     * @param callback    The main function which will get a batch handler to run call and notify on.
     * @param all_done_cb A callback function to call after all results have been handled.
     * @param error_cb    A callback function to call if there is an error from the server.
     *                    Note, that batch calls should always get an overall success, and the
     *                    only error
     */
    $.JsonRpcClient.prototype.batch = function(callback, all_done_cb, error_cb) {
        var batch = new $.JsonRpcClient._batchObject(this, all_done_cb, error_cb);
        callback(batch);
        batch._execute();
    };

    /**
     * The default getSocket handler.
     *
     * @param onmessage_cb The callback to be bound to onmessage events on the socket.
     *
     * @fn _getSocket
     * @memberof $.JsonRpcClient
     */

    $.JsonRpcClient.prototype.socketReady = function() {
        if (this._ws_socket === null || this._ws_socket.readyState > 1) {
            return false;
        }

        return true;
    };

    $.JsonRpcClient.prototype.closeSocket = function() {
	var self = this;
        if (self.socketReady()) {
            self._ws_socket.onclose = function (w) {console.log("Closing Socket");};
            self._ws_socket.close();
        }
    };

    $.JsonRpcClient.prototype.loginData = function(params) {
	var self = this;
        self.options.login = params.login;
        self.options.passwd = params.passwd;
	self.options.loginParams = params.loginParams;
	self.options.userVariables = params.userVariables;
    };

    $.JsonRpcClient.prototype.connectSocket = function(onmessage_cb) {
        var self = this;

        if (self.to) {
            clearTimeout(self.to);
        }

        if (!self.socketReady()) {
            self.authing = false;

            if (self._ws_socket) {
                delete self._ws_socket;
            }

            // No socket, or dying socket, let's get a new one.
            self._ws_socket = new WebSocket(self.options.socketUrl);

            if (self._ws_socket) {
                // Set up onmessage handler.
                self._ws_socket.onmessage = onmessage_cb;
                self._ws_socket.onclose = function (w) {
                    if (!self.ws_sleep) {
                        self.ws_sleep = 1000;
                    }

                    if (self.options.onWSClose) {
                        self.options.onWSClose(self);
                    }

                    console.error("Websocket Lost " + self.ws_cnt + " sleep: " + self.ws_sleep + "msec");

                    self.to = setTimeout(function() {
                        console.log("Attempting Reconnection....");
                        self.connectSocket(onmessage_cb);
                    }, self.ws_sleep);

                    self.ws_cnt++;

                    if (self.ws_sleep < 3000 && (self.ws_cnt % 10) === 0) {
                        self.ws_sleep += 1000;
                    }
                };

                // Set up sending of message for when the socket is open.
                self._ws_socket.onopen = function() {
                    if (self.to) {
                        clearTimeout(self.to);
                    }
                    self.ws_sleep = 1000;
                    self.ws_cnt = 0;
                    if (self.options.onWSConnect) {
                        self.options.onWSConnect(self);
                    }

                    var req;
                    // Send the requests.
                    while ((req = $.JsonRpcClient.q.pop())) {
                        self._ws_socket.send(req);
                    }
                };
            }
        }

        return self._ws_socket ? true : false;
    };

    $.JsonRpcClient.prototype._getSocket = function(onmessage_cb) {
        // If there is no ws url set, we don't have a socket.
        // Likewise, if there is no window.WebSocket.
        if (this.options.socketUrl === null || !("WebSocket" in window)) return null;

        this.connectSocket(onmessage_cb);

        return this._ws_socket;
    };

    /**
     * Queue to save messages delivered when websocket is not ready
     */
    $.JsonRpcClient.q = [];

    /**
     * Internal handler to dispatch a JRON-RPC request through a websocket.
     *
     * @fn _wsCall
     * @memberof $.JsonRpcClient
     */
    $.JsonRpcClient.prototype._wsCall = function(socket, request, success_cb, error_cb) {
        var request_json = $.toJSON(request);

        if (socket.readyState < 1) {
            // The websocket is not open yet; we have to set sending of the message in onopen.
            self = this; // In closure below, this is set to the WebSocket.  Use self instead.
            $.JsonRpcClient.q.push(request_json);
        } else {
            // We have a socket and it should be ready to send on.
            socket.send(request_json);
        }

        // Setup callbacks.  If there is an id, this is a call and not a notify.
        if ('id' in request && typeof success_cb !== 'undefined') {
            this._ws_callbacks[request.id] = { request: request_json, request_obj: request, success_cb: success_cb, error_cb: error_cb };
        }
    };

    /**
     * Internal handler for the websocket messages.  It determines if the message is a JSON-RPC
     * response, and if so, tries to couple it with a given callback.  Otherwise, it falls back to
     * given external onmessage-handler, if any.
     *
     * @param event The websocket onmessage-event.
     */
    $.JsonRpcClient.prototype._wsOnMessage = function(event) {
        // Check if this could be a JSON RPC message.
        var response;

	// Special sub proto
	if (event.data[0] == "#" && event.data[1] == "S" && event.data[2] == "P") {
	    if (event.data[3] == "U") {
		this.up_dur = parseInt(event.data.substring(4));
	    } else if (this.speedCB && event.data[3] == "D") {
		this.down_dur = parseInt(event.data.substring(4));

		var up_kps = (((this.speedBytes * 8) / (this.up_dur / 1000)) / 1024).toFixed(0);
		var down_kps = (((this.speedBytes * 8) / (this.down_dur / 1000)) / 1024).toFixed(0);
		
		console.info("Speed Test: Up: " + up_kps + " Down: " + down_kps);
		this.speedCB(event, { upDur: this.up_dur, downDur: this.down_dur, upKPS: up_kps, downKPS: down_kps });
		this.speedCB = null;
	    }
	    
	    return;
	}


        try {
            response = $.parseJSON(event.data);

            /// @todo Make using the jsonrcp 2.0 check optional, to use this on JSON-RPC 1 backends.

            if (typeof response === 'object' &&
                'jsonrpc' in response &&
                response.jsonrpc === '2.0') {

                /// @todo Handle bad response (without id).

                // If this is an object with result, it is a response.
                if ('result' in response && this._ws_callbacks[response.id]) {
                    // Get the success callback.
                    var success_cb = this._ws_callbacks[response.id].success_cb;

    /*
                    // set the sessid if present
                    if ('sessid' in response.result && !this.options.sessid || (this.options.sessid != response.result.sessid)) {
                        this.options.sessid = response.result.sessid;
                        if (this.options.sessid) {
                            console.log("setting session UUID to: " + this.options.sessid);
                        }
                    }
    */
                    // Delete the callback from the storage.
                    delete this._ws_callbacks[response.id];

                    // Run callback with result as parameter.
                    success_cb(response.result, this);
                    return;
                } else if ('error' in response && this._ws_callbacks[response.id]) {
                // If this is an object with error, it is an error response.

                // Get the error callback.
                    var error_cb = this._ws_callbacks[response.id].error_cb;
                    var orig_req = this._ws_callbacks[response.id].request;

                    // if this is an auth request, send the credentials and resend the failed request
                    if (!self.authing && response.error.code == -32000 && self.options.login && self.options.passwd) {
                        self.authing = true;

                        this.call("login", { login: self.options.login, passwd: self.options.passwd, loginParams: self.options.loginParams,
					     userVariables: self.options.userVariables},
                            this._ws_callbacks[response.id].request_obj.method == "login" ?
                            function(e) {
                                self.authing = false;
                                console.log("logged in");
                                delete self._ws_callbacks[response.id];

                                if (self.options.onWSLogin) {
                                    self.options.onWSLogin(true, self);
                                }
                            }

                            :

                            function(e) {
                                self.authing = false;
                                console.log("logged in, resending request id: " + response.id);
                                var socket = self.options.getSocket(self.wsOnMessage);
                                if (socket !== null) {
                                    socket.send(orig_req);
                                }
                                if (self.options.onWSLogin) {
                                    self.options.onWSLogin(true, self);
                                }
                            },

                            function(e) {
                                console.log("error logging in, request id:", response.id);
                                delete self._ws_callbacks[response.id];
                                error_cb(response.error, this);
                                if (self.options.onWSLogin) {
                                self.options.onWSLogin(false, self);
                                }
                            });
                            return;
                        }

                        // Delete the callback from the storage.
                        delete this._ws_callbacks[response.id];

                        // Run callback with the error object as parameter.
                        error_cb(response.error, this);
                        return;
                    }
                }
            } catch (err) {
            // Probably an error while parsing a non json-string as json.  All real JSON-RPC cases are
            // handled above, and the fallback method is called below.
            console.log("ERROR: "+ err);
            return;
        }

        // This is not a JSON-RPC response.  Call the fallback message handler, if given.
        if (typeof this.options.onmessage === 'function') {
            event.eventData = response;
            if (!event.eventData) {
                event.eventData = {};
            }

            var reply = this.options.onmessage(event);

            if (reply && typeof reply === "object" && event.eventData.id) {
                var msg = {
                    jsonrpc: "2.0",
                    id: event.eventData.id,
                    result: reply
                };

                var socket = self.options.getSocket(self.wsOnMessage);
                if (socket !== null) {
                    socket.send($.toJSON(msg));
                }
            }
        }
    };


    /************************************************************************************************
     * Batch object with methods
     ************************************************************************************************/

    /**
     * Handling object for batch calls.
     */
    $.JsonRpcClient._batchObject = function(jsonrpcclient, all_done_cb, error_cb) {
        // Array of objects to hold the call and notify requests.  Each objects will have the request
        // object, and unless it is a notify, success_cb and error_cb.
        this._requests   = [];

        this.jsonrpcclient = jsonrpcclient;
        this.all_done_cb = all_done_cb;
        this.error_cb    = typeof error_cb === 'function' ? error_cb : function() {};

    };

    /**
     * @sa $.JsonRpcClient.prototype.call
     */
    $.JsonRpcClient._batchObject.prototype.call = function(method, params, success_cb, error_cb) {

        if (!params) {
            params = {};
        }

        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        if (!success_cb) {
            success_cb = function(e){console.log("Success: ", e);};
        }

        if (!error_cb) {
        error_cb = function(e){console.log("Error: ", e);};
        }

        this._requests.push({
            request    : {
            jsonrpc : '2.0',
            method  : method,
            params  : params,
            id      : this.jsonrpcclient._current_id++  // Use the client's id series.
        },
            success_cb : success_cb,
            error_cb   : error_cb
        });
    };

    /**
     * @sa $.JsonRpcClient.prototype.notify
     */
    $.JsonRpcClient._batchObject.prototype.notify = function(method, params) {
        if (this.options.sessid) {
            params.sessid = this.options.sessid;
        }

        this._requests.push({
            request    : {
                jsonrpc : '2.0',
                method  : method,
                params  : params
            }
        });
    };

    /**
     * Executes the batched up calls.
     */
    $.JsonRpcClient._batchObject.prototype._execute = function() {
        var self = this;

        if (this._requests.length === 0) return; // All done :P

        // Collect all request data and sort handlers by request id.
        var batch_request = [];
        var handlers = {};
        var i = 0;
        var call;
        var success_cb;
        var error_cb;

        // If we have a WebSocket, just send the requests individually like normal calls.
        var socket = self.jsonrpcclient.options.getSocket(self.jsonrpcclient.wsOnMessage);
        if (socket !== null) {
            for (i = 0; i < this._requests.length; i++) {
                call = this._requests[i];
                success_cb = ('success_cb' in call) ? call.success_cb : undefined;
                error_cb   = ('error_cb'   in call) ? call.error_cb   : undefined;
                self.jsonrpcclient._wsCall(socket, call.request, success_cb, error_cb);
            }

            if (typeof all_done_cb === 'function') all_done_cb(result);
            return;
        }

        for (i = 0; i < this._requests.length; i++) {
            call = this._requests[i];
            batch_request.push(call.request);

            // If the request has an id, it should handle returns (otherwise it's a notify).
            if ('id' in call.request) {
                handlers[call.request.id] = {
                    success_cb : call.success_cb,
                    error_cb   : call.error_cb
                };
            }
        }

        success_cb = function(data) { self._batchCb(data, handlers, self.all_done_cb); };

        // No WebSocket, and no HTTP backend?  This won't work.
        if (self.jsonrpcclient.options.ajaxUrl === null) {
            throw "$.JsonRpcClient.batch used with no websocket and no http endpoint.";
        }

        // Send request
        $.ajax({
            url      : self.jsonrpcclient.options.ajaxUrl,
            data     : $.toJSON(batch_request),
            dataType : 'json',
            cache    : false,
            type     : 'POST',

            // Batch-requests should always return 200
            error    : function(jqXHR, textStatus, errorThrown) {
                self.error_cb(jqXHR, textStatus, errorThrown);
            },
            success  : success_cb
        });
    };

    /**
     * Internal helper to match the result array from a batch call to their respective callbacks.
     *
     * @fn _batchCb
     * @memberof $.JsonRpcClient
     */
    $.JsonRpcClient._batchObject.prototype._batchCb = function(result, handlers, all_done_cb) {
        for (var i = 0; i < result.length; i++) {
            var response = result[i];

            // Handle error
            if ('error' in response) {
                if (response.id === null || !(response.id in handlers)) {
                    // An error on a notify?  Just log it to the console.
                    if ('console' in window) console.log(response);
                } else {
                    handlers[response.id].error_cb(response.error, this);
                }
            } else {
                // Here we should always have a correct id and no error.
                if (!(response.id in handlers) && 'console' in window) {
                    console.log(response);
                } else {
                    handlers[response.id].success_cb(response.result, this);
                }
            }
        }

        if (typeof all_done_cb === 'function') all_done_cb(result);
    };

})(jQuery);

/*
 * Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 * Copyright (C) 2005-2014, Anthony Minessale II <anthm@freeswitch.org>
 *
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Verto HTML5/Javascript Telephony Signaling and Control Protocol Stack for FreeSWITCH
 *
 * The Initial Developer of the Original Code is
 * Anthony Minessale II <anthm@freeswitch.org>
 * Portions created by the Initial Developer are Copyright (C)
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Anthony Minessale II <anthm@freeswitch.org>
 *
 * jquery.verto.js - Main interface
 *
 */

(function($) {
    var sources = [];

    var generateGUID = (typeof(window.crypto) !== 'undefined' && typeof(window.crypto.getRandomValues) !== 'undefined') ?
    function() {
        // If we have a cryptographically secure PRNG, use that
        // http://stackoverflow.com/questions/6906916/collisions-when-generating-uuids-in-javascript
        var buf = new Uint16Array(8);
        window.crypto.getRandomValues(buf);
        var S4 = function(num) {
            var ret = num.toString(16);
            while (ret.length < 4) {
                ret = "0" + ret;
            }
            return ret;
        };
        return (S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-" + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]));
    }

    :

    function() {
        // Otherwise, just use Math.random
        // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    /// MASTER OBJ
    $.verto = function(options, callbacks) {
        var verto = this;

        $.verto.saved.push(verto);

        verto.options = $.extend({
            login: null,
            passwd: null,
            socketUrl: null,
            tag: null,
	    localTag: null,
            videoParams: {},
            audioParams: {},
	    loginParams: {},
	    deviceParams: {onResCheck: null},
	    userVariables: {},
            iceServers: false,
            ringSleep: 6000,
	    sessid: null
        }, options);

	if (verto.options.deviceParams.useCamera) {
	    $.FSRTC.getValidRes(verto.options.deviceParams.useCamera, verto.options.deviceParams.onResCheck);
	}

	if (!verto.options.deviceParams.useMic) {
	    verto.options.deviceParams.useMic = "any";
	}

	if (!verto.options.deviceParams.useSpeak) {
	    verto.options.deviceParams.useSpeak = "any";
	}

	if (verto.options.sessid) {
	    verto.sessid = verto.options.sessid;
	} else {
            verto.sessid = localStorage.getItem("verto_session_uuid") || generateGUID();
	    localStorage.setItem("verto_session_uuid", verto.sessid);
	}

        verto.dialogs = {};
        verto.callbacks = callbacks || {};
        verto.eventSUBS = {};

        verto.rpcClient = new $.JsonRpcClient({
            login: verto.options.login,
            passwd: verto.options.passwd,
            socketUrl: verto.options.socketUrl,
	    loginParams: verto.options.loginParams,
	    userVariables: verto.options.userVariables,
            sessid: verto.sessid,
            onmessage: function(e) {
                return verto.handleMessage(e.eventData);
            },
            onWSConnect: function(o) {
                o.call('login', {});
            },
            onWSLogin: function(success) {
                if (verto.callbacks.onWSLogin) {
                    verto.callbacks.onWSLogin(verto, success);
                }
            },
            onWSClose: function(success) {
                if (verto.callbacks.onWSClose) {
                    verto.callbacks.onWSClose(verto, success);
                }
                verto.purge();
            }
        });

        var tag = verto.options.tag;
        if (typeof(tag) === "function") {
          tag = tag();
        }

        if (verto.options.ringFile && verto.options.tag) {
            verto.ringer = $("#" + tag);
        }

        verto.rpcClient.call('login', {});

    };


    $.verto.prototype.deviceParams = function(obj) {
        var verto = this;

	for (var i in obj) {
            verto.options.deviceParams[i] = obj[i];
	}

	if (obj.useCamera) {
	    $.FSRTC.getValidRes(verto.options.deviceParams.useCamera, obj ? obj.onResCheck : undefined);
	}
    };

    $.verto.prototype.videoParams = function(obj) {
        var verto = this;

	for (var i in obj) {
            verto.options.videoParams[i] = obj[i];
	}
    };

    $.verto.prototype.iceServers = function(obj) {
        var verto = this;
        verto.options.iceServers = obj;
    };

    $.verto.prototype.loginData = function(params) {
	var verto = this;
        verto.options.login = params.login;
        verto.options.passwd = params.passwd;
        verto.rpcClient.loginData(params);
    };

    $.verto.prototype.logout = function(msg) {
        var verto = this;
        verto.rpcClient.closeSocket();
        if (verto.callbacks.onWSClose) {
            verto.callbacks.onWSClose(verto, false);
        }
        verto.purge();
    };

    $.verto.prototype.login = function(msg) {
        var verto = this;
        verto.logout();
        verto.rpcClient.call('login', {});
    };

    $.verto.prototype.message = function(msg) {
        var verto = this;
        var err = 0;

        if (!msg.to) {
            console.error("Missing To");
            err++;
        }

        if (!msg.body) {
            console.error("Missing Body");
            err++;
        }

        if (err) {
            return false;
        }

        verto.sendMethod("verto.info", {
            msg: msg
        });

        return true;
    };

    $.verto.prototype.processReply = function(method, success, e) {
        var verto = this;
        var i;

        //console.log("Response: " + method, success, e);

        switch (method) {
        case "verto.subscribe":
            for (i in e.unauthorizedChannels) {
                drop_bad(verto, e.unauthorizedChannels[i]);
            }
            for (i in e.subscribedChannels) {
                mark_ready(verto, e.subscribedChannels[i]);
            }

            break;
        case "verto.unsubscribe":
            //console.error(e);
            break;
        }
    };

    $.verto.prototype.sendMethod = function(method, params) {
        var verto = this;

        verto.rpcClient.call(method, params,

        function(e) {
            /* Success */
            verto.processReply(method, true, e);
        },

        function(e) {
            /* Error */
            verto.processReply(method, false, e);
        });
    };

    function do_sub(verto, channel, obj) {

    }

    function drop_bad(verto, channel) {
        console.error("drop unauthorized channel: " + channel);
        delete verto.eventSUBS[channel];
    }

    function mark_ready(verto, channel) {
        for (var j in verto.eventSUBS[channel]) {
            console.error("jjjj", j);
            verto.eventSUBS[channel][j].ready = true;
            console.log("jjjj subscribed to channel: " + channel);
            if (verto.eventSUBS[channel][j].readyHandler) {
                verto.eventSUBS[channel][j].readyHandler(verto, channel);
            }
        }
    }

    var SERNO = 1;

    function do_subscribe(verto, channel, subChannels, sparams) {
        var params = sparams || {};

        var local = params.local;

        var obj = {
            eventChannel: channel,
            userData: params.userData,
            handler: params.handler,
            ready: false,
            readyHandler: params.readyHandler,
            serno: SERNO++
        };

        var isnew = false;

        if (!verto.eventSUBS[channel]) {
            verto.eventSUBS[channel] = [];
            subChannels.push(channel);
            isnew = true;
        }

        verto.eventSUBS[channel].push(obj);

        if (local) {
            obj.ready = true;
            obj.local = true;
        }

        if (!isnew && verto.eventSUBS[channel][0].ready) {
            obj.ready = true;
            if (obj.readyHandler) {
                obj.readyHandler(verto, channel);
            }
        }

        return {
            serno: obj.serno,
            eventChannel: channel
        };

    }

    $.verto.prototype.subscribe = function(channel, sparams) {
        var verto = this;
        var r = [];
        var subChannels = [];
        var params = sparams || {};

        if (typeof(channel) === "string") {
            r.push(do_subscribe(verto, channel, subChannels, params));
        } else {
            for (var i in channel) {
                r.push(do_subscribe(verto, channel, subChannels, params));
            }
        }

        if (subChannels.length) {
            verto.sendMethod("verto.subscribe", {
                eventChannel: subChannels.length == 1 ? subChannels[0] : subChannels,
                subParams: params.subParams
            });
        }

        return r;
    };

    $.verto.prototype.unsubscribe = function(handle) {
        var verto = this;
        var i;

        if (!handle) {
            for (i in verto.eventSUBS) {
                if (verto.eventSUBS[i]) {
                    verto.unsubscribe(verto.eventSUBS[i]);
                }
            }
        } else {
            var unsubChannels = {};
            var sendChannels = [];
            var channel;

            if (typeof(handle) == "string") {
                delete verto.eventSUBS[handle];
                unsubChannels[handle]++;
            } else {
                for (i in handle) {
                    if (typeof(handle[i]) == "string") {
                        channel = handle[i];
                        delete verto.eventSUBS[channel];
                        unsubChannels[channel]++;
                    } else {
                        var repl = [];
                        channel = handle[i].eventChannel;

                        for (var j in verto.eventSUBS[channel]) {
                            if (verto.eventSUBS[channel][j].serno == handle[i].serno) {} else {
                                repl.push(verto.eventSUBS[channel][j]);
                            }
                        }

                        verto.eventSUBS[channel] = repl;

                        if (verto.eventSUBS[channel].length === 0) {
                            delete verto.eventSUBS[channel];
                            unsubChannels[channel]++;
                        }
                    }
                }
            }

            for (var u in unsubChannels) {
                console.log("Sending Unsubscribe for: ", u);
                sendChannels.push(u);
            }

            if (sendChannels.length) {
                verto.sendMethod("verto.unsubscribe", {
                    eventChannel: sendChannels.length == 1 ? sendChannels[0] : sendChannels
                });
            }
        }
    };

    $.verto.prototype.broadcast = function(channel, params) {
        var verto = this;
        var msg = {
            eventChannel: channel,
            data: {}
        };
        for (var i in params) {
            msg.data[i] = params[i];
        }
        verto.sendMethod("verto.broadcast", msg);
    };

    $.verto.prototype.purge = function(callID) {
        var verto = this;
        var x = 0;
        var i;

        for (i in verto.dialogs) {
            if (!x) {
                console.log("purging dialogs");
            }
            x++;
            verto.dialogs[i].setState($.verto.enum.state.purge);
        }

        for (i in verto.eventSUBS) {
            if (verto.eventSUBS[i]) {
                console.log("purging subscription: " + i);
                delete verto.eventSUBS[i];
            }
        }
    };

    $.verto.prototype.hangup = function(callID) {
        var verto = this;
        if (callID) {
            var dialog = verto.dialogs[callID];

            if (dialog) {
                dialog.hangup();
            }
        } else {
            for (var i in verto.dialogs) {
                verto.dialogs[i].hangup();
            }
        }
    };

    $.verto.prototype.newCall = function(args, callbacks) {
        var verto = this;

        if (!verto.rpcClient.socketReady()) {
            console.error("Not Connected...");
            return;
        }

        var dialog = new $.verto.dialog($.verto.enum.direction.outbound, this, args);

        dialog.invite();

        if (callbacks) {
            dialog.callbacks = callbacks;
        }

        return dialog;
    };

    $.verto.prototype.handleMessage = function(data) {
        var verto = this;

        if (!(data && data.method)) {
            console.error("Invalid Data", data);
            return;
        }

        if (data.params.callID) {
            var dialog = verto.dialogs[data.params.callID];
	    
	    if (data.method === "verto.attach" && dialog) {
		delete dialog.verto.dialogs[dialog.callID];
		dialog.rtc.stop();
		dialog = null;
	    }

            if (dialog) {

                switch (data.method) {
                case 'verto.bye':
                    dialog.hangup(data.params);
                    break;
                case 'verto.answer':
                    dialog.handleAnswer(data.params);
                    break;
                case 'verto.media':
                    dialog.handleMedia(data.params);
                    break;
                case 'verto.display':
                    dialog.handleDisplay(data.params);
                    break;
                case 'verto.info':
                    dialog.handleInfo(data.params);
                    break;
                default:
                    console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", dialog, data.method);
                    break;
                }
            } else {

                switch (data.method) {
                case 'verto.attach':
                    data.params.attach = true;

                    if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
                        data.params.useVideo = true;
                    }

                    if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
                        data.params.useStereo = true;
                    }

                    dialog = new $.verto.dialog($.verto.enum.direction.inbound, verto, data.params);
                    dialog.setState($.verto.enum.state.recovering);

                    break;
                case 'verto.invite':

                    if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
                        data.params.wantVideo = true;
                    }

                    if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
                        data.params.useStereo = true;
                    }

                    dialog = new $.verto.dialog($.verto.enum.direction.inbound, verto, data.params);
                    break;
                default:
                    console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED");
                    break;
                }
            }

            return {
                method: data.method
            };
        } else {
            switch (data.method) {
            case 'verto.punt':
                verto.purge();
		verto.logout();
		break;
            case 'verto.event':
                var list = null;
                var key = null;

                if (data.params) {
                    key = data.params.eventChannel;
                }

                if (key) {
                    list = verto.eventSUBS[key];

                    if (!list) {
                        list = verto.eventSUBS[key.split(".")[0]];
                    }
                }

                if (!list && key && key === verto.sessid) {
                    if (verto.callbacks.onMessage) {
                        verto.callbacks.onMessage(verto, null, $.verto.enum.message.pvtEvent, data.params);
                    }
                } else if (!list && key && verto.dialogs[key]) {
                    verto.dialogs[key].sendMessage($.verto.enum.message.pvtEvent, data.params);
                } else if (!list) {
                    if (!key) {
                        key = "UNDEFINED";
                    }
                    console.error("UNSUBBED or invalid EVENT " + key + " IGNORED");
                } else {
                    for (var i in list) {
                        var sub = list[i];

                        if (!sub || !sub.ready) {
                            console.error("invalid EVENT for " + key + " IGNORED");
                        } else if (sub.handler) {
                            sub.handler(verto, data.params, sub.userData);
                        } else if (verto.callbacks.onEvent) {
                            verto.callbacks.onEvent(verto, data.params, sub.userData);
                        } else {
                            console.log("EVENT:", data.params);
                        }
                    }
                }

                break;

            case "verto.info":
                if (verto.callbacks.onMessage) {
                    verto.callbacks.onMessage(verto, null, $.verto.enum.message.info, data.params.msg);
                }
                //console.error(data);
                console.debug("MESSAGE from: " + data.params.msg.from, data.params.msg.body);

                break;

            default:
                console.error("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", data.method);
                break;
            }
        }
    };

    var del_array = function(array, name) {
        var r = [];
        var len = array.length;

        for (var i = 0; i < len; i++) {
            if (array[i] != name) {
                r.push(array[i]);
            }
        }

        return r;
    };

    var hashArray = function() {
        var vha = this;

        var hash = {};
        var array = [];

        vha.reorder = function(a) {
            array = a;
            var h = hash;
            hash = {};

            var len = array.length;

            for (var i = 0; i < len; i++) {
                var key = array[i];
                if (h[key]) {
                    hash[key] = h[key];
                    delete h[key];
                }
            }
            h = undefined;
        };

        vha.clear = function() {
            hash = undefined;
            array = undefined;
            hash = {};
            array = [];
        };

        vha.add = function(name, val, insertAt) {
            var redraw = false;

            if (!hash[name]) {
                if (insertAt === undefined || insertAt < 0 || insertAt >= array.length) {
                    array.push(name);
                } else {
                    var x = 0;
                    var n = [];
                    var len = array.length;

                    for (var i = 0; i < len; i++) {
                        if (x++==insertAt) {
                            n.push(name);
                        }
                        n.push(array[i]);
                    }

                    array = undefined;
                    array = n;
                    n = undefined;
                    redraw = true;
                }
            }

            hash[name] = val;

            return redraw;
        };

        vha.del = function(name) {
            var r = false;

            if (hash[name]) {
                array = del_array(array, name);
                delete hash[name];
                r = true;
            } else {
                console.error("can't del nonexistant key " + name);
            }

            return r;
        };

        vha.get = function(name) {
            return hash[name];
        };

        vha.order = function() {
            return array;
        };

        vha.hash = function() {
            return hash;
        };

        vha.indexOf = function(name) {
            var len = array.length;

            for (var i = 0; i < len; i++) {
                if (array[i] == name) {
                    return i;
                }
            }
        };

        vha.arrayLen = function() {
            return array.length;
        };

        vha.asArray = function() {
            var r = [];

            var len = array.length;

            for (var i = 0; i < len; i++) {
                var key = array[i];
                r.push(hash[key]);
            }

            return r;
        };

        vha.each = function(cb) {
            var len = array.length;

            for (var i = 0; i < len; i++) {
                cb(array[i], hash[array[i]]);
            }
        };

        vha.dump = function(html) {
            var str = "";

            vha.each(function(name, val) {
                str += "name: " + name + " val: " + JSON.stringify(val) + (html ? "<br>" : "\n");
            });

            return str;
        };

    };

    $.verto.liveArray = function(verto, context, name, config) {
        var la = this;
        var lastSerno = 0;
        var binding = null;
        var user_obj = config.userObj;
        var local = false;

        // Inherit methods of hashArray
        hashArray.call(la);

        // Save the hashArray add, del, reorder, clear methods so we can make our own.
        la._add = la.add;
        la._del = la.del;
        la._reorder = la.reorder;
        la._clear = la.clear;

        la.context = context;
        la.name = name;
        la.user_obj = user_obj;

        la.verto = verto;
        la.broadcast = function(channel, obj) {
            verto.broadcast(channel, obj);
        };
        la.errs = 0;

        la.clear = function() {
            la._clear();
            lastSerno = 0;

            if (la.onChange) {
                la.onChange(la, {
                    action: "clear"
                });
            }
        };

        la.checkSerno = function(serno) {
            if (serno < 0) {
                return true;
            }

            if (lastSerno > 0 && serno != (lastSerno + 1)) {
                if (la.onErr) {
                    la.onErr(la, {
                        lastSerno: lastSerno,
                        serno: serno
                    });
                }
                la.errs++;
                console.debug(la.errs);
                if (la.errs < 3) {
                    la.bootstrap(la.user_obj);
                }
                return false;
            } else {
                lastSerno = serno;
                return true;
            }
        };

        la.reorder = function(serno, a) {
            if (la.checkSerno(serno)) {
                la._reorder(a);
                if (la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "reorder"
                    });
                }
            }
        };

        la.init = function(serno, val, key, index) {
            if (key === null || key === undefined) {
                key = serno;
            }
            if (la.checkSerno(serno)) {
                if (la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "init",
                        index: index,
                        key: key,
                        data: val
                    });
                }
            }
        };

        la.bootObj = function(serno, val) {
            if (la.checkSerno(serno)) {

                //la.clear();
                for (var i in val) {
                    la._add(val[i][0], val[i][1]);
                }

                if (la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "bootObj",
                        data: val,
                        redraw: true
                    });
                }
            }
        };

        // @param serno  La is the serial number for la particular request.
        // @param key    If looking at it as a hash table, la represents the key in the hashArray object where you want to store the val object.
        // @param index  If looking at it as an array, la represents the position in the array where you want to store the val object.
        // @param val    La is the object you want to store at the key or index location in the hash table / array.
        la.add = function(serno, val, key, index) {
            if (key === null || key === undefined) {
                key = serno;
            }
            if (la.checkSerno(serno)) {
                var redraw = la._add(key, val, index);
                if (la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "add",
                        index: index,
                        key: key,
                        data: val,
                        redraw: redraw
                    });
                }
            }
        };

        la.modify = function(serno, val, key, index) {
            if (key === null || key === undefined) {
                key = serno;
            }
            if (la.checkSerno(serno)) {
                la._add(key, val, index);
                if (la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "modify",
                        key: key,
                        data: val,
                        index: index
                    });
                }
            }
        };

        la.del = function(serno, key, index) {
            if (key === null || key === undefined) {
                key = serno;
            }
            if (la.checkSerno(serno)) {
                if (index === null || index < 0 || index === undefined) {
                    index = la.indexOf(key);
                }
                var ok = la._del(key);

                if (ok && la.onChange) {
                    la.onChange(la, {
                        serno: serno,
                        action: "del",
                        key: key,
                        index: index
                    });
                }
            }
        };

        var eventHandler = function(v, e, la) {
            var packet = e.data;

            //console.error("READ:", packet);

            if (packet.name != la.name) {
                return;
            }

            switch (packet.action) {

            case "init":
                la.init(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                break;

            case "bootObj":
                la.bootObj(packet.wireSerno, packet.data);
                break;
            case "add":
                la.add(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                break;

            case "modify":
                if (! (packet.arrIndex || packet.hashKey)) {
                    console.error("Invalid Packet", packet);
                } else {
                    la.modify(packet.wireSerno, packet.data, packet.hashKey, packet.arrIndex);
                }
                break;
            case "del":
                if (! (packet.arrIndex || packet.hashKey)) {
                    console.error("Invalid Packet", packet);
                } else {
                    la.del(packet.wireSerno, packet.hashKey, packet.arrIndex);
                }
                break;

            case "clear":
                la.clear();
                break;

            case "reorder":
                la.reorder(packet.wireSerno, packet.order);
                break;

            default:
                if (la.checkSerno(packet.wireSerno)) {
                    if (la.onChange) {
                        la.onChange(la, {
                            serno: packet.wireSerno,
                            action: packet.action,
                            data: packet.data
                        });
                    }
                }
                break;
            }
        };

        if (la.context) {
            binding = la.verto.subscribe(la.context, {
                handler: eventHandler,
                userData: la,
                subParams: config.subParams
            });
        }

        la.destroy = function() {
            la._clear();
            la.verto.unsubscribe(binding);
        };

        la.sendCommand = function(cmd, obj) {
            var self = la;
            self.broadcast(self.context, {
                liveArray: {
                    command: cmd,
                    context: self.context,
                    name: self.name,
                    obj: obj
                }
            });
        };

        la.bootstrap = function(obj) {
            var self = la;
            la.sendCommand("bootstrap", obj);
            //self.heartbeat();
        };

        la.changepage = function(obj) {
            var self = la;
            self.clear();
            self.broadcast(self.context, {
                liveArray: {
                    command: "changepage",
                    context: la.context,
                    name: la.name,
                    obj: obj
                }
            });
        };

        la.heartbeat = function(obj) {
            var self = la;

            var callback = function() {
                self.heartbeat.call(self, obj);
            };
            self.broadcast(self.context, {
                liveArray: {
                    command: "heartbeat",
                    context: self.context,
                    name: self.name,
                    obj: obj
                }
            });
            self.hb_pid = setTimeout(callback, 30000);
        };

        la.bootstrap(la.user_obj);
    };

    $.verto.liveTable = function(verto, context, name, jq, config) {
        var dt;
        var la = new $.verto.liveArray(verto, context, name, {
            subParams: config.subParams
        });
        var lt = this;

        lt.liveArray = la;
        lt.dataTable = dt;
        lt.verto = verto;

        lt.destroy = function() {
            if (dt) {
                dt.fnDestroy();
            }
            if (la) {
                la.destroy();
            }

            dt = null;
            la = null;
        };

        la.onErr = function(obj, args) {
            console.error("Error: ", obj, args);
        };

	/* back compat so jsonstatus can always be enabled */
	function genRow(data) {
	    if (typeof(data[4]) === "string" && data[4].indexOf("{") > -1) {
		var tmp = $.parseJSON(data[4]);
		data[4] = tmp.oldStatus;
		data[5] = null;
	    }
	    return data;
	}

	function genArray(obj) {
	    var data = obj.asArray();

            for (var i in data) {
		data[i] = genRow(data[i]);
	    }

	    return data;
	}


        la.onChange = function(obj, args) {
            var index = 0;
            var iserr = 0;

            if (!dt) {
                if (!config.aoColumns) {
                    if (args.action != "init") {
                        return;
                    }

                    config.aoColumns = [];

                    for (var i in args.data) {
                        config.aoColumns.push({
                            "sTitle": args.data[i]
                        });
                    }
                }

                dt = jq.dataTable(config);
            }

            if (dt && (args.action == "del" || args.action == "modify")) {
                index = args.index;

                if (index === undefined && args.key) {
                    index = la.indexOf(args.key);
                }

                if (index === undefined) {
                    console.error("INVALID PACKET Missing INDEX\n", args);
                    return;
                }
            }

            if (config.onChange) {
                config.onChange(obj, args);
            }

            try {
                switch (args.action) {
                case "bootObj":
                    if (!args.data) {
                        console.error("missing data");
                        return;
                    }
                    dt.fnClearTable();
                    dt.fnAddData(genArray(obj));
                    dt.fnAdjustColumnSizing();
                    break;
                case "add":
                    if (!args.data) {
                        console.error("missing data");
                        return;
                    }
                    if (args.redraw > -1) {
                        // specific position, more costly
                        dt.fnClearTable();
                        dt.fnAddData(genArray(obj));
                    } else {
                        dt.fnAddData(genRow(args.data));
                    }
                    dt.fnAdjustColumnSizing();
                    break;
                case "modify":
                    if (!args.data) {
                        return;
                    }
                    //console.debug(args, index);
                    dt.fnUpdate(genRow(args.data), index);
                    dt.fnAdjustColumnSizing();
                    break;
                case "del":
                    dt.fnDeleteRow(index);
                    dt.fnAdjustColumnSizing();
                    break;
                case "clear":
                    dt.fnClearTable();
                    break;
                case "reorder":
                    // specific position, more costly
                    dt.fnClearTable();
                    dt.fnAddData(genArray(obj));
                    break;
                case "hide":
                    jq.hide();
                    break;

                case "show":
                    jq.show();
                    break;

                }
            } catch(err) {
                console.error("ERROR: " + err);
                iserr++;
            }

            if (iserr) {
                obj.errs++;
                if (obj.errs < 3) {
                    obj.bootstrap(obj.user_obj);
                }
            } else {
                obj.errs = 0;
            }

        };

        la.onChange(la, {
            action: "init"
        });

    };

    var CONFMAN_SERNO = 1;

    /*
        Conference Manager without jQuery table.
     */

    $.verto.conf = function(verto, params) {
        var conf = this;

        conf.params = $.extend({
            dialog: null,
            hasVid: false,
            laData: null,
            onBroadcast: null,
            onLaChange: null,
            onLaRow: null
        }, params);

        conf.verto = verto;
        conf.serno = CONFMAN_SERNO++;

        createMainModeratorMethods();

        verto.subscribe(conf.params.laData.modChannel, {
            handler: function(v, e) {
                if (conf.params.onBroadcast) {
                    conf.params.onBroadcast(verto, conf, e.data);
                }
            }
        });

        verto.subscribe(conf.params.laData.chatChannel, {
            handler: function(v, e) {
                if (typeof(conf.params.chatCallback) === "function") {
                    conf.params.chatCallback(v,e);
                }
            }
        });
    };

    $.verto.conf.prototype.modCommand = function(cmd, id, value) {
        var conf = this;

        conf.verto.rpcClient.call("verto.broadcast", {
            "eventChannel": conf.params.laData.modChannel,
            "data": {
                "application": "conf-control",
                "command": cmd,
                "id": id,
                "value": value
            }
        });
    };

    $.verto.conf.prototype.destroy = function() {
        var conf = this;

        conf.destroyed = true;
        conf.params.onBroadcast(conf.verto, conf, 'destroy');

        if (conf.params.laData.modChannel) {
            conf.verto.unsubscribe(conf.params.laData.modChannel);
        }

        if (conf.params.laData.chatChannel) {
            conf.verto.unsubscribe(conf.params.laData.chatChannel);
        }
    };

    function createMainModeratorMethods() {
        $.verto.conf.prototype.listVideoLayouts = function() {
            this.modCommand("list-videoLayouts", null, null);
        };

        $.verto.conf.prototype.play = function(file) {
            this.modCommand("play", null, file);
        };

        $.verto.conf.prototype.stop = function() {
            this.modCommand("stop", null, "all");
        };

        $.verto.conf.prototype.deaf = function(memberID) {
            this.modCommand("deaf", parseInt(memberID));
        };

        $.verto.conf.prototype.undeaf = function(memberID) {
            this.modCommand("undeaf", parseInt(memberID));
        };

        $.verto.conf.prototype.record = function(file) {
            this.modCommand("recording", null, ["start", file]);
        };

        $.verto.conf.prototype.stopRecord = function() {
            this.modCommand("recording", null, ["stop", "all"]);
        };

        $.verto.conf.prototype.snapshot = function(file) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
            this.modCommand("vid-write-png", null, file);
        };

        $.verto.conf.prototype.setVideoLayout = function(layout, canvasID) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
	    if (canvasID) {
		this.modCommand("vid-layout", null, [layout, canvasID]);
	    } else {
		this.modCommand("vid-layout", null, layout);
	    }
        };

        $.verto.conf.prototype.kick = function(memberID) {
            this.modCommand("kick", parseInt(memberID));
        };

        $.verto.conf.prototype.muteMic = function(memberID) {
            this.modCommand("tmute", parseInt(memberID));
        };

        $.verto.conf.prototype.muteVideo = function(memberID) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
            this.modCommand("tvmute", parseInt(memberID));
        };

        $.verto.conf.prototype.presenter = function(memberID) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
            this.modCommand("vid-res-id", parseInt(memberID), "presenter");
        };

        $.verto.conf.prototype.videoFloor = function(memberID) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
            this.modCommand("vid-floor", parseInt(memberID), "force");
        };

        $.verto.conf.prototype.banner = function(memberID, text) {
            if (!this.params.hasVid) {
                throw 'Conference has no video';
            }
            this.modCommand("vid-banner", parseInt(memberID), escape(text));
        };

        $.verto.conf.prototype.volumeDown = function(memberID) {
            this.modCommand("volume_out", parseInt(memberID), "down");
        };

        $.verto.conf.prototype.volumeUp = function(memberID) {
            this.modCommand("volume_out", parseInt(memberID), "up");
        };

        $.verto.conf.prototype.gainDown = function(memberID) {
            this.modCommand("volume_in", parseInt(memberID), "down");
        };

        $.verto.conf.prototype.gainUp = function(memberID) {
            this.modCommand("volume_in", parseInt(memberID), "up");
        };

        $.verto.conf.prototype.transfer = function(memberID, exten) {
            this.modCommand("transfer", parseInt(memberID), exten);
        };

        $.verto.conf.prototype.sendChat = function(message, type) {
            var conf = this;
            conf.verto.rpcClient.call("verto.broadcast", {
                "eventChannel": conf.params.laData.chatChannel,
                "data": {
                    "action": "send",
                    "message": message,
                    "type": type
                }
            });
        };
            
    }

    $.verto.modfuncs = {};

    $.verto.confMan = function(verto, params) {
        var confMan = this;

        confMan.params = $.extend({
            tableID: null,
            statusID: null,
            mainModID: null,
            dialog: null,
            hasVid: false,
            laData: null,
            onBroadcast: null,
            onLaChange: null,
            onLaRow: null
        }, params);

        confMan.verto = verto;
        confMan.serno = CONFMAN_SERNO++;
	confMan.canvasCount = confMan.params.laData.canvasCount;
	
        function genMainMod(jq) {
            var play_id = "play_" + confMan.serno;
            var stop_id = "stop_" + confMan.serno;
            var recording_id = "recording_" + confMan.serno;
            var snapshot_id = "snapshot_" + confMan.serno;
            var rec_stop_id = "recording_stop" + confMan.serno;
            var div_id = "confman_" + confMan.serno;

            var html =  "<div id='" + div_id + "'><br>" +
		"<button class='ctlbtn' id='" + play_id + "'>Play</button>" +
		"<button class='ctlbtn' id='" + stop_id + "'>Stop</button>" +
		"<button class='ctlbtn' id='" + recording_id + "'>Record</button>" +
		"<button class='ctlbtn' id='" + rec_stop_id + "'>Record Stop</button>" +
		(confMan.params.hasVid ? "<button class='ctlbtn' id='" + snapshot_id + "'>PNG Snapshot</button>" : "") +
		"<br><br></div>";

            jq.html(html);

	    $.verto.modfuncs.change_video_layout = function(id, canvas_id) {	    
		var val = $("#" + id + " option:selected").text();
		if (val !== "none") {
                    confMan.modCommand("vid-layout", null, [val, canvas_id]);
		}
	    };

	    if (confMan.params.hasVid) {
		for (var j = 0; j < confMan.canvasCount; j++) {
		    var vlayout_id = "confman_vid_layout_" + j + "_" + confMan.serno;
		    var vlselect_id = "confman_vl_select_" + j + "_" + confMan.serno;
		

		    var vlhtml =  "<div id='" + vlayout_id + "'><br>" +
			"<b>Video Layout Canvas " + (j+1) + 
			"</b> <select onChange='$.verto.modfuncs.change_video_layout(\"" + vlayout_id + "\", \"" + (j+1) + "\")' id='" + vlselect_id + "'></select> " +
			"<br><br></div>";
		    jq.append(vlhtml);
		}

		$("#" + snapshot_id).click(function() {
                    var file = prompt("Please enter file name", "");
		    if (file) {
			confMan.modCommand("vid-write-png", null, file);
		    }
		});
	    }

            $("#" + play_id).click(function() {
                var file = prompt("Please enter file name", "");
		if (file) {
                    confMan.modCommand("play", null, file);
		}
            });

            $("#" + stop_id).click(function() {
                confMan.modCommand("stop", null, "all");
            });

            $("#" + recording_id).click(function() {
                var file = prompt("Please enter file name", "");
		if (file) {
                    confMan.modCommand("recording", null, ["start", file]);
		}
            });

            $("#" + rec_stop_id).click(function() {
                confMan.modCommand("recording", null, ["stop", "all"]);
            });

        }

        function genControls(jq, rowid) {
            var x = parseInt(rowid);
            var kick_id = "kick_" + x;
            var canvas_in_next_id = "canvas_in_next_" + x;
            var canvas_in_prev_id = "canvas_in_prev_" + x;
            var canvas_out_next_id = "canvas_out_next_" + x;
            var canvas_out_prev_id = "canvas_out_prev_" + x;

            var canvas_in_set_id = "canvas_in_set_" + x;
            var canvas_out_set_id = "canvas_out_set_" + x;

            var layer_set_id = "layer_set_" + x;
            var layer_next_id = "layer_next_" + x;
            var layer_prev_id = "layer_prev_" + x;
	    
            var tmute_id = "tmute_" + x;
            var tvmute_id = "tvmute_" + x;
            var vbanner_id = "vbanner_" + x;
            var tvpresenter_id = "tvpresenter_" + x;
            var tvfloor_id = "tvfloor_" + x;
            var box_id = "box_" + x;
            var gainup_id = "gain_in_up" + x;
            var gaindn_id = "gain_in_dn" + x;
            var volup_id = "vol_in_up" + x;
            var voldn_id = "vol_in_dn" + x;
            var transfer_id = "transfer" + x;
	    

            var html = "<div id='" + box_id + "'>";

	    html += "<b>General Controls</b><hr noshade>";

            html += "<button class='ctlbtn' id='" + kick_id + "'>Kick</button>" +
                "<button class='ctlbtn' id='" + tmute_id + "'>Mute</button>" +
                "<button class='ctlbtn' id='" + gainup_id + "'>Gain -</button>" +
                "<button class='ctlbtn' id='" + gaindn_id + "'>Gain +</button>" +
                "<button class='ctlbtn' id='" + voldn_id + "'>Vol -</button>" +
                "<button class='ctlbtn' id='" + volup_id + "'>Vol +</button>" +
                "<button class='ctlbtn' id='" + transfer_id + "'>Transfer</button>";
		
	    if (confMan.params.hasVid) {
		html += "<br><br><b>Video Controls</b><hr noshade>";


                html += "<button class='ctlbtn' id='" + tvmute_id + "'>VMute</button>" +
                    "<button class='ctlbtn' id='" + tvpresenter_id + "'>Presenter</button>" +
                    "<button class='ctlbtn' id='" + tvfloor_id + "'>Vid Floor</button>" +
                    "<button class='ctlbtn' id='" + vbanner_id + "'>Banner</button>";

		if (confMan.canvasCount > 1) {
                    html += "<br><br><b>Canvas Controls</b><hr noshade>" +
			"<button class='ctlbtn' id='" + canvas_in_set_id + "'>Set Input Canvas</button>" +
			"<button class='ctlbtn' id='" + canvas_in_prev_id + "'>Prev Input Canvas</button>" +
			"<button class='ctlbtn' id='" + canvas_in_next_id + "'>Next Input Canvas</button>" +
			
		    "<br>" +
			
		    "<button class='ctlbtn' id='" + canvas_out_set_id + "'>Set Watching Canvas</button>" +
			"<button class='ctlbtn' id='" + canvas_out_prev_id + "'>Prev Watching Canvas</button>" +
			"<button class='ctlbtn' id='" + canvas_out_next_id + "'>Next Watching Canvas</button>";
		}
		
		html += "<br>" +

                "<button class='ctlbtn' id='" + layer_set_id + "'>Set Layer</button>" +
                    "<button class='ctlbtn' id='" + layer_prev_id + "'>Prev Layer</button>" +
                    "<button class='ctlbtn' id='" + layer_next_id + "'>Next Layer</button>" +



                    "</div>";
            }

            jq.html(html);


            if (!jq.data("mouse")) {
                $("#" + box_id).hide();
            }

            jq.mouseover(function(e) {
                jq.data({"mouse": true});
                $("#" + box_id).show();
            });

            jq.mouseout(function(e) {
                jq.data({"mouse": false});
                $("#" + box_id).hide();
            });

            $("#" + transfer_id).click(function() {
                var xten = prompt("Enter Extension");
		if (xten) {
                    confMan.modCommand("transfer", x, xten);
		}
            });

            $("#" + kick_id).click(function() {
                confMan.modCommand("kick", x);
            });


            $("#" + layer_set_id).click(function() {
                var cid = prompt("Please enter layer ID", "");
		if (cid) {
                    confMan.modCommand("vid-layer", x, cid);
		}
            });

            $("#" + layer_next_id).click(function() {
                confMan.modCommand("vid-layer", x, "next");
            });
            $("#" + layer_prev_id).click(function() {
                confMan.modCommand("vid-layer", x, "prev");
            });

            $("#" + canvas_in_set_id).click(function() {
                var cid = prompt("Please enter canvas ID", "");
		if (cid) {
                    confMan.modCommand("vid-canvas", x, cid);
		}
            });

            $("#" + canvas_out_set_id).click(function() {
                var cid = prompt("Please enter canvas ID", "");
		if (cid) {
                    confMan.modCommand("vid-watching-canvas", x, cid);
		}
            });

            $("#" + canvas_in_next_id).click(function() {
                confMan.modCommand("vid-canvas", x, "next");
            });
            $("#" + canvas_in_prev_id).click(function() {
                confMan.modCommand("vid-canvas", x, "prev");
            });


            $("#" + canvas_out_next_id).click(function() {
                confMan.modCommand("vid-watching-canvas", x, "next");
            });
            $("#" + canvas_out_prev_id).click(function() {
                confMan.modCommand("vid-watching-canvas", x, "prev");
            });
	    
            $("#" + tmute_id).click(function() {
                confMan.modCommand("tmute", x);
            });

	    if (confMan.params.hasVid) {
		$("#" + tvmute_id).click(function() {
                    confMan.modCommand("tvmute", x);
		});
		$("#" + tvpresenter_id).click(function() {
                    confMan.modCommand("vid-res-id", x, "presenter");
		});
		$("#" + tvfloor_id).click(function() {
                    confMan.modCommand("vid-floor", x, "force");
		});
		$("#" + vbanner_id).click(function() {
                    var text = prompt("Please enter text", "");
		    if (text) {
			confMan.modCommand("vid-banner", x, escape(text));
		    }
		});
	    }

            $("#" + gainup_id).click(function() {
                confMan.modCommand("volume_in", x, "up");
            });

            $("#" + gaindn_id).click(function() {
                confMan.modCommand("volume_in", x, "down");
            });

            $("#" + volup_id).click(function() {
                confMan.modCommand("volume_out", x, "up");
            });

            $("#" + voldn_id).click(function() {
                confMan.modCommand("volume_out", x, "down");
            });

            return html;
        }

        var atitle = "";
        var awidth = 0;

        //$(".jsDataTable").width(confMan.params.hasVid ? "900px" : "800px");

	verto.subscribe(confMan.params.laData.chatChannel, {
	    handler: function(v, e) {
		if (typeof(confMan.params.chatCallback) === "function") {
		    confMan.params.chatCallback(v,e);
		}
	    }
	});

        if (confMan.params.laData.role === "moderator") {
            atitle = "Action";
            awidth = 600;

            if (confMan.params.mainModID) {
                genMainMod($(confMan.params.mainModID));
                $(confMan.params.displayID).html("Moderator Controls Ready<br><br>");
            } else {
                $(confMan.params.mainModID).html("");
            }

            verto.subscribe(confMan.params.laData.modChannel, {
                handler: function(v, e) {
                    //console.error("MODDATA:", e.data);
                    if (confMan.params.onBroadcast) {
                        confMan.params.onBroadcast(verto, confMan, e.data);
                    }

		    if (e.data["conf-command"] === "list-videoLayouts") {
			for (var j = 0; j < confMan.canvasCount; j++) {
			    var vlselect_id = "#confman_vl_select_" + j + "_" + confMan.serno;
			    var vlayout_id = "#confman_vid_layout_" + j + "_" + confMan.serno;
			    
			    var x = 0;
			    var options;
			    
			    $(vlselect_id).selectmenu({});
			    $(vlselect_id).selectmenu("enable");
			    $(vlselect_id).empty();
			    
			    $(vlselect_id).append(new Option("Choose a Layout", "none"));

			    if (e.data.responseData) {
				var rdata = [];

				for (var i in e.data.responseData) {
				    rdata.push(e.data.responseData[i].name);
				}
				
				options = rdata.sort(function(a, b) {
				    var ga = a.substring(0, 6) == "group:" ? true : false;
				    var gb = b.substring(0, 6) == "group:" ? true : false;
				    
				    if ((ga || gb) && ga != gb) {
					return ga ? -1 : 1;
				    }
				    
				    return ( ( a == b ) ? 0 : ( ( a > b ) ? 1 : -1 ) );
				});

				for (var i in options) {
				    $(vlselect_id).append(new Option(options[i], options[i]));
				    x++;
				}
			    }

			    if (x) {
				$(vlselect_id).selectmenu('refresh', true);
			    } else {
				$(vlayout_id).hide();
			    }
			}
		    } else {

			if (!confMan.destroyed && confMan.params.displayID) {
                            $(confMan.params.displayID).html(e.data.response + "<br><br>");
                            if (confMan.lastTimeout) {
				clearTimeout(confMan.lastTimeout);
				confMan.lastTimeout = 0;
                            }
                            confMan.lastTimeout = setTimeout(function() { $(confMan.params.displayID).html(confMan.destroyed ? "" : "Moderator Controls Ready<br><br>");}, 4000);
			}
		    }
                }
            });


	    if (confMan.params.hasVid) {
		confMan.modCommand("list-videoLayouts", null, null);
	    }
        }

        var row_callback = null;

        if (confMan.params.laData.role === "moderator") {
            row_callback = function(nRow, aData, iDisplayIndex, iDisplayIndexFull) {
                if (!aData[5]) {
                    var $row = $('td:eq(5)', nRow);
                    genControls($row, aData);

                    if (confMan.params.onLaRow) {
                        confMan.params.onLaRow(verto, confMan, $row, aData);
                    }
                }
            };
        }

        confMan.lt = new $.verto.liveTable(verto, confMan.params.laData.laChannel, confMan.params.laData.laName, $(confMan.params.tableID), {
            subParams: {
                callID: confMan.params.dialog ? confMan.params.dialog.callID : null
            },

            "onChange": function(obj, args) {
                $(confMan.params.statusID).text("Conference Members: " + " (" + obj.arrayLen() + " Total)");
                if (confMan.params.onLaChange) {
                    confMan.params.onLaChange(verto, confMan, $.verto.enum.confEvent.laChange, obj, args);
                }
            },

            "aaData": [],
            "aoColumns": [
                {
                    "sTitle": "ID",
                    "sWidth": "50"
                },
                {
                    "sTitle": "Number",
		    "sWidth": "250"
                },
                {
                    "sTitle": "Name",
		    "sWidth": "250"
                },
                {
                    "sTitle": "Codec",
                    "sWidth": "100"
                },
                {
                    "sTitle": "Status",
                    "sWidth": confMan.params.hasVid ? "200px" : "150px"
                },
                {
                    "sTitle": atitle,
                    "sWidth": awidth,
                }
            ],
            "bAutoWidth": true,
            "bDestroy": true,
            "bSort": false,
            "bInfo": false,
            "bFilter": false,
            "bLengthChange": false,
            "bPaginate": false,
            "iDisplayLength": 1400,

            "oLanguage": {
                "sEmptyTable": "The Conference is Empty....."
            },

            "fnRowCallback": row_callback

        });
    };

    $.verto.confMan.prototype.modCommand = function(cmd, id, value) {
        var confMan = this;

        confMan.verto.rpcClient.call("verto.broadcast", {
            "eventChannel": confMan.params.laData.modChannel,
            "data": {
		"application": "conf-control",
		"command": cmd,
		"id": id,
		"value": value
            }
	});
    };

    $.verto.confMan.prototype.sendChat = function(message, type) {
        var confMan = this;
        confMan.verto.rpcClient.call("verto.broadcast", {
            "eventChannel": confMan.params.laData.chatChannel,
            "data": {
		"action": "send",
		"message": message,
		"type": type
            }
	});
    };


    $.verto.confMan.prototype.destroy = function() {
        var confMan = this;

        confMan.destroyed = true;

        if (confMan.lt) {
            confMan.lt.destroy();
        }

        if (confMan.params.laData.chatChannel) {
            confMan.verto.unsubscribe(confMan.params.laData.chatChannel);
        }

        if (confMan.params.laData.modChannel) {
            confMan.verto.unsubscribe(confMan.params.laData.modChannel);
        }

        if (confMan.params.mainModID) {
            $(confMan.params.mainModID).html("");
        }
    };

    $.verto.dialog = function(direction, verto, params) {
        var dialog = this;

        var tag = verto.options.tag;
        if (typeof(tag) === "function") {
            tag = tag();
        }

        dialog.params = $.extend({
            useVideo: verto.options.useVideo,
            useStereo: verto.options.useStereo,
	    screenShare: false,
	    useCamera: verto.options.deviceParams.useCamera,
	    useMic: verto.options.deviceParams.useMic,
	    useSpeak: verto.options.deviceParams.useSpeak,
            tag: tag,
            localTag: verto.options.localTag,
            login: verto.options.login,
	    videoParams: verto.options.videoParams
        }, params);
	
        dialog.verto = verto;
        dialog.direction = direction;
        dialog.lastState = null;
        dialog.state = dialog.lastState = $.verto.enum.state.new;
        dialog.callbacks = verto.callbacks;
        dialog.answered = false;
        dialog.attach = params.attach || false;
	dialog.screenShare = params.screenShare || false;
	dialog.useCamera = dialog.params.useCamera;
	dialog.useMic = dialog.params.useMic;
	dialog.useSpeak = dialog.params.useSpeak;
	
        if (dialog.params.callID) {
            dialog.callID = dialog.params.callID;
        } else {
            dialog.callID = dialog.params.callID = generateGUID();
        }
	
        if (dialog.params.tag) {
            dialog.audioStream = document.getElementById(dialog.params.tag);

            if (dialog.params.useVideo) {
                dialog.videoStream = dialog.audioStream;
            }
        } //else conjure one TBD

        if (dialog.params.localTag) {
	    dialog.localVideo = document.getElementById(dialog.params.localTag);
	}

        dialog.verto.dialogs[dialog.callID] = dialog;

        var RTCcallbacks = {};

        if (dialog.direction == $.verto.enum.direction.inbound) {
            if (dialog.params.display_direction === "outbound") {
                dialog.params.remote_caller_id_name = dialog.params.caller_id_name;
                dialog.params.remote_caller_id_number = dialog.params.caller_id_number;
            } else {
                dialog.params.remote_caller_id_name = dialog.params.callee_id_name;
                dialog.params.remote_caller_id_number = dialog.params.callee_id_number;
            }

            if (!dialog.params.remote_caller_id_name) {
                dialog.params.remote_caller_id_name = "Nobody";
            }

            if (!dialog.params.remote_caller_id_number) {
                dialog.params.remote_caller_id_number = "UNKNOWN";
            }

            RTCcallbacks.onMessage = function(rtc, msg) {
                console.debug(msg);
            };

            RTCcallbacks.onAnswerSDP = function(rtc, sdp) {
                console.error("answer sdp", sdp);
            };
        } else {
            dialog.params.remote_caller_id_name = "Outbound Call";
            dialog.params.remote_caller_id_number = dialog.params.destination_number;
        }

        RTCcallbacks.onICESDP = function(rtc) {
            console.log("RECV " + rtc.type + " SDP", rtc.mediaData.SDP);

	    if (dialog.state == $.verto.enum.state.requesting || dialog.state == $.verto.enum.state.answering || dialog.state == $.verto.enum.state.active) {
		location.reload();
		return;
	    }

            if (rtc.type == "offer") {
		if (dialog.state == $.verto.enum.state.active) {
                    dialog.setState($.verto.enum.state.requesting);
		    dialog.sendMethod("verto.attach", {
			sdp: rtc.mediaData.SDP
                    });
		} else {
                    dialog.setState($.verto.enum.state.requesting);
		    
                    dialog.sendMethod("verto.invite", {
			sdp: rtc.mediaData.SDP
                    });
		}
            } else { //answer
                dialog.setState($.verto.enum.state.answering);

                dialog.sendMethod(dialog.attach ? "verto.attach" : "verto.answer", {
                    sdp: dialog.rtc.mediaData.SDP
                });
            }
        };

        RTCcallbacks.onICE = function(rtc) {
            //console.log("cand", rtc.mediaData.candidate);
            if (rtc.type == "offer") {
                console.log("offer", rtc.mediaData.candidate);
                return;
            }
        };

        RTCcallbacks.onStream = function(rtc, stream) {
            if (dialog.verto.options.permissionCallback &&
                typeof dialog.verto.options.permissionCallback.onGranted === 'function'){
                dialog.verto.options.permissionCallback.onGranted(stream);
            }
            console.log("stream started");
        };

        RTCcallbacks.onError = function(e) {
            if (dialog.verto.options.permissionCallback &&
                typeof dialog.verto.options.permissionCallback.onDenied === 'function'){
                dialog.verto.options.permissionCallback.onDenied();
            }
            console.error("ERROR:", e);
            dialog.hangup({cause: "Device or Permission Error"});
        };

        dialog.rtc = new $.FSRTC({
            callbacks: RTCcallbacks,
	    localVideo: dialog.screenShare ? null : dialog.localVideo,
            useVideo: dialog.params.useVideo ? dialog.videoStream : null,
            useAudio: dialog.audioStream,
            useStereo: dialog.params.useStereo,
            videoParams: dialog.params.videoParams,
            audioParams: verto.options.audioParams,
            iceServers: verto.options.iceServers,
	    screenShare: dialog.screenShare,
	    useCamera: dialog.useCamera,
	    useMic: dialog.useMic,
	    useSpeak: dialog.useSpeak
        });

        dialog.rtc.verto = dialog.verto;

        if (dialog.direction == $.verto.enum.direction.inbound) {
            if (dialog.attach) {
                dialog.answer();
            } else {
                dialog.ring();
            }
        }
    };

    $.verto.dialog.prototype.invite = function() {
        var dialog = this;
        dialog.rtc.call();
    };

    $.verto.dialog.prototype.sendMethod = function(method, obj) {
        var dialog = this;
        obj.dialogParams = {};

        for (var i in dialog.params) {
	    if (i == "sdp" && method != "verto.invite" && method != "verto.attach") {
                continue;
	    }
	    
	    if ((obj.noDialogParams && i != "callID")) {
		continue;
	    }

	    obj.dialogParams[i] = dialog.params[i];
        }
	
	delete obj.noDialogParams;

        dialog.verto.rpcClient.call(method, obj,

        function(e) {
            /* Success */
            dialog.processReply(method, true, e);
        },

        function(e) {
            /* Error */
            dialog.processReply(method, false, e);
        });
    };

    function checkStateChange(oldS, newS) {

        if (newS == $.verto.enum.state.purge || $.verto.enum.states[oldS.name][newS.name]) {
            return true;
        }

        return false;
    }


    // Attach audio output device to video element using device/sink ID.                                                                                           
    function find_name(id) {
	for (var i in $.verto.audioOutDevices) {
	    var source = $.verto.audioOutDevices[i];
	    if (source.id === id) {
		return(source.label);
	    }
	}

	return id;
    }

    $.verto.dialog.prototype.setAudioPlaybackDevice = function(sinkId, callback, arg) {
	var dialog = this;
	var element = dialog.audioStream;

	if (typeof element.sinkId !== 'undefined') {
	    var devname = find_name(sinkId);
	    console.info("Dialog: " + dialog.callID + " Setting speaker:", element, devname);

	    element.setSinkId(sinkId)
		.then(function() {
		    console.log("Dialog: " + dialog.callID + ' Success, audio output device attached: ' + sinkId);
		    if (callback) {
			callback(true, devname, arg);
		    }
		})
		.catch(function(error) {
		    var errorMessage = error;
		    if (error.name === 'SecurityError') {
			errorMessage = "Dialog: " + dialog.callID + ' You need to use HTTPS for selecting audio output ' +
			    'device: ' + error;
		    }
		    if (callback) {
			callback(false, null, arg);
		    }
		    console.error(errorMessage);
		});
	} else {
	    console.warn("Dialog: " + dialog.callID + ' Browser does not support output device selection.');
	    if (callback) {
		callback(false, null, arg);
	    }
	}
    }

    $.verto.dialog.prototype.setState = function(state) {
        var dialog = this;

        if (dialog.state == $.verto.enum.state.ringing) {
            dialog.stopRinging();
        }

        if (dialog.state == state || !checkStateChange(dialog.state, state)) {
            console.error("Dialog " + dialog.callID + ": INVALID state change from " + dialog.state.name + " to " + state.name);
            dialog.hangup();
            return false;
        }

        console.log("Dialog " + dialog.callID + ": state change from " + dialog.state.name + " to " + state.name);

        dialog.lastState = dialog.state;
        dialog.state = state;

        if (!dialog.causeCode) {
            dialog.causeCode = 16;
        }

        if (!dialog.cause) {
            dialog.cause = "NORMAL CLEARING";
        }

        if (dialog.callbacks.onDialogState) {
            dialog.callbacks.onDialogState(this);
        }

        switch (dialog.state) {

        case $.verto.enum.state.early:
        case $.verto.enum.state.active:

	    var speaker = dialog.useSpeak;
	    console.info("Using Speaker: ", speaker);

	    if (speaker && speaker !== "any" && speaker !== "none") {
		setTimeout(function() {
		    dialog.setAudioPlaybackDevice(speaker);
		}, 500);
	    }

	    break;

        case $.verto.enum.state.trying:
            setTimeout(function() {
                if (dialog.state == $.verto.enum.state.trying) {
                    dialog.setState($.verto.enum.state.hangup);
                }
            }, 30000);
            break;
        case $.verto.enum.state.purge:
            dialog.setState($.verto.enum.state.destroy);
            break;
        case $.verto.enum.state.hangup:

            if (dialog.lastState.val > $.verto.enum.state.requesting.val && dialog.lastState.val < $.verto.enum.state.hangup.val) {
                dialog.sendMethod("verto.bye", {});
            }

            dialog.setState($.verto.enum.state.destroy);
            break;
        case $.verto.enum.state.destroy:

            if (typeof(dialog.verto.options.tag) === "function") {
              $('#' + dialog.params.tag).remove();
            }

            delete dialog.verto.dialogs[dialog.callID];
	    if (dialog.params.screenShare) {
		dialog.rtc.stopPeer();
	    } else {
		dialog.rtc.stop();
	    }
            break;
        }

        return true;
    };

    $.verto.dialog.prototype.processReply = function(method, success, e) {
        var dialog = this;

        //console.log("Response: " + method + " State:" + dialog.state.name, success, e);

        switch (method) {

        case "verto.answer":
        case "verto.attach":
            if (success) {
                dialog.setState($.verto.enum.state.active);
            } else {
                dialog.hangup();
            }
            break;
        case "verto.invite":
            if (success) {
                dialog.setState($.verto.enum.state.trying);
            } else {
                dialog.setState($.verto.enum.state.destroy);
            }
            break;

        case "verto.bye":
            dialog.hangup();
            break;

        case "verto.modify":
            if (e.holdState) {
                if (e.holdState == "held") {
                    if (dialog.state != $.verto.enum.state.held) {
                        dialog.setState($.verto.enum.state.held);
                    }
                } else if (e.holdState == "active") {
                    if (dialog.state != $.verto.enum.state.active) {
                        dialog.setState($.verto.enum.state.active);
                    }
                }
            }

            if (success) {}

            break;

        default:
            break;
        }

    };

    $.verto.dialog.prototype.hangup = function(params) {
        var dialog = this;

        if (params) {
            if (params.causeCode) {
		dialog.causeCode = params.causeCode;
            }

            if (params.cause) {
		dialog.cause = params.cause;
            }
        }

        if (dialog.state.val >= $.verto.enum.state.new.val && dialog.state.val < $.verto.enum.state.hangup.val) {
            dialog.setState($.verto.enum.state.hangup);
        } else if (dialog.state.val < $.verto.enum.state.destroy) {
            dialog.setState($.verto.enum.state.destroy);
        }
    };

    $.verto.dialog.prototype.stopRinging = function() {
        var dialog = this;
        if (dialog.verto.ringer) {
            dialog.verto.ringer.stop();
        }
    };

    $.verto.dialog.prototype.indicateRing = function() {
        var dialog = this;

        if (dialog.verto.ringer) {
            dialog.verto.ringer.attr("src", dialog.verto.options.ringFile)[0].play();

            setTimeout(function() {
                dialog.stopRinging();
                if (dialog.state == $.verto.enum.state.ringing) {
                    dialog.indicateRing();
                }
            },
            dialog.verto.options.ringSleep);
        }
    };

    $.verto.dialog.prototype.ring = function() {
        var dialog = this;

        dialog.setState($.verto.enum.state.ringing);
        dialog.indicateRing();
    };

    $.verto.dialog.prototype.useVideo = function(on) {
        var dialog = this;

        dialog.params.useVideo = on;

        if (on) {
            dialog.videoStream = dialog.audioStream;
        } else {
            dialog.videoStream = null;
        }

        dialog.rtc.useVideo(dialog.videoStream, dialog.localVideo);

    };

    $.verto.dialog.prototype.setMute = function(what) {
	var dialog = this;
	return dialog.rtc.setMute(what);
    };

    $.verto.dialog.prototype.getMute = function() {
	var dialog = this; 
	return dialog.rtc.getMute();
    };

    $.verto.dialog.prototype.setVideoMute = function(what) {
	var dialog = this;
	return dialog.rtc.setVideoMute(what);
    };

    $.verto.dialog.prototype.getVideoMute = function() {
	var dialog = this; 
	return dialog.rtc.getVideoMute();
    };

    $.verto.dialog.prototype.useStereo = function(on) {
        var dialog = this;

        dialog.params.useStereo = on;
        dialog.rtc.useStereo(on);
    };

    $.verto.dialog.prototype.dtmf = function(digits) {
        var dialog = this;
        if (digits) {
            dialog.sendMethod("verto.info", {
                dtmf: digits
            });
        }
    };

    $.verto.dialog.prototype.rtt = function(obj) {
        var dialog = this;
	var pobj = {};

	if (!obj) {
	    return false;
	}

	pobj.code = obj.code;
	pobj.chars = obj.chars;


        if (pobj.chars || pobj.code) {
            dialog.sendMethod("verto.info", {
                txt: obj,
		noDialogParams: true
            });
        }
    };

    $.verto.dialog.prototype.transfer = function(dest, params) {
        var dialog = this;
        if (dest) {
            dialog.sendMethod("verto.modify", {
                action: "transfer",
                destination: dest,
                params: params
            });
        }
    };

    $.verto.dialog.prototype.hold = function(params) {
        var dialog = this;

        dialog.sendMethod("verto.modify", {
            action: "hold",
            params: params
        });
    };

    $.verto.dialog.prototype.unhold = function(params) {
        var dialog = this;

        dialog.sendMethod("verto.modify", {
            action: "unhold",
            params: params
        });
    };

    $.verto.dialog.prototype.toggleHold = function(params) {
        var dialog = this;

        dialog.sendMethod("verto.modify", {
            action: "toggleHold",
            params: params
        });
    };

    $.verto.dialog.prototype.message = function(msg) {
        var dialog = this;
        var err = 0;

        msg.from = dialog.params.login;

        if (!msg.to) {
            console.error("Missing To");
            err++;
        }

        if (!msg.body) {
            console.error("Missing Body");
            err++;
        }

        if (err) {
            return false;
        }

        dialog.sendMethod("verto.info", {
            msg: msg
        });

        return true;
    };

    $.verto.dialog.prototype.answer = function(params) {
        var dialog = this;
	
        if (!dialog.answered) {
	    if (!params) {
		params = {};
	    }

	    params.sdp = dialog.params.sdp;

            if (params) {
                if (params.useVideo) {
                    dialog.useVideo(true);
                }
		dialog.params.callee_id_name = params.callee_id_name;
		dialog.params.callee_id_number = params.callee_id_number;

		if (params.useCamera) {
		    dialog.useCamera = params.useCamera;
		}

		if (params.useMic) {
		    dialog.useMic = params.useMic;
		}

		if (params.useSpeak) {
		    dialog.useSpeak = params.useSpeak;
		}
            }
	    
            dialog.rtc.createAnswer(params);
            dialog.answered = true;
        }
    };

    $.verto.dialog.prototype.handleAnswer = function(params) {
        var dialog = this;

        dialog.gotAnswer = true;

        if (dialog.state.val >= $.verto.enum.state.active.val) {
            return;
        }

        if (dialog.state.val >= $.verto.enum.state.early.val) {
            dialog.setState($.verto.enum.state.active);
        } else {
            if (dialog.gotEarly) {
                console.log("Dialog " + dialog.callID + " Got answer while still establishing early media, delaying...");
            } else {
                console.log("Dialog " + dialog.callID + " Answering Channel");
                dialog.rtc.answer(params.sdp, function() {
                    dialog.setState($.verto.enum.state.active);
                }, function(e) {
                    console.error(e);
                    dialog.hangup();
                });
                console.log("Dialog " + dialog.callID + "ANSWER SDP", params.sdp);
            }
        }


    };

    $.verto.dialog.prototype.cidString = function(enc) {
        var dialog = this;
        var party = dialog.params.remote_caller_id_name + (enc ? " &lt;" : " <") + dialog.params.remote_caller_id_number + (enc ? "&gt;" : ">");
        return party;
    };

    $.verto.dialog.prototype.sendMessage = function(msg, params) {
        var dialog = this;

        if (dialog.callbacks.onMessage) {
            dialog.callbacks.onMessage(dialog.verto, dialog, msg, params);
        }
    };

    $.verto.dialog.prototype.handleInfo = function(params) {
        var dialog = this;

        dialog.sendMessage($.verto.enum.message.info, params);

    };

    $.verto.dialog.prototype.handleDisplay = function(params) {
        var dialog = this;

        if (params.display_name) {
            dialog.params.remote_caller_id_name = params.display_name;
        }
        if (params.display_number) {
            dialog.params.remote_caller_id_number = params.display_number;
        }

        dialog.sendMessage($.verto.enum.message.display, {});
    };

    $.verto.dialog.prototype.handleMedia = function(params) {
        var dialog = this;

        if (dialog.state.val >= $.verto.enum.state.early.val) {
            return;
        }

        dialog.gotEarly = true;

        dialog.rtc.answer(params.sdp, function() {
            console.log("Dialog " + dialog.callID + "Establishing early media");
            dialog.setState($.verto.enum.state.early);

            if (dialog.gotAnswer) {
                console.log("Dialog " + dialog.callID + "Answering Channel");
                dialog.setState($.verto.enum.state.active);
            }
        }, function(e) {
            console.error(e);
            dialog.hangup();
        });
        console.log("Dialog " + dialog.callID + "EARLY SDP", params.sdp);
    };

    $.verto.ENUM = function(s) {
        var i = 0,
        o = {};
        s.split(" ").map(function(x) {
            o[x] = {
                name: x,
                val: i++
            };
        });
        return Object.freeze(o);
    };

    $.verto.enum = {};

    $.verto.enum.states = Object.freeze({
        new: {
            requesting: 1,
            recovering: 1,
            ringing: 1,
            destroy: 1,
            answering: 1,
	    hangup: 1
        },
        requesting: {
            trying: 1,
            hangup: 1,
	    active: 1
        },
        recovering: {
            answering: 1,
            hangup: 1
        },
        trying: {
            active: 1,
            early: 1,
            hangup: 1
        },
        ringing: {
            answering: 1,
            hangup: 1
        },
        answering: {
            active: 1,
            hangup: 1
        },
        active: {
            answering: 1,
            requesting: 1,
            hangup: 1,
            held: 1
        },
        held: {
            hangup: 1,
            active: 1
        },
        early: {
            hangup: 1,
            active: 1
        },
        hangup: {
            destroy: 1
        },
        destroy: {},
        purge: {
            destroy: 1
        }
    });

    $.verto.enum.state = $.verto.ENUM("new requesting trying recovering ringing answering early active held hangup destroy purge");
    $.verto.enum.direction = $.verto.ENUM("inbound outbound");
    $.verto.enum.message = $.verto.ENUM("display info pvtEvent");

    $.verto.enum = Object.freeze($.verto.enum);

    $.verto.saved = [];
    
    $.verto.unloadJobs = [];

    $(window).bind('beforeunload', function() {
	for (var f in $.verto.unloadJobs) {
	    $.verto.unloadJobs[f]();
	}

        if ($.verto.haltClosure)
          return $.verto.haltClosure();

        for (var i in $.verto.saved) {
            var verto = $.verto.saved[i];
            if (verto) {
                verto.purge();
                verto.logout();
            }
        }

        return $.verto.warnOnUnload;
    });

    $.verto.videoDevices = [];
    $.verto.audioInDevices = [];
    $.verto.audioOutDevices = [];

    var checkDevices = function(runtime) {
	console.info("enumerating devices");
	var aud_in = [], aud_out = [], vid = [];	

	if ((!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) && MediaStreamTrack.getSources) {
	    MediaStreamTrack.getSources(function (media_sources) {
		for (var i = 0; i < media_sources.length; i++) {

		    if (media_sources[i].kind == 'video') {
			vid.push(media_sources[i]);
		    } else {
			aud_in.push(media_sources[i]);
		    }
		}
		
		$.verto.videoDevices = vid;
		$.verto.audioInDevices = aud_in;
		
		console.info("Audio Devices", $.verto.audioInDevices);
		console.info("Video Devices", $.verto.videoDevices);
		runtime(true);
	    });
	} else {
	    /* of course it's a totally different API CALL with different element names for the same exact thing */
	    
	    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
		console.log("enumerateDevices() not supported.");
		return;
	    }

	    // List cameras and microphones.

	    navigator.mediaDevices.enumerateDevices()
		.then(function(devices) {
		    devices.forEach(function(device) {
			console.log(device);

			console.log(device.kind + ": " + device.label +
				    " id = " + device.deviceId);
			
			if (device.kind === "videoinput") {
			    vid.push({id: device.deviceId, kind: "video", label: device.label});
			} else if (device.kind === "audioinput") {
			    aud_in.push({id: device.deviceId, kind: "audio_in", label: device.label});
			} else if (device.kind === "audiooutput") {
			    aud_out.push({id: device.deviceId, kind: "audio_out", label: device.label});
			}
		    });
		    

		    $.verto.videoDevices = vid;
		    $.verto.audioInDevices = aud_in;
		    $.verto.audioOutDevices = aud_out;
		    
		    console.info("Audio IN Devices", $.verto.audioInDevices);
		    console.info("Audio Out Devices", $.verto.audioOutDevices);
		    console.info("Video Devices", $.verto.videoDevices);
		    runtime(true);
		    
		})
		.catch(function(err) {
		    console.log(" Device Enumeration ERROR: " + err.name + ": " + err.message);
		    runtime(false);
		});
	}

    };

    $.verto.refreshDevices = function(runtime) {
	checkDevices(runtime);
    }

    $.verto.init = function(obj, runtime) {
	if (!obj) {
	    obj = {};
	}

	if (!obj.skipPermCheck && !obj.skipDeviceCheck) {
	    $.FSRTC.checkPerms(function(status) {
		checkDevices(runtime);
	    }, true, true);
	} else if (obj.skipPermCheck && !obj.skipDeviceCheck) {
	    checkDevices(runtime);
	} else if (!obj.skipPermCheck && obj.skipDeviceCheck) {
	    $.FSRTC.checkPerms(function(status) {
		runtime(status);
	    }, true, true);
	} else {
	    runtime(null);
	}

    }

    $.verto.genUUID = function () {
	return generateGUID();
    }


})(jQuery);
/*! adapterjs - v0.13.3 - 2016-08-03 */

// Adapter's interface.
var AdapterJS = AdapterJS || {};

// Browserify compatibility
if(typeof exports !== 'undefined') {
  module.exports = AdapterJS;
}

AdapterJS.options = AdapterJS.options || {};

// uncomment to get virtual webcams
// AdapterJS.options.getAllCams = true;

// uncomment to prevent the install prompt when the plugin in not yet installed
// AdapterJS.options.hidePluginInstallPrompt = true;

// AdapterJS version
AdapterJS.VERSION = '0.13.3';

// This function will be called when the WebRTC API is ready to be used
// Whether it is the native implementation (Chrome, Firefox, Opera) or
// the plugin
// You may Override this function to synchronise the start of your application
// with the WebRTC API being ready.
// If you decide not to override use this synchronisation, it may result in
// an extensive CPU usage on the plugin start (once per tab loaded)
// Params:
//    - isUsingPlugin: true is the WebRTC plugin is being used, false otherwise
//
AdapterJS.onwebrtcready = AdapterJS.onwebrtcready || function(isUsingPlugin) {
  // The WebRTC API is ready.
  // Override me and do whatever you want here
};

// New interface to store multiple callbacks, private
AdapterJS._onwebrtcreadies = [];

// Sets a callback function to be called when the WebRTC interface is ready.
// The first argument is the function to callback.\
// Throws an error if the first argument is not a function
AdapterJS.webRTCReady = function (callback) {
  if (typeof callback !== 'function') {
    throw new Error('Callback provided is not a function');
  }

  if (true === AdapterJS.onwebrtcreadyDone) {
    // All WebRTC interfaces are ready, just call the callback
    callback(null !== AdapterJS.WebRTCPlugin.plugin);
  } else {
    // will be triggered automatically when your browser/plugin is ready.
    AdapterJS._onwebrtcreadies.push(callback);
  }
};

// Plugin namespace
AdapterJS.WebRTCPlugin = AdapterJS.WebRTCPlugin || {};

// The object to store plugin information
/* jshint ignore:start */
AdapterJS.WebRTCPlugin.pluginInfo = {
  prefix : 'Tem',
  plugName : 'TemWebRTCPlugin',
  pluginId : 'plugin0',
  type : 'application/x-temwebrtcplugin',
  onload : '__TemWebRTCReady0',
  portalLink : 'http://skylink.io/plugin/',
  downloadLink : null, //set below
  companyName: 'Temasys'
};
if(!!navigator.platform.match(/^Mac/i)) {
  AdapterJS.WebRTCPlugin.pluginInfo.downloadLink = 'http://bit.ly/1n77hco';
}
else if(!!navigator.platform.match(/^Win/i)) {
  AdapterJS.WebRTCPlugin.pluginInfo.downloadLink = 'http://bit.ly/1kkS4FN';
}
/* jshint ignore:end */

AdapterJS.WebRTCPlugin.TAGS = {
  NONE  : 'none',
  AUDIO : 'audio',
  VIDEO : 'video'
};

// Unique identifier of each opened page
AdapterJS.WebRTCPlugin.pageId = Math.random().toString(36).slice(2);

// Use this whenever you want to call the plugin.
AdapterJS.WebRTCPlugin.plugin = null;

// Set log level for the plugin once it is ready.
// The different values are
// This is an asynchronous function that will run when the plugin is ready
AdapterJS.WebRTCPlugin.setLogLevel = null;

// Defines webrtc's JS interface according to the plugin's implementation.
// Define plugin Browsers as WebRTC Interface.
AdapterJS.WebRTCPlugin.defineWebRTCInterface = null;

// This function detects whether or not a plugin is installed.
// Checks if Not IE (firefox, for example), else if it's IE,
// we're running IE and do something. If not it is not supported.
AdapterJS.WebRTCPlugin.isPluginInstalled = null;

 // Lets adapter.js wait until the the document is ready before injecting the plugin
AdapterJS.WebRTCPlugin.pluginInjectionInterval = null;

// Inject the HTML DOM object element into the page.
AdapterJS.WebRTCPlugin.injectPlugin = null;

// States of readiness that the plugin goes through when
// being injected and stated
AdapterJS.WebRTCPlugin.PLUGIN_STATES = {
  NONE : 0,           // no plugin use
  INITIALIZING : 1,   // Detected need for plugin
  INJECTING : 2,      // Injecting plugin
  INJECTED: 3,        // Plugin element injected but not usable yet
  READY: 4            // Plugin ready to be used
};

// Current state of the plugin. You cannot use the plugin before this is
// equal to AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY
AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.NONE;

// True is AdapterJS.onwebrtcready was already called, false otherwise
// Used to make sure AdapterJS.onwebrtcready is only called once
AdapterJS.onwebrtcreadyDone = false;

// Log levels for the plugin.
// To be set by calling AdapterJS.WebRTCPlugin.setLogLevel
/*
Log outputs are prefixed in some cases.
  INFO: Information reported by the plugin.
  ERROR: Errors originating from within the plugin.
  WEBRTC: Error originating from within the libWebRTC library
*/
// From the least verbose to the most verbose
AdapterJS.WebRTCPlugin.PLUGIN_LOG_LEVELS = {
  NONE : 'NONE',
  ERROR : 'ERROR',
  WARNING : 'WARNING',
  INFO: 'INFO',
  VERBOSE: 'VERBOSE',
  SENSITIVE: 'SENSITIVE'
};

// Does a waiting check before proceeding to load the plugin.
AdapterJS.WebRTCPlugin.WaitForPluginReady = null;

// This methid will use an interval to wait for the plugin to be ready.
AdapterJS.WebRTCPlugin.callWhenPluginReady = null;

// !!!! WARNING: DO NOT OVERRIDE THIS FUNCTION. !!!
// This function will be called when plugin is ready. It sends necessary
// details to the plugin.
// The function will wait for the document to be ready and the set the
// plugin state to AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY,
// indicating that it can start being requested.
// This function is not in the IE/Safari condition brackets so that
// TemPluginLoaded function might be called on Chrome/Firefox.
// This function is the only private function that is not encapsulated to
// allow the plugin method to be called.
__TemWebRTCReady0 = function () {
  if (document.readyState === 'complete') {
    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY;
    AdapterJS.maybeThroughWebRTCReady();
  } else {
    var timer = setInterval(function () {
      if (document.readyState === 'complete') {
        // TODO: update comments, we wait for the document to be ready
        clearInterval(timer);
        AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY;
        AdapterJS.maybeThroughWebRTCReady();
      }
    }, 100);
  }
};

AdapterJS.maybeThroughWebRTCReady = function() {
  if (!AdapterJS.onwebrtcreadyDone) {
    AdapterJS.onwebrtcreadyDone = true;

    // If new interface for multiple callbacks used
    if (AdapterJS._onwebrtcreadies.length) {
      AdapterJS._onwebrtcreadies.forEach(function (callback) {
        if (typeof(callback) === 'function') {
          callback(AdapterJS.WebRTCPlugin.plugin !== null);
        }
      });
    // Else if no callbacks on new interface assuming user used old(deprecated) way to set callback through AdapterJS.onwebrtcready = ...
    } else if (typeof(AdapterJS.onwebrtcready) === 'function') {
      AdapterJS.onwebrtcready(AdapterJS.WebRTCPlugin.plugin !== null);
    }
  }
};

// Text namespace
AdapterJS.TEXT = {
  PLUGIN: {
    REQUIRE_INSTALLATION: 'This website requires you to install a WebRTC-enabling plugin ' +
      'to work on this browser.',
    NOT_SUPPORTED: 'Your browser does not support WebRTC.',
    BUTTON: 'Install Now'
  },
  REFRESH: {
    REQUIRE_REFRESH: 'Please refresh page',
    BUTTON: 'Refresh Page'
  }
};

// The result of ice connection states.
// - starting: Ice connection is starting.
// - checking: Ice connection is checking.
// - connected Ice connection is connected.
// - completed Ice connection is connected.
// - done Ice connection has been completed.
// - disconnected Ice connection has been disconnected.
// - failed Ice connection has failed.
// - closed Ice connection is closed.
AdapterJS._iceConnectionStates = {
  starting : 'starting',
  checking : 'checking',
  connected : 'connected',
  completed : 'connected',
  done : 'completed',
  disconnected : 'disconnected',
  failed : 'failed',
  closed : 'closed'
};

//The IceConnection states that has been fired for each peer.
AdapterJS._iceConnectionFiredStates = [];


// Check if WebRTC Interface is defined.
AdapterJS.isDefined = null;

// This function helps to retrieve the webrtc detected browser information.
// This sets:
// - webrtcDetectedBrowser: The browser agent name.
// - webrtcDetectedVersion: The browser version.
// - webrtcMinimumVersion: The minimum browser version still supported by AJS.
// - webrtcDetectedType: The types of webRTC support.
//   - 'moz': Mozilla implementation of webRTC.
//   - 'webkit': WebKit implementation of webRTC.
//   - 'plugin': Using the plugin implementation.
AdapterJS.parseWebrtcDetectedBrowser = function () {
  var hasMatch = null;
  if ((!!window.opr && !!opr.addons) || 
    !!window.opera || 
    navigator.userAgent.indexOf(' OPR/') >= 0) {
    // Opera 8.0+
    webrtcDetectedBrowser = 'opera';
    webrtcDetectedType    = 'webkit';
    webrtcMinimumVersion  = 26;
    hasMatch = /OPR\/(\d+)/i.exec(navigator.userAgent) || [];
    webrtcDetectedVersion = parseInt(hasMatch[1], 10);
  } else if (typeof InstallTrigger !== 'undefined') {
    // Firefox 1.0+
    // Bowser and Version set in Google's adapter
    webrtcDetectedType    = 'moz';
  } else if (Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0) {
    // Safari
    webrtcDetectedBrowser = 'safari';
    webrtcDetectedType    = 'plugin';
    webrtcMinimumVersion  = 7;
    hasMatch = /version\/(\d+)/i.exec(navigator.userAgent) || [];
    webrtcDetectedVersion = parseInt(hasMatch[1], 10);
  } else if (/*@cc_on!@*/false || !!document.documentMode) {
    // Internet Explorer 6-11
    webrtcDetectedBrowser = 'IE';
    webrtcDetectedType    = 'plugin';
    webrtcMinimumVersion  = 9;
    hasMatch = /\brv[ :]+(\d+)/g.exec(navigator.userAgent) || [];
    webrtcDetectedVersion = parseInt(hasMatch[1] || '0', 10);
    if (!webrtcDetectedVersion) {
      hasMatch = /\bMSIE[ :]+(\d+)/g.exec(navigator.userAgent) || [];
      webrtcDetectedVersion = parseInt(hasMatch[1] || '0', 10);      
    }
  } else if (!!window.StyleMedia) {
    // Edge 20+
    // Bowser and Version set in Google's adapter
    webrtcDetectedType    = '';
  } else if (!!window.chrome && !!window.chrome.webstore) {
    // Chrome 1+
    // Bowser and Version set in Google's adapter
    webrtcDetectedType    = 'webkit';
  } else if ((webrtcDetectedBrowser === 'chrome'|| webrtcDetectedBrowser === 'opera') && 
    !!window.CSS) {
    // Blink engine detection
    webrtcDetectedBrowser = 'blink';
    // TODO: detected WebRTC version
  }

  window.webrtcDetectedBrowser = webrtcDetectedBrowser;
  window.webrtcDetectedVersion = webrtcDetectedVersion;
  window.webrtcMinimumVersion  = webrtcMinimumVersion;
};

AdapterJS.addEvent = function(elem, evnt, func) {
  if (elem.addEventListener) { // W3C DOM
    elem.addEventListener(evnt, func, false);
  } else if (elem.attachEvent) {// OLD IE DOM
    elem.attachEvent('on'+evnt, func);
  } else { // No much to do
    elem[evnt] = func;
  }
};

AdapterJS.renderNotificationBar = function (text, buttonText, buttonLink, openNewTab, displayRefreshBar) {
  // only inject once the page is ready
  if (document.readyState !== 'complete') {
    return;
  }

  var w = window;
  var i = document.createElement('iframe');
  i.name = 'adapterjs-alert';
  i.style.position = 'fixed';
  i.style.top = '-41px';
  i.style.left = 0;
  i.style.right = 0;
  i.style.width = '100%';
  i.style.height = '40px';
  i.style.backgroundColor = '#ffffe1';
  i.style.border = 'none';
  i.style.borderBottom = '1px solid #888888';
  i.style.zIndex = '9999999';
  if(typeof i.style.webkitTransition === 'string') {
    i.style.webkitTransition = 'all .5s ease-out';
  } else if(typeof i.style.transition === 'string') {
    i.style.transition = 'all .5s ease-out';
  }
  document.body.appendChild(i);
  var c = (i.contentWindow) ? i.contentWindow :
    (i.contentDocument.document) ? i.contentDocument.document : i.contentDocument;
  c.document.open();
  c.document.write('<span style="display: inline-block; font-family: Helvetica, Arial,' +
    'sans-serif; font-size: .9rem; padding: 4px; vertical-align: ' +
    'middle; cursor: default;">' + text + '</span>');
  if(buttonText && buttonLink) {
    c.document.write('<button id="okay">' + buttonText + '</button><button id="cancel">Cancel</button>');
    c.document.close();

    // On click on okay
    AdapterJS.addEvent(c.document.getElementById('okay'), 'click', function(e) {
      if (!!displayRefreshBar) {
        AdapterJS.renderNotificationBar(AdapterJS.TEXT.EXTENSION ?
          AdapterJS.TEXT.EXTENSION.REQUIRE_REFRESH : AdapterJS.TEXT.REFRESH.REQUIRE_REFRESH,
          AdapterJS.TEXT.REFRESH.BUTTON, 'javascript:location.reload()'); // jshint ignore:line
      }
      window.open(buttonLink, !!openNewTab ? '_blank' : '_top');

      e.preventDefault();
      try {
        e.cancelBubble = true;
      } catch(error) { }

      var pluginInstallInterval = setInterval(function(){
        if(! isIE) {
          navigator.plugins.refresh(false);
        }
        AdapterJS.WebRTCPlugin.isPluginInstalled(
          AdapterJS.WebRTCPlugin.pluginInfo.prefix,
          AdapterJS.WebRTCPlugin.pluginInfo.plugName,
          function() { // plugin now installed
            clearInterval(pluginInstallInterval);
            AdapterJS.WebRTCPlugin.defineWebRTCInterface();
          },
          function() {
            // still no plugin detected, nothing to do
          });
      } , 500);
    });

    // On click on Cancel
    AdapterJS.addEvent(c.document.getElementById('cancel'), 'click', function(e) {
      w.document.body.removeChild(i);
    });
  } else {
    c.document.close();
  }
  setTimeout(function() {
    if(typeof i.style.webkitTransform === 'string') {
      i.style.webkitTransform = 'translateY(40px)';
    } else if(typeof i.style.transform === 'string') {
      i.style.transform = 'translateY(40px)';
    } else {
      i.style.top = '0px';
    }
  }, 300);
};

// -----------------------------------------------------------
// Detected webrtc implementation. Types are:
// - 'moz': Mozilla implementation of webRTC.
// - 'webkit': WebKit implementation of webRTC.
// - 'plugin': Using the plugin implementation.
webrtcDetectedType = null;

// Set the settings for creating DataChannels, MediaStream for
// Cross-browser compability.
// - This is only for SCTP based support browsers.
// the 'urls' attribute.
checkMediaDataChannelSettings =
  function (peerBrowserAgent, peerBrowserVersion, callback, constraints) {
  if (typeof callback !== 'function') {
    return;
  }
  var beOfferer = true;
  var isLocalFirefox = webrtcDetectedBrowser === 'firefox';
  // Nightly version does not require MozDontOfferDataChannel for interop
  var isLocalFirefoxInterop = webrtcDetectedType === 'moz' && webrtcDetectedVersion > 30;
  var isPeerFirefox = peerBrowserAgent === 'firefox';
  var isPeerFirefoxInterop = peerBrowserAgent === 'firefox' &&
    ((peerBrowserVersion) ? (peerBrowserVersion > 30) : false);

  // Resends an updated version of constraints for MozDataChannel to work
  // If other userAgent is firefox and user is firefox, remove MozDataChannel
  if ((isLocalFirefox && isPeerFirefox) || (isLocalFirefoxInterop)) {
    try {
      delete constraints.mandatory.MozDontOfferDataChannel;
    } catch (error) {
      console.error('Failed deleting MozDontOfferDataChannel');
      console.error(error);
    }
  } else if ((isLocalFirefox && !isPeerFirefox)) {
    constraints.mandatory.MozDontOfferDataChannel = true;
  }
  if (!isLocalFirefox) {
    // temporary measure to remove Moz* constraints in non Firefox browsers
    for (var prop in constraints.mandatory) {
      if (constraints.mandatory.hasOwnProperty(prop)) {
        if (prop.indexOf('Moz') !== -1) {
          delete constraints.mandatory[prop];
        }
      }
    }
  }
  // Firefox (not interopable) cannot offer DataChannel as it will cause problems to the
  // interopability of the media stream
  if (isLocalFirefox && !isPeerFirefox && !isLocalFirefoxInterop) {
    beOfferer = false;
  }
  callback(beOfferer, constraints);
};

// Handles the differences for all browsers ice connection state output.
// - Tested outcomes are:
//   - Chrome (offerer)  : 'checking' > 'completed' > 'completed'
//   - Chrome (answerer) : 'checking' > 'connected'
//   - Firefox (offerer) : 'checking' > 'connected'
//   - Firefox (answerer): 'checking' > 'connected'
checkIceConnectionState = function (peerId, iceConnectionState, callback) {
  if (typeof callback !== 'function') {
    console.warn('No callback specified in checkIceConnectionState. Aborted.');
    return;
  }
  peerId = (peerId) ? peerId : 'peer';

  if (!AdapterJS._iceConnectionFiredStates[peerId] ||
    iceConnectionState === AdapterJS._iceConnectionStates.disconnected ||
    iceConnectionState === AdapterJS._iceConnectionStates.failed ||
    iceConnectionState === AdapterJS._iceConnectionStates.closed) {
    AdapterJS._iceConnectionFiredStates[peerId] = [];
  }
  iceConnectionState = AdapterJS._iceConnectionStates[iceConnectionState];
  if (AdapterJS._iceConnectionFiredStates[peerId].indexOf(iceConnectionState) < 0) {
    AdapterJS._iceConnectionFiredStates[peerId].push(iceConnectionState);
    if (iceConnectionState === AdapterJS._iceConnectionStates.connected) {
      setTimeout(function () {
        AdapterJS._iceConnectionFiredStates[peerId]
          .push(AdapterJS._iceConnectionStates.done);
        callback(AdapterJS._iceConnectionStates.done);
      }, 1000);
    }
    callback(iceConnectionState);
  }
  return;
};

// Firefox:
// - Creates iceServer from the url for Firefox.
// - Create iceServer with stun url.
// - Create iceServer with turn url.
//   - Ignore the transport parameter from TURN url for FF version <=27.
//   - Return null for createIceServer if transport=tcp.
// - FF 27 and above supports transport parameters in TURN url,
// - So passing in the full url to create iceServer.
// Chrome:
// - Creates iceServer from the url for Chrome M33 and earlier.
//   - Create iceServer with stun url.
//   - Chrome M28 & above uses below TURN format.
// Plugin:
// - Creates Ice Server for Plugin Browsers
//   - If Stun - Create iceServer with stun url.
//   - Else - Create iceServer with turn url
//   - This is a WebRTC Function
createIceServer = null;

// Firefox:
// - Creates IceServers for Firefox
//   - Use .url for FireFox.
//   - Multiple Urls support
// Chrome:
// - Creates iceServers from the urls for Chrome M34 and above.
//   - .urls is supported since Chrome M34.
//   - Multiple Urls support
// Plugin:
// - Creates Ice Servers for Plugin Browsers
//   - Multiple Urls support
//   - This is a WebRTC Function
createIceServers = null;
//------------------------------------------------------------

//The RTCPeerConnection object.
RTCPeerConnection = null;

// Creates RTCSessionDescription object for Plugin Browsers
RTCSessionDescription = (typeof RTCSessionDescription === 'function') ?
  RTCSessionDescription : null;

// Creates RTCIceCandidate object for Plugin Browsers
RTCIceCandidate = (typeof RTCIceCandidate === 'function') ?
  RTCIceCandidate : null;

// Get UserMedia (only difference is the prefix).
// Code from Adam Barth.
getUserMedia = null;

// Attach a media stream to an element.
attachMediaStream = null;

// Re-attach a media stream to an element.
reattachMediaStream = null;


// Detected browser agent name. Types are:
// - 'firefox': Firefox browser.
// - 'chrome': Chrome browser.
// - 'opera': Opera browser.
// - 'safari': Safari browser.
// - 'IE' - Internet Explorer browser.
webrtcDetectedBrowser = null;

// Detected browser version.
webrtcDetectedVersion = null;

// The minimum browser version still supported by AJS.
webrtcMinimumVersion  = null;

// Check for browser types and react accordingly
if ( navigator.mozGetUserMedia || 
  navigator.webkitGetUserMedia || 
  (navigator.mediaDevices && 
    navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) ) { 

  ///////////////////////////////////////////////////////////////////
  // INJECTION OF GOOGLE'S ADAPTER.JS CONTENT

/* jshint ignore:start */
  (function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.adapter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
   /* eslint-env node */
  'use strict';
  
  // SDP helpers.
  var SDPUtils = {};
  
  // Generate an alphanumeric identifier for cname or mids.
  // TODO: use UUIDs instead? https://gist.github.com/jed/982883
  SDPUtils.generateIdentifier = function() {
    return Math.random().toString(36).substr(2, 10);
  };
  
  // The RTCP CNAME used by all peerconnections from the same JS.
  SDPUtils.localCName = SDPUtils.generateIdentifier();
  
  // Splits SDP into lines, dealing with both CRLF and LF.
  SDPUtils.splitLines = function(blob) {
    return blob.trim().split('\n').map(function(line) {
      return line.trim();
    });
  };
  // Splits SDP into sessionpart and mediasections. Ensures CRLF.
  SDPUtils.splitSections = function(blob) {
    var parts = blob.split('\nm=');
    return parts.map(function(part, index) {
      return (index > 0 ? 'm=' + part : part).trim() + '\r\n';
    });
  };
  
  // Returns lines that start with a certain prefix.
  SDPUtils.matchPrefix = function(blob, prefix) {
    return SDPUtils.splitLines(blob).filter(function(line) {
      return line.indexOf(prefix) === 0;
    });
  };
  
  // Parses an ICE candidate line. Sample input:
  // candidate:702786350 2 udp 41819902 8.8.8.8 60769 typ relay raddr 8.8.8.8
  // rport 55996"
  SDPUtils.parseCandidate = function(line) {
    var parts;
    // Parse both variants.
    if (line.indexOf('a=candidate:') === 0) {
      parts = line.substring(12).split(' ');
    } else {
      parts = line.substring(10).split(' ');
    }
  
    var candidate = {
      foundation: parts[0],
      component: parts[1],
      protocol: parts[2].toLowerCase(),
      priority: parseInt(parts[3], 10),
      ip: parts[4],
      port: parseInt(parts[5], 10),
      // skip parts[6] == 'typ'
      type: parts[7]
    };
  
    for (var i = 8; i < parts.length; i += 2) {
      switch (parts[i]) {
        case 'raddr':
          candidate.relatedAddress = parts[i + 1];
          break;
        case 'rport':
          candidate.relatedPort = parseInt(parts[i + 1], 10);
          break;
        case 'tcptype':
          candidate.tcpType = parts[i + 1];
          break;
        default: // Unknown extensions are silently ignored.
          break;
      }
    }
    return candidate;
  };
  
  // Translates a candidate object into SDP candidate attribute.
  SDPUtils.writeCandidate = function(candidate) {
    var sdp = [];
    sdp.push(candidate.foundation);
    sdp.push(candidate.component);
    sdp.push(candidate.protocol.toUpperCase());
    sdp.push(candidate.priority);
    sdp.push(candidate.ip);
    sdp.push(candidate.port);
  
    var type = candidate.type;
    sdp.push('typ');
    sdp.push(type);
    if (type !== 'host' && candidate.relatedAddress &&
        candidate.relatedPort) {
      sdp.push('raddr');
      sdp.push(candidate.relatedAddress); // was: relAddr
      sdp.push('rport');
      sdp.push(candidate.relatedPort); // was: relPort
    }
    if (candidate.tcpType && candidate.protocol.toLowerCase() === 'tcp') {
      sdp.push('tcptype');
      sdp.push(candidate.tcpType);
    }
    return 'candidate:' + sdp.join(' ');
  };
  
  // Parses an rtpmap line, returns RTCRtpCoddecParameters. Sample input:
  // a=rtpmap:111 opus/48000/2
  SDPUtils.parseRtpMap = function(line) {
    var parts = line.substr(9).split(' ');
    var parsed = {
      payloadType: parseInt(parts.shift(), 10) // was: id
    };
  
    parts = parts[0].split('/');
  
    parsed.name = parts[0];
    parsed.clockRate = parseInt(parts[1], 10); // was: clockrate
    // was: channels
    parsed.numChannels = parts.length === 3 ? parseInt(parts[2], 10) : 1;
    return parsed;
  };
  
  // Generate an a=rtpmap line from RTCRtpCodecCapability or
  // RTCRtpCodecParameters.
  SDPUtils.writeRtpMap = function(codec) {
    var pt = codec.payloadType;
    if (codec.preferredPayloadType !== undefined) {
      pt = codec.preferredPayloadType;
    }
    return 'a=rtpmap:' + pt + ' ' + codec.name + '/' + codec.clockRate +
        (codec.numChannels !== 1 ? '/' + codec.numChannels : '') + '\r\n';
  };
  
  // Parses an a=extmap line (headerextension from RFC 5285). Sample input:
  // a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
  SDPUtils.parseExtmap = function(line) {
    var parts = line.substr(9).split(' ');
    return {
      id: parseInt(parts[0], 10),
      uri: parts[1]
    };
  };
  
  // Generates a=extmap line from RTCRtpHeaderExtensionParameters or
  // RTCRtpHeaderExtension.
  SDPUtils.writeExtmap = function(headerExtension) {
    return 'a=extmap:' + (headerExtension.id || headerExtension.preferredId) +
         ' ' + headerExtension.uri + '\r\n';
  };
  
  // Parses an ftmp line, returns dictionary. Sample input:
  // a=fmtp:96 vbr=on;cng=on
  // Also deals with vbr=on; cng=on
  SDPUtils.parseFmtp = function(line) {
    var parsed = {};
    var kv;
    var parts = line.substr(line.indexOf(' ') + 1).split(';');
    for (var j = 0; j < parts.length; j++) {
      kv = parts[j].trim().split('=');
      parsed[kv[0].trim()] = kv[1];
    }
    return parsed;
  };
  
  // Generates an a=ftmp line from RTCRtpCodecCapability or RTCRtpCodecParameters.
  SDPUtils.writeFmtp = function(codec) {
    var line = '';
    var pt = codec.payloadType;
    if (codec.preferredPayloadType !== undefined) {
      pt = codec.preferredPayloadType;
    }
    if (codec.parameters && Object.keys(codec.parameters).length) {
      var params = [];
      Object.keys(codec.parameters).forEach(function(param) {
        params.push(param + '=' + codec.parameters[param]);
      });
      line += 'a=fmtp:' + pt + ' ' + params.join(';') + '\r\n';
    }
    return line;
  };
  
  // Parses an rtcp-fb line, returns RTCPRtcpFeedback object. Sample input:
  // a=rtcp-fb:98 nack rpsi
  SDPUtils.parseRtcpFb = function(line) {
    var parts = line.substr(line.indexOf(' ') + 1).split(' ');
    return {
      type: parts.shift(),
      parameter: parts.join(' ')
    };
  };
  // Generate a=rtcp-fb lines from RTCRtpCodecCapability or RTCRtpCodecParameters.
  SDPUtils.writeRtcpFb = function(codec) {
    var lines = '';
    var pt = codec.payloadType;
    if (codec.preferredPayloadType !== undefined) {
      pt = codec.preferredPayloadType;
    }
    if (codec.rtcpFeedback && codec.rtcpFeedback.length) {
      // FIXME: special handling for trr-int?
      codec.rtcpFeedback.forEach(function(fb) {
        lines += 'a=rtcp-fb:' + pt + ' ' + fb.type +
        (fb.parameter && fb.parameter.length ? ' ' + fb.parameter : '') +
            '\r\n';
      });
    }
    return lines;
  };
  
  // Parses an RFC 5576 ssrc media attribute. Sample input:
  // a=ssrc:3735928559 cname:something
  SDPUtils.parseSsrcMedia = function(line) {
    var sp = line.indexOf(' ');
    var parts = {
      ssrc: parseInt(line.substr(7, sp - 7), 10)
    };
    var colon = line.indexOf(':', sp);
    if (colon > -1) {
      parts.attribute = line.substr(sp + 1, colon - sp - 1);
      parts.value = line.substr(colon + 1);
    } else {
      parts.attribute = line.substr(sp + 1);
    }
    return parts;
  };
  
  // Extracts DTLS parameters from SDP media section or sessionpart.
  // FIXME: for consistency with other functions this should only
  //   get the fingerprint line as input. See also getIceParameters.
  SDPUtils.getDtlsParameters = function(mediaSection, sessionpart) {
    var lines = SDPUtils.splitLines(mediaSection);
    // Search in session part, too.
    lines = lines.concat(SDPUtils.splitLines(sessionpart));
    var fpLine = lines.filter(function(line) {
      return line.indexOf('a=fingerprint:') === 0;
    })[0].substr(14);
    // Note: a=setup line is ignored since we use the 'auto' role.
    var dtlsParameters = {
      role: 'auto',
      fingerprints: [{
        algorithm: fpLine.split(' ')[0],
        value: fpLine.split(' ')[1]
      }]
    };
    return dtlsParameters;
  };
  
  // Serializes DTLS parameters to SDP.
  SDPUtils.writeDtlsParameters = function(params, setupType) {
    var sdp = 'a=setup:' + setupType + '\r\n';
    params.fingerprints.forEach(function(fp) {
      sdp += 'a=fingerprint:' + fp.algorithm + ' ' + fp.value + '\r\n';
    });
    return sdp;
  };
  // Parses ICE information from SDP media section or sessionpart.
  // FIXME: for consistency with other functions this should only
  //   get the ice-ufrag and ice-pwd lines as input.
  SDPUtils.getIceParameters = function(mediaSection, sessionpart) {
    var lines = SDPUtils.splitLines(mediaSection);
    // Search in session part, too.
    lines = lines.concat(SDPUtils.splitLines(sessionpart));
    var iceParameters = {
      usernameFragment: lines.filter(function(line) {
        return line.indexOf('a=ice-ufrag:') === 0;
      })[0].substr(12),
      password: lines.filter(function(line) {
        return line.indexOf('a=ice-pwd:') === 0;
      })[0].substr(10)
    };
    return iceParameters;
  };
  
  // Serializes ICE parameters to SDP.
  SDPUtils.writeIceParameters = function(params) {
    return 'a=ice-ufrag:' + params.usernameFragment + '\r\n' +
        'a=ice-pwd:' + params.password + '\r\n';
  };
  
  // Parses the SDP media section and returns RTCRtpParameters.
  SDPUtils.parseRtpParameters = function(mediaSection) {
    var description = {
      codecs: [],
      headerExtensions: [],
      fecMechanisms: [],
      rtcp: []
    };
    var lines = SDPUtils.splitLines(mediaSection);
    var mline = lines[0].split(' ');
    for (var i = 3; i < mline.length; i++) { // find all codecs from mline[3..]
      var pt = mline[i];
      var rtpmapline = SDPUtils.matchPrefix(
          mediaSection, 'a=rtpmap:' + pt + ' ')[0];
      if (rtpmapline) {
        var codec = SDPUtils.parseRtpMap(rtpmapline);
        var fmtps = SDPUtils.matchPrefix(
            mediaSection, 'a=fmtp:' + pt + ' ');
        // Only the first a=fmtp:<pt> is considered.
        codec.parameters = fmtps.length ? SDPUtils.parseFmtp(fmtps[0]) : {};
        codec.rtcpFeedback = SDPUtils.matchPrefix(
            mediaSection, 'a=rtcp-fb:' + pt + ' ')
          .map(SDPUtils.parseRtcpFb);
        description.codecs.push(codec);
        // parse FEC mechanisms from rtpmap lines.
        switch (codec.name.toUpperCase()) {
          case 'RED':
          case 'ULPFEC':
            description.fecMechanisms.push(codec.name.toUpperCase());
            break;
          default: // only RED and ULPFEC are recognized as FEC mechanisms.
            break;
        }
      }
    }
    SDPUtils.matchPrefix(mediaSection, 'a=extmap:').forEach(function(line) {
      description.headerExtensions.push(SDPUtils.parseExtmap(line));
    });
    // FIXME: parse rtcp.
    return description;
  };
  
  // Generates parts of the SDP media section describing the capabilities /
  // parameters.
  SDPUtils.writeRtpDescription = function(kind, caps) {
    var sdp = '';
  
    // Build the mline.
    sdp += 'm=' + kind + ' ';
    sdp += caps.codecs.length > 0 ? '9' : '0'; // reject if no codecs.
    sdp += ' UDP/TLS/RTP/SAVPF ';
    sdp += caps.codecs.map(function(codec) {
      if (codec.preferredPayloadType !== undefined) {
        return codec.preferredPayloadType;
      }
      return codec.payloadType;
    }).join(' ') + '\r\n';
  
    sdp += 'c=IN IP4 0.0.0.0\r\n';
    sdp += 'a=rtcp:9 IN IP4 0.0.0.0\r\n';
  
    // Add a=rtpmap lines for each codec. Also fmtp and rtcp-fb.
    caps.codecs.forEach(function(codec) {
      sdp += SDPUtils.writeRtpMap(codec);
      sdp += SDPUtils.writeFmtp(codec);
      sdp += SDPUtils.writeRtcpFb(codec);
    });
    // FIXME: add headerExtensions, fecMechanismş and rtcp.
    sdp += 'a=rtcp-mux\r\n';
    return sdp;
  };
  
  // Parses the SDP media section and returns an array of
  // RTCRtpEncodingParameters.
  SDPUtils.parseRtpEncodingParameters = function(mediaSection) {
    var encodingParameters = [];
    var description = SDPUtils.parseRtpParameters(mediaSection);
    var hasRed = description.fecMechanisms.indexOf('RED') !== -1;
    var hasUlpfec = description.fecMechanisms.indexOf('ULPFEC') !== -1;
  
    // filter a=ssrc:... cname:, ignore PlanB-msid
    var ssrcs = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
    .map(function(line) {
      return SDPUtils.parseSsrcMedia(line);
    })
    .filter(function(parts) {
      return parts.attribute === 'cname';
    });
    var primarySsrc = ssrcs.length > 0 && ssrcs[0].ssrc;
    var secondarySsrc;
  
    var flows = SDPUtils.matchPrefix(mediaSection, 'a=ssrc-group:FID')
    .map(function(line) {
      var parts = line.split(' ');
      parts.shift();
      return parts.map(function(part) {
        return parseInt(part, 10);
      });
    });
    if (flows.length > 0 && flows[0].length > 1 && flows[0][0] === primarySsrc) {
      secondarySsrc = flows[0][1];
    }
  
    description.codecs.forEach(function(codec) {
      if (codec.name.toUpperCase() === 'RTX' && codec.parameters.apt) {
        var encParam = {
          ssrc: primarySsrc,
          codecPayloadType: parseInt(codec.parameters.apt, 10),
          rtx: {
            payloadType: codec.payloadType,
            ssrc: secondarySsrc
          }
        };
        encodingParameters.push(encParam);
        if (hasRed) {
          encParam = JSON.parse(JSON.stringify(encParam));
          encParam.fec = {
            ssrc: secondarySsrc,
            mechanism: hasUlpfec ? 'red+ulpfec' : 'red'
          };
          encodingParameters.push(encParam);
        }
      }
    });
    if (encodingParameters.length === 0 && primarySsrc) {
      encodingParameters.push({
        ssrc: primarySsrc
      });
    }
  
    // we support both b=AS and b=TIAS but interpret AS as TIAS.
    var bandwidth = SDPUtils.matchPrefix(mediaSection, 'b=');
    if (bandwidth.length) {
      if (bandwidth[0].indexOf('b=TIAS:') === 0) {
        bandwidth = parseInt(bandwidth[0].substr(7), 10);
      } else if (bandwidth[0].indexOf('b=AS:') === 0) {
        bandwidth = parseInt(bandwidth[0].substr(5), 10);
      }
      encodingParameters.forEach(function(params) {
        params.maxBitrate = bandwidth;
      });
    }
    return encodingParameters;
  };
  
  SDPUtils.writeSessionBoilerplate = function() {
    // FIXME: sess-id should be an NTP timestamp.
    return 'v=0\r\n' +
        'o=thisisadapterortc 8169639915646943137 2 IN IP4 127.0.0.1\r\n' +
        's=-\r\n' +
        't=0 0\r\n';
  };
  
  SDPUtils.writeMediaSection = function(transceiver, caps, type, stream) {
    var sdp = SDPUtils.writeRtpDescription(transceiver.kind, caps);
  
    // Map ICE parameters (ufrag, pwd) to SDP.
    sdp += SDPUtils.writeIceParameters(
        transceiver.iceGatherer.getLocalParameters());
  
    // Map DTLS parameters to SDP.
    sdp += SDPUtils.writeDtlsParameters(
        transceiver.dtlsTransport.getLocalParameters(),
        type === 'offer' ? 'actpass' : 'active');
  
    sdp += 'a=mid:' + transceiver.mid + '\r\n';
  
    if (transceiver.rtpSender && transceiver.rtpReceiver) {
      sdp += 'a=sendrecv\r\n';
    } else if (transceiver.rtpSender) {
      sdp += 'a=sendonly\r\n';
    } else if (transceiver.rtpReceiver) {
      sdp += 'a=recvonly\r\n';
    } else {
      sdp += 'a=inactive\r\n';
    }
  
    // FIXME: for RTX there might be multiple SSRCs. Not implemented in Edge yet.
    if (transceiver.rtpSender) {
      var msid = 'msid:' + stream.id + ' ' +
          transceiver.rtpSender.track.id + '\r\n';
      sdp += 'a=' + msid;
      sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
          ' ' + msid;
    }
    // FIXME: this should be written by writeRtpDescription.
    sdp += 'a=ssrc:' + transceiver.sendEncodingParameters[0].ssrc +
        ' cname:' + SDPUtils.localCName + '\r\n';
    return sdp;
  };
  
  // Gets the direction from the mediaSection or the sessionpart.
  SDPUtils.getDirection = function(mediaSection, sessionpart) {
    // Look for sendrecv, sendonly, recvonly, inactive, default to sendrecv.
    var lines = SDPUtils.splitLines(mediaSection);
    for (var i = 0; i < lines.length; i++) {
      switch (lines[i]) {
        case 'a=sendrecv':
        case 'a=sendonly':
        case 'a=recvonly':
        case 'a=inactive':
          return lines[i].substr(2);
        default:
          // FIXME: What should happen here?
      }
    }
    if (sessionpart) {
      return SDPUtils.getDirection(sessionpart);
    }
    return 'sendrecv';
  };
  
  // Expose public methods.
  module.exports = SDPUtils;
  
  },{}],2:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  
  'use strict';
  
  // Shimming starts here.
  (function() {
    // Utils.
    var logging = require('./utils').log;
    var browserDetails = require('./utils').browserDetails;
    // Export to the adapter global object visible in the browser.
    module.exports.browserDetails = browserDetails;
    module.exports.extractVersion = require('./utils').extractVersion;
    module.exports.disableLog = require('./utils').disableLog;
  
    // Uncomment the line below if you want logging to occur, including logging
    // for the switch statement below. Can also be turned on in the browser via
    // adapter.disableLog(false), but then logging from the switch statement below
    // will not appear.
    // require('./utils').disableLog(false);
  
    // Browser shims.
    var chromeShim = require('./chrome/chrome_shim') || null;
    var edgeShim = require('./edge/edge_shim') || null;
    var firefoxShim = require('./firefox/firefox_shim') || null;
    var safariShim = require('./safari/safari_shim') || null;
  
    // Shim browser if found.
    switch (browserDetails.browser) {
      case 'opera': // fallthrough as it uses chrome shims
      case 'chrome':
        if (!chromeShim || !chromeShim.shimPeerConnection) {
          logging('Chrome shim is not included in this adapter release.');
          return;
        }
        logging('adapter.js shimming chrome.');
        // Export to the adapter global object visible in the browser.
        module.exports.browserShim = chromeShim;
  
        chromeShim.shimGetUserMedia();
        chromeShim.shimMediaStream();
        chromeShim.shimSourceObject();
        chromeShim.shimPeerConnection();
        chromeShim.shimOnTrack();
        break;
      case 'firefox':
        if (!firefoxShim || !firefoxShim.shimPeerConnection) {
          logging('Firefox shim is not included in this adapter release.');
          return;
        }
        logging('adapter.js shimming firefox.');
        // Export to the adapter global object visible in the browser.
        module.exports.browserShim = firefoxShim;
  
        firefoxShim.shimGetUserMedia();
        firefoxShim.shimSourceObject();
        firefoxShim.shimPeerConnection();
        firefoxShim.shimOnTrack();
        break;
      case 'edge':
        if (!edgeShim || !edgeShim.shimPeerConnection) {
          logging('MS edge shim is not included in this adapter release.');
          return;
        }
        logging('adapter.js shimming edge.');
        // Export to the adapter global object visible in the browser.
        module.exports.browserShim = edgeShim;
  
        edgeShim.shimGetUserMedia();
        edgeShim.shimPeerConnection();
        break;
      case 'safari':
        if (!safariShim) {
          logging('Safari shim is not included in this adapter release.');
          return;
        }
        logging('adapter.js shimming safari.');
        // Export to the adapter global object visible in the browser.
        module.exports.browserShim = safariShim;
  
        safariShim.shimGetUserMedia();
        break;
      default:
        logging('Unsupported browser!');
    }
  })();
  
  },{"./chrome/chrome_shim":3,"./edge/edge_shim":5,"./firefox/firefox_shim":7,"./safari/safari_shim":9,"./utils":10}],3:[function(require,module,exports){
  
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  var logging = require('../utils.js').log;
  var browserDetails = require('../utils.js').browserDetails;
  
  var chromeShim = {
    shimMediaStream: function() {
      window.MediaStream = window.MediaStream || window.webkitMediaStream;
    },
  
    shimOnTrack: function() {
      if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
          window.RTCPeerConnection.prototype)) {
        Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
          get: function() {
            return this._ontrack;
          },
          set: function(f) {
            var self = this;
            if (this._ontrack) {
              this.removeEventListener('track', this._ontrack);
              this.removeEventListener('addstream', this._ontrackpoly);
            }
            this.addEventListener('track', this._ontrack = f);
            this.addEventListener('addstream', this._ontrackpoly = function(e) {
              // onaddstream does not fire when a track is added to an existing
              // stream. But stream.onaddtrack is implemented so we use that.
              e.stream.addEventListener('addtrack', function(te) {
                var event = new Event('track');
                event.track = te.track;
                event.receiver = {track: te.track};
                event.streams = [e.stream];
                self.dispatchEvent(event);
              });
              e.stream.getTracks().forEach(function(track) {
                var event = new Event('track');
                event.track = track;
                event.receiver = {track: track};
                event.streams = [e.stream];
                this.dispatchEvent(event);
              }.bind(this));
            }.bind(this));
          }
        });
      }
    },
  
    shimSourceObject: function() {
      if (typeof window === 'object') {
        if (window.HTMLMediaElement &&
          !('srcObject' in window.HTMLMediaElement.prototype)) {
          // Shim the srcObject property, once, when HTMLMediaElement is found.
          Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
            get: function() {
              return this._srcObject;
            },
            set: function(stream) {
              var self = this;
              // Use _srcObject as a private property for this shim
              this._srcObject = stream;
              if (this.src) {
                URL.revokeObjectURL(this.src);
              }
  
              if (!stream) {
                this.src = '';
                return;
              }
              this.src = URL.createObjectURL(stream);
              // We need to recreate the blob url when a track is added or
              // removed. Doing it manually since we want to avoid a recursion.
              stream.addEventListener('addtrack', function() {
                if (self.src) {
                  URL.revokeObjectURL(self.src);
                }
                self.src = URL.createObjectURL(stream);
              });
              stream.addEventListener('removetrack', function() {
                if (self.src) {
                  URL.revokeObjectURL(self.src);
                }
                self.src = URL.createObjectURL(stream);
              });
            }
          });
        }
      }
    },
  
    shimPeerConnection: function() {
      // The RTCPeerConnection object.
      window.RTCPeerConnection = function(pcConfig, pcConstraints) {
        // Translate iceTransportPolicy to iceTransports,
        // see https://code.google.com/p/webrtc/issues/detail?id=4869
        logging('PeerConnection');
        if (pcConfig && pcConfig.iceTransportPolicy) {
          pcConfig.iceTransports = pcConfig.iceTransportPolicy;
        }
  
        var pc = new webkitRTCPeerConnection(pcConfig, pcConstraints);
        var origGetStats = pc.getStats.bind(pc);
        pc.getStats = function(selector, successCallback, errorCallback) {
          var self = this;
          var args = arguments;
  
          // If selector is a function then we are in the old style stats so just
          // pass back the original getStats format to avoid breaking old users.
          if (arguments.length > 0 && typeof selector === 'function') {
            return origGetStats(selector, successCallback);
          }
  
          var fixChromeStats_ = function(response) {
            var standardReport = {};
            var reports = response.result();
            reports.forEach(function(report) {
              var standardStats = {
                id: report.id,
                timestamp: report.timestamp,
                type: report.type
              };
              report.names().forEach(function(name) {
                standardStats[name] = report.stat(name);
              });
              standardReport[standardStats.id] = standardStats;
            });
  
            return standardReport;
          };
  
          // shim getStats with maplike support
          var makeMapStats = function(stats, legacyStats) {
            var map = new Map(Object.keys(stats).map(function(key) {
              return[key, stats[key]];
            }));
            legacyStats = legacyStats || stats;
            Object.keys(legacyStats).forEach(function(key) {
              map[key] = legacyStats[key];
            });
            return map;
          };
  
          if (arguments.length >= 2) {
            var successCallbackWrapper_ = function(response) {
              args[1](makeMapStats(fixChromeStats_(response)));
            };
  
            return origGetStats.apply(this, [successCallbackWrapper_,
                arguments[0]]);
          }
  
          // promise-support
          return new Promise(function(resolve, reject) {
            if (args.length === 1 && typeof selector === 'object') {
              origGetStats.apply(self, [
                function(response) {
                  resolve(makeMapStats(fixChromeStats_(response)));
                }, reject]);
            } else {
              // Preserve legacy chrome stats only on legacy access of stats obj
              origGetStats.apply(self, [
                function(response) {
                  resolve(makeMapStats(fixChromeStats_(response),
                      response.result()));
                }, reject]);
            }
          }).then(successCallback, errorCallback);
        };
  
        return pc;
      };
      window.RTCPeerConnection.prototype = webkitRTCPeerConnection.prototype;
  
      // wrap static methods. Currently just generateCertificate.
      if (webkitRTCPeerConnection.generateCertificate) {
        Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
          get: function() {
            return webkitRTCPeerConnection.generateCertificate;
          }
        });
      }
  
      ['createOffer', 'createAnswer'].forEach(function(method) {
        var nativeMethod = webkitRTCPeerConnection.prototype[method];
        webkitRTCPeerConnection.prototype[method] = function() {
          var self = this;
          if (arguments.length < 1 || (arguments.length === 1 &&
              typeof arguments[0] === 'object')) {
            var opts = arguments.length === 1 ? arguments[0] : undefined;
            return new Promise(function(resolve, reject) {
              nativeMethod.apply(self, [resolve, reject, opts]);
            });
          }
          return nativeMethod.apply(this, arguments);
        };
      });
  
      // add promise support -- natively available in Chrome 51
      if (browserDetails.version < 51) {
        ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
            .forEach(function(method) {
              var nativeMethod = webkitRTCPeerConnection.prototype[method];
              webkitRTCPeerConnection.prototype[method] = function() {
                var args = arguments;
                var self = this;
                var promise = new Promise(function(resolve, reject) {
                  nativeMethod.apply(self, [args[0], resolve, reject]);
                });
                if (args.length < 2) {
                  return promise;
                }
                return promise.then(function() {
                  args[1].apply(null, []);
                },
                function(err) {
                  if (args.length >= 3) {
                    args[2].apply(null, [err]);
                  }
                });
              };
            });
      }
  
      // shim implicit creation of RTCSessionDescription/RTCIceCandidate
      ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
          .forEach(function(method) {
            var nativeMethod = webkitRTCPeerConnection.prototype[method];
            webkitRTCPeerConnection.prototype[method] = function() {
              arguments[0] = new ((method === 'addIceCandidate') ?
                  RTCIceCandidate : RTCSessionDescription)(arguments[0]);
              return nativeMethod.apply(this, arguments);
            };
          });
  
      // support for addIceCandidate(null)
      var nativeAddIceCandidate =
          RTCPeerConnection.prototype.addIceCandidate;
      RTCPeerConnection.prototype.addIceCandidate = function() {
        return arguments[0] === null ? Promise.resolve()
            : nativeAddIceCandidate.apply(this, arguments);
      };
    }
  };
  
  
  // Expose public methods.
  module.exports = {
    shimMediaStream: chromeShim.shimMediaStream,
    shimOnTrack: chromeShim.shimOnTrack,
    shimSourceObject: chromeShim.shimSourceObject,
    shimPeerConnection: chromeShim.shimPeerConnection,
    shimGetUserMedia: require('./getusermedia')
  };
  
  },{"../utils.js":10,"./getusermedia":4}],4:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  var logging = require('../utils.js').log;
  
  // Expose public methods.
  module.exports = function() {
    var constraintsToChrome_ = function(c) {
      if (typeof c !== 'object' || c.mandatory || c.optional) {
        return c;
      }
      var cc = {};
      Object.keys(c).forEach(function(key) {
        if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
          return;
        }
        var r = (typeof c[key] === 'object') ? c[key] : {ideal: c[key]};
        if (r.exact !== undefined && typeof r.exact === 'number') {
          r.min = r.max = r.exact;
        }
        var oldname_ = function(prefix, name) {
          if (prefix) {
            return prefix + name.charAt(0).toUpperCase() + name.slice(1);
          }
          return (name === 'deviceId') ? 'sourceId' : name;
        };
        if (r.ideal !== undefined) {
          cc.optional = cc.optional || [];
          var oc = {};
          if (typeof r.ideal === 'number') {
            oc[oldname_('min', key)] = r.ideal;
            cc.optional.push(oc);
            oc = {};
            oc[oldname_('max', key)] = r.ideal;
            cc.optional.push(oc);
          } else {
            oc[oldname_('', key)] = r.ideal;
            cc.optional.push(oc);
          }
        }
        if (r.exact !== undefined && typeof r.exact !== 'number') {
          cc.mandatory = cc.mandatory || {};
          cc.mandatory[oldname_('', key)] = r.exact;
        } else {
          ['min', 'max'].forEach(function(mix) {
            if (r[mix] !== undefined) {
              cc.mandatory = cc.mandatory || {};
              cc.mandatory[oldname_(mix, key)] = r[mix];
            }
          });
        }
      });
      if (c.advanced) {
        cc.optional = (cc.optional || []).concat(c.advanced);
      }
      return cc;
    };
  
    var shimConstraints_ = function(constraints, func) {
      constraints = JSON.parse(JSON.stringify(constraints));
      if (constraints && constraints.audio) {
        constraints.audio = constraintsToChrome_(constraints.audio);
      }
      if (constraints && typeof constraints.video === 'object') {
        // Shim facingMode for mobile, where it defaults to "user".
        var face = constraints.video.facingMode;
        face = face && ((typeof face === 'object') ? face : {ideal: face});
  
        if ((face && (face.exact === 'user' || face.exact === 'environment' ||
                      face.ideal === 'user' || face.ideal === 'environment')) &&
            !(navigator.mediaDevices.getSupportedConstraints &&
              navigator.mediaDevices.getSupportedConstraints().facingMode)) {
          delete constraints.video.facingMode;
          if (face.exact === 'environment' || face.ideal === 'environment') {
            // Look for "back" in label, or use last cam (typically back cam).
            return navigator.mediaDevices.enumerateDevices()
            .then(function(devices) {
              devices = devices.filter(function(d) {
                return d.kind === 'videoinput';
              });
              var back = devices.find(function(d) {
                return d.label.toLowerCase().indexOf('back') !== -1;
              }) || (devices.length && devices[devices.length - 1]);
              if (back) {
                constraints.video.deviceId = face.exact ? {exact: back.deviceId} :
                                                          {ideal: back.deviceId};
              }
              constraints.video = constraintsToChrome_(constraints.video);
              logging('chrome: ' + JSON.stringify(constraints));
              return func(constraints);
            });
          }
        }
        constraints.video = constraintsToChrome_(constraints.video);
      }
      logging('chrome: ' + JSON.stringify(constraints));
      return func(constraints);
    };
  
    var shimError_ = function(e) {
      return {
        name: {
          PermissionDeniedError: 'NotAllowedError',
          ConstraintNotSatisfiedError: 'OverconstrainedError'
        }[e.name] || e.name,
        message: e.message,
        constraint: e.constraintName,
        toString: function() {
          return this.name + (this.message && ': ') + this.message;
        }
      };
    };
  
    var getUserMedia_ = function(constraints, onSuccess, onError) {
      shimConstraints_(constraints, function(c) {
        navigator.webkitGetUserMedia(c, onSuccess, function(e) {
          onError(shimError_(e));
        });
      });
    };
  
    navigator.getUserMedia = getUserMedia_;
  
    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        navigator.getUserMedia(constraints, resolve, reject);
      });
    };
  
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {
        getUserMedia: getUserMediaPromise_,
        enumerateDevices: function() {
          return new Promise(function(resolve) {
            var kinds = {audio: 'audioinput', video: 'videoinput'};
            return MediaStreamTrack.getSources(function(devices) {
              resolve(devices.map(function(device) {
                return {label: device.label,
                        kind: kinds[device.kind],
                        deviceId: device.id,
                        groupId: ''};
              }));
            });
          });
        }
      };
    }
  
    // A shim for getUserMedia method on the mediaDevices object.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        return getUserMediaPromise_(constraints);
      };
    } else {
      // Even though Chrome 45 has navigator.mediaDevices and a getUserMedia
      // function which returns a Promise, it does not accept spec-style
      // constraints.
      var origGetUserMedia = navigator.mediaDevices.getUserMedia.
          bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(cs) {
        return shimConstraints_(cs, function(c) {
          return origGetUserMedia(c).catch(function(e) {
            return Promise.reject(shimError_(e));
          });
        });
      };
    }
  
    // Dummy devicechange event methods.
    // TODO(KaptenJansson) remove once implemented in Chrome stable.
    if (typeof navigator.mediaDevices.addEventListener === 'undefined') {
      navigator.mediaDevices.addEventListener = function() {
        logging('Dummy mediaDevices.addEventListener called.');
      };
    }
    if (typeof navigator.mediaDevices.removeEventListener === 'undefined') {
      navigator.mediaDevices.removeEventListener = function() {
        logging('Dummy mediaDevices.removeEventListener called.');
      };
    }
  };
  
  },{"../utils.js":10}],5:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  
  var SDPUtils = require('sdp');
  
  var edgeShim = {
    shimPeerConnection: function() {
      if (window.RTCIceGatherer) {
        // ORTC defines an RTCIceCandidate object but no constructor.
        // Not implemented in Edge.
        if (!window.RTCIceCandidate) {
          window.RTCIceCandidate = function(args) {
            return args;
          };
        }
        // ORTC does not have a session description object but
        // other browsers (i.e. Chrome) that will support both PC and ORTC
        // in the future might have this defined already.
        if (!window.RTCSessionDescription) {
          window.RTCSessionDescription = function(args) {
            return args;
          };
        }
      }
  
      window.RTCPeerConnection = function(config) {
        var self = this;
  
        var _eventTarget = document.createDocumentFragment();
        ['addEventListener', 'removeEventListener', 'dispatchEvent']
            .forEach(function(method) {
              self[method] = _eventTarget[method].bind(_eventTarget);
            });
  
        this.onicecandidate = null;
        this.onaddstream = null;
        this.ontrack = null;
        this.onremovestream = null;
        this.onsignalingstatechange = null;
        this.oniceconnectionstatechange = null;
        this.onnegotiationneeded = null;
        this.ondatachannel = null;
  
        this.localStreams = [];
        this.remoteStreams = [];
        this.getLocalStreams = function() {
          return self.localStreams;
        };
        this.getRemoteStreams = function() {
          return self.remoteStreams;
        };
  
        this.localDescription = new RTCSessionDescription({
          type: '',
          sdp: ''
        });
        this.remoteDescription = new RTCSessionDescription({
          type: '',
          sdp: ''
        });
        this.signalingState = 'stable';
        this.iceConnectionState = 'new';
        this.iceGatheringState = 'new';
  
        this.iceOptions = {
          gatherPolicy: 'all',
          iceServers: []
        };
        if (config && config.iceTransportPolicy) {
          switch (config.iceTransportPolicy) {
            case 'all':
            case 'relay':
              this.iceOptions.gatherPolicy = config.iceTransportPolicy;
              break;
            case 'none':
              // FIXME: remove once implementation and spec have added this.
              throw new TypeError('iceTransportPolicy "none" not supported');
            default:
              // don't set iceTransportPolicy.
              break;
          }
        }
        this.usingBundle = config && config.bundlePolicy === 'max-bundle';
  
        if (config && config.iceServers) {
          // Edge does not like
          // 1) stun:
          // 2) turn: that does not have all of turn:host:port?transport=udp
          // 3) turn: with ipv6 addresses
          var iceServers = JSON.parse(JSON.stringify(config.iceServers));
          this.iceOptions.iceServers = iceServers.filter(function(server) {
            if (server && server.urls) {
              var urls = server.urls;
              if (typeof urls === 'string') {
                urls = [urls];
              }
              urls = urls.filter(function(url) {
                return url.indexOf('turn:') === 0 &&
                    url.indexOf('transport=udp') !== -1 &&
                    url.indexOf('turn:[') === -1;
              })[0];
              return !!urls;
            }
            return false;
          });
        }
  
        // per-track iceGathers, iceTransports, dtlsTransports, rtpSenders, ...
        // everything that is needed to describe a SDP m-line.
        this.transceivers = [];
  
        // since the iceGatherer is currently created in createOffer but we
        // must not emit candidates until after setLocalDescription we buffer
        // them in this array.
        this._localIceCandidatesBuffer = [];
      };
  
      window.RTCPeerConnection.prototype._emitBufferedCandidates = function() {
        var self = this;
        var sections = SDPUtils.splitSections(self.localDescription.sdp);
        // FIXME: need to apply ice candidates in a way which is async but
        // in-order
        this._localIceCandidatesBuffer.forEach(function(event) {
          var end = !event.candidate || Object.keys(event.candidate).length === 0;
          if (end) {
            for (var j = 1; j < sections.length; j++) {
              if (sections[j].indexOf('\r\na=end-of-candidates\r\n') === -1) {
                sections[j] += 'a=end-of-candidates\r\n';
              }
            }
          } else if (event.candidate.candidate.indexOf('typ endOfCandidates')
              === -1) {
            sections[event.candidate.sdpMLineIndex + 1] +=
                'a=' + event.candidate.candidate + '\r\n';
          }
          self.localDescription.sdp = sections.join('');
          self.dispatchEvent(event);
          if (self.onicecandidate !== null) {
            self.onicecandidate(event);
          }
          if (!event.candidate && self.iceGatheringState !== 'complete') {
            var complete = self.transceivers.every(function(transceiver) {
              return transceiver.iceGatherer &&
                  transceiver.iceGatherer.state === 'completed';
            });
            if (complete) {
              self.iceGatheringState = 'complete';
            }
          }
        });
        this._localIceCandidatesBuffer = [];
      };
  
      window.RTCPeerConnection.prototype.addStream = function(stream) {
        // Clone is necessary for local demos mostly, attaching directly
        // to two different senders does not work (build 10547).
        this.localStreams.push(stream.clone());
        this._maybeFireNegotiationNeeded();
      };
  
      window.RTCPeerConnection.prototype.removeStream = function(stream) {
        var idx = this.localStreams.indexOf(stream);
        if (idx > -1) {
          this.localStreams.splice(idx, 1);
          this._maybeFireNegotiationNeeded();
        }
      };
  
      window.RTCPeerConnection.prototype.getSenders = function() {
        return this.transceivers.filter(function(transceiver) {
          return !!transceiver.rtpSender;
        })
        .map(function(transceiver) {
          return transceiver.rtpSender;
        });
      };
  
      window.RTCPeerConnection.prototype.getReceivers = function() {
        return this.transceivers.filter(function(transceiver) {
          return !!transceiver.rtpReceiver;
        })
        .map(function(transceiver) {
          return transceiver.rtpReceiver;
        });
      };
  
      // Determines the intersection of local and remote capabilities.
      window.RTCPeerConnection.prototype._getCommonCapabilities =
          function(localCapabilities, remoteCapabilities) {
            var commonCapabilities = {
              codecs: [],
              headerExtensions: [],
              fecMechanisms: []
            };
            localCapabilities.codecs.forEach(function(lCodec) {
              for (var i = 0; i < remoteCapabilities.codecs.length; i++) {
                var rCodec = remoteCapabilities.codecs[i];
                if (lCodec.name.toLowerCase() === rCodec.name.toLowerCase() &&
                    lCodec.clockRate === rCodec.clockRate &&
                    lCodec.numChannels === rCodec.numChannels) {
                  // push rCodec so we reply with offerer payload type
                  commonCapabilities.codecs.push(rCodec);
  
                  // determine common feedback mechanisms
                  rCodec.rtcpFeedback = rCodec.rtcpFeedback.filter(function(fb) {
                    for (var j = 0; j < lCodec.rtcpFeedback.length; j++) {
                      if (lCodec.rtcpFeedback[j].type === fb.type &&
                          lCodec.rtcpFeedback[j].parameter === fb.parameter) {
                        return true;
                      }
                    }
                    return false;
                  });
                  // FIXME: also need to determine .parameters
                  //  see https://github.com/openpeer/ortc/issues/569
                  break;
                }
              }
            });
  
            localCapabilities.headerExtensions
                .forEach(function(lHeaderExtension) {
                  for (var i = 0; i < remoteCapabilities.headerExtensions.length;
                       i++) {
                    var rHeaderExtension = remoteCapabilities.headerExtensions[i];
                    if (lHeaderExtension.uri === rHeaderExtension.uri) {
                      commonCapabilities.headerExtensions.push(rHeaderExtension);
                      break;
                    }
                  }
                });
  
            // FIXME: fecMechanisms
            return commonCapabilities;
          };
  
      // Create ICE gatherer, ICE transport and DTLS transport.
      window.RTCPeerConnection.prototype._createIceAndDtlsTransports =
          function(mid, sdpMLineIndex) {
            var self = this;
            var iceGatherer = new RTCIceGatherer(self.iceOptions);
            var iceTransport = new RTCIceTransport(iceGatherer);
            iceGatherer.onlocalcandidate = function(evt) {
              var event = new Event('icecandidate');
              event.candidate = {sdpMid: mid, sdpMLineIndex: sdpMLineIndex};
  
              var cand = evt.candidate;
              var end = !cand || Object.keys(cand).length === 0;
              // Edge emits an empty object for RTCIceCandidateComplete‥
              if (end) {
                // polyfill since RTCIceGatherer.state is not implemented in
                // Edge 10547 yet.
                if (iceGatherer.state === undefined) {
                  iceGatherer.state = 'completed';
                }
  
                // Emit a candidate with type endOfCandidates to make the samples
                // work. Edge requires addIceCandidate with this empty candidate
                // to start checking. The real solution is to signal
                // end-of-candidates to the other side when getting the null
                // candidate but some apps (like the samples) don't do that.
                event.candidate.candidate =
                    'candidate:1 1 udp 1 0.0.0.0 9 typ endOfCandidates';
              } else {
                // RTCIceCandidate doesn't have a component, needs to be added
                cand.component = iceTransport.component === 'RTCP' ? 2 : 1;
                event.candidate.candidate = SDPUtils.writeCandidate(cand);
              }
  
              // update local description.
              var sections = SDPUtils.splitSections(self.localDescription.sdp);
              if (event.candidate.candidate.indexOf('typ endOfCandidates')
                  === -1) {
                sections[event.candidate.sdpMLineIndex + 1] +=
                    'a=' + event.candidate.candidate + '\r\n';
              } else {
                sections[event.candidate.sdpMLineIndex + 1] +=
                    'a=end-of-candidates\r\n';
              }
              self.localDescription.sdp = sections.join('');
  
              var complete = self.transceivers.every(function(transceiver) {
                return transceiver.iceGatherer &&
                    transceiver.iceGatherer.state === 'completed';
              });
  
              // Emit candidate if localDescription is set.
              // Also emits null candidate when all gatherers are complete.
              switch (self.iceGatheringState) {
                case 'new':
                  self._localIceCandidatesBuffer.push(event);
                  if (end && complete) {
                    self._localIceCandidatesBuffer.push(
                        new Event('icecandidate'));
                  }
                  break;
                case 'gathering':
                  self._emitBufferedCandidates();
                  self.dispatchEvent(event);
                  if (self.onicecandidate !== null) {
                    self.onicecandidate(event);
                  }
                  if (complete) {
                    self.dispatchEvent(new Event('icecandidate'));
                    if (self.onicecandidate !== null) {
                      self.onicecandidate(new Event('icecandidate'));
                    }
                    self.iceGatheringState = 'complete';
                  }
                  break;
                case 'complete':
                  // should not happen... currently!
                  break;
                default: // no-op.
                  break;
              }
            };
            iceTransport.onicestatechange = function() {
              self._updateConnectionState();
            };
  
            var dtlsTransport = new RTCDtlsTransport(iceTransport);
            dtlsTransport.ondtlsstatechange = function() {
              self._updateConnectionState();
            };
            dtlsTransport.onerror = function() {
              // onerror does not set state to failed by itself.
              dtlsTransport.state = 'failed';
              self._updateConnectionState();
            };
  
            return {
              iceGatherer: iceGatherer,
              iceTransport: iceTransport,
              dtlsTransport: dtlsTransport
            };
          };
  
      // Start the RTP Sender and Receiver for a transceiver.
      window.RTCPeerConnection.prototype._transceive = function(transceiver,
          send, recv) {
        var params = this._getCommonCapabilities(transceiver.localCapabilities,
            transceiver.remoteCapabilities);
        if (send && transceiver.rtpSender) {
          params.encodings = transceiver.sendEncodingParameters;
          params.rtcp = {
            cname: SDPUtils.localCName
          };
          if (transceiver.recvEncodingParameters.length) {
            params.rtcp.ssrc = transceiver.recvEncodingParameters[0].ssrc;
          }
          transceiver.rtpSender.send(params);
        }
        if (recv && transceiver.rtpReceiver) {
          params.encodings = transceiver.recvEncodingParameters;
          params.rtcp = {
            cname: transceiver.cname
          };
          if (transceiver.sendEncodingParameters.length) {
            params.rtcp.ssrc = transceiver.sendEncodingParameters[0].ssrc;
          }
          transceiver.rtpReceiver.receive(params);
        }
      };
  
      window.RTCPeerConnection.prototype.setLocalDescription =
          function(description) {
            var self = this;
            var sections;
            var sessionpart;
            if (description.type === 'offer') {
              // FIXME: What was the purpose of this empty if statement?
              // if (!this._pendingOffer) {
              // } else {
              if (this._pendingOffer) {
                // VERY limited support for SDP munging. Limited to:
                // * changing the order of codecs
                sections = SDPUtils.splitSections(description.sdp);
                sessionpart = sections.shift();
                sections.forEach(function(mediaSection, sdpMLineIndex) {
                  var caps = SDPUtils.parseRtpParameters(mediaSection);
                  self._pendingOffer[sdpMLineIndex].localCapabilities = caps;
                });
                this.transceivers = this._pendingOffer;
                delete this._pendingOffer;
              }
            } else if (description.type === 'answer') {
              sections = SDPUtils.splitSections(self.remoteDescription.sdp);
              sessionpart = sections.shift();
              var isIceLite = SDPUtils.matchPrefix(sessionpart,
                  'a=ice-lite').length > 0;
              sections.forEach(function(mediaSection, sdpMLineIndex) {
                var transceiver = self.transceivers[sdpMLineIndex];
                var iceGatherer = transceiver.iceGatherer;
                var iceTransport = transceiver.iceTransport;
                var dtlsTransport = transceiver.dtlsTransport;
                var localCapabilities = transceiver.localCapabilities;
                var remoteCapabilities = transceiver.remoteCapabilities;
                var rejected = mediaSection.split('\n', 1)[0]
                    .split(' ', 2)[1] === '0';
  
                if (!rejected) {
                  var remoteIceParameters = SDPUtils.getIceParameters(
                      mediaSection, sessionpart);
                  if (isIceLite) {
                    var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
                    .map(function(cand) {
                      return SDPUtils.parseCandidate(cand);
                    })
                    .filter(function(cand) {
                      return cand.component === '1';
                    });
                    // ice-lite only includes host candidates in the SDP so we can
                    // use setRemoteCandidates (which implies an
                    // RTCIceCandidateComplete)
                    if (cands.length) {
                      iceTransport.setRemoteCandidates(cands);
                    }
                  }
                  var remoteDtlsParameters = SDPUtils.getDtlsParameters(
                      mediaSection, sessionpart);
                  if (isIceLite) {
                    remoteDtlsParameters.role = 'server';
                  }
  
                  if (!self.usingBundle || sdpMLineIndex === 0) {
                    iceTransport.start(iceGatherer, remoteIceParameters,
                        isIceLite ? 'controlling' : 'controlled');
                    dtlsTransport.start(remoteDtlsParameters);
                  }
  
                  // Calculate intersection of capabilities.
                  var params = self._getCommonCapabilities(localCapabilities,
                      remoteCapabilities);
  
                  // Start the RTCRtpSender. The RTCRtpReceiver for this
                  // transceiver has already been started in setRemoteDescription.
                  self._transceive(transceiver,
                      params.codecs.length > 0,
                      false);
                }
              });
            }
  
            this.localDescription = {
              type: description.type,
              sdp: description.sdp
            };
            switch (description.type) {
              case 'offer':
                this._updateSignalingState('have-local-offer');
                break;
              case 'answer':
                this._updateSignalingState('stable');
                break;
              default:
                throw new TypeError('unsupported type "' + description.type +
                    '"');
            }
  
            // If a success callback was provided, emit ICE candidates after it
            // has been executed. Otherwise, emit callback after the Promise is
            // resolved.
            var hasCallback = arguments.length > 1 &&
              typeof arguments[1] === 'function';
            if (hasCallback) {
              var cb = arguments[1];
              window.setTimeout(function() {
                cb();
                if (self.iceGatheringState === 'new') {
                  self.iceGatheringState = 'gathering';
                }
                self._emitBufferedCandidates();
              }, 0);
            }
            var p = Promise.resolve();
            p.then(function() {
              if (!hasCallback) {
                if (self.iceGatheringState === 'new') {
                  self.iceGatheringState = 'gathering';
                }
                // Usually candidates will be emitted earlier.
                window.setTimeout(self._emitBufferedCandidates.bind(self), 500);
              }
            });
            return p;
          };
  
      window.RTCPeerConnection.prototype.setRemoteDescription =
          function(description) {
            var self = this;
            var stream = new MediaStream();
            var receiverList = [];
            var sections = SDPUtils.splitSections(description.sdp);
            var sessionpart = sections.shift();
            var isIceLite = SDPUtils.matchPrefix(sessionpart,
                'a=ice-lite').length > 0;
            this.usingBundle = SDPUtils.matchPrefix(sessionpart,
                'a=group:BUNDLE ').length > 0;
            sections.forEach(function(mediaSection, sdpMLineIndex) {
              var lines = SDPUtils.splitLines(mediaSection);
              var mline = lines[0].substr(2).split(' ');
              var kind = mline[0];
              var rejected = mline[1] === '0';
              var direction = SDPUtils.getDirection(mediaSection, sessionpart);
  
              var transceiver;
              var iceGatherer;
              var iceTransport;
              var dtlsTransport;
              var rtpSender;
              var rtpReceiver;
              var sendEncodingParameters;
              var recvEncodingParameters;
              var localCapabilities;
  
              var track;
              // FIXME: ensure the mediaSection has rtcp-mux set.
              var remoteCapabilities = SDPUtils.parseRtpParameters(mediaSection);
              var remoteIceParameters;
              var remoteDtlsParameters;
              if (!rejected) {
                remoteIceParameters = SDPUtils.getIceParameters(mediaSection,
                    sessionpart);
                remoteDtlsParameters = SDPUtils.getDtlsParameters(mediaSection,
                    sessionpart);
                remoteDtlsParameters.role = 'client';
              }
              recvEncodingParameters =
                  SDPUtils.parseRtpEncodingParameters(mediaSection);
  
              var mid = SDPUtils.matchPrefix(mediaSection, 'a=mid:');
              if (mid.length) {
                mid = mid[0].substr(6);
              } else {
                mid = SDPUtils.generateIdentifier();
              }
  
              var cname;
              // Gets the first SSRC. Note that with RTX there might be multiple
              // SSRCs.
              var remoteSsrc = SDPUtils.matchPrefix(mediaSection, 'a=ssrc:')
                  .map(function(line) {
                    return SDPUtils.parseSsrcMedia(line);
                  })
                  .filter(function(obj) {
                    return obj.attribute === 'cname';
                  })[0];
              if (remoteSsrc) {
                cname = remoteSsrc.value;
              }
  
              var isComplete = SDPUtils.matchPrefix(mediaSection,
                  'a=end-of-candidates', sessionpart).length > 0;
              var cands = SDPUtils.matchPrefix(mediaSection, 'a=candidate:')
                  .map(function(cand) {
                    return SDPUtils.parseCandidate(cand);
                  })
                  .filter(function(cand) {
                    return cand.component === '1';
                  });
              if (description.type === 'offer' && !rejected) {
                var transports = self.usingBundle && sdpMLineIndex > 0 ? {
                  iceGatherer: self.transceivers[0].iceGatherer,
                  iceTransport: self.transceivers[0].iceTransport,
                  dtlsTransport: self.transceivers[0].dtlsTransport
                } : self._createIceAndDtlsTransports(mid, sdpMLineIndex);
  
                if (isComplete) {
                  transports.iceTransport.setRemoteCandidates(cands);
                }
  
                localCapabilities = RTCRtpReceiver.getCapabilities(kind);
                sendEncodingParameters = [{
                  ssrc: (2 * sdpMLineIndex + 2) * 1001
                }];
  
                rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);
  
                track = rtpReceiver.track;
                receiverList.push([track, rtpReceiver]);
                // FIXME: not correct when there are multiple streams but that is
                // not currently supported in this shim.
                stream.addTrack(track);
  
                // FIXME: look at direction.
                if (self.localStreams.length > 0 &&
                    self.localStreams[0].getTracks().length >= sdpMLineIndex) {
                  var localTrack;
                  if (kind === 'audio') {
                    localTrack = self.localStreams[0].getAudioTracks()[0];
                  } else if (kind === 'video') {
                    localTrack = self.localStreams[0].getVideoTracks()[0];
                  }
                  if (localTrack) {
                    rtpSender = new RTCRtpSender(localTrack,
                        transports.dtlsTransport);
                  }
                }
  
                self.transceivers[sdpMLineIndex] = {
                  iceGatherer: transports.iceGatherer,
                  iceTransport: transports.iceTransport,
                  dtlsTransport: transports.dtlsTransport,
                  localCapabilities: localCapabilities,
                  remoteCapabilities: remoteCapabilities,
                  rtpSender: rtpSender,
                  rtpReceiver: rtpReceiver,
                  kind: kind,
                  mid: mid,
                  cname: cname,
                  sendEncodingParameters: sendEncodingParameters,
                  recvEncodingParameters: recvEncodingParameters
                };
                // Start the RTCRtpReceiver now. The RTPSender is started in
                // setLocalDescription.
                self._transceive(self.transceivers[sdpMLineIndex],
                    false,
                    direction === 'sendrecv' || direction === 'sendonly');
              } else if (description.type === 'answer' && !rejected) {
                transceiver = self.transceivers[sdpMLineIndex];
                iceGatherer = transceiver.iceGatherer;
                iceTransport = transceiver.iceTransport;
                dtlsTransport = transceiver.dtlsTransport;
                rtpSender = transceiver.rtpSender;
                rtpReceiver = transceiver.rtpReceiver;
                sendEncodingParameters = transceiver.sendEncodingParameters;
                localCapabilities = transceiver.localCapabilities;
  
                self.transceivers[sdpMLineIndex].recvEncodingParameters =
                    recvEncodingParameters;
                self.transceivers[sdpMLineIndex].remoteCapabilities =
                    remoteCapabilities;
                self.transceivers[sdpMLineIndex].cname = cname;
  
                if ((isIceLite || isComplete) && cands.length) {
                  iceTransport.setRemoteCandidates(cands);
                }
                if (!self.usingBundle || sdpMLineIndex === 0) {
                  iceTransport.start(iceGatherer, remoteIceParameters,
                      'controlling');
                  dtlsTransport.start(remoteDtlsParameters);
                }
  
                self._transceive(transceiver,
                    direction === 'sendrecv' || direction === 'recvonly',
                    direction === 'sendrecv' || direction === 'sendonly');
  
                if (rtpReceiver &&
                    (direction === 'sendrecv' || direction === 'sendonly')) {
                  track = rtpReceiver.track;
                  receiverList.push([track, rtpReceiver]);
                  stream.addTrack(track);
                } else {
                  // FIXME: actually the receiver should be created later.
                  delete transceiver.rtpReceiver;
                }
              }
            });
  
            this.remoteDescription = {
              type: description.type,
              sdp: description.sdp
            };
            switch (description.type) {
              case 'offer':
                this._updateSignalingState('have-remote-offer');
                break;
              case 'answer':
                this._updateSignalingState('stable');
                break;
              default:
                throw new TypeError('unsupported type "' + description.type +
                    '"');
            }
            if (stream.getTracks().length) {
              self.remoteStreams.push(stream);
              window.setTimeout(function() {
                var event = new Event('addstream');
                event.stream = stream;
                self.dispatchEvent(event);
                if (self.onaddstream !== null) {
                  window.setTimeout(function() {
                    self.onaddstream(event);
                  }, 0);
                }
  
                receiverList.forEach(function(item) {
                  var track = item[0];
                  var receiver = item[1];
                  var trackEvent = new Event('track');
                  trackEvent.track = track;
                  trackEvent.receiver = receiver;
                  trackEvent.streams = [stream];
                  self.dispatchEvent(event);
                  if (self.ontrack !== null) {
                    window.setTimeout(function() {
                      self.ontrack(trackEvent);
                    }, 0);
                  }
                });
              }, 0);
            }
            if (arguments.length > 1 && typeof arguments[1] === 'function') {
              window.setTimeout(arguments[1], 0);
            }
            return Promise.resolve();
          };
  
      window.RTCPeerConnection.prototype.close = function() {
        this.transceivers.forEach(function(transceiver) {
          /* not yet
          if (transceiver.iceGatherer) {
            transceiver.iceGatherer.close();
          }
          */
          if (transceiver.iceTransport) {
            transceiver.iceTransport.stop();
          }
          if (transceiver.dtlsTransport) {
            transceiver.dtlsTransport.stop();
          }
          if (transceiver.rtpSender) {
            transceiver.rtpSender.stop();
          }
          if (transceiver.rtpReceiver) {
            transceiver.rtpReceiver.stop();
          }
        });
        // FIXME: clean up tracks, local streams, remote streams, etc
        this._updateSignalingState('closed');
      };
  
      // Update the signaling state.
      window.RTCPeerConnection.prototype._updateSignalingState =
          function(newState) {
            this.signalingState = newState;
            var event = new Event('signalingstatechange');
            this.dispatchEvent(event);
            if (this.onsignalingstatechange !== null) {
              this.onsignalingstatechange(event);
            }
          };
  
      // Determine whether to fire the negotiationneeded event.
      window.RTCPeerConnection.prototype._maybeFireNegotiationNeeded =
          function() {
            // Fire away (for now).
            var event = new Event('negotiationneeded');
            this.dispatchEvent(event);
            if (this.onnegotiationneeded !== null) {
              this.onnegotiationneeded(event);
            }
          };
  
      // Update the connection state.
      window.RTCPeerConnection.prototype._updateConnectionState = function() {
        var self = this;
        var newState;
        var states = {
          'new': 0,
          closed: 0,
          connecting: 0,
          checking: 0,
          connected: 0,
          completed: 0,
          failed: 0
        };
        this.transceivers.forEach(function(transceiver) {
          states[transceiver.iceTransport.state]++;
          states[transceiver.dtlsTransport.state]++;
        });
        // ICETransport.completed and connected are the same for this purpose.
        states.connected += states.completed;
  
        newState = 'new';
        if (states.failed > 0) {
          newState = 'failed';
        } else if (states.connecting > 0 || states.checking > 0) {
          newState = 'connecting';
        } else if (states.disconnected > 0) {
          newState = 'disconnected';
        } else if (states.new > 0) {
          newState = 'new';
        } else if (states.connected > 0 || states.completed > 0) {
          newState = 'connected';
        }
  
        if (newState !== self.iceConnectionState) {
          self.iceConnectionState = newState;
          var event = new Event('iceconnectionstatechange');
          this.dispatchEvent(event);
          if (this.oniceconnectionstatechange !== null) {
            this.oniceconnectionstatechange(event);
          }
        }
      };
  
      window.RTCPeerConnection.prototype.createOffer = function() {
        var self = this;
        if (this._pendingOffer) {
          throw new Error('createOffer called while there is a pending offer.');
        }
        var offerOptions;
        if (arguments.length === 1 && typeof arguments[0] !== 'function') {
          offerOptions = arguments[0];
        } else if (arguments.length === 3) {
          offerOptions = arguments[2];
        }
  
        var tracks = [];
        var numAudioTracks = 0;
        var numVideoTracks = 0;
        // Default to sendrecv.
        if (this.localStreams.length) {
          numAudioTracks = this.localStreams[0].getAudioTracks().length;
          numVideoTracks = this.localStreams[0].getVideoTracks().length;
        }
        // Determine number of audio and video tracks we need to send/recv.
        if (offerOptions) {
          // Reject Chrome legacy constraints.
          if (offerOptions.mandatory || offerOptions.optional) {
            throw new TypeError(
                'Legacy mandatory/optional constraints not supported.');
          }
          if (offerOptions.offerToReceiveAudio !== undefined) {
            numAudioTracks = offerOptions.offerToReceiveAudio;
          }
          if (offerOptions.offerToReceiveVideo !== undefined) {
            numVideoTracks = offerOptions.offerToReceiveVideo;
          }
        }
        if (this.localStreams.length) {
          // Push local streams.
          this.localStreams[0].getTracks().forEach(function(track) {
            tracks.push({
              kind: track.kind,
              track: track,
              wantReceive: track.kind === 'audio' ?
                  numAudioTracks > 0 : numVideoTracks > 0
            });
            if (track.kind === 'audio') {
              numAudioTracks--;
            } else if (track.kind === 'video') {
              numVideoTracks--;
            }
          });
        }
        // Create M-lines for recvonly streams.
        while (numAudioTracks > 0 || numVideoTracks > 0) {
          if (numAudioTracks > 0) {
            tracks.push({
              kind: 'audio',
              wantReceive: true
            });
            numAudioTracks--;
          }
          if (numVideoTracks > 0) {
            tracks.push({
              kind: 'video',
              wantReceive: true
            });
            numVideoTracks--;
          }
        }
  
        var sdp = SDPUtils.writeSessionBoilerplate();
        var transceivers = [];
        tracks.forEach(function(mline, sdpMLineIndex) {
          // For each track, create an ice gatherer, ice transport,
          // dtls transport, potentially rtpsender and rtpreceiver.
          var track = mline.track;
          var kind = mline.kind;
          var mid = SDPUtils.generateIdentifier();
  
          var transports = self.usingBundle && sdpMLineIndex > 0 ? {
            iceGatherer: transceivers[0].iceGatherer,
            iceTransport: transceivers[0].iceTransport,
            dtlsTransport: transceivers[0].dtlsTransport
          } : self._createIceAndDtlsTransports(mid, sdpMLineIndex);
  
          var localCapabilities = RTCRtpSender.getCapabilities(kind);
          var rtpSender;
          var rtpReceiver;
  
          // generate an ssrc now, to be used later in rtpSender.send
          var sendEncodingParameters = [{
            ssrc: (2 * sdpMLineIndex + 1) * 1001
          }];
          if (track) {
            rtpSender = new RTCRtpSender(track, transports.dtlsTransport);
          }
  
          if (mline.wantReceive) {
            rtpReceiver = new RTCRtpReceiver(transports.dtlsTransport, kind);
          }
  
          transceivers[sdpMLineIndex] = {
            iceGatherer: transports.iceGatherer,
            iceTransport: transports.iceTransport,
            dtlsTransport: transports.dtlsTransport,
            localCapabilities: localCapabilities,
            remoteCapabilities: null,
            rtpSender: rtpSender,
            rtpReceiver: rtpReceiver,
            kind: kind,
            mid: mid,
            sendEncodingParameters: sendEncodingParameters,
            recvEncodingParameters: null
          };
        });
        if (this.usingBundle) {
          sdp += 'a=group:BUNDLE ' + transceivers.map(function(t) {
            return t.mid;
          }).join(' ') + '\r\n';
        }
        tracks.forEach(function(mline, sdpMLineIndex) {
          var transceiver = transceivers[sdpMLineIndex];
          sdp += SDPUtils.writeMediaSection(transceiver,
              transceiver.localCapabilities, 'offer', self.localStreams[0]);
        });
  
        this._pendingOffer = transceivers;
        var desc = new RTCSessionDescription({
          type: 'offer',
          sdp: sdp
        });
        if (arguments.length && typeof arguments[0] === 'function') {
          window.setTimeout(arguments[0], 0, desc);
        }
        return Promise.resolve(desc);
      };
  
      window.RTCPeerConnection.prototype.createAnswer = function() {
        var self = this;
  
        var sdp = SDPUtils.writeSessionBoilerplate();
        if (this.usingBundle) {
          sdp += 'a=group:BUNDLE ' + this.transceivers.map(function(t) {
            return t.mid;
          }).join(' ') + '\r\n';
        }
        this.transceivers.forEach(function(transceiver) {
          // Calculate intersection of capabilities.
          var commonCapabilities = self._getCommonCapabilities(
              transceiver.localCapabilities,
              transceiver.remoteCapabilities);
  
          sdp += SDPUtils.writeMediaSection(transceiver, commonCapabilities,
              'answer', self.localStreams[0]);
        });
  
        var desc = new RTCSessionDescription({
          type: 'answer',
          sdp: sdp
        });
        if (arguments.length && typeof arguments[0] === 'function') {
          window.setTimeout(arguments[0], 0, desc);
        }
        return Promise.resolve(desc);
      };
  
      window.RTCPeerConnection.prototype.addIceCandidate = function(candidate) {
        if (candidate === null) {
          this.transceivers.forEach(function(transceiver) {
            transceiver.iceTransport.addRemoteCandidate({});
          });
        } else {
          var mLineIndex = candidate.sdpMLineIndex;
          if (candidate.sdpMid) {
            for (var i = 0; i < this.transceivers.length; i++) {
              if (this.transceivers[i].mid === candidate.sdpMid) {
                mLineIndex = i;
                break;
              }
            }
          }
          var transceiver = this.transceivers[mLineIndex];
          if (transceiver) {
            var cand = Object.keys(candidate.candidate).length > 0 ?
                SDPUtils.parseCandidate(candidate.candidate) : {};
            // Ignore Chrome's invalid candidates since Edge does not like them.
            if (cand.protocol === 'tcp' && (cand.port === 0 || cand.port === 9)) {
              return;
            }
            // Ignore RTCP candidates, we assume RTCP-MUX.
            if (cand.component !== '1') {
              return;
            }
            // A dirty hack to make samples work.
            if (cand.type === 'endOfCandidates') {
              cand = {};
            }
            transceiver.iceTransport.addRemoteCandidate(cand);
  
            // update the remoteDescription.
            var sections = SDPUtils.splitSections(this.remoteDescription.sdp);
            sections[mLineIndex + 1] += (cand.type ? candidate.candidate.trim()
                : 'a=end-of-candidates') + '\r\n';
            this.remoteDescription.sdp = sections.join('');
          }
        }
        if (arguments.length > 1 && typeof arguments[1] === 'function') {
          window.setTimeout(arguments[1], 0);
        }
        return Promise.resolve();
      };
  
      window.RTCPeerConnection.prototype.getStats = function() {
        var promises = [];
        this.transceivers.forEach(function(transceiver) {
          ['rtpSender', 'rtpReceiver', 'iceGatherer', 'iceTransport',
              'dtlsTransport'].forEach(function(method) {
                if (transceiver[method]) {
                  promises.push(transceiver[method].getStats());
                }
              });
        });
        var cb = arguments.length > 1 && typeof arguments[1] === 'function' &&
            arguments[1];
        return new Promise(function(resolve) {
          // shim getStats with maplike support
          var results = new Map();
          Promise.all(promises).then(function(res) {
            res.forEach(function(result) {
              Object.keys(result).forEach(function(id) {
                results.set(id, result[id]);
                results[id] = result[id];
              });
            });
            if (cb) {
              window.setTimeout(cb, 0, results);
            }
            resolve(results);
          });
        });
      };
    }
  };
  
  // Expose public methods.
  module.exports = {
    shimPeerConnection: edgeShim.shimPeerConnection,
    shimGetUserMedia: require('./getusermedia')
  };
  
  },{"./getusermedia":6,"sdp":1}],6:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  
  // Expose public methods.
  module.exports = function() {
    var shimError_ = function(e) {
      return {
        name: {PermissionDeniedError: 'NotAllowedError'}[e.name] || e.name,
        message: e.message,
        constraint: e.constraint,
        toString: function() {
          return this.name;
        }
      };
    };
  
    // getUserMedia error shim.
    var origGetUserMedia = navigator.mediaDevices.getUserMedia.
        bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function(c) {
      return origGetUserMedia(c).catch(function(e) {
        return Promise.reject(shimError_(e));
      });
    };
  };
  
  },{}],7:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  
  var browserDetails = require('../utils').browserDetails;
  
  var firefoxShim = {
    shimOnTrack: function() {
      if (typeof window === 'object' && window.RTCPeerConnection && !('ontrack' in
          window.RTCPeerConnection.prototype)) {
        Object.defineProperty(window.RTCPeerConnection.prototype, 'ontrack', {
          get: function() {
            return this._ontrack;
          },
          set: function(f) {
            if (this._ontrack) {
              this.removeEventListener('track', this._ontrack);
              this.removeEventListener('addstream', this._ontrackpoly);
            }
            this.addEventListener('track', this._ontrack = f);
            this.addEventListener('addstream', this._ontrackpoly = function(e) {
              e.stream.getTracks().forEach(function(track) {
                var event = new Event('track');
                event.track = track;
                event.receiver = {track: track};
                event.streams = [e.stream];
                this.dispatchEvent(event);
              }.bind(this));
            }.bind(this));
          }
        });
      }
    },
  
    shimSourceObject: function() {
      // Firefox has supported mozSrcObject since FF22, unprefixed in 42.
      if (typeof window === 'object') {
        if (window.HTMLMediaElement &&
          !('srcObject' in window.HTMLMediaElement.prototype)) {
          // Shim the srcObject property, once, when HTMLMediaElement is found.
          Object.defineProperty(window.HTMLMediaElement.prototype, 'srcObject', {
            get: function() {
              return this.mozSrcObject;
            },
            set: function(stream) {
              this.mozSrcObject = stream;
            }
          });
        }
      }
    },
  
    shimPeerConnection: function() {
      if (typeof window !== 'object' || !(window.RTCPeerConnection ||
          window.mozRTCPeerConnection)) {
        return; // probably media.peerconnection.enabled=false in about:config
      }
      // The RTCPeerConnection object.
      if (!window.RTCPeerConnection) {
        window.RTCPeerConnection = function(pcConfig, pcConstraints) {
          if (browserDetails.version < 38) {
            // .urls is not supported in FF < 38.
            // create RTCIceServers with a single url.
            if (pcConfig && pcConfig.iceServers) {
              var newIceServers = [];
              for (var i = 0; i < pcConfig.iceServers.length; i++) {
                var server = pcConfig.iceServers[i];
                if (server.hasOwnProperty('urls')) {
                  for (var j = 0; j < server.urls.length; j++) {
                    var newServer = {
                      url: server.urls[j]
                    };
                    if (server.urls[j].indexOf('turn') === 0) {
                      newServer.username = server.username;
                      newServer.credential = server.credential;
                    }
                    newIceServers.push(newServer);
                  }
                } else {
                  newIceServers.push(pcConfig.iceServers[i]);
                }
              }
              pcConfig.iceServers = newIceServers;
            }
          }
          return new mozRTCPeerConnection(pcConfig, pcConstraints);
        };
        window.RTCPeerConnection.prototype = mozRTCPeerConnection.prototype;
  
        // wrap static methods. Currently just generateCertificate.
        if (mozRTCPeerConnection.generateCertificate) {
          Object.defineProperty(window.RTCPeerConnection, 'generateCertificate', {
            get: function() {
              return mozRTCPeerConnection.generateCertificate;
            }
          });
        }
  
        window.RTCSessionDescription = mozRTCSessionDescription;
        window.RTCIceCandidate = mozRTCIceCandidate;
      }
  
      // shim away need for obsolete RTCIceCandidate/RTCSessionDescription.
      ['setLocalDescription', 'setRemoteDescription', 'addIceCandidate']
          .forEach(function(method) {
            var nativeMethod = RTCPeerConnection.prototype[method];
            RTCPeerConnection.prototype[method] = function() {
              arguments[0] = new ((method === 'addIceCandidate') ?
                  RTCIceCandidate : RTCSessionDescription)(arguments[0]);
              return nativeMethod.apply(this, arguments);
            };
          });
  
      // support for addIceCandidate(null)
      var nativeAddIceCandidate =
          RTCPeerConnection.prototype.addIceCandidate;
      RTCPeerConnection.prototype.addIceCandidate = function() {
        return arguments[0] === null ? Promise.resolve()
            : nativeAddIceCandidate.apply(this, arguments);
      };
  
      // shim getStats with maplike support
      var makeMapStats = function(stats) {
        var map = new Map();
        Object.keys(stats).forEach(function(key) {
          map.set(key, stats[key]);
          map[key] = stats[key];
        });
        return map;
      };
  
      var nativeGetStats = RTCPeerConnection.prototype.getStats;
      RTCPeerConnection.prototype.getStats = function(selector, onSucc, onErr) {
        return nativeGetStats.apply(this, [selector || null])
          .then(function(stats) {
            return makeMapStats(stats);
          })
          .then(onSucc, onErr);
      };
    }
  };
  
  // Expose public methods.
  module.exports = {
    shimOnTrack: firefoxShim.shimOnTrack,
    shimSourceObject: firefoxShim.shimSourceObject,
    shimPeerConnection: firefoxShim.shimPeerConnection,
    shimGetUserMedia: require('./getusermedia')
  };
  
  },{"../utils":10,"./getusermedia":8}],8:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  
  var logging = require('../utils').log;
  var browserDetails = require('../utils').browserDetails;
  
  // Expose public methods.
  module.exports = function() {
    var shimError_ = function(e) {
      return {
        name: {
          SecurityError: 'NotAllowedError',
          PermissionDeniedError: 'NotAllowedError'
        }[e.name] || e.name,
        message: {
          'The operation is insecure.': 'The request is not allowed by the ' +
          'user agent or the platform in the current context.'
        }[e.message] || e.message,
        constraint: e.constraint,
        toString: function() {
          return this.name + (this.message && ': ') + this.message;
        }
      };
    };
  
    // getUserMedia constraints shim.
    var getUserMedia_ = function(constraints, onSuccess, onError) {
      var constraintsToFF37_ = function(c) {
        if (typeof c !== 'object' || c.require) {
          return c;
        }
        var require = [];
        Object.keys(c).forEach(function(key) {
          if (key === 'require' || key === 'advanced' || key === 'mediaSource') {
            return;
          }
          var r = c[key] = (typeof c[key] === 'object') ?
              c[key] : {ideal: c[key]};
          if (r.min !== undefined ||
              r.max !== undefined || r.exact !== undefined) {
            require.push(key);
          }
          if (r.exact !== undefined) {
            if (typeof r.exact === 'number') {
              r. min = r.max = r.exact;
            } else {
              c[key] = r.exact;
            }
            delete r.exact;
          }
          if (r.ideal !== undefined) {
            c.advanced = c.advanced || [];
            var oc = {};
            if (typeof r.ideal === 'number') {
              oc[key] = {min: r.ideal, max: r.ideal};
            } else {
              oc[key] = r.ideal;
            }
            c.advanced.push(oc);
            delete r.ideal;
            if (!Object.keys(r).length) {
              delete c[key];
            }
          }
        });
        if (require.length) {
          c.require = require;
        }
        return c;
      };
      constraints = JSON.parse(JSON.stringify(constraints));
      if (browserDetails.version < 38) {
        logging('spec: ' + JSON.stringify(constraints));
        if (constraints.audio) {
          constraints.audio = constraintsToFF37_(constraints.audio);
        }
        if (constraints.video) {
          constraints.video = constraintsToFF37_(constraints.video);
        }
        logging('ff37: ' + JSON.stringify(constraints));
      }
      return navigator.mozGetUserMedia(constraints, onSuccess, function(e) {
        onError(shimError_(e));
      });
    };
  
    // Returns the result of getUserMedia as a Promise.
    var getUserMediaPromise_ = function(constraints) {
      return new Promise(function(resolve, reject) {
        getUserMedia_(constraints, resolve, reject);
      });
    };
  
    // Shim for mediaDevices on older versions.
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {getUserMedia: getUserMediaPromise_,
        addEventListener: function() { },
        removeEventListener: function() { }
      };
    }
    navigator.mediaDevices.enumerateDevices =
        navigator.mediaDevices.enumerateDevices || function() {
          return new Promise(function(resolve) {
            var infos = [
              {kind: 'audioinput', deviceId: 'default', label: '', groupId: ''},
              {kind: 'videoinput', deviceId: 'default', label: '', groupId: ''}
            ];
            resolve(infos);
          });
        };
  
    if (browserDetails.version < 41) {
      // Work around http://bugzil.la/1169665
      var orgEnumerateDevices =
          navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = function() {
        return orgEnumerateDevices().then(undefined, function(e) {
          if (e.name === 'NotFoundError') {
            return [];
          }
          throw e;
        });
      };
    }
    if (browserDetails.version < 49) {
      var origGetUserMedia = navigator.mediaDevices.getUserMedia.
          bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = function(c) {
        return origGetUserMedia(c).catch(function(e) {
          return Promise.reject(shimError_(e));
        });
      };
    }
    navigator.getUserMedia = function(constraints, onSuccess, onError) {
      if (browserDetails.version < 44) {
        return getUserMedia_(constraints, onSuccess, onError);
      }
      // Replace Firefox 44+'s deprecation warning with unprefixed version.
      console.warn('navigator.getUserMedia has been replaced by ' +
                   'navigator.mediaDevices.getUserMedia');
      navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
    };
  };
  
  },{"../utils":10}],9:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
  'use strict';
  var safariShim = {
    // TODO: DrAlex, should be here, double check against LayoutTests
    // shimOnTrack: function() { },
  
    // TODO: once the back-end for the mac port is done, add.
    // TODO: check for webkitGTK+
    // shimPeerConnection: function() { },
  
    shimGetUserMedia: function() {
      navigator.getUserMedia = navigator.webkitGetUserMedia;
    }
  };
  
  // Expose public methods.
  module.exports = {
    shimGetUserMedia: safariShim.shimGetUserMedia
    // TODO
    // shimOnTrack: safariShim.shimOnTrack,
    // shimPeerConnection: safariShim.shimPeerConnection
  };
  
  },{}],10:[function(require,module,exports){
  /*
   *  Copyright (c) 2016 The WebRTC project authors. All Rights Reserved.
   *
   *  Use of this source code is governed by a BSD-style license
   *  that can be found in the LICENSE file in the root of the source
   *  tree.
   */
   /* eslint-env node */
  'use strict';
  
  var logDisabled_ = true;
  
  // Utility methods.
  var utils = {
    disableLog: function(bool) {
      if (typeof bool !== 'boolean') {
        return new Error('Argument type: ' + typeof bool +
            '. Please use a boolean.');
      }
      logDisabled_ = bool;
      return (bool) ? 'adapter.js logging disabled' :
          'adapter.js logging enabled';
    },
  
    log: function() {
      if (typeof window === 'object') {
        if (logDisabled_) {
          return;
        }
        if (typeof console !== 'undefined' && typeof console.log === 'function') {
          console.log.apply(console, arguments);
        }
      }
    },
  
    /**
     * Extract browser version out of the provided user agent string.
     *
     * @param {!string} uastring userAgent string.
     * @param {!string} expr Regular expression used as match criteria.
     * @param {!number} pos position in the version string to be returned.
     * @return {!number} browser version.
     */
    extractVersion: function(uastring, expr, pos) {
      var match = uastring.match(expr);
      return match && match.length >= pos && parseInt(match[pos], 10);
    },
  
    /**
     * Browser detector.
     *
     * @return {object} result containing browser and version
     *     properties.
     */
    detectBrowser: function() {
      // Returned result object.
      var result = {};
      result.browser = null;
      result.version = null;
  
      // Fail early if it's not a browser
      if (typeof window === 'undefined' || !window.navigator) {
        result.browser = 'Not a browser.';
        return result;
      }
  
      // Firefox.
      if (navigator.mozGetUserMedia) {
        result.browser = 'firefox';
        result.version = this.extractVersion(navigator.userAgent,
            /Firefox\/([0-9]+)\./, 1);
  
      // all webkit-based browsers
      } else if (navigator.webkitGetUserMedia) {
        // Chrome, Chromium, Webview, Opera, all use the chrome shim for now
        if (window.webkitRTCPeerConnection) {
          result.browser = 'chrome';
          result.version = this.extractVersion(navigator.userAgent,
            /Chrom(e|ium)\/([0-9]+)\./, 2);
  
        // Safari or unknown webkit-based
        // for the time being Safari has support for MediaStreams but not webRTC
        } else {
          // Safari UA substrings of interest for reference:
          // - webkit version:           AppleWebKit/602.1.25 (also used in Op,Cr)
          // - safari UI version:        Version/9.0.3 (unique to Safari)
          // - safari UI webkit version: Safari/601.4.4 (also used in Op,Cr)
          //
          // if the webkit version and safari UI webkit versions are equals,
          // ... this is a stable version.
          //
          // only the internal webkit version is important today to know if
          // media streams are supported
          //
          if (navigator.userAgent.match(/Version\/(\d+).(\d+)/)) {
            result.browser = 'safari';
            result.version = this.extractVersion(navigator.userAgent,
              /AppleWebKit\/([0-9]+)\./, 1);
  
          // unknown webkit-based browser
          } else {
            result.browser = 'Unsupported webkit-based browser ' +
                'with GUM support but no WebRTC support.';
            return result;
          }
        }
  
      // Edge.
      } else if (navigator.mediaDevices &&
          navigator.userAgent.match(/Edge\/(\d+).(\d+)$/)) {
        result.browser = 'edge';
        result.version = this.extractVersion(navigator.userAgent,
            /Edge\/(\d+).(\d+)$/, 2);
  
      // Default fallthrough: not supported.
      } else {
        result.browser = 'Not a supported browser.';
        return result;
      }
  
      return result;
    }
  };
  
  // Export.
  module.exports = {
    log: utils.log,
    disableLog: utils.disableLog,
    browserDetails: utils.detectBrowser(),
    extractVersion: utils.extractVersion
  };
  
  },{}]},{},[2])(2)
});
/* jshint ignore:end */

  // END OF INJECTION OF GOOGLE'S ADAPTER.JS CONTENT
  ///////////////////////////////////////////////////////////////////

  AdapterJS.parseWebrtcDetectedBrowser();

  ///////////////////////////////////////////////////////////////////
  // EXTENSION FOR CHROME, FIREFOX AND EDGE
  // Includes legacy functions
  // -- createIceServer
  // -- createIceServers
  // -- MediaStreamTrack.getSources
  //
  // and additional shims
  // -- attachMediaStream
  // -- reattachMediaStream
  // -- requestUserMedia
  // -- a call to AdapterJS.maybeThroughWebRTCReady (notifies WebRTC is ready)

  // Add support for legacy functions createIceServer and createIceServers
  if ( navigator.mozGetUserMedia ) {
    // Shim for MediaStreamTrack.getSources.
    MediaStreamTrack.getSources = function(successCb) {
      setTimeout(function() {
        var infos = [
          { kind: 'audio', id: 'default', label:'', facing:'' },
          { kind: 'video', id: 'default', label:'', facing:'' }
        ];
        successCb(infos);
      }, 0);
    };

    createIceServer = function (url, username, password) {
      console.warn('createIceServer is deprecated. It should be replaced with an application level implementation.');
      // Note: Google's import of AJS will auto-reverse to 'url': '...' for FF < 38

      var iceServer = null;
      var urlParts = url.split(':');
      if (urlParts[0].indexOf('stun') === 0) {
        iceServer = { urls : [url] };
      } else if (urlParts[0].indexOf('turn') === 0) {
        if (webrtcDetectedVersion < 27) {
          var turnUrlParts = url.split('?');
          if (turnUrlParts.length === 1 ||
            turnUrlParts[1].indexOf('transport=udp') === 0) {
            iceServer = {
              urls : [turnUrlParts[0]],
              credential : password,
              username : username
            };
          }
        } else {
          iceServer = {
            urls : [url],
            credential : password,
            username : username
          };
        }
      }
      return iceServer;
    };

    createIceServers = function (urls, username, password) {
      console.warn('createIceServers is deprecated. It should be replaced with an application level implementation.');

      var iceServers = [];
      for (i = 0; i < urls.length; i++) {
        var iceServer = createIceServer(urls[i], username, password);
        if (iceServer !== null) {
          iceServers.push(iceServer);
        }
      }
      return iceServers;
    };
  } else if ( navigator.webkitGetUserMedia ) {
    createIceServer = function (url, username, password) {
      console.warn('createIceServer is deprecated. It should be replaced with an application level implementation.');

      var iceServer = null;
      var urlParts = url.split(':');
      if (urlParts[0].indexOf('stun') === 0) {
        iceServer = { 'url' : url };
      } else if (urlParts[0].indexOf('turn') === 0) {
        iceServer = {
          'url' : url,
          'credential' : password,
          'username' : username
        };
      }
      return iceServer;
    };

    createIceServers = function (urls, username, password) {
      console.warn('createIceServers is deprecated. It should be replaced with an application level implementation.');

      var iceServers = [];
      if (webrtcDetectedVersion >= 34) {
        iceServers = {
          'urls' : urls,
          'credential' : password,
          'username' : username
        };
      } else {
        for (i = 0; i < urls.length; i++) {
          var iceServer = createIceServer(urls[i], username, password);
          if (iceServer !== null) {
            iceServers.push(iceServer);
          }
        }
      }
      return iceServers;
    };
  }

  // adapter.js by Google currently doesn't suppport
  // attachMediaStream and reattachMediaStream for Egde
  if (navigator.mediaDevices && navigator.userAgent.match(
      /Edge\/(\d+).(\d+)$/)) {
    getUserMedia = window.getUserMedia = navigator.getUserMedia.bind(navigator);
    attachMediaStream = function(element, stream) {
      element.srcObject = stream;
      return element;
    };
    reattachMediaStream = function(to, from) {
      to.srcObject = from.srcObject;
      return to;
    };
  }

  // Need to override attachMediaStream and reattachMediaStream
  // to support the plugin's logic
    if (attachMediaStream) {
	attachMediaStream_base = attachMediaStream;
	attachMediaStream = function (element, stream) {
	    if ((webrtcDetectedBrowser === 'chrome' ||
		 webrtcDetectedBrowser === 'opera') && 
		!stream) {
		// Chrome does not support "src = null"
		element.src = '';
	    } else {
		attachMediaStream_base(element, stream);
	    }
	    return element;
	};
    }
    if (reattachMediaStream) {
	reattachMediaStream_base = reattachMediaStream;
	reattachMediaStream = function (to, from) {
	    reattachMediaStream_base(to, from);
	    return to;
	};
    }

  // Propagate attachMediaStream and gUM in window and AdapterJS
  window.attachMediaStream      = attachMediaStream;
  window.reattachMediaStream    = reattachMediaStream;
  window.getUserMedia           = getUserMedia;
  AdapterJS.attachMediaStream   = attachMediaStream;
  AdapterJS.reattachMediaStream = reattachMediaStream;
  AdapterJS.getUserMedia        = getUserMedia;

  // Removed Google defined promises when promise is not defined
  if (typeof Promise === 'undefined') {
    requestUserMedia = null;
  }

  AdapterJS.maybeThroughWebRTCReady();

  // END OF EXTENSION OF CHROME, FIREFOX AND EDGE
  ///////////////////////////////////////////////////////////////////

} else { // TRY TO USE PLUGIN

  ///////////////////////////////////////////////////////////////////
  // WEBRTC PLUGIN SHIM
  // Will automatically check if the plugin is available and inject it
  // into the DOM if it is.
  // When the plugin is not available, will prompt a banner to suggest installing it
  // Use AdapterJS.options.hidePluginInstallPrompt to prevent this banner from popping
  //
  // Shims the follwing:
  // -- getUserMedia
  // -- MediaStreamTrack
  // -- MediaStreamTrack.getSources
  // -- RTCPeerConnection
  // -- RTCSessionDescription
  // -- RTCIceCandidate
  // -- createIceServer
  // -- createIceServers
  // -- attachMediaStream
  // -- reattachMediaStream
  // -- webrtcDetectedBrowser
  // -- webrtcDetectedVersion

  // IE 9 is not offering an implementation of console.log until you open a console
  if (typeof console !== 'object' || typeof console.log !== 'function') {
    /* jshint -W020 */
    console = {} || console;
    // Implemented based on console specs from MDN
    // You may override these functions
    console.log = function (arg) {};
    console.info = function (arg) {};
    console.error = function (arg) {};
    console.dir = function (arg) {};
    console.exception = function (arg) {};
    console.trace = function (arg) {};
    console.warn = function (arg) {};
    console.count = function (arg) {};
    console.debug = function (arg) {};
    console.count = function (arg) {};
    console.time = function (arg) {};
    console.timeEnd = function (arg) {};
    console.group = function (arg) {};
    console.groupCollapsed = function (arg) {};
    console.groupEnd = function (arg) {};
    /* jshint +W020 */
  }
  AdapterJS.parseWebrtcDetectedBrowser();
  isIE = webrtcDetectedBrowser === 'IE';

  /* jshint -W035 */
  AdapterJS.WebRTCPlugin.WaitForPluginReady = function() {
    while (AdapterJS.WebRTCPlugin.pluginState !== AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
      /* empty because it needs to prevent the function from running. */
    }
  };
  /* jshint +W035 */

  AdapterJS.WebRTCPlugin.callWhenPluginReady = function (callback) {
    if (AdapterJS.WebRTCPlugin.pluginState === AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
      // Call immediately if possible
      // Once the plugin is set, the code will always take this path
      callback();
    } else {
      // otherwise start a 100ms interval
      var checkPluginReadyState = setInterval(function () {
        if (AdapterJS.WebRTCPlugin.pluginState === AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
          clearInterval(checkPluginReadyState);
          callback();
        }
      }, 100);
    }
  };

  AdapterJS.WebRTCPlugin.setLogLevel = function(logLevel) {
    AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
      AdapterJS.WebRTCPlugin.plugin.setLogLevel(logLevel);
    });
  };

  AdapterJS.WebRTCPlugin.injectPlugin = function () {
    // only inject once the page is ready
    if (document.readyState !== 'complete') {
      return;
    }

    // Prevent multiple injections
    if (AdapterJS.WebRTCPlugin.pluginState !== AdapterJS.WebRTCPlugin.PLUGIN_STATES.INITIALIZING) {
      return;
    }

    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INJECTING;

    if (webrtcDetectedBrowser === 'IE' && webrtcDetectedVersion <= 10) {
      var frag = document.createDocumentFragment();
      AdapterJS.WebRTCPlugin.plugin = document.createElement('div');
      AdapterJS.WebRTCPlugin.plugin.innerHTML = '<object id="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '" type="' +
        AdapterJS.WebRTCPlugin.pluginInfo.type + '" ' + 'width="1" height="1">' +
        '<param name="pluginId" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '" /> ' +
        '<param name="windowless" value="false" /> ' +
        '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '" /> ' +
        '<param name="onload" value="' + AdapterJS.WebRTCPlugin.pluginInfo.onload + '" />' +
        '<param name="tag" value="' + AdapterJS.WebRTCPlugin.TAGS.NONE + '" />' +
        // uncomment to be able to use virtual cams
        (AdapterJS.options.getAllCams ? '<param name="forceGetAllCams" value="True" />':'') +

        '</object>';
      while (AdapterJS.WebRTCPlugin.plugin.firstChild) {
        frag.appendChild(AdapterJS.WebRTCPlugin.plugin.firstChild);
      }
      document.body.appendChild(frag);

      // Need to re-fetch the plugin
      AdapterJS.WebRTCPlugin.plugin =
        document.getElementById(AdapterJS.WebRTCPlugin.pluginInfo.pluginId);
    } else {
      // Load Plugin
      AdapterJS.WebRTCPlugin.plugin = document.createElement('object');
      AdapterJS.WebRTCPlugin.plugin.id =
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId;
      // IE will only start the plugin if it's ACTUALLY visible
      if (isIE) {
        AdapterJS.WebRTCPlugin.plugin.width = '1px';
        AdapterJS.WebRTCPlugin.plugin.height = '1px';
      } else { // The size of the plugin on Safari should be 0x0px
              // so that the autorisation prompt is at the top
        AdapterJS.WebRTCPlugin.plugin.width = '0px';
        AdapterJS.WebRTCPlugin.plugin.height = '0px';
      }
      AdapterJS.WebRTCPlugin.plugin.type = AdapterJS.WebRTCPlugin.pluginInfo.type;
      AdapterJS.WebRTCPlugin.plugin.innerHTML = '<param name="onload" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.onload + '">' +
        '<param name="pluginId" value="' +
        AdapterJS.WebRTCPlugin.pluginInfo.pluginId + '">' +
        '<param name="windowless" value="false" /> ' +
        (AdapterJS.options.getAllCams ? '<param name="forceGetAllCams" value="True" />':'') +
        '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '">' +
        '<param name="tag" value="' + AdapterJS.WebRTCPlugin.TAGS.NONE + '" />';
      document.body.appendChild(AdapterJS.WebRTCPlugin.plugin);
    }


    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INJECTED;
  };

  AdapterJS.WebRTCPlugin.isPluginInstalled =
    function (comName, plugName, installedCb, notInstalledCb) {
    if (!isIE) {
      var pluginArray = navigator.plugins;
      for (var i = 0; i < pluginArray.length; i++) {
        if (pluginArray[i].name.indexOf(plugName) >= 0) {
          installedCb();
          return;
        }
      }
      notInstalledCb();
    } else {
      try {
        var axo = new ActiveXObject(comName + '.' + plugName);
      } catch (e) {
        notInstalledCb();
        return;
      }
      installedCb();
    }
  };

  AdapterJS.WebRTCPlugin.defineWebRTCInterface = function () {
    if (AdapterJS.WebRTCPlugin.pluginState ===
        AdapterJS.WebRTCPlugin.PLUGIN_STATES.READY) {
      console.error('AdapterJS - WebRTC interface has already been defined');
      return;
    }

    AdapterJS.WebRTCPlugin.pluginState = AdapterJS.WebRTCPlugin.PLUGIN_STATES.INITIALIZING;

    AdapterJS.isDefined = function (variable) {
      return variable !== null && variable !== undefined;
    };

    createIceServer = function (url, username, password) {
      var iceServer = null;
      var urlParts = url.split(':');
      if (urlParts[0].indexOf('stun') === 0) {
        iceServer = {
          'url' : url,
          'hasCredentials' : false
        };
      } else if (urlParts[0].indexOf('turn') === 0) {
        iceServer = {
          'url' : url,
          'hasCredentials' : true,
          'credential' : password,
          'username' : username
        };
      }
      return iceServer;
    };

    createIceServers = function (urls, username, password) {
      var iceServers = [];
      for (var i = 0; i < urls.length; ++i) {
        iceServers.push(createIceServer(urls[i], username, password));
      }
      return iceServers;
    };

    RTCSessionDescription = function (info) {
      AdapterJS.WebRTCPlugin.WaitForPluginReady();
      return AdapterJS.WebRTCPlugin.plugin.
        ConstructSessionDescription(info.type, info.sdp);
    };

    RTCPeerConnection = function (servers, constraints) {
      // Validate server argumenr
      if (!(servers === undefined ||
            servers === null ||
            Array.isArray(servers.iceServers))) {
        throw new Error('Failed to construct \'RTCPeerConnection\': Malformed RTCConfiguration');
      }

      // Validate constraints argument
      if (typeof constraints !== 'undefined' && constraints !== null) {
        var invalidConstraits = false;
        invalidConstraits |= typeof constraints !== 'object';
        invalidConstraits |= constraints.hasOwnProperty('mandatory') && 
                              constraints.mandatory !== undefined && 
                              constraints.mandatory !== null && 
                              constraints.mandatory.constructor !== Object;
        invalidConstraits |= constraints.hasOwnProperty('optional') && 
                              constraints.optional !== undefined &&
                              constraints.optional !== null &&
                              !Array.isArray(constraints.optional);
        if (invalidConstraits) {
          throw new Error('Failed to construct \'RTCPeerConnection\': Malformed constraints object');
        }
      }

      // Call relevant PeerConnection constructor according to plugin version
      AdapterJS.WebRTCPlugin.WaitForPluginReady();

      // RTCPeerConnection prototype from the old spec
      var iceServers = null;
      if (servers && Array.isArray(servers.iceServers)) {
        iceServers = servers.iceServers;
        for (var i = 0; i < iceServers.length; i++) {
          // Legacy plugin versions compatibility
          if (iceServers[i].urls && !iceServers[i].url) {
            iceServers[i].url = iceServers[i].urls;
          }
          iceServers[i].hasCredentials = AdapterJS.
            isDefined(iceServers[i].username) &&
            AdapterJS.isDefined(iceServers[i].credential);
        }
      }

      if (AdapterJS.WebRTCPlugin.plugin.PEER_CONNECTION_VERSION &&
          AdapterJS.WebRTCPlugin.plugin.PEER_CONNECTION_VERSION > 1) {
        // RTCPeerConnection prototype from the new spec
        if (iceServers) {
          servers.iceServers = iceServers;
        }
        return AdapterJS.WebRTCPlugin.plugin.PeerConnection(servers);
      } else {
        var mandatory = (constraints && constraints.mandatory) ?
          constraints.mandatory : null;
        var optional = (constraints && constraints.optional) ?
          constraints.optional : null;
        return AdapterJS.WebRTCPlugin.plugin.
          PeerConnection(AdapterJS.WebRTCPlugin.pageId,
          iceServers, mandatory, optional);
      }
    };

    MediaStreamTrack = function(){};
    MediaStreamTrack.getSources = function (callback) {
      AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
        AdapterJS.WebRTCPlugin.plugin.GetSources(callback);
      });
    };

    getUserMedia = function (constraints, successCallback, failureCallback) {
      constraints.audio = constraints.audio || false;
      constraints.video = constraints.video || false;

      AdapterJS.WebRTCPlugin.callWhenPluginReady(function() {
        AdapterJS.WebRTCPlugin.plugin.
          getUserMedia(constraints, successCallback, failureCallback);
      });
    };
    window.navigator.getUserMedia = getUserMedia;

    // Defined mediaDevices when promises are available
    if ( !navigator.mediaDevices &&
      typeof Promise !== 'undefined') {
      requestUserMedia = function(constraints) {
        return new Promise(function(resolve, reject) {
          getUserMedia(constraints, resolve, reject);
        });
      };
      navigator.mediaDevices = {getUserMedia: requestUserMedia,
                                enumerateDevices: function() {
        return new Promise(function(resolve) {
          var kinds = {audio: 'audioinput', video: 'videoinput'};
          return MediaStreamTrack.getSources(function(devices) {
            resolve(devices.map(function(device) {
              return {label: device.label,
                      kind: kinds[device.kind],
                      id: device.id,
                      deviceId: device.id,
                      groupId: ''};
            }));
          });
        });
      }};
    }

    attachMediaStream = function (element, stream) {
      if (!element || !element.parentNode) {
        return;
      }

      var streamId;
      if (stream === null) {
        streamId = '';
      } else {
        if (typeof stream.enableSoundTracks !== 'undefined') {
          stream.enableSoundTracks(true);
        }
        streamId = stream.id;
      }

      var elementId = element.id.length === 0 ? Math.random().toString(36).slice(2) : element.id;
      var nodeName = element.nodeName.toLowerCase();
      if (nodeName !== 'object') { // not a plugin <object> tag yet
        var tag;
        switch(nodeName) {
          case 'audio':
            tag = AdapterJS.WebRTCPlugin.TAGS.AUDIO;
            break;
          case 'video':
            tag = AdapterJS.WebRTCPlugin.TAGS.VIDEO;
            break;
          default:
            tag = AdapterJS.WebRTCPlugin.TAGS.NONE;
          }

        var frag = document.createDocumentFragment();
        var temp = document.createElement('div');
        var classHTML = '';
        if (element.className) {
          classHTML = 'class="' + element.className + '" ';
        } else if (element.attributes && element.attributes['class']) {
          classHTML = 'class="' + element.attributes['class'].value + '" ';
        }

        temp.innerHTML = '<object id="' + elementId + '" ' + classHTML +
          'type="' + AdapterJS.WebRTCPlugin.pluginInfo.type + '">' +
          '<param name="pluginId" value="' + elementId + '" /> ' +
          '<param name="pageId" value="' + AdapterJS.WebRTCPlugin.pageId + '" /> ' +
          '<param name="windowless" value="true" /> ' +
          '<param name="streamId" value="' + streamId + '" /> ' +
          '<param name="tag" value="' + tag + '" /> ' +
          '</object>';
        while (temp.firstChild) {
          frag.appendChild(temp.firstChild);
        }

        var height = '';
        var width = '';
        if (element.clientWidth || element.clientHeight) {
          width = element.clientWidth;
          height = element.clientHeight;
        }
        else if (element.width || element.height) {
          width = element.width;
          height = element.height;
        }

        element.parentNode.insertBefore(frag, element);
        frag = document.getElementById(elementId);
        frag.width = width;
        frag.height = height;
        element.parentNode.removeChild(element);
      } else { // already an <object> tag, just change the stream id
        var children = element.children;
        for (var i = 0; i !== children.length; ++i) {
          if (children[i].name === 'streamId') {
            children[i].value = streamId;
            break;
          }
        }
        element.setStreamId(streamId);
      }
      var newElement = document.getElementById(elementId);
      AdapterJS.forwardEventHandlers(newElement, element, Object.getPrototypeOf(element));

      return newElement;
    };

    reattachMediaStream = function (to, from) {
      var stream = null;
      var children = from.children;
      for (var i = 0; i !== children.length; ++i) {
        if (children[i].name === 'streamId') {
          AdapterJS.WebRTCPlugin.WaitForPluginReady();
          stream = AdapterJS.WebRTCPlugin.plugin
            .getStreamWithId(AdapterJS.WebRTCPlugin.pageId, children[i].value);
          break;
        }
      }
      if (stream !== null) {
        return attachMediaStream(to, stream);
      } else {
        console.log('Could not find the stream associated with this element');
      }
    };

    // Propagate attachMediaStream and gUM in window and AdapterJS
    window.attachMediaStream      = attachMediaStream;
    window.reattachMediaStream    = reattachMediaStream;
    window.getUserMedia           = getUserMedia;
    AdapterJS.attachMediaStream   = attachMediaStream;
    AdapterJS.reattachMediaStream = reattachMediaStream;
    AdapterJS.getUserMedia        = getUserMedia;

    AdapterJS.forwardEventHandlers = function (destElem, srcElem, prototype) {
      properties = Object.getOwnPropertyNames( prototype );
      for(var prop in properties) {
        if (prop) {
          propName = properties[prop];

          if (typeof propName.slice === 'function' &&
              propName.slice(0,2) === 'on' && 
              typeof srcElem[propName] === 'function') {
              AdapterJS.addEvent(destElem, propName.slice(2), srcElem[propName]);
          }
        }
      }
      var subPrototype = Object.getPrototypeOf(prototype);
      if(!!subPrototype) {
        AdapterJS.forwardEventHandlers(destElem, srcElem, subPrototype);
      }
    };

    RTCIceCandidate = function (candidate) {
      if (!candidate.sdpMid) {
        candidate.sdpMid = '';
      }

      AdapterJS.WebRTCPlugin.WaitForPluginReady();
      return AdapterJS.WebRTCPlugin.plugin.ConstructIceCandidate(
        candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate
      );
    };

    // inject plugin
    AdapterJS.addEvent(document, 'readystatechange', AdapterJS.WebRTCPlugin.injectPlugin);
    AdapterJS.WebRTCPlugin.injectPlugin();
  };

  // This function will be called if the plugin is needed (browser different
  // from Chrome or Firefox), but the plugin is not installed.
  AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb = AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb ||
    function() {
      AdapterJS.addEvent(document,
                        'readystatechange',
                         AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv);
      AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv();
    };

  AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCbPriv = function () {
    if (AdapterJS.options.hidePluginInstallPrompt) {
      return;
    }

    var downloadLink = AdapterJS.WebRTCPlugin.pluginInfo.downloadLink;
    if(downloadLink) { // if download link
      var popupString;
      if (AdapterJS.WebRTCPlugin.pluginInfo.portalLink) { // is portal link
       popupString = 'This website requires you to install the ' +
        ' <a href="' + AdapterJS.WebRTCPlugin.pluginInfo.portalLink +
        '" target="_blank">' + AdapterJS.WebRTCPlugin.pluginInfo.companyName +
        ' WebRTC Plugin</a>' +
        ' to work on this browser.';
      } else { // no portal link, just print a generic explanation
       popupString = AdapterJS.TEXT.PLUGIN.REQUIRE_INSTALLATION;
      }

      AdapterJS.renderNotificationBar(popupString, AdapterJS.TEXT.PLUGIN.BUTTON, downloadLink);
    } else { // no download link, just print a generic explanation
      AdapterJS.renderNotificationBar(AdapterJS.TEXT.PLUGIN.NOT_SUPPORTED);
    }
  };

  // Try to detect the plugin and act accordingly
  AdapterJS.WebRTCPlugin.isPluginInstalled(
    AdapterJS.WebRTCPlugin.pluginInfo.prefix,
    AdapterJS.WebRTCPlugin.pluginInfo.plugName,
    AdapterJS.WebRTCPlugin.defineWebRTCInterface,
    AdapterJS.WebRTCPlugin.pluginNeededButNotInstalledCb);

  // END OF WEBRTC PLUGIN SHIM
  ///////////////////////////////////////////////////////////////////
}
