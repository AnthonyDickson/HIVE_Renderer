/*
 * HIVE Renderer, WebXR renderer for 3D videos created with HIVE.
 * Copyright (C) 2023  Anthony Dickson anthony.dickson9656@gmail.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

// @ts-ignore
import * as THREE from 'three'
// @ts-ignore
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js'
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js"
// @ts-ignore
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
// @ts-ignore
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

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

    // Whether the mesh has a single frame and has `persistFrame` set to `true`.
    private isStaticMesh: boolean

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
        this.isStaticMesh = false
        this.reset()

        this.numFrames = 0
        this.hasLoaded = false
    }

    /**
     * Go to the start of the video sequence.
     */
    reset() {
        this.currentFrameIndex = 0
        this.timeSinceLastMeshSwap = 0.0
        this.displayedFrameIndex = null

        for (const framesKey in this.frames) {
            const mesh = this.frames[framesKey]
            mesh.visible = false
        }
    }

    /**
     * Add the meshes in this video to a group.
     * @param group The group to add the meshes to.
     */
    addMeshes(group: THREE.Group) {
        for (const frameKey in this.frames) {
            const mesh = this.frames[frameKey]
            group.add(mesh)
        }
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

                if (numFramesLoaded === 1 && this.persistFrame) {
                    this.isStaticMesh = true
                }

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
     */
    update(delta: number) {
        if (!this.hasLoaded) {
            return
        }

        this.timeSinceLastMeshSwap += delta

        if (this.timeSinceLastMeshSwap >= this.swapMeshInterval && this.numFrames > 0) {
            // The time since last mesh swap can be many multiples of the swap mesh interval if the renderer loses
            // focus and comes back into focus later.
            const framesSinceLastUpdate = Math.floor(this.timeSinceLastMeshSwap / this.swapMeshInterval)
            this.timeSinceLastMeshSwap = Math.max(0.0, this.timeSinceLastMeshSwap - framesSinceLastUpdate * this.swapMeshInterval)

            if (framesSinceLastUpdate > 1) {
                console.debug(`Catching up by skipping ${framesSinceLastUpdate - 1} frames...`)
            }

            const nextFrameIndex = (this.currentFrameIndex + framesSinceLastUpdate) % this.numFrames;
            this.goToFrame(nextFrameIndex)
        }
    }

    /**
     * Go to the specified frame.
     * Throws an error If the given frame index is out of bounds.
     *
     * @param frameIndex The index of the frame to go to.
     */
    goToFrame(frameIndex: number) {
        if (frameIndex < 0 || this.numFrames <= frameIndex) {
            throw new Error(`The frame index ${frameIndex} is out of bounds for a video with ${this.numFrames} frames.`)
        }

        const previousFrameIndex = this.displayedFrameIndex

        if (this.isStaticMesh && this.displayedFrameIndex === null) {
            const index = parseInt(Object.keys(this.frames)[0])
            this.frames[index].visible = true
            this.displayedFrameIndex = index
        } else {
            const hasPreviousFrame = this.frames.hasOwnProperty(previousFrameIndex)
            const hasNextFrame = this.frames.hasOwnProperty(frameIndex)

            const shouldUpdateFrame = (this.persistFrame && hasNextFrame) || !this.persistFrame

            if (shouldUpdateFrame) {
                if (hasPreviousFrame) {
                    this.frames[previousFrameIndex].visible = false
                }

                if (hasNextFrame) {
                    this.frames[frameIndex].visible = true
                    this.displayedFrameIndex = frameIndex
                }
            }
        }

        this.currentFrameIndex = frameIndex
    }

    /**
     * Get the index of the currently displayed frame.
     */
    getCurrentFrameIndex(): number {
        return this.displayedFrameIndex
    }
}

/**
 * Displays an overlay over the renderer and shows a progress spinner while the assets load in.
 */
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

/**
 * Displays an overlay over the renderer and shows a progress spinner while the assets load in.
 */
class HelpOverlay {
    private readonly helpButton: HTMLElement
    private readonly helpText: HTMLElement

    constructor() {
        this.helpButton = document.getElementById("help-button")
        this.helpText = document.getElementById("help-text")

        this.helpButton.addEventListener("mouseenter", () => this.show(), false)
        this.helpButton.addEventListener("mouseleave", () => this.hide(), false)
    }

    addHelpText(text: string) {
        /**
         * Set the help text. The text can contain HTML code.
         */
        this.helpText.innerHTML = text
        this.hide()
    }

    show() {
        this.helpText.style.display = 'block'
    }

    hide() {
        this.helpText.style.display = 'none'
    }

}

const createRenderer = (width: number, height: number): THREE.WebGLRenderer => {
    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(width, height)
    document.body.appendChild(renderer.domElement)

    renderer.setClearColor(0x000000, 1)
    renderer.outputEncoding = THREE.sRGBEncoding

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
    stats.dom.hidden = true

    return stats
}

const getVideoFolder = (): string => {
    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    let videoFolder: string

    if (urlParams.has('video')) {
        videoFolder = `video/${urlParams.get('video')}`
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

const saveJSON = (content, fileName, contentType = 'text/plain') => {
    var a = document.createElement("a");
    var file = new Blob([JSON.stringify(content)], {type: contentType});
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

interface Vector3 {x: number, y: number, z: number}
interface Vector4 {
    x: number,
    y: number,
    z: number,
    w: number
}

interface Pose {
    position: Vector3,
    rotation: Vector4
}

const decompose = (poseMatrix) => {
    const position = new THREE.Vector3()
    const rotation = new THREE.Quaternion()

    position.setFromMatrixPosition(poseMatrix)
    rotation.setFromRotationMatrix(poseMatrix)

    return {
        position: position,
        rotation: rotation
    }
}
const getPoseJSON = (poseMatrix): Pose => {
    const {position, rotation} = decompose(poseMatrix)

    return {
        'position': {
            'x': position.x,
            'y': position.y,
            'z': position.z
        },
        'rotation': {
            'x': rotation.x,
            'y': rotation.y,
            'z': rotation.z,
            'w': rotation.w
        }
    }
}

const updateMetadata = (camera, metadata) => {
    let newMetadata = {...metadata}

    newMetadata.pose = getPoseJSON(camera.matrixWorld)

    console.debug(`Camera Pose: ${JSON.stringify(newMetadata.pose)}`)

    saveJSON(newMetadata, 'metadata.json')
}

/**
 * Reset the position and orientation of a group.
 *
 * The group is moved down to that (what is hopefully) the center of the mesh is at eye level.
 * @param group The group that holds all the scene geometry.
 */
const resetGroupPose = (group) => {
    group.position.set(0.0, -1.5, 0.0)
    group.quaternion.set(0.0, 0.0, 0.0, 1.0)
}

/**
 * Resets a camera, its controls, and the group that holds the scene geometry to the default head-on view.
 * @param camera The `PerspectiveCamera` object that is responsible for rendering the scene (on desktop, not XR).
 * @param group The group that holds all the scene geometry.
 * @param controls The orbit controls for `camera`.
 */
const resetCamera = (camera, group, controls) => {
    controls.reset()

    camera.position.set(0.0, 0.0, 0.0)
    camera.quaternion.set(0.0, 0.0, 0.0, 1.0)

    camera.position.setZ(-1.5)
    camera.lookAt(0, 0, 0)

    resetGroupPose(group)
}


/** Mapping of keyboard strokes and their key codes. */
const keyCodes = {
    'space': 32,
    'c': 67,
    'g': 71,
    'l': 76,
    'p': 80,
    'r': 82,
    's': 83,
    'j': 74
}
const printKeyboardShortcuts = keyBindings => {
    console.info("Keyboard shortcuts:")

    for (const key in keyCodes) {
        const keyCode = keyCodes[key]

        if (keyBindings.hasOwnProperty(keyCode)) {
            console.info(`${key}: ${keyBindings[keyCode].description}`)
        }
    }
}

const formatControls = (keyBindings, keyCodes) => {
    let helpText = "<h2>Mouse Controls</h2>" +
        "<ul>" +
        "<li>[Left Click] + [Drag]: Adjust viewing angle</li>" +
        "<li>[Right Click] + [Drag]: Pan camera</li>" +
        "<li>[Scroll Wheel]: Zoom camera</li>" +
        "</ul>" +
        "<h2>Keyboard Controls</h2>" +
        "<ul>"

    for (const key in keyCodes) {
        const keyCode = keyCodes[key]

        if (keyBindings.hasOwnProperty(keyCode)) {
            helpText += `<li>[${key.toUpperCase()}]: ${keyBindings[keyCode].description}</li>`
        }
    }

    helpText += "</ul>"

    return helpText
}

function init() {
    const videoFolder = getVideoFolder()
    document.title = `HIVE | ${videoFolder}`

    const loadingOverlay = new LoadingOverlay()
    loadingOverlay.show()

    loadMetadata(videoFolder).then(metadata => {
        const canvasWidth = window.innerWidth
        const canvasHeight = window.innerHeight
        const fieldOfView = metadata.hasOwnProperty('fov_y') ? metadata['fov_y'] : 60
        const aspectRatio = metadata.hasOwnProperty('aspect_ratio') ? metadata['aspect_ratio'] : canvasWidth / canvasHeight

        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(fieldOfView, aspectRatio, 0.1, 1000)
        const renderer = createRenderer(canvasWidth, canvasHeight)
        const controls = createControls(camera, renderer)
        const stats = createStatsPanel()
        const userGroup = new THREE.Group()

        let useCachedPose = true
        let isPlaying = true
        let showStats = false

        const keyBindings = {
            [keyCodes.space]: {
                description: "Pause/play the video.",
                action: () => {
                    isPlaying = !isPlaying
                    console.info(`Video is now ${isPlaying ? "playing" : "paused"}.`)
                }
            },
            // On some platforms, `space` will enter/exit XR mode,
            [keyCodes.j]: {
                description: "Pause/play the video.",
                action: () => {
                    isPlaying = !isPlaying
                }
            },
            [keyCodes.c]: {
                description: "Reset the camera's position and rotation.",
                action: () => {
                    console.info("Resetting camera position...")
                    resetCamera(camera, userGroup, controls)
                }
            },
            [keyCodes.l]: {
                description: "Toggle whether to use camera pose from metadata for XR headset.",
                action: () => {
                    useCachedPose = !useCachedPose
                    console.info(`Using cached pose from metadata is: ${useCachedPose ? "enabled" : "disabled"}.`)
                }
            },
            [keyCodes.r]: {
                description: "Restart the video playback.",
                action: () => {
                    console.info("Restarting video playback...")
                    staticElements.reset()
                    dynamicElements.reset()
                    isPlaying = true
                }
            },
            [keyCodes.p]: {
                description: "Save the camera's pose and metadata to disk.",
                action: () => {
                    console.info("Saving metadata with camera pose...")
                    updateMetadata(camera, metadata)
                }
            },
            [keyCodes.g]: {
                description: "Go to a particular frame.",
                action: () => {
                    let frameIndex = prompt(`Which frame do you want to view? (0-${metadata["num_frames"] - 1})`, `${dynamicElements.getCurrentFrameIndex()}`)
                    goToFrame(frameIndex)
                }
            },
            [keyCodes.s]: {
                description: "Show/hide the framerate statistics.",
                action: () => {
                    showStats = !showStats
                    stats.dom.hidden = !showStats
                }
            }
        }

        const goToFrame = (frameIndexString?: string) => {
            try {
                let frameIndex = parseInt(frameIndexString)

                console.log(`Going to frame ${frameIndex}...`)
                staticElements.goToFrame(frameIndex)
                dynamicElements.goToFrame(frameIndex)
                isPlaying = false
            } catch (e) {
                console.error(`Could not go to frame ${frameIndexString}.`)
            }
        }

        const help = new HelpOverlay()
        help.addHelpText(formatControls(keyBindings, keyCodes))

        const onDocumentKeyDown = (event) => {
            const keyCode = event.which

            if (keyBindings.hasOwnProperty(keyCode)) {
                keyBindings[keyCode].action()
            } else {
                console.debug(`Key ${keyCode} pressed.`)
            }
        }
        document.addEventListener("keydown", onDocumentKeyDown, false)

        const loader = new GLTFLoader()
        const dracoLoader = new DRACOLoader()
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
        loader.setDRACOLoader( dracoLoader )

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

        if (metadata.hasOwnProperty("add_ground_plane") && metadata["add_ground_plane"] === true) {
            scene.add(getGroundPlane(100, 100))
        }

        if (metadata.hasOwnProperty("add_sky_box") && metadata["add_sky_box"] === true) {
            scene.background = loadSkybox()
        }

        const clock = new THREE.Clock()

        // we add an ambient light source to the scene
        scene.add(new THREE.AmbientLight(0xffffff));
        scene.add(userGroup)

        const onSceneLoaded = () => {
            // Ensure that the two clips will be synced
            const numFrames = metadata["num_frames"] ?? Math.max(staticElements.numFrames, dynamicElements.numFrames)

            for (const scene of [dynamicElements, staticElements]) {
                scene.numFrames = numFrames
                scene.addMeshes(userGroup)
                scene.reset()
            }

            resetCamera(camera, userGroup, controls)

            renderer.xr.enabled = true
            renderer.xr.setReferenceSpaceType('local')
            document.body.appendChild(VRButton.createButton(renderer))

            printKeyboardShortcuts(keyBindings)

            loadingOverlay.hide()

            clock.start()
        }

        // This is used to keep track of the camera pose before entering XR.
        let desktopCameraPose = null

        // Have to use `xr` as type any as a workaround for no property error for `addEventListener` on `renderer.xr`.
        const xr: any = renderer.xr

        xr.addEventListener('sessionstart', () => {
            desktopCameraPose = camera.matrixWorld.clone()

            const pose = decompose(desktopCameraPose)

            let xrCameraPosition = pose.position
            let xrCameraRotation = pose.rotation

            if (useCachedPose && metadata.hasOwnProperty('pose')) {
                const {position, rotation} = metadata.pose

                xrCameraPosition = new THREE.Vector3(position.x, position.y, position.z)
                xrCameraRotation = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
            }

            const inverse_rotation = xrCameraRotation.conjugate()
            const translation = xrCameraPosition.negate().applyQuaternion(inverse_rotation)

            userGroup.quaternion.multiplyQuaternions(inverse_rotation, userGroup.quaternion)
            userGroup.position.addVectors(userGroup.position, translation)

            dynamicElements.reset()
            staticElements.reset()

            console.debug("Entered XR mode.")
        })

        xr.addEventListener('sessionend', () => {
            resetGroupPose(userGroup)

            if (desktopCameraPose != null) {
                const {position, rotation} = decompose(desktopCameraPose)
                camera.position.copy(position)
                camera.quaternion.copy(rotation)
            }

            console.debug("Exited XR mode.")
        })

        renderer.setAnimationLoop(() => {
            stats.begin()

            if (loadingOverlay.isVisible && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                onSceneLoaded()
            }

            const delta = clock.getDelta()

            if (isPlaying) {
                dynamicElements.update(delta)
                staticElements.update(delta)
            }

            controls.update()

            renderer.render(scene, camera)

            stats.end()
        })
    })
        .catch(() => alert("An error occurred when trying to load the video."))
}
