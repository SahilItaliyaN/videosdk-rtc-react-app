import "./App.css";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MeetingProvider,
  MeetingConsumer,
  useMeeting,
  useParticipant,
  VideoPlayer,
} from "@videosdk.live/react-sdk";
import { authToken, createMeeting } from "./API";


function JoinScreen({ getMeetingAndToken }) {
  const [meetingId, setMeetingId] = useState(null);
  const onClick = async () => {
    await getMeetingAndToken(meetingId);
  };
  return (
    <div>
      <input
        type="text"
        placeholder="Enter Meeting Id"
        onChange={(e) => {
          setMeetingId(e.target.value);
        }}
      />
      <button onClick={onClick}>Join</button>
      {" or "}
      <button onClick={onClick}>Create Meeting</button>
    </div>
  );
}

function ParticipantView(props) {
  const micRef = useRef(null);
  const { micStream, webcamOn, micOn, isLocal, displayName } =
    useParticipant(props.participantId);

  useEffect(() => {
    if (micRef.current) {
      if (micOn && micStream) {
        const mediaStream = new MediaStream();
        mediaStream.addTrack(micStream.track);

        micRef.current.srcObject = mediaStream;
        micRef.current
          .play()
          .catch((error) =>
            console.error("videoElem.current.play() failed", error)
          );
      } else {
        micRef.current.srcObject = null;
      }
    }
  }, [micStream, micOn]);


  return (
    <div key={props.participantId}>
      <p>
        Participant: {displayName} | Webcam: {webcamOn ? "ON" : "OFF"} | Mic:{" "}
        {micOn ? "ON" : "OFF"}
      </p>
      <audio ref={micRef} autoPlay muted={isLocal} />
      {webcamOn && (
        <>
          <VideoPlayer
            participantId={props.participantId} // Required
            type="video" // "video" or "share"
            containerStyle={{
              height: "200px",
              width: "300px",
            }}
            className="h-full"
            classNameVideo="h-full"
            videoStyle={{}}
          />
        </>
      )}
    </div>
  );
  // const { micStream, webcamOn, micOn } = useParticipant(props.participantId);
  // const micRef = useRef(null);
  // const mediaStream = new MediaStream();
  // mediaStream.addTrack(micStream.track);

  // micRef.current.srcObject = mediaStream;
  // micRef.current
  //   .play()
  //   .catch((error) => console.error("micElem.current.play() failed", error));
}

// function Controls() {
//   const [meetingId, setMeetingId] = useState(null);
//   const { leave, toggleMic, toggleWebcam } = useMeeting();
//   return (
//     <div>
//       <button onClick={() => leave()}>Leave</button>
//       <button onClick={() => toggleMic()}>toggleMic</button>
//       <button onClick={() => toggleWebcam()}>toggleWebcam</button>

//     </div>
//   );
// }

function Controls(props) {
  const [meetingId, setMeetingId] = useState(null);
  const [joined, setJoined] = useState(null);
  const { join, participants, leave, toggleMic, toggleWebcam } = useMeeting({
    //callback for when meeting is joined successfully
    onMeetingJoined: () => {
      setJoined("JOINED");
    },
    //callback for when meeting is left
    onMeetingLeft: () => {
      props.onMeetingLeave();
    },
  });
  const joinMeeting = () => {
    leave();
    setJoined("JOINING");
    join();
  };

  const onClick = async () => {
    await props.getMeetingAndToken(meetingId);
  };


  return (
    <div>
      <button onClick={() => leave()}>Leave</button>
      <button onClick={() => toggleMic()}>toggleMic</button>
      <button onClick={() => toggleWebcam()}>toggleWebcam</button>
      <div>
        <input
          type="text"
          placeholder="Enter Meeting Id"
          onChange={(e) => {
            setMeetingId(e.target.value);
          }}
        />
        <button onClick={onClick}>Join</button>
      </div>
    </div>
  );
}

function MeetingView(props) {
  const [joined, setJoined] = useState(null);
  //Get the method which will be used to join the meeting.
  //We will also get the participants list to display all participants
  const { join, participants } = useMeeting({
    //callback for when meeting is joined successfully
    onMeetingJoined: () => {
      setJoined("JOINED");
    },
    //callback for when meeting is left
    onMeetingLeft: () => {
      props.onMeetingLeave();
    },
  });
  const joinMeeting = () => {
    setJoined("JOINING");
    join();
  };

  return (
    <div className="container">
      <h3>Meeting Id: {props.meetingId}</h3>
      {joined && joined == "JOINED" ? (
        <div>
          <Controls getMeetingAndToken={props.getMeetingAndToken} />
//For rendering all the participants in the meeting
          {[...participants.keys()].map((participantId) => (
            <ParticipantView
              participantId={participantId}
              key={participantId}
            />
          ))}
        </div>
      ) : joined && joined == "JOINING" ? (
        <p>Joining the meeting...</p>
      ) : (
        <button onClick={joinMeeting}>Join</button>
      )}
    </div>
  );
}

function App() {
  const [meetingId, setMeetingId] = useState(null);

  //Getting the meeting id by calling the api we just wrote
  const getMeetingAndToken = async (id) => {
    const meetingId =
      id == null ? await createMeeting({ token: authToken }) : id;
    setMeetingId(meetingId);
  };

  //This will set Meeting Id to null when meeting is left or ended
  const onMeetingLeave = () => {
    setMeetingId(null);
  };

  return authToken && meetingId ? (
    <MeetingProvider
      config={{
        meetingId,
        micEnabled: true,
        webcamEnabled: true,
        name: "C.V. Raman",
      }}
      token={authToken}
    >
      <MeetingView meetingId={meetingId} getMeetingAndToken={getMeetingAndToken} onMeetingLeave={onMeetingLeave} />
    </MeetingProvider>
  ) : (
    <JoinScreen meetingId={meetingId} getMeetingAndToken={getMeetingAndToken} />
  );
}

export default App;