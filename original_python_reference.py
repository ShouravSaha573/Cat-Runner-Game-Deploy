from OpenGL.GL import *
from OpenGL.GLUT import *
from OpenGL.GLU import *
import random
import time
from OpenGL.GLUT import GLUT_BITMAP_HELVETICA_18

# Camera-related variables
camera_pos = (0, -620, 300)

fovY = 90
window_w = 1000
window_h = 800

# Road-related variables
GRID_LENGTH = 600
road_width = 430
road_front = 620
road_back = -520
road_piece = 160
road_move = 0

# Player-related variables
lane_x = [-120, 0, 120]
cat_lane = 1
cat_y = -170
cat_z = 0.0

is_jumping = False
jump_speed = 0.0

is_sliding = False
slide_time = 0

# Game-related variables
game_started = False
game_over = False
score = 0
milk_count = 0
game_speed = 20
difficulty_time = 0
last_update_time = time.time()

# Object-related variables
running_objects = []
spawn_time = 120
spawn_gap = 160


def draw_text(x, y, text, font= GLUT_BITMAP_HELVETICA_18):
    glColor3f(1, 1, 1)
    glMatrixMode(GL_PROJECTION)
    glPushMatrix()
    glLoadIdentity()

    gluOrtho2D(0, window_w, 0, window_h)

    glMatrixMode(GL_MODELVIEW)
    glPushMatrix()
    glLoadIdentity()

    glRasterPos2f(x, y)
    for ch in text:
        glutBitmapCharacter(font, ord(ch))

    glPopMatrix()
    glMatrixMode(GL_PROJECTION)
    glPopMatrix()
    glMatrixMode(GL_MODELVIEW)


def draw_box(x, y, z, sx, sy, sz, r, g, b):
    glPushMatrix()
    glColor3f(r, g, b)
    glTranslatef(x, y, z)
    glScalef(sx, sy, sz)
    glutSolidCube(1)
    glPopMatrix()


def draw_sphere(x, y, z, radius, r, g, b):
    glPushMatrix()
    glColor3f(r, g, b)
    glTranslatef(x, y, z)
    gluSphere(gluNewQuadric(), radius, 10, 10)
    glPopMatrix()


def draw_cylinder(x, y, z, radius1, radius2, height, r, g, b, rot_angle=0, ax=0, ay=0, az=1):
    glPushMatrix()
    glColor3f(r, g, b)
    glTranslatef(x, y, z)

    if rot_angle != 0:
        glRotatef(rot_angle, ax, ay, az)

    gluCylinder(gluNewQuadric(), radius1, radius2, height, 10, 10)
    glPopMatrix()


def draw_quad(x1, y1, x2, y2, z, r, g, b):
    glColor3f(r, g, b)
    glBegin(GL_QUADS)
    glVertex3f(x1, y1, z)
    glVertex3f(x2, y1, z)
    glVertex3f(x2, y2, z)
    glVertex3f(x1, y2, z)
    glEnd()


def reset_game():
    global cat_lane, cat_z
    global is_jumping, jump_speed
    global is_sliding, slide_time
    global game_started, game_over
    global score, milk_count
    global game_speed, difficulty_time, last_update_time
    global road_move, running_objects
    global spawn_time, spawn_gap

    cat_lane = 1
    cat_z = 0.0

    is_jumping = False
    jump_speed = 0.0

    is_sliding = False
    slide_time = 0

    game_started = True
    game_over = False

    score = 0
    milk_count = 0

    game_speed = 20
    difficulty_time = 0
    last_update_time = time.time()
    road_move = 0

    running_objects = []
    spawn_time = 120
    spawn_gap = 160


def draw_road():
    start_y = road_back - road_piece
    shift = road_move % road_piece
    y = start_y - shift
    count = 0

    draw_quad(-700, road_back, -road_width / 2, road_front, -2, 0.10, 0.45, 0.15)
    draw_quad(road_width / 2, road_back, 700, road_front, -2, 0.10, 0.45, 0.15)

    while y < road_front + road_piece:
        if count % 2 == 0:
            draw_quad(-road_width / 2, y, road_width / 2, y + road_piece, 0, 0.17, 0.17, 0.17)
        else:
            draw_quad(-road_width / 2, y, road_width / 2, y + road_piece, 0, 0.23, 0.23, 0.23)

        draw_quad(-60, y + 30, -50, y + 90, 2, 1, 1, 1)
        draw_quad(50, y + 30, 60, y + 90, 2, 1, 1, 1)

        y += road_piece
        count += 1

    draw_box(-road_width / 2 - 15, 50, 20, 20, 1100, 40, 0.2, 0.2, 0.8)
    draw_box(road_width / 2 + 15, 50, 20, 20, 1100, 40, 0.2, 0.2, 0.8)


def draw_environment():
    tree_y = -420

    while tree_y <= 620:
        draw_cylinder(-340, tree_y, 0, 9, 7, 55, 0.40, 0.22, 0.08)
        draw_sphere(-340, tree_y, 70, 35, 0.0, 0.55, 0.12)

        draw_cylinder(340, tree_y + 70, 0, 9, 7, 55, 0.40, 0.22, 0.08)
        draw_sphere(340, tree_y + 70, 70, 35, 0.0, 0.55, 0.12)

        tree_y += 180

    draw_box(-520, 120, 35, 80, 90, 70, 0.65, 0.35, 0.25)
    draw_box(520, 260, 35, 80, 90, 70, 0.50, 0.30, 0.65)
    draw_box(-520, 115, 90, 95, 100, 25, 0.35, 0.10, 0.10)
    draw_box(520, 255, 90, 95, 100, 25, 0.35, 0.10, 0.10)


def draw_cat():
    x = lane_x[cat_lane]
    z = cat_z

    if is_sliding:
        body_z = z + 18
        body_sx = 58
        body_sy = 32
        body_sz = 22
        head_z = z + 22
        head_y = cat_y + 35
    else:
        body_z = z + 35
        body_sx = 48
        body_sy = 32
        body_sz = 35
        head_z = z + 62
        head_y = cat_y + 12

    draw_box(x, cat_y, body_z, body_sx, body_sy, body_sz, 0.95, 0.55, 0.15)
    draw_sphere(x, head_y, head_z, 20, 0.95, 0.55, 0.15)

    draw_box(x - 12, head_y, head_z + 18, 10, 8, 15, 0.95, 0.45, 0.10)
    draw_box(x + 12, head_y, head_z + 18, 10, 8, 15, 0.95, 0.45, 0.10)

    draw_sphere(x - 7, head_y - 17, head_z + 3, 3, 0, 0, 0)
    draw_sphere(x + 7, head_y - 17, head_z + 3, 3, 0, 0, 0)
    draw_sphere(x, head_y - 20, head_z - 5, 3, 0.9, 0.25, 0.25)

    if not is_sliding:
        draw_box(x - 16, cat_y - 8, z + 12, 9, 12, 24, 0.85, 0.40, 0.10)
        draw_box(x + 16, cat_y - 8, z + 12, 9, 12, 24, 0.85, 0.40, 0.10)
        draw_box(x - 16, cat_y + 14, z + 12, 9, 12, 24, 0.85, 0.40, 0.10)
        draw_box(x + 16, cat_y + 14, z + 12, 9, 12, 24, 0.85, 0.40, 0.10)

    draw_cylinder(x, cat_y + 25, z + 35, 5, 3, 45, 0.95, 0.55, 0.15, 65, 1, 0, 0)


def draw_milk(obj):
    x = lane_x[obj["lane"]]
    y = obj["y"]

    draw_cylinder(x, y, 10, 14, 11, 38, 0.75, 0.90, 1.0)
    draw_sphere(x, y, 52, 13, 1, 1, 1)
    draw_box(x, y, 8, 30, 30, 6, 1, 1, 1)


def draw_low_obstacle(obj):
    x = lane_x[obj["lane"]]
    y = obj["y"]

    draw_box(x, y, 25, 70, 45, 50, 0.55, 0.25, 0.08)
    draw_box(x, y, 55, 76, 50, 8, 0.40, 0.18, 0.05)


def draw_high_obstacle(obj):
    x = lane_x[obj["lane"]]
    y = obj["y"]

    draw_box(x, y, 95, 92, 20, 18, 0.65, 0.65, 0.65)
    draw_box(x - 40, y, 50, 12, 18, 80, 0.35, 0.35, 0.35)
    draw_box(x + 40, y, 50, 12, 18, 80, 0.35, 0.35, 0.35)


def draw_human(obj):
    x = lane_x[obj["lane"]]
    y = obj["y"]

    draw_box(x, y, 45, 32, 22, 60, 0.10, 0.25, 0.75)
    draw_sphere(x, y, 88, 17, 0.95, 0.78, 0.55)

    draw_box(x - 10, y, 15, 9, 12, 30, 0.05, 0.05, 0.08)
    draw_box(x + 10, y, 15, 9, 12, 30, 0.05, 0.05, 0.08)

    draw_box(x - 25, y, 48, 10, 12, 40, 0.95, 0.78, 0.55)
    draw_box(x + 25, y, 48, 10, 12, 40, 0.95, 0.78, 0.55)


def draw_running_objects():
    for obj in running_objects:
        if obj["type"] == "milk":
            draw_milk(obj)
        elif obj["type"] == "low":
            draw_low_obstacle(obj)
        elif obj["type"] == "high":
            draw_high_obstacle(obj)
        elif obj["type"] == "human":
            draw_human(obj)


def draw_shapes():
    draw_road()
    draw_environment()
    draw_running_objects()
    draw_cat()


def create_object():
    lane = random.randint(0, 2)
    number = random.randint(1, 100)

    if number <= 40:
        obj_type = "milk"
    elif number <= 62:
        obj_type = "low"
    elif number <= 82:
        obj_type = "high"
    else:
        obj_type = "human"

    return {"type": obj_type, "lane": lane, "y": road_front + 80}


def check_object_collision(obj):
    if obj["lane"] != cat_lane:
        return False

    front_gap = obj["y"] - cat_y

    if front_gap < -35 or front_gap > 45:
        return False

    if obj["type"] == "milk":
        return True

    if obj["type"] == "low":
        if cat_z > 45:
            return False
        return True

    if obj["type"] == "high":
        if is_sliding:
            return False
        return True

    if obj["type"] == "human":
        return True

    return False


def update_player():
    global cat_z
    global is_jumping, jump_speed
    global is_sliding, slide_time

    if is_jumping:
        cat_z += jump_speed
        jump_speed -= 0.75

        if cat_z <= 0:
            cat_z = 0.0
            is_jumping = False
            jump_speed = 0.0

    if is_sliding:
        slide_time -= 1

        if slide_time <= 0:
            is_sliding = False
            slide_time = 0


def update_objects():
    global running_objects
    global spawn_time
    global score, milk_count
    global game_over

    new_list = []

    for obj in running_objects:
        obj["y"] -= game_speed

        if check_object_collision(obj):
            if obj["type"] == "milk":
                score += 10
                milk_count += 1
                continue
            else:
                game_over = True
                continue

        if obj["y"] > road_back - 140:
            new_list.append(obj)

    running_objects = new_list

    spawn_time -= 1

    if spawn_time <= 0:
        running_objects.append(create_object())
        spawn_time = spawn_gap


def update_difficulty():
    global game_speed
    global difficulty_time
    global spawn_gap
    global road_move

    difficulty_time += 1
    road_move += game_speed

    if difficulty_time % 900 == 0:
        game_speed += 0.08

        if spawn_gap > 105:
            spawn_gap -= 2


def keyboardListener(key, x, y):
    global game_started
    global cat_lane
    global is_jumping, jump_speed
    global is_sliding, slide_time

    if key == b' ':
        if not game_started:
            reset_game()
        return

    if key == b'r' or key == b'R':
        if game_over:
            reset_game()
        return

    if not game_started or game_over:
        return

    if key == b'a' or key == b'A':
        if cat_lane > 0:
            cat_lane -= 1

    if key == b'd' or key == b'D':
        if cat_lane < 2:
            cat_lane += 1

    if key == b'w' or key == b'W':
        if not is_jumping and not is_sliding:
            is_jumping = True
            jump_speed = 13.0

    if key == b's' or key == b'S':
        if not is_jumping and not is_sliding:
            is_sliding = True
            slide_time = 38


def specialKeyListener(key, x, y):
    global cat_lane

    if not game_started or game_over:
        return

    if key == GLUT_KEY_LEFT:
        if cat_lane > 0:
            cat_lane -= 1

    if key == GLUT_KEY_RIGHT:
        if cat_lane < 2:
            cat_lane += 1


def mouseListener(button, state, x, y):
    pass


def setupCamera():
    global camera_pos

    glMatrixMode(GL_PROJECTION)
    glLoadIdentity()
    gluPerspective(fovY, 1.25, 0.1, 1600)

    glMatrixMode(GL_MODELVIEW)
    glLoadIdentity()

    cat_x = lane_x[cat_lane]

    eye_x = cat_x
    eye_y = cat_y - 440
    eye_z = 260

    look_x = cat_x
    look_y = cat_y + 210
    look_z = 65

    camera_pos = (eye_x, eye_y, eye_z)

    gluLookAt(
        eye_x, eye_y, eye_z,
        look_x, look_y, look_z,
        0, 0, 1
    )


def idle():
    global last_update_time

    current_time = time.time()

    if current_time - last_update_time >= 0.035:
        last_update_time = current_time

        if game_started and not game_over:
            update_player()
            update_objects()
            update_difficulty()

    glutPostRedisplay()


def draw_game_info():
    if not game_started:
        draw_text(355, 710, "RunningCat")
        draw_text(300, 670, "Press SPACE to Start")
        draw_text(265, 635, "A/D or Left/Right: Change Lane")
        draw_text(300, 605, "W: Jump    S: Slide")
        draw_text(260, 575, "Collect milk. Avoid humans and obstacles.")
        return

    if game_over:
        draw_text(385, 710, "GAME OVER")
        draw_text(360, 670, "Final Score: " + str(score))
        draw_text(360, 635, "Milk Collected: " + str(milk_count))
        draw_text(325, 600, "Press R to Restart")
        return

    draw_text(20, 760, "Score: " + str(score))
    draw_text(20, 730, "Milk: " + str(milk_count))
    draw_text(20, 700, "Speed: " + str(round(game_speed, 1)))
    draw_text(20, 670, "A/D or Arrow: Lane | W: Jump | S: Slide")


def showScreen():
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)
    glLoadIdentity()
    glViewport(0, 0, window_w, window_h)

    setupCamera()

    draw_shapes()
    draw_game_info()

    glutSwapBuffers()


# Main function to set up OpenGL window and loop
def main():
    glutInit()
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_DEPTH)
    glutInitWindowSize(window_w, window_h)
    glutInitWindowPosition(0, 0)
    wind = glutCreateWindow(b"RunningCat")

    glutDisplayFunc(showScreen)
    glutKeyboardFunc(keyboardListener)
    glutSpecialFunc(specialKeyListener)
    glutMouseFunc(mouseListener)
    glutIdleFunc(idle)

    glutMainLoop()


if __name__ == "__main__":
    main()