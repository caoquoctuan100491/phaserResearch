var config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 300 },
      debug: false,
    },
  },
  scene: {
    preload: preload,
    create: create,
    update: update,
  },
};

var game = new Phaser.Game(config);
var platforms;
var player;
var ruler;
var arrow;
var bullet;
let bulletPower = 350;
let canShoot = false;
var lastMove;
var lastAngle;
var mapMember = {};
var cursors;
var isShowRule = false;
var isPlayCollSound = false;
var playTeleport = false;
var selectSkill = 0;
var maxbullet = 1;

var shootSound,
  bulletMoveSound,
  bulletCollSound,
  teleportSoundBlind,
  teleportSoundSand;
var skillTeleportSound;
// Create a socket instance
const socket = new WebSocket("ws://localhost:2567");

// Connect to the Colyseus server
var client = new Colyseus.Client("ws://localhost:2567");
var myRoom;

function preload() {
  this.load.image("bg", "assets/Night.png");
  this.load.image("platform", "assets/platform.png");
  this.load.image("ruler-light", "assets/ruler-light.png");
  this.load.image("arrow-light", "assets/arrow-light.png");
  this.load.image("bullet", "assets/bullet.png");
  this.load.spritesheet("dude", "assets/dude.png", {
    frameWidth: 32,
    frameHeight: 48,
  });

  this.load.spritesheet("mist", "assets/Mist.png", {
    frameWidth: 192,
    frameHeight: 192,
  });
  this.load.spritesheet("hitFire", "assets/HitFire.png", {
    frameWidth: 192,
    frameHeight: 192,
  });
  this.load.spritesheet("Ice1", "assets/Ice1.png", {
    frameWidth: 192,
    frameHeight: 192,
  });
  this.load.spritesheet("Ice2", "assets/Ice2.png", {
    frameWidth: 192,
    frameHeight: 192,
  });

  //audio
  this.load.audio("gun1", "audio/Gun1.ogg");
  this.load.audio("Up1", "audio/Up1.ogg");
  this.load.audio("Explosion1", "audio/Explosion1.ogg");
  this.load.audio("Darkness1", "audio/Darkness1.ogg");
  this.load.audio("Blind", "audio/Blind.ogg");
  this.load.audio("Sand", "audio/Sand.ogg");
}

function create() {
  let that = this;
  shootSound = this.sound.add("gun1");
  this.bulletMoveSound = this.sound.add("Up1");
  bulletCollSound = this.sound.add("Explosion1");
  skillTeleportSound = this.sound.add("Darkness1");
  teleportSoundSand = this.sound.add("Sand");
  teleportSoundBlind = this.sound.add("Blind");

  this.add.image(1000, 300, "bg").setScale(2.5);
  platforms = this.physics.add.staticGroup();
  platforms.create(400, 900, "platform").setScale(2).refreshBody();

  //player
  player = createMember(this);
  this.anims.create({
    key: "teleport",
    frames: this.anims.generateFrameNumbers("mist", { start: 0, end: 3 }),
    frameRate: 10,
  });
  this.anims.create({
    key: "hitFire",
    frames: this.anims.generateFrameNumbers("hitFire", { start: 0, end: 7 }),
    frameRate: 10,
  });

  this.anims.create({
    key: "Ice1",
    frames: this.anims.generateFrameNumbers("Ice1", { start: 0, end: 14 }),
    frameRate: 10,
  });

  this.anims.create({
    key: "Ice2",
    frames: this.anims.generateFrameNumbers("Ice2", { start: 0, end: 18 }),
    frameRate: 10,
  });

  this.anims.create({
    key: "left",
    frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1,
  });

  this.anims.create({
    key: "turn",
    frames: [{ key: "dude", frame: 4 }],
    frameRate: 20,
  });

  this.anims.create({
    key: "right",
    frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1,
  });

  cursors = this.input.keyboard.createCursorKeys();

  //Socket
  // Join a room
  client
    .joinOrCreate("my_room")
    .then((room) => {
      console.log(room.sessionId, "joined", room.name);
      myRoom = room;
      room.onMessage("updatePlayer", (message) => {
        if (player.x != message.x) {
          player.x = message.x;
        }
      });
      room.onMessage("newMember", (message) => {
        if (message.member != room.sessionId) {
          mapMember[message.member] = createMember(that);
        }
      });
      room.onMessage("leave", (message) => {
        if (message.member != room.sessionId) {
          mapMember[message.member].destroy();
        }
      });
      room.onMessage("updateMember", (message) => {
        if (message.member != room.sessionId) {
          let velocityX = 0;
          if (message.direction == "right") {
            velocityX = 160;
          } else if (message.direction == "left") {
            velocityX = -160;
          }
          if (!mapMember[message.member]) {
            mapMember[message.member] = createMember(that, message);
          }
          updateMember(mapMember[message.member], velocityX, message.direction);
          mapMember[message.member].x = message.x;
        }
      });
    })
    .catch((e) => {
      console.log("JOIN ERROR", e);
    });
}

function createMember(that, position) {
  x = 100;
  y = 100;
  if (position) {
    x = position.x;
    y = position.y;
  }
  let member = that.physics.add.sprite(x, y, "dude");

  member.setBounce(0.2);
  member.setCollideWorldBounds(true);
  that.physics.add.collider(member, platforms);
  return member;
}

function update() {
  if (cursors.left.isDown) {
    lastMove = "left";
    lastAngle = arrow.angle;
    updateMember(player, -160, "left");
    isShowRule = false;
    arrow.destroy();
    ruler.destroy();
    // myRoom.send("move", { direction: "left" });
  } else if (cursors.right.isDown) {
    lastMove = "right";
    lastAngle = arrow.angle;
    updateMember(player, 160, "right");
    isShowRule = false;
    arrow.destroy();
    ruler.destroy();
    // myRoom.send("move", { direction: "right" });
  } else if (cursors.up.isDown) {
    if (lastMove == "left") {
      if (arrow.angle < 120) {
        arrow.angle += 1;
      }
    } else {
      if (arrow.angle > -120) {
        arrow.angle -= 1;
      }
    }
  } else if (cursors.down.isDown) {
    if (lastMove == "left") {
      if (arrow.angle > -30) {
        arrow.angle -= 1;
      }
    } else {
      if (arrow.angle < 30) {
        arrow.angle += 1;
      }
    }
  } else {
    if (player.move != "turn") {
      if (myRoom) {
        // myRoom.send("move", { direction: "turn" });
      }
    }
    updateMember(player, 0, "turn");
    // console.log(player.y);
    if (player.y == 714 && !isShowRule) {
      //714
      isShowRule = true;
      arrow = player.scene.add.image(player.x, player.y, "arrow-light");
      ruler = player.scene.add.image(player.x, player.y, "ruler-light");
      if (lastMove == "left") {
        arrow.setScale(-1, 1);
        ruler.setScale(-1, 1);
      }
      if (lastAngle) {
        if (
          (lastAngle >= -120 && lastAngle <= 30 && lastMove == "left") ||
          (lastAngle >= -30 && lastAngle <= 120 && lastMove == "right")
        ) {
          arrow.angle = -lastAngle;
        } else {
          arrow.angle = lastAngle;
        }
      }
    }
  }
  if (arrow) {
    if (cursors.space.isDown) {
      bulletPower += 10;
      this.canShoot = true;
    } else {
      if (this.canShoot) {
        shootSound.play();
        this.canShoot = false;
        const bulletSpeed = bulletPower;
        const angle = arrow.rotation;
        // Thiết lập tốc độ di chuyển của đạn và cho phép nó di chuyển
        var bulletVelocityX = bulletSpeed * Math.cos(angle);
        var bulletVelocityY = bulletSpeed * Math.sin(angle);
        if (lastMove == "left") {
          bulletVelocityX = bulletSpeed * Math.cos(angle + Math.PI);
          bulletVelocityY = bulletSpeed * Math.sin(angle + Math.PI);
        }
        if (this.intervalAngle) {
          clearInterval(this.intervalAngle);
        }
        this.bullet = player.scene.physics.add.sprite(
          player.x,
          player.y,
          "bullet"
        );
        this.bullet.angle = 0;
        this.bullet.setScale(1);
        this.bullet.setPosition(player.x, player.y);
        this.bullet.setVelocity(bulletVelocityX, bulletVelocityY);
        this.bullet.setActive(true);
        this.bullet.setVisible(true);

        player.scene.physics.add.overlap(this.bullet, platforms, () => {
          bulletCollid(this.bullet, platforms);
        });
        var isRotation = true;

        if (selectSkill == 2) {
          setTimeout(() => {
            this.bullet.setScale(0.75);
            for (let index = 1; index < maxbullet; index++) {
              createNewBullet(
                this.bullet.x,
                this.bullet.y,
                this.bullet.body.velocity.x + Phaser.Math.Between(-50, 50),
                this.bullet.body.velocity.y + Phaser.Math.Between(-50, 50),
                Phaser.Math.Between(0, 360),
                0.75
              );
            }
          }, 500);
        }

        if (selectSkill == 3) {
          for (let index = 1; index < maxbullet; index++) {
            setTimeout(() => {
              shootSound.play();
              createNewBullet(
                player.x,
                player.y,
                bulletVelocityX,
                bulletVelocityY,
                0,
                1
              );
            }, 500 * index);
          }
        }

        if (selectSkill == 4) {
          scaleIncrease = 0.02;
          this.interval = setInterval(() => {
            this.bullet.setScale(this.bullet.scaleX + scaleIncrease);
          }, 100);
        } else {
          clearInterval(this.interval);
        }

        if (selectSkill == 5) {
          // const rotationSpeed = 0.01; // Tốc độ quay vòng của đạn
          // this.time.addEvent({
          //   callback: () => {
          //     Phaser.Actions.RotateAround(
          //       [this.bullet],
          //       { x, y },
          //       rotationSpeed
          //     );
          //   },
          //   loop: true,
          // });
          setTimeout(() => {
            this.bullet.setVelocity(
              this.bullet.body.velocity.x * -0.25,
              this.bullet.body.velocity.y * -1
            );
          }, 500);
        }

        if (selectSkill == 6) {
          isRotation = false;
          setTimeout(() => {
            this.bullet.anims.play("Ice2", true);
            setTimeout(() => {
              this.bullet.setVelocityY(1000);
            }, 1000);
          }, 500);
        }

        if (isRotation) {
          this.bullet.intervalAngle = setInterval(() => {
            this.bullet.angle = this.bullet.angle + 50;
          }, 100);
        }

        bulletPower = 350;
      }
    }
  }

  if (this.bullet) {
    if (this.bullet.active) {
      isPlayCollSound = true;
      if (this.bullet.y > 900) {
        this.bullet.setActive(false);
      }
      // this.bulletMoveSound.play();
    }
  }
}

function updateMember(member, velocityX, move) {
  if (member) {
    member.move = move;
    member.setVelocityX(velocityX);
    if (playTeleport) {
      member.anims.play("teleport", true);
    } else {
      member.anims.play(move, true);
    }
  }
}

function getAngle() {
  let value = arrow.angle || 0;
  if (value === 0) value = 0;
  else if (!this.isFlip) value = -value;
  else if (this.isFlip) {
    if (value < 0) value = value + 180;
    else value = value - 180;
  }

  return Math.round(value);
}

function createNewBullet(x, y, vx, vy, angle, scale) {
  let newBullet = player.scene.physics.add.sprite(x, y, "bullet");
  player.scene.physics.add.overlap(newBullet, platforms, () => {
    bulletCollid(newBullet, platforms);
  });
  newBullet.setScale(scale);
  newBullet.setVelocity(vx, vy);
  newBullet.angle = angle;
  newBullet.intervalAngle = setInterval(() => {
    newBullet.angle = newBullet.angle + 50;
  }, 100);
}

function bulletCollid(bullet, platforms) {
  if (bullet.active) {
    bullet.setVelocity(0, 0);
    switch (selectSkill) {
      case 1:
        //teleport
        arrow.destroy();
        ruler.destroy();

        playTeleport = true;
        teleportSoundBlind.play();
        teleportSoundSand.play();
        let x = bullet.x;
        let y = bullet.y;
        setTimeout(() => {
          skillTeleportSound.play();
          player.setPosition(x, y);
        }, 250);

        setTimeout(() => {
          playTeleport = false;
          isShowRule = false;
        }, 500);

        break;
      default:
        break;
    }
    if (selectSkill != 1) {
      bulletCollSound.play();
      bullet.anims.play("hitFire", true);
      setTimeout(() => {
        bullet.setActive(false);
        bullet.setVisible(false);
      }, 250);
    } else {
      bullet.setActive(false);
      bullet.setVisible(false);
    }

    const platformAngle = Phaser.Math.Between(0, 90);
    platforms.angle = platformAngle;
    platforms.y += 20;

    if (bullet.intervalAngle) {
      clearInterval(bullet.intervalAngle);
    }
  }
}
