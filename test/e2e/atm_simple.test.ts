import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { expect, test } from 'vitest'

// Jest tips
// Run specific suite: npm t -- testsuite.test.ts
// Run specific test: npm t -- testsuite.test.ts -t "test-name" 

type RootFsmScheme = {
    states: {
        'home': {
            context: {}
        },
        'pin_entry': {
            context: {cardNumber:string}
        },
        'account_actions': {
            context: {accountNumber:string}
        }
    },
    events: {
        "card_inserted" : {cardNumber:string},
        "pin_entered" : {pin:string}
    }
}

function buildRootState(): Fsm<RootFsmScheme> {
    let builder = new FsmBuilder<RootFsmScheme>();
    builder.simpleState('home')
        .transition('card_inserted', 'pin_entry', (c, e) => {
            return {cardNumber:e.cardNumber}
        })
    builder.simpleState('pin_entry')
        .transition('pin_entered', 'account_actions', (c, e) => {
            return {accountNumber: ""}
        })    
    return builder.build();
}
 
test("expect pin_entry when card_inserted given home", () => {
    let pinEntryStateEnterEffectCalled = false;

    let fsm = buildRootState();
    fsm.setEntryEffect('pin_entry', c => {
        pinEntryStateEnterEffectCalled = true;
    })
    
    fsm.init('home', {})
    expect('home').toBe(fsm.getCurrentState());

    fsm.processEvent('card_inserted', {cardNumber:""})
    expect('pin_entry').toBe(fsm.getCurrentState());
    expect(true).toBe(pinEntryStateEnterEffectCalled);
});

test("expect account_actions when pin_entered given pin_entry", () => {
    let fsm = buildRootState();    

    fsm.init('pin_entry', {cardNumber:""})
    expect('pin_entry').toBe(fsm.getCurrentState());

    fsm.processEvent('pin_entered', {pin:""})
    expect('account_actions').toBe(fsm.getCurrentState());
});

/*
test("works with a deep object", () => {
    expect(100).toBe(99 + 1);
});*/

//npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.ts(2582)