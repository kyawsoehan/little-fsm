import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { NoContext, retainContext } from "../../src/FsmHelpers"
import { expect, test } from 'vitest'

// Jest tips
// Run specific suite: npm t -- testsuite.test.ts
// Run specific test: npm t -- testsuite.test.ts -t "test-name" 

type RootFsmScheme = {
    states: {
        'idle': {
            context: {}
        },
        'uploading': {
            context: {
                fileName: string
            }
        }
    },
    events: {
        "started" : {
            fileName: string
        },
        "completed" : {},
    }
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('idle')
        .transition('started', 'uploading', (c, e) => {
            return {fileName: e.fileName}
        });
    builder.simpleState('uploading')
        .transition('completed', 'idle', (c, e) => {
            return {}
        });
    return builder.build();
}
 
test("expect off when initiated", () => {

    let fsm = buildRootState();
    
    fsm.init('idle', {});
    expect('idle').toBe(fsm.getCurrentState());

    fsm.processEvent('started', {fileName: "photo.jpeg"});
    expect('uploading').toBe(fsm.getCurrentState());

    fsm.processEvent('completed', {});
    expect('idle').toBe(fsm.getCurrentState());
});
