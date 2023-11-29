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

import * as THREE from 'three';

export let HoveredButton = {
	state: "hovered",
	attributes: {
		offset: 0.035,
		backgroundColor: new THREE.Color(0x999999),
		/* backgroundOpacity: 1, */
		fontColor: new THREE.Color(0xffffff)
	},
	onSet: () => {}
};

export let IdleButton = {
	state: "idle",
	attributes: {
		offset: 0.035,
		backgroundColor: new THREE.Color(0x666666),
		/* backgroundOpacity: 0.3, */
		fontColor: new THREE.Color(0xffffff)
	},
	onSet: () => {}
};

export let SelectedButtonAttributes = {
	offset: 0.02,
	backgroundColor: new THREE.Color(0x777777),
	fontColor: new THREE.Color(0x222222)
};

export const VideoColors = [
	new THREE.Color(0x003f5c),
	new THREE.Color(0x2f4b7c),
	new THREE.Color(0x665191),
	new THREE.Color(0xa05195),
	new THREE.Color(0xd45087),
	new THREE.Color(0xf95d6a),
	new THREE.Color(0xff7c43),
	new THREE.Color(0xffa600)
];

export function getVideoIdleState(index: number) {
	return  {
		state: "idle",
		attributes: {
			offset: 0.035,
			/* backgroundOpacity: 0.3, */
			fontColor: new THREE.Color(0xffffff),
			backgroundColor: VideoColors[index % VideoColors.length],
		},
	};

}

export const VideoHoverState = {
	state: "hovered",
	attributes: {
		offset: 0.035,
		backgroundColor: new THREE.Color(0x999999),
		/* backgroundOpacity: 1, */
		fontColor: new THREE.Color(0xffffff)
	},
};

export const VideoStateSelectedAttributes = {
	offset: 0.02,
	backgroundColor: new THREE.Color(0x777777),
	fontColor: new THREE.Color(0x222222)
};

export const ButtonOptions = {
	width: 0.18,
	height: 0.18,
	justifyContent: 'center',
	alignContent: 'center',
	offset: 0.05,
	margin: 0.02,
	borderRadius: 0.025
};

export class TimelineButtonOptions {
	constructor(public length: number, public color: THREE.Color) {
		this.width = length;
		this.backgroundColor = color;
	}
	width: number;
	height = 0.15;
	justifyContent: 'center';
	alignContent: 'center';
	backgroundColor: THREE.Color;
	offset: 0.05;
	margin: 0.00;
	borderRadius: 0.0;
	hiddenOverflow: true;
}


