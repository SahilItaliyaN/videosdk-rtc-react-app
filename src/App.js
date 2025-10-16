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
  onLeaveAll,
  roomAId,
  roomBId
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

    // Ensure stopLivestream is called and completes before leaving
    const stopAndLeave = async () => {
      if (relayActive && meeting) {
        try {
          console.log("🛑 Stopping media relay before switching rooms...");
          await meeting.stopLivestream();
          setRelayActive(false); // Reset relay state
          console.log("✅ Media relay stopped successfully.");
        } catch (err) {
          console.error("Error stopping relay before switching:", err);
          // Even if stopping fails, we still proceed to leave and switch rooms
        }
      }
      leave(); // Leave the current meeting
      setTimeout(() => {
        onSwitchRoom(targetRoomId); // Switch to the new room
      }, 800);
    };

    stopAndLeave();
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
        alert(`Media Relay Started!\n\nYour audio/video is now being broadcast to ${targetRoomName}.\n\nOpen another tab and join ${targetRoomName} to see the relay.`);
      } else {
        console.log("🛑 Stopping media relay");
        // Ensure meeting object is still valid before attempting to stop livestream
        if (meeting) {
          await meeting.stopLivestream();
          setRelayActive(false);
          console.log("✅ Media relay stopped");
        } else {
          console.warn("Meeting object is undefined, cannot stop livestream.");
          setRelayActive(false); // Still reset state if meeting is gone
        }
      }
    } catch (error) {
      console.error("❌ Media relay error:", error);
      alert(`Media Relay Error: ${error.message}\n\nNote: Media relay requires livestream configuration in your VideoSDK dashboard.`);
    }
  };

  const handleLeaveAll = () => {
    if (relayActive && meeting) {
      try {
        meeting.stopLivestream().catch(err => console.error("Error stopping relay:", err));
      } catch (error) {
        console.log("error in the all leave all", error)
      }
    }
    leave();
    setTimeout(() => {
      onLeaveAll();
    }, 300);
  };

  const copyRoomId = (roomId, roomName) => {
    navigator.clipboard.writeText(roomId).then(() => {
      alert(`${roomName} ID copied to clipboard!\n\n${roomId}\n\nPaste this in another tab to join the same room.`);
    }).catch(() => {
      alert(`${roomName} ID: ${roomId}\n\nCopy this to join from another tab.`);
    });
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

      {/* Room IDs Display */}
      <div style={{
        padding: "15px",
        backgroundColor: "#e3f2fd",
        borderRadius: "5px",
        marginBottom: "20px"
      }}>
        <h3 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>📋 Room IDs (Share with others)</h3>
        <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>Room A:</span>
            <code style={{
              backgroundColor: "white",
              padding: "5px 10px",
              borderRadius: "3px",
              fontSize: "12px",
              flex: 1
            }}>
              {roomAId}
            </code>
            <button
              onClick={() => copyRoomId(roomAId, "Room A")}
              style={{
                padding: "5px 15px",
                fontSize: "12px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer"
              }}
            >
              📋 Copy
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "14px", fontWeight: "bold" }}>Room B:</span>
            <code style={{
              backgroundColor: "white",
              padding: "5px 10px",
              borderRadius: "3px",
              fontSize: "12px",
              flex: 1
            }}>
              {roomBId}
            </code>
            <button
              onClick={() => copyRoomId(roomBId, "Room B")}
              style={{
                padding: "5px 15px",
                fontSize: "12px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "3px",
                cursor: "pointer"
              }}
            >
              📋 Copy
            </button>
          </div>
        </div>
        <p style={{
          margin: "10px 0 0 0",
          fontSize: "12px",
          color: "#666",
          fontStyle: "italic"
        }}>
          💡 Copy these IDs and use "Join Existing Room" in another tab to join the same rooms
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
                style={{ ...controlButton, backgroundColor: "#2196F3" }}
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
                style={{ ...controlButton, backgroundColor: "#f44336" }}
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
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
          </div>
        </>
      )}
    </div>
  );
}

const controlButton = {
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

function JoinExistingRoomScreen({ onJoinRoom, onBack }) {
  const [roomAInput, setRoomAInput] = useState("");
  const [roomBInput, setRoomBInput] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("A");

  const handleJoin = () => {
    if (!roomAInput.trim() || !roomBInput.trim()) {
      alert("Please enter both Room A and Room B IDs");
      return;
    }
    onJoinRoom(roomAInput.trim(), roomBInput.trim(), selectedRoom === "A" ? roomAInput.trim() : roomBInput.trim());
  };

  return (
    <div style={{
      padding: "40px",
      textAlign: "center",
      maxWidth: "600px",
      margin: "0 auto"
    }}>
      <h2 style={{ color: "#4CAF50" }}>🚪 Join Existing Rooms</h2>
      <p style={{ color: "#666", marginBottom: "30px" }}>
        Enter the Room IDs shared with you
      </p>

      <div style={{ marginBottom: "20px", textAlign: "left" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Room A ID:
        </label>
        <input
          type="text"
          value={roomAInput}
          onChange={(e) => setRoomAInput(e.target.value)}
          placeholder="Enter Room A ID"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "14px",
            border: "2px solid #ddd",
            borderRadius: "5px",
            boxSizing: "border-box"
          }}
        />
      </div>

      <div style={{ marginBottom: "20px", textAlign: "left" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Room B ID:
        </label>
        <input
          type="text"
          value={roomBInput}
          onChange={(e) => setRoomBInput(e.target.value)}
          placeholder="Enter Room B ID"
          style={{
            width: "100%",
            padding: "12px",
            fontSize: "14px",
            border: "2px solid #ddd",
            borderRadius: "5px",
            boxSizing: "border-box"
          }}
        />
      </div>

      <div style={{ marginBottom: "30px", textAlign: "left" }}>
        <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
          Which room to join first?
        </label>
        <div style={{ display: "flex", gap: "10px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              value="A"
              checked={selectedRoom === "A"}
              onChange={(e) => setSelectedRoom(e.target.value)}
              style={{ marginRight: "5px" }}
            />
            Room A
          </label>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              value="B"
              checked={selectedRoom === "B"}
              onChange={(e) => setSelectedRoom(e.target.value)}
              style={{ marginRight: "5px" }}
            />
            Room B
          </label>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
        <button
          onClick={onBack}
          style={{
            padding: "15px 30px",
            fontSize: "16px",
            backgroundColor: "#9e9e9e",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          ← Back
        </button>
        <button
          onClick={handleJoin}
          style={{
            padding: "15px 30px",
            fontSize: "16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Join Room {selectedRoom}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [roomAId, setRoomAId] = useState(null);
  const [roomBId, setRoomBId] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showJoinScreen, setShowJoinScreen] = useState(false);

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
      alert(`Rooms created successfully!\n\nRoom A: ${roomA}\nRoom B: ${roomB}\n\nYou're now in Room A.\n\n📋 Copy these IDs to join from another tab!`);
    } catch (error) {
      console.error("❌ Error creating rooms:", error);
      alert("Failed to create rooms. Please check your auth token and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinExistingRooms = (roomA, roomB, startRoom) => {
    setRoomAId(roomA);
    setRoomBId(roomB);
    setCurrentRoom(startRoom);
    setShowJoinScreen(false);
    console.log("✅ Joined existing rooms - Room A:", roomA, "Room B:", roomB);
  };

  const handleSwitchRoom = (newRoomId) => {
    setCurrentRoom(newRoomId);
  };

  const handleLeaveAll = () => {
    setCurrentRoom(null);
    setRoomAId(null);
    setRoomBId(null);
    setShowJoinScreen(false);
  };

  // Join Existing Room Screen
  if (showJoinScreen) {
    return (
      <JoinExistingRoomScreen
        onJoinRoom={handleJoinExistingRooms}
        onBack={() => setShowJoinScreen(false)}
      />
    );
  }

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
          <div style={{ display: "flex", gap: "15px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={createRooms}
              style={{
                padding: "20px 40px",
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
              🚀 Create New Rooms
            </button>
            <button
              onClick={() => setShowJoinScreen(true)}
              style={{
                padding: "20px 40px",
                fontSize: "18px",
                backgroundColor: "#2196F3",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
              }}
            >
              🚪 Join Existing Rooms
            </button>
          </div>
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
            <li><strong>First Tab:</strong> Click "Create New Rooms" to initialize Room A and Room B</li>
            <li><strong>Copy Room IDs:</strong> Once created, copy the Room IDs displayed at the top</li>
            <li><strong>Second Tab:</strong> Open this app in a new tab/window</li>
            <li><strong>Join Same Rooms:</strong> Click "Join Existing Rooms" and paste the Room IDs</li>
            <li><strong>Test Features:</strong> Now you can test room switching and media relay between tabs!</li>
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
          <strong>⚠️ Troubleshooting:</strong>
          <ul style={{ marginTop: "10px", lineHeight: "1.6" }}>
            <li>Close other apps using your camera (Zoom, Teams, Skype, etc.)</li>
            <li>Grant camera/microphone permissions to your browser</li>
            <li>Use different browser profiles or incognito windows for testing</li>
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
            roomAId={roomAId}
            roomBId={roomBId}
          />
        )}
      </MeetingConsumer>
    </MeetingProvider>
  );
}

export default App;
