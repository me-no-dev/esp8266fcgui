(function($) {
    var PLUGIN_NAME = 'kiss.model',
        pluginData = function(obj) {
            return obj.data(PLUGIN_NAME);
        };
    var
        ARM_LENGTH = 1,
        HUB_RADIUS = ARM_LENGTH * 0.2,
        CRAFT_DEPTH = ARM_LENGTH * 0.03,
        AXIS = {
            roll: new THREE.Vector3(1, 0, 0),
            pitch: new THREE.Vector3(0, 1, 0),
            yaw: new THREE.Vector3(0, 0, 1)
        },
        MIXER_LIST = [{
            name: 'Tricopter',
            arms: 3,
            rotation: -Math.PI / 3,
            colors: [0, 0, 1]
        }, {
            name: 'Quad +',
            arms: 4,
            colors: [0, 1, 1, 1]
        }, {
            name: 'Quad X',
            arms: 4,
            rotation: -Math.PI / 4,
            colors: [0, 0, 1, 1]
        }, {
            name: 'Y4',
            arms: 3,
            rotation: -Math.PI / 3,
            colors: [0, 0, 1, 1],
            motors: [
                [0],
                [1],
                [2, -3]
            ]
        }, {
            name: 'Y6',
            arms: 3,
            rotation: -Math.PI / 3,
            colors: [0, 0, 0, 0, 1, 1],
            motors: [
                [0, -1],
                [2, -3],
                [4, -5]
            ]
        }, {
            name: 'Hexa +',
            arms: 6,
            colors: [0, 1, 1, 1, 1, 1]
        }, {
            name: 'Hexa X',
            arms: 6,
            rotation: -Math.PI / 6,
            colors: [0, 0, 1, 1, 1, 1]
        }];

    var privateMethods = {
        makeMotor: function(self, propColor) {
            var motorParent = new THREE.Object3D();
            var motorMaterial = new THREE.MeshPhongMaterial({
                color: 0x000000,
                specular: 0x202020,
                shininess: 100
            });
            var propMaterial = new THREE.MeshPhongMaterial({
                color: propColor,
                shininess: 0
            });
            var propDiskMaterial = new THREE.MeshPhongMaterial({
                color: propColor,
                shininess: 80,
                transparent: true,
                opacity: 0.4
            });
            var motorBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.02, 16), motorMaterial);
            var motorBell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 16), motorMaterial);
            var motorTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 16), motorMaterial);
            var motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.27, 16), motorMaterial);
            var motorNut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 6), motorMaterial);
            var propHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), propMaterial);
            var propDisk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.01, 32), propDiskMaterial);
            motorBell.position.y = 0.07;
            motorTop.position.y = 0.125;
            motorShaft.position.y = 0.12;
            propHub.position.y = 0.16;
            motorNut.position.y = 0.20;
            propDisk.position.y = 0.165;
            motorParent.add(motorBase);
            motorParent.add(motorBell);
            motorParent.add(motorTop);
            motorParent.add(motorShaft);
            motorParent.add(propHub);
            motorParent.add(motorNut);
            motorParent.add(propDisk);
            return motorParent;
        },
        build: function(self) {
            var data = pluginData(self);
            data.mixerData = MIXER_LIST[data.mixer];
            data.scene = new THREE.Scene();

            privateMethods.initCamera(self);
            privateMethods.initRenderer(self);

            var path = new THREE.Path(),
                ARM_WIDTH_RADIANS = 0.15,
                MOTOR_MOUNT_WIDTH_RATIO = 2.5,
                MOTOR_MOUNT_LENGTH_RATIO = 0.08,
                MOTOR_BEVEL_DEPTH_RATIO = 0.08,
                ARM_WIDTH = 2 * Math.sin(ARM_WIDTH_RADIANS) * HUB_RADIUS,
                texture = THREE.ImageUtils.loadTexture(data.texture);

            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(12, 24);

            var craftMaterial = new THREE.MeshPhongMaterial({
                    map: texture,
                    specular: 0x202020,
                    shininess: 100
                }),
                craft = new THREE.Object3D(),
                craftParent = new THREE.Object3D();

            for (i = 0; i < data.mixerData.arms; i++) {
                var
                    armStart = i / data.mixerData.arms * Math.PI * 2 - ARM_WIDTH_RADIANS,
                    armEnd = armStart + ARM_WIDTH_RADIANS * 2;

                if (i === 0) {
                    path.moveTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
                } else {
                    path.lineTo(Math.cos(armStart) * HUB_RADIUS, Math.sin(armStart) * HUB_RADIUS);
                }

                var
                    armVectorX = Math.cos(armStart + ARM_WIDTH_RADIANS),
                    armVectorY = Math.sin(armStart + ARM_WIDTH_RADIANS),
                    crossArmX = -armVectorY * ARM_WIDTH * 0.5,
                    crossArmY = armVectorX * ARM_WIDTH * 0.5,

                    armPoints = [{
                        length: 1 - MOTOR_MOUNT_LENGTH_RATIO - MOTOR_BEVEL_DEPTH_RATIO,
                        width: 1
                    }, {
                        length: 1 - MOTOR_MOUNT_LENGTH_RATIO,
                        width: MOTOR_MOUNT_WIDTH_RATIO
                    }, {
                        length: 1 + MOTOR_MOUNT_LENGTH_RATIO,
                        width: MOTOR_MOUNT_WIDTH_RATIO
                    }, {
                        length: 1 + MOTOR_MOUNT_LENGTH_RATIO + MOTOR_BEVEL_DEPTH_RATIO,
                        width: 1
                    }];

                armVectorX *= ARM_LENGTH;
                armVectorY *= ARM_LENGTH;

                for (var j = 0; j < armPoints.length; j++) {
                    var point = armPoints[j];
                    path.lineTo(point.length * armVectorX - point.width * crossArmX, point.length * armVectorY - point.width * crossArmY);
                }

                for (var j = armPoints.length - 1; j >= 0; j--) {
                    var point = armPoints[j];
                    path.lineTo(point.length * armVectorX + point.width * crossArmX, point.length * armVectorY + point.width * crossArmY);
                }

                path.lineTo(
                    Math.cos(armEnd) * HUB_RADIUS,
                    Math.sin(armEnd) * HUB_RADIUS
                );

                var motors = [i];
                if (data.mixerData.motors !== undefined) {
                    motors = data.mixerData.motors[i];
                }

                for (var k = 0; k < motors.length; k++) {
                    var motor = privateMethods.makeMotor(self, data.propColors[data.mixerData.colors[Math.abs(motors[k])]]);
                    motor.position.x = armVectorX
                    motor.position.y = armVectorY
                    if (motors[k] >= 0) {
                        motor.position.z = CRAFT_DEPTH;
                        motor.rotateOnAxis(AXIS.roll, Math.PI / 2);
                    } else {
                        motor.rotateOnAxis(AXIS.roll, -Math.PI / 2);
                    }
                    craft.add(motor);
                }
            }

            var
                shape = path.toShapes(true, false),
                extrudeSettings = {
                    amount: CRAFT_DEPTH,
                    steps: 1,
                    bevelEnabled: false
                },
                geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings),
                craftMesh = new THREE.Mesh(geometry, craftMaterial);

            craft.add(craftMesh);

            craft.position.z = -CRAFT_DEPTH / 2;

            if (data.mixerData.rotation !== undefined) {
                craft.rotateOnAxis(AXIS.yaw, data.mixerData.rotation);
            }

            craftParent.add(craft);
            craftParent.rotation.z = Math.PI / 2;

            var directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(0, 0, 1);
            data.scene.add(directionalLight);
            data.model = craftParent;
            data.scene.add(data.model);
            self.append(data.renderer.domElement);
        },
        initCamera: function(self) {
            var data = pluginData(self);
            data.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
            data.camera.position.set(0, 100, 300);
            data.camera.position.y = 0;
            data.camera.position.z = 5;
        },
        initRenderer: function(self) {
            var data = pluginData(self);
            data.renderer = new THREE.WebGLRenderer({
                antialias: true
            });
            data.renderer.setSize(data.width, data.height); // w/h
            data.renderer.setClearColor(data.backgroundColor, 0);
        }
    };

    var publicMethods = {
        init: function(options) {
            return this.each(function() {
                var self = $(this),
                    data = pluginData(self);
                if (!data) {
                    self.data(PLUGIN_NAME, $.extend(true, {
                        rate: {
                            roll: 0,
                            pitch: 0,
                            yaw: 0
                        },
                        scene: null,
                        renderer: null,
                        camera: null,
                        model: null,
                        width: 200,
                        height: 200,
                        mixer: 6,
                        mixerData: {},
                        backgroundColor: 0xf4f4f4,
                        propColors: [0xffa84e, 0x00f300],
                        texture: 'images/cf.png'
                    }, options));
                    data = pluginData(self);
                }
                privateMethods.build(self);
            });
        },
        destroy: function() {
            return this.each(function() {
                $(this).removeData(PLUGIN_NAME);
            });
        },
        updateRate: function(newValue) {
            var self = $(this);
            var data = pluginData(self);
            data.rate = newValue;
        },
        refresh: function() {
            var data = pluginData($(this));
            data.model.rotateOnAxis(AXIS.roll, data.rate.roll);
            data.model.rotateOnAxis(AXIS.pitch, data.rate.pitch);
            data.model.rotateOnAxis(AXIS.yaw, -data.rate.yaw);
            data.renderer.render(data.scene, data.camera);
        }
    };

    $.fn.kissModel = function(method) {
        if (publicMethods[method]) {
            return publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return publicMethods.init.apply(this, arguments);
        } else {
            $.error('Method [' + method + '] not available in $.kissModel');
        }
    };
})(jQuery);