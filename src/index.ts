// @ts-ignore
import * as THREE from 'three'
// @ts-ignore
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls'
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js"
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js'
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
// @ts-ignore
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
// @ts-ignore
//import TeleportVR from "teleportvr";
// @ts-ignore
import StatsVR from 'statsvr';

window.onload = () => {
    init()
}

class MeshVideo {
    private readonly videoBaseFolder: string
    private readonly sceneName: string
    private loader: GLTFLoader

    private readonly frames: { number: THREE.Mesh }
    private readonly useVertexColour: boolean
    private readonly persistFrame: boolean
    private readonly swapMeshInterval: number
    private timeSinceLastMeshSwap: number
    // The current frame position in the video sequence.
    private currentFrameIndex: number
    // The index of the currently displayed frame (null if no frame is currently displayed).
    private displayedFrameIndex: number

    public numFrames: number
    public hasLoaded: boolean

    constructor({
                    swapMeshInterval,
                    loader,
                    videoBaseFolder,
                    sceneName = 'scene3d',
                    useVertexColour = false,
                    persistFrame = false
                }) {
        this.videoBaseFolder = videoBaseFolder
        this.sceneName = sceneName
        this.loader = loader

        // @ts-ignore
        this.frames = {}
        this.useVertexColour = useVertexColour
        this.persistFrame = persistFrame
        this.swapMeshInterval = swapMeshInterval
        this.reset()

        this.numFrames = 0
        this.hasLoaded = false
    }

    // Go to the start of the video sequence.
    reset() {
        this.currentFrameIndex = 0
        this.timeSinceLastMeshSwap = 0.0
        this.displayedFrameIndex = null
    }

    /**
     * Load the mesh data from disk.
     * @return A reference to this MeshVideo object.
     *  Allows a call to this load function to be chained when creating a new instance.
     */
    load(): MeshVideo {
        this.loader.load(
            `${this.videoBaseFolder}/${this.sceneName}.glb`,
            (gltf) => {
                console.debug(gltf)
                console.debug(gltf.scene.children[0].children as unknown as Array<THREE.Mesh>)

                for (const mesh of gltf.scene.children[0].children as unknown as Array<THREE.Mesh>) {
                    // Objects will either of type "Mesh" or "Object3D". The latter occurs when there is no mesh.
                    if (mesh.type == "Mesh") {
                        mesh.material = new THREE.MeshBasicMaterial({map: (mesh.material as THREE.MeshStandardMaterial).map})

                        if (this.useVertexColour) {
                            mesh.material.vertexColors = true
                        }

                        const frame_number = parseInt(mesh.name)
                        this.frames[frame_number] = mesh

                        if (this.currentFrameIndex < 0) {
                            this.currentFrameIndex = frame_number
                        }

                        if (frame_number > this.numFrames) {
                            this.numFrames = frame_number
                        }
                    }
                }

                this.hasLoaded = true

                const numFramesLoaded = Object.keys(this.frames).length
                console.info(`Loaded ${numFramesLoaded} frames for video "${this.sceneName}" in ${this.videoBaseFolder}.`)
            },
            undefined,
            (error) => {
                console.error(error)
            }
        )

        return this
    }

    /**
     * Perform a frame update if enough time has elapsed since the last update.
     * @param delta The time since the last call to this method.
     * @param scene The scene object to display the mesh(es) in.
     */
    update(delta: number, scene: THREE.Scene) {
        if (!this.hasLoaded) {
            return
        }

        this.timeSinceLastMeshSwap += delta

        if (this.timeSinceLastMeshSwap > this.swapMeshInterval && this.numFrames > 0) {
            this.timeSinceLastMeshSwap = 0.0

            this.step(scene)
        }
    }

    /**
     * Advance one frame.
     * @param scene The scene object to update.
     * @private
     */
    private step(scene: THREE.Scene) {
        const previousFrameIndex = this.displayedFrameIndex
        const nextFrameIndex = this.currentFrameIndex

        const hasPreviousFrame = this.frames.hasOwnProperty(previousFrameIndex)
        const hasNextFrame = this.frames.hasOwnProperty(nextFrameIndex)

        const shouldUpdateFrame = (this.persistFrame && hasNextFrame) || !this.persistFrame

        if (shouldUpdateFrame) {
            if (hasPreviousFrame) {
                scene.remove(this.frames[previousFrameIndex])
            }

            if (hasNextFrame) {
                scene.add(this.frames[nextFrameIndex])
                this.displayedFrameIndex = nextFrameIndex
            }
        }

        this.currentFrameIndex = (this.currentFrameIndex + 1) % this.numFrames
    }
}

class LoadingOverlay {
    private readonly loaderGUI: HTMLElement
    private readonly rendererGUI: HTMLElement
    isVisible: boolean

    constructor() {
        this.loaderGUI = document.getElementById("loader-overlay")
        this.rendererGUI = document.getElementById("container")
        this.isVisible = false
    }

    show() {
        this.loaderGUI.style.display = 'block'
        this.rendererGUI.style.display = 'none'
        this.isVisible = true
    }

    hide() {
        this.loaderGUI.style.display = 'none'
        this.rendererGUI.style.display = 'block'
        this.isVisible = false
    }

}

const createRenderer = (width: number, height: number): THREE.WebGLRenderer => {
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    document.body.appendChild(renderer.domElement)

    renderer.setClearColor(0x000000, 1)
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local')
    document.body.appendChild(VRButton.createButton(renderer))

    return renderer
}

const createControls = (camera: THREE.Camera, renderer: THREE.WebGLRenderer): OrbitControls => {
    const controls = new OrbitControls(camera, renderer.domElement)

    controls.rotateSpeed = 1.0
    controls.zoomSpeed = 1.0
    controls.panSpeed = 0.8

    return controls
}

const createStatsPanel = (): Stats => {
    const stats = Stats()
    stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom)

    return stats
}

const getVideoFolder = (): string => {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    let videoFolder: string

    if (urlParams.has('video')) {
        videoFolder = urlParams.get('video')
    } else {
        videoFolder = 'demo'
    }

    return videoFolder
}

async function loadMetadata(videoFolder: string) {
    const response = await fetch(`${videoFolder}/metadata.json`)
    return await response.json()
}

const getGroundPlane = (width: number = 1, height: number = 1, color: number = 0xffffff): THREE.Mesh => {
    return new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({color: color, side: THREE.DoubleSide})
    ).rotateX(-Math.PI / 2)
}

const loadSkybox = (): THREE.CubeTexture => {
    return new THREE.CubeTextureLoader()
        .setPath('cubemaps/sky/')
        .load([
            'pos_x.jpg',
            'neg_x.jpg',
            'pos_y.jpg',
            'neg_y.jpg',
            'pos_z.jpg',
            'neg_z.jpg',
        ])
}

function init() {
    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, canvasWidth / canvasHeight, 0.1, 1000)
    const renderer = createRenderer(canvasWidth, canvasHeight)
    const controls = createControls(camera, renderer)
    const stats = createStatsPanel()

    const resetCamera = () => {
        controls.reset()

        // initial position of the camera
        camera.position.set(0, 1.6, -3)
        camera.lookAt(0, 0, 0)
    }

    const onDocumentKeyDown = (event) => {
        const keyCode = event.which;
        switch (keyCode) {
            case 82: { // the key 'r'
                resetCamera()
                break
            }
            case 80: {
                console.info(`Camera position: (${camera.position.x}, ${camera.position.y}, ${camera.position.z})`)
                console.info(`Camera rotation: (${camera.rotation.x}, ${camera.rotation.y}, ${camera.rotation.z})`)
                let cameraDirection = new THREE.Vector3()
                camera.getWorldDirection(cameraDirection)
                console.info(`Camera direction: (${cameraDirection.x}, ${cameraDirection.y}, ${cameraDirection.z})`)
                break
            }
            default:
                console.debug(`Key ${keyCode} pressed.`)
        }
    }
    document.addEventListener("keydown", onDocumentKeyDown, false);

    const videoFolder = getVideoFolder()
    document.title = `3D Video | ${videoFolder}`

    const loadingOverlay = new LoadingOverlay()
    loadingOverlay.show()

    loadMetadata(videoFolder).then(metadata => {
        const loader = new GLTFLoader()
        const swapMeshInterval = 1.0 / metadata["fps"] // seconds

        const dynamicElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: "fg",
            useVertexColour: false,
            persistFrame: false
        }).load()

        const staticElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: 'bg',
            useVertexColour: metadata["use_vertex_colour_for_bg"],
            persistFrame: true
        }).load()

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(20, 20, 10, 10),
            new THREE.MeshBasicMaterial({
                color: 0x008800,
                wireframe: true,
            })
        )
        floor.rotation.x = Math.PI / -2
        floor.position.y = -0.001
        scene.add(floor)
        
        // we load the nice clouds
        scene.background = loadSkybox()

        // we add an ambient light source to the scene
        var light = new THREE.AmbientLight(0xffffff);
        scene.add(light);

        // some fantastic combination of the two strategies
        const teleportVR = new TeleportVR(scene, camera);

        const controllerModelFactory = new XRControllerModelFactory();

        const controllerGrip0 = renderer.xr.getControllerGrip(0);
        controllerGrip0.add(
            controllerModelFactory.createControllerModel(controllerGrip0)
        );
        controllerGrip0.addEventListener('connected', (e: any) => {
            teleportVR.add(0, controllerGrip0, e.data.gamepad)
        })

        const controllerGrip1 = renderer.xr.getControllerGrip(1);
        controllerGrip1.add(
            controllerModelFactory.createControllerModel(controllerGrip1)
        );
        controllerGrip1.addEventListener('connected', (e: any) => {
            teleportVR.add(1, controllerGrip1, e.data.gamepad)
        })

        // we start the clock
        const clock = new THREE.Clock()
        
        //set up stats in VR
        const statsVR = new StatsVR(scene, camera)
        statsVR.setX(0)
        statsVR.setY(0)
        statsVR.setZ(-2)

        renderer.setAnimationLoop(() => {

            // browser only
            if(!renderer.xr.isPresenting){
                stats.begin()
            }

            // when running for the first time
            if (loadingOverlay.isVisible && dynamicElements.hasLoaded && staticElements.hasLoaded) {

                // synchronise the foreground and background
                const numFrames = Math.max(staticElements.numFrames, dynamicElements.numFrames)
                dynamicElements.numFrames = numFrames
                staticElements.numFrames = numFrames

                dynamicElements.reset()
                staticElements.reset()

                // browser only
                if(!renderer.xr.isPresenting){
                    resetCamera()
                    loadingOverlay.hide()
                }
                
                clock.start()

                /*
                // fix the initial position of the VR camera
                if(renderer.xr.isPresenting && isXRCameraFixed == false){
                    //userGroup.rotateY(Math.PI);
                    isXRCameraFixed = true;
                }
                */
            }

            // webxr only
            if(renderer.xr.isPresenting){
                teleportVR.update()

                statsVR.update()
            } else {
                controls.update()
            }

            const delta = clock.getDelta()

            dynamicElements.update(delta, scene)
            staticElements.update(delta, scene)

            renderer.render(scene, camera)

            // browser only
            if(!renderer.xr.isPresenting){
                stats.end()
            }
        })
    })
        .catch(() => alert("An error occurred when trying to load the video."))
}

class TeleportVR {
     private _group = new THREE.Group()
     private _target = new THREE.Group()
     private _curve = new THREE.Mesh()
     private _maxDistance = 10
     private _visible = false
     private _activeController = new THREE.Object3D()
     private _activeControllerKey = ''
     private _controllers: { [id: number]: THREE.Object3D } = {}
     private _enabled: { [id: number]: boolean } = {}
     private _gamePads: { [id: number]: Gamepad } = {}
     private _raycaster = new THREE.Raycaster()
     private _vectorArray: THREE.QuadraticBezierCurve3
 
     constructor(scene: THREE.Scene, camera: THREE.Camera) {
         this._group.add(camera)
         scene.add(this._group)
 
         this._group.add(this._target)
 
         this._vectorArray = new THREE.QuadraticBezierCurve3(
             new THREE.Vector3(0, 0, 0),
             new THREE.Vector3(1, 3, -1),
             new THREE.Vector3(2, 0, -2)
         )
 
         const _mesh = new THREE.Mesh(
             new THREE.CylinderGeometry(1, 1, 0.01, 8),
             new THREE.MeshBasicMaterial({
                 color: 0x0044ff,
                 wireframe: true,
             })
         )
         _mesh.name = 'helperTarget'
         this._target.add(_mesh)
 
         const _mesh2 = new THREE.Mesh(
             new THREE.BoxGeometry(0.1, 0.1, 2),
             new THREE.MeshBasicMaterial({
                 color: 0x0044ff,
                 wireframe: true,
             })
         )
         _mesh2.translateZ(-1)
         _mesh2.name = 'helperDirection'
         this._target.add(_mesh2)
         this._target.visible = false
 
         const _geometry = new THREE.TubeGeometry(this._vectorArray, 9, 0.1, 5, false)
         this._curve = new THREE.Mesh(
             _geometry,
             new THREE.MeshBasicMaterial({
                 color: 0xff0000,
                 wireframe: true,
             })
         )
         this._curve.visible = false
         this._group.add(this._curve)
 
         const direction = new THREE.Vector3(0, -1, 0)
         this._raycaster.ray.direction.copy(direction)
     }
 
     public add(id: number, model: THREE.Object3D, gamePad: Gamepad) {
         model.name = 'teleportVRController_' + id.toString()
         this._group.add(model)
         this._controllers[id] = model
         this._gamePads[id] = gamePad
         this._enabled[id] = true
         //console.log("gamepads length = " + Object.keys(this._gamePads).length)
     }
 
     public get enabled(): { [id: number]: boolean } {
         return this._enabled
     }
     public set enabled(value: { [id: number]: boolean }) {
         this._enabled = value
     }
 
     public get gamePads(): { [id: number]: Gamepad } {
         return this._gamePads
     }
     public set gamePads(value: { [id: number]: Gamepad }) {
         this._gamePads = value
     }
 
     public get target() {
         return this._target
     }
     public set target(value) {
         this._target = value
     }
 
     public get curve() {
         return this._curve
     }
     public set curve(value) {
         this._curve = value
     }
 
     public useDefaultTargetHelper(use: boolean) {
         ;(this._target.getObjectByName('helperTarget') as THREE.Mesh).visible = use
     }
     public useDefaultDirectionHelper(use: boolean) {
         ;(this._target.getObjectByName('helperDirection') as THREE.Mesh).visible = use
     }
 
     public setMaxDistance(val: number) {
         this._maxDistance = val
     }
 
     public teleport() {
         this._visible = false
         this._target.visible = false
         this._curve.visible = false
         this._target.getWorldPosition(this._group.position)
         this._target.getWorldQuaternion(this._group.quaternion)
     }
 
     public update(elevationsMeshList?: THREE.Mesh[]) {
         if (Object.keys(this._gamePads).length > 0) {
             for (let key in Object.keys(this._gamePads)) {
                 if (this._enabled[key]) {
                     const gp = this._gamePads[key]
                     if (gp.buttons[3].touched) {
                         //console.log("hapticActuators = " + gp.hapticActuators)
                         //console.log(gp.axes[0] + " " + gp.axes[1] + " " + gp.axes[2] + " " + gp.axes[3])
                         this._activeController = this._controllers[key]
                         this._activeControllerKey = key
                         this._visible = true
                         if (Math.abs(gp.axes[2]) + Math.abs(gp.axes[3]) > 0.25) {
                             this._target.rotation.y = Math.atan2(-gp.axes[2], -gp.axes[3]) //angle degrees
                         }
                         this._target.visible = true
                         this._curve.visible = true
                         break
                     } else {
                         if (this._activeControllerKey === key) {
                             this._activeControllerKey = ''
                             this.teleport()
                             this._target.rotation.y = 0

                             // put fix here
                             this._group.position.y = 1

                             // how can I adjust the position of the camera without interfering with
                             // the position of 

                             // maybe i need to change logic below to fix it 

                             // find the intercept of the thing

                             // or turn the curve into a straight line? hmm
                         }
                     }
                 }
             }
         }
 
         if (this._visible) {
             const v = new THREE.Vector3(0, -1, 0)
             v.applyQuaternion(this._activeController.quaternion)
             this._target.position.set(v.x * this._maxDistance, 0, v.z * this._maxDistance)
 
             if (elevationsMeshList) {
                 this._target.getWorldPosition(this._raycaster.ray.origin)
                 this._raycaster.ray.origin.y += 10
                 var intersects = this._raycaster.intersectObjects(elevationsMeshList)
                 if (intersects.length > 0) {
                     this._target.position.y = intersects[0].point.y - this._group.position.y
                 }
             }
 
             this._vectorArray.v0.copy(this._target.position)
             this._vectorArray.v2.copy(this._activeController.position)
             var midPoint = new THREE.Object3D()
             midPoint.position.copy(this._vectorArray.v2)
             midPoint.quaternion.copy(this._activeController.quaternion)
             midPoint.translateY(-3)
             this._vectorArray.v1.copy(midPoint.position)
 
             const t = new THREE.TubeGeometry(
                 this._vectorArray,
                 9,
                 0.1,
                 5,
                 false
             ) as THREE.BufferGeometry
             ;(this._curve.geometry as THREE.BufferGeometry).copy(t)
         }
     }
 }
 