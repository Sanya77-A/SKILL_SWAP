import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff } from "lucide-react";
import { Button } from "./ui/Button";

const ICE_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    { 
      urls: "turn:openrelay.metered.ca:80", 
      username: "openrelayproject", 
      credential: "openrelayproject" 
    },
    { 
      urls: "turn:openrelay.metered.ca:443", 
      username: "openrelayproject", 
      credential: "openrelayproject" 
    },
    { 
      urls: "turn:openrelay.metered.ca:443?transport=tcp", 
      username: "openrelayproject", 
      credential: "openrelayproject" 
    }
  ],
};

export function VideoCall({ socket, isInitiator, remoteUserId, remoteUserName, isVideo, incomingOffer, bufferedCandidates = [], localUserName = "Someone", onEnd }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const processedCandidatesRef = useRef(new Set());
  const bufferedCandidatesRef = useRef(bufferedCandidates);
  
  const [hasConnected, setHasConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideo);

  // Keep buffered candidates ref updated
  useEffect(() => {
    bufferedCandidatesRef.current = bufferedCandidates;
  }, [bufferedCandidates]);

  const applyCandidates = async (peer) => {
    try {
      const candidates = [...bufferedCandidatesRef.current, ...pendingCandidatesRef.current];
      pendingCandidatesRef.current = [];
      for (const c of candidates) {
        if (!c) continue;
        const cStr = typeof c === "string" ? c : JSON.stringify(c);
        if (processedCandidatesRef.current.has(cStr)) continue;
        processedCandidatesRef.current.add(cStr);
        await peer.addIceCandidate(new RTCIceCandidate(c)).catch((e) => {
          console.warn("Could not add ice candidate during applyCandidates:", e);
        });
      }
    } catch (e) {
      console.error("Error applying buffered candidates", e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function startCall() {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        } catch (mediaErr) {
          console.warn("Camera failed, trying audio only", mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setIsVideoOff(true);
        }
        
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch((err) => {
            console.warn("Local video play failed:", err);
          });
        }

        const peer = new RTCPeerConnection(ICE_CONFIG);
        peerRef.current = peer;

        stream.getTracks().forEach((track) => peer.addTrack(track, stream));

        peer.ontrack = (event) => {
          if (remoteVideoRef.current) {
            let remoteStream = remoteVideoRef.current.srcObject;
            if (!remoteStream || !(remoteStream instanceof MediaStream)) {
              remoteStream = event.streams[0] || new MediaStream();
              remoteVideoRef.current.srcObject = remoteStream;
            }
            
            if (event.track) {
              const hasTrack = remoteStream.getTracks().some((t) => t.id === event.track.id);
              if (!hasTrack) {
                remoteStream.addTrack(event.track);
              }
            }

            remoteVideoRef.current.play().catch((err) => {
              console.warn("Autoplay remote video failed, waiting for user interaction:", err);
            });
            
            setHasConnected(true);
          }
        };

        peer.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("ice_candidate", { to: remoteUserId, candidate: event.candidate });
          }
        };

        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "connected" || peer.iceConnectionState === "completed") {
            setHasConnected(true);
          }
        };

        if (isInitiator) {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          socket.emit("call_user", { to: remoteUserId, offer, isVideo, callerName: localUserName });
          // Note: initiator doesn't have an incoming offer yet.
          // They will apply candidates after receiving answer_call.
        } else {
          await peer.setRemoteDescription(new RTCSessionDescription(incomingOffer));
          await applyCandidates(peer); // Apply early candidates
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          socket.emit("answer_call", { to: remoteUserId, answer });
        }
      } catch (err) {
        console.error("Error accessing media devices.", err);
        if (isMounted) handleEndCall();
      }
    }

    startCall();

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleAnswer = async ({ answer }) => {
      if (peerRef.current && !peerRef.current.currentRemoteDescription) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await applyCandidates(peerRef.current); // Apply candidates received before answer
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const cStr = typeof candidate === "string" ? candidate : JSON.stringify(candidate);
      if (processedCandidatesRef.current.has(cStr)) return;

      if (!peerRef.current || !peerRef.current.currentRemoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try {
        processedCandidatesRef.current.add(cStr);
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn("Error adding ice candidate:", e);
      }
    };

    const handleCallEnded = () => {
      handleEndCall();
    };

    socket.on("call_answered", handleAnswer);
    // Note: VideoCall has its own ice_candidate listener independent of ChatPage
    // to handle ones arriving after mount.
    socket.on("ice_candidate", handleIceCandidate);
    socket.on("call_ended", handleCallEnded);

    return () => {
      socket.off("call_answered", handleAnswer);
      socket.off("ice_candidate", handleIceCandidate);
      socket.off("call_ended", handleCallEnded);
    };
  }, [socket]);

  const handleEndCall = () => {
    socket.emit("end_call", { to: remoteUserId });
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    onEnd();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl font-sans">
      <div className="flex-1 relative p-4 pb-24 flex items-center justify-center">
        
        <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Local Video */}
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950/70 border border-gray-700 shadow-xl flex items-center justify-center group">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                  <VideoOff className="w-10 h-10 text-gray-400" />
                </div>
                <p className="text-gray-400 font-medium text-sm">Camera Off</p>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium border border-white/10 flex items-center gap-2">
              You
              {isMuted && <MicOff className="w-4 h-4 text-danger" />}
            </div>
          </div>

          {/* Remote Video */}
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950/70 border border-gray-700 shadow-xl flex items-center justify-center">
            <video 
              ref={remoteVideoRef} 
              autoPlay 
              playsInline 
              className={`w-full h-full object-cover transition-opacity duration-300 ${!hasConnected ? 'opacity-0' : 'opacity-100'}`}
            />
            {!hasConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 bg-gray-800/80 backdrop-blur-sm">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center animate-pulse absolute inset-0 scale-150" />
                  <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center relative z-10">
                    <Phone className="w-8 h-8 text-white animate-bounce" />
                  </div>
                </div>
                <p className="text-lg font-medium tracking-wide mt-4">
                  {isInitiator ? `Calling ${remoteUserName}...` : "Connecting..."}
                </p>
              </div>
            )}
            {hasConnected && (
              <div className="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium border border-white/10">
                {remoteUserName}
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 rounded-full bg-gray-900/80 backdrop-blur-xl border border-white/10 shadow-2xl">
        <button 
          onClick={toggleMute}
          className={`p-4 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${isMuted ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>
        
        {isVideo && (
          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 ${isVideoOff ? 'bg-danger/20 text-danger hover:bg-danger/30' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title={isVideoOff ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        <button 
          onClick={handleEndCall}
          className="p-4 rounded-full bg-danger text-white hover:bg-danger/90 hover:scale-105 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 shadow-lg shadow-danger/30"
          title="End Call"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
