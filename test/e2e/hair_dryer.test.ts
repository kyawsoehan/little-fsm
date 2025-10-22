import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { NoContext, retainContext } from "../../src/FsmHelpers"
import { expect, test } from 'vitest'

// Jest tips
// Run specific suite: npm t -- testsuite.test.ts
// Run specific test: npm t -- testsuite.test.ts -t "test-name" 

type HairDryerContext = {
    heat: number,
    speed: number
}

type RootFsmScheme = {
    states: {
        'off': {
            context: HairDryerContext
        },
        'low': {
            context: HairDryerContext
        },
        'high': {
            context: HairDryerContext
        }
    },
    events: {
        "press" : {}
    }
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('off')
        .transition('press', 'low', (c, e) => {
            return {speed: 5, heat: 5}
        })
    builder.simpleState('low')
        .transition('press', 'high', (c, e) => {
            return {speed: 10, heat: 10}
        })    
    builder.simpleState('high')
        .transition('press', 'off', (c, e) => {
            return {speed: 0, heat: 0}
        })    
    return builder.build();
}
 
test("expect off when initiated", () => {

    let fsm = buildRootState();
    
    fsm.init('off', {heat:0, speed:0});
    expect('off').toBe(fsm.getCurrentState());

    fsm.processEvent('press', {});
    expect('low').toBe(fsm.getCurrentState());

    fsm.processEvent('press', {});
    expect('high').toBe(fsm.getCurrentState());
    expect(10).toBe(fsm.getCurrentStateContext('high').heat);
});
