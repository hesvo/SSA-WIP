<h2 align="center">A Proof-of-Concept for Self Sovereign Attendancy application.</h2>

<p align="center">
  <a href="https://discord.com/invite/wTnDbDG/" style="text-decoration:none;"><img src="https://img.shields.io/badge/Discord-9cf.svg?logo=discord" alt="Discord"></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT license"></a>
</p>

<p align="center">
  <a href="#Node-SSA-app">Node SSA-application</a> ◈
  <a href="#Use-case">Use Case</a> ◈
  <a href="#Code">Code</a> ◈
  <a href="#Getting-started">Getting started</a> ◈
  <a href="#Remark">Remark</a>
</p>

---

## Node-SSA-app

This is the PoC of our Self Sovereign Attendancy application.
Written for NodeJS as a PoC+ with securitymeasures built for IOTA-chrysalis with MAM-V0 (with LOTS of explanation en debuginfo in the source).

## Use-case

The use-case is described here : https://northsearegion.eu/bling/use-cases/use-case-1-blockchainlab-drenthe/ and an animationvideo about it can be found here : https://www.youtube.com/watch?v=VDKABf8hmFI

## Code

The code-dir has a JS-file for 5 modules:

- organiser.js
- attendee.js
- generateQR.js
- eventclose.js
- verifier.js

**organiser.js** : registers the eventinformation on the Tangle and generates a QRcode (expirytime +20min.) for the attendee to find the eventinfo.

**attendee.js** : looks up the event on the Tangle and asks the attendee if he/she wants to register (optional remark).

**generateQR.js** : lets the attendee generate a verifierQR (anonymous or with personal information -if the verifier demands-)

**eventclose.js** : makes a list of all attendees who registered, writes is to the Tangle and closes the event.

**verifier.js** : reads the verifierQR and checks on the Tangle at the event if the attendee was registered.

## Getting started

To start playing with these examples: install NodeJS on your machine and run the following commands in your terminal:

```
git clone https://gitlab.com/blockchainlabdrenthe/nodeSSA.git
# or git clone https://gitlab.com/IoTAdri/nodeSSA.git
# or git clone https://github.com/IoTAdri/nodeSSA.git
cd nodeSSA
npm install # or yarn install
node code/organiser.js
```

You should see the SSA-organiser-app. You can answer both prompts with \* `[enter]` and then a demo-event will be registered on the IOTA-Tangle.

A technical desciption about the architecture/dataflow we used can be found in our Youtubechannel. In this lecture we gave for the DutchBlockchainWeek : https://www.youtube.com/watch?v=W-AVcImH0gY#t=48m08s

You can find the demo/walkthrough-video of this PoC here : https://youtu.be/exjHvn2xgoY

---

No personal attendee-information is shared over the Tangle (GDPR-proof), the attendee-token is secured with Elliptic Curve Encryption (comparable with RSA-3072).

Information between the modules is shared through a JSON-file with minimal values (in actual deployment this is done with QR-code and scanner or via iBeacon-function).

It is all based upon IOTA-MAMchannels on the chrysalis-testnet. To be replaced with IOTA-Streams before final deployment.

### Remark

> (this code is far from optimal it is simply written show the workingprinciple and to serve as a startingpoint. It can ALWAYS use some refactoring/cleanup -it's a PoC- so PR's are welcome)

This is a project within:

![Bling](https://www.bcld.nl/wp-content/uploads/2019/09/BLING-RGB-02-A-colour-300x119.jpg)

(c) Adri Wischmann 2021
