# VideoSDK RTC React App

This document outlines the setup, features, and limitations of the VideoSDK RTC React application.

## 1. Project Setup Steps

1.  **Create a new room:** Start by creating a new room from the homepage.
2.  **Navigate to Room A:** After creating the room, you’ll be redirected to “Room A”.
3.  **Open a new tab and join an existing room:** In a new browser tab, open the app again and choose to join an existing room.
4.  **Enter the Room ID:** Input the Room ID of “Room A” (or any other room you want to join).
5.  **Join the desired room:** Click to join the room. You should now be connected to the same room from both tabs.

## 2. Room Switching Implementation

The application supports switching between multiple rooms. We created two rooms and stored their IDs. For switching between rooms, we first leave the current room, then join the other room.

You can switch back to Room A at any time because we’re just changing the room ID. When the room ID changes, the entire RoomInterface re-renders, which is why the new participants are displayed correctly.

## 3. Media Relay Usage

An attempt was made to implement the Media Relay feature based on a provided guide website. However, this feature is not currently working as expected. The primary reason identified for this issue is that live streaming capabilities, which are likely dependent on Media Relay, are only available for paid plans. The current environment is using a free plan, which restricts the implementation of this feature.

## 4. Limitations, Challenges, and Differences

### Limitations:
*   **Media Relay / Live Streaming:** These features are not functional due to plan restrictions. They require a paid plan.

*   **Permissions:** Even with token-based permissions, additional configuration is required in the project dashboard. These settings may not be available under the free plan.

### Challenges:
*   **Paid Plan Requirement:** Core functionality related to Media Relay and live streaming is gated behind a paid subscription. This was discovered after multiple unsuccessful attempts to implement the feature, even when using generated tokens.
*   **Dashboard Permissions:** Some required permissions are only configurable in the dashboard under a paid plan. Initially, this led to confusion and wasted time during debugging.


### Differences between Normal Switching and Media Relay Switching:
*   **Normal Room Switching:** This feature allows switching between rooms, but it does not maintain audio or video streams from the previous room.

*   **Media Relay Switching:** Media Relay enables live streaming from one room to another by sharing audio, video, or screen across rooms using specific room IDs. This allows one screen to be shared with multiple rooms simultaneously.
