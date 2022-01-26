// @ts-ignore
import * as THREE from 'three';
// @ts-ignore
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls"
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

    const controls = new OrbitControls(camera, renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff));
    let directionalLight = new THREE.DirectionalLight(0xffffff, 100);
    directionalLight.position.set(1, 1, -1)
    scene.add(directionalLight)

    const loader = new GLTFLoader();
    let meshes = [];
    let currentMeshIndex = 0;
    let timeSinceLastMeshSwap = 0.0;
    // TODO: Load framerate from disk.
    const swapMeshInterval = 1.0 / 30.0; // seconds
    const clock = new THREE.Clock()
    clock.start()
    console.log(currentMeshIndex)

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    let videoBaseFolder: String;

    if (urlParams.has('video')) {
        videoBaseFolder = urlParams.get('video')
    } else {
        videoBaseFolder = 'scene3d'
    }

    loader.load( `${videoBaseFolder}/scene3d/model.gltf`, function ( gltf ) {
        console.log(gltf)
        console.log(gltf.scene.children[0].children as unknown as Array<THREE.Mesh>)

        for (const mesh of gltf.scene.children[0].children as unknown as Array<THREE.Mesh>) {
            mesh.material = new THREE.MeshBasicMaterial({map: (mesh.material as THREE.MeshStandardMaterial).map})
            meshes.push(mesh)

        }

        scene.add(meshes[currentMeshIndex])

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

    }, undefined, function ( error ) {

        console.error( error );

    } );

    camera.position.z = -1

    renderer.setAnimationLoop(function () {
        stats.begin()

        timeSinceLastMeshSwap += clock.getDelta();

        if (timeSinceLastMeshSwap > swapMeshInterval && meshes.length > 0) {
        timeSinceLastMeshSwap = 0.0;
        scene.remove(meshes[currentMeshIndex]);

        currentMeshIndex++;
        currentMeshIndex = currentMeshIndex % meshes.length
        scene.add(meshes[currentMeshIndex])
        }

        renderer.render(scene, camera);

        stats.end()
    });
}
