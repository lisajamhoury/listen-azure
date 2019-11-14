let kinectron = null;

// Set depth width and height same Kinect
let DEPTHWIDTH = 320;
let DEPTHHEIGHT = 288;

let depthBuffer;
let renderer, camera, scene, controls;
// let composer;

let particles = new THREE.Geometry();
let colors = [];
let numParticles = DEPTHWIDTH * DEPTHHEIGHT;

let animFrame = null;
let busy = false;

let bgOptions = [0xe80c7a, 0xffffff, 0x00889c, 0x000000, 0x9c1759, 0xecd523];
let bgCtr = 0;
let changeBG = false;

let nDepthMinReliableDistance;
let nDepthMaxDistance;

// Wait for page to load to create webgl canvas and Kinectron connection
window.addEventListener("load", function() {
  // Create point cloud
  initPointCloud();

  // Define and create an instance of kinectron
  let kinectronIpAddress = "127.0.0.1"; // FILL IN YOUR KINECTRON IP ADDRESS HERE
  kinectron = new Kinectron(kinectronIpAddress);

  // Connect to the microstudio
  //kinectron = new Kinectron("kinectron.itp.tsoa.nyu.edu");

  // Connect remote to application
  kinectron.makeConnection();
  kinectron.startRawDepth(rdCallback);
});

// Run this callback each time Kinect data is received
function rdCallback(dataReceived) {
  depthBuffer = dataReceived;

  // Update point cloud based on incoming Kinect data
  pointCloud(depthBuffer);
}

window.addEventListener("keydown", e => {
  if (e.keyCode === 66) {
    if (bgCtr < bgOptions.length) {
      bgCtr++;
    } else {
      bgCtr = 0;
    }
    changeBG = true;
  }
});

function initPointCloud() {
  // Create three.js renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("cloudCanvas"),
    alpha: 0,
    antialias: true,
    clearColor: 0x000000
  });

  // Create three.js camera and controls
  camera = new THREE.PerspectiveCamera(
    30,
    renderer.domElement.width / renderer.domElement.height,
    1,
    10000
  );
  camera.position.set(0, 0, 9200);
  controls = new THREE.TrackballControls(camera, renderer.domElement);

  // Create three.js scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe80c7a);

  createParticles();

  // let gui = new dat.GUI();
  // gui.add( material.uniforms.nearClipping, 'value', 1, 10000, 1.0 ).name( 'nearClipping' );
  // gui.add( material.uniforms.farClipping, 'value', 1, 10000, 1.0 ).name( 'farClipping' );
  // gui.add( material.uniforms.pointSize, 'value', 1, 10, 1.0 ).name( 'pointSize' );
  // gui.add( material.uniforms.zOffset, 'value', 0, 4000, 1.0 ).name( 'zOffset' );
  // gui.close();

  // postprocessing

  // let renderModel = new THREE.RenderPass(scene, camera);
  // let effectBloom = new THREE.BloomPass(0.0);
  // let effectFilm = new THREE.FilmPass(0.5, 0.5, 1448, false);

  // effectFocus = new THREE.ShaderPass(THREE.FocusShader);

  // effectFocus.uniforms["screenWidth"].value =
  //   window.innerWidth * window.devicePixelRatio;
  // effectFocus.uniforms["screenHeight"].value =
  //   window.innerHeight * window.devicePixelRatio;

  // composer = new THREE.EffectComposer(renderer);

  // // composer.addPass(renderModel);
  // composer.addPass(effectBloom);
  // // composer.addPass(effectFilm);
  // // composer.addPass(effectFocus);

  window.addEventListener("resize", onWindowResize, false);
  onWindowResize();
  render();
}

function keyDown() {
  console.log("down", e);
}

function createParticles() {
  // Create particles
  for (let i = 0; i < numParticles; i++) {
    let x = (i % DEPTHWIDTH) - DEPTHWIDTH * 0.5;
    let y = DEPTHHEIGHT - Math.floor(i / DEPTHWIDTH) - 200;
    let vertex = new THREE.Vector3(x, y, Math.random());
    particles.vertices.push(vertex);

    // Assign each particle a color -- rainbow
    let color = (i / numParticles) * 360;
    colors[i] = new THREE.Color("hsl(" + color + ", 50%, 50%)");

    // Assign each particle a color -- white
    // colors[i] = new THREE.Color(0xffffff);

    // //let color = i/numParticles;
    // let color = Math.floor(i/numParticles*100);
    // let color2 = 100-color;
    // colors[i] = new THREE.Color("rgb(" + color2 + "%," + color2 + "%, " + color + "%)");
  }

  // Add point cloud to scene
  particles.colors = colors;
  let material = new THREE.PointsMaterial({
    size: 4,
    vertexColors: THREE.VertexColors,
    transparent: true
  });
  mesh = new THREE.Points(particles, material);
  scene.add(mesh);
}

function pointCloud(depthBuffer) {
  if (busy) {
    return;
  }

  busy = true;

  // Set desired depth resolution
  nDepthMinReliableDistance = 0;
  nDepthMaxDistance = 3000;
  let j = 0;

  // Match depth buffer info to each particle
  for (let i = 0; i < depthBuffer.length; i++) {
    let depth = depthBuffer[i];
    if (depth <= nDepthMinReliableDistance || depth >= nDepthMaxDistance)
      depth = Number.MAX_VALUE; //push particles far far away so we don't see them
    particles.vertices[j].z = nDepthMaxDistance - depth - 2000;
    j++;
  }

  // Update particles
  particles.verticesNeedUpdate = true;
  busy = false;
}

// Resize scene based on window size
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // composer.setSize(window.innerWidth, window.innerHeight);
}

// Render three.js scene
function render() {
  renderer.render(scene, camera);
  controls.update();
  // composer.render(0.01);

  if (changeBG) {
    let newClr = bgOptions[bgCtr];
    scene.background = new THREE.Color(newClr);
    changeBG = false;
  }

  animFrame = requestAnimationFrame(render);
}
