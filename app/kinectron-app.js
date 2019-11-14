const os = require("os");
const kinect = require("node_kinect");

const kinectAzure = new kinect.AzureKinectDeviceWrapper(1);
let depthInterval;
let rawDepthInterval;
let kinectOpen = false;

//  Create local peer server
var PeerServer = require("peer").PeerServer;
var server = PeerServer({ port: 9001, path: "/" });

// Set peer credentials for localhost by default
var peerNet = { host: "localhost", port: 9001, path: "/" };
var myPeerId = "kinectron";
var peer_ids = [];
var peer_connections = [];
var peer = null;
var peerIdDisplay = null;
var newPeerEntry = false;

var canvas = null;
var context = null;
var canvasState = null;

const DEPTHWIDTH = 320;
const DEPTHHEIGHT = 288;

var RAWWIDTH = 320;
var RAWHEIGHT = 288;

var imageData = null;
var imageDataSize = null;
var imageDataArray = null;

let busy = false;
var currentCamera = null;

var rawDepth = false;
var blockAPI = false;

var imgQuality = 1.0; // set default image quality

window.addEventListener("load", initpeer);
window.addEventListener("load", init);
window.addEventListener("load", initKinectAzure);

function init() {
  var ipAddresses;
  var allIpAddresses;

  ipAddresses = getIpAddress();
  allIpAddresses = ipAddresses.join(", ");
  document.getElementById("ipaddress").innerHTML = allIpAddresses;

  peerIdDisplay = document.getElementById("peerid");

  canvas = document.getElementById("inputCanvas");
  context = canvas.getContext("2d");

  setImageData();

  document.getElementById("depth").addEventListener("click", chooseCamera);
  document.getElementById("raw-depth").addEventListener("click", chooseCamera);
  document.getElementById("stop-all").addEventListener("click", chooseCamera);
}

function initKinectAzure() {
  console.log("opening kinect");

  let code = kinectAzure.openDevice();

  if (code != 0) {
    process.exit();
  }

  kinectOpen = true;

  //Configure device
  kinectAzure.configureDepthMode(1); // 2 = K4A_DEPTH_MODE_NFOV_UNBINNED
  kinectAzure.configureFPS(30);

  kinectAzure.startCameras();
}

function reInitKinectAzure() {
  kinectOpen = true;

  //Configure device
  kinectAzure.configureDepthMode(1); // 2 = K4A_DEPTH_MODE_NFOV_UNBINNED
  kinectAzure.configureFPS(30);

  kinectAzure.startCameras();
}

function getIpAddress() {
  var ifaces = os.networkInterfaces();
  var ipAddresses = [];

  Object.keys(ifaces).forEach(function(ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function(iface) {
      if ("IPv4" !== iface.family || iface.internal !== false) {
        // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
        return;
      }

      if (alias >= 1) {
        // this single interface has multiple ipv4 addresses
        ipAddresses.push(iface.address);
      } else {
        // this interface has only one ipv4 adress
        ipAddresses.push(iface.address);
      }
      ++alias;
    });
  });

  return ipAddresses;
}

function initpeer() {
  peer = new Peer(myPeerId, peerNet);
  peer.on("error", function(err) {
    console.log(err);
  });

  peer.on("open", function(id) {
    myPeerId = id;
    peerIdDisplay.innerHTML = myPeerId;
    document.getElementById("port").innerHTML = peer.options.port;
    document.getElementById("newipaddress").innerHTML = peer.options.host;
  });

  peer.on("connection", function(conn) {
    connection = conn;
    console.log("Got a new data connection from peer: " + connection.peer);
    peer_connections.push(connection);

    connection.on("open", function() {
      console.log("Connection opened.");
      sendToPeer("ready", {});
    });

    connection.on("data", function(dataReceived) {
      if (blockAPI == true) return;

      switch (dataReceived.event) {
        case "initfeed":
          if (dataReceived.data.feed) {
            chooseCamera(null, dataReceived.data.feed);
          }
          break;

        case "feed":
          chooseCamera(null, dataReceived.data.feed);
          break;
      }
    });
  });

  peer.on("close", function() {
    console.log("Peer connection closed");

    // Only create new peer if old peer destroyed and new peer requested
    if (newPeerEntry) {
      peer = null;
      initpeer();
      newPeerEntry = false;
    }
  });
}

function newPeerServer(evt) {
  console.log("Creating new peer server");
  newPeerEntry = true;
  evt.preventDefault();
  myPeerId = document.getElementById("newpeerid").value;
  var peerNetTemp = document.getElementById("peernet").value;
  peerNet = JSON.parse(peerNetTemp);

  // Distroy default peer before creating new one
  peer.disconnect();
  peer.destroy();

  // Show new peer credentials. Hide default ip address
  document.getElementById("connectionopen").style.display = "none";
  document.getElementById("newpeercreated").style.display = "block";
}

function sendToPeer(evt, data) {
  var dataToSend = { event: evt, data: data };
  peer_connections.forEach(function(connection) {
    connection.send(dataToSend);
  });
}

////////////////////////////////////////////////////////////////////////
//////////////////////////// Feed Choice //////////////////////////////

function chooseCamera(evt, feed) {
  var camera;

  if (evt) {
    evt.preventDefault();
    camera = evt.srcElement.id;
  } else {
    camera = feed;
  }

  if (currentCamera == camera) {
    return;
  } else if (camera == "stop-all") {
    if (currentCamera) {
      changeCameraState(currentCamera, "stop");
      toggleButtonState(currentCamera, "inactive");
      toggleFeedDiv(currentCamera, "none");

      currentCamera = null;
      return;
    } else {
      return;
    }
  } else {
    if (currentCamera) {
      changeCameraState(currentCamera, "stop");
      toggleButtonState(currentCamera, "inactive");
      toggleFeedDiv(currentCamera, "none");
    }
    changeCameraState(camera, "start");
    toggleButtonState(camera, "active");
    toggleFeedDiv(camera, "block");

    currentCamera = camera;
  }
}

function toggleButtonState(buttonId, state) {
  var button = document.getElementById(buttonId);

  if (state == "active") {
    button.style.background = "#1daad8";
  } else if (state == "inactive") {
    button.style.background = "#fff";
  }
}

function toggleFeedDiv(camera, state) {
  var divsToShow = [];
  divsToShow.push(camera);

  for (var j = 0; j < divsToShow.length; j++) {
    var divId = divsToShow[j] + "-div";
    var feedDiv = document.getElementById(divId);

    feedDiv.style.display = state;
  }
}

function changeCameraState(camera, state) {
  var cameraCode;
  var changeStateFunction;

  switch (camera) {
    case "depth":
      cameraCode = "Depth";
      break;

    case "raw-depth":
      cameraCode = "RawDepth";
      break;
  }

  changeStateFunction = window[state + cameraCode];
  changeStateFunction();
}

////////////////////////////////////////////////////////////////////////
//////////////////////////// Kinect Frames ////////////////////////////

function startDepth() {
  console.log("start depth camera");
  if (!kinectOpen) reInitKinectAzure();

  resetCanvas("depth");
  canvasState = "depth";
  setImageData();

  // global interval variable
  depthInterval = setInterval(function() {
    if (busy) {
      console.log("busy returning");
      return;
    }

    busy = true;

    let depthCanvas = document.getElementById("depth-canvas");
    let depthContext = depthCanvas.getContext("2d");

    kinectAzure.getFrame();
    let depthData = kinectAzure.getDepthData();
    processDepthBuffer(depthData);
    drawImageToCanvas(depthCanvas, depthContext, "depth", "webp", 1);
    // drawDepthData(depthData)

    kinectAzure.releaseImageAndCamera();

    busy = false;
  }, 1000 / 10); // 10fps
}

function stopDepth() {
  console.log("stopping depth camera");

  clearInterval(depthInterval);

  kinectAzure.releaseImageAndCamera();
  kinectAzure.stopCameras();
  kinectOpen = false;

  canvasState = null;
  busy = false;
}

function startRawDepth() {
  console.log("start Raw Depth Camera");
  if (!kinectOpen) reInitKinectAzure();

  resetCanvas("raw");
  canvasState = "raw";
  setImageData();

  rawDepth = true;

  // global interval variable
  rawDepthInterval = setInterval(function() {
    if (busy) {
      console.log("busy returning");
      return;
    }

    busy = true;

    var rawDepthCanvas = document.getElementById("raw-depth-canvas");
    var rawDepthContext = rawDepthCanvas.getContext("2d");

    kinectAzure.getFrame();
    let depthData = kinectAzure.getDepthData();
    // processRawDepthBuffer(depthData);
    // drawImageToCanvas(depthCanvas, depthContext, "depth", "webp", 1);

    processRawDepthBuffer(depthData);
    var rawDepthImg = drawImageToCanvas(
      rawDepthCanvas,
      rawDepthContext,
      "rawDepth",
      "webp",
      1
    );

    sendToPeer("rawDepth", rawDepthImg);

    kinectAzure.releaseImageAndCamera();

    busy = false;
  }, 1000 / 8); // 10fps
}

function stopRawDepth() {
  console.log("stopping raw depth camera");

  clearInterval(rawDepthInterval);

  kinectAzure.releaseImageAndCamera();
  kinectAzure.stopCameras();
  kinectOpen = false;

  canvasState = null;
  rawDepth = false;
  busy = false;
}

function setImageData() {
  imageData = context.createImageData(canvas.width, canvas.height);
  imageDataSize = imageData.data.length;
  imageDataArray = imageData.data;
}

function resetCanvas(size) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  //outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

  switch (size) {
    case "depth":
      canvas.width = DEPTHWIDTH;
      canvas.height = DEPTHHEIGHT;
      //outputCanvas.width = outputDepthW;
      //outputCanvas.height = outputDepthH;
      break;

    case "raw":
      canvas.width = RAWWIDTH;
      canvas.height = RAWHEIGHT;
      //outputCanvas.width = OUTPUTRAWW;
      //outputCanvas.height = OUTPUTRAWH;
      break;
  }
}

function drawImageToCanvas(inCanvas, inContext, frameType, imageType, quality) {
  var outputCanvasData;
  var imageQuality = imgQuality; //use globally stored image quality variable
  var dataToSend;

  if (typeof quality !== "undefined") imageQuality = quality; // or replace image quality with stream default

  context.putImageData(imageData, 0, 0);
  inContext.clearRect(0, 0, inCanvas.width, inCanvas.height);
  inContext.drawImage(canvas, 0, 0, inCanvas.width, inCanvas.height);
  outputCanvasData = inCanvas.toDataURL("image/" + imageType, imageQuality);

  if (rawDepth) {
    return outputCanvasData;
  } else {
    packageData(frameType, outputCanvasData);
  }
}

function packageData(frameType, outputCanvasData) {
  dataToSend = { name: frameType, imagedata: outputCanvasData };
  sendToPeer("frame", dataToSend);
}

function processDepthBuffer(newPixelData) {
  // console.log(imageDataSize);
  let j = 0;

  for (let i = 0; i < imageDataSize; i += 4) {
    // map depth (0-5460mm) to grayscale (0-255) for NFOV binned (sw);
    // map depth (0-3860mm) to grayscale (0-255) for NFOV unbinned
    let newPixel = (newPixelData[j] * 255) / 3860;

    imageDataArray[i] = newPixel;
    imageDataArray[i + 1] = newPixel;
    imageDataArray[i + 2] = newPixel;
    imageDataArray[i + 3] = 0xff; // set alpha channel at full opacity
    j++;
  }
}

function processRawDepthBuffer(newPixelData) {
  var j = 0;
  for (var i = 0; i < imageDataSize; i += 4) {
    imageDataArray[i] = parseInt(newPixelData[j] / 255);
    imageDataArray[i + 1] = newPixelData[j] % 255;
    imageDataArray[i + 2] = 0;
    imageDataArray[i + 3] = 0xff;
    j++;
  }
}
