const axios = require('axios');
const FormData = require("form-data");
const luxon = require("luxon");
const fs = require("fs");
const fetch = require("node-fetch");
const pinataSDK = require("@pinata/sdk");



const pinataNode = 'https://api.pinata.cloud/pinning/pinJSONtoIPFS';
const pinataNodeA = 'https://api.pinata.cloud/data/testAuthentication';
const pinataKey = "d83e4ab290b19d2e56ba";
const pinataSKey = "2092d06158aefc30d8dea3fd9faabf9c4115e731e79ae2c6bcf22d08043a66f1";
const pinata = pinataSDK(pinataKey, pinataSKey);

let cid = 'QmcdrXBsk5cSgNx9PQo4YTUhb8VhawRDHTh3S9YhzWfNcd';


function testAuthentication() {
    return axios
        .get(pinataNodeA, {
            headers: {
                pinata_api_key: pinataKey,
                pinata_secret_api_key: pinataSKey
            }
        })
        .then(function (response) {
            console.log(response);
        })
        .catch(function (error) {
            console.log(error);
        });
};

async function pinToIPFS(data) {
    console.log("test1");
    const options = {
        pinataMetadata:{
            name: 'Pin Test /w R5'
        }
    };

    await pinata.pinJSONToIPFS(JSON.parse(data), options).then((result) => {
        console.log("cid is: " + result.IpfsHash);
        console.log(result);
        cid = result.IpfsHash;
    })


    // axios.post(pinataNode, pinData, {
    //     maxBodyLength: 'Infinity',
    //     headers: {
    //         'pinata_api_key': pinataKey,
    //         'pinata_secret_api_key': pinataSKey
    //     }
    // })
    //     .then(function (response) {
    //         console.log(response);
    //         console.log(response.data.IpfsHash);
    //         cid = response.data.IpfsHash;
    //         console.log(cid);
    //         return response;
    //     })
    //     .catch(function (error) {
    //         console.log(error);
    //     })
}

async function retrieveCID(targetCID) {
    console.log(targetCID);
    const url = "https://gateway.pinata.cloud/ipfs/".concat(targetCID);
    console.log(url);
    let retrieved;
    await fetch(url)
        .then(res => res.json())
        .then(json => {console.log(json); console.log("retrieved json: " + JSON.stringify(json)); retrieved = JSON.stringify(json)});
    console.log("retrieved: " + retrieved);
    try {
        fs.writeFileSync("./json/eventList.json", retrieved);
      } catch (e) {
        console.error(e);
      }
}

async function run() {
    // console.log("test auth");
    // await testAuthentication();
    // console.log("testing api pin");
    // console.log("__________________");

    const payloadT = {
        title: "testUpload",
        timestamp: luxon.DateTime.now().toISO(),
    };
    

    //console.log(payloadT);
    //console.log(JSON.stringify(payloadT));
    console.log("pinning");
    await pinToIPFS(JSON.stringify(payloadT));
    console.log("pinned, cid is: " + cid);
    //console.log("testing finished");
    try {
        fs.writeFileSync("./json/sent.json", JSON.stringify(payloadT));
      } catch (e) {
        console.error(e);
      }
    console.log("RETRIEVING");
    console.log(cid);
    if(cid != '') {
        retrieveCID(cid);
    }
    console.log("RETRIEVED!");
}

run();
