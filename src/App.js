import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import {
  MeetingProvider,
  MeetingConsumer,
  useMeeting,
  useParticipant,
  VideoPlayer,
} from "@videosdk.live/react-sdk";
import { authToken, createMeeting } from "./API";

function ParticipantView({ participantId }) {
  const micRef = useRef(null);
  const { micStream, webcamOn, micOn, isLocal, displayName } =
    useParticipant(participantId);

  useEffect(() => {
    if (micRef.current) {
      if (micOn && micStream) {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(micStream.track);
        micRef.current.srcObject = mediaStream;
        micRef.current.play().catch((error) =>
          console.error("Audio play failed", error)
        );
      } else {
        micRef.current.srcObject = null;
      }
    }
  }, [micStream, micOn]);

  return (
    <div style={{ 
      margin: "10px", 
      border: "2px solid #2196F3", 
      padding: "15px",
      borderRadius: "8px",
      backgroundColor: "#f9f9f9"
    }}>
      <p style={{ margin: "5px 0", fontWeight: "bold" }}>
        {displayName} {isLocal && "(You)"}
      </p>
      <p style={{ margin: "5px 0", fontSize: "14px" }}>
        📹 Webcam: {webcamOn ? "ON" : "OFF"} | 🎤 Mic: {micOn ? "ON" : "OFF"}
      </p>
      <audio ref={micRef} autoPlay muted={isLocal} />
      {webcamOn && (
        <VideoPlayer
          participantId={participantId}
          type="video"
          containerStyle={{
            height: "200px",
            width: "300px",
            borderRadius: "5px",
            overflow: "hidden"
          }}
        />
      )}
    </div>
  );
}

function RoomInterface({ 
  meetingId, 
  roomName, 
  onSwitchRoom, 
  targetRoomId, 
  targetRoomName,
  onLeaveAll 
}) {
  const [joined, setJoined] = useState(false);
  const [relayActive, setRelayActive] = useState(false);
  const [isTogglingWebcam, setIsTogglingWebcam] = useState(false);
  const [isTogglingMic, setIsTogglingMic] = useState(false);

  const { 
    join, 
    leave, 
    toggleMic, 
    toggleWebcam, 
    participants,
    meeting,
    localMicOn,
    localWebcamOn
  } = useMeeting({
    onMeetingJoined: () => {
      setJoined(true);
      console.log(`✅ Joined ${roomName} (${meetingId})`);
    },
    onMeetingLeft: () => {
      setJoined(false);
      setRelayActive(false);
      console.log(`👋 Left ${roomName}`);
    },
    onError: (error) => {
      console.error("Meeting error:", error);
      if (error.message?.includes("camera")) {
        alert("Camera error: Please ensure no other application is using your camera.");
      }
    }
  });

  const handleJoin = () => {
    join();
  };

  const handleSwitchRoom = () => {
    console.log(`🔄 Switching from ${roomName} to ${targetRoomName}`);
    
    // Stop relay if active
    if (relayActive && meeting) {
      meeting.stopLivestream().catch(err => console.error("Error stopping relay:", err));
      setRelayActive(false);
    }
    
    leave();
    setTimeout(() => {
      onSwitchRoom(targetRoomId);
    }, 800);
  };

  const handleToggleMic = async () => {
    if (isTogglingMic) return;
    
    setIsTogglingMic(true);
    try {
      await toggleMic();
      console.log(`🎤 Mic ${localMicOn ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error("Error toggling mic:", error);
      alert("Failed to toggle microphone. Please check permissions.");
    } finally {
      setTimeout(() => setIsTogglingMic(false), 500);
    }
  };

  const handleToggleWebcam = async () => {
    if (isTogglingWebcam) return;
    
    setIsTogglingWebcam(true);
    try {
      await toggleWebcam();
      console.log(`📹 Webcam ${localWebcamOn ? 'disabled' : 'enabled'}`);
    } catch (error) {
      console.error("Error toggling webcam:", error);
      alert("Failed to toggle webcam. Please ensure:\n1. No other app is using the camera\n2. Camera permissions are granted\n3. Camera is properly connected");
    } finally {
      setTimeout(() => setIsTogglingWebcam(false), 500);
    }
  };

  const handleMediaRelay = async () => {
    if (!meeting || !targetRoomId) return;

    try {
      if (!relayActive) {
        console.log(`🎥 Starting media relay to ${targetRoomName}`);
        
        await meeting.startLivestream({
          outputs: [
            {
              url: `rtmp://live.videosdk.live/live/${targetRoomId}`,
              streamKey: targetRoomId,
            },
          ],
        });
        
        setRelayActive(true);
        console.log(`✅ Media relay active to ${targetRoomName}`);
      } else {
        console.log("🛑 Stopping media relay");
        await meeting.stopLivestream();
        setRelayActive(false);
        console.log("✅ Media relay stopped");
      }
    } catch (error) {
      console.error("❌ Media relay error:", error);
      alert(`Media Relay Error: ${error.message}\n\nNote: Media relay requires livestream configuration in your VideoSDK dashboard.`);
    }
  };

  const handleLeaveAll = () => {
    if (relayActive && meeting) {
      meeting.stopLivestream().catch(err => console.error("Error stopping relay:", err));
    }
    leave();
    setTimeout(() => {
      onLeaveAll();
    }, 300);
  };

  return (
    <div style={{ 
      padding: "20px", 
      border: "3px solid #4CAF50", 
      borderRadius: "10px",
      margin: "20px",
      backgroundColor: "white"
    }}>
      <div style={{ 
        backgroundColor: "#4CAF50", 
        padding: "15px", 
        borderRadius: "5px",
        color: "white",
        marginBottom: "20px"
      }}>
        <h2 style={{ margin: "5px 0" }}>🏠 {roomName}</h2>
        <p style={{ margin: "5px 0", fontSize: "12px", opacity: 0.9 }}>
          Meeting ID: {meetingId}
        </p>
      </div>

      {!joined ? (
        <button 
          onClick={handleJoin}
          style={{
            padding: "15px 40px",
            fontSize: "18px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Join {roomName}
        </button>
      ) : (
        <>
          {/* Controls */}
          <div style={{ 
            padding: "15px", 
            backgroundColor: "#f5f5f5", 
            borderRadius: "5px",
            marginBottom: "20px"
          }}>
            <h3 style={{ marginTop: 0 }}>⚙️ Controls</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button 
                onClick={handleToggleMic}
                disabled={isTogglingMic}
                style={{
                  ...controlButton,
                  opacity: isTogglingMic ? 0.6 : 1,
                  cursor: isTogglingMic ? "not-allowed" : "pointer"
                }}
              >
                🎤 {isTogglingMic ? "Toggling..." : localMicOn ? "Mute Mic" : "Unmute Mic"}
              </button>
              <button 
                onClick={handleToggleWebcam}
                disabled={isTogglingWebcam}
                style={{
                  ...controlButton,
                  opacity: isTogglingWebcam ? 0.6 : 1,
                  cursor: isTogglingWebcam ? "not-allowed" : "pointer"
                }}
              >
                📹 {isTogglingWebcam ? "Toggling..." : localWebcamOn ? "Stop Camera" : "Start Camera"}
              </button>
              <button 
                onClick={handleSwitchRoom} 
                style={{...controlButton, backgroundColor: "#2196F3"}}
              >
                🔄 Switch to {targetRoomName}
              </button>
              <button 
                onClick={handleMediaRelay}
                style={{
                  ...controlButton, 
                  backgroundColor: relayActive ? "#f44336" : "#FF9800"
                }}
              >
                {relayActive ? "🛑 Stop Relay" : "📡 Start Media Relay"}
              </button>
              <button 
                onClick={handleLeaveAll}
                style={{...controlButton, backgroundColor: "#f44336"}}
              >
                🚪 Leave All
              </button>
            </div>
          </div>

          {/* Relay Status */}
          {relayActive && (
            <div style={{
              padding: "15px",
              backgroundColor: "#fff3cd",
              border: "2px solid #ffc107",
              borderRadius: "5px",
              marginBottom: "20px"
            }}>
              <strong>⚡ Media Relay Active</strong>
              <p style={{ margin: "5px 0" }}>
                Your audio and video are being relayed to {targetRoomName}
              </p>
            </div>
          )}

          {/* Participants */}
          <div>
            <h3>👥 Participants ({participants.size})</h3>
            {participants.size === 0 ? (
              <p style={{ color: "#666", fontStyle: "italic" }}>
                No participants yet. Waiting for others to join...
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {[...participants.keys()].map((participantId) => (
                  <ParticipantView
                    key={participantId}
                    participantId={participantId}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
  padding: "12px 20px",
  fontSize: "14px",
  backgroundColor: "#4CAF50",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer",
  fontWeight: "500",
  transition: "all 0.3s"
};

function App() {
  const [roomAId, setRoomAId] = useState(null);
  const [roomBId, setRoomBId] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  const createRooms = async () => {
    setLoading(true);
    try {
      console.log("🏗️ Creating two rooms...");
      const roomA = await createMeeting({ token: authToken });
      const roomB = await createMeeting({ token: authToken });
      
      setRoomAId(roomA);
      setRoomBId(roomB);
      setCurrentRoom(roomA);
      
      console.log("✅ Room A created:", roomA);
      console.log("✅ Room B created:", roomB);
      alert(`Rooms created successfully!\n\nRoom A: ${roomA}\nRoom B: ${roomB}\n\nYou're now in Room A.`);
    } catch (error) {
      console.error("❌ Error creating rooms:", error);
      alert("Failed to create rooms. Please check your auth token and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchRoom = (newRoomId) => {
    setCurrentRoom(newRoomId);
  };

  const handleLeaveAll = () => {
    setCurrentRoom(null);
    setRoomAId(null);
    setRoomBId(null);
  };

  // Welcome Screen
  if (!currentRoom) {
    return (
      <div style={{ 
        padding: "40px", 
        textAlign: "center",
        maxWidth: "800px",
        margin: "0 auto"
      }}>
        <h1 style={{ color: "#4CAF50" }}>🎥 VideoSDK Room Switching Demo</h1>
        <p style={{ fontSize: "16px", color: "#666", marginBottom: "30px" }}>
          This demo showcases two room switching methods:
        </p>
        <ul style={{ 
          textAlign: "left", 
          maxWidth: "600px", 
          margin: "0 auto 30px",
          lineHeight: "1.8"
        }}>
          <li><strong>Normal Room Switch:</strong> Leave Room A and join Room B</li>
          <li><strong>Media Relay:</strong> Broadcast your audio/video from one room to another</li>
        </ul>
        
        {loading ? (
          <p style={{ fontSize: "18px" }}>Creating rooms... ⏳</p>
        ) : (
          <button
            onClick={createRooms}
            style={{
              padding: "20px 50px",
              fontSize: "18px",
              backgroundColor: "#4CAF50",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "bold",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
            }}
          >
            🚀 Create Two Rooms & Start
          </button>
        )}
        
        <div style={{ 
          marginTop: "40px", 
          padding: "20px", 
          backgroundColor: "#e3f2fd",
          borderRadius: "8px",
          fontSize: "14px",
          textAlign: "left"
        }}>
          <strong>📝 Instructions:</strong>
          <ol style={{ marginTop: "10px", lineHeight: "1.8" }}>
            <li>Click "Create Two Rooms & Start" to initialize Room A and Room B</li>
            <li>Join Room A and enable your camera/microphone</li>
            <li>Use "Switch to Room B" to move between rooms</li>
            <li>Use "Start Media Relay" to broadcast to the other room</li>
            <li>Open this app in another browser tab to see both rooms simultaneously</li>
          </ol>
        </div>

        <div style={{ 
          marginTop: "20px", 
          padding: "15px", 
          backgroundColor: "#fff3cd",
          borderRadius: "8px",
          fontSize: "13px",
          textAlign: "left"
        }}>
          <strong>⚠️ Troubleshooting Camera Issues:</strong>
          <ul style={{ marginTop: "10px", lineHeight: "1.6" }}>
            <li>Close other apps using your camera (Zoom, Teams, Skype, etc.)</li>
            <li>Grant camera/microphone permissions to your browser</li>
            <li>Try refreshing the page if camera won't start</li>
            <li>Check if your camera is properly connected</li>
          </ul>
        </div>
      </div>
    );
  }

  // Meeting Interface
  const isRoomA = currentRoom === roomAId;
  const targetRoomId = isRoomA ? roomBId : roomAId;
  const targetRoomName = isRoomA ? "Room B" : "Room A";
  const currentRoomName = isRoomA ? "Room A" : "Room B";

  return (
    <MeetingProvider
      config={{
        meetingId: currentRoom,
        micEnabled: true,
        webcamEnabled: true,
        name: "C.V. Raman",
      }}
      token={authToken}
    >
      <MeetingConsumer>
        {() => (
          <RoomInterface
            meetingId={currentRoom}
            roomName={currentRoomName}
            onSwitchRoom={handleSwitchRoom}
            targetRoomId={targetRoomId}
            targetRoomName={targetRoomName}
            onLeaveAll={handleLeaveAll}
          />
        )}
      </MeetingConsumer>
    </MeetingProvider>
  );
}

export default App;