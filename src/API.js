//This is the Auth token, you will use it to generate a meeting and connect to it
export const authToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlrZXkiOiJmMzBlYTZjMC1jNmM4LTQ3NWMtYWZhYy02NzlhN2I3ODBiNTQiLCJwZXJtaXNzaW9ucyI6WyJhbGxvd19qb2luIiwiYWxsb3dfbW9kIiwiYWxsb3dfbGl2ZV9zdHJlYW0iXSwiaWF0IjoxNzYwNjAzMTcxLCJleHAiOjE3NjEyMDc5NzF9.J4eFxkn1NE_BqHFKrusraOylkJNBMnX18xKjepkFvGk";

// Function to create a new meeting room
export const createMeeting = async ({ token }) => {
  const res = await fetch(`https://api.videosdk.live/v2/rooms`, {
    method: "POST",
    headers: {
      authorization: `${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create meeting: ${res.status} ${text}`);
  }

  // Extract the roomId from response
  const { roomId } = await res.json();
  return roomId;
};
