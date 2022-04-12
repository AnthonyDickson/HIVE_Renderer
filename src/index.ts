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

    constructor({swapMeshInterval, loader, videoBaseFolder, sceneName = 'scene3d', useVertexColour = false, persistFrame = false}) {
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
    load() : MeshVideo {
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

function init() {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
    camera.lookAt(0, 0, 0)
    camera.position.z = -5

    const renderer = new THREE.WebGLRenderer()
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    renderer.setClearColor(0x000000, 1)
    renderer.xr.enabled = true
    renderer.xr.setReferenceSpaceType('local')
    document.body.appendChild(VRButton.createButton(renderer))

    const stats = Stats()
    stats.showPanel(0) // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom)


    const controls = new TrackballControls(camera, renderer.domElement)

    controls.rotateSpeed = 1.0
    controls.zoomSpeed = 1.0
    controls.panSpeed = 0.8

    const queryString = window.location.search
    const urlParams = new URLSearchParams(queryString)
    let videoBaseFolder: String

    if (urlParams.has('video')) {
        videoBaseFolder = urlParams.get('video')
    } else {
        videoBaseFolder = '.'
    }

    const loaderGUI = document.getElementById("loader-overlay")
    const rendererGUI = document.getElementById("container")
    let isLoaderShowing = false

    const showLoader = () => {
        loaderGUI.style.display = 'block'
        rendererGUI.style.display = 'none'
        isLoaderShowing = true
    }

    const hideLoader = () => {
        loaderGUI.style.display = 'none'
        rendererGUI.style.display = 'block'
        isLoaderShowing = false
    }

    showLoader()

    async function loadMetadata() {
        const response = await fetch(`${videoBaseFolder}/metadata.json`)
        return await response.json()
    }

    loadMetadata().then(metadata => {
        const loader = new GLTFLoader()
        const swapMeshInterval = 1.0 / metadata["fps"] // seconds
        const dynamicElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder,
            sceneName: "fg",
            useVertexColour: false,
            persistFrame: false
        }).load()

        const staticElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder,
            sceneName: 'bg',
            useVertexColour: metadata["use_vertex_colour_for_bg"],
            persistFrame: true
        }).load()

        const clock = new THREE.Clock()

        renderer.setAnimationLoop(() => {
            stats.begin()

            if (isLoaderShowing && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                // Ensure that the two clips will be synced
                const numFrames = Math.max(staticElements.numFrames, dynamicElements.numFrames)
                dynamicElements.numFrames = numFrames
                staticElements.numFrames = numFrames

                dynamicElements.reset()
                staticElements.reset()

                scene.remove.apply(scene, scene.children)

                hideLoader()

                clock.start()
            }

            const delta = clock.getDelta()

            dynamicElements.update(delta, scene)
            staticElements.update(delta, scene)

            controls.update()

            renderer.render(scene, camera)

            stats.end()
        })
    })
}
