// @ts-ignore
import * as THREE from 'three';
// @ts-ignore
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js";
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js';
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

window.onload = () => {
    init();
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

    const controls = new TrackballControls( camera, renderer.domElement );

    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;

    scene.add(new THREE.AmbientLight(0xffffff));
    let directionalLight = new THREE.DirectionalLight(0xffffff, 100);
    directionalLight.position.set(1, 1, -1)
    scene.add(directionalLight)

    const loader = new GLTFLoader();
    let timeSinceLastMeshSwap = 0.0;
    // TODO: Load framerate from disk.
    const swapMeshInterval = 1.0 / 30.0; // seconds
    const clock = new THREE.Clock()
    clock.start()

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    let videoBaseFolder: String;

    if (urlParams.has('video')) {
        videoBaseFolder = urlParams.get('video')
    } else {
        videoBaseFolder = '.'
    }

    const frames = {}
    let currentFrameIndex = -1
    let numFrames = -1
    const loaderGUI = document.getElementById("loader-overlay")
    const rendererGUI = document.getElementById("container")

    const showLoader = () => {
        loaderGUI.style.display = 'block'
        rendererGUI.style.display = 'none'
    }

    const hideLoader = () => {
        loaderGUI.style.display = 'none'
        rendererGUI.style.display = 'block'
    }

    let isFGLoaded = false
    let isBGLoaded = false

    showLoader()

    loader.load( `${videoBaseFolder}/scene3d/model.gltf`, function ( gltf ) {
        console.log(gltf)
        console.log(gltf.scene.children[0].children as unknown as Array<THREE.Mesh>)

        for (const mesh of gltf.scene.children[0].children as unknown as Array<THREE.Mesh>) {
            // Objects will either of type "Mesh" or "Object3D". The latter occurs when there is no mesh.
            if (mesh.type == "Mesh") {
                mesh.material = new THREE.MeshBasicMaterial({map: (mesh.material as THREE.MeshStandardMaterial).map})

                const frame_number = parseInt(mesh.name)
                frames[frame_number] = mesh

                if (currentFrameIndex < 0) {
                    currentFrameIndex = frame_number
                }

                if (frame_number > numFrames) {
                    numFrames = frame_number
                }
            }
        }

        scene.add(frames[currentFrameIndex])

        isFGLoaded = true

        if (isBGLoaded) {
            hideLoader()
        }

    }, undefined, function ( error ) {

        console.error( error );

    } );

    loader.load( `${videoBaseFolder}/scene3d_bg/model.gltf`, function ( gltf ) {

        for (const mesh of gltf.scene.children[0].children as unknown as Array<THREE.Mesh>) {
            mesh.material = new THREE.MeshBasicMaterial({map: (mesh.material as THREE.MeshStandardMaterial).map})
            mesh.material.vertexColors = true
            scene.add(mesh)
        }

        console.log(gltf)

        isBGLoaded = true

        if (isFGLoaded) {
            hideLoader()
        }


    }, undefined, function ( error ) {

        console.error( error );

    } );

    renderer.setAnimationLoop(function () {
        stats.begin()

        timeSinceLastMeshSwap += clock.getDelta();

        if (timeSinceLastMeshSwap > swapMeshInterval && numFrames > 0) {
            timeSinceLastMeshSwap = 0.0;

            const previousFrameIndex = currentFrameIndex
            currentFrameIndex = (currentFrameIndex + 1) % numFrames

            if (frames.hasOwnProperty(previousFrameIndex)) {
                scene.remove(frames[previousFrameIndex]);
            }

            if (frames.hasOwnProperty(currentFrameIndex)) {
                scene.add(frames[currentFrameIndex])
            }
        }

        controls.update()
        renderer.render(scene, camera);

        stats.end()
    });
}
