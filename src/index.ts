import * as THREE from 'three';
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls"
import Stats from "three/examples/jsm/libs/stats.module.js";
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js';

window.onload = () => {
    init();
}

function init() {
    const displacementScale = -10.0;
    const displacementBias = -1.0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local');
    document.body.appendChild(renderer.domElement)
    document.body.appendChild(VRButton.createButton(renderer));

    const stats = Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);

    const controls = new OrbitControls(camera, renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff));

    const geometry = new THREE.PlaneGeometry(6.4, 4.8, 320, 240);

    const rgbVideo = document.getElementById("rgb-video") as HTMLVideoElement
    const rgbTexture = new THREE.VideoTexture(rgbVideo)

    const depthVideo = document.getElementById("depth-video") as HTMLVideoElement
    const depthTexture = new THREE.VideoTexture(depthVideo)

    const bgAlphaVideo = document.getElementById("bg-alpha-video") as HTMLVideoElement
    const bgAlphaTexture = new THREE.VideoTexture(bgAlphaVideo)

    const backgroundMaterial = new THREE.MeshPhongMaterial({
        map: rgbTexture, displacementMap: depthTexture,
        alphaMap: bgAlphaTexture, transparent: true,
        displacementScale: displacementScale, displacementBias: displacementBias, flatShading: true, toneMapped: false
    })
    const backgroundMesh = new THREE.Mesh(geometry, backgroundMaterial);
    scene.add(backgroundMesh);

    const object1Video = document.getElementById("object-001-video") as HTMLVideoElement
    const object1Texture = new THREE.VideoTexture(object1Video)

    const foregroundMaterial = new THREE.MeshPhongMaterial({
        map: rgbTexture, displacementMap: depthTexture,
        alphaMap: object1Texture, transparent: true,
        displacementScale: displacementScale, displacementBias: displacementBias, flatShading: true, toneMapped: false
    })
    const foregroundMesh = new THREE.Mesh(geometry, foregroundMaterial);
    scene.add(foregroundMesh);

    camera.position.z = 5;

    renderer.setAnimationLoop(function () {
        stats.begin()

        renderer.render(scene, camera);

        stats.end()
    });
}
