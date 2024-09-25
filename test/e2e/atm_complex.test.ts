//import { greet } from './greet';

import { Fsm } from "../../src/Fsm"
import { FsmBuilder, SubFsmBuilder } from "../../src/FsmBuilder"
import { expect, test } from 'vitest'

type RootFsmScheme = {
    states: {
        'home': {
            context: {},
            substates: ['initial'],
            events: {        
                'card_inserted': {}
            }
        },
        'auth': {
            context: {},
            substates: ['pin_entry'],
            events: {        
                'pin_entered': {}
            }
        }
    },
    events: {
        "back" : {}
    }
}

function buildHomeState() : SubFsmBuilder<RootFsmScheme['states']['home']> {
    let subBuilder = new SubFsmBuilder<RootFsmScheme['states']['home']>();     
    subBuilder.entrySubstate('initial');
    subBuilder.substate('initial').completion('card_inserted', (c, e) => c);        
    return subBuilder;
}

function buildAuthState() : SubFsmBuilder<RootFsmScheme['states']['auth']> {
    let subBuilder = new SubFsmBuilder<RootFsmScheme['states']['auth']>();     
    subBuilder.entrySubstate('pin_entry');
    subBuilder.substate('pin_entry').completion('pin_entered', (c, e) => c);        
    return subBuilder;
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.compositeState('home', buildHomeState())
        .transitionOnCompletion('auth', c => c)
    builder.compositeState('auth', buildAuthState())
    return builder.build();
}
 
/*
test("works with a shallow object", () => {
    let fsm = buildRootState();
    fsm.init('home', {})

    expect('home').toBe(fsm.getCurrentState());

    let homeFsm = fsm.subFsm('home');
    homeFsm.processEvent('card_inserted', {})

    expect('auth').toBe(fsm.getCurrentState());
}); */


test("works with a deep object", () => {
    expect(100).toBe(99 + 1);
});

//npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.ts(2582)