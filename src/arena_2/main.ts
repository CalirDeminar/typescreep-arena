import { getTicks } from "game/utils";

let myCreeps: CreepRecord[] = [];
function init() {
  if(!myCreeps){
    myCreeps = [];
  }
}
export function loop(): void {
  console.log(`The time is ${getTicks()}`);
}
