import { CreepRecord, SquadRecord } from 'coreLib/memory';
import { Memory } from 'coreLib/memory';
import { ATTACK, HEAL, MOVE, RANGED_ATTACK } from 'game/constants';
import { searchPath } from 'game/path-finder';
import { Creep, Structure, StructureSpawn } from 'game/prototypes';
import { getObjectById, getObjectsByPrototype } from 'game/utils';

const trooperTemplate = [
  ...Array(4).fill(MOVE),
  ...Array(3).fill(RANGED_ATTACK),
  ...Array(1).fill(HEAL),
];
const squadSize = 2;
export class CombatManager {
  private static buildSquads(memory: Memory, mySpawn: StructureSpawn): Memory {
    let workingUpSquad = memory.mySquads.find((s) => !s.active);
    if (workingUpSquad) {
      // build out squad
      const spawning = mySpawn.spawnCreep(trooperTemplate).object;
      if (spawning) {
        const newTrooper: CreepRecord = {
          creep: spawning,
          memory: {
            role: 'trooper',
          },
        };
        const newSquadCreepList = [...workingUpSquad.creeps, newTrooper];
        workingUpSquad = {
          ...workingUpSquad,
          creeps: newSquadCreepList,
          active: newSquadCreepList.length >= squadSize,
          lead: workingUpSquad.lead || newTrooper.creep.id,
        };
        const newSquadList = memory.mySquads.map((s) =>
          s.id === workingUpSquad?.id ? workingUpSquad : s
        );
        return {
          ...memory,
          myCreeps: [...memory.myCreeps, newTrooper],
          mySquads: newSquadList,
        };
      } else {
        return memory;
      }
    } else {
      // new squad
      const newSquad: SquadRecord = {
        id: Math.random().toString(),
        active: false,
        lead: undefined,
        creeps: [],
      };
      return {
        ...memory,
        mySquads: [...memory.mySquads, newSquad],
      };
    }
  }
  private static runSquad(
    memory: Memory,
    squad: SquadRecord,
    mySpawn: StructureSpawn
  ): Memory {
    const { creeps, lead } = squad;
    // console.log(`Squad: ${squad.id}: `, squad)
    if (
      !squad.active ||
      creeps.some((c) => c.creep.getRangeTo(mySpawn) === 0)
    ) {
      return memory;
    }
    const leadCreep = creeps.find((c) => c.creep.id === lead) || creeps[0];
    const squadCreeps = creeps.filter((c) => c.creep.id !== leadCreep.creep.id);

    // target lock
    const hostileCreeps = getObjectsByPrototype(Creep).filter((c) => !c.my);
    const hostileSpawn = getObjectsByPrototype(StructureSpawn).filter(
      (s) => !s.my
    )[0];

    const targetPos = leadCreep.creep.findClosestByPath(hostileCreeps);
    const target =
      hostileCreeps.find((c) => c.getRangeTo(targetPos) === 0) || hostileSpawn;
    // movement
    const laggingCreeps = creeps.filter(
      (c) => c.creep.getRangeTo(leadCreep.creep) > 1
    );
    const nearbyMeleeCreeps = hostileCreeps.filter(
      (hc) =>
        hc.body.some((b) => b.type === ATTACK) &&
        hc.findInRange(
          creeps.map((mc) => mc.creep),
          2
        ).length > 0
    );
    switch (true) {
      case laggingCreeps.length > 0:
        console.log(`Squad: ${squad.id}: Wait for lagging creep`);
        laggingCreeps.map((c) => c.creep.moveTo(leadCreep.creep));
        break;
      case nearbyMeleeCreeps.length > 0:
        console.log(`Squad: ${squad.id}: Flee Melee`);
        const fleeTarget = searchPath(leadCreep.creep, nearbyMeleeCreeps[0], {
          flee: true,
          range: 2,
        }).path[0];
        leadCreep.creep.moveTo(fleeTarget);
        squadCreeps.map((c) => c.creep.moveTo(leadCreep.creep));
        break;
      case leadCreep.creep.getRangeTo(target) >= 3:
        console.log(`Squad: ${squad.id}: Move to Target`);
        leadCreep.creep.moveTo(target);
        squadCreeps.map((c) => c.creep.moveTo(leadCreep.creep));
        break;
    }
    // firing
    creeps.map((c) => c.creep.rangedAttack(target));
    // healing
    const healTarget = creeps.sort((c) => c.creep.hits)[0];
    creeps.map((c) => c.creep.heal(healTarget.creep));

    const endSquadState = {
      ...squad,
      lead: leadCreep.creep.id,
    };
    return {
      ...memory,
      mySquads: memory.mySquads.map((s) =>
        s.id === endSquadState.id ? endSquadState : s
      ),
    };
  }
  public static run(m: Memory): Memory {
    let memory = m;
    const mySpawn = getObjectsByPrototype(StructureSpawn).filter(
      (s) => s.my
    )[0];
    memory = memory.mySquads.reduce(
      (mem, squad): Memory => this.runSquad(mem, squad, mySpawn),
      memory
    );
    // spawn

    // run

    const post = this.buildSquads(memory, mySpawn);
    return post;
  }
}
