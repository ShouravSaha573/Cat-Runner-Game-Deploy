/*
  RunningCat
  Direct browser/WebGL port of project_codes.py.
  The names, constants, object sizes, colors, camera, controls, update timing,
  spawn logic, collision logic, scoring, and text coordinates are kept from the Python file.
*/

// Camera-related variables
let camera_pos = [0, -620, 300];

const fovY = 90;
const window_w = 1000;
const window_h = 800;

// Road-related variables
const GRID_LENGTH = 600;
const road_width = 430;
const road_front = 620;
const road_back = -520;
const road_piece = 160;
let road_move = 0;

// Player-related variables
const lane_x = [-120, 0, 120];
let cat_lane = 1;
const cat_y = -170;
let cat_z = 0.0;

let is_jumping = false;
let jump_speed = 0.0;

let is_sliding = false;
let slide_time = 0;

// Game-related variables
let game_started = false;
let game_over = false;
let score = 0;
let milk_count = 0;
let game_speed = 20;
let difficulty_time = 0;
let last_update_time = performance.now() / 1000;

// Object-related variables
let running_objects = [];
let spawn_time = 120;
let spawn_gap = 160;

const canvas = document.getElementById("game-canvas");
const textCanvas = document.getElementById("text-canvas");
const textCtx = textCanvas.getContext("2d");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.setSize(window_w, window_h, false);
renderer.sortObjects = false;
renderer.setClearColor(0x000000, 1);
renderer.autoClear = true;
renderer.shadowMap.enabled = false;

// Original PyOpenGL code does not enable GL_DEPTH_TEST or lighting.
// These flags make the browser renderer preserve the same flat-color, draw-order-based look.
let drawOrderCounter = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(fovY, 1.25, 0.1, 1600);
camera.up.set(0, 0, 1);

const world = new THREE.Group();
scene.add(world);

const materialCache = new Map();
const boxGeometryCache = new Map();
const sphereGeometryCache = new Map();
const cylinderGeometryCache = new Map();

function colorKey(r, g, b) {
  return `${r},${g},${b}`;
}

function getMaterial(r, g, b, doubleSide = false) {
  const key = `${colorKey(r, g, b)}:opengl-flat-no-depth`;
  if (!materialCache.has(key)) {
    materialCache.set(
      key,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(r, g, b),
        side: THREE.DoubleSide,   // OpenGL face culling is not enabled in the Python file.
        depthTest: false,         // GL_DEPTH_TEST is not enabled in the Python file.
        depthWrite: false,
        toneMapped: false,
      })
    );
  }
  return materialCache.get(key);
}

function getBoxGeometry(sx, sy, sz) {
  const key = `${sx},${sy},${sz}`;
  if (!boxGeometryCache.has(key)) {
    boxGeometryCache.set(key, new THREE.BoxGeometry(sx, sy, sz));
  }
  return boxGeometryCache.get(key);
}

function getSphereGeometry(radius) {
  const key = `${radius}`;
  if (!sphereGeometryCache.has(key)) {
    sphereGeometryCache.set(key, new THREE.SphereGeometry(radius, 10, 10));
  }
  return sphereGeometryCache.get(key);
}

function getCylinderGeometry(radius1, radius2, height) {
  const key = `${radius1},${radius2},${height}`;
  if (!cylinderGeometryCache.has(key)) {
    // THREE cylinder: radiusTop, radiusBottom, height. PyOpenGL gluCylinder: base radius, top radius, height.
    cylinderGeometryCache.set(key, new THREE.CylinderGeometry(radius2, radius1, height, 10, 10, true));
  }
  return cylinderGeometryCache.get(key);
}

function clearWorld() {
  while (world.children.length) {
    world.remove(world.children[world.children.length - 1]);
  }
}

function draw_text(x, y, text) {
  // PyOpenGL draw_text used gluOrtho2D(0, window_w, 0, window_h), so y is bottom-based.
  textCtx.fillStyle = "rgb(255,255,255)";
  textCtx.font = "18px Helvetica, Arial, sans-serif";
  textCtx.textBaseline = "alphabetic";
  textCtx.fillText(text, x, window_h - y);
}

function draw_box(x, y, z, sx, sy, sz, r, g, b) {
  const mesh = new THREE.Mesh(getBoxGeometry(sx, sy, sz), getMaterial(r, g, b));
  mesh.renderOrder = drawOrderCounter++;
  mesh.position.set(x, y, z);
  world.add(mesh);
}

function draw_sphere(x, y, z, radius, r, g, b) {
  const mesh = new THREE.Mesh(getSphereGeometry(radius), getMaterial(r, g, b));
  mesh.renderOrder = drawOrderCounter++;
  mesh.position.set(x, y, z);
  world.add(mesh);
}

function axisAngleRotateVector(vector, angleDegrees, ax, ay, az) {
  const angle = THREE.MathUtils.degToRad(angleDegrees);
  const axis = new THREE.Vector3(ax, ay, az);
  if (axis.lengthSq() === 0) return vector.clone();
  axis.normalize();
  return vector.clone().applyAxisAngle(axis, angle);
}

function draw_cylinder(x, y, z, radius1, radius2, height, r, g, b, rot_angle = 0, ax = 0, ay = 0, az = 1) {
  // PyOpenGL gluCylinder draws along +Z from the translated base point.
  // THREE CylinderGeometry draws along local +Y, centered. This converts +Y to the same final +Z axis.
  let finalAxis = new THREE.Vector3(0, 0, 1);
  if (rot_angle !== 0) {
    finalAxis = axisAngleRotateVector(finalAxis, rot_angle, ax, ay, az);
  }
  finalAxis.normalize();

  const mesh = new THREE.Mesh(getCylinderGeometry(radius1, radius2, height), getMaterial(r, g, b));
  mesh.renderOrder = drawOrderCounter++;
  const base = new THREE.Vector3(x, y, z);
  mesh.position.copy(base.add(finalAxis.clone().multiplyScalar(height / 2)));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), finalAxis);
  world.add(mesh);
}

function draw_quad(x1, y1, x2, y2, z, r, g, b) {
  const width = x2 - x1;
  const height = y2 - y1;
  const geometry = new THREE.PlaneGeometry(Math.abs(width), Math.abs(height));
  const mesh = new THREE.Mesh(geometry, getMaterial(r, g, b, true));
  mesh.renderOrder = drawOrderCounter++;
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  world.add(mesh);
}

function reset_game() {
  cat_lane = 1;
  cat_z = 0.0;

  is_jumping = false;
  jump_speed = 0.0;

  is_sliding = false;
  slide_time = 0;

  game_started = true;
  game_over = false;

  score = 0;
  milk_count = 0;

  game_speed = 20;
  difficulty_time = 0;
  last_update_time = performance.now() / 1000;
  road_move = 0;

  running_objects = [];
  spawn_time = 120;
  spawn_gap = 160;
}

function draw_road() {
  const start_y = road_back - road_piece;
  const shift = road_move % road_piece;
  let y = start_y - shift;
  let count = 0;

  draw_quad(-700, road_back, -road_width / 2, road_front, -2, 0.10, 0.45, 0.15);
  draw_quad(road_width / 2, road_back, 700, road_front, -2, 0.10, 0.45, 0.15);

  while (y < road_front + road_piece) {
    if (count % 2 === 0) {
      draw_quad(-road_width / 2, y, road_width / 2, y + road_piece, 0, 0.17, 0.17, 0.17);
    } else {
      draw_quad(-road_width / 2, y, road_width / 2, y + road_piece, 0, 0.23, 0.23, 0.23);
    }

    draw_quad(-60, y + 30, -50, y + 90, 2, 1, 1, 1);
    draw_quad(50, y + 30, 60, y + 90, 2, 1, 1, 1);

    y += road_piece;
    count += 1;
  }

  draw_box(-road_width / 2 - 15, 50, 20, 20, 1100, 40, 0.2, 0.2, 0.8);
  draw_box(road_width / 2 + 15, 50, 20, 20, 1100, 40, 0.2, 0.2, 0.8);
}

function draw_environment() {
  let tree_y = -420;

  while (tree_y <= 620) {
    draw_cylinder(-340, tree_y, 0, 9, 7, 55, 0.40, 0.22, 0.08);
    draw_sphere(-340, tree_y, 70, 35, 0.0, 0.55, 0.12);

    draw_cylinder(340, tree_y + 70, 0, 9, 7, 55, 0.40, 0.22, 0.08);
    draw_sphere(340, tree_y + 70, 70, 35, 0.0, 0.55, 0.12);

    tree_y += 180;
  }

  draw_box(-520, 120, 35, 80, 90, 70, 0.65, 0.35, 0.25);
  draw_box(520, 260, 35, 80, 90, 70, 0.50, 0.30, 0.65);
  draw_box(-520, 115, 90, 95, 100, 25, 0.35, 0.10, 0.10);
  draw_box(520, 255, 90, 95, 100, 25, 0.35, 0.10, 0.10);
}

function draw_cat() {
  const x = lane_x[cat_lane];
  const z = cat_z;

  let body_z;
  let body_sx;
  let body_sy;
  let body_sz;
  let head_z;
  let head_y;

  if (is_sliding) {
    body_z = z + 18;
    body_sx = 58;
    body_sy = 32;
    body_sz = 22;
    head_z = z + 22;
    head_y = cat_y + 35;
  } else {
    body_z = z + 35;
    body_sx = 48;
    body_sy = 32;
    body_sz = 35;
    head_z = z + 62;
    head_y = cat_y + 12;
  }

  draw_box(x, cat_y, body_z, body_sx, body_sy, body_sz, 0.95, 0.55, 0.15);
  draw_sphere(x, head_y, head_z, 20, 0.95, 0.55, 0.15);

  draw_box(x - 12, head_y, head_z + 18, 10, 8, 15, 0.95, 0.45, 0.10);
  draw_box(x + 12, head_y, head_z + 18, 10, 8, 15, 0.95, 0.45, 0.10);

  draw_sphere(x - 7, head_y - 17, head_z + 3, 3, 0, 0, 0);
  draw_sphere(x + 7, head_y - 17, head_z + 3, 3, 0, 0, 0);
  draw_sphere(x, head_y - 20, head_z - 5, 3, 0.9, 0.25, 0.25);

  if (!is_sliding) {
    draw_box(x - 16, cat_y - 8, z + 12, 9, 12, 24, 0.85, 0.40, 0.10);
    draw_box(x + 16, cat_y - 8, z + 12, 9, 12, 24, 0.85, 0.40, 0.10);
    draw_box(x - 16, cat_y + 14, z + 12, 9, 12, 24, 0.85, 0.40, 0.10);
    draw_box(x + 16, cat_y + 14, z + 12, 9, 12, 24, 0.85, 0.40, 0.10);
  }

  draw_cylinder(x, cat_y + 25, z + 35, 5, 3, 45, 0.95, 0.55, 0.15, 65, 1, 0, 0);
}

function draw_milk(obj) {
  const x = lane_x[obj.lane];
  const y = obj.y;

  draw_cylinder(x, y, 10, 14, 11, 38, 0.75, 0.90, 1.0);
  draw_sphere(x, y, 52, 13, 1, 1, 1);
  draw_box(x, y, 8, 30, 30, 6, 1, 1, 1);
}

function draw_low_obstacle(obj) {
  const x = lane_x[obj.lane];
  const y = obj.y;

  draw_box(x, y, 25, 70, 45, 50, 0.55, 0.25, 0.08);
  draw_box(x, y, 55, 76, 50, 8, 0.40, 0.18, 0.05);
}

function draw_high_obstacle(obj) {
  const x = lane_x[obj.lane];
  const y = obj.y;

  draw_box(x, y, 95, 92, 20, 18, 0.65, 0.65, 0.65);
  draw_box(x - 40, y, 50, 12, 18, 80, 0.35, 0.35, 0.35);
  draw_box(x + 40, y, 50, 12, 18, 80, 0.35, 0.35, 0.35);
}

function draw_human(obj) {
  const x = lane_x[obj.lane];
  const y = obj.y;

  draw_box(x, y, 45, 32, 22, 60, 0.10, 0.25, 0.75);
  draw_sphere(x, y, 88, 17, 0.95, 0.78, 0.55);

  draw_box(x - 10, y, 15, 9, 12, 30, 0.05, 0.05, 0.08);
  draw_box(x + 10, y, 15, 9, 12, 30, 0.05, 0.05, 0.08);

  draw_box(x - 25, y, 48, 10, 12, 40, 0.95, 0.78, 0.55);
  draw_box(x + 25, y, 48, 10, 12, 40, 0.95, 0.78, 0.55);
}

function draw_running_objects() {
  for (const obj of running_objects) {
    if (obj.type === "milk") {
      draw_milk(obj);
    } else if (obj.type === "low") {
      draw_low_obstacle(obj);
    } else if (obj.type === "high") {
      draw_high_obstacle(obj);
    } else if (obj.type === "human") {
      draw_human(obj);
    }
  }
}

function draw_shapes() {
  draw_road();
  draw_environment();
  draw_running_objects();
  draw_cat();
}

function randintInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function create_object() {
  const lane = randintInclusive(0, 2);
  const number = randintInclusive(1, 100);

  let obj_type;
  if (number <= 40) {
    obj_type = "milk";
  } else if (number <= 62) {
    obj_type = "low";
  } else if (number <= 82) {
    obj_type = "high";
  } else {
    obj_type = "human";
  }

  return { type: obj_type, lane: lane, y: road_front + 80 };
}

function check_object_collision(obj) {
  if (obj.lane !== cat_lane) {
    return false;
  }

  const front_gap = obj.y - cat_y;

  if (front_gap < -35 || front_gap > 45) {
    return false;
  }

  if (obj.type === "milk") {
    return true;
  }

  if (obj.type === "low") {
    if (cat_z > 45) {
      return false;
    }
    return true;
  }

  if (obj.type === "high") {
    if (is_sliding) {
      return false;
    }
    return true;
  }

  if (obj.type === "human") {
    return true;
  }

  return false;
}

function update_player() {
  if (is_jumping) {
    cat_z += jump_speed;
    jump_speed -= 0.75;

    if (cat_z <= 0) {
      cat_z = 0.0;
      is_jumping = false;
      jump_speed = 0.0;
    }
  }

  if (is_sliding) {
    slide_time -= 1;

    if (slide_time <= 0) {
      is_sliding = false;
      slide_time = 0;
    }
  }
}

function update_objects() {
  const new_list = [];

  for (const obj of running_objects) {
    obj.y -= game_speed;

    if (check_object_collision(obj)) {
      if (obj.type === "milk") {
        score += 10;
        milk_count += 1;
        continue;
      } else {
        game_over = true;
        continue;
      }
    }

    if (obj.y > road_back - 140) {
      new_list.push(obj);
    }
  }

  running_objects = new_list;

  spawn_time -= 1;

  if (spawn_time <= 0) {
    running_objects.push(create_object());
    spawn_time = spawn_gap;
  }
}

function update_difficulty() {
  difficulty_time += 1;
  road_move += game_speed;

  if (difficulty_time % 900 === 0) {
    game_speed += 0.08;

    if (spawn_gap > 105) {
      spawn_gap -= 2;
    }
  }
}

function keyboardListener(key) {
  if (key === " ") {
    if (!game_started) {
      reset_game();
    }
    return;
  }

  if (key === "r" || key === "R") {
    if (game_over) {
      reset_game();
    }
    return;
  }

  if (!game_started || game_over) {
    return;
  }

  if (key === "a" || key === "A") {
    if (cat_lane > 0) {
      cat_lane -= 1;
    }
  }

  if (key === "d" || key === "D") {
    if (cat_lane < 2) {
      cat_lane += 1;
    }
  }

  if (key === "w" || key === "W") {
    if (!is_jumping && !is_sliding) {
      is_jumping = true;
      jump_speed = 13.0;
    }
  }

  if (key === "s" || key === "S") {
    if (!is_jumping && !is_sliding) {
      is_sliding = true;
      slide_time = 38;
    }
  }
}

function specialKeyListener(code) {
  if (!game_started || game_over) {
    return;
  }

  if (code === "ArrowLeft") {
    if (cat_lane > 0) {
      cat_lane -= 1;
    }
  }

  if (code === "ArrowRight") {
    if (cat_lane < 2) {
      cat_lane += 1;
    }
  }
}

function mouseListener(button, state, x, y) {
  // Original Python function is pass.
}

function setupCamera() {
  const cat_x = lane_x[cat_lane];

  const eye_x = cat_x;
  const eye_y = cat_y - 440;
  const eye_z = 260;

  const look_x = cat_x;
  const look_y = cat_y + 210;
  const look_z = 65;

  camera_pos = [eye_x, eye_y, eye_z];

  camera.position.set(eye_x, eye_y, eye_z);
  camera.lookAt(new THREE.Vector3(look_x, look_y, look_z));
}

function idle() {
  const current_time = performance.now() / 1000;

  if (current_time - last_update_time >= 0.035) {
    last_update_time = current_time;

    if (game_started && !game_over) {
      update_player();
      update_objects();
      update_difficulty();
    }
  }
}

function draw_game_info() {
  textCtx.clearRect(0, 0, window_w, window_h);

  if (!game_started) {
    draw_text(355, 710, "RunningCat");
    draw_text(300, 670, "Press SPACE to Start");
    draw_text(265, 635, "A/D or Left/Right: Change Lane");
    draw_text(300, 605, "W: Jump    S: Slide");
    draw_text(260, 575, "Collect milk. Avoid humans and obstacles.");
    return;
  }

  if (game_over) {
    draw_text(385, 710, "GAME OVER");
    draw_text(360, 670, "Final Score: " + String(score));
    draw_text(360, 635, "Milk Collected: " + String(milk_count));
    draw_text(325, 600, "Press R to Restart");
    return;
  }

  draw_text(20, 760, "Score: " + String(score));
  draw_text(20, 730, "Milk: " + String(milk_count));
  draw_text(20, 700, "Speed: " + String(Math.round(game_speed * 10) / 10));
  draw_text(20, 670, "A/D or Arrow: Lane | W: Jump | S: Slide");
}

function showScreen() {
  drawOrderCounter = 0;
  clearWorld();
  setupCamera();
  draw_shapes();
  draw_game_info();
  renderer.render(scene, camera);
}

function animationLoop() {
  idle();
  showScreen();
  requestAnimationFrame(animationLoop);
}

window.addEventListener("keydown", (event) => {
  if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    specialKeyListener(event.key);
    return;
  }

  keyboardListener(event.key);
});

canvas.addEventListener("mousedown", (event) => {
  mouseListener(event.button, "down", event.offsetX, event.offsetY);
});

animationLoop();
