import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { expect, test } from 'vitest'

// Jest tips
// Run specific suite: npm t -- testsuite.test.ts
// Run specific test: npm t -- testsuite.test.ts -t "test-name" 

type OtpFsmManifest = {
    states: {
        'initial': {
            context: {}
        },
        'otp_entry': {
            context: {}
        },
        'verifying_otp': {
            context: {}
        },
        'success': {
            context: {}
        },
        'error': {
            context: {}
        }
    },
    events: {
        "otp_requested": {},
        "otp_submitted" : {otp:string},
        "otp_verified" : {},
        "otp_not_verified" : {},
    }
}

function buildRootState(): Fsm<OtpFsmManifest> {
    let noContextChange = (c, e) => c;
    let builder = new FsmBuilder<OtpFsmManifest>();
    builder.simpleState('initial')
        .transition('otp_requested', 'otp_entry', noContextChange);
    builder.simpleState('otp_entry')
        .transition('otp_submitted', 'verifying_otp', noContextChange);
    builder.simpleState('verifying_otp')
        .transition('otp_verified', 'success', noContextChange);
    builder.simpleState('verifying_otp')
        .transition('otp_not_verified', 'error', noContextChange);

    return builder.build();
}
 
test("expect pin_entry when card_inserted given home", () => {
    let otpEntryStateEnterEffectCalled = false;

    let fsm = buildRootState();
    fsm.setEntryEffect('otp_entry', c => {
        otpEntryStateEnterEffectCalled = true;
    })
    
    fsm.init('initial', {})
    expect('initial').toBe(fsm.getCurrentState());

    fsm.processEvent('otp_requested', {cardNumber:""})
    expect('otp_entry').toBe(fsm.getCurrentState());
    expect(true).toBe(otpEntryStateEnterEffectCalled);
});

test("expect account_actions when pin_entered given pin_entry", () => {
    let fsm = buildRootState();    

    fsm.init('otp_entry', {})
    expect('otp_entry').toBe(fsm.getCurrentState());

    fsm.processEvent('otp_submitted', {otp:""})
    expect('verifying_otp').toBe(fsm.getCurrentState());
});

test("expect success when otp_verified given verifying_otp", () => {
    let fsm = buildRootState();    

    fsm.init('verifying_otp', {})
    expect('verifying_otp').toBe(fsm.getCurrentState());

    fsm.processEvent('otp_verified', {otp:""})
    expect('success').toBe(fsm.getCurrentState());
});

/*
test("works with a deep object", () => {
    expect(100).toBe(99 + 1);
});*/

//npm i --save-dev @types/jest` or `npm i --save-dev @types/mocha`.ts(2582)