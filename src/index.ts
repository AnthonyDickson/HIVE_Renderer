// @ts-ignore
import * as THREE from 'three'
// @ts-ignore
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls.js'
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js"
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js'
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'

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
    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(width, height)
    document.body.appendChild(renderer.domElement)

    renderer.setClearColor(0x000000, 1)
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local')
    document.body.appendChild(VRButton.createButton(renderer))

    return renderer
}

const createControls = (camera: THREE.Camera, renderer: THREE.WebGLRenderer): TrackballControls => {
    const controls = new TrackballControls(camera, renderer.domElement)

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
        camera.position.z = -1.5
        camera.lookAt(0, 0, 0)
        // Have to move the world instead of the camera to get the controls to behave correctly...
        scene.position.y = -1.5
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

        scene.add(getGroundPlane(100, 100))
        scene.background = loadSkybox()

        const clock = new THREE.Clock()

        var isXRCameraFixed = false;

        // we add an ambient light source to the scene
        var light = new THREE.AmbientLight(0xffffff);
        scene.add(light);

        const userGroup = new THREE.Group();

        // since we move the scene to be "centered" on the trackball controller,
        // we need to move the controllers to match the new scene location
        userGroup.translateY(1.5);
        userGroup.add(camera);
        userGroup.translateZ(-1);

        scene.add(userGroup);

        renderer.setAnimationLoop(() => {
            stats.begin()

            if (loadingOverlay.isVisible && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                // Ensure that the two clips will be synced
                const numFrames = Math.max(staticElements.numFrames, dynamicElements.numFrames)
                dynamicElements.numFrames = numFrames
                staticElements.numFrames = numFrames

                dynamicElements.reset()
                staticElements.reset()

                resetCamera()
                loadingOverlay.hide()

                clock.start()
            }
            
            // fix the initial position of the VR camera
            if(renderer.xr.isPresenting && isXRCameraFixed == false){
                userGroup.rotateY(Math.PI);
                isXRCameraFixed = true;
            }

            const delta = clock.getDelta()

            dynamicElements.update(delta, scene)
            staticElements.update(delta, scene)
            controls.update()

            renderer.render(scene, camera)

            stats.end()
        })
    })
        .catch(() => alert("An error occurred when trying to load the video."))
}
