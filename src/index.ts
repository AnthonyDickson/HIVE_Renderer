// @ts-ignore
import * as THREE from 'three';
// @ts-ignore
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls.js';
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js";
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js';
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

window.onload = () => {
    init();
}

class MeshVideo {
    private loader: GLTFLoader
    private readonly videoBaseFolder: string
    private readonly sceneName: string
    private readonly useVertexColour: boolean
    private frames: { number: THREE.Mesh }
    timeSinceLastMeshSwap: number
    private swapMeshInterval: number

    public numFrames: number
    public currentFrameIndex: number
    hasLoaded: boolean

    constructor({swapMeshInterval, loader, videoBaseFolder, sceneName = 'scene3d', useVertexColour = false}) {
        this.loader = loader
        this.videoBaseFolder = videoBaseFolder
        this.sceneName = sceneName
        this.timeSinceLastMeshSwap = 0.0;
        this.swapMeshInterval = swapMeshInterval;
        this.useVertexColour = useVertexColour

        this.currentFrameIndex = -1
        this.numFrames = 0
        this.hasLoaded = false
        // @ts-ignore
        this.frames = {};
    }

    load() {
        this.loader.load(
            `${this.videoBaseFolder}/${this.sceneName}.glb`,
            (gltf) => {
                console.log(gltf)
                console.log(gltf.scene.children[0].children as unknown as Array<THREE.Mesh>)

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
            },
            undefined,
            (error) => {
                console.error(error)
            }
        )

        return this
    }

    update(delta: number, scene: THREE.Scene) {
        if (!this.hasLoaded) {
            return
        }

        this.timeSinceLastMeshSwap += delta;

        if (this.timeSinceLastMeshSwap > this.swapMeshInterval && this.numFrames > 0) {
            this.timeSinceLastMeshSwap = 0.0

            const previousFrameIndex = this.currentFrameIndex
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.numFrames

            if (this.frames.hasOwnProperty(previousFrameIndex)) {
                scene.remove(this.frames[previousFrameIndex])
            }

            if (this.frames.hasOwnProperty(this.currentFrameIndex)) {
                scene.add(this.frames[this.currentFrameIndex])
            }
        }
    }
}

function init() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.setClearColor(0x000000, 1);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    document.body.appendChild(VRButton.createButton(renderer));

    const stats = Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    camera.position.z -= 5

    const controls = new TrackballControls(camera, renderer.domElement);

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;

    scene.add(new THREE.AmbientLight(0xffffff));
    let directionalLight = new THREE.DirectionalLight(0xffffff, 100);
    directionalLight.position.set(1, 1, -1)
    scene.add(directionalLight)

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
        const swapMeshInterval = 1.0 / metadata["fps"]; // seconds
        const dynamicElements = new MeshVideo({swapMeshInterval, loader, videoBaseFolder, sceneName: "fg"}).load()
        const staticElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder,
            sceneName: 'bg',
            useVertexColour: metadata["use_vertex_colour_for_bg"]
        }).load()

        const clock = new THREE.Clock()

        renderer.setAnimationLoop(() => {
            stats.begin()

            if (isLoaderShowing && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                // Ensure that the two clips will be synced
                const numFrames = Math.max(staticElements.numFrames, dynamicElements.numFrames)
                dynamicElements.numFrames = numFrames
                staticElements.numFrames = numFrames

                clock.start()

                hideLoader()
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
