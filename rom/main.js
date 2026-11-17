import { App } from "./tetris.js";
import { initHandheld } from "./handheld.js";

new App(document.querySelector("#screen")).run();
await initHandheld();
