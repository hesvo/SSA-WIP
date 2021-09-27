//////////////////////////////////////////////////////////
// Organiser init-event-app
// (c) A.J. Wischmann 2021
//////////////////////////////////////////////////////////
"use strict";
const { bufferToHex, generateKeyPair, randomBytes } = require("eccrypto-js");
const {
  createChannel,
  createMessage,
  mamAttach,
  TrytesHelper,
} = require("@iota/mam.js");
const crypto = require("crypto");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");
const { strict } = require("assert");
var secrets = require("secrets.js-grempe");

const node = "https://chrysalis-nodes.iota.org/";

// the privatekey and the publickey to encrypt/decrypt attendancy-transaction
const keyPair = generateKeyPair();
const privateOrgPrivateEventKey = keyPair.privateKey;
const publicEventKey = keyPair.publicKey;

// public organiserdetails -for demopurposes hardcoded
const organiserName = "ExampleOrganiser";
const organiserAddress = "42 Examplestreet";
const organiserPostcode = "4242EG";
const organiserCity = "ExampleCity";
const organiserURL = "www.exampleurl.com";
const organiserTelephone = "0612345678";
const organiserMail = "example.email@gmail.com";
const organiserDID = "did:example:123456789abcdefghi#key-1";

// public eventdetails -for demopurposes hardcoded
const privateOrgPrivateTitle = "ExamplePrivateEventTitle";
const eventName = "Example Event Name";
const eventDate = "March 9th 2021";
const eventTime = "10:00 - 16:30";
const eventLocation = "Online";

let eventSEED = "";
let organiserKey = "";
let channelState;
// demo-sidekey
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";

let attendeeQRcode = "";
let attendanceNotificationKey = "";

let shamirQR = false;
let nAttendees;
let qrThreshold;
let qrAmount;
let registrationKey;



const payload0 = {
  // Information for the private-organiser-Mam-record

  title: privateOrgPrivateTitle,
  timestamp: luxon.DateTime.now().toISO(),
  ePKey: bufferToHex(privateOrgPrivateEventKey),
};

const payload1 = {
  // Information for the 1st public-Mam-record
  orgname: organiserName,
  orgaddress: organiserAddress,
  orgzip: organiserPostcode,
  orgcity: organiserCity,
  orgtel: organiserTelephone,
  orgmail: organiserMail,
  orgurl: organiserURL,
  orgdid: organiserDID,
  eventname: eventName,
  eventloc: eventLocation,
  eventdate: eventDate,
  eventtime: eventTime,
  eventPublicKey: bufferToHex(publicEventKey),
};

async function splitShamirSecret(
  publicEventRoot,
  attendanceNotificationKey,
  expiryDateTime) {
  // This is a MAM with only 1 restricted-record:
  // publicRootEventMAM -as link to Eventinformation
  // indexation - as tag for attendance-transactions/notifications
  // timestamp - expiryDateTime

  const mode = "restricted";
  const sideKey = "DATE"; //TODO change for dynamic password?
  let channelQRState;


  registrationKey = secrets.random(256);

  const dataQRPlain = publicEventRoot + attendanceNotificationKey;

  let encryptedQR = encryptQR(dataQRPlain, registrationKey);

  const payloadQR = {
    a: encryptedQR.payloadEnc,
    b: encryptedQR.hexIV,
    expirytimestamp: expiryDateTime,
  };

  let qrKey = registrationKey.slice(0,32);
  let attendeeKey = registrationKey.slice(32, 64);

  const allShares = secrets.share(attendeeKey, parseInt(nAttendees), 2);
  const publicShare = allShares[0];
  const attendeeShares = allShares.slice(1);

  const shamirSecret = qrKey + publicShare;

  let qrShares = secrets.share(shamirSecret, parseInt(qrAmount), parseInt(qrThreshold));

  attendeeQRcode = "SSA" + generateSeed(78);

  for (let i = 0; i < qrShares.length; i++) {
    qrShares[i] = qrThreshold + qrShares[i] + attendeeQRcode;
  }

  

  console.log("PayloadQR =================".red);
  console.log(payloadQR);
  console.log("=================".red);

  console.log(`Send these shares to attendees to use as unique registration tokens:`);
  console.log(attendeeShares);

  console.log(`Attendee QR-seed : ${attendeeQRcode}`.cyan);
  console.log(`Public share(recovered with QR codes): ${publicShare}`.green);
  console.log(`Show these QR codes to attendees (threshold for registration: ${qrThreshold}):`);
  qrShares.forEach(s => {
    console.log(
      `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${s}`
        .yellow
    )
  });

  channelQRState = createChannel(attendeeQRcode, 2, mode, sideKey);

  const mamMessage = createMessage(
    channelQRState,
    TrytesHelper.fromAscii(JSON.stringify(payloadQR))
  );

  saveSharesQR(qrShares); // SEED    : plus sidekey?!
  saveSharesAttendee(allShares);

  console.log("Attaching =================".red);
  console.log("Attaching Eventmessage to tangle, please wait...");
  // tag -SSA9EXPERIMENTQR- can be used lateron for storing on permanode
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENTQR");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/chrysalis/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);


}


function encryptQR(payload, pass) {

  let data = payload;

  
  const key = Buffer.from(pass, 'hex');
  const iv = ppto.randomBytes(16);
 
  const cipher = crypto.createCipheriv('aes-256-ctr', Buffer.from(pass, 'hex'), iv);

  const cText = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');

  let payloadEnc = cText;

  const hexIV = iv.toString('hex');

  return {payloadEnc, hexIV};
}

function decryptQR(data, ivEnc, pass) {

  const key = Buffer.from(pass, 'hex');
  const toDecipher = data;
  const iv = Buffer.from(ivEnc, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(pass, 'hex'), iv);

  const decrypted1 = decipher.update(toDecipher, 'hex', 'utf8') + decipher.final('utf8');

  return decrypted1;
}


function hashKeyFromPass(pass) {
  return crypto.createHash('md5').update(pass).digest();
}


function generateSeed(length) {
  // Random string A-Z,9 -for seeds
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ9";
  let seed = "";
  while (seed.length < length) {
    const byte = crypto.randomBytes(1);
    if (byte[0] < 243) {
      seed += charset.charAt(byte[0] % 27);
    }
  }
  return seed;
}

function saveChannelState() {
  // Store the channel state so we can use it in evenclose.js
  console.log("Save channelstate >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/channelState.json",
      JSON.stringify(channelState, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }
}

function saveQR(qrcode) {
  // save QRcode so we can use it in attendee.js
  console.log("Save QRcode >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/QRcode.json", qrcode);
  } catch (e) {
    console.error(e);
  }
}

function saveSharesAttendee(shamirShares) {
  const data = {
    attendeeShares: shamirShares,
  };
  // save QRcode so we can use it in attendee.js
  console.log("Save shares (attendees) >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/attendeeShares.json", JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

function saveSharesQR(shamirShares) {
  
  const data = {
    qrShares: shamirShares,
  };
  // save QRcode so we can use it in attendee.js
  console.log("Save shares (qr) >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/QRshares.json", JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

function saveSeedAndKeys() {
  // save eventSEED and eventPassword in (imaginery) organiserswallet

  const eventWalletInfo = `{
    "seed":"${eventSEED}",
    "password":"${organiserKey}",
    "indexation":"${attendanceNotificationKey}",
    "aQR":"${attendeeQRcode}",
    "ePKey":"${bufferToHex(privateOrgPrivateEventKey)}",
    "registrationKey":"${registrationKey}"
  }`;

  console.log("Save Event Seed and Keys >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/ShamirEventWallet.json", eventWalletInfo);
  } catch (e) {
    console.error(e);
  }
}

function saveSEEDnPassword() {
  // save eventSEED and eventPassword in (imaginery) organiserswallet

  const eventWalletInfo = `{
    "seed":"${eventSEED}",
    "password":"${organiserKey}",
    "indexation":"${attendanceNotificationKey}",
    "aQR":"${attendeeQRcode}",
    "ePKey":"${bufferToHex(privateOrgPrivateEventKey)}"
  }`;

  console.log("Save EventSEED >>>>>>>>".green);
  try {
    fs.writeFileSync("./json/Wallet.json", eventWalletInfo);
  } catch (e) {
    console.error(e);
  }
}

async function setupMam(payload) {
  // add Organiser-Privatemessage to MAM
  const mode = "restricted";
  const sideKey = organiserKey;

  channelState = createChannel(eventSEED, 2, mode, sideKey);
  const mamMessage = createMessage(
    channelState,
    TrytesHelper.fromAscii(JSON.stringify(payload))
  );

  //DEBUGINFO
  // console.log("mamMessage =================".red);
  // console.log(mamMessage);
  // console.log("channelState =================".red);
  // console.log(channelState);

  console.log("Payload =================".red);
  console.log(JSON.stringify(payload));
  console.log("=================".red);

  // Display the details for the MAM message.
  // console.log("Seed:", channelState.seed);
  // console.log("Address:", mamMessage.address);
  // console.log("Root:", mamMessage.root);
  // console.log("NextRoot:", channelState.nextRoot);

  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching private-Eventmessage to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/chrysalis/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

async function addEvent2Mam(payload) {
  // add Event-message to MAM
  const mode = "restricted";
  const sideKey = commonSideKey;

  channelState.sideKey = commonSideKey;
  console.log("Payload =================".red);
  console.log(JSON.stringify(payload));

  const mamMessage = createMessage(
    channelState,
    TrytesHelper.fromAscii(JSON.stringify(payload))
  );

  //DEBUGINFO
  // console.log("channelState =================".red);
  // console.log(channelState);
  // console.log("mamMessage =================".red);
  // console.log(mamMessage);

  // Display the details for the MAM message.
  // console.log("=================".red);
  // console.log("Seed:", channelState.seed);
  // console.log("Address:", mamMessage.address);
  // console.log("Root:", mamMessage.root);
  // console.log("NextRoot:", channelState.nextRoot);

  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching Eventmessage to tangle, please wait...");
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENT");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/chrysalis/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

async function makeQRmam(
  publicEventRoot,
  attendanceNotificationKey,
  expiryDateTime
) {
  // This is a MAM with only 1 restricted-record:
  // publicRootEventMAM -as link to Eventinformation
  // indexation - as tag for attendance-transactions/notifications
  // timestamp - expiryDateTime

  const mode = "restricted";
  const sideKey = "DATE"; //TODO change for dynamic password?
  let channelQRState;

  const payloadQR = {
    root: publicEventRoot,
    indexation: attendanceNotificationKey,
    expirytimestamp: expiryDateTime,
  };

  console.log("PayloadQR =================".red);
  console.log(payloadQR);
  console.log("=================".red);

  attendeeQRcode = "SSA" + generateSeed(78);
  console.log(`Attendee QR-seed : ${attendeeQRcode}`.cyan);
  console.log(`You can use this QR-code to show to your attendees :`);
  console.log(
    `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${attendeeQRcode}`
      .yellow
  );
  channelQRState = createChannel(attendeeQRcode, 2, mode, sideKey);

  const mamMessage = createMessage(
    channelQRState,
    TrytesHelper.fromAscii(JSON.stringify(payloadQR))
  );


  saveQR(attendeeQRcode); // SEED    : plus sidekey?!

  //DEBUGINFO
  // console.log("channelQRState =================".red);
  // console.log(channelQRState);

  // Display the details for the MAM message.
  // console.log("=================".red);
  // console.log("Seed:", channelQRState.seed);
  // console.log("Address:", mamMessage.address);
  // console.log("Root:", mamMessage.root);
  // console.log("NextRoot:", channelQRState.nextRoot);

  // Attach the message.
  console.log("Attaching =================".red);
  console.log("Attaching Eventmessage to tangle, please wait...");
  // tag -SSA9EXPERIMENTQR- can be used lateron for storing on permanode
  const { messageId } = await mamAttach(node, mamMessage, "SSA9EXPERIMENTQR");
  console.log(`Message Id`, messageId);
  console.log(
    `You can view the mam channel here : \nhttps://explorer.iota.org/chrysalis/streams/0/${mamMessage.root}/${mode}/${sideKey}`
  );
  console.log("===============================".yellow);
}

function makeMamEntryPointAttendee() {
  const publicEventRoot = channelState.nextRoot;
  //HINT make expirydelay a variable
  const expiryDateTime = luxon.DateTime.now().plus({ minutes: 15 }); // to be set by organiser

  attendanceNotificationKey = generateSeed(64);
  if (shamirQR) {
    splitShamirSecret(
      channelState.nextRoot,
      attendanceNotificationKey,
      expiryDateTime.toISO()
      );
  } else {
    makeQRmam(
      channelState.nextRoot,
      attendanceNotificationKey,
      expiryDateTime.toISO()
    );
  }
  

  addEvent2Mam(payload1);
  // save nextroot to append attendee-list in closeevent.js
  saveChannelState();

  if (shamirQR) {
    saveSeedAndKeys();
  } else {
    saveSEEDnPassword();
  }
}

console.log("SSA-organiser-app".cyan);
// Unique SEED per event
eventSEED = prompt(
  "Event SEED -81 UPPERCASE A-Z,9- (*=random-auto-generate): "
);
// password for the private organiser MAMrecord (first record in the MAM)
organiserKey = prompt(
  "Secure organiserKey -UPPERCASE A-Z,9- (*=default for demo): "
);

// Use shamir for multiQR
let yn = prompt(
  "Use Shamir Secret Sharing for multiQR? (y,n): "
);

nAttendees = prompt(
  "Number of attendees? (*=20 default for demo): "
);

qrAmount = prompt(
  "Number of qr codes for event? (*=5 default for demo): "
);

qrThreshold = prompt(
  "Threshold number of QR code for registration? (*=3 default for demo): "
);


if (eventSEED === "*") {
  // generate default for debugging -for lazy people-
  eventSEED = generateSeed(81);
}

if (organiserKey === "*") {
  // for first record of MAM (which is private)
  // for extra encrypting the record which holds the eventPrivatekey
  organiserKey = "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMDHCR9CAD9F";
}

if (yn.toUpperCase() == "Y" || yn == "*") {
  shamirQR = true;
} else {
  shamirQR = false;
}

if (nAttendees == "*") {
  nAttendees = "20";
}

if (qrAmount == "*") {
  qrAmount = "5";
}

if (qrThreshold == "*") {
  qrThreshold = "3";
}

async function run() {
  // interact with IOTA-MAM-V0
  // setupMam(payload0).then(() => makeMamEntryPointAttendee());
  await setupMam(payload0);
  await makeMamEntryPointAttendee();


}

// saveSEEDnPassword();
console.log(`EventSEED = ${eventSEED}`.green);
console.log(`OrganiserKey = ${organiserKey}`.green);
console.log(
  `PrivateEventKey = ${privateOrgPrivateEventKey.toString("hex")}`.cyan
);
console.log(`PublicEventKey = ${publicEventKey.toString("hex")}`.cyan);

run();
