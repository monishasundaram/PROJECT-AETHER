import { GestureBus } from '@aether/three-engine'

/** Single bus connecting the vision loop (publisher) to the 3D workspace (consumer). */
export const gestureBus = new GestureBus()