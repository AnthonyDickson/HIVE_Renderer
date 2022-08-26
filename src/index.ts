// @ts-ignore
import * as THREE from 'three'
// @ts-ignore
import ThreeMeshUI from 'three-mesh-ui';
// @ts-ignore
import {TrackballControls} from 'three/examples/jsm/controls/TrackballControls.js'
// @ts-ignore
import VRControl from './utils/VRControl.js';
// @ts-ignore
import {HoveredButton, IdleButton, SelectedButtonAttributes, ButtonOptions} from './UIConstants';
// @ts-ignore
import Stats from "three/examples/jsm/libs/stats.module.js"
// @ts-ignore
import {VRButton} from 'three/examples/jsm/webxr/VRButton.js'
// @ts-ignore
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'

// global variables
let vrControl, camera, renderer;
let clock = new THREE.Clock();
let selectState = false;
let touchState = false;
const raycaster = new THREE.Raycaster();
const objsToTest = [];

// set up the mouse
const mouse = new THREE.Vector2();
mouse.x = mouse.y = null;

window.addEventListener( 'pointermove', ( event ) => {
	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = -( event.clientY / window.innerHeight ) * 2 + 1;
} );

window.addEventListener( 'pointerdown', () => {
	selectState = true;
} );

window.addEventListener( 'pointerup', () => {
	selectState = false;
} );

window.addEventListener( 'resize', onWindowResize );

window.addEventListener( 'touchstart', ( event ) => {

	touchState = true;
	mouse.x = ( event.touches[ 0 ].clientX / window.innerWidth ) * 2 - 1;
	mouse.y = -( event.touches[ 0 ].clientY / window.innerHeight ) * 2 + 1;

} );

window.addEventListener( 'touchend', () => {

	touchState = false;
	mouse.x = null;
	mouse.y = null;

} );

// when the window loads this calls the init() function
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

    /** The current frame position in the video sequence. */
    private currentFrameIndex: number

    /** The index of the currently displayed frame (null if no frame is currently displayed). */
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

    // 
    clear() {
        this.currentFrameIndex = 0
    }

	// Returns the current frame index.
	getCurrentFrameIndex(): number {
		return this.currentFrameIndex;
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
	document.body.appendChild( renderer.domElement )

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

function createButton(name: string = null, imageURL: string = null, func: any): any {
    
    const button = new ThreeMeshUI.Block(ButtonOptions);

    if (imageURL) {
        new THREE.TextureLoader().load(imageURL, (texture) => {
            button.set({
              backgroundTexture: texture,
            });
        });
    }

    if (name) {
        button.add(
            new ThreeMeshUI.Text({content: name})
        );
    }

    button.setupState({
        state: "selected",
        attributes: SelectedButtonAttributes,
        onSet: func
    });

    button.setupState(HoveredButton);
    button.setupState(IdleButton);

    return button;
}

function createContainer(position: THREE.Vector3, xrot: number = -0.55) {
    const container = <THREE.Object3D>new ThreeMeshUI.Block({
        justifyContent: 'center',
        alignContent: 'center',
        contentDirection: 'row-reverse',
        fontFamily: './assets/Roboto-msdf.json',
        fontTexture: './assets/Roboto-msdf.png',
        fontSize: 0.07,
        padding: 0.02,
        borderRadius: 0.11
    });
    container.position.set(position.x, position.y, position.z);
    container.rotation.x = xrot;
    container.name = "ButtonContainer";
    return container;
}

// Called in the loop, get intersection with either the mouse or the VR controllers,
// then update the buttons states according to result

function updateButtons() {

	// Find closest intersecting object

	let intersect;

	if ( renderer.xr.isPresenting ) {

		vrControl.setFromController( 0, raycaster.ray );

		intersect = raycast();

		// Position the little white dot at the end of the controller pointing ray
		if ( intersect ) vrControl.setPointerAt( 0, intersect.point );

	} else if ( mouse.x !== null && mouse.y !== null ) {

		raycaster.setFromCamera( mouse, camera );

		intersect = raycast();

	}

	// Update targeted button state (if any)

	if ( intersect && intersect.object.isUI ) {

		if ( selectState ) {

			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'selected' );

		} else {

			// Component.setState internally call component.set with the options you defined in component.setupState
			intersect.object.setState( 'hovered' );

		}

	}

	// Update non-targeted buttons state

	objsToTest.forEach( ( obj ) => {

		if ( ( !intersect || obj !== intersect.object ) && obj.isUI ) {

			// Component.setState internally call component.set with the options you defined in component.setupState
			obj.setState( 'idle' );

		}

	} );

}

// calculates rays
function raycast() {

	return objsToTest.reduce( ( closestIntersection, obj ) => {

		const intersection = raycaster.intersectObject( obj, true );

		if ( !intersection[ 0 ] ) return closestIntersection;

		if ( !closestIntersection || intersection[ 0 ].distance < closestIntersection.distance ) {

			intersection[ 0 ].object = obj;

			return intersection[ 0 ];

		}

		return closestIntersection;

	}, null );

}

// pause button. if the video is currently playing, pause the playback, if 
// the video is currently paused, resume playback.
function buttonPause(){
    console.log("the pause button has been clicked");

    if(clock.running) {
        clock.stop();
    } else {
        clock.start();
    }
}

// stop button. pauses the foreground and background animation and resets
// the current frame to the first frame in the sequence.
function buttonStop(){
    console.log("the stop button has been clicked");
	clock.stop();

    // TODO:
    // is the stop button missing functionality? should the
    // stop button reset the current animation back to the beginning?
}

// play button. if the animation is paused, resume the playback, otherwise
// do nothing!
function buttonPlay(){
    console.log("the play button has been clicked");
    clock.start();
}

// start button. resets the current frame to the first frame in the sequence
// and plays
function buttonStart(){
    console.log("the start button has been clicked");
    clock.start();
}

// onWindowResize will be called when the window is resized
function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );

}

function init() {
    const canvasWidth = window.innerWidth
    const canvasHeight = window.innerHeight
    const scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(60, canvasWidth / canvasHeight, 0.1, 1000)
    renderer = createRenderer(canvasWidth, canvasHeight)
    const controls = createControls(camera, renderer)
    const stats = createStatsPanel()

    const resetCamera = () => {

        // the trackball controls will always be centered on (0, 0, 0)

        controls.reset()
        camera.position.set(0, 0, -1)

        // this means we must move the scene instead of the camera to get the controls
        // to work with the center
        scene.position.y = -1.5
    }

    // initialise VR controllers
    vrControl = VRControl( renderer, camera, scene );

    const controllers = new THREE.Group();

    controllers.add( vrControl.controllerGrips[ 0 ], vrControl.controllers[ 0 ] );

    vrControl.controllers[ 0 ].addEventListener( 'selectstart', () => {

        selectState = true;

    } );
    vrControl.controllers[ 0 ].addEventListener( 'selectend', () => {

        selectState = false;

    } );

    controllers.add( vrControl.controllerGrips[ 1 ], vrControl.controllers[ 1 ] );

    vrControl.controllers[ 1 ].addEventListener( 'selectstart', () => {

        selectState = true;

    } );
    vrControl.controllers[ 1 ].addEventListener( 'selectend', () => {

        selectState = false;

    } );

    // since we move the scene to be "centered" on the trackball controller,
    // we need to move the controllers to match the new scene location
    controllers.translateY(1.5);

    scene.add(controllers);
    // end of initialising VR controllers

    // setup the VR camera if in VR
    //
    // the VR camera by default starts in a strange (x, y, z) 
    // and faces in the wrong direction (needs rotation towards the objects)
    //renderer.xr.getCamera().cameras[0].position.x = 10;
    //renderer.render( scene, renderer.xr.getCamera().cameras[0] );

    const onDocumentKeyDown = (event) => {
        const keyCode = event.which;
        switch (keyCode) {
            case 82: { // the key 'r'
                resetCamera()
                break
            }
            case 80: { // the key 'p'
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

    // TODO:
    // add catalogue functionality here
    const videoFolder = getVideoFolder()
    document.title = `3D Video | ${videoFolder}`

    const loadingOverlay = new LoadingOverlay()
    loadingOverlay.show()

    loadMetadata(videoFolder).then(metadata => {
        const loader = new GLTFLoader()
        const swapMeshInterval = 1.0 / metadata["fps"] // seconds

        // loads the dynamic elements aka foreground
        const dynamicElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: "fg",
            useVertexColour: false,
            persistFrame: false
        }).load()

        // loads the static elements aka background
        const staticElements = new MeshVideo({
            swapMeshInterval,
            loader,
            videoBaseFolder: videoFolder,
            sceneName: 'bg',
            useVertexColour: metadata["use_vertex_colour_for_bg"],
            persistFrame: true
        }).load()

        // add white plane as floor
        scene.add(getGroundPlane(100, 100))

        // add nice clouds as background
        scene.background = loadSkybox()

        // setup the button panel
		let buttonContainer = createContainer(new THREE.Vector3(0, 1, 0));
        
        let buttons = [
			createButton(null, "./assets/pause.png", () => {buttonPause()}),
            createButton(null, "./assets/stop.png", () => {buttonStop(), dynamicElements.clear(), dynamicElements.update(0.25, scene), 
                staticElements.update(0.25, scene)}),
            createButton(null, "./assets/play.png", () => {buttonPlay()}),
            createButton(null, "./assets/start.png", () => {buttonStart(), dynamicElements.clear()})
		];
		buttons.forEach(button => buttonContainer.add(button));
		buttons.forEach(button => objsToTest.push(button));

        let buttonGroup = new THREE.Group();
        buttonGroup.add(buttonContainer);
        buttonContainer.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), THREE.MathUtils.DEG2RAD * -180);

        scene.add(buttonGroup);

        // setup information panel
        const informationContainer = new ThreeMeshUI.Block( {
            width: 1.2,
            height: 0.5,
            padding: 0.05,
            justifyContent: 'center',
            textAlign: 'left',
            fontFamily: './assets/Roboto-msdf.json',
            fontTexture: './assets/Roboto-msdf.png'
        } );
    
        informationContainer.position.set( 0, 0.65, -0.2 );
        informationContainer.rotation.x = -0.55;
        scene.add( informationContainer );

        informationContainer.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), THREE.MathUtils.DEG2RAD * -180);

        let staticLabel = new ThreeMeshUI.Text( {
            content: 'current frame: ',
            fontSize: 0.055
        })

        let dynamicLabel = new ThreeMeshUI.Text( {
            content: dynamicElements.getCurrentFrameIndex(),
            fontSize: 0.055
        })
    
        informationContainer.add(staticLabel, dynamicLabel);

        let x = 0

        renderer.setAnimationLoop(() => {
            stats.begin()

            x = dynamicElements.getCurrentFrameIndex();

            dynamicLabel.set( {
                content: '' + x,
                fontSize: 0.055
            } );

            ThreeMeshUI.update()

            // loading block
            if (loadingOverlay.isVisible && dynamicElements.hasLoaded && staticElements.hasLoaded) {
                // Ensure that the two clips (fg and bg) will be synced
                const numFrames = Math.max(staticElements.numFrames, dynamicElements.numFrames)
                dynamicElements.numFrames = numFrames
                staticElements.numFrames = numFrames

                dynamicElements.reset()
                staticElements.reset()

                resetCamera()
                loadingOverlay.hide()

                clock.start()

				// renders the initial scene when the program is loaded
				dynamicElements.update(0.1, scene)
                staticElements.update(0.1, scene)

                clock.stop()
            }

            const delta = clock.getDelta()

			dynamicElements.update(delta, scene)
            staticElements.update(delta, scene)
            
            controls.update()

            renderer.render(scene, camera)

			updateButtons()

            stats.end()
        })
    })
    .catch(() => alert("An error occurred when trying to load the video."))
}