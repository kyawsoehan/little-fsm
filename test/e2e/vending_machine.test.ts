import { Fsm } from "../../src/Fsm"
import { FsmBuilder } from "../../src/FsmBuilder"
import { NoContext, retainContext} from "../../src/FsmHelpers"
import { expect, test } from 'vitest'

type VendingMachineManifest = {
    states: {
        'idle': NoContext,
        'ready_to_order': {
            context: {
                balanceAmount:number
            }
        },
        'dispensing': NoContext,
        'refunding': NoContext
    },
    events: {
        "coin_inserted": {insertedAmount:number},
        "item_selected" : {},
        "dispensed": {}
        "cancelled" : {},
        "refunded" : {},
    }
}

function buildFsm(): Fsm<VendingMachineManifest> {
    let builder = new FsmBuilder<VendingMachineManifest>();

    builder.simpleState('idle')
        .transition('coin_inserted', 'ready_to_order', (ctx, event) => {
            return {
                balanceAmount: event.insertedAmount
            }
        });

    builder.simpleState('ready_to_order')
        .transition('item_selected', 'dispensing', retainContext)
        .transition('cancelled', 'refunding', retainContext)
        .transition('coin_inserted', 'ready_to_order', (ctx, event) => {
            return {
                balanceAmount: ctx.balanceAmount + event.insertedAmount
            }
        });

    builder.simpleState('dispensing')
        .transition('dispensed', 'idle', retainContext);

    builder.simpleState('refunding')
        .transition('refunded', 'idle', retainContext);

    return builder.build();
}
   
test("expect initial state to be idle", () => {
    let fsm = buildFsm();    
    fsm.init('idle', {});

    expect('idle').toBe(fsm.getCurrentState());

    fsm.processEvent('coin_inserted', {insertedAmount: 5})
});
