import { Fsm } from "../../src/Fsm"
import { NoContext, retainContext, FsmBuilder } from "../../src/FsmBuilder"
import { expect, test } from 'vitest'

type VendingMachineManifest = {
    states: {
        'idle': NoContext,
        'ready_to_order': NoContext,
        'dispensing': NoContext,
        'refunding': NoContext
    },
    events: {
        "coin_inserted": {},
        "item_selected" : {},
        "dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}

function buildFsm(): Fsm<VendingMachineManifest> {
    let builder = new FsmBuilder<VendingMachineManifest>();

    builder.atomicState('idle')
        .transition('coin_inserted', 'ready_to_order', retainContext);

    builder.atomicState('ready_to_order')
        .transition('item_selected', 'dispensing', retainContext)
        .transition('cancelled', 'refunding', retainContext);

    builder.atomicState('dispensing')
        .transition('dispensed', 'idle', retainContext);

    builder.atomicState('refunding')
        .transition('refunded', 'idle', retainContext);

    return builder.build();
}
 
test("expect initial state to be idle", () => {
    let fsm = buildFsm();    
    fsm.init('idle', {});

    expect('initial').toBe(fsm.getCurrentState());

    fsm.processEvent('coin_inserted', {})
});
