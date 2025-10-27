import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { NoContext, retainContext } from "../../src/FsmHelpers"
import { expect, test } from 'vitest'

// Jest tips
// Run specific suite: npm t -- testsuite.test.ts
// Run specific test: npm t -- testsuite.test.ts -t "test-name" 

type RootFsmScheme = {
    states: {
        'in': NoContext,
        'out': NoContext
    },
    events: {
        "press" : {}
    }
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('in')
        .transition('press', 'out', retainContext)
    builder.simpleState('out')
        .transition('press', 'in', retainContext)    
    return builder.build();
}
 
test("expect in when initiated", () => {

    let fsm = buildRootState();
    fsm.setEntryEffect('out', ctx => {
        console.log("Handle entry effect for out");
    })

    fsm.init('in', {});
    expect('in').toBe(fsm.getCurrentState());

    fsm.processEvent('press', {});
    expect('out').toBe(fsm.getCurrentState());
});
