//////////////////////////////////////////////////////////
// Attendee attend-event-app
// (c) A.J. Wischmann 2021
//////////////////////////////////////////////////////////
"use strict";
const { sendData, SingleNodeClient, Converter } = require("@iota/iota.js");

const {
  mamFetch,
  TrytesHelper,
  channelRoot,
  createChannel,
  mamFetchAll,
} = require("@iota/mam.js");

const {
  bufferToHex,
  hexToBuffer,
  sha256,
  encrypt,
  utf8ToBuffer,
} = require("eccrypto-js");
const luxon = require("luxon");
const fs = require("fs");
const prompt = require("prompt-sync")({ sigint: true });
const colors = require("colors");
const crypto = require("crypto");
var secrets = require("secrets.js-grempe");


const node = "https://chrysalis-nodes.iota.org/";
const commonSideKey =
  "SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSACOMMONKEY9SSA";

let publicEventRoot = "";
let attendancyAddress = "";
let expdatetime = "";
let eventInformation = "";

// Personal information to calculate the Merkle-root
const personalFirstName = "John";
const personalSurname = "Smith";
const personalBirthdate = "19980820";
const personalMail = "johnsmith@gmail.com";
const personalDID = "did:example:123456789abcdefghi#key-1";
const organisation = "An Organisation";
// for demo-purpose
const personalMerkleRoot =
  "ec76f5e70d24137494dbade31136119b52458b19105fd7e5b5812f4de38b82d1";
let eventPersonalMerkleRoot;
let qrReconstruct = new Array();
let aUniqueShare;
let publicShare;
let shareThreshold = 0;
let eventQRSeed = "";
let pCID = "";
let aCID = "";
let ipfsKey = "";

function readQR() {
  // Try and load the QR-root from file - as substitute for QRscan from camera
  try {
    const data = fs.readFileSync("./json/QRcode.json", "utf8");
    return data;
  } catch (err) { console.log(err) }
}

async function retrieveClose() {
  const mode = "restricted";
  const sideKey = commonSideKey;
  let eventClosed = false;

  let fMessage = "";
  const fetched = await mamFetchAll(node, publicEventRoot, mode, sideKey);
  if (fetched && fetched.length > 0) {
    for (let i = 0; i < fetched.length; i++) {
      const element = fetched[i].message;
      fMessage = JSON.parse(TrytesHelper.toAscii(element));
      if (fMessage.message == "Event closed") {
        pCID = fMessage.publicCID;
        aCID = fMessage.attendeeCID;
        ipfsKey = fMessage.ipfsKey;
        saveEventToWallet();
        eventClosed = true;
        console.log("Close message received".green)
      }
    }
    if (!eventClosed) {
      console.log("Event has not been closed.".red);
    }
  }
}

// load qr shares from file, demo purpose
function loadShares() {
  try {
    const data = fs.readFileSync("./json/QRshares.json", "utf8");
    return JSON.parse(data);
  } catch (err) { console.log(eer) }
}

function loadAttendeeShare() {
  try {
    const data = fs.readFileSync("./json/attendeeShares.json", "utf8");
    return JSON.parse(data).attendeeShares[1];
  } catch (err) { console.log(eer) }
}

function decryptQR(data, ivEnc, pass) {

  const key = Buffer.from(pass, 'hex');
  const toDecipher = data;
  const iv = Buffer.from(ivEnc, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(pass, 'hex'), iv);

  const decryptedData = decipher.update(toDecipher, 'hex', 'utf8') + decipher.final('utf8');

  return decryptedData;
}

function readQRShamir() {

  let qrCode = prompt("QR code to add (use 1-5 for QR from file (demo)): ");

  if (Array.from(Array(5).keys()).indexOf(parseInt(qrCode) - 1) != -1) {
    qrCode = loadShares().qrShares[parseInt(qrCode) - 1];
  }


  if (shareThreshold == 0) {
    shareThreshold = qrCode.slice(0, 1);
  }

  let extractShare = qrCode.slice(1, 132);

  if (qrReconstruct.indexOf(extractShare) != -1) {
    console.log("QR code already used.");
    return;
  }

  qrReconstruct.push(extractShare);


  if (eventQRSeed == "") {
    eventQRSeed = qrCode.slice(132);
  }
}

async function readShamirMam() {

  let reconstructedSecret = secrets.combine(qrReconstruct);

  const qrKey = reconstructedSecret.slice(0, 32);
  publicShare = reconstructedSecret.slice(32, 32 + 81);


  const attendeeKey = secrets.combine([publicShare, aUniqueShare]);

  let registrationKey = qrKey + attendeeKey;

  const mode = "restricted";
  const sideKey = "DATE"; //TODO make it dynamic UTC-date?
  let rootValue = "NON";
  let indexationKey = "";

  let qrRoot = channelRoot(createChannel(eventQRSeed, 2, mode, sideKey));
  //DEBUGINFO
  // console.log("Fetching from tangle, please wait...");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`qrRoot : ${qrRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching from tangle, please wait...");
  const fetched = await mamFetch(node, qrRoot, mode, sideKey);

  let encryptedData;
  let hexIV;

  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    encryptedData = fMessage.a;
    hexIV = fMessage.b;
    expdatetime = fMessage.expirytimestamp;
    // console.log(`Message.root : ${rootValue}`);
    // console.log(`Message.indexation : ${indexationKey}`);
    console.log(`Expirydatetime : ${expdatetime}`);
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }


  const decryptedQR = decryptQR(encryptedData, hexIV, registrationKey);



  publicEventRoot = decryptedQR.slice(0, 81);
  attendancyAddress = decryptedQR.slice(81);
}

async function readQRmam(qrSeed) {
  const mode = "restricted";
  const sideKey = "DATE"; //TODO make it dynamic UTC-date?
  let rootValue = "NON";
  let indexationKey = "";

  let qrRoot = channelRoot(createChannel(qrSeed, 2, mode, sideKey));
  //DEBUGINFO
  // console.log("Fetching from tangle, please wait...");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`qrRoot : ${qrRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching from tangle, please wait...");
  const fetched = await mamFetch(node, qrRoot, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    rootValue = fMessage.root;
    indexationKey = fMessage.indexation;
    expdatetime = fMessage.expirytimestamp;
    // console.log(`Message.root : ${rootValue}`);
    // console.log(`Message.indexation : ${indexationKey}`);
    console.log(`Expirydatetime : ${expdatetime}`);
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }
  publicEventRoot = rootValue;
  attendancyAddress = indexationKey;
  //DEBUGINFO
  // console.log("MAMdata ===================".red);
  // console.log(`fetched : ${fetched.message}`.green);
  // console.log("============================".yellow);
  // console.log(publicEventRoot);
  // console.log(attendancyAddress);
}

async function readPublicEventInfo(publicEventRoot) {
  const mode = "restricted";
  const sideKey = commonSideKey;
  //DEBUGINFO
  // console.log("Fetching from publicEventtangle with this information :");
  // console.log(`Node : ${node}`.yellow);
  // console.log(`EventRoot : ${publicEventRoot}`.yellow);
  // console.log(`mode : ${mode}`.yellow);
  // console.log(`sideKey : ${sideKey}`.yellow);

  // Try fetching from MAM
  console.log("Fetching from tangle, please wait...");
  const fetched = await mamFetch(node, publicEventRoot, mode, sideKey);
  if (fetched) {
    let fMessage = JSON.parse(TrytesHelper.toAscii(fetched.message));
    // console.log("Fetched : ", fMessage);
    eventInformation = fMessage;
  } else {
    console.log("Nothing was fetched from the MAM channel");
  }
  //DEBUGINFO
  // console.log("MAMdata ===================".red);
  // console.log(`fetched : ${fetched.message}`.green);
}

function presentEventInfo(eventRecord) {
  console.log("=================================".red);
  console.log("Event :".cyan);
  console.log(`Name : ${eventRecord.eventname}`);
  console.log(`Date : ${eventRecord.eventdate}`);
  console.log(`Time : ${eventRecord.eventtime}`);
  console.log(`Location : ${eventRecord.eventloc}`);
  console.log("Organised by :".cyan);
  console.log(`Organisation : ${eventRecord.orgname}`);
  console.log(`Address : ${eventRecord.orgaddress}`);
  console.log(`Zipcode : ${eventRecord.orgzip}`);
  console.log(`City : ${eventRecord.orgcity}`);
  console.log(`Tel.nr. : ${eventRecord.orgtel}`);
  console.log(`E-mail : ${eventRecord.orgmail}`);
  console.log(`WWW : ${eventRecord.orgurl}`);
  console.log(`DID : ${eventRecord.orgdid}`);
  console.log("=================================".red);
}

function saveInfoToWallet() {
  // write information about the event to Wallet
  // include the peronal information also because
  // this could change over time.

  // mr should be constructed from personalInfo
  // included just for demo-purposes
  const payload = {
    firstname: personalFirstName,
    lastname: personalSurname,
    birthdate: personalBirthdate,
    mail: personalMail,
    organisation: organisation,
    did: personalDID,
    mr: personalMerkleRoot,
    er: publicEventRoot,
  };

  // Store personal eventinformation in Wallet
  // to be used for generating a new verifierQR anytime
  console.log("Save data to wallet >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/personalWallet.json",
      JSON.stringify(payload, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }
}

function saveEventToWallet() {

  const payload = {
    er: publicEventRoot,
    publicCID: pCID,
    attendeeCID: aCID,
    storageKey: ipfsKey,
  };

  // Store personal eventinformation in Wallet
  // to be used for generating a new verifierQR anytime
  console.log("Save data to wallet >>>>>>>>".green);
  try {
    fs.writeFileSync(
      "./json/eventWallet.json",
      JSON.stringify(payload, undefined, "\t")
    );
  } catch (e) {
    console.error(e);
  }
}

async function getSavedRoot() {
  // Try and load the wallet personalinfo from json file
  let pData
  try {
    const storedData = fs.readFileSync("./json/personalWallet.json");
    if (storedData) {
      pData = JSON.parse(storedData.toString());
      publicEventRoot = pData.er;
    }
  } catch (e) {
    console.log(`Error : ${e}`);
  }
}

async function hashHash(mroot) {
  let element = await sha256(utf8ToBuffer(mroot));
  return bufferToHex(element);
}

async function mamInteract() {
  // start the whole process
  if (publicEventRoot === "NON") {
    console.log("Invalid eventRoot-address".brightred);
    return;
  }
  let nowDate = luxon.DateTime.now();
  let expFromISO = luxon.DateTime.fromISO(expdatetime);
  // console.log(nowDate.toISO());
  // console.log(expFromISO.toISO());
  // if (nowDate.toMillis() > expFromISO.toMillis()) {
  if (nowDate > expFromISO) {
    // check for expiry of registration - set by organiser: 20? min
    console.log("The registration to this event has expired.".brightRed);
    return;
  }
  await readPublicEventInfo(publicEventRoot);
  presentEventInfo(eventInformation);
  const answer = prompt(
    "Would you like to register for this event? [Y,n]: ".yellow
  );
  if (answer == "n") {
    return;
  }

  const payloadRemark = prompt(`Optional remark : `.cyan);

  //TODO hashPersonalInfo
  // setup&calculate merkle-root

  // include publicEventRoot to make this token unique per event
  eventPersonalMerkleRoot = personalMerkleRoot + publicEventRoot;
  const mh2 = await hashHash(eventPersonalMerkleRoot);
  const merkleHash2 = await hashHash(mh2);
  //DEBUGINFO
  // console.log("eventPersonalMerkleRoot :".red);
  // console.log(eventPersonalMerkleRoot);
  // console.log(merkleHash2);
  // console.log("===========");

  const payload0 = {
    attendeeID: merkleHash2,
    remark: payloadRemark, //HINT optional, can remain empty. Will be striped by closeevent.
    timestamp: new Date().toLocaleString(),
    attendeeShare: aUniqueShare,
  };

  //DEBUGINFO
  // console.log("Payloadcontent ==============".green);
  // console.log(payload0);

  // writeAttendancy2Tangle
  console.log("Writing attendancy to Tangle ... ========".yellow);
  const client = new SingleNodeClient(node);
  const myIndex = attendancyAddress;

  // encrypt attendeeData with eventPublicKey
  const attendeeData = JSON.stringify(payload0);
  const pubKey = hexToBuffer(eventInformation.eventPublicKey);
  const encrypted2 = await encrypt(pubKey, attendeeData);
  const payloadEnc = {
    a: bufferToHex(encrypted2.iv),
    b: bufferToHex(encrypted2.ephemPublicKey),
    c: bufferToHex(encrypted2.ciphertext),
    d: bufferToHex(encrypted2.mac),
  };
  //DEBUGINFO
  // console.log("enc2");
  const encrypted = JSON.stringify(payloadEnc);
  // console.log(encrypted);

  console.log(`PublicKey : ${eventInformation.eventPublicKey}`.green);
  // const encrypted = attendeeData;

  const sendResult = await sendData(
    client,
    myIndex,
    Converter.utf8ToBytes(encrypted)
  );
  console.log("Done writing attendancy to Tangle ... ========".yellow);
  //DEBUGINFO
  // console.log(`Payload : `);
  // console.dir(encrypted);
  console.log("Received Message Id", sendResult.messageId);
}

console.log("SSA-attendee-app".cyan);
// let readQRcode = readQR();
// console.log(`QRcode from file = ${readQRcode}`.yellow);
// let eventQR = prompt("Event QR-code (*=savedversion): ");
// if (eventQR === "*") eventQR = readQRcode;

let aShare = prompt("Attendee unique token/share (*=load from file (demo)): ");
let loadedShare = loadAttendeeShare();
if (aShare == "*") {
  aUniqueShare = loadedShare;
} else {
  aUniqueShare = aShare;
}
console.log(`Attendee token = ${aUniqueShare}`.blue);


//mamInteract(eventQR);

async function run() {
  console.log("Attendee registration".cyan);
  console.log("=================================================".green);

  let theEnd = false;
  while (!theEnd) {
    let promptString = "Menu: [a]-Add QR code, [r]-Register for event, [c]-Get Close Message info, [q]-Quit: ";
    let menuChoice = prompt(promptString.green);
    menuChoice = menuChoice.toLowerCase();
    if (menuChoice == "a") {
      // show current list of transactions on the Tangle
      readQRShamir();
    }
    if (menuChoice == "r") {
      if (qrReconstruct.length < shareThreshold || shareThreshold == 0) {
        console.log("Not enough QR codes to register.");
      } else {
        // show the details of the current transactions on the Tangle
        await readShamirMam();
        await mamInteract(eventQRSeed);
        saveInfoToWallet();
      }
    }
    if (menuChoice == "c") {
      await getSavedRoot();
      await retrieveClose();
    }
    if (menuChoice == "q") {
      // exit the application
      theEnd = true;
    }
  }
}

run();
