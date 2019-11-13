let myCanvas = null;

// Declare kinectron
let kinectron = null;

let frameP;

function setup() {
  myCanvas = createCanvas(370, 288);
  background(0);

  frameP = createP("");

  // Define and create an instance of kinectron
  let kinectronIpAddress = "127.0.0.1"; // FILL IN YOUR KINECTRON IP ADDRESS HERE
  kinectron = new Kinectron(kinectronIpAddress);

  // Connect with application over peer
  kinectron.makeConnection();

  // Set callbacks
  kinectron.setDepthCallback(drawFeed);
}

function draw() {
  let fps = frameRate();
  fill(0);
  stroke(0);
  text("FPS: " + fps.toFixed(0), 10, height);
  frameP.html(fps.toFixed(0));
}

// Choose camera to start based on key pressed
function keyPressed() {
  if (keyCode === ENTER) {
    kinectron.startDepth();
  } else if (keyCode === RIGHT_ARROW) {
    kinectron.stopAll();
  }
}

function drawFeed(img) {
  // Draws feed using p5 load and display image functions
  // console.log('recieving');
  loadImage(img.src, function(loadedImage) {
    image(loadedImage, 0, 0);
  });
}
