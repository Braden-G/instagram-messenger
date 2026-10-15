# Quiet DMs

Quiet DMs is a personal iOS app that opens direct messages and leaves the rest of the site alone. Feed, Explore, profiles, and the Reels tab are sent back to the inbox. Reels and posts sent inside a chat still play.

It is an independent Expo SDK 54 app. A web view loads https://www.instagram.com/direct/inbox/, and you sign in there with your own account. There is no Instagram API. Quiet DMs is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

## Run it

Install the App Store version of Expo Go (SDK 54), then:

```
npm install
npx expo start
```

Scan the QR code with Expo Go.

## App Review notes

Paste this into App Store Connect, on the version page, under App Review Information → Notes:

```
Quiet DMs is a personal app for family use. It is an independent app and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

People sign in with their own account on Instagram's official website, loaded inside a web view. The app does not collect data.

The app keeps browsing on direct messages to cut down on scrolling. Feed, Explore, profiles, and the Reels tab are returned to the inbox. Media that someone sends inside a conversation can still be opened.
```
